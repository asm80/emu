/**
 * KIM-1 Headless Emulator Module
 *
 * Encapsulates the full KIM-1 computer emulation: MOS 6502 CPU @ 1 MHz,
 * two MCS 6530 RRIOT chips (RAM/ROM/I/O/Timer), 1 KB base RAM (expandable),
 * 6-digit 7-segment LED display, 23-key matrix keyboard, serial TTY interface
 * (via ROM patch), and cassette tape interface with MOS papertape (.pap) support.
 *
 * This module has NO DOM dependencies — it exposes a frame-oriented API that
 * any host (browser page, test harness, Node.js script) can drive.
 *
 * @example
 * import { createKIM } from "./src/devices/kim/kim1.js";
 * const kim = createKIM({ ramSize: "4k" });
 * kim.reset();
 * // In animation loop:
 * const { display } = kim.frame(16667, { kbad: false, kb0: true, ... });
 */

import create6502 from "../../6502.js";
import { ROM_002, ROM_003 } from "./kim1-rom.js";

/**
 * CPU clock frequency in Hz.
 * @type {number}
 */
const FCPU = 1_000_000;

/**
 * "Magic" memory addresses used to intercept GETCH / OUTCH without
 * bit-banging emulation. These addresses are in unmapped space on the
 * original KIM-1 and will never appear in user programs.
 */
const SERIAL_IN_ADDR  = 0xBFFE;
const SERIAL_OUT_ADDR = 0xBFFF;

/**
 * KIM-1 ROM_002 subroutine entry points (absolute addresses).
 * GETCH reads one character from the TTY; OUTCH writes one character.
 * Both are patched at reset() to redirect through SERIAL_IN/OUT_ADDR.
 */
const GETCH_ADDR = 0x1E5A;
const OUTCH_ADDR = 0x1EA0;

/**
 * KIM-1 monitor zero-page variables that must be pre-seeded to bypass
 * the baud-rate detection loop at startup.
 * $EF = CNTH30 (baud rate high byte timer constant)
 * $F0 = CNTL30 (baud rate low byte timer constant)
 */
const BAUDRATE_HIGH_ADDR = 0xEF;
const BAUDRATE_LOW_ADDR  = 0xF0;
// Values that represent ~300 baud (arbitrary — bypasses the measurement loop)
const BAUDRATE_HIGH_VAL  = 0x07;
const BAUDRATE_LOW_VAL   = 0x27;

/**
 * All valid key names for the KIM-1 keyboard.
 * Physical layout (6 rows × 4 columns, top to bottom):
 *   Row 0 (top): GO  ST  BS  SST
 *   Row 1:       AD  DA  PC  +
 *   Row 2:       C   D   E   F
 *   Row 3:       8   9   A   B
 *   Row 4:       4   5   6   7
 *   Row 5:       0   1   2   3
 *
 * kbrs (RS/Reset) and kbst (ST/Stop) are handled outside frame() by the host.
 * kbsst (SST) is a persistent toggle maintained by the host in keyMatrix.
 *
 * @type {string[]}
 */
export const KEY_NAMES = [
  "kbgo", "kbst", "kbbs", "kbsst",
  "kbad", "kbda", "kbpc", "kbplus",
  "kbc",  "kbd",  "kbe",  "kbf",
  "kb8",  "kb9",  "kba",  "kbb",
  "kb4",  "kb5",  "kb6",  "kb7",
  "kb0",  "kb1",  "kb2",  "kb3",
  "kbrs",
];

// ── Internal RIOT factory ────────────────────────────────────────────────────

/**
 * Create a MCS 6530 RRIOT (RAM/ROM/I/O/Timer) emulation instance.
 *
 * Register map (offset from chip base address):
 *   0x00  Port A data direction register (DDR A)
 *   0x01  Port A data register
 *   0x02  Port B DDR
 *   0x03  Port B data register
 *   0x04–0x07  Timer load (÷1/8/64/1024), IRQ disable
 *   0x06  Timer read, IRQ disable
 *   0x07  Timer status (bit7 = overflow)
 *   0x0C–0x0F  Timer load with IRQ enable
 *   0x0E  Timer read, IRQ enable
 *
 * @param {function(number, number, number, number): void} hookFn
 *   Called after every register write: hookFn(ddrA, ddrB, dataA, dataB)
 * @returns {object} RIOT instance
 */
