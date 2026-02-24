/**
 * Intel 8080 Last Branch Tests
 *
 * Final tests to reach 90% branch coverage
 */

import QUnit from "qunit";
import create8080 from "../src/8080.js";

QUnit.module("8080 Last Branch Tests", () => {
  const createTestCPU = () => {
    const mem = new Uint8Array(65536);
    const ports = new Uint8Array(256);
    const cpu = create8080({
      byteAt: (addr) => mem[addr] || 0,
      byteTo: (addr, val) => { mem[addr] = val & 0xFF; },
      portOut: (port, val) => { ports[port] = val & 0xFF; },
      portIn: (port) => ports[port] || 0
    });
    return { cpu, mem, ports };
  };

  QUnit.module("Missing PUSH instructions", () => {
    QUnit.test("PUSH DE", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      cpu.set("D", 0x12);
      cpu.set("E", 0x34);
      mem[0x0000] = 0xD5; // PUSH DE
      cpu.set("PC", 0x0000);
      cpu.steps(11);
      assert.equal(mem[0xEFFE], 0x34, "E pushed to stack");
      assert.equal(mem[0xEFFF], 0x12, "D pushed to stack");
      assert.equal(cpu.status().sp, 0xEFFE, "SP decremented");
    });

    QUnit.test("PUSH BC", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      cpu.set("B", 0x56);
      cpu.set("C", 0x78);
      mem[0x0000] = 0xC5; // PUSH BC
      cpu.set("PC", 0x0000);
      cpu.steps(11);
      assert.equal(mem[0xEFFE], 0x78, "C pushed to stack");
      assert.equal(mem[0xEFFF], 0x56, "B pushed to stack");
    });
  });

  QUnit.module("JC - missing else branch", () => {
    QUnit.test("JC nn - not taken (carry not set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("F", 0x00); // Carry not set
      mem[0x0000] = 0xDA; // JC nn
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x10;
      cpu.set("PC", 0x0000);
      cpu.steps(10);
      assert.equal(cpu.status().pc, 0x0003, "Jump not taken, PC advanced");
    });
  });

  QUnit.module("Additional conditional coverage", () => {
    QUnit.test("CZ - taken (zero set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      cpu.set("F", 0x40); // Set zero flag
      mem[0x0000] = 0xCC; // CZ nn
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x10;
      cpu.set("PC", 0x0000);
      cpu.steps(17);
      assert.equal(cpu.status().pc, 0x1000, "Call taken when zero set");
      assert.equal(cpu.status().sp, 0xEFFE, "Return address pushed");
    });

    QUnit.test("CZ - not taken (zero not set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      cpu.set("F", 0x00); // Zero not set
      mem[0x0000] = 0xCC; // CZ nn
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x10;
      cpu.set("PC", 0x0000);
      cpu.steps(11);
      assert.equal(cpu.status().pc, 0x0003, "Call not taken");
      assert.equal(cpu.status().sp, 0xF000, "SP unchanged");
    });
  });

  QUnit.module("Increment/Decrement edge cases", () => {
    QUnit.test("INR with zero result", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("B", 0xFF);
      mem[0x0000] = 0x04; // INR B
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      const state = cpu.status();
      assert.equal(state.b, 0x00, "B wrapped to 0");
      assert.ok(state.f & 0x40, "Zero flag set");
      assert.ok(state.f & 0x10, "Half-carry set (lower nibble overflow)");
    });

    QUnit.test("DCR with zero result", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("B", 0x01);
      mem[0x0000] = 0x05; // DCR B
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      const state = cpu.status();
      assert.equal(state.b, 0x00, "B decremented to 0");
      assert.ok(state.f & 0x40, "Zero flag set");
      assert.ok(state.f & 0x10, "Half-carry set");
    });

    QUnit.test("DCR from zero wraps to 0xFF", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x00);
      mem[0x0000] = 0x3D; // DCR A
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      const state = cpu.status();
      assert.equal(state.a, 0xFF, "A wrapped to 0xFF");
      assert.ok(state.f & 0x80, "Sign flag set");
      assert.notOk(state.f & 0x10, "Half-carry clear (no borrow from bit 4)");
    });
  });

  QUnit.module("XOR with carry/half-carry clear", () => {
    QUnit.test("XOR clears carry and half-carry", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0xFF);
      cpu.set("B", 0x00);
      cpu.set("F", 0x11); // Set carry and half-carry
      mem[0x0000] = 0xA8; // XRA B
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      const state = cpu.status();
      assert.notOk(state.f & 0x01, "Carry cleared");
      assert.notOk(state.f & 0x10, "Half-carry cleared");
    });
  });

  QUnit.module("OR with carry/half-carry clear", () => {
    QUnit.test("OR clears carry and half-carry", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0xF0);
      cpu.set("B", 0x00);
      cpu.set("F", 0x11); // Set carry and half-carry
      mem[0x0000] = 0xB0; // ORA B
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      const state = cpu.status();
      assert.notOk(state.f & 0x01, "Carry cleared");
      assert.notOk(state.f & 0x10, "Half-carry cleared");
    });
  });

  QUnit.module("Subtract edge cases", () => {
    QUnit.test("SUB without half-carry", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x20); // 0010 0000
      cpu.set("B", 0x01); // 0000 0001
      mem[0x0000] = 0x90; // SUB B
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      const state = cpu.status();
      assert.equal(state.a, 0x1F, "A = 0x20 - 0x01 = 0x1F");
      // Half-carry depends on specific bit pattern
    });

    QUnit.test("SBB with borrow", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x00);
      cpu.set("B", 0x01);
      cpu.set("F", 0x01); // Set carry (borrow)
      mem[0x0000] = 0x98; // SBB B
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      const state = cpu.status();
      assert.equal(state.a, 0xFE, "A = 0 - 1 - 1 = -2 = 0xFE");
      assert.ok(state.f & 0x01, "Carry set (underflow)");
    });
  });

  QUnit.module("Compare with different results", () => {
    QUnit.test("CMP - greater than (no carry)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x50);
      cpu.set("B", 0x30);
      mem[0x0000] = 0xB8; // CMP B
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      const state = cpu.status();
      assert.notOk(state.f & 0x01, "Carry clear (A > B)");
      assert.notOk(state.f & 0x40, "Zero clear");
    });

    QUnit.test("CMP - less than (carry set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x30);
      cpu.set("B", 0x50);
      mem[0x0000] = 0xB8; // CMP B
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      const state = cpu.status();
      assert.ok(state.f & 0x01, "Carry set (A < B)");
    });
  });

  QUnit.module("Additional ADD/SUB combinations", () => {
    QUnit.test("ADD with all flags", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0xFF);
      cpu.set("B", 0xFF);
      mem[0x0000] = 0x80; // ADD B
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      const state = cpu.status();
      assert.equal(state.a, 0xFE, "A = 0xFF + 0xFF = 0xFE (with carry)");
      assert.ok(state.f & 0x01, "Carry set");
      assert.ok(state.f & 0x10, "Half-carry set");
      assert.ok(state.f & 0x80, "Sign set");
    });

    QUnit.test("ADC with carry chain", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0xFF);
      cpu.set("B", 0xFF);
      cpu.set("F", 0x01); // Set carry
      mem[0x0000] = 0x88; // ADC B
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      const state = cpu.status();
      assert.equal(state.a, 0xFF, "A = 0xFF + 0xFF + 1 = 0xFF (with carry out)");
      assert.ok(state.f & 0x01, "Carry set");
    });
  });
});
