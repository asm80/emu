/**
 * Intel 8080 CPU core — AssemblyScript port of src/8080.js.
 *
 * Key differences from JS version:
 * - Registers are module-level variables (no closures in AS)
 * - Dynamic property access (regs[REG[src]]) replaced with getReg/setReg switch
 * - All arithmetic uses i32/u32 with explicit masking to 8/16 bits
 */

import { byteAt, byteTo, portIn, portOut, OFFSET_REGS } from "./memory";
import { flagTable, daaTable } from "./tables";

// Flag bit constants (same as src/8080.js)
const CARRY:     u8 = 0x01;
const PARITY:    u8 = 0x04;
const HALFCARRY: u8 = 0x10;
const ZERO:      u8 = 0x40;
const SIGN:      u8 = 0x80;

// CPU registers (module-level — no closures in AssemblyScript)
let regA: u8  = 0;
let regB: u8  = 0;
let regC: u8  = 0;
let regD: u8  = 0;
let regE: u8  = 0;
let regF: u8  = 2;   // bit 1 always set
let regH: u8  = 0;
let regL: u8  = 0;
let regPC: u16 = 0;
let regSP: u16 = 0;
let regInte:   u8 = 0;
let regHalted: u8 = 0;
let regCycles: i32 = 0;

// Pending IRQ — nastaven z JS přes cpuRaiseIrq(), zkontrolován před každou instrukcí
let pendingIrq:    u8  = 0;
let pendingVector: u16 = 0x38;

// ─── Register pair helpers ───────────────────────────────────────────────────

@inline function af(): u16 { return ((regA as u16) << 8) | regF; }
@inline function setAF(n: u16): void { regA = (n >> 8) as u8; regF = (n & 0xFF) as u8; }

@inline function bc(): u16 { return ((regB as u16) << 8) | regC; }
@inline function setBC(n: u16): void { regB = (n >> 8) as u8; regC = (n & 0xFF) as u8; }

@inline function de(): u16 { return ((regD as u16) << 8) | regE; }
@inline function setDE(n: u16): void { regD = (n >> 8) as u8; regE = (n & 0xFF) as u8; }

@inline function hl(): u16 { return ((regH as u16) << 8) | regL; }
@inline function setHL(n: u16): void { regH = (n >> 8) as u8; regL = (n & 0xFF) as u8; }

// ─── Register index helpers (replaces JS regs[REG[n]]) ───────────────────────
// Register index: 0=B 1=C 2=D 3=E 4=H 5=L 6=M(memory) 7=A

@inline function getReg(r: i32): u8 {
  if (r === 0) return regB;
  if (r === 1) return regC;
  if (r === 2) return regD;
  if (r === 3) return regE;
  if (r === 4) return regH;
  if (r === 5) return regL;
  if (r === 6) return byteAt(hl());   // M = [HL]
  return regA;                         // r === 7
}

@inline function setReg8(r: i32, v: u8): void {
  if (r === 0) { regB = v; return; }
  if (r === 1) { regC = v; return; }
  if (r === 2) { regD = v; return; }
  if (r === 3) { regE = v; return; }
  if (r === 4) { regH = v; return; }
  if (r === 5) { regL = v; return; }
  if (r === 6) { byteTo(hl(), v); return; }  // M = [HL]
  regA = v;                                   // r === 7
}

// Register pair index (for 0x00–0x3F instructions): 0=BC 1=DE 2=HL 3=SP
@inline function getRP(rp: i32): u16 {
  if (rp === 0) return bc();
  if (rp === 1) return de();
  if (rp === 2) return hl();
  return regSP;
}

@inline function setRP(rp: i32, v: u16): void {
  if (rp === 0) { setBC(v); return; }
  if (rp === 1) { setDE(v); return; }
  if (rp === 2) { setHL(v); return; }
  regSP = v;
}