const createRIOT = (hookFn) => {
  // Port registers
  let ddrA  = 0;   // Port A data direction register (1=output)
  let dataA = 0;   // Port A data output register
  let ddrB  = 0;   // Port B DDR
  let dataB = 0;   // Port B data output register
  // External pin values (injected by host via portA / portB)
  let pinA  = 0xFF;
  let pinB  = 0xFF;
  // Gate: hookFn is only called after Port B has been written since the last
  // Port A write, preventing spurious display updates from intermediate blanking.
  let portBWritten = false;
  // Timer
  let timer    = 0xFF;
  let divisor  = 1;
  let savedDiv = 1;
  let act      = 1;   // sub-counter: fires when it reaches 0
  let overflow = 0;   // 1 when timer wrapped through 0
  let irqEn    = 0;   // interrupt enable flag (informational only)

  const doTick = () => {
    act--;
    if (act === 0) {
      act = divisor;
      timer--;
      if (timer < 0) {
        timer    = 0xFF;
        divisor  = 1;    // free-run at ÷1 after overflow
        overflow = 1;
      }
    }
  };

  return {
    /** Advance timer by Ts CPU T-states. */
    tick(Ts) {
      for (let i = 0; i < Ts; i++) doTick();
    },

    /** Memory-mapped register write (offset = addr - chip_base). */
    byteTo(offset, val) {
      switch (offset) {
        case 0x00:
          ddrA = val;
          // Display update: only when Port B was written since last Port A write
          // (prevents spurious updates from intermediate blanking of Port A)
          if (portBWritten) {
            portBWritten = false;
            hookFn(ddrA, ddrB, dataA, dataB, false);
          }
          return;
        case 0x01: dataA = val; break;
        case 0x02:
          ddrB = val;
          portBWritten = true;
          // Keyboard / tape injection: fire immediately so ROM can read Port A
          hookFn(ddrA, ddrB, dataA, dataB, true);
          break;
        case 0x03: dataB = val; break;
        // Timer load — IRQ disabled
        case 0x04: divisor = savedDiv = 1;    timer = val; overflow = 0; irqEn = 0; break;
        case 0x05: divisor = savedDiv = 8;    timer = val; overflow = 0; irqEn = 0; break;
        case 0x06: divisor = savedDiv = 64;   timer = val; overflow = 0; irqEn = 0; break;
        case 0x07: divisor = savedDiv = 1024; timer = val; overflow = 0; irqEn = 0; break;
        // Timer load — IRQ enabled
        case 0x0C: divisor = savedDiv = 1;    timer = val; overflow = 0; irqEn = 1; break;
        case 0x0D: divisor = savedDiv = 8;    timer = val; overflow = 0; irqEn = 1; break;
        case 0x0E: divisor = savedDiv = 64;   timer = val; overflow = 0; irqEn = 1; break;
        case 0x0F: divisor = savedDiv = 1024; timer = val; overflow = 0; irqEn = 1; break;
        default: break;
      }
    },

    /** Memory-mapped register read (offset = addr - chip_base). */
    byteAt(offset) {
      switch (offset) {
        // Port A: offset 0 = DATA reg (ddrA), offset 1 = DDR (dataA)
        // Output bits (DDR=1): return DATA; input bits (DDR=0): return pinA
        case 0x00: return (ddrA & dataA) | ((~dataA & 0xFF) & pinA);
        case 0x01: return dataA;
        // Port B: offset 2 = DATA reg (ddrB), offset 3 = DDR (dataB)
        case 0x02: return (ddrB & dataB) | ((~dataB & 0xFF) & pinB);
        case 0x03: return dataB;
        // Timer read — IRQ disable
        case 0x06: {
          irqEn = 0;
          if (overflow) { overflow = 0; divisor = savedDiv; }
          return timer & 0xFF;
        }
        // Timer read — IRQ enable
        case 0x0E: {
          irqEn = 1;
          if (overflow) { overflow = 0; divisor = savedDiv; }
          return timer & 0xFF;
        }
        // Timer status: bit7 = overflow flag
        case 0x07: return overflow ? 0x80 : 0x00;
        default: return 0x00;
      }
    },

    /** Inject external value onto Port A input pins. */
    portA(val) { pinA = val & 0xFF; },

    /** Inject external value onto Port B input pins. */
    portB(val) { pinB = val & 0xFF; },

    /** Reset all registers to power-on state. */
    reset() {
      ddrA = 0; dataA = 0; ddrB = 0; dataB = 0;
      pinA = 0xFF; pinB = 0xFF;
      portBWritten = false;
      timer = 0xFF; divisor = 1; savedDiv = 1; act = 1;
      overflow = 0; irqEn = 0;
    },
  };
};

