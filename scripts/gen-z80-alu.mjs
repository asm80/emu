/**
 * Generator: Z80 8-bit ALU instruction tests
 * Generates QUnit test code for all register variants of arithmetic instructions.
 * Run: node scripts/gen-z80-alu.mjs >> test/z80-alu.test.js
 */

// Z80 documented flag bits
const F_S  = 0x80; // Sign
const F_Z  = 0x40; // Zero
const F_H  = 0x10; // Half-carry
const F_PV = 0x04; // Parity/Overflow
const F_N  = 0x02; // Subtract
const F_C  = 0x01; // Carry
const F_DOC = F_S | F_Z | F_H | F_PV | F_N | F_C; // mask to ignore undocumented Y/X

const parity = (n) => {
  n ^= n >> 4; n ^= n >> 2; n ^= n >> 1;
  return (n & 1) === 0; // even parity
};

const flagsADD = (a, r) => {
  const full = a + r;
  const res  = full & 0xFF;
  return {
    result: res,
    flags: (res & 0x80 ? F_S : 0) |
           (res === 0 ? F_Z : 0) |
           (((a & 0xF) + (r & 0xF)) > 0xF ? F_H : 0) |
           (((a ^ full) & (r ^ full) & 0x80) ? F_PV : 0) |
           // N = 0
           (full > 0xFF ? F_C : 0)
  };
};

const flagsADC = (a, r, cy) => {
  const full = a + r + cy;
  const res  = full & 0xFF;
  return {
    result: res,
    flags: (res & 0x80 ? F_S : 0) |
           (res === 0 ? F_Z : 0) |
           (((a & 0xF) + (r & 0xF) + cy) > 0xF ? F_H : 0) |
           (((a ^ full) & (r ^ full) & 0x80) ? F_PV : 0) |
           // N = 0
           (full > 0xFF ? F_C : 0)
  };
};

const flagsSUB = (a, r) => {
  const full = a - r;
  const res  = full & 0xFF;
  return {
    result: res,
    flags: (res & 0x80 ? F_S : 0) |
           (res === 0 ? F_Z : 0) |
           ((a & 0xF) < (r & 0xF) ? F_H : 0) |
           (((a ^ r) & (a ^ res) & 0x80) ? F_PV : 0) |
           F_N |
           (full < 0 ? F_C : 0)
  };
};

const flagsSBC = (a, r, cy) => {
  const full = a - r - cy;
  const res  = full & 0xFF;
  return {
    result: res,
    flags: (res & 0x80 ? F_S : 0) |
           (res === 0 ? F_Z : 0) |
           ((a & 0xF) < ((r & 0xF) + cy) ? F_H : 0) |
           (((a ^ r) & (a ^ res) & 0x80) ? F_PV : 0) |
           F_N |
           (full < 0 ? F_C : 0)
  };
};

const flagsAND = (a, r) => {
  const res = a & r;
  return {
    result: res,
    flags: (res & 0x80 ? F_S : 0) |
           (res === 0 ? F_Z : 0) |
           F_H | // H always set for AND
           (parity(res) ? F_PV : 0)
           // N=0, C=0
  };
};

const flagsXOR = (a, r) => {
  const res = a ^ r;
  return {
    result: res,
    flags: (res & 0x80 ? F_S : 0) |
           (res === 0 ? F_Z : 0) |
           (parity(res) ? F_PV : 0)
           // H=0, N=0, C=0
  };
};

const flagsOR = (a, r) => {
  const res = a | r;
  return {
    result: res,
    flags: (res & 0x80 ? F_S : 0) |
           (res === 0 ? F_Z : 0) |
           (parity(res) ? F_PV : 0)
           // H=0, N=0, C=0
  };
};

