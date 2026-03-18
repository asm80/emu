/**
 * Hitachi HD6309 CPU Emulator
 *
 * ES6 module implementation of the HD6309 emulator, forked from MC6809.
 * The 6309 is a compatible superset of the 6809 with additional registers,
 * native execution mode, and ~80 new instructions.
 *
 * @module 6309
 */

// CPU registers
let rA, rB, rX, rY, rU, rS, PC, CC, DP;
// HD6309 additional registers
let rE, rF, rV, rMD;

// Condition code flags (EFHINZVC)
const F_CARRY = 1;
const F_OVERFLOW = 2;
const F_ZERO = 4;
const F_NEGATIVE = 8;
const F_IRQMASK = 16;
const F_HALFCARRY = 32;
const F_FIRQMASK = 64;
const F_ENTIRE = 128;

// Interrupt vectors
const vecRESET = 0xfffe;
const vecNMI = 0xfffc;
const vecSWI = 0xfffa;
const vecIRQ = 0xfff8;
const vecFIRQ = 0xfff6;
const vecSWI2 = 0xfff4;
const vecSWI3 = 0xfff2;
const vecTRAP = 0xfff0;

// Timing and interrupt state
let ticks = null;
let T = 0;
let IRQs;

// Memory interface callbacks
let byteTo, byteAt;

let cycles = [
    6,
    6 /* OIM direct */,
    6 /* AIM direct */,
    6,
    6,
    6 /* EIM direct */,
    6,
    6,
    6,
    6,
    6,
    6 /* TIM direct */,
    6,
    6,
    3,
    6 /* 00-0F */,
    0,
    0,
    2,
    4,
    4 /* SEXW */,
    0,
    5,
    9,
    0,
    2,
    3,
    0,
    3,
    2,
    8,
    6 /* 10-1F */,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    3 /* 20-2F */,
    4,
    4,
    4,
    4,
    5,
    5,
    5,
    5,
    0,
    5,
    3,
    6,
    9,
    11,
    0,
    19 /* 30-3F */,
    2,
    0,
    0,
    2,
    2,
    0,
    2,
    2,
    2,
    2,
    2,
    0,
    2,
    2,
    0,
    2 /* 40-4F */,
    2,
    0,
    0,
    2,
    2,
    0,
    2,
    2,
    2,
    2,
    2,
    0,
    2,
    2,
    0,
    2 /* 50-5F */,
    6,
    7 /* OIM indexed */,
    7 /* AIM indexed */,
    6,
    6,
    7 /* EIM indexed */,
    6,
    6,
    6,
    6,
    6,
    7 /* TIM indexed */,
    6,
    6,
    3,
    6 /* 60-6F */,
    7,
    7 /* OIM extended */,
    7 /* AIM extended */,
    7,
    7,
    7 /* EIM extended */,
    7,
    7,
    7,
    7,
    7,
    7 /* TIM extended */,
    7,
    7,
    4,
    7 /* 70-7F */,
    2,
    2,
    2,
    4,
    2,
    2,
    2,
    0,
    2,
    2,
    2,
    2,
    4,
    7,
    3,
    0 /* 80-8F */,
    4,
    4,
    4,
    6,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    6,
    7,
    5,
    5 /* 90-9F */,
    4,
    4,
    4,
    6,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    6,
    7,
    5,
    5 /* A0-AF */,
    5,
    5,
    5,
    7,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    7,
    8,
    6,
    6 /* B0-BF */,
    2,
    2,
    2,
    4,
    2,
    2,
    2,
    0,
    2,
    2,
    2,
    2,
    3,
    5 /* LDQ imm */,
    3,
    0 /* C0-CF */,
    4,
    4,
    4,
    6,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    5,
    5,
    5,
    5 /* D0-DF */,
    4,
    4,
    4,
    6,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    5,
    5,
    5,
    5 /* E0-EF */,
    5,
    5,
    5,
    7,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    6,
    6,
    6,
    6,
  ]; /* F0-FF */

// Helper: true when HD6309 is running in native mode (MD bit 0 = 1)
const isNative = () => (rMD & 1) !== 0;

// Native mode timing for page 0 (from parenthesized values in docs/6309/6309.txt sec 6.1)
// Entries without parenthesized values use same count as emulation mode
const cyclesNative = [
  5, 6, 6, 5, 5, 6, 5, 5, 5, 5, 5, 6, 5, 4, 2, 5 /* 00-0F */,
  0, 0, 1, 1, 0, 0, 4, 7, 0, 1, 2, 0, 3, 1, 5, 4 /* 10-1F */,
  3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3 /* 20-2F */,
  4, 4, 4, 4, 4, 4, 4, 4, 0, 4, 3, 17, 20, 10, 7, 21 /* 30-3F: RTI=17, SWI=21 */,
  1, 0, 0, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1 /* 40-4F */,
  1, 0, 0, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1 /* 50-5F */,
  6, 0, 0, 6, 6, 0, 6, 6, 6, 6, 6, 0, 6, 5, 3, 6 /* 60-6F */,
  6, 0, 0, 6, 6, 0, 6, 6, 6, 6, 6, 0, 6, 5, 3, 6 /* 70-7F */,
  2, 2, 2, 3, 2, 2, 2, 0, 2, 2, 2, 2, 3, 6, 3, 0 /* 80-8F */,
  3, 3, 3, 4, 3, 3, 3, 3, 3, 3, 3, 3, 4, 6, 4, 4 /* 90-9F */,
  4, 4, 4, 5, 4, 4, 4, 4, 4, 4, 4, 4, 5, 6, 5, 5 /* A0-AF */,
  4, 4, 4, 5, 4, 4, 4, 4, 4, 4, 4, 4, 5, 7, 5, 5 /* B0-BF */,
  2, 2, 2, 3, 2, 2, 2, 0, 2, 2, 2, 2, 3, 0, 3, 0 /* C0-CF */,
  3, 3, 3, 4, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4 /* D0-DF */,
  4, 4, 4, 5, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5 /* E0-EF */,
  5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5 /* F0-FF */,
];

  /* Instruction timing for the two-byte opcodes */
let cycles2 = [
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0 /* 00-0F */,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0 /* 10-1F */,
    0,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5 /* 20-2F */,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    20 /* 30-3F */,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0 /* 40-4F */,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0 /* 50-5F */,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0 /* 60-6F */,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0 /* 70-7F */,
    0,
    0,
    0,
    5,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    5,
    0,
    4,
    0 /* 80-8F */,
    0,
    0,
    0,
    7,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    7,
    0,
    6,
    6 /* 90-9F */,
    0,
    0,
    0,
    7,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    7,
    0,
    6,
    6 /* A0-AF */,
    0,
    0,
    0,
    8,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    8,
    0,
    7,
    7 /* B0-BF */,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    4,
    0 /* C0-CF */,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    6,
    6 /* D0-DF */,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    6,
    6 /* E0-EF */,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    7,
    7,
  ]; /* F0-FF */

  /* Negative and zero flags for quicker flag settings */
let flagsNZ = [
    4,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0 /* 00-0F */,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0 /* 10-1F */,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0 /* 20-2F */,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0 /* 30-3F */,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0 /* 40-4F */,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0 /* 50-5F */,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0 /* 60-6F */,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0 /* 70-7F */,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8 /* 80-8F */,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8 /* 90-9F */,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8 /* A0-AF */,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8 /* B0-BF */,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8 /* C0-CF */,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8 /* D0-DF */,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8 /* E0-EF */,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
    8,
  ]; /* F0-FF */

const setV8 = (a, b, r) => {
    CC |= ((a ^ b ^ r ^ (r >> 1)) & 0x80) >> 6;
  };
const setV8cmp = (a, b, r) => {
    if ((a ^ b) & (a ^ r)) CC |= F_OVERFLOW;
  };
const setV16 = (a, b, r) => {
    CC |= ((a ^ b ^ r ^ (r >> 1)) & 0x8000) >> 14;
  };
const getD = () => {
    return rA * 256 + rB;
  };
const setD = (v) => {
    rA = (v >> 8) & 0xFF;
    rB = v & 0xFF;
  };
const getW = () => rE * 256 + rF;
const setW = (v) => { rE = (v >> 8) & 0xFF; rF = v & 0xFF; };
const getQ = () => ((rA * 0x1000000 + rB * 0x10000 + rE * 0x100 + rF) >>> 0);
const setQ = (v) => {
  rA = (v >>> 24) & 0xFF;
  rB = (v >>> 16) & 0xFF;
  rE = (v >>> 8) & 0xFF;
  rF = v & 0xFF;
};
const PUSHB = function (b) {
    byteTo(--rS, b & 0xff);
  };
const PUSHW = function (b) {
    byteTo(--rS, b & 0xff);
    byteTo(--rS, (b >> 8) & 0xff);
  };

const PUSHBU = function (b) {
    byteTo(--rU, b & 0xff);
  };
const PUSHWU = function (b) {
    byteTo(--rU, b & 0xff);
    byteTo(--rU, (b >> 8) & 0xff);
  };
const PULLB = function (b) {
    return byteAt(rS++);
  };