// Register pair index (for PUSH/POP 0xC0–0xFF): 0=BC 1=DE 2=HL 3=PSW(AF)
@inline function getRP16(rp: i32): u16 {
  if (rp === 0) return bc();
  if (rp === 1) return de();
  if (rp === 2) return hl();
  return af();
}

@inline function setRP16(rp: i32, v: u16): void {
  if (rp === 0) { setBC(v); return; }
  if (rp === 1) { setDE(v); return; }
  if (rp === 2) { setHL(v); return; }
  setAF(v);
}

// Condition code flag lookup: NZ, Z, NC, C, PO, PE, P, M
@inline function ccFlag(cc: i32): u8 {
  if (cc === 0 || cc === 1) return ZERO;
  if (cc === 2 || cc === 3) return CARRY;
  if (cc === 4 || cc === 5) return PARITY;
  return SIGN;
}

// ─── Memory helpers ───────────────────────────────────────────────────────────

@inline function getMem(addr: u16): u8   { return byteAt(addr); }
@inline function setMem(addr: u16, v: u8): void { byteTo(addr, v); }

@inline function getWord(addr: u16): u16 {
  const lo = byteAt(addr) as u16;
  const hi = byteAt((addr + 1) & 0xFFFF as u16) as u16;
  return (hi << 8) | lo;
}

@inline function setWord(addr: u16, v: u16): void {
  byteTo(addr, (v & 0xFF) as u8);
  byteTo((addr + 1) & 0xFFFF as u16, (v >> 8) as u8);
}

@inline function nextByte(): u8 {
  const b = byteAt(regPC);
  regPC = (regPC + 1) & 0xFFFF as u16;
  return b;
}

@inline function nextWord(): u16 {
  const lo = byteAt(regPC) as u16;
  const hi = byteAt((regPC + 1) & 0xFFFF as u16) as u16;
  regPC = (regPC + 2) & 0xFFFF as u16;
  return (hi << 8) | lo;
}

// ─── Stack helpers ────────────────────────────────────────────────────────────

@inline function pop(): u16 {
  const v = getWord(regSP);
  regSP = (regSP + 2) & 0xFFFF as u16;
  return v;
}

@inline function push(v: u16): void {
  regSP = (regSP - 2) & 0xFFFF as u16;
  setWord(regSP, v);
}

// ─── Flag helpers ─────────────────────────────────────────────────────────────

@inline function calcFlags(v: i32): u8 {
  const x: u8 = (v & 0xFF) as u8;
  let f: u8 = flagTable[x as i32];
  if (v >= 0x100 || v < 0) f |= CARRY; else f &= ~CARRY & 0xFF as u8;
  return f;
}

// Module-level lookup tables for half-carry (avoid per-call heap allocation)
// @ts-ignore: decorator
@lazy const HC_ADD: StaticArray<u8> = [0, HALFCARRY, HALFCARRY, HALFCARRY, 0, 0, 0, HALFCARRY];
// @ts-ignore: decorator
@lazy const HC_SUB: StaticArray<u8> = [HALFCARRY, HALFCARRY, 0, HALFCARRY, 0, HALFCARRY, 0, 0];

// Half-carry for ADD: HC_ADD[dis] where dis = (r>>1 & 4) | (a2>>2 & 2) | (a1>>3 & 1)
@inline function acADD(a1: u8, a2: u8, r: u8): void {
  const dis: i32 = ((r & 8) >> 1) | ((a2 & 8) >> 2) | ((a1 & 8) >> 3);
  regF = (regF & (~HALFCARRY & 0xFF) as u8) | HC_ADD[dis];
}

// Half-carry for SUB: HC_SUB[dis]
@inline function acSUB(a1: u8, a2: u8, r: u8): void {
  const dis: i32 = ((r & 8) >> 1) | ((a2 & 8) >> 2) | ((a1 & 8) >> 3);
  regF = (regF & (~HALFCARRY & 0xFF) as u8) | HC_SUB[dis];
}

