/**
 * Zilog Z80 CPU Emulator
 *
 * ES6 module implementation of cycle-accurate Z80 emulator.
 * The Z80 is a superset of Intel 8080 with enhanced instruction set,
 * alternate registers, index registers (IX/IY), and advanced features.
 *
 * Based on original JSSpeccy implementation (CoffeeScript-generated eval code)
 * modernized to ES6 without runtime code generation.
 *
 * @module z80
 */

// Flag bit masks (Z80 has 8 flags: SZYHXPNC)
const FLAG_C = 0x01;  // Carry
const FLAG_N = 0x02;  // Subtract (for DAA)
const FLAG_P = 0x04;  // Parity/Overflow
const FLAG_V = 0x04;  // Overflow (same bit as P)
const FLAG_X = 0x08;  // Undocumented flag bit 3
const FLAG_H = 0x10;  // Half-carry
const FLAG_Y = 0x20;  // Undocumented flag bit 5
const FLAG_Z = 0x40;  // Zero
const FLAG_S = 0x80;  // Sign

/**
 * Detect endianness for typed array register storage
 */
const detectEndianness = () => {
  const buffer = new ArrayBuffer(2);
  const uint16 = new Uint16Array(buffer);
  const uint8 = new Uint8Array(buffer);
  uint16[0] = 0x0100;
  return uint8[0] === 0x01; // true = big-endian
};

const isBigEndian = detectEndianness();

// Register pair indexes for 16-bit access
const RP_AF = 0;
const RP_BC = 1;
const RP_DE = 2;
const RP_HL = 3;
const RP_AF_ = 4; // Alternate
const RP_BC_ = 5;
const RP_DE_ = 6;
const RP_HL_ = 7;
const RP_IX = 8;
const RP_IY = 9;
const RP_IR = 10; // I and R combined
const RP_SP = 11;
const RP_PC = 12;

// Register indexes for 8-bit access (endian-dependent)
let R_A, R_F, R_B, R_C, R_D, R_E, R_H, R_L;
let R_A_, R_F_, R_B_, R_C_, R_D_, R_E_, R_H_, R_L_;
let R_IXH, R_IXL, R_IYH, R_IYL, R_I, R_R;

if (isBigEndian) {
  R_A = 0; R_F = 1;
  R_B = 2; R_C = 3;
  R_D = 4; R_E = 5;
  R_H = 6; R_L = 7;
  R_A_ = 8; R_F_ = 9;
  R_B_ = 10; R_C_ = 11;
  R_D_ = 12; R_E_ = 13;
  R_H_ = 14; R_L_ = 15;
  R_IXH = 16; R_IXL = 17;
  R_IYH = 18; R_IYL = 19;
  R_I = 20; R_R = 21;
} else {
  R_F = 0; R_A = 1;
  R_C = 2; R_B = 3;
  R_E = 4; R_D = 5;
  R_L = 6; R_H = 7;
  R_F_ = 8; R_A_ = 9;
  R_C_ = 10; R_B_ = 11;
  R_E_ = 12; R_D_ = 13;
  R_L_ = 14; R_H_ = 15;
  R_IXL = 16; R_IXH = 17;
  R_IYL = 18; R_IYH = 19;
  R_R = 20; R_I = 21;
}

/**
 * Pre-computed flag lookup tables for hardware-accurate behavior
 */

// Sign, Zero, Y, X, Parity flags for all 256 byte values
const sz53pTable = new Uint8Array(256);
for (let i = 0; i < 256; i++) {
  let flags = i & (FLAG_S | FLAG_Y | FLAG_X); // S, Y, X from value
  if (i === 0) flags |= FLAG_Z; // Zero flag
  // Parity: count 1-bits
  let parity = 0;
  for (let j = i; j; j >>= 1) {
    parity ^= (j & 1);
  }
  if (parity === 0) flags |= FLAG_P; // Even parity
  sz53pTable[i] = flags;
}

// Sign, Zero, Y, X flags only (no parity)
const sz53Table = new Uint8Array(256);
for (let i = 0; i < 256; i++) {
  let flags = i & (FLAG_S | FLAG_Y | FLAG_X); // S, Y, X from value
  if (i === 0) flags |= FLAG_Z; // Zero flag
  sz53Table[i] = flags;
}

// Parity-only table
const parityTable = new Uint8Array(256);
for (let i = 0; i < 256; i++) {
  let parity = 0;
  for (let j = i; j; j >>= 1) {
    parity ^= (j & 1);
  }
  parityTable[i] = parity === 0 ? FLAG_P : 0;
}

// Half-carry lookup for ADD operations
// Index = (a_bit3) | (b_bit3 << 1) | (result_bit3 << 2)
const halfcarryAddTable = new Uint8Array([0, FLAG_H, FLAG_H, FLAG_H, 0, 0, 0, FLAG_H]);

// Half-carry lookup for SUB operations
// Index = (a_bit3) | (b_bit3 << 1) | (result_bit3 << 2)
const halfcarrySubTable = new Uint8Array([0, 0, FLAG_H, 0, FLAG_H, 0, FLAG_H, FLAG_H]);

// Overflow lookup for ADD operations
// Index = (a_bit7) | (b_bit7 << 1) | (result_bit7 << 2)
// Overflow when pos+pos=neg (i=4) or neg+neg=pos (i=3)
const overflowAddTable = new Uint8Array([0, 0, 0, FLAG_V, FLAG_V, 0, 0, 0]);

// Overflow lookup for SUB operations
// Index = (a_bit7) | (b_bit7 << 1) | (result_bit7 << 2)
// Overflow when neg-pos=pos (i=1) or pos-neg=neg (i=6)
const overflowSubTable = new Uint8Array([0, FLAG_V, 0, 0, 0, 0, FLAG_V, 0]);

/**
 * Create a Zilog Z80 CPU emulator instance
 *
 * @param {Object} callbacks - Memory and I/O callback functions
 * @param {Function} callbacks.byteTo - Write byte to memory: (address, value) => void
 * @param {Function} callbacks.byteAt - Read byte from memory: (address) => value
 * @param {Function} [callbacks.portOut] - Write byte to port: (port, value) => void
 * @param {Function} [callbacks.portIn] - Read byte from port: (port) => value
 * @param {Function} [callbacks.contendRead] - ZX Spectrum memory contention: (addr, cycles) => additionalCycles
 * @param {Function} [callbacks.contendWrite] - ZX Spectrum memory contention: (addr, cycles) => additionalCycles
 * @returns {Object} CPU instance with public API
 */
