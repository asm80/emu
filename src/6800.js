/**
 * Motorola 6800 CPU Emulator
 *
 * ES6 module implementation of cycle-accurate Motorola 6800 emulator.
 * The MC6800 is an 8-bit microprocessor from 1974 that powered early
 * personal computers and embedded systems.
 *
 * Features:
 * - 2 x 8-bit accumulators: A, B
 * - 16-bit index register: X
 * - 16-bit SP and PC
 * - 6 flags: H (half-carry), I (interrupt mask), N (negative), Z (zero), V (overflow), C (carry)
 * - 7 addressing modes: inherent, immediate, direct, indexed, extended, relative
 * - Stack grows downward (pre-decrement push)
 * - Interrupt vectors at high memory
 *
 * Based on original work by Martin Maly.
 *
 * @module 6800
 */

// Interrupt vector addresses
const VECTOR_RESET = 0xfffe;
const VECTOR_NMI = 0xfffc;
const VECTOR_SWI = 0xfffa;
const VECTOR_INT = 0xfff8;

// Flag bit masks (HINZVC format)
const FLAG_CARRY = 1;      // C - Carry/borrow
const FLAG_OVERFLOW = 2;   // V - Overflow
const FLAG_ZERO = 4;       // Z - Zero
const FLAG_NEGATIVE = 8;   // N - Negative
const FLAG_INTERRUPT = 16; // I - Interrupt mask
const FLAG_HALFCARRY = 32; // H - Half-carry (for BCD)

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

// Instruction timing table (in CPU cycles)
const cycletime = [
  0,2,0,0,0,0,2,2,4,4,2,2,2,2,2,2,2,2,0,0,0,0,2,2,0,2,0,2,0,0,0,0,
  4,0,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,0,5,0,10,0,0,9,12,
  2,0,0,2,2,0,2,2,2,2,2,0,2,2,0,2,2,0,0,2,2,0,2,2,2,2,2,0,2,2,0,2,
  7,0,0,7,7,0,7,7,7,7,7,0,7,7,4,7,6,0,0,6,6,0,6,6,6,6,6,0,6,6,3,6,
  2,2,2,0,2,2,2,0,2,2,2,2,3,8,3,0,3,3,3,0,3,3,3,4,3,3,3,3,4,0,4,5,
  5,5,5,0,5,5,5,6,5,5,5,5,6,8,6,7,4,4,4,0,4,4,4,5,4,4,4,4,5,9,5,6,
  2,2,2,0,2,2,2,0,2,2,2,2,0,0,3,0,3,3,3,0,3,3,3,4,3,3,3,3,0,0,4,5,
  5,5,5,0,5,5,5,6,5,5,5,5,0,0,6,7,4,4,4,0,4,4,4,5,4,4,4,4,0,0,5,6
];

// Addressing mode enumeration
const MODE_INH = -1;  // Inherent
const MODE_DIR = 0;   // Direct (zero page)
const MODE_IMM = 1;   // Immediate
const MODE_IMM3 = 2;  // Immediate 16-bit
const MODE_EXT = 3;   // Extended (absolute)
const MODE_IDX = 4;   // Indexed
const MODE_REL = 6;   // Relative

// Addressing mode table
const addrmode = [
  -1,0,-1,-1,-1,-1,0,0,0,0,0,0,0,0,0,0,0,0,-1,-1,-1,-1,0,0,-1,0,-1,0,-1,-1,-1,-1,
  6,-1,6,6,6,6,6,6,6,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0,-1,0,-1,0,-1,-1,0,0,
  0,-1,-1,0,0,-1,0,0,0,0,0,-1,0,0,-1,0,0,-1,-1,0,0,-1,0,0,0,0,0,-1,0,0,-1,0,
  4,-1,-1,4,4,-1,4,4,4,4,4,-1,4,4,4,4,3,-1,-1,3,3,-1,3,3,3,3,3,-1,3,3,3,3,
  5,5,5,-1,5,5,5,-1,5,5,5,5,2,6,2,-1,1,1,1,-1,1,1,1,1,1,1,1,1,1,-1,1,1,
  4,4,4,-1,4,4,4,4,4,4,4,4,4,4,4,4,3,3,3,-1,3,3,3,3,3,3,3,3,3,3,3,3,
  5,5,5,-1,5,5,5,-1,5,5,5,5,-1,-1,2,-1,1,1,1,-1,1,1,1,1,1,1,1,1,-1,-1,1,1,
  4,4,4,-1,4,4,4,4,4,4,4,4,-1,-1,4,4,3,3,3,-1,3,3,3,3,3,3,3,3,-1,-1,3,3
];

