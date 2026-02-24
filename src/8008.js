/**
 * Intel 8008 CPU Emulator
 *
 * ES6 module implementation of cycle-accurate Intel 8008 emulator.
 * The 8008 is the predecessor of 8080 with 14-bit addressing and simpler architecture.
 *
 * Based on original work by Martin Maly.
 *
 * @module 8008
 */

// Flag constants (4 flags only - no HALFCARRY)
const CARRY = 0x01;
const PARITY = 0x02;
const ZERO = 0x04;
const SIGN = 0x08;

// Pre-computed lookup table for parity/zero/sign flags (no halfcarry for 8008)
const flagTable = [6,0,0,2,0,2,2,0,0,2,2,0,2,0,0,2,0,2,2,0,2,0,0,2,2,0,0,2,0,2,2,0,0,2,2,0,2,0,0,2,2,0,0,2,0,2,2,0,2,0,0,2,0,2,2,0,0,2,2,0,2,0,0,2,0,2,2,0,2,0,0,2,2,0,0,2,0,2,2,0,2,0,0,2,0,2,2,0,0,2,2,0,2,0,0,2,2,0,0,2,0,2,2,0,0,2,2,0,2,0,0,2,0,2,2,0,2,0,0,2,2,0,0,2,0,2,2,0,14,8,8,10,8,10,10,8,8,10,10,8,10,8,8,10,8,10,10,8,10,8,8,10,10,8,8,10,8,10,10,8,8,10,10,8,10,8,8,10,10,8,8,10,8,10,10,8,10,8,8,10,8,10,10,8,8,10,10,8,10,8,8,10,8,10,10,8,10,8,8,10,10,8,8,10,8,10,10,8,10,8,8,10,8,10,10,8,8,10,10,8,10,8,8,10,10,8,8,10,8,10,10,8,8,10,10,8,10,8,8,10,8,10,10,8,10,8,8,10,10,8,8,10,8,10,10,8];

// Disassembly instruction table [mnemonic, byte_length]
const disasmTable = Array(256).fill(["???", 1]);

// Initialize disassembly table for 8008 instructions
const initDisasmTable = () => {
  // HLT
  disasmTable[0x00] = ["HLT", 1];
  disasmTable[0xFF] = ["HLT", 1];

  // MOV instructions (register to register)
  const regs = ["A", "B", "C", "D", "E", "H", "L", "M"];
  for (let dst = 0; dst < 8; dst++) {
    for (let src = 0; src < 8; src++) {
      if (dst === 7) continue; // Skip MOV M,M (invalid)
      const opcode = 0xC0 | (dst << 3) | src;
      disasmTable[opcode] = [`MOV ${regs[dst]},${regs[src]}`, 1];
    }
  }

  // MVI (immediate load)
  for (let dst = 0; dst < 8; dst++) {
    const opcode = 0x06 | (dst << 3);
    disasmTable[opcode] = [`MVI ${regs[dst]},%1`, 2];
  }

  // Arithmetic and logical operations
  const aluOps = ["ADD", "ADC", "SUB", "SBB", "ANA", "XRA", "ORA", "CMP"];
  for (let op = 0; op < 8; op++) {
    for (let reg = 0; reg < 8; reg++) {
      const opcode = 0x80 | (op << 3) | reg;
      disasmTable[opcode] = [`${aluOps[op]} ${regs[reg]}`, 1];
    }
  }

  // Immediate arithmetic
  const immOps = ["ADI", "ACI", "SUI", "SBI", "ANI", "XRI", "ORI", "CPI"];
  for (let op = 0; op < 8; op++) {
    const opcode = 0x04 | (op << 3);
    disasmTable[opcode] = [`${immOps[op]} %1`, 2];
  }

  // INR/DCR
  for (let reg = 0; reg < 8; reg++) {
    disasmTable[0x00 | (reg << 3)] = [`INR ${regs[reg]}`, 1];
    disasmTable[0x01 | (reg << 3)] = [`DCR ${regs[reg]}`, 1];
  }

  // Rotate instructions
  disasmTable[0x02] = ["RLC", 1];
  disasmTable[0x0A] = ["RRC", 1];
  disasmTable[0x12] = ["RAL", 1];
  disasmTable[0x1A] = ["RAR", 1];

  // Jump instructions
  const conditions = ["JNC", "JNZ", "JP", "JPO", "JC", "JZ", "JM", "JPE"];
  for (let cond = 0; cond < 8; cond++) {
    disasmTable[0x40 | (cond << 3)] = [`${conditions[cond]} #1`, 3];
  }
  disasmTable[0x44] = ["JMP #1", 3];

  // Call/Return instructions
  for (let cond = 0; cond < 8; cond++) {
    disasmTable[0x42 | (cond << 3)] = [`C${conditions[cond].substring(1)} #1`, 3];
    disasmTable[0x03 | (cond << 3)] = [`R${conditions[cond].substring(1)}`, 1];
  }
  disasmTable[0x46] = ["CALL #1", 3];
  disasmTable[0x07] = ["RET", 1];

  // RST instructions
  for (let vec = 0; vec < 8; vec++) {
    disasmTable[0x05 | (vec << 3)] = [`RST ${vec}`, 1];
  }

  // I/O instructions
  for (let port = 0; port < 8; port++) {
    disasmTable[0x41 | (port << 3)] = [`INP ${port}`, 1];
    disasmTable[0x51 | (port << 3)] = [`OUT ${port}`, 1];
  }
};