export default (callbacks) => {
  const { byteTo, byteAt, portOut, portIn, contendRead, contendWrite } = callbacks;

  // Register storage (13 pairs × 2 bytes = 26 bytes)
  const regPairsBuffer = new ArrayBuffer(26);
  const regPairs = new Uint16Array(regPairsBuffer); // 16-bit view
  const regs = new Uint8Array(regPairsBuffer);      // 8-bit view

  // CPU state
  let iff1 = 0;          // Interrupt flip-flop 1
  let iff2 = 0;          // Interrupt flip-flop 2
  let im = 0;            // Interrupt mode (0, 1, or 2)
  let halted = false;    // HALT state
  let tstates = 0;       // Cycle counter
  let interruptPending = false;
  let NMIPending = false;

  // Optional contention callbacks (for ZX Spectrum timing)
  const contend_read = contendRead || ((addr, cycles) => cycles);
  const contend_write = contendWrite || ((addr, cycles) => cycles);

  /**
   * Reset CPU to initial state
   */
  const reset = () => {
    // Clear all registers
    for (let i = 0; i < regPairs.length; i++) {
      regPairs[i] = 0;
    }

    // Initialize state
    regPairs[RP_PC] = 0;
    regPairs[RP_SP] = 0; // Consistent with 8080/8085
    iff1 = 0;
    iff2 = 0;
    im = 0;
    halted = false;
    tstates = 0;
    interruptPending = false;
    NMIPending = false;
  };

  /**
   * Memory access helpers
   */
  const readByte = (addr) => byteAt(addr & 0xFFFF);

  const writeByte = (addr, value) => {
    byteTo(addr & 0xFFFF, value & 0xFF);
  };

  const readWord = (addr) => {
    const l = readByte(addr);
    const h = readByte((addr + 1) & 0xFFFF);
    return (h << 8) | l;
  };

  const writeWord = (addr, value) => {
    writeByte(addr, value & 0xFF);
    writeByte((addr + 1) & 0xFFFF, (value >> 8) & 0xFF);
  };

  /**
   * Stack operations
   */
  const push = (value) => {
    regPairs[RP_SP] = (regPairs[RP_SP] - 1) & 0xFFFF;
    writeByte(regPairs[RP_SP], (value >> 8) & 0xFF);
    regPairs[RP_SP] = (regPairs[RP_SP] - 1) & 0xFFFF;
    writeByte(regPairs[RP_SP], value & 0xFF);
  };

  const pop = () => {
    const l = readByte(regPairs[RP_SP]);
    regPairs[RP_SP] = (regPairs[RP_SP] + 1) & 0xFFFF;
    const h = readByte(regPairs[RP_SP]);
    regPairs[RP_SP] = (regPairs[RP_SP] + 1) & 0xFFFF;
    return (h << 8) | l;
  };

  /**
   * Fetch next byte from PC and increment (for operands, not opcodes)
   */
  const fetchByte = () => {
    const byte = readByte(regPairs[RP_PC]);
    regPairs[RP_PC] = (regPairs[RP_PC] + 1) & 0xFFFF;
    return byte;
  };

  /**
   * Fetch next word from PC and increment
   */
  const fetchWord = () => {
    const l = fetchByte();
    const h = fetchByte();
    return (h << 8) | l;
  };

  // Register getter: returns value of Z80 register r (0=B,1=C,2=D,3=E,4=H,5=L,6=(HL),7=A)
  const getReg = (r) => {
    switch (r) {
      case 0: return regs[R_B];
      case 1: return regs[R_C];
      case 2: return regs[R_D];
      case 3: return regs[R_E];
      case 4: return regs[R_H];
      case 5: return regs[R_L];
      case 6: return readByte(regPairs[RP_HL]);
      case 7: return regs[R_A];
    }
  };

  // Register setter: sets value of Z80 register r
  const setReg = (r, value) => {
    value &= 0xFF;
    switch (r) {
      case 0: regs[R_B] = value; break;
      case 1: regs[R_C] = value; break;
      case 2: regs[R_D] = value; break;
      case 3: regs[R_E] = value; break;
      case 4: regs[R_H] = value; break;
      case 5: regs[R_L] = value; break;
      case 6: writeByte(regPairs[RP_HL], value); break;
      case 7: regs[R_A] = value; break;
    }
  };

  const isMemory = (r) => r === 6;

  // ALU operations for Z80: ADD,ADC,SUB,SBC,AND,XOR,OR,CP
  const addA = (value) => {
    const result = regs[R_A] + value;
    const lookup = ((regs[R_A] & 0x88) >> 3) | ((value & 0x88) >> 2) | ((result & 0x88) >> 1);
    regs[R_A] = result & 0xFF;
    regs[R_F] = (result & 0x100 ? FLAG_C : 0) |
                halfcarryAddTable[lookup & 0x07] |
                overflowAddTable[lookup >> 4] |
                sz53Table[regs[R_A]];
  };

  const adcA = (value) => {
    const result = regs[R_A] + value + (regs[R_F] & FLAG_C);
    const lookup = ((regs[R_A] & 0x88) >> 3) | ((value & 0x88) >> 2) | ((result & 0x88) >> 1);
    regs[R_A] = result & 0xFF;
    regs[R_F] = (result & 0x100 ? FLAG_C : 0) |
                halfcarryAddTable[lookup & 0x07] |
                overflowAddTable[lookup >> 4] |
                sz53Table[regs[R_A]];
  };

  const subA = (value) => {
    const result = regs[R_A] - value;
    const lookup = ((regs[R_A] & 0x88) >> 3) | ((value & 0x88) >> 2) | ((result & 0x88) >> 1);
    regs[R_A] = result & 0xFF;
    regs[R_F] = (result & 0x100 ? FLAG_C : 0) |
                FLAG_N |
                halfcarrySubTable[lookup & 0x07] |
                overflowSubTable[lookup >> 4] |
                sz53Table[regs[R_A]];
  };

  const sbcA = (value) => {
    const result = regs[R_A] - value - (regs[R_F] & FLAG_C);
    const lookup = ((regs[R_A] & 0x88) >> 3) | ((value & 0x88) >> 2) | ((result & 0x88) >> 1);
    regs[R_A] = result & 0xFF;
    regs[R_F] = (result & 0x100 ? FLAG_C : 0) |
                FLAG_N |
                halfcarrySubTable[lookup & 0x07] |
                overflowSubTable[lookup >> 4] |
                sz53Table[regs[R_A]];
  };

  const andA = (value) => {
    regs[R_A] &= value;
    regs[R_F] = FLAG_H | sz53pTable[regs[R_A]];
  };

  const xorA = (value) => {
    regs[R_A] ^= value;
    regs[R_F] = sz53pTable[regs[R_A]];
  };

  const orA = (value) => {
    regs[R_A] |= value;
    regs[R_F] = sz53pTable[regs[R_A]];
  };

  const cpA = (value) => {
    const result = regs[R_A] - value;
    const lookup = ((regs[R_A] & 0x88) >> 3) | ((value & 0x88) >> 2) | ((result & 0x88) >> 1);
    regs[R_F] = (result & 0x100 ? FLAG_C : (result ? 0 : FLAG_Z)) |
                FLAG_N |
                halfcarrySubTable[lookup & 0x07] |
                overflowSubTable[lookup >> 4] |
                (value & (FLAG_Y | FLAG_X)) |
                (result & FLAG_S);
  };

  // ALU dispatch table: ADD, ADC, SUB, SBC, AND, XOR, OR, CP
  const Z80_ALU = [addA, adcA, subA, sbcA, andA, xorA, orA, cpA];

  /**
   * Execute CB-prefixed instruction (bit operations)
   */
  const executeCBInstruction = () => {
    const opcode = fetchByte();

    // Extract bit number and register from opcode pattern
    const bit = (opcode >> 3) & 0x07;
    const reg = opcode & 0x07;

    if (opcode < 0x40) {
      // 0x00-0x3F: Rotates and shifts
      let value = getReg(reg);

      if (opcode < 0x08) {
        // RLC r
        value = ((value << 1) | (value >> 7)) & 0xFF;
        regs[R_F] = (value & FLAG_C) | sz53pTable[value];
      } else if (opcode < 0x10) {
        // RRC r
        regs[R_F] = value & FLAG_C;
        value = ((value >> 1) | (value << 7)) & 0xFF;
        regs[R_F] |= sz53pTable[value];
      } else if (opcode < 0x18) {
        // RL r
        const carry = regs[R_F] & FLAG_C;
        regs[R_F] = value >> 7;
        value = ((value << 1) | carry) & 0xFF;
        regs[R_F] |= sz53pTable[value];
      } else if (opcode < 0x20) {
        // RR r
        const carry = regs[R_F] & FLAG_C;
        regs[R_F] = value & FLAG_C;
        value = ((value >> 1) | (carry << 7)) & 0xFF;
        regs[R_F] |= sz53pTable[value];
      } else if (opcode < 0x28) {
        // SLA r
        regs[R_F] = value >> 7;
        value = (value << 1) & 0xFF;
        regs[R_F] |= sz53pTable[value];
      } else if (opcode < 0x30) {
        // SRA r
        regs[R_F] = value & FLAG_C;
        value = ((value & 0x80) | (value >> 1)) & 0xFF;
        regs[R_F] |= sz53pTable[value];
      } else if (opcode < 0x38) {
        // SLL r (undocumented)
        regs[R_F] = value >> 7;
        value = ((value << 1) | 0x01) & 0xFF;
        regs[R_F] |= sz53pTable[value];
      } else {
        // SRL r
        regs[R_F] = value & FLAG_C;
        value >>= 1;
        regs[R_F] |= sz53pTable[value];
      }

      setReg(reg, value);
      tstates += isMemory(reg) ? 15 : 8;

    } else if (opcode < 0x80) {
      // 0x40-0x7F: BIT n,r
      const value = getReg(reg);
      regs[R_F] = (regs[R_F] & FLAG_C) | FLAG_H | (value & (FLAG_X | FLAG_Y));
      if (!(value & (1 << bit))) {
        regs[R_F] |= FLAG_P | FLAG_Z;
      }
      if (bit === 7 && (value & 0x80)) {
        regs[R_F] |= FLAG_S;
      }
      tstates += isMemory(reg) ? 12 : 8;

    } else if (opcode < 0xC0) {
      // 0x80-0xBF: RES n,r
      const value = getReg(reg) & ~(1 << bit);
      setReg(reg, value);
      tstates += isMemory(reg) ? 15 : 8;

    } else {
      // 0xC0-0xFF: SET n,r
      const value = getReg(reg) | (1 << bit);
      setReg(reg, value);
      tstates += isMemory(reg) ? 15 : 8;
    }
  };

  /**
   * Execute ED-prefixed instruction (extended operations)
   */
  const executeEDInstruction = () => {
    const opcode = fetchByte();

    switch (opcode) {
      // Block load instructions
      case 0xA0: { // LDI
        const value = readByte(regPairs[RP_HL]);
        writeByte(regPairs[RP_DE], value);
        regPairs[RP_HL] = (regPairs[RP_HL] + 1) & 0xFFFF;
        regPairs[RP_DE] = (regPairs[RP_DE] + 1) & 0xFFFF;
        regPairs[RP_BC] = (regPairs[RP_BC] - 1) & 0xFFFF;
        const n = (value + regs[R_A]) & 0xFF;
        regs[R_F] = (regs[R_F] & (FLAG_C | FLAG_Z | FLAG_S)) |
                    (regPairs[RP_BC] ? FLAG_P : 0) |
                    (n & FLAG_X) |
                    ((n & 0x02) ? FLAG_Y : 0);
        tstates += 16;
        break;
      }

      case 0xA8: { // LDD
        const value = readByte(regPairs[RP_HL]);
        writeByte(regPairs[RP_DE], value);
        regPairs[RP_HL] = (regPairs[RP_HL] - 1) & 0xFFFF;
        regPairs[RP_DE] = (regPairs[RP_DE] - 1) & 0xFFFF;
        regPairs[RP_BC] = (regPairs[RP_BC] - 1) & 0xFFFF;
        const n = (value + regs[R_A]) & 0xFF;
        regs[R_F] = (regs[R_F] & (FLAG_C | FLAG_Z | FLAG_S)) |
                    (regPairs[RP_BC] ? FLAG_P : 0) |
                    (n & FLAG_X) |
                    ((n & 0x02) ? FLAG_Y : 0);
        tstates += 16;
        break;
      }

      case 0xB0: { // LDIR - internal loop until BC=0
        let ldir_val = 0;
        do {
          ldir_val = readByte(regPairs[RP_HL]);
          writeByte(regPairs[RP_DE], ldir_val);
          regPairs[RP_HL] = (regPairs[RP_HL] + 1) & 0xFFFF;
          regPairs[RP_DE] = (regPairs[RP_DE] + 1) & 0xFFFF;
          regPairs[RP_BC] = (regPairs[RP_BC] - 1) & 0xFFFF;
          tstates += regPairs[RP_BC] ? 21 : 16;
        } while (regPairs[RP_BC]);
        const ldir_n = (ldir_val + regs[R_A]) & 0xFF;
        regs[R_F] = (regs[R_F] & (FLAG_C | FLAG_Z | FLAG_S)) |
                    (ldir_n & FLAG_X) |
                    ((ldir_n & 0x02) ? FLAG_Y : 0);
        break;
      }

      case 0xB8: { // LDDR - internal loop until BC=0
        let lddr_val = 0;
        do {
          lddr_val = readByte(regPairs[RP_HL]);
          writeByte(regPairs[RP_DE], lddr_val);
          regPairs[RP_HL] = (regPairs[RP_HL] - 1) & 0xFFFF;
          regPairs[RP_DE] = (regPairs[RP_DE] - 1) & 0xFFFF;
          regPairs[RP_BC] = (regPairs[RP_BC] - 1) & 0xFFFF;
          tstates += regPairs[RP_BC] ? 21 : 16;
        } while (regPairs[RP_BC]);
        const lddr_n = (lddr_val + regs[R_A]) & 0xFF;
        regs[R_F] = (regs[R_F] & (FLAG_C | FLAG_Z | FLAG_S)) |
                    (lddr_n & FLAG_X) |
                    ((lddr_n & 0x02) ? FLAG_Y : 0);
        break;
      }

      // Block compare instructions
      case 0xA1: { // CPI
        const value = readByte(regPairs[RP_HL]);
        const result = (regs[R_A] - value) & 0xFF;
        const lookup = ((regs[R_A] & 0x08) >> 3) | ((value & 0x08) >> 2) | ((result & 0x08) >> 1);
        regPairs[RP_HL] = (regPairs[RP_HL] + 1) & 0xFFFF;
        regPairs[RP_BC] = (regPairs[RP_BC] - 1) & 0xFFFF;
        regs[R_F] = (regs[R_F] & FLAG_C) |
                    (regPairs[RP_BC] ? FLAG_P | FLAG_N : FLAG_N) |
                    halfcarrySubTable[lookup] |
                    (result ? 0 : FLAG_Z) |
                    (result & FLAG_S);
        let n = result;
        if (regs[R_F] & FLAG_H) n--;
        regs[R_F] |= (n & FLAG_X) | ((n & 0x02) ? FLAG_Y : 0);
        tstates += 16;
        break;
      }

      case 0xA9: { // CPD
        const value = readByte(regPairs[RP_HL]);
        const result = (regs[R_A] - value) & 0xFF;
        const lookup = ((regs[R_A] & 0x08) >> 3) | ((value & 0x08) >> 2) | ((result & 0x08) >> 1);
        regPairs[RP_HL] = (regPairs[RP_HL] - 1) & 0xFFFF;
        regPairs[RP_BC] = (regPairs[RP_BC] - 1) & 0xFFFF;
        regs[R_F] = (regs[R_F] & FLAG_C) |
                    (regPairs[RP_BC] ? FLAG_P | FLAG_N : FLAG_N) |
                    halfcarrySubTable[lookup] |
                    (result ? 0 : FLAG_Z) |
                    (result & FLAG_S);
        let n = result;
        if (regs[R_F] & FLAG_H) n--;
        regs[R_F] |= (n & FLAG_X) | ((n & 0x02) ? FLAG_Y : 0);
        tstates += 16;
        break;
      }

      case 0xB1: { // CPIR - internal loop until match or BC=0
        let cpir_result = 1, cpir_lookup = 0;
        do {
          const cpir_val = readByte(regPairs[RP_HL]);
          cpir_result = (regs[R_A] - cpir_val) & 0xFF;
          cpir_lookup = ((regs[R_A] & 0x08) >> 3) | ((cpir_val & 0x08) >> 2) | ((cpir_result & 0x08) >> 1);
          regPairs[RP_HL] = (regPairs[RP_HL] + 1) & 0xFFFF;
          regPairs[RP_BC] = (regPairs[RP_BC] - 1) & 0xFFFF;
          tstates += (regPairs[RP_BC] && cpir_result !== 0) ? 21 : 16;
        } while (regPairs[RP_BC] && cpir_result !== 0);
        regs[R_F] = (regs[R_F] & FLAG_C) |
                    (regPairs[RP_BC] ? FLAG_P | FLAG_N : FLAG_N) |
                    halfcarrySubTable[cpir_lookup] |
                    (cpir_result ? 0 : FLAG_Z) |
                    (cpir_result & FLAG_S);
        let cpir_n = cpir_result;
        if (regs[R_F] & FLAG_H) cpir_n--;
        regs[R_F] |= (cpir_n & FLAG_X) | ((cpir_n & 0x02) ? FLAG_Y : 0);
        break;
      }

      case 0xB9: { // CPDR - internal loop until match or BC=0
        let cpdr_result = 1, cpdr_lookup = 0;
        do {
          const cpdr_val = readByte(regPairs[RP_HL]);
          cpdr_result = (regs[R_A] - cpdr_val) & 0xFF;
          cpdr_lookup = ((regs[R_A] & 0x08) >> 3) | ((cpdr_val & 0x08) >> 2) | ((cpdr_result & 0x08) >> 1);
          regPairs[RP_HL] = (regPairs[RP_HL] - 1) & 0xFFFF;
          regPairs[RP_BC] = (regPairs[RP_BC] - 1) & 0xFFFF;
          tstates += (regPairs[RP_BC] && cpdr_result !== 0) ? 21 : 16;
        } while (regPairs[RP_BC] && cpdr_result !== 0);
        regs[R_F] = (regs[R_F] & FLAG_C) |
                    (regPairs[RP_BC] ? FLAG_P | FLAG_N : FLAG_N) |
                    halfcarrySubTable[cpdr_lookup] |
                    (cpdr_result ? 0 : FLAG_Z) |
                    (cpdr_result & FLAG_S);
        let cpdr_n = cpdr_result;
        if (regs[R_F] & FLAG_H) cpdr_n--;
        regs[R_F] |= (cpdr_n & FLAG_X) | ((cpdr_n & 0x02) ? FLAG_Y : 0);
        break;
      }

      // I/O block operations
      case 0xA2: { // INI - Input and increment
        const ini_val = portIn ? portIn(regs[R_C]) : 0;
        writeByte(regPairs[RP_HL], ini_val);
        regPairs[RP_HL] = (regPairs[RP_HL] + 1) & 0xFFFF;
        regs[R_B] = (regs[R_B] - 1) & 0xFF;
        regs[R_F] = (regs[R_B] ? 0 : FLAG_Z) | FLAG_N;
        tstates += 16;
        break;
      }

      case 0xAA: { // IND - Input and decrement
        const ind_val = portIn ? portIn(regs[R_C]) : 0;
        writeByte(regPairs[RP_HL], ind_val);
        regPairs[RP_HL] = (regPairs[RP_HL] - 1) & 0xFFFF;
        regs[R_B] = (regs[R_B] - 1) & 0xFF;
        regs[R_F] = (regs[R_B] ? 0 : FLAG_Z) | FLAG_N;
        tstates += 16;
        break;
      }

      case 0xB2: { // INIR - Input, increment and repeat until B=0
        do {
          const inir_val = portIn ? portIn(regs[R_C]) : 0;
          writeByte(regPairs[RP_HL], inir_val);
          regPairs[RP_HL] = (regPairs[RP_HL] + 1) & 0xFFFF;
          regs[R_B] = (regs[R_B] - 1) & 0xFF;
          tstates += regs[R_B] ? 21 : 16;
        } while (regs[R_B]);
        regs[R_F] = FLAG_Z | FLAG_N;
        break;
      }

      case 0xBA: { // INDR - Input, decrement and repeat until B=0
        do {
          const indr_val = portIn ? portIn(regs[R_C]) : 0;
          writeByte(regPairs[RP_HL], indr_val);
          regPairs[RP_HL] = (regPairs[RP_HL] - 1) & 0xFFFF;
          regs[R_B] = (regs[R_B] - 1) & 0xFF;
          tstates += regs[R_B] ? 21 : 16;
        } while (regs[R_B]);
        regs[R_F] = FLAG_Z | FLAG_N;
        break;
      }

      case 0xA3: { // OUTI - Output and increment
        const outi_val = readByte(regPairs[RP_HL]);
        regPairs[RP_HL] = (regPairs[RP_HL] + 1) & 0xFFFF;
        regs[R_B] = (regs[R_B] - 1) & 0xFF;
        if (portOut) portOut(regs[R_C], outi_val);
        regs[R_F] = (regs[R_B] ? 0 : FLAG_Z) | FLAG_N;
        tstates += 16;
        break;
      }

      case 0xAB: { // OUTD - Output and decrement
        const outd_val = readByte(regPairs[RP_HL]);
        regPairs[RP_HL] = (regPairs[RP_HL] - 1) & 0xFFFF;
        regs[R_B] = (regs[R_B] - 1) & 0xFF;
        if (portOut) portOut(regs[R_C], outd_val);
        regs[R_F] = (regs[R_B] ? 0 : FLAG_Z) | FLAG_N;
        tstates += 16;
        break;
      }

      case 0xB3: { // OTIR - Output, increment and repeat until B=0
        do {
          const otir_val = readByte(regPairs[RP_HL]);
          regPairs[RP_HL] = (regPairs[RP_HL] + 1) & 0xFFFF;
          regs[R_B] = (regs[R_B] - 1) & 0xFF;
          if (portOut) portOut(regs[R_C], otir_val);
          tstates += regs[R_B] ? 21 : 16;
        } while (regs[R_B]);
        regs[R_F] = FLAG_Z | FLAG_N;
        break;
      }

      case 0xBB: { // OTDR - Output, decrement and repeat until B=0
        do {
          const otdr_val = readByte(regPairs[RP_HL]);
          regPairs[RP_HL] = (regPairs[RP_HL] - 1) & 0xFFFF;
          regs[R_B] = (regs[R_B] - 1) & 0xFF;
          if (portOut) portOut(regs[R_C], otdr_val);
          tstates += regs[R_B] ? 21 : 16;
        } while (regs[R_B]);
        regs[R_F] = FLAG_Z | FLAG_N;
        break;
      }

      // 16-bit arithmetic
      case 0x4A: { // ADC HL,BC
        const hl = regPairs[RP_HL];
        const bc = regPairs[RP_BC];
        const result = hl + bc + (regs[R_F] & FLAG_C);
        const lookup = ((hl & 0x8800) >> 11) | ((bc & 0x8800) >> 10) | ((result & 0x8800) >> 9);
        regPairs[RP_HL] = result & 0xFFFF;
        regs[R_F] = (result & 0x10000 ? FLAG_C : 0) |
                    (!(regPairs[RP_HL]) ? FLAG_Z : 0) |
                    ((regPairs[RP_HL] >> 8) & (FLAG_S | FLAG_X | FLAG_Y)) |
                    ((lookup >> 4) & FLAG_V) |
                    ((lookup & 0x08) ? FLAG_H : 0);
        tstates += 15;
        break;
      }

      case 0x5A: { // ADC HL,DE
        const hl = regPairs[RP_HL];
        const de = regPairs[RP_DE];
        const result = hl + de + (regs[R_F] & FLAG_C);
        const lookup = ((hl & 0x8800) >> 11) | ((de & 0x8800) >> 10) | ((result & 0x8800) >> 9);
        regPairs[RP_HL] = result & 0xFFFF;
        regs[R_F] = (result & 0x10000 ? FLAG_C : 0) |
                    (!(regPairs[RP_HL]) ? FLAG_Z : 0) |
                    ((regPairs[RP_HL] >> 8) & (FLAG_S | FLAG_X | FLAG_Y)) |
                    ((lookup >> 4) & FLAG_V) |
                    ((lookup & 0x08) ? FLAG_H : 0);
        tstates += 15;
        break;
      }

      case 0x6A: { // ADC HL,HL
        const hl = regPairs[RP_HL];
        const result = hl + hl + (regs[R_F] & FLAG_C);
        const lookup = ((hl & 0x8800) >> 11) | ((hl & 0x8800) >> 10) | ((result & 0x8800) >> 9);
        regPairs[RP_HL] = result & 0xFFFF;
        regs[R_F] = (result & 0x10000 ? FLAG_C : 0) |
                    (!(regPairs[RP_HL]) ? FLAG_Z : 0) |
                    ((regPairs[RP_HL] >> 8) & (FLAG_S | FLAG_X | FLAG_Y)) |
                    ((lookup >> 4) & FLAG_V) |
                    ((lookup & 0x08) ? FLAG_H : 0);
        tstates += 15;
        break;
      }

      case 0x7A: { // ADC HL,SP
        const hl = regPairs[RP_HL];
        const sp = regPairs[RP_SP];
        const result = hl + sp + (regs[R_F] & FLAG_C);
        const lookup = ((hl & 0x8800) >> 11) | ((sp & 0x8800) >> 10) | ((result & 0x8800) >> 9);
        regPairs[RP_HL] = result & 0xFFFF;
        regs[R_F] = (result & 0x10000 ? FLAG_C : 0) |
                    (!(regPairs[RP_HL]) ? FLAG_Z : 0) |
                    ((regPairs[RP_HL] >> 8) & (FLAG_S | FLAG_X | FLAG_Y)) |
                    ((lookup >> 4) & FLAG_V) |
                    ((lookup & 0x08) ? FLAG_H : 0);
        tstates += 15;
        break;
      }

      case 0x42: { // SBC HL,BC
        const hl = regPairs[RP_HL];
        const bc = regPairs[RP_BC];
        const result = hl - bc - (regs[R_F] & FLAG_C);
        const lookup = ((hl & 0x8800) >> 11) | ((bc & 0x8800) >> 10) | ((result & 0x8800) >> 9);
        regPairs[RP_HL] = result & 0xFFFF;
        regs[R_F] = (result & 0x10000 ? FLAG_C : 0) |
                    FLAG_N |
                    (!(regPairs[RP_HL]) ? FLAG_Z : 0) |
                    ((regPairs[RP_HL] >> 8) & (FLAG_S | FLAG_X | FLAG_Y)) |
                    ((lookup >> 4) & FLAG_V) |
                    ((lookup & 0x08) ? FLAG_H : 0);
        tstates += 15;
        break;
      }

      case 0x52: { // SBC HL,DE
        const hl = regPairs[RP_HL];
        const de = regPairs[RP_DE];
        const result = hl - de - (regs[R_F] & FLAG_C);
        const lookup = ((hl & 0x8800) >> 11) | ((de & 0x8800) >> 10) | ((result & 0x8800) >> 9);
        regPairs[RP_HL] = result & 0xFFFF;
        regs[R_F] = (result & 0x10000 ? FLAG_C : 0) |
                    FLAG_N |
                    (!(regPairs[RP_HL]) ? FLAG_Z : 0) |
                    ((regPairs[RP_HL] >> 8) & (FLAG_S | FLAG_X | FLAG_Y)) |
                    ((lookup >> 4) & FLAG_V) |
                    ((lookup & 0x08) ? FLAG_H : 0);
        tstates += 15;
        break;
      }

      case 0x62: { // SBC HL,HL
        const hl = regPairs[RP_HL];
        const result = hl - hl - (regs[R_F] & FLAG_C);
        const lookup = ((hl & 0x8800) >> 11) | ((hl & 0x8800) >> 10) | ((result & 0x8800) >> 9);
        regPairs[RP_HL] = result & 0xFFFF;
        regs[R_F] = (result & 0x10000 ? FLAG_C : 0) |
                    FLAG_N |
                    (!(regPairs[RP_HL]) ? FLAG_Z : 0) |
                    ((regPairs[RP_HL] >> 8) & (FLAG_S | FLAG_X | FLAG_Y)) |
                    ((lookup >> 4) & FLAG_V) |
                    ((lookup & 0x08) ? FLAG_H : 0);
        tstates += 15;
        break;
      }

      case 0x72: { // SBC HL,SP
        const hl = regPairs[RP_HL];
        const sp = regPairs[RP_SP];
        const result = hl - sp - (regs[R_F] & FLAG_C);
        const lookup = ((hl & 0x8800) >> 11) | ((sp & 0x8800) >> 10) | ((result & 0x8800) >> 9);
        regPairs[RP_HL] = result & 0xFFFF;
        regs[R_F] = (result & 0x10000 ? FLAG_C : 0) |
                    FLAG_N |
                    (!(regPairs[RP_HL]) ? FLAG_Z : 0) |
                    ((regPairs[RP_HL] >> 8) & (FLAG_S | FLAG_X | FLAG_Y)) |
                    ((lookup >> 4) & FLAG_V) |
                    ((lookup & 0x08) ? FLAG_H : 0);
        tstates += 15;
        break;
      }

      // NEG
      case 0x44:
      case 0x4C:
      case 0x54:
      case 0x5C:
      case 0x64:
      case 0x6C:
      case 0x74:
      case 0x7C: {
        const value = regs[R_A];
        const result = -value;
        const lookup = ((value & 0x88) >> 2) | ((result & 0x88) >> 1);
        regs[R_A] = result & 0xFF;
        regs[R_F] = (result & 0x100 ? FLAG_C : 0) |
                    FLAG_N |
                    halfcarrySubTable[lookup & 0x07] |
                    overflowSubTable[lookup >> 4] |
                    sz53pTable[regs[R_A]];
        tstates += 8;
        break;
      }

      // Interrupt mode
      case 0x46:
      case 0x4E:
      case 0x66:
      case 0x6E:
        im = 0;
        tstates += 8;
        break;

      case 0x56:
      case 0x76:
        im = 1;
        tstates += 8;
        break;

      case 0x5E:
      case 0x7E:
        im = 2;
        tstates += 8;
        break;

      // RETN/RETI
      case 0x45:
      case 0x55:
      case 0x5D:
      case 0x65:
      case 0x6D:
      case 0x75:
      case 0x7D:
        iff1 = iff2;
        regPairs[RP_PC] = pop();
        tstates += 14;
        break;

      case 0x4D:
        regPairs[RP_PC] = pop();
        tstates += 14;
        break;

      // RRD/RLD
      case 0x67: { // RRD
        const addr = regPairs[RP_HL];
        const value = readByte(addr);
        const temp = value;
        writeByte(addr, ((value >> 4) | (regs[R_A] << 4)) & 0xFF);
        regs[R_A] = (regs[R_A] & 0xF0) | (temp & 0x0F);
        regs[R_F] = (regs[R_F] & FLAG_C) | sz53pTable[regs[R_A]];
        tstates += 18;
        break;
      }

      case 0x6F: { // RLD
        const addr = regPairs[RP_HL];
        const value = readByte(addr);
        const temp = value;
        writeByte(addr, ((value << 4) | (regs[R_A] & 0x0F)) & 0xFF);
        regs[R_A] = (regs[R_A] & 0xF0) | (temp >> 4);
        regs[R_F] = (regs[R_F] & FLAG_C) | sz53pTable[regs[R_A]];
        tstates += 18;
        break;
      }

      // I/O with flags
      case 0x40: // IN B,(C)
        if (portIn) {
          regs[R_B] = portIn(regPairs[RP_BC]) & 0xFF;
          regs[R_F] = (regs[R_F] & FLAG_C) | sz53pTable[regs[R_B]];
        }
        tstates += 12;
        break;

      case 0x48: // IN C,(C)
        if (portIn) {
          regs[R_C] = portIn(regPairs[RP_BC]) & 0xFF;
          regs[R_F] = (regs[R_F] & FLAG_C) | sz53pTable[regs[R_C]];
        }
        tstates += 12;
        break;

      case 0x50: // IN D,(C)
        if (portIn) {
          regs[R_D] = portIn(regPairs[RP_BC]) & 0xFF;
          regs[R_F] = (regs[R_F] & FLAG_C) | sz53pTable[regs[R_D]];
        }
        tstates += 12;
        break;

      case 0x58: // IN E,(C)
        if (portIn) {
          regs[R_E] = portIn(regPairs[RP_BC]) & 0xFF;
          regs[R_F] = (regs[R_F] & FLAG_C) | sz53pTable[regs[R_E]];
        }
        tstates += 12;
        break;

      case 0x60: // IN H,(C)
        if (portIn) {
          regs[R_H] = portIn(regPairs[RP_BC]) & 0xFF;
          regs[R_F] = (regs[R_F] & FLAG_C) | sz53pTable[regs[R_H]];
        }
        tstates += 12;
        break;

      case 0x68: // IN L,(C)
        if (portIn) {
          regs[R_L] = portIn(regPairs[RP_BC]) & 0xFF;
          regs[R_F] = (regs[R_F] & FLAG_C) | sz53pTable[regs[R_L]];
        }
        tstates += 12;
        break;

      case 0x70: // IN F,(C) - undocumented
        if (portIn) {
          const temp = portIn(regPairs[RP_BC]) & 0xFF;
          regs[R_F] = (regs[R_F] & FLAG_C) | sz53pTable[temp];
        }
        tstates += 12;
        break;

      case 0x78: // IN A,(C)
        if (portIn) {
          regs[R_A] = portIn(regPairs[RP_BC]) & 0xFF;
          regs[R_F] = (regs[R_F] & FLAG_C) | sz53pTable[regs[R_A]];
        }
        tstates += 12;
        break;

      case 0x41: // OUT (C),B
        if (portOut) portOut(regPairs[RP_BC], regs[R_B]);
        tstates += 12;
        break;

      case 0x49: // OUT (C),C
        if (portOut) portOut(regPairs[RP_BC], regs[R_C]);
        tstates += 12;
        break;

      case 0x51: // OUT (C),D
        if (portOut) portOut(regPairs[RP_BC], regs[R_D]);
        tstates += 12;
        break;

      case 0x59: // OUT (C),E
        if (portOut) portOut(regPairs[RP_BC], regs[R_E]);
        tstates += 12;
        break;

      case 0x61: // OUT (C),H
        if (portOut) portOut(regPairs[RP_BC], regs[R_H]);
        tstates += 12;
        break;

      case 0x69: // OUT (C),L
        if (portOut) portOut(regPairs[RP_BC], regs[R_L]);
        tstates += 12;
        break;

      case 0x71: // OUT (C),0 - undocumented
        if (portOut) portOut(regPairs[RP_BC], 0);
        tstates += 12;
        break;

      case 0x79: // OUT (C),A
        if (portOut) portOut(regPairs[RP_BC], regs[R_A]);
        tstates += 12;
        break;

      // LD I/R,A and LD A,I/R
      case 0x47:
        regs[R_I] = regs[R_A];
        tstates += 9;
        break;

      case 0x4F:
        regs[R_R] = regs[R_A];
        tstates += 9;
        break;

      case 0x57:
        regs[R_A] = regs[R_I];
        regs[R_F] = (regs[R_F] & FLAG_C) |
                    sz53pTable[regs[R_A]] |
                    (iff2 ? FLAG_P : 0);
        tstates += 9;
        break;

      case 0x5F:
        regs[R_A] = regs[R_R];
        regs[R_F] = (regs[R_F] & FLAG_C) |
                    sz53pTable[regs[R_A]] |
                    (iff2 ? FLAG_P : 0);
        tstates += 9;
        break;

      // 16-bit loads with immediate address
      case 0x43: { // LD (nn),BC
        const addr = fetchWord();
        writeWord(addr, regPairs[RP_BC]);
        tstates += 20;
        break;
      }

      case 0x53: { // LD (nn),DE
        const addr = fetchWord();
        writeWord(addr, regPairs[RP_DE]);
        tstates += 20;
        break;
      }

      case 0x63: { // LD (nn),HL
        const addr = fetchWord();
        writeWord(addr, regPairs[RP_HL]);
        tstates += 20;
        break;
      }

      case 0x73: { // LD (nn),SP
        const addr = fetchWord();
        writeWord(addr, regPairs[RP_SP]);
        tstates += 20;
        break;
      }

      case 0x4B: { // LD BC,(nn)
        const addr = fetchWord();
        regPairs[RP_BC] = readWord(addr);
        tstates += 20;
        break;
      }

      case 0x5B: { // LD DE,(nn)
        const addr = fetchWord();
        regPairs[RP_DE] = readWord(addr);
        tstates += 20;
        break;
      }

      case 0x6B: { // LD HL,(nn)
        const addr = fetchWord();
        regPairs[RP_HL] = readWord(addr);
        tstates += 20;
        break;
      }

      case 0x7B: { // LD SP,(nn)
        const addr = fetchWord();
        regPairs[RP_SP] = readWord(addr);
        tstates += 20;
        break;
      }

      default:
        // NOP for unimplemented ED instructions
        tstates += 8;
        break;
    }
  };

  /**
   * Execute DD/FD-prefixed instruction (IX/IY indexed)
   */
  const executeIndexedInstruction = (isIX) => {
    const opcode = fetchByte();
    const rpIndex = isIX ? RP_IX : RP_IY;

    // DD/FD CB instructions need special handling
    if (opcode === 0xCB) {
      const offset = fetchByte();
      const signedOffset = (offset & 0x80) ? offset - 0x100 : offset;
      const cbOpcode = fetchByte();
      const addr = (regPairs[rpIndex] + signedOffset) & 0xFFFF;

      const bit = (cbOpcode >> 3) & 0x07;
      let value = readByte(addr);

      if (cbOpcode < 0x40) {
        // Shifts and rotates
        if (cbOpcode < 0x08) {
          value = ((value << 1) | (value >> 7)) & 0xFF;
          regs[R_F] = (value & FLAG_C) | sz53pTable[value];
        } else if (cbOpcode < 0x10) {
          regs[R_F] = value & FLAG_C;
          value = ((value >> 1) | (value << 7)) & 0xFF;
          regs[R_F] |= sz53pTable[value];
        } else if (cbOpcode < 0x18) {
          const carry = regs[R_F] & FLAG_C;
          regs[R_F] = value >> 7;
          value = ((value << 1) | carry) & 0xFF;
          regs[R_F] |= sz53pTable[value];
        } else if (cbOpcode < 0x20) {
          const carry = regs[R_F] & FLAG_C;
          regs[R_F] = value & FLAG_C;
          value = ((value >> 1) | (carry << 7)) & 0xFF;
          regs[R_F] |= sz53pTable[value];
        } else if (cbOpcode < 0x28) {
          regs[R_F] = value >> 7;
          value = (value << 1) & 0xFF;
          regs[R_F] |= sz53pTable[value];
        } else if (cbOpcode < 0x30) {
          regs[R_F] = value & FLAG_C;
          value = ((value & 0x80) | (value >> 1)) & 0xFF;
          regs[R_F] |= sz53pTable[value];
        } else if (cbOpcode < 0x38) {
          regs[R_F] = value >> 7;
          value = ((value << 1) | 0x01) & 0xFF;
          regs[R_F] |= sz53pTable[value];
        } else {
          regs[R_F] = value & FLAG_C;
          value >>= 1;
          regs[R_F] |= sz53pTable[value];
        }
        writeByte(addr, value);
        tstates += 23;
      } else if (cbOpcode < 0x80) {
        // BIT n,(IX/IY+d)
        regs[R_F] = (regs[R_F] & FLAG_C) | FLAG_H | (value & (FLAG_X | FLAG_Y));
        if (!(value & (1 << bit))) {
          regs[R_F] |= FLAG_P | FLAG_Z;
        }
        if (bit === 7 && (value & 0x80)) {
          regs[R_F] |= FLAG_S;
        }
        tstates += 20;
      } else if (cbOpcode < 0xC0) {
        // RES n,(IX/IY+d)
        value &= ~(1 << bit);
        writeByte(addr, value);
        tstates += 23;
      } else {
        // SET n,(IX/IY+d)
        value |= (1 << bit);
        writeByte(addr, value);
        tstates += 23;
      }
      return;
    }

    // Regular DD/FD instructions
    // Most instructions mirror base opcodes but use IX/IY instead of HL
    switch (opcode) {
      case 0x09: // ADD IX/IY,BC
        {
          const result = regPairs[rpIndex] + regPairs[RP_BC];
          regs[R_F] = (regs[R_F] & (FLAG_S | FLAG_Z | FLAG_P)) |
                      (result & 0x10000 ? FLAG_C : 0) |
                      (((regPairs[rpIndex] & 0x0FFF) + (regPairs[RP_BC] & 0x0FFF)) & 0x1000 ? FLAG_H : 0) |
                      ((result >> 8) & (FLAG_X | FLAG_Y));
          regPairs[rpIndex] = result & 0xFFFF;
          tstates += 15;
        }
        break;

      case 0x19: // ADD IX/IY,DE
        {
          const result = regPairs[rpIndex] + regPairs[RP_DE];
          regs[R_F] = (regs[R_F] & (FLAG_S | FLAG_Z | FLAG_P)) |
                      (result & 0x10000 ? FLAG_C : 0) |
                      (((regPairs[rpIndex] & 0x0FFF) + (regPairs[RP_DE] & 0x0FFF)) & 0x1000 ? FLAG_H : 0) |
                      ((result >> 8) & (FLAG_X | FLAG_Y));
          regPairs[rpIndex] = result & 0xFFFF;
          tstates += 15;
        }
        break;

      case 0x21: // LD IX/IY,nn
        regPairs[rpIndex] = fetchWord();
        tstates += 14;
        break;

      case 0x22: { // LD (nn),IX/IY
        const addr = fetchWord();
        writeWord(addr, regPairs[rpIndex]);
        tstates += 20;
        break;
      }

      case 0x23: // INC IX/IY
        regPairs[rpIndex] = (regPairs[rpIndex] + 1) & 0xFFFF;
        tstates += 10;
        break;

      case 0x29: // ADD IX/IY,IX/IY
        {
          const result = regPairs[rpIndex] + regPairs[rpIndex];
          regs[R_F] = (regs[R_F] & (FLAG_S | FLAG_Z | FLAG_P)) |
                      (result & 0x10000 ? FLAG_C : 0) |
                      (((regPairs[rpIndex] & 0x0FFF) + (regPairs[rpIndex] & 0x0FFF)) & 0x1000 ? FLAG_H : 0) |
                      ((result >> 8) & (FLAG_X | FLAG_Y));
          regPairs[rpIndex] = result & 0xFFFF;
          tstates += 15;
        }
        break;

      case 0x2A: { // LD IX/IY,(nn)
        const addr = fetchWord();
        regPairs[rpIndex] = readWord(addr);
        tstates += 20;
        break;
      }

      case 0x2B: // DEC IX/IY
        regPairs[rpIndex] = (regPairs[rpIndex] - 1) & 0xFFFF;
        tstates += 10;
        break;

      case 0x34: { // INC (IX/IY+d)
        const offset = fetchByte();
        const signedOffset = (offset & 0x80) ? offset - 0x100 : offset;
        const addr = (regPairs[rpIndex] + signedOffset) & 0xFFFF;
        const value = readByte(addr);
        const result = (value + 1) & 0xFF;
        writeByte(addr, result);
        regs[R_F] = (regs[R_F] & FLAG_C) |
                    sz53Table[result] |
                    ((value & 0x0F) === 0x0F ? FLAG_H : 0) |
                    ((value === 0x7F) ? FLAG_V : 0);
        regs[R_F] &= ~FLAG_N;
        tstates += 23;
        break;
      }

      case 0x35: { // DEC (IX/IY+d)
        const offset = fetchByte();
        const signedOffset = (offset & 0x80) ? offset - 0x100 : offset;
        const addr = (regPairs[rpIndex] + signedOffset) & 0xFFFF;
        const value = readByte(addr);
        const result = (value - 1) & 0xFF;
        writeByte(addr, result);
        regs[R_F] = (regs[R_F] & FLAG_C) |
                    sz53Table[result] |
                    FLAG_N |
                    ((value & 0x0F) === 0 ? FLAG_H : 0) |
                    ((value === 0x80) ? FLAG_V : 0);
        tstates += 23;
        break;
      }

      case 0x36: { // LD (IX/IY+d),n
        const offset = fetchByte();
        const signedOffset = (offset & 0x80) ? offset - 0x100 : offset;
        const value = fetchByte();
        const addr = (regPairs[rpIndex] + signedOffset) & 0xFFFF;
        writeByte(addr, value);
        tstates += 19;
        break;
      }

      case 0x39: // ADD IX/IY,SP
        {
          const result = regPairs[rpIndex] + regPairs[RP_SP];
          regs[R_F] = (regs[R_F] & (FLAG_S | FLAG_Z | FLAG_P)) |
                      (result & 0x10000 ? FLAG_C : 0) |
                      (((regPairs[rpIndex] & 0x0FFF) + (regPairs[RP_SP] & 0x0FFF)) & 0x1000 ? FLAG_H : 0) |
                      ((result >> 8) & (FLAG_X | FLAG_Y));
          regPairs[rpIndex] = result & 0xFFFF;
          tstates += 15;
        }
        break;

      // LD r,(IX/IY+d) and LD (IX/IY+d),r instructions
      case 0x46: case 0x4E: case 0x56: case 0x5E:
      case 0x66: case 0x6E: case 0x7E: {
        const offset = fetchByte();
        const signedOffset = (offset & 0x80) ? offset - 0x100 : offset;
        const addr = (regPairs[rpIndex] + signedOffset) & 0xFFFF;
        const value = readByte(addr);
        const reg = (opcode >> 3) & 0x07;
        switch (reg) {
          case 0: regs[R_B] = value; break;
          case 1: regs[R_C] = value; break;
          case 2: regs[R_D] = value; break;
          case 3: regs[R_E] = value; break;
          case 4: regs[R_H] = value; break;
          case 5: regs[R_L] = value; break;
          case 7: regs[R_A] = value; break;
        }
        tstates += 19;
        break;
      }

      case 0x70: case 0x71: case 0x72: case 0x73:
      case 0x74: case 0x75: case 0x77: {
        const offset = fetchByte();
        const signedOffset = (offset & 0x80) ? offset - 0x100 : offset;
        const addr = (regPairs[rpIndex] + signedOffset) & 0xFFFF;
        const reg = opcode & 0x07;
        let value;
        switch (reg) {
          case 0: value = regs[R_B]; break;
          case 1: value = regs[R_C]; break;
          case 2: value = regs[R_D]; break;
          case 3: value = regs[R_E]; break;
          case 4: value = regs[R_H]; break;
          case 5: value = regs[R_L]; break;
          case 7: value = regs[R_A]; break;
        }
        writeByte(addr, value);
        tstates += 19;
        break;
      }

      // Arithmetic with (IX/IY+d)
      case 0x86: { // ADD A,(IX/IY+d)
        const offset = fetchByte();
        const signedOffset = (offset & 0x80) ? offset - 0x100 : offset;
        const addr = (regPairs[rpIndex] + signedOffset) & 0xFFFF;
        const value = readByte(addr);
        const result = regs[R_A] + value;
        const lookup = ((regs[R_A] & 0x88) >> 3) | ((value & 0x88) >> 2) | ((result & 0x88) >> 1);
        regs[R_A] = result & 0xFF;
        regs[R_F] = (result & 0x100 ? FLAG_C : 0) |
                    halfcarryAddTable[lookup & 0x07] |
                    overflowAddTable[lookup >> 4] |
                    sz53pTable[regs[R_A]];
        tstates += 19;
        break;
      }

      case 0x8E: { // ADC A,(IX/IY+d)
        const offset = fetchByte();
        const signedOffset = (offset & 0x80) ? offset - 0x100 : offset;
        const addr = (regPairs[rpIndex] + signedOffset) & 0xFFFF;
        const value = readByte(addr);
        const result = regs[R_A] + value + (regs[R_F] & FLAG_C);
        const lookup = ((regs[R_A] & 0x88) >> 3) | ((value & 0x88) >> 2) | ((result & 0x88) >> 1);
        regs[R_A] = result & 0xFF;
        regs[R_F] = (result & 0x100 ? FLAG_C : 0) |
                    halfcarryAddTable[lookup & 0x07] |
                    overflowAddTable[lookup >> 4] |
                    sz53pTable[regs[R_A]];
        tstates += 19;
        break;
      }

      case 0x96: { // SUB (IX/IY+d)
        const offset = fetchByte();
        const signedOffset = (offset & 0x80) ? offset - 0x100 : offset;
        const addr = (regPairs[rpIndex] + signedOffset) & 0xFFFF;
        const value = readByte(addr);
        const result = regs[R_A] - value;
        const lookup = ((regs[R_A] & 0x88) >> 3) | ((value & 0x88) >> 2) | ((result & 0x88) >> 1);
        regs[R_A] = result & 0xFF;
        regs[R_F] = (result & 0x100 ? FLAG_C : 0) |
                    FLAG_N |
                    halfcarrySubTable[lookup & 0x07] |
                    overflowSubTable[lookup >> 4] |
                    sz53pTable[regs[R_A]];
        tstates += 19;
        break;
      }

      case 0x9E: { // SBC A,(IX/IY+d)
        const offset = fetchByte();
        const signedOffset = (offset & 0x80) ? offset - 0x100 : offset;
        const addr = (regPairs[rpIndex] + signedOffset) & 0xFFFF;
        const value = readByte(addr);
        const result = regs[R_A] - value - (regs[R_F] & FLAG_C);
        const lookup = ((regs[R_A] & 0x88) >> 3) | ((value & 0x88) >> 2) | ((result & 0x88) >> 1);
        regs[R_A] = result & 0xFF;
        regs[R_F] = (result & 0x100 ? FLAG_C : 0) |
                    FLAG_N |
                    halfcarrySubTable[lookup & 0x07] |
                    overflowSubTable[lookup >> 4] |
                    sz53pTable[regs[R_A]];
        tstates += 19;
        break;
      }

      case 0xA6: { // AND (IX/IY+d)
        const offset = fetchByte();
        const signedOffset = (offset & 0x80) ? offset - 0x100 : offset;
        const addr = (regPairs[rpIndex] + signedOffset) & 0xFFFF;
        const value = readByte(addr);
        regs[R_A] &= value;
        regs[R_F] = FLAG_H | sz53pTable[regs[R_A]];
        tstates += 19;
        break;
      }

      case 0xAE: { // XOR (IX/IY+d)
        const offset = fetchByte();
        const signedOffset = (offset & 0x80) ? offset - 0x100 : offset;
        const addr = (regPairs[rpIndex] + signedOffset) & 0xFFFF;
        const value = readByte(addr);
        regs[R_A] ^= value;
        regs[R_F] = sz53pTable[regs[R_A]];
        tstates += 19;
        break;
      }

      case 0xB6: { // OR (IX/IY+d)
        const offset = fetchByte();
        const signedOffset = (offset & 0x80) ? offset - 0x100 : offset;
        const addr = (regPairs[rpIndex] + signedOffset) & 0xFFFF;
        const value = readByte(addr);
        regs[R_A] |= value;
        regs[R_F] = sz53pTable[regs[R_A]];
        tstates += 19;
        break;
      }

      case 0xBE: { // CP (IX/IY+d)
        const offset = fetchByte();
        const signedOffset = (offset & 0x80) ? offset - 0x100 : offset;
        const addr = (regPairs[rpIndex] + signedOffset) & 0xFFFF;
        const value = readByte(addr);
        const result = regs[R_A] - value;
        const lookup = ((regs[R_A] & 0x88) >> 3) | ((value & 0x88) >> 2) | ((result & 0x88) >> 1);
        regs[R_F] = (result & 0x100 ? FLAG_C : 0) |
                    FLAG_N |
                    halfcarrySubTable[lookup & 0x07] |
                    overflowSubTable[lookup >> 4] |
                    (value & (FLAG_X | FLAG_Y)) |
                    ((result & 0xFF) ? (result & FLAG_S) : FLAG_Z);
        tstates += 19;
        break;
      }

      case 0xE1: // POP IX/IY
        regPairs[rpIndex] = pop();
        tstates += 14;
        break;

      case 0xE3: { // EX (SP),IX/IY
        const temp = readWord(regPairs[RP_SP]);
        writeWord(regPairs[RP_SP], regPairs[rpIndex]);
        regPairs[rpIndex] = temp;
        tstates += 23;
        break;
      }

      case 0xE5: // PUSH IX/IY
        push(regPairs[rpIndex]);
        tstates += 15;
        break;

      case 0xE9: // JP (IX/IY)
        regPairs[RP_PC] = regPairs[rpIndex];
        tstates += 8;
        break;

      case 0xF9: // LD SP,IX/IY
        regPairs[RP_SP] = regPairs[rpIndex];
        tstates += 10;
        break;

      default:
        // For opcodes that don't use the index register, execute as normal
        // but the prefix has already consumed 4 T-states
        regPairs[RP_PC] = (regPairs[RP_PC] - 1) & 0xFFFF;
        executeInstruction();
        break;
    }
  };

  /**
   * Execute one instruction
   */
  const executeInstruction = () => {
    const opcode = fetchByte();
    // Update R register (auto-increment on each opcode fetch, not operand fetch)
    regs[R_R] = ((regs[R_R] + 1) & 0x7F) | (regs[R_R] & 0x80);

    // LD r,r' instructions (0x40-0x7F): generic register-to-register loads
    if (opcode >= 0x40 && opcode <= 0x7F) {
      if (opcode === 0x76) {
        halted = true;
        regPairs[RP_PC] = (regPairs[RP_PC] - 1) & 0xFFFF; // Stay on HALT
        tstates += 4;
      } else {
        const dst = (opcode >> 3) & 7, src = opcode & 7;
        setReg(dst, getReg(src));
        tstates += (src === 6 || dst === 6) ? 7 : 4;
      }
      return;
    }

    // ALU operations (0x80-0xBF): ADD,ADC,SUB,SBC,AND,XOR,OR,CP
    if (opcode >= 0x80 && opcode <= 0xBF) {
      const op = (opcode >> 3) & 7, src = opcode & 7;
      Z80_ALU[op](getReg(src));
      tstates += src === 6 ? 7 : 4;
      return;
    }

    // Decode and execute based on opcode
    switch (opcode) {
      case 0x00: // NOP
        tstates += 4;
        break;

      case 0x01: // LD BC,nn
        regPairs[RP_BC] = fetchWord();
        tstates += 10;
        break;

      case 0x02: // LD (BC),A
        writeByte(regPairs[RP_BC], regs[R_A]);
        tstates += 7;
        break;

      case 0x03: // INC BC
        regPairs[RP_BC] = (regPairs[RP_BC] + 1) & 0xFFFF;
        tstates += 6;
        break;

      case 0x04: { // INC B
        const val = regs[R_B];
        const result = (val + 1) & 0xFF;
        regs[R_B] = result;
        regs[R_F] = (regs[R_F] & FLAG_C) | // Preserve carry
                    sz53Table[result] |
                    ((val & 0x0F) === 0x0F ? FLAG_H : 0) |
                    ((val === 0x7F) ? FLAG_V : 0);
        regs[R_F] &= ~FLAG_N; // Clear N
        tstates += 4;
        break;
      }

      case 0x05: { // DEC B
        const val = regs[R_B];
        const result = (val - 1) & 0xFF;
        regs[R_B] = result;
        regs[R_F] = (regs[R_F] & FLAG_C) | // Preserve carry
                    sz53Table[result] |
                    FLAG_N |
                    ((val & 0x0F) === 0 ? FLAG_H : 0) |
                    ((val === 0x80) ? FLAG_V : 0);
        tstates += 4;
        break;
      }

      case 0x06: // LD B,n
        regs[R_B] = fetchByte();
        tstates += 7;
        break;

      case 0x07: { // RLCA
        const carry = regs[R_A] & 0x80;
        regs[R_A] = ((regs[R_A] << 1) | (carry ? 1 : 0)) & 0xFF;
        regs[R_F] = (regs[R_F] & (FLAG_S | FLAG_Z | FLAG_P)) |
                    (carry ? FLAG_C : 0) |
                    (regs[R_A] & (FLAG_Y | FLAG_X));
        tstates += 4;
        break;
      }

      case 0x08: { // EX AF,AF'
        const temp = regPairs[RP_AF];
        regPairs[RP_AF] = regPairs[RP_AF_];
        regPairs[RP_AF_] = temp;
        tstates += 4;
        break;
      }

      case 0x09: { // ADD HL,BC
        const hl = regPairs[RP_HL];
        const bc = regPairs[RP_BC];
        const result = (hl + bc) & 0xFFFF;
        regPairs[RP_HL] = result;
        regs[R_F] = (regs[R_F] & (FLAG_S | FLAG_Z | FLAG_P)) |
                    (((hl ^ bc ^ result) >> 8) & FLAG_H) |
                    ((result >> 8) & (FLAG_Y | FLAG_X)) |
                    ((result < hl) ? FLAG_C : 0);
        regs[R_F] &= ~FLAG_N;
        tstates += 11;
        break;
      }

      case 0x0A: // LD A,(BC)
        regs[R_A] = readByte(regPairs[RP_BC]);
        tstates += 7;
        break;

      case 0x0B: // DEC BC
        regPairs[RP_BC] = (regPairs[RP_BC] - 1) & 0xFFFF;
        tstates += 6;
        break;

      case 0x0C: { // INC C
        const val = regs[R_C];
        const result = (val + 1) & 0xFF;
        regs[R_C] = result;
        regs[R_F] = (regs[R_F] & FLAG_C) |
                    sz53Table[result] |
                    ((val & 0x0F) === 0x0F ? FLAG_H : 0) |
                    ((val === 0x7F) ? FLAG_V : 0);
        regs[R_F] &= ~FLAG_N;
        tstates += 4;
        break;
      }

      case 0x0D: { // DEC C
        const val = regs[R_C];
        const result = (val - 1) & 0xFF;
        regs[R_C] = result;
        regs[R_F] = (regs[R_F] & FLAG_C) |
                    sz53Table[result] |
                    FLAG_N |
                    ((val & 0x0F) === 0 ? FLAG_H : 0) |
                    ((val === 0x80) ? FLAG_V : 0);
        tstates += 4;
        break;
      }

      case 0x0E: // LD C,n
        regs[R_C] = fetchByte();
        tstates += 7;
        break;

      case 0x0F: { // RRCA
        const carry = regs[R_A] & 0x01;
        regs[R_A] = ((regs[R_A] >> 1) | (carry ? 0x80 : 0)) & 0xFF;
        regs[R_F] = (regs[R_F] & (FLAG_S | FLAG_Z | FLAG_P)) |
                    (carry ? FLAG_C : 0) |
                    (regs[R_A] & (FLAG_Y | FLAG_X));
        tstates += 4;
        break;
      }

      case 0x10: { // DJNZ n (Decrement B and Jump if Not Zero)
        regs[R_B] = (regs[R_B] - 1) & 0xFF;
        tstates += 1;
        if (regs[R_B]) {
          const offset = fetchByte();
          tstates += 12;
          regPairs[RP_PC] = (regPairs[RP_PC] + (offset & 0x80 ? offset - 0x100 : offset)) & 0xFFFF;
        } else {
          regPairs[RP_PC] = (regPairs[RP_PC] + 1) & 0xFFFF;
          tstates += 8;
        }
        break;
      }

      case 0x11: // LD DE,nn
        regPairs[RP_DE] = fetchWord();
        tstates += 10;
        break;

      case 0x12: // LD (DE),A
        writeByte(regPairs[RP_DE], regs[R_A]);
        tstates += 7;
        break;

      case 0x13: // INC DE
        regPairs[RP_DE] = (regPairs[RP_DE] + 1) & 0xFFFF;
        tstates += 6;
        break;

      case 0x14: { // INC D
        const val = regs[R_D];
        const result = (val + 1) & 0xFF;
        regs[R_D] = result;
        regs[R_F] = (regs[R_F] & FLAG_C) |
                    sz53Table[result] |
                    ((val & 0x0F) === 0x0F ? FLAG_H : 0) |
                    ((val === 0x7F) ? FLAG_V : 0);
        regs[R_F] &= ~FLAG_N;
        tstates += 4;
        break;
      }

      case 0x15: { // DEC D
        const val = regs[R_D];
        const result = (val - 1) & 0xFF;
        regs[R_D] = result;
        regs[R_F] = (regs[R_F] & FLAG_C) |
                    sz53Table[result] |
                    FLAG_N |
                    ((val & 0x0F) === 0 ? FLAG_H : 0) |
                    ((val === 0x80) ? FLAG_V : 0);
        tstates += 4;
        break;
      }

      case 0x16: // LD D,n
        regs[R_D] = fetchByte();
        tstates += 7;
        break;

      case 0x17: { // RLA
        const carry = regs[R_F] & FLAG_C;
        const newCarry = (regs[R_A] & 0x80) ? FLAG_C : 0;
        regs[R_A] = ((regs[R_A] << 1) | (carry ? 1 : 0)) & 0xFF;
        regs[R_F] = (regs[R_F] & (FLAG_S | FLAG_Z | FLAG_P)) |
                    newCarry |
                    (regs[R_A] & (FLAG_Y | FLAG_X));
        tstates += 4;
        break;
      }

      case 0x18: { // JR n
        const offset = fetchByte();
        tstates += 12;
        regPairs[RP_PC] = (regPairs[RP_PC] + (offset & 0x80 ? offset - 0x100 : offset)) & 0xFFFF;
        break;
      }

      case 0x19: { // ADD HL,DE
        const hl = regPairs[RP_HL];
        const de = regPairs[RP_DE];
        const result = (hl + de) & 0xFFFF;
        regPairs[RP_HL] = result;
        regs[R_F] = (regs[R_F] & (FLAG_S | FLAG_Z | FLAG_P)) |
                    (((hl ^ de ^ result) >> 8) & FLAG_H) |
                    ((result >> 8) & (FLAG_Y | FLAG_X)) |
                    ((hl + de > 0xFFFF) ? FLAG_C : 0);
        regs[R_F] &= ~FLAG_N;
        tstates += 11;
        break;
      }

      case 0x1A: // LD A,(DE)
        regs[R_A] = readByte(regPairs[RP_DE]);
        tstates += 7;
        break;

      case 0x1B: // DEC DE
        regPairs[RP_DE] = (regPairs[RP_DE] - 1) & 0xFFFF;
        tstates += 6;
        break;

      case 0x1C: { // INC E
        const val = regs[R_E];
        const result = (val + 1) & 0xFF;
        regs[R_E] = result;
        regs[R_F] = (regs[R_F] & FLAG_C) |
                    sz53Table[result] |
                    ((val & 0x0F) === 0x0F ? FLAG_H : 0) |
                    ((val === 0x7F) ? FLAG_V : 0);
        regs[R_F] &= ~FLAG_N;
        tstates += 4;
        break;
      }

      case 0x1D: { // DEC E
        const val = regs[R_E];
        const result = (val - 1) & 0xFF;
        regs[R_E] = result;
        regs[R_F] = (regs[R_F] & FLAG_C) |
                    sz53Table[result] |
                    FLAG_N |
                    ((val & 0x0F) === 0 ? FLAG_H : 0) |
                    ((val === 0x80) ? FLAG_V : 0);
        tstates += 4;
        break;
      }

      case 0x1E: // LD E,n
        regs[R_E] = fetchByte();
        tstates += 7;
        break;

      case 0x1F: { // RRA
        const carry = regs[R_F] & FLAG_C;
        const newCarry = (regs[R_A] & 0x01) ? FLAG_C : 0;
        regs[R_A] = ((regs[R_A] >> 1) | (carry ? 0x80 : 0)) & 0xFF;
        regs[R_F] = (regs[R_F] & (FLAG_S | FLAG_Z | FLAG_P)) |
                    newCarry |
                    (regs[R_A] & (FLAG_Y | FLAG_X));
        tstates += 4;
        break;
      }

      case 0x20: { // JR NZ,n
        const offset = fetchByte();
        if (!(regs[R_F] & FLAG_Z)) {
          tstates += 12;
          regPairs[RP_PC] = (regPairs[RP_PC] + (offset & 0x80 ? offset - 0x100 : offset)) & 0xFFFF;
        } else {
          tstates += 7;
        }
        break;
      }

      case 0x21: // LD HL,nn
        regPairs[RP_HL] = fetchWord();
        tstates += 10;
        break;

      case 0x22: { // LD (nn),HL
        const addr = fetchWord();
        writeWord(addr, regPairs[RP_HL]);
        tstates += 16;
        break;
      }

      case 0x23: // INC HL
        regPairs[RP_HL] = (regPairs[RP_HL] + 1) & 0xFFFF;
        tstates += 6;
        break;

      case 0x24: { // INC H
        const val = regs[R_H];
        const result = (val + 1) & 0xFF;
        regs[R_H] = result;
        regs[R_F] = (regs[R_F] & FLAG_C) |
                    sz53Table[result] |
                    ((val & 0x0F) === 0x0F ? FLAG_H : 0) |
                    ((val === 0x7F) ? FLAG_V : 0);
        regs[R_F] &= ~FLAG_N;
        tstates += 4;
        break;
      }

      case 0x25: { // DEC H
        const val = regs[R_H];
        const result = (val - 1) & 0xFF;
        regs[R_H] = result;
        regs[R_F] = (regs[R_F] & FLAG_C) |
                    sz53Table[result] |
                    FLAG_N |
                    ((val & 0x0F) === 0 ? FLAG_H : 0) |
                    ((val === 0x80) ? FLAG_V : 0);
        tstates += 4;
        break;
      }

      case 0x26: // LD H,n
        regs[R_H] = fetchByte();
        tstates += 7;
        break;

      case 0x27: { // DAA (Decimal Adjust Accumulator)
        let add = 0;
        let carry = regs[R_F] & FLAG_C;
        if ((regs[R_F] & FLAG_H) || ((regs[R_A] & 0x0F) > 9)) {
          add = 6;
        }
        if (carry || (regs[R_A] > 0x99)) {
          add |= 0x60;
        }
        if (regs[R_A] > 0x99) {
          carry = FLAG_C;
        }
        if (regs[R_F] & FLAG_N) {
          regs[R_A] = (regs[R_A] - add) & 0xFF;
        } else {
          regs[R_A] = (regs[R_A] + add) & 0xFF;
        }
        regs[R_F] = (regs[R_F] & FLAG_N) | carry | sz53pTable[regs[R_A]] | parityTable[regs[R_A]];
        tstates += 4;
        break;
      }

      case 0x28: { // JR Z,n
        const offset = fetchByte();
        if (regs[R_F] & FLAG_Z) {
          tstates += 12;
          regPairs[RP_PC] = (regPairs[RP_PC] + (offset & 0x80 ? offset - 0x100 : offset)) & 0xFFFF;
        } else {
          tstates += 7;
        }
        break;
      }

      case 0x29: { // ADD HL,HL
        const hl = regPairs[RP_HL];
        const result = (hl + hl) & 0xFFFF;
        regPairs[RP_HL] = result;
        regs[R_F] = (regs[R_F] & (FLAG_S | FLAG_Z | FLAG_P)) |
                    (((hl ^ hl ^ result) >> 8) & FLAG_H) |
                    ((result >> 8) & (FLAG_Y | FLAG_X)) |
                    ((hl + hl > 0xFFFF) ? FLAG_C : 0);
        regs[R_F] &= ~FLAG_N;
        tstates += 11;
        break;
      }

      case 0x2A: { // LD HL,(nn)
        const addr = fetchWord();
        regPairs[RP_HL] = readWord(addr);
        tstates += 16;
        break;
      }

      case 0x2B: // DEC HL
        regPairs[RP_HL] = (regPairs[RP_HL] - 1) & 0xFFFF;
        tstates += 6;
        break;

      case 0x2C: { // INC L
        const val = regs[R_L];
        const result = (val + 1) & 0xFF;
        regs[R_L] = result;
        regs[R_F] = (regs[R_F] & FLAG_C) |
                    sz53Table[result] |
                    ((val & 0x0F) === 0x0F ? FLAG_H : 0) |
                    ((val === 0x7F) ? FLAG_V : 0);
        regs[R_F] &= ~FLAG_N;
        tstates += 4;
        break;
      }

      case 0x2D: { // DEC L
        const val = regs[R_L];
        const result = (val - 1) & 0xFF;
        regs[R_L] = result;
        regs[R_F] = (regs[R_F] & FLAG_C) |
                    sz53Table[result] |
                    FLAG_N |
                    ((val & 0x0F) === 0 ? FLAG_H : 0) |
                    ((val === 0x80) ? FLAG_V : 0);
        tstates += 4;
        break;
      }

      case 0x2E: // LD L,n
        regs[R_L] = fetchByte();
        tstates += 7;
        break;

      case 0x2F: // CPL (Complement Accumulator)
        regs[R_A] ^= 0xFF;
        regs[R_F] = (regs[R_F] & (FLAG_C | FLAG_P | FLAG_Z | FLAG_S)) |
                    (regs[R_A] & (FLAG_Y | FLAG_X)) |
                    (FLAG_N | FLAG_H);
        tstates += 4;
        break;

      case 0x30: { // JR NC,n
        const offset = fetchByte();
        if (!(regs[R_F] & FLAG_C)) {
          tstates += 12;
          regPairs[RP_PC] = (regPairs[RP_PC] + (offset & 0x80 ? offset - 0x100 : offset)) & 0xFFFF;
        } else {
          tstates += 7;
        }
        break;
      }

      case 0x31: // LD SP,nn
        regPairs[RP_SP] = fetchWord();
        tstates += 10;
        break;

      case 0x32: { // LD (nn),A
        const addr = fetchWord();
        writeByte(addr, regs[R_A]);
        tstates += 13;
        break;
      }

      case 0x33: // INC SP
        regPairs[RP_SP] = (regPairs[RP_SP] + 1) & 0xFFFF;
        tstates += 6;
        break;

      case 0x34: { // INC (HL)
        const addr = regPairs[RP_HL];
        const val = readByte(addr);
        const result = (val + 1) & 0xFF;
        writeByte(addr, result);
        regs[R_F] = (regs[R_F] & FLAG_C) |
                    sz53Table[result] |
                    ((val & 0x0F) === 0x0F ? FLAG_H : 0) |
                    ((val === 0x7F) ? FLAG_V : 0);
        regs[R_F] &= ~FLAG_N;
        tstates += 11;
        break;
      }

      case 0x35: { // DEC (HL)
        const addr = regPairs[RP_HL];
        const val = readByte(addr);
        const result = (val - 1) & 0xFF;
        writeByte(addr, result);
        regs[R_F] = (regs[R_F] & FLAG_C) |
                    sz53Table[result] |
                    FLAG_N |
                    ((val & 0x0F) === 0 ? FLAG_H : 0) |
                    ((val === 0x80) ? FLAG_V : 0);
        tstates += 11;
        break;
      }

      case 0x36: { // LD (HL),n
        const val = fetchByte();
        writeByte(regPairs[RP_HL], val);
        tstates += 10;
        break;
      }

      case 0x37: // SCF (Set Carry Flag)
        regs[R_F] = (regs[R_F] & (FLAG_P | FLAG_Z | FLAG_S)) |
                    (regs[R_A] & (FLAG_Y | FLAG_X)) |
                    FLAG_C;
        tstates += 4;
        break;

      case 0x38: { // JR C,n
        const offset = fetchByte();
        if (regs[R_F] & FLAG_C) {
          tstates += 12;
          regPairs[RP_PC] = (regPairs[RP_PC] + (offset & 0x80 ? offset - 0x100 : offset)) & 0xFFFF;
        } else {
          tstates += 7;
        }
        break;
      }

      case 0x39: { // ADD HL,SP
        const hl = regPairs[RP_HL];
        const sp = regPairs[RP_SP];
        const result = (hl + sp) & 0xFFFF;
        regPairs[RP_HL] = result;
        regs[R_F] = (regs[R_F] & (FLAG_S | FLAG_Z | FLAG_P)) |
                    (((hl ^ sp ^ result) >> 8) & FLAG_H) |
                    ((result >> 8) & (FLAG_Y | FLAG_X)) |
                    ((hl + sp > 0xFFFF) ? FLAG_C : 0);
        regs[R_F] &= ~FLAG_N;
        tstates += 11;
        break;
      }

      case 0x3A: { // LD A,(nn)
        const addr = fetchWord();
        regs[R_A] = readByte(addr);
        tstates += 13;
        break;
      }

      case 0x3B: // DEC SP
        regPairs[RP_SP] = (regPairs[RP_SP] - 1) & 0xFFFF;
        tstates += 6;
        break;

      case 0x3C: { // INC A
        const val = regs[R_A];
        const result = (val + 1) & 0xFF;
        regs[R_A] = result;
        regs[R_F] = (regs[R_F] & FLAG_C) |
                    sz53Table[result] |
                    ((val & 0x0F) === 0x0F ? FLAG_H : 0) |
                    ((val === 0x7F) ? FLAG_V : 0);
        regs[R_F] &= ~FLAG_N;
        tstates += 4;
        break;
      }

      case 0x3D: { // DEC A
        const val = regs[R_A];
        const result = (val - 1) & 0xFF;
        regs[R_A] = result;
        regs[R_F] = (regs[R_F] & FLAG_C) |
                    sz53Table[result] |
                    FLAG_N |
                    ((val & 0x0F) === 0 ? FLAG_H : 0) |
                    ((val === 0x80) ? FLAG_V : 0);
        tstates += 4;
        break;
      }

      case 0x3E: // LD A,n
        regs[R_A] = fetchByte();
        tstates += 7;
        break;

      case 0x3F: // CCF (Complement Carry Flag)
        regs[R_F] = (regs[R_F] & (FLAG_P | FLAG_Z | FLAG_S)) |
                    ((regs[R_F] & FLAG_C) ? FLAG_H : FLAG_C) |
                    (regs[R_A] & (FLAG_Y | FLAG_X));
        tstates += 4;
        break;
      // Conditional returns, jumps, and calls (0xC0-0xFF)
      case 0xC0: // RET NZ
        tstates += 1;
        if (!(regs[R_F] & FLAG_Z)) {
          regPairs[RP_PC] = pop();
          tstates += 10;
        } else {
          tstates += 4;
        }
        break;

      case 0xC1: // POP BC
        regPairs[RP_BC] = pop();
        tstates += 10;
        break;

      case 0xC2: { // JP NZ,nn
        const addr = fetchWord();
        if (!(regs[R_F] & FLAG_Z)) {
          regPairs[RP_PC] = addr;
        }
        tstates += 10;
        break;
      }

      case 0xC3: // JP nn
        regPairs[RP_PC] = fetchWord();
        tstates += 10;
        break;

      case 0xC4: { // CALL NZ,nn
        const addr = fetchWord();
        if (!(regs[R_F] & FLAG_Z)) {
          push(regPairs[RP_PC]);
          regPairs[RP_PC] = addr;
          tstates += 17;
        } else {
          tstates += 10;
        }
        break;
      }

      case 0xC5: // PUSH BC
        tstates += 1;
        push(regPairs[RP_BC]);
        tstates += 10;
        break;

      case 0xC6: { // ADD A,n
        const value = fetchByte();
        const result = regs[R_A] + value;
        const lookup = ((regs[R_A] & 0x88) >> 3) | ((value & 0x88) >> 2) | ((result & 0x88) >> 1);
        regs[R_A] = result & 0xFF;
        regs[R_F] = (result & 0x100 ? FLAG_C : 0) |
                    halfcarryAddTable[lookup & 0x07] |
                    overflowAddTable[lookup >> 4] |
                    sz53Table[regs[R_A]];
        tstates += 7;
        break;
      }

      case 0xC7: // RST 00H
        tstates += 1;
        push(regPairs[RP_PC]);
        regPairs[RP_PC] = 0x00;
        tstates += 10;
        break;

      case 0xC8: // RET Z
        tstates += 1;
        if (regs[R_F] & FLAG_Z) {
          regPairs[RP_PC] = pop();
          tstates += 10;
        } else {
          tstates += 4;
        }
        break;

      case 0xC9: // RET
        regPairs[RP_PC] = pop();
        tstates += 10;
        break;

      case 0xCA: { // JP Z,nn
        const addr = fetchWord();
        if (regs[R_F] & FLAG_Z) {
          regPairs[RP_PC] = addr;
        }
        tstates += 10;
        break;
      }

      case 0xCB: // CB prefix - bit operations
        executeCBInstruction();
        break;

      case 0xCC: { // CALL Z,nn
        const addr = fetchWord();
        if (regs[R_F] & FLAG_Z) {
          push(regPairs[RP_PC]);
          regPairs[RP_PC] = addr;
          tstates += 17;
        } else {
          tstates += 10;
        }
        break;
      }

      case 0xCD: { // CALL nn
        const addr = fetchWord();
        push(regPairs[RP_PC]);
        regPairs[RP_PC] = addr;
        tstates += 17;
        break;
      }

      case 0xCE: { // ADC A,n
        const value = fetchByte();
        const result = regs[R_A] + value + (regs[R_F] & FLAG_C);
        const lookup = ((regs[R_A] & 0x88) >> 3) | ((value & 0x88) >> 2) | ((result & 0x88) >> 1);
        regs[R_A] = result & 0xFF;
        regs[R_F] = (result & 0x100 ? FLAG_C : 0) |
                    halfcarryAddTable[lookup & 0x07] |
                    overflowAddTable[lookup >> 4] |
                    sz53Table[regs[R_A]];
        tstates += 7;
        break;
      }

      case 0xCF: // RST 08H
        tstates += 1;
        push(regPairs[RP_PC]);
        regPairs[RP_PC] = 0x08;
        tstates += 10;
        break;

      case 0xD0: // RET NC
        tstates += 1;
        if (!(regs[R_F] & FLAG_C)) {
          regPairs[RP_PC] = pop();
          tstates += 10;
        } else {
          tstates += 4;
        }
        break;

      case 0xD1: // POP DE
        regPairs[RP_DE] = pop();
        tstates += 10;
        break;

      case 0xD2: { // JP NC,nn
        const addr = fetchWord();
        if (!(regs[R_F] & FLAG_C)) {
          regPairs[RP_PC] = addr;
        }
        tstates += 10;
        break;
      }

      case 0xD3: { // OUT (n),A
        const port = fetchByte();
        if (portOut) portOut(port, regs[R_A]);
        tstates += 11;
        break;
      }

      case 0xD4: { // CALL NC,nn
        const addr = fetchWord();
        if (!(regs[R_F] & FLAG_C)) {
          push(regPairs[RP_PC]);
          regPairs[RP_PC] = addr;
          tstates += 17;
        } else {
          tstates += 10;
        }
        break;
      }

      case 0xD5: // PUSH DE
        tstates += 1;
        push(regPairs[RP_DE]);
        tstates += 10;
        break;

      case 0xD6: { // SUB n
        const value = fetchByte();
        const result = regs[R_A] - value;
        const lookup = ((regs[R_A] & 0x88) >> 3) | ((value & 0x88) >> 2) | ((result & 0x88) >> 1);
        regs[R_A] = result & 0xFF;
        regs[R_F] = (result & 0x100 ? FLAG_C : 0) |
                    FLAG_N |
                    halfcarrySubTable[lookup & 0x07] |
                    overflowSubTable[lookup >> 4] |
                    sz53Table[regs[R_A]];
        tstates += 7;
        break;
      }

      case 0xD7: // RST 10H
        tstates += 1;
        push(regPairs[RP_PC]);
        regPairs[RP_PC] = 0x10;
        tstates += 10;
        break;

      case 0xD8: // RET C
        tstates += 1;
        if (regs[R_F] & FLAG_C) {
          regPairs[RP_PC] = pop();
          tstates += 10;
        } else {
          tstates += 4;
        }
        break;

      case 0xD9: { // EXX
        let temp;
        temp = regPairs[RP_BC]; regPairs[RP_BC] = regPairs[RP_BC_]; regPairs[RP_BC_] = temp;
        temp = regPairs[RP_DE]; regPairs[RP_DE] = regPairs[RP_DE_]; regPairs[RP_DE_] = temp;
        temp = regPairs[RP_HL]; regPairs[RP_HL] = regPairs[RP_HL_]; regPairs[RP_HL_] = temp;
        tstates += 4;
        break;
      }

      case 0xDA: { // JP C,nn
        const addr = fetchWord();
        if (regs[R_F] & FLAG_C) {
          regPairs[RP_PC] = addr;
        }
        tstates += 10;
        break;
      }

      case 0xDB: { // IN A,(n)
        const port = fetchByte();
        if (portIn) regs[R_A] = portIn(port);
        tstates += 11;
        break;
      }

      case 0xDC: { // CALL C,nn
        const addr = fetchWord();
        if (regs[R_F] & FLAG_C) {
          push(regPairs[RP_PC]);
          regPairs[RP_PC] = addr;
          tstates += 17;
        } else {
          tstates += 10;
        }
        break;
      }

      case 0xDD: // DD prefix - IX-indexed
        executeIndexedInstruction(true);
        break;

      case 0xDE: { // SBC A,n
        const value = fetchByte();
        const result = regs[R_A] - value - (regs[R_F] & FLAG_C);
        const lookup = ((regs[R_A] & 0x88) >> 3) | ((value & 0x88) >> 2) | ((result & 0x88) >> 1);
        regs[R_A] = result & 0xFF;
        regs[R_F] = (result & 0x100 ? FLAG_C : 0) |
                    FLAG_N |
                    halfcarrySubTable[lookup & 0x07] |
                    overflowSubTable[lookup >> 4] |
                    sz53Table[regs[R_A]];
        tstates += 7;
        break;
      }

      case 0xDF: // RST 18H
        tstates += 1;
        push(regPairs[RP_PC]);
        regPairs[RP_PC] = 0x18;
        tstates += 10;
        break;

      case 0xE0: // RET PO
        tstates += 1;
        if (!(regs[R_F] & FLAG_P)) {
          regPairs[RP_PC] = pop();
          tstates += 10;
        } else {
          tstates += 4;
        }
        break;

      case 0xE1: // POP HL
        regPairs[RP_HL] = pop();
        tstates += 10;
        break;

      case 0xE2: { // JP PO,nn
        const addr = fetchWord();
        if (!(regs[R_F] & FLAG_P)) {
          regPairs[RP_PC] = addr;
        }
        tstates += 10;
        break;
      }

      case 0xE3: { // EX (SP),HL
        const temp = readWord(regPairs[RP_SP]);
        writeWord(regPairs[RP_SP], regPairs[RP_HL]);
        regPairs[RP_HL] = temp;
        tstates += 19;
        break;
      }

      case 0xE4: { // CALL PO,nn
        const addr = fetchWord();
        if (!(regs[R_F] & FLAG_P)) {
          push(regPairs[RP_PC]);
          regPairs[RP_PC] = addr;
          tstates += 17;
        } else {
          tstates += 10;
        }
        break;
      }

      case 0xE5: // PUSH HL
        tstates += 1;
        push(regPairs[RP_HL]);
        tstates += 10;
        break;

      case 0xE6: { // AND n
        const value = fetchByte();
        regs[R_A] &= value;
        regs[R_F] = FLAG_H | sz53pTable[regs[R_A]];
        tstates += 7;
        break;
      }

      case 0xE7: // RST 20H
        tstates += 1;
        push(regPairs[RP_PC]);
        regPairs[RP_PC] = 0x20;
        tstates += 10;
        break;

      case 0xE8: // RET PE
        tstates += 1;
        if (regs[R_F] & FLAG_P) {
          regPairs[RP_PC] = pop();
          tstates += 10;
        } else {
          tstates += 4;
        }
        break;

      case 0xE9: // JP (HL)
        regPairs[RP_PC] = regPairs[RP_HL];
        tstates += 4;
        break;

      case 0xEA: { // JP PE,nn
        const addr = fetchWord();
        if (regs[R_F] & FLAG_P) {
          regPairs[RP_PC] = addr;
        }
        tstates += 10;
        break;
      }

      case 0xEB: { // EX DE,HL
        const temp = regPairs[RP_DE];
        regPairs[RP_DE] = regPairs[RP_HL];
        regPairs[RP_HL] = temp;
        tstates += 4;
        break;
      }

      case 0xEC: { // CALL PE,nn
        const addr = fetchWord();
        if (regs[R_F] & FLAG_P) {
          push(regPairs[RP_PC]);
          regPairs[RP_PC] = addr;
          tstates += 17;
        } else {
          tstates += 10;
        }
        break;
      }

      case 0xED: // ED prefix - extended instructions
        executeEDInstruction();
        break;

      case 0xEE: { // XOR n
        const value = fetchByte();
        regs[R_A] ^= value;
        regs[R_F] = sz53pTable[regs[R_A]];
        tstates += 7;
        break;
      }

      case 0xEF: // RST 28H
        tstates += 1;
        push(regPairs[RP_PC]);
        regPairs[RP_PC] = 0x28;
        tstates += 10;
        break;

      case 0xF0: // RET P
        tstates += 1;
        if (!(regs[R_F] & FLAG_S)) {
          regPairs[RP_PC] = pop();
          tstates += 10;
        } else {
          tstates += 4;
        }
        break;

      case 0xF1: // POP AF
        regPairs[RP_AF] = pop();
        tstates += 10;
        break;

      case 0xF2: { // JP P,nn
        const addr = fetchWord();
        if (!(regs[R_F] & FLAG_S)) {
          regPairs[RP_PC] = addr;
        }
        tstates += 10;
        break;
      }

      case 0xF3: // DI
        iff1 = 0;
        iff2 = 0;
        tstates += 4;
        break;

      case 0xF4: { // CALL P,nn
        const addr = fetchWord();
        if (!(regs[R_F] & FLAG_S)) {
          push(regPairs[RP_PC]);
          regPairs[RP_PC] = addr;
          tstates += 17;
        } else {
          tstates += 10;
        }
        break;
      }

      case 0xF5: // PUSH AF
        tstates += 1;
        push(regPairs[RP_AF]);
        tstates += 10;
        break;

      case 0xF6: { // OR n
        const value = fetchByte();
        regs[R_A] |= value;
        regs[R_F] = sz53pTable[regs[R_A]];
        tstates += 7;
        break;
      }

      case 0xF7: // RST 30H
        tstates += 1;
        push(regPairs[RP_PC]);
        regPairs[RP_PC] = 0x30;
        tstates += 10;
        break;

      case 0xF8: // RET M
        tstates += 1;
        if (regs[R_F] & FLAG_S) {
          regPairs[RP_PC] = pop();
          tstates += 10;
        } else {
          tstates += 4;
        }
        break;

      case 0xF9: // LD SP,HL
        regPairs[RP_SP] = regPairs[RP_HL];
        tstates += 6;
        break;

      case 0xFA: { // JP M,nn
        const addr = fetchWord();
        if (regs[R_F] & FLAG_S) {
          regPairs[RP_PC] = addr;
        }
        tstates += 10;
        break;
      }

      case 0xFB: // EI
        iff1 = 1;
        iff2 = 1;
        tstates += 4;
        break;

      case 0xFC: { // CALL M,nn
        const addr = fetchWord();
        if (regs[R_F] & FLAG_S) {
          push(regPairs[RP_PC]);
          regPairs[RP_PC] = addr;
          tstates += 17;
        } else {
          tstates += 10;
        }
        break;
      }

      case 0xFD: // FD prefix - IY-indexed
        executeIndexedInstruction(false);
        break;

      case 0xFE: { // CP n
        const value = fetchByte();
        const result = regs[R_A] - value;
        const lookup = ((regs[R_A] & 0x88) >> 3) | ((value & 0x88) >> 2) | ((result & 0x88) >> 1);
        regs[R_F] = (result & 0x100 ? FLAG_C : (result ? 0 : FLAG_Z)) |
                    FLAG_N |
                    halfcarrySubTable[lookup & 0x07] |
                    overflowSubTable[lookup >> 4] |
                    (value & (FLAG_Y | FLAG_X)) |
                    (result & FLAG_S);
        tstates += 7;
        break;
      }

      case 0xFF: // RST 38H
        tstates += 1;
        push(regPairs[RP_PC]);
        regPairs[RP_PC] = 0x38;
        tstates += 10;
        break;

      default:
        throw new Error(`Unimplemented Z80 opcode: 0x${opcode.toString(16).toUpperCase().padStart(2, "0")}`);
    }
  };

  /**
   * Execute instructions for specified number of cycles
   */
  const steps = (cycles) => {
    const targetTstates = tstates + cycles;

    // When halted, the main loop's `!halted` guard prevents it from running, so
    // interrupt checks inside the loop are unreachable.  Handle HALT wakeup here,
    // before entering the loop.  NMI always wakes; IRQ only when IFF1 is set.
    if (halted) {
      if (NMIPending) {
        NMIPending = false;
        regPairs[RP_PC] = (regPairs[RP_PC] + 1) & 0xFFFF; // return to instr after HALT
        halted = false;
        push(regPairs[RP_PC]);
        regPairs[RP_PC] = 0x0066;
        tstates += 11;
      } else if (interruptPending && iff1) {
        interruptPending = false;
        regPairs[RP_PC] = (regPairs[RP_PC] + 1) & 0xFFFF; // return to instr after HALT
        halted = false;
        iff1 = 0;
        iff2 = 0;
        push(regPairs[RP_PC]);
        switch (im) {
          case 0: regPairs[RP_PC] = 0x0038; tstates += 6; break;
          case 1: regPairs[RP_PC] = 0x0038; tstates += 7; break;
          case 2: {
            const vector = (regs[R_I] << 8) | 0xFF;
            regPairs[RP_PC] = readWord(vector);
            tstates += 7;
            break;
          }
        }
      }
    }

    while (tstates < targetTstates && !halted) {
      // Handle NMI (non-maskable interrupt)
      if (NMIPending) {
        NMIPending = false;
        if (halted) {
          regPairs[RP_PC] = (regPairs[RP_PC] + 1) & 0xFFFF;
          halted = false;
        }
        push(regPairs[RP_PC]);
        regPairs[RP_PC] = 0x0066;
        tstates += 11;
      }

      // Handle maskable interrupt
      if (interruptPending && iff1) {
        interruptPending = false;
        if (halted) {
          regPairs[RP_PC] = (regPairs[RP_PC] + 1) & 0xFFFF;
          halted = false;
        }
        iff1 = 0;
        iff2 = 0;
        push(regPairs[RP_PC]);

        switch (im) {
          case 0: // IM 0: Execute RST 38h
            regPairs[RP_PC] = 0x0038;
            tstates += 6;
            break;
          case 1: // IM 1: RST 38h
            regPairs[RP_PC] = 0x0038;
            tstates += 7;
            break;
          case 2: { // IM 2: Vectored interrupt
            const vector = (regs[R_I] << 8) | 0xFF;
            regPairs[RP_PC] = readWord(vector);
            tstates += 7;
            break;
          }
        }
      }

      executeInstruction();
    }
  };

  /**
   * Execute one instruction
   */
  const step = () => {
    executeInstruction();
  };

  /**
   * Get current register state
   */
  const status = () => ({
    pc: regPairs[RP_PC],
    sp: regPairs[RP_SP],
    af: regPairs[RP_AF],
    bc: regPairs[RP_BC],
    de: regPairs[RP_DE],
    hl: regPairs[RP_HL],
    af_: regPairs[RP_AF_],
    bc_: regPairs[RP_BC_],
    de_: regPairs[RP_DE_],
    hl_: regPairs[RP_HL_],
    ix: regPairs[RP_IX],
    iy: regPairs[RP_IY],
    i: regs[R_I],
    r: regs[R_R],
    a: regs[R_A],
    b: regs[R_B],
    c: regs[R_C],
    d: regs[R_D],
    e: regs[R_E],
    f: regs[R_F],
    h: regs[R_H],
    l: regs[R_L],
    iff1,
    iff2,
    im,
    halted
  });

  /**
   * Set register value
   */
  const set = (reg, value) => {
    switch (reg.toUpperCase()) {
      case "PC": regPairs[RP_PC] = value & 0xFFFF; break;
      case "SP": regPairs[RP_SP] = value & 0xFFFF; break;
      case "AF": regPairs[RP_AF] = value & 0xFFFF; break;
      case "BC": regPairs[RP_BC] = value & 0xFFFF; break;
      case "DE": regPairs[RP_DE] = value & 0xFFFF; break;
      case "HL": regPairs[RP_HL] = value & 0xFFFF; break;
      case "AF_": regPairs[RP_AF_] = value & 0xFFFF; break;
      case "BC_": regPairs[RP_BC_] = value & 0xFFFF; break;
      case "DE_": regPairs[RP_DE_] = value & 0xFFFF; break;
      case "HL_": regPairs[RP_HL_] = value & 0xFFFF; break;
      case "IX": regPairs[RP_IX] = value & 0xFFFF; break;
      case "IY": regPairs[RP_IY] = value & 0xFFFF; break;
      case "I": regs[R_I] = value & 0xFF; break;
      case "R": regs[R_R] = value & 0xFF; break;
      case "A": regs[R_A] = value & 0xFF; break;
      case "B": regs[R_B] = value & 0xFF; break;
      case "C": regs[R_C] = value & 0xFF; break;
      case "D": regs[R_D] = value & 0xFF; break;
      case "E": regs[R_E] = value & 0xFF; break;
      case "F": regs[R_F] = value & 0xFF; break;
      case "H": regs[R_H] = value & 0xFF; break;
      case "L": regs[R_L] = value & 0xFF; break;
      case "IFF1": iff1 = value ? 1 : 0; break;
      case "IFF2": iff2 = value ? 1 : 0; break;
      case "IM": im = value & 0x03; break;
      default:
        throw new Error(`Unknown register: ${reg}`);
    }
  };

  /**
   * Request maskable interrupt
   */
  const interrupt = () => {
    interruptPending = true;
  };

  /**
   * Request non-maskable interrupt
   */
  const nmi = () => {
    NMIPending = true;
  };

  /**
   * Get cycle count
   */
  const T = () => tstates;

  /**
   * Read memory (for debugger)
   */
  const memr = (addr) => readByte(addr);

  /**
   * Format flags as string (SZYHXPNC)
   */
  const flagsToString = () => {
    const flagNames = "SZYHXPNC";
    const f = regs[R_F];
    let result = "";
    for (let i = 0; i < 8; i++) {
      const mask = 0x80 >> i;
      if (f & mask) {
        result += flagNames[i];
      } else {
        result += flagNames[i].toLowerCase();
      }
    }
    return result;
  };

  // Initialize CPU
  reset();

  return {
    reset,
    steps,
    step,
    status,
    set,
    interrupt,
    nmi,
    T,
    memr,
    flagsToString
  };
};