// CP: like SUB but A unchanged; Y,X from r (Z80 quirk, ignored here - we mask undocumented)
const flagsCP = (a, r) => {
  const full = a - r;
  const res  = full & 0xFF;
  return {
    result: a, // A unchanged
    flags: (res & 0x80 ? F_S : 0) |
           (res === 0 ? F_Z : 0) |
           ((a & 0xF) < (r & 0xF) ? F_H : 0) |
           (((a ^ r) & (a ^ res) & 0x80) ? F_PV : 0) |
           F_N |
           (full < 0 ? F_C : 0)
  };
};

const flagsINC = (r, prevC) => {
  const res = (r + 1) & 0xFF;
  return {
    result: res,
    flags: (res & 0x80 ? F_S : 0) |
           (res === 0 ? F_Z : 0) |
           ((r & 0xF) === 0xF ? F_H : 0) |
           (r === 0x7F ? F_PV : 0) |
           // N = 0
           prevC // C unchanged
  };
};

const flagsDEC = (r, prevC) => {
  const res = (r - 1) & 0xFF;
  return {
    result: res,
    flags: (res & 0x80 ? F_S : 0) |
           (res === 0 ? F_Z : 0) |
           ((r & 0xF) === 0x0 ? F_H : 0) |
           (r === 0x80 ? F_PV : 0) |
           F_N |
           prevC // C unchanged
  };
};

// Register names
const REG_NAMES = ["B", "C", "D", "E", "H", "L", "(HL)", "A"];
const REG_SET   = ["B", "C", "D", "E", "H", "L", null,   "A"];
const REG_STAT  = ["b", "c", "d", "e", "h", "l", null,   "a"];

// INC opcode table
const INC_OPS = [0x04, 0x0C, 0x14, 0x1C, 0x24, 0x2C, 0x34, 0x3C];
// DEC opcode table
const DEC_OPS = [0x05, 0x0D, 0x15, 0x1D, 0x25, 0x2D, 0x35, 0x3D];

// Test vectors for each operation
// Format: [aVal, rVal, description]
const ADD_VECTORS = [
  [0x10, 0x20, "simple"],
  [0xFF, 0x01, "carry out"],
  [0x70, 0x10, "overflow"],
  [0x08, 0x08, "half-carry"],
  [0x00, 0x00, "zero result"],
];

const SUB_VECTORS = [
  [0x40, 0x10, "simple"],
  [0x30, 0x30, "zero result"],
  [0x10, 0x20, "borrow (carry out)"],
  [0x80, 0x01, "overflow"],
  [0x18, 0x09, "half-borrow"],
];

const AND_VECTORS = [
  [0xF0, 0x0F, "no overlap"],
  [0xFF, 0xAA, "partial"],
  [0xAA, 0xAA, "same value"],
  [0x00, 0xFF, "zero result"],
];

const XOR_VECTORS = [
  [0xFF, 0x0F, "partial"],
  [0xAA, 0xAA, "self XOR = 0"],
  [0x00, 0x80, "sign bit"],
  [0x55, 0xAA, "alternating"],
];

const OR_VECTORS = [
  [0xF0, 0x0F, "merge nibbles"],
  [0x00, 0x00, "zero result"],
  [0x80, 0x40, "two bits"],
  [0x55, 0xAA, "full set"],
];

const CP_VECTORS = [
  [0x50, 0x10, "greater"],
  [0x30, 0x30, "equal (Z set)"],
  [0x10, 0x20, "less (C set)"],
  [0x80, 0x01, "overflow"],
];

const ADC_VECTORS_NOCY = [
  [0x10, 0x20, "no carry"],
  [0xFF, 0x00, "no overflow with carry=0"],
];
const ADC_VECTORS_CY = [
  [0x10, 0x20, "with carry=1"],
  [0xFF, 0x00, "carry propagates"],
];

const SBC_VECTORS_NOCY = [
  [0x40, 0x10, "no carry"],
  [0x30, 0x30, "equal no carry"],
];
const SBC_VECTORS_CY = [
  [0x40, 0x10, "with borrow"],
  [0x30, 0x30, "equal with borrow"],
];

