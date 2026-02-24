/**
 * WDC 65C816 CPU Emulator
 *
 * ES6 module implementation of the WDC 65C816 16-bit processor.
 * The 65C816 is the enhanced 16-bit version of the 6502, used in the Super Nintendo,
 * Apple IIGS, and other systems.
 *
 * Features:
 * - Switchable 8/16-bit accumulator and index registers (M and X flags)
 * - 24-bit addressing (16MB address space via bank registers)
 * - Bank registers: PBR (Program Bank), DBR (Data Bank)
 * - Emulation mode for 6502 compatibility (E flag)
 * - 8 flags: N, V, M, X, D, I, Z, C (NVMXDIZC)
 * - Enhanced stack operations
 * - New addressing modes and instructions
 *
 * IMPLEMENTATION STATUS:
 * ⚠️ WARNING: This emulator is INCOMPLETE (~60% complete)
 *
 * WORKING FEATURES:
 * - 6502 compatibility mode (emulation mode)
 * - Basic 8-bit operations (LDA, STA, ADC, SBC, etc.)
 * - Standard addressing modes (immediate, absolute, indexed, etc.)
 * - Flag operations (SEC, CLC, SEI, CLI, etc.)
 * - Stack operations (PHA, PLA, PHP, PLP)
 * - Branches and jumps
 *
 * INCOMPLETE/STUBBED FEATURES:
 * - 16-bit accumulator mode (M flag=0) - STUBBED
 * - 16-bit index register mode (X flag=0) - STUBBED
 * - 24-bit long addressing modes - STUBBED
 * - Bank register operations - STUBBED
 * - 65816-exclusive instructions: MVP, MVN, PEI, PEA, BRL, JML, RTL, JSL, REP, SEP, XBA, XCE, COP, WDM - STUBBED
 * - Direct Page register offset - PARTIALLY IMPLEMENTED
 * - Stack Relative addressing - STUBBED
 * - Block move instructions - STUBBED
 *
 * Based on original work by Martin Maly.
 * Bugs fixed and modernized to ES6.
 *
 * @module 65816
 */

// Interrupt vector addresses
const RESET_VECTOR = 0xfffc;
const IRQ_VECTOR = 0xfffe;
const NMI_VECTOR = 0xfffa;

// Flag bit masks
const FLAG_CARRY = 1;
const FLAG_ZERO = 2;
const FLAG_INTERRUPT = 4;
const FLAG_DECIMAL = 8;
const FLAG_BREAK = 16;        // Also FLAG_INDEX_WIDTH in native mode
const FLAG_INDEX_WIDTH = 16;  // X flag in native mode (0=16-bit, 1=8-bit)
const FLAG_ACC_WIDTH = 32;    // M flag (0=16-bit, 1=8-bit)
const FLAG_OVERFLOW = 64;
const FLAG_NEGATIVE = 128;

// BCD conversion lookup tables
const bcd2dec = [
   0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, 14, 15,  // 0x00
  10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,  // 0x10
  20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35,  // 0x20
  30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45,  // 0x30
  40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55,  // 0x40
  50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65,  // 0x50
  60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75,  // 0x60
  70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85,  // 0x70
  80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95,  // 0x80
  90, 91, 92, 93, 94, 95, 96, 97, 98, 99,100,101,102,103,104,105,  // 0x90
 100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,  // 0xA0
 110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,  // 0xB0
 120,121,122,123,124,125,126,127,128,129,130,131,132,133,134,135,  // 0xC0
 130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,  // 0xD0
 140,141,142,143,144,145,146,147,148,149,150,151,152,153,154,155,  // 0xE0
 150,151,152,153,154,155,156,157,158,159,160,161,162,163,164,165   // 0xF0
];

const dec2bcd = [
  0x00,0x01,0x02,0x03,0x04,0x05,0x06,0x07,0x08,0x09,
  0x10,0x11,0x12,0x13,0x14,0x15,0x16,0x17,0x18,0x19,
  0x20,0x21,0x22,0x23,0x24,0x25,0x26,0x27,0x28,0x29,
  0x30,0x31,0x32,0x33,0x34,0x35,0x36,0x37,0x38,0x39,
  0x40,0x41,0x42,0x43,0x44,0x45,0x46,0x47,0x48,0x49,
  0x50,0x51,0x52,0x53,0x54,0x55,0x56,0x57,0x58,0x59,
  0x60,0x61,0x62,0x63,0x64,0x65,0x66,0x67,0x68,0x69,
  0x70,0x71,0x72,0x73,0x74,0x75,0x76,0x77,0x78,0x79,
  0x80,0x81,0x82,0x83,0x84,0x85,0x86,0x87,0x88,0x89,
  0x90,0x91,0x92,0x93,0x94,0x95,0x96,0x97,0x98,0x99
];

// Instruction timing tables (in CPU cycles)
const cycletime = [
  7, 6, 0, 0, 0, 3, 5, 0, 3, 2, 2, 0, 0, 4, 6, 0,  // 00
  2, 5, 0, 0, 0, 4, 6, 0, 2, 4, 0, 0, 0, 4, 7, 0,  // 10
  6, 6, 0, 0, 3, 3, 5, 0, 4, 2, 2, 0, 4, 4, 6, 0,  // 20
  2, 5, 0, 0, 0, 4, 6, 0, 2, 4, 0, 0, 0, 4, 7, 0,  // 30
  6, 6, 0, 0, 0, 3, 5, 0, 3, 2, 2, 0, 3, 4, 6, 0,  // 40
  2, 5, 0, 0, 0, 4, 6, 0, 2, 4, 0, 0, 0, 4, 7, 0,  // 50
  6, 6, 0, 0, 0, 3, 5, 0, 4, 2, 2, 0, 5, 4, 6, 0,  // 60
  2, 5, 0, 0, 0, 4, 6, 0, 2, 4, 0, 0, 0, 4, 7, 0,  // 70
  0, 6, 0, 0, 3, 3, 3, 0, 2, 0, 2, 0, 4, 4, 4, 0,  // 80
  2, 6, 0, 0, 4, 4, 4, 0, 2, 5, 2, 0, 0, 5, 0, 0,  // 90
  2, 6, 2, 0, 3, 3, 3, 0, 2, 2, 2, 0, 4, 4, 4, 0,  // A0
  2, 5, 0, 0, 4, 4, 4, 0, 2, 4, 2, 0, 4, 4, 4, 0,  // B0
  2, 6, 0, 0, 3, 3, 5, 0, 2, 2, 2, 0, 4, 4, 3, 0,  // C0
  2, 5, 0, 0, 0, 4, 6, 0, 2, 4, 0, 0, 0, 4, 7, 0,  // D0
  2, 6, 0, 0, 3, 3, 5, 0, 2, 2, 2, 0, 4, 4, 6, 0,  // E0
  2, 5, 0, 0, 0, 4, 6, 0, 2, 4, 0, 0, 0, 4, 7, 0   // F0
];