/**
 * Helper functions for disassembly formatting
 */
const toHexN = (n, digits) => {
  let s = n.toString(16);
  while (s.length < digits) {
    s = "0" + s;
  }
  return s.toUpperCase();
};

const toHex2 = (n) => toHexN(n & 0xff, 2);
const toHex4 = (n) => toHexN(n, 4);

/**
 * Convert unsigned byte to signed offset string with sign
 */
const signedOffset = (n) => {
  const signed = n < 128 ? n : n - 256;
  return signed >= 0 ? `+$${toHex2(signed)}` : `-$${toHex2(-signed)}`;
};

/**
 * Base Z80 instruction table (no prefix)
 * Index by opcode, empty string means handled by 2/3-byte decoder
 */
const baseTable = [
  "NOP", "", "LD    (BC),A", "INC   BC", "INC   B", "DEC   B", "", "RLCA",
  "EX    AF,AF'", "ADD   HL,BC", "LD    A,(BC)", "DEC   BC", "INC   C", "DEC   C", "", "RRCA",
  "", "", "LD    (DE),A", "INC   DE", "INC   D", "DEC   D", "", "RLA",
  "", "ADD   HL,DE", "LD    A,(DE)", "DEC   DE", "INC   E", "DEC   E", "", "RRA",
  "", "", "", "INC   HL", "INC   H", "DEC   H", "", "DAA",
  "", "ADD   HL,HL", "", "DEC   HL", "INC   L", "DEC   L", "", "CPL",
  "", "", "", "INC   SP", "INC   (HL)", "DEC   (HL)", "", "SCF",
  "", "ADD   HL,SP", "", "DEC   SP", "INC   A", "DEC   A", "", "CCF",
  "LD    B,B", "LD    B,C", "LD    B,D", "LD    B,E", "LD    B,H", "LD    B,L", "LD    B,(HL)", "LD    B,A",
  "LD    C,B", "LD    C,C", "LD    C,D", "LD    C,E", "LD    C,H", "LD    C,L", "LD    C,(HL)", "LD    C,A",
  "LD    D,B", "LD    D,C", "LD    D,D", "LD    D,E", "LD    D,H", "LD    D,L", "LD    D,(HL)", "LD    D,A",
  "LD    E,B", "LD    E,C", "LD    E,D", "LD    E,E", "LD    E,H", "LD    E,L", "LD    E,(HL)", "LD    E,A",
  "LD    H,B", "LD    H,C", "LD    H,D", "LD    H,E", "LD    H,H", "LD    H,L", "LD    H,(HL)", "LD    H,A",
  "LD    L,B", "LD    L,C", "LD    L,D", "LD    L,E", "LD    L,H", "LD    L,L", "LD    L,(HL)", "LD    L,A",
  "LD    (HL),B", "LD    (HL),C", "LD    (HL),D", "LD    (HL),E", "LD    (HL),H", "LD    (HL),L", "HALT", "LD    (HL),A",
  "LD    A,B", "LD    A,C", "LD    A,D", "LD    A,E", "LD    A,H", "LD    A,L", "LD    A,(HL)", "LD    A,A",
  "ADD   A,B", "ADD   A,C", "ADD   A,D", "ADD   A,E", "ADD   A,H", "ADD   A,L", "ADD   A,(HL)", "ADD   A,A",
  "ADC   A,B", "ADC   A,C", "ADC   A,D", "ADC   A,E", "ADC   A,H", "ADC   A,L", "ADC   A,(HL)", "ADC   A,A",
  "SUB   B", "SUB   C", "SUB   D", "SUB   E", "SUB   H", "SUB   L", "SUB   (HL)", "SUB   A",
  "SBC   A,B", "SBC   A,C", "SBC   A,D", "SBC   A,E", "SBC   A,H", "SBC   A,L", "SBC   A,(HL)", "SBC   A,A",
  "AND   B", "AND   C", "AND   D", "AND   E", "AND   H", "AND   L", "AND   (HL)", "AND   A",
  "XOR   B", "XOR   C", "XOR   D", "XOR   E", "XOR   H", "XOR   L", "XOR   (HL)", "XOR   A",
  "OR    B", "OR    C", "OR    D", "OR    E", "OR    H", "OR    L", "OR    (HL)", "OR    A",
  "CP    B", "CP    C", "CP    D", "CP    E", "CP    H", "CP    L", "CP    (HL)", "CP    A",
  "RET   NZ", "POP   BC", "", "", "", "PUSH  BC", "", "RST   00",
  "RET   Z", "RET", "", "", "", "", "", "RST   08",
  "RET   NC", "POP   DE", "", "", "", "PUSH  DE", "", "RST   10",
  "RET   C", "EXX", "", "", "", "", "", "RST   18",
  "RET   PO", "POP   HL", "", "EX    (SP),HL", "", "PUSH  HL", "", "RST   20",
  "RET   PE", "JP    (HL)", "", "EX    DE,HL", "", "", "", "RST   28",
  "RET   P", "POP   AF", "", "DI", "", "PUSH  AF", "", "RST   30",
  "RET   M", "LD    SP,HL", "", "EI", "", "", "", "RST   38"
];