// ─── ALU operations ───────────────────────────────────────────────────────────

@inline function incrementByte(o: u8): u8 {
  const c = regF & CARRY;
  const v = (o as i32) + 1;
  const x: u8 = (v & 0xFF) as u8;
  regF = flagTable[x as i32];
  if (v >= 0x100) regF |= CARRY; else regF &= ~CARRY & 0xFF as u8;
  regF = (regF & ~CARRY & 0xFF as u8) | c;
  if ((x & 0x0F) === 0) regF |= HALFCARRY; else regF &= ~HALFCARRY & 0xFF as u8;
  return x;
}

@inline function decrementByte(o: u8): u8 {
  const c = regF & CARRY;
  const v = (o as i32) - 1;
  const x: u8 = (v & 0xFF) as u8;
  regF = flagTable[x as i32];
  if (v < 0) regF |= CARRY; else regF &= ~CARRY & 0xFF as u8;
  regF = (regF & ~CARRY & 0xFF as u8) | c;
  if ((o & 0x0F) > 0) regF |= HALFCARRY; else regF &= ~HALFCARRY & 0xFF as u8;
  return x;
}

@inline function addByte(lhs: u8, rhs: u8): u8 {
  const v = (lhs as i32) + (rhs as i32);
  const x: u8 = (v & 0xFF) as u8;
  regF = flagTable[x as i32];
  if (v >= 0x100) regF |= CARRY; else regF &= ~CARRY & 0xFF as u8;
  acADD(lhs, rhs, x);
  return x;
}

@inline function addByteWithCarry(lhs: u8, rhs: u8): u8 {
  const cy: u8 = (regF & CARRY) ? 1 : 0;
  const rhs2: u8 = (rhs + cy) as u8;
  const v = (lhs as i32) + (rhs2 as i32);
  const x: u8 = (v & 0xFF) as u8;
  regF = flagTable[x as i32];
  if (v >= 0x100) regF |= CARRY; else regF &= ~CARRY & 0xFF as u8;
  acADD(lhs, rhs, x);
  return x;
}

@inline function subtractByte(lhs: u8, rhs: u8): u8 {
  const v = (lhs as i32) - (rhs as i32);
  const x: u8 = (v & 0xFF) as u8;
  regF = flagTable[x as i32];
  if (v < 0) regF |= CARRY; else regF &= ~CARRY & 0xFF as u8;
  acSUB(lhs, rhs, x);
  return x;
}

@inline function subtractByteWithCarry(lhs: u8, rhs: u8): u8 {
  const cy: u8 = (regF & CARRY) ? 1 : 0;
  const rhs2 = ((rhs as i32) + (cy as i32)) as u8;
  const v = (lhs as i32) - (rhs2 as i32);
  const x: u8 = (v & 0xFF) as u8;
  regF = flagTable[x as i32];
  if (v < 0) regF |= CARRY; else regF &= ~CARRY & 0xFF as u8;
  acSUB(lhs, rhs, x);
  return x;
}

@inline function andByte(lhs: u8, rhs: u8): u8 {
  const x: u8 = lhs & rhs;
  regF = flagTable[x as i32];
  regF &= ~CARRY & 0xFF as u8;
  if ((lhs & 8) | (rhs & 8)) regF |= HALFCARRY; else regF &= ~HALFCARRY & 0xFF as u8;
  return x;
}

@inline function xorByte(lhs: u8, rhs: u8): u8 {
  const x: u8 = lhs ^ rhs;
  regF = flagTable[x as i32];
  regF &= ~(CARRY | HALFCARRY) & 0xFF as u8;
  return x;
}

@inline function orByte(lhs: u8, rhs: u8): u8 {
  const x: u8 = lhs | rhs;
  regF = flagTable[x as i32];
  regF &= ~(CARRY | HALFCARRY) & 0xFF as u8;
  return x;
}

