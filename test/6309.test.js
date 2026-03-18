/**
 * Hitachi HD6309 CPU Emulator - Comprehensive Tests
 *
 * Test suite covering HD6309-specific instructions, native mode,
 * new registers, and all extensions over the MC6809 baseline.
 */

import QUnit from "qunit";
import CPU6309 from "../src/6309.js";

QUnit.module("Hitachi HD6309 CPU Emulator", () => {
  /**
   * Helper: Create CPU with test memory
   */
  const createTestCPU = () => {
    const mem = new Uint8Array(65536);

    // Set reset vector to 0x1000
    mem[0xFFFE] = 0x10;
    mem[0xFFFF] = 0x00;

    const cpu = CPU6309({
      byteTo: (addr, val) => { mem[addr] = val & 0xFF; },
      byteAt: (addr) => mem[addr] || 0,
    });

    return { cpu, mem };
  };

  // Tests will be added in subsequent tasks

  QUnit.module("New Registers", () => {
    QUnit.test("E and F registers initialized to 0", (assert) => {
      const { cpu } = createTestCPU();
      const state = cpu.status();
      assert.equal(state.e, 0, "E = 0 after reset");
      assert.equal(state.f, 0, "F = 0 after reset");
    });

    QUnit.test("W register is E:F concatenated", (assert) => {
      const { cpu } = createTestCPU();
      cpu.set("E", 0x12);
      cpu.set("F", 0x34);
      assert.equal(cpu.status().w, 0x1234, "W = E:F");
    });

    QUnit.test("V register initialized to 0 but survives reset", (assert) => {
      const { cpu } = createTestCPU();
      assert.equal(cpu.status().v, 0, "V = 0 initially");
      cpu.set("V", 0xABCD);
      cpu.reset();
      assert.equal(cpu.status().v, 0xABCD, "V survives reset");
    });

    QUnit.test("MD register initialized to 0 on reset", (assert) => {
      const { cpu } = createTestCPU();
      assert.equal(cpu.status().md, 0, "MD = 0 after reset");
    });

    QUnit.test("set() and status() round-trip for E, F, V, MD", (assert) => {
      const { cpu } = createTestCPU();
      cpu.set("E", 0x55);
      cpu.set("F", 0xAA);
      cpu.set("V", 0x1234);
      cpu.set("MD", 1);
      const s = cpu.status();
      assert.equal(s.e, 0x55, "E");
      assert.equal(s.f, 0xAA, "F");
      assert.equal(s.v, 0x1234, "V");
      assert.equal(s.md, 1, "MD");
    });

    QUnit.test("Q register is D:W (32-bit)", (assert) => {
      const { cpu } = createTestCPU();
      cpu.set("A", 0x11);
      cpu.set("B", 0x22);
      cpu.set("E", 0x33);
      cpu.set("F", 0x44);
      assert.equal(cpu.status().q, 0x11223344, "Q = D:W");
    });
  });
});