/**
 * CB prefix instructions (bit operations)
 */
const cbTable = [
  "RLC   B", "RLC   C", "RLC   D", "RLC   E", "RLC   H", "RLC   L", "RLC   (HL)", "RLC   A",
  "RRC   B", "RRC   C", "RRC   D", "RRC   E", "RRC   H", "RRC   L", "RRC   (HL)", "RRC   A",
  "RL    B", "RL    C", "RL    D", "RL    E", "RL    H", "RL    L", "RL    (HL)", "RL    A",
  "RR    B", "RR    C", "RR    D", "RR    E", "RR    H", "RR    L", "RR    (HL)", "RR    A",
  "SLA   B", "SLA   C", "SLA   D", "SLA   E", "SLA   H", "SLA   L", "SLA   (HL)", "SLA   A",
  "SRA   B", "SRA   C", "SRA   D", "SRA   E", "SRA   H", "SRA   L", "SRA   (HL)", "SRA   A",
  "SLL   B", "SLL   C", "SLL   D", "SLL   E", "SLL   H", "SLL   L", "SLL   (HL)", "SLL   A",
  "SRL   B", "SRL   C", "SRL   D", "SRL   E", "SRL   H", "SRL   L", "SRL   (HL)", "SRL   A",
  "BIT   0,B", "BIT   0,C", "BIT   0,D", "BIT   0,E", "BIT   0,H", "BIT   0,L", "BIT   0,(HL)", "BIT   0,A",
  "BIT   1,B", "BIT   1,C", "BIT   1,D", "BIT   1,E", "BIT   1,H", "BIT   1,L", "BIT   1,(HL)", "BIT   1,A",
  "BIT   2,B", "BIT   2,C", "BIT   2,D", "BIT   2,E", "BIT   2,H", "BIT   2,L", "BIT   2,(HL)", "BIT   2,A",
  "BIT   3,B", "BIT   3,C", "BIT   3,D", "BIT   3,E", "BIT   3,H", "BIT   3,L", "BIT   3,(HL)", "BIT   3,A",
  "BIT   4,B", "BIT   4,C", "BIT   4,D", "BIT   4,E", "BIT   4,H", "BIT   4,L", "BIT   4,(HL)", "BIT   4,A",
  "BIT   5,B", "BIT   5,C", "BIT   5,D", "BIT   5,E", "BIT   5,H", "BIT   5,L", "BIT   5,(HL)", "BIT   5,A",
  "BIT   6,B", "BIT   6,C", "BIT   6,D", "BIT   6,E", "BIT   6,H", "BIT   6,L", "BIT   6,(HL)", "BIT   6,A",
  "BIT   7,B", "BIT   7,C", "BIT   7,D", "BIT   7,E", "BIT   7,H", "BIT   7,L", "BIT   7,(HL)", "BIT   7,A",
  "RES   0,B", "RES   0,C", "RES   0,D", "RES   0,E", "RES   0,H", "RES   0,L", "RES   0,(HL)", "RES   0,A",
  "RES   1,B", "RES   1,C", "RES   1,D", "RES   1,E", "RES   1,H", "RES   1,L", "RES   1,(HL)", "RES   1,A",
  "RES   2,B", "RES   2,C", "RES   2,D", "RES   2,E", "RES   2,H", "RES   2,L", "RES   2,(HL)", "RES   2,A",
  "RES   3,B", "RES   3,C", "RES   3,D", "RES   3,E", "RES   3,H", "RES   3,L", "RES   3,(HL)", "RES   3,A",
  "RES   4,B", "RES   4,C", "RES   4,D", "RES   4,E", "RES   4,H", "RES   4,L", "RES   4,(HL)", "RES   4,A",
  "RES   5,B", "RES   5,C", "RES   5,D", "RES   5,E", "RES   5,H", "RES   5,L", "RES   5,(HL)", "RES   5,A",
  "RES   6,B", "RES   6,C", "RES   6,D", "RES   6,E", "RES   6,H", "RES   6,L", "RES   6,(HL)", "RES   6,A",
  "RES   7,B", "RES   7,C", "RES   7,D", "RES   7,E", "RES   7,H", "RES   7,L", "RES   7,(HL)", "RES   7,A",
  "SET   0,B", "SET   0,C", "SET   0,D", "SET   0,E", "SET   0,H", "SET   0,L", "SET   0,(HL)", "SET   0,A",
  "SET   1,B", "SET   1,C", "SET   1,D", "SET   1,E", "SET   1,H", "SET   1,L", "SET   1,(HL)", "SET   1,A",
  "SET   2,B", "SET   2,C", "SET   2,D", "SET   2,E", "SET   2,H", "SET   2,L", "SET   2,(HL)", "SET   2,A",
  "SET   3,B", "SET   3,C", "SET   3,D", "SET   3,E", "SET   3,H", "SET   3,L", "SET   3,(HL)", "SET   3,A",
  "SET   4,B", "SET   4,C", "SET   4,D", "SET   4,E", "SET   4,H", "SET   4,L", "SET   4,(HL)", "SET   4,A",
  "SET   5,B", "SET   5,C", "SET   5,D", "SET   5,E", "SET   5,H", "SET   5,L", "SET   5,(HL)", "SET   5,A",
  "SET   6,B", "SET   6,C", "SET   6,D", "SET   6,E", "SET   6,H", "SET   6,L", "SET   6,(HL)", "SET   6,A",
  "SET   7,B", "SET   7,C", "SET   7,D", "SET   7,E", "SET   7,H", "SET   7,L", "SET   7,(HL)", "SET   7,A"
];