// ── MOS Papertape parser / generator ────────────────────────────────────────

/**
 * Parse a MOS Technology papertape string (.pap format).
 *
 * Record format per line:
 *   ;LLAAAAdd...ddSS
 *   LL   = byte count (hex, 1–24)
 *   AAAA = load address (hex, 16-bit)
 *   dd   = data bytes (LL × 2 hex chars)
 *   SS   = 16-bit checksum, low byte first (address bytes + data bytes, mod 65536)
 *
 * End record: ;0000040001 (data count = 0, address = 0004, checksum = 0001)
 *
 * @param {string} text  Raw papertape text
 * @param {Uint8Array} ram  RAM array to write loaded bytes into
 * @returns {{ ok: boolean, blocks: number, error?: string }}
 */
const parsePAP = (text, ram) => {
  // Normalise all line endings (CR-only, CRLF, LF) to LF
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  let blocks = 0;
  const warnings = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || !line.startsWith(";")) continue;

    const count = parseInt(line.slice(1, 3), 16);
    if (isNaN(count)) continue;
    if (count === 0) break;   // end record

    if (line.length < 3 + 4 + count * 2) {
      warnings.push(`Short record skipped: ${line}`);
      continue;
    }

    const addr = parseInt(line.slice(3, 7), 16);
    if (isNaN(addr)) { warnings.push(`Bad address in: ${line}`); continue; }

    const data = [];
    for (let i = 0; i < count; i++) {
      data.push(parseInt(line.slice(7 + i * 2, 9 + i * 2), 16));
    }

    // Verify checksum if present (4 hex chars after data)
    // KIM-1 papertape checksum: count + addrHi + addrLo + all data bytes, mod 65536
    // Stored big-endian in the file (high byte first, low byte second)
    if (line.length >= 3 + 4 + count * 2 + 4) {
      const addrHi = (addr >> 8) & 0xFF;
      const addrLo = addr & 0xFF;
      let sum = count + addrHi + addrLo;
      for (const b of data) sum += b;
      sum &= 0xFFFF;

      const csOffset = 7 + count * 2;
      const csHi = parseInt(line.slice(csOffset,     csOffset + 2), 16);  // high byte first
      const csLo = parseInt(line.slice(csOffset + 2, csOffset + 4), 16);  // low byte second
      const checksum = (csHi << 8) | csLo;
      if (checksum !== sum) {
        warnings.push(`Checksum mismatch at 0x${addr.toString(16).toUpperCase().padStart(4,"0")}: expected 0x${sum.toString(16)}, got 0x${checksum.toString(16)}`);
      }
    }

    for (let i = 0; i < count; i++) {
      ram[addr + i] = data[i];
    }
    blocks++;
  }

  return { ok: true, blocks, warnings };
};

/**
 * Generate a MOS Technology papertape string for a RAM range.
 *
 * @param {Uint8Array} ram       Source RAM array
 * @param {number}     startAddr Start address (inclusive)
 * @param {number}     endAddr   End address (inclusive)
 * @returns {string}  Complete papertape text
 */