@inline function addWord(lhs: u16, rhs: u16): u16 {
  const r: u32 = (lhs as u32) + (rhs as u32);
  if (r > 0xFFFF) regF |= CARRY; else regF &= ~CARRY & 0xFF as u8;
  return (r & 0xFFFF) as u16;
}

// Dispatch ALU op (index 0–7): ADD,ADC,SUB,SBB,ANA,XRA,ORA,CMP
@inline function aluOp(op: i32, val: u8): void {
  if (op === 0) { regA = addByte(regA, val); return; }
  if (op === 1) { regA = addByteWithCarry(regA, val); return; }
  if (op === 2) { regA = subtractByte(regA, val); return; }
  if (op === 3) { regA = subtractByteWithCarry(regA, val); return; }
  if (op === 4) { regA = andByte(regA, val); return; }
  if (op === 5) { regA = xorByte(regA, val); return; }
  if (op === 6) { regA = orByte(regA, val); return; }
  subtractByte(regA, val);  // CMP: flags only, discard result
}

// ─── Instruction execution ────────────────────────────────────────────────────

function execute(i: i32): void {
  // Normalize flags before decode (bits 3,5 clear; bit 1 set)
  regF = (regF & 0xD7) | 0x02;

  // ── MOV 0x40–0x7F ──────────────────────────────────────────────────────────
  if (i >= 0x40 && i <= 0x7F) {
    if (i === 0x76) {
      // HLT
      regCycles += 7; regHalted = 1;
    } else {
      const dst = (i >> 3) & 7;
      const src = i & 7;
      const val = getReg(src);
      if (dst === 6) {
        byteTo(hl(), val); regCycles += 7;
      } else {
        setReg8(dst, val);
        regCycles += src === 6 ? 7 : 5;
      }
    }

  // ── ALU 0x80–0xBF ──────────────────────────────────────────────────────────
  } else if (i >= 0x80 && i <= 0xBF) {
    const op  = (i >> 3) & 7;
    const src = i & 7;
    const val = getReg(src);
    aluOp(op, val);
    regCycles += src === 6 ? 7 : 4;

  // ── 0x00–0x3F ──────────────────────────────────────────────────────────────
  } else if (i < 0x40) {
    const low3 = i & 7;
    const low4 = i & 0x0F;
    const reg  = (i >> 3) & 7;
    const rp   = (i >> 4) & 3;

    if (low3 === 4) {
      // INR r / INR M
      if (reg === 6) {
        const addr = hl(); byteTo(addr, incrementByte(byteAt(addr))); regCycles += 10;
      } else {
        setReg8(reg, incrementByte(getReg(reg))); regCycles += 5;
      }
    } else if (low3 === 5) {
      // DCR r / DCR M
      if (reg === 6) {
        const addr = hl(); byteTo(addr, decrementByte(byteAt(addr))); regCycles += 10;
      } else {
        setReg8(reg, decrementByte(getReg(reg))); regCycles += 5;
      }
    } else if (low3 === 6) {
      // MVI r,n / MVI M,n
      if (reg === 6) { byteTo(hl(), nextByte()); regCycles += 10; }
      else           { setReg8(reg, nextByte()); regCycles += 7; }
    } else if (low4 === 1) {
      // LXI rp,nn
      setRP(rp, nextWord()); regCycles += 10;
    } else if (low4 === 3) {
      // INX rp
      setRP(rp, (getRP(rp) + 1) & 0xFFFF as u16); regCycles += 6;
    } else if (low4 === 0xB) {
      // DCX rp
      setRP(rp, ((getRP(rp) as i32 - 1 + 0x10000) & 0xFFFF) as u16); regCycles += 6;
    } else if (low4 === 9) {
      // DAD rp
      setHL(addWord(hl(), getRP(rp))); regCycles += 11;
    } else if (low4 === 2 && rp < 2) {
      // STAX B / STAX D
      byteTo(getRP(rp), regA); regCycles += 7;
    } else if (low4 === 0xA && rp < 2) {
      // LDAX B / LDAX D
      regA = byteAt(getRP(rp)); regCycles += 7;
    } else {
      // Specific instructions
      switch (i) {
        // NOP and undocumented NOP aliases
        case 0x00: case 0x08: case 0x10: case 0x18:
        case 0x20: case 0x28: case 0x30: case 0x38:
          regCycles += 4; break;

        // RLC
        case 0x07: {
          const msb: u8 = (regA & 0x80) >> 7;
          if (msb) regF |= CARRY; else regF &= ~CARRY & 0xFF as u8;
          regA = ((regA << 1) & 0xFE) | msb;
          regCycles += 4; break;
        }
        // RRC
        case 0x0F: {
          const lsb: u8 = (regA & 1) << 7;
          if (lsb) regF |= CARRY; else regF &= ~CARRY & 0xFF as u8;
          regA = ((regA >> 1) & 0x7F) | lsb;
          regCycles += 4; break;
        }
        // RAL
        case 0x17: {
          const c: u8 = (regF & CARRY) ? 1 : 0;
          if (regA & 128) regF |= CARRY; else regF &= ~CARRY & 0xFF as u8;
          regA = ((regA << 1) & 0xFE) | c;
          regCycles += 4; break;
        }
        // RAR
        case 0x1F: {
          const cy: u8 = (regF & CARRY) ? 128 : 0;
          if (regA & 1) regF |= CARRY; else regF &= ~CARRY & 0xFF as u8;
          regA = ((regA >> 1) & 0x7F) | cy;
          regCycles += 4; break;
        }
        // SHLD (nn)
        case 0x22:
          setWord(nextWord(), hl()); regCycles += 16; break;
        // DAA
        case 0x27: {
          let temp: i32 = regA as i32;
          if (regF & CARRY)     temp |= 0x100;
          if (regF & HALFCARRY) temp |= 0x200;
          const AF = daaTable[temp];
          regA = ((AF >> 8) & 0xFF) as u8;
          regF = ((AF & 0xD7) | 0x02) as u8;
          regCycles += 4; break;
        }
        // LHLD (nn)
        case 0x2A:
          setHL(getWord(nextWord())); regCycles += 16; break;
        // CMA
        case 0x2F:
          regA ^= 0xFF; regCycles += 4; break;
        // STA (nn)
        case 0x32:
          byteTo(nextWord(), regA); regCycles += 13; break;
        // STC
        case 0x37:
          regF |= CARRY; regCycles += 4; break;
        // LDA (nn)
        case 0x3A:
          regA = byteAt(nextWord()); regCycles += 13; break;
        // CMC
        case 0x3F:
          regF ^= CARRY; regCycles += 4; break;
        default:
          regCycles += 4; break;
      }
    }

  // ── 0xC0–0xFF ──────────────────────────────────────────────────────────────
  } else {
    const low3 = i & 7;
    const low4 = i & 0x0F;
    const rp   = (i >> 4) & 3;
    const cc   = (i >> 3) & 7;

    if (low3 === 7) {
      // RST n
      push(regPC); regPC = (i & 0x38) as u16; regCycles += 11;
    } else if (low3 === 0) {
      // Rcc (conditional return)
      const flag = ccFlag(cc);
      const cond: bool = (cc & 1) ? !!(regF & flag) : !(regF & flag);
      if (cond) { regPC = pop(); regCycles += 11; } else { regCycles += 5; }
    } else if (low3 === 2) {
      // Jcc nn (conditional jump)
      const flag = ccFlag(cc);
      const cond: bool = (cc & 1) ? !!(regF & flag) : !(regF & flag);
      if (cond) { regPC = nextWord(); } else { regPC = (regPC + 2) & 0xFFFF as u16; }
      regCycles += 10;
    } else if (low3 === 4) {
      // Ccc nn (conditional call)
      const flag = ccFlag(cc);
      const cond: bool = (cc & 1) ? !!(regF & flag) : !(regF & flag);
      if (cond) {
        const w = nextWord(); push(regPC); regPC = w; regCycles += 17;
      } else {
        regPC = (regPC + 2) & 0xFFFF as u16; regCycles += 11;
      }
    } else if (low4 === 5) {
      // PUSH rp
      push(getRP16(rp)); regCycles += 11;
    } else if (low4 === 1) {
      // POP rp
      setRP16(rp, pop()); regCycles += 10;
    } else {
      switch (i) {
        // JMP nn (+ undocumented 0xCB)
        case 0xC3: case 0xCB:
          regPC = getWord(regPC); regCycles += 10; break;
        // ADI n
        case 0xC6:
          regA = addByte(regA, nextByte()); regCycles += 7; break;
        // RET (+ undocumented 0xD9)
        case 0xC9: case 0xD9:
          regPC = pop(); regCycles += 10; break;
        // ACI n
        case 0xCE:
          regA = addByteWithCarry(regA, nextByte()); regCycles += 7; break;
        // CALL nn (+ undocumented 0xDD, 0xED, 0xFD)
        case 0xCD: case 0xDD: case 0xED: case 0xFD: {
          const w = nextWord(); push(regPC); regPC = w; regCycles += 17; break;
        }
        // OUT (n),A
        case 0xD3:
          portOut(nextByte(), regA); regCycles += 10; break;
        // SUI n
        case 0xD6:
          regA = subtractByte(regA, nextByte()); regCycles += 7; break;
        // IN A,(n)
        case 0xDB:
          regA = portIn(nextByte()); regCycles += 10; break;
        // SBI n
        case 0xDE:
          regA = subtractByteWithCarry(regA, nextByte()); regCycles += 7; break;
        // XTHL
        case 0xE3: {
          const tmp = getWord(regSP); setWord(regSP, hl()); setHL(tmp);
          regCycles += 4; break;
        }
        // ANI n
        case 0xE6:
          regA = andByte(regA, nextByte()); regCycles += 7; break;
        // PCHL
        case 0xE9:
          regPC = hl(); regCycles += 4; break;
        // XCHG
        case 0xEB: {
          const tmp = de(); setDE(hl()); setHL(tmp); regCycles += 4; break;
        }
        // XRI n
        case 0xEE:
          regA = xorByte(regA, nextByte()); regCycles += 7; break;
        // DI
        case 0xF3:
          regInte = 0; regCycles += 4; break;
        // ORI n
        case 0xF6:
          regA = orByte(regA, nextByte()); regCycles += 7; break;
        // SPHL
        case 0xF9:
          regSP = hl(); regCycles += 6; break;
        // EI
        case 0xFB:
          regInte = 1; regCycles += 4; break;
        // CPI n
        case 0xFE:
          subtractByte(regA, nextByte()); regCycles += 7; break;
        default:
          regCycles += 4; break;
      }
    }
  }

  // Normalize flags after execute
  regF = (regF & 0xD7) | 0x02;
}