/**
 * ED prefix instructions (extended opcodes)
 * Sparse table - many opcodes are undocumented/invalid
 */
const edTable = {
  0x40: "IN    B,(C)", 0x41: "OUT   (C),B", 0x42: "SBC   HL,BC", 0x44: "NEG", 0x45: "RETN",
  0x46: "IM    0", 0x47: "LD    I,A", 0x48: "IN    C,(C)", 0x49: "OUT   (C),C", 0x4A: "ADC   HL,BC",
  0x4C: "NEG*", 0x4D: "RETI", 0x4E: "IM    0*", 0x4F: "LD    R,A", 0x50: "IN    D,(C)",
  0x51: "OUT   (C),D", 0x52: "SBC   HL,DE", 0x54: "NEG*", 0x55: "RETN*", 0x56: "IM    1",
  0x57: "LD    A,I", 0x58: "IN    E,(C)", 0x59: "OUT   (C),E", 0x5A: "ADC   HL,DE", 0x5C: "NEG*",
  0x5D: "RETN*", 0x5E: "IM    2", 0x5F: "LD    A,R", 0x60: "IN    H,(C)", 0x61: "OUT   (C),H",
  0x62: "SBC   HL,HL", 0x64: "NEG*", 0x65: "RETN*", 0x66: "IM    0*", 0x67: "RRD",
  0x68: "IN    L,(C)", 0x69: "OUT   (C),L", 0x6A: "ADC   HL,HL", 0x6C: "NEG*", 0x6D: "RETN*",
  0x6E: "IM    0*", 0x6F: "RLD", 0x70: "IN    F,(C)", 0x71: "OUT   (C),0", 0x72: "SBC   HL,SP",
  0x74: "NEG*", 0x75: "RETN*", 0x76: "IM    1*", 0x77: "NOP*", 0x78: "IN    A,(C)",
  0x79: "OUT   (C),A", 0x7A: "ADC   HL,SP", 0x7C: "NEG*", 0x7D: "RETN*", 0x7E: "IM    2*",
  0x7F: "NOP*", 0xA0: "LDI", 0xA1: "CPI", 0xA2: "INI", 0xA3: "OUTI", 0xA8: "LDD",
  0xA9: "CPD", 0xAA: "IND", 0xAB: "OUTD", 0xB0: "LDIR", 0xB1: "CPIR", 0xB2: "INIR",
  0xB3: "OTIR", 0xB8: "LDDR", 0xB9: "CPDR", 0xBA: "INDR", 0xBB: "OTDR"
};

