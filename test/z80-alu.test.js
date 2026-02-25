
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

  QUnit.module("ADD A,r - all registers", () => {
    QUnit.test("ADD A,B (opcode 0x80)", (assert) => {
      const HL_ADDR = 0x2000;
      // simple: A=0x10 + B=0x20 = 0x30
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x10);
        cpu.set("B", 0x20);
        mem[0] = 0x80;
        cpu.step();
        assert.equal(cpu.status().a, 0x30, "A=0x10+0x20=0x30 (simple)");
        assert.equal(cpu.status().f & 0xD7, 0x00, "flags (simple)"); }
      // carry out: A=0xFF + B=0x01 = 0x00
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);
        cpu.set("B", 0x01);
        mem[0] = 0x80;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0xFF+0x01=0x00 (carry out)");
        assert.equal(cpu.status().f & 0xD7, 0x51, "flags (carry out)"); }
      // overflow: A=0x70 + B=0x10 = 0x80
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x70);
        cpu.set("B", 0x10);
        mem[0] = 0x80;
        cpu.step();
        assert.equal(cpu.status().a, 0x80, "A=0x70+0x10=0x80 (overflow)");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags (overflow)"); }
      // half-carry: A=0x08 + B=0x08 = 0x10
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x08);
        cpu.set("B", 0x08);
        mem[0] = 0x80;
        cpu.step();
        assert.equal(cpu.status().a, 0x10, "A=0x08+0x08=0x10 (half-carry)");
        assert.equal(cpu.status().f & 0xD7, 0x10, "flags (half-carry)"); }
      // zero result: A=0x00 + B=0x00 = 0x00
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x00);
        cpu.set("B", 0x00);
        mem[0] = 0x80;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0x00+0x00=0x00 (zero result)");
        assert.equal(cpu.status().f & 0xD7, 0x40, "flags (zero result)"); }
    });
    QUnit.test("ADD A,C (opcode 0x81)", (assert) => {
      const HL_ADDR = 0x2000;
      // simple: A=0x10 + C=0x20 = 0x30
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x10);
        cpu.set("C", 0x20);
        mem[0] = 0x81;
        cpu.step();
        assert.equal(cpu.status().a, 0x30, "A=0x10+0x20=0x30 (simple)");
        assert.equal(cpu.status().f & 0xD7, 0x00, "flags (simple)"); }
      // carry out: A=0xFF + C=0x01 = 0x00
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);
        cpu.set("C", 0x01);
        mem[0] = 0x81;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0xFF+0x01=0x00 (carry out)");
        assert.equal(cpu.status().f & 0xD7, 0x51, "flags (carry out)"); }
      // overflow: A=0x70 + C=0x10 = 0x80
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x70);
        cpu.set("C", 0x10);
        mem[0] = 0x81;
        cpu.step();
        assert.equal(cpu.status().a, 0x80, "A=0x70+0x10=0x80 (overflow)");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags (overflow)"); }
      // half-carry: A=0x08 + C=0x08 = 0x10
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x08);
        cpu.set("C", 0x08);
        mem[0] = 0x81;
        cpu.step();
        assert.equal(cpu.status().a, 0x10, "A=0x08+0x08=0x10 (half-carry)");
        assert.equal(cpu.status().f & 0xD7, 0x10, "flags (half-carry)"); }
      // zero result: A=0x00 + C=0x00 = 0x00
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x00);
        cpu.set("C", 0x00);
        mem[0] = 0x81;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0x00+0x00=0x00 (zero result)");
        assert.equal(cpu.status().f & 0xD7, 0x40, "flags (zero result)"); }
    });
    QUnit.test("ADD A,D (opcode 0x82)", (assert) => {
      const HL_ADDR = 0x2000;
      // simple: A=0x10 + D=0x20 = 0x30
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x10);
        cpu.set("D", 0x20);
        mem[0] = 0x82;
        cpu.step();
        assert.equal(cpu.status().a, 0x30, "A=0x10+0x20=0x30 (simple)");
        assert.equal(cpu.status().f & 0xD7, 0x00, "flags (simple)"); }
      // carry out: A=0xFF + D=0x01 = 0x00
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);
        cpu.set("D", 0x01);
        mem[0] = 0x82;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0xFF+0x01=0x00 (carry out)");
        assert.equal(cpu.status().f & 0xD7, 0x51, "flags (carry out)"); }
      // overflow: A=0x70 + D=0x10 = 0x80
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x70);
        cpu.set("D", 0x10);
        mem[0] = 0x82;
        cpu.step();
        assert.equal(cpu.status().a, 0x80, "A=0x70+0x10=0x80 (overflow)");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags (overflow)"); }
      // half-carry: A=0x08 + D=0x08 = 0x10
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x08);
        cpu.set("D", 0x08);
        mem[0] = 0x82;
        cpu.step();
        assert.equal(cpu.status().a, 0x10, "A=0x08+0x08=0x10 (half-carry)");
        assert.equal(cpu.status().f & 0xD7, 0x10, "flags (half-carry)"); }
      // zero result: A=0x00 + D=0x00 = 0x00
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x00);
        cpu.set("D", 0x00);
        mem[0] = 0x82;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0x00+0x00=0x00 (zero result)");
        assert.equal(cpu.status().f & 0xD7, 0x40, "flags (zero result)"); }
    });
    QUnit.test("ADD A,E (opcode 0x83)", (assert) => {
      const HL_ADDR = 0x2000;
      // simple: A=0x10 + E=0x20 = 0x30
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x10);
        cpu.set("E", 0x20);
        mem[0] = 0x83;
        cpu.step();
        assert.equal(cpu.status().a, 0x30, "A=0x10+0x20=0x30 (simple)");
        assert.equal(cpu.status().f & 0xD7, 0x00, "flags (simple)"); }
      // carry out: A=0xFF + E=0x01 = 0x00
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);
        cpu.set("E", 0x01);
        mem[0] = 0x83;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0xFF+0x01=0x00 (carry out)");
        assert.equal(cpu.status().f & 0xD7, 0x51, "flags (carry out)"); }
      // overflow: A=0x70 + E=0x10 = 0x80
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x70);
        cpu.set("E", 0x10);
        mem[0] = 0x83;
        cpu.step();
        assert.equal(cpu.status().a, 0x80, "A=0x70+0x10=0x80 (overflow)");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags (overflow)"); }
      // half-carry: A=0x08 + E=0x08 = 0x10
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x08);
        cpu.set("E", 0x08);
        mem[0] = 0x83;
        cpu.step();
        assert.equal(cpu.status().a, 0x10, "A=0x08+0x08=0x10 (half-carry)");
        assert.equal(cpu.status().f & 0xD7, 0x10, "flags (half-carry)"); }
      // zero result: A=0x00 + E=0x00 = 0x00
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x00);
        cpu.set("E", 0x00);
        mem[0] = 0x83;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0x00+0x00=0x00 (zero result)");
        assert.equal(cpu.status().f & 0xD7, 0x40, "flags (zero result)"); }
    });
    QUnit.test("ADD A,H (opcode 0x84)", (assert) => {
      const HL_ADDR = 0x2000;
      // simple: A=0x10 + H=0x20 = 0x30
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x10);
        cpu.set("H", 0x20);
        mem[0] = 0x84;
        cpu.step();
        assert.equal(cpu.status().a, 0x30, "A=0x10+0x20=0x30 (simple)");
        assert.equal(cpu.status().f & 0xD7, 0x00, "flags (simple)"); }
      // carry out: A=0xFF + H=0x01 = 0x00
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);
        cpu.set("H", 0x01);
        mem[0] = 0x84;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0xFF+0x01=0x00 (carry out)");
        assert.equal(cpu.status().f & 0xD7, 0x51, "flags (carry out)"); }
      // overflow: A=0x70 + H=0x10 = 0x80
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x70);
        cpu.set("H", 0x10);
        mem[0] = 0x84;
        cpu.step();
        assert.equal(cpu.status().a, 0x80, "A=0x70+0x10=0x80 (overflow)");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags (overflow)"); }
      // half-carry: A=0x08 + H=0x08 = 0x10
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x08);
        cpu.set("H", 0x08);
        mem[0] = 0x84;
        cpu.step();
        assert.equal(cpu.status().a, 0x10, "A=0x08+0x08=0x10 (half-carry)");
        assert.equal(cpu.status().f & 0xD7, 0x10, "flags (half-carry)"); }
      // zero result: A=0x00 + H=0x00 = 0x00
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x00);
        cpu.set("H", 0x00);
        mem[0] = 0x84;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0x00+0x00=0x00 (zero result)");
        assert.equal(cpu.status().f & 0xD7, 0x40, "flags (zero result)"); }
    });
    QUnit.test("ADD A,L (opcode 0x85)", (assert) => {
      const HL_ADDR = 0x2000;
      // simple: A=0x10 + L=0x20 = 0x30
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x10);
        cpu.set("L", 0x20);
        mem[0] = 0x85;
        cpu.step();
        assert.equal(cpu.status().a, 0x30, "A=0x10+0x20=0x30 (simple)");
        assert.equal(cpu.status().f & 0xD7, 0x00, "flags (simple)"); }
      // carry out: A=0xFF + L=0x01 = 0x00
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);
        cpu.set("L", 0x01);
        mem[0] = 0x85;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0xFF+0x01=0x00 (carry out)");
        assert.equal(cpu.status().f & 0xD7, 0x51, "flags (carry out)"); }
      // overflow: A=0x70 + L=0x10 = 0x80
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x70);
        cpu.set("L", 0x10);
        mem[0] = 0x85;
        cpu.step();
        assert.equal(cpu.status().a, 0x80, "A=0x70+0x10=0x80 (overflow)");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags (overflow)"); }
      // half-carry: A=0x08 + L=0x08 = 0x10
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x08);
        cpu.set("L", 0x08);
        mem[0] = 0x85;
        cpu.step();
        assert.equal(cpu.status().a, 0x10, "A=0x08+0x08=0x10 (half-carry)");
        assert.equal(cpu.status().f & 0xD7, 0x10, "flags (half-carry)"); }
      // zero result: A=0x00 + L=0x00 = 0x00
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x00);
        cpu.set("L", 0x00);
        mem[0] = 0x85;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0x00+0x00=0x00 (zero result)");
        assert.equal(cpu.status().f & 0xD7, 0x40, "flags (zero result)"); }
    });
    QUnit.test("ADD A,(HL) (opcode 0x86)", (assert) => {
      const HL_ADDR = 0x2000;
      // simple: A=0x10 + (HL)=0x20 = 0x30
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x10);
        cpu.set("HL", 0x2000);
      mem[0x2000] = 0x20;
        mem[0] = 0x86;
        cpu.step();
        assert.equal(cpu.status().a, 0x30, "A=0x10+0x20=0x30 (simple)");
        assert.equal(cpu.status().f & 0xD7, 0x00, "flags (simple)"); }
      // carry out: A=0xFF + (HL)=0x01 = 0x00
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);
        cpu.set("HL", 0x2000);
      mem[0x2000] = 0x01;
        mem[0] = 0x86;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0xFF+0x01=0x00 (carry out)");
        assert.equal(cpu.status().f & 0xD7, 0x51, "flags (carry out)"); }
      // overflow: A=0x70 + (HL)=0x10 = 0x80
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x70);
        cpu.set("HL", 0x2000);
      mem[0x2000] = 0x10;
        mem[0] = 0x86;
        cpu.step();
        assert.equal(cpu.status().a, 0x80, "A=0x70+0x10=0x80 (overflow)");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags (overflow)"); }
      // half-carry: A=0x08 + (HL)=0x08 = 0x10
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x08);
        cpu.set("HL", 0x2000);
      mem[0x2000] = 0x08;
        mem[0] = 0x86;
        cpu.step();
        assert.equal(cpu.status().a, 0x10, "A=0x08+0x08=0x10 (half-carry)");
        assert.equal(cpu.status().f & 0xD7, 0x10, "flags (half-carry)"); }
      // zero result: A=0x00 + (HL)=0x00 = 0x00
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x00);
        cpu.set("HL", 0x2000);
      mem[0x2000] = 0x00;
        mem[0] = 0x86;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0x00+0x00=0x00 (zero result)");
        assert.equal(cpu.status().f & 0xD7, 0x40, "flags (zero result)"); }
    });
    QUnit.test("ADD A,A (opcode 0x87)", (assert) => {
      const HL_ADDR = 0x2000;
      // simple: A=0x10 + A=0x10 = 0x20
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x10);
        mem[0] = 0x87;
        cpu.step();
        assert.equal(cpu.status().a, 0x20, "A=0x10+0x10=0x20 (simple)");
        assert.equal(cpu.status().f & 0xD7, 0x00, "flags (simple)"); }
      // carry out: A=0xFF + A=0xFF = 0xFE
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);
        mem[0] = 0x87;
        cpu.step();
        assert.equal(cpu.status().a, 0xFE, "A=0xFF+0xFF=0xFE (carry out)");
        assert.equal(cpu.status().f & 0xD7, 0x91, "flags (carry out)"); }
      // overflow: A=0x70 + A=0x70 = 0xE0
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x70);
        mem[0] = 0x87;
        cpu.step();
        assert.equal(cpu.status().a, 0xE0, "A=0x70+0x70=0xE0 (overflow)");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags (overflow)"); }
      // half-carry: A=0x08 + A=0x08 = 0x10
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x08);
        mem[0] = 0x87;
        cpu.step();
        assert.equal(cpu.status().a, 0x10, "A=0x08+0x08=0x10 (half-carry)");
        assert.equal(cpu.status().f & 0xD7, 0x10, "flags (half-carry)"); }
      // zero result: A=0x00 + A=0x00 = 0x00
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x00);
        mem[0] = 0x87;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0x00+0x00=0x00 (zero result)");
        assert.equal(cpu.status().f & 0xD7, 0x40, "flags (zero result)"); }
    });
  });

  QUnit.module("ADC A,r - all registers", () => {
    QUnit.test("ADC A,B (opcode 0x88)", (assert) => {
      const HL_ADDR = 0x2000;
      // carry=0: no carry
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x10);
        cpu.set("B", 0x20);
        mem[0] = 0x88;
        cpu.step();
        assert.equal(cpu.status().a, 0x30, "ADC cy=0: A=0x10+0x20+0=0x30");
        assert.equal(cpu.status().f & 0xD7, 0x00, "flags cy=0"); }
      // carry=0: no overflow with carry=0
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);
        cpu.set("B", 0x00);
        mem[0] = 0x88;
        cpu.step();
        assert.equal(cpu.status().a, 0xFF, "ADC cy=0: A=0xFF+0x00+0=0xFF");
        assert.equal(cpu.status().f & 0xD7, 0x80, "flags cy=0"); }
      // carry=1: with carry=1
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x10);
        cpu.set("B", 0x20);
        mem[0] = 0x37; // SCF
        mem[1] = 0x88; // ADC A,B
        cpu.step(); // SCF
        cpu.step(); // ADC
        assert.equal(cpu.status().a, 0x31, "ADC cy=1: A=0x10+0x20+1=0x31");
        assert.equal(cpu.status().f & 0xD7, 0x00, "flags cy=1"); }
      // carry=1: carry propagates
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);
        cpu.set("B", 0x00);
        mem[0] = 0x37; // SCF
        mem[1] = 0x88; // ADC A,B
        cpu.step(); // SCF
        cpu.step(); // ADC
        assert.equal(cpu.status().a, 0x00, "ADC cy=1: A=0xFF+0x00+1=0x00");
        assert.equal(cpu.status().f & 0xD7, 0x51, "flags cy=1"); }
    });
    QUnit.test("ADC A,C (opcode 0x89)", (assert) => {
      const HL_ADDR = 0x2000;
      // carry=0: no carry
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x10);
        cpu.set("C", 0x20);
        mem[0] = 0x89;
        cpu.step();
        assert.equal(cpu.status().a, 0x30, "ADC cy=0: A=0x10+0x20+0=0x30");
        assert.equal(cpu.status().f & 0xD7, 0x00, "flags cy=0"); }
      // carry=0: no overflow with carry=0
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);
        cpu.set("C", 0x00);
        mem[0] = 0x89;
        cpu.step();
        assert.equal(cpu.status().a, 0xFF, "ADC cy=0: A=0xFF+0x00+0=0xFF");
        assert.equal(cpu.status().f & 0xD7, 0x80, "flags cy=0"); }
      // carry=1: with carry=1
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x10);
        cpu.set("C", 0x20);
        mem[0] = 0x37; // SCF
        mem[1] = 0x89; // ADC A,C
        cpu.step(); // SCF
        cpu.step(); // ADC
        assert.equal(cpu.status().a, 0x31, "ADC cy=1: A=0x10+0x20+1=0x31");
        assert.equal(cpu.status().f & 0xD7, 0x00, "flags cy=1"); }
      // carry=1: carry propagates
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);
        cpu.set("C", 0x00);
        mem[0] = 0x37; // SCF
        mem[1] = 0x89; // ADC A,C
        cpu.step(); // SCF
        cpu.step(); // ADC
        assert.equal(cpu.status().a, 0x00, "ADC cy=1: A=0xFF+0x00+1=0x00");
        assert.equal(cpu.status().f & 0xD7, 0x51, "flags cy=1"); }
    });
    QUnit.test("ADC A,D (opcode 0x8A)", (assert) => {
      const HL_ADDR = 0x2000;
      // carry=0: no carry
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x10);
        cpu.set("D", 0x20);
        mem[0] = 0x8A;
        cpu.step();
        assert.equal(cpu.status().a, 0x30, "ADC cy=0: A=0x10+0x20+0=0x30");
        assert.equal(cpu.status().f & 0xD7, 0x00, "flags cy=0"); }
      // carry=0: no overflow with carry=0
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);
        cpu.set("D", 0x00);
        mem[0] = 0x8A;
        cpu.step();
        assert.equal(cpu.status().a, 0xFF, "ADC cy=0: A=0xFF+0x00+0=0xFF");
        assert.equal(cpu.status().f & 0xD7, 0x80, "flags cy=0"); }
      // carry=1: with carry=1
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x10);
        cpu.set("D", 0x20);
        mem[0] = 0x37; // SCF
        mem[1] = 0x8A; // ADC A,D
        cpu.step(); // SCF
        cpu.step(); // ADC
        assert.equal(cpu.status().a, 0x31, "ADC cy=1: A=0x10+0x20+1=0x31");
        assert.equal(cpu.status().f & 0xD7, 0x00, "flags cy=1"); }
      // carry=1: carry propagates
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);
        cpu.set("D", 0x00);
        mem[0] = 0x37; // SCF
        mem[1] = 0x8A; // ADC A,D
        cpu.step(); // SCF
        cpu.step(); // ADC
        assert.equal(cpu.status().a, 0x00, "ADC cy=1: A=0xFF+0x00+1=0x00");
        assert.equal(cpu.status().f & 0xD7, 0x51, "flags cy=1"); }
    });
    QUnit.test("ADC A,E (opcode 0x8B)", (assert) => {
      const HL_ADDR = 0x2000;
      // carry=0: no carry
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x10);
        cpu.set("E", 0x20);
        mem[0] = 0x8B;
        cpu.step();
        assert.equal(cpu.status().a, 0x30, "ADC cy=0: A=0x10+0x20+0=0x30");
        assert.equal(cpu.status().f & 0xD7, 0x00, "flags cy=0"); }
      // carry=0: no overflow with carry=0
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);
        cpu.set("E", 0x00);
        mem[0] = 0x8B;
        cpu.step();
        assert.equal(cpu.status().a, 0xFF, "ADC cy=0: A=0xFF+0x00+0=0xFF");
        assert.equal(cpu.status().f & 0xD7, 0x80, "flags cy=0"); }
      // carry=1: with carry=1
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x10);
        cpu.set("E", 0x20);
        mem[0] = 0x37; // SCF
        mem[1] = 0x8B; // ADC A,E
        cpu.step(); // SCF
        cpu.step(); // ADC
        assert.equal(cpu.status().a, 0x31, "ADC cy=1: A=0x10+0x20+1=0x31");
        assert.equal(cpu.status().f & 0xD7, 0x00, "flags cy=1"); }
      // carry=1: carry propagates
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);
        cpu.set("E", 0x00);
        mem[0] = 0x37; // SCF
        mem[1] = 0x8B; // ADC A,E
        cpu.step(); // SCF
        cpu.step(); // ADC
        assert.equal(cpu.status().a, 0x00, "ADC cy=1: A=0xFF+0x00+1=0x00");
        assert.equal(cpu.status().f & 0xD7, 0x51, "flags cy=1"); }
    });
    QUnit.test("ADC A,H (opcode 0x8C)", (assert) => {
      const HL_ADDR = 0x2000;
      // carry=0: no carry
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x10);
        cpu.set("H", 0x20);
        mem[0] = 0x8C;
        cpu.step();
        assert.equal(cpu.status().a, 0x30, "ADC cy=0: A=0x10+0x20+0=0x30");
        assert.equal(cpu.status().f & 0xD7, 0x00, "flags cy=0"); }
      // carry=0: no overflow with carry=0
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);
        cpu.set("H", 0x00);
        mem[0] = 0x8C;
        cpu.step();
        assert.equal(cpu.status().a, 0xFF, "ADC cy=0: A=0xFF+0x00+0=0xFF");
        assert.equal(cpu.status().f & 0xD7, 0x80, "flags cy=0"); }
      // carry=1: with carry=1
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x10);
        cpu.set("H", 0x20);
        mem[0] = 0x37; // SCF
        mem[1] = 0x8C; // ADC A,H
        cpu.step(); // SCF
        cpu.step(); // ADC
        assert.equal(cpu.status().a, 0x31, "ADC cy=1: A=0x10+0x20+1=0x31");
        assert.equal(cpu.status().f & 0xD7, 0x00, "flags cy=1"); }
      // carry=1: carry propagates
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);
        cpu.set("H", 0x00);
        mem[0] = 0x37; // SCF
        mem[1] = 0x8C; // ADC A,H
        cpu.step(); // SCF
        cpu.step(); // ADC
        assert.equal(cpu.status().a, 0x00, "ADC cy=1: A=0xFF+0x00+1=0x00");
        assert.equal(cpu.status().f & 0xD7, 0x51, "flags cy=1"); }
    });
    QUnit.test("ADC A,L (opcode 0x8D)", (assert) => {
      const HL_ADDR = 0x2000;
      // carry=0: no carry
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x10);
        cpu.set("L", 0x20);
        mem[0] = 0x8D;
        cpu.step();
        assert.equal(cpu.status().a, 0x30, "ADC cy=0: A=0x10+0x20+0=0x30");
        assert.equal(cpu.status().f & 0xD7, 0x00, "flags cy=0"); }
      // carry=0: no overflow with carry=0
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);
        cpu.set("L", 0x00);
        mem[0] = 0x8D;
        cpu.step();
        assert.equal(cpu.status().a, 0xFF, "ADC cy=0: A=0xFF+0x00+0=0xFF");
        assert.equal(cpu.status().f & 0xD7, 0x80, "flags cy=0"); }
      // carry=1: with carry=1
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x10);
        cpu.set("L", 0x20);
        mem[0] = 0x37; // SCF
        mem[1] = 0x8D; // ADC A,L
        cpu.step(); // SCF
        cpu.step(); // ADC
        assert.equal(cpu.status().a, 0x31, "ADC cy=1: A=0x10+0x20+1=0x31");
        assert.equal(cpu.status().f & 0xD7, 0x00, "flags cy=1"); }
      // carry=1: carry propagates
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);
        cpu.set("L", 0x00);
        mem[0] = 0x37; // SCF
        mem[1] = 0x8D; // ADC A,L
        cpu.step(); // SCF
        cpu.step(); // ADC
        assert.equal(cpu.status().a, 0x00, "ADC cy=1: A=0xFF+0x00+1=0x00");
        assert.equal(cpu.status().f & 0xD7, 0x51, "flags cy=1"); }
    });
    QUnit.test("ADC A,(HL) (opcode 0x8E)", (assert) => {
      const HL_ADDR = 0x2000;
      // carry=0: no carry
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x10);
        cpu.set("HL", 0x2000);
      mem[0x2000] = 0x20;
        mem[0] = 0x8E;
        cpu.step();
        assert.equal(cpu.status().a, 0x30, "ADC cy=0: A=0x10+0x20+0=0x30");
        assert.equal(cpu.status().f & 0xD7, 0x00, "flags cy=0"); }
      // carry=0: no overflow with carry=0
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);
        cpu.set("HL", 0x2000);
      mem[0x2000] = 0x00;
        mem[0] = 0x8E;
        cpu.step();
        assert.equal(cpu.status().a, 0xFF, "ADC cy=0: A=0xFF+0x00+0=0xFF");
        assert.equal(cpu.status().f & 0xD7, 0x80, "flags cy=0"); }
      // carry=1: with carry=1
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x10);
        cpu.set("HL", 0x2000);
      mem[0x2000] = 0x20;
        mem[0] = 0x37; // SCF
        mem[1] = 0x8E; // ADC A,(HL)
        cpu.step(); // SCF
        cpu.step(); // ADC
        assert.equal(cpu.status().a, 0x31, "ADC cy=1: A=0x10+0x20+1=0x31");
        assert.equal(cpu.status().f & 0xD7, 0x00, "flags cy=1"); }
      // carry=1: carry propagates
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);
        cpu.set("HL", 0x2000);
      mem[0x2000] = 0x00;
        mem[0] = 0x37; // SCF
        mem[1] = 0x8E; // ADC A,(HL)
        cpu.step(); // SCF
        cpu.step(); // ADC
        assert.equal(cpu.status().a, 0x00, "ADC cy=1: A=0xFF+0x00+1=0x00");
        assert.equal(cpu.status().f & 0xD7, 0x51, "flags cy=1"); }
    });
    QUnit.test("ADC A,A (opcode 0x8F)", (assert) => {
      const HL_ADDR = 0x2000;
      // carry=0: no carry
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x10);
        mem[0] = 0x8F;
        cpu.step();
        assert.equal(cpu.status().a, 0x20, "ADC cy=0: A=0x10+0x10+0=0x20");
        assert.equal(cpu.status().f & 0xD7, 0x00, "flags cy=0"); }
      // carry=0: no overflow with carry=0
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);
        mem[0] = 0x8F;
        cpu.step();
        assert.equal(cpu.status().a, 0xFE, "ADC cy=0: A=0xFF+0xFF+0=0xFE");
        assert.equal(cpu.status().f & 0xD7, 0x91, "flags cy=0"); }
      // carry=1: with carry=1
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x10);
        mem[0] = 0x37; // SCF
        mem[1] = 0x8F; // ADC A,A
        cpu.step(); // SCF
        cpu.step(); // ADC
        assert.equal(cpu.status().a, 0x21, "ADC cy=1: A=0x10+0x10+1=0x21");
        assert.equal(cpu.status().f & 0xD7, 0x00, "flags cy=1"); }
      // carry=1: carry propagates
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);
        mem[0] = 0x37; // SCF
        mem[1] = 0x8F; // ADC A,A
        cpu.step(); // SCF
        cpu.step(); // ADC
        assert.equal(cpu.status().a, 0xFF, "ADC cy=1: A=0xFF+0xFF+1=0xFF");
        assert.equal(cpu.status().f & 0xD7, 0x91, "flags cy=1"); }
    });
  });

  QUnit.module("SUB r - all registers", () => {
    QUnit.test("SUB B (opcode 0x90)", (assert) => {
      const HL_ADDR = 0x2000;
      // simple: A=0x40 - B=0x10 = 0x30
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x40);
        cpu.set("B", 0x10);
        mem[0] = 0x90;
        cpu.step();
        assert.equal(cpu.status().a, 0x30, "A=0x40-0x10=0x30 (simple)");
        assert.equal(cpu.status().f & 0xD7, 0x02, "flags (simple)"); }
      // zero result: A=0x30 - B=0x30 = 0x00
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x30);
        cpu.set("B", 0x30);
        mem[0] = 0x90;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0x30-0x30=0x00 (zero result)");
        assert.equal(cpu.status().f & 0xD7, 0x42, "flags (zero result)"); }
      // borrow (carry out): A=0x10 - B=0x20 = 0xF0
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x10);
        cpu.set("B", 0x20);
        mem[0] = 0x90;
        cpu.step();
        assert.equal(cpu.status().a, 0xF0, "A=0x10-0x20=0xF0 (borrow (carry out))");
        assert.equal(cpu.status().f & 0xD7, 0x83, "flags (borrow (carry out))"); }
      // overflow: A=0x80 - B=0x01 = 0x7F
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x80);
        cpu.set("B", 0x01);
        mem[0] = 0x90;
        cpu.step();
        assert.equal(cpu.status().a, 0x7F, "A=0x80-0x01=0x7F (overflow)");
        assert.equal(cpu.status().f & 0xD7, 0x16, "flags (overflow)"); }
      // half-borrow: A=0x18 - B=0x09 = 0x0F
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x18);
        cpu.set("B", 0x09);
        mem[0] = 0x90;
        cpu.step();
        assert.equal(cpu.status().a, 0x0F, "A=0x18-0x09=0x0F (half-borrow)");
        assert.equal(cpu.status().f & 0xD7, 0x12, "flags (half-borrow)"); }
    });
    QUnit.test("SUB C (opcode 0x91)", (assert) => {
      const HL_ADDR = 0x2000;
      // simple: A=0x40 - C=0x10 = 0x30
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x40);
        cpu.set("C", 0x10);
        mem[0] = 0x91;
        cpu.step();
        assert.equal(cpu.status().a, 0x30, "A=0x40-0x10=0x30 (simple)");
        assert.equal(cpu.status().f & 0xD7, 0x02, "flags (simple)"); }
      // zero result: A=0x30 - C=0x30 = 0x00
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x30);
        cpu.set("C", 0x30);
        mem[0] = 0x91;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0x30-0x30=0x00 (zero result)");
        assert.equal(cpu.status().f & 0xD7, 0x42, "flags (zero result)"); }
      // borrow (carry out): A=0x10 - C=0x20 = 0xF0
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x10);
        cpu.set("C", 0x20);
        mem[0] = 0x91;
        cpu.step();
        assert.equal(cpu.status().a, 0xF0, "A=0x10-0x20=0xF0 (borrow (carry out))");
        assert.equal(cpu.status().f & 0xD7, 0x83, "flags (borrow (carry out))"); }
      // overflow: A=0x80 - C=0x01 = 0x7F
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x80);
        cpu.set("C", 0x01);
        mem[0] = 0x91;
        cpu.step();
        assert.equal(cpu.status().a, 0x7F, "A=0x80-0x01=0x7F (overflow)");
        assert.equal(cpu.status().f & 0xD7, 0x16, "flags (overflow)"); }
      // half-borrow: A=0x18 - C=0x09 = 0x0F
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x18);
        cpu.set("C", 0x09);
        mem[0] = 0x91;
        cpu.step();
        assert.equal(cpu.status().a, 0x0F, "A=0x18-0x09=0x0F (half-borrow)");
        assert.equal(cpu.status().f & 0xD7, 0x12, "flags (half-borrow)"); }
    });
    QUnit.test("SUB D (opcode 0x92)", (assert) => {
      const HL_ADDR = 0x2000;
      // simple: A=0x40 - D=0x10 = 0x30
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x40);
        cpu.set("D", 0x10);
        mem[0] = 0x92;
        cpu.step();
        assert.equal(cpu.status().a, 0x30, "A=0x40-0x10=0x30 (simple)");
        assert.equal(cpu.status().f & 0xD7, 0x02, "flags (simple)"); }
      // zero result: A=0x30 - D=0x30 = 0x00
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x30);
        cpu.set("D", 0x30);
        mem[0] = 0x92;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0x30-0x30=0x00 (zero result)");
        assert.equal(cpu.status().f & 0xD7, 0x42, "flags (zero result)"); }
      // borrow (carry out): A=0x10 - D=0x20 = 0xF0
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x10);
        cpu.set("D", 0x20);
        mem[0] = 0x92;
        cpu.step();
        assert.equal(cpu.status().a, 0xF0, "A=0x10-0x20=0xF0 (borrow (carry out))");
        assert.equal(cpu.status().f & 0xD7, 0x83, "flags (borrow (carry out))"); }
      // overflow: A=0x80 - D=0x01 = 0x7F
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x80);
        cpu.set("D", 0x01);
        mem[0] = 0x92;
        cpu.step();
        assert.equal(cpu.status().a, 0x7F, "A=0x80-0x01=0x7F (overflow)");
        assert.equal(cpu.status().f & 0xD7, 0x16, "flags (overflow)"); }
      // half-borrow: A=0x18 - D=0x09 = 0x0F
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x18);
        cpu.set("D", 0x09);
        mem[0] = 0x92;
        cpu.step();
        assert.equal(cpu.status().a, 0x0F, "A=0x18-0x09=0x0F (half-borrow)");
        assert.equal(cpu.status().f & 0xD7, 0x12, "flags (half-borrow)"); }
    });
    QUnit.test("SUB E (opcode 0x93)", (assert) => {
      const HL_ADDR = 0x2000;
      // simple: A=0x40 - E=0x10 = 0x30
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x40);
        cpu.set("E", 0x10);
        mem[0] = 0x93;
        cpu.step();
        assert.equal(cpu.status().a, 0x30, "A=0x40-0x10=0x30 (simple)");
        assert.equal(cpu.status().f & 0xD7, 0x02, "flags (simple)"); }
      // zero result: A=0x30 - E=0x30 = 0x00
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x30);
        cpu.set("E", 0x30);
        mem[0] = 0x93;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0x30-0x30=0x00 (zero result)");
        assert.equal(cpu.status().f & 0xD7, 0x42, "flags (zero result)"); }
      // borrow (carry out): A=0x10 - E=0x20 = 0xF0
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x10);
        cpu.set("E", 0x20);
        mem[0] = 0x93;
        cpu.step();
        assert.equal(cpu.status().a, 0xF0, "A=0x10-0x20=0xF0 (borrow (carry out))");
        assert.equal(cpu.status().f & 0xD7, 0x83, "flags (borrow (carry out))"); }
      // overflow: A=0x80 - E=0x01 = 0x7F
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x80);
        cpu.set("E", 0x01);
        mem[0] = 0x93;
        cpu.step();
        assert.equal(cpu.status().a, 0x7F, "A=0x80-0x01=0x7F (overflow)");
        assert.equal(cpu.status().f & 0xD7, 0x16, "flags (overflow)"); }
      // half-borrow: A=0x18 - E=0x09 = 0x0F
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x18);
        cpu.set("E", 0x09);
        mem[0] = 0x93;
        cpu.step();
        assert.equal(cpu.status().a, 0x0F, "A=0x18-0x09=0x0F (half-borrow)");
        assert.equal(cpu.status().f & 0xD7, 0x12, "flags (half-borrow)"); }
    });
    QUnit.test("SUB H (opcode 0x94)", (assert) => {
      const HL_ADDR = 0x2000;
      // simple: A=0x40 - H=0x10 = 0x30
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x40);
        cpu.set("H", 0x10);
        mem[0] = 0x94;
        cpu.step();
        assert.equal(cpu.status().a, 0x30, "A=0x40-0x10=0x30 (simple)");
        assert.equal(cpu.status().f & 0xD7, 0x02, "flags (simple)"); }
      // zero result: A=0x30 - H=0x30 = 0x00
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x30);
        cpu.set("H", 0x30);
        mem[0] = 0x94;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0x30-0x30=0x00 (zero result)");
        assert.equal(cpu.status().f & 0xD7, 0x42, "flags (zero result)"); }
      // borrow (carry out): A=0x10 - H=0x20 = 0xF0
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x10);
        cpu.set("H", 0x20);
        mem[0] = 0x94;
        cpu.step();
        assert.equal(cpu.status().a, 0xF0, "A=0x10-0x20=0xF0 (borrow (carry out))");
        assert.equal(cpu.status().f & 0xD7, 0x83, "flags (borrow (carry out))"); }
      // overflow: A=0x80 - H=0x01 = 0x7F
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x80);
        cpu.set("H", 0x01);
        mem[0] = 0x94;
        cpu.step();
        assert.equal(cpu.status().a, 0x7F, "A=0x80-0x01=0x7F (overflow)");
        assert.equal(cpu.status().f & 0xD7, 0x16, "flags (overflow)"); }
      // half-borrow: A=0x18 - H=0x09 = 0x0F
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x18);
        cpu.set("H", 0x09);
        mem[0] = 0x94;
        cpu.step();
        assert.equal(cpu.status().a, 0x0F, "A=0x18-0x09=0x0F (half-borrow)");
        assert.equal(cpu.status().f & 0xD7, 0x12, "flags (half-borrow)"); }
    });
    QUnit.test("SUB L (opcode 0x95)", (assert) => {
      const HL_ADDR = 0x2000;
      // simple: A=0x40 - L=0x10 = 0x30
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x40);
        cpu.set("L", 0x10);
        mem[0] = 0x95;
        cpu.step();
        assert.equal(cpu.status().a, 0x30, "A=0x40-0x10=0x30 (simple)");
        assert.equal(cpu.status().f & 0xD7, 0x02, "flags (simple)"); }
      // zero result: A=0x30 - L=0x30 = 0x00
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x30);
        cpu.set("L", 0x30);
        mem[0] = 0x95;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0x30-0x30=0x00 (zero result)");
        assert.equal(cpu.status().f & 0xD7, 0x42, "flags (zero result)"); }
      // borrow (carry out): A=0x10 - L=0x20 = 0xF0
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x10);
        cpu.set("L", 0x20);
        mem[0] = 0x95;
        cpu.step();
        assert.equal(cpu.status().a, 0xF0, "A=0x10-0x20=0xF0 (borrow (carry out))");
        assert.equal(cpu.status().f & 0xD7, 0x83, "flags (borrow (carry out))"); }
      // overflow: A=0x80 - L=0x01 = 0x7F
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x80);
        cpu.set("L", 0x01);
        mem[0] = 0x95;
        cpu.step();
        assert.equal(cpu.status().a, 0x7F, "A=0x80-0x01=0x7F (overflow)");
        assert.equal(cpu.status().f & 0xD7, 0x16, "flags (overflow)"); }
      // half-borrow: A=0x18 - L=0x09 = 0x0F
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x18);
        cpu.set("L", 0x09);
        mem[0] = 0x95;
        cpu.step();
        assert.equal(cpu.status().a, 0x0F, "A=0x18-0x09=0x0F (half-borrow)");
        assert.equal(cpu.status().f & 0xD7, 0x12, "flags (half-borrow)"); }
    });
    QUnit.test("SUB (HL) (opcode 0x96)", (assert) => {
      const HL_ADDR = 0x2000;
      // simple: A=0x40 - (HL)=0x10 = 0x30
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x40);
        cpu.set("HL", 0x2000);
      mem[0x2000] = 0x10;
        mem[0] = 0x96;
        cpu.step();
        assert.equal(cpu.status().a, 0x30, "A=0x40-0x10=0x30 (simple)");
        assert.equal(cpu.status().f & 0xD7, 0x02, "flags (simple)"); }
      // zero result: A=0x30 - (HL)=0x30 = 0x00
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x30);
        cpu.set("HL", 0x2000);
      mem[0x2000] = 0x30;
        mem[0] = 0x96;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0x30-0x30=0x00 (zero result)");
        assert.equal(cpu.status().f & 0xD7, 0x42, "flags (zero result)"); }
      // borrow (carry out): A=0x10 - (HL)=0x20 = 0xF0
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x10);
        cpu.set("HL", 0x2000);
      mem[0x2000] = 0x20;
        mem[0] = 0x96;
        cpu.step();
        assert.equal(cpu.status().a, 0xF0, "A=0x10-0x20=0xF0 (borrow (carry out))");
        assert.equal(cpu.status().f & 0xD7, 0x83, "flags (borrow (carry out))"); }
      // overflow: A=0x80 - (HL)=0x01 = 0x7F
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x80);
        cpu.set("HL", 0x2000);
      mem[0x2000] = 0x01;
        mem[0] = 0x96;
        cpu.step();
        assert.equal(cpu.status().a, 0x7F, "A=0x80-0x01=0x7F (overflow)");
        assert.equal(cpu.status().f & 0xD7, 0x16, "flags (overflow)"); }
      // half-borrow: A=0x18 - (HL)=0x09 = 0x0F
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x18);
        cpu.set("HL", 0x2000);
      mem[0x2000] = 0x09;
        mem[0] = 0x96;
        cpu.step();
        assert.equal(cpu.status().a, 0x0F, "A=0x18-0x09=0x0F (half-borrow)");
        assert.equal(cpu.status().f & 0xD7, 0x12, "flags (half-borrow)"); }
    });
    QUnit.test("SUB A (opcode 0x97)", (assert) => {
      const HL_ADDR = 0x2000;
      // simple: A=0x40 - A=0x40 = 0x00
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x40);
        mem[0] = 0x97;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0x40-0x40=0x00 (simple)");
        assert.equal(cpu.status().f & 0xD7, 0x42, "flags (simple)"); }
      // zero result: A=0x30 - A=0x30 = 0x00
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x30);
        mem[0] = 0x97;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0x30-0x30=0x00 (zero result)");
        assert.equal(cpu.status().f & 0xD7, 0x42, "flags (zero result)"); }
      // borrow (carry out): A=0x10 - A=0x10 = 0x00
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x10);
        mem[0] = 0x97;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0x10-0x10=0x00 (borrow (carry out))");
        assert.equal(cpu.status().f & 0xD7, 0x42, "flags (borrow (carry out))"); }
      // overflow: A=0x80 - A=0x80 = 0x00
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x80);
        mem[0] = 0x97;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0x80-0x80=0x00 (overflow)");
        assert.equal(cpu.status().f & 0xD7, 0x42, "flags (overflow)"); }
      // half-borrow: A=0x18 - A=0x18 = 0x00
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x18);
        mem[0] = 0x97;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0x18-0x18=0x00 (half-borrow)");
        assert.equal(cpu.status().f & 0xD7, 0x42, "flags (half-borrow)"); }
    });
  });

  QUnit.module("SBC A,r - all registers", () => {
    QUnit.test("SBC A,B (opcode 0x98)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x40);
        cpu.set("B", 0x10);
        mem[0] = 0x98;
        cpu.step();
        assert.equal(cpu.status().a, 0x30, "SBC cy=0: A=0x40-0x10-0=0x30 (no carry)");
        assert.equal(cpu.status().f & 0xD7, 0x02, "flags (no carry)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x30);
        cpu.set("B", 0x30);
        mem[0] = 0x98;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "SBC cy=0: A=0x30-0x30-0=0x00 (equal no carry)");
        assert.equal(cpu.status().f & 0xD7, 0x42, "flags (equal no carry)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x40);
        cpu.set("B", 0x10);
        mem[0] = 0x37; // SCF
        mem[1] = 0x98; // SBC A,B
        cpu.step(); // SCF
        cpu.step(); // SBC
        assert.equal(cpu.status().a, 0x2F, "SBC cy=1: A=0x40-0x10-1=0x2F (with borrow)");
        assert.equal(cpu.status().f & 0xD7, 0x12, "flags cy=1 (with borrow)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x30);
        cpu.set("B", 0x30);
        mem[0] = 0x37; // SCF
        mem[1] = 0x98; // SBC A,B
        cpu.step(); // SCF
        cpu.step(); // SBC
        assert.equal(cpu.status().a, 0xFF, "SBC cy=1: A=0x30-0x30-1=0xFF (equal with borrow)");
        assert.equal(cpu.status().f & 0xD7, 0x93, "flags cy=1 (equal with borrow)"); }
    });
    QUnit.test("SBC A,C (opcode 0x99)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x40);
        cpu.set("C", 0x10);
        mem[0] = 0x99;
        cpu.step();
        assert.equal(cpu.status().a, 0x30, "SBC cy=0: A=0x40-0x10-0=0x30 (no carry)");
        assert.equal(cpu.status().f & 0xD7, 0x02, "flags (no carry)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x30);
        cpu.set("C", 0x30);
        mem[0] = 0x99;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "SBC cy=0: A=0x30-0x30-0=0x00 (equal no carry)");
        assert.equal(cpu.status().f & 0xD7, 0x42, "flags (equal no carry)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x40);
        cpu.set("C", 0x10);
        mem[0] = 0x37; // SCF
        mem[1] = 0x99; // SBC A,C
        cpu.step(); // SCF
        cpu.step(); // SBC
        assert.equal(cpu.status().a, 0x2F, "SBC cy=1: A=0x40-0x10-1=0x2F (with borrow)");
        assert.equal(cpu.status().f & 0xD7, 0x12, "flags cy=1 (with borrow)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x30);
        cpu.set("C", 0x30);
        mem[0] = 0x37; // SCF
        mem[1] = 0x99; // SBC A,C
        cpu.step(); // SCF
        cpu.step(); // SBC
        assert.equal(cpu.status().a, 0xFF, "SBC cy=1: A=0x30-0x30-1=0xFF (equal with borrow)");
        assert.equal(cpu.status().f & 0xD7, 0x93, "flags cy=1 (equal with borrow)"); }
    });
    QUnit.test("SBC A,D (opcode 0x9A)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x40);
        cpu.set("D", 0x10);
        mem[0] = 0x9A;
        cpu.step();
        assert.equal(cpu.status().a, 0x30, "SBC cy=0: A=0x40-0x10-0=0x30 (no carry)");
        assert.equal(cpu.status().f & 0xD7, 0x02, "flags (no carry)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x30);
        cpu.set("D", 0x30);
        mem[0] = 0x9A;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "SBC cy=0: A=0x30-0x30-0=0x00 (equal no carry)");
        assert.equal(cpu.status().f & 0xD7, 0x42, "flags (equal no carry)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x40);
        cpu.set("D", 0x10);
        mem[0] = 0x37; // SCF
        mem[1] = 0x9A; // SBC A,D
        cpu.step(); // SCF
        cpu.step(); // SBC
        assert.equal(cpu.status().a, 0x2F, "SBC cy=1: A=0x40-0x10-1=0x2F (with borrow)");
        assert.equal(cpu.status().f & 0xD7, 0x12, "flags cy=1 (with borrow)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x30);
        cpu.set("D", 0x30);
        mem[0] = 0x37; // SCF
        mem[1] = 0x9A; // SBC A,D
        cpu.step(); // SCF
        cpu.step(); // SBC
        assert.equal(cpu.status().a, 0xFF, "SBC cy=1: A=0x30-0x30-1=0xFF (equal with borrow)");
        assert.equal(cpu.status().f & 0xD7, 0x93, "flags cy=1 (equal with borrow)"); }
    });
    QUnit.test("SBC A,E (opcode 0x9B)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x40);
        cpu.set("E", 0x10);
        mem[0] = 0x9B;
        cpu.step();
        assert.equal(cpu.status().a, 0x30, "SBC cy=0: A=0x40-0x10-0=0x30 (no carry)");
        assert.equal(cpu.status().f & 0xD7, 0x02, "flags (no carry)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x30);
        cpu.set("E", 0x30);
        mem[0] = 0x9B;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "SBC cy=0: A=0x30-0x30-0=0x00 (equal no carry)");
        assert.equal(cpu.status().f & 0xD7, 0x42, "flags (equal no carry)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x40);
        cpu.set("E", 0x10);
        mem[0] = 0x37; // SCF
        mem[1] = 0x9B; // SBC A,E
        cpu.step(); // SCF
        cpu.step(); // SBC
        assert.equal(cpu.status().a, 0x2F, "SBC cy=1: A=0x40-0x10-1=0x2F (with borrow)");
        assert.equal(cpu.status().f & 0xD7, 0x12, "flags cy=1 (with borrow)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x30);
        cpu.set("E", 0x30);
        mem[0] = 0x37; // SCF
        mem[1] = 0x9B; // SBC A,E
        cpu.step(); // SCF
        cpu.step(); // SBC
        assert.equal(cpu.status().a, 0xFF, "SBC cy=1: A=0x30-0x30-1=0xFF (equal with borrow)");
        assert.equal(cpu.status().f & 0xD7, 0x93, "flags cy=1 (equal with borrow)"); }
    });
    QUnit.test("SBC A,H (opcode 0x9C)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x40);
        cpu.set("H", 0x10);
        mem[0] = 0x9C;
        cpu.step();
        assert.equal(cpu.status().a, 0x30, "SBC cy=0: A=0x40-0x10-0=0x30 (no carry)");
        assert.equal(cpu.status().f & 0xD7, 0x02, "flags (no carry)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x30);
        cpu.set("H", 0x30);
        mem[0] = 0x9C;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "SBC cy=0: A=0x30-0x30-0=0x00 (equal no carry)");
        assert.equal(cpu.status().f & 0xD7, 0x42, "flags (equal no carry)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x40);
        cpu.set("H", 0x10);
        mem[0] = 0x37; // SCF
        mem[1] = 0x9C; // SBC A,H
        cpu.step(); // SCF
        cpu.step(); // SBC
        assert.equal(cpu.status().a, 0x2F, "SBC cy=1: A=0x40-0x10-1=0x2F (with borrow)");
        assert.equal(cpu.status().f & 0xD7, 0x12, "flags cy=1 (with borrow)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x30);
        cpu.set("H", 0x30);
        mem[0] = 0x37; // SCF
        mem[1] = 0x9C; // SBC A,H
        cpu.step(); // SCF
        cpu.step(); // SBC
        assert.equal(cpu.status().a, 0xFF, "SBC cy=1: A=0x30-0x30-1=0xFF (equal with borrow)");
        assert.equal(cpu.status().f & 0xD7, 0x93, "flags cy=1 (equal with borrow)"); }
    });
    QUnit.test("SBC A,L (opcode 0x9D)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x40);
        cpu.set("L", 0x10);
        mem[0] = 0x9D;
        cpu.step();
        assert.equal(cpu.status().a, 0x30, "SBC cy=0: A=0x40-0x10-0=0x30 (no carry)");
        assert.equal(cpu.status().f & 0xD7, 0x02, "flags (no carry)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x30);
        cpu.set("L", 0x30);
        mem[0] = 0x9D;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "SBC cy=0: A=0x30-0x30-0=0x00 (equal no carry)");
        assert.equal(cpu.status().f & 0xD7, 0x42, "flags (equal no carry)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x40);
        cpu.set("L", 0x10);
        mem[0] = 0x37; // SCF
        mem[1] = 0x9D; // SBC A,L
        cpu.step(); // SCF
        cpu.step(); // SBC
        assert.equal(cpu.status().a, 0x2F, "SBC cy=1: A=0x40-0x10-1=0x2F (with borrow)");
        assert.equal(cpu.status().f & 0xD7, 0x12, "flags cy=1 (with borrow)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x30);
        cpu.set("L", 0x30);
        mem[0] = 0x37; // SCF
        mem[1] = 0x9D; // SBC A,L
        cpu.step(); // SCF
        cpu.step(); // SBC
        assert.equal(cpu.status().a, 0xFF, "SBC cy=1: A=0x30-0x30-1=0xFF (equal with borrow)");
        assert.equal(cpu.status().f & 0xD7, 0x93, "flags cy=1 (equal with borrow)"); }
    });
    QUnit.test("SBC A,(HL) (opcode 0x9E)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x40);
        cpu.set("HL", 0x2000);
      mem[0x2000] = 0x10;
        mem[0] = 0x9E;
        cpu.step();
        assert.equal(cpu.status().a, 0x30, "SBC cy=0: A=0x40-0x10-0=0x30 (no carry)");
        assert.equal(cpu.status().f & 0xD7, 0x02, "flags (no carry)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x30);
        cpu.set("HL", 0x2000);
      mem[0x2000] = 0x30;
        mem[0] = 0x9E;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "SBC cy=0: A=0x30-0x30-0=0x00 (equal no carry)");
        assert.equal(cpu.status().f & 0xD7, 0x42, "flags (equal no carry)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x40);
        cpu.set("HL", 0x2000);
      mem[0x2000] = 0x10;
        mem[0] = 0x37; // SCF
        mem[1] = 0x9E; // SBC A,(HL)
        cpu.step(); // SCF
        cpu.step(); // SBC
        assert.equal(cpu.status().a, 0x2F, "SBC cy=1: A=0x40-0x10-1=0x2F (with borrow)");
        assert.equal(cpu.status().f & 0xD7, 0x12, "flags cy=1 (with borrow)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x30);
        cpu.set("HL", 0x2000);
      mem[0x2000] = 0x30;
        mem[0] = 0x37; // SCF
        mem[1] = 0x9E; // SBC A,(HL)
        cpu.step(); // SCF
        cpu.step(); // SBC
        assert.equal(cpu.status().a, 0xFF, "SBC cy=1: A=0x30-0x30-1=0xFF (equal with borrow)");
        assert.equal(cpu.status().f & 0xD7, 0x93, "flags cy=1 (equal with borrow)"); }
    });
    QUnit.test("SBC A,A (opcode 0x9F)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x40);
        mem[0] = 0x9F;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "SBC cy=0: A=0x40-0x40-0=0x00 (no carry)");
        assert.equal(cpu.status().f & 0xD7, 0x42, "flags (no carry)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x30);
        mem[0] = 0x9F;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "SBC cy=0: A=0x30-0x30-0=0x00 (equal no carry)");
        assert.equal(cpu.status().f & 0xD7, 0x42, "flags (equal no carry)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x40);
        mem[0] = 0x37; // SCF
        mem[1] = 0x9F; // SBC A,A
        cpu.step(); // SCF
        cpu.step(); // SBC
        assert.equal(cpu.status().a, 0xFF, "SBC cy=1: A=0x40-0x40-1=0xFF (with borrow)");
        assert.equal(cpu.status().f & 0xD7, 0x93, "flags cy=1 (with borrow)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x30);
        mem[0] = 0x37; // SCF
        mem[1] = 0x9F; // SBC A,A
        cpu.step(); // SCF
        cpu.step(); // SBC
        assert.equal(cpu.status().a, 0xFF, "SBC cy=1: A=0x30-0x30-1=0xFF (equal with borrow)");
        assert.equal(cpu.status().f & 0xD7, 0x93, "flags cy=1 (equal with borrow)"); }
    });
  });

  QUnit.module("AND r - all registers", () => {
    QUnit.test("AND B (opcode 0xA0)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xF0);
        cpu.set("B", 0x0F);
        mem[0] = 0xA0;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0xF0&0x0F=0x00 (no overlap)");
        assert.equal(cpu.status().f & 0xD7, 0x54, "flags (no overlap)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);
        cpu.set("B", 0xAA);
        mem[0] = 0xA0;
        cpu.step();
        assert.equal(cpu.status().a, 0xAA, "A=0xFF&0xAA=0xAA (partial)");
        assert.equal(cpu.status().f & 0xD7, 0x94, "flags (partial)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xAA);
        cpu.set("B", 0xAA);
        mem[0] = 0xA0;
        cpu.step();
        assert.equal(cpu.status().a, 0xAA, "A=0xAA&0xAA=0xAA (same value)");
        assert.equal(cpu.status().f & 0xD7, 0x94, "flags (same value)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x00);
        cpu.set("B", 0xFF);
        mem[0] = 0xA0;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0x00&0xFF=0x00 (zero result)");
        assert.equal(cpu.status().f & 0xD7, 0x54, "flags (zero result)"); }
    });
    QUnit.test("AND C (opcode 0xA1)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xF0);
        cpu.set("C", 0x0F);
        mem[0] = 0xA1;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0xF0&0x0F=0x00 (no overlap)");
        assert.equal(cpu.status().f & 0xD7, 0x54, "flags (no overlap)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);
        cpu.set("C", 0xAA);
        mem[0] = 0xA1;
        cpu.step();
        assert.equal(cpu.status().a, 0xAA, "A=0xFF&0xAA=0xAA (partial)");
        assert.equal(cpu.status().f & 0xD7, 0x94, "flags (partial)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xAA);
        cpu.set("C", 0xAA);
        mem[0] = 0xA1;
        cpu.step();
        assert.equal(cpu.status().a, 0xAA, "A=0xAA&0xAA=0xAA (same value)");
        assert.equal(cpu.status().f & 0xD7, 0x94, "flags (same value)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x00);
        cpu.set("C", 0xFF);
        mem[0] = 0xA1;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0x00&0xFF=0x00 (zero result)");
        assert.equal(cpu.status().f & 0xD7, 0x54, "flags (zero result)"); }
    });
    QUnit.test("AND D (opcode 0xA2)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xF0);
        cpu.set("D", 0x0F);
        mem[0] = 0xA2;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0xF0&0x0F=0x00 (no overlap)");
        assert.equal(cpu.status().f & 0xD7, 0x54, "flags (no overlap)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);
        cpu.set("D", 0xAA);
        mem[0] = 0xA2;
        cpu.step();
        assert.equal(cpu.status().a, 0xAA, "A=0xFF&0xAA=0xAA (partial)");
        assert.equal(cpu.status().f & 0xD7, 0x94, "flags (partial)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xAA);
        cpu.set("D", 0xAA);
        mem[0] = 0xA2;
        cpu.step();
        assert.equal(cpu.status().a, 0xAA, "A=0xAA&0xAA=0xAA (same value)");
        assert.equal(cpu.status().f & 0xD7, 0x94, "flags (same value)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x00);
        cpu.set("D", 0xFF);
        mem[0] = 0xA2;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0x00&0xFF=0x00 (zero result)");
        assert.equal(cpu.status().f & 0xD7, 0x54, "flags (zero result)"); }
    });
    QUnit.test("AND E (opcode 0xA3)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xF0);
        cpu.set("E", 0x0F);
        mem[0] = 0xA3;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0xF0&0x0F=0x00 (no overlap)");
        assert.equal(cpu.status().f & 0xD7, 0x54, "flags (no overlap)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);
        cpu.set("E", 0xAA);
        mem[0] = 0xA3;
        cpu.step();
        assert.equal(cpu.status().a, 0xAA, "A=0xFF&0xAA=0xAA (partial)");
        assert.equal(cpu.status().f & 0xD7, 0x94, "flags (partial)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xAA);
        cpu.set("E", 0xAA);
        mem[0] = 0xA3;
        cpu.step();
        assert.equal(cpu.status().a, 0xAA, "A=0xAA&0xAA=0xAA (same value)");
        assert.equal(cpu.status().f & 0xD7, 0x94, "flags (same value)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x00);
        cpu.set("E", 0xFF);
        mem[0] = 0xA3;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0x00&0xFF=0x00 (zero result)");
        assert.equal(cpu.status().f & 0xD7, 0x54, "flags (zero result)"); }
    });
    QUnit.test("AND H (opcode 0xA4)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xF0);
        cpu.set("H", 0x0F);
        mem[0] = 0xA4;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0xF0&0x0F=0x00 (no overlap)");
        assert.equal(cpu.status().f & 0xD7, 0x54, "flags (no overlap)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);
        cpu.set("H", 0xAA);
        mem[0] = 0xA4;
        cpu.step();
        assert.equal(cpu.status().a, 0xAA, "A=0xFF&0xAA=0xAA (partial)");
        assert.equal(cpu.status().f & 0xD7, 0x94, "flags (partial)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xAA);
        cpu.set("H", 0xAA);
        mem[0] = 0xA4;
        cpu.step();
        assert.equal(cpu.status().a, 0xAA, "A=0xAA&0xAA=0xAA (same value)");
        assert.equal(cpu.status().f & 0xD7, 0x94, "flags (same value)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x00);
        cpu.set("H", 0xFF);
        mem[0] = 0xA4;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0x00&0xFF=0x00 (zero result)");
        assert.equal(cpu.status().f & 0xD7, 0x54, "flags (zero result)"); }
    });
    QUnit.test("AND L (opcode 0xA5)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xF0);
        cpu.set("L", 0x0F);
        mem[0] = 0xA5;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0xF0&0x0F=0x00 (no overlap)");
        assert.equal(cpu.status().f & 0xD7, 0x54, "flags (no overlap)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);
        cpu.set("L", 0xAA);
        mem[0] = 0xA5;
        cpu.step();
        assert.equal(cpu.status().a, 0xAA, "A=0xFF&0xAA=0xAA (partial)");
        assert.equal(cpu.status().f & 0xD7, 0x94, "flags (partial)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xAA);
        cpu.set("L", 0xAA);
        mem[0] = 0xA5;
        cpu.step();
        assert.equal(cpu.status().a, 0xAA, "A=0xAA&0xAA=0xAA (same value)");
        assert.equal(cpu.status().f & 0xD7, 0x94, "flags (same value)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x00);
        cpu.set("L", 0xFF);
        mem[0] = 0xA5;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0x00&0xFF=0x00 (zero result)");
        assert.equal(cpu.status().f & 0xD7, 0x54, "flags (zero result)"); }
    });
    QUnit.test("AND (HL) (opcode 0xA6)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xF0);
        cpu.set("HL", 0x2000);
      mem[0x2000] = 0x0F;
        mem[0] = 0xA6;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0xF0&0x0F=0x00 (no overlap)");
        assert.equal(cpu.status().f & 0xD7, 0x54, "flags (no overlap)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);
        cpu.set("HL", 0x2000);
      mem[0x2000] = 0xAA;
        mem[0] = 0xA6;
        cpu.step();
        assert.equal(cpu.status().a, 0xAA, "A=0xFF&0xAA=0xAA (partial)");
        assert.equal(cpu.status().f & 0xD7, 0x94, "flags (partial)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xAA);
        cpu.set("HL", 0x2000);
      mem[0x2000] = 0xAA;
        mem[0] = 0xA6;
        cpu.step();
        assert.equal(cpu.status().a, 0xAA, "A=0xAA&0xAA=0xAA (same value)");
        assert.equal(cpu.status().f & 0xD7, 0x94, "flags (same value)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x00);
        cpu.set("HL", 0x2000);
      mem[0x2000] = 0xFF;
        mem[0] = 0xA6;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0x00&0xFF=0x00 (zero result)");
        assert.equal(cpu.status().f & 0xD7, 0x54, "flags (zero result)"); }
    });
    QUnit.test("AND A (opcode 0xA7)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xF0);
        mem[0] = 0xA7;
        cpu.step();
        assert.equal(cpu.status().a, 0xF0, "A=0xF0&0xF0=0xF0 (no overlap)");
        assert.equal(cpu.status().f & 0xD7, 0x94, "flags (no overlap)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);
        mem[0] = 0xA7;
        cpu.step();
        assert.equal(cpu.status().a, 0xFF, "A=0xFF&0xFF=0xFF (partial)");
        assert.equal(cpu.status().f & 0xD7, 0x94, "flags (partial)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xAA);
        mem[0] = 0xA7;
        cpu.step();
        assert.equal(cpu.status().a, 0xAA, "A=0xAA&0xAA=0xAA (same value)");
        assert.equal(cpu.status().f & 0xD7, 0x94, "flags (same value)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x00);
        mem[0] = 0xA7;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0x00&0x00=0x00 (zero result)");
        assert.equal(cpu.status().f & 0xD7, 0x54, "flags (zero result)"); }
    });
  });

  QUnit.module("XOR r - all registers", () => {
    QUnit.test("XOR B (opcode 0xA8)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);
        cpu.set("B", 0x0F);
        mem[0] = 0xA8;
        cpu.step();
        assert.equal(cpu.status().a, 0xF0, "A=0xFF^0x0F=0xF0 (partial)");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags (partial)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xAA);
        cpu.set("B", 0xAA);
        mem[0] = 0xA8;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0xAA^0xAA=0x00 (self XOR = 0)");
        assert.equal(cpu.status().f & 0xD7, 0x44, "flags (self XOR = 0)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x00);
        cpu.set("B", 0x80);
        mem[0] = 0xA8;
        cpu.step();
        assert.equal(cpu.status().a, 0x80, "A=0x00^0x80=0x80 (sign bit)");
        assert.equal(cpu.status().f & 0xD7, 0x80, "flags (sign bit)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x55);
        cpu.set("B", 0xAA);
        mem[0] = 0xA8;
        cpu.step();
        assert.equal(cpu.status().a, 0xFF, "A=0x55^0xAA=0xFF (alternating)");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags (alternating)"); }
    });
    QUnit.test("XOR C (opcode 0xA9)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);
        cpu.set("C", 0x0F);
        mem[0] = 0xA9;
        cpu.step();
        assert.equal(cpu.status().a, 0xF0, "A=0xFF^0x0F=0xF0 (partial)");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags (partial)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xAA);
        cpu.set("C", 0xAA);
        mem[0] = 0xA9;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0xAA^0xAA=0x00 (self XOR = 0)");
        assert.equal(cpu.status().f & 0xD7, 0x44, "flags (self XOR = 0)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x00);
        cpu.set("C", 0x80);
        mem[0] = 0xA9;
        cpu.step();
        assert.equal(cpu.status().a, 0x80, "A=0x00^0x80=0x80 (sign bit)");
        assert.equal(cpu.status().f & 0xD7, 0x80, "flags (sign bit)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x55);
        cpu.set("C", 0xAA);
        mem[0] = 0xA9;
        cpu.step();
        assert.equal(cpu.status().a, 0xFF, "A=0x55^0xAA=0xFF (alternating)");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags (alternating)"); }
    });
    QUnit.test("XOR D (opcode 0xAA)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);
        cpu.set("D", 0x0F);
        mem[0] = 0xAA;
        cpu.step();
        assert.equal(cpu.status().a, 0xF0, "A=0xFF^0x0F=0xF0 (partial)");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags (partial)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xAA);
        cpu.set("D", 0xAA);
        mem[0] = 0xAA;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0xAA^0xAA=0x00 (self XOR = 0)");
        assert.equal(cpu.status().f & 0xD7, 0x44, "flags (self XOR = 0)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x00);
        cpu.set("D", 0x80);
        mem[0] = 0xAA;
        cpu.step();
        assert.equal(cpu.status().a, 0x80, "A=0x00^0x80=0x80 (sign bit)");
        assert.equal(cpu.status().f & 0xD7, 0x80, "flags (sign bit)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x55);
        cpu.set("D", 0xAA);
        mem[0] = 0xAA;
        cpu.step();
        assert.equal(cpu.status().a, 0xFF, "A=0x55^0xAA=0xFF (alternating)");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags (alternating)"); }
    });
    QUnit.test("XOR E (opcode 0xAB)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);
        cpu.set("E", 0x0F);
        mem[0] = 0xAB;
        cpu.step();
        assert.equal(cpu.status().a, 0xF0, "A=0xFF^0x0F=0xF0 (partial)");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags (partial)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xAA);
        cpu.set("E", 0xAA);
        mem[0] = 0xAB;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0xAA^0xAA=0x00 (self XOR = 0)");
        assert.equal(cpu.status().f & 0xD7, 0x44, "flags (self XOR = 0)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x00);
        cpu.set("E", 0x80);
        mem[0] = 0xAB;
        cpu.step();
        assert.equal(cpu.status().a, 0x80, "A=0x00^0x80=0x80 (sign bit)");
        assert.equal(cpu.status().f & 0xD7, 0x80, "flags (sign bit)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x55);
        cpu.set("E", 0xAA);
        mem[0] = 0xAB;
        cpu.step();
        assert.equal(cpu.status().a, 0xFF, "A=0x55^0xAA=0xFF (alternating)");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags (alternating)"); }
    });
    QUnit.test("XOR H (opcode 0xAC)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);
        cpu.set("H", 0x0F);
        mem[0] = 0xAC;
        cpu.step();
        assert.equal(cpu.status().a, 0xF0, "A=0xFF^0x0F=0xF0 (partial)");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags (partial)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xAA);
        cpu.set("H", 0xAA);
        mem[0] = 0xAC;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0xAA^0xAA=0x00 (self XOR = 0)");
        assert.equal(cpu.status().f & 0xD7, 0x44, "flags (self XOR = 0)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x00);
        cpu.set("H", 0x80);
        mem[0] = 0xAC;
        cpu.step();
        assert.equal(cpu.status().a, 0x80, "A=0x00^0x80=0x80 (sign bit)");
        assert.equal(cpu.status().f & 0xD7, 0x80, "flags (sign bit)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x55);
        cpu.set("H", 0xAA);
        mem[0] = 0xAC;
        cpu.step();
        assert.equal(cpu.status().a, 0xFF, "A=0x55^0xAA=0xFF (alternating)");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags (alternating)"); }
    });
    QUnit.test("XOR L (opcode 0xAD)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);
        cpu.set("L", 0x0F);
        mem[0] = 0xAD;
        cpu.step();
        assert.equal(cpu.status().a, 0xF0, "A=0xFF^0x0F=0xF0 (partial)");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags (partial)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xAA);
        cpu.set("L", 0xAA);
        mem[0] = 0xAD;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0xAA^0xAA=0x00 (self XOR = 0)");
        assert.equal(cpu.status().f & 0xD7, 0x44, "flags (self XOR = 0)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x00);
        cpu.set("L", 0x80);
        mem[0] = 0xAD;
        cpu.step();
        assert.equal(cpu.status().a, 0x80, "A=0x00^0x80=0x80 (sign bit)");
        assert.equal(cpu.status().f & 0xD7, 0x80, "flags (sign bit)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x55);
        cpu.set("L", 0xAA);
        mem[0] = 0xAD;
        cpu.step();
        assert.equal(cpu.status().a, 0xFF, "A=0x55^0xAA=0xFF (alternating)");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags (alternating)"); }
    });
    QUnit.test("XOR (HL) (opcode 0xAE)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);
        cpu.set("HL", 0x2000);
      mem[0x2000] = 0x0F;
        mem[0] = 0xAE;
        cpu.step();
        assert.equal(cpu.status().a, 0xF0, "A=0xFF^0x0F=0xF0 (partial)");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags (partial)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xAA);
        cpu.set("HL", 0x2000);
      mem[0x2000] = 0xAA;
        mem[0] = 0xAE;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0xAA^0xAA=0x00 (self XOR = 0)");
        assert.equal(cpu.status().f & 0xD7, 0x44, "flags (self XOR = 0)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x00);
        cpu.set("HL", 0x2000);
      mem[0x2000] = 0x80;
        mem[0] = 0xAE;
        cpu.step();
        assert.equal(cpu.status().a, 0x80, "A=0x00^0x80=0x80 (sign bit)");
        assert.equal(cpu.status().f & 0xD7, 0x80, "flags (sign bit)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x55);
        cpu.set("HL", 0x2000);
      mem[0x2000] = 0xAA;
        mem[0] = 0xAE;
        cpu.step();
        assert.equal(cpu.status().a, 0xFF, "A=0x55^0xAA=0xFF (alternating)");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags (alternating)"); }
    });
    QUnit.test("XOR A (opcode 0xAF)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);
        mem[0] = 0xAF;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0xFF^0xFF=0x00 (partial)");
        assert.equal(cpu.status().f & 0xD7, 0x44, "flags (partial)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xAA);
        mem[0] = 0xAF;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0xAA^0xAA=0x00 (self XOR = 0)");
        assert.equal(cpu.status().f & 0xD7, 0x44, "flags (self XOR = 0)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x00);
        mem[0] = 0xAF;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0x00^0x00=0x00 (sign bit)");
        assert.equal(cpu.status().f & 0xD7, 0x44, "flags (sign bit)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x55);
        mem[0] = 0xAF;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0x55^0x55=0x00 (alternating)");
        assert.equal(cpu.status().f & 0xD7, 0x44, "flags (alternating)"); }
    });
  });

  QUnit.module("OR r - all registers", () => {
    QUnit.test("OR B (opcode 0xB0)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xF0);
        cpu.set("B", 0x0F);
        mem[0] = 0xB0;
        cpu.step();
        assert.equal(cpu.status().a, 0xFF, "A=0xF0|0x0F=0xFF (merge nibbles)");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags (merge nibbles)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x00);
        cpu.set("B", 0x00);
        mem[0] = 0xB0;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0x00|0x00=0x00 (zero result)");
        assert.equal(cpu.status().f & 0xD7, 0x44, "flags (zero result)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x80);
        cpu.set("B", 0x40);
        mem[0] = 0xB0;
        cpu.step();
        assert.equal(cpu.status().a, 0xC0, "A=0x80|0x40=0xC0 (two bits)");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags (two bits)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x55);
        cpu.set("B", 0xAA);
        mem[0] = 0xB0;
        cpu.step();
        assert.equal(cpu.status().a, 0xFF, "A=0x55|0xAA=0xFF (full set)");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags (full set)"); }
    });
    QUnit.test("OR C (opcode 0xB1)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xF0);
        cpu.set("C", 0x0F);
        mem[0] = 0xB1;
        cpu.step();
        assert.equal(cpu.status().a, 0xFF, "A=0xF0|0x0F=0xFF (merge nibbles)");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags (merge nibbles)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x00);
        cpu.set("C", 0x00);
        mem[0] = 0xB1;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0x00|0x00=0x00 (zero result)");
        assert.equal(cpu.status().f & 0xD7, 0x44, "flags (zero result)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x80);
        cpu.set("C", 0x40);
        mem[0] = 0xB1;
        cpu.step();
        assert.equal(cpu.status().a, 0xC0, "A=0x80|0x40=0xC0 (two bits)");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags (two bits)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x55);
        cpu.set("C", 0xAA);
        mem[0] = 0xB1;
        cpu.step();
        assert.equal(cpu.status().a, 0xFF, "A=0x55|0xAA=0xFF (full set)");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags (full set)"); }
    });
    QUnit.test("OR D (opcode 0xB2)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xF0);
        cpu.set("D", 0x0F);
        mem[0] = 0xB2;
        cpu.step();
        assert.equal(cpu.status().a, 0xFF, "A=0xF0|0x0F=0xFF (merge nibbles)");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags (merge nibbles)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x00);
        cpu.set("D", 0x00);
        mem[0] = 0xB2;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0x00|0x00=0x00 (zero result)");
        assert.equal(cpu.status().f & 0xD7, 0x44, "flags (zero result)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x80);
        cpu.set("D", 0x40);
        mem[0] = 0xB2;
        cpu.step();
        assert.equal(cpu.status().a, 0xC0, "A=0x80|0x40=0xC0 (two bits)");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags (two bits)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x55);
        cpu.set("D", 0xAA);
        mem[0] = 0xB2;
        cpu.step();
        assert.equal(cpu.status().a, 0xFF, "A=0x55|0xAA=0xFF (full set)");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags (full set)"); }
    });
    QUnit.test("OR E (opcode 0xB3)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xF0);
        cpu.set("E", 0x0F);
        mem[0] = 0xB3;
        cpu.step();
        assert.equal(cpu.status().a, 0xFF, "A=0xF0|0x0F=0xFF (merge nibbles)");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags (merge nibbles)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x00);
        cpu.set("E", 0x00);
        mem[0] = 0xB3;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0x00|0x00=0x00 (zero result)");
        assert.equal(cpu.status().f & 0xD7, 0x44, "flags (zero result)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x80);
        cpu.set("E", 0x40);
        mem[0] = 0xB3;
        cpu.step();
        assert.equal(cpu.status().a, 0xC0, "A=0x80|0x40=0xC0 (two bits)");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags (two bits)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x55);
        cpu.set("E", 0xAA);
        mem[0] = 0xB3;
        cpu.step();
        assert.equal(cpu.status().a, 0xFF, "A=0x55|0xAA=0xFF (full set)");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags (full set)"); }
    });
    QUnit.test("OR H (opcode 0xB4)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xF0);
        cpu.set("H", 0x0F);
        mem[0] = 0xB4;
        cpu.step();
        assert.equal(cpu.status().a, 0xFF, "A=0xF0|0x0F=0xFF (merge nibbles)");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags (merge nibbles)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x00);
        cpu.set("H", 0x00);
        mem[0] = 0xB4;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0x00|0x00=0x00 (zero result)");
        assert.equal(cpu.status().f & 0xD7, 0x44, "flags (zero result)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x80);
        cpu.set("H", 0x40);
        mem[0] = 0xB4;
        cpu.step();
        assert.equal(cpu.status().a, 0xC0, "A=0x80|0x40=0xC0 (two bits)");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags (two bits)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x55);
        cpu.set("H", 0xAA);
        mem[0] = 0xB4;
        cpu.step();
        assert.equal(cpu.status().a, 0xFF, "A=0x55|0xAA=0xFF (full set)");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags (full set)"); }
    });
    QUnit.test("OR L (opcode 0xB5)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xF0);
        cpu.set("L", 0x0F);
        mem[0] = 0xB5;
        cpu.step();
        assert.equal(cpu.status().a, 0xFF, "A=0xF0|0x0F=0xFF (merge nibbles)");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags (merge nibbles)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x00);
        cpu.set("L", 0x00);
        mem[0] = 0xB5;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0x00|0x00=0x00 (zero result)");
        assert.equal(cpu.status().f & 0xD7, 0x44, "flags (zero result)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x80);
        cpu.set("L", 0x40);
        mem[0] = 0xB5;
        cpu.step();
        assert.equal(cpu.status().a, 0xC0, "A=0x80|0x40=0xC0 (two bits)");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags (two bits)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x55);
        cpu.set("L", 0xAA);
        mem[0] = 0xB5;
        cpu.step();
        assert.equal(cpu.status().a, 0xFF, "A=0x55|0xAA=0xFF (full set)");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags (full set)"); }
    });
    QUnit.test("OR (HL) (opcode 0xB6)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xF0);
        cpu.set("HL", 0x2000);
      mem[0x2000] = 0x0F;
        mem[0] = 0xB6;
        cpu.step();
        assert.equal(cpu.status().a, 0xFF, "A=0xF0|0x0F=0xFF (merge nibbles)");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags (merge nibbles)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x00);
        cpu.set("HL", 0x2000);
      mem[0x2000] = 0x00;
        mem[0] = 0xB6;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0x00|0x00=0x00 (zero result)");
        assert.equal(cpu.status().f & 0xD7, 0x44, "flags (zero result)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x80);
        cpu.set("HL", 0x2000);
      mem[0x2000] = 0x40;
        mem[0] = 0xB6;
        cpu.step();
        assert.equal(cpu.status().a, 0xC0, "A=0x80|0x40=0xC0 (two bits)");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags (two bits)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x55);
        cpu.set("HL", 0x2000);
      mem[0x2000] = 0xAA;
        mem[0] = 0xB6;
        cpu.step();
        assert.equal(cpu.status().a, 0xFF, "A=0x55|0xAA=0xFF (full set)");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags (full set)"); }
    });
    QUnit.test("OR A (opcode 0xB7)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xF0);
        mem[0] = 0xB7;
        cpu.step();
        assert.equal(cpu.status().a, 0xF0, "A=0xF0|0xF0=0xF0 (merge nibbles)");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags (merge nibbles)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x00);
        mem[0] = 0xB7;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "A=0x00|0x00=0x00 (zero result)");
        assert.equal(cpu.status().f & 0xD7, 0x44, "flags (zero result)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x80);
        mem[0] = 0xB7;
        cpu.step();
        assert.equal(cpu.status().a, 0x80, "A=0x80|0x80=0x80 (two bits)");
        assert.equal(cpu.status().f & 0xD7, 0x80, "flags (two bits)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x55);
        mem[0] = 0xB7;
        cpu.step();
        assert.equal(cpu.status().a, 0x55, "A=0x55|0x55=0x55 (full set)");
        assert.equal(cpu.status().f & 0xD7, 0x04, "flags (full set)"); }
    });
  });

  QUnit.module("CP r - all registers", () => {
    QUnit.test("CP B (opcode 0xB8)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x50);
        cpu.set("B", 0x10);
        mem[0] = 0xB8;
        cpu.step();
        assert.equal(cpu.status().a, 0x50, "A unchanged=0x50 (greater)");
        assert.equal(cpu.status().f & 0xD7, 0x02, "flags (greater)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x30);
        cpu.set("B", 0x30);
        mem[0] = 0xB8;
        cpu.step();
        assert.equal(cpu.status().a, 0x30, "A unchanged=0x30 (equal (Z set))");
        assert.equal(cpu.status().f & 0xD7, 0x42, "flags (equal (Z set))"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x10);
        cpu.set("B", 0x20);
        mem[0] = 0xB8;
        cpu.step();
        assert.equal(cpu.status().a, 0x10, "A unchanged=0x10 (less (C set))");
        assert.equal(cpu.status().f & 0xD7, 0x83, "flags (less (C set))"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x80);
        cpu.set("B", 0x01);
        mem[0] = 0xB8;
        cpu.step();
        assert.equal(cpu.status().a, 0x80, "A unchanged=0x80 (overflow)");
        assert.equal(cpu.status().f & 0xD7, 0x16, "flags (overflow)"); }
    });
    QUnit.test("CP C (opcode 0xB9)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x50);
        cpu.set("C", 0x10);
        mem[0] = 0xB9;
        cpu.step();
        assert.equal(cpu.status().a, 0x50, "A unchanged=0x50 (greater)");
        assert.equal(cpu.status().f & 0xD7, 0x02, "flags (greater)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x30);
        cpu.set("C", 0x30);
        mem[0] = 0xB9;
        cpu.step();
        assert.equal(cpu.status().a, 0x30, "A unchanged=0x30 (equal (Z set))");
        assert.equal(cpu.status().f & 0xD7, 0x42, "flags (equal (Z set))"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x10);
        cpu.set("C", 0x20);
        mem[0] = 0xB9;
        cpu.step();
        assert.equal(cpu.status().a, 0x10, "A unchanged=0x10 (less (C set))");
        assert.equal(cpu.status().f & 0xD7, 0x83, "flags (less (C set))"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x80);
        cpu.set("C", 0x01);
        mem[0] = 0xB9;
        cpu.step();
        assert.equal(cpu.status().a, 0x80, "A unchanged=0x80 (overflow)");
        assert.equal(cpu.status().f & 0xD7, 0x16, "flags (overflow)"); }
    });
    QUnit.test("CP D (opcode 0xBA)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x50);
        cpu.set("D", 0x10);
        mem[0] = 0xBA;
        cpu.step();
        assert.equal(cpu.status().a, 0x50, "A unchanged=0x50 (greater)");
        assert.equal(cpu.status().f & 0xD7, 0x02, "flags (greater)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x30);
        cpu.set("D", 0x30);
        mem[0] = 0xBA;
        cpu.step();
        assert.equal(cpu.status().a, 0x30, "A unchanged=0x30 (equal (Z set))");
        assert.equal(cpu.status().f & 0xD7, 0x42, "flags (equal (Z set))"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x10);
        cpu.set("D", 0x20);
        mem[0] = 0xBA;
        cpu.step();
        assert.equal(cpu.status().a, 0x10, "A unchanged=0x10 (less (C set))");
        assert.equal(cpu.status().f & 0xD7, 0x83, "flags (less (C set))"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x80);
        cpu.set("D", 0x01);
        mem[0] = 0xBA;
        cpu.step();
        assert.equal(cpu.status().a, 0x80, "A unchanged=0x80 (overflow)");
        assert.equal(cpu.status().f & 0xD7, 0x16, "flags (overflow)"); }
    });
    QUnit.test("CP E (opcode 0xBB)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x50);
        cpu.set("E", 0x10);
        mem[0] = 0xBB;
        cpu.step();
        assert.equal(cpu.status().a, 0x50, "A unchanged=0x50 (greater)");
        assert.equal(cpu.status().f & 0xD7, 0x02, "flags (greater)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x30);
        cpu.set("E", 0x30);
        mem[0] = 0xBB;
        cpu.step();
        assert.equal(cpu.status().a, 0x30, "A unchanged=0x30 (equal (Z set))");
        assert.equal(cpu.status().f & 0xD7, 0x42, "flags (equal (Z set))"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x10);
        cpu.set("E", 0x20);
        mem[0] = 0xBB;
        cpu.step();
        assert.equal(cpu.status().a, 0x10, "A unchanged=0x10 (less (C set))");
        assert.equal(cpu.status().f & 0xD7, 0x83, "flags (less (C set))"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x80);
        cpu.set("E", 0x01);
        mem[0] = 0xBB;
        cpu.step();
        assert.equal(cpu.status().a, 0x80, "A unchanged=0x80 (overflow)");
        assert.equal(cpu.status().f & 0xD7, 0x16, "flags (overflow)"); }
    });
    QUnit.test("CP H (opcode 0xBC)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x50);
        cpu.set("H", 0x10);
        mem[0] = 0xBC;
        cpu.step();
        assert.equal(cpu.status().a, 0x50, "A unchanged=0x50 (greater)");
        assert.equal(cpu.status().f & 0xD7, 0x02, "flags (greater)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x30);
        cpu.set("H", 0x30);
        mem[0] = 0xBC;
        cpu.step();
        assert.equal(cpu.status().a, 0x30, "A unchanged=0x30 (equal (Z set))");
        assert.equal(cpu.status().f & 0xD7, 0x42, "flags (equal (Z set))"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x10);
        cpu.set("H", 0x20);
        mem[0] = 0xBC;
        cpu.step();
        assert.equal(cpu.status().a, 0x10, "A unchanged=0x10 (less (C set))");
        assert.equal(cpu.status().f & 0xD7, 0x83, "flags (less (C set))"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x80);
        cpu.set("H", 0x01);
        mem[0] = 0xBC;
        cpu.step();
        assert.equal(cpu.status().a, 0x80, "A unchanged=0x80 (overflow)");
        assert.equal(cpu.status().f & 0xD7, 0x16, "flags (overflow)"); }
    });
    QUnit.test("CP L (opcode 0xBD)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x50);
        cpu.set("L", 0x10);
        mem[0] = 0xBD;
        cpu.step();
        assert.equal(cpu.status().a, 0x50, "A unchanged=0x50 (greater)");
        assert.equal(cpu.status().f & 0xD7, 0x02, "flags (greater)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x30);
        cpu.set("L", 0x30);
        mem[0] = 0xBD;
        cpu.step();
        assert.equal(cpu.status().a, 0x30, "A unchanged=0x30 (equal (Z set))");
        assert.equal(cpu.status().f & 0xD7, 0x42, "flags (equal (Z set))"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x10);
        cpu.set("L", 0x20);
        mem[0] = 0xBD;
        cpu.step();
        assert.equal(cpu.status().a, 0x10, "A unchanged=0x10 (less (C set))");
        assert.equal(cpu.status().f & 0xD7, 0x83, "flags (less (C set))"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x80);
        cpu.set("L", 0x01);
        mem[0] = 0xBD;
        cpu.step();
        assert.equal(cpu.status().a, 0x80, "A unchanged=0x80 (overflow)");
        assert.equal(cpu.status().f & 0xD7, 0x16, "flags (overflow)"); }
    });
    QUnit.test("CP (HL) (opcode 0xBE)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x50);
        cpu.set("HL", 0x2000);
      mem[0x2000] = 0x10;
        mem[0] = 0xBE;
        cpu.step();
        assert.equal(cpu.status().a, 0x50, "A unchanged=0x50 (greater)");
        assert.equal(cpu.status().f & 0xD7, 0x02, "flags (greater)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x30);
        cpu.set("HL", 0x2000);
      mem[0x2000] = 0x30;
        mem[0] = 0xBE;
        cpu.step();
        assert.equal(cpu.status().a, 0x30, "A unchanged=0x30 (equal (Z set))");
        assert.equal(cpu.status().f & 0xD7, 0x42, "flags (equal (Z set))"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x10);
        cpu.set("HL", 0x2000);
      mem[0x2000] = 0x20;
        mem[0] = 0xBE;
        cpu.step();
        assert.equal(cpu.status().a, 0x10, "A unchanged=0x10 (less (C set))");
        assert.equal(cpu.status().f & 0xD7, 0x83, "flags (less (C set))"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x80);
        cpu.set("HL", 0x2000);
      mem[0x2000] = 0x01;
        mem[0] = 0xBE;
        cpu.step();
        assert.equal(cpu.status().a, 0x80, "A unchanged=0x80 (overflow)");
        assert.equal(cpu.status().f & 0xD7, 0x16, "flags (overflow)"); }
    });
    QUnit.test("CP A (opcode 0xBF)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x50);
        mem[0] = 0xBF;
        cpu.step();
        assert.equal(cpu.status().a, 0x50, "A unchanged=0x50 (greater)");
        assert.equal(cpu.status().f & 0xD7, 0x42, "flags (greater)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x30);
        mem[0] = 0xBF;
        cpu.step();
        assert.equal(cpu.status().a, 0x30, "A unchanged=0x30 (equal (Z set))");
        assert.equal(cpu.status().f & 0xD7, 0x42, "flags (equal (Z set))"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x10);
        mem[0] = 0xBF;
        cpu.step();
        assert.equal(cpu.status().a, 0x10, "A unchanged=0x10 (less (C set))");
        assert.equal(cpu.status().f & 0xD7, 0x42, "flags (less (C set))"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x80);
        mem[0] = 0xBF;
        cpu.step();
        assert.equal(cpu.status().a, 0x80, "A unchanged=0x80 (overflow)");
        assert.equal(cpu.status().f & 0xD7, 0x42, "flags (overflow)"); }
    });
  });

  QUnit.module("INC r - all registers", () => {
    QUnit.test("INC B (opcode 0x04)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("B", 0x00);
        mem[0] = 0x04;
        cpu.step();
        assert.equal(cpu.status().b, 0x01, "INC B: 0x00+1=0x01");
        assert.equal(cpu.status().f & 0xD6, 0x00, "flags (0x00+1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("B", 0x0F);
        mem[0] = 0x04;
        cpu.step();
        assert.equal(cpu.status().b, 0x10, "INC B: 0x0F+1=0x10");
        assert.equal(cpu.status().f & 0xD6, 0x10, "flags (0x0F+1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("B", 0x7F);
        mem[0] = 0x04;
        cpu.step();
        assert.equal(cpu.status().b, 0x80, "INC B: 0x7F+1=0x80");
        assert.equal(cpu.status().f & 0xD6, 0x94, "flags (0x7F+1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("B", 0xFE);
        mem[0] = 0x04;
        cpu.step();
        assert.equal(cpu.status().b, 0xFF, "INC B: 0xFE+1=0xFF");
        assert.equal(cpu.status().f & 0xD6, 0x80, "flags (0xFE+1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("B", 0xFF);
        mem[0] = 0x04;
        cpu.step();
        assert.equal(cpu.status().b, 0x00, "INC B: 0xFF+1=0x00");
        assert.equal(cpu.status().f & 0xD6, 0x50, "flags (0xFF+1)"); }
    });
    QUnit.test("INC C (opcode 0x0C)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("C", 0x00);
        mem[0] = 0x0C;
        cpu.step();
        assert.equal(cpu.status().c, 0x01, "INC C: 0x00+1=0x01");
        assert.equal(cpu.status().f & 0xD6, 0x00, "flags (0x00+1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("C", 0x0F);
        mem[0] = 0x0C;
        cpu.step();
        assert.equal(cpu.status().c, 0x10, "INC C: 0x0F+1=0x10");
        assert.equal(cpu.status().f & 0xD6, 0x10, "flags (0x0F+1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("C", 0x7F);
        mem[0] = 0x0C;
        cpu.step();
        assert.equal(cpu.status().c, 0x80, "INC C: 0x7F+1=0x80");
        assert.equal(cpu.status().f & 0xD6, 0x94, "flags (0x7F+1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("C", 0xFE);
        mem[0] = 0x0C;
        cpu.step();
        assert.equal(cpu.status().c, 0xFF, "INC C: 0xFE+1=0xFF");
        assert.equal(cpu.status().f & 0xD6, 0x80, "flags (0xFE+1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("C", 0xFF);
        mem[0] = 0x0C;
        cpu.step();
        assert.equal(cpu.status().c, 0x00, "INC C: 0xFF+1=0x00");
        assert.equal(cpu.status().f & 0xD6, 0x50, "flags (0xFF+1)"); }
    });
    QUnit.test("INC D (opcode 0x14)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("D", 0x00);
        mem[0] = 0x14;
        cpu.step();
        assert.equal(cpu.status().d, 0x01, "INC D: 0x00+1=0x01");
        assert.equal(cpu.status().f & 0xD6, 0x00, "flags (0x00+1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("D", 0x0F);
        mem[0] = 0x14;
        cpu.step();
        assert.equal(cpu.status().d, 0x10, "INC D: 0x0F+1=0x10");
        assert.equal(cpu.status().f & 0xD6, 0x10, "flags (0x0F+1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("D", 0x7F);
        mem[0] = 0x14;
        cpu.step();
        assert.equal(cpu.status().d, 0x80, "INC D: 0x7F+1=0x80");
        assert.equal(cpu.status().f & 0xD6, 0x94, "flags (0x7F+1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("D", 0xFE);
        mem[0] = 0x14;
        cpu.step();
        assert.equal(cpu.status().d, 0xFF, "INC D: 0xFE+1=0xFF");
        assert.equal(cpu.status().f & 0xD6, 0x80, "flags (0xFE+1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("D", 0xFF);
        mem[0] = 0x14;
        cpu.step();
        assert.equal(cpu.status().d, 0x00, "INC D: 0xFF+1=0x00");
        assert.equal(cpu.status().f & 0xD6, 0x50, "flags (0xFF+1)"); }
    });
    QUnit.test("INC E (opcode 0x1C)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("E", 0x00);
        mem[0] = 0x1C;
        cpu.step();
        assert.equal(cpu.status().e, 0x01, "INC E: 0x00+1=0x01");
        assert.equal(cpu.status().f & 0xD6, 0x00, "flags (0x00+1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("E", 0x0F);
        mem[0] = 0x1C;
        cpu.step();
        assert.equal(cpu.status().e, 0x10, "INC E: 0x0F+1=0x10");
        assert.equal(cpu.status().f & 0xD6, 0x10, "flags (0x0F+1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("E", 0x7F);
        mem[0] = 0x1C;
        cpu.step();
        assert.equal(cpu.status().e, 0x80, "INC E: 0x7F+1=0x80");
        assert.equal(cpu.status().f & 0xD6, 0x94, "flags (0x7F+1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("E", 0xFE);
        mem[0] = 0x1C;
        cpu.step();
        assert.equal(cpu.status().e, 0xFF, "INC E: 0xFE+1=0xFF");
        assert.equal(cpu.status().f & 0xD6, 0x80, "flags (0xFE+1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("E", 0xFF);
        mem[0] = 0x1C;
        cpu.step();
        assert.equal(cpu.status().e, 0x00, "INC E: 0xFF+1=0x00");
        assert.equal(cpu.status().f & 0xD6, 0x50, "flags (0xFF+1)"); }
    });
    QUnit.test("INC H (opcode 0x24)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("H", 0x00);
        mem[0] = 0x24;
        cpu.step();
        assert.equal(cpu.status().h, 0x01, "INC H: 0x00+1=0x01");
        assert.equal(cpu.status().f & 0xD6, 0x00, "flags (0x00+1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("H", 0x0F);
        mem[0] = 0x24;
        cpu.step();
        assert.equal(cpu.status().h, 0x10, "INC H: 0x0F+1=0x10");
        assert.equal(cpu.status().f & 0xD6, 0x10, "flags (0x0F+1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("H", 0x7F);
        mem[0] = 0x24;
        cpu.step();
        assert.equal(cpu.status().h, 0x80, "INC H: 0x7F+1=0x80");
        assert.equal(cpu.status().f & 0xD6, 0x94, "flags (0x7F+1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("H", 0xFE);
        mem[0] = 0x24;
        cpu.step();
        assert.equal(cpu.status().h, 0xFF, "INC H: 0xFE+1=0xFF");
        assert.equal(cpu.status().f & 0xD6, 0x80, "flags (0xFE+1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("H", 0xFF);
        mem[0] = 0x24;
        cpu.step();
        assert.equal(cpu.status().h, 0x00, "INC H: 0xFF+1=0x00");
        assert.equal(cpu.status().f & 0xD6, 0x50, "flags (0xFF+1)"); }
    });
    QUnit.test("INC L (opcode 0x2C)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("L", 0x00);
        mem[0] = 0x2C;
        cpu.step();
        assert.equal(cpu.status().l, 0x01, "INC L: 0x00+1=0x01");
        assert.equal(cpu.status().f & 0xD6, 0x00, "flags (0x00+1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("L", 0x0F);
        mem[0] = 0x2C;
        cpu.step();
        assert.equal(cpu.status().l, 0x10, "INC L: 0x0F+1=0x10");
        assert.equal(cpu.status().f & 0xD6, 0x10, "flags (0x0F+1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("L", 0x7F);
        mem[0] = 0x2C;
        cpu.step();
        assert.equal(cpu.status().l, 0x80, "INC L: 0x7F+1=0x80");
        assert.equal(cpu.status().f & 0xD6, 0x94, "flags (0x7F+1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("L", 0xFE);
        mem[0] = 0x2C;
        cpu.step();
        assert.equal(cpu.status().l, 0xFF, "INC L: 0xFE+1=0xFF");
        assert.equal(cpu.status().f & 0xD6, 0x80, "flags (0xFE+1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("L", 0xFF);
        mem[0] = 0x2C;
        cpu.step();
        assert.equal(cpu.status().l, 0x00, "INC L: 0xFF+1=0x00");
        assert.equal(cpu.status().f & 0xD6, 0x50, "flags (0xFF+1)"); }
    });
    QUnit.test("INC (HL) (opcode 0x34)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("HL", 0x2000); mem[0x2000] = 0x00;
        mem[0] = 0x34;
        cpu.step();
        assert.equal(mem[0x2000], 0x01, "INC (HL): 0x00+1=0x01");
        assert.equal(cpu.status().f & 0xD6, 0x00, "flags (0x00+1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("HL", 0x2000); mem[0x2000] = 0x0F;
        mem[0] = 0x34;
        cpu.step();
        assert.equal(mem[0x2000], 0x10, "INC (HL): 0x0F+1=0x10");
        assert.equal(cpu.status().f & 0xD6, 0x10, "flags (0x0F+1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("HL", 0x2000); mem[0x2000] = 0x7F;
        mem[0] = 0x34;
        cpu.step();
        assert.equal(mem[0x2000], 0x80, "INC (HL): 0x7F+1=0x80");
        assert.equal(cpu.status().f & 0xD6, 0x94, "flags (0x7F+1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("HL", 0x2000); mem[0x2000] = 0xFE;
        mem[0] = 0x34;
        cpu.step();
        assert.equal(mem[0x2000], 0xFF, "INC (HL): 0xFE+1=0xFF");
        assert.equal(cpu.status().f & 0xD6, 0x80, "flags (0xFE+1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("HL", 0x2000); mem[0x2000] = 0xFF;
        mem[0] = 0x34;
        cpu.step();
        assert.equal(mem[0x2000], 0x00, "INC (HL): 0xFF+1=0x00");
        assert.equal(cpu.status().f & 0xD6, 0x50, "flags (0xFF+1)"); }
    });
    QUnit.test("INC A (opcode 0x3C)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x00);
        mem[0] = 0x3C;
        cpu.step();
        assert.equal(cpu.status().a, 0x01, "INC A: 0x00+1=0x01");
        assert.equal(cpu.status().f & 0xD6, 0x00, "flags (0x00+1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x0F);
        mem[0] = 0x3C;
        cpu.step();
        assert.equal(cpu.status().a, 0x10, "INC A: 0x0F+1=0x10");
        assert.equal(cpu.status().f & 0xD6, 0x10, "flags (0x0F+1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x7F);
        mem[0] = 0x3C;
        cpu.step();
        assert.equal(cpu.status().a, 0x80, "INC A: 0x7F+1=0x80");
        assert.equal(cpu.status().f & 0xD6, 0x94, "flags (0x7F+1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFE);
        mem[0] = 0x3C;
        cpu.step();
        assert.equal(cpu.status().a, 0xFF, "INC A: 0xFE+1=0xFF");
        assert.equal(cpu.status().f & 0xD6, 0x80, "flags (0xFE+1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);
        mem[0] = 0x3C;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "INC A: 0xFF+1=0x00");
        assert.equal(cpu.status().f & 0xD6, 0x50, "flags (0xFF+1)"); }
    });
  });

  QUnit.module("DEC r - all registers", () => {
    QUnit.test("DEC B (opcode 0x05)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("B", 0x01);
        mem[0] = 0x05;
        cpu.step();
        assert.equal(cpu.status().b, 0x00, "DEC B: 0x01-1=0x00");
        assert.equal(cpu.status().f & 0xD7, 0x42, "flags (0x01-1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("B", 0x10);
        mem[0] = 0x05;
        cpu.step();
        assert.equal(cpu.status().b, 0x0F, "DEC B: 0x10-1=0x0F");
        assert.equal(cpu.status().f & 0xD7, 0x12, "flags (0x10-1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("B", 0x80);
        mem[0] = 0x05;
        cpu.step();
        assert.equal(cpu.status().b, 0x7F, "DEC B: 0x80-1=0x7F");
        assert.equal(cpu.status().f & 0xD7, 0x16, "flags (0x80-1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("B", 0x00);
        mem[0] = 0x05;
        cpu.step();
        assert.equal(cpu.status().b, 0xFF, "DEC B: 0x00-1=0xFF");
        assert.equal(cpu.status().f & 0xD7, 0x92, "flags (0x00-1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("B", 0xFF);
        mem[0] = 0x05;
        cpu.step();
        assert.equal(cpu.status().b, 0xFE, "DEC B: 0xFF-1=0xFE");
        assert.equal(cpu.status().f & 0xD7, 0x82, "flags (0xFF-1)"); }
    });
    QUnit.test("DEC C (opcode 0x0D)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("C", 0x01);
        mem[0] = 0x0D;
        cpu.step();
        assert.equal(cpu.status().c, 0x00, "DEC C: 0x01-1=0x00");
        assert.equal(cpu.status().f & 0xD7, 0x42, "flags (0x01-1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("C", 0x10);
        mem[0] = 0x0D;
        cpu.step();
        assert.equal(cpu.status().c, 0x0F, "DEC C: 0x10-1=0x0F");
        assert.equal(cpu.status().f & 0xD7, 0x12, "flags (0x10-1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("C", 0x80);
        mem[0] = 0x0D;
        cpu.step();
        assert.equal(cpu.status().c, 0x7F, "DEC C: 0x80-1=0x7F");
        assert.equal(cpu.status().f & 0xD7, 0x16, "flags (0x80-1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("C", 0x00);
        mem[0] = 0x0D;
        cpu.step();
        assert.equal(cpu.status().c, 0xFF, "DEC C: 0x00-1=0xFF");
        assert.equal(cpu.status().f & 0xD7, 0x92, "flags (0x00-1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("C", 0xFF);
        mem[0] = 0x0D;
        cpu.step();
        assert.equal(cpu.status().c, 0xFE, "DEC C: 0xFF-1=0xFE");
        assert.equal(cpu.status().f & 0xD7, 0x82, "flags (0xFF-1)"); }
    });
    QUnit.test("DEC D (opcode 0x15)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("D", 0x01);
        mem[0] = 0x15;
        cpu.step();
        assert.equal(cpu.status().d, 0x00, "DEC D: 0x01-1=0x00");
        assert.equal(cpu.status().f & 0xD7, 0x42, "flags (0x01-1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("D", 0x10);
        mem[0] = 0x15;
        cpu.step();
        assert.equal(cpu.status().d, 0x0F, "DEC D: 0x10-1=0x0F");
        assert.equal(cpu.status().f & 0xD7, 0x12, "flags (0x10-1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("D", 0x80);
        mem[0] = 0x15;
        cpu.step();
        assert.equal(cpu.status().d, 0x7F, "DEC D: 0x80-1=0x7F");
        assert.equal(cpu.status().f & 0xD7, 0x16, "flags (0x80-1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("D", 0x00);
        mem[0] = 0x15;
        cpu.step();
        assert.equal(cpu.status().d, 0xFF, "DEC D: 0x00-1=0xFF");
        assert.equal(cpu.status().f & 0xD7, 0x92, "flags (0x00-1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("D", 0xFF);
        mem[0] = 0x15;
        cpu.step();
        assert.equal(cpu.status().d, 0xFE, "DEC D: 0xFF-1=0xFE");
        assert.equal(cpu.status().f & 0xD7, 0x82, "flags (0xFF-1)"); }
    });
    QUnit.test("DEC E (opcode 0x1D)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("E", 0x01);
        mem[0] = 0x1D;
        cpu.step();
        assert.equal(cpu.status().e, 0x00, "DEC E: 0x01-1=0x00");
        assert.equal(cpu.status().f & 0xD7, 0x42, "flags (0x01-1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("E", 0x10);
        mem[0] = 0x1D;
        cpu.step();
        assert.equal(cpu.status().e, 0x0F, "DEC E: 0x10-1=0x0F");
        assert.equal(cpu.status().f & 0xD7, 0x12, "flags (0x10-1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("E", 0x80);
        mem[0] = 0x1D;
        cpu.step();
        assert.equal(cpu.status().e, 0x7F, "DEC E: 0x80-1=0x7F");
        assert.equal(cpu.status().f & 0xD7, 0x16, "flags (0x80-1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("E", 0x00);
        mem[0] = 0x1D;
        cpu.step();
        assert.equal(cpu.status().e, 0xFF, "DEC E: 0x00-1=0xFF");
        assert.equal(cpu.status().f & 0xD7, 0x92, "flags (0x00-1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("E", 0xFF);
        mem[0] = 0x1D;
        cpu.step();
        assert.equal(cpu.status().e, 0xFE, "DEC E: 0xFF-1=0xFE");
        assert.equal(cpu.status().f & 0xD7, 0x82, "flags (0xFF-1)"); }
    });
    QUnit.test("DEC H (opcode 0x25)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("H", 0x01);
        mem[0] = 0x25;
        cpu.step();
        assert.equal(cpu.status().h, 0x00, "DEC H: 0x01-1=0x00");
        assert.equal(cpu.status().f & 0xD7, 0x42, "flags (0x01-1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("H", 0x10);
        mem[0] = 0x25;
        cpu.step();
        assert.equal(cpu.status().h, 0x0F, "DEC H: 0x10-1=0x0F");
        assert.equal(cpu.status().f & 0xD7, 0x12, "flags (0x10-1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("H", 0x80);
        mem[0] = 0x25;
        cpu.step();
        assert.equal(cpu.status().h, 0x7F, "DEC H: 0x80-1=0x7F");
        assert.equal(cpu.status().f & 0xD7, 0x16, "flags (0x80-1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("H", 0x00);
        mem[0] = 0x25;
        cpu.step();
        assert.equal(cpu.status().h, 0xFF, "DEC H: 0x00-1=0xFF");
        assert.equal(cpu.status().f & 0xD7, 0x92, "flags (0x00-1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("H", 0xFF);
        mem[0] = 0x25;
        cpu.step();
        assert.equal(cpu.status().h, 0xFE, "DEC H: 0xFF-1=0xFE");
        assert.equal(cpu.status().f & 0xD7, 0x82, "flags (0xFF-1)"); }
    });
    QUnit.test("DEC L (opcode 0x2D)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("L", 0x01);
        mem[0] = 0x2D;
        cpu.step();
        assert.equal(cpu.status().l, 0x00, "DEC L: 0x01-1=0x00");
        assert.equal(cpu.status().f & 0xD7, 0x42, "flags (0x01-1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("L", 0x10);
        mem[0] = 0x2D;
        cpu.step();
        assert.equal(cpu.status().l, 0x0F, "DEC L: 0x10-1=0x0F");
        assert.equal(cpu.status().f & 0xD7, 0x12, "flags (0x10-1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("L", 0x80);
        mem[0] = 0x2D;
        cpu.step();
        assert.equal(cpu.status().l, 0x7F, "DEC L: 0x80-1=0x7F");
        assert.equal(cpu.status().f & 0xD7, 0x16, "flags (0x80-1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("L", 0x00);
        mem[0] = 0x2D;
        cpu.step();
        assert.equal(cpu.status().l, 0xFF, "DEC L: 0x00-1=0xFF");
        assert.equal(cpu.status().f & 0xD7, 0x92, "flags (0x00-1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("L", 0xFF);
        mem[0] = 0x2D;
        cpu.step();
        assert.equal(cpu.status().l, 0xFE, "DEC L: 0xFF-1=0xFE");
        assert.equal(cpu.status().f & 0xD7, 0x82, "flags (0xFF-1)"); }
    });
    QUnit.test("DEC (HL) (opcode 0x35)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("HL", 0x2000); mem[0x2000] = 0x01;
        mem[0] = 0x35;
        cpu.step();
        assert.equal(mem[0x2000], 0x00, "DEC (HL): 0x01-1=0x00");
        assert.equal(cpu.status().f & 0xD7, 0x42, "flags (0x01-1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("HL", 0x2000); mem[0x2000] = 0x10;
        mem[0] = 0x35;
        cpu.step();
        assert.equal(mem[0x2000], 0x0F, "DEC (HL): 0x10-1=0x0F");
        assert.equal(cpu.status().f & 0xD7, 0x12, "flags (0x10-1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("HL", 0x2000); mem[0x2000] = 0x80;
        mem[0] = 0x35;
        cpu.step();
        assert.equal(mem[0x2000], 0x7F, "DEC (HL): 0x80-1=0x7F");
        assert.equal(cpu.status().f & 0xD7, 0x16, "flags (0x80-1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("HL", 0x2000); mem[0x2000] = 0x00;
        mem[0] = 0x35;
        cpu.step();
        assert.equal(mem[0x2000], 0xFF, "DEC (HL): 0x00-1=0xFF");
        assert.equal(cpu.status().f & 0xD7, 0x92, "flags (0x00-1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("HL", 0x2000); mem[0x2000] = 0xFF;
        mem[0] = 0x35;
        cpu.step();
        assert.equal(mem[0x2000], 0xFE, "DEC (HL): 0xFF-1=0xFE");
        assert.equal(cpu.status().f & 0xD7, 0x82, "flags (0xFF-1)"); }
    });
    QUnit.test("DEC A (opcode 0x3D)", (assert) => {
      const HL_ADDR = 0x2000;
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x01);
        mem[0] = 0x3D;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "DEC A: 0x01-1=0x00");
        assert.equal(cpu.status().f & 0xD7, 0x42, "flags (0x01-1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x10);
        mem[0] = 0x3D;
        cpu.step();
        assert.equal(cpu.status().a, 0x0F, "DEC A: 0x10-1=0x0F");
        assert.equal(cpu.status().f & 0xD7, 0x12, "flags (0x10-1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x80);
        mem[0] = 0x3D;
        cpu.step();
        assert.equal(cpu.status().a, 0x7F, "DEC A: 0x80-1=0x7F");
        assert.equal(cpu.status().f & 0xD7, 0x16, "flags (0x80-1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x00);
        mem[0] = 0x3D;
        cpu.step();
        assert.equal(cpu.status().a, 0xFF, "DEC A: 0x00-1=0xFF");
        assert.equal(cpu.status().f & 0xD7, 0x92, "flags (0x00-1)"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);
        mem[0] = 0x3D;
        cpu.step();
        assert.equal(cpu.status().a, 0xFE, "DEC A: 0xFF-1=0xFE");
        assert.equal(cpu.status().f & 0xD7, 0x82, "flags (0xFF-1)"); }
    });
  });

  QUnit.module("ALU immediate - n forms", () => {
    QUnit.test("ADD A,n (opcode 0xC6)", (assert) => {
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x10);
        mem[0] = 0xC6; mem[1] = 0x20;
        cpu.step();
        assert.equal(cpu.status().a, 0x30, "ADD A,n A=0x10,n=0x20=0x30");
        assert.equal(cpu.status().f & 0xD7, 0x00, "flags"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);
        mem[0] = 0xC6; mem[1] = 0x01;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "ADD A,n A=0xFF,n=0x01=0x00");
        assert.equal(cpu.status().f & 0xD7, 0x51, "flags"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x70);
        mem[0] = 0xC6; mem[1] = 0x10;
        cpu.step();
        assert.equal(cpu.status().a, 0x80, "ADD A,n A=0x70,n=0x10=0x80");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags"); }
    });
    QUnit.test("ADC A,n (opcode 0xCE)", (assert) => {
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x10);
        mem[0] = 0xCE; mem[1] = 0x20;
        cpu.step();
        assert.equal(cpu.status().a, 0x30, "ADC A,n A=0x10,n=0x20=0x30");
        assert.equal(cpu.status().f & 0xD7, 0x00, "flags"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);
        mem[0] = 0xCE; mem[1] = 0x00;
        cpu.step();
        assert.equal(cpu.status().a, 0xFF, "ADC A,n A=0xFF,n=0x00=0xFF");
        assert.equal(cpu.status().f & 0xD7, 0x80, "flags"); }
      { const { cpu, mem } = createTestCPU(); // with carry=1
        cpu.set("A", 0x10);
        mem[0] = 0x37; // SCF
        mem[1] = 0xCE; mem[2] = 0x20;
        cpu.step(); cpu.step();
        assert.equal(cpu.status().a, 0x31, "ADC A,n cy=1: A=0x10,n=0x20+1=0x31");
        assert.equal(cpu.status().f & 0xD7, 0x00, "flags cy=1"); }
    });
    QUnit.test("SUB n (opcode 0xD6)", (assert) => {
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x40);
        mem[0] = 0xD6; mem[1] = 0x10;
        cpu.step();
        assert.equal(cpu.status().a, 0x30, "SUB n A=0x40,n=0x10=0x30");
        assert.equal(cpu.status().f & 0xD7, 0x02, "flags"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x30);
        mem[0] = 0xD6; mem[1] = 0x30;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "SUB n A=0x30,n=0x30=0x00");
        assert.equal(cpu.status().f & 0xD7, 0x42, "flags"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x10);
        mem[0] = 0xD6; mem[1] = 0x20;
        cpu.step();
        assert.equal(cpu.status().a, 0xF0, "SUB n A=0x10,n=0x20=0xF0");
        assert.equal(cpu.status().f & 0xD7, 0x83, "flags"); }
    });
    QUnit.test("SBC A,n (opcode 0xDE)", (assert) => {
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x40);
        mem[0] = 0xDE; mem[1] = 0x10;
        cpu.step();
        assert.equal(cpu.status().a, 0x30, "SBC A,n A=0x40,n=0x10=0x30");
        assert.equal(cpu.status().f & 0xD7, 0x02, "flags"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x30);
        mem[0] = 0xDE; mem[1] = 0x30;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "SBC A,n A=0x30,n=0x30=0x00");
        assert.equal(cpu.status().f & 0xD7, 0x42, "flags"); }
      { const { cpu, mem } = createTestCPU(); // with carry=1
        cpu.set("A", 0x40);
        mem[0] = 0x37; // SCF
        mem[1] = 0xDE; mem[2] = 0x10;
        cpu.step(); cpu.step();
        assert.equal(cpu.status().a, 0x2F, "SBC A,n cy=1: A=0x40,n=0x10+1=0x2F");
        assert.equal(cpu.status().f & 0xD7, 0x12, "flags cy=1"); }
    });
    QUnit.test("AND n (opcode 0xE6)", (assert) => {
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xF0);
        mem[0] = 0xE6; mem[1] = 0x0F;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "AND n A=0xF0,n=0x0F=0x00");
        assert.equal(cpu.status().f & 0xD7, 0x54, "flags"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);
        mem[0] = 0xE6; mem[1] = 0xAA;
        cpu.step();
        assert.equal(cpu.status().a, 0xAA, "AND n A=0xFF,n=0xAA=0xAA");
        assert.equal(cpu.status().f & 0xD7, 0x94, "flags"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x00);
        mem[0] = 0xE6; mem[1] = 0xFF;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "AND n A=0x00,n=0xFF=0x00");
        assert.equal(cpu.status().f & 0xD7, 0x54, "flags"); }
    });
    QUnit.test("XOR n (opcode 0xEE)", (assert) => {
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);
        mem[0] = 0xEE; mem[1] = 0x0F;
        cpu.step();
        assert.equal(cpu.status().a, 0xF0, "XOR n A=0xFF,n=0x0F=0xF0");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xAA);
        mem[0] = 0xEE; mem[1] = 0xAA;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "XOR n A=0xAA,n=0xAA=0x00");
        assert.equal(cpu.status().f & 0xD7, 0x44, "flags"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x00);
        mem[0] = 0xEE; mem[1] = 0x80;
        cpu.step();
        assert.equal(cpu.status().a, 0x80, "XOR n A=0x00,n=0x80=0x80");
        assert.equal(cpu.status().f & 0xD7, 0x80, "flags"); }
    });
    QUnit.test("OR n (opcode 0xF6)", (assert) => {
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xF0);
        mem[0] = 0xF6; mem[1] = 0x0F;
        cpu.step();
        assert.equal(cpu.status().a, 0xFF, "OR n A=0xF0,n=0x0F=0xFF");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x00);
        mem[0] = 0xF6; mem[1] = 0x00;
        cpu.step();
        assert.equal(cpu.status().a, 0x00, "OR n A=0x00,n=0x00=0x00");
        assert.equal(cpu.status().f & 0xD7, 0x44, "flags"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x55);
        mem[0] = 0xF6; mem[1] = 0xAA;
        cpu.step();
        assert.equal(cpu.status().a, 0xFF, "OR n A=0x55,n=0xAA=0xFF");
        assert.equal(cpu.status().f & 0xD7, 0x84, "flags"); }
    });
    QUnit.test("CP n (opcode 0xFE)", (assert) => {
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x50);
        mem[0] = 0xFE; mem[1] = 0x10;
        cpu.step();
        assert.equal(cpu.status().a, 0x50, "CP n A=0x50,n=0x10=0x50");
        assert.equal(cpu.status().f & 0xD7, 0x02, "flags"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x30);
        mem[0] = 0xFE; mem[1] = 0x30;
        cpu.step();
        assert.equal(cpu.status().a, 0x30, "CP n A=0x30,n=0x30=0x30");
        assert.equal(cpu.status().f & 0xD7, 0x42, "flags"); }
      { const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x10);
        mem[0] = 0xFE; mem[1] = 0x20;
        cpu.step();
        assert.equal(cpu.status().a, 0x10, "CP n A=0x10,n=0x20=0x10");
        assert.equal(cpu.status().f & 0xD7, 0x83, "flags"); }
    });
  });
});