initDisasmTable();

/**
 * Format number as uppercase hex string with leading zeros
 */
const toHexN = (n, digits) => {
  let s = n.toString(16);
  while (s.length < digits) {
    s = "0" + s;
  }
  return s.toUpperCase();
};

const toHex2 = (n) => toHexN(n & 0xff, 2);
const toHex4 = (n) => toHexN(n & 0x3fff, 4);

/**
 * Disassemble a single 8008 instruction
 *
 * @param {number} opcode - The instruction opcode (0-255)
 * @param {number} a - First operand byte
 * @param {number} b - Second operand byte (for 3-byte instructions)
 * @returns {Array} [mnemonic_string, instruction_length]
 */
export const disasm = (opcode, a, b) => {
  const sx = disasmTable[opcode];
  let s = sx[0];
  const d8 = toHex2(a);
  s = s.replace("%1", "$" + d8);
  const d16 = toHex2(b) + toHex2(a);
  s = s.replace("#1", "$" + d16);
  return [s, sx[1]];
};

/**
 * Create an Intel 8008 CPU emulator instance
 *
 * @param {Object} callbacks - Memory and I/O callback functions
 * @param {Function} callbacks.byteTo - Write byte to memory: (address, value) => void
 * @param {Function} callbacks.byteAt - Read byte from memory: (address) => value
 * @param {Function} [callbacks.portOut] - Write byte to port: (port, value) => void
 * @param {Function} [callbacks.portIn] - Read byte from port: (port) => value
 * @returns {Object} CPU instance with public API
 */