/**
 * Disassemble a single Z80 instruction
 *
 * @param {number} opcode - The instruction opcode
 * @param {number} a - First operand byte
 * @param {number} b - Second operand byte
 * @param {number} c - Third operand byte (for indexed instructions)
 * @param {number} d - Fourth operand byte
 * @param {number} pc - Current PC value (for relative jumps)
 * @returns {Array} [mnemonic_string, instruction_length]
 */
export const disasm = (opcode, a, b, c, d, pc) => {
  a = a || 0;
  b = b || 0;
  c = c || 0;
  d = d || 0;
  pc = pc || 0;

  // Handle CB prefix (bit operations)
  if (opcode === 0xCB) {
    return [cbTable[a], 2];
  }

  // Handle ED prefix (extended instructions)
  if (opcode === 0xED) {
    // Check for 4-byte ED instructions (16-bit loads) first
    if (a === 0x43 || a === 0x4B || a === 0x53 || a === 0x5B || a === 0x73 || a === 0x7B) {
      const addr = toHex2(c) + toHex2(b);
      if (a === 0x43) return [`LD    ($${addr}),BC`, 4];
      if (a === 0x4B) return [`LD    BC,($${addr})`, 4];
      if (a === 0x53) return [`LD    ($${addr}),DE`, 4];
      if (a === 0x5B) return [`LD    DE,($${addr})`, 4];
      if (a === 0x73) return [`LD    ($${addr}),SP`, 4];
      if (a === 0x7B) return [`LD    SP,($${addr})`, 4];
    }
    const edInstr = edTable[a];
    if (edInstr) {
      return [edInstr, 2];
    }
    return ["", 2];
  }

  // Handle DD prefix (IX-indexed instructions)
  if (opcode === 0xDD) {
    return disasmIndexed(a, b, c, d, "IX");
  }

  // Handle FD prefix (IY-indexed instructions)
  if (opcode === 0xFD) {
    return disasmIndexed(a, b, c, d, "IY");
  }

  // Base instruction table lookup
  let mnem = baseTable[opcode];
  if (mnem) {
    return [mnem, 1];
  }

  // 2-byte instructions with immediate or relative
  const d8 = toHex2(a);
  switch (opcode) {
    case 0x10: // DJNZ
      const djnzTarget = ((a < 128 ? a : a - 256) + pc + 2) & 0xFFFF;
      return [`DJNZ  ${toHex4(djnzTarget)}`, 2];
    case 0x18: // JR
      const jrTarget = ((a < 128 ? a : a - 256) + pc + 2) & 0xFFFF;
      return [`JR    ${toHex4(jrTarget)}`, 2];
    case 0x20: // JR NZ
      const jrnzTarget = ((a < 128 ? a : a - 256) + pc + 2) & 0xFFFF;
      return [`JR    NZ,${toHex4(jrnzTarget)}`, 2];
    case 0x28: // JR Z
      const jrzTarget = ((a < 128 ? a : a - 256) + pc + 2) & 0xFFFF;
      return [`JR    Z,${toHex4(jrzTarget)}`, 2];
    case 0x30: // JR NC
      const jrncTarget = ((a < 128 ? a : a - 256) + pc + 2) & 0xFFFF;
      return [`JR    NC,${toHex4(jrncTarget)}`, 2];
    case 0x38: // JR C
      const jrcTarget = ((a < 128 ? a : a - 256) + pc + 2) & 0xFFFF;
      return [`JR    C,${toHex4(jrcTarget)}`, 2];
    case 0x06: return [`LD    B,$${d8}`, 2];
    case 0x0E: return [`LD    C,$${d8}`, 2];
    case 0x16: return [`LD    D,$${d8}`, 2];
    case 0x1E: return [`LD    E,$${d8}`, 2];
    case 0x26: return [`LD    H,$${d8}`, 2];
    case 0x2E: return [`LD    L,$${d8}`, 2];
    case 0x36: return [`LD    (HL),$${d8}`, 2];
    case 0x3E: return [`LD    A,$${d8}`, 2];
    case 0xC6: return [`ADD   A,$${d8}`, 2];
    case 0xCE: return [`ADC   A,$${d8}`, 2];
    case 0xD3: return [`OUT   ($${d8}),A`, 2];
    case 0xD6: return [`SUB   $${d8}`, 2];
    case 0xDB: return [`IN    A,($${d8})`, 2];
    case 0xDE: return [`SBC   A,$${d8}`, 2];
    case 0xE6: return [`AND   $${d8}`, 2];
    case 0xEE: return [`XOR   $${d8}`, 2];
    case 0xF6: return [`OR    $${d8}`, 2];
    case 0xFE: return [`CP    $${d8}`, 2];
  }

  // 3-byte instructions with 16-bit immediate
  const d16 = toHex2(b) + toHex2(a);
  switch (opcode) {
    case 0x01: return [`LD    BC,$${d16}`, 3];
    case 0x11: return [`LD    DE,$${d16}`, 3];
    case 0x21: return [`LD    HL,$${d16}`, 3];
    case 0x22: return [`LD    ($${d16}),HL`, 3];
    case 0x2A: return [`LD    HL,($${d16})`, 3];
    case 0x31: return [`LD    SP,$${d16}`, 3];
    case 0x32: return [`LD    ($${d16}),A`, 3];
    case 0x3A: return [`LD    A,($${d16})`, 3];
    case 0xC2: return [`JP    NZ,$${d16}`, 3];
    case 0xC3: return [`JP    $${d16}`, 3];
    case 0xC4: return [`CALL  NZ,$${d16}`, 3];
    case 0xCA: return [`JP    Z,$${d16}`, 3];
    case 0xCC: return [`CALL  Z,$${d16}`, 3];
    case 0xCD: return [`CALL  $${d16}`, 3];
    case 0xD2: return [`JP    NC,$${d16}`, 3];
    case 0xD4: return [`CALL  NC,$${d16}`, 3];
    case 0xDA: return [`JP    C,$${d16}`, 3];
    case 0xDC: return [`CALL  C,$${d16}`, 3];
    case 0xE2: return [`JP    PO,$${d16}`, 3];
    case 0xE4: return [`CALL  PO,$${d16}`, 3];
    case 0xEA: return [`JP    PE,$${d16}`, 3];
    case 0xEC: return [`CALL  PE,$${d16}`, 3];
    case 0xF2: return [`JP    P,$${d16}`, 3];
    case 0xF4: return [`CALL  P,$${d16}`, 3];
    case 0xFA: return [`JP    M,$${d16}`, 3];
    case 0xFC: return [`CALL  M,$${d16}`, 3];
  }

  return ["UNKNOWN", 0];
};