// Disassembly table [mnemonic, byte_length]
const disasmTable = [
  ["-",0],["NOP",1],["-",0],["-",0],["-",0],["-",0],["TAP",1],["TPA",1],["INX",1],["DEX",1],["CLV",1],["SEV",1],["CLC",1],
  ["SEC",1],["CLI",1],["SEI",1],["SBA",1],["CBA",1],["-",0],["-",0],["-",0],["-",0],["TAB",1],["TBA",1],["-",0],["DAA",1],["-",0],["ABA",1],
  ["-",0],["-",0],["-",0],["-",0],["BRA ~",2],["-",0],["BHI ~",2],["BLS ~",2],["BCC ~",2],["BCS ~",2],["BNE ~",2],["BEQ ~",2],["BVC ~",2],["BVS ~",2],
  ["BPL ~",2],["BMI ~",2],["BGE ~",2],["BLT ~",2],["BGT ~",2],["BLE ~",2],["TSX",1],["INS",1],["PULA",1],["PULB",1],["DES",1],["TXS",1],["PSHA",1],["PSHB",1],
  ["-",0],["RTS",1],["-",0],["RTI",1],["-",0],["-",0],["WAI",1],["SWI",1],["NEGA",1],["-",0],["-",0],["COMA",1],["LSRA",1],["-",0],["RORA",1],["ASRA",1],
  ["ASLA",1],["ROLA",1],["DECA",1],["-",0],["INCA",1],["TSTA",1],["-",0],["CLRA",1],["NEGB",1],["-",0],["-",0],["COMB",1],["LSRB",1],["-",0],["RORB",1],
  ["ASRB",1],["ASLB",1],["ROLB",1],["DECB",1],["-",0],["INCB",1],["TSTB",1],["-",0],["CLRB",1],["NEG @,X",2],["-",0],["-",0],["COM @,X",2],["LSR @,X",2],
  ["-",0],["ROR @,X",2],["ASR @,X",2],["ASL @,X",2],["ROL @,X",2],["DEC @,X",2],["-",0],["INC @,X",2],["TST @,X",2],["JMP @,X",2],["CLR @,X",2],["NEG ^",3],
  ["-",0],["-",0],["COM ^",3],["LSR ^",3],["-",0],["ROR ^",3],["ASR ^",3],["ASL ^",3],["ROL ^",3],["DEC ^",3],["-",0],["INC ^",3],["TST ^",3],["JMP ^",3],
  ["CLR ^",3],["SUBA #@",2],["CMPA #@",2],["SBCA #@",2],["-",0],["ANDA #@",2],["BITA #@",2],["LDAA #@",2],["-",0],["EORA #@",2],["ADCA #@",2],["ORAA #@",2],
  ["ADDA #@",2],["CPX #^",3],["BSR ~",2],["LDS #^",3],["-",0],["SUBA @",2],["CMPA @",2],["SBCA @",2],["-",0],["ANDA @",2],["BITA @",2],["LDAA @",2],
  ["STAA @",2],["EORA @",2],["ADCA @",2],["ORAA @",2],["ADDA @",2],["CPX @",2],["-",0],["LDS @",2],["STS @",2],["SUBA @,X",2],["CMPA @,X",2],
  ["SBCA @,X",2],["-",0],["ANDA @,X",2],["BITA @,X",2],["LDAA @,X",2],["STAA @,X",2],["EORA @,X",2],["ADCA @,X",2],["ORAA @,X",2],["ADDA @,X",2],
  ["CPX @,X",2],["JSR @,X",2],["LDS @,X",2],["STS @,X",2],["SUBA ^",3],["CMPA ^",3],["SBCA ^",3],["-",0],["ANDA ^",3],["BITA ^",3],["LDAA ^",3],
  ["STAA ^",3],["EORA ^",3],["ADCA ^",3],["ORAA ^",3],["ADDA ^",3],["CPX ^",3],["JSR ^",3],["LDS ^",3],["STS ^",3],["SUBB #@",2],["CMPB #@",2],
  ["SBCB #@",2],["-",0],["ANDB #@",2],["BITB #@",2],["LDAB #@",2],["-",0],["EORB #@",2],["ADCB #@",2],["ORAB #@",2],["ADDB #@",2],["-",0],["-",0],
  ["LDX #^",3],["-",0],["SUBB @",2],["CMPB @",2],["SBCB @",2],["-",0],["ANDB @",2],["BITB @",2],["LDAB @",2],["STAB @",2],["EORB @",2],["ADCB @",2],
  ["ORAB @",2],["ADDB @",2],["-",0],["-",0],["LDX @",2],["STX @",2],["SUBB @,X",2],["CMPB @,X",2],["SBCB @,X",2],["-",0],["ANDB @,X",2],["BITB @,X",2],
  ["LDAB @,X",2],["STAB @,X",2],["EORB @,X",2],["ADCB @,X",2],["ORAB @,X",2],["ADDB @,X",2],["-",0],["-",0],["LDX @,X",2],["STX @,X",2],["SUBB ^",3],
  ["CMPB ^",3],["SBCB ^",3],["-",0],["ANDB ^",3],["BITB ^",3],["LDAB ^",3],["STAB ^",3],["EORB ^",3],["ADCB ^",3],["ORAB ^",3],["ADDB ^",3],["-",0],
  ["-",0],["LDX ^",3],["STX ^",3]
];

/**
 * Format number as uppercase hex string with leading zeros
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
 * Disassemble a single 6800 instruction
 *
 * @param {number} i - Instruction opcode
 * @param {number} a - First operand byte
 * @param {number} b - Second operand byte
 * @param {number} pc - Program counter value
 * @returns {Array} [mnemonic_string, instruction_length]
 */
export const disasm = (i, a, b, pc) => {
  const sx = disasmTable[i];
  let s = sx[0];
  const d8 = toHex2(a);
  const rel8 = (a < 128) ? toHex4(a + pc + 2) : toHex4(pc + a - 256 + 2);
  s = s.replace("~", "$" + rel8);
  s = s.replace("@", "$" + d8);
  const d16 = toHex2(a) + toHex2(b);
  s = s.replace("^", "$" + d16);
  return [s, sx[1]];
};

/**
 * Create Motorola 6800 CPU emulator instance
 *
 * @param {Object} callbacks - Memory and I/O callbacks
 * @param {Function} callbacks.byteTo - Write byte to memory: (address, value) => void
 * @param {Function} callbacks.byteAt - Read byte from memory: (address) => value
 * @param {Function} [callbacks.ticks] - Tick callback for timing: (cycles) => void
 * @returns {Object} CPU instance with public API
 */