const generatePAP = (ram, startAddr, endAddr) => {
  const BYTES_PER_RECORD = 0x18;  // 24 bytes per record (standard KIM-1 value)
  let out = "";

  for (let addr = startAddr; addr <= endAddr; addr += BYTES_PER_RECORD) {
    const count = Math.min(BYTES_PER_RECORD, endAddr - addr + 1);
    const addrHi = (addr >> 8) & 0xFF;
    const addrLo = addr & 0xFF;

    // KIM-1 checksum: count + addrHi + addrLo + all data bytes, stored big-endian
    let sum = count + addrHi + addrLo;
    let dataStr = "";
    for (let i = 0; i < count; i++) {
      const b = ram[addr + i] || 0;
      sum += b;
      dataStr += b.toString(16).toUpperCase().padStart(2, "0");
    }
    sum &= 0xFFFF;

    const csHi = ((sum >> 8) & 0xFF).toString(16).toUpperCase().padStart(2, "0");
    const csLo = (sum & 0xFF).toString(16).toUpperCase().padStart(2, "0");
    const countStr = count.toString(16).toUpperCase().padStart(2, "0");
    const addrStr  = addr.toString(16).toUpperCase().padStart(4, "0");

    out += `;${countStr}${addrStr}${dataStr}${csHi}${csLo}\r\n`;
  }

  // Standard KIM-1 end record
  out += ";0000040001\r\n";
  return out;
};

// ── Main factory ─────────────────────────────────────────────────────────────

/**
 * Create a new KIM-1 emulator instance.
 *
 * The instance is NOT initialized after creation — call reset() before frame().
 * This allows the host to start its animation loop immediately and handle the
 * uninitialized state gracefully via the { initialized: false } frame result.
 *
 * @param {object}     [options]
 * @param {number}     [options.sampleRate]  Audio sample rate (unused — reserved for future use)
 * @param {"1k"|"4k"|"8k"|"64k"} [options.ramSize]  RAM configuration (default: "4k")
 * @param {Uint8Array} [options.rom002]      Custom 1024-byte ROM_002 image
 * @param {Uint8Array} [options.rom003]      Custom 1024-byte ROM_003 image
 * @returns {object}  KIM-1 emulator instance
 */
