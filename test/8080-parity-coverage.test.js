/**
 * Intel 8080 Parity Coverage Tests
 *
 * Tests for missing parity flag branches to achieve 97%+ and 90%+ coverage
 */

import QUnit from "qunit";
import create8080 from "../src/8080.js";

QUnit.module("8080 Parity Branch Coverage", () => {
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

  QUnit.module("RPO - Missing branches", () => {
    QUnit.test("RPO - not taken (parity set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      cpu.set("F", 0x04); // Set parity flag
      mem[0x0100] = 0xE0; // RPO
      cpu.set("PC", 0x0100);
      cpu.steps(5);
      assert.equal(cpu.status().pc, 0x0101, "Return not taken");
      assert.equal(cpu.T(), 5, "Takes 5 cycles when not taken");
    });
  });

  QUnit.module("JPO - Missing branches", () => {
    QUnit.test("JPO - not taken (parity set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("F", 0x04); // Set parity flag
      mem[0x0000] = 0xE2; // JPO nn
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x10;
      cpu.set("PC", 0x0000);
      cpu.steps(10);
      assert.equal(cpu.status().pc, 0x0003, "Jump not taken, PC advanced");
    });
  });

  QUnit.module("CPO - Missing branches", () => {
    QUnit.test("CPO - not taken (parity set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      cpu.set("F", 0x04); // Set parity flag
      mem[0x0000] = 0xE4; // CPO nn
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x10;
      cpu.set("PC", 0x0000);
      cpu.steps(11);
      assert.equal(cpu.status().pc, 0x0003, "Call not taken, PC advanced");
      assert.equal(cpu.status().sp, 0xF000, "SP unchanged");
      assert.equal(cpu.T(), 11, "Takes 11 cycles when not taken");
    });
  });

  QUnit.module("Other Missing Conditions", () => {
    QUnit.test("JNZ - taken (zero not set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("F", 0x00); // Zero not set
      mem[0x0000] = 0xC2; // JNZ nn
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x10;
      cpu.set("PC", 0x0000);
      cpu.steps(10);
      assert.equal(cpu.status().pc, 0x1000, "Jump taken");
    });

    QUnit.test("CNZ - taken (zero not set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      cpu.set("F", 0x00); // Zero not set
      mem[0x0000] = 0xC4; // CNZ nn
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x10;
      cpu.set("PC", 0x0000);
      cpu.steps(17);
      assert.equal(cpu.status().pc, 0x1000, "Call taken");
      assert.equal(cpu.status().sp, 0xEFFE, "Return address pushed");
    });

    QUnit.test("CNC - taken (carry not set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      cpu.set("F", 0x00); // Carry not set
      mem[0x0000] = 0xD4; // CNC nn
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x10;
      cpu.set("PC", 0x0000);
      cpu.steps(17);
      assert.equal(cpu.status().pc, 0x1000, "Call taken");
      assert.equal(cpu.status().sp, 0xEFFE, "Return address pushed");
    });

    QUnit.test("JNC - taken (carry not set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("F", 0x00); // Carry not set
      mem[0x0000] = 0xD2; // JNC nn
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x10;
      cpu.set("PC", 0x0000);
      cpu.steps(10);
      assert.equal(cpu.status().pc, 0x1000, "Jump taken");
    });

    QUnit.test("CC - taken (carry set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      cpu.set("F", 0x01); // Set carry
      mem[0x0000] = 0xDC; // CC nn
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x10;
      cpu.set("PC", 0x0000);
      cpu.steps(17);
      assert.equal(cpu.status().pc, 0x1000, "Call taken");
      assert.equal(cpu.status().sp, 0xEFFE, "Return address pushed");
    });

    QUnit.test("CC - not taken (carry not set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      cpu.set("F", 0x00); // Carry not set
      mem[0x0000] = 0xDC; // CC nn
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x10;
      cpu.set("PC", 0x0000);
      cpu.steps(11);
      assert.equal(cpu.status().pc, 0x0003, "Call not taken");
      assert.equal(cpu.status().sp, 0xF000, "SP unchanged");
    });

    QUnit.test("RC - taken (carry set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      cpu.set("F", 0x01); // Set carry
      mem[0xF000] = 0x00;
      mem[0xF001] = 0x20;
      mem[0x0100] = 0xD8; // RC
      cpu.set("PC", 0x0100);
      cpu.steps(11);
      assert.equal(cpu.status().pc, 0x2000, "Return taken");
    });

    QUnit.test("RC - not taken (carry not set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      cpu.set("F", 0x00); // Carry not set
      mem[0x0100] = 0xD8; // RC
      cpu.set("PC", 0x0100);
      cpu.steps(5);
      assert.equal(cpu.status().pc, 0x0101, "Return not taken");
    });

    QUnit.test("RZ - taken (zero set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      cpu.set("F", 0x40); // Set zero
      mem[0xF000] = 0x00;
      mem[0xF001] = 0x20;
      mem[0x0100] = 0xC8; // RZ
      cpu.set("PC", 0x0100);
      cpu.steps(11);
      assert.equal(cpu.status().pc, 0x2000, "Return taken");
    });

    QUnit.test("RZ - not taken (zero not set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      cpu.set("F", 0x00); // Zero not set
      mem[0x0100] = 0xC8; // RZ
      cpu.set("PC", 0x0100);
      cpu.steps(5);
      assert.equal(cpu.status().pc, 0x0101, "Return not taken");
    });
  });

  QUnit.module("Half-carry flag edge cases", () => {
    QUnit.test("ADD with half-carry set", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x0F); // Lower nibble = F
      cpu.set("B", 0x01); // Adding 1 causes half-carry
      mem[0x0000] = 0x80; // ADD B
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      const state = cpu.status();
      assert.equal(state.a, 0x10, "A = 0x0F + 0x01 = 0x10");
      assert.ok(state.f & 0x10, "Half-carry flag set");
    });

    QUnit.test("SUB with half-carry clear", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x10); // 0001 0000
      cpu.set("B", 0x01); // 0000 0001
      mem[0x0000] = 0x90; // SUB B
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      const state = cpu.status();
      assert.equal(state.a, 0x0F, "A = 0x10 - 0x01 = 0x0F");
      // Half-carry clear because lower nibble had no borrow
      assert.notOk(state.f & 0x10, "Half-carry flag clear");
    });
  });

  QUnit.module("Parity flag variations", () => {
    QUnit.test("Result with even parity (parity flag set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x00); // 0 bits = even parity
      mem[0x0000] = 0xB7; // ORA A (touch flags)
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      const state = cpu.status();
      assert.ok(state.f & 0x04, "Parity flag set for even parity");
    });

    QUnit.test("Result with odd parity (parity flag clear)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x01); // 1 bit = odd parity
      mem[0x0000] = 0xB7; // ORA A (touch flags)
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      const state = cpu.status();
      assert.notOk(state.f & 0x04, "Parity flag clear for odd parity");
    });
  });

  QUnit.module("DAD with carry", () => {
    QUnit.test("DAD B with carry set", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("H", 0xFF);
      cpu.set("L", 0xFF);
      cpu.set("B", 0x00);
      cpu.set("C", 0x01);
      mem[0x0000] = 0x09; // DAD B
      cpu.set("PC", 0x0000);
      cpu.steps(11);
      const state = cpu.status();
      assert.equal(state.h, 0x00, "H wrapped to 0x00");
      assert.equal(state.l, 0x00, "L wrapped to 0x00");
      assert.ok(state.f & 0x01, "Carry flag set on 16-bit overflow");
    });

    QUnit.test("DAD H with carry", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("H", 0x80);
      cpu.set("L", 0x00);
      mem[0x0000] = 0x29; // DAD H (double HL)
      cpu.set("PC", 0x0000);
      cpu.steps(11);
      const state = cpu.status();
      assert.equal(state.h, 0x00, "H = 0x00 after doubling 0x8000");
      assert.equal(state.l, 0x00, "L = 0x00");
      assert.ok(state.f & 0x01, "Carry flag set");
    });

    QUnit.test("DAD D with carry", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("H", 0xFF);
      cpu.set("L", 0xFF);
      cpu.set("D", 0x00);
      cpu.set("E", 0x01);
      mem[0x0000] = 0x19; // DAD D
      cpu.set("PC", 0x0000);
      cpu.steps(11);
      const state = cpu.status();
      assert.ok(state.f & 0x01, "Carry flag set");
    });

    QUnit.test("DAD SP with carry", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("H", 0xFF);
      cpu.set("L", 0xFF);
      cpu.set("SP", 0x0001);
      mem[0x0000] = 0x39; // DAD SP
      cpu.set("PC", 0x0000);
      cpu.steps(11);
      const state = cpu.status();
      assert.ok(state.f & 0x01, "Carry flag set");
    });
  });

  QUnit.module("AND with half-carry variations", () => {
    QUnit.test("AND with both operands having bit 3 set", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x08); // Bit 3 set
      cpu.set("B", 0x08); // Bit 3 set
      mem[0x0000] = 0xA0; // ANA B
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      const state = cpu.status();
      assert.ok(state.f & 0x10, "Half-carry set when both have bit 3");
    });

    QUnit.test("AND with one operand having bit 3 set", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x08); // Bit 3 set
      cpu.set("B", 0x00); // Bit 3 not set
      mem[0x0000] = 0xA0; // ANA B
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      const state = cpu.status();
      assert.ok(state.f & 0x10, "Half-carry set when one has bit 3");
    });

    QUnit.test("AND with neither operand having bit 3 set", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x01); // Bit 3 not set
      cpu.set("B", 0x01); // Bit 3 not set
      mem[0x0000] = 0xA0; // ANA B
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      const state = cpu.status();
      assert.notOk(state.f & 0x10, "Half-carry not set when neither has bit 3");
    });
  });
});
