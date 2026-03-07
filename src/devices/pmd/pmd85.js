/**
 * PMD-85 Headless Emulator Module
 *
 * Encapsulates the full PMD-85 computer emulation: Intel 8080 CPU, 64 KB RAM,
 * ROM monitor, keyboard matrix, audio generation, LED state, and tape interface.
 *
 * This module has NO DOM dependencies — it exposes a frame-oriented API that
 * any host (browser page, test harness, Node.js script) can drive.
 *
 * @example
 * import { createPMD } from "./src/devices/pmd/pmd85.js";
 * const pmd = createPMD({ sampleRate: audioCtx.sampleRate });
 * pmd.reset();
 * // In animation/audio loop:
 * const { audio, leds } = pmd.frame(tStates, keyMatrix);
 * // Read VRAM: pmd.getRAM().subarray(0xC000, 0x10000)
 */

import create8080 from "../../8080.js";
import { MONITOR_ROM, EXTENSION_ROM } from "./pmd85-rom.js";

/**
 * CPU clock frequency in Hz (PMD-85 hardware spec).
 *
 * @type {number}
 */
const FCPU = 2000000;

/**
 * Create a new PMD-85 emulator instance.
 *
 * The instance is NOT initialized after creation — call reset() before frame().
 * This allows the host to start its animation loop immediately and handle the
 * uninitialized state gracefully via the { initialized: false } frame result.
 *
 * @param {object}     [options]            - Configuration options
 * @param {number}     [options.sampleRate] - Audio sample rate in Hz (default: 44100).
 *                                           Pass audioCtx.sampleRate for accurate sync.
 * @param {Uint8Array} [options.rom]        - Custom 4096-byte ROM image to load at 0x8000.
 *                                           If omitted, the built-in PMD-85 Monitor ROM is used.
 * @returns {object} PMD-85 emulator instance
 */