// Extra cycles for page boundary crossing
const extracycles = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,  // 00
  2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0,  // 10
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,  // 20
  2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0,  // 30
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,  // 40
  2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0,  // 50
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,  // 60
  2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0,  // 70
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,  // 80
  2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,  // 90
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,  // A0
  2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 1, 0,  // B0
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,  // C0
  2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0,  // D0
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,  // E0
  2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0   // F0
];

/**
 * Creates a new 65C816 CPU emulator instance
 *
 * @returns {Object} CPU emulator instance with public methods
 */
const createCPU65816 = () => {
  // CPU registers
  let a = 0;          // Accumulator (8-bit or 16-bit)
  let x = 0;          // X index register (8-bit or 16-bit)
  let y = 0;          // Y index register (8-bit or 16-bit)
  let flags = 32;     // Processor status register
  let sp = 255;       // Stack pointer
  let pc = 0;         // Program counter
  let dbr = 0;        // Data bank register
  let dp = 0;         // Direct page register
  let pbr = 0;        // Program bank register
  let breakFlag = false;
  let emulation = true;  // Start in emulation mode (6502 compatible)
  let exbytes = 0;    // Extra bytes for current instruction
  let excycles = 0;   // Extra cycles for current instruction
  let addcycles = 0;  // Flag to add cycles for page crossing
  let T = 0;          // Total cycle counter

  // Memory interface callbacks (set via init())
  let byteTo = null;
  let byteAt = null;
  let ticks = null;

  /**
   * Check if accumulator is in 16-bit mode
   * FIXED BUG: Changed && to & for bitwise AND
   */
  const isAcc16 = () => ((flags & FLAG_ACC_WIDTH) === 0 && !emulation);

  /**
   * Check if index registers are in 16-bit mode
   * FIXED BUG: Changed && to & for bitwise AND
   */
  const isIdx16 = () => ((flags & FLAG_INDEX_WIDTH) === 0 && !emulation);

  /**
   * Read 16-bit word at address (little-endian)
   */
  const wordAt = (addr) => byteAt(addr) + byteAt(0xffff & (addr + 1)) * 256;

  /**
   * Fetch byte at PC
   */
  const m1 = () => byteAt(pc);

  /**
   * Add extra cycle if accumulator is 16-bit
   */
  const excyc = () => {
    if ((flags & FLAG_ACC_WIDTH) === 0) excycles++;
  };

  /**
   * Add extra cycles for direct page addressing
   */
  const exdp = () => {
    if (dp !== 0) excycles++;
    if ((flags & FLAG_ACC_WIDTH) === 0) excycles++;
  };

  /**
   * Add extra cycle for index crossing page boundary
   */
  const exx = (x) => {
    if ((x & 0xff) === 0xff) excycles++;
  };

  // ============================================================================
  // ADDRESSING MODES
  // ============================================================================

  /**
   * Implied addressing mode
   */
  const aimp = () => {
    exbytes = 0;
    return null;
  };

  /**
   * Immediate addressing mode
   */
  const aimm = () => {
    exbytes = 1;
    if ((flags & FLAG_ACC_WIDTH) === 0) exbytes++;
    excyc();
    return pc;
  };

  /**
   * Absolute addressing mode
   */
  const aabs = () => {
    exbytes = 2;
    excyc();
    return wordAt(pc);
  };

  /**
   * Absolute Long addressing mode (24-bit)
   * ⚠️ STUB: Returns 16-bit address only
   */
  const aabl = () => {
    exbytes = 3;
    excyc();
    return wordAt(pc);
  };

  /**
   * Direct Page addressing mode
   */
  const adp = () => {
    exbytes = 1;
    exdp();
    return (dp << 8) + byteAt(pc);
  };

  /**
   * Direct Page indexed by X
   */
  const adpx = () => {
    exbytes = 1;
    exdp();
    return (dp << 8) + (255 & (x + byteAt(pc)));
  };

  /**
   * Direct Page indexed by Y
   */
  const adpy = () => {
    exbytes = 1;
    exdp();
    return (dp << 8) + (255 & (y + byteAt(pc)));
  };

  /**
   * Direct Page Indexed Indirect (DP,X)
   */
  const aidx = () => {
    exbytes = 1;
    exdp();
    return wordAt((dp << 8) + (255 & (x + byteAt(pc))));
  };

  /**
   * Direct Page Indirect Indexed (DP),Y
   */
  const aidy = () => {
    exbytes = 1;
    if (addcycles) {
      const a1 = wordAt((dp << 8) + byteAt(pc));
      const a2 = (a1 + y) & 0xffff;
      if ((a1 & 0xff00) !== (a2 & 0xff00)) excycles++;
      return a2;
    } else {
      return (wordAt((dp << 8) + byteAt(pc)) + y) & 0xffff;
    }
  };

  /**
   * Direct Page Indirect (DP)
   * ⚠️ STUB: Basic implementation
   */
  const aidp = () => {
    exbytes = 1;
    exdp();
    return wordAt((dp << 8) + byteAt(pc));
  };

  /**
   * Direct Page Indirect Long [DP]
   * ⚠️ STUB: Returns 16-bit address only
   */
  const aidl = () => {
    exbytes = 1;
    exdp();
    return wordAt((dp << 8) + byteAt(pc));
  };

  /**
   * Direct Page Indirect Long Indexed [DP],Y
   * ⚠️ STUB: Returns 16-bit address only
   */
  const aidly = () => {
    exbytes = 1;
    exdp();
    const addr = wordAt((dp << 8) + byteAt(pc));
    return (addr + y) & 0xffff;
  };

  /**
   * Stack Relative Indirect Indexed (SR,S),Y
   * ⚠️ STUB: Not implemented
   */
  const aisy = () => {
    exbytes = 1;
    return 0;
  };

  /**
   * Absolute Indexed by X
   */
  const aabx = () => {
    exbytes = 2;
    excyc();
    if (addcycles) {
      const a1 = wordAt(pc);
      const a2 = (a1 + x) & 0xffff;
      if ((a1 & 0xff00) !== (a2 & 0xff00)) excycles++;
      return a2;
    } else {
      return (wordAt(pc) + x) & 0xffff;
    }
  };

  /**
   * Absolute Indexed by Y
   */
  const aaby = () => {
    exbytes = 2;
    excyc();
    if (addcycles) {
      const a1 = wordAt(pc);
      const a2 = (a1 + y) & 0xffff;
      if ((a1 & 0xff00) !== (a2 & 0xff00)) excycles++;
      return a2;
    } else {
      return (wordAt(pc) + y) & 0xffff;
    }
  };

  /**
   * Absolute Indirect
   */
  const aind = () => {
    exbytes = 2;
    const ta = wordAt(pc);
    return wordAt(ta);
  };

  /**
   * Relative addressing (for branches)
   */
  const arel = () => {
    exbytes = 1;
    return pc;
  };

  /**
   * Relative Long (16-bit relative)
   * ⚠️ STUB: Basic implementation
   */
  const arell = () => {
    exbytes = 2;
    return pc;
  };

  /**
   * Block Move addressing
   * ⚠️ STUB: Not implemented
   */
  const abm = () => {
    exbytes = 2;
    return 0;
  };

  /**
   * Stack Relative
   * ⚠️ STUB: Not implemented
   */
  const asr = () => {
    exbytes = 1;
    return 0;
  };

  /**
   * Absolute Long Indexed X
   * ⚠️ STUB: Returns 16-bit address only
   */
  const aalx = () => {
    exbytes = 3;
    excyc();
    return (wordAt(pc) + x) & 0xffff;
  };

  /**
   * Absolute Indexed Indirect (a,X)
   * ⚠️ STUB: Basic implementation
   */
  const aiax = () => {
    exbytes = 2;
    const base = wordAt(pc);
    return wordAt((base + x) & 0xffff);
  };

  /**
   * Absolute Indirect Long [a]
   * ⚠️ STUB: Returns 16-bit address only
   */
  const aial = () => {
    exbytes = 2;
    const ta = wordAt(pc);
    return wordAt(ta);
  };

  /**
   * Accumulator addressing (used by some implementations)
   * ⚠️ STUB: Not used in this implementation
   */
  const aima = () => {
    exbytes = 0;
    return null;
  };

  /**
   * Branch relative addressing helper
   */
  const branchRelAddr = () => {
    excycles++;
    const offset = byteAt(pc);
    pc++;  // Move past offset byte
    // Calculate target address relative to current PC (after offset byte)
    const addr = (offset & 128) ? pc - ((offset ^ 255) + 1) : pc + offset;
    if ((pc & 0xff00) !== (addr & 0xff00)) excycles++;
    pc = addr & 0xffff;
  };

  // ============================================================================
  // STACK OPERATIONS
  // ============================================================================

  const stPush = (z) => {
    byteTo(sp + 256, z & 255);
    sp--;
    sp &= 255;
  };

  const stPop = () => {
    sp++;
    sp &= 255;
    return byteAt(sp + 256);
  };

  const stPushWord = (z) => {
    stPush((z >> 8) & 255);
    stPush(z & 255);
  };

  const stPopWord = () => {
    let z = stPop();
    z += 256 * stPop();
    return z;
  };

  // ============================================================================
  // FLAG OPERATIONS
  // ============================================================================

  /**
   * Update N and Z flags based on value
   */
  const flagsNZ = (z) => {
    flags &= ~(FLAG_ZERO + FLAG_NEGATIVE);
    if (z === 0) {
      flags |= FLAG_ZERO;
    } else {
      flags |= z & 128;
    }
  };

  /**
   * Calculate overflow flag for ADC
   */
  const flagVadc = (m, n, s) => {
    const m7 = (m & 0x80) ? 1 : 0;
    const n7 = (n & 0x80) ? 1 : 0;
    const s7 = (s & 0x80) ? 1 : 0;
    let v = 0;
    if ((m7 === 0) && (n7 === 0) && (s7 === 1)) v = 1;
    if ((m7 === 1) && (n7 === 1) && (s7 === 0)) v = 1;
    return v;
  };

  /**
   * Calculate overflow flag for SBC
   */
  const flagVsbc = (m, n, s) => {
    const m7 = (m & 0x80) ? 1 : 0;
    const n7 = (n & 0x80) ? 1 : 0;
    const s7 = (s & 0x80) ? 1 : 0;
    let v = 0;
    if ((m7 === 0) && (n7 === 1) && (s7 === 0)) v = 1;
    if ((m7 === 1) && (n7 === 0) && (s7 === 1)) v = 1;
    return v;
  };

  // ============================================================================
  // OPERATION HELPERS
  // ============================================================================

  const opORA = (x) => {
    a |= byteAt(x());
    flagsNZ(a);
  };

  const opASL = (x) => {
    const addr = x();
    let tbyte = byteAt(addr);
    flags &= ~(FLAG_CARRY + FLAG_NEGATIVE + FLAG_ZERO);
    if (tbyte & 128) flags |= FLAG_CARRY;
    tbyte = tbyte << 1;
    if (tbyte) {
      flags |= tbyte & 128;
    } else {
      flags |= FLAG_ZERO;
    }
    byteTo(addr, tbyte);
  };

  const opLSR = (x) => {
    const addr = x();
    let tbyte = byteAt(addr);
    flags &= ~(FLAG_CARRY + FLAG_NEGATIVE + FLAG_ZERO);
    flags |= tbyte & 1;
    tbyte = tbyte >> 1;
    if (tbyte === 0) {
      flags |= FLAG_ZERO;
    }
    byteTo(addr, tbyte);
  };

  const opBCL = (x) => {
    if (flags & x) {
      pc++;
    } else {
      branchRelAddr();
    }
    exbytes = 0;  // Branch instructions handle PC themselves
  };

  const opBST = (x) => {
    if (flags & x) {
      branchRelAddr();
    } else {
      pc++;
    }
    exbytes = 0;  // Branch instructions handle PC themselves
  };

  const opCLR = (x) => {
    flags &= ~x;
  };

  const opSET = (x) => {
    flags |= x;
  };

  const opAND = (x) => {
    a &= byteAt(x());
    flagsNZ(a);
  };

  const opBIT = (x) => {
    const tbyte = byteAt(x());
    flags &= ~(FLAG_ZERO + FLAG_NEGATIVE + FLAG_OVERFLOW);
    if ((a & tbyte) === 0) flags |= FLAG_ZERO;
    flags |= tbyte & (128 + 64);
  };

  const opROL = (x) => {
    const addr = x();
    let tbyte = byteAt(addr);
    if (flags & FLAG_CARRY) {
      if ((tbyte & 128) === 0) {
        flags &= ~FLAG_CARRY;
      }
      tbyte = (tbyte << 1) | 1;
    } else {
      if (tbyte & 128) flags |= FLAG_CARRY;
      tbyte = tbyte << 1;
    }
    flagsNZ(tbyte);
    byteTo(addr, tbyte);
  };

  const opEOR = (x) => {
    a ^= byteAt(x());
    flagsNZ(a);
  };

  const opADC = (x) => {
    let data = byteAt(x());
    const olddata = data;
    if (flags & FLAG_DECIMAL) {
      data = bcd2dec[data] + bcd2dec[a] + ((flags & FLAG_CARRY) ? 1 : 0);
      flags &= ~(FLAG_CARRY + FLAG_OVERFLOW + FLAG_NEGATIVE + FLAG_ZERO);
      if (flagVadc(olddata, a, data)) {
        flags |= FLAG_OVERFLOW;
      }
      if (data > 99) {
        flags |= FLAG_CARRY;
        data -= 100;
      }
      if (data === 0) {
        flags |= FLAG_ZERO;
      } else {
        flags |= data & 128;
      }
      a = dec2bcd[data];
    } else {
      data += a + ((flags & FLAG_CARRY) ? 1 : 0);
      flags &= ~(FLAG_CARRY + FLAG_OVERFLOW + FLAG_NEGATIVE + FLAG_ZERO);
      if (data > 255) {
        flags |= FLAG_CARRY;
        data &= 255;
      }
      if (data === 0) {
        flags |= FLAG_ZERO;
      } else {
        flags |= data & 128;
      }
      if (flagVadc(olddata, a, data)) {
        flags |= FLAG_OVERFLOW;
      }
      a = data;
    }
  };

  const opROR = (x) => {
    const addr = x();
    let tbyte = byteAt(addr);
    if (flags & FLAG_CARRY) {
      if ((tbyte & 1) === 0) flags &= ~FLAG_CARRY;
      tbyte = (tbyte >> 1) | 128;
    } else {
      if (tbyte & 1) flags |= FLAG_CARRY;
      tbyte = tbyte >> 1;
    }
    flagsNZ(tbyte);
    byteTo(addr, tbyte);
  };

  const opSTA = (x) => {
    byteTo(x(), a);
  };

  const opSTY = (x) => {
    byteTo(x(), y);
  };

  const opSTX = (y) => {
    byteTo(y(), x);
  };

  const opCPY = (x) => {
    const tbyte = byteAt(x());
    flags &= ~(FLAG_CARRY + FLAG_ZERO + FLAG_NEGATIVE);
    if (y === tbyte) {
      flags |= FLAG_CARRY + FLAG_ZERO;
    } else if (y > tbyte) {
      flags |= FLAG_CARRY;
    } else {
      flags |= FLAG_NEGATIVE;
    }
  };

  const opCPX = (y) => {
    const tbyte = byteAt(y());
    flags &= ~(FLAG_CARRY + FLAG_ZERO + FLAG_NEGATIVE);
    if (x === tbyte) {
      flags |= FLAG_CARRY + FLAG_ZERO;
    } else if (x > tbyte) {
      flags |= FLAG_CARRY;
    } else {
      flags |= FLAG_NEGATIVE;
    }
  };

  const opCMP = (x) => {
    const tbyte = byteAt(x());
    flags &= ~(FLAG_CARRY + FLAG_ZERO + FLAG_NEGATIVE);
    if (a === tbyte) {
      flags |= FLAG_CARRY + FLAG_ZERO;
    } else if (a > tbyte) {
      flags |= FLAG_CARRY;
    } else {
      flags |= FLAG_NEGATIVE;
    }
  };

  const opSBC = (x) => {
    let data = byteAt(x());
    const olddata = data;
    if (flags & FLAG_DECIMAL) {
      data = bcd2dec[a] - bcd2dec[data] - ((flags & FLAG_CARRY) ? 0 : 1);
      flags &= ~(FLAG_CARRY + FLAG_ZERO + FLAG_NEGATIVE + FLAG_OVERFLOW);
      if (flagVsbc(olddata, a, data)) {
        flags |= FLAG_OVERFLOW;
      }
      if (data === 0) {
        flags |= FLAG_ZERO + FLAG_CARRY;
      } else if (data > 0) {
        flags |= FLAG_CARRY;
      } else {
        flags |= FLAG_NEGATIVE;
        data += 100;
      }
      a = dec2bcd[data];
    } else {
      data = a - data - ((flags & FLAG_CARRY) ? 0 : 1);
      flags &= ~(FLAG_CARRY + FLAG_ZERO + FLAG_OVERFLOW + FLAG_NEGATIVE);
      if (data === 0) {
        flags |= FLAG_ZERO + FLAG_CARRY;
      } else if (data > 0) {
        flags |= FLAG_CARRY;
      }
      flags |= data & 128;
      if (flagVsbc(olddata, a, data)) {
        flags |= FLAG_OVERFLOW;
      }
      a = data & 255;
    }
  };

  const opDECR = (x) => {
    const addr = x();
    let tbyte = (byteAt(addr) - 1) & 255;
    flags &= ~(FLAG_ZERO + FLAG_NEGATIVE);
    if (tbyte) {
      flags |= tbyte & 128;
    } else {
      flags |= FLAG_ZERO;
    }
    byteTo(addr, tbyte);
  };

  const opINCR = (x) => {
    const addr = x();
    let tbyte = (byteAt(addr) + 1) & 255;
    flags &= ~(FLAG_ZERO + FLAG_NEGATIVE);
    if (tbyte) {
      flags |= tbyte & 128;
    } else {
      flags |= FLAG_ZERO;
    }
    byteTo(addr, tbyte);
  };

  const opLDA = (x) => {
    a = byteAt(x());
    flagsNZ(a);
  };

  const opLDY = (x) => {
    y = byteAt(x());
    flagsNZ(y);
  };

  const opLDX = (y) => {
    x = byteAt(y());
    flagsNZ(x);
  };

  // ============================================================================
  // INSTRUCTION IMPLEMENTATIONS
  // ============================================================================

  // BRK - Break
  const ibrk = () => {
    flags |= FLAG_BREAK;
    stPushWord(pc);
    stPush(flags);
    flags |= FLAG_INTERRUPT;
    pc = wordAt(IRQ_VECTOR);
    breakFlag = true;
  };

  // ORA - OR with Accumulator
  const iora = (ad) => {
    a |= byteAt(ad);
    flagsNZ(a);
  };

  // COP - Coprocessor instruction
  // ⚠️ STUB: Not implemented
  const icop = () => {
    pc++;
  };

  // TSB - Test and Set Bits
  // ⚠️ STUB: Not implemented
  const itsb = () => {
    pc++;
  };

  // ASL - Arithmetic Shift Left
  const iasl = (ad) => {
    if (ad === null) {
      // ASL A
      if (a & 128) {
        flags |= FLAG_CARRY;
      } else {
        flags &= ~FLAG_CARRY;
      }
      a = a << 1;
      flagsNZ(a);
      a &= 255;
    } else {
      opASL(() => ad);
    }
  };

  // PHP - Push Processor Status
  const iphp = () => {
    stPush(flags);
  };

  // PHD - Push Direct Page Register
  // ⚠️ STUB: Basic implementation
  const iphd = () => {
    stPushWord(dp);
  };

  // ORA immediate
  const iora_imm = () => {
    a |= byteAt(pc);
    flagsNZ(a);
    pc++;
  };

  // BPL - Branch if Plus
  const ibpl = () => {
    opBCL(FLAG_NEGATIVE);
  };

  // TRB - Test and Reset Bits
  // ⚠️ STUB: Not implemented
  const itrb = () => {
    pc++;
  };

  // CLC - Clear Carry
  const iclc = () => {
    opCLR(FLAG_CARRY);
  };

  // INC - Increment
  const iinc = (ad) => {
    if (ad === null) {
      // INC A
      a++;
      a &= 255;
      flagsNZ(a);
    } else {
      opINCR(() => ad);
    }
  };

  // TCS - Transfer Accumulator to Stack Pointer
  // ⚠️ STUB: Basic implementation
  const itcs = () => {
    sp = a;
  };

  // JSR - Jump to Subroutine
  const ijsr = (ad) => {
    // Push address of last byte of JSR instruction (PC + 1)
    // PC is currently at first address byte, last byte is at PC+1
    stPushWord((pc + 1) & 0xffff);
    pc = ad;
    exbytes = 0;  // We've set PC ourselves, don't add exbytes
  };

  // AND - AND with Accumulator
  const iand = (ad) => {
    a &= byteAt(ad);
    flagsNZ(a);
  };

  // BIT - Bit Test
  const ibit = (ad) => {
    const tbyte = byteAt(ad);
    flags &= ~(FLAG_ZERO + FLAG_NEGATIVE + FLAG_OVERFLOW);
    if ((a & tbyte) === 0) flags |= FLAG_ZERO;
    flags |= tbyte & (128 + 64);
  };

  // ROL - Rotate Left
  const irol = (ad) => {
    if (ad === null) {
      // ROL A
      if (flags & FLAG_CARRY) {
        if ((a & 128) === 0) flags &= ~FLAG_CARRY;
        a = (a << 1) | 1;
      } else {
        if (a & 128) flags |= FLAG_CARRY;
        a = a << 1;
      }
      flagsNZ(a);
      a &= 255;
    } else {
      opROL(() => ad);
    }
  };

  // PLP - Pull Processor Status
  const iplp = () => {
    flags = stPop();
  };

  // PLD - Pull Direct Page Register
  // ⚠️ STUB: Basic implementation
  const ipld = () => {
    dp = stPopWord();
  };

  // BMI - Branch if Minus
  const ibmi = () => {
    opBST(FLAG_NEGATIVE);
  };

  // SEC - Set Carry
  const isec = () => {
    opSET(FLAG_CARRY);
  };

  // DEC - Decrement
  const idec = (ad) => {
    if (ad === null) {
      // DEC A
      a--;
      a &= 255;
      flagsNZ(a);
    } else {
      opDECR(() => ad);
    }
  };

  // TSC - Transfer Stack Pointer to Accumulator
  // ⚠️ STUB: Basic implementation
  const itsc = () => {
    a = sp;
    flagsNZ(a);
  };

  // RTI - Return from Interrupt
  const irti = () => {
    flags = stPop();
    pc = stPopWord();
  };

  // EOR - Exclusive OR
  const ieor = (ad) => {
    a ^= byteAt(ad);
    flagsNZ(a);
  };

  // WDM - Reserved for future use
  // ⚠️ STUB: Not implemented
  const iwdm = () => {
    pc++;
  };

  // MVP - Block Move Previous
  // ⚠️ STUB: Not implemented
  const imvp = () => {
    pc += 2;
  };

  // LSR - Logical Shift Right
  const ilsr = (ad) => {
    if (ad === null) {
      // LSR A
      flags &= ~(FLAG_CARRY + FLAG_NEGATIVE + FLAG_ZERO);
      if (a & 1) flags |= FLAG_CARRY;
      a = a >> 1;
      if (a === 0) {
        flags |= FLAG_ZERO;
      }
      a &= 255;
    } else {
      opLSR(() => ad);
    }
  };

  // PHA - Push Accumulator
  const ipha = () => {
    stPush(a);
  };

  // PHK - Push Program Bank Register
  // ⚠️ STUB: Basic implementation
  const iphk = () => {
    stPush(pbr);
  };

  // JMP - Jump
  const ijmp = (ad) => {
    pc = ad;
    exbytes = 0;  // We've set PC ourselves, don't add exbytes
  };

  // BVC - Branch if Overflow Clear
  const ibvc = () => {
    opBCL(FLAG_OVERFLOW);
  };

  // MVN - Block Move Next
  // ⚠️ STUB: Not implemented
  const imvn = () => {
    pc += 2;
  };

  // CLI - Clear Interrupt Disable
  const icli = () => {
    opCLR(FLAG_INTERRUPT);
  };

  // PHY - Push Y Register
  // ⚠️ STUB: Basic implementation
  const iphy = () => {
    stPush(y);
  };

  // TCD - Transfer Accumulator to Direct Page
  // ⚠️ STUB: Basic implementation
  const itcd = () => {
    dp = a;
  };

  // RTS - Return from Subroutine
  const irts = () => {
    pc = stPopWord();
    pc++;
  };

  // ADC - Add with Carry
  const iadc = (ad) => {
    let data = byteAt(ad);
    const olddata = data;
    if (flags & FLAG_DECIMAL) {
      data = bcd2dec[data] + bcd2dec[a] + ((flags & FLAG_CARRY) ? 1 : 0);
      flags &= ~(FLAG_CARRY + FLAG_OVERFLOW + FLAG_NEGATIVE + FLAG_ZERO);
      if (data > 99) {
        flags |= FLAG_CARRY;
        data -= 100;
      }
      if (data === 0) {
        flags |= FLAG_ZERO;
      } else {
        flags |= data & 128;
      }
      if (flagVadc(olddata, a, data)) {
        flags |= FLAG_OVERFLOW;
      }
      a = dec2bcd[data];
    } else {
      data += a + ((flags & FLAG_CARRY) ? 1 : 0);
      flags &= ~(FLAG_CARRY + FLAG_OVERFLOW + FLAG_NEGATIVE + FLAG_ZERO);
      if (data > 255) {
        flags |= FLAG_CARRY;
        data &= 255;
      }
      if (data === 0) {
        flags |= FLAG_ZERO;
      } else {
        flags |= data & 128;
      }
      if (flagVadc(olddata, a, data)) {
        flags |= FLAG_OVERFLOW;
      }
      a = data;
    }
  };

  // PER - Push Effective Relative Address
  // ⚠️ STUB: Not implemented
  const iper = () => {
    pc += 2;
  };

  // STZ - Store Zero
  // ⚠️ STUB: Basic implementation
  const istz = (ad) => {
    byteTo(ad, 0);
  };

  // ROR - Rotate Right
  const iror = (ad) => {
    if (ad === null) {
      // ROR A
      if (flags & FLAG_CARRY) {
        if ((a & 1) === 0) flags &= ~FLAG_CARRY;
        a = (a >> 1) | 128;
      } else {
        if (a & 1) flags |= FLAG_CARRY;
        a = a >> 1;
      }
      flagsNZ(a);
      a &= 255;
    } else {
      opROR(() => ad);
    }
  };

  // PLA - Pull Accumulator
  const ipla = () => {
    a = stPop();
    flagsNZ(a);
  };

  // RTL - Return from Subroutine Long
  // ⚠️ STUB: Basic implementation (acts like RTS)
  const irtl = () => {
    pc = stPopWord();
    pc++;
  };

  // BVS - Branch if Overflow Set
  const ibvs = () => {
    opBST(FLAG_OVERFLOW);
  };

  // SEI - Set Interrupt Disable
  const isei = () => {
    opSET(FLAG_INTERRUPT);
  };

  // PLY - Pull Y Register
  // ⚠️ STUB: Basic implementation
  const iply = () => {
    y = stPop();
    flagsNZ(y);
  };

  // TDC - Transfer Direct Page to Accumulator
  // ⚠️ STUB: Basic implementation
  const itdc = () => {
    a = dp;
    flagsNZ(a);
  };

  // BRA - Branch Always
  const ibra = () => {
    branchRelAddr();
  };

  // STA - Store Accumulator
  const ista = (ad) => {
    byteTo(ad, a);
  };

  // BRL - Branch Long Always
  // ⚠️ STUB: Not implemented (acts like BRA)
  const ibrl = () => {
    branchRelAddr();
  };

  // STY - Store Y Register
  const isty = (ad) => {
    byteTo(ad, y);
  };

  // STX - Store X Register
  const istx = (ad) => {
    byteTo(ad, x);
  };

  // DEY - Decrement Y
  const idey = () => {
    y--;
    y &= 255;
    flagsNZ(y);
  };

  // TXA - Transfer X to Accumulator
  const itxa = () => {
    a = x;
    flagsNZ(a);
  };

  // PHB - Push Data Bank Register
  // ⚠️ STUB: Basic implementation
  const iphb = () => {
    stPush(dbr);
  };

  // BCC - Branch if Carry Clear
  const ibcc = () => {
    opBCL(FLAG_CARRY);
  };

  // TYA - Transfer Y to Accumulator
  const itya = () => {
    a = y;
    flagsNZ(a);
  };

  // TXS - Transfer X to Stack Pointer
  const itxs = () => {
    sp = x;
  };

  // TXY - Transfer X to Y
  // ⚠️ STUB: Basic implementation
  const itxy = () => {
    y = x;
    flagsNZ(y);
  };

  // LDY - Load Y Register
  const ildy = (ad) => {
    y = byteAt(ad);
    flagsNZ(y);
  };

  // LDA - Load Accumulator
  const ilda = (ad) => {
    a = byteAt(ad);
    flagsNZ(a);
  };

  // LDX - Load X Register
  const ildx = (ad) => {
    x = byteAt(ad);
    flagsNZ(x);
  };

  // TAY - Transfer Accumulator to Y
  const itay = () => {
    y = a;
    flagsNZ(y);
  };

  // TAX - Transfer Accumulator to X
  const itax = () => {
    x = a;
    flagsNZ(x);
  };

  // PLB - Pull Data Bank Register
  // ⚠️ STUB: Basic implementation
  const iplb = () => {
    dbr = stPop();
  };

  // BCS - Branch if Carry Set
  const ibcs = () => {
    opBST(FLAG_CARRY);
  };

  // CLV - Clear Overflow
  const iclv = () => {
    opCLR(FLAG_OVERFLOW);
  };

  // TSX - Transfer Stack Pointer to X
  const itsx = () => {
    x = sp;
    flagsNZ(x);
  };

  // TYX - Transfer Y to X
  // ⚠️ STUB: Basic implementation
  const ityx = () => {
    x = y;
    flagsNZ(x);
  };

  // CPY - Compare Y Register
  const icpy = (ad) => {
    const tbyte = byteAt(ad);
    flags &= ~(FLAG_CARRY + FLAG_ZERO + FLAG_NEGATIVE);
    if (y === tbyte) {
      flags |= FLAG_CARRY + FLAG_ZERO;
    } else if (y > tbyte) {
      flags |= FLAG_CARRY;
    } else {
      flags |= FLAG_NEGATIVE;
    }
  };

  // CMP - Compare Accumulator
  const icmp = (ad) => {
    const tbyte = byteAt(ad);
    flags &= ~(FLAG_CARRY + FLAG_ZERO + FLAG_NEGATIVE);
    if (a === tbyte) {
      flags |= FLAG_CARRY + FLAG_ZERO;
    } else if (a > tbyte) {
      flags |= FLAG_CARRY;
    } else {
      flags |= FLAG_NEGATIVE;
    }
  };

  // REP - Reset Processor Status Bits
  // ⚠️ STUB: Basic implementation
  const irep = () => {
    const mask = byteAt(pc);
    flags &= ~mask;
    pc++;
  };

  // INY - Increment Y
  const iiny = () => {
    y++;
    y &= 255;
    flagsNZ(y);
  };

  // DEX - Decrement X
  const idex = () => {
    x--;
    x &= 255;
    flagsNZ(x);
  };

  // WAI - Wait for Interrupt
  // ⚠️ STUB: Not implemented
  const iwai = () => {
    // Do nothing
  };

  // BNE - Branch if Not Equal
  const ibne = () => {
    opBCL(FLAG_ZERO);
  };

  // PEI - Push Effective Indirect Address
  // ⚠️ STUB: Not implemented
  const ipei = () => {
    pc++;
  };

  // CLD - Clear Decimal Mode
  const icld = () => {
    opCLR(FLAG_DECIMAL);
  };

  // PHX - Push X Register
  // ⚠️ STUB: Basic implementation
  const iphx = () => {
    stPush(x);
  };

  // STP - Stop Processor
  // ⚠️ STUB: Not implemented
  const istp = () => {
    // Do nothing
  };

  // CPX - Compare X Register
  const icpx = (ad) => {
    const tbyte = byteAt(ad);
    flags &= ~(FLAG_CARRY + FLAG_ZERO + FLAG_NEGATIVE);
    if (x === tbyte) {
      flags |= FLAG_CARRY + FLAG_ZERO;
    } else if (x > tbyte) {
      flags |= FLAG_CARRY;
    } else {
      flags |= FLAG_NEGATIVE;
    }
  };

  // SBC - Subtract with Carry
  const isbc = (ad) => {
    let data = byteAt(ad);
    const olddata = data;
    if (flags & FLAG_DECIMAL) {
      data = bcd2dec[a] - bcd2dec[data] - ((flags & FLAG_CARRY) ? 0 : 1);
      flags &= ~(FLAG_CARRY + FLAG_ZERO + FLAG_NEGATIVE + FLAG_OVERFLOW);
      if (flagVsbc(olddata, a, data)) {
        flags |= FLAG_OVERFLOW;
      }
      if (data === 0) {
        flags |= FLAG_ZERO + FLAG_CARRY;
      } else if (data > 0) {
        flags |= FLAG_CARRY;
      } else {
        flags |= FLAG_NEGATIVE;
        data += 100;
      }
      a = dec2bcd[data];
    } else {
      data = a - data - ((flags & FLAG_CARRY) ? 0 : 1);
      flags &= ~(FLAG_CARRY + FLAG_ZERO + FLAG_OVERFLOW + FLAG_NEGATIVE);
      if (data === 0) {
        flags |= FLAG_ZERO + FLAG_CARRY;
      } else if (data > 0) {
        flags |= FLAG_CARRY;
      }
      data &= 255;
      flags |= data & 128;
      if (flagVsbc(olddata, a, data)) {
        flags |= FLAG_OVERFLOW;
      }
      a = data;
    }
  };

  // SEP - Set Processor Status Bits
  // ⚠️ STUB: Basic implementation
  const isep = () => {
    const mask = byteAt(pc);
    flags |= mask;
    pc++;
  };

  // INX - Increment X
  const iinx = () => {
    x++;
    x &= 255;
    flagsNZ(x);
  };

  // NOP - No Operation
  const inop = () => {
    // Do nothing
  };

  // XBA - Exchange B and A
  // ⚠️ STUB: Not implemented (65816 specific)
  const ixba = () => {
    // Do nothing
  };

  // BEQ - Branch if Equal
  const ibeq = () => {
    opBST(FLAG_ZERO);
  };

  // PEA - Push Effective Address
  // ⚠️ STUB: Not implemented
  const ipea = () => {
    pc += 2;
  };

  // SED - Set Decimal Mode
  const ised = () => {
    opSET(FLAG_DECIMAL);
  };

  // PLX - Pull X Register
  // ⚠️ STUB: Basic implementation
  const iplx = () => {
    x = stPop();
    flagsNZ(x);
  };

  // XCE - Exchange Carry and Emulation
  // ⚠️ STUB: Not implemented (65816 specific)
  const ixce = () => {
    // Swap carry flag and emulation mode
    const temp = (flags & FLAG_CARRY) !== 0;
    if (emulation) {
      flags |= FLAG_CARRY;
    } else {
      flags &= ~FLAG_CARRY;
    }
    emulation = temp;
  };

  // Addressing mode lookup table
  // FIXED BUG: Complete and properly aligned table
  const admode = [
    aimp, aidx, aimm, asr, adp, adp, adp, aidl, aimp, aimm, aima, aimp, aabs, aabs, aabs, aabl,
    arel, aidy, aidp, aisy, adp, adpx, adpx, aidly, aimp, aaby, aimp, aimp, aabs, aabx, aabx, aalx,
    aabs, aidx, aabl, asr, adp, adp, adp, aidl, aimp, aimm, aima, aimp, aabs, aabs, aabs, aabl,
    arel, aidy, aidp, aisy, adpx, adpx, adpx, aidly, aimp, aaby, aimp, aimp, aabx, aabx, aabx, aalx,
    aimp, aidx, aimp, asr, abm, adp, adp, aidl, aimp, aimm, aima, aimp, aabs, aabs, aabs, aabl,
    arel, aidy, aidp, aisy, abm, adpx, adpx, aidly, aimp, aaby, aimp, aimp, aabl, aabx, aabx, aalx,
    aimp, aidx, arell, asr, adp, adp, adp, aidl, aimp, aimm, aimp, aimp, aind, aabs, aabs, aabl,
    arel, aidy, aidp, aisy, adpx, adpx, adpx, aidly, aimp, aaby, aimp, aimp, aial, aabx, aabx, aalx,
    arel, aidx, arell, asr, adp, adp, adp, aidl, aimp, aimm, aimp, aimp, aabs, aabs, aabs, aabl,
    arel, aidy, aidp, aisy, adpx, adpx, adpy, aidly, aimp, aaby, aimp, aimp, aabs, aabx, aabx, aalx,
    aimm, aidx, aimm, asr, adp, adp, adp, aidl, aimp, aimm, aimp, aimp, aabs, aabs, aabs, aabl,
    arel, aidy, aidp, aisy, adpx, adpx, adpy, aidly, aimp, aaby, aimp, aimp, aabx, aabx, aaby, aalx,
    aimm, aidx, aimm, asr, adp, adp, adp, aidl, aimp, aimm, aimp, aimp, aabs, aabs, aabs, aabl,
    arel, aidy, aidp, aisy, aidp, adpx, adpx, aidly, aimp, aaby, aimp, aimp, aiax, aabx, aabx, aalx,
    aimm, aidx, aimm, asr, adp, adp, adp, aidl, aimp, aimm, aimp, aimp, aabs, aabs, aabs, aabl,
    arel, aidy, aidp, aisy, aabs, adpx, adpx, aidly, aimp, aaby, aimp, aimp, aial, aabx, aabx, aalx
  ];

  // Instruction lookup table
  const instruct = [
    ibrk, iora, icop, iora, itsb, iora, iasl, iora, iphp, iora, iasl, iphd, itsb, iora, iasl, iora,
    ibpl, iora, iora, iora, itrb, iora, iasl, iora, iclc, iora, iinc, itcs, itrb, iora, iasl, iora,
    ijsr, iand, ijsr, iand, ibit, iand, irol, iand, iplp, iand, irol, ipld, ibit, iand, irol, iand,
    ibmi, iand, iand, iand, ibit, iand, irol, iand, isec, iand, idec, itsc, ibit, iand, irol, iand,
    irti, ieor, iwdm, ieor, imvp, ieor, ilsr, ieor, ipha, ieor, ilsr, iphk, ijmp, ieor, ilsr, ieor,
    ibvc, ieor, ieor, ieor, imvn, ieor, ilsr, ieor, icli, ieor, iphy, itcd, ijmp, ieor, ilsr, ieor,
    irts, iadc, iper, iadc, istz, iadc, iror, iadc, ipla, iadc, iror, irtl, ijmp, iadc, iror, iadc,
    ibvs, iadc, iadc, iadc, istz, iadc, iror, iadc, isei, iadc, iply, itdc, ijmp, iadc, iror, iadc,
    ibra, ista, ibrl, ista, isty, ista, istx, ista, idey, ibit, itxa, iphb, isty, ista, istx, ista,
    ibcc, ista, ista, ista, isty, ista, istx, ista, itya, ista, itxs, itxy, istz, ista, istz, ista,
    ildy, ilda, ildx, ilda, ildy, ilda, ildx, ilda, itay, ilda, itax, iplb, ildy, ilda, ildx, ilda,
    ibcs, ilda, ilda, ilda, ildy, ilda, ildx, ilda, iclv, ilda, itsx, ityx, ildy, ilda, ildx, ilda,
    icpy, icmp, irep, icmp, icpy, icmp, idec, icmp, iiny, icmp, idex, iwai, icpy, icmp, idec, icmp,
    ibne, icmp, icmp, icmp, ipei, icmp, idec, icmp, icld, icmp, iphx, istp, ijmp, icmp, idec, icmp,
    icpx, isbc, isep, isbc, icpx, isbc, iinc, isbc, iinx, isbc, inop, ixba, icpx, isbc, iinc, isbc,
    ibeq, isbc, isbc, isbc, ipea, isbc, iinc, isbc, ised, isbc, iplx, ixce, ijsr, isbc, iinc, isbc
  ];

  /**
   * Execute a single instruction
   * FIXED BUG: Removed debug console.log
   */
  const step = () => {
    breakFlag = false;
    const opcode = m1();
    excycles = 0;

    pc++;
    pc &= 0xffff;

    const ad = admode[opcode]();

    instruct[opcode](ad);

    pc += exbytes;
    pc &= 0xffff;

    const time = cycletime[opcode] + excycles;
    T += time;
    if (ticks) ticks(time);
    return time;
  };

  /**
   * Reset the CPU
   */
  const reset = () => {
    pc = wordAt(RESET_VECTOR);
    sp = 255;
    a = x = y = dbr = pbr = dp = 0;
    flags = 32;
    breakFlag = false;
    emulation = true;
    T = 0;
  };

  /**
   * Convert number to hex string
   */
  const toHexN = (n, d) => {
    let s = n.toString(16);
    while (s.length < d) {
      s = "0" + s;
    }
    return s.toUpperCase();
  };

  const toHex2 = (n) => toHexN(n & 0xff, 2);
  const toHex4 = (n) => toHexN(n, 4);

  /**
   * Disassemble instruction at address
   * ⚠️ STUB: Returns basic 6502 disassembly
   */
  const disasm = (opcode, a, b, pc) => {
    return ["???", 1];
  };

  // Public API
  return {
    /**
     * Execute instructions for given number of cycles
     */
    steps: (Ts) => {
      while (Ts > 0) {
        Ts -= step();
        if (breakFlag) {
          T += Ts;
          return;
        }
      }
    },

    /**
     * Get total cycle count
     */
    T: () => T,

    /**
     * Read memory at address
     */
    memr: (addr) => byteAt(addr),

    /**
     * Reset CPU
     */
    reset: reset,

    /**
     * Initialize CPU with memory callbacks
     */
    init: (bt, ba, tck) => {
      byteTo = bt;
      byteAt = ba;
      ticks = tck;
      reset();
    },

    /**
     * Get CPU status
     */
    status: () => ({
      pc: pc,
      sp: sp,
      a: a,
      x: x,
      y: y,
      flags: flags,
      dbr: dbr,
      dp: dp,
      pbr: pbr,
      emulation: emulation,
      break: breakFlag
    }),

    /**
     * Trigger hardware interrupt (IRQ)
     */
    interrupt: () => {
      if (flags & FLAG_INTERRUPT) {
        return;
      }
      stPushWord(pc);
      stPush(flags);
      flags |= FLAG_INTERRUPT;
      pc = wordAt(IRQ_VECTOR);
      T += 7;
    },

    /**
     * Trigger non-maskable interrupt (NMI)
     */
    nmi: () => {
      stPushWord(pc);
      stPush(flags);
      flags |= FLAG_INTERRUPT;
      pc = wordAt(NMI_VECTOR);
      T += 7;
    },

    /**
     * Set register value
     */
    set: (reg, value) => {
      switch (reg.toUpperCase()) {
        case "PC":
          pc = value;
          return;
        case "A":
          a = value;
          return;
        case "X":
          x = value;
          return;
        case "Y":
          y = value;
          return;
        case "SP":
          sp = value;
          return;
        case "FLAGS":
          flags = value;
          return;
        case "DBR":
          dbr = value;
          return;
        case "DP":
          dp = value;
          return;
        case "PBR":
          pbr = value;
          return;
      }
    },

    /**
     * Convert flags to string representation
     */
    flagsToString: () => {
      let f = "";
      const fx = "NVMXDIZC";
      for (let i = 0; i < 8; i++) {
        const n = flags & (0x80 >> i);
        if (n === 0) {
          f += fx[i].toLowerCase();
        } else {
          f += fx[i];
        }
      }
      return f;
    },

    /**
     * Disassemble instruction
     */
    disasm: disasm
  };
};

export default createCPU65816;