const PULLW = function (b) {
    return byteAt(rS++) * 256 + byteAt(rS++);
  };

const PULLBU = function (b) {
    return byteAt(rU++);
  };
const PULLWU = function (b) {
    return byteAt(rU++) * 256 + byteAt(rU++);
  };

const PSHS = function (ucTemp) {
    let i = 0;
    if (ucTemp & 0x80) {
      PUSHW(PC);
      i += 2;
    }
    if (ucTemp & 0x40) {
      PUSHW(rU);
      i += 2;
    }
    if (ucTemp & 0x20) {
      PUSHW(rY);
      i += 2;
    }
    if (ucTemp & 0x10) {
      PUSHW(rX);
      i += 2;
    }
    if (ucTemp & 0x8) {
      PUSHB(DP);
      i++;
    }
    if (ucTemp & 0x4) {
      PUSHB(rB);
      i++;
    }
    if (ucTemp & 0x2) {
      PUSHB(rA);
      i++;
    }
    if (ucTemp & 0x1) {
      PUSHB(CC);
      i++;
    }
    T += i; //timing
  };
const PSHU = function (ucTemp) {
    let i = 0;
    if (ucTemp & 0x80) {
      PUSHWU(PC);
      i += 2;
    }
    if (ucTemp & 0x40) {
      PUSHWU(rS);
      i += 2;
    }
    if (ucTemp & 0x20) {
      PUSHWU(rY);
      i += 2;
    }
    if (ucTemp & 0x10) {
      PUSHWU(rX);
      i += 2;
    }
    if (ucTemp & 0x8) {
      PUSHBU(DP);
      i++;
    }
    if (ucTemp & 0x4) {
      PUSHBU(rB);
      i++;
    }
    if (ucTemp & 0x2) {
      PUSHBU(rA);
      i++;
    }
    if (ucTemp & 0x1) {
      PUSHBU(CC);
      i++;
    }
    T += i; //timing
  };
const PULS = function (ucTemp) {
    let i = 0;
    if (ucTemp & 0x1) {
      CC = PULLB();
      i++;
    }
    if (ucTemp & 0x2) {
      rA = PULLB();
      i++;
    }
    if (ucTemp & 0x4) {
      rB = PULLB();
      i++;
    }
    if (ucTemp & 0x8) {
      DP = PULLB();
      i++;
    }
    if (ucTemp & 0x10) {
      rX = PULLW();
      i += 2;
    }
    if (ucTemp & 0x20) {
      rY = PULLW();
      i += 2;
    }
    if (ucTemp & 0x40) {
      rU = PULLW();
      i += 2;
    }
    if (ucTemp & 0x80) {
      PC = PULLW();
      i += 2;
    }
    T += i; //timing
  };
const PULU = function (ucTemp) {
    let i = 0;
    if (ucTemp & 0x1) {
      CC = PULLBU();
      i++;
    }
    if (ucTemp & 0x2) {
      rA = PULLBU();
      i++;
    }
    if (ucTemp & 0x4) {
      rB = PULLBU();
      i++;
    }
    if (ucTemp & 0x8) {
      DP = PULLBU();
      i++;
    }
    if (ucTemp & 0x10) {
      rX = PULLWU();
      i += 2;
    }
    if (ucTemp & 0x20) {
      rY = PULLWU();
      i += 2;
    }
    if (ucTemp & 0x40) {
      rS = PULLWU();
      i += 2;
    }
    if (ucTemp & 0x80) {
      PC = PULLWU();
      i += 2;
    }
    T += i; //timing
  };

/**
 * Get PostByte Register value
 * Decodes PostByte register encoding for TFR/EXG instructions
 */
const getPBR = (ucPostByte) => {
    switch (ucPostByte & 0xf) {
      case 0x00 /* D */:
        return getD();
      case 0x1 /* X */:
        return rX;
      case 0x2 /* Y */:
        return rY;
      case 0x3 /* U */:
        return rU;
      case 0x4 /* S */:
        return rS;
      case 0x5 /* PC */:
        return PC;
      case 0x8 /* A */:
        return rA;
      case 0x9 /* B */:
        return rB;
      case 0xa /* CC */:
        return CC;
      case 0xb /* DP */:
        return DP;
      case 0x6 /* W */:
        return getW();
      case 0x7 /* V */:
        return rV;
      case 0xC /* zero register */:
      case 0xD /* zero register */:
        return 0;
      case 0xE /* E */:
        return rE;
      case 0xF /* F */:
        return rF;
      default:
        /* illegal */
        return null;
    }
  };
/**
 * Set PostByte Register value
 * Encodes PostByte register setting for TFR/EXG instructions
 */
const setPBR = (ucPostByte, v) => {
    switch (ucPostByte & 0xf /* Get destination register */) {
      case 0x00 /* D */:
        setD(v);
        return;
      case 0x1 /* X */:
        rX = v;
        return;
      case 0x2 /* Y */:
        rY = v;
        return;
      case 0x3 /* U */:
        rU = v;
        return;
      case 0x4 /* S */:
        rS = v;
        return;
      case 0x5 /* PC */:
        PC = v;
        return;
      case 0x8 /* A */:
        rA = v;
        return;
      case 0x9 /* B */:
        rB = v;
        return;
      case 0xa /* CC */:
        CC = v;
        return;
      case 0xb /* DP */:
        DP = v;
        return;
      case 0x6 /* W */:
        setW(v);
        return;
      case 0x7 /* V */:
        rV = v & 0xFFFF;
        return;
      case 0xC /* zero register - discard */:
      case 0xD /* zero register - discard */:
        return;
      case 0xE /* E */:
        rE = v & 0xFF;
        return;
      case 0xF /* F */:
        rF = v & 0xFF;
        return;
      default:
        /* illegal */
        return;
    }
  };

/**
 * TFR/EXG instruction handler
 * Transfer or exchange between registers
 *
 * @param {number} ucPostByte - PostByte encoding source and destination
 * @param {boolean} bExchange - true for EXG, false for TFR
 *
 * PostByte format: [source:4][dest:4]
 * 16-bit registers: 0x0-0x5 (D, X, Y, U, S, PC)
 * 8-bit registers: 0x8-0xB (A, B, CC, DP)
 *
 * FIXED: Original code had a bug when mixing 16-bit and 8-bit registers.
 * Per MC6809 spec, mixing register sizes produces undefined results.
 * This implementation treats mixed-size operations as no-ops for safety.
 */
const TFREXG = (ucPostByte, bExchange) => {
    // Check if mixing 16-bit and 8-bit registers (undefined behavior per 6809 spec)
    // Bit 3 of each nibble indicates 8-bit (1) vs 16-bit (0)
    const srcIs8Bit = (ucPostByte & 0x80) !== 0;
    const dstIs8Bit = (ucPostByte & 0x08) !== 0;

    // If register sizes don't match, treat as no-op (safest behavior)
    if (srcIs8Bit !== dstIs8Bit) {
      return;
    }

    if (bExchange) {
      // EXG: Exchange values between two registers
      const temp = getPBR(ucPostByte >> 4);
      setPBR(ucPostByte >> 4, getPBR(ucPostByte));
      setPBR(ucPostByte, temp);
    } else {
      // TFR: Transfer source to destination
      setPBR(ucPostByte, getPBR(ucPostByte >> 4));
    }
  };

/** Convert unsigned 8-bit to signed */
const signed = (x) => {
    return x > 127 ? x - 256 : x;
  };
/** Convert unsigned 16-bit to signed */
const signed16 = (x) => {
    return x > 32767 ? x - 65536 : x;
  };

/** Fetch next byte from PC */
const fetch = () => {
    const v = byteAt(PC++);
    PC &= 0xffff;
    return v;
  };

/** Fetch next 16-bit word from PC (big-endian) */
const fetch16 = () => {
    const v1 = byteAt(PC++);
    PC &= 0xffff;
    const v2 = byteAt(PC++);
    PC &= 0xffff;
    return v1 * 256 + v2;
  };

/** Read 16-bit word from memory (big-endian) */
const ReadWord = (addr) => {
    const v1 = byteAt(addr++);
    addr &= 0xffff;
    const v2 = byteAt(addr++);
    addr &= 0xffff;
    return v1 * 256 + v2;
  };

/** Write 16-bit word to memory (big-endian) */
const WriteWord = (addr, v) => {
    byteTo(addr++, (v >> 8) & 0xff);
    addr &= 0xffff;
    byteTo(addr, v & 0xff);
  };