// ─── Public API (exported via index.ts) ──────────────────────────────────────

/**
 * Obsluží čekající IRQ pokud je povoleno přerušení (INTE=1).
 * Vrátí true pokud byl IRQ obsloužen — step() pak nesmí provést další instrukci.
 * (Reálný 8080: IRQ "spotřebuje" instrukční cyklus místo normálního fetch.)
 */
@inline function serviceIrq(): bool {
  if (pendingIrq && regInte) {
    pendingIrq = 0;
    regHalted  = 0;
    regInte    = 0;    // DI implicitní při vstupu do ISR (jako reálný 8080)
    push(regPC);
    regPC = pendingVector;
    regCycles += 11;   // RST má 11 T-stavů
    return true;
  }
  return false;
}

export function cpuReset(): void {
  regPC = 0; regSP = 0; regHalted = 0; regInte = 0;
  regA = 0; regB = 0; regC = 0; regD = 0;
  regE = 0; regH = 0; regL = 0;
  regF = 2;
  regCycles  = 0;
  pendingIrq = 0;
}

/**
 * Execute one instruction. Returns T-states consumed.
 * Returns 1 if CPU is halted (keeps time moving).
 */
export function cpuStep(): i32 {
  if (serviceIrq()) return 11;
  if (regHalted) { regCycles++; return 1; }
  const i: i32 = byteAt(regPC) as i32;
  regPC = ((regPC as i32 + 1) & 0xFFFF) as u16;
  const before: i32 = regCycles;
  execute(i);
  regPC = (regPC & 0xFFFF as u16);
  const t: i32 = regCycles - before;
  return t;
}