const INC_VECTORS = [0x00, 0x0F, 0x7F, 0xFE, 0xFF];
const DEC_VECTORS = [0x01, 0x10, 0x80, 0x00, 0xFF];

// ============================================================
// Code generator functions
// ============================================================

const hex = (n) => `0x${n.toString(16).toUpperCase().padStart(2, "0")}`;

const genSetReg = (ri, rVal, hlAddr) => {
  if (ri === 6) {
    return `      cpu.set("HL", ${hex(hlAddr)});\n      mem[${hex(hlAddr)}] = ${hex(rVal)};`;
  } else if (ri === 7) {
    return ""; // A is already set by cpu.set("A", aVal)
  } else {
    return `      cpu.set("${REG_SET[ri]}", ${hex(rVal)});`;
  }
};

const genGetReg = (ri) => {
  if (ri === 6) return "mem[HL_ADDR]";
  return `cpu.status().${REG_STAT[ri]}`;
};

// Generate ADD A,r tests for all registers
const genADD = () => {
  const lines = [];
  lines.push(`  QUnit.module("ADD A,r - all registers", () => {`);
  for (let ri = 0; ri < 8; ri++) {
    const name = REG_NAMES[ri];
    const opcode = hex(0x80 | ri);
    lines.push(`    QUnit.test("ADD A,${name} (opcode ${opcode})", (assert) => {`);
    lines.push(`      const HL_ADDR = 0x2000;`);
    for (const [aIn, rIn, desc] of ADD_VECTORS) {
      const rVal = ri === 7 ? aIn : rIn; // ADD A,A uses A as operand
      const { result, flags } = flagsADD(aIn, rVal);
      lines.push(`      // ${desc}: A=${hex(aIn)} + ${name}=${hex(rVal)} = ${hex(result)}`);
      lines.push(`      { const { cpu, mem } = createTestCPU();`);
      lines.push(`        cpu.set("A", ${hex(aIn)});`);
      const setReg = genSetReg(ri, rVal, 0x2000);
      if (setReg) lines.push(`        ${setReg.trim()}`);
      lines.push(`        mem[0] = ${opcode};`);
      lines.push(`        cpu.step();`);
      lines.push(`        assert.equal(cpu.status().a, ${hex(result)}, "A=${hex(aIn)}+${hex(rVal)}=${hex(result)} (${desc})");`);
      lines.push(`        assert.equal(cpu.status().f & 0xD7, ${hex(flags & 0xD7)}, "flags (${desc})"); }`);
    }
    lines.push(`    });`);
  }
  lines.push(`  });`);
  return lines.join("\n");
};

// Generate SUB r tests
const genSUB = () => {
  const lines = [];
  lines.push(`  QUnit.module("SUB r - all registers", () => {`);
  for (let ri = 0; ri < 8; ri++) {
    const name = REG_NAMES[ri];
    const opcode = hex(0x90 | ri);
    lines.push(`    QUnit.test("SUB ${name} (opcode ${opcode})", (assert) => {`);
    lines.push(`      const HL_ADDR = 0x2000;`);
    for (const [aIn, rIn, desc] of SUB_VECTORS) {
      const rVal = ri === 7 ? aIn : rIn; // SUB A: A-A = 0
      const { result, flags } = flagsSUB(aIn, rVal);
      lines.push(`      // ${desc}: A=${hex(aIn)} - ${name}=${hex(rVal)} = ${hex(result)}`);
      lines.push(`      { const { cpu, mem } = createTestCPU();`);
      lines.push(`        cpu.set("A", ${hex(aIn)});`);
      const setReg = genSetReg(ri, rVal, 0x2000);
      if (setReg) lines.push(`        ${setReg.trim()}`);
      lines.push(`        mem[0] = ${opcode};`);
      lines.push(`        cpu.step();`);
      lines.push(`        assert.equal(cpu.status().a, ${hex(result)}, "A=${hex(aIn)}-${hex(rVal)}=${hex(result)} (${desc})");`);
      lines.push(`        assert.equal(cpu.status().f & 0xD7, ${hex(flags & 0xD7)}, "flags (${desc})"); }`);
    }
    lines.push(`    });`);
  }
  lines.push(`  });`);
  return lines.join("\n");
};