/**
 * Disassemble DD/FD indexed instructions (IX/IY)
 */
const disasmIndexed = (a, b, c, d, idx) => {
  const d8 = toHex2(b);
  const d16 = toHex2(c) + toHex2(b);
  const offset = signedOffset(b);

  // Simple 2-byte DD/FD instructions
  switch (a) {
    case 0x09: return [`ADD   ${idx},BC`, 2];
    case 0x19: return [`ADD   ${idx},DE`, 2];
    case 0x23: return [`INC   ${idx}`, 2];
    case 0x24: return [`INC   ${idx}H`, 2];
    case 0x25: return [`DEC   ${idx}H`, 2];
    case 0x26: return [`LD    ${idx}H,$${d8}`, 3];
    case 0x29: return [`ADD   ${idx},${idx}`, 2];
    case 0x2B: return [`DEC   ${idx}`, 2];
    case 0x2C: return [`INC   ${idx}L`, 2];
    case 0x2D: return [`DEC   ${idx}L`, 2];
    case 0x2E: return [`LD    ${idx}L,$${d8}`, 3];
    case 0x39: return [`ADD   ${idx},SP`, 2];
    case 0x44: return [`LD    B,${idx}H`, 2];
    case 0x45: return [`LD    B,${idx}L`, 2];
    case 0x4C: return [`LD    C,${idx}H`, 2];
    case 0x4D: return [`LD    C,${idx}L`, 2];
    case 0x54: return [`LD    D,${idx}H`, 2];
    case 0x55: return [`LD    D,${idx}L`, 2];
    case 0x5C: return [`LD    E,${idx}H`, 2];
    case 0x5D: return [`LD    E,${idx}L`, 2];
    case 0x60: return [`LD    ${idx}H,B`, 2];
    case 0x61: return [`LD    ${idx}H,C`, 2];
    case 0x62: return [`LD    ${idx}H,D`, 2];
    case 0x63: return [`LD    ${idx}H,E`, 2];
    case 0x64: return [`LD    ${idx}H,${idx}H`, 2];
    case 0x65: return [`LD    ${idx}H,${idx}L`, 2];
    case 0x67: return [`LD    ${idx}H,A`, 2];
    case 0x68: return [`LD    ${idx}L,B`, 2];
    case 0x69: return [`LD    ${idx}L,C`, 2];
    case 0x6A: return [`LD    ${idx}L,D`, 2];
    case 0x6B: return [`LD    ${idx}L,E`, 2];
    case 0x6C: return [`LD    ${idx}L,${idx}H`, 2];
    case 0x6D: return [`LD    ${idx}L,${idx}L`, 2];
    case 0x6F: return [`LD    ${idx}L,A`, 2];
    case 0x7C: return [`LD    A,${idx}H`, 2];
    case 0x7D: return [`LD    A,${idx}L`, 2];
    case 0x84: return [`ADD   A,${idx}H`, 2];
    case 0x85: return [`ADD   A,${idx}L`, 2];
    case 0x8C: return [`ADC   A,${idx}H`, 2];
    case 0x8D: return [`ADC   A,${idx}L`, 2];
    case 0x94: return [`SUB   ${idx}H`, 2];
    case 0x95: return [`SUB   ${idx}L`, 2];
    case 0x9C: return [`SBC   A,${idx}H`, 2];
    case 0x9D: return [`SBC   A,${idx}L`, 2];
    case 0xA4: return [`AND   ${idx}H`, 2];
    case 0xA5: return [`AND   ${idx}L`, 2];
    case 0xAC: return [`XOR   ${idx}H`, 2];
    case 0xAD: return [`XOR   ${idx}L`, 2];
    case 0xB4: return [`OR    ${idx}H`, 2];
    case 0xB5: return [`OR    ${idx}L`, 2];
    case 0xBC: return [`CP    ${idx}H`, 2];
    case 0xBD: return [`CP    ${idx}L`, 2];
    case 0xE1: return [`POP   ${idx}`, 2];
    case 0xE3: return [`EX    (SP),${idx}`, 2];
    case 0xE5: return [`PUSH  ${idx}`, 2];
    case 0xE9: return [`JP    (${idx})`, 2];
    case 0xEB: return [`EX    DE,${idx}`, 2];
    case 0xF9: return [`LD    SP,${idx}`, 2];
  }

  // 3-byte DD/FD with offset
  switch (a) {
    case 0x34: return [`INC   (${idx}${offset})`, 3];
    case 0x35: return [`DEC   (${idx}${offset})`, 3];
    case 0x46: return [`LD    B,(${idx}${offset})`, 3];
    case 0x4E: return [`LD    C,(${idx}${offset})`, 3];
    case 0x56: return [`LD    D,(${idx}${offset})`, 3];
    case 0x5E: return [`LD    E,(${idx}${offset})`, 3];
    case 0x66: return [`LD    H,(${idx}${offset})`, 3];
    case 0x6E: return [`LD    L,(${idx}${offset})`, 3];
    case 0x70: return [`LD    (${idx}${offset}),B`, 3];
    case 0x71: return [`LD    (${idx}${offset}),C`, 3];
    case 0x72: return [`LD    (${idx}${offset}),D`, 3];
    case 0x73: return [`LD    (${idx}${offset}),E`, 3];
    case 0x74: return [`LD    (${idx}${offset}),H`, 3];
    case 0x75: return [`LD    (${idx}${offset}),L`, 3];
    case 0x77: return [`LD    (${idx}${offset}),A`, 3];
    case 0x7E: return [`LD    A,(${idx}${offset})`, 3];
    case 0x86: return [`ADD   A,(${idx}${offset})`, 3];
    case 0x8E: return [`ADC   A,(${idx}${offset})`, 3];
    case 0x96: return [`SUB   (${idx}${offset})`, 3];
    case 0x9E: return [`SBC   A,(${idx}${offset})`, 3];
    case 0xA6: return [`AND   (${idx}${offset})`, 3];
    case 0xAE: return [`XOR   (${idx}${offset})`, 3];
    case 0xB6: return [`OR    (${idx}${offset})`, 3];
    case 0xBE: return [`CP    (${idx}${offset})`, 3];
  }

  // 4-byte DD/FD instructions
  const d8c = toHex2(c);
  switch (a) {
    case 0x21: return [`LD    ${idx},$${d16}`, 4];
    case 0x22: return [`LD    ($${d16}),${idx}`, 4];
    case 0x2A: return [`LD    ${idx},($${d16})`, 4];
    case 0x36: return [`LD    (${idx}${offset}),$${d8c}`, 4];
    case 0xCB: return disasmIndexedCB(b, c, idx);
  }

  return ["", 2];
};

