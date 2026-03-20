/**
 * ZX Spectrum 48k / 128k Headless Emulator
 *
 * Encapsulates a complete ZX Spectrum emulation: Zilog Z80 CPU, ULA
 * (border/video/keyboard), beeper audio, AY-3-8912 PSG (128k), ROM,
 * RAM with optional bank-switching (128k), and SNA snapshot support.
 *
 * No DOM dependencies — exposes a frame-oriented API.
 *
 * @example
 * import { createZXS } from "./src/devices/zxs/zxspectrum.js";
 * const zxs = createZXS({ model: "128k", sampleRate: audioCtx.sampleRate });
 * zxs.reset();
 * const { video, audio, borderColor } = zxs.frame(69888, keyMatrix);
 *
 * @module zxspectrum
 */

import createZ80 from "../../z80.js";
import { createAY } from "../ay3891x/ay3891x.js";
import { ROM_48, ROM_128_0, ROM_128_1 } from "./zxs-rom.js";

// ── Machine constants ────────────────────────────────────────────────────────

const FCPU_48  = 3500000;
const FCPU_128 = 3546900;

const SCANLINE_TSTATES_48  = 224;
const SCANLINE_TSTATES_128 = 228;

const SCANLINES      = 312;   // total scanlines including vertical retrace
const TOP_BORDER     = 48;
const ACTIVE_LINES   = 192;
const BOTTOM_BORDER  = 56;
const LEFT_BORDER_PX = 48;
const VISIBLE_LINES  = TOP_BORDER + ACTIVE_LINES + BOTTOM_BORDER;  // 296

// Visible display dimensions (no retrace, no horizontal blanking)
const SCREEN_W    = LEFT_BORDER_PX + 256 + LEFT_BORDER_PX;  // 352
const SCREEN_H    = VISIBLE_LINES;                           // 296
const VIDEO_BYTES = SCREEN_W * SCREEN_H * 4;                // 352×296×4 = 416384

/** ZX Spectrum 16-color RGBA palette (8 normal + 8 bright), little-endian RGBA. */
const ZX_PALETTE_RGBA = new Uint32Array(16);
(() => {
  // Normal colors: black, blue, red, magenta, green, cyan, yellow, white
  const colors = [
    [0,0,0], [0,0,215], [215,0,0], [215,0,215],
    [0,215,0], [0,215,215], [215,215,0], [215,215,215],
  ];
  // Bright colors
  const bright = [
    [0,0,0], [0,0,255], [255,0,0], [255,0,255],
    [0,255,0], [0,255,255], [255,255,0], [255,255,255],
  ];
  for (let i = 0; i < 8; i++) {
    const [r, g, b] = colors[i];
    ZX_PALETTE_RGBA[i]     = (0xFF << 24) | (b << 16) | (g << 8) | r;
    const [br, bg, bb] = bright[i];
    ZX_PALETTE_RGBA[i + 8] = (0xFF << 24) | (bb << 16) | (bg << 8) | br;
  }
})();

// ── Tape constants ────────────────────────────────────────────────────────────

const PILOT_PULSE     = 2168;
const SYNC1_PULSE     = 667;
const SYNC2_PULSE     = 735;
const BIT0_PULSE      = 855;
const BIT1_PULSE      = 1710;
const PILOT_HEADER    = 8063;
const PILOT_DATA      = 3223;
const PAUSE_MS_TSTATES = 3500;  // T-states per millisecond at 3.5 MHz

/**
 * Convert a TAP file to a flat array of T-state edge durations.
 *
 * Each element is the number of T-states until the next signal edge.
 * The signal toggles at each edge.
 *
 * @param {Uint8Array} data - Raw TAP file bytes
 * @returns {Uint32Array} Edge duration array
 */
const parseTAPtoEdges = (data) => {
  const edges = [];
  let i = 0;
  while (i + 2 <= data.length) {
    const blockLen = data[i] | (data[i + 1] << 8);
    i += 2;
    if (blockLen === 0 || i + blockLen > data.length) break;
    const isHeader = data[i] === 0x00;
    const pilotLen = isHeader ? PILOT_HEADER : PILOT_DATA;
    for (let p = 0; p < pilotLen; p++) edges.push(PILOT_PULSE);
    edges.push(SYNC1_PULSE, SYNC2_PULSE);
    for (let b = 0; b < blockLen; b++) {
      const byte = data[i + b];
      for (let bit = 7; bit >= 0; bit--) {
        const pulse = (byte >> bit) & 1 ? BIT1_PULSE : BIT0_PULSE;
        edges.push(pulse, pulse);
      }
    }
    edges.push(3500000);  // inter-block pause (~1 second)
    i += blockLen;
  }
  return new Uint32Array(edges);
};