// Generate AND r tests
const genAND = () => {
  const lines = [];
  lines.push(`  QUnit.module("AND r - all registers", () => {`);
  for (let ri = 0; ri < 8; ri++) {
    const name = REG_NAMES[ri];
    const opcode = hex(0xA0 | ri);
    lines.push(`    QUnit.test("AND ${name} (opcode ${opcode})", (assert) => {`);
    lines.push(`      const HL_ADDR = 0x2000;`);
    for (const [aIn, rIn, desc] of AND_VECTORS) {
      const rVal = ri === 7 ? aIn : rIn;
      const { result, flags } = flagsAND(aIn, rVal);
      lines.push(`      { const { cpu, mem } = createTestCPU();`);
      lines.push(`        cpu.set("A", ${hex(aIn)});`);
      const setReg = genSetReg(ri, rVal, 0x2000);
      if (setReg) lines.push(`        ${setReg.trim()}`);
      lines.push(`        mem[0] = ${opcode};`);
      lines.push(`        cpu.step();`);
      lines.push(`        assert.equal(cpu.status().a, ${hex(result)}, "A=${hex(aIn)}&${hex(rVal)}=${hex(result)} (${desc})");`);
      lines.push(`        assert.equal(cpu.status().f & 0xD7, ${hex(flags & 0xD7)}, "flags (${desc})"); }`);
    }
    lines.push(`    });`);
  }
  lines.push(`  });`);
  return lines.join("\n");
};

// Generate XOR r tests
const genXOR = () => {
  const lines = [];
  lines.push(`  QUnit.module("XOR r - all registers", () => {`);
  for (let ri = 0; ri < 8; ri++) {
    const name = REG_NAMES[ri];
    const opcode = hex(0xA8 | ri);
    lines.push(`    QUnit.test("XOR ${name} (opcode ${opcode})", (assert) => {`);
    lines.push(`      const HL_ADDR = 0x2000;`);
    for (const [aIn, rIn, desc] of XOR_VECTORS) {
      const rVal = ri === 7 ? aIn : rIn;
      const { result, flags } = flagsXOR(aIn, rVal);
      lines.push(`      { const { cpu, mem } = createTestCPU();`);
      lines.push(`        cpu.set("A", ${hex(aIn)});`);
      const setReg = genSetReg(ri, rVal, 0x2000);
      if (setReg) lines.push(`        ${setReg.trim()}`);
      lines.push(`        mem[0] = ${opcode};`);
      lines.push(`        cpu.step();`);
      lines.push(`        assert.equal(cpu.status().a, ${hex(result)}, "A=${hex(aIn)}^${hex(rVal)}=${hex(result)} (${desc})");`);
      lines.push(`        assert.equal(cpu.status().f & 0xD7, ${hex(flags & 0xD7)}, "flags (${desc})"); }`);
    }
    lines.push(`    });`);
  }
  lines.push(`  });`);
  return lines.join("\n");
};

// Generate OR r tests
const genOR = () => {
  const lines = [];
  lines.push(`  QUnit.module("OR r - all registers", () => {`);
  for (let ri = 0; ri < 8; ri++) {
    const name = REG_NAMES[ri];
    const opcode = hex(0xB0 | ri);
    lines.push(`    QUnit.test("OR ${name} (opcode ${opcode})", (assert) => {`);
    lines.push(`      const HL_ADDR = 0x2000;`);
    for (const [aIn, rIn, desc] of OR_VECTORS) {
      const rVal = ri === 7 ? aIn : rIn;
      const { result, flags } = flagsOR(aIn, rVal);
      lines.push(`      { const { cpu, mem } = createTestCPU();`);
      lines.push(`        cpu.set("A", ${hex(aIn)});`);
      const setReg = genSetReg(ri, rVal, 0x2000);
      if (setReg) lines.push(`        ${setReg.trim()}`);
      lines.push(`        mem[0] = ${opcode};`);
      lines.push(`        cpu.step();`);
      lines.push(`        assert.equal(cpu.status().a, ${hex(result)}, "A=${hex(aIn)}|${hex(rVal)}=${hex(result)} (${desc})");`);
      lines.push(`        assert.equal(cpu.status().f & 0xD7, ${hex(flags & 0xD7)}, "flags (${desc})"); }`);
    }
    lines.push(`    });`);
  }
  lines.push(`  });`);
  return lines.join("\n");
};