export const createKIM = (options = {}) => {
  const ramSize  = options.ramSize  ?? "4k";
  if (!["1k", "4k", "8k", "64k"].includes(ramSize)) {
    throw new Error(`Invalid ramSize: "${ramSize}". Expected "1k", "4k", "8k", or "64k".`);
  }
  const customR2 = options.rom002   ?? null;
  const customR3 = options.rom003   ?? null;
  const rom2     = customR2 ?? ROM_002;
  const rom3     = customR3 ?? ROM_003;

  // ── Memory ──────────────────────────────────────────────────────────────

  const ram = new Uint8Array(65536);

  /**
   * Returns true if the given address is in valid RAM for this configuration.
   * Used by byteTo to silently ignore writes to unmapped regions.
   */
  const isWritableRAM = (addr) => {
    // RIOT registers and ROM regions are never writable via byteTo
    if (addr >= 0x1700 && addr <= 0x1FFF) return false;
    if (addr >= 0xFC00)                   return false;
    // Base RAM: 0x0000–0x03FF always present
    if (addr <= 0x03FF) return true;
    // Expansion RAM
    switch (ramSize) {
      case "4k":  return addr >= 0x2000 && addr <= 0x2FFF;
      case "8k":  return addr >= 0x2000 && addr <= 0x3FFF;
      case "64k": return addr >= 0x0400 && addr <= 0xBFFF;
      default:    return false;  // "1k"
    }
  };

  // ── Serial TTY ──────────────────────────────────────────────────────────

  /** @type {number[]} Characters waiting to be consumed by GETCH */
  const serialInQueue  = [];
  /** @type {number[]} Characters produced by OUTCH */
  const serialOutQueue = [];

  // ── Display ─────────────────────────────────────────────────────────────

  /**
   * 6-element display snapshot. Segment bitmask (bit0=a…bit6=g) or null.
   * Null means the digit was not refreshed this frame → host preserves
   * the last rendered value (afterglow).
   */
  const displayState = new Array(6).fill(null);

  // ── Cassette / Tape ──────────────────────────────────────────────────────

  /** T-state interval buffer (durations between PA bit-7 transitions). */
  let tapeIntervals  = [];
  let tapeRecording  = false;
  let tapePlayback   = false;
  // Recording state
  let tapeMgwait  = true;   // waiting for the first HIGH transition
  let tapeMgt     = 0;      // T-state of last recorded edge
  let tapeMglast  = 0;      // last PA bit-7 value (0 or 0x80)
  // Playback state
  let tapeMgpt    = 0;      // T-state reference for playback timing
  let tapeMgdelay = 0;      // remaining T-states until next transition
  let tapeMgplast = 0x80;   // current playback output (idle = high = 0x80)
  let tapeMgpos   = 0;      // current position in tapeIntervals[]

  /**
   * Record a PA bit-7 transition for cassette output.
   * @param {number} pa7  Current bit7 of Port A (0 or 0x80)
   * @param {number} T    Current CPU T-state counter
   */
  const tapeOut = (pa7, T) => {
    if (!tapeRecording) return;
    if (tapeMgwait) {
      if (pa7 === 0) return;   // wait for first HIGH
      tapeMgt    = T;
      tapeMgwait = false;
      tapeMglast = 0x80;
      return;
    }
    const bit = pa7 & 0x80;
    if (bit !== tapeMglast) {
      tapeIntervals.push(T - tapeMgt);
      tapeMgt    = T;
      tapeMglast = bit;
    }
  };

  /**
   * Read the current cassette input bit (for PA bit-7 playback).
   * @param {number} T  Current CPU T-state counter
   * @returns {number}  0x00 or 0x80
   */
  const tapeIn = (T) => {
    if (!tapePlayback) return 0x80;
    if (tapeMgpt < 0) tapeMgpt = T;  // lazy init: -1 = not yet started
    const diff = T - tapeMgpt;
    tapeMgdelay -= diff;
    tapeMgpt = T;
    if (tapeMgdelay > 0) return tapeMgplast;
    tapeMgpos++;
    if (tapeMgpos >= tapeIntervals.length) {
      tapePlayback = false;
      return 0x80;
    }
    tapeMgdelay = tapeIntervals[tapeMgpos];
    tapeMgplast ^= 0x80;
    return tapeMgplast;
  };

  // ── Keyboard ────────────────────────────────────────────────────────────

  let currentKeys = {};

  // ── RIOT instances ───────────────────────────────────────────────────────

  let initialized = false;

  /**
   * RIOT-002 hook: called after every register write.
   * Decodes the Port B scan value to determine whether to update the LED
   * display or inject a keyboard row into Port A.
   *
   * Scan formula: segment = ((ddrB >> 1) & 0x0F) - 4
   *   segment >= 0  →  LED display digit (index 0–5)
   *   segment == -1 →  tape-fake: inject 0xFF into Port A (no keyboard)
   *   segment == -2 →  keyboard row 2 (kbpc, kbgo, kbplus, kbda, kbad, kbf, kbe)
   *   segment == -3 →  keyboard row 1 (kbd, kbc, kbb, kba, kb9, kb8, kb7)
   *   segment == -4 →  keyboard row 0 (kb6, kb5, kb4, kb3, kb2, kb1, kb0)
   *
   * @param {number} ddrA   Port A DDR value
   * @param {number} ddrB   Port B DDR value
   * @param {number} dataA  Port A data output
   * @param {number} dataB  Port B data output (unused — it's ddrB that's used for scan)
   */
  // isPortBWrite: true  → called from Port B write (keyboard/tape injection only)
  //               false → called from Port A write, gated (display update only)
  const process002 = (ddrA, ddrB, _dataA, _dataB, isPortBWrite) => {
    // ddrA = offset 0 = Port A DATA register (segment pattern written by ROM)
    // ddrB = offset 2 = Port B DATA register (column scan value written by ROM)
    const segment = ((ddrB >> 1) & 0x0F) - 4;

    if (segment >= 0) {
      // Display digit: only update from Port A write (not Port B, to avoid stale data)
      if (!isPortBWrite && segment < 6) {
        displayState[segment] = ddrA & 0x7F;
      }
      return;
    }

    const k = currentKeys;
    if (segment === -1) {
      // Tape read: combine idle-high (0xFF) with tape input bit and return via portA
      riot002.portA(0xFF);
      return;
    }

    // Keyboard row scan — active-low (bit = 0 means pressed)
    let row;
    if (segment === -2) {
      row = (k.kbpc   ? 1  : 0) | (k.kbgo   ? 2  : 0) | (k.kbplus ? 4  : 0) |
            (k.kbda   ? 8  : 0) | (k.kbad   ? 16 : 0) | (k.kbf    ? 32 : 0) |
            (k.kbe    ? 64 : 0);
    } else if (segment === -3) {
      row = (k.kbd ? 1  : 0) | (k.kbc ? 2  : 0) | (k.kbb ? 4  : 0) |
            (k.kba ? 8  : 0) | (k.kb9 ? 16 : 0) | (k.kb8 ? 32 : 0) |
            (k.kb7 ? 64 : 0);
    } else {
      // segment === -4
      row = (k.kb6 ? 1  : 0) | (k.kb5 ? 2  : 0) | (k.kb4 ? 4  : 0) |
            (k.kb3 ? 8  : 0) | (k.kb2 ? 16 : 0) | (k.kb1 ? 32 : 0) |
            (k.kb0 ? 64 : 0);
    }

    // Inject: active-low → XOR with 0xFF; tape bit always OR'd into bit7
    const tapeBit = cpu ? tapeIn(cpu.T()) : 0x80;
    riot002.portA((row ^ 0x7F) | tapeBit);
  };

  /**
   * RIOT-003 hook: nothing to do for the base KIM-1 configuration.
   * (RIOT-003 handles the TTY serial hardware, which we patch at ROM level.)
   */
  const process003 = () => {};

  // Create RIOT instances (process002/003 reference riot002 via closure, which
  // is assigned immediately after createRIOT returns)
  const riot002 = createRIOT(process002);
  const riot003 = createRIOT(process003);

  // ── Memory bus ──────────────────────────────────────────────────────────

  const byteAt = (addr) => {
    // RIOT-002 registers: 0x1740–0x177F
    if (addr >= 0x1740 && addr <= 0x177F) return riot002.byteAt(addr - 0x1740);
    // RIOT-003 registers: 0x1700–0x173F
    if (addr >= 0x1700 && addr <= 0x173F) return riot003.byteAt(addr - 0x1700);
    // ROM_003: 0x1800–0x1BFF
    if (addr >= 0x1800 && addr <= 0x1BFF) return ram[addr];
    // ROM_002: 0x1C00–0x1FFF
    if (addr >= 0x1C00 && addr <= 0x1FFF) return ram[addr];
    // ROM_002 mirror: 0xFC00–0xFFFF (6502 vector page)
    if (addr >= 0xFC00) return ram[addr - 0xFC00 + 0x1C00];
    // Serial TTY input magic address
    if (addr === SERIAL_IN_ADDR) return serialInQueue.length > 0 ? serialInQueue.shift() : 0x00;
    return ram[addr];
  };

  const byteTo = (addr, val) => {
    // RIOT-002 registers
    if (addr >= 0x1740 && addr <= 0x177F) { riot002.byteTo(addr - 0x1740, val & 0xFF); return; }
    // RIOT-003 registers
    if (addr >= 0x1700 && addr <= 0x173F) { riot003.byteTo(addr - 0x1700, val & 0xFF); return; }
    // Serial TTY output magic address
    if (addr === SERIAL_OUT_ADDR) { serialOutQueue.push(val & 0xFF); return; }
    // Writable RAM check (silently ignore writes to ROM / unmapped regions)
    if (!isWritableRAM(addr)) return;
    ram[addr] = val & 0xFF;
  };

  // ── CPU ─────────────────────────────────────────────────────────────────

  // cpu is declared before RIOT creation but assigned here; process002 refers
  // to cpu via closure (safe because process002 is only called after cpu is set)
  let cpu = null;
  cpu = create6502({
    byteAt,
    byteTo,
    ticks: (cycles) => {
      riot002.tick(cycles);
      riot003.tick(cycles);
    },
  });

  // ── ROM patch helpers ────────────────────────────────────────────────────

  /**
   * Write a JMP absolute instruction (3 bytes) to the RAM copy of ROM.
   * @param {number} from  Address of the instruction to overwrite
   * @param {number} to    Target address for the JMP
   */
  const patchJmp = (from, to) => {
    ram[from]     = 0x4C;              // JMP abs opcode
    ram[from + 1] = to & 0xFF;         // low byte
    ram[from + 2] = (to >> 8) & 0xFF;  // high byte
  };

  /**
   * Patch GETCH at `from` to: LDA SERIAL_IN_ADDR; RTS (4 bytes).
   * LDA abs = 0xAD, then 2-byte address, then RTS = 0x60.
   */
  const patchGetch = (from) => {
    ram[from]     = 0xAD;
    ram[from + 1] = SERIAL_IN_ADDR & 0xFF;
    ram[from + 2] = (SERIAL_IN_ADDR >> 8) & 0xFF;
    ram[from + 3] = 0x60;  // RTS
  };

  /**
   * Patch OUTCH at `from` to: STA SERIAL_OUT_ADDR; RTS (4 bytes).
   * STA abs = 0x8D.
   */
  const patchOutch = (from) => {
    ram[from]     = 0x8D;
    ram[from + 1] = SERIAL_OUT_ADDR & 0xFF;
    ram[from + 2] = (SERIAL_OUT_ADDR >> 8) & 0xFF;
    ram[from + 3] = 0x60;  // RTS
  };

  // ── reset() ─────────────────────────────────────────────────────────────

  const reset = () => {
    ram.fill(0);

    // Load ROM images into RAM
    ram.set(rom3.subarray(0, 1024), 0x1800);
    ram.set(rom2.subarray(0, 1024), 0x1C00);

    // Apply serial TTY patches to the RAM-resident ROM copy
    patchGetch(GETCH_ADDR);
    patchOutch(OUTCH_ADDR);

    // Pre-seed baud-rate variables to bypass the baud detection loop
    ram[BAUDRATE_HIGH_ADDR] = BAUDRATE_HIGH_VAL;
    ram[BAUDRATE_LOW_ADDR]  = BAUDRATE_LOW_VAL;

    // Initialize KIM-1 soft interrupt vectors (NMI and IRQ → 0x1C00)
    ram[0x17FA] = 0x00;
    ram[0x17FB] = 0x1C;
    ram[0x17FE] = 0x00;
    ram[0x17FF] = 0x1C;

    riot002.reset();
    riot003.reset();

    displayState.fill(null);
    currentKeys = {};
    serialInQueue.length  = 0;
    serialOutQueue.length = 0;

    tapeIntervals = [30000];
    tapeRecording = false;
    tapePlayback  = false;
    tapeMgwait    = true;
    tapeMgt       = 0;
    tapeMglast    = 0;
    tapeMgpt      = -1;
    tapeMgdelay   = 0;
    tapeMgplast   = 0x80;
    tapeMgpos     = 0;

    cpu.reset();

    initialized = true;
  };

  // ── frame() ─────────────────────────────────────────────────────────────

  /**
   * Execute one emulation frame.
   *
   * @param {number} tStates    Number of 6502 T-states to execute (~16667 for 60 fps at 1 MHz)
   * @param {object} [keyMatrix]  Key state object: { kbgo: bool, kb0: bool, ... }
   *   kbsst: persistent toggle — true = SST mode active
   *   kbrs:  ignored here — host must call reset() on mouseup
   *   kbst:  ignored here — host must call nmi() on mouseup
   * @returns {{ initialized: boolean, display?: Array<number|null> }}
   */
  const frame = (tStates, keyMatrix = {}) => {
    if (!initialized) return { initialized: false };

    currentKeys = keyMatrix;
    displayState.fill(null);

    const sst = Boolean(keyMatrix.kbsst);

    if (sst) {
      // Single-Step mode: execute one full instruction at a time.
      // After each instruction whose PC was outside ROM, fire NMI.
      // Use cpu.T() delta to get accurate T-state count per instruction for RIOT ticks.
      let remaining = tStates;
      while (remaining > 0) {
        const pc = cpu.status().pc;
        const outside = pc < 0x1800 || pc > 0x1FFF;
        const tBefore = cpu.T();
        cpu.singleStep();
        const elapsed = cpu.T() - tBefore;
        remaining -= elapsed;
        if (outside) cpu.nmi();
      }
    } else {
      // Normal mode: ticks callback handles RIOT synchronously per instruction
      cpu.steps(tStates);
    }

    return { initialized: true, display: [...displayState] };
  };

  // ── Tape public API ──────────────────────────────────────────────────────

  const tape = {
    /** Start recording cassette output (PA bit-7 transitions). */
    record() {
      tapeIntervals = [30000];
      tapeMgwait    = true;
      tapeMgt       = 0;
      tapeMglast    = 0;
      tapeRecording = true;
      tapePlayback  = false;
    },

    /**
     * Start playback from the internal interval buffer.
     * Call setReadBuffer() first to load an external tape.
     */
    play() {
      if (tapeIntervals.length < 2) return;
      tapeMgplast   = 0x00;
      tapeMgpt      = -1;  // lazy init: first tapeIn() call sets the reference T
      tapeMgpos     = 0;
      tapeMgdelay   = tapeIntervals[0];
      tapePlayback  = true;
      tapeRecording = false;
    },

    /** Stop recording or playback. */
    stop() {
      tapeRecording = false;
      tapePlayback  = false;
    },

    /** @returns {boolean} */
    isRecording() { return tapeRecording; },

    /** @returns {boolean} */
    isPlaying() { return tapePlayback; },

    /**
     * Load a raw interval array for playback.
     * @param {number[]} arr  Array of T-state intervals (element 0 = leader delay)
     */
    setReadBuffer(arr) {
      tapeIntervals = [...arr];
      tapeMgpos     = 0;
    },

    /**
     * Return a copy of the recorded interval array.
     * @returns {number[]}
     */
    getRecorded() { return [...tapeIntervals]; },

    /**
     * Parse a MOS papertape text string and load it into KIM-1 RAM.
     * @param {string} text  Contents of a .pap file
     * @returns {{ ok: boolean, blocks: number, error?: string }}
     */
    loadPAP(text) { return parsePAP(text, ram); },

    /**
     * Dump a RAM range as a MOS papertape string.
     * @param {number} startAddr  First address to dump (inclusive)
     * @param {number} endAddr    Last address to dump (inclusive)
     * @returns {string}  Papertape text ready for saving as .pap
     */
    savePAP(startAddr, endAddr) { return generatePAP(ram, startAddr, endAddr); },
  };

  // ── Serial public API ────────────────────────────────────────────────────

  const serial = {
    /**
     * Queue a string for the emulated KIM-1 to read via GETCH.
     * Characters are 7-bit ASCII; uppercase is recommended for the monitor.
     * @param {string} str
     */
    input(str) {
      for (let i = 0; i < str.length; i++) {
        serialInQueue.push(str.charCodeAt(i) & 0x7F);
      }
    },

    /**
     * Return and clear all characters produced by OUTCH since the last call.
     * @returns {string}
     */
    getOutput() {
      if (serialOutQueue.length === 0) return "";
      const str = String.fromCharCode(...serialOutQueue);
      serialOutQueue.length = 0;
      return str;
    },

    /** @returns {boolean} true if there is unread output waiting */
    outputReady() { return serialOutQueue.length > 0; },
  };

  // ── Public instance ──────────────────────────────────────────────────────

  return {
    /** Power-on reset. Must be called before frame(). */
    reset,

    /** Execute one animation frame. */
    frame,

    /** Trigger a 6502 NMI (ST key / STOP). */
    nmi() { cpu.nmi(); },

    /** Trigger a 6502 IRQ. */
    interrupt() { cpu.interrupt(); },

    /** Execute N T-states directly (bypass frame logic). */
    steps(n) { cpu.steps(n); },

    /** @returns {object} CPU register snapshot */
    getCpuStatus() { return cpu.status(); },

    /**
     * Set a CPU register by name.
     * @param {string} reg   "PC" | "A" | "X" | "Y" | "SP" | "FLAGS"
     * @param {number} value
     */
    setCpuRegister(reg, value) { cpu.set(reg, value); },

    /**
     * Zero-copy reference to the 64 KB RAM buffer.
     * Note: ROM regions (0x1800–0x1FFF) are also stored here after reset().
     * @returns {Uint8Array}
     */
    getRAM() { return ram; },

    /** Tape transport and .pap file API. */
    tape,

    /** Serial TTY character I/O. */
    serial,
  };
};