/**
 * Convert a TZX file to a flat array of T-state edge durations.
 *
 * Handles block types: 0x10 (standard), 0x11 (turbo), 0x12 (pure tone),
 * 0x13 (pulse sequence), 0x14 (pure data), 0x20 (pause). Others are skipped.
 *
 * @param {Uint8Array} data - Raw TZX file bytes
 * @returns {Uint32Array} Edge duration array
 */
const parseTZXtoEdges = (data) => {
  // Validate header: "ZXTape!" + 0x1A
  if (data.length < 10 || String.fromCharCode(...data.subarray(0, 7)) !== "ZXTape!" || data[7] !== 0x1A) {
    return new Uint32Array(0);
  }

  const edges = [];
  let i = 10;  // skip header (10 bytes)

  const pushDataBits = (bytes, offset, count, bit0, bit1) => {
    for (let b = 0; b < count; b++) {
      const bitsInByte = (b === count - 1 && bytes._usedBits) ? bytes._usedBits : 8;
      const byte = bytes[offset + b];
      for (let bit = 7; bit >= 8 - bitsInByte; bit--) {
        const pulse = (byte >> bit) & 1 ? bit1 : bit0;
        edges.push(pulse, pulse);
      }
    }
  };

  while (i < data.length) {
    const blockType = data[i++];

    if (blockType === 0x10) {
      // Standard speed data block
      const pauseMs  = data[i] | (data[i + 1] << 8);
      const dataLen  = data[i + 2] | (data[i + 3] << 8);
      const isHeader = data[i + 4] === 0x00;
      const pilotLen = isHeader ? PILOT_HEADER : PILOT_DATA;
      for (let p = 0; p < pilotLen; p++) edges.push(PILOT_PULSE);
      edges.push(SYNC1_PULSE, SYNC2_PULSE);
      for (let b = 0; b < dataLen; b++) {
        const byte = data[i + 4 + b];
        for (let bit = 7; bit >= 0; bit--) {
          const pulse = (byte >> bit) & 1 ? BIT1_PULSE : BIT0_PULSE;
          edges.push(pulse, pulse);
        }
      }
      if (pauseMs > 0) edges.push(pauseMs * PAUSE_MS_TSTATES);
      i += 4 + dataLen;

    } else if (blockType === 0x11) {
      // Turbo speed data block
      const pilotPulse = data[i] | (data[i + 1] << 8);
      const sync1      = data[i + 2] | (data[i + 3] << 8);
      const sync2      = data[i + 4] | (data[i + 5] << 8);
      const bit0       = data[i + 6] | (data[i + 7] << 8);
      const bit1       = data[i + 8] | (data[i + 9] << 8);
      const pilotLen   = data[i + 10] | (data[i + 11] << 8);
      const usedBits   = data[i + 12];
      const pauseMs    = data[i + 13] | (data[i + 14] << 8);
      const dataLen    = data[i + 15] | (data[i + 16] << 8) | (data[i + 17] << 16);
      for (let p = 0; p < pilotLen; p++) edges.push(pilotPulse);
      edges.push(sync1, sync2);
      for (let b = 0; b < dataLen; b++) {
        const bitsInByte = (b === dataLen - 1) ? usedBits : 8;
        const byte = data[i + 18 + b];
        for (let bit = 7; bit >= 8 - bitsInByte; bit--) {
          const pulse = (byte >> bit) & 1 ? bit1 : bit0;
          edges.push(pulse, pulse);
        }
      }
      if (pauseMs > 0) edges.push(pauseMs * PAUSE_MS_TSTATES);
      i += 18 + dataLen;

    } else if (blockType === 0x12) {
      // Pure tone
      const pulse  = data[i] | (data[i + 1] << 8);
      const count  = data[i + 2] | (data[i + 3] << 8);
      for (let p = 0; p < count; p++) edges.push(pulse);
      i += 4;

    } else if (blockType === 0x13) {
      // Pulse sequence
      const count = data[i++];
      for (let p = 0; p < count; p++) {
        edges.push(data[i] | (data[i + 1] << 8));
        i += 2;
      }

    } else if (blockType === 0x14) {
      // Pure data block (no pilot/sync)
      const bit0     = data[i] | (data[i + 1] << 8);
      const bit1     = data[i + 2] | (data[i + 3] << 8);
      const usedBits = data[i + 4];
      const pauseMs  = data[i + 5] | (data[i + 6] << 8);
      const dataLen  = data[i + 7] | (data[i + 8] << 8) | (data[i + 9] << 16);
      for (let b = 0; b < dataLen; b++) {
        const bitsInByte = (b === dataLen - 1) ? usedBits : 8;
        const byte = data[i + 10 + b];
        for (let bit = 7; bit >= 8 - bitsInByte; bit--) {
          const pulse = (byte >> bit) & 1 ? bit1 : bit0;
          edges.push(pulse, pulse);
        }
      }
      if (pauseMs > 0) edges.push(pauseMs * PAUSE_MS_TSTATES);
      i += 10 + dataLen;

    } else if (blockType === 0x20) {
      // Pause / stop the tape
      const pauseMs = data[i] | (data[i + 1] << 8);
      if (pauseMs > 0) edges.push(pauseMs * PAUSE_MS_TSTATES);
      i += 2;

    } else {
      // Unknown block — skip via 4-byte length field (most TZX extension blocks)
      const blockLen = data[i] | (data[i + 1] << 8) | (data[i + 2] << 16) | (data[i + 3] << 24);
      i += 4 + (blockLen >>> 0);
    }
  }

  return new Uint32Array(edges);
};

// ── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a new ZX Spectrum emulator instance.
 *
 * @param {object}  [options]
 * @param {string}  [options.model="48k"]    - Machine model: "48k" or "128k"
 * @param {number}  [options.sampleRate=44100] - Audio output sample rate in Hz
 * @returns {object} ZX Spectrum emulator instance
 */
export const createZXS = (options = {}) => {
  const sampleRate = options.sampleRate ?? 44100;
  const is128k     = (options.model ?? "48k") === "128k";

  // ── Memory ────────────────────────────────────────────────────────────────

  /** 48k contiguous RAM: 0x4000–0xFFFF (49152 bytes). */
  const ram48  = new Uint8Array(49152);

  /** 128k: 8 banks × 16 KB = 131072 bytes. Banks 0–7. */
  const ram128 = new Uint8Array(8 * 16384);

  // 128k paging state
  let romBank        = 0;  // 0 = ROM_128_0 (128k editor), 1 = ROM_128_1 (48k BASIC)
  let ramBank        = 0;  // which of 8 banks mapped at 0xC000
  let screenBank     = 5;  // which bank holds the displayed screen (5 or 7)
  let pagingDisabled = false;

  // ── Video ────────────────────────────────────────────────────────────────

  /** RGBA frame buffer: 448 × 312 pixels × 4 bytes. */
  const videoBuffer = new Uint8Array(VIDEO_BYTES);
  const videoView   = new Uint32Array(videoBuffer.buffer);

  /** Flash phase toggles every 16 frames (50 Hz → 3.125 Hz). */
  let frameCount = 0;

  // ── Audio ─────────────────────────────────────────────────────────────────

  const fcpu = is128k ? FCPU_128 : FCPU_48;
  const tPerSample = fcpu / sampleRate;
  const audioBuffer  = new Float32Array(Math.ceil(sampleRate / 10) + 2);
  const beeperBuf    = new Float32Array(audioBuffer.length);

  /** Beeper state: 0 = off, 1 = on (EAR/MIC bit of ULA port). */
  let beeperState       = 0;
  let beeperStateAtFrameStart = 0;
  /** Sound event log: [tOffset, beeperBit, ...]. Reset each frame. */
  let beeperEvents = [];
  /** cpu.T() at start of current frame. */
  let frameBaseT   = 0;

  // ── Tape ──────────────────────────────────────────────────────────────────

  /** Pre-computed T-state durations between signal edges. */
  let tapeEdges   = new Uint32Array(0);
  /** Current index into tapeEdges. */
  let tapePos     = 0;
  /** T-states remaining until the next edge transition. */
  let tapeT       = 0;
  /** Current EAR signal level: 0 or 1. */
  let tapeSignal  = 0;
  let tapePlaying = false;
  /** cpu.T() value at the last tape advance — used for lazy per-IN advancement. */
  let tapeTBase   = 0;

  // ── ULA / Border ──────────────────────────────────────────────────────────

  let borderColor = 7;

  // ── Keyboard ──────────────────────────────────────────────────────────────

  /**
   * Keyboard matrix: Uint8Array(8).
   * Index = half-row 0–7, bits 0–4 = keys, bit SET = pressed.
   * Half-rows correspond to A8–A15 address lines during IN/OUT 0xFE.
   */
  let currentKeyMatrix = new Uint8Array(8);

  // ── AY PSG (128k only) ────────────────────────────────────────────────────

  const ay = createAY({ sampleRate, clockHz: 1773400, cpuClockHz: fcpu });

  // ── Memory dispatch ───────────────────────────────────────────────────────

  /**
   * Read a byte from the 16-bit address space.
   *
   * @param {number} addr - 16-bit address
   * @returns {number} Byte value
   */
  const byteAt = (addr) => {
    if (addr < 0x4000) {
      if (is128k) return romBank === 0 ? ROM_128_0[addr] : ROM_128_1[addr];
      return ROM_48[addr];
    }
    if (!is128k) return ram48[addr - 0x4000];
    if (addr < 0x8000) return ram128[5 * 16384 + (addr - 0x4000)];  // bank 5 fixed
    if (addr < 0xC000) return ram128[2 * 16384 + (addr - 0x8000)];  // bank 2 fixed
    return ram128[ramBank * 16384 + (addr - 0xC000)];
  };

  /**
   * Write a byte to the 16-bit address space.
   * Writes to ROM area (< 0x4000) are silently ignored.
   *
   * @param {number} addr - 16-bit address
   * @param {number} val  - Byte value (0–255)
   */
  const byteTo = (addr, val) => {
    if (addr < 0x4000) return;  // ROM is read-only
    if (is128k) {
      if (addr < 0x8000) { ram128[5 * 16384 + (addr - 0x4000)] = val & 0xFF; return; }
      if (addr < 0xC000) { ram128[2 * 16384 + (addr - 0x8000)] = val & 0xFF; return; }
      ram128[ramBank * 16384 + (addr - 0xC000)] = val & 0xFF;
    } else {
      ram48[addr - 0x4000] = val & 0xFF;
    }
  };

  // ── I/O port dispatch ─────────────────────────────────────────────────────

  /**
   * Handle CPU IN instruction.
   *
   * @param {number} port     - Low byte of port address
   * @param {number} fullAddr - Full 16-bit port address
   * @returns {number} Byte value (0–255)
   */
  const portIn = (port, fullAddr) => {
    // ULA read: any even port address
    if ((fullAddr & 0x0001) === 0) {
      // Keyboard: A8–A15 = inverted half-row select, bit SET means NOT selected
      const rowSelect = (fullAddr >> 8) & 0xFF;
      let keys = 0;
      for (let row = 0; row < 8; row++) {
        if ((rowSelect & (1 << row)) === 0) {
          keys |= currentKeyMatrix[row] & 0x1F;
        }
      }
      // Bits 0–4: key rows (active low: 0 = pressed), bit 6 = EAR input
      // Advance tape lazily to the exact T-state of this IN instruction so the
      // ROM loader sees signal edges at cycle-accurate positions.
      if (tapePlaying) {
        const elapsed = cpu.T() - tapeTBase;
        if (elapsed > 0) advanceTape(elapsed);
        tapeTBase = cpu.T();
      }
      const earBit = tapePlaying ? (tapeSignal << 6) : 0x40;
      return (0xA0 | earBit | (~keys & 0x1F));
    }

    // AY register read
    if ((fullAddr & 0xC002) === 0xC000) return ay.readRegister();

    return 0xFF;
  };

  /**
   * Handle CPU OUT instruction.
   *
   * @param {number} port     - Low byte of port address
   * @param {number} val      - Byte value written
   * @param {number} fullAddr - Full 16-bit port address
   */
  const portOut = (port, val, fullAddr) => {
    // ULA write: any even port address
    if ((fullAddr & 0x0001) === 0) {
      borderColor = val & 0x07;
      const newBeeper = (val >> 4) & 1;
      if (newBeeper !== beeperState) {
        beeperEvents.push(cpu.T() - frameBaseT, newBeeper);
        beeperState = newBeeper;
      }
    }

    // 128k memory paging
    if (is128k && (fullAddr & 0xC002) === 0x4000 && !pagingDisabled) {
      ramBank = val & 0x07;
      screenBank = (val & 0x08) ? 7 : 5;
      romBank = (val & 0x10) ? 1 : 0;
      if (val & 0x20) pagingDisabled = true;
    }

    // AY register select
    if ((fullAddr & 0xC002) === 0xC000) ay.writeRegisterSelect(val);

    // AY register write
    if ((fullAddr & 0xC002) === 0x8000) ay.writeRegisterValue(val);
  };

  // ── CPU ───────────────────────────────────────────────────────────────────

  const cpu = createZ80({ byteAt, byteTo, portIn, portOut });

  // ── Video rendering ───────────────────────────────────────────────────────

  /**
   * Render one scanline into videoBuffer.
   *
   * @param {number} line       - Scanline index 0–311
   * @param {number} bColor     - Current border color index (0–7)
   * @param {boolean} flashPhase - True = flash inverted this frame
   */
  const renderScanline = (line, bColor, flashPhase) => {
    // Skip retrace lines — they are outside the video buffer
    if (line >= VISIBLE_LINES) return;

    const borderRGBA = ZX_PALETTE_RGBA[bColor];
    const rowBase    = line * SCREEN_W;

    const isActive = line >= TOP_BORDER && line < TOP_BORDER + ACTIVE_LINES;

    // Fill entire scanline with border color first
    videoView.fill(borderRGBA, rowBase, rowBase + SCREEN_W);

    if (!isActive) return;

    const y = line - TOP_BORDER;  // Display line 0–191

    // Active pixels (256 wide = 32 bytes), starting at LEFT_BORDER_PX
    const vramBase = is128k ? screenBank * 16384 : 0;
    for (let xByte = 0; xByte < 32; xByte++) {
      // ZX Spectrum pixel addressing:
      // bits 12-11: top third (y bits 7-6)
      // bits 10-8:  y bits 2-0
      // bits 7-5:   y bits 5-3
      // bits 4-0:   x byte
      const pixelOffset = ((y & 0xC0) << 5) | ((y & 0x07) << 8) | ((y & 0x38) << 2) | xByte;
      const attrOffset  = 0x1800 | ((y >> 3) * 32) | xByte;

      let pixelByte, attrByte;
      if (is128k) {
        pixelByte = ram128[vramBase + pixelOffset];
        attrByte  = ram128[vramBase + attrOffset];
      } else {
        pixelByte = ram48[pixelOffset];
        attrByte  = ram48[attrOffset];
      }

      const bright    = (attrByte & 0x40) ? 8 : 0;
      let   inkIdx    = (attrByte & 0x07) | bright;
      let   paperIdx  = ((attrByte >> 3) & 0x07) | bright;
      const flash     = (attrByte & 0x80) !== 0;

      if (flash && flashPhase) {
        const tmp = inkIdx; inkIdx = paperIdx; paperIdx = tmp;
      }

      const inkRGBA   = ZX_PALETTE_RGBA[inkIdx];
      const paperRGBA = ZX_PALETTE_RGBA[paperIdx];

      const pxBase = rowBase + LEFT_BORDER_PX + xByte * 8;
      for (let bit = 7; bit >= 0; bit--) {
        videoView[pxBase + (7 - bit)] = (pixelByte >> bit) & 1 ? inkRGBA : paperRGBA;
      }
    }
  };

  // ── Tape playback ─────────────────────────────────────────────────────────

  /**
   * Advance tape playback by the given number of T-states,
   * toggling tapeSignal at each edge boundary.
   *
   * @param {number} tStates - T-states elapsed this frame
   */
  const advanceTape = (tStates) => {
    if (!tapePlaying || tapePos >= tapeEdges.length) return;
    let rem = tStates;
    while (rem > 0 && tapePos < tapeEdges.length) {
      if (rem >= tapeT) {
        rem -= tapeT;
        tapeSignal ^= 1;
        tapePos++;
        tapeT = tapePos < tapeEdges.length ? tapeEdges[tapePos] : 0;
      } else {
        tapeT -= rem;
        rem = 0;
      }
    }
    if (tapePos >= tapeEdges.length) tapePlaying = false;
  };

  // ── Audio generation ──────────────────────────────────────────────────────

  /**
   * Generate beeper audio from recorded port events.
   *
   * @param {number} tStates - T-states this frame
   */
  const generateBeeper = (tStates) => {
    const numSamples = Math.ceil(tStates / tPerSample);
    let evIdx = 0;
    let state = beeperStateAtFrameStart;

    for (let i = 0; i < numSamples; i++) {
      const tAt = i * tPerSample;
      while (evIdx < beeperEvents.length && beeperEvents[evIdx] <= tAt) {
        state = beeperEvents[evIdx + 1];
        evIdx += 2;
      }
      beeperBuf[i] = state ? 0.5 : 0;
    }
    return numSamples;
  };

  // ── Initialized flag ──────────────────────────────────────────────────────

  let initialized = false;

  // ── Public API ────────────────────────────────────────────────────────────

  return {

    /**
     * Reset the emulator to power-on state.
     *
     * Clears RAM, resets CPU (PC = 0x0000, i.e. start of ROM), resets border,
     * audio state, AY chip, and video buffer.
     */
    reset() {
      ram48.fill(0);
      ram128.fill(0);
      romBank = 0; ramBank = 0; screenBank = 5; pagingDisabled = false;
      borderColor = 7; frameCount = 0;
      currentKeyMatrix = new Uint8Array(8);
      beeperState = 0; beeperStateAtFrameStart = 0; beeperEvents = []; frameBaseT = 0;
      tapeEdges = new Uint32Array(0); tapePos = 0; tapeT = 0; tapeSignal = 0; tapePlaying = false; tapeTBase = 0;
      audioBuffer.fill(0); beeperBuf.fill(0);
      videoBuffer.fill(0);
      ay.reset();
      cpu.reset();
      initialized = true;
    },

    /**
     * Execute one frame of emulation and return video + audio output.
     *
     * @param {number}     [tStates]   - T-states per frame (default: 69888 for 48k, 70908 for 128k)
     * @param {Uint8Array} [keyMatrix] - 8-byte keyboard state (bit set = key pressed)
     * @returns {{ initialized: false }|{ video: Uint8Array, audio: Float32Array, borderColor: number }}
     */
    frame(tStates, keyMatrix) {
      if (!initialized) return { initialized: false };

      tStates = tStates ?? (is128k ? SCANLINE_TSTATES_128 * SCANLINES : SCANLINE_TSTATES_48 * SCANLINES);
      if (keyMatrix) currentKeyMatrix = keyMatrix;

      frameBaseT          = cpu.T();
      tapeTBase           = cpu.T();
      beeperStateAtFrameStart = beeperState;
      beeperEvents        = [];

      // Frame interrupt (IM1 → RST 0x38)
      cpu.interrupt(0xFF);

      const flashPhase = (frameCount >> 4) & 1;

      // Distribute tStates proportionally across VISIBLE_LINES, then retrace.
      // Tape is advanced lazily inside portIn at the exact T-state of each
      // IN (0xFE) instruction, so no per-scanline advancement is needed here.
      let tDone = 0;
      for (let line = 0; line < VISIBLE_LINES; line++) {
        const lineTarget = Math.round(tStates * (line + 1) / SCANLINES);
        const lineT = lineTarget - tDone;
        if (lineT > 0) cpu.steps(lineT);
        tDone = lineTarget;
        renderScanline(line, borderColor, flashPhase);
      }
      // Retrace lines (no rendering)
      const retraceT = tStates - tDone;
      if (retraceT > 0) cpu.steps(retraceT);

      // Flush any remaining tape T-states not consumed by IN instructions
      // (e.g. frames where the loader isn't actively sampling).
      if (tapePlaying) {
        const elapsed = cpu.T() - tapeTBase;
        if (elapsed > 0) advanceTape(elapsed);
        tapeTBase = cpu.T();
      }

      // Generate beeper audio
      const numSamples = generateBeeper(tStates);

      // Mix AY
      const ayBuf = ay.generate(tStates);
      for (let i = 0; i < numSamples; i++) {
        audioBuffer[i] = beeperBuf[i] * 0.5 + (i < ayBuf.length ? ayBuf[i] : 0) * 0.5;
      }

      frameCount++;

      return {
        initialized: true,
        video: videoBuffer,
        audio: audioBuffer.subarray(0, numSamples),
        borderColor,
      };
    },

    /**
     * Load a .SNA snapshot file.
     *
     * Supports both 48k (49179 bytes) and 128k (131103 bytes) formats.
     *
     * @param {Uint8Array} data - Raw SNA file contents
     * @throws {Error} If file size is invalid
     */
    loadSNA(data) {
      if (data.length !== 49179 && data.length !== 131103) {
        throw new Error(`Invalid SNA file: unexpected size ${data.length}`);
      }

      // Common header (27 bytes): registers
      cpu.set("I",  data[0]);
      cpu.set("HL_", (data[2] << 8) | data[1]);
      cpu.set("DE_", (data[4] << 8) | data[3]);
      cpu.set("BC_", (data[6] << 8) | data[5]);
      cpu.set("AF_", (data[8] << 8) | data[7]);
      cpu.set("HL",  (data[10] << 8) | data[9]);
      cpu.set("DE",  (data[12] << 8) | data[11]);
      cpu.set("BC",  (data[14] << 8) | data[13]);
      cpu.set("IY",  (data[16] << 8) | data[15]);
      cpu.set("IX",  (data[18] << 8) | data[17]);
      // data[19]: IFF2 / interrupt flags — set IM and IFF
      cpu.set("IFF1", data[19] & 0x04 ? 1 : 0);
      cpu.set("IFF2", data[19] & 0x04 ? 1 : 0);
      cpu.set("R",  data[20]);
      cpu.set("AF",  (data[21] << 8) | data[22]);  // AF: A=21, F=22 in SNA
      cpu.set("SP",  (data[23] | (data[24] << 8)));
      cpu.set("IM",  data[25] & 0x03);
      borderColor = data[26] & 0x07;

      if (data.length === 49179) {
        // 48k SNA: bytes 27–49178 = RAM 0x4000–0xFFFF
        ram48.set(data.subarray(27, 49179));
        // PC is on the stack — pop it
        const sp  = cpu.status().sp;
        const pcL = ram48[sp - 0x4000];
        const pcH = ram48[sp - 0x4000 + 1];
        cpu.set("PC", (pcH << 8) | pcL);
        cpu.set("SP", (sp + 2) & 0xFFFF);
      } else {
        // 128k SNA format (131103 bytes):
        // Bytes 27–49178: 49152 bytes = bank5 (16384) + bank2 (16384) + ramBank (16384)
        // Bytes 49179–49180: PC
        // Byte  49181: port 0x7FFD value
        // Byte  49182: TR-DOS flag (ignored)
        // Bytes 49183+: remaining 5 banks (all except 5, 2, and ramBank)
        const pc       = data[49179] | (data[49180] << 8);
        const port7FFD = data[49181];

        cpu.set("PC", pc);
        ramBank        = port7FFD & 0x07;
        screenBank     = (port7FFD & 0x08) ? 7 : 5;
        romBank        = (port7FFD & 0x10) ? 1 : 0;
        pagingDisabled = !!(port7FFD & 0x20);

        // Load bank 5 (0x4000–0x7FFF region), bank 2, then current ramBank
        ram128.set(data.subarray(27, 27 + 16384), 5 * 16384);
        ram128.set(data.subarray(27 + 16384, 27 + 32768), 2 * 16384);
        ram128.set(data.subarray(27 + 32768, 27 + 49152), ramBank * 16384);

        // Load remaining 5 banks
        let offset = 49183;
        for (let page = 0; page < 8; page++) {
          if (page === 5 || page === 2 || page === ramBank) continue;
          ram128.set(data.subarray(offset, offset + 16384), page * 16384);
          offset += 16384;
        }
      }

      initialized = true;
    },

    /**
     * Save a .SNA snapshot of the current emulator state.
     *
     * @returns {Uint8Array} SNA file contents
     */
    snapshot() {
      const size = is128k ? 131103 : 49179;
      const out  = new Uint8Array(size);
      const st   = cpu.status();

      out[0]  = st.i ?? 0;
      out[1]  = (st.hl_ ?? 0) & 0xFF; out[2]  = ((st.hl_ ?? 0) >> 8) & 0xFF;
      out[3]  = (st.de_ ?? 0) & 0xFF; out[4]  = ((st.de_ ?? 0) >> 8) & 0xFF;
      out[5]  = (st.bc_ ?? 0) & 0xFF; out[6]  = ((st.bc_ ?? 0) >> 8) & 0xFF;
      out[7]  = (st.af_ ?? 0) & 0xFF; out[8]  = ((st.af_ ?? 0) >> 8) & 0xFF;
      out[9]  = (st.hl ?? 0) & 0xFF; out[10] = ((st.hl ?? 0) >> 8) & 0xFF;
      out[11] = (st.de ?? 0) & 0xFF; out[12] = ((st.de ?? 0) >> 8) & 0xFF;
      out[13] = (st.bc ?? 0) & 0xFF; out[14] = ((st.bc ?? 0) >> 8) & 0xFF;
      out[15] = (st.iy ?? 0) & 0xFF; out[16] = ((st.iy ?? 0) >> 8) & 0xFF;
      out[17] = (st.ix ?? 0) & 0xFF; out[18] = ((st.ix ?? 0) >> 8) & 0xFF;
      out[19] = (st.iff1 ?? 0) ? 0x04 : 0x00;
      out[20] = st.r ?? 0;
      out[21] = st.a ?? 0; out[22] = st.f ?? 0;
      out[23] = (st.sp ?? 0) & 0xFF; out[24] = ((st.sp ?? 0) >> 8) & 0xFF;
      out[25] = (st.im ?? 1) & 0x03;
      out[26] = borderColor;

      if (!is128k) {
        // Push PC onto stack (SP decrements before write, as per SNA format)
        let sp = st.sp ?? 0;
        const pc = st.pc ?? 0;
        sp = (sp - 2) & 0xFFFF;
        ram48[sp - 0x4000 + 1] = (pc >> 8) & 0xFF;
        ram48[sp - 0x4000]     = pc & 0xFF;
        cpu.set("SP", sp);
        // Update SP in header to point to pushed PC
        out[23] = sp & 0xFF;
        out[24] = (sp >> 8) & 0xFF;
        out.set(ram48, 27);
      } else {
        out[49179] = (st.pc ?? 0) & 0xFF;
        out[49180] = ((st.pc ?? 0) >> 8) & 0xFF;
        const port7FFD = ramBank | (screenBank === 7 ? 0x08 : 0) | (romBank ? 0x10 : 0) | (pagingDisabled ? 0x20 : 0);
        out[49181] = port7FFD;
        out[49182] = 0;

        // Write bank5 + bank2 + current ramBank = 49152 bytes at offset 27
        out.set(ram128.subarray(5 * 16384, 6 * 16384), 27);
        out.set(ram128.subarray(2 * 16384, 3 * 16384), 27 + 16384);
        out.set(ram128.subarray(ramBank * 16384, (ramBank + 1) * 16384), 27 + 32768);

        // Write remaining 5 banks (all except 5, 2, and current ramBank)
        let offset = 49183;
        for (let page = 0; page < 8; page++) {
          if (page === 5 || page === 2 || page === ramBank) continue;
          out.set(ram128.subarray(page * 16384, (page + 1) * 16384), offset);
          offset += 16384;
        }
      }

      return out;
    },

    /**
     * Enable or disable CPU instruction tracing to console.
     *
     * @param {boolean} on - True to enable tracing
     */
    trace: (on) => cpu.trace(on),

    /**
     * Get a snapshot of all CPU registers.
     *
     * @returns {object} Register values
     */
    status: () => cpu.status(),

    /**
     * Direct RAM access for external tools (debuggers, memory viewers).
     * 48k: returns the 49152-byte RAM buffer.
     * 128k: returns the full 131072-byte bank array.
     *
     * @returns {Uint8Array} RAM buffer (direct reference)
     */
    getRAM: () => is128k ? ram128 : ram48,

    /**
     * Get current 128k banking state.
     *
     * @returns {{ romBank, ramBank, screenBank, pagingDisabled }}
     */
    getBankingState: () => ({ romBank, ramBank, screenBank, pagingDisabled }),

    /**
     * Get the current video buffer (448 × 312 RGBA).
     *
     * @returns {Uint8Array} Raw RGBA byte buffer
     */
    getVideoBuffer: () => videoBuffer,

    /**
     * Load a .TAP tape image and prepare it for playback.
     * Does not auto-play — call tapePlay() to start.
     *
     * @param {Uint8Array} data - Raw TAP file bytes
     */
    loadTAP(data) {
      tapeEdges   = parseTAPtoEdges(data);
      tapePos     = 0;
      tapeT       = tapeEdges.length > 0 ? tapeEdges[0] : 0;
      tapeSignal  = 0;
      tapePlaying = false;
    },

    /**
     * Load a .TZX tape image and prepare it for playback.
     * Does not auto-play — call tapePlay() to start.
     *
     * @param {Uint8Array} data - Raw TZX file bytes
     */
    loadTZX(data) {
      tapeEdges   = parseTZXtoEdges(data);
      tapePos     = 0;
      tapeT       = tapeEdges.length > 0 ? tapeEdges[0] : 0;
      tapeSignal  = 0;
      tapePlaying = false;
    },

    /** Start or resume tape playback. */
    tapePlay() {
      if (tapeEdges.length > 0 && tapePos < tapeEdges.length) tapePlaying = true;
    },

    /** Pause tape playback without rewinding. */
    tapePause() {
      tapePlaying = false;
    },

    /** Stop tape playback and rewind to the beginning. */
    tapeStop() {
      tapePlaying = false;
      tapePos     = 0;
      tapeT       = tapeEdges.length > 0 ? tapeEdges[0] : 0;
      tapeSignal  = 0;
    },

    /**
     * Get current tape transport state.
     *
     * @returns {{ playing: boolean, edgeCount: number, edgesRemaining: number }}
     */
    tapeGetState: () => ({
      playing:        tapePlaying,
      edgeCount:      tapeEdges.length,
      edgesRemaining: Math.max(0, tapeEdges.length - tapePos),
    }),
  };
};