const PostByte = () => {
    const pb = fetch();
    let preg;
    switch (pb & 0x60) {
      case 0:
        preg = rX;
        break;
      case 0x20:
        preg = rY;
        break;
      case 0x40:
        preg = rU;
        break;
      case 0x60:
        preg = rS;
        break;
    }

    let xchg = null;
    let addr = null;
    let sTemp;

    if (pb & 0x80) {
      /* Complex stuff */
      switch (pb & 0x0f) {
        case 0 /* EA = ,reg+ */:
          addr = preg;
          xchg = preg + 1;
          T += 2;
          break;
        case 1 /* EA = ,reg++ */:
          addr = preg;
          xchg = preg + 2;
          T += 3;
          break;
        case 2 /* EA = ,-reg */:
          xchg = preg - 1;
          addr = xchg;
          T += 2;
          break;
        case 3 /* EA = ,--reg */:
          xchg = preg - 2;
          addr = xchg;
          T += 3;
          break;
        case 4 /* EA = ,reg */:
          addr = preg;
          break;
        case 5 /* EA = ,reg + B */:
          //usAddr = *pReg + (signed short)(signed char)regs->ucRegB;
          addr = preg + signed(rB);
          T += 1;
          break;
        case 6 /* EA = ,reg + A */:
          addr = preg + signed(rA);
          T += 1;
          break;
        case 7 /* illegal */:
          addr = 0;
          break;
        case 8 /* EA = ,reg + 8-bit offset */:
          addr = preg + signed(fetch());
          T += 1;
          break;
        case 9 /* EA = ,reg + 16-bit offset */:
          addr = preg + signed16(fetch16());
          T += 4;
          break;
        case 0xa /* illegal */:
          addr = 0;
          break;
        case 0xb /* EA = ,reg + D */:
          T += 4;
          addr = preg + getD();
          break;
        case 0xc /* EA = PC + 8-bit offset */:
          sTemp = signed(fetch());
          addr = PC + sTemp;
          T += 1;
          break;
        case 0xd /* EA = PC + 16-bit offset */:
          sTemp = signed16(fetch16());
          addr = PC + sTemp;
          T += 5;
          break;
        case 0xe /* Illegal */:
          addr = 0;
          break;
        case 0xf /* EA = [,address] */:
          T += 5;
          addr = fetch16();
          break;
      } /* switch */

      addr &= 0xffff;

      if (pb & 0x10) {
        /* Indirect addressing */
        addr = byteAt(addr) * 256 + byteAt((addr + 1) & 0xffff);
        T += 3;
      }
    } /* Just a 5 bit signed offset + register */ else {
      let sByte = pb & 0x1f;
      if (sByte > 15) /* Two's complement 5-bit value */ sByte -= 32;
      addr = preg + sByte;
      T += 1;
    }

    if (xchg !== null) {
      switch (pb & 0x60) {
        case 0:
          rX = xchg;
          break;
        case 0x20:
          rY = xchg;
          break;
        case 0x40:
          rU = xchg;
          break;
        case 0x60:
          rS = xchg;
          break;
      }
    }

    return addr & 0xffff; /* Return the effective address */
  };

const flagsNZ16 = (word) => {
    CC &= ~(F_ZERO | F_NEGATIVE);
    if (word === 0) CC |= F_ZERO;
    if (word & 0x8000) CC |= F_NEGATIVE;
  };

  // ============= Operations

const oINC = (b) => {
    b++;
    b &= 0xff;
    CC &= ~(F_ZERO | F_OVERFLOW | F_NEGATIVE);
    CC |= flagsNZ[b];
    if (b === 0 || b == 0x80) CC |= F_OVERFLOW;
    return b;
  };
const oDEC = (b) => {
    b--;
    b &= 0xff;
    CC &= ~(F_ZERO | F_OVERFLOW | F_NEGATIVE);
    CC |= flagsNZ[b];
    if (b === 0x7f || b == 0xff) CC |= F_OVERFLOW;
    return b;
  };
const oSUB = (b, v) => {
    const temp = b - v;
    //temp &= 0xff;
    CC &= ~(F_CARRY | F_ZERO | F_OVERFLOW | F_NEGATIVE);
    CC |= flagsNZ[temp & 0xff];
    if (temp & 0x100) CC |= F_CARRY;
    setV8(b, v, temp);
    return temp & 0xff;
  };
const oSUB16 = (b, v) => {
    const temp = b - v;
    //temp &= 0xff;
    CC &= ~(F_CARRY | F_ZERO | F_OVERFLOW | F_NEGATIVE);
    if ((temp & 0xffff) === 0) CC |= F_ZERO;
    if (temp & 0x8000) CC |= F_NEGATIVE;
    if (temp & 0x10000) CC |= F_CARRY;
    setV16(b, v, temp);
    return temp & 0xffff;
  };
const oADD = (b, v) => {
    const temp = b + v;
    //temp &= 0xff;
    CC &= ~(F_HALFCARRY | F_CARRY | F_ZERO | F_OVERFLOW | F_NEGATIVE);
    CC |= flagsNZ[temp & 0xff];
    if (temp & 0x100) CC |= F_CARRY;
    setV8(b, v, temp);
    if ((temp ^ b ^ v) & 0x10) CC |= F_HALFCARRY;
    return temp & 0xff;
  };
const oADD16 = (b, v) => {
    const temp = b + v;
    //temp &= 0xff;
    CC &= ~(F_CARRY | F_ZERO | F_OVERFLOW | F_NEGATIVE);
    if ((temp & 0xffff) === 0) CC |= F_ZERO;
    if (temp & 0x8000) CC |= F_NEGATIVE;
    if (temp & 0x10000) CC |= F_CARRY;
    setV16(b, v, temp);
    return temp & 0xffff;
  };
const oADC = (b, v) => {
    const temp = b + v + (CC & F_CARRY);
    //temp &= 0xff;
    CC &= ~(F_HALFCARRY | F_CARRY | F_ZERO | F_OVERFLOW | F_NEGATIVE);
    CC |= flagsNZ[temp & 0xff];
    if (temp & 0x100) CC |= F_CARRY;
    setV8(b, v, temp);
    if ((temp ^ b ^ v) & 0x10) CC |= F_HALFCARRY;
    return temp & 0xff;
  };
const oSBC = (b, v) => {
    const temp = b - v - (CC & F_CARRY);
    //temp &= 0xff;
    CC &= ~(F_CARRY | F_ZERO | F_OVERFLOW | F_NEGATIVE);
    CC |= flagsNZ[temp & 0xff];
    if (temp & 0x100) CC |= F_CARRY;
    setV8(b, v, temp);
    return temp & 0xff;
  };

  /*
var oSUB = function(b,v) {
   var temp = b-v;
   //temp &= 0xff;
   CC &= ~(F_CARRY | F_ZERO | F_OVERFLOW | F_NEGATIVE);
   CC |= flagsNZ[temp & 0xff];
   if (temp&0x100) CC|=F_CARRY;
   setV8(b,v,temp);
   return temp&0xff;
};
*/

const oCMP = (b, v) => {
    const temp = b - v;
    //temp &= 0xff;
    CC &= ~(F_CARRY | F_ZERO | F_OVERFLOW | F_NEGATIVE);
    CC |= flagsNZ[temp & 0xff];
    if (temp & 0x100) CC |= F_CARRY;
    //setV8cmp(b,v,temp);
    setV8(b, v, temp);
    return;
  };
const oCMP16 = (b, v) => {
    const temp = b - v;
    //temp &= 0xff;
    CC &= ~(F_CARRY | F_ZERO | F_OVERFLOW | F_NEGATIVE);
    if ((temp & 0xffff) === 0) CC |= F_ZERO;
    if (temp & 0x8000) CC |= F_NEGATIVE;
    if (temp & 0x10000) CC |= F_CARRY;
    setV16(b, v, temp);
    return;
  };

const oNEG = (b) => {
    CC &= ~(F_CARRY | F_ZERO | F_OVERFLOW | F_NEGATIVE);
    if (b == 0x80) CC |= F_OVERFLOW;
    b = (~b & 0xff) + 1;
    if (b === 0) CC |= F_ZERO;
    else {
      CC |= F_CARRY;
    }
    if (b & 0x80) {
      CC |= F_NEGATIVE;
    }
    if (b & 0x80) CC |= F_NEGATIVE;
    return b;
  };

const oLSR = (b) => {
    CC &= ~(F_ZERO | F_CARRY | F_NEGATIVE);
    if (b & 0x01) CC |= F_CARRY;
    b >>= 1;
    if (b === 0) CC |= F_ZERO;
    return b & 0xff;
  };
const oASR = (b) => {
    CC &= ~(F_ZERO | F_CARRY | F_NEGATIVE);
    if (b & 0x01) CC |= F_CARRY;
    b = (b & 0x80) | (b >> 1);
    CC |= flagsNZ[b];
    return b;
  };
const oASL = (b) => {
    const temp = b;
    CC &= ~(F_ZERO | F_CARRY | F_NEGATIVE | F_OVERFLOW);
    if (b & 0x80) CC |= F_CARRY;
    b <<= 1;
    CC |= flagsNZ[b];
    if ((b ^ temp) & 0x80) CC |= F_OVERFLOW;
    return b;
  };
const oROL = (b) => {
    const temp = b;
    const oldc = CC & F_CARRY;
    CC &= ~(F_ZERO | F_CARRY | F_NEGATIVE | F_OVERFLOW);
    if (b & 0x80) CC |= F_CARRY;
    b = (b << 1) | oldc;
    CC |= flagsNZ[b];
    if ((b ^ temp) & 0x80) CC |= F_OVERFLOW;
    return b;
  };
