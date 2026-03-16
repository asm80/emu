/**
 * PMI-80 Headless Emulator Module
 *
 * Encapsulates the full PMI-80 computer emulation: Intel 8080 CPU, 64 KB RAM,
 * 1 KB Monitor ROM, 9-digit 8-segment display, 25-key matrix keyboard,
 * timing-based cassette interface, and 1-bit PB0 audio output.
 *
 * This module has NO DOM dependencies — it exposes a frame-oriented API that
 * any host (browser page, test harness, Node.js script) can drive.
 *
 * @example
 * import { createPMI } from "./src/devices/pmi/pmi80.js";
 * const pmi = createPMI({ sampleRate: audioCtx.sampleRate });
 * pmi.reset();
 * // In audio/animation loop:
 * const { display, audio } = pmi.frame(tStates, { kb0: false, kb1: true, ... });
 */

import create8080 from "../../8080.js";
import { MONITOR_ROM } from "./pmi80-rom.js";

/**
 * CPU clock frequency in Hz (PMI-80 hardware spec).
 *
 * @type {number}
 */
const FCPU = 1108000;

/**
 * All valid key names for the PMI-80 keyboard matrix.
 * Pass these as keys in the keyMatrix object to frame().
 * Note: kbi (Interrupt) and kbre (Reset) are handled outside frame() by the host.
 *
 * @type {string[]}
 */
export const KEY_NAMES = [
  "kb0","kb1","kb2","kb3","kb4","kb5","kb6","kb7","kb8","kb9",
  "kba","kbb","kbc","kbd","kbe","kbf",
  "kbeq","kbs","kbl","kbm","kbbr","kbr","kbex","kbi","kbre",
];

/**
 * Create a new PMI-80 emulator instance.
 *
 * The instance is NOT initialized after creation — call reset() before frame().
 * This allows the host to start its audio loop immediately and handle the
 * uninitialized state gracefully via the { initialized: false } frame result.
 *
 * @param {object}     [options]            - Configuration options
 * @param {number}     [options.sampleRate] - Audio sample rate in Hz (default: 44100).
 *                                           Pass audioCtx.sampleRate for accurate sync.
 * @param {Uint8Array} [options.rom]        - Custom 1024-byte ROM image to load at 0x0000.
 *                                           If omitted, the built-in PMI-80 Monitor ROM is used.
 * @returns {object} PMI-80 emulator instance
 */
