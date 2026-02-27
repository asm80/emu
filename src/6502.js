/**
 * MOS 6502 CPU Emulator
 *
 * ES6 module implementation of cycle-accurate MOS 6502 emulator.
 * The 6502 is the 8-bit processor that powered the Commodore 64, Apple II,
 * NES, and many other classic systems.
 *
 * Features:
 * - 3 x 8-bit registers: A (accumulator), X, Y (index registers)
 * - 16-bit PC, 8-bit SP (stack at $0100-$01FF)
 * - 7 flags: C, Z, I, D, B, V, N (CZIDBVN)
 * - 11 addressing modes
 * - BCD (Binary Coded Decimal) arithmetic support
 * - Page-boundary cycle counting for accurate timing
 *
 * Based on original work by Martin Maly.
 *
 * @module 6502
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
const FLAG_BREAK = 16;
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

// Extra cycle for page boundary crossing (0=no extra cycle, 1=check page boundary)
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

// Disassembly table [mnemonic, instruction_length]
const disasmTable = [
  ["BRK",1],["ORA (@,X)",2],["-",0],["SLO (@,X)",2],["-",0],["ORA *@",2],["ASL *@",2],["SLO *@",2],["PHP",1],
  ["ORA #@",2],["ASL A",1],["ANC #@",2],["-",0],["ORA ^",3],["ASL ^",3],["SLO ^",3],["BPL @",2],["ORA (@),Y",2],["-",0],
  ["SLO (@),Y",2],["-",0],["ORA *@,X",2],["ASL *@,X",2],["SLO *@,X",2],["CLC",1],["ORA ^,Y",3],["-",0],["SLO ^,Y",3],["-",0],
  ["ORA ^,X",3],["ASL ^,X",3],["SLO ^,X",3],["JSR ^",3],["AND (@,X)",2],["-",0],["RLA (@,X)",2],["BIT *@",2],["AND *@",2],
  ["ROL *@",2],["RLA *@",2],["PLP",1],["AND #@",2],["ROL A",1],["-",0],["BIT ^",3],["AND ^",3],["ROL ^",3],["RLA ^",3],
  ["BMI @",2],["AND (@),Y",2],["-",0],["RLA (@),Y",2],["-",0],["AND *@,X",2],["ROL *@,X",2],["RLA *@,X",2],["SEC",1],
  ["AND ^,Y",3],["-",0],["RLA ^,Y",3],["-",0],["AND ^,X",3],["ROL ^,X",3],["RLA ^,X",3],["RTI",1],["EOR (@,X)",2],
  ["-",0],["SRE (@,X)",2],["-",0],["EOR *@",2],["LSR *@",2],["SRE *@",2],["PHA",1],["EOR #@",2],["LSR A",1],["ALR #@",2],
  ["JMP ^",3],["EOR ^",3],["LSR ^",3],["SRE ^",3],["BVC @",2],["EOR (@),Y",2],["-",0],["SRE (@),Y",2],["-",0],
  ["EOR *@,X",2],["LSR *@,X",2],["SRE *@,X",2],["CLI",1],["EOR ^,Y",3],["-",0],["SRE ^,Y",3],["-",0],["EOR ^,X",3],
  ["LSR ^,X",3],["SRE ^,X",3],["RTS",1],["ADC (@,X)",2],["-",0],["RRA (@,X)",2],["-",0],["ADC *@",2],["ROR *@",2],
  ["RRA *@",2],["PLA",1],["ADC #@",2],["ROR A",1],["ARR #@",2],["JMP (^)",3],["ADC ^",3],["ROR ^",3],["RRA ^",3],
  ["BVS @",2],["ADC (@),Y",2],["-",0],["RRA (@),Y",2],["-",0],["ADC *@,X",2],["ROR *@,X",2],["RRA *@,X",2],["SEI",1],
  ["ADC ^,Y",3],["-",0],["RRA ^,Y",3],["-",0],["ADC ^,X",3],["ROR ^,X",3],["RRA ^,X",3],["-",0],["STA (@,X)",2],
  ["-",0],["SAX (@,X)",2],["STY *@",2],["STA *@",2],["STX *@",2],["SAX *@",2],["DEY",1],["-",0],["TXA",1],["XAA #@",2],
  ["STY ^",3],["STA ^",3],["STX ^",3],["SAX ^",3],["BCC @",2],["STA (@),Y",2],["-",0],["AHX (@),Y",2],["STY *@,X",2],
  ["STA *@,X",2],["STX *@,Y",2],["SAX *@,Y",2],["TYA",1],["STA ^,Y",3],["TXS",1],["TAS ^,Y",3],["SHY ^,X",3],["STA ^,X",3],
  ["SHX ^,Y",3],["AHX ^,Y",3],["LDY #@",2],["LDA (@,X)",2],["LDX #@",2],["-",0],["LDY *@",2],["LDA *@",2],["LDX *@",2],["-",0],
  ["TAY",1],["LDA #@",2],["TAX",1],["LAX #@",2],["LDY ^",3],["LDA ^",3],["LDX ^",3],["-",0],["BCS @",2],["LDA (@),Y",2],["-",0],
  ["-",0],["LDY *@,X",2],["LDA *@,X",2],["LDX *@,Y",2],["-",0],["CLV",1],["LDA ^,Y",3],["TSX",1],["LAS ^,Y",3],["LDY ^,X",3],
  ["LDA ^,X",3],["LDX ^,Y",3],["-",0],["CPY #@",2],["CMP (@,X)",2],["-",0],["DCP (@,X)",2],["CPY *@",2],["CMP *@",2],["DEC *@",2],
  ["DCP *@",2],["INY",1],["CMP #@",2],["DEX",1],["AXS #@",2],["CPY ^",3],["CMP ^",3],["DEC ^",3],["DCP ^",3],["BNE @",2],
  ["CMP (@),Y",2],["-",0],["DCP (@),Y",2],["-",0],["CMP *@,X",2],["DEC *@,X",2],["DCP *@,X",2],["CLD",1],["CMP ^,Y",3],["-",0],
  ["DCP ^,Y",3],["-",0],["CMP ^,X",3],["DEC ^,X",3],["DCP ^,X",3],["CPX #@",2],["SBC (@,X)",2],["-",0],["ISC (@,X)",2],
  ["CPX *@",2],["SBC *@",2],["INC *@",2],["ISC *@",2],["INX",1],["SBC #@",2],["NOP",1],["-",0],["CPX ^",3],["SBC ^",3],
  ["INC ^",3],["ISC ^",3],["BEQ @",2],["SBC (@),Y",2],["-",0],["ISC (@),Y",2],["-",0],["SBC *@,X",2],["INC *@,X",2],["ISC *@,X",2],
  ["SED",1],["SBC ^,Y",3],["-",0],["ISC ^,Y",3],["-",0],["SBC ^,X",3],["INC ^,X",3],["ISC ^,X",3]
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
 * Disassemble a single 6502 instruction
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
  s = s.replace(" @", " $" + rel8);
  s = s.replace("@", "$" + d8);
  const d16 = toHex2(b) + toHex2(a);
  s = s.replace("^", "$" + d16);
  return [s, sx[1]];
};

/**
 * Create MOS 6502 CPU emulator instance
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
  let a = 0;          // Accumulator
  let x = 0;          // X index register
  let y = 0;          // Y index register
  let flags = 32;     // Status register (bit 5 always set)
  let sp = 255;       // Stack pointer (points to $0100-$01FF)
  let pc = 0;         // Program counter
  let T = 0;          // Total cycles
  let breakFlag = false;  // BRK instruction flag
  let excycles = 0;   // Extra cycles for current instruction
  let addcycles = 0;  // Flag to check for page boundary crossing

  // Helper: read word from memory (little-endian)
  const wordAt = (addr) => {
    return byteAt(addr) + byteAt(0xffff & (addr + 1)) * 256;
  };

  // Helper: read byte at PC (immediate addressing)
  const immediateByte = () => {
    return byteAt(pc);
  };

  // Addressing mode functions

  const zeroPageAddr = () => byteAt(pc);

  const zeroPageXAddr = () => 255 & (x + byteAt(pc));

  const zeroPageYAddr = () => 255 & (y + byteAt(pc));

  const indirectXAddr = () => wordAt(255 & (byteAt(pc) + x));

  // Fixed: wrap address to zero-page for wordAt call
  const indirectYAddr = () => {
    if (addcycles) {
      const zpAddr = byteAt(pc);
      const a1 = byteAt(zpAddr) + byteAt((zpAddr + 1) & 0xff) * 256;
      const a2 = (a1 + y) & 0xffff;
      if ((a1 & 0xff00) !== (a2 & 0xff00)) excycles++;
      return a2;
    } else {
      const zpAddr = byteAt(pc);
      return (byteAt(zpAddr) + byteAt((zpAddr + 1) & 0xff) * 256 + y) & 0xffff;
    }
  };

  const absoluteAddr = () => wordAt(pc);

  const absoluteXAddr = () => {
    if (addcycles) {
      const a1 = wordAt(pc);
      const a2 = (a1 + x) & 0xffff;
      if ((a1 & 0xff00) !== (a2 & 0xff00)) excycles++;
      return a2;
    } else {
      return (wordAt(pc) + x) & 0xffff;
    }
  };

  const absoluteYAddr = () => {
    if (addcycles) {
      const a1 = wordAt(pc);
      const a2 = (a1 + y) & 0xffff;
      if ((a1 & 0xff00) !== (a2 & 0xff00)) excycles++;
      return a2;
    } else {
      return (wordAt(pc) + y) & 0xffff;
    }
  };

  const branchRelAddr = () => {
    excycles++;
    let addr = immediateByte();
    pc++;
    addr = (addr & 128) ? pc - ((addr ^ 255) + 1) : pc + addr;
    if ((pc & 0xff00) !== (addr & 0xff00)) excycles++;
    pc = addr & 0xffff;
  };

  // Stack operations

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

  // Flag operations

  const flagsNZ = (z) => {
    flags &= ~(FLAG_ZERO + FLAG_NEGATIVE);
    if (z === 0) {
      flags |= FLAG_ZERO;
    } else {
      flags |= z & 128;
    }
  };

  const flagVadc = (m, n, s) => {
    const m7 = (m & 0x80) ? 1 : 0;
    const n7 = (n & 0x80) ? 1 : 0;
    const s7 = (s & 0x80) ? 1 : 0;
    let v = 0;
    if ((m7 === 0) && (n7 === 0) && (s7 === 1)) v = 1;
    if ((m7 === 1) && (n7 === 1) && (s7 === 0)) v = 1;
    return v;
  };

  const flagVsbc = (m, n, s) => {
    const m7 = (m & 0x80) ? 1 : 0;
    const n7 = (n & 0x80) ? 1 : 0;
    const s7 = (s & 0x80) ? 1 : 0;
    let v = 0;
    if ((m7 === 0) && (n7 === 1) && (s7 === 0)) v = 1;
    if ((m7 === 1) && (n7 === 0) && (s7 === 1)) v = 1;
    return v;
  };

  // Instruction operations

  const opORA = (addrMode) => {
    a |= byteAt(addrMode());
    flagsNZ(a);
  };

  const opASL = (addrMode) => {
    const addr = addrMode();
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

  const opLSR = (addrMode) => {
    const addr = addrMode();
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
  };

  const opBST = (x) => {
    if (flags & x) {
      branchRelAddr();
    } else {
      pc++;
    }
  };

  const opCLR = (x) => {
    flags &= ~x;
  };

  const opSET = (x) => {
    flags |= x;
  };

  const opAND = (addrMode) => {
    a &= byteAt(addrMode());
    flagsNZ(a);
  };

  // Fixed: BIT does NOT affect carry flag (removed FLAG_CARRY from mask)
  const opBIT = (addrMode) => {
    const tbyte = byteAt(addrMode());
    flags &= ~(FLAG_ZERO + FLAG_NEGATIVE + FLAG_OVERFLOW);
    if ((a & tbyte) === 0) flags |= FLAG_ZERO;
    flags |= tbyte & (128 + 64);
  };

  const opROL = (addrMode) => {
    const addr = addrMode();
    let tbyte = byteAt(addr);
    if (flags & FLAG_CARRY) {
      const newCarry = (tbyte & 128) !== 0;
      tbyte = (tbyte << 1) | 1;
      if (!newCarry) {
        flags &= ~FLAG_CARRY;
      }
    } else {
      if (tbyte & 128) flags |= FLAG_CARRY;
      tbyte = tbyte << 1;
    }
    flagsNZ(tbyte);
    byteTo(addr, tbyte);
  };

  const opEOR = (addrMode) => {
    a ^= byteAt(addrMode());
    flagsNZ(a);
  };

  const opADC = (addrMode) => {
    let data = byteAt(addrMode());
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

  const opROR = (addrMode) => {
    const addr = addrMode();
    let tbyte = byteAt(addr);
    if (flags & FLAG_CARRY) {
      const newCarry = (tbyte & 1) !== 0;
      tbyte = (tbyte >> 1) | 128;
      if (!newCarry) flags &= ~FLAG_CARRY;
    } else {
      if (tbyte & 1) flags |= FLAG_CARRY;
      tbyte = tbyte >> 1;
    }
    flagsNZ(tbyte);
    byteTo(addr, tbyte);
  };

  const opSTA = (addrMode) => {
    byteTo(addrMode(), a);
  };

  const opSTY = (addrMode) => {
    byteTo(addrMode(), y);
  };

  const opSTX = (addrMode) => {
    byteTo(addrMode(), x);
  };

  const opCPY = (addrMode) => {
    const tbyte = byteAt(addrMode());
    flags &= ~(FLAG_CARRY + FLAG_ZERO + FLAG_NEGATIVE);
    if (y === tbyte) {
      flags |= FLAG_CARRY + FLAG_ZERO;
    } else if (y > tbyte) {
      flags |= FLAG_CARRY;
    } else {
      flags |= FLAG_NEGATIVE;
    }
  };

  const opCPX = (addrMode) => {
    const tbyte = byteAt(addrMode());
    flags &= ~(FLAG_CARRY + FLAG_ZERO + FLAG_NEGATIVE);
    if (x === tbyte) {
      flags |= FLAG_CARRY + FLAG_ZERO;
    } else if (x > tbyte) {
      flags |= FLAG_CARRY;
    } else {
      flags |= FLAG_NEGATIVE;
    }
  };

  const opCMP = (addrMode) => {
    const tbyte = byteAt(addrMode());
    flags &= ~(FLAG_CARRY + FLAG_ZERO + FLAG_NEGATIVE);
    if (a === tbyte) {
      flags |= FLAG_CARRY + FLAG_ZERO;
    } else if (a > tbyte) {
      flags |= FLAG_CARRY;
    } else {
      flags |= FLAG_NEGATIVE;
    }
  };

  const opSBC = (addrMode) => {
    let data = byteAt(addrMode());
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

  const opDECR = (addrMode) => {
    const addr = addrMode();
    const tbyte = (byteAt(addr) - 1) & 255;
    flags &= ~(FLAG_ZERO + FLAG_NEGATIVE);
    if (tbyte) {
      flags |= tbyte & 128;
    } else {
      flags |= FLAG_ZERO;
    }
    byteTo(addr, tbyte);
  };

  const opINCR = (addrMode) => {
    const addr = addrMode();
    const tbyte = (byteAt(addr) + 1) & 255;
    flags &= ~(FLAG_ZERO + FLAG_NEGATIVE);
    if (tbyte) {
      flags |= tbyte & 128;
    } else {
      flags |= FLAG_ZERO;
    }
    byteTo(addr, tbyte);
  };

  const opLDA = (addrMode) => {
    a = byteAt(addrMode());
    flagsNZ(a);
  };

  const opLDY = (addrMode) => {
    y = byteAt(addrMode());
    flagsNZ(y);
  };

  const opLDX = (addrMode) => {
    x = byteAt(addrMode());
    flagsNZ(x);
  };

  // Instruction handlers

  const ini = () => { pc++; };

  const i00 = () => {
    flags |= FLAG_BREAK;
    stPushWord(pc);
    stPush(flags);
    flags |= FLAG_INTERRUPT;
    pc = wordAt(IRQ_VECTOR);
    breakFlag = true;
  };

  const i01 = () => { opORA(indirectXAddr); pc++; };
  const i05 = () => { opORA(zeroPageAddr); pc++; };
  const i06 = () => { opASL(zeroPageAddr); pc++; };
  const i08 = () => { flags |= 32; stPush(flags); };
  const i09 = () => { a |= immediateByte(); flagsNZ(a); pc++; };
  const i0a = () => {
    if (a & 128) {
      flags |= FLAG_CARRY;
    } else {
      flags &= ~FLAG_CARRY;
    }
    a = a << 1;
    flagsNZ(a);
    a &= 255;
  };
  const i0d = () => { opORA(absoluteAddr); pc += 2; };
  const i0e = () => { opASL(absoluteAddr); pc += 2; };
  const i10 = () => { opBCL(FLAG_NEGATIVE); };
  const i11 = () => { opORA(indirectYAddr); pc++; };
  const i15 = () => { opORA(zeroPageXAddr); pc++; };
  const i16 = () => { opASL(zeroPageXAddr); pc++; };
  const i18 = () => { opCLR(FLAG_CARRY); };
  const i19 = () => { opORA(absoluteYAddr); pc += 2; };
  const i1d = () => { opORA(absoluteXAddr); pc += 2; };
  const i1e = () => { opASL(absoluteXAddr); pc += 2; };
  const i20 = () => { stPushWord((pc + 1) & 0xffff); pc = wordAt(pc); };
  const i21 = () => { opAND(indirectXAddr); pc++; };
  const i24 = () => { opBIT(zeroPageAddr); pc++; };
  const i25 = () => { opAND(zeroPageAddr); pc++; };
  const i26 = () => { opROL(zeroPageAddr); pc++; };
  const i28 = () => { flags = stPop(); };
  const i29 = () => { a &= immediateByte(); flagsNZ(a); pc++; };
  const i2a = () => {
    if (flags & FLAG_CARRY) {
      const newCarry = (a & 128) !== 0;
      a = (a << 1) | 1;
      if (!newCarry) flags &= ~FLAG_CARRY;
    } else {
      if (a & 128) flags |= FLAG_CARRY;
      a = a << 1;
    }
    flagsNZ(a);
    a &= 255;
  };
  const i2c = () => { opBIT(absoluteAddr); pc += 2; };
  const i2d = () => { opAND(absoluteAddr); pc += 2; };
  const i2e = () => { opROL(absoluteAddr); pc += 2; };
  const i30 = () => { opBST(FLAG_NEGATIVE); };
  const i31 = () => { opAND(indirectYAddr); pc++; };
  const i35 = () => { opAND(zeroPageXAddr); pc++; };
  const i36 = () => { opROL(zeroPageXAddr); pc++; };
  const i38 = () => { opSET(FLAG_CARRY); };
  const i39 = () => { opAND(absoluteYAddr); pc += 2; };
  const i3d = () => { opAND(absoluteXAddr); pc += 2; };
  const i3e = () => { opROL(absoluteXAddr); pc += 2; };
  const i40 = () => { flags = stPop(); pc = stPopWord(); };
  const i41 = () => { opEOR(indirectXAddr); pc++; };
  const i45 = () => { opEOR(zeroPageAddr); pc++; };
  const i46 = () => { opLSR(zeroPageAddr); pc++; };
  const i48 = () => { stPush(a); };
  const i49 = () => { a ^= immediateByte(); flagsNZ(a); pc++; };
  const i4a = () => {
    flags &= ~(FLAG_CARRY + FLAG_NEGATIVE + FLAG_ZERO);
    if (a & 1) flags |= FLAG_CARRY;
    a = a >> 1;
    if (a === 0) {
      flags |= FLAG_ZERO;
    }
    a &= 255;
  };

  const i4c = () => { pc = wordAt(pc); };

  const i4d = () => { opEOR(absoluteAddr); pc += 2; };
  const i4e = () => { opLSR(absoluteAddr); pc += 2; };
  const i50 = () => { opBCL(FLAG_OVERFLOW); };
  const i51 = () => { opEOR(indirectYAddr); pc++; };
  const i55 = () => { opEOR(zeroPageXAddr); pc++; };
  const i56 = () => { opLSR(zeroPageXAddr); pc++; };
  const i58 = () => { opCLR(FLAG_INTERRUPT); };
  const i59 = () => { opEOR(absoluteYAddr); pc += 2; };
  const i5d = () => { opEOR(absoluteXAddr); pc += 2; };
  const i5e = () => { opLSR(absoluteXAddr); pc += 2; };
  const i60 = () => { pc = stPopWord(); pc++; };
  const i61 = () => { opADC(indirectXAddr); pc++; };
  const i65 = () => { opADC(zeroPageAddr); pc++; };
  const i66 = () => { opROR(zeroPageAddr); pc++; };
  const i68 = () => { a = stPop(); flagsNZ(a); };
  const i69 = () => {
    let data = immediateByte();
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
    pc++;
  };
  const i6a = () => {
    if (flags & FLAG_CARRY) {
      const newCarry = (a & 1) !== 0;
      a = (a >> 1) | 128;
      if (!newCarry) flags &= ~FLAG_CARRY;
    } else {
      if (a & 1) flags |= FLAG_CARRY;
      a = a >> 1;
    }
    flagsNZ(a);
    a &= 255;
  };

  const i6c = () => { const ta = wordAt(pc); pc = wordAt(ta); };

  const i6d = () => { opADC(absoluteAddr); pc += 2; };
  const i6e = () => { opROR(absoluteAddr); pc += 2; };
  const i70 = () => { opBST(FLAG_OVERFLOW); };
  const i71 = () => { opADC(indirectYAddr); pc++; };
  const i75 = () => { opADC(zeroPageXAddr); pc++; };
  const i76 = () => { opROR(zeroPageXAddr); pc++; };
  const i78 = () => { opSET(FLAG_INTERRUPT); };
  const i79 = () => { opADC(absoluteYAddr); pc += 2; };
  const i7d = () => { opADC(absoluteXAddr); pc += 2; };
  const i7e = () => { opROR(absoluteXAddr); pc += 2; };
  const i81 = () => { opSTA(indirectXAddr); pc++; };
  const i84 = () => { opSTY(zeroPageAddr); pc++; };
  const i85 = () => { opSTA(zeroPageAddr); pc++; };
  const i86 = () => { opSTX(zeroPageAddr); pc++; };
  const i88 = () => { y--; y &= 255; flagsNZ(y); };
  const i8a = () => { a = x; flagsNZ(a); };
  const i8c = () => { opSTY(absoluteAddr); pc += 2; };
  const i8d = () => { opSTA(absoluteAddr); pc += 2; };
  const i8e = () => { opSTX(absoluteAddr); pc += 2; };
  const i90 = () => { opBCL(FLAG_CARRY); };
  const i91 = () => { opSTA(indirectYAddr); pc++; };
  const i94 = () => { opSTY(zeroPageXAddr); pc++; };
  const i95 = () => { opSTA(zeroPageXAddr); pc++; };
  const i96 = () => { opSTX(zeroPageYAddr); pc++; };
  const i98 = () => { a = y; flagsNZ(a); };
  const i99 = () => { opSTA(absoluteYAddr); pc += 2; };
  const i9a = () => { sp = x; };
  const i9d = () => { opSTA(absoluteXAddr); pc += 2; };
  const ia0 = () => { y = immediateByte(); flagsNZ(y); pc++; };
  const ia1 = () => { opLDA(indirectXAddr); pc++; };
  const ia2 = () => { x = immediateByte(); flagsNZ(x); pc++; };
  const ia4 = () => { opLDY(zeroPageAddr); pc++; };
  const ia5 = () => { opLDA(zeroPageAddr); pc++; };
  const ia6 = () => { opLDX(zeroPageAddr); pc++; };
  const ia8 = () => { y = a; flagsNZ(y); };
  const ia9 = () => { a = immediateByte(); flagsNZ(a); pc++; };
  const iaa = () => { x = a; flagsNZ(x); };
  const iac = () => { opLDY(absoluteAddr); pc += 2; };
  const iad = () => { opLDA(absoluteAddr); pc += 2; };
  const iae = () => { opLDX(absoluteAddr); pc += 2; };
  const ib0 = () => { opBST(FLAG_CARRY); };
  const ib1 = () => { opLDA(indirectYAddr); pc++; };
  const ib4 = () => { opLDY(zeroPageXAddr); pc++; };
  const ib5 = () => { opLDA(zeroPageXAddr); pc++; };
  const ib6 = () => { opLDX(zeroPageYAddr); pc++; };
  const ib8 = () => { opCLR(FLAG_OVERFLOW); };
  const ib9 = () => { opLDA(absoluteYAddr); pc += 2; };
  const iba = () => { x = sp; };
  const ibc = () => { opLDY(absoluteXAddr); pc += 2; };
  const ibd = () => { opLDA(absoluteXAddr); pc += 2; };
  const ibe = () => { opLDX(absoluteYAddr); pc += 2; };
  const ic0 = () => {
    const tbyte = immediateByte();
    flags &= ~(FLAG_CARRY + FLAG_ZERO + FLAG_NEGATIVE);
    if (y === tbyte) {
      flags |= FLAG_CARRY + FLAG_ZERO;
    } else if (y > tbyte) {
      flags |= FLAG_CARRY;
    } else {
      flags |= FLAG_NEGATIVE;
    }
    pc++;
  };
  const ic1 = () => { opCMP(indirectXAddr); pc++; };
  const ic4 = () => { opCPY(zeroPageAddr); pc++; };
  const ic5 = () => { opCMP(zeroPageAddr); pc++; };
  const ic6 = () => { opDECR(zeroPageAddr); pc++; };
  const ic8 = () => { y++; y &= 255; flagsNZ(y); };
  const ic9 = () => {
    const tbyte = immediateByte();
    flags &= ~(FLAG_CARRY + FLAG_ZERO + FLAG_NEGATIVE);
    if (a === tbyte) {
      flags |= FLAG_CARRY + FLAG_ZERO;
    } else if (a > tbyte) {
      flags |= FLAG_CARRY;
    } else {
      flags |= FLAG_NEGATIVE;
    }
    pc++;
  };
  const ica = () => { x--; x &= 255; flagsNZ(x); };
  const icc = () => { opCPY(absoluteAddr); pc += 2; };
  const icd = () => { opCMP(absoluteAddr); pc += 2; };
  const ice = () => { opDECR(absoluteAddr); pc += 2; };
  const id0 = () => { opBCL(FLAG_ZERO); };
  const id1 = () => { opCMP(indirectYAddr); pc++; };
  const id5 = () => { opCMP(zeroPageXAddr); pc++; };
  const id6 = () => { opDECR(zeroPageXAddr); pc++; };
  const id8 = () => { opCLR(FLAG_DECIMAL); };
  const id9 = () => { opCMP(absoluteYAddr); pc += 2; };
  const idd = () => { opCMP(absoluteXAddr); pc += 2; };
  const ide = () => { opDECR(absoluteXAddr); pc += 2; };
  const ie0 = () => {
    const tbyte = immediateByte();
    flags &= ~(FLAG_CARRY + FLAG_ZERO + FLAG_NEGATIVE);
    if (x === tbyte) {
      flags |= FLAG_CARRY + FLAG_ZERO;
    } else if (x > tbyte) {
      flags |= FLAG_CARRY;
    } else {
      flags |= FLAG_NEGATIVE;
    }
    pc++;
  };
  const ie1 = () => { opSBC(indirectXAddr); pc++; };
  const ie4 = () => { opCPX(zeroPageAddr); pc++; };
  const ie5 = () => { opSBC(zeroPageAddr); pc++; };
  const ie6 = () => { opINCR(zeroPageAddr); pc++; };

  const ie8 = () => { x++; x &= 255; flagsNZ(x); };
  const ie9 = () => {
    let data = immediateByte();
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
    pc++;
  };
  const iea = () => {};
  const iec = () => { opCPX(absoluteAddr); pc += 2; };
  const ied = () => { opSBC(absoluteAddr); pc += 2; };
  const iee = () => { opINCR(absoluteAddr); pc += 2; };
  const if0 = () => { opBST(FLAG_ZERO); };
  const if1 = () => { opSBC(indirectYAddr); pc++; };
  const if5 = () => { opSBC(zeroPageXAddr); pc++; };
  const if6 = () => { opINCR(zeroPageXAddr); pc++; };
  const if8 = () => { opSET(FLAG_DECIMAL); };
  const if9 = () => { opSBC(absoluteYAddr); pc += 2; };
  const ifd = () => { opSBC(absoluteXAddr); pc += 2; };
  const ife = () => { opINCR(absoluteXAddr); pc += 2; };

  // Instruction table
  const instruct = [
    i00, i01, ini, ini, ini, i05, i06, ini,
    i08, i09, i0a, ini, ini, i0d, i0e, ini,
    i10, i11, ini, ini, ini, i15, i16, ini,
    i18, i19, ini, ini, ini, i1d, i1e, ini,
    i20, i21, ini, ini, i24, i25, i26, ini,
    i28, i29, i2a, ini, i2c, i2d, i2e, ini,
    i30, i31, ini, ini, ini, i35, i36, ini,
    i38, i39, ini, ini, ini, i3d, i3e, ini,
    i40, i41, ini, ini, ini, i45, i46, ini,
    i48, i49, i4a, ini, i4c, i4d, i4e, ini,
    i50, i51, ini, ini, ini, i55, i56, ini,
    i58, i59, ini, ini, ini, i5d, i5e, ini,
    i60, i61, ini, ini, ini, i65, i66, ini,
    i68, i69, i6a, ini, i6c, i6d, i6e, ini,
    i70, i71, ini, ini, ini, i75, i76, ini,
    i78, i79, ini, ini, ini, i7d, i7e, ini,
    ini, i81, ini, ini, i84, i85, i86, ini,
    i88, ini, i8a, ini, i8c, i8d, i8e, ini,
    i90, i91, ini, ini, i94, i95, i96, ini,
    i98, i99, i9a, ini, ini, i9d, ini, ini,
    ia0, ia1, ia2, ini, ia4, ia5, ia6, ini,
    ia8, ia9, iaa, ini, iac, iad, iae, ini,
    ib0, ib1, ini, ini, ib4, ib5, ib6, ini,
    ib8, ib9, iba, ini, ibc, ibd, ibe, ini,
    ic0, ic1, ini, ini, ic4, ic5, ic6, ini,
    ic8, ic9, ica, ini, icc, icd, ice, ini,
    id0, id1, ini, ini, ini, id5, id6, ini,
    id8, id9, ini, ini, ini, idd, ide, ini,
    ie0, ie1, ini, ini, ie4, ie5, ie6, ini,
    ie8, ie9, iea, ini, iec, ied, iee, ini,
    if0, if1, ini, ini, ini, if5, if6, ini,
    if8, if9, ini, ini, ini, ifd, ife, ini
  ];

  /**
   * Execute one instruction
   * @returns {number} Cycles consumed
   */
  const step = () => {
    breakFlag = false;
    const instructCode = immediateByte();
    pc++;
    pc &= 0xffff;
    excycles = 0;
    addcycles = extracycles[instructCode];
    instruct[instructCode]();

    pc &= 0xffff;
    const time = cycletime[instructCode] + excycles;
    T += time;
    if (ticks) ticks(time);
    return time;
  };

  /**
   * Reset CPU to initial state
   */
  const reset = () => {
    pc = wordAt(RESET_VECTOR);
    sp = 0xFD;
    a = x = y = 0;
    flags = 32;
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
    x: x,
    y: y,
    flags: flags,
    break: breakFlag
  });

  /**
   * Trigger maskable interrupt (IRQ)
   */
  const interrupt = () => {
    if (flags & FLAG_INTERRUPT) {
      return;
    }
    stPushWord(pc);
    stPush(flags);
    flags |= FLAG_INTERRUPT;
    pc = wordAt(IRQ_VECTOR);
    T += 7;
  };

  /**
   * Trigger non-maskable interrupt (NMI)
   */
  const nmi = () => {
    stPushWord(pc);
    stPush(flags);
    flags |= FLAG_INTERRUPT;
    pc = wordAt(NMI_VECTOR);
    T += 7;
  };

  /**
   * Set CPU register value
   * @param {string} reg - Register name
   * @param {number} value - Value to set
   */
  const set = (reg, value) => {
    switch (reg) {
      case "PC": pc = value; return;
      case "A": a = value; return;
      case "X": x = value; return;
      case "Y": y = value; return;
      case "SP": sp = value; return;
      case "FLAGS": flags = value; return;
    }
  };

  /**
   * Convert flags to string representation
   * @returns {string} Flag string (e.g., "NV1BDIZC")
   */
  const flagsToString = () => {
    let f = "";
    const fx = "NV-BDIZC";
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