export const createPMD = (options = {}) => {
  const sampleRate = options.sampleRate ?? 44100;
  const customRom  = options.rom ?? null;

  // ── Memory ──────────────────────────────────────────────────────────────────

  /** Full 64 KB address space — RAM + ROM + VRAM all share this buffer. */
  const ram = new Uint8Array(65536);

  let initialized = false;

  // ── Port registers (8255 PPI equivalent) ────────────────────────────────────

  /** Port A register — keyboard column select, written by CPU via OUT 0xF4. */
  let PA = 0;
  /** Port C register — sound bits (0–2) + LED bits (3–5), written via OUT 0xF6. */
  let PC = 0;
  /** ROM bank low byte (port 0xF9). */
  let ROMPB = 0;
  /** ROM bank high byte / page (port 0xFA). Index = ROMPB + 256 * ROMPC. */
  let ROMPC = 0;

  // ── Audio state ─────────────────────────────────────────────────────────────

  /**
   * T-states per audio sample — precomputed ratio.
   * At 2 MHz CPU and 44100 Hz audio: ≈ 45.35 T-states/sample.
   */
  const tPerSample = FCPU / sampleRate;

  /**
   * Pre-allocated audio output buffer, reused every frame.
   * Sized for 30 fps minimum (largest possible frame).
   */
  // Sized for 10 fps worst-case headroom — ScriptProcessor at 48 kHz with
  // a 2048-sample buffer runs at ~23 fps, so this safely covers any host.
  const audioBuffer = new Float32Array(Math.ceil(sampleRate / 10) + 2);

  /**
   * Square wave counter for the ~4 kHz tone (period = 12 samples at 48 kHz).
   * Persists across frames to maintain phase continuity.
   */
  let kHz4 = 0;
  /**
   * Square wave counter for the ~1 kHz tone (period = 48 samples at 48 kHz).
   * Persists across frames to maintain phase continuity.
   */
  let kHz1 = 0;

  /** Active tone flags, updated from port 0xF6 sound events. */
  let s0 = false;
  let s1 = false;
  let s4 = false;

  /**
   * Flat sound event log for the current frame: [tOffset0, pcByte0, tOffset1, pcByte1, ...].
   * Populated by portOut(0xF6) during CPU execution, consumed by generateAudio().
   */
  let soundEvents = [];

  /** CPU T-state baseline at start of current frame, for computing event offsets. */
  let soundBaseT = 0;

  // ── LED state ───────────────────────────────────────────────────────────────

  /** Current LED states — updated from port 0xF6 bit field. */
  let leds = { r: false, y: false, g: false };

  // ── Keyboard ─────────────────────────────────────────────────────────────────

  /**
   * Keyboard matrix provided by the host before each frame.
   * Uint8Array(16): index = column (0–15), bits 0–4 = rows 0–4, bit set = pressed.
   * The module inverts this to produce active-low values for the CPU.
   */
  let currentKeyMatrix = new Uint8Array(16);

  // ── Tape ─────────────────────────────────────────────────────────────────────

  /** Data buffer for tape playback (read by CPU via IN port 0x1E). */
  let tapeReadBuffer = new Uint8Array(0);
  /** Current read position within tapeReadBuffer. */
  let tapeReadPos = 0;
  /** Accumulates bytes written by CPU via OUT port 0x1E during active recording. */
  const tapeWriteBuf = [];
  /**
   * Tape transport state flags.
   * The PMD-85 monitor polls port 0x1F bit 1 waiting for "motor running" before
   * reading or writing tape data. Without explicit play/record, the CPU loops forever.
   */
  let tapePlayback  = false;
  let tapeRecording = false;

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
   * Writes to 0x8000–0xBFFF are silently ignored — the ROM monitor occupies
   * 4 KB at 0x8000–0x8FFF and mirrors three times to fill 0x8000–0xBFFF
   * (hardware address lines A12/A13 of the ROM chip are unconnected).
   *
   * @param {number} addr - 16-bit address
   * @param {number} val  - Byte value (0–255)
   */
  const byteTo = (addr, val) => {
    if (addr >= 0x8000 && addr < 0xC000) return;
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
    switch (port & 0xFF) {
      case 0xF4: return PA;
      case 0xF5: return (~currentKeyMatrix[PA & 0x0F]) & 0xFF;  // active-low keyboard
      case 0xF6: return PC;
      case 0xF8: return (EXTENSION_ROM[ROMPB + 256 * ROMPC] ?? 0xFF);
      case 0xF9: return ROMPB;
      case 0xFA: return ROMPC;
      case 0x1E:
        // Return data only when transport is actively playing
        if (!tapePlayback) return 0x00;
        return tapeReadPos < tapeReadBuffer.length
          ? tapeReadBuffer[tapeReadPos++]
          : 0x00;
      case 0x1F:
        // Bit 0: tape ready (always 1)
        // Bit 1: motor running — set only when play or record is active
        // PMD-85 monitor polls this bit before reading/writing data
        return 0x01 | (tapePlayback || tapeRecording ? 2 : 0);
      default:
        return 0xFF;
    }
  };

  /**
   * Handle CPU OUT (port write) instructions.
   *
   * @param {number} port - Port number (0–255)
   * @param {number} val  - Byte value (0–255)
   */
  const portOut = (port, val) => {
    switch (port & 0xFF) {
      case 0xF4:
        PA = val;
        break;
      case 0xF6:
        PC = val;
        // Record sound event as T-state offset from frame start
        soundEvents.push(cpu.T() - soundBaseT, val & 7);
        // Update LEDs: bit 3 = red, bits 0–2 nonzero = yellow
        leds = { r: (val & 8) > 0, y: (val & 7) > 0, g: false };
        break;
      case 0xF8:
        // ROMPA register — unused in standard PMD-85 (only ROMPB+ROMPC are used)
        break;
      case 0xF9:
        ROMPB = val;
        break;
      case 0xFA:
        ROMPC = val;
        break;
      case 0x1E:
        // Write data only when transport is in recording mode
        if (tapeRecording) tapeWriteBuf.push(val & 0xFF);
        break;
    }
  };

  // ── CPU ──────────────────────────────────────────────────────────────────────

  const cpu = create8080({ byteAt, byteTo, portIn, portOut });

  // ── Audio generation ─────────────────────────────────────────────────────────

  /**
   * Downsample the collected sound events into a Float32Array of audio samples.
   *
   * Two square-wave tone generators (matching PMD-85 hardware):
   *   - ~4 kHz: 12-sample period, output = 0.3 when counter > 6 (50% duty)
   *   - ~1 kHz: 48-sample period, output = 0.3 when counter > 24 (50% duty)
   *   - s0: direct amplitude 0.3 (overrides both)
   *
   * kHz4/kHz1 counters persist across frames for phase continuity.
   *
   * @param {number} tStates - T-states executed this frame (determines sample count)
   * @returns {Float32Array} View into the pre-allocated audioBuffer (no allocation)
   */
  const generateAudio = (tStates) => {
    const numSamples = Math.ceil(tStates / tPerSample);
    let evIdx = 0;

    for (let i = 0; i < numSamples; i++) {
      const tAt = i * tPerSample;

      // Apply all sound events that occurred before this sample's T-state position
      while (evIdx < soundEvents.length && soundEvents[evIdx] <= tAt) {
        const bits = soundEvents[evIdx + 1];
        s1 = (bits & 1) !== 0;
        s4 = (bits & 2) !== 0;
        s0 = (bits & 4) !== 0;
        evIdx += 2;
      }

      // Generate sample value
      let sample = 0;
      if (s4) sample  = kHz4 > 6  ? 0.3 : 0;
      if (s1) sample += kHz1 > 24 ? 0.3 : 0;
      if (s0) sample  = 0.3;
      audioBuffer[i] = sample;

      // Advance tone counters (wrap maintains correct frequency)
      kHz4 = (kHz4 + 1) % 12;
      kHz1 = (kHz1 + 1) % 48;
    }

    // Return a view — no copy, zero allocation
    return audioBuffer.subarray(0, numSamples);
  };

  // ── Public API ───────────────────────────────────────────────────────────────

  return {

    /**
     * Reset the emulator to power-on state.
     *
     * - Clears all RAM
     * - Loads ROM monitor into 0x8000–0xBFFF (4× mirrored, matching hardware)
     * - Resets CPU: PC=0x8000, SP=0x7FFF, all registers 0
     * - Clears port registers, audio state, and LED state
     * - Does NOT clear tape buffers (tape persists across resets, matching hardware)
     */
    reset() {
      ram.fill(0);
      const rom = customRom ?? MONITOR_ROM;
      // Mirror the 4 KB ROM across all four 4 KB slots in 0x8000–0xBFFF,
      // matching PMD-85 hardware where A12/A13 of the ROM chip are unconnected.
      const romSlice = rom.subarray(0, 4096);
      for (let mirror = 0; mirror < 4; mirror++) {
        ram.set(romSlice, 0x8000 + mirror * 0x1000);
      }
      cpu.reset();
      cpu.set("PC", 0x8000);
      cpu.set("SP", 0x7FFF);
      PA = 0; PC = 0; ROMPB = 0; ROMPC = 0;
      soundEvents = [];
      soundBaseT = 0;
      kHz4 = 0; kHz1 = 0;
      s0 = false; s1 = false; s4 = false;
      leds = { r: false, y: false, g: false };
      tapePlayback  = false;
      tapeRecording = false;
      initialized = true;
    },

    /**
     * Execute one animation frame worth of CPU cycles and return audio + state.
     *
     * If called before reset(), returns { initialized: false } without executing
     * any CPU instructions. This allows the host to start its loop before reset.
     *
     * @param {number}     tStates   - Number of T-states to execute.
     *                                 Typical: Math.floor(FCPU / fps) e.g. 40000 at 50 fps.
     * @param {Uint8Array} keyMatrix - Keyboard state, 16 bytes. Index = column (0–15),
     *                                 bits 0–4 = rows 0–4, bit set = key pressed.
     *                                 Filled by host from physical keyboard events.
     * @returns {{ initialized: false }
     *          |{ initialized: true, audio: Float32Array, leds: {r:bool,y:bool,g:bool} }}
     */
    frame(tStates, keyMatrix) {
      if (!initialized) return { initialized: false };
      currentKeyMatrix = keyMatrix;
      soundBaseT = cpu.T();
      soundEvents = [];
      cpu.steps(tStates);
      const audio = generateAudio(tStates);
      return { initialized: true, audio, leds: { ...leds } };
    },

    /**
     * Execute a given number of T-states without generating audio.
     * Useful for step-mode debugging while keeping the display live.
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
     * @param {string} reg   - Register name, case-insensitive: "A","B","C","D","E",
     *                         "H","L","F","PC","SP"
     * @param {number} value - Byte (0–255) for 8-bit registers; word (0–65535) for PC/SP
     */
    setCpuRegister: (reg, value) => cpu.set(reg, value),

    /**
     * Get a direct reference to the full 64 KB RAM buffer.
     *
     * This is the SAME Uint8Array reference on every call — zero-copy access.
     * Video RAM occupies 0xC000–0xFFFF. Each byte encodes 6 pixels:
     *   bits 0–5: pixel data (bit 0 = leftmost pixel)
     *   bit 6:    brightness (1 = full, 0 = dim)
     *   bit 7:    blink flag (host decides when to blank)
     *
     * @returns {Uint8Array} 65536-byte RAM buffer (direct reference, not a copy)
     */
    getRAM: () => ram,

    /**
     * Tape interface for cassette emulation.
     *
     * Read and write buffers are independent and can both be active simultaneously.
     */
    tape: {

      /**
       * Load a tape image for playback.
       * Resets the read pointer to the beginning of the provided data.
       * Does NOT automatically start playback — call play() separately.
       *
       * @param {Uint8Array} data - Tape data bytes to play back
       */
      setReadBuffer: (data) => {
        tapeReadBuffer = data;
        tapeReadPos = 0;
      },

      /**
       * Start tape playback (equivalent to pressing Play on the cassette deck).
       *
       * Sets port 0x1F bit 1 = 1 ("motor running"), which releases the PMD-85
       * monitor from its wait loop. The CPU can then read data via IN port 0x1E.
       * Stops recording if it was active.
       */
      play: () => {
        tapePlayback  = true;
        tapeRecording = false;
      },

      /**
       * Start tape recording (equivalent to pressing Record on the cassette deck).
       *
       * Sets port 0x1F bit 1 = 1 ("motor running") and clears the write buffer.
       * The CPU can then write data via OUT port 0x1E.
       * Stops playback if it was active.
       */
      record: () => {
        tapeRecording = true;
        tapePlayback  = false;
        tapeWriteBuf.length = 0;
      },

      /**
       * Stop the tape transport (equivalent to pressing Stop on the cassette deck).
       *
       * Clears port 0x1F bit 1. The CPU monitor will stop reading/writing.
       */
      stop: () => {
        tapePlayback  = false;
        tapeRecording = false;
      },

      /**
       * Rewind the tape to the beginning (reset read pointer to 0).
       * Does not stop playback or clear the buffer.
       */
      rewind: () => { tapeReadPos = 0; },

      /**
       * Get the current read position within the playback buffer.
       *
       * @returns {number} Byte index of the next byte to be read
       */
      readPos: () => tapeReadPos,

      /** @returns {boolean} True if transport is in playback mode */
      isPlaying:   () => tapePlayback,
      /** @returns {boolean} True if transport is in recording mode */
      isRecording: () => tapeRecording,

      /**
       * Get all bytes written by the CPU to port 0x1E (tape recording).
       * Returns a new Uint8Array copy each call.
       *
       * @returns {Uint8Array} Recorded tape data
       */
      getWriteBuffer: () => new Uint8Array(tapeWriteBuf),

      /**
       * Clear the tape write buffer (discard all recorded data).
       */
      clearWriteBuffer: () => { tapeWriteBuf.length = 0; },
    },
  };
};
