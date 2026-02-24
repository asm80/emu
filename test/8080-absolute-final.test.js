/**
 * Intel 8080 Absolute Final Tests
 *
 * Target the last 0.79% of branches to reach 90%
 */

import QUnit from "qunit";
import create8080 from "../src/8080.js";

QUnit.module("8080 Absolute Final", () => {
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

  QUnit.module("Remaining MOV instructions", () => {
    // Target uncovered lines 573-574, 885-887, 1005
    QUnit.test("MOV B,B (self-move)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("B", 0x42);
      mem[0x0000] = 0x40; // MOV B,B
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().b, 0x42, "B unchanged");
    });

    QUnit.test("MOV C,C (self-move)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("C", 0x42);
      mem[0x0000] = 0x49; // MOV C,C
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().c, 0x42, "C unchanged");
    });
  });

  QUnit.module("Remaining conditional branches", () => {
    QUnit.test("RNZ - not taken (zero set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      cpu.set("F", 0x40); // Set zero flag
      mem[0x0100] = 0xC0; // RNZ
      cpu.set("PC", 0x0100);
      cpu.steps(5);
      assert.equal(cpu.status().pc, 0x0101, "Return not taken when zero set");
      assert.equal(cpu.T(), 5, "Takes 5 cycles when not taken");
    });

    QUnit.test("RNC - not taken (carry set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      cpu.set("F", 0x01); // Set carry flag
      mem[0x0100] = 0xD0; // RNC
      cpu.set("PC", 0x0100);
      cpu.steps(5);
      assert.equal(cpu.status().pc, 0x0101, "Return not taken when carry set");
    });
  });

  QUnit.module("Flag preservation in INR/DCR", () => {
    QUnit.test("INR preserves carry flag", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("B", 0x10);
      cpu.set("F", 0x01); // Set carry
      mem[0x0000] = 0x04; // INR B
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      const state = cpu.status();
      assert.equal(state.b, 0x11, "B incremented");
      assert.ok(state.f & 0x01, "Carry flag preserved");
    });

    QUnit.test("DCR preserves carry flag", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("C", 0x10);
      cpu.set("F", 0x01); // Set carry
      mem[0x0000] = 0x0D; // DCR C
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      const state = cpu.status();
      assert.equal(state.c, 0x0F, "C decremented");
      assert.ok(state.f & 0x01, "Carry flag preserved");
    });
  });

  QUnit.module("DAD without carry", () => {
    QUnit.test("DAD B - no carry", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("H", 0x10);
      cpu.set("L", 0x00);
      cpu.set("B", 0x00);
      cpu.set("C", 0x01);
      cpu.set("F", 0x00); // Clear carry
      mem[0x0000] = 0x09; // DAD B
      cpu.set("PC", 0x0000);
      cpu.steps(11);
      const state = cpu.status();
      assert.equal(state.h, 0x10, "H = 0x10");
      assert.equal(state.l, 0x01, "L = 0x01");
      assert.notOk(state.f & 0x01, "Carry not set");
    });

    QUnit.test("DAD H - no carry", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("H", 0x10);
      cpu.set("L", 0x00);
      mem[0x0000] = 0x29; // DAD H
      cpu.set("PC", 0x0000);
      cpu.steps(11);
      const state = cpu.status();
      assert.equal(state.h, 0x20, "H doubled");
      assert.equal(state.l, 0x00, "L = 0");
      assert.notOk(state.f & 0x01, "Carry not set");
    });

    QUnit.test("DAD D - no carry", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("H", 0x10);
      cpu.set("L", 0x00);
      cpu.set("D", 0x00);
      cpu.set("E", 0x50);
      mem[0x0000] = 0x19; // DAD D
      cpu.set("PC", 0x0000);
      cpu.steps(11);
      const state = cpu.status();
      assert.notOk(state.f & 0x01, "Carry not set");
    });

    QUnit.test("DAD SP - no carry", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("H", 0x10);
      cpu.set("L", 0x00);
      cpu.set("SP", 0x0050);
      mem[0x0000] = 0x39; // DAD SP
      cpu.set("PC", 0x0000);
      cpu.steps(11);
      const state = cpu.status();
      assert.notOk(state.f & 0x01, "Carry not set");
    });
  });

  QUnit.module("Rotate with different carry states", () => {
    QUnit.test("RLC with bit 7 clear", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x55); // 01010101 - bit 7 = 0
      mem[0x0000] = 0x07; // RLC
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      const state = cpu.status();
      assert.equal(state.a, 0xAA, "A rotated left");
      assert.notOk(state.f & 0x01, "Carry clear (bit 7 was 0)");
    });

    QUnit.test("RRC with bit 0 clear", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0xAA); // 10101010 - bit 0 = 0
      mem[0x0000] = 0x0F; // RRC
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      const state = cpu.status();
      assert.equal(state.a, 0x55, "A rotated right");
      assert.notOk(state.f & 0x01, "Carry clear (bit 0 was 0)");
    });

    QUnit.test("RAL with bit 7 clear and carry clear", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x55); // bit 7 = 0
      cpu.set("F", 0x00); // Carry = 0
      mem[0x0000] = 0x17; // RAL
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      const state = cpu.status();
      assert.equal(state.a, 0xAA, "A rotated left");
      assert.notOk(state.f & 0x01, "Carry clear");
    });

    QUnit.test("RAR with bit 0 clear and carry clear", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0xAA); // bit 0 = 0
      cpu.set("F", 0x00); // Carry = 0
      mem[0x0000] = 0x1F; // RAR
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      const state = cpu.status();
      assert.equal(state.a, 0x55, "A rotated right");
      assert.notOk(state.f & 0x01, "Carry clear");
    });
  });

  QUnit.module("Additional INX/DCX edge cases", () => {
    QUnit.test("INX B at 0xFFFF wraps to 0x0000", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("B", 0xFF);
      cpu.set("C", 0xFF);
      mem[0x0000] = 0x03; // INX B
      cpu.set("PC", 0x0000);
      cpu.steps(6);
      const state = cpu.status();
      assert.equal(state.b, 0x00, "B wrapped to 0x00");
      assert.equal(state.c, 0x00, "C wrapped to 0x00");
    });

    QUnit.test("DCX B at 0x0000 wraps to 0xFFFF", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("B", 0x00);
      cpu.set("C", 0x00);
      mem[0x0000] = 0x0B; // DCX B
      cpu.set("PC", 0x0000);
      cpu.steps(6);
      const state = cpu.status();
      assert.equal(state.b, 0xFF, "B wrapped to 0xFF");
      assert.equal(state.c, 0xFF, "C wrapped to 0xFF");
    });
  });

  QUnit.module("CMC toggle carry", () => {
    QUnit.test("CMC when carry is set", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("F", 0x01); // Set carry
      mem[0x0000] = 0x3F; // CMC
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      assert.notOk(cpu.status().f & 0x01, "Carry toggled to 0");
    });

    QUnit.test("CMC when carry is clear", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("F", 0x00); // Clear carry
      mem[0x0000] = 0x3F; // CMC
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      assert.ok(cpu.status().f & 0x01, "Carry toggled to 1");
    });
  });
});
