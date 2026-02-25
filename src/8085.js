/**
 * Intel 8085 CPU Emulator
 *
 * ES6 module implementation of cycle-accurate Intel 8085 emulator.
 * The 8085 is 99% identical to 8080 with RIM/SIM instructions added.
 *
 * Based on original work by Chris Double (BSD-licensed) and Martin Maly.
 *
 * @module 8085
 */

// Flag constants
const CARRY = 0x01;
const PARITY = 0x04;
const HALFCARRY = 0x10;
const INTERRUPT = 0x20;
const ZERO = 0x40;
const SIGN = 0x80;

// Pre-computed lookup tables for hardware-accurate flag behavior
const flagTable = [70,2,2,6,2,6,6,2,2,6,6,2,6,2,2,6,2,6,6,2,6,2,2,6,6,2,2,6,2,6,6,2,2,6,6,2,6,2,2,6,6,2,2,6,2,6,6,2,6,2,2,6,2,6,6,2,2,6,6,2,6,2,2,6,2,6,6,2,6,2,2,6,6,2,2,6,2,6,6,2,6,2,2,6,2,6,6,2,2,6,6,2,6,2,2,6,6,2,2,6,2,6,6,2,2,6,6,2,6,2,2,6,2,6,6,2,6,2,2,6,6,2,2,6,2,6,6,2,130,134,134,130,134,130,130,134,134,130,130,134,130,134,134,130,134,130,130,134,130,134,134,130,130,134,134,130,134,130,130,134,134,130,130,134,130,134,134,130,130,134,134,130,134,130,130,134,130,134,134,130,134,130,130,134,134,130,130,134,130,134,134,130,134,130,130,134,130,134,134,130,130,134,134,130,134,130,130,134,130,134,134,130,134,130,130,134,134,130,130,134,130,134,134,130,130,134,134,130,134,130,130,134,134,130,130,134,130,134,134,130,134,130,130,134,130,134,134,130,130,134,134,130,134,130,130,134];