// Generate CP r tests
const genCP = () => {
  const lines = [];
  lines.push(`  QUnit.module("CP r - all registers", () => {`);
  for (let ri = 0; ri < 8; ri++) {
    const name = REG_NAMES[ri];
    const opcode = hex(0xB8 | ri);
    lines.push(`    QUnit.test("CP ${name} (opcode ${opcode})", (assert) => {`);
    lines.push(`      const HL_ADDR = 0x2000;`);
    for (const [aIn, rIn, desc] of CP_VECTORS) {
      const rVal = ri === 7 ? aIn : rIn;
      const { result, flags } = flagsCP(aIn, rVal);
      lines.push(`      { const { cpu, mem } = createTestCPU();`);
      lines.push(`        cpu.set("A", ${hex(aIn)});`);
      const setReg = genSetReg(ri, rVal, 0x2000);
      if (setReg) lines.push(`        ${setReg.trim()}`);
      lines.push(`        mem[0] = ${opcode};`);
      lines.push(`        cpu.step();`);
      lines.push(`        assert.equal(cpu.status().a, ${hex(result)}, "A unchanged=${hex(result)} (${desc})");`);
      lines.push(`        assert.equal(cpu.status().f & 0xD7, ${hex(flags & 0xD7)}, "flags (${desc})"); }`);
    }
    lines.push(`    });`);
  }
  lines.push(`  });`);
  return lines.join("\n");
};

// Generate ADC A,r tests (carry=0 and carry=1)
const genADC = () => {
  const lines = [];
  lines.push(`  QUnit.module("ADC A,r - all registers", () => {`);
  for (let ri = 0; ri < 8; ri++) {
    const name = REG_NAMES[ri];
    const opcode = hex(0x88 | ri);
    lines.push(`    QUnit.test("ADC A,${name} (opcode ${opcode})", (assert) => {`);
    lines.push(`      const HL_ADDR = 0x2000;`);
    // Test with carry=0
    for (const [aIn, rIn, desc] of ADC_VECTORS_NOCY) {
      const rVal = ri === 7 ? aIn : rIn;
      const { result, flags } = flagsADC(aIn, rVal, 0);
      lines.push(`      // carry=0: ${desc}`);
      lines.push(`      { const { cpu, mem } = createTestCPU();`);
      lines.push(`        cpu.set("A", ${hex(aIn)});`);
      const setReg = genSetReg(ri, rVal, 0x2000);
      if (setReg) lines.push(`        ${setReg.trim()}`);
      lines.push(`        mem[0] = ${opcode};`);
      lines.push(`        cpu.step();`);
      lines.push(`        assert.equal(cpu.status().a, ${hex(result)}, "ADC cy=0: A=${hex(aIn)}+${hex(rVal)}+0=${hex(result)}");`);
      lines.push(`        assert.equal(cpu.status().f & 0xD7, ${hex(flags & 0xD7)}, "flags cy=0"); }`);
    }
    // Test with carry=1 (need to set carry flag before ADC)
    for (const [aIn, rIn, desc] of ADC_VECTORS_CY) {
      const rVal = ri === 7 ? aIn : rIn;
      const { result, flags } = flagsADC(aIn, rVal, 1);
      lines.push(`      // carry=1: ${desc}`);
      lines.push(`      { const { cpu, mem } = createTestCPU();`);
      lines.push(`        cpu.set("A", ${hex(aIn)});`);
      const setReg = genSetReg(ri, rVal, 0x2000);
      if (setReg) lines.push(`        ${setReg.trim()}`);
      // SCF sets carry; then ADC
      lines.push(`        mem[0] = 0x37; // SCF`);
      lines.push(`        mem[1] = ${opcode}; // ADC A,${name}`);
      lines.push(`        cpu.step(); // SCF`);
      lines.push(`        cpu.step(); // ADC`);
      lines.push(`        assert.equal(cpu.status().a, ${hex(result)}, "ADC cy=1: A=${hex(aIn)}+${hex(rVal)}+1=${hex(result)}");`);
      lines.push(`        assert.equal(cpu.status().f & 0xD7, ${hex(flags & 0xD7)}, "flags cy=1"); }`);
    }
    lines.push(`    });`);
  }
  lines.push(`  });`);
  return lines.join("\n");
};

