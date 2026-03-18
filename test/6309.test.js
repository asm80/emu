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

  QUnit.module("Native Mode Interrupt Stack", () => {
    QUnit.test("IRQ in emulation mode pushes 12 bytes", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0xFFF8] = 0x20;
      mem[0xFFF9] = 0x00;
      cpu.set("SP", 0x0200);

      const sBefore = cpu.status().sp;
      cpu.interrupt();
      const sAfter = cpu.status().sp;

      assert.equal(sBefore - sAfter, 12, "emulation mode pushes 12 bytes");
    });

    QUnit.test("IRQ in native mode pushes 14 bytes (E and F added)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("MD", 1);
      mem[0xFFF8] = 0x20;
      mem[0xFFF9] = 0x00;
      cpu.set("SP", 0x0200);

      const sBefore = cpu.status().sp;
      cpu.interrupt();
      const sAfter = cpu.status().sp;

      assert.equal(sBefore - sAfter, 14, "native mode pushes 14 bytes");
    });

    QUnit.test("Native IRQ stack layout: E and F between B and DP", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("MD", 1);
      cpu.set("A", 0x11);
      cpu.set("B", 0x22);
      cpu.set("E", 0x33);
      cpu.set("F", 0x44);
      cpu.set("DP", 0x55);
      cpu.set("SP", 0x0200);
      mem[0xFFF8] = 0x20;
      mem[0xFFF9] = 0x00;

      cpu.interrupt();

      const s = cpu.status().sp;
      // Push order (last pushed = lowest addr): PClo,PChi,Ulo,Uhi,Ylo,Yhi,Xlo,Xhi,DP,F,E,B,A,CC
      // S points to CC (last pushed). Layout from S:
      // mem[s]=CC, mem[s+1]=A, mem[s+2]=B, mem[s+3]=E, mem[s+4]=F, mem[s+5]=DP
      assert.equal(mem[s + 1], 0x11, "A on stack at s+1");
      assert.equal(mem[s + 2], 0x22, "B on stack at s+2");
      assert.equal(mem[s + 3], 0x33, "E on stack at s+3 (between B and DP)");
      assert.equal(mem[s + 4], 0x44, "F on stack at s+4");
      assert.equal(mem[s + 5], 0x55, "DP on stack at s+5");
    });

    QUnit.test("RTI in native mode restores E and F", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("MD", 1);
      cpu.set("SP", 0x0200);
      mem[0xFFF8] = 0x20;
      mem[0xFFF9] = 0x00;

      // Push known values via interrupt
      cpu.set("E", 0xAB);
      cpu.set("F", 0xCD);
      cpu.interrupt();

      // Clobber E and F
      cpu.set("E", 0x00);
      cpu.set("F", 0x00);

      // RTI at IRQ handler address
      mem[0x2000] = 0x3B; // RTI
      cpu.singleStep();

      assert.equal(cpu.status().e, 0xAB, "E restored by RTI");
      assert.equal(cpu.status().f, 0xCD, "F restored by RTI");
    });
  });

  QUnit.module("Page 0 New Instructions", () => {
    QUnit.test("OIM direct: OR immediate to memory", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x0050] = 0x0F;
      cpu.set("DP", 0x00);

      mem[0x1000] = 0x01; // OIM direct
      mem[0x1001] = 0xF0; // immediate
      mem[0x1002] = 0x50; // direct page offset

      cpu.singleStep();
      assert.equal(mem[0x0050], 0xFF, "OIM: 0x0F | 0xF0 = 0xFF");
    });

    QUnit.test("AIM direct: AND immediate to memory", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x0050] = 0xFF;
      cpu.set("DP", 0x00);

      mem[0x1000] = 0x02; // AIM direct
      mem[0x1001] = 0x0F; // immediate
      mem[0x1002] = 0x50;

      cpu.singleStep();
      assert.equal(mem[0x0050], 0x0F, "AIM: 0xFF & 0x0F = 0x0F");
    });

    QUnit.test("EIM direct: EOR immediate to memory", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x0050] = 0xAA;
      cpu.set("DP", 0x00);

      mem[0x1000] = 0x05; // EIM direct
      mem[0x1001] = 0xFF; // immediate
      mem[0x1002] = 0x50;

      cpu.singleStep();
      assert.equal(mem[0x0050], 0x55, "EIM: 0xAA ^ 0xFF = 0x55");
    });

    QUnit.test("TIM direct: test immediate, no write", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x0050] = 0xAA;
      cpu.set("DP", 0x00);

      mem[0x1000] = 0x0B; // TIM direct
      mem[0x1001] = 0x55; // immediate
      mem[0x1002] = 0x50;

      cpu.singleStep();
      assert.equal(mem[0x0050], 0xAA, "TIM does not write memory");
      // 0xAA & 0x55 = 0x00, so Z should be set
      assert.ok(cpu.status().flags & 4, "Z flag set (result is zero)");
    });

    QUnit.test("OIM sets N flag when result has bit 7 set", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x0050] = 0x00;
      cpu.set("DP", 0x00);

      mem[0x1000] = 0x01; // OIM direct
      mem[0x1001] = 0x80;
      mem[0x1002] = 0x50;

      cpu.singleStep();
      assert.ok(cpu.status().flags & 8, "N flag set");
    });
  });

  QUnit.module("SEXW and LDQ", () => {
    QUnit.test("SEXW: sign extends W into D (W negative)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("E", 0x80); // W = 0x8000 (negative)
      cpu.set("F", 0x00);

      mem[0x1000] = 0x14; // SEXW
      cpu.singleStep();

      assert.equal(cpu.status().a, 0xFF, "A = 0xFF (sign extension)");
      assert.equal(cpu.status().b, 0xFF, "B = 0xFF (sign extension)");
      assert.equal(cpu.status().e, 0x80, "W unchanged");
    });

    QUnit.test("SEXW: sign extends W into D (W positive)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("E", 0x7F);
      cpu.set("F", 0xFF);

      mem[0x1000] = 0x14; // SEXW
      cpu.singleStep();

      assert.equal(cpu.status().a, 0x00, "A = 0x00");
      assert.equal(cpu.status().b, 0x00, "B = 0x00");
    });

    QUnit.test("LDQ immediate: loads 4 bytes into Q", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xCD; // LDQ imm
      mem[0x1001] = 0x11;
      mem[0x1002] = 0x22;
      mem[0x1003] = 0x33;
      mem[0x1004] = 0x44;

      cpu.singleStep();

      assert.equal(cpu.status().a, 0x11, "A = 0x11");
      assert.equal(cpu.status().b, 0x22, "B = 0x22");
      assert.equal(cpu.status().e, 0x33, "E = 0x33");
      assert.equal(cpu.status().f, 0x44, "F = 0x44");
    });
  });

  QUnit.module("Page $10 Instructions", () => {
    QUnit.module("Inter-Register Operations", () => {
      QUnit.test("ADDR D,X: X = X + D", (assert) => {
        const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x00);
        cpu.set("B", 0x10); // D = 0x0010
        cpu.set("X", 0x0100);

        mem[0x1000] = 0x10;
        mem[0x1001] = 0x30;
        mem[0x1002] = 0x01; // src=D(0), dst=X(1)

        cpu.singleStep();
        assert.equal(cpu.status().x, 0x0110, "X = X + D");
      });

      QUnit.test("SUBR A,B: B = B - A", (assert) => {
        const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x03);
        cpu.set("B", 0x10);

        mem[0x1000] = 0x10;
        mem[0x1001] = 0x32;
        mem[0x1002] = 0x89; // src=A(8), dst=B(9)

        cpu.singleStep();
        assert.equal(cpu.status().b, 0x0D, "B = B - A = 0x0D");
      });

      QUnit.test("CMPR D,X: sets flags for X - D, no store", (assert) => {
        const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x01);
        cpu.set("B", 0x00); // D = 0x0100
        cpu.set("X", 0x0100);

        mem[0x1000] = 0x10;
        mem[0x1001] = 0x37;
        mem[0x1002] = 0x01; // src=D(0), dst=X(1)

        cpu.singleStep();
        assert.ok(cpu.status().flags & 4, "Z set (X == D)");
        assert.equal(cpu.status().x, 0x0100, "X unchanged");
      });
    });

    QUnit.module("Stack W", () => {
      QUnit.test("PSHSW pushes W (E,F) onto S stack", (assert) => {
        const { cpu, mem } = createTestCPU();
        cpu.set("E", 0xAB);
        cpu.set("F", 0xCD);
        cpu.set("SP", 0x0200);

        mem[0x1000] = 0x10;
        mem[0x1001] = 0x38; // PSHSW

        cpu.singleStep();

        assert.equal(cpu.status().sp, 0x01FE, "S decremented by 2");
        assert.equal(mem[0x01FE], 0xAB, "E at top of stack");
        assert.equal(mem[0x01FF], 0xCD, "F below E");
      });

      QUnit.test("PULSW restores W from S stack", (assert) => {
        const { cpu, mem } = createTestCPU();
        cpu.set("SP", 0x01FE);
        mem[0x01FE] = 0x12;
        mem[0x01FF] = 0x34;

        mem[0x1000] = 0x10;
        mem[0x1001] = 0x39; // PULSW

        cpu.singleStep();

        assert.equal(cpu.status().e, 0x12, "E restored");
        assert.equal(cpu.status().f, 0x34, "F restored");
        assert.equal(cpu.status().sp, 0x0200, "S incremented by 2");
      });
    });
  });

  QUnit.module("D/W Register Unary Ops ($10 prefix)", () => {
    QUnit.test("NEGD: D = -D", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x00);
      cpu.set("B", 0x05); // D = 5

      mem[0x1000] = 0x10;
      mem[0x1001] = 0x40; // NEGD

      cpu.singleStep();

      assert.equal(cpu.status().a, 0xFF, "A = 0xFF");
      assert.equal(cpu.status().b, 0xFB, "B = 0xFB (D = -5 = 0xFFFB)");
    });

    QUnit.test("CLRD: D = 0, Z flag set", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0xFF);
      cpu.set("B", 0xFF);

      mem[0x1000] = 0x10;
      mem[0x1001] = 0x4F; // CLRD

      cpu.singleStep();

      assert.equal(cpu.status().a, 0, "A = 0");
      assert.equal(cpu.status().b, 0, "B = 0");
      assert.ok(cpu.status().flags & 4, "Z flag set");
    });

    QUnit.test("INCW: W = W + 1", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("E", 0x00);
      cpu.set("F", 0xFF); // W = 0x00FF

      mem[0x1000] = 0x10;
      mem[0x1001] = 0x5C; // INCW

      cpu.singleStep();

      assert.equal(cpu.status().w, 0x0100, "W = 0x0100");
    });
  });

  QUnit.module("W Arithmetic and LDQ/STQ ($10 prefix)", () => {
    QUnit.test("LDW immediate: W = operand", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x10;
      mem[0x1001] = 0x86; // LDW imm
      mem[0x1002] = 0xAB;
      mem[0x1003] = 0xCD;

      cpu.singleStep();
      assert.equal(cpu.status().e, 0xAB, "E = 0xAB");
      assert.equal(cpu.status().f, 0xCD, "F = 0xCD");
    });

    QUnit.test("STW direct: stores W to memory", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("E", 0x12);
      cpu.set("F", 0x34);
      cpu.set("DP", 0x00);

      mem[0x1000] = 0x10;
      mem[0x1001] = 0x97; // STW direct
      mem[0x1002] = 0x50;

      cpu.singleStep();
      assert.equal(mem[0x0050], 0x12, "high byte stored");
      assert.equal(mem[0x0051], 0x34, "low byte stored");
    });

    QUnit.test("LDQ direct: loads 4 bytes into Q", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("DP", 0x00);
      mem[0x0050] = 0x11;
      mem[0x0051] = 0x22;
      mem[0x0052] = 0x33;
      mem[0x0053] = 0x44;

      mem[0x1000] = 0x10;
      mem[0x1001] = 0xDC; // LDQ direct
      mem[0x1002] = 0x50;

      cpu.singleStep();
      assert.equal(cpu.status().a, 0x11);
      assert.equal(cpu.status().b, 0x22);
      assert.equal(cpu.status().e, 0x33);
      assert.equal(cpu.status().f, 0x44);
    });

    QUnit.test("STQ direct: stores Q to 4 bytes", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0xAA); cpu.set("B", 0xBB);
      cpu.set("E", 0xCC); cpu.set("F", 0xDD);
      cpu.set("DP", 0x00);

      mem[0x1000] = 0x10;
      mem[0x1001] = 0xDD; // STQ direct
      mem[0x1002] = 0x60;

      cpu.singleStep();
      assert.equal(mem[0x0060], 0xAA);
      assert.equal(mem[0x0061], 0xBB);
      assert.equal(mem[0x0062], 0xCC);
      assert.equal(mem[0x0063], 0xDD);
    });
  });

  QUnit.module("Trap System", () => {
    QUnit.test("Illegal opcode triggers trap via $FFF0 vector", (assert) => {
      const { cpu, mem } = createTestCPU();

      // Set trap vector
      mem[0xFFF0] = 0x30;
      mem[0xFFF1] = 0x00;

      // Place an undefined opcode at PC ($87 is illegal on both 6809 and 6309)
      mem[0x1000] = 0x87;

      cpu.singleStep();

      assert.equal(cpu.status().pc, 0x3000, "PC jumped to trap vector");
      assert.ok(cpu.status().md & 0x40, "MD bit 6 set (illegal op)");
    });

    QUnit.test("Trap pushes registers on S stack", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0xFFF0] = 0x30;
      mem[0xFFF1] = 0x00;
      cpu.set("SP", 0x0200);

      const sBefore = cpu.status().sp;
      mem[0x1000] = 0x87; // illegal opcode
      cpu.singleStep();

      const sAfter = cpu.status().sp;
      assert.ok(sBefore > sAfter, "S stack decreased (registers pushed)");
    });
  });
});