/**
 * Disassemble DDCB/FDCB indexed bit operations
 */
const disasmIndexedCB = (offset, opcode, idx) => {
  const off = signedOffset(offset);
  const regs = ["B", "C", "D", "E", "H", "L", "", "A"];
  const reg = regs[opcode & 7];

  if (opcode < 0x40) {
    // Shifts/rotates - note RL and RR have 4 spaces, others have 3
    const ops = ["RLC   ", "RRC   ", "RL    ", "RR    ", "SLA   ", "SRA   ", "SLL   ", "SRL   "];
    const op = ops[(opcode >> 3) & 7];
    return reg ? [`${op}(${idx}${off}),${reg}`, 4] : [`${op}(${idx}${off})`, 4];
  } else if (opcode < 0x80) {
    // BIT
    const bit = (opcode >> 3) & 7;
    return [`BIT   ${bit},(${idx}${off})`, 4];
  } else if (opcode < 0xC0) {
    // RES
    const bit = (opcode >> 3) & 7;
    return reg ? [`RES   ${bit},(${idx}${off}),${reg}`, 4] : [`RES   ${bit},(${idx}${off})`, 4];
  } else {
    // SET
    const bit = (opcode >> 3) & 7;
    return reg ? [`SET   ${bit},(${idx}${off}),${reg}`, 4] : [`SET   ${bit},(${idx}${off})`, 4];
  }
};