export default (callbacks) => {
  const { byteTo, byteAt, portOut, portIn } = callbacks;

  // CPU registers
  let regs = {
    a: 0,
    b: 0,
    c: 0,
    d: 0,
    e: 0,
    f: 0,
    h: 0,
    l: 0,
    pc: 0,
    sp: 0,
    halted: 0,
    cycles: 0
  };

  // 8-level hardware stack (not memory-based like 8080)
  let stackDepth = 0;
  const STACK_MAX = 8;

  let tracer = false;

  // Register pair getters and setters
  const af = () => (regs.a << 8) | regs.f;
  const setAF = (n) => {
    regs.a = (n >> 8) & 0xFF;
    regs.f = n & 0xFF;
  };

  const bc = () => ((regs.b & 0xFF) << 8) | (regs.c & 0xFF);
  const setBC = (n) => {
    regs.b = (n >> 8) & 0xFF;
    regs.c = n & 0xFF;
  };

  const de = () => (regs.d << 8) | regs.e;
  const setDE = (n) => {
    regs.d = (n >> 8) & 0xFF;
    regs.e = n & 0xFF;
  };

  const hl = () => (regs.h << 8) | regs.l;
  const setHL = (n) => {
    regs.h = (n >> 8) & 0xFF;
    regs.l = n & 0xFF;
  };

  // Memory access helpers (14-bit address space)
  const getByte = (addr) => byteAt(addr & 0x3FFF);

  const getWord = (addr) => {
    const l = byteAt(addr & 0x3FFF);
    const h = byteAt((addr + 1) & 0x3FFF);
    return (h << 8) | l;
  };

  const nextByte = () => {
    const b = byteAt(regs.pc & 0x3FFF);
    regs.pc = (regs.pc + 1) & 0x3FFF;
    return b;
  };

  const nextWord = () => {
    const l = byteAt(regs.pc & 0x3FFF);
    const h = byteAt((regs.pc + 1) & 0x3FFF);
    regs.pc = (regs.pc + 2) & 0x3FFF;
    return ((h << 8) | l) & 0x3FFF;
  };

  const writeByte = (addr, value) => {
    const v = value & 0xFF;
    byteTo(addr & 0x3FFF, v);
  };

  const writeWord = (addr, value) => {
    const l = value;
    const h = value >> 8;
    writeByte(addr & 0x3FFF, l);
    writeByte((addr + 1) & 0x3FFF, h);
  };

  // I/O port helpers (8 input ports 0-7, 32 output ports 0-31)
  const writePort = (port, v) => {
    if (portOut) portOut(port & 0x1F, v);
  };

  const readPort = (port) => {
    if (portIn) return portIn(port & 0x7);
    return 255;
  };

  // Stack operations (8-level hardware stack)
  const pop = () => {
    if (stackDepth <= 0) {
      return 0; // Stack underflow
    }
    const value = getWord(regs.sp);
    regs.sp = (regs.sp + 2) & 0x3FFF;
    stackDepth--;
    return value & 0x3FFF;
  };

  const push = (v) => {
    if (stackDepth >= STACK_MAX) {
      return; // Stack overflow
    }
    regs.sp = (regs.sp - 2) & 0x3FFF;
    writeWord(regs.sp, v & 0x3FFF);
    stackDepth++;
  };

  // Flag calculation helpers (no HALFCARRY in 8008)

  /**
   * Calculate flags after arithmetic/logical operation
   * Uses lookup table for zero, sign, parity flags (no halfcarry)
   */
  const calcFlags = (v) => {
    const x = v & 0xFF;

    if (v >= 0x100 || v < 0) {
      regs.f |= CARRY;
    } else {
      regs.f &= ~CARRY & 0xFF;
    }

    regs.f = flagTable[x];

    if (v >= 0x100 || v < 0) {
      regs.f |= CARRY;
    }

    return x;
  };

  // Arithmetic operations (no halfcarry logic)

  const incrementByte = (o) => {
    const c = regs.f & CARRY;
    const r = calcFlags(o + 1);
    regs.f = (regs.f & ~CARRY & 0xFF) | c;
    return r;
  };

  const decrementByte = (o) => {
    const c = regs.f & CARRY;
    const r = calcFlags(o - 1);
    regs.f = (regs.f & ~CARRY & 0xFF) | c;
    return r;
  };

  const addByte = (lhs, rhs) => {
    return calcFlags(lhs + rhs);
  };

  const addByteWithCarry = (lhs, rhs) => {
    return calcFlags(lhs + rhs + ((regs.f & CARRY) ? 1 : 0));
  };

  const subtractByte = (lhs, rhs) => {
    return calcFlags(lhs - rhs);
  };

  const subtractByteWithCarry = (lhs, rhs) => {
    const nrhs = rhs + ((regs.f & CARRY) ? 1 : 0);
    return calcFlags(lhs - nrhs);
  };

  const andByte = (lhs, rhs) => {
    const x = calcFlags(lhs & rhs);
    regs.f &= ~CARRY & 0xFF;
    return x;
  };

  const xorByte = (lhs, rhs) => {
    const x = calcFlags(lhs ^ rhs);
    regs.f &= ~CARRY & 0xFF;
    return x;
  };

  const orByte = (lhs, rhs) => {
    const x = calcFlags(lhs | rhs);
    regs.f &= ~CARRY & 0xFF;
    return x;
  };

  // Conditional check for 8008 (fixed from legacy bug)
  const condCheck = (dest) => {
    const cond = dest & 3;
    let condl = 0;
    if (cond === 0) condl = (regs.f & CARRY) ? 1 : 0;
    else if (cond === 1) condl = (regs.f & ZERO) ? 1 : 0;
    else if (cond === 2) condl = (regs.f & SIGN) ? 1 : 0;
    else condl = (regs.f & PARITY) ? 1 : 0;
    return (dest >> 2) === condl ? 1 : 0;
  };

  // Instruction execution
  const execute = (i) => {
    let addr, w, c;

    // Decode instruction using bit fields
    const yyy = (i >> 3) & 0x07;
    const zzz = i & 0x07;
    const top2 = (i >> 6) & 0x03;

    switch (top2) {
      case 0: // 00xxxxxx - Special instructions
        if (i === 0x00 || i === 0xFF) {
          // HLT
          regs.halted = 1;
          regs.cycles += 4;
        } else if ((i & 0xC7) === 0x02) {
          // Rotate instructions
          switch (yyy) {
            case 0: // RLC
              c = (regs.a & 0x80) >> 7;
              if (c) regs.f |= CARRY;
              else regs.f &= ~CARRY & 0xFF;
              regs.a = ((regs.a << 1) & 0xFE) | c;
              regs.cycles += 5;
              break;
            case 1: // RRC
              c = (regs.a & 1) << 7;
              if (c) regs.f |= CARRY;
              else regs.f &= ~CARRY & 0xFF;
              regs.a = ((regs.a >> 1) & 0x7F) | c;
              regs.cycles += 5;
              break;
            case 2: // RAL
              c = (regs.f & CARRY) ? 1 : 0;
              if (regs.a & 128) regs.f |= CARRY;
              else regs.f &= ~CARRY & 0xFF;
              regs.a = ((regs.a << 1) & 0xFE) | c;
              regs.cycles += 5;
              break;
            case 3: // RAR
              c = (regs.f & CARRY) ? 128 : 0;
              if (regs.a & 1) regs.f |= CARRY;
              else regs.f &= ~CARRY & 0xFF;
              regs.a = ((regs.a >> 1) & 0x7F) | c;
              regs.cycles += 5;
              break;
          }
        } else if ((i & 0xC7) === 0x03) {
          // Return instructions
          if (condCheck(yyy)) {
            regs.pc = pop();
            regs.cycles += 5;
          } else {
            regs.cycles += 3;
          }
        } else if ((i & 0xC7) === 0x04) {
          // Immediate ALU operations
          const imm = nextByte();
          switch (yyy) {
            case 0: regs.a = addByte(regs.a, imm); break;
            case 1: regs.a = addByteWithCarry(regs.a, imm); break;
            case 2: regs.a = subtractByte(regs.a, imm); break;
            case 3: regs.a = subtractByteWithCarry(regs.a, imm); break;
            case 4: regs.a = andByte(regs.a, imm); break;
            case 5: regs.a = xorByte(regs.a, imm); break;
            case 6: regs.a = orByte(regs.a, imm); break;
            case 7: subtractByte(regs.a, imm); break; // CMP
          }
          regs.cycles += 8;
        } else if ((i & 0xC7) === 0x05) {
          // RST instructions
          push(regs.pc);
          regs.pc = yyy << 3;
          regs.cycles += 5;
        } else if ((i & 0xC7) === 0x06) {
          // MVI (load immediate)
          const imm = nextByte();
          switch (yyy) {
            case 0: regs.a = imm; break;
            case 1: regs.b = imm; break;
            case 2: regs.c = imm; break;
            case 3: regs.d = imm; break;
            case 4: regs.e = imm; break;
            case 5: regs.h = imm; break;
            case 6: regs.l = imm; break;
            case 7: writeByte(hl(), imm); break;
          }
          regs.cycles += 8;
        } else if ((i & 0xC0) === 0x00) {
          // INR/DCR
          const isINR = (i & 1) === 0;
          const reg = yyy;
          if (isINR) {
            switch (reg) {
              case 0: regs.a = incrementByte(regs.a); break;
              case 1: regs.b = incrementByte(regs.b); break;
              case 2: regs.c = incrementByte(regs.c); break;
              case 3: regs.d = incrementByte(regs.d); break;
              case 4: regs.e = incrementByte(regs.e); break;
              case 5: regs.h = incrementByte(regs.h); break;
              case 6: regs.l = incrementByte(regs.l); break;
              case 7: writeByte(hl(), incrementByte(getByte(hl()))); break;
            }
          } else {
            switch (reg) {
              case 0: regs.a = decrementByte(regs.a); break;
              case 1: regs.b = decrementByte(regs.b); break;
              case 2: regs.c = decrementByte(regs.c); break;
              case 3: regs.d = decrementByte(regs.d); break;
              case 4: regs.e = decrementByte(regs.e); break;
              case 5: regs.h = decrementByte(regs.h); break;
              case 6: regs.l = decrementByte(regs.l); break;
              case 7: writeByte(hl(), decrementByte(getByte(hl()))); break;
            }
          }
          regs.cycles += 5;
        }
        break;

      case 1: // 01xxxxxx - Jump, Call, I/O
        if ((i & 0xC7) === 0x40) {
          // Conditional jump
          const target = nextWord();
          if (condCheck(yyy)) {
            regs.pc = target;
          }
          regs.cycles += 11;
        } else if ((i & 0xC7) === 0x41) {
          // Input from port
          regs.a = readPort(yyy);
          regs.cycles += 8;
        } else if ((i & 0xC7) === 0x42) {
          // Conditional call
          const target = nextWord();
          if (condCheck(yyy)) {
            push(regs.pc);
            regs.pc = target;
            regs.cycles += 11;
          } else {
            regs.cycles += 9;
          }
        } else if (i === 0x44) {
          // Unconditional jump
          regs.pc = nextWord();
          regs.cycles += 11;
        } else if (i === 0x46) {
          // Unconditional call
          w = nextWord();
          push(regs.pc);
          regs.pc = w;
          regs.cycles += 11;
        } else if ((i & 0xC1) === 0x41) {
          // Output to port
          writePort(yyy, regs.a);
          regs.cycles += 6;
        }
        break;

      case 2: // 10xxxxxx - ALU operations with register
        {
          const op = yyy;
          let src = 0;
          switch (zzz) {
            case 0: src = regs.a; break;
            case 1: src = regs.b; break;
            case 2: src = regs.c; break;
            case 3: src = regs.d; break;
            case 4: src = regs.e; break;
            case 5: src = regs.h; break;
            case 6: src = regs.l; break;
            case 7: src = getByte(hl()); break;
          }

          switch (op) {
            case 0: regs.a = addByte(regs.a, src); break;
            case 1: regs.a = addByteWithCarry(regs.a, src); break;
            case 2: regs.a = subtractByte(regs.a, src); break;
            case 3: regs.a = subtractByteWithCarry(regs.a, src); break;
            case 4: regs.a = andByte(regs.a, src); break;
            case 5: regs.a = xorByte(regs.a, src); break;
            case 6: regs.a = orByte(regs.a, src); break;
            case 7: subtractByte(regs.a, src); break; // CMP
          }
          regs.cycles += (zzz === 7) ? 8 : 5;
        }
        break;

      case 3: // 11xxxxxx - MOV instructions
        {
          const dst = yyy;
          const src = zzz;
          let value = 0;

          // Get source value
          switch (src) {
            case 0: value = regs.a; break;
            case 1: value = regs.b; break;
            case 2: value = regs.c; break;
            case 3: value = regs.d; break;
            case 4: value = regs.e; break;
            case 5: value = regs.h; break;
            case 6: value = regs.l; break;
            case 7: value = getByte(hl()); break;
          }

          // Set destination
          switch (dst) {
            case 0: regs.a = value; break;
            case 1: regs.b = value; break;
            case 2: regs.c = value; break;
            case 3: regs.d = value; break;
            case 4: regs.e = value; break;
            case 5: regs.h = value; break;
            case 6: regs.l = value; break;
            case 7: writeByte(hl(), value); break;
          }

          regs.cycles += (src === 7 || dst === 7) ? 8 : 5;
        }
        break;
    }

    regs.pc &= 0x3FFF;
  };

  // Single step execution
  const step = () => {
    if (regs.halted === 1) {
      regs.cycles++;
      return 1;
    }

    const i = byteAt(regs.pc++);
    regs.pc &= 0x3FFF;
    const inT = regs.cycles;
    execute(i);
    return regs.cycles - inT;
  };

  // Trace helper
  const goTrace = () => {
    console.log(toHex4(regs.pc));
  };

  // Public API

  /**
   * Initialize CPU (legacy compatibility - now no-op)
   */
  const init = () => {
    // No-op: callbacks already set in constructor
  };

  /**
   * Reset CPU to initial state
   */
  const reset = () => {
    regs.pc = 0;
    regs.sp = 0;
    regs.halted = 0;
    regs.a = regs.b = regs.c = regs.d = regs.e = regs.h = regs.l = 0;
    regs.f = 0;
    regs.cycles = 0;
    stackDepth = 0;
  };

  /**
   * Execute N CPU cycles
   *
   * @param {number} timescale - Number of cycles to execute
   */
  const steps = (timescale) => {
    let Ts = timescale;

    while (Ts > 0) {
      Ts -= step();
      if (tracer) goTrace();
    }
  };

  /**
   * Enable/disable execution tracing
   *
   * @param {boolean} stat - True to enable tracing
   */
  const trace = (stat) => {
    tracer = stat;
  };

  /**
   * Get total cycle count
   *
   * @returns {number} Total cycles executed
   */
  const T = () => regs.cycles;

  /**
   * Read memory byte
   *
   * @param {number} addr - Memory address
   * @returns {number} Byte value
   */
  const memr = (addr) => byteAt(addr & 0x3FFF);

  /**
   * Get CPU register snapshot
   *
   * @returns {Object} Register values
   */
  const status = () => ({
    pc: regs.pc,
    sp: regs.sp,
    a: regs.a,
    b: regs.b,
    c: regs.c,
    d: regs.d,
    e: regs.e,
    f: regs.f,
    h: regs.h,
    l: regs.l,
    stackDepth: stackDepth
  });

  /**
   * Set register value
   *
   * @param {string} reg - Register name (case-insensitive)
   * @param {number} value - Value to set
   */
  const set = (reg, value) => {
    const r = reg.toUpperCase();
    switch (r) {
      case "PC": regs.pc = value & 0x3FFF; break;
      case "A": regs.a = value; break;
      case "B": regs.b = value; break;
      case "C": regs.c = value; break;
      case "D": regs.d = value; break;
      case "E": regs.e = value; break;
      case "H": regs.h = value; break;
      case "L": regs.l = value; break;
      case "F": regs.f = value; break;
      case "SP": regs.sp = value & 0x3FFF; break;
    }
  };

  /**
   * Format flags as string (8008 has 4 flags: SZPC)
   *
   * @returns {string} Flag string (e.g., "SZPC" or "szpc")
   */
  const flagsToString = () => {
    let f = "";
    const fx = "SZPC";
    const bits = [SIGN, ZERO, PARITY, CARRY];

    for (let i = 0; i < 4; i++) {
      const n = regs.f & bits[i];
      if (n === 0) {
        f += fx[i].toLowerCase();
      } else {
        f += fx[i];
      }
    }

    return f;
  };

  // Initialize and return API
  reset();

  return {
    init,
    reset,
    steps,
    trace,
    T,
    memr,
    status,
    set,
    flagsToString
  };
};