const daaTable = [70,258,514,774,1026,1286,1542,1794,2050,2310,4114,4374,4630,4882,5142,5394,4098,4358,4614,4866,5126,5378,5634,5894,6150,6402,8210,8470,8726,8978,9238,9490,8194,8454,8710,8962,9222,9474,9730,9990,10246,10498,12310,12562,12818,13078,13330,13590,12294,12546,12802,13062,13314,13574,13830,14082,14338,14598,16402,16662,16918,17170,17430,17682,16386,16646,16902,17154,17414,17666,17922,18182,18438,18690,20502,20754,21010,21270,21522,21782,20486,20738,20994,21254,21506,21766,22022,22274,22530,22790,24598,24850,25106,25366,25618,25878,24582,24834,25090,25350,25602,25862,26118,26370,26626,26886,28690,28950,29206,29458,29718,29970,28674,28934,29190,29442,29702,29954,30210,30470,30726,30978,32914,33174,33430,33682,33942,34194,32898,33158,33414,33666,33926,34178,34434,34694,34950,35202,37014,37266,37522,37782,38034,38294,36998,37250,37506,37766,38018,38278,38534,38786,39042,39302,65623,65811,66067,66327,66579,66839,65607,65795,66051,66311,66563,66823,67079,67331,67587,67847,69651,69911,70167,70419,70679,70931,69635,69895,70151,70403,70663,70915,71171,71431,71687,71939,73747,74007,74263,74515,74775,75027,73731,73991,74247,74499,74759,75011,75267,75527,75783,76035,77847,78099,78355,78615,78867,79127,77831,78083,78339,78599,78851,79111,79367,79619,79875,80135,81939,82199,82455,82707,82967,83219,81923,82183,82439,82691,82951,83203,83459,83719,83975,84227,86039,86291,86547,86807,87059,87319,86023,86275,86531,86791,87043,87303,87559,87811,88067,88327,90135,90387,90643,90903,91155,91415,24583,24835,25091,25351,25603,25863,26119,26371,26627,26887,28691,28951,29207,29459,29719,29971,28675,28935,29191,29443,29703,29955,30211,30471,30727,30979,32915,33175,33431,33683,33943,34195,32899,33159,33415,33667,33927,34179,34435,34695,34951,35203,37015,37267,37523,37783,38035,38295,36999,37251,37507,37767,38019,38279,38535,38787,39043,39303,41111,41363,41619,41879,42131,42391,41095,41347,41603,41863,42115,42375,42631,42883,43139,43399,45203,45463,45719,45971,46231,46483,45187,45447,45703,45955,46215,46467,46723,46983,47239,47491,49303,49555,49811,50071,50323,50583,49287,49539,49795,50055,50307,50567,50823,51075,51331,51591,53395,53655,53911,54163,54423,54675,53379,53639,53895,54147,54407,54659,54915,55175,55431,55683,57491,57751,58007,58259,58519,58771,57475,57735,57991,58243,58503,58755,59011,59271,59527,59779,61591,61843,62099,62359,62611,62871,61575,61827,62083,62343,62595,62855,63111,63363,63619,63879,65623,65811,66067,66327,66579,66839,65607,65795,66051,66311,66563,66823,67079,67331,67587,67847,69651,69911,70167,70419,70679,70931,69635,69895,70151,70403,70663,70915,71171,71431,71687,71939,73747,74007,74263,74515,74775,75027,73731,73991,74247,74499,74759,75011,75267,75527,75783,76035,77847,78099,78355,78615,78867,79127,77831,78083,78339,78599,78851,79111,79367,79619,79875,80135,81939,82199,82455,82707,82967,83219,81923,82183,82439,82691,82951,83203,83459,83719,83975,84227,86039,86291,86547,86807,87059,87319,86023,86275,86531,86791,87043,87303,87559,87811,88067,88327,90135,90387,90643,90903,91155,91415,1542,1794,2050,2310,2566,2818,3078,3330,3586,3846,4114,4374,4630,4882,5142,5394,5634,5894,6150,6402,6658,6918,7170,7430,7686,7938,8210,8470,8726,8978,9238,9490,9730,9990,10246,10498,10754,11014,11266,11526,11782,12034,12310,12562,12818,13078,13330,13590,13830,14082,14338,14598,14854,15106,15366,15618,15874,16134,16402,16662,16918,17170,17430,17682,17922,18182,18438,18690,18946,19206,19458,19718,19974,20226,20502,20754,21010,21270,21522,21782,22022,22274,22530,22790,23046,23298,23558,23810,24066,24326,24598,24850,25106,25366,25618,25878,26118,26370,26626,26886,27142,27394,27654,27906,28162,28422,28690,28950,29206,29458,29718,29970,30210,30470,30726,30978,31234,31494,31746,32006,32262,32514,32914,33174,33430,33682,33942,34194,34434,34694,34950,35202,35458,35718,35970,36230,36486,36738,37014,37266,37522,37782,38034,38294,38534,38786,39042,39302,39558,39810,40070,40322,40578,40838,65623,65811,66067,66327,66579,66839,67079,67331,67587,67847,68103,68355,68615,68867,69123,69383,69651,69911,70167,70419,70679,70931,71171,71431,71687,71939,72195,72455,72707,72967,73223,73475,73747,74007,74263,74515,74775,75027,75267,75527,75783,76035,76291,76551,76803,77063,77319,77571,77847,78099,78355,78615,78867,79127,79367,79619,79875,80135,80391,80643,80903,81155,81411,81671,81939,82199,82455,82707,82967,83219,83459,83719,83975,84227,84483,84743,84995,85255,85511,85763,86039,86291,86547,86807,87059,87319,87559,87811,88067,88327,88583,88835,89095,89347,89603,89863,90135,90387,90643,90903,91155,91415,26119,26371,26627,26887,27143,27395,27655,27907,28163,28423,28691,28951,29207,29459,29719,29971,30211,30471,30727,30979,31235,31495,31747,32007,32263,32515,32915,33175,33431,33683,33943,34195,34435,34695,34951,35203,35459,35719,35971,36231,36487,36739,37015,37267,37523,37783,38035,38295,38535,38787,39043,39303,39559,39811,40071,40323,40579,40839,41111,41363,41619,41879,42131,42391,42631,42883,43139,43399,43655,43907,44167,44419,44675,44935,45203,45463,45719,45971,46231,46483,46723,46983,47239,47491,47747,48007,48259,48519,48775,49027,49303,49555,49811,50071,50323,50583,50823,51075,51331,51591,51847,52099,52359,52611,52867,53127,53395,53655,53911,54163,54423,54675,54915,55175,55431,55683,55939,56199,56451,56711,56967,57219,57491,57751,58007,58259,58519,58771,59011,59271,59527,59779,60035,60295,60547,60807,61063,61315,61591,61843,62099,62359,62611,62871,63111,63363,63619,63879,64135,64387,64647,64899,65155,65415,65623,65811,66067,66327,66579,66839,67079,67331,67587,67847,68103,68355,68615,68867,69123,69383,69651,69911,70167,70419,70679,70931,71171,71431,71687,71939,72195,72455,72707,72967,73223,73475,73747,74007,74263,74515,74775,75027,75267,75527,75783,76035,76291,76551,76803,77063,77319,77571,77847,78099,78355,78615,78867,79127,79367,79619,79875,80135,80391,80643,80903,81155,81411,81671,81939,82199,82455,82707,82967,83219,83459,83719,83975,84227,84483,84743,84995,85255,85511,85763,86039,86291,86547,86807,87059,87319,87559,87811,88067,88327,88583,88835,89095,89347,89603,89863,90135,90387,90643,90903,91155,91415];