/**
 * Write register snapshot to fixed WASM memory offset (OFFSET_REGS).
 * Layout: PC(2) SP(2) A B C D E F H L cycles(8) = 20 bytes
 */
export function cpuStatus(): void {
  const base = OFFSET_REGS;
  store<u16>(base,      regPC);
  store<u16>(base + 2,  regSP);
  store<u8> (base + 4,  regA);
  store<u8> (base + 5,  regB);
  store<u8> (base + 6,  regC);
  store<u8> (base + 7,  regD);
  store<u8> (base + 8,  regE);
  store<u8> (base + 9,  regF);
  store<u8> (base + 10, regH);
  store<u8> (base + 11, regL);
  store<i32>(base + 12, regCycles);
}

export function cpuGetCycles(): i32 { return regCycles; }

/**
 * Tight loop uvnitř WASM — žádná JS/WASM hranice mezi kroky.
 * Spustí instrukce dokud spotřebované T-stavy nedosáhnou tStates.
 * Vrátí skutečně spotřebované T-stavy (může být o pár více kvůli zarovnání).
 */
export function cpuRunTicks(tStates: i32): i32 {
  const start: i32 = regCycles;
  const target: i32 = start + tStates;
  while (regCycles < target) {
    if (serviceIrq()) continue;
    if (regHalted) { regCycles++; continue; }
    const i: i32 = byteAt(regPC) as i32;
    regPC = ((regPC as i32 + 1) & 0xFFFF) as u16;
    execute(i);
    regPC = (regPC & 0xFFFF as u16);
  }
  return regCycles - start;
}