// Generate SBC A,r tests
const genSBC = () => {
  const lines = [];
  lines.push(`  QUnit.module("SBC A,r - all registers", () => {`);
  for (let ri = 0; ri < 8; ri++) {
    const name = REG_NAMES[ri];
    const opcode = hex(0x98 | ri);
    lines.push(`    QUnit.test("SBC A,${name} (opcode ${opcode})", (assert) => {`);
    lines.push(`      const HL_ADDR = 0x2000;`);
    for (const [aIn, rIn, desc] of SBC_VECTORS_NOCY) {
      const rVal = ri === 7 ? aIn : rIn;
      const { result, flags } = flagsSBC(aIn, rVal, 0);
      lines.push(`      { const { cpu, mem } = createTestCPU();`);
      lines.push(`        cpu.set("A", ${hex(aIn)});`);
      const setReg = genSetReg(ri, rVal, 0x2000);
      if (setReg) lines.push(`        ${setReg.trim()}`);
      lines.push(`        mem[0] = ${opcode};`);
      lines.push(`        cpu.step();`);
      lines.push(`        assert.equal(cpu.status().a, ${hex(result)}, "SBC cy=0: A=${hex(aIn)}-${hex(rVal)}-0=${hex(result)} (${desc})");`);
      lines.push(`        assert.equal(cpu.status().f & 0xD7, ${hex(flags & 0xD7)}, "flags (${desc})"); }`);
    }
    for (const [aIn, rIn, desc] of SBC_VECTORS_CY) {
      const rVal = ri === 7 ? aIn : rIn;
      const { result, flags } = flagsSBC(aIn, rVal, 1);
      lines.push(`      { const { cpu, mem } = createTestCPU();`);
      lines.push(`        cpu.set("A", ${hex(aIn)});`);
      const setReg = genSetReg(ri, rVal, 0x2000);
      if (setReg) lines.push(`        ${setReg.trim()}`);
      lines.push(`        mem[0] = 0x37; // SCF`);
      lines.push(`        mem[1] = ${opcode}; // SBC A,${name}`);
      lines.push(`        cpu.step(); // SCF`);
      lines.push(`        cpu.step(); // SBC`);
      lines.push(`        assert.equal(cpu.status().a, ${hex(result)}, "SBC cy=1: A=${hex(aIn)}-${hex(rVal)}-1=${hex(result)} (${desc})");`);
      lines.push(`        assert.equal(cpu.status().f & 0xD7, ${hex(flags & 0xD7)}, "flags cy=1 (${desc})"); }`);
    }
    lines.push(`    });`);
  }
  lines.push(`  });`);
  return lines.join("\n");
};