const oROR = (b) => {
    const oldc = CC & F_CARRY;
    CC &= ~(F_ZERO | F_CARRY | F_NEGATIVE);
    if (b & 0x01) CC |= F_CARRY;
    b = (b >> 1) | (oldc << 7);
    CC |= flagsNZ[b];
    //    if ((b ^ temp) & 0x80) CC|=F_OVERFLOW;
    return b;
  };

const oEOR = (b, v) => {
    CC &= ~(F_ZERO | F_NEGATIVE | F_OVERFLOW);
    b ^= v;
    CC |= flagsNZ[b];
    return b;
  };
const oOR = (b, v) => {
    CC &= ~(F_ZERO | F_NEGATIVE | F_OVERFLOW);
    b |= v;
    CC |= flagsNZ[b];
    return b;
  };
const oAND = (b, v) => {
    CC &= ~(F_ZERO | F_NEGATIVE | F_OVERFLOW);
    b &= v;
    CC |= flagsNZ[b];
    return b;
  };
const oCOM = (b) => {
    CC &= ~(F_ZERO | F_NEGATIVE | F_OVERFLOW);
    b ^= 0xff;
    CC |= flagsNZ[b];
    CC |= F_CARRY;
    return b;
  };

  //----common
const dpadd = () => {
    //direct page + 8bit index
    return DP * 256 + fetch();
  };

// Unary/RMW ops indexed by lower nibble (null = special case handled inline)
const UNARY_OPS = [oNEG, null, null, oCOM, oLSR, null, oROR, oASR,
                   oASL, oROL, oDEC, null, oINC, null, null, null];

// 8-bit binary ALU ops indexed by lower nibble (null = not handled here)
// Nibbles 1 (CMP) and 5 (BIT) have no result store and are handled separately
const BIN8_OPS = [oSUB, null, oSBC, null, oAND, null, null, null,
                  oEOR, oADC, oOR, oADD, null, null, null, null];

/**
 * Trigger a hardware trap (illegal opcode or division by zero).
 * Sets the appropriate MD flag bit, pushes all registers, and vectors via $FFF0.
 *
 * @param {number} reason - 0x40 for illegal op, 0x80 for div by zero
 */
const trap = (reason) => {
  rMD |= reason;
  CC |= F_ENTIRE;
  PUSHW(PC);
  PUSHW(rU);
  PUSHW(rY);
  PUSHW(rX);
  PUSHB(DP);
  if (isNative()) {
    PUSHB(rF);
    PUSHB(rE);
  }
  PUSHB(rB);
  PUSHB(rA);
  PUSHB(CC);
  PC = ReadWord(vecTRAP);
};