// Disassembly instruction table [mnemonic, byte_length]
const disasmTable = [["NOP",1],["LXI B,#1",3],["STAX B",1],["INX B",1],["INR B",1],["DCR B",1],["MVI B, %1",2],["RLC",1],["-",0],["DAD B",1],["LDAX B",1],["DCX B",1],["INR C",1],["DCR C",1],["MVI C,%1",2],["RRC",1],["-",0],["LXI D,#1",3],["STAX D",1],["INX D",1],["INR D",1],["DCR D",1],["MVI D, %1",2],["RAL",1],["-",0],["DAD D",1],["LDAX D",1],["DCX D",1],["INR E",1],["DCR E",1],["MVI E,%1",2],["RAR",1],["RIM",1],["LXI H,#1",3],["SHLD #1",3],["INX H",1],["INR H",1],["DCR H",1],["MVI H,%1",2],["DAA",1],["-",0],["DAD H",1],["LHLD #1",3],["DCX H",1],["INR L",1],["DCR L",1],["MVI L, %1",2],["CMA",1],["SIM",1],["LXI SP, #1",3],["STA #1",3],["INX SP",1],["INR M",1],["DCR M",1],["MVI M,%1",2],["STC",1],["-",0],["DAD SP",1],["LDA #1",3],["DCX SP",1],["INR A",1],["DCR A",1],["MVI A,%1",2],["CMC",1],["MOV B,B",1],["MOV B,C",1],["MOV B,D",1],["MOV B,E",1],["MOV B,H",1],["MOV B,L",1],["MOV B,M",1],["MOV B,A",1],["MOV C,B",1],["MOV C,C",1],["MOV C,D",1],["MOV C,E",1],["MOV C,H",1],["MOV C,L",1],["MOV C,M",1],["MOV C,A",1],["MOV D,B",1],["MOV D,C",1],["MOV D,D",1],["MOV D,E",1],["MOV D,H",1],["MOV D,L",1],["MOV D,M",1],["MOV D,A",1],["MOV E,B",1],["MOV E,C",1],["MOV E,D",1],["MOV E,E",1],["MOV E,H",1],["MOV E,L",1],["MOV E,M",1],["MOV E,A",1],["MOV H,B",1],["MOV H,C",1],["MOV H,D",1],["MOV H,E",1],["MOV H,H",1],["MOV H,L",1],["MOV H,M",1],["MOV H,A",1],["MOV L,B",1],["MOV L,C",1],["MOV L,D",1],["MOV L,E",1],["MOV L,H",1],["MOV L,L",1],["MOV L,M",1],["MOV L,A",1],["MOV M,B",1],["MOV M,C",1],["MOV M,D",1],["MOV M,E",1],["MOV M,H",1],["MOV M,L",1],["HLT",1],["MOV M,A",1],["MOV A,B",1],["MOV A,C",1],["MOV A,D",1],["MOV A,E",1],["MOV A,H",1],["MOV A,L",1],["MOV A,M",1],["MOV A,A",1],["ADD B",1],["ADD C",1],["ADD D",1],["ADD E",1],["ADD H",1],["ADD L",1],["ADD M",1],["ADD A",1],["ADC B",1],["ADC C",1],["ADC D",1],["ADC E",1],["ADC H",1],["ADC L",1],["ADC M",1],["ADC A",1],["SUB B",1],["SUB C",1],["SUB D",1],["SUB E",1],["SUB H",1],["SUB L",1],["SUB M",1],["SUB A",1],["SBB B",1],["SBB C",1],["SBB D",1],["SBB E",1],["SBB H",1],["SBB L",1],["SBB M",1],["SBB A",1],["ANA B",1],["ANA C",1],["ANA D",1],["ANA E",1],["ANA H",1],["ANA L",1],["ANA M",1],["ANA A",1],["XRA B",1],["XRA C",1],["XRA D",1],["XRA E",1],["XRA H",1],["XRA L",1],["XRA M",1],["XRA A",1],["ORA B",1],["ORA C",1],["ORA D",1],["ORA E",1],["ORA H",1],["ORA L",1],["ORA M",1],["ORA A",1],["CMP B",1],["CMP C",1],["CMP D",1],["CMP E",1],["CMP H",1],["CMP L",1],["CMP M",1],["CMP A",1],["RNZ",1],["POP B",1],["JNZ #1",3],["JMP #1",3],["CNZ #1",3],["PUSH B",1],["ADI %1",2],["RST 0",1],["RZ",1],["RET",1],["JZ #1",3],["-",0],["CZ #1",3],["CALL #1",3],["ACI %1",2],["RST 1",1],["RNC",1],["POP D",1],["JNC #1",3],["OUT %1",2],["CNC #1",3],["PUSH D",1],["SUI %1",2],["RST 2",1],["RC",1],["-",0],["JC #1",3],["IN %1",2],["CC #1",3],["-",0],["SBI %1",2],["RST 3",1],["RPO",1],["POP H",1],["JPO #1",3],["XTHL",1],["CPO #1",3],["PUSH H",1],["ANI %1",2],["RST 4",1],["RPE",1],["PCHL",1],["JPE #1",3],["XCHG",1],["CPE #1",3],["-",0],["XRI %1",2],["RST 5",1],["RP",1],["POP PSW",1],["JP #1",3],["DI",1],["CP #1",3],["PUSH PSW",1],["ORI %1",2],["RST 6",1],["RM",1],["SPHL",1],["JM #1",3],["EI",1],["CM #1",3],["-",0],["CPI %1",2],["RST 7",1]];

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
const toHex4 = (n) => toHexN(n, 4);

