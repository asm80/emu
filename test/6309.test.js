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

  QUnit.module("TFR/EXG Extensions", () => {
    QUnit.test("TFR W,D transfers W to D", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("E", 0x12);
      cpu.set("F", 0x34);
      // TFR W,D: opcode $1F, postbyte W->D = 0x60 (src=W(6), dst=D(0))
      mem[0x1000] = 0x1F;
      mem[0x1001] = 0x60;
      cpu.steps(2);
      assert.equal(cpu.status().a, 0x12, "A = E (high byte of W)");
      assert.equal(cpu.status().b, 0x34, "B = F (low byte of W)");
    });

    QUnit.test("TFR D,W transfers D to W", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0xAB);
      cpu.set("B", 0xCD);
      // TFR D,W: postbyte D->W = 0x06 (src=D(0), dst=W(6))
      mem[0x1000] = 0x1F;
      mem[0x1001] = 0x06;
      cpu.steps(2);
      assert.equal(cpu.status().e, 0xAB, "E = A");
      assert.equal(cpu.status().f, 0xCD, "F = B");
    });

    QUnit.test("TFR A,E transfers A to E (8-bit)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x77);
      // TFR A,E: postbyte 0x8E (src=A(8), dst=E(E))
      mem[0x1000] = 0x1F;
      mem[0x1001] = 0x8E;
      cpu.steps(2);
      assert.equal(cpu.status().e, 0x77, "E = A");
    });

    QUnit.test("TFR to zero register discards value (no crash)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x55);
      // TFR A,0 (zero reg): postbyte 0x8C (src=A(8), dst=zero(C))
      mem[0x1000] = 0x1F;
      mem[0x1001] = 0x8C;
      cpu.steps(2);
      assert.ok(true, "TFR to zero register does not crash");
    });

    QUnit.test("TFR from zero register gives 0", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x99);
      // TFR 0,A: postbyte 0xC8 (src=zero(C), dst=A(8))
      mem[0x1000] = 0x1F;
      mem[0x1001] = 0xC8;
      cpu.steps(2);
      assert.equal(cpu.status().a, 0, "A = 0 (from zero register)");
    });

    QUnit.test("EXG E,F exchanges E and F", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("E", 0x11);
      cpu.set("F", 0x22);
      // EXG E,F: opcode $1E, postbyte 0xEF (src=E(E), dst=F(F))
      mem[0x1000] = 0x1E;
      mem[0x1001] = 0xEF;
      cpu.steps(2);
      assert.equal(cpu.status().e, 0x22, "E = old F");
      assert.equal(cpu.status().f, 0x11, "F = old E");
    });

    QUnit.test("TFR E,F transfers E to F (8-bit to 8-bit)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("E", 0x42);
      cpu.set("F", 0x00);
      // TFR E,F: postbyte 0xEF (src=E(E), dst=F(F))
      mem[0x1000] = 0x1F;
      mem[0x1001] = 0xEF;
      cpu.steps(2);
      assert.equal(cpu.status().f, 0x42, "F = E");
    });
  });

  QUnit.module("Native Mode Timing", () => {
    QUnit.test("MD bit 0 = 0 means emulation mode by default", (assert) => {
      const { cpu } = createTestCPU();
      assert.equal(cpu.status().md & 1, 0, "emulation mode by default");
    });

    QUnit.test("NOP takes 2 cycles emulation, 1 cycle native", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x12; // NOP

      const t0 = cpu.T();
      cpu.singleStep();
      const emulCycles = cpu.T() - t0;
      assert.equal(emulCycles, 2, "NOP = 2 cycles in emulation mode");

      // Switch to native mode
      cpu.set("MD", 1);
      cpu.set("PC", 0x1000);
      const t1 = cpu.T();
      cpu.singleStep();
      const nativeCycles = cpu.T() - t1;
      assert.equal(nativeCycles, 1, "NOP = 1 cycle in native mode");
    });

    QUnit.test("NEG direct takes 6 cycles emulation, 5 native", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x00; // NEG direct
      mem[0x1001] = 0x50; // operand at $0050
      mem[0x0050] = 0x01;
      cpu.set("DP", 0x00);

      const t0 = cpu.T();
      cpu.singleStep();
      assert.equal(cpu.T() - t0, 6, "NEG direct = 6 cycles emulation");

      // Reset and try native
      cpu.set("MD", 1);
      mem[0x1000] = 0x00;
      mem[0x1001] = 0x50;
      mem[0x0050] = 0x01;
      cpu.set("PC", 0x1000);
      cpu.set("DP", 0x00);
      const t1 = cpu.T();
      cpu.singleStep();
      assert.equal(cpu.T() - t1, 5, "NEG direct = 5 cycles native");
    });
  });
});