const step = () => {
    const oldT = T;

    if (IRQs) {
      //;;;
    }

    let addr = null;
    let pb = null;

    const oldPC = PC;
    let opcode = fetch();
    T += isNative() ? cyclesNative[opcode] : cycles[opcode];

    // Binary 8-bit ALU: A-reg (0x80-0xBF) or B-reg (0xC0-0xFF)
    // Handles parallel nibbles: 0,1,2,4,5,6,7,8,9,A,B
    if (opcode >= 0x80) {
      const lo = opcode & 0xF;
      const isB = opcode >= 0xC0;
      const mode = (opcode >> 4) & 3;   // 0=imm, 1=dp, 2=idx, 3=ext

      // Standard parallel ALU ops (nibbles 0,1,2,4,5,8,9,A,B)
      if (lo <= 0xB && lo !== 3 && lo !== 6 && lo !== 7) {
        const val = mode === 0 ? fetch()
                  : mode === 1 ? byteAt(dpadd())
                  : mode === 2 ? byteAt(PostByte())
                  : byteAt(fetch16());
        if (lo === 1) {                              // CMP - no store
          oCMP(isB ? rB : rA, val);
        } else if (lo === 5) {                       // BIT - no store
          oAND(isB ? rB : rA, val);
        } else {
          if (isB) rB = BIN8_OPS[lo](rB, val);
          else     rA = BIN8_OPS[lo](rA, val);
        }
        return T - oldT;
      }

      // LDA/LDB (nibble 6)
      if (lo === 6) {
        const val = mode === 0 ? fetch()
                  : mode === 1 ? byteAt(dpadd())
                  : mode === 2 ? byteAt(PostByte())
                  : byteAt(fetch16());
        if (isB) rB = val; else rA = val;
        CC &= ~(F_ZERO | F_NEGATIVE | F_OVERFLOW);
        CC |= flagsNZ[isB ? rB : rA];
        return T - oldT;
      }

      // STA/STB (nibble 7, only for memory modes — no STA/STB imm)
      if (lo === 7 && mode !== 0) {
        addr = mode === 1 ? dpadd() : mode === 2 ? PostByte() : fetch16();
        const reg = isB ? rB : rA;
        byteTo(addr, reg);
        CC &= ~(F_ZERO | F_NEGATIVE | F_OVERFLOW);
        CC |= flagsNZ[reg];
        return T - oldT;
      }

      // Helper: read 16-bit operand for the current addressing mode
      const readVal = () => mode === 0 ? fetch16()
        : ReadWord(mode === 1 ? dpadd() : mode === 2 ? PostByte() : fetch16());

      // Nibble 3: SUBD (A-side) or ADDD (B-side)
      if (lo === 3) {
        if (isB) setD(oADD16(getD(), readVal()));
        else     setD(oSUB16(getD(), readVal()));
        return T - oldT;
      }

      // Nibble C: CMPX (A-side) or LDD (B-side)
      if (lo === 0xC) {
        const val = readVal();
        if (isB) { setD(val); flagsNZ16(val); CC &= ~F_OVERFLOW; }
        else       oCMP16(rX, val);
        return T - oldT;
      }

      // Nibble D: JSR/BSR (A-side) or STD (B-side, no imm)
      // NOTE: STD sets only ~F_OVERFLOW — preserving original behavior (no flagsNZ16 call)
      if (lo === 0xD) {
        if (isB) {
          if (mode !== 0) {
            addr = mode === 1 ? dpadd() : mode === 2 ? PostByte() : fetch16();
            WriteWord(addr, getD());
            CC &= ~F_OVERFLOW;
          }
        } else if (mode === 0) {                   // BSR (signed 8-bit offset)
          addr = signed(fetch()); PUSHW(PC); PC += addr;
        } else {                                   // JSR
          addr = mode === 1 ? dpadd() : mode === 2 ? PostByte() : fetch16();
          PUSHW(PC); PC = addr;
        }
        return T - oldT;
      }

      // Nibble E: LDX (A-side) or LDU (B-side)
      // FIX: LDU direct (0xDE) had flagsNZ16(rX) — corrected to flagsNZ16(rU)
      if (lo === 0xE) {
        const val = readVal();
        if (isB) rU = val; else rX = val;
        flagsNZ16(isB ? rU : rX);
        CC &= ~F_OVERFLOW;
        return T - oldT;
      }

      // Nibble F: STX (A-side) or STU (B-side) — no imm mode
      if (lo === 0xF && mode !== 0) {
        addr = mode === 1 ? dpadd() : mode === 2 ? PostByte() : fetch16();
        const val = isB ? rU : rX;
        WriteWord(addr, val); flagsNZ16(val); CC &= ~F_OVERFLOW;
        return T - oldT;
      }
    }

    // Inherent unary on A (0x40-0x4F) or B (0x50-0x5F)
    if (opcode >= 0x40 && opcode < 0x60) {
      const lo = opcode & 0xF;
      const isB = opcode >= 0x50;
      if (UNARY_OPS[lo]) {
        if (isB) rB = UNARY_OPS[lo](rB); else rA = UNARY_OPS[lo](rA);
      } else if (lo === 0xD) {                      // TST A/B
        CC &= ~(F_ZERO | F_NEGATIVE | F_OVERFLOW);
        CC |= flagsNZ[isB ? rB : rA];
      } else if (lo === 0xF) {                      // CLR A/B
        if (isB) rB = 0; else rA = 0;
        CC &= ~(F_NEGATIVE | F_OVERFLOW | F_CARRY);
        CC |= F_ZERO;
      }
      return T - oldT;
    }

    // RMW: DP (0x00-0x0F), Indexed (0x60-0x6F), Extended (0x70-0x7F)
    if (opcode < 0x10 || (opcode >= 0x60 && opcode < 0x80)) {
      const lo = opcode & 0xF;
      const addrFn = opcode < 0x10 ? dpadd : opcode < 0x70 ? PostByte : fetch16;
      if (lo === 0x1 || lo === 0x2 || lo === 0x5 || lo === 0xB) {
        // OIM(1) AIM(2) EIM(5) TIM(B): imm byte first, then address
        const imm = fetch();
        addr = addrFn();
        const memVal = byteAt(addr);
        let result;
        if (lo === 0x1) result = memVal | imm;       // OIM
        else if (lo === 0x2) result = memVal & imm;  // AIM
        else if (lo === 0x5) result = memVal ^ imm;  // EIM
        else result = memVal & imm;                  // TIM (no write)
        CC &= ~(F_ZERO | F_NEGATIVE | F_OVERFLOW);
        CC |= flagsNZ[result & 0xFF];
        if (lo !== 0xB) byteTo(addr, result & 0xFF); // TIM does not write
      } else if (UNARY_OPS[lo]) {
        addr = addrFn();
        byteTo(addr, UNARY_OPS[lo](byteAt(addr)));
      } else if (lo === 0xD) {                      // TST
        addr = addrFn();
        CC &= ~(F_ZERO | F_NEGATIVE | F_OVERFLOW);
        CC |= flagsNZ[byteAt(addr)];
      } else if (lo === 0xE) {                      // JMP
        PC = addrFn();
      } else if (lo === 0xF) {                      // CLR
        addr = addrFn();
        byteTo(addr, 0);
        CC &= ~(F_CARRY | F_NEGATIVE | F_OVERFLOW);
        CC |= F_ZERO;
      }
      return T - oldT;
    }

    switch (opcode) {
      case 0x12: //NOP
        break;
      case 0x13: //SYNC
        break;
      case 0x14: // SEXW: sign extend W bit 15 into D
        if (rE & 0x80) { rA = 0xFF; rB = 0xFF; }
        else { rA = 0; rB = 0; }
        break;
      case 0xCD: // LDQ immediate: load 4 bytes into Q (A:B:E:F)
        rA = fetch(); rB = fetch(); rE = fetch(); rF = fetch();
        CC &= ~(F_ZERO | F_NEGATIVE | F_OVERFLOW);
        if (getQ() === 0) CC |= F_ZERO;
        if (rA & 0x80) CC |= F_NEGATIVE;
        break;
      case 0x16: //LBRA relative
        addr = signed16(fetch16());
        PC += addr;
        break;
      case 0x17: //LBSR relative
        addr = signed16(fetch16());
        PUSHW(PC);
        PC += addr;
        break;
      case 0x19: //DAA
        let tdaa;
        //var precarry = CC & F_CARRY;
        let cf = 0;
        const nhi = rA & 0xf0;
        const nlo = rA & 0x0f;
        if (nlo > 0x09 || CC & 0x20) cf |= 0x06;
        if (nhi > 0x80 && nlo > 0x09) cf |= 0x60;
        if (nhi > 0x90 || CC & 0x01) cf |= 0x60;
        tdaa = cf + rA;
        CC &= ~(F_NEGATIVE | F_ZERO | F_OVERFLOW);
        if (tdaa & 0x100) CC |= F_CARRY;
        rA = tdaa & 0xff;
        CC |= flagsNZ[rA];
        //console.log(precarry, CC & F_CARRY);
        break;
      case 0x1a: //ORCC
        CC |= fetch();
        break;
      case 0x1c: //ANDCC
        CC &= fetch();
        break;
      case 0x1d: //SEX
        rA = rB & 0x80 ? 0xff : 0;
        flagsNZ16(getD());
        CC &= ~F_OVERFLOW;
        break;
      case 0x1e: //EXG
        pb = fetch();
        TFREXG(pb, true);
        break;
      case 0x1f: //EXG
        pb = fetch();
        TFREXG(pb, false);
        break;

      case 0x20: //BRA
        addr = signed(fetch());
        PC += addr;
        break;
      case 0x21: //BRN
        addr = signed(fetch());
        break;
      case 0x22: //BHI
        addr = signed(fetch());
        if (!(CC & (F_CARRY | F_ZERO))) PC += addr;
        break;
      case 0x23: //BLS
        addr = signed(fetch());
        if (CC & (F_CARRY | F_ZERO)) PC += addr;
        break;
      case 0x24: //BCC
        addr = signed(fetch());
        if (!(CC & F_CARRY)) PC += addr;
        break;
      case 0x25: //BCS
        addr = signed(fetch());
        if (CC & F_CARRY) PC += addr;
        break;
      case 0x26: //BNE
        addr = signed(fetch());
        if (!(CC & F_ZERO)) PC += addr;
        break;
      case 0x27: //BEQ
        addr = signed(fetch());
        if (CC & F_ZERO) PC += addr;
        break;
      case 0x28: //BVC
        addr = signed(fetch());
        if (!(CC & F_OVERFLOW)) PC += addr;
        break;
      case 0x29: //BVS
        addr = signed(fetch());
        if (CC & F_OVERFLOW) PC += addr;
        break;
      case 0x2a: //BPL
        addr = signed(fetch());
        if (!(CC & F_NEGATIVE)) PC += addr;
        break;
      case 0x2b: //BMI
        addr = signed(fetch());
        if (CC & F_NEGATIVE) PC += addr;
        break;
      case 0x2c: //BGE
        addr = signed(fetch());
        if (!((CC & F_NEGATIVE) ^ ((CC & F_OVERFLOW) << 2))) PC += addr;
        break;
      case 0x2d: //BLT
        addr = signed(fetch());
        if ((CC & F_NEGATIVE) ^ ((CC & F_OVERFLOW) << 2)) PC += addr;
        break;
      case 0x2e: //BGT
        addr = signed(fetch());
        //if (!((CC&F_NEGATIVE) ^ ((CC&F_OVERFLOW)<<2) || (CC&F_ZERO))) PC += addr;
        if (!((CC & F_NEGATIVE) ^ ((CC & F_OVERFLOW) << 2) || CC & F_ZERO))
          PC += addr;
        break;
      case 0x2f: //BLE
        addr = signed(fetch());
        if ((CC & F_NEGATIVE) ^ ((CC & F_OVERFLOW) << 2) || CC & F_ZERO)
          PC += addr;
        break;

      case 0x30: //LEAX
        rX = PostByte();
        if (rX === 0) CC |= F_ZERO;
        else CC &= ~F_ZERO;
        break;
      case 0x31: //LEAY
        rY = PostByte();
        if (rY === 0) CC |= F_ZERO;
        else CC &= ~F_ZERO;
        break;
      case 0x32: //LEAS
        rS = PostByte();
        break;
      case 0x33: //LEAU
        rU = PostByte();
        break;

      case 0x34: //PSHS
        PSHS(fetch());
        break;
      case 0x35: //PULS
        PULS(fetch());
        break;
      case 0x36: //PSHU
        PSHU(fetch());
        break;
      case 0x37: //PULU
        PULU(fetch());
        break;
      case 0x39: //RTS
        PC = PULLW();
        break;
      case 0x3a: //ABX
        rX += rB;
        break;
      case 0x3b: //RTI
        CC = PULLB();
        if (CC & F_ENTIRE) {
          T += isNative() ? 11 : 9;
          rA = PULLB();
          rB = PULLB();
          if (isNative()) {
            rE = PULLB();
            rF = PULLB();
          }
          DP = PULLB();
          rX = PULLW();
          rY = PULLW();
          rU = PULLW();
        }
        PC = PULLW();
        break;
      case 0x3c: //CWAI **todo
        CC &= fetch();
        break;
      case 0x3d: //MUL
        addr = rA * rB;
        if (addr === 0) CC |= F_ZERO;
        else CC &= ~F_ZERO;
        if (addr & 0x80) CC |= F_CARRY;
        else CC &= ~F_CARRY;
        setD(addr);
        break;
      case 0x3f: //SWI
        CC |= F_ENTIRE;
        PUSHW(PC);
        PUSHW(rU);
        PUSHW(rY);
        PUSHW(rX);
        PUSHB(DP);
        PUSHB(rB);
        PUSHB(rA);
        PUSHB(CC);
        CC |= F_IRQMASK | F_FIRQMASK;
        PC = ReadWord(vecSWI);
        break;

      // page 1
      case 0x10: //page 1
        {
          opcode = fetch();
          T += cycles2[opcode];

          // Dispatch 16-bit register ops in page 1 prefix
          if (opcode >= 0x80) {
            const lo = opcode & 0xF;
            const isB = opcode >= 0xC0;
            const mode = (opcode >> 4) & 3;
            const readVal = () => mode === 0 ? fetch16()
              : ReadWord(mode === 1 ? dpadd() : mode === 2 ? PostByte() : fetch16());

            if (lo === 3) {                            // CMPD (A-side only)
              if (!isB) oCMP16(getD(), readVal());
              return T - oldT;
            }
            if (lo === 0xC) {                          // CMPY (A-side only)
              if (!isB) oCMP16(rY, readVal());
              return T - oldT;
            }
            if (lo === 0xE) {                          // LDY (A-side) or LDS (B-side)
              const val = readVal();
              if (isB) rS = val; else rY = val;
              flagsNZ16(isB ? rS : rY);
              CC &= ~F_OVERFLOW;
              return T - oldT;
            }
            if (lo === 0xF && mode !== 0) {            // STY (A-side) or STS (B-side)
              addr = mode === 1 ? dpadd() : mode === 2 ? PostByte() : fetch16();
              WriteWord(addr, isB ? rS : rY);
              flagsNZ16(isB ? rS : rY);
              CC &= ~F_OVERFLOW;
              return T - oldT;
            }
          }

          switch (opcode) {
            case 0x21: //BRN
              addr = signed16(fetch16());
              break;
            case 0x22: //BHI
              addr = signed16(fetch16());
              if (!(CC & (F_CARRY | F_ZERO))) PC += addr;
              break;
            case 0x23: //BLS
              addr = signed16(fetch16());
              if (CC & (F_CARRY | F_ZERO)) PC += addr;
              break;
            case 0x24: //BCC
              addr = signed16(fetch16());
              if (!(CC & F_CARRY)) PC += addr;
              break;
            case 0x25: //BCS
              addr = signed16(fetch16());
              if (CC & F_CARRY) PC += addr;
              break;
            case 0x26: //BNE
              addr = signed16(fetch16());
              if (!(CC & F_ZERO)) PC += addr;
              break;
            case 0x27: //BEQ
              addr = signed16(fetch16());
              if (CC & F_ZERO) PC += addr;
              break;
            case 0x28: //BVC
              addr = signed16(fetch16());
              if (!(CC & F_OVERFLOW)) PC += addr;
              break;
            case 0x29: //BVS
              addr = signed16(fetch16());
              if (CC & F_OVERFLOW) PC += addr;
              break;
            case 0x2a: //BPL
              addr = signed16(fetch16());
              if (!(CC & F_NEGATIVE)) PC += addr;
              break;
            case 0x2b: //BMI
              addr = signed16(fetch16());
              if (CC & F_NEGATIVE) PC += addr;
              break;
            case 0x2c: //BGE
              addr = signed16(fetch16());
              if (!((CC & F_NEGATIVE) ^ ((CC & F_OVERFLOW) << 2))) PC += addr;
              break;
            case 0x2d: //BLT
              addr = signed16(fetch16());
              if ((CC & F_NEGATIVE) ^ ((CC & F_OVERFLOW) << 2)) PC += addr;
              break;
            case 0x2e: //BGT
              addr = signed16(fetch16());
              //if (!((CC&F_NEGATIVE) ^ ((CC&F_OVERFLOW)<<2) || (CC&F_ZERO))) PC += addr;
              if (
                !((CC & F_NEGATIVE) ^ ((CC & F_OVERFLOW) << 2) && CC & F_ZERO)
              )
                PC += addr;
              break;
            case 0x2f: //BLE
              addr = signed16(fetch16());
              if ((CC & F_NEGATIVE) ^ ((CC & F_OVERFLOW) << 2) || CC & F_ZERO)
                PC += addr;
              break;
            case 0x3f: //SWI2
              CC |= F_ENTIRE;
              PUSHW(PC);
              PUSHW(rU);
              PUSHW(rY);
              PUSHW(rX);
              PUSHB(DP);
              PUSHB(rB);
              PUSHB(rA);
              PUSHB(CC);
              CC |= F_IRQMASK | F_FIRQMASK;
              PC = ReadWord(vecSWI2);
              break;
          }
        }
        break;
      // page 2
      case 0x11: //page 2
        {
          opcode = fetch();
          T += cycles2[opcode];

          // Dispatch 16-bit compare ops in page 2 prefix
          if (opcode >= 0x80) {
            const lo = opcode & 0xF;
            const mode = (opcode >> 4) & 3;
            const readVal = () => mode === 0 ? fetch16()
              : ReadWord(mode === 1 ? dpadd() : mode === 2 ? PostByte() : fetch16());

            if (lo === 3) { oCMP16(rU, readVal()); return T - oldT; }  // CMPU
            if (lo === 0xC) { oCMP16(rS, readVal()); return T - oldT; } // CMPS
          }

          switch (opcode) {
            case 0x3f: //SWI3
              CC |= F_ENTIRE;
              PUSHW(PC);
              PUSHW(rU);
              PUSHW(rY);
              PUSHW(rX);
              PUSHB(DP);
              PUSHB(rB);
              PUSHB(rA);
              PUSHB(CC);
              CC |= F_IRQMASK | F_FIRQMASK;
              PC = ReadWord(vecSWI3);
              break;
          }
        }
        break;

      default:
        // Illegal/undefined opcode — trigger trap via $FFF0
        trap(0x40);
        break;
    }

    rA &= 0xff;
    rB &= 0xff;
    CC &= 0xff;
    DP &= 0xff;
    rX &= 0xffff;
    rY &= 0xffff;
    rU &= 0xffff;
    rS &= 0xffff;
    PC &= 0xffff;
    return T - oldT;
  };