/**
 * Disassemble a single 8085 instruction
 *
 * @param {number} opcode - The instruction opcode (0-255)
 * @param {number} a - First operand byte
 * @param {number} b - Second operand byte (for 3-byte instructions)
 * @param {number} c - Unused
 * @param {number} d - Unused
 * @returns {Array} [mnemonic_string, instruction_length]
 */
export const disasm = (opcode, a, b, c, d) => {
  const sx = disasmTable[opcode];
  let s = sx[0];
  const d8 = toHex2(a);
  s = s.replace("%1", "$" + d8);
  const d16 = toHex2(b) + toHex2(a);
  s = s.replace("#1", "$" + d16);
  return [s, sx[1]];
};

/**
 * Create an Intel 8085 CPU emulator instance
 *
 * @param {Object} callbacks - Memory and I/O callback functions
 * @param {Function} callbacks.byteTo - Write byte to memory: (address, value) => void
 * @param {Function} callbacks.byteAt - Read byte from memory: (address) => value
 * @param {Function} [callbacks.portOut] - Write byte to port: (port, value) => void
 * @param {Function} [callbacks.portIn] - Read byte from port: (port) => value
 * @param {Function} [callbacks.ticks] - Tick callback (unused in this implementation)
 * @returns {Object} CPU instance with public API
 */