// Generate INC r tests
const genINC = () => {
  const lines = [];
  lines.push(`  QUnit.module("INC r - all registers", () => {`);
  for (let ri = 0; ri < 8; ri++) {
    const name = REG_NAMES[ri];
    const opcode = hex(INC_OPS[ri]);
    lines.push(`    QUnit.test("INC ${name} (opcode ${opcode})", (assert) => {`);
    lines.push(`      const HL_ADDR = 0x2000;`);
    for (const rIn of INC_VECTORS) {
      const { result, flags } = flagsINC(rIn, 0); // prevC=0
      lines.push(`      { const { cpu, mem } = createTestCPU();`);
      if (ri === 6) {
        lines.push(`        cpu.set("HL", 0x2000); mem[0x2000] = ${hex(rIn)};`);
      } else {
        lines.push(`        cpu.set("${REG_SET[ri]}", ${hex(rIn)});`);
      }
      lines.push(`        mem[0] = ${opcode};`);
      lines.push(`        cpu.step();`);
      if (ri === 6) {
        lines.push(`        assert.equal(mem[0x2000], ${hex(result)}, "INC (HL): ${hex(rIn)}+1=${hex(result)}");`);
      } else {
        lines.push(`        assert.equal(cpu.status().${REG_STAT[ri]}, ${hex(result)}, "INC ${name}: ${hex(rIn)}+1=${hex(result)}");`);
      }
      lines.push(`        assert.equal(cpu.status().f & 0xD6, ${hex(flags & 0xD6)}, "flags (${hex(rIn)}+1)"); }`);
    }
    lines.push(`    });`);
  }
  lines.push(`  });`);
  return lines.join("\n");
};

// Generate DEC r tests
const genDEC = () => {
  const lines = [];
  lines.push(`  QUnit.module("DEC r - all registers", () => {`);
  for (let ri = 0; ri < 8; ri++) {
    const name = REG_NAMES[ri];
    const opcode = hex(DEC_OPS[ri]);
    lines.push(`    QUnit.test("DEC ${name} (opcode ${opcode})", (assert) => {`);
    lines.push(`      const HL_ADDR = 0x2000;`);
    for (const rIn of DEC_VECTORS) {
      const { result, flags } = flagsDEC(rIn, 0); // prevC=0
      lines.push(`      { const { cpu, mem } = createTestCPU();`);
      if (ri === 6) {
        lines.push(`        cpu.set("HL", 0x2000); mem[0x2000] = ${hex(rIn)};`);
      } else {
        lines.push(`        cpu.set("${REG_SET[ri]}", ${hex(rIn)});`);
      }
      lines.push(`        mem[0] = ${opcode};`);
      lines.push(`        cpu.step();`);
      if (ri === 6) {
        lines.push(`        assert.equal(mem[0x2000], ${hex(result)}, "DEC (HL): ${hex(rIn)}-1=${hex(result)}");`);
      } else {
        lines.push(`        assert.equal(cpu.status().${REG_STAT[ri]}, ${hex(result)}, "DEC ${name}: ${hex(rIn)}-1=${hex(result)}");`);
      }
      lines.push(`        assert.equal(cpu.status().f & 0xD7, ${hex(flags & 0xD7)}, "flags (${hex(rIn)}-1)"); }`);
    }
    lines.push(`    });`);
  }
  lines.push(`  });`);
  return lines.join("\n");
};