const reset = () => {
    rA = rA | 0x00;
    rB = rB | 0x00;
    rX = rX | 0x00;
    rY = rY | 0x00;
    rU = rU | 0x00;
    rS = rS | 0x00;
    PC = ReadWord(vecRESET);
    DP = 0;
    CC |= F_FIRQMASK | F_IRQMASK;
    rE = 0;
    rF = 0;
    // rV is NOT reset here — it survives power cycle per spec
    rMD = 0;
    T = 0;
  };

  //---------- Disassembler

  /*
ILLEGAL 0
DIRECT 1
INHERENT 2
BRANCH_REL_16 3
IMMEDIAT_8 4
BRANCH_REL_8 5
INDEXED 6
EXTENDED 7
IMMEDIAT_16 8

PSHS 10
PSHU 11

EXG, TFR 20
*/
let ds = [
    [2, 1, "NEG"],
    [1, 0, "???"],
    [1, 0, "???"],
    [2, 1, "COM"],
    [2, 1, "LSR"],
    [1, 0, "???"],
    [2, 1, "ROR"],
    [2, 1, "ASR"],
    [2, 1, "LSL"],
    [2, 1, "ROL"],
    [2, 1, "DEC"],
    [1, 0, "???"],
    [2, 1, "INC"],
    [2, 1, "TST"],
    [2, 1, "JMP"],
    [2, 1, "CLR"],
    [1, 0, "Prefix"],
    [1, 0, "Prefix"],
    [1, 2, "NOP"],
    [1, 2, "SYNC"],
    [1, 0, "???"],
    [1, 0, "???"],
    [3, 3, "LBRA"],
    [3, 3, "LBSR"],
    [1, 0, "???"],
    [1, 2, "DAA"],
    [2, 4, "ORCC"],
    [1, 0, "???"],
    [2, 4, "ANDCC"],
    [1, 2, "SEX"],
    [2, 20, "EXG"],
    [2, 20, "TFR"],
    [2, 5, "BRA"],
    [2, 5, "BRN"],
    [2, 5, "BHI"],
    [2, 5, "BLS"],
    [2, 5, "BCC"],
    [2, 5, "BCS"],
    [2, 5, "BNE"],
    [2, 5, "BEQ"],
    [2, 5, "BVC"],
    [2, 5, "BVS"],
    [2, 5, "BPL"],
    [2, 5, "BMI"],
    [2, 5, "BGE"],
    [2, 5, "BLT"],
    [2, 5, "BGT"],
    [2, 5, "BLE"],
    [2, 6, "LEAX"],
    [2, 6, "LEAY"],
    [2, 6, "LEAS"],
    [2, 6, "LEAU"],
    [2, 10, "PSHS"],
    [2, 10, "PULS"],
    [2, 11, "PSHU"],
    [2, 11, "PULU"],
    [1, 0, "???"],
    [1, 2, "RTS"],
    [1, 2, "ABX"],
    [1, 2, "RTI"],
    [2, 2, "CWAI"],
    [1, 2, "MUL"],
    [1, 2, "RESET"],
    [1, 2, "SWI1"],
    [1, 2, "NEGA"],
    [1, 0, "???"],
    [1, 0, "???"],
    [1, 2, "COMA"],
    [1, 2, "LSRA"],
    [1, 0, "???"],
    [1, 2, "RORA"],
    [1, 2, "ASRA"],
    [1, 2, "ASLA"],
    [1, 2, "ROLA"],
    [1, 2, "DECA"],
    [1, 0, "???"],
    [1, 2, "INCA"],
    [1, 2, "TSTA"],
    [1, 0, "???"],
    [1, 2, "CLRA"],
    [1, 2, "NEGB"],
    [1, 0, "???"],
    [1, 0, "???"],
    [1, 2, "COMB"],
    [1, 2, "LSRB"],
    [1, 0, "???"],
    [1, 2, "RORB"],
    [1, 2, "ASRB"],
    [1, 2, "ASLB"],
    [1, 2, "ROLB"],
    [1, 2, "DECB"],
    [1, 0, "???"],
    [1, 2, "INCB"],
    [1, 2, "TSTB"],
    [1, 0, "???"],
    [1, 2, "CLRB"],
    [2, 6, "NEG"],
    [1, 0, "???"],
    [1, 0, "???"],
    [2, 6, "COM"],
    [2, 6, "LSR"],
    [1, 0, "???"],
    [2, 6, "ROR"],
    [2, 6, "ASR"],
    [2, 6, "LSL"],
    [2, 6, "ROL"],
    [2, 6, "DEC"],
    [1, 0, "???"],
    [2, 6, "INC"],
    [2, 6, "TST"],
    [2, 6, "JMP"],
    [2, 6, "CLR"],
    [3, 7, "NEG"],
    [1, 0, "???"],
    [1, 0, "???"],
    [3, 7, "COM"],
    [3, 7, "LSR"],
    [1, 0, "???"],
    [3, 7, "ROR"],
    [3, 7, "ASR"],
    [3, 7, "LSL"],
    [3, 7, "ROL"],
    [3, 7, "DEC"],
    [1, 0, "???"],
    [3, 7, "INC"],
    [3, 7, "TST"],
    [3, 7, "JMP"],
    [3, 7, "CLR"],
    [2, 4, "SUBA"],
    [2, 4, "CMPA"],
    [2, 4, "SBCA"],
    [3, 8, "SUBD"],
    [2, 4, "ANDA"],
    [2, 4, "BITA"],
    [2, 4, "LDA"],
    [1, 0, "???"],
    [2, 4, "EORA"],
    [2, 4, "ADCA"],
    [2, 4, "ORA"],
    [2, 4, "ADDA"],
    [3, 8, "CMPX"],
    [2, 5, "BSR"],
    [3, 8, "LDX"],
    [1, 0, "???"],
    [2, 1, "SUBA"],
    [2, 1, "CMPA"],
    [2, 1, "SBCA"],
    [2, 1, "SUBd"],
    [2, 1, "ANDA"],
    [2, 1, "BITA"],
    [2, 1, "LDA"],
    [2, 1, "STA"],
    [2, 1, "EORA"],
    [2, 1, "ADCA"],
    [2, 1, "ORA"],
    [2, 1, "ADDA"],
    [2, 1, "CMPX"],
    [2, 1, "JSR"],
    [2, 1, "LDX"],
    [2, 1, "STX"],
    [2, 6, "SUBA"],
    [2, 6, "CMPA"],
    [2, 6, "SBCA"],
    [2, 6, "SUBD"],
    [2, 6, "ANDA"],
    [2, 6, "BITA"],
    [2, 6, "LDA"],
    [2, 6, "STA"],
    [2, 6, "EORA"],
    [2, 6, "ADCA"],
    [2, 6, "ORA"],
    [2, 6, "ADDA"],
    [2, 6, "CMPX"],
    [2, 6, "JSR"],
    [2, 6, "LDX"],
    [2, 6, "STX"],
    [3, 7, "SUBA"],
    [3, 7, "CMPA"],
    [3, 7, "SBCA"],
    [3, 7, "SUBD"],
    [3, 7, "ANDA"],
    [3, 7, "BITA"],
    [3, 7, "LDA"],
    [3, 7, "STA"],
    [3, 7, "EORA"],
    [3, 7, "ADCA"],
    [3, 7, "ORA"],
    [3, 7, "ADDA"],
    [3, 7, "CMPX"],
    [3, 7, "JSR"],
    [3, 7, "LDX"],
    [3, 7, "STX"],
    [2, 4, "SUBB"],
    [2, 4, "CMPB"],
    [2, 4, "SBCB"],
    [3, 8, "ADDD"],
    [2, 4, "ANDB"],
    [2, 4, "BITB"],
    [2, 4, "LDB"],
    [1, 0, "???"],
    [2, 4, "EORB"],
    [2, 4, "ADCB"],
    [2, 4, "ORB"],
    [2, 4, "ADDB"],
    [3, 8, "LDD"],
    [1, 0, "???"],
    [3, 8, "LDU"],
    [1, 0, "???"],
    [2, 1, "SUBB"],
    [2, 1, "CMPB"],
    [2, 1, "SBCB"],
    [2, 1, "ADDD"],
    [2, 1, "ANDB"],
    [2, 1, "BITB"],
    [2, 1, "LDB"],
    [2, 1, "STB"],
    [2, 1, "EORB"],
    [2, 1, "ADCB"],
    [2, 1, "ORB "],
    [2, 1, "ADDB"],
    [2, 1, "LDD "],
    [2, 1, "STD "],
    [2, 1, "LDU "],
    [2, 1, "STU "],
    [2, 6, "SUBB"],
    [2, 6, "CMPB"],
    [2, 6, "SBCB"],
    [2, 6, "ADDD"],
    [2, 6, "ANDB"],
    [2, 6, "BITB"],
    [2, 6, "LDB"],
    [2, 6, "STB"],
    [2, 6, "EORB"],
    [2, 6, "ADCB"],
    [2, 6, "ORB"],
    [2, 6, "ADDB"],
    [2, 6, "LDD"],
    [2, 6, "STD"],
    [2, 6, "LDU"],
    [2, 6, "STU"],
    [3, 7, "SUBB"],
    [3, 7, "CMPB"],
    [3, 7, "SBCB"],
    [3, 7, "ADDD"],
    [3, 7, "ANDB"],
    [3, 7, "BITB"],
    [3, 7, "LDB"],
    [3, 7, "STB"],
    [3, 7, "EORB"],
    [3, 7, "ADCB"],
    [3, 7, "ORB"],
    [3, 7, "ADDB"],
    [3, 7, "LDD"],
    [3, 7, "STD"],
    [3, 7, "LDU"],
    [3, 7, "STU"],
  ];