/**
 * Zařadí IRQ do fronty. Obsluha proběhne před příští instrukcí (v cpuStep/cpuRunTicks).
 * Pokud INTE=0, IRQ čeká až do EI.
 * @param vector adresa obslužné rutiny (výchozí 0x38 = RST 7)
 */
export function cpuRaiseIrq(vector: u16): void {
  pendingIrq    = 1;
  pendingVector = vector ? vector : 0x38;
}

/**
 * Set CPU register by numeric ID.
 * IDs: 0=PC 1=SP 2=A 3=B 4=C 5=D 6=E 7=H 8=L 9=F
 */
export function cpuSetReg(id: u8, value: u16): void {
  if (id === 0) { regPC = value & 0xFFFF as u16; return; }
  if (id === 1) { regSP = value & 0xFFFF as u16; return; }
  const v8 = (value & 0xFF) as u8;
  if (id === 2) { regA = v8; return; }
  if (id === 3) { regB = v8; return; }
  if (id === 4) { regC = v8; return; }
  if (id === 5) { regD = v8; return; }
  if (id === 6) { regE = v8; return; }
  if (id === 7) { regH = v8; return; }
  if (id === 8) { regL = v8; return; }
  if (id === 9) { regF = v8; return; }
}

export function cpuGetPC(): u16 { return regPC; }
export function cpuIsHalted(): u8 { return regHalted; }