export const createPMI = (options = {}) => {
  const sampleRate = options.sampleRate ?? 44100;
  const customRom  = options.rom ?? null;

  // ── Memory ──────────────────────────────────────────────────────────────────

  /** Full 64 KB address space. ROM at 0x0000–0x03FF is enforced read-only in byteTo. */
  const ram = new Uint8Array(65536);

  let initialized = false;

  // ── Port registers (8255 PPI equivalent) ────────────────────────────────────

  /** Port A — segment data written by CPU via OUT 0xF8. Active-low: segment = 255 - PA. */
  let PA = 0;
  /** Port B — bit0 drives 1-bit audio speaker, written via OUT 0xF9. */
  let PB = 0;
  /** Port C — lower nibble = digit address, written via OUT 0xFA. */
  let PC = 0;

  // ── Display state ────────────────────────────────────────────────────────────

  /**
   * Per-digit segment state snapshot for the current frame.
   * Index = digit position (0 = leftmost). Value = null (not written this frame)
   * or 0–255 (segment bitmask: bit0=a, bit1=b, …, bit6=g, bit7=dp).
   * Updated on OUT 0xF8 only when the PC port was written since the last PA write
   * (see paGated). Reset to null at the start of each frame().
   */
  const displayState = new Array(9).fill(null);

  /**
   * Gate flag for display updates.
   *
   * The PMI-80 monitor display routine always writes PA=0x7F (all-segments-off)
   * BEFORE updating PC to the new digit address, then writes the real segment data
   * to PA. Without filtering, the blank write would corrupt the previous digit's
   * state (it fires with the old PC address still set).
   *
   * Rule: only update displayState when PA is written AND PC was written since the
   * last PA write. This ensures only the intended segment data (step 3) updates the
   * display, not the intermediate blank (step 1).
   *
   * Initialized to true so that custom programs writing PA without a preceding PC
   * write still work at startup (PC=0 maps to segment 15 which is out-of-range, so
   * the first blank write is safely discarded anyway).
   */
  let paGated = true;

  // ── Audio state ──────────────────────────────────────────────────────────────

  /**
   * T-states per audio sample — precomputed ratio.
   * At 1.108 MHz and 44100 Hz: ≈ 25.1 T-states/sample.
   */
  const tPerSample = FCPU / sampleRate;

  /** Pre-allocated audio output buffer, reused every frame (zero allocation per frame). */
  const audioBuffer = new Float32Array(Math.ceil(sampleRate / 10) + 2);

  /**
   * Current state of PB0 (1-bit speaker output). Persists across frames for
   * phase continuity: a partial high pulse at the end of one frame continues
   * into the next.
   */
  let pb0 = false;

  /**
   * PB0 state at the start of the current frame. Captured before cpu.steps() so
   * generateAudio() knows the initial level before the first transition event.
   */
  let pb0FrameStart = false;

  /**
   * Flat audio event log for the current frame: [tOffset0, bit0, tOffset1, bit1, ...].
   * Populated by portOut(0xF9) when PB0 transitions. Consumed by generateAudio().
   */
  let audioEvents = [];

  /** CPU T-state baseline at start of current frame, for computing event offsets. */
  let audioBaseT = 0;

  // ── Keyboard ─────────────────────────────────────────────────────────────────

  /**
   * Key state provided by the host for the current frame.
   * Plain object: { kb0: bool, kb1: bool, ..., kbf: bool, kbeq: bool, ... }.
   * Unknown keys and missing keys are treated as false (not pressed).
   */
  let currentKeys = {};

  // ── Tape (timing-based, matching emuPMI.js mgo/mgi pattern) ─────────────────

  /**
   * Interval array: T-state durations between successive bit7-PA transitions.
   * Element 0 is the initial delay before playback starts (default: 30000 T-states).
   * Populated during recording; loaded via tape.setReadBuffer() for playback.
   */
  let tapeIntervals = [];

  let tapeRecording = false;
  let tapePlayback  = false;

  // Recording state
  /** Waiting for first high pulse before starting to record intervals. */
  let tapeMgwait = true;
  /** T-state of the last recorded transition. */
  let tapeMgt = 0;
  /** Bit7 value at the last recorded transition (0 or 0x80). */
  let tapeMglast = 0;

  // Playback state (mgi-equivalent)
  /** T-state reference at last mgi() call; 0 = not yet initialized for this playback. */
  let tapeMgpt = 0;
  /** Remaining T-states until the next transition. */
  let tapeMgdelay = 0;
  /** Current output bit (0x00 or 0x80). Starts high when stopped (idle). */
  let tapeMgplast = 0x80;
  /** Current position in tapeIntervals (playback). */
  let tapeMgpos = 0;

  // ── Keyboard decode ──────────────────────────────────────────────────────────

  /**
   * Decode keyboard matrix from current PC address bits and currentKeys.
   * Matches PMIKB() from old/devices/emuPMI.js.
   *
   * @param {number} pc - Current value of PC port register (OUT 0xFA)
   * @returns {number} 3-bit value (bits 0–2), active-low: 0 = pressed
   */
  const decodeKeyboard = (pc) => {
    const segment = 15 - (pc & 0x0F);
    const k = currentKeys;
    switch (segment) {
      case 8: return (k.kbeq ? 0 : 1) + (k.kb3 ? 0 : 2) + (k.kb1 ? 0 : 4);
      case 7: return 1                 + (k.kb7 ? 0 : 2) + (k.kb5 ? 0 : 4);
      case 6: return 1                 + (k.kbb ? 0 : 2) + (k.kb9 ? 0 : 4);
      case 5: return (k.kbm  ? 0 : 1) + (k.kbe ? 0 : 2) + (k.kbc ? 0 : 4);
      case 4: return (k.kbbr ? 0 : 1) + (k.kbf ? 0 : 2) + (k.kbd ? 0 : 4);
      case 3: return 1                 + (k.kbr ? 0 : 2) + (k.kbex ? 0 : 4);
      case 2: return (k.kbl  ? 0 : 1) + (k.kba ? 0 : 2) + (k.kb8 ? 0 : 4);
      case 1: return (k.kbs  ? 0 : 1) + (k.kb6 ? 0 : 2) + (k.kb4 ? 0 : 4);
      case 0: return 1                 + (k.kb2 ? 0 : 2) + (k.kb0 ? 0 : 4);
      default: return 7;
    }
  };

  // ── Tape helpers ─────────────────────────────────────────────────────────────

  /**
   * Record tape signal from PA bit7 transition (mgo-equivalent).
   * Called on every OUT 0xF8 during active recording.
   *
   * @param {number} pa - Value written to port 0xF8
   * @param {number} T  - Current CPU T-state counter
   */
  const tapeOut = (pa, T) => {
    if (!tapeRecording) return;
    const bit7 = pa & 0x80;
    if (tapeMgwait) {
      // Wait for first high pulse before starting to record
      if (bit7) {
        tapeMgt    = T;
        tapeMgwait = false;
        tapeMglast = 0x80;
      }
      return;
    }
    if (bit7 !== tapeMglast) {
      tapeIntervals.push(T - tapeMgt);
      tapeMglast = bit7;
      tapeMgt    = T;
    }
  };

  /**
   * Read tape signal for CPU (mgi-equivalent).
   * Called on every IN 0xFA during active playback.
   * Returns 0x80 (high) when not playing (idle).
   *
   * @param {number} T - Current CPU T-state counter
   * @returns {number} 0x00 or 0x80 — current tape bit
   */
  const tapeIn = (T) => {
    if (!tapePlayback) return 0x80;
    if (tapeMgpt === 0) tapeMgpt = T;   // initialize on first call after play()
    const diff = T - tapeMgpt;
    tapeMgdelay -= diff;
    tapeMgpt = T;
    if (tapeMgdelay > 0) return tapeMgplast;
    tapeMgdelay = tapeIntervals[tapeMgpos++] ?? 0;
    tapeMgplast ^= 0x80;
    if (tapeMgpos > tapeIntervals.length) tapePlayback = false;
    return tapeMgplast;
  };

  // ── Memory callbacks ─────────────────────────────────────────────────────────

  /**
   * Read a byte from the address space.
   *
   * @param {number} addr - 16-bit address
   * @returns {number} Byte value (0–255)
   */
  const byteAt = (addr) => ram[addr] || 0;

  /**
   * Write a byte to the address space.
   * Writes to 0x0000–0x03FF (ROM) are silently ignored.
   *
   * @param {number} addr - 16-bit address
   * @param {number} val  - Byte value (0–255)
   */
  const byteTo = (addr, val) => {
    if (addr < 0x0400) return;
    ram[addr] = val & 0xFF;
  };

  // ── I/O port callbacks ───────────────────────────────────────────────────────

  /**
   * Handle CPU IN (port read) instructions.
   *
   * @param {number} port - Port number (0–255)
   * @returns {number} Byte value (0–255); defaults to 0xFF for unmapped ports
   */
  const portIn = (port) => {
    if ((port & 0xFF) === 0xFA) {
      const kb      = decodeKeyboard(PC);
      const tapeBit = tapeIn(cpu.T());
      // Upper nibble: keyboard bits [6:4]; lower nibble: 0x0F; bit7: tape
      return (kb << 4) | 0x0F | tapeBit;
    }
    return 0xFF;
  };

  /**
   * Handle CPU OUT (port write) instructions.
   *
   * @param {number} port - Port number (0–255)
   * @param {number} val  - Byte value (0–255)
   */
  const portOut = (port, val) => {
    switch (port & 0xFF) {
      case 0xF8: {
        PA = val;
        // Update display only when PC was written since the last PA write.
        // This skips the intermediate PA=0x7F blank that the monitor inserts
        // before changing the digit address (see paGated declaration above).
        if (paGated) {
          const segment = 15 - (PC & 0x0F);
          if (segment >= 0 && segment <= 8) {
            displayState[segment] = (255 - val) & 0x7F;  // bit7 (dp) always 0
          }
          paGated = false;
        }
        // Detect PA bit7 transition for tape recording (regardless of paGated)
        tapeOut(PA, cpu.T());
        break;
      }
      case 0xF9: {
        // Detect PB0 transition for audio
        const newPb0 = (val & 1) !== 0;
        if (newPb0 !== pb0) {
          audioEvents.push(cpu.T() - audioBaseT, newPb0 ? 1 : 0);
          pb0 = newPb0;
        }
        PB = val;
        break;
      }
      case 0xFA:
        PC = val;
        paGated = true;   // arm display gate: next PA write carries real segment data
        break;
      case 0xFB:
        // PPI control register — stored but has no further effect in this emulation
        break;
    }
  };

  // ── CPU ──────────────────────────────────────────────────────────────────────

  const cpu = create8080({ byteAt, byteTo, portIn, portOut });

  // ── Audio generation ─────────────────────────────────────────────────────────

  /**
   * Generate audio samples for the current frame from PB0 transition events.
   *
   * PB0 is a 1-bit speaker: output = 0.3 when bit is high, 0 when low.
   * Events are sorted by T-state offset (guaranteed by execution order).
   * pb0FrameStart holds the PB0 state at the start of this frame.
   *
   * @param {number} tStates - T-states executed this frame
   * @returns {Float32Array} View into pre-allocated audioBuffer (no allocation)
   */
  const generateAudio = (tStates) => {
    const numSamples = Math.ceil(tStates / tPerSample);
    let evIdx = 0;
    let curBit = pb0FrameStart ? 1 : 0;

    for (let i = 0; i < numSamples; i++) {
      const tAt = i * tPerSample;
      // Apply all transitions that occurred before this sample's T-position
      while (evIdx < audioEvents.length && audioEvents[evIdx] <= tAt) {
        curBit = audioEvents[evIdx + 1];
        evIdx += 2;
      }
      audioBuffer[i] = curBit ? 0.3 : 0;
    }

    return audioBuffer.subarray(0, numSamples);
  };

  // ── Public API ───────────────────────────────────────────────────────────────

  return {

    /**
     * Reset the emulator to power-on state.
     *
     * - Clears all RAM
     * - Loads Monitor ROM into 0x0000–0x03FF (1 KB)
     * - Resets CPU: PC=0x0000, all registers 0
     * - Clears port registers, display state, and audio state
     * - Does NOT clear tape buffers (tape persists across resets, matching hardware)
     */
    reset() {
      ram.fill(0);
      const rom = customRom ?? MONITOR_ROM;
      ram.set(rom.subarray(0, 1024), 0x0000);
      cpu.reset();
      cpu.set("PC", 0x0000);
      PA = 0; PB = 0; PC = 0;
      paGated = true;
      displayState.fill(null);
      audioEvents = [];
      audioBaseT  = 0;
      pb0         = false;
      pb0FrameStart = false;
      initialized = true;
    },

    /**
     * Execute one frame worth of CPU cycles and return display + audio state.
     *
     * If called before reset(), returns { initialized: false } without executing
     * any CPU instructions. This allows the host to start its loop before reset.
     *
     * @param {number} tStates   - Number of T-states to execute.
     * @param {object} keyMatrix - Key state: { kb0: bool, kb1: bool, ... }.
     *                             Missing keys default to false. kbi/kbre are ignored
     *                             (handled by the host via interrupt(0x38) / reset()).
     * @returns {{ initialized: false }
     *          |{ initialized: true,
     *             display: Array<number|null>,
     *             audio: Float32Array }}
     */
    frame(tStates, keyMatrix) {
      if (!initialized) return { initialized: false };
      currentKeys   = keyMatrix ?? {};
      audioBaseT    = cpu.T();
      audioEvents   = [];
      pb0FrameStart = pb0;
      displayState.fill(null);
      cpu.steps(tStates);
      const audio = generateAudio(tStates);
      return {
        initialized: true,
        display: [...displayState],
        audio,
      };
    },

    /**
     * Execute a given number of T-states without generating audio or display data.
     *
     * @param {number} tStates - Number of T-states to execute
     */
    steps: (tStates) => cpu.steps(tStates),

    /**
     * Execute exactly one CPU instruction.
     *
     * @returns {number} Number of T-states consumed by the instruction
     */
    cpuSingleStep: () => cpu.singleStep(),

    /**
     * Get a snapshot of all CPU registers.
     *
     * @returns {{ pc: number, sp: number, a: number, b: number, c: number,
     *             d: number, e: number, h: number, l: number, f: number }}
     */
    getCpuStatus: () => cpu.status(),

    /**
     * Set a CPU register by name.
     *
     * @param {string} reg   - Register name: "A","B","C","D","E","H","L","F","PC","SP"
     * @param {number} value - Value (0–255 for 8-bit; 0–65535 for PC/SP)
     */
    setCpuRegister: (reg, value) => cpu.set(reg, value),

    /**
     * Trigger a hardware interrupt.
     *
     * @param {number} vector - Interrupt vector byte (e.g. 0xFF for RST 7 = 0x38)
     */
    interrupt: (vector) => cpu.interrupt(vector),

    /**
     * Get a direct reference to the full 64 KB RAM buffer (zero-copy).
     *
     * @returns {Uint8Array} 65536-byte RAM buffer
     */
    getRAM: () => ram,

    /**
     * Tape interface for cassette emulation (timing-based interval format).
     *
     * The .pmitape format is a JSON array of T-state interval numbers.
     * Element 0 is the initial delay before the first transition.
     * Recording automatically prepends a 30000 T-state leader interval.
     */
    tape: {

      /**
       * Load an interval array for playback.
       * Resets the playback pointer to the beginning.
       * Does NOT automatically start playback — call play() separately.
       *
       * @param {number[]} intervals - Array of T-state intervals between bit7 transitions
       */
      setReadBuffer: (intervals) => {
        tapeIntervals = intervals;
        tapeMgpos     = 0;
      },

      /**
       * Start playback. Resets internal timing state.
       * Stops recording if active.
       */
      play: () => {
        tapePlayback  = true;
        tapeRecording = false;
        tapeMgplast   = 0x00;   // starts low, matching emuPMI mgplay()
        tapeMgpt      = 0;      // will be initialized on first tapeIn() call
        tapeMgpos     = 1;      // skip element 0 (leader delay), apply as initial delay
        tapeMgdelay   = tapeIntervals[0] ?? 0;
      },

      /**
       * Start recording. Clears the interval buffer and waits for the first
       * high pulse on PA bit7. Stops playback if active.
       * The buffer is pre-seeded with a 30000 T-state leader interval (matches emuPMI).
       */
      record: () => {
        tapeRecording = true;
        tapePlayback  = false;
        tapeIntervals = [30000];
        tapeMgwait    = true;
        tapeMgt       = 0;
        tapeMglast    = 0;
      },

      /**
       * Stop tape transport. Both playback and recording become inactive.
       */
      stop: () => {
        tapePlayback  = false;
        tapeRecording = false;
      },

      /**
       * Rewind to the beginning (reset playback pointer to position 0).
       * Does not stop playback.
       */
      rewind: () => { tapeMgpos = 0; },

      /**
       * Get the recorded interval array (copy).
       *
       * @returns {number[]} Copy of the recorded interval array
       */
      getRecorded: () => [...tapeIntervals],

      /**
       * Clear the recorded interval array.
       */
      clearRecorded: () => { tapeIntervals = []; },

      /** @returns {boolean} True if transport is in playback mode */
      isPlaying:   () => tapePlayback,

      /** @returns {boolean} True if transport is in recording mode */
      isRecording: () => tapeRecording,

      /** @returns {number} Current playback position (interval index) */
      getPlayPos: () => tapeMgpos,

      /** @returns {number} Total number of intervals in the tape buffer */
      getTapeLength: () => tapeIntervals.length,
    },
  };
};