export default (callbacks) => {
  const { byteTo, byteAt, ticks } = callbacks;

  // CPU state
  let a = 0;          // Accumulator A
  let b = 0;          // Accumulator B
  let x = 0;          // Index register (16-bit)
  let flags = 16;     // Status flags (I flag set by default)
  let sp = 0;         // Stack pointer (16-bit)
  let pc = 0;         // Program counter
  let T = 0;          // Total cycles
  let breakFlag = false;

  // Helper: read word from memory (big-endian)
  const wordAt = (addr) => {
    return byteAt(addr) * 256 + byteAt(0xffff & (addr + 1));
  };

  // Helper: read word from zero page (wraps at 0xff)
  const wordAtZP = (addr) => {
    return byteAt(addr & 0xff) * 256 + byteAt(0xff & (addr + 1));
  };

  // Helper: write word to memory (big-endian)
  const wordTo = (addr, data) => {
    byteTo(addr, (data >> 8) & 0xff);
    byteTo((addr + 1) & 0xffff, data & 0xff);
  };

  // Helper: write word to zero page (wraps at 0xff) - FIXED: added data parameter
  const wordToZP = (addr, data) => {
    byteTo(addr & 0xff, (data >> 8) & 0xff);
    byteTo((addr + 1) & 0xff, data & 0xff);
  };

  // Fetch next instruction byte and advance PC
  const M1 = () => {
    const v = byteAt(pc++);
    pc &= 0xffff;
    return v;
  };

  // Addressing mode functions (return value from memory)
  const methods = [
    // INH
    () => 0,
    // DIR
    () => {
      const aa = M1();
      return byteAt(aa);
    },
    // IMM3
    () => {
      const aa = M1();
      const bb = M1();
      return aa * 256 + bb;
    },
    // EXT
    () => {
      const aa = M1();
      const bb = M1();
      return byteAt(aa * 256 + bb);
    },
    // IDX
    () => {
      const aa = M1();
      return byteAt(aa + x);
    },
    // IMM
    () => {
      const aa = M1();
      return aa;
    },
    // REL
    () => {
      const aa = 128 - M1();
      return aa + pc;
    }
  ];

  // Addressing mode functions (return effective address)
  const leas = [
    // INH
    () => 0,
    // DIR
    () => M1(),
    // IMM3
    () => {
      const aa = M1();
      const bb = M1();
      return aa * 256 + bb;
    },
    // EXT
    () => {
      const aa = M1();
      const bb = M1();
      return aa * 256 + bb;
    },
    // IDX
    () => {
      const aa = M1();
      return aa + x;
    },
    // IMM
    () => M1(),
    // REL
    () => {
      const aa = 128 - M1();
      return aa + pc;
    }
  ];

  // Store functions (write byte to memory at effective address)
  const stores = [
    // INH
    (d) => {},
    // DIR
    (d) => {
      const aa = M1();
      byteTo(aa, d);
    },
    // IMM3
    (d) => {},
    // EXT
    (d) => {
      const aa = M1();
      const bb = M1();
      byteTo(aa * 256 + bb, d);
    },
    // IDX
    (d) => {
      const aa = M1();
      byteTo(aa + x, d);
    },
    // IMM
    (d) => {},
    // REL
    (d) => {}
  ];

  // Flag operations

  const flagsNZ = (z) => {
    flags &= ~(FLAG_ZERO + FLAG_NEGATIVE);
    if (z === 0) {
      flags |= FLAG_ZERO;
    } else {
      if (z & 128) flags |= FLAG_NEGATIVE;
    }
    return z;
  };

  const flagsZ = (z) => {
    flags &= ~FLAG_ZERO;
    if (z === 0) {
      flags |= FLAG_ZERO;
    }
    return z;
  };

  const flagsN = (z) => {
    flags &= ~FLAG_NEGATIVE;
    if (z & 128) flags |= FLAG_NEGATIVE;
    return z;
  };

  const flagsNZ0 = (z) => {
    flagsNZ(z);
    flags &= ~FLAG_OVERFLOW;
    return z;
  };

  const flagsH = (acc, oper, result) => {
    flags &= ~FLAG_HALFCARRY;
    if ((((acc >> 3) & 1) & ((oper >> 3) & 1)) | (((oper >> 3) & 1) & ~((result >> 3) & 1)) | (~((result >> 3) & 1) & ((acc >> 3) & 1))) {
      flags |= FLAG_HALFCARRY;
    }
  };

  const flagsC = (acc, oper, result) => {
    flags &= ~FLAG_CARRY;
    if ((((acc >> 7) & 1) & ((oper >> 7) & 1)) | (((oper >> 7) & 1) & ~((result >> 7) & 1)) | (~((result >> 7) & 1) & ((acc >> 7) & 1))) {
      flags |= FLAG_CARRY;
    }
  };

  const flagsV = (acc, oper, result) => {
    flags &= ~FLAG_OVERFLOW;
    if ((((acc >> 7) & 1) & ~((oper >> 7) & 1) & ~((result >> 7) & 1)) | (~((acc >> 7) & 1) & ((oper >> 7) & 1) & ((result >> 7) & 1))) {
      flags |= FLAG_OVERFLOW;
    }
  };

  const flags7V = (acc) => {
    flags &= ~FLAG_OVERFLOW;
    if (acc === 0x80) {
      flags |= FLAG_OVERFLOW;
    }
    return acc;
  };

  const flags0V = (acc) => {
    flags &= ~FLAG_OVERFLOW;
    if (acc === 0x7F) {
      flags |= FLAG_OVERFLOW;
    }
    return acc;
  };

  const bit7C = (z) => {
    flags &= ~FLAG_CARRY;
    if (z & 0x80) flags |= FLAG_CARRY;
    return z;
  };

  const bit0C = (z) => {
    flags &= ~FLAG_CARRY;
    if (z & 0x01) flags |= FLAG_CARRY;
    return z;
  };

  const flagsZC = (z) => {
    flags &= ~(FLAG_ZERO + FLAG_CARRY);
    if (z === 0) {
      flags |= FLAG_ZERO;
    } else {
      flags |= FLAG_CARRY;
    }
    return z;
  };

  const flagsVNxC = (z) => {
    flags &= ~FLAG_OVERFLOW;
    if ((flags & 9) === 1 || (flags & 9) === 8) {
      flags |= FLAG_OVERFLOW;
    }
    return z;
  };

  const flagsN7VZC = (z) => {
    return flagsN(flags7V(flagsZC(z)));
  };

  // Helper for indexed operations
  const helperIDX = (cb) => {
    const addr = M1() + x;
    const data = cb(byteAt(addr));
    if (data !== null) byteTo(addr, data & 0xff);
  };

  // Helper for extended operations
  const helperEXT = (cb) => {
    const addr = M1() * 256 + M1();
    const data = cb(byteAt(addr));
    if (data !== null) byteTo(addr, data & 0xff);
  };

  // Convert signed byte to 8-bit relative offset
  const rel8 = (b) => {
    if (b < 128) return b;
    return b - 256;
  };

  /**
   * Execute one instruction
   * @returns {number} Cycles consumed
   */
  const step = () => {
    breakFlag = false;
    const instructCode = M1();
    const mode = addrmode[instructCode];
    let operand = null;
    let store = null;
    let lea = null;

    if (mode >= 0) {
      operand = methods[mode];
      store = stores[mode];
      lea = leas[mode];
    }

    let temp, op, saveC;

    // Big switch statement
    switch (instructCode) {
      case 0x01: break; // NOP

      case 0x06: flags = a & 0x3f; break; // TAP
      case 0x07: a = flags; break; // TPA
      case 0x08: x = (x + 1) & 0xffff; flagsZ(x); break; // INX
      case 0x09: x = (x - 1) & 0xffff; flagsZ(x); break; // DEX
      case 0x0a: flags &= (FLAG_OVERFLOW ^ 0x3f); break; // CLV
      case 0x0b: flags |= FLAG_OVERFLOW; break; // SEV
      case 0x0c: flags &= (FLAG_CARRY ^ 0x3f); break; // CLC
      case 0x0d: flags |= FLAG_CARRY; break; // SEC
      case 0x0e: flags &= (FLAG_INTERRUPT ^ 0x3f); break; // CLI
      case 0x0f: flags |= FLAG_INTERRUPT; break; // SEI

      case 0x10: // SBA
        temp = a;
        temp -= b;
        flagsC(a, b, temp);
        flagsV(a, b, temp);
        a = temp & 0xff;
        flagsN(a);
        flagsZ(a);
        break;

      case 0x11: // CBA
        temp = a;
        temp -= b;
        if (b > a) {
          flags |= FLAG_CARRY;
        } else {
          flags &= 0x3e;
        }
        flagsV(a, b, temp);
        flagsN(temp & 0xff);
        flagsZ(temp & 0xff);
        break;

      case 0x16: b = flagsNZ0(a); break; // TAB
      case 0x17: a = flagsNZ0(b); break; // TBA

      case 0x19: // DAA - Decimal Adjust Accumulator
        temp = a;
        if (((a & 0xF) > 9) | (flags & FLAG_HALFCARRY)) {
          a += 0x06;
          flagsV(temp, 0x06, a);
        }
        if ((((a & 0xF0) >> 8) > 9) | (flags & FLAG_CARRY)) {
          a += 0x60;
          flagsV(temp, 0x60, a);
        }
        if (((a & 0xF) > 9) & ((a & 0xF0) === 0x90)) {
          a += 0x60;
          flagsV(temp, 0x60, a);
        }
        // FIXED: Use bitwise OR instead of object property access
        if (((a & 0xF0) >> 8) > 9) {
          flags |= FLAG_CARRY;
        }
        flagsN(a);
        flagsZ(a);
        break;

      case 0x1b: // ABA
        temp = a;
        temp += b;
        flagsH(a, b, temp);
        flagsC(a, b, temp);
        flagsV(a, b, temp);
        a = temp & 0xff;
        flagsN(a);
        flagsZ(a);
        break;

      case 0x20: // BRA
        temp = M1();
        pc += rel8(temp);
        break;

      case 0x22: // BHI
        temp = M1();
        // FIXED: Use bitwise operations instead of property access
        if (!((flags & FLAG_CARRY) | (flags & FLAG_ZERO))) pc += rel8(temp);
        break;

      case 0x23: // BLS
        temp = M1();
        // FIXED: Use bitwise operations instead of property access
        if (((flags & FLAG_CARRY) | (flags & FLAG_ZERO))) pc += rel8(temp);
        break;

      case 0x24: // BCC
        temp = M1();
        if (!(flags & FLAG_CARRY)) pc += rel8(temp);
        break;

      case 0x25: // BCS
        temp = M1();
        if ((flags & FLAG_CARRY)) pc += rel8(temp);
        break;

      case 0x26: // BNE
        temp = M1();
        if (!(flags & FLAG_ZERO)) pc += rel8(temp);
        break;

      case 0x27: // BEQ
        temp = M1();
        if ((flags & FLAG_ZERO)) pc += rel8(temp);
        break;

      case 0x28: // BVC
        temp = M1();
        if (!(flags & FLAG_OVERFLOW)) pc += rel8(temp);
        break;

      case 0x29: // BVS
        temp = M1();
        if ((flags & FLAG_OVERFLOW)) pc += rel8(temp);
        break;

      case 0x2A: // BPL
        temp = M1();
        if (!(flags & FLAG_NEGATIVE)) pc += rel8(temp);
        break;

      case 0x2B: // BMI
        temp = M1();
        if ((flags & FLAG_NEGATIVE)) pc += rel8(temp);
        break;

      case 0x2C: // BGE
        temp = M1();
        // FIXED: Use bitwise operations instead of property access
        if (!((flags & FLAG_NEGATIVE) ^ (flags & FLAG_OVERFLOW))) pc += rel8(temp);
        break;

      case 0x2D: // BLT
        temp = M1();
        // FIXED: Use bitwise operations instead of property access
        if (((flags & FLAG_NEGATIVE) ^ (flags & FLAG_OVERFLOW))) pc += rel8(temp);
        break;

      case 0x2E: // BGT
        temp = M1();
        // FIXED: Use bitwise operations instead of property access
        if (!((flags & FLAG_NEGATIVE) ^ (flags & FLAG_OVERFLOW)) && !(flags & FLAG_ZERO)) pc += rel8(temp);
        break;

      case 0x2F: // BLE
        temp = M1();
        // BLE: Branch if less or equal (Z=1 OR (N XOR V)=1)
        if (((flags & FLAG_NEGATIVE) ^ (flags & FLAG_OVERFLOW)) || (flags & FLAG_ZERO)) pc += rel8(temp);
        break;

      case 0x30: x = (sp + 1) & 0xffff; break; // TSX
      case 0x35: sp = (x - 1) & 0xffff; break; // TXS

      case 0x31: sp = (sp + 1) & 0xffff; break; // INS
      case 0x34: sp = (sp - 1) & 0xffff; break; // DES

      case 0x32: sp = (sp + 1) & 0xffff; a = byteAt(sp); break; // PULA
      case 0x33: sp = (sp + 1) & 0xffff; b = byteAt(sp); break; // PULB

      case 0x36: byteTo(sp, a); sp = (sp - 1) & 0xffff; break; // PSHA
      case 0x37: byteTo(sp, b); sp = (sp - 1) & 0xffff; break; // PSHB

      case 0x39: sp += 2; pc = (byteAt(sp - 1) << 8) + byteAt(sp); break; // RTS

      case 0x3B: // RTI
        flags = byteAt(++sp) & 0x3f;
        b = byteAt(++sp);
        a = byteAt(++sp);
        sp += 2; x = (byteAt(sp - 1) << 8) + byteAt(sp);
        sp += 2; pc = (byteAt(sp - 1) << 8) + byteAt(sp);
        break;

      case 0x3f: // SWI
        byteTo(sp--, pc & 0xff);
        byteTo(sp--, (pc >> 8) & 0xFF);
        byteTo(sp--, x & 0xFF);
        byteTo(sp--, (x >> 8) & 0xFF);
        byteTo(sp--, a);
        byteTo(sp--, b);
        byteTo(sp--, flags);
        flags |= FLAG_INTERRUPT;
        pc = wordAt(VECTOR_SWI);
        break;

      case 0x40: a = flagsN7VZC((0 - a) & 0xff); break; // NEGA
      case 0x50: b = flagsN7VZC((0 - b) & 0xff); break; // NEGB
      case 0x60: helperIDX((data) => flagsN7VZC((0 - data) & 0xff)); break; // NEG idx
      case 0x70: helperEXT((data) => flagsN7VZC((0 - data) & 0xff)); break; // NEG ext

      case 0x43: a = flagsNZ0((~a & 0xff)); flags |= FLAG_CARRY; break; // COMA
      case 0x53: b = flagsNZ0(~b & 0xff); flags |= FLAG_CARRY; break; // COMB
      case 0x63: helperIDX((data) => { flags |= FLAG_CARRY; return flagsNZ0(~data & 0xff); }); break; // COM idx
      case 0x73: helperEXT((data) => { flags |= FLAG_CARRY; return flagsNZ0(~data & 0xff); }); break; // COM ext

      case 0x44: // LSRA
        temp = a; bit0C(a); temp = (temp >> 1);
        a = flagsNZ(temp & 0xff); flagsVNxC(a); break;
      case 0x54: // LSRB
        temp = b; bit0C(b); temp = (temp >> 1);
        b = flagsNZ(temp & 0xff); flagsVNxC(b); break;
      case 0x64: // LSR idx
        helperIDX((data) => { temp = data; bit0C(data); temp = (temp >> 1); data = flagsNZ(temp & 0xff); return flagsVNxC(data); });
        break;
      case 0x74: // LSR ext
        helperEXT((data) => { temp = data; bit0C(data); temp = (temp >> 1); data = flagsNZ(temp & 0xff); return flagsVNxC(data); });
        break;

      case 0x46: // RORA
        temp = a; saveC = flags & 1; bit0C(a); temp = (temp >> 1) + (saveC << 7);
        a = flagsNZ(temp & 0xff); flagsVNxC(a); break;
      case 0x56: // RORB
        temp = b; saveC = flags & 1; bit0C(b); temp = (temp >> 1) + (saveC << 7);
        b = flagsNZ(temp & 0xff); flagsVNxC(b); break;
      case 0x66: // ROR idx
        helperIDX((data) => { temp = data; saveC = flags & 1; bit0C(data); temp = (temp >> 1) + (saveC << 7); data = flagsNZ(temp & 0xff); return flagsVNxC(data); });
        break;
      case 0x76: // ROR ext
        helperEXT((data) => { temp = data; saveC = flags & 1; bit0C(data); temp = (temp >> 1) + (saveC << 7); data = flagsNZ(temp & 0xff); return flagsVNxC(data); });
        break;

      case 0x47: // ASRA
        temp = a; bit0C(a); temp = (temp >> 1) + (temp & 0x80);
        a = flagsNZ(temp & 0xff); flagsVNxC(a); break;
      case 0x57: // ASRB
        temp = b; bit0C(b); temp = (temp >> 1) + (temp & 0x80);
        b = flagsNZ(temp & 0xff); flagsVNxC(b); break;
      case 0x67: // ASR idx
        helperIDX((data) => { temp = data; bit0C(data); temp = (temp >> 1) + (temp & 0x80); data = flagsNZ(temp & 0xff); return flagsVNxC(data); });
        break;
      case 0x77: // ASR ext
        helperEXT((data) => { temp = data; bit0C(data); temp = (temp >> 1) + (temp & 0x80); data = flagsNZ(temp & 0xff); return flagsVNxC(data); });
        break;

      case 0x48: // ASLA
        temp = a; bit7C(a); temp = (temp << 1);
        a = flagsNZ(temp & 0xff); flagsVNxC(a); break;
      case 0x58: // ASLB
        temp = b; bit7C(b); temp = (temp << 1);
        b = flagsNZ(temp & 0xff); flagsVNxC(b); break;
      case 0x68: // ASL idx
        helperIDX((data) => { temp = data; bit7C(data); temp = (temp << 1); data = flagsNZ(temp & 0xff); return flagsVNxC(data); });
        break;
      case 0x78: // ASL ext
        helperEXT((data) => { temp = data; bit7C(data); temp = (temp << 1); data = flagsNZ(temp & 0xff); return flagsVNxC(data); });
        break;

      case 0x49: // ROLA
        temp = a; saveC = flags & 1; bit7C(a); temp = (temp << 1) + saveC;
        a = flagsNZ(temp & 0xff); flagsVNxC(a); break;
      case 0x59: // ROLB
        temp = b; saveC = flags & 1; bit7C(b); temp = (temp << 1) + saveC;
        b = flagsNZ(temp & 0xff); flagsVNxC(b); break;
      case 0x69: // ROL idx
        helperIDX((data) => { temp = data; saveC = flags & 1; bit7C(data); temp = (temp << 1) + saveC; data = flagsNZ(temp & 0xff); return flagsVNxC(data); });
        break;
      case 0x79: // ROL ext
        helperEXT((data) => { temp = data; saveC = flags & 1; bit7C(data); temp = (temp << 1) + saveC; data = flagsNZ(temp & 0xff); return flagsVNxC(data); });
        break;

      case 0x4A: a = flagsNZ((flags7V(a) - 1) & 0xff); break; // DECA
      case 0x5A: b = flagsNZ((flags7V(b) - 1) & 0xff); break; // DECB
      case 0x6A: helperIDX((data) => flagsNZ((flags7V(data) - 1) & 0xff)); break; // DEC idx
      case 0x7A: helperEXT((data) => flagsNZ((flags7V(data) - 1) & 0xff)); break; // DEC ext

      case 0x4C: a = flagsNZ((flags0V(a) + 1) & 0xff); break; // INCA
      case 0x5C: b = flagsNZ((flags0V(b) + 1) & 0xff); break; // INCB
      case 0x6C: helperIDX((data) => flagsNZ((flags0V(data) + 1) & 0xff)); break; // INC idx
      case 0x7C: helperEXT((data) => flagsNZ((flags0V(data) + 1) & 0xff)); break; // INC ext

      case 0x4d: flagsNZ0(a & 0xff); flags &= 0x3e; break; // TSTA
      case 0x5d: flagsNZ0(b & 0xff); flags &= 0x3E; break; // TSTB
      case 0x6d: helperIDX((data) => { flagsNZ0(data); flags &= 0x3E; return null; }); break; // TST idx
      case 0x7d: helperEXT((data) => { flagsNZ0(data); flags &= 0x3E; return null; }); break; // TST ext

      case 0x6e: // JMP idx - lea() already returns X + offset
        pc = lea();
        break;

      case 0x7e: // JMP ext - FIXED: use lea() to get address
        pc = lea();
        break;

      case 0x4F: a = flagsN7VZC(0); break; // CLRA
      case 0x5F: b = flagsN7VZC(0); break; // CLRB
      case 0x6F: helperIDX((data) => flagsN7VZC(0)); break; // CLR idx
      case 0x7F: helperEXT((data) => flagsN7VZC(0)); break; // CLR ext

      // Arithmetic and logical operations
      case 0x80:
      case 0x90:
      case 0xa0:
      case 0xb0: // SUBA
        temp = a;
        op = operand();
        temp -= op;
        if (op > a) {
          flags |= FLAG_CARRY;
        } else {
          flags &= 0x3e;
        }
        flagsV(a, op, temp);
        a = temp & 0xff;
        flagsN(a);
        flagsZ(a);
        break;

      case 0xc0:
      case 0xd0:
      case 0xe0:
      case 0xf0: // SUBB
        temp = b;
        op = operand();
        temp -= op;
        if (op > b) {
          flags |= FLAG_CARRY;
        } else {
          flags &= 0x3e;
        }
        flagsV(b, op, temp);
        b = temp & 0xff;
        flagsN(b);
        flagsZ(b);
        break;

      case 0x81:
      case 0x91:
      case 0xa1:
      case 0xb1: // CMPA
        temp = a;
        op = operand();
        temp -= op;
        if (op > a) {
          flags |= FLAG_CARRY;
        } else {
          flags &= 0x3e;
        }
        flagsV(a, op, temp);
        flagsN(temp & 0xff);
        flagsZ(temp & 0xff);
        break;

      case 0xc1:
      case 0xd1:
      case 0xe1:
      case 0xf1: // CMPB
        temp = b;
        op = operand();
        temp -= op;
        if (op > b) {
          flags |= FLAG_CARRY;
        } else {
          flags &= 0x3e;
        }
        flagsV(b, op, temp);
        flagsN(temp & 0xff);
        flagsZ(temp & 0xff);
        break;

      case 0x82:
      case 0x92:
      case 0xa2:
      case 0xb2: // SBCA
        temp = a;
        op = operand();
        temp -= op;
        temp -= flags & 1;
        if (op > a) {
          flags |= FLAG_CARRY;
        } else {
          flags &= 0x3e;
        }
        flagsV(a, op, temp);
        a = temp & 0xff;
        flagsN(a);
        flagsZ(a);
        break;

      case 0xc2:
      case 0xd2:
      case 0xe2:
      case 0xf2: // SBCB
        temp = b;
        op = operand();
        temp -= op;
        temp -= flags & 1;
        if (op > b) {
          flags |= FLAG_CARRY;
        } else {
          flags &= 0x3e;
        }
        flagsV(b, op, temp);
        b = temp & 0xff;
        flagsN(b);
        flagsZ(b);
        break;

      case 0x84:
      case 0x94:
      case 0xa4:
      case 0xb4: a = flagsNZ0(a & operand()); break; // ANDA

      case 0xc4:
      case 0xd4:
      case 0xe4:
      case 0xf4: b = flagsNZ0(b & operand()); break; // ANDB

      case 0x85:
      case 0x95:
      case 0xa5:
      case 0xb5: flagsNZ0(a & operand()); break; // BITA

      case 0xc5:
      case 0xd5:
      case 0xe5:
      case 0xf5: flagsNZ0(b & operand()); break; // BITB

      case 0x86:
      case 0x96:
      case 0xa6:
      case 0xb6: a = flagsNZ0(operand()); break; // LDAA

      case 0xc6:
      case 0xd6:
      case 0xe6:
      case 0xf6: b = flagsNZ0(operand()); break; // LDAB

      case 0x97:
      case 0xa7:
      case 0xb7: store(flagsNZ0(a)); break; // STAA

      case 0xd7:
      case 0xe7:
      case 0xf7: store(flagsNZ0(b)); break; // STAB

      case 0x88:
      case 0x98:
      case 0xa8:
      case 0xb8: a = flagsNZ0(a ^ operand()); break; // EORA

      case 0xc8:
      case 0xd8:
      case 0xe8:
      case 0xf8: b = flagsNZ0(b ^ operand()); break; // EORB

      case 0x89:
      case 0x99:
      case 0xa9:
      case 0xb9: // ADCA
        temp = a;
        op = operand();
        temp += op + (flags & 1);
        flagsH(a, op, temp);
        flagsC(a, op, temp);
        flagsV(a, op, temp);
        a = temp & 0xff;
        flagsN(a);
        flagsZ(a);
        break;

      case 0xc9:
      case 0xd9:
      case 0xe9:
      case 0xf9: // ADCB
        temp = b;
        op = operand();
        temp += op + (flags & 1);
        flagsH(b, op, temp);
        flagsC(b, op, temp);
        flagsV(b, op, temp);
        b = temp & 0xff;
        flagsN(b);
        flagsZ(b);
        break;

      case 0x8a:
      case 0x9a:
      case 0xaa:
      case 0xba: a = flagsNZ0(a | operand()); break; // ORAA

      case 0xca:
      case 0xda:
      case 0xea:
      case 0xfa: b = flagsNZ0(b | operand()); break; // ORAB

      case 0x8b:
      case 0x9b:
      case 0xab:
      case 0xbb: // ADDA
        temp = a;
        op = operand();
        temp += op;
        flagsH(a, op, temp);
        flagsC(a, op, temp);
        flagsV(a, op, temp);
        a = temp & 0xff;
        flagsN(a);
        flagsZ(a);
        break;

      case 0xcb:
      case 0xdb:
      case 0xeb:
      case 0xfb: // ADDB
        temp = b;
        op = operand();
        temp += op;
        flagsH(b, op, temp);
        flagsC(b, op, temp);
        flagsV(b, op, temp);
        b = temp & 0xff;
        flagsN(b);
        flagsZ(b);
        break;

      case 0x8c: // CPX imm
        temp = (M1() << 8) + M1();
        op = temp;
        temp = x - temp;
        flagsV(x, op, temp);
        flagsN(temp >> 8);
        flagsZ(temp);
        break;

      case 0x9c: // CPX dir
        temp = wordAtZP(M1());
        op = temp;
        temp = x - temp;
        flagsV(x, op, temp);
        flagsN(temp >> 8);
        flagsZ(temp);
        break;

      case 0xac: // CPX idx
        temp = wordAt(M1() + x);
        op = temp;
        temp = x - temp;
        flagsV(x, op, temp);
        flagsN(temp >> 8);
        flagsZ(temp);
        break;

      case 0xbc: // CPX ext
        temp = (M1() << 8) + M1();
        temp = wordAt(temp);
        op = temp;
        temp = x - temp;
        flagsV(x, op, temp);
        flagsN(temp >> 8);
        flagsZ(temp);
        break;

      case 0xad: // JSR idx
        op = M1();
        byteTo(sp--, pc & 0xff);
        byteTo(sp--, (pc >> 8) & 0xff);
        pc = x + op;
        break;

      case 0xbd: // JSR ext
        op = (M1() << 8) + M1();
        byteTo(sp--, pc & 0xff);
        byteTo(sp--, (pc >> 8) & 0xff);
        pc = op;
        break;

      case 0x8d: // BSR (Branch to Subroutine - relative)
        temp = M1(); // Read offset
        // Push return address (current PC) onto stack
        byteTo(sp--, pc & 0xff);
        byteTo(sp--, (pc >> 8) & 0xff);
        // Branch to PC + relative offset
        pc += rel8(temp);
        break;

      case 0x8e: // LDS imm
        sp = (M1() << 8) + M1();
        flags &= ~FLAG_OVERFLOW;
        flagsN(sp >> 8);
        flagsZ(sp);
        break;

      case 0x9e: // LDS dir
        sp = wordAtZP(M1());
        flags &= ~FLAG_OVERFLOW;
        flagsN(sp >> 8);
        flagsZ(sp);
        break;

      case 0xae: // LDS idx
        sp = wordAt(M1() + x);
        flags &= ~FLAG_OVERFLOW;
        flagsN(sp >> 8);
        flagsZ(sp);
        break;

      case 0xbe: // LDS ext
        temp = (M1() << 8) + M1();
        sp = wordAt(temp);
        flags &= ~FLAG_OVERFLOW;
        flagsN(sp >> 8);
        flagsZ(sp);
        break;

      case 0xce: // LDX imm
        x = (M1() << 8) + M1();
        flags &= ~FLAG_OVERFLOW;
        flagsN(x >> 8);
        flagsZ(x);
        break;

      case 0xde: // LDX dir
        x = wordAtZP(M1());
        flags &= ~FLAG_OVERFLOW;
        flagsN(x >> 8);
        flagsZ(x);
        break;

      case 0xee: // LDX idx
        x = wordAt(M1() + x);
        flags &= ~FLAG_OVERFLOW;
        flagsN(x >> 8);
        flagsZ(x);
        break;

      case 0xfe: // LDX ext
        temp = (M1() << 8) + M1();
        x = wordAt(temp);
        flags &= ~FLAG_OVERFLOW;
        flagsN(x >> 8);
        flagsZ(x);
        break;

      case 0x9f: // STS dir
        wordToZP(M1(), sp);
        flags &= ~FLAG_OVERFLOW;
        flagsN(sp >> 8);
        flagsZ(sp);
        break;

      case 0xaf: // STS idx
        wordTo(M1() + x, sp);
        flags &= ~FLAG_OVERFLOW;
        flagsN(sp >> 8);
        flagsZ(sp);
        break;

      case 0xbf: // STS ext
        temp = (M1() << 8) + M1();
        wordTo(temp, sp);
        flags &= ~FLAG_OVERFLOW;
        flagsN(sp >> 8);
        flagsZ(sp);
        break;

      case 0xdf: // STX dir
        wordToZP(M1(), x);
        flags &= ~FLAG_OVERFLOW;
        flagsN(x >> 8);
        flagsZ(x);
        break;

      case 0xef: // STX idx
        wordTo(M1() + x, x);
        flags &= ~FLAG_OVERFLOW;
        flagsN(x >> 8);
        flagsZ(x);
        break;

      case 0xff: // STX ext
        temp = (M1() << 8) + M1();
        wordTo(temp, x);
        flags &= ~FLAG_OVERFLOW;
        flagsN(x >> 8);
        flagsZ(x);
        break;
    }

    pc &= 0xffff;
    const time = cycletime[instructCode];
    T += time;
    if (ticks) ticks(time);
    return time;
  };

  /**
   * Reset CPU to initial state
   */
  const reset = () => {
    pc = wordAt(VECTOR_RESET);
    a = b = x = 0;
    flags = 16; // I flag set
    breakFlag = false;
    T = 0;
  };

  /**
   * Execute instructions for specified number of cycles
   * @param {number} Ts - Number of cycles to execute
   */
  const steps = (Ts) => {
    while (Ts > 0) {
      Ts -= step();
      if (breakFlag) {
        T += Ts;
        return;
      }
    }
  };

  /**
   * Get total cycle count
   * @returns {number} Total cycles executed
   */
  const getCycles = () => T;

  /**
   * Read memory byte (for debugger)
   * @param {number} addr - Memory address
   * @returns {number} Byte value
   */
  const memr = (addr) => byteAt(addr);

  /**
   * Initialize CPU (legacy compatibility)
   * @param {Function} bt - byteTo callback
   * @param {Function} ba - byteAt callback
   * @param {Function} tck - ticks callback
   */
  const init = (bt, ba, tck) => {
    sp = 0;
    a = 0;
    b = 0;
    pc = 0;
    flags = 0;
    x = 0;
    reset();
  };

  /**
   * Get current CPU status
   * @returns {Object} CPU state
   */
  const status = () => ({
    pc: pc,
    sp: sp,
    a: a,
    b: b,
    x: x,
    flags: (flags & 0x3f),
    break: breakFlag
  });

  /**
   * Trigger maskable interrupt (IRQ)
   */
  const interrupt = () => {
    if (flags & FLAG_INTERRUPT) {
      return;
    }
    byteTo(sp--, pc & 0xff);
    byteTo(sp--, (pc >> 8) & 0xFF);
    byteTo(sp--, x & 0xFF);
    byteTo(sp--, (x >> 8) & 0xFF);
    byteTo(sp--, a);
    byteTo(sp--, b);
    byteTo(sp--, flags);
    flags |= FLAG_INTERRUPT;
    pc = wordAt(VECTOR_INT);
    T += 12;
  };

  /**
   * Trigger non-maskable interrupt (NMI)
   */
  const nmi = () => {
    byteTo(sp--, pc & 0xff);
    byteTo(sp--, (pc >> 8) & 0xFF);
    byteTo(sp--, x & 0xFF);
    byteTo(sp--, (x >> 8) & 0xFF);
    byteTo(sp--, a);
    byteTo(sp--, b);
    byteTo(sp--, flags);
    flags |= FLAG_INTERRUPT;
    pc = wordAt(VECTOR_NMI);
    T += 12;
  };

  /**
   * Set CPU register value
   * @param {string} reg - Register name
   * @param {number} value - Value to set
   */
  const set = (reg, value) => {
    switch (reg.toLowerCase()) {
      case "pc": pc = value; return;
      case "a": a = value; return;
      case "b": b = value; return;
      case "x": x = value; return;
      case "sp": sp = value; return;
      case "flags": flags = value & 0x3f; return;
    }
  };

  /**
   * Convert flags to string representation
   * @returns {string} Flag string (e.g., "HINZVC")
   */
  const flagsToString = () => {
    let f = "";
    const fx = "--HINZVC";
    for (let i = 0; i < 8; i++) {
      const n = flags & (0x80 >> i);
      if (n === 0) {
        f += fx[i].toLowerCase();
      } else {
        f += fx[i];
      }
    }
    return f;
  };

  // Initialize and return public API
  reset();

  return {
    steps,
    T: getCycles,
    memr,
    reset,
    init,
    status,
    interrupt,
    nmi,
    set,
    flagsToString,
    disasm
  };
};