let ds11 = {
    0x3f: [2, 2, "SWI3"],
    0x83: [4, 8, "CMPU"],
    0x8c: [4, 8, "CMPS"],
    0x93: [3, 1, "CMPU"],
    0x9c: [3, 1, "CMPS"],
    0xa3: [3, 6, "CMPU"],
    0xac: [3, 6, "CMPS"],
    0xb3: [4, 7, "CMPU"],
    0xbc: [4, 7, "CMPS"],
  };

let ds10 = {
    0x21: [5, 3, "LBRN"],
    0x22: [5, 3, "LBHI"],
    0x23: [5, 3, "LBLS"],
    0x24: [5, 3, "LBCC"],
    0x25: [5, 3, "LBCS"],
    0x26: [5, 3, "LBNE"],
    0x27: [5, 3, "LBEQ"],
    0x28: [5, 3, "LBVC"],
    0x29: [5, 3, "LBVS"],
    0x2a: [5, 3, "LBPL"],
    0x2b: [5, 3, "LBMI"],
    0x2c: [5, 3, "LBGE"],
    0x2d: [5, 3, "LBLT"],
    0x2e: [5, 3, "LBGT"],
    0x2f: [5, 3, "LBLE"],
    0x3f: [2, 2, "SWI2"],
    0x83: [4, 8, "CMPD"],
    0x8c: [4, 8, "CMPY"],
    0x8e: [4, 8, "LDY"],
    0x93: [3, 1, "CMPD"],
    0x9c: [3, 1, "CMPY"],
    0x9e: [3, 1, "LDY"],
    0x9f: [3, 1, "STY"],
    0xa3: [3, 6, "CMPD"],
    0xac: [3, 6, "CMPY"],
    0xae: [3, 6, "LDY"],
    0xaf: [3, 6, "STY"],
    0xb3: [4, 7, "CMPD"],
    0xbc: [4, 7, "CMPY"],
    0xbe: [4, 7, "LDY"],
    0xbf: [4, 7, "STY"],
    0xce: [4, 8, "LDS"],
    0xde: [3, 1, "LDS"],
    0xdf: [3, 1, "STS"],
    0xee: [3, 6, "LDS"],
    0xef: [3, 6, "STS"],
    0xfe: [4, 7, "LDS"],
    0xff: [4, 7, "STS"],
  };
  /*
ILLEGAL 0
DIRECT 1
INHERENT 2
BRANCH_REL_16 3
IMMEDIAT_8 4
BRANCH_REL_8 5
INDEXED 6
EXTENDED 7
IMMEDIAT_16 8
*/