export default (callbacks) => {
  const { byteTo, byteAt, portOut, portIn, ticks } = callbacks;

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
    sp: 0xF000,
    halted: 0,
    cycles: 0
  };

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

  // Memory access helpers
  const getByte = (addr) => byteAt(addr & 0xFFFF);

  const getWord = (addr) => {
    const l = byteAt(addr & 0xFFFF);
    const h = byteAt((addr + 1) & 0xFFFF);
    return (h << 8) | l;
  };

  const nextByte = () => {
    const b = byteAt(regs.pc & 0xFFFF);
    regs.pc = (regs.pc + 1) & 0xFFFF;
    return b;
  };

  const nextWord = () => {
    const l = byteAt(regs.pc & 0xFFFF);
    const h = byteAt((regs.pc + 1) & 0xFFFF);
    regs.pc = (regs.pc + 2) & 0xFFFF;
    return (h << 8) | l;
  };

  const writeByte = (addr, value) => {
    const v = value & 0xFF;
    byteTo(addr & 0xFFFF, v);
  };

  const writeWord = (addr, value) => {
    const l = value;
    const h = value >> 8;
    writeByte(addr & 0xFFFF, l);
    writeByte((addr + 1) & 0xFFFF, h);
  };

  // I/O port helpers
  const writePort = (port, v) => {
    if (portOut) portOut(port & 0xFF, v);
  };

  const readPort = (port) => {
    if (portIn) return portIn(port & 0xFF);
    return 255;
  };

  // Stack operations
  const pop = () => {
    const pc = getWord(regs.sp);
    regs.sp = (regs.sp + 2) & 0xFFFF;
    return pc;
  };

  const push = (v) => {
    regs.sp = (regs.sp - 2) & 0xFFFF;
    writeWord(regs.sp, v);
  };

  // Flag calculation helpers

  /**
   * Calculate flags after arithmetic/logical operation
   * Uses hardware-accurate lookup table for zero, sign, parity flags
   */
  const calcFlags = (v, lhs, rhs) => {
    const x = v & 0xFF;

    if (v >= 0x100 || v < 0) {
      regs.f |= CARRY;
    } else {
      regs.f &= ~CARRY & 0xFF;
    }

    regs.f = flagTable[x];

    if (v >= 0x100 || v < 0) {
      regs.f |= CARRY;
    } else {
      regs.f &= ~CARRY & 0xFF;
    }

    return x;
  };

  /**
   * Calculate auxiliary carry for ADD operations
   * Hardware-accurate implementation using lookup table
   */
  const acADD = (a1, a2, r) => {
    const aux = [0, HALFCARRY, HALFCARRY, HALFCARRY, 0, 0, 0, HALFCARRY];
    const dis = ((r & 8) >> 1) | ((a2 & 8) >> 2) | ((a1 & 8) >> 3);
    const ac = aux[dis];
    regs.f = (regs.f & ~HALFCARRY) | ac;
  };

  /**
   * Calculate auxiliary carry for SUB operations
   * Hardware-accurate implementation using lookup table
   */
  const acSUB = (a1, a2, r) => {
    const aux = [HALFCARRY, HALFCARRY, 0, HALFCARRY, 0, HALFCARRY, 0, 0];
    const dis = ((r & 8) >> 1) | ((a2 & 8) >> 2) | ((a1 & 8) >> 3);
    const ac = aux[dis];
    regs.f = (regs.f & ~HALFCARRY) | ac;
  };

  // Arithmetic operations

  const incrementByte = (o) => {
    const c = regs.f & CARRY;
    const r = calcFlags(o + 1, o, 1);
    regs.f = (regs.f & ~CARRY & 0xFF) | c;

    if ((r & 0x0F) === 0) {
      regs.f = regs.f | HALFCARRY;
    } else {
      regs.f &= ~HALFCARRY & 0xFF;
    }

    return r;
  };

  const decrementByte = (o) => {
    const c = regs.f & CARRY;
    const r = calcFlags(o - 1, o, 1);
    regs.f = (regs.f & ~CARRY & 0xFF) | c;

    // Halfcarry on decrement: set when borrow from upper nibble (lower nibble is 0)
    if ((o & 0x0F) === 0) {
      regs.f = regs.f | HALFCARRY;
    } else {
      regs.f &= ~HALFCARRY & 0xFF;
    }

    return r;
  };

  const addByte = (lhs, rhs) => {
    const mid = calcFlags(lhs + rhs, lhs, rhs);
    acADD(lhs, rhs, mid);
    return mid;
  };

  const addByteWithCarry = (lhs, rhs) => {
    const mid = addByte(lhs, rhs + ((regs.f & CARRY) ? 1 : 0));
    acADD(lhs, rhs, mid);
    return mid;
  };

  const subtractByte = (lhs, rhs) => {
    const mid = calcFlags(lhs - rhs, lhs, rhs);
    acSUB(lhs, rhs, mid);
    return mid;
  };

  const subtractByteWithCarry = (lhs, rhs) => {
    const nrhs = rhs + ((regs.f & CARRY) ? 1 : 0);
    const mid = calcFlags(lhs - nrhs, lhs, nrhs);
    acSUB(lhs, rhs, mid);
    return mid;
  };

  const andByte = (lhs, rhs) => {
    const x = calcFlags(lhs & rhs, lhs, rhs);
    const ac = (lhs & 0x08) | (rhs & 0x08);

    if (ac > 0) {
      regs.f |= HALFCARRY;
    } else {
      regs.f &= ~HALFCARRY;
    }

    regs.f &= ~CARRY & 0xFF;
    return x;
  };

  const xorByte = (lhs, rhs) => {
    const x = calcFlags(lhs ^ rhs, lhs, rhs);
    regs.f &= ~HALFCARRY;
    regs.f &= ~CARRY & 0xFF;
    return x;
  };

  const orByte = (lhs, rhs) => {
    const x = calcFlags(lhs | rhs, lhs, rhs);
    regs.f &= ~HALFCARRY;
    regs.f &= ~CARRY & 0xFF;
    return x;
  };

  const addWord = (lhs, rhs) => {
    const r = lhs + rhs;

    if (r > 0xFFFF) {
      regs.f |= CARRY;
    } else {
      regs.f &= ~CARRY;
    }

    return r & 0xFFFF;
  };

  // Register name lookup: B,C,D,E,H,L,M(=memory),A (index 6 = M = memory [HL])
  const REG = ["b", "c", "d", "e", "h", "l", null, "a"];

  // ALU operation dispatch: ADD,ADC,SUB,SBB,ANA,XRA,ORA,CMP
  const ALU_FNS = [
    addByte, addByteWithCarry, subtractByte, subtractByteWithCarry,
    andByte, xorByte, orByte, null  // null = CMP (subtractByte, result discarded)
  ];

  // Register pair getters/setters for 0x00-0x3F: BC, DE, HL, SP
  const RP_GET = [bc, de, hl, () => regs.sp];
  const RP_SET = [setBC, setDE, setHL, (v) => { regs.sp = v & 0xFFFF; }];

  // Register pair getters/setters for 0xC0-0xFF PUSH/POP: BC, DE, HL, PSW
  const RP16_GET = [bc, de, hl, af];
  const RP16_SET = [setBC, setDE, setHL, setAF];

  // Condition code flag mapping: NZ, Z, NC, C, PO, PE, P, M
  const CC_FLAGS = [ZERO, ZERO, CARRY, CARRY, PARITY, PARITY, SIGN, SIGN];

  // Instruction execution
  const execute = (i) => {
    let addr, w, c;

    regs.f &= 0xF7;
    regs.f |= 0x02;

    // MOV instructions: 0x40-0x7F
    if (i >= 0x40 && i <= 0x7F) {
      if (i === 0x76) {
        regs.cycles += 7; regs.halted = 1;                   // HLT
      } else {
        const dst = (i >> 3) & 7, src = i & 7;
        const val = src === 6 ? byteAt(hl()) : regs[REG[src]];
        if (dst === 6) { writeByte(hl(), val); regs.cycles += 7; }
        else { regs[REG[dst]] = val; regs.cycles += src === 6 ? 7 : 5; }
      }

    // ALU instructions: 0x80-0xBF (ADD,ADC,SUB,SBB,ANA,XRA,ORA,CMP)
    } else if (i >= 0x80 && i <= 0xBF) {
      const op = (i >> 3) & 7, src = i & 7;
      const val = src === 6 ? byteAt(hl()) : regs[REG[src]];
      if (op === 7) subtractByte(regs.a, val);               // CMP: flags only
      else regs.a = ALU_FNS[op](regs.a, val);
      regs.cycles += src === 6 ? 7 : 4;

    } else if (i < 0x40) {
      const low3 = i & 7, low4 = i & 0x0F;
      const reg = (i >> 3) & 7, rp = (i >> 4) & 3;
      if (low3 === 4) {
        // INR: 0x04,0x0C,0x14,0x1C,0x24,0x2C,0x34,0x3C
        if (reg === 6) { addr = hl(); writeByte(addr, incrementByte(byteAt(addr))); regs.cycles += 10; }
        else { regs[REG[reg]] = incrementByte(regs[REG[reg]]); regs.cycles += 5; }
      } else if (low3 === 5) {
        // DCR: 0x05,0x0D,0x15,0x1D,0x25,0x2D,0x35,0x3D
        if (reg === 6) { addr = hl(); writeByte(addr, decrementByte(byteAt(addr))); regs.cycles += 10; }
        else { regs[REG[reg]] = decrementByte(regs[REG[reg]]); regs.cycles += 5; }
      } else if (low3 === 6) {
        // MVI: 0x06,0x0E,0x16,0x1E,0x26,0x2E,0x36,0x3E
        if (reg === 6) { writeByte(hl(), nextByte()); regs.cycles += 10; }
        else { regs[REG[reg]] = nextByte(); regs.cycles += 7; }
      } else if (low4 === 1) {
        // LXI: 0x01,0x11,0x21,0x31
        RP_SET[rp](nextWord()); regs.cycles += 10;
      } else if (low4 === 3) {
        // INX: 0x03,0x13,0x23,0x33
        RP_SET[rp]((RP_GET[rp]() + 1) & 0xFFFF); regs.cycles += 6;
      } else if (low4 === 0xB) {
        // DCX: 0x0B,0x1B,0x2B,0x3B
        RP_SET[rp]((RP_GET[rp]() - 1 + 0x10000) & 0xFFFF); regs.cycles += 6;
      } else if (low4 === 9) {
        // DAD: 0x09,0x19,0x29,0x39
        setHL(addWord(hl(), RP_GET[rp]())); regs.cycles += 11;
      } else if (low4 === 2 && rp < 2) {
        // STAX: 0x02,0x12
        writeByte(RP_GET[rp](), regs.a); regs.cycles += 7;
      } else if (low4 === 0xA && rp < 2) {
        // LDAX: 0x0A,0x1A
        regs.a = byteAt(RP_GET[rp]()); regs.cycles += 7;
      } else {
        switch (i) {
          // NOP and undocumented NOP aliases (8085: 6 aliases, 0x20 and 0x30 are RIM/SIM)
          case 0x00:
          case 0x08:
          case 0x10:
          case 0x18:
          case 0x28:
          case 0x38:
            regs.cycles += 4;
            break;

          // RIM (8085-specific: Read Interrupt Mask)
          case 0x20:
            if (readPort(99999)) {
              regs.a |= 0x80;
            } else {
              regs.a &= 0x7F;
            }
            regs.cycles += 4;
            break;

          // SIM (8085-specific: Set Interrupt Mask)
          case 0x30:
            writePort(99999, regs.a & 0xC0);
            regs.cycles += 4;
            break;

          // RLC
          case 0x07: {
            const l = (regs.a & 0x80) >> 7;
            if (l) {
              regs.f |= CARRY;
            } else {
              regs.f &= ~CARRY & 0xFF;
            }
            regs.a = ((regs.a << 1) & 0xFE) | l;
            regs.cycles += 4;
            break;
          }

          // RRC
          case 0x0F: {
            const h = (regs.a & 1) << 7;
            if (h) {
              regs.f |= CARRY;
            } else {
              regs.f &= ~CARRY & 0xFF;
            }
            regs.a = ((regs.a >> 1) & 0x7F) | h;
            regs.cycles += 4;
            break;
          }

          // RAL
          case 0x17:
            c = (regs.f & CARRY) ? 1 : 0;
            if (regs.a & 128) {
              regs.f |= CARRY;
            } else {
              regs.f &= ~CARRY & 0xFF;
            }
            regs.a = ((regs.a << 1) & 0xFE) | c;
            regs.cycles += 4;
            break;

          // RAR
          case 0x1F: {
            const cy = (regs.f & CARRY) ? 128 : 0;
            if (regs.a & 1) {
              regs.f |= CARRY;
            } else {
              regs.f &= ~CARRY & 0xFF;
            }
            regs.a = ((regs.a >> 1) & 0x7F) | cy;
            regs.cycles += 4;
            break;
          }

          // SHLD (nn)
          case 0x22:
            writeWord(nextWord(), hl());
            regs.cycles += 16;
            break;

          // DAA (Decimal Adjust Accumulator)
          case 0x27: {
            let temp = regs.a;
            if (regs.f & CARRY) {
              temp |= 0x100;
            }
            if (regs.f & HALFCARRY) {
              temp |= 0x200;
            }
            const AF = daaTable[temp];
            regs.a = (AF >> 8) & 0xFF;
            regs.f = (AF & 0xD7) | 0x02;
            regs.cycles += 4;
            break;
          }

          // LHLD (nn)
          case 0x2A:
            setHL(getWord(nextWord()));
            regs.cycles += 16;
            break;

          // CMA
          case 0x2F:
            regs.a ^= 0xFF;
            regs.cycles += 4;
            break;

          // STA (nn)
          case 0x32:
            writeByte(nextWord(), regs.a);
            regs.cycles += 13;
            break;

          // STC
          case 0x37:
            regs.f |= CARRY;
            regs.cycles += 4;
            break;

          // LDA (nn)
          case 0x3A:
            regs.a = byteAt(nextWord());
            regs.cycles += 13;
            break;

          // CMC
          case 0x3F:
            regs.f ^= CARRY;
            regs.cycles += 4;
            break;

          default:
            regs.cycles += 4;
            break;
        }
      }

    } else {
      const low3 = i & 7, low4 = i & 0x0F;
      const rp = (i >> 4) & 3, cc = (i >> 3) & 7;
      if (low3 === 7) {
        // RST: 0xC7,0xCF,0xD7,0xDF,0xE7,0xEF,0xF7,0xFF
        push(regs.pc); regs.pc = i & 0x38; regs.cycles += 11;
      } else if (low3 === 0) {
        // RCC: 0xC0,0xC8,0xD0,0xD8,0xE0,0xE8,0xF0,0xF8
        const cond = (cc & 1) ? !!(regs.f & CC_FLAGS[cc]) : !(regs.f & CC_FLAGS[cc]);
        if (cond) { regs.pc = pop(); regs.cycles += 11; } else { regs.cycles += 5; }
      } else if (low3 === 2) {
        // JCC: 0xC2,0xCA,0xD2,0xDA,0xE2,0xEA,0xF2,0xFA
        const cond = (cc & 1) ? !!(regs.f & CC_FLAGS[cc]) : !(regs.f & CC_FLAGS[cc]);
        regs.pc = cond ? nextWord() : (regs.pc + 2) & 0xFFFF;
        regs.cycles += 10;
      } else if (low3 === 4) {
        // CCC: 0xC4,0xCC,0xD4,0xDC,0xE4,0xEC,0xF4,0xFC
        const cond = (cc & 1) ? !!(regs.f & CC_FLAGS[cc]) : !(regs.f & CC_FLAGS[cc]);
        if (cond) { regs.cycles += 17; w = nextWord(); push(regs.pc); regs.pc = w; }
        else { regs.cycles += 11; regs.pc = (regs.pc + 2) & 0xFFFF; }
      } else if (low4 === 5) {
        // PUSH: 0xC5,0xD5,0xE5,0xF5
        push(RP16_GET[rp]()); regs.cycles += 11;
      } else if (low4 === 1) {
        // POP: 0xC1,0xD1,0xE1,0xF1
        RP16_SET[rp](pop()); regs.cycles += 10;
      } else {
        switch (i) {
          // JMP nn (also 0xCB)
          case 0xC3:
          case 0xCB:
            regs.pc = getWord(regs.pc);
            regs.cycles += 10;
            break;

          // ADI n
          case 0xC6:
            regs.a = addByte(regs.a, nextByte());
            regs.cycles += 7;
            break;

          // RET (also 0xD9)
          case 0xC9:
          case 0xD9:
            regs.pc = pop();
            regs.cycles += 10;
            break;

          // ACI n
          case 0xCE:
            regs.a = addByteWithCarry(regs.a, nextByte());
            regs.cycles += 7;
            break;

          // CALL nn (also 0xDD, 0xED, 0xFD)
          case 0xCD:
          case 0xDD:
          case 0xED:
          case 0xFD:
            w = nextWord();
            push(regs.pc);
            regs.pc = w;
            regs.cycles += 17;
            break;

          // OUT (n),A
          case 0xD3:
            writePort(nextByte(), regs.a);
            regs.cycles += 10;
            break;

          // SUI n
          case 0xD6:
            regs.a = subtractByte(regs.a, nextByte());
            regs.cycles += 7;
            break;

          // IN A,(n)
          case 0xDB:
            regs.a = readPort(nextByte());
            regs.cycles += 10;
            break;

          // SBI n
          case 0xDE:
            regs.a = subtractByteWithCarry(regs.a, nextByte());
            regs.cycles += 7;
            break;

          // XTHL
          case 0xE3: {
            const a = getWord(regs.sp);
            writeWord(regs.sp, hl());
            setHL(a);
            regs.cycles += 4;
            break;
          }

          // ANI n
          case 0xE6:
            regs.a = andByte(regs.a, nextByte());
            regs.cycles += 7;
            break;

          // PCHL
          case 0xE9:
            regs.pc = hl();
            regs.cycles += 4;
            break;

          // XCHG
          case 0xEB:
            w = de();
            setDE(hl());
            setHL(w);
            regs.cycles += 4;
            break;

          // XRI n
          case 0xEE:
            regs.a = xorByte(regs.a, nextByte());
            regs.cycles += 7;
            break;

          // DI
          case 0xF3:
            regs.f &= ~INTERRUPT & 0xFF;
            regs.cycles += 4;
            break;

          // ORI n
          case 0xF6:
            regs.a = orByte(regs.a, nextByte());
            regs.cycles += 7;
            break;

          // SPHL
          case 0xF9:
            regs.sp = hl();
            regs.cycles += 6;
            break;

          // EI
          case 0xFB:
            regs.f |= INTERRUPT;
            regs.cycles += 4;
            break;

          // CPI n
          case 0xFE:
            subtractByte(regs.a, nextByte());
            regs.cycles += 7;
            break;

          default:
            regs.cycles += 4;
            break;
        }
      }
    }

    regs.f &= 0xF7;
    regs.f |= 0x02;
  };

  // Single step execution
  const step = () => {
    if (regs.halted === 1) {
      regs.cycles++;
      return 1;
    }

    const i = byteAt(regs.pc++);
    const inT = regs.cycles;
    execute(i);
    regs.pc &= 0xFFFF;
    return regs.cycles - inT;
  };

  // Trace helper
  const goTrace = () => {
    console.log(toHex4(regs.pc));
  };

  // Public API

  /**
   * Initialize CPU (legacy compatibility - now no-op since callbacks passed to constructor)
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
    regs.f = 2;
    regs.cycles = 0;
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
  const memr = (addr) => byteAt(addr);

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
    l: regs.l
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
      case "PC": regs.pc = value; break;
      case "A": regs.a = value; break;
      case "B": regs.b = value; break;
      case "C": regs.c = value; break;
      case "D": regs.d = value; break;
      case "E": regs.e = value; break;
      case "H": regs.h = value; break;
      case "L": regs.l = value; break;
      case "F": regs.f = value; break;
      case "SP": regs.sp = value; break;
    }
  };

  /**
   * Trigger hardware interrupt
   *
   * @param {number} [vector=0x38] - Interrupt vector address
   */
  const interrupt = (vector) => {
    if (regs.f & INTERRUPT) {
      regs.halted = 0;
      push(regs.pc);
      regs.pc = vector || 0x38;
    }
  };

  /**
   * Format flags as string
   *
   * @returns {string} Flag string (e.g., "SZ0A0P1C")
   */
  const flagsToString = () => {
    let f = "";
    const fx = "SZ0A0P1C";

    for (let i = 0; i < 8; i++) {
      const n = regs.f & (0x80 >> i);
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
    interrupt,
    flagsToString
  };
};