// Generate immediate form tests (ADD A,n; ADC A,n; SUB n; SBC A,n; AND n; XOR n; OR n; CP n)
const genImmediates = () => {
  const lines = [];
  lines.push(`  QUnit.module("ALU immediate - n forms", () => {`);

  const ops = [
    { name: "ADD A,n", op: 0xC6, fn: flagsADD, vectors: [[0x10, 0x20], [0xFF, 0x01], [0x70, 0x10]] },
    { name: "ADC A,n", op: 0xCE, fn: flagsADC, vectors: [[0x10, 0x20], [0xFF, 0x00]], hasCy: true },
    { name: "SUB n",   op: 0xD6, fn: flagsSUB, vectors: [[0x40, 0x10], [0x30, 0x30], [0x10, 0x20]] },
    { name: "SBC A,n", op: 0xDE, fn: flagsSBC, vectors: [[0x40, 0x10], [0x30, 0x30]], hasCy: true },
    { name: "AND n",   op: 0xE6, fn: flagsAND, vectors: [[0xF0, 0x0F], [0xFF, 0xAA], [0x00, 0xFF]] },
    { name: "XOR n",   op: 0xEE, fn: flagsXOR, vectors: [[0xFF, 0x0F], [0xAA, 0xAA], [0x00, 0x80]] },
    { name: "OR n",    op: 0xF6, fn: flagsOR,  vectors: [[0xF0, 0x0F], [0x00, 0x00], [0x55, 0xAA]] },
    { name: "CP n",    op: 0xFE, fn: flagsCP,  vectors: [[0x50, 0x10], [0x30, 0x30], [0x10, 0x20]] },
  ];

  for (const { name, op, fn, vectors, hasCy } of ops) {
    lines.push(`    QUnit.test("${name} (opcode ${hex(op)})", (assert) => {`);
    for (const [aIn, rVal] of vectors) {
      const { result, flags } = fn(aIn, rVal, 0);
      lines.push(`      { const { cpu, mem } = createTestCPU();`);
      lines.push(`        cpu.set("A", ${hex(aIn)});`);
      lines.push(`        mem[0] = ${hex(op)}; mem[1] = ${hex(rVal)};`);
      lines.push(`        cpu.step();`);
      lines.push(`        assert.equal(cpu.status().a, ${hex(result)}, "${name} A=${hex(aIn)},n=${hex(rVal)}=${hex(result)}");`);
      lines.push(`        assert.equal(cpu.status().f & 0xD7, ${hex(flags & 0xD7)}, "flags"); }`);
    }
    if (hasCy) {
      // Also test with carry=1
      const [aIn, rVal] = vectors[0];
      const { result, flags } = fn(aIn, rVal, 1);
      lines.push(`      { const { cpu, mem } = createTestCPU(); // with carry=1`);
      lines.push(`        cpu.set("A", ${hex(aIn)});`);
      lines.push(`        mem[0] = 0x37; // SCF`);
      lines.push(`        mem[1] = ${hex(op)}; mem[2] = ${hex(rVal)};`);
      lines.push(`        cpu.step(); cpu.step();`);
      lines.push(`        assert.equal(cpu.status().a, ${hex(result)}, "${name} cy=1: A=${hex(aIn)},n=${hex(rVal)}+1=${hex(result)}");`);
      lines.push(`        assert.equal(cpu.status().f & 0xD7, ${hex(flags & 0xD7)}, "flags cy=1"); }`);
    }
    lines.push(`    });`);
  }

  lines.push(`  });`);
  return lines.join("\n");
};

// ============================================================
// Main output
// ============================================================

const output = `
/**
 * Zilog Z80 CPU Emulator - 8-bit ALU Complete Register Coverage
 *
 * Auto-generated tests for all arithmetic/logic instructions across all 8 register variants.
 * Covers: ADD, ADC, SUB, SBC, AND, XOR, OR, CP (register and immediate forms), INC, DEC.
 */

import QUnit from "qunit";
import z80 from "../src/z80.js";

QUnit.module("Z80 8-bit ALU - Register Coverage", () => {
  const createTestCPU = () => {
    const mem = new Uint8Array(65536);
    const ports = new Uint8Array(256);
    const cpu = z80({
      byteAt: (addr) => mem[addr] || 0,
      byteTo: (addr, val) => { mem[addr] = val & 0xFF; },
      portOut: (port, val) => { ports[port] = val & 0xFF; },
      portIn: (port) => ports[port] || 0
    });
    return { cpu, mem, ports };
  };

${genADD()}

${genADC()}

${genSUB()}

${genSBC()}

${genAND()}

${genXOR()}

${genOR()}

${genCP()}

${genINC()}

${genDEC()}

${genImmediates()}
});
`;

process.stdout.write(output);