export const disasm = function (i, a, b, c, d, pc) {
    const toHexN = function (n, d) {
      let s = n.toString(16);
      while (s.length < d) {
        s = "0" + s;
      }
      return s.toUpperCase();
    };

    const toHex2 = function (n) {
      return toHexN(n & 0xff, 2);
    };
    const toHex4 = function (n) {
      return toHexN(n, 4);
    };
    var rx, ro, j;
    let sx = ds[i];
    if (i === 0x10) {
      sx = ds10[a];
      if (sx === undefined) {
        return ["???", 2];
      }
      i = a;
      a = b;
      b = c;
      c = d;
    }
    if (i === 0x11) {
      sx = ds11[a];
      if (sx === undefined) {
        return ["???", 2];
      }
      i = a;
      a = b;
      b = c;
      c = d;
    }
    let bytes = sx[0];
    const mode = sx[1];
    let mnemo = sx[2];

    switch (mode) {
      case 0: //invalid
        break;
      case 1: //direct page
        mnemo += " $" + toHex2(a);
        break;
      case 2: // inherent
        break;
      case 3: //brel16
        mnemo +=
          " #$" +
          toHex4(
            a * 256 + b < 32768 ? a * 256 + b + pc : a * 256 + b + pc - 65536
          );
        break;
      case 4: //imm8
        mnemo += " #$" + toHex2(a);
        break;
      case 5: //brel8
        mnemo += " #$" + toHex4(a < 128 ? a + pc + 2 : a + pc - 254);
        break;
      case 6: //indexed, postbyte etc.
        mnemo += " ";
        const pb = a;
        const ixr = ["X", "Y", "U", "S"][(pb & 0x60) >> 5];
        if (!(pb & 0x80)) {
          //direct5
          var disp = pb & 0x1f;
          if (disp > 15) disp = disp - 32;
          mnemo += disp + "," + ixr;
          break;
        }
        const ind = pb & 0x10;
        const mod = pb & 0x0f;
        const ofs8 = b > 127 ? b - 256 : b;
        const ofs16 = b * 256 + c > 32767 ? b * 256 + c - 65536 : b * 256 + c;
        if (!ind) {
          switch (mod) {
            case 0:
              mnemo += "," + ixr + "+";
              break;
            case 1:
              mnemo += "," + ixr + "++";
              break;
            case 2:
              mnemo += ",-" + ixr;
              break;
            case 3:
              mnemo += ",--" + ixr;
              break;
            case 4:
              mnemo += "," + ixr;
              break;
            case 5:
              mnemo += "B," + ixr;
              break;
            case 6:
              mnemo += "A," + ixr;
              break;
            case 7:
              mnemo += "???";
              break;
            case 8:
              mnemo += ofs8 + "," + ixr;
              bytes++;
              break;
            case 9:
              mnemo += ofs16 + "," + ixr;
              bytes += 2;
              break;
            case 10:
              mnemo += "???";
              break;
            case 11:
              mnemo += "D," + ixr;
              break;
            case 12:
              mnemo += ofs8 + ",PC";
              bytes++;
              break;
            case 13:
              mnemo += ofs16 + ",PC";
              bytes += 2;
              break;
            case 14:
              mnemo += "???";
              break;
            case 15:
              mnemo += "$" + toHex4(b * 256 + c);
              bytes += 2;
              break;
          }
        } else {
          switch (mod) {
            case 0:
              mnemo += "???";
              break;
            case 1:
              mnemo += "[," + ixr + "++]";
              break;
            case 2:
              mnemo += "???";
              break;
            case 3:
              mnemo += "[,--" + ixr + "]";
              break;
            case 4:
              mnemo += "[," + ixr + "]";
              break;
            case 5:
              mnemo += "[B," + ixr + "]";
              break;
            case 6:
              mnemo += "[A," + ixr + "]";
              break;
            case 7:
              mnemo += "???";
              break;
            case 8:
              mnemo += "[" + ofs8 + "," + ixr + "]";
              bytes++;
              break;
            case 9:
              mnemo += "[" + ofs16 + "," + ixr + "]";
              bytes += 2;
              break;
            case 10:
              mnemo += "???";
              break;
            case 11:
              mnemo += "[D," + ixr + "]";
              break;
            case 12:
              mnemo += "[" + ofs8 + ",PC]";
              bytes++;
              break;
            case 13:
              mnemo += "[" + ofs16 + ",PC]";
              bytes += 2;
              break;
            case 14:
              mnemo += "???";
              break;
            case 15:
              mnemo += "[$" + toHex4(b * 256 + c) + "]";
              bytes += 2;
              break;
          }
        }

        break;
      case 7: //extended
        mnemo += " $" + toHex4(a * 256 + b);
        break;
      case 8: //imm16
        mnemo += " #$" + toHex4(a * 256 + b);
        break;

      case 10: //pshs, puls
        rx = ["PC", "U", "Y", "X", "DP", "B", "A", "CC"];
        ro = [];
        for (j = 0; j < 8; j++) {
          if ((a & 1) !== 0) {
            ro.push(rx[7 - j]);
          }
          a >>= 1;
        }
        mnemo += " " + ro.join(",");
        break;
      case 11: //pshs, puls
        rx = ["PC", "S", "Y", "X", "DP", "B", "A", "CC"];
        ro = [];
        for (j = 0; j < 8; j++) {
          if ((a & 1) !== 0) {
            ro.push(rx[7 - j]);
          }
          a >>= 1;
        }
        mnemo += " " + ro.join(",");
        break;
      case 20: //TFR etc
        rx = [
          "D",
          "X",
          "Y",
          "U",
          "S",
          "PC",
          "?",
          "?",
          "A",
          "B",
          "CC",
          "DP",
          "?",
          "?",
          "?",
          "?",
        ];
        mnemo += " " + rx[a >> 4] + "," + rx[a & 0x0f];
        break;
    }

    return [mnemo, bytes];
  };

  //---------- Public API

/**
 * Initialize emulator with memory interface and optional tick callback
 *
 * @param {Function} bt - byteTo(addr, value) callback for writing memory
 * @param {Function} ba - byteAt(addr) callback for reading memory
 * @param {Function} tck - Optional tick callback for peripheral updates
 */
const init = (bt, ba, tck) => {
  byteTo = bt;
  byteAt = ba;
  ticks = tck;
  rV = 0; // Initialize V once — it survives subsequent resets
  reset();
};

/**
 * Execute a specified number of T-cycles
 *
 * @param {number} Ts - Number of cycles to execute
 */
const steps = (Ts) => {
  while (Ts > 0) {
    Ts -= step();
  }
};

/**
 * Execute instructions until ticks callback returns truthy value
 */
const run = () => {
  let c = true;
  while (c) {
    c = !ticks || !ticks();
    step();
  }
};

/**
 * Get current CPU state
 *
 * @returns {Object} Register state {pc, sp, u, a, b, x, y, dp, flags}
 */
const status = () => ({
  pc: PC,
  sp: rS,
  u: rU,
  a: rA,
  b: rB,
  x: rX,
  y: rY,
  dp: DP,
  flags: CC,
  e: rE,
  f: rF,
  w: getW(),
  q: getQ(),
  v: rV,
  md: rMD,
});

/**
 * Handle IRQ interrupt
 *
 * Pushes entire CPU state to system stack (S) and vectors through vecIRQ.
 * Honors the I flag (F_IRQMASK) - interrupts disabled if I=1.
 *
 * Per MC6809 spec:
 * - Set E flag (entire state saved)
 * - Push all registers to S stack
 * - Set I and F flags (mask further interrupts)
 * - Load PC from IRQ vector
 */
const interrupt = () => {
  // Set entire flag before pushing CC
  CC |= F_ENTIRE;

  // Push entire machine state (E=1 means all registers saved)
  PUSHW(PC);
  PUSHW(rU);
  PUSHW(rY);
  PUSHW(rX);
  PUSHB(DP);
  if (isNative()) {
    PUSHB(rF);
    PUSHB(rE);
  }
  PUSHB(rB);
  PUSHB(rA);
  PUSHB(CC);

  // Mask both IRQ and FIRQ
  CC |= F_IRQMASK | F_FIRQMASK;

  // Vector to IRQ handler
  PC = ReadWord(vecIRQ);
  T += isNative() ? 21 : 19;
};

/**
 * Handle NMI (Non-Maskable Interrupt)
 *
 * Pushes entire CPU state to system stack (S) and vectors through vecNMI.
 * Cannot be masked - always executes.
 *
 * Per MC6809 spec:
 * - Set E flag (entire state saved)
 * - Push all registers to S stack
 * - Set I and F flags (mask further interrupts during NMI handler)
 * - Load PC from NMI vector
 */
const nmi = () => {
  // Set entire flag before pushing CC
  CC |= F_ENTIRE;

  // Push entire machine state
  PUSHW(PC);
  PUSHW(rU);
  PUSHW(rY);
  PUSHW(rX);
  PUSHB(DP);
  if (isNative()) {
    PUSHB(rF);
    PUSHB(rE);
  }
  PUSHB(rB);
  PUSHB(rA);
  PUSHB(CC);

  // Mask both IRQ and FIRQ during NMI handler
  CC |= F_IRQMASK | F_FIRQMASK;

  // Vector to NMI handler
  PC = ReadWord(vecNMI);
  T += isNative() ? 21 : 19;
};

/**
 * Set a register to a specific value (for debugging/testing)
 *
 * @param {string} reg - Register name (PC, A, B, X, Y, SP, U, FLAGS, DP)
 * @param {number} value - Value to set
 */
const set = (reg, value) => {
  switch (reg.toUpperCase()) {
    case "PC":
      PC = value;
      return;
    case "A":
      rA = value;
      return;
    case "B":
      rB = value;
      return;
    case "X":
      rX = value;
      return;
    case "Y":
      rY = value;
      return;
    case "SP":
      rS = value;
      return;
    case "U":
      rU = value;
      return;
    case "FLAGS":
      CC = value;
      return;
    case "DP":
      DP = value;
      return;
    case "E":
      rE = value & 0xFF;
      return;
    case "F":
      rF = value & 0xFF;
      return;
    case "W":
      setW(value);
      return;
    case "V":
      rV = value & 0xFFFF;
      return;
    case "MD":
      rMD = value & 0xFF;
      return;
  }
};

/**
 * Convert condition code flags to human-readable string
 *
 * @returns {string} Flag string "EFHINZVC" (uppercase=set, lowercase=clear)
 */
const flagsToString = () => {
  let f = "";
  const fx = "EFHINZVC";
  for (let i = 0; i < 8; i++) {
    const n = CC & (0x80 >> i);
    if (n === 0) {
      f += fx[i].toLowerCase();
    } else {
      f += fx[i];
    }
  }
  return f;
};

export default (callbacks) => {
  init(callbacks.byteTo, callbacks.byteAt, callbacks.ticks ?? null);
  return {
    reset,
    steps,
    singleStep: () => step(),
    run,
    status,
    interrupt,
    nmi,
    set,
    flagsToString,
    disasm,
    T: () => T,
  };
};
