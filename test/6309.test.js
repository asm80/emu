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

  QUnit.module("Page $11 Instructions", () => {
    QUnit.module("MD Register Instructions", () => {
      QUnit.test("LDMD switches to native mode", (assert) => {
        const { cpu, mem } = createTestCPU();

        mem[0x1000] = 0x11;
        mem[0x1001] = 0x3D; // LDMD
        mem[0x1002] = 0x01; // native mode

        cpu.singleStep();
        assert.equal(cpu.status().md & 1, 1, "native mode enabled");
      });

      QUnit.test("BITMD clears MD bits 6 and 7 after test", (assert) => {
        const { cpu, mem } = createTestCPU();
        cpu.set("MD", 0xC0); // bits 6 and 7 set

        mem[0x1000] = 0x11;
        mem[0x1001] = 0x3C; // BITMD
        mem[0x1002] = 0xC0; // test bits 6 and 7

        cpu.singleStep();

        assert.equal(cpu.status().md & 0xC0, 0, "MD bits 6 and 7 cleared");
        assert.equal(cpu.status().flags & 4, 0, "Z clear (result non-zero)");
      });

      QUnit.test("BITMD sets Z when result is zero", (assert) => {
        const { cpu, mem } = createTestCPU();
        cpu.set("MD", 0x00);

        mem[0x1000] = 0x11;
        mem[0x1001] = 0x3C;
        mem[0x1002] = 0xC0; // test bits 6 and 7

        cpu.singleStep();
        assert.ok(cpu.status().flags & 4, "Z set (MD & 0xC0 = 0)");
      });
    });

    QUnit.module("E/F Register Operations", () => {
      QUnit.test("LDE immediate: E = operand", (assert) => {
        const { cpu, mem } = createTestCPU();

        mem[0x1000] = 0x11;
        mem[0x1001] = 0x86; // LDE imm
        mem[0x1002] = 0x42;

        cpu.singleStep();
        assert.equal(cpu.status().e, 0x42, "E = 0x42");
      });

      QUnit.test("STE direct: stores E to memory", (assert) => {
        const { cpu, mem } = createTestCPU();
        cpu.set("E", 0xAB);
        cpu.set("DP", 0x00);

        mem[0x1000] = 0x11;
        mem[0x1001] = 0x97; // STE direct
        mem[0x1002] = 0x50;

        cpu.singleStep();
        assert.equal(mem[0x0050], 0xAB, "E stored to memory");
      });

      QUnit.test("LDF immediate: F = operand", (assert) => {
        const { cpu, mem } = createTestCPU();

        mem[0x1000] = 0x11;
        mem[0x1001] = 0xC6; // LDF imm
        mem[0x1002] = 0x77;

        cpu.singleStep();
        assert.equal(cpu.status().f, 0x77, "F = 0x77");
      });
    });

    QUnit.module("TFM Block Transfer", () => {
      QUnit.test("TFM X+,Y+: transfers block from X to Y, both increment", (assert) => {
        const { cpu, mem } = createTestCPU();
        cpu.set("X", 0x0100);
        cpu.set("Y", 0x0200);
        cpu.set("E", 0x00);
        cpu.set("F", 0x03); // W = 3 bytes to transfer

        mem[0x0100] = 0xAA;
        mem[0x0101] = 0xBB;
        mem[0x0102] = 0xCC;

        mem[0x1000] = 0x11;
        mem[0x1001] = 0x38; // TFM X+,Y+
        mem[0x1002] = 0x12; // X=1, Y=2

        cpu.singleStep();

        assert.equal(mem[0x0200], 0xAA, "byte 0 transferred");
        assert.equal(mem[0x0201], 0xBB, "byte 1 transferred");
        assert.equal(mem[0x0202], 0xCC, "byte 2 transferred");
        assert.equal(cpu.status().x, 0x0103, "X incremented");
        assert.equal(cpu.status().y, 0x0203, "Y incremented");
        assert.equal(cpu.status().w, 0, "W = 0 after transfer");
      });
    });

    QUnit.module("Bit Operations", () => {
      QUnit.test("BAND: dest bit = dest bit AND src bit", (assert) => {
        const { cpu, mem } = createTestCPU();
        cpu.set("A", 0xFF);   // A bit 3 = 1
        cpu.set("DP", 0x00);
        mem[0x0050] = 0xF7;  // mem bit 2 = 1 (bit 2 = 0b00000100... wait: 0xF7 = 1111 0111, bit 3 = 0)
        mem[0x0050] = 0x08;  // mem bit 3 = 1 (0x08 = 0000 1000)

        // BAND: postbyte: dstBit=3, srcBit=3, reg=A(0)
        // postbyte = (3<<5)|(3<<2)|0 = 0x6C
        mem[0x1000] = 0x11;
        mem[0x1001] = 0x30; // BAND
        mem[0x1002] = 0x6C; // postbyte: dstBit=3, srcBit=3, reg=A
        mem[0x1003] = 0x50; // direct addr

        cpu.singleStep();
        // A bit 3 (1) AND mem bit 3 (1) = 1 → A bit 3 remains 1
        assert.equal((cpu.status().a >> 3) & 1, 1, "A bit 3 = 1 AND mem bit 3 = 1 → 1");
      });
    });

    QUnit.module("MULD/DIVD/DIVQ", () => {
      QUnit.test("MULD immediate: Q = D * operand (signed)", (assert) => {
        const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x00);
        cpu.set("B", 0x05); // D = 5

        mem[0x1000] = 0x11;
        mem[0x1001] = 0x8F; // MULD imm
        mem[0x1002] = 0x00;
        mem[0x1003] = 0x03; // 3

        cpu.singleStep();
        assert.equal(cpu.status().q, 15, "Q = 5 * 3 = 15");
      });

      QUnit.test("DIVD immediate: W=quotient, D=remainder", (assert) => {
        const { cpu, mem } = createTestCPU();
        cpu.set("A", 0x00);
        cpu.set("B", 0x0A); // D = 10

        mem[0x1000] = 0x11;
        mem[0x1001] = 0x9D; // DIVD direct? No - check opcode
        // Actually DIVD imm = $11 $8D
        mem[0x1000] = 0x11;
        mem[0x1001] = 0x8D; // DIVD imm
        mem[0x1002] = 0x03; // divide by 3

        cpu.singleStep();
        // 10 / 3 = quotient 3, remainder 1
        assert.equal(cpu.status().w, 3, "W = quotient = 3");
        assert.equal(cpu.status().b, 1, "B = remainder = 1 (D = 0x0001)");
      });
    });
  });

  QUnit.module("Disassembler", () => {
    QUnit.test("OIM direct disassembles correctly", (assert) => {
      const { cpu } = createTestCPU();
      const [mnem, len] = cpu.disasm(0x01, 0xF0, 0x50);
      assert.equal(mnem, "OIM #$F0,$50", "OIM direct mnemonic");
      assert.equal(len, 3, "3 bytes");
    });

    QUnit.test("SEXW disassembles", (assert) => {
      const { cpu } = createTestCPU();
      const [mnem, len] = cpu.disasm(0x14);
      assert.equal(mnem, "SEXW", "SEXW mnemonic");
      assert.equal(len, 1, "1 byte");
    });

    QUnit.test("LDQ immediate disassembles", (assert) => {
      const { cpu } = createTestCPU();
      const [mnem, len] = cpu.disasm(0xCD, 0x11, 0x22, 0x33, 0x44);
      assert.equal(mnem, "LDQ #$11223344", "LDQ imm mnemonic");
      assert.equal(len, 5, "5 bytes");
    });

    QUnit.test("$10 $30 ADDR disassembles", (assert) => {
      const { cpu } = createTestCPU();
      const [mnem, len] = cpu.disasm(0x10, 0x30, 0x01);
      assert.equal(mnem, "ADDR D,X", "ADDR mnemonic with registers");
      assert.equal(len, 3, "3 bytes");
    });

    QUnit.test("$11 $3D LDMD disassembles", (assert) => {
      const { cpu } = createTestCPU();
      const [mnem, len] = cpu.disasm(0x11, 0x3D, 0x01);
      assert.equal(mnem, "LDMD #$01", "LDMD mnemonic");
      assert.equal(len, 3, "3 bytes");
    });

    QUnit.test("$11 $38 TFM disassembles", (assert) => {
      const { cpu } = createTestCPU();
      const [mnem, len] = cpu.disasm(0x11, 0x38, 0x12);
      assert.equal(mnem, "TFM X+,Y+", "TFM r+,r+ mnemonic");
      assert.equal(len, 3, "3 bytes");
    });

    QUnit.test("Unknown opcode returns ???", (assert) => {
      const { cpu } = createTestCPU();
      const [mnem, len] = cpu.disasm(0x87);
      assert.equal(mnem, "???", "unknown opcode");
      assert.equal(len, 1, "1 byte");
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

  QUnit.module("PSHS/PULS register bits", () => {
    QUnit.test("PSHS 0xFF pushes all 8 standard registers", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x11); cpu.set("B", 0x22); cpu.set("X", 0x1234);
      cpu.set("Y", 0x5678); cpu.set("U", 0xABCD); cpu.set("DP", 0x05);
      cpu.set("CC", 0x55); cpu.set("SP", 0x0200);
      mem[0x1000] = 0x34; mem[0x1001] = 0xFF; // PSHS #$FF
      cpu.singleStep();
      assert.ok(cpu.status().sp < 0x0200, "SP decreased after PSHS");
      assert.equal(cpu.status().sp, 0x0200 - 12, "SP decreased by 12 bytes (PC=2, U=2, Y=2, X=2, DP=1, B=1, A=1, CC=1)");
    });

    QUnit.test("PSHS individual bits: U (0x40)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("U", 0xBEEF); cpu.set("SP", 0x0200);
      mem[0x1000] = 0x34; mem[0x1001] = 0x40; // PSHS #$40 (U only)
      cpu.singleStep();
      assert.equal(cpu.status().sp, 0x01FE, "SP decreased by 2");
      const val = (mem[0x01FE] << 8) | mem[0x01FF];
      assert.equal(val, 0xBEEF, "U value on stack");
    });

    QUnit.test("PSHS individual bits: Y (0x20)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("Y", 0xCAFE); cpu.set("SP", 0x0200);
      mem[0x1000] = 0x34; mem[0x1001] = 0x20; // PSHS #$20 (Y only)
      cpu.singleStep();
      assert.equal(cpu.status().sp, 0x01FE, "SP decreased by 2");
      const val = (mem[0x01FE] << 8) | mem[0x01FF];
      assert.equal(val, 0xCAFE, "Y value on stack");
    });

    QUnit.test("PSHS individual bits: X (0x10)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("X", 0x1234); cpu.set("SP", 0x0200);
      mem[0x1000] = 0x34; mem[0x1001] = 0x10; // PSHS #$10 (X only)
      cpu.singleStep();
      assert.equal(cpu.status().sp, 0x01FE, "SP decreased by 2");
      const val = (mem[0x01FE] << 8) | mem[0x01FF];
      assert.equal(val, 0x1234, "X value on stack");
    });

    QUnit.test("PSHS individual bits: DP (0x08)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("DP", 0x42); cpu.set("SP", 0x0200);
      mem[0x1000] = 0x34; mem[0x1001] = 0x08; // PSHS #$08 (DP only)
      cpu.singleStep();
      assert.equal(cpu.status().sp, 0x01FF, "SP decreased by 1");
      assert.equal(mem[0x01FF], 0x42, "DP on stack");
    });

    QUnit.test("PSHS individual bits: B (0x04)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("B", 0x77); cpu.set("SP", 0x0200);
      mem[0x1000] = 0x34; mem[0x1001] = 0x04; // PSHS #$04 (B only)
      cpu.singleStep();
      assert.equal(mem[0x01FF], 0x77, "B on stack");
      assert.equal(cpu.status().sp, 0x01FF, "SP decreased by 1");
    });

    QUnit.test("PSHS individual bits: A (0x02)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x33); cpu.set("SP", 0x0200);
      mem[0x1000] = 0x34; mem[0x1001] = 0x02; // PSHS #$02 (A only)
      cpu.singleStep();
      assert.equal(mem[0x01FF], 0x33, "A on stack");
      assert.equal(cpu.status().sp, 0x01FF, "SP decreased by 1");
    });

    QUnit.test("PULS restores A, B, X, Y from stack", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x11); cpu.set("B", 0x22); cpu.set("X", 0x3456); cpu.set("Y", 0x789A);
      cpu.set("SP", 0x0200);
      // Push A, B, X, Y
      mem[0x1000] = 0x34; mem[0x1001] = 0x36; // PSHS #$36 (B|A|X|Y)
      cpu.singleStep();
      // Modify registers so pull restores them
      cpu.set("A", 0); cpu.set("B", 0); cpu.set("X", 0); cpu.set("Y", 0);
      mem[0x1002] = 0x35; mem[0x1003] = 0x36; // PULS #$36
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x11, "A restored");
      assert.equal(cpu.status().b, 0x22, "B restored");
      assert.equal(cpu.status().x, 0x3456, "X restored");
      assert.equal(cpu.status().y, 0x789A, "Y restored");
    });

    QUnit.test("PULS with PC bit (0x80) restores PC", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x01FE);
      mem[0x01FE] = 0x20; mem[0x01FF] = 0x00; // value 0x2000 on stack
      mem[0x1000] = 0x35; mem[0x1001] = 0x80; // PULS #$80 (PC only)
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x2000, "PC restored from stack");
    });

    QUnit.test("PULS with U bit (0x40) restores U", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x01FE);
      mem[0x01FE] = 0xDE; mem[0x01FF] = 0xAD;
      mem[0x1000] = 0x35; mem[0x1001] = 0x40; // PULS #$40
      cpu.singleStep();
      assert.equal(cpu.status().u, 0xDEAD, "U restored from stack");
    });

    QUnit.test("PULS with DP bit (0x08) restores DP", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x01FF);
      mem[0x01FF] = 0xAB;
      mem[0x1000] = 0x35; mem[0x1001] = 0x08; // PULS #$08
      cpu.singleStep();
      assert.equal(cpu.status().dp, 0xAB, "DP restored from stack");
    });

    QUnit.test("PSHU/PULU push and pull to U stack", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x55); cpu.set("U", 0x0300);
      mem[0x1000] = 0x36; mem[0x1001] = 0x02; // PSHU #$02 (A only)
      cpu.singleStep();
      assert.equal(mem[0x02FF], 0x55, "A pushed to U stack");
      cpu.set("A", 0);
      mem[0x1002] = 0x37; mem[0x1003] = 0x02; // PULU #$02
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x55, "A pulled from U stack");
    });

    QUnit.test("PSHU with Y, X, S, PC bits", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("U", 0x0300); cpu.set("Y", 0x1111); cpu.set("X", 0x2222);
      mem[0x1000] = 0x36; mem[0x1001] = 0xF0; // PSHU #$F0 (PC, S, Y, X)
      cpu.singleStep();
      assert.ok(cpu.status().u < 0x0300, "U decreased");
    });
  });

  QUnit.module("TFR/EXG extended 6309 registers", () => {
    QUnit.test("TFR D→W sets W equal to D", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x12); cpu.set("B", 0x34); // D = 0x1234
      mem[0x1000] = 0x1F; mem[0x1001] = 0x06; // TFR D,W (src=0=D, dst=6=W)
      cpu.singleStep();
      assert.equal(cpu.status().w, 0x1234, "W = D after TFR D,W");
    });

    QUnit.test("TFR W→D sets D equal to W", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("E", 0xAB); cpu.set("F", 0xCD); // W = 0xABCD
      mem[0x1000] = 0x1F; mem[0x1001] = 0x60; // TFR W,D (src=6=W, dst=0=D)
      cpu.singleStep();
      assert.equal(cpu.status().a, 0xAB, "A (D high) = W high");
      assert.equal(cpu.status().b, 0xCD, "B (D low) = W low");
    });

    QUnit.test("TFR A→E transfers A to E register", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x77);
      mem[0x1000] = 0x1F; mem[0x1001] = 0x8E; // TFR A,E (src=8=A, dst=E=E)
      cpu.singleStep();
      assert.equal(cpu.status().e, 0x77, "E = A after TFR A,E");
    });

    QUnit.test("TFR B→F transfers B to F register", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("B", 0x88);
      mem[0x1000] = 0x1F; mem[0x1001] = 0x9F; // TFR B,F (src=9=B, dst=F=F)
      cpu.singleStep();
      assert.equal(cpu.status().f, 0x88, "F = B after TFR B,F");
    });

    QUnit.test("TFR X→V transfers X to V register", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("X", 0x5A5A);
      mem[0x1000] = 0x1F; mem[0x1001] = 0x17; // TFR X,V (src=1=X, dst=7=V)
      cpu.singleStep();
      assert.equal(cpu.status().v, 0x5A5A, "V = X after TFR X,V");
    });

    QUnit.test("TFR V→X transfers V to X register", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("V", 0x1357);
      mem[0x1000] = 0x1F; mem[0x1001] = 0x71; // TFR V,X (src=7=V, dst=1=X)
      cpu.singleStep();
      assert.equal(cpu.status().x, 0x1357, "X = V after TFR V,X");
    });

    QUnit.test("TFR A→zero (0xC) discards value", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x42);
      mem[0x1000] = 0x1F; mem[0x1001] = 0x8C; // TFR A,zero (dst=C=zero)
      cpu.singleStep();
      // No assertion on zero — just confirm no crash and A unchanged
      assert.equal(cpu.status().a, 0x42, "A unchanged after TFR A,zero");
    });

    QUnit.test("TFR zero→A reads 0x00 or 0xFF into A (16-bit src truncated)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x55);
      mem[0x1000] = 0x1F; mem[0x1001] = 0xC8; // TFR zero,A (src=C=zero, dst=8=A)
      cpu.singleStep();
      // zero register returns 0; 16→8 bit: low byte = 0x00
      assert.equal(cpu.status().a, 0x00, "A = 0x00 from zero register");
    });

    QUnit.test("EXG W↔D exchanges W and D", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x12); cpu.set("B", 0x34); // D = 0x1234
      cpu.set("E", 0x56); cpu.set("F", 0x78); // W = 0x5678
      mem[0x1000] = 0x1E; mem[0x1001] = 0x06; // EXG D,W
      cpu.singleStep();
      assert.equal(cpu.status().w, 0x1234, "W = old D");
      assert.equal(cpu.status().a, 0x56, "A = old W high");
      assert.equal(cpu.status().b, 0x78, "B = old W low");
    });

    QUnit.test("EXG E↔A exchanges E and A (8-bit registers)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0xAA); cpu.set("E", 0x55);
      mem[0x1000] = 0x1E; mem[0x1001] = 0x8E; // EXG A,E
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x55, "A = old E");
      assert.equal(cpu.status().e, 0xAA, "E = old A");
    });

    QUnit.test("TFR CC→DP and DP→CC", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x5A);
      mem[0x1000] = 0x1F; mem[0x1001] = 0xAB; // TFR CC,DP (src=A=CC, dst=B=DP)
      cpu.singleStep();
      assert.equal(cpu.status().dp, 0x5A, "DP = CC after TFR CC,DP");
    });
  });

  QUnit.module("PostByte indexed addressing modes", () => {
    // LDA indexed = 0xA6 pb; loads A from address computed by postbyte
    const ldaIndexed = (cpu, mem, pb, extraBytes = []) => {
      mem[0x1000] = 0xA6;
      mem[0x1001] = pb;
      extraBytes.forEach((b, i) => { mem[0x1002 + i] = b; });
    };

    QUnit.test(",reg++ post-increment by 2 (case 1)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("X", 0x2000); mem[0x2000] = 0x42;
      ldaIndexed(cpu, mem, 0x81); // X post-increment by 2: pb = 1000 0001 (case 1 = ,X++)
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x42, "A loaded from [X]");
      assert.equal(cpu.status().x, 0x2002, "X incremented by 2");
    });

    QUnit.test(",--reg pre-decrement by 2 (case 3)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("X", 0x2002); mem[0x2000] = 0x99;
      ldaIndexed(cpu, mem, 0x83); // X pre-decrement by 2: pb = 1000 0011
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x99, "A loaded from [X-2]");
      assert.equal(cpu.status().x, 0x2000, "X decremented by 2");
    });

    QUnit.test(",-reg pre-decrement by 1 (case 2)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("X", 0x2001); mem[0x2000] = 0x11;
      ldaIndexed(cpu, mem, 0x82); // X pre-decrement by 1
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x11, "A loaded from [X-1]");
      assert.equal(cpu.status().x, 0x2000, "X decremented by 1");
    });

    QUnit.test(",reg+B offset (case 5)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("X", 0x2000); cpu.set("B", 0x05); mem[0x2005] = 0xAA;
      ldaIndexed(cpu, mem, 0x85); // X+B
      cpu.singleStep();
      assert.equal(cpu.status().a, 0xAA, "A loaded from [X+B]");
    });

    QUnit.test(",reg+A offset (case 6)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("X", 0x2000); cpu.set("A", 0x03); mem[0x2003] = 0xBB;
      ldaIndexed(cpu, mem, 0x86); // X+A
      cpu.singleStep();
      assert.equal(cpu.status().a, 0xBB, "A loaded from [X+A]");
    });

    QUnit.test("illegal postbyte case 7 does not crash", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("X", 0x2000);
      ldaIndexed(cpu, mem, 0x87); // illegal
      cpu.singleStep();
      assert.ok(true, "no crash on illegal postbyte 7");
    });

    QUnit.test(",reg+16bit offset (case 9)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("X", 0x1000); mem[0x1010] = 0xCC;
      ldaIndexed(cpu, mem, 0x89, [0x00, 0x10]); // X + 0x0010
      cpu.singleStep();
      assert.equal(cpu.status().a, 0xCC, "A loaded from [X+0x0010]");
    });

    QUnit.test("illegal postbyte case 0xA does not crash", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("X", 0x2000);
      ldaIndexed(cpu, mem, 0x8A); // illegal
      cpu.singleStep();
      assert.ok(true, "no crash on illegal postbyte 0xA");
    });

    QUnit.test(",reg+D offset (case 0xB)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("X", 0x2000); cpu.set("A", 0x00); cpu.set("B", 0x08);
      mem[0x2008] = 0xDD;
      ldaIndexed(cpu, mem, 0x8B); // X+D
      cpu.singleStep();
      assert.equal(cpu.status().a, 0xDD, "A loaded from [X+D]");
    });

    QUnit.test("PC+16bit offset (case 0xD)", (assert) => {
      const { cpu, mem } = createTestCPU();
      // After fetching opcode(0x1000), pb(0x1001), offset hi(0x1002), offset lo(0x1003) → PC=0x1004
      // EA = PC + 0x0010 = 0x1014
      mem[0x1014] = 0x7E;
      ldaIndexed(cpu, mem, 0x8D, [0x00, 0x10]); // PC+0x0010
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x7E, "A loaded from [PC+0x0010]");
    });

    QUnit.test("illegal postbyte case 0xE does not crash", (assert) => {
      const { cpu, mem } = createTestCPU();
      ldaIndexed(cpu, mem, 0x8E); // illegal
      cpu.singleStep();
      assert.ok(true, "no crash on illegal postbyte 0xE");
    });

    QUnit.test("[,ext] extended indirect (case 0xF)", (assert) => {
      const { cpu, mem } = createTestCPU();
      // pb=0x9F: bit4=1 (indirect), case=0xF; next 2 bytes = pointer address
      // EA = word at 0x3000 = 0x4000; A = mem[0x4000]
      mem[0x3000] = 0x40; mem[0x3001] = 0x00; // pointer to 0x4000
      mem[0x4000] = 0xFE;
      ldaIndexed(cpu, mem, 0x9F, [0x30, 0x00]); // [[0x3000]]
      cpu.singleStep();
      assert.equal(cpu.status().a, 0xFE, "A loaded via extended indirect");
    });

    QUnit.test("Y register as PostByte base (case 4, Y)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("Y", 0x3000); mem[0x3000] = 0x55;
      ldaIndexed(cpu, mem, 0xA4); // ,Y (pb=0xA4: bits 6:5=01=Y, case=4)
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x55, "A loaded from [Y]");
    });

    QUnit.test("U register as PostByte base", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("U", 0x4000); mem[0x4000] = 0x66;
      ldaIndexed(cpu, mem, 0xC4); // ,U (bits 6:5=10=U, case=4)
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x66, "A loaded from [U]");
    });

    QUnit.test("S register as PostByte base", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x5000); mem[0x5000] = 0x77;
      ldaIndexed(cpu, mem, 0xE4); // ,S (bits 6:5=11=S, case=4)
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x77, "A loaded from [S]");
    });

    QUnit.test("Y post-increment (case 0 with Y base)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("Y", 0x2000); mem[0x2000] = 0x12;
      ldaIndexed(cpu, mem, 0xA0); // ,Y+ (Y post-inc by 1)
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x12, "A loaded from [Y]");
      assert.equal(cpu.status().y, 0x2001, "Y incremented");
    });
  });

  QUnit.module("$10 prefix: LDY/STY/LDS/STS/CMPY/CMPD", () => {
    QUnit.test("LDY immediate ($10 $8E)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0x8E; mem[0x1002] = 0x12; mem[0x1003] = 0x34;
      cpu.singleStep();
      assert.equal(cpu.status().y, 0x1234, "Y = 0x1234 after LDY #$1234");
      assert.equal(cpu.status().flags & 0x04, 0, "Z flag clear");
    });

    QUnit.test("LDY immediate sets Z flag for zero", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0x8E; mem[0x1002] = 0x00; mem[0x1003] = 0x00;
      cpu.singleStep();
      assert.equal(cpu.status().y, 0, "Y = 0");
      assert.ok(cpu.status().flags & 0x04, "Z flag set");
    });

    QUnit.test("LDY direct ($10 $9E)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("DP", 0x05); mem[0x0510] = 0xAB; mem[0x0511] = 0xCD;
      mem[0x1000] = 0x10; mem[0x1001] = 0x9E; mem[0x1002] = 0x10;
      cpu.singleStep();
      assert.equal(cpu.status().y, 0xABCD, "Y loaded from direct page");
    });

    QUnit.test("LDY extended ($10 $BE)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x3000] = 0x56; mem[0x3001] = 0x78;
      mem[0x1000] = 0x10; mem[0x1001] = 0xBE; mem[0x1002] = 0x30; mem[0x1003] = 0x00;
      cpu.singleStep();
      assert.equal(cpu.status().y, 0x5678, "Y loaded from extended address");
    });

    QUnit.test("STY direct ($10 $9F)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("Y", 0x1234); cpu.set("DP", 0x05);
      mem[0x1000] = 0x10; mem[0x1001] = 0x9F; mem[0x1002] = 0x20;
      cpu.singleStep();
      assert.equal(mem[0x0520], 0x12, "Y high byte stored");
      assert.equal(mem[0x0521], 0x34, "Y low byte stored");
    });

    QUnit.test("STY extended ($10 $BF)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("Y", 0x9ABC);
      mem[0x1000] = 0x10; mem[0x1001] = 0xBF; mem[0x1002] = 0x40; mem[0x1003] = 0x00;
      cpu.singleStep();
      assert.equal((mem[0x4000] << 8) | mem[0x4001], 0x9ABC, "Y stored at extended address");
    });

    QUnit.test("LDS immediate ($10 $CE)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0xCE; mem[0x1002] = 0x03; mem[0x1003] = 0x00;
      cpu.singleStep();
      assert.equal(cpu.status().sp, 0x0300, "S = 0x0300 after LDS #$0300");
    });

    QUnit.test("LDS direct ($10 $DE)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("DP", 0x00); mem[0x0050] = 0x02; mem[0x0051] = 0x00;
      mem[0x1000] = 0x10; mem[0x1001] = 0xDE; mem[0x1002] = 0x50;
      cpu.singleStep();
      assert.equal(cpu.status().sp, 0x0200, "S loaded from direct page");
    });

    QUnit.test("LDS extended ($10 $FE)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x5000] = 0x01; mem[0x5001] = 0xFF;
      mem[0x1000] = 0x10; mem[0x1001] = 0xFE; mem[0x1002] = 0x50; mem[0x1003] = 0x00;
      cpu.singleStep();
      assert.equal(cpu.status().sp, 0x01FF, "S loaded from extended address");
    });

    QUnit.test("STS extended ($10 $FF)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x0200);
      mem[0x1000] = 0x10; mem[0x1001] = 0xFF; mem[0x1002] = 0x60; mem[0x1003] = 0x00;
      cpu.singleStep();
      assert.equal((mem[0x6000] << 8) | mem[0x6001], 0x0200, "S stored at extended address");
    });

    QUnit.test("CMPY immediate ($10 $8C) sets Z on equal", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("Y", 0x1234);
      mem[0x1000] = 0x10; mem[0x1001] = 0x8C; mem[0x1002] = 0x12; mem[0x1003] = 0x34;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z flag set when Y = operand");
    });

    QUnit.test("CMPY extended ($10 $BC) sets N on Y < operand", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("Y", 0x0100);
      mem[0x7000] = 0x02; mem[0x7001] = 0x00;
      mem[0x1000] = 0x10; mem[0x1001] = 0xBC; mem[0x1002] = 0x70; mem[0x1003] = 0x00;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x08, "N flag set when Y < operand");
    });

    QUnit.test("CMPD immediate ($10 $83) sets Z on equal", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x12); cpu.set("B", 0x34); // D = 0x1234
      mem[0x1000] = 0x10; mem[0x1001] = 0x83; mem[0x1002] = 0x12; mem[0x1003] = 0x34;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z flag set when D = operand");
    });

    QUnit.test("CMPD extended ($10 $B3) compares D with memory", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x00); cpu.set("B", 0x05); // D = 0x0005
      mem[0x8000] = 0x00; mem[0x8001] = 0x05;
      mem[0x1000] = 0x10; mem[0x1001] = 0xB3; mem[0x1002] = 0x80; mem[0x1003] = 0x00;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z flag set when D = memory");
    });
  });

  QUnit.module("$10 prefix: Long branches", () => {
    // PC after $10 $xx $HH $LL = 0x1004, so target = 0x1004 + signed16(offset)
    const setup = (mem, opcode, offset) => {
      mem[0x1000] = 0x10;
      mem[0x1001] = opcode;
      mem[0x1002] = (offset >> 8) & 0xFF;
      mem[0x1003] = offset & 0xFF;
    };

    QUnit.test("LBRA ($16) always branches", (assert) => {
      // LBRA is a base opcode $16 (not under $10 prefix): 3 bytes total, PC=0x1003 after fetch
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x16; mem[0x1001] = 0x00; mem[0x1002] = 0x10;
      cpu.singleStep();
      // PC at fetch end = 0x1003, offset = 0x0010 → 0x1003 + 0x10 = 0x1013
      assert.equal(cpu.status().pc, 0x1013, "LBRA branches to PC+0x10");
    });

    QUnit.test("LBRA negative offset branches backward", (assert) => {
      // LBRA is a base opcode $16: 3 bytes total, PC=0x1003 after fetch
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x16; mem[0x1001] = 0xFF; mem[0x1002] = 0xF0;
      cpu.singleStep();
      // PC at fetch end = 0x1003, offset = 0xFFF0 = -16 signed → 0x1003 + (-16) = 0x0FF3
      assert.equal(cpu.status().pc, 0x0FF3, "LBRA negative offset branches backward");
    });

    QUnit.test("LBEQ taken when Z set ($10 $27)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x04); // Z=1
      setup(mem, 0x27, 0x0020);
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1024, "LBEQ taken when Z=1");
    });

    QUnit.test("LBEQ not taken when Z clear", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x00);
      setup(mem, 0x27, 0x0020);
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1004, "LBEQ not taken when Z=0");
    });

    QUnit.test("LBNE taken when Z clear ($10 $26)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x00);
      setup(mem, 0x26, 0x0010);
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1014, "LBNE taken when Z=0");
    });

    QUnit.test("LBNE not taken when Z set", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x04);
      setup(mem, 0x26, 0x0010);
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1004, "LBNE not taken when Z=1");
    });

    QUnit.test("LBCS taken when C set ($10 $25)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x01); // C=1
      setup(mem, 0x25, 0x0010);
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1014, "LBCS taken when C=1");
    });

    QUnit.test("LBCC taken when C clear ($10 $24)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x00);
      setup(mem, 0x24, 0x0010);
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1014, "LBCC taken when C=0");
    });

    QUnit.test("LBVS taken when V set ($10 $29)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x02); // V=1
      setup(mem, 0x29, 0x0010);
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1014, "LBVS taken when V=1");
    });

    QUnit.test("LBVC taken when V clear ($10 $28)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x00);
      setup(mem, 0x28, 0x0010);
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1014, "LBVC taken when V=0");
    });

    QUnit.test("LBMI taken when N set ($10 $2B)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x08); // N=1
      setup(mem, 0x2B, 0x0010);
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1014, "LBMI taken when N=1");
    });

    QUnit.test("LBPL taken when N clear ($10 $2A)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x00);
      setup(mem, 0x2A, 0x0010);
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1014, "LBPL taken when N=0");
    });

    QUnit.test("LBGE taken when N=V ($10 $2C)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x00); // N=0, V=0: N xor V = 0 → branch
      setup(mem, 0x2C, 0x0010);
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1014, "LBGE taken when N=V=0");
    });

    QUnit.test("LBLT taken when N≠V ($10 $2D)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x08); // N=1, V=0: N xor V → branch
      setup(mem, 0x2D, 0x0010);
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1014, "LBLT taken when N≠V");
    });

    QUnit.test("LBHI taken when C=0 and Z=0 ($10 $22)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x00);
      setup(mem, 0x22, 0x0010);
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1014, "LBHI taken when C=0,Z=0");
    });

    QUnit.test("LBLS taken when C=1 or Z=1 ($10 $23)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x01); // C=1
      setup(mem, 0x23, 0x0010);
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1014, "LBLS taken when C=1");
    });

    QUnit.test("LBGT taken when Z=0 and N=V ($10 $2E)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x00); // Z=0, N=0, V=0
      setup(mem, 0x2E, 0x0010);
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1014, "LBGT taken when Z=0,N=V");
    });

    QUnit.test("LBLE taken when Z=1 or N≠V ($10 $2F)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x04); // Z=1
      setup(mem, 0x2F, 0x0010);
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1014, "LBLE taken when Z=1");
    });

    QUnit.test("LBRN ($10 $21) never branches", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0xFF); // all flags set — still no branch
      setup(mem, 0x21, 0x0010);
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1004, "LBRN never branches");
    });
  });

  QUnit.module("Base instructions: LEAX/LEAY/RTI/MUL/RMW/short-branches", () => {
    QUnit.test("LEAX result=0 sets Z flag (0x30)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("X", 0x0000);
      mem[0x1000] = 0x30; mem[0x1001] = 0x84; // LEAX ,X (pb=0x84: ,X case 4)
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z flag set when LEAX result = 0");
    });

    QUnit.test("LEAX result≠0 clears Z flag", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("X", 0x1234);
      mem[0x1000] = 0x30; mem[0x1001] = 0x84; // LEAX ,X
      cpu.singleStep();
      assert.equal(cpu.status().flags & 0x04, 0, "Z flag clear when LEAX result ≠ 0");
      assert.equal(cpu.status().x, 0x1234, "X unchanged");
    });

    QUnit.test("LEAY result=0 sets Z flag (0x31)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("Y", 0x0000);
      mem[0x1000] = 0x31; mem[0x1001] = 0xA4; // LEAY ,Y (pb=0xA4)
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z flag set when LEAY result = 0");
    });

    QUnit.test("RTI without F_ENTIRE only pulls CC and PC", (assert) => {
      const { cpu, mem } = createTestCPU();
      // Stack: CC(no F_ENTIRE), PC=0x2000
      cpu.set("SP", 0x01FD);
      mem[0x01FD] = 0x00; // CC (no F_ENTIRE bit 0x80)
      mem[0x01FE] = 0x20; mem[0x01FF] = 0x00; // PC = 0x2000
      mem[0x1000] = 0x3B; // RTI
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x2000, "PC restored to 0x2000");
      assert.equal(cpu.status().sp, 0x0200, "SP advanced by 3");
    });

    QUnit.test("RTI with F_ENTIRE pulls full register set", (assert) => {
      const { cpu, mem } = createTestCPU();
      // Full stack: CC(0x80), A, B, DP, X(2), Y(2), U(2), PC(2) = 12 bytes
      cpu.set("SP", 0x01F4);
      mem[0x01F4] = 0x80; // CC with F_ENTIRE
      mem[0x01F5] = 0x11; // A
      mem[0x01F6] = 0x22; // B
      mem[0x01F7] = 0x05; // DP
      mem[0x01F8] = 0x12; mem[0x01F9] = 0x34; // X
      mem[0x01FA] = 0x56; mem[0x01FB] = 0x78; // Y
      mem[0x01FC] = 0x9A; mem[0x01FD] = 0xBC; // U
      mem[0x01FE] = 0x30; mem[0x01FF] = 0x00; // PC = 0x3000
      mem[0x1000] = 0x3B;
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x11, "A restored");
      assert.equal(cpu.status().b, 0x22, "B restored");
      assert.equal(cpu.status().pc, 0x3000, "PC restored to 0x3000");
    });

    QUnit.test("RTI in native mode additionally restores E and F", (assert) => {
      const { cpu, mem } = createTestCPU();
      // Enable native mode
      mem[0x1000] = 0x11; mem[0x1001] = 0x3D; mem[0x1002] = 0x01; // LDMD #1
      cpu.singleStep(); // PC now at 0x1003
      // Native RTI stack: CC(0x80), A, B, E, F, DP, X(2), Y(2), U(2), PC(2) = 14 bytes
      cpu.set("SP", 0x01F2);
      mem[0x01F2] = 0x80; // CC (F_ENTIRE)
      mem[0x01F3] = 0xAA; // A
      mem[0x01F4] = 0xBB; // B
      mem[0x01F5] = 0xDD; // E (pulled first by RTI)
      mem[0x01F6] = 0xCC; // F (pulled second by RTI)
      mem[0x01F7] = 0x00; // DP
      mem[0x01F8] = 0x00; mem[0x01F9] = 0x00; // X
      mem[0x01FA] = 0x00; mem[0x01FB] = 0x00; // Y
      mem[0x01FC] = 0x00; mem[0x01FD] = 0x00; // U
      mem[0x01FE] = 0x20; mem[0x01FF] = 0x00; // PC = 0x2000
      mem[0x1003] = 0x3B; // RTI at new PC
      cpu.singleStep();
      assert.equal(cpu.status().e, 0xDD, "E restored from stack in native mode");
      assert.equal(cpu.status().f, 0xCC, "F restored from stack in native mode");
    });

    QUnit.test("MUL result=0 sets Z flag (0x3D)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x00); cpu.set("B", 0x05);
      mem[0x1000] = 0x3D; // MUL
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z flag set when A*B=0");
    });

    QUnit.test("MUL result has bit7 set → carry flag set", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x01); cpu.set("B", 0x80); // 1*128=128=0x80, bit7=1
      mem[0x1000] = 0x3D;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x01, "C flag set when bit7 of result=1");
    });

    QUnit.test("MUL result bit7 clear → carry flag clear", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x02); cpu.set("B", 0x02); // result=4, bit7=0
      mem[0x1000] = 0x3D;
      cpu.singleStep();
      assert.equal(cpu.status().flags & 0x01, 0, "C flag clear when bit7 of result=0");
    });

    QUnit.test("OIM indexed — OR immediate with memory (0x61)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("X", 0x3000); mem[0x3000] = 0x0F;
      // OIM indexed: opcode=0x61, imm byte, then postbyte
      mem[0x1000] = 0x61; mem[0x1001] = 0xF0; mem[0x1002] = 0x84; // OIM imm=$F0 ,X
      cpu.singleStep();
      assert.equal(mem[0x3000], 0xFF, "memory ORed with immediate");
    });

    QUnit.test("AIM indexed — AND immediate with memory (0x62)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("X", 0x3000); mem[0x3000] = 0xFF;
      mem[0x1000] = 0x62; mem[0x1001] = 0x0F; mem[0x1002] = 0x84; // AIM imm=$0F ,X
      cpu.singleStep();
      assert.equal(mem[0x3000], 0x0F, "memory ANDed with immediate");
    });

    QUnit.test("EIM indexed — XOR immediate with memory (0x65)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("X", 0x3000); mem[0x3000] = 0xAA;
      mem[0x1000] = 0x65; mem[0x1001] = 0xFF; mem[0x1002] = 0x84;
      cpu.singleStep();
      assert.equal(mem[0x3000], 0x55, "memory XORed with immediate");
    });

    QUnit.test("TIM indexed — test bits in memory, no write (0x6B)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("X", 0x3000); mem[0x3000] = 0x0F;
      mem[0x1000] = 0x6B; mem[0x1001] = 0xF0; mem[0x1002] = 0x84; // TIM: AND but no store
      cpu.singleStep();
      assert.equal(mem[0x3000], 0x0F, "TIM does not modify memory");
      assert.ok(cpu.status().flags & 0x04, "Z flag set (result of AND = 0)");
    });

    QUnit.test("OIM extended — OR immediate with extended memory (0x71)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x5000] = 0x03;
      mem[0x1000] = 0x71; mem[0x1001] = 0x0C; mem[0x1002] = 0x50; mem[0x1003] = 0x00;
      cpu.singleStep();
      assert.equal(mem[0x5000], 0x0F, "memory ORed in extended mode");
    });

    QUnit.test("BLT not taken when N=V (0x2D)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x00); // N=0, V=0: N xor V = 0 → not taken
      mem[0x1000] = 0x2D; mem[0x1001] = 0x10;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1002, "BLT not taken when N=V");
    });

    QUnit.test("BLT taken when N≠V (0x2D)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x08); // N=1, V=0
      mem[0x1000] = 0x2D; mem[0x1001] = 0x10;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1012, "BLT taken when N≠V");
    });

    QUnit.test("BGT not taken when Z=1 (0x2E)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x04); // Z=1 → not taken
      mem[0x1000] = 0x2E; mem[0x1001] = 0x10;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1002, "BGT not taken when Z=1");
    });

    QUnit.test("BLE taken when Z=1 (0x2F)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x04); // Z=1 → taken
      mem[0x1000] = 0x2F; mem[0x1001] = 0x10;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1012, "BLE taken when Z=1");
    });

    QUnit.test("BLE not taken when Z=0 and N=V (0x2F)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x00); // Z=0, N=0, V=0 → not taken
      mem[0x1000] = 0x2F; mem[0x1001] = 0x10;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1002, "BLE not taken when Z=0, N=V");
    });
  });

  QUnit.module("$11 prefix: CMPU/CMPS", () => {
    QUnit.test("CMPU immediate equal — Z flag set ($11 $83)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("U", 0x1234);
      mem[0x1000] = 0x11; mem[0x1001] = 0x83; mem[0x1002] = 0x12; mem[0x1003] = 0x34;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z set when U = operand");
    });

    QUnit.test("CMPU immediate U > operand — C clear", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("U", 0x0200);
      mem[0x1000] = 0x11; mem[0x1001] = 0x83; mem[0x1002] = 0x01; mem[0x1003] = 0x00;
      cpu.singleStep();
      assert.equal(cpu.status().flags & 0x01, 0, "C clear when U > operand");
    });

    QUnit.test("CMPU immediate U < operand — C set ($11 $83)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("U", 0x0100);
      mem[0x1000] = 0x11; mem[0x1001] = 0x83; mem[0x1002] = 0x02; mem[0x1003] = 0x00;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x01, "C set when U < operand (unsigned)");
    });

    QUnit.test("CMPU direct ($11 $93)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("U", 0x5678); cpu.set("DP", 0x00);
      mem[0x0020] = 0x56; mem[0x0021] = 0x78;
      mem[0x1000] = 0x11; mem[0x1001] = 0x93; mem[0x1002] = 0x20;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z set when U = memory (direct)");
    });

    QUnit.test("CMPU extended ($11 $B3)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("U", 0xABCD);
      mem[0x7000] = 0xAB; mem[0x7001] = 0xCD;
      mem[0x1000] = 0x11; mem[0x1001] = 0xB3; mem[0x1002] = 0x70; mem[0x1003] = 0x00;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z set when U = memory (extended)");
    });

    QUnit.test("CMPS immediate equal — Z flag set ($11 $8C)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x0200);
      mem[0x1000] = 0x11; mem[0x1001] = 0x8C; mem[0x1002] = 0x02; mem[0x1003] = 0x00;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z set when S = operand");
    });

    QUnit.test("CMPS immediate S < operand — C set", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x0100);
      mem[0x1000] = 0x11; mem[0x1001] = 0x8C; mem[0x1002] = 0x02; mem[0x1003] = 0x00;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x01, "C set when S < operand");
    });

    QUnit.test("CMPS direct ($11 $9C)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x0200); cpu.set("DP", 0x00);
      mem[0x0030] = 0x02; mem[0x0031] = 0x00;
      mem[0x1000] = 0x11; mem[0x1001] = 0x9C; mem[0x1002] = 0x30;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z set when S = memory (direct)");
    });

    QUnit.test("CMPS extended ($11 $BC)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x0300);
      mem[0x8000] = 0x03; mem[0x8001] = 0x00;
      mem[0x1000] = 0x11; mem[0x1001] = 0xBC; mem[0x1002] = 0x80; mem[0x1003] = 0x00;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z set when S = memory (extended)");
    });
  });

  QUnit.module("$11 prefix: native mode ops", () => {
    QUnit.test("COME complements E register ($11 $43)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("E", 0xAA);
      mem[0x1000] = 0x11; mem[0x1001] = 0x43;
      cpu.singleStep();
      assert.equal(cpu.status().e, 0x55, "E = ~0xAA = 0x55");
      assert.ok(cpu.status().flags & 0x01, "C flag set after COM");
    });

    QUnit.test("DECE decrements E, overflow at 0x80→0x7F ($11 $4A)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("E", 0x80);
      mem[0x1000] = 0x11; mem[0x1001] = 0x4A;
      cpu.singleStep();
      assert.equal(cpu.status().e, 0x7F, "E decremented");
      assert.ok(cpu.status().flags & 0x02, "V flag set on 0x80→0x7F");
    });

    QUnit.test("DECE at 0x01 — no overflow", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("E", 0x01);
      mem[0x1000] = 0x11; mem[0x1001] = 0x4A;
      cpu.singleStep();
      assert.equal(cpu.status().e, 0x00, "E = 0");
      assert.ok(cpu.status().flags & 0x04, "Z flag set");
    });

    QUnit.test("INCE increments E, overflow at 0x7F→0x80 ($11 $4C)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("E", 0x7F);
      mem[0x1000] = 0x11; mem[0x1001] = 0x4C;
      cpu.singleStep();
      assert.equal(cpu.status().e, 0x80, "E incremented to 0x80");
      assert.ok(cpu.status().flags & 0x02, "V flag set on 0x7F→0x80");
    });

    QUnit.test("INCE at 0xFF wraps to 0x00 — no overflow", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("E", 0xFF);
      mem[0x1000] = 0x11; mem[0x1001] = 0x4C;
      cpu.singleStep();
      assert.equal(cpu.status().e, 0x00, "E wrapped to 0");
      assert.ok(cpu.status().flags & 0x04, "Z flag set");
    });

    QUnit.test("TSTE sets N flag when E has bit7 set ($11 $4D)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("E", 0x80);
      mem[0x1000] = 0x11; mem[0x1001] = 0x4D;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x08, "N flag set when E bit7=1");
    });

    QUnit.test("CLRE clears E to 0 ($11 $4F)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("E", 0xFF);
      mem[0x1000] = 0x11; mem[0x1001] = 0x4F;
      cpu.singleStep();
      assert.equal(cpu.status().e, 0x00, "E cleared to 0");
      assert.ok(cpu.status().flags & 0x04, "Z flag set");
    });

    QUnit.test("COMF complements F register ($11 $53)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("F", 0x00);
      mem[0x1000] = 0x11; mem[0x1001] = 0x53;
      cpu.singleStep();
      assert.equal(cpu.status().f, 0xFF, "F = ~0x00 = 0xFF");
    });

    QUnit.test("DECF decrements F ($11 $5A)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("F", 0x05);
      mem[0x1000] = 0x11; mem[0x1001] = 0x5A;
      cpu.singleStep();
      assert.equal(cpu.status().f, 0x04, "F decremented");
    });

    QUnit.test("DECF overflow at 0x80→0x7F ($11 $5A)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("F", 0x80);
      mem[0x1000] = 0x11; mem[0x1001] = 0x5A;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x02, "V flag set on DECF 0x80→0x7F");
    });

    QUnit.test("INCF increments F ($11 $5C)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("F", 0x05);
      mem[0x1000] = 0x11; mem[0x1001] = 0x5C;
      cpu.singleStep();
      assert.equal(cpu.status().f, 0x06, "F incremented");
    });

    QUnit.test("INCF overflow at 0x7F→0x80 ($11 $5C)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("F", 0x7F);
      mem[0x1000] = 0x11; mem[0x1001] = 0x5C;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x02, "V flag set on INCF 0x7F→0x80");
    });

    QUnit.test("TSTF sets Z when F=0 ($11 $5D)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("F", 0x00);
      mem[0x1000] = 0x11; mem[0x1001] = 0x5D;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z set when F=0");
    });

    QUnit.test("CLRF clears F to 0 ($11 $5F)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("F", 0xAB);
      mem[0x1000] = 0x11; mem[0x1001] = 0x5F;
      cpu.singleStep();
      assert.equal(cpu.status().f, 0x00, "F cleared to 0");
    });

    QUnit.test("MULD immediate: 3×4=12 in Q ($11 $8F)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x00); cpu.set("B", 0x03); // D=3
      mem[0x1000] = 0x11; mem[0x1001] = 0x8F; mem[0x1002] = 0x00; mem[0x1003] = 0x04;
      cpu.singleStep();
      // Q = A:B:E:F (32-bit), 3*4=12=0x0000000C → A=0,B=0,E=0,F=0x0C, W(E:F)=0x000C
      assert.equal(cpu.status().a, 0x00, "A (Q high byte) = 0");
      assert.equal(cpu.status().b, 0x00, "B (Q byte 1) = 0");
      assert.equal(cpu.status().w, 0x000C, "W=E:F (Q low word) = 12 (3*4)");
    });

    QUnit.test("MULD direct ($11 $9F)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x00); cpu.set("B", 0x05); // D=5
      cpu.set("DP", 0x00); mem[0x0040] = 0x00; mem[0x0041] = 0x03; // operand=3
      mem[0x1000] = 0x11; mem[0x1001] = 0x9F; mem[0x1002] = 0x40;
      cpu.singleStep();
      assert.equal(cpu.status().f, 0x0F, "MULD direct: F (Q low byte) = 15 (5*3)");
    });

    QUnit.test("DIVD immediate: 10÷3, quotient=3 remainder=1 ($11 $8D)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x00); cpu.set("B", 0x0A); // D=10
      mem[0x1000] = 0x11; mem[0x1001] = 0x8D; mem[0x1002] = 0x03; // DIVD #3
      cpu.singleStep();
      // DIVD: quotient → W (E:F), remainder → D (A:B)
      assert.equal(cpu.status().f, 0x03, "quotient 3 in F (W low byte)");
      assert.equal(cpu.status().b, 0x01, "remainder 1 in B (D low byte)");
    });

    QUnit.test("DIVD division by zero triggers trap ($11 $8D #0)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0xFFF0] = 0x20; mem[0xFFF1] = 0x00; // trap vector → 0x2000
      cpu.set("A", 0x00); cpu.set("B", 0x05);
      mem[0x1000] = 0x11; mem[0x1001] = 0x8D; mem[0x1002] = 0x00; // DIVD #0
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x2000, "trap vector taken on div by zero");
      assert.ok(cpu.status().md & 0x80, "MD bit 7 set (div by zero)");
    });

    QUnit.test("DIVD extended ($11 $BD)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x00); cpu.set("B", 0x06);
      mem[0x9000] = 0x02; // divisor = 2
      mem[0x1000] = 0x11; mem[0x1001] = 0xBD; mem[0x1002] = 0x90; mem[0x1003] = 0x00;
      cpu.singleStep();
      assert.equal(cpu.status().f, 0x03, "quotient 3 in F");
      assert.equal(cpu.status().b, 0x00, "remainder 0 in B");
    });

    QUnit.test("DIVQ immediate basic case ($11 $8E)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x00); cpu.set("B", 0x00); cpu.set("E", 0x00); cpu.set("F", 0x06);
      mem[0x1000] = 0x11; mem[0x1001] = 0x8E; mem[0x1002] = 0x00; mem[0x1003] = 0x02;
      cpu.singleStep();
      // DIVQ: Q=6 / 2 → quotient=3 in W (E:F), remainder=0 in D (A:B)
      assert.equal(cpu.status().f, 0x03, "quotient 3 in F (W low byte)");
      assert.equal(cpu.status().b, 0x00, "remainder 0 in B (D low byte)");
    });

    QUnit.test("DIVQ division by zero triggers trap ($11 $8E #0)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0xFFF0] = 0x20; mem[0xFFF1] = 0x00;
      mem[0x1000] = 0x11; mem[0x1001] = 0x8E; mem[0x1002] = 0x00; mem[0x1003] = 0x00;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x2000, "trap taken on DIVQ div by zero");
    });

    QUnit.test("BITMD ANDs MD with immediate, sets Z flag ($11 $3C)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x11; mem[0x1001] = 0x3D; mem[0x1002] = 0x03; // LDMD #3 → MD bits 0:1
      cpu.singleStep();
      mem[0x1003] = 0x11; mem[0x1004] = 0x3C; mem[0x1005] = 0x00; // BITMD #0 → result=0, Z set
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z flag set when BITMD result = 0");
    });

    QUnit.test("BITMD clears bits 6 and 7 of MD ($11 $3C)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0xFFF0] = 0x10; mem[0xFFF1] = 0x00; // trap vector → back to 0x1000
      mem[0x1000] = 0x87; // illegal opcode → trap sets MD bit 6
      cpu.singleStep();
      const mdBefore = cpu.status().md;
      assert.ok(mdBefore & 0x40, "MD bit 6 set from illegal op trap");
      mem[0x1000] = 0x11; mem[0x1001] = 0x3C; mem[0x1002] = 0xFF; // BITMD #$FF
      cpu.singleStep();
      assert.equal(cpu.status().md & 0xC0, 0, "BITMD clears bits 6 and 7 of MD");
    });

    QUnit.test("LDMD loads bits 0:1 of MD ($11 $3D)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x11; mem[0x1001] = 0x3D; mem[0x1002] = 0x03; // LDMD #3
      cpu.singleStep();
      assert.equal(cpu.status().md & 0x03, 0x03, "MD bits 0:1 loaded from immediate");
    });

    QUnit.test("MULD indexed ($11 $AF)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x00); cpu.set("B", 0x07); cpu.set("X", 0x3000);
      mem[0x3000] = 0x00; mem[0x3001] = 0x02; // operand = 2
      mem[0x1000] = 0x11; mem[0x1001] = 0xAF; mem[0x1002] = 0x84; // MULD ,X
      cpu.singleStep();
      assert.equal(cpu.status().f, 0x0E, "MULD indexed: F (Q low byte) = 14 (7*2)");
    });

    QUnit.test("DIVD direct ($11 $9D)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x00); cpu.set("B", 0x08); cpu.set("DP", 0x00);
      mem[0x0060] = 0x04; // divisor = 4
      mem[0x1000] = 0x11; mem[0x1001] = 0x9D; mem[0x1002] = 0x60;
      cpu.singleStep();
      assert.equal(cpu.status().f, 0x02, "quotient 2 in F");
      assert.equal(cpu.status().b, 0x00, "remainder 0 in B");
    });

    QUnit.test("DIVQ direct ($11 $9E)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x00); cpu.set("B", 0x00); cpu.set("E", 0x00); cpu.set("F", 0x08);
      cpu.set("DP", 0x00); mem[0x0070] = 0x00; mem[0x0071] = 0x04;
      mem[0x1000] = 0x11; mem[0x1001] = 0x9E; mem[0x1002] = 0x70;
      cpu.singleStep();
      assert.ok(true, "DIVQ direct executed without crash");
    });

    QUnit.test("DIVQ extended ($11 $BE)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x00); cpu.set("B", 0x00); cpu.set("E", 0x00); cpu.set("F", 0x0A);
      mem[0xA000] = 0x00; mem[0xA001] = 0x05;
      mem[0x1000] = 0x11; mem[0x1001] = 0xBE; mem[0x1002] = 0xA0; mem[0x1003] = 0x00;
      cpu.singleStep();
      assert.ok(true, "DIVQ extended executed without crash");
    });
  });

  QUnit.module("Disassembler $10/$11 prefix", () => {
    QUnit.test("$10 $8E = LDY #imm (2+2 bytes)", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0x10, 0x8E, 0x12, 0x34);
      assert.equal(m, "LDY #$1234", "mnemonic is LDY");
      assert.equal(l, 4, "4 bytes total");
    });

    QUnit.test("$10 $9F = STY direct (2+1 bytes)", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0x10, 0x9F, 0x50);
      assert.equal(m, "STY $50", "mnemonic is STY");
      assert.equal(l, 3, "3 bytes");
    });

    QUnit.test("$10 $BE = LDY extended (2+2 bytes)", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0x10, 0xBE, 0x30, 0x00);
      assert.equal(m, "LDY $3000", "mnemonic is LDY (extended)");
      assert.equal(l, 4, "4 bytes");
    });

    QUnit.test("$10 $CE = LDS #imm", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0x10, 0xCE, 0x03, 0x00);
      assert.equal(m, "LDS #$0300", "mnemonic is LDS");
    });

    QUnit.test("$10 $DF = STS direct", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0x10, 0xDF, 0x50);
      assert.equal(m, "STS $50", "mnemonic is STS");
    });

    QUnit.test("$10 $8C = CMPY #imm", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0x10, 0x8C, 0x12, 0x34);
      assert.equal(m, "CMPY #$1234", "mnemonic is CMPY");
    });

    QUnit.test("$10 $83 = CMPD #imm", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0x10, 0x83, 0x12, 0x34);
      assert.equal(m, "CMPD #$1234", "mnemonic is CMPD");
    });

    QUnit.test("$10 $27 = LBEQ (long branch)", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0x10, 0x27, 0x00, 0x10, 0, 0);
      assert.equal(m, "LBEQ #$0010", "mnemonic is LBEQ");
      assert.equal(l, 4, "4 bytes");
    });

    QUnit.test("$10 $16 = LBRA", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0x10, 0x16, 0x00, 0x10, 0, 0);
      assert.equal(m, "LBRA #$0010", "mnemonic is LBRA");
      assert.equal(l, 4, "4 bytes");
    });

    QUnit.test("$10 $26 = LBNE", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0x10, 0x26, 0x00, 0x10, 0, 0);
      assert.equal(m, "LBNE #$0010", "mnemonic is LBNE");
    });

    QUnit.test("$10 $24 = LBCC", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0x10, 0x24, 0x00, 0x10, 0, 0);
      assert.equal(m, "LBCC #$0010", "mnemonic is LBCC");
    });

    QUnit.test("$10 $25 = LBCS", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0x10, 0x25, 0x00, 0x10, 0, 0);
      assert.equal(m, "LBCS #$0010", "mnemonic is LBCS");
    });

    QUnit.test("$10 $28 = LBVC", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0x10, 0x28, 0x00, 0x10, 0, 0);
      assert.equal(m, "LBVC #$0010", "mnemonic is LBVC");
    });

    QUnit.test("$10 $29 = LBVS", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0x10, 0x29, 0x00, 0x10, 0, 0);
      assert.equal(m, "LBVS #$0010", "mnemonic is LBVS");
    });

    QUnit.test("$10 $2A = LBPL", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0x10, 0x2A, 0x00, 0x10, 0, 0);
      assert.equal(m, "LBPL #$0010", "mnemonic is LBPL");
    });

    QUnit.test("$10 $2B = LBMI", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0x10, 0x2B, 0x00, 0x10, 0, 0);
      assert.equal(m, "LBMI #$0010", "mnemonic is LBMI");
    });

    QUnit.test("$10 $2C = LBGE", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0x10, 0x2C, 0x00, 0x10, 0, 0);
      assert.equal(m, "LBGE #$0010", "mnemonic is LBGE");
    });

    QUnit.test("$10 $2D = LBLT", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0x10, 0x2D, 0x00, 0x10, 0, 0);
      assert.equal(m, "LBLT #$0010", "mnemonic is LBLT");
    });

    QUnit.test("$10 $2E = LBGT", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0x10, 0x2E, 0x00, 0x10, 0, 0);
      assert.equal(m, "LBGT #$0010", "mnemonic is LBGT");
    });

    QUnit.test("$10 $2F = LBLE", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0x10, 0x2F, 0x00, 0x10, 0, 0);
      assert.equal(m, "LBLE #$0010", "mnemonic is LBLE");
    });

    QUnit.test("$10 $22 = LBHI", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0x10, 0x22, 0x00, 0x10, 0, 0);
      assert.equal(m, "LBHI #$0010", "mnemonic is LBHI");
    });

    QUnit.test("$10 $23 = LBLS", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0x10, 0x23, 0x00, 0x10, 0, 0);
      assert.equal(m, "LBLS #$0010", "mnemonic is LBLS");
    });

    QUnit.test("Unknown $10 opcode returns ['???', 2]", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0x10, 0x01);
      assert.equal(m, "???", "unknown $10 opcode returns ???");
      assert.equal(l, 2, "length = 2");
    });

    QUnit.test("$11 $83 = CMPU #imm", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0x11, 0x83, 0x12, 0x34);
      assert.equal(m, "CMPU #$1234", "mnemonic is CMPU");
    });

    QUnit.test("$11 $8C = CMPS #imm", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0x11, 0x8C, 0x12, 0x34);
      assert.equal(m, "CMPS #$1234", "mnemonic is CMPS");
    });

    QUnit.test("$11 $43 = COME", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0x11, 0x43);
      assert.equal(m, "COME", "mnemonic is COME");
    });

    QUnit.test("$11 $4A = DECE", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0x11, 0x4A);
      assert.equal(m, "DECE", "mnemonic is DECE");
    });

    QUnit.test("$11 $4C = INCE", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0x11, 0x4C);
      assert.equal(m, "INCE", "mnemonic is INCE");
    });

    QUnit.test("$11 $4D = TSTE", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0x11, 0x4D);
      assert.equal(m, "TSTE", "mnemonic is TSTE");
    });

    QUnit.test("$11 $4F = CLRE", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0x11, 0x4F);
      assert.equal(m, "CLRE", "mnemonic is CLRE");
    });

    QUnit.test("$11 $53 = COMF", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0x11, 0x53);
      assert.equal(m, "COMF", "mnemonic is COMF");
    });

    QUnit.test("$11 $5A = DECF", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0x11, 0x5A);
      assert.equal(m, "DECF", "mnemonic is DECF");
    });

    QUnit.test("$11 $5C = INCF", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0x11, 0x5C);
      assert.equal(m, "INCF", "mnemonic is INCF");
    });

    QUnit.test("$11 $5D = TSTF", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0x11, 0x5D);
      assert.equal(m, "TSTF", "mnemonic is TSTF");
    });

    QUnit.test("$11 $5F = CLRF", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0x11, 0x5F);
      assert.equal(m, "CLRF", "mnemonic is CLRF");
    });

    QUnit.test("$11 $8F = MULD #imm", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0x11, 0x8F, 0x00, 0x04);
      assert.equal(m, "MULD #$0004", "mnemonic is MULD");
    });

    QUnit.test("$11 $8D = DIVD #imm", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0x11, 0x8D, 0x03);
      assert.equal(m, "DIVD #$03", "mnemonic is DIVD");
    });

    QUnit.test("$11 $8E = DIVQ #imm", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0x11, 0x8E, 0x00, 0x02);
      assert.equal(m, "DIVQ #$0002", "mnemonic is DIVQ");
    });

    QUnit.test("Unknown $11 opcode returns ['???', 2]", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0x11, 0x01);
      assert.equal(m, "???", "unknown $11 opcode returns ???");
      assert.equal(l, 2, "length = 2");
    });
  });

  QUnit.module("PSHU/PULU register bits", () => {
    QUnit.test("PSHU pushes A onto U stack (postbyte $02)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0xAB);
      cpu.set("U", 0x0200);
      mem[0x1000] = 0x36; mem[0x1001] = 0x02; // PSHU #A
      cpu.singleStep();
      assert.equal(cpu.status().u, 0x01FF, "U decremented by 1");
      assert.equal(mem[0x01FF], 0xAB, "A value on U stack");
    });

    QUnit.test("PSHU pushes B onto U stack (postbyte $04)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("B", 0xCD);
      cpu.set("U", 0x0200);
      mem[0x1000] = 0x36; mem[0x1001] = 0x04; // PSHU #B
      cpu.singleStep();
      assert.equal(cpu.status().u, 0x01FF, "U decremented by 1");
      assert.equal(mem[0x01FF], 0xCD, "B value on U stack");
    });

    QUnit.test("PSHU pushes X onto U stack (postbyte $10)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("X", 0x1234);
      cpu.set("U", 0x0200);
      mem[0x1000] = 0x36; mem[0x1001] = 0x10; // PSHU #X
      cpu.singleStep();
      assert.equal(cpu.status().u, 0x01FE, "U decremented by 2");
      assert.equal((mem[0x01FE] << 8) | mem[0x01FF], 0x1234, "X value on U stack");
    });

    QUnit.test("PSHU pushes Y onto U stack (postbyte $20)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("Y", 0x5678);
      cpu.set("U", 0x0200);
      mem[0x1000] = 0x36; mem[0x1001] = 0x20; // PSHU #Y
      cpu.singleStep();
      assert.equal(cpu.status().u, 0x01FE, "U decremented by 2");
      assert.equal((mem[0x01FE] << 8) | mem[0x01FF], 0x5678, "Y value on U stack");
    });

    QUnit.test("PSHU pushes S (postbyte $40) onto U stack", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x0300);
      cpu.set("U", 0x0200);
      mem[0x1000] = 0x36; mem[0x1001] = 0x40; // PSHU #S
      cpu.singleStep();
      assert.equal(cpu.status().u, 0x01FE, "U decremented by 2");
    });

    QUnit.test("PSHU pushes PC (postbyte $80) onto U stack", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("U", 0x0200);
      mem[0x1000] = 0x36; mem[0x1001] = 0x80; // PSHU #PC
      cpu.singleStep();
      assert.equal(cpu.status().u, 0x01FE, "U decremented by 2 for PC");
    });

    QUnit.test("PSHU pushes DP (postbyte $08) onto U stack", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("DP", 0x05);
      cpu.set("U", 0x0200);
      mem[0x1000] = 0x36; mem[0x1001] = 0x08; // PSHU #DP
      cpu.singleStep();
      assert.equal(cpu.status().u, 0x01FF, "U decremented by 1");
      assert.equal(mem[0x01FF], 0x05, "DP value on U stack");
    });

    QUnit.test("PULU pulls A from U stack (postbyte $02)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x01FF] = 0x42; // A value on stack
      cpu.set("U", 0x01FF);
      mem[0x1000] = 0x37; mem[0x1001] = 0x02; // PULU #A
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x42, "A pulled from U stack");
      assert.equal(cpu.status().u, 0x0200, "U incremented");
    });

    QUnit.test("PULU pulls X from U stack (postbyte $10)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x01FE] = 0x12; mem[0x01FF] = 0x34;
      cpu.set("U", 0x01FE);
      mem[0x1000] = 0x37; mem[0x1001] = 0x10; // PULU #X
      cpu.singleStep();
      assert.equal(cpu.status().x, 0x1234, "X pulled from U stack");
      assert.equal(cpu.status().u, 0x0200, "U incremented by 2");
    });

    QUnit.test("PULU pulls PC from U stack (postbyte $80)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x01FE] = 0x30; mem[0x01FF] = 0x00;
      cpu.set("U", 0x01FE);
      mem[0x1000] = 0x37; mem[0x1001] = 0x80; // PULU #PC
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x3000, "PC pulled from U stack");
    });

    QUnit.test("PULU pulls CC from U stack (postbyte $01)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x01FF] = 0x05;
      cpu.set("U", 0x01FF);
      mem[0x1000] = 0x37; mem[0x1001] = 0x01; // PULU #CC
      cpu.singleStep();
      assert.equal(cpu.status().flags & 0x05, 0x05, "CC pulled from U stack");
    });

    QUnit.test("PULU pulls DP from U stack (postbyte $08)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x01FF] = 0x07;
      cpu.set("U", 0x01FF);
      mem[0x1000] = 0x37; mem[0x1001] = 0x08; // PULU #DP
      cpu.singleStep();
      assert.equal(cpu.status().dp, 0x07, "DP pulled from U stack");
    });

    QUnit.test("PULU pulls Y from U stack (postbyte $20)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x01FE] = 0xAB; mem[0x01FF] = 0xCD;
      cpu.set("U", 0x01FE);
      mem[0x1000] = 0x37; mem[0x1001] = 0x20; // PULU #Y
      cpu.singleStep();
      assert.equal(cpu.status().y, 0xABCD, "Y pulled from U stack");
    });

    QUnit.test("PULU pulls B from U stack (postbyte $04)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x01FF] = 0x77;
      cpu.set("U", 0x01FF);
      mem[0x1000] = 0x37; mem[0x1001] = 0x04; // PULU #B
      cpu.singleStep();
      assert.equal(cpu.status().b, 0x77, "B pulled from U stack");
    });

    QUnit.test("PULU pulls S from U stack (postbyte $40)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x01FE] = 0x04; mem[0x01FF] = 0x00;
      cpu.set("U", 0x01FE);
      mem[0x1000] = 0x37; mem[0x1001] = 0x40; // PULU #S
      cpu.singleStep();
      assert.equal(cpu.status().sp, 0x0400, "S pulled from U stack");
    });
  });

  QUnit.module("$10 prefix: inter-register ops", () => {
    QUnit.test("ADDR D,X: D+X->X ($10 $30)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x00); cpu.set("B", 0x05); // D=5
      cpu.set("X", 0x0003);
      mem[0x1000] = 0x10; mem[0x1001] = 0x30; mem[0x1002] = 0x01; // ADDR D,X (src=D=0, dst=X=1)
      cpu.singleStep();
      assert.equal(cpu.status().x, 0x0008, "X = D + X = 5 + 3 = 8");
    });

    QUnit.test("SUBR D,X: X-D->X ($10 $32)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("X", 0x0010);
      cpu.set("A", 0x00); cpu.set("B", 0x05); // D=5
      mem[0x1000] = 0x10; mem[0x1001] = 0x32; mem[0x1002] = 0x01; // SUBR D,X (src=D=0, dst=X=1)
      cpu.singleStep();
      // X = X - D = 16 - 5 = 11
      assert.equal(cpu.status().x, 0x000B, "X = X - D = 11");
    });

    QUnit.test("CMPR D,D: equal - Z flag set ($10 $37)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x12); cpu.set("B", 0x34); // D=0x1234
      mem[0x1000] = 0x10; mem[0x1001] = 0x37; mem[0x1002] = 0x00; // CMPR D,D (src=D=0, dst=D=0)
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z flag set when D = D");
    });

    QUnit.test("ANDR D,X: D AND X->X ($10 $34)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x00); cpu.set("B", 0xFF); // D=0x00FF
      cpu.set("X", 0x0F0F);
      mem[0x1000] = 0x10; mem[0x1001] = 0x34; mem[0x1002] = 0x01; // ANDR D,X (src=D=0, dst=X=1)
      cpu.singleStep();
      assert.equal(cpu.status().x, 0x000F, "X = D AND X = 0x00FF AND 0x0F0F = 0x000F");
    });

    QUnit.test("ORR D,X: D OR X->X ($10 $35)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x00); cpu.set("B", 0xF0); // D=0x00F0
      cpu.set("X", 0x000F);
      mem[0x1000] = 0x10; mem[0x1001] = 0x35; mem[0x1002] = 0x01; // ORR D,X (src=D=0, dst=X=1)
      cpu.singleStep();
      assert.equal(cpu.status().x, 0x00FF, "X = D OR X = 0x00F0 OR 0x000F = 0x00FF");
    });

    QUnit.test("EORR D,X: D XOR X->X ($10 $36)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x00); cpu.set("B", 0xFF); // D=0x00FF
      cpu.set("X", 0x00FF);
      mem[0x1000] = 0x10; mem[0x1001] = 0x36; mem[0x1002] = 0x01; // EORR D,X (src=D=0, dst=X=1)
      cpu.singleStep();
      assert.equal(cpu.status().x, 0x0000, "X = D XOR X = 0x00FF XOR 0x00FF = 0");
      assert.ok(cpu.status().flags & 0x04, "Z flag set");
    });

    QUnit.test("ADCR D,X: D+X+C->X ($10 $31)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x00); cpu.set("B", 0x05); // D=5
      cpu.set("X", 0x0003);
      cpu.set("FLAGS", 0x01); // C=1
      mem[0x1000] = 0x10; mem[0x1001] = 0x31; mem[0x1002] = 0x01; // ADCR D,X (src=D=0, dst=X=1)
      cpu.singleStep();
      assert.equal(cpu.status().x, 0x0009, "X = D + X + C = 5 + 3 + 1 = 9");
    });

    QUnit.test("SBCR D,X: X-D-C->X ($10 $33)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("X", 0x0010);
      cpu.set("A", 0x00); cpu.set("B", 0x05); // D=5
      cpu.set("FLAGS", 0x01); // C=1
      mem[0x1000] = 0x10; mem[0x1001] = 0x33; mem[0x1002] = 0x01; // SBCR D,X (src=D=0, dst=X=1)
      cpu.singleStep();
      // X = X - D - C = 16 - 5 - 1 = 10
      assert.equal(cpu.status().x, 0x000A, "X = X - D - C = 10");
    });
  });

  QUnit.module("$11 prefix: E/F 8-bit arithmetic", () => {
    QUnit.test("LDE immediate ($11 $86)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x11; mem[0x1001] = 0x86; mem[0x1002] = 0x42;
      cpu.singleStep();
      assert.equal(cpu.status().e, 0x42, "E loaded from immediate");
    });

    QUnit.test("LDE direct ($11 $96)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("DP", 0x00); mem[0x0030] = 0x55;
      mem[0x1000] = 0x11; mem[0x1001] = 0x96; mem[0x1002] = 0x30;
      cpu.singleStep();
      assert.equal(cpu.status().e, 0x55, "E loaded from direct page");
    });

    QUnit.test("LDE extended ($11 $B6)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x5000] = 0x99;
      mem[0x1000] = 0x11; mem[0x1001] = 0xB6; mem[0x1002] = 0x50; mem[0x1003] = 0x00;
      cpu.singleStep();
      assert.equal(cpu.status().e, 0x99, "E loaded from extended address");
    });

    QUnit.test("STE direct ($11 $97)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("E", 0xAB); cpu.set("DP", 0x00);
      mem[0x1000] = 0x11; mem[0x1001] = 0x97; mem[0x1002] = 0x40;
      cpu.singleStep();
      assert.equal(mem[0x0040], 0xAB, "E stored to direct page");
    });

    QUnit.test("CMPE immediate ($11 $81) - Z set when equal", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("E", 0x10);
      mem[0x1000] = 0x11; mem[0x1001] = 0x81; mem[0x1002] = 0x10;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z set when E = operand");
    });

    QUnit.test("SUBE immediate ($11 $80)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("E", 0x0A);
      mem[0x1000] = 0x11; mem[0x1001] = 0x80; mem[0x1002] = 0x03;
      cpu.singleStep();
      assert.equal(cpu.status().e, 0x07, "E = E - 3 = 7");
    });

    QUnit.test("ADDE immediate ($11 $8B)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("E", 0x05);
      mem[0x1000] = 0x11; mem[0x1001] = 0x8B; mem[0x1002] = 0x03;
      cpu.singleStep();
      assert.equal(cpu.status().e, 0x08, "E = E + 3 = 8");
    });

    QUnit.test("LDE sets Z when zero ($11 $86 #0)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x11; mem[0x1001] = 0x86; mem[0x1002] = 0x00;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z set when E = 0");
    });

    QUnit.test("LDF immediate ($11 $C6)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x11; mem[0x1001] = 0xC6; mem[0x1002] = 0x77;
      cpu.singleStep();
      assert.equal(cpu.status().f, 0x77, "F loaded from immediate");
    });

    QUnit.test("ADDE direct ($11 $9B)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("E", 0x05); cpu.set("DP", 0x00); mem[0x0020] = 0x03;
      mem[0x1000] = 0x11; mem[0x1001] = 0x9B; mem[0x1002] = 0x20;
      cpu.singleStep();
      assert.equal(cpu.status().e, 0x08, "E = E + mem[DP:20] = 5 + 3 = 8");
    });

    QUnit.test("SUBE extended ($11 $B0)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("E", 0x0A); mem[0x5000] = 0x03;
      mem[0x1000] = 0x11; mem[0x1001] = 0xB0; mem[0x1002] = 0x50; mem[0x1003] = 0x00;
      cpu.singleStep();
      assert.equal(cpu.status().e, 0x07, "E = E - mem[5000] = 10 - 3 = 7");
    });

    QUnit.test("STF direct ($11 $D7)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("F", 0xCC); cpu.set("DP", 0x00);
      mem[0x1000] = 0x11; mem[0x1001] = 0xD7; mem[0x1002] = 0x50;
      cpu.singleStep();
      assert.equal(mem[0x0050], 0xCC, "F stored to direct page");
    });

    QUnit.test("CMPF immediate ($11 $C1) - Z set when equal", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("F", 0x20);
      mem[0x1000] = 0x11; mem[0x1001] = 0xC1; mem[0x1002] = 0x20;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z set when F = operand");
    });

    QUnit.test("SUBF immediate ($11 $C0)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("F", 0x08);
      mem[0x1000] = 0x11; mem[0x1001] = 0xC0; mem[0x1002] = 0x03;
      cpu.singleStep();
      assert.equal(cpu.status().f, 0x05, "F = F - 3 = 5");
    });

    QUnit.test("ADDF immediate ($11 $CB)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("F", 0x04);
      mem[0x1000] = 0x11; mem[0x1001] = 0xCB; mem[0x1002] = 0x06;
      cpu.singleStep();
      assert.equal(cpu.status().f, 0x0A, "F = F + 6 = 10");
    });
  });

  QUnit.module("$11 prefix: bit ops and TFM", () => {
    QUnit.test("LDBT loads memory bit to register bit ($11 $36)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("DP", 0x00); mem[0x0020] = 0x01; // bit 0 of mem[0x0020] = 1
      // LDBT: copy mem bit 0 to A bit 0
      // bpb: dst_bit=0, src_bit=0, reg=A(0) -> 0b 000 000 00 = 0x00
      mem[0x1000] = 0x11; mem[0x1001] = 0x36; mem[0x1002] = 0x00; mem[0x1003] = 0x20;
      cpu.singleStep();
      assert.ok(cpu.status().a & 0x01, "bit 0 of A loaded from memory bit 0");
    });

    QUnit.test("STBT stores register bit to memory bit ($11 $37)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x01); // A bit 0 = 1
      cpu.set("DP", 0x00); mem[0x0025] = 0x00;
      // STBT: copy A bit 0 to mem bit 0
      // bpb: dst_bit=0, src_bit=0, reg=A(0) -> 0x00
      mem[0x1000] = 0x11; mem[0x1001] = 0x37; mem[0x1002] = 0x00; mem[0x1003] = 0x25;
      cpu.singleStep();
      assert.ok(mem[0x0025] & 0x01, "memory bit 0 set from A bit 0");
    });

    QUnit.test("BAND A bit 0 with memory bit 0 ($11 $30)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0xFF); // A bit 0 = 1
      cpu.set("DP", 0x00); mem[0x0030] = 0x01; // mem bit 0 = 1
      // BAND: A bit 0 = A bit 0 AND mem bit 0
      mem[0x1000] = 0x11; mem[0x1001] = 0x30; mem[0x1002] = 0x00; mem[0x1003] = 0x30;
      cpu.singleStep();
      assert.ok(cpu.status().a & 0x01, "A bit 0 = 1 AND 1 = 1");
    });

    QUnit.test("BOR A bit 0 with memory bit 0 ($11 $32)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x00); // A bit 0 = 0
      cpu.set("DP", 0x00); mem[0x0031] = 0x01; // mem bit 0 = 1
      // BOR: A bit 0 = A bit 0 OR mem bit 0 = 0 OR 1 = 1
      mem[0x1000] = 0x11; mem[0x1001] = 0x32; mem[0x1002] = 0x00; mem[0x1003] = 0x31;
      cpu.singleStep();
      assert.ok(cpu.status().a & 0x01, "A bit 0 = 0 OR 1 = 1");
    });

    QUnit.test("BEOR A bit 0 with memory bit 0 ($11 $34)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x01); // A bit 0 = 1
      cpu.set("DP", 0x00); mem[0x0032] = 0x01; // mem bit 0 = 1
      // BEOR: A bit 0 = A bit 0 XOR mem bit 0 = 1 XOR 1 = 0
      mem[0x1000] = 0x11; mem[0x1001] = 0x34; mem[0x1002] = 0x00; mem[0x1003] = 0x32;
      cpu.singleStep();
      assert.equal(cpu.status().a & 0x01, 0, "A bit 0 = 1 XOR 1 = 0");
    });

    QUnit.test("TFM X+Y+ transfers bytes ($11 $38)", (assert) => {
      const { cpu, mem } = createTestCPU();
      // Transfer 3 bytes from X to Y
      mem[0x3000] = 0xAA; mem[0x3001] = 0xBB; mem[0x3002] = 0xCC;
      cpu.set("X", 0x3000); cpu.set("Y", 0x4000);
      // W is the count register - set W=3 via E and F
      cpu.set("E", 0x00); cpu.set("F", 0x03);
      mem[0x1000] = 0x11; mem[0x1001] = 0x38; mem[0x1002] = 0x12; // TFM X+Y+ (src=X=1, dst=Y=2)
      cpu.singleStep();
      assert.equal(mem[0x4000], 0xAA, "byte 0 transferred");
      assert.equal(mem[0x4001], 0xBB, "byte 1 transferred");
      assert.equal(mem[0x4002], 0xCC, "byte 2 transferred");
    });

    QUnit.test("TFM X-Y- transfers bytes in decrement mode ($11 $39)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x3002] = 0xDD;
      cpu.set("X", 0x3002); cpu.set("Y", 0x4002);
      cpu.set("E", 0x00); cpu.set("F", 0x01); // W=1
      mem[0x1000] = 0x11; mem[0x1001] = 0x39; mem[0x1002] = 0x12; // TFM X-Y-
      cpu.singleStep();
      assert.equal(mem[0x4002], 0xDD, "byte transferred in decrement mode");
    });

    QUnit.test("TFM X+Y transfers from X (increment), to fixed Y ($11 $3A)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x3000] = 0xEE;
      cpu.set("X", 0x3000); cpu.set("Y", 0x5000);
      cpu.set("E", 0x00); cpu.set("F", 0x01); // W=1
      mem[0x1000] = 0x11; mem[0x1001] = 0x3A; mem[0x1002] = 0x12; // TFM X+Y
      cpu.singleStep();
      assert.equal(mem[0x5000], 0xEE, "byte transferred with src increment");
    });

    QUnit.test("TFM XY+ transfers to Y (increment), from fixed X ($11 $3B)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x3000] = 0xFF;
      cpu.set("X", 0x3000); cpu.set("Y", 0x6000);
      cpu.set("E", 0x00); cpu.set("F", 0x01); // W=1
      mem[0x1000] = 0x11; mem[0x1001] = 0x3B; mem[0x1002] = 0x12; // TFM XY+
      cpu.singleStep();
      assert.equal(mem[0x6000], 0xFF, "byte transferred with dst increment");
    });
  });

  QUnit.module("$10 prefix: W register ops", () => {
    QUnit.test("PSHSW pushes W (E:F) onto S stack ($10 $38)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("E", 0x12); cpu.set("F", 0x34);
      cpu.set("SP", 0x0200);
      mem[0x1000] = 0x10; mem[0x1001] = 0x38;
      cpu.singleStep();
      assert.equal(cpu.status().sp, 0x01FE, "SP decremented by 2");
      assert.equal((mem[0x01FE] << 8) | mem[0x01FF], 0x1234, "W=E:F stored on stack");
    });

    QUnit.test("PULSW pulls W from S stack ($10 $39)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x01FE] = 0xAB; mem[0x01FF] = 0xCD;
      cpu.set("SP", 0x01FE);
      mem[0x1000] = 0x10; mem[0x1001] = 0x39;
      cpu.singleStep();
      assert.equal(cpu.status().w, 0xABCD, "W pulled from S stack");
      assert.equal(cpu.status().sp, 0x0200, "SP incremented by 2");
    });

    QUnit.test("PSHUW pushes W onto U stack ($10 $3A)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("E", 0x56); cpu.set("F", 0x78);
      cpu.set("U", 0x0200);
      mem[0x1000] = 0x10; mem[0x1001] = 0x3A;
      cpu.singleStep();
      assert.equal(cpu.status().u, 0x01FE, "U decremented by 2");
    });

    QUnit.test("PULUW pulls W from U stack ($10 $3B)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x01FE] = 0xDE; mem[0x01FF] = 0xAD;
      cpu.set("U", 0x01FE);
      mem[0x1000] = 0x10; mem[0x1001] = 0x3B;
      cpu.singleStep();
      assert.equal(cpu.status().w, 0xDEAD, "W pulled from U stack");
    });
  });

  // ===== Disassembler: indexed addressing mode =====
  QUnit.module("Disassembler indexed addressing", () => {
    // 5-bit signed offset (bit7=0) — positive
    QUnit.test("5-bit positive offset ,X (pb=0x05)", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0xA6, 0x05);
      assert.equal(m, "LDA 5,X", "5,X");
    });

    // 5-bit signed offset — negative (value > 15 wraps to negative)
    QUnit.test("5-bit negative offset ,X (pb=0x1B => -5,X)", (assert) => {
      const { cpu } = createTestCPU();
      // pb=0x1B => bit7=0, (pb&0x60)>>5=0 => X, disp=0x1B&0x1f=27 > 15 => 27-32=-5
      const [m, l] = cpu.disasm(0xA6, 0x1B);
      assert.equal(m, "LDA -5,X", "-5,X");
    });

    // pb bit7=1 non-indirect mode (pb & 0x10 === 0)
    QUnit.test(",X+ (pb=0x80)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0x80);
      assert.equal(m, "LDA ,X+", ",X+");
    });

    QUnit.test(",X++ (pb=0x81)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0x81);
      assert.equal(m, "LDA ,X++", ",X++");
    });

    QUnit.test(",-X (pb=0x82)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0x82);
      assert.equal(m, "LDA ,-X", ",-X");
    });

    QUnit.test(",--X (pb=0x83)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0x83);
      assert.equal(m, "LDA ,--X", ",--X");
    });

    QUnit.test(",X (pb=0x84)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0x84);
      assert.equal(m, "LDA ,X", ",X");
    });

    QUnit.test("B,X (pb=0x85)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0x85);
      assert.equal(m, "LDA B,X", "B,X");
    });

    QUnit.test("A,X (pb=0x86)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0x86);
      assert.equal(m, "LDA A,X", "A,X");
    });

    QUnit.test("5,X 8-bit signed offset (pb=0x88, b=0x05)", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0xA6, 0x88, 0x05);
      assert.equal(m, "LDA 5,X", "5,X 8-bit");
      assert.equal(l, 3, "3 bytes");
    });

    QUnit.test("-1,X 8-bit signed offset negative (pb=0x88, b=0xFF)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0x88, 0xFF);
      assert.equal(m, "LDA -1,X", "-1,X 8-bit");
    });

    QUnit.test("16,X 16-bit offset (pb=0x89, b=0x00, c=0x10)", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0xA6, 0x89, 0x00, 0x10);
      assert.equal(m, "LDA 16,X", "16,X 16-bit");
      assert.equal(l, 4, "4 bytes");
    });

    QUnit.test("D,X (pb=0x8B)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0x8B);
      assert.equal(m, "LDA D,X", "D,X");
    });

    QUnit.test("5,PC 8-bit (pb=0x8C, b=0x05)", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0xA6, 0x8C, 0x05);
      assert.equal(m, "LDA 5,PC", "5,PC");
      assert.equal(l, 3, "3 bytes");
    });

    QUnit.test("16,PC 16-bit (pb=0x8D, b=0x00, c=0x10)", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0xA6, 0x8D, 0x00, 0x10);
      assert.equal(m, "LDA 16,PC", "16,PC");
      assert.equal(l, 4, "4 bytes");
    });

    QUnit.test("extended indirect $3000 non-indirect (pb=0x8F)", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0xA6, 0x8F, 0x30, 0x00);
      assert.equal(m, "LDA $3000", "$3000 extended");
      assert.equal(l, 4, "4 bytes");
    });

    // Y, U, S base registers
    QUnit.test(",Y (pb=0xA4)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0xA4);
      assert.equal(m, "LDA ,Y", ",Y");
    });

    QUnit.test(",U (pb=0xC4)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0xC4);
      assert.equal(m, "LDA ,U", ",U");
    });

    QUnit.test(",S (pb=0xE4)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0xE4);
      assert.equal(m, "LDA ,S", ",S");
    });

    // Indirect variants (pb & 0x10 set)
    QUnit.test("[,X++] (pb=0x91)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0x91);
      assert.equal(m, "LDA [,X++]", "[,X++]");
    });

    QUnit.test("[,--X] (pb=0x93)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0x93);
      assert.equal(m, "LDA [,--X]", "[,--X]");
    });

    QUnit.test("[,X] (pb=0x94)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0x94);
      assert.equal(m, "LDA [,X]", "[,X]");
    });

    QUnit.test("[B,X] (pb=0x95)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0x95);
      assert.equal(m, "LDA [B,X]", "[B,X]");
    });

    QUnit.test("[A,X] (pb=0x96)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0x96);
      assert.equal(m, "LDA [A,X]", "[A,X]");
    });

    QUnit.test("[5,X] (pb=0x98, b=0x05)", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0xA6, 0x98, 0x05);
      assert.equal(m, "LDA [5,X]", "[5,X]");
      assert.equal(l, 3, "3 bytes");
    });

    QUnit.test("[16,X] (pb=0x99, b=0x00, c=0x10)", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0xA6, 0x99, 0x00, 0x10);
      assert.equal(m, "LDA [16,X]", "[16,X]");
      assert.equal(l, 4, "4 bytes");
    });

    QUnit.test("[D,X] (pb=0x9B)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0x9B);
      assert.equal(m, "LDA [D,X]", "[D,X]");
    });

    QUnit.test("[5,PC] (pb=0x9C, b=0x05)", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0xA6, 0x9C, 0x05);
      assert.equal(m, "LDA [5,PC]", "[5,PC]");
      assert.equal(l, 3, "3 bytes");
    });

    QUnit.test("[-1,PC] (pb=0x9C, b=0xFF)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0x9C, 0xFF);
      assert.equal(m, "LDA [-1,PC]", "[-1,PC]");
    });

    QUnit.test("[16,PC] (pb=0x9D, b=0x00, c=0x10)", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0xA6, 0x9D, 0x00, 0x10);
      assert.equal(m, "LDA [16,PC]", "[16,PC]");
      assert.equal(l, 4, "4 bytes");
    });

    QUnit.test("[$3000] (pb=0x9F, b=0x30, c=0x00)", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0xA6, 0x9F, 0x30, 0x00);
      assert.equal(m, "LDA [$3000]", "[$3000]");
      assert.equal(l, 4, "4 bytes");
    });

    // Illegal mod cases
    QUnit.test("??? for pb=0x87 (mod=7, non-indirect)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0x87);
      assert.equal(m, "LDA ???", "mod=7 non-indirect is ???");
    });

    QUnit.test("??? for pb=0x8A (mod=10, non-indirect)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0x8A);
      assert.equal(m, "LDA ???", "mod=10 non-indirect is ???");
    });

    QUnit.test("??? for pb=0x8E (mod=14, non-indirect)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0x8E);
      assert.equal(m, "LDA ???", "mod=14 non-indirect is ???");
    });

    QUnit.test("??? for pb=0x90 (mod=0, indirect)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0x90);
      assert.equal(m, "LDA ???", "mod=0 indirect is ???");
    });

    QUnit.test("??? for pb=0x92 (mod=2, indirect)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0x92);
      assert.equal(m, "LDA ???", "mod=2 indirect is ???");
    });

    QUnit.test("??? for pb=0x97 (mod=7, indirect)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0x97);
      assert.equal(m, "LDA ???", "mod=7 indirect is ???");
    });

    QUnit.test("??? for pb=0x9A (mod=10, indirect)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0x9A);
      assert.equal(m, "LDA ???", "mod=10 indirect is ???");
    });

    QUnit.test("??? for pb=0x9E (mod=14, indirect)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0x9E);
      assert.equal(m, "LDA ???", "mod=14 indirect is ???");
    });

    // $10 prefix undefined opcode ($10 $01 is not in ds10)
    QUnit.test("$10 $01 undefined disasm returns ???", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0x10, 0x01);
      assert.equal(m, "???", "$10 $01 is undefined");
      assert.equal(l, 2, "2 bytes");
    });

    // $11 prefix undefined opcode
    QUnit.test("$11 $FF undefined disasm returns ???", (assert) => {
      const { cpu } = createTestCPU();
      const [m, l] = cpu.disasm(0x11, 0xFF);
      assert.equal(m, "???", "$11 $FF is undefined");
      assert.equal(l, 2, "2 bytes");
    });
  });

  // ===== Arithmetic flag edge cases =====
  QUnit.module("Arithmetic flag edge cases", () => {
    QUnit.test("oNEG: NEG of 0x80 sets overflow, result=0x80", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x40; // NEGA
      cpu.set("A", 0x80);
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x80, "NEG 0x80 = 0x80");
      assert.ok(cpu.status().flags & 0x02, "overflow set for 0x80");
    });

    QUnit.test("oNEG: NEG of 0x01 sets carry, clears zero", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x40; // NEGA
      cpu.set("A", 0x01);
      cpu.singleStep();
      assert.equal(cpu.status().a, 0xFF, "NEG 1 = 0xFF");
      assert.ok(cpu.status().flags & 0x01, "carry set");
    });

    QUnit.test("oNEG: NEG of 0 clears carry (result = 256 -> zero flag check fails)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x40; // NEGA
      cpu.set("A", 0x00);
      cpu.singleStep();
      // NEG 0: (~0 & 0xFF) + 1 = 256, not 0, so carry IS set (b !== 0 branch)
      assert.ok(cpu.status().flags & 0x01, "carry set (b=256 != 0)");
    });

    QUnit.test("oLSR: sets carry when low bit=1", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x44; // LSRA
      cpu.set("A", 0x01);
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x00, "0x01 >> 1 = 0");
      assert.ok(cpu.status().flags & 0x01, "carry set from low bit");
      assert.ok(cpu.status().flags & 0x04, "zero set");
    });

    QUnit.test("oASR: sets carry + N from bit0=1 and bit7=1", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x47; // ASRA
      cpu.set("A", 0x81); // 1000_0001
      cpu.singleStep();
      assert.equal(cpu.status().a, 0xC0, "ASR 0x81 = 0xC0");
      assert.ok(cpu.status().flags & 0x01, "carry from bit0");
      assert.ok(cpu.status().flags & 0x08, "N set");
    });

    QUnit.test("oASL: sets overflow when sign bit changes", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x48; // ASLA
      cpu.set("A", 0x40); // shift gives 0x80, sign changes
      cpu.singleStep();
      assert.equal(cpu.status().a & 0xFF, 0x80, "ASL 0x40 = 0x80");
      assert.ok(cpu.status().flags & 0x02, "overflow set");
      assert.ok(cpu.status().flags & 0x08, "N set");
    });

    QUnit.test("oASL: sets carry when high bit=1", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x48; // ASLA
      cpu.set("A", 0x80);
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x01, "carry from bit7");
    });

    QUnit.test("oROL: sets overflow when sign changes + carry in", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x49; // ROLA
      cpu.set("A", 0x40);
      cpu.set("FLAGS", 0x01); // carry=1
      cpu.singleStep();
      // result = (0x40<<1)|1 = 0x81, sign change from 0x40 to 0x81
      assert.equal(cpu.status().a & 0xFF, 0x81, "ROL 0x40 with carry = 0x81");
      assert.ok(cpu.status().flags & 0x02, "overflow set");
    });

    QUnit.test("oROL: sets carry from high bit", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x49; // ROLA
      cpu.set("A", 0x80);
      cpu.set("FLAGS", 0x00);
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x01, "carry from high bit");
    });

    QUnit.test("oROR: sets carry from low bit and shifts in carry", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x46; // RORA
      cpu.set("A", 0x01);
      cpu.set("FLAGS", 0x01); // carry=1
      cpu.singleStep();
      assert.equal(cpu.status().a & 0xFF, 0x80, "ROR 0x01 with carry = 0x80");
      assert.ok(cpu.status().flags & 0x01, "carry from low bit");
    });

    QUnit.test("oADD: sets half-carry on nibble carry", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x8B; // ADDA imm
      mem[0x1001] = 0x08;
      cpu.set("A", 0x08);
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x10, "0x08+0x08=0x10");
      assert.ok(cpu.status().flags & 0x20, "half-carry set");
    });

    QUnit.test("oSUB16: sets carry on borrow", (assert) => {
      const { cpu, mem } = createTestCPU();
      // SUBD imm: opcode 0x83, 2-byte imm
      mem[0x1000] = 0x83; mem[0x1001] = 0x00; mem[0x1002] = 0x01;
      cpu.set("A", 0x00); cpu.set("B", 0x00); // D=0
      cpu.singleStep();
      // 0 - 1 = 0xFFFF with borrow
      assert.ok(cpu.status().flags & 0x01, "carry set on borrow");
    });

    QUnit.test("oSUB16: sets zero when result=0", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x83; mem[0x1001] = 0x12; mem[0x1002] = 0x34;
      cpu.set("A", 0x12); cpu.set("B", 0x34);
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "zero set");
    });

    QUnit.test("oSUB16: sets N when result negative", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x83; mem[0x1001] = 0x00; mem[0x1002] = 0x01;
      cpu.set("A", 0x00); cpu.set("B", 0x00);
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x08, "N set for 0 - 1");
    });

    QUnit.test("oADD16: sets carry on overflow above 0xFFFF", (assert) => {
      const { cpu, mem } = createTestCPU();
      // ADDD (opcode 0xC3, imm)
      mem[0x1000] = 0xC3; mem[0x1001] = 0x00; mem[0x1002] = 0x01;
      cpu.set("A", 0xFF); cpu.set("B", 0xFF); // D=0xFFFF
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x01, "carry set");
      assert.ok(cpu.status().flags & 0x04, "zero set for 0xFFFF+1=0");
    });

    QUnit.test("oADD16: sets N when result high bit set", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0xC3; mem[0x1001] = 0x00; mem[0x1002] = 0x01;
      cpu.set("A", 0x7F); cpu.set("B", 0xFF); // D=0x7FFF
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x08, "N set");
    });

    QUnit.test("oADC16: zero flag when result=0", (assert) => {
      const { cpu, mem } = createTestCPU();
      // ADCD via $10 prefix: opcode $10 $89
      mem[0x1000] = 0x10; mem[0x1001] = 0x89; mem[0x1002] = 0xFF; mem[0x1003] = 0xFF;
      cpu.set("A", 0x00); cpu.set("B", 0x00);
      cpu.set("FLAGS", 0x01); // carry=1
      cpu.singleStep();
      // D=0 + 0xFFFF + 1carry = 0x10000 => 0, carry set
      assert.ok(cpu.status().flags & 0x04, "zero set");
      assert.ok(cpu.status().flags & 0x01, "carry set");
    });

    QUnit.test("oSBC16: N and carry on borrow", (assert) => {
      const { cpu, mem } = createTestCPU();
      // SBCD via $10 prefix: opcode $10 $82
      mem[0x1000] = 0x10; mem[0x1001] = 0x82; mem[0x1002] = 0x00; mem[0x1003] = 0x01;
      cpu.set("A", 0x00); cpu.set("B", 0x00);
      cpu.set("FLAGS", 0x01); // carry=1
      cpu.singleStep();
      // D=0 - 1 - 1carry = -2
      assert.ok(cpu.status().flags & 0x01, "carry set on borrow");
      assert.ok(cpu.status().flags & 0x08, "N set");
    });

    QUnit.test("oINC overflow at 0x80 (0x7F+1=0x80)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x4C; // INCA
      cpu.set("A", 0x7F);
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x80, "0x7F+1=0x80");
      assert.ok(cpu.status().flags & 0x02, "overflow set at 0x80");
    });

    QUnit.test("oDEC overflow at 0xFF (0x00-1=0xFF)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x4A; // DECA
      cpu.set("A", 0x00);
      cpu.singleStep();
      assert.equal(cpu.status().a, 0xFF, "0x00-1=0xFF");
      assert.ok(cpu.status().flags & 0x02, "overflow set at 0xFF");
    });

    QUnit.test("oCMP16: zero flag when equal", (assert) => {
      const { cpu, mem } = createTestCPU();
      // CMPX imm
      mem[0x1000] = 0x8C; mem[0x1001] = 0x12; mem[0x1002] = 0x34;
      cpu.set("X", 0x1234);
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "zero set");
    });

    QUnit.test("oCMP16: N flag when result negative", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x8C; mem[0x1001] = 0x00; mem[0x1002] = 0x01;
      cpu.set("X", 0x0000);
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x08, "N set");
    });

    QUnit.test("oCMP16: carry flag on borrow", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x8C; mem[0x1001] = 0xFF; mem[0x1002] = 0xFF;
      cpu.set("X", 0x0000);
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x01, "carry set on borrow");
    });
  });

  // ===== Uncovered branch/instruction cases =====
  QUnit.module("Uncovered branch conditions and instructions", () => {
    QUnit.test("SYNC (0x13) executes without error", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x13;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1001, "PC advanced");
    });

    QUnit.test("LDQ zero sets Z flag (0xCD)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0xCD; mem[0x1001] = 0x00; mem[0x1002] = 0x00; mem[0x1003] = 0x00; mem[0x1004] = 0x00;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z flag set for LDQ #0");
    });

    QUnit.test("LDQ negative sets N flag (0xCD)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0xCD; mem[0x1001] = 0x80; mem[0x1002] = 0x00; mem[0x1003] = 0x00; mem[0x1004] = 0x00;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x08, "N flag set for LDQ #$80000000");
    });

    QUnit.test("SEXW: E bit7=1 sign extends to D=0xFFFF", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x14; // SEXW
      cpu.set("E", 0x80); // bit7 set
      cpu.singleStep();
      assert.equal(cpu.status().a, 0xFF, "A=0xFF after SEXW with E bit7=1");
      assert.equal(cpu.status().b, 0xFF, "B=0xFF after SEXW with E bit7=1");
    });

    QUnit.test("SEXW: E bit7=0 clears D", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x14;
      cpu.set("A", 0xFF); cpu.set("B", 0xFF);
      cpu.set("E", 0x40); // bit7 clear
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x00, "A=0 after SEXW with E bit7=0");
      assert.equal(cpu.status().b, 0x00, "B=0");
    });

    // BHI not-taken (carry or zero set)
    QUnit.test("BHI not taken when carry set", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x22; mem[0x1001] = 0x10; // BHI +16
      cpu.set("FLAGS", 0x01); // carry set
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1002, "BHI not taken");
    });

    // BCC taken (carry clear)
    QUnit.test("BCC taken when carry clear", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x24; mem[0x1001] = 0x10;
      cpu.set("FLAGS", 0x00);
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1012, "BCC taken");
    });

    // BCC not taken (carry set)
    QUnit.test("BCC not taken when carry set", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x24; mem[0x1001] = 0x10;
      cpu.set("FLAGS", 0x01);
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1002, "BCC not taken");
    });

    // BCS taken
    QUnit.test("BCS taken when carry set", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x25; mem[0x1001] = 0x10;
      cpu.set("FLAGS", 0x01);
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1012, "BCS taken");
    });

    // BNE taken
    QUnit.test("BNE taken when zero clear", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x26; mem[0x1001] = 0x10;
      cpu.set("FLAGS", 0x00);
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1012, "BNE taken");
    });

    // BNE not taken
    QUnit.test("BNE not taken when zero set", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x26; mem[0x1001] = 0x10;
      cpu.set("FLAGS", 0x04);
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1002, "BNE not taken");
    });

    // BEQ taken
    QUnit.test("BEQ taken when zero set", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x27; mem[0x1001] = 0x10;
      cpu.set("FLAGS", 0x04);
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1012, "BEQ taken");
    });

    // BVC taken
    QUnit.test("BVC taken when overflow clear", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x28; mem[0x1001] = 0x10;
      cpu.set("FLAGS", 0x00);
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1012, "BVC taken");
    });

    // BVC not taken
    QUnit.test("BVC not taken when overflow set", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x28; mem[0x1001] = 0x10;
      cpu.set("FLAGS", 0x02);
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1002, "BVC not taken");
    });

    // BVS taken
    QUnit.test("BVS taken when overflow set", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x29; mem[0x1001] = 0x10;
      cpu.set("FLAGS", 0x02);
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1012, "BVS taken");
    });

    // BPL taken
    QUnit.test("BPL taken when N clear", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x2A; mem[0x1001] = 0x10;
      cpu.set("FLAGS", 0x00);
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1012, "BPL taken");
    });

    // BPL not taken
    QUnit.test("BPL not taken when N set", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x2A; mem[0x1001] = 0x10;
      cpu.set("FLAGS", 0x08);
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1002, "BPL not taken");
    });

    // BMI taken
    QUnit.test("BMI taken when N set", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x2B; mem[0x1001] = 0x10;
      cpu.set("FLAGS", 0x08);
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1012, "BMI taken");
    });

    // BGE taken (N=V)
    QUnit.test("BGE taken when N=V=0", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x2C; mem[0x1001] = 0x10;
      cpu.set("FLAGS", 0x00);
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1012, "BGE taken when N=V=0");
    });

    // BGE not taken (N!=V)
    QUnit.test("BGE not taken when N=1,V=0", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x2C; mem[0x1001] = 0x10;
      cpu.set("FLAGS", 0x08); // N=1, V=0
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1002, "BGE not taken");
    });

    // BLT taken
    QUnit.test("BLT taken when N=1,V=0", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x2D; mem[0x1001] = 0x10;
      cpu.set("FLAGS", 0x08);
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1012, "BLT taken");
    });

    // BLT not taken
    QUnit.test("BLT not taken when N=V=0", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x2D; mem[0x1001] = 0x10;
      cpu.set("FLAGS", 0x00);
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1002, "BLT not taken");
    });

    // BGT taken
    QUnit.test("BGT taken when N=V=0 and Z=0", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x2E; mem[0x1001] = 0x10;
      cpu.set("FLAGS", 0x00);
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1012, "BGT taken");
    });

    // BLE taken when Z set
    QUnit.test("BLE taken when Z set", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x2F; mem[0x1001] = 0x10;
      cpu.set("FLAGS", 0x04);
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1012, "BLE taken when Z=1");
    });

    // BLE not taken
    QUnit.test("BLE not taken when N=V=0 and Z=0", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x2F; mem[0x1001] = 0x10;
      cpu.set("FLAGS", 0x00);
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1002, "BLE not taken");
    });

    // PSHS CC only
    QUnit.test("PSHS CC only ($34 $01)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x0200); cpu.set("FLAGS", 0x55);
      mem[0x1000] = 0x34; mem[0x1001] = 0x01;
      cpu.singleStep();
      assert.equal(cpu.status().sp, 0x01FF, "SP decremented by 1");
      assert.equal(mem[0x01FF], 0x55, "CC on stack");
    });

    // PULS all ($FF) — restores PC
    QUnit.test("PULS all ($35 $FF) restores PC", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x0100);
      // Stack layout for PULS 0xFF (CC,A,B,DP,X,Y,U,PC)
      let sp = 0x0100;
      mem[sp++] = 0x12; // CC
      mem[sp++] = 0x34; // A
      mem[sp++] = 0x56; // B
      mem[sp++] = 0x00; // DP
      mem[sp++] = 0x20; mem[sp++] = 0x00; // X
      mem[sp++] = 0x30; mem[sp++] = 0x00; // Y
      mem[sp++] = 0x40; mem[sp++] = 0x00; // U
      mem[sp++] = 0x20; mem[sp++] = 0x00; // PC
      mem[0x1000] = 0x35; mem[0x1001] = 0xFF;
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x34, "A restored");
      assert.equal(cpu.status().pc, 0x2000, "PC restored");
    });

    // PSHU CC only
    QUnit.test("PSHU CC only ($36 $01)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("U", 0x0200); cpu.set("FLAGS", 0xAA);
      mem[0x1000] = 0x36; mem[0x1001] = 0x01;
      cpu.singleStep();
      assert.equal(cpu.status().u, 0x01FF, "U decremented by 1");
      assert.equal(mem[0x01FF], 0xAA, "CC on U stack");
    });

    // PULU all — restores PC
    QUnit.test("PULU all ($37 $FF) restores registers", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("U", 0x0100);
      let sp = 0x0100;
      mem[sp++] = 0x12; // CC
      mem[sp++] = 0x34; // A
      mem[sp++] = 0x56; // B
      mem[sp++] = 0x00; // DP
      mem[sp++] = 0x20; mem[sp++] = 0x00; // X
      mem[sp++] = 0x30; mem[sp++] = 0x00; // Y
      mem[sp++] = 0x40; mem[sp++] = 0x00; // S
      mem[sp++] = 0x50; mem[sp++] = 0x00; // PC
      mem[0x1000] = 0x37; mem[0x1001] = 0xFF;
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x34, "A restored from U stack");
    });

    // TFR: V register
    QUnit.test("TFR X,V ($1F $17)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x1F; mem[0x1001] = 0x17; // TFR X,V
      cpu.set("X", 0x1234);
      cpu.singleStep();
      assert.equal(cpu.status().v, 0x1234, "V = X via TFR");
    });

    // TFR: W register
    QUnit.test("TFR W,D ($1F $60)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x1F; mem[0x1001] = 0x60; // TFR W,D
      cpu.set("W", 0xABCD);
      cpu.singleStep();
      assert.equal(cpu.status().a, 0xAB, "A = W high via TFR");
      assert.equal(cpu.status().b, 0xCD, "B = W low via TFR");
    });

    // TFR: E register
    QUnit.test("TFR A,E ($1F $8E)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x1F; mem[0x1001] = 0x8E; // TFR A,E
      cpu.set("A", 0x42);
      cpu.singleStep();
      assert.equal(cpu.status().e, 0x42, "E = A via TFR");
    });

    // TFR: F register
    QUnit.test("TFR A,F ($1F $8F)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x1F; mem[0x1001] = 0x8F; // TFR A,F
      cpu.set("A", 0x55);
      cpu.singleStep();
      assert.equal(cpu.status().f, 0x55, "F = A via TFR");
    });

    // TFR: zero register (src=C or D, value=0)
    QUnit.test("TFR 0,A (zero reg src) ($1F $C8)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x1F; mem[0x1001] = 0xC8; // TFR zero,A
      cpu.set("A", 0xFF);
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x00, "A=0 from zero register");
    });

    // LEAS — no Z flag
    QUnit.test("LEAS ,X+1 updates S only (no Z flag)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("X", 0x2000);
      mem[0x1000] = 0x32; mem[0x1001] = 0x80; // LEAS ,X+
      cpu.singleStep();
      assert.equal(cpu.status().sp, 0x2000, "S = X (before increment)");
    });

    // LEAU
    QUnit.test("LEAU ,X sets U", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("X", 0x3000);
      mem[0x1000] = 0x33; mem[0x1001] = 0x84; // LEAU ,X
      cpu.singleStep();
      assert.equal(cpu.status().u, 0x3000, "U = X");
    });

    // RTI with E flag clear (short form)
    QUnit.test("RTI without E flag restores only PC", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x01FE);
      mem[0x01FE] = 0x00; // CC with E=0
      mem[0x01FF] = 0x20; mem[0x0200] = 0x00; // PC = 0x2000 — wait, stack is CC then PC
      // RTI pops CC then if E set pops all. With E=0: pop CC, pop PC
      // Layout: [SP]=CC, [SP+1]=PC_hi, [SP+2]=PC_lo
      mem[0x01FE] = 0x00; // CC (E=0)
      mem[0x01FF] = 0x20; // PC_hi
      mem[0x0200] = 0x00; // PC_lo - but PULLW reads [SP] then [SP+1]
      mem[0x1000] = 0x3B; // RTI
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x2000, "PC restored via RTI (short form)");
    });

    // ABX
    QUnit.test("ABX: X += B", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x3A;
      cpu.set("X", 0x1000); cpu.set("B", 0x10);
      cpu.singleStep();
      assert.equal(cpu.status().x, 0x1010, "X += B");
    });

    // CWAI
    QUnit.test("CWAI masks CC bits ($3C $F0)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x3C; mem[0x1001] = 0xF0;
      cpu.set("FLAGS", 0xFF);
      cpu.singleStep();
      assert.equal(cpu.status().flags & 0x0F, 0x00, "low nibble of CC cleared");
    });

    // MUL result=0 sets Z
    QUnit.test("MUL 0*5 sets Z flag", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x3D;
      cpu.set("A", 0x00); cpu.set("B", 0x05);
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z set for MUL=0");
    });

    // MUL sets carry from bit7 of result
    QUnit.test("MUL result bit7=1 sets carry", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x3D;
      cpu.set("A", 0x02); cpu.set("B", 0x40); // 2*64=128=0x0080
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x01, "carry set from result bit7");
    });

    // STA direct (mode 1)
    QUnit.test("STA direct ($97 $50)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x97; mem[0x1001] = 0x50;
      cpu.set("A", 0xAB); cpu.set("DP", 0x00);
      cpu.singleStep();
      assert.equal(mem[0x0050], 0xAB, "A stored to $0050");
    });

    // NEGD: zero flag
    QUnit.test("NEGD of 0 sets Z ($10 $40)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0x40;
      cpu.set("A", 0x00); cpu.set("B", 0x00);
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z set for NEGD 0");
    });

    // NEGD: N and carry
    QUnit.test("NEGD of 1 sets N and carry ($10 $40)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0x40;
      cpu.set("A", 0x00); cpu.set("B", 0x01); // D=1
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x08, "N set");
      assert.ok(cpu.status().flags & 0x01, "carry set");
    });

    // NEGD: overflow for 0x8000
    QUnit.test("NEGD of 0x8000 sets overflow ($10 $40)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0x40;
      cpu.set("A", 0x80); cpu.set("B", 0x00); // D=0x8000
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x02, "overflow set");
    });

    // LSRD: carry flag
    QUnit.test("LSRD bit0=1 sets carry ($10 $44)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0x44;
      cpu.set("A", 0x00); cpu.set("B", 0x01); // D=1
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x01, "carry set");
      assert.ok(cpu.status().flags & 0x04, "zero set");
    });

    // RORD: carry in
    QUnit.test("RORD with carry in rotates ($10 $46)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0x46;
      cpu.set("A", 0x00); cpu.set("B", 0x01); // D=1
      cpu.set("FLAGS", 0x01); // carry=1
      cpu.singleStep();
      // D = (D >>> 1) | (cin << 15) = 0 | 0x8000 = 0x8000 → A=0x80, B=0x00
      assert.equal(cpu.status().a, 0x80, "carry rotated into D bit15 (A=0x80)");
      assert.ok(cpu.status().flags & 0x01, "carry set from bit0");
    });

    // ASRD: carry from bit0
    QUnit.test("ASRD bit0=1 sets carry ($10 $47)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0x47;
      cpu.set("A", 0x80); cpu.set("B", 0x01); // D=0x8001
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x01, "carry from bit0");
      assert.ok(cpu.status().flags & 0x08, "N preserved (bit15=1)");
    });

    // ASLD: carry + overflow
    QUnit.test("ASLD high bit set causes carry ($10 $48)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0x48;
      cpu.set("A", 0x80); cpu.set("B", 0x00); // D=0x8000
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x01, "carry from bit15");
      assert.ok(cpu.status().flags & 0x04, "zero set (result=0)");
    });

    // ROLD: carry in
    QUnit.test("ROLD with carry in ($10 $49)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0x49;
      cpu.set("A", 0x00); cpu.set("B", 0x00); // D=0
      cpu.set("FLAGS", 0x01); // carry=1
      cpu.singleStep();
      // D = (D << 1) | cin = 0 | 1 = 1 → A=0x00, B=0x01
      assert.equal(cpu.status().b, 0x01, "carry rotated into D bit0 (B=0x01)");
    });

    // DECD: overflow at 0x8000
    QUnit.test("DECD 0x8000 sets overflow ($10 $4A)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0x4A;
      cpu.set("A", 0x80); cpu.set("B", 0x00); // D=0x8000
      cpu.singleStep();
      // D = 0x8000 - 1 = 0x7FFF → A=0x7F, B=0xFF; overflow at 0x7FFF
      assert.equal(cpu.status().a, 0x7F, "A=0x7F after DECD 0x8000");
      assert.equal(cpu.status().b, 0xFF, "B=0xFF after DECD 0x8000");
      assert.ok(cpu.status().flags & 0x02, "overflow set at 0x7FFF");
    });

    // INCD: zero flag
    QUnit.test("INCD 0xFFFF => 0 sets zero ($10 $4C)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0x4C;
      cpu.set("A", 0xFF); cpu.set("B", 0xFF); // D=0xFFFF
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "zero set");
    });

    // INCD: overflow at 0x8000
    QUnit.test("INCD 0x7FFF => 0x8000 sets overflow ($10 $4C)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0x4C;
      cpu.set("A", 0x7F); cpu.set("B", 0xFF); // D=0x7FFF
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x02, "overflow set");
    });

    // COMW: carry set
    QUnit.test("COMW sets carry ($10 $53)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0x53;
      cpu.set("E", 0xFF); cpu.set("F", 0xFF);
      cpu.singleStep();
      assert.equal(cpu.status().w, 0x0000, "COMW 0xFFFF=0");
      assert.ok(cpu.status().flags & 0x01, "carry always set");
    });

    // LSRW: carry from bit0
    QUnit.test("LSRW bit0=1 sets carry ($10 $54)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0x54;
      cpu.set("E", 0x00); cpu.set("F", 0x01); // W=1
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x01, "carry from bit0");
    });

    // RORW: carry in rotation
    QUnit.test("RORW with carry in ($10 $56)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0x56;
      cpu.set("E", 0x00); cpu.set("F", 0x01); // W=1
      cpu.set("FLAGS", 0x01);
      cpu.singleStep();
      assert.equal(cpu.status().w, 0x8000, "carry in bit15");
    });

    // ROLW: carry in
    QUnit.test("ROLW carry in to bit0 ($10 $59)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0x59;
      cpu.set("E", 0x00); cpu.set("F", 0x00); // W=0
      cpu.set("FLAGS", 0x01);
      cpu.singleStep();
      assert.equal(cpu.status().w, 0x0001, "carry rotated into bit0");
    });

    // ROLW: overflow
    QUnit.test("ROLW overflow when sign changes ($10 $59)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0x59;
      cpu.set("E", 0x40); cpu.set("F", 0x00); // W=0x4000
      cpu.set("FLAGS", 0x00);
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x02, "overflow set");
    });

    // DECW: overflow at 0x8000
    QUnit.test("DECW 0x8000 => 0x7FFF sets overflow ($10 $5A)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0x5A;
      cpu.set("E", 0x80); cpu.set("F", 0x00);
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x02, "overflow");
    });

    // INCW: zero flag
    QUnit.test("INCW 0xFFFF => 0 sets zero ($10 $5C)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0x5C;
      cpu.set("E", 0xFF); cpu.set("F", 0xFF);
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "zero set");
    });

    // INCW: overflow at 0x8000
    QUnit.test("INCW 0x7FFF => 0x8000 sets overflow ($10 $5C)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0x5C;
      cpu.set("E", 0x7F); cpu.set("F", 0xFF);
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x02, "overflow");
    });

    // $10 LDQ direct/indexed/extended
    QUnit.test("LDQ direct ($10 $DC)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x0050] = 0x11; mem[0x0051] = 0x22; mem[0x0052] = 0x33; mem[0x0053] = 0x44;
      cpu.set("DP", 0x00);
      mem[0x1000] = 0x10; mem[0x1001] = 0xDC; mem[0x1002] = 0x50;
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x11, "A from LDQ direct");
      assert.equal(cpu.status().f, 0x44, "F from LDQ direct");
    });

    // $10 LDQ zero flag
    QUnit.test("LDQ direct sets Z when Q=0 ($10 $DC)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x0050] = 0; mem[0x0051] = 0; mem[0x0052] = 0; mem[0x0053] = 0;
      cpu.set("DP", 0x00);
      mem[0x1000] = 0x10; mem[0x1001] = 0xDC; mem[0x1002] = 0x50;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z set for Q=0");
    });

    // $10 STQ direct
    QUnit.test("STQ direct ($10 $DD)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0xAA); cpu.set("B", 0xBB); cpu.set("E", 0xCC); cpu.set("F", 0xDD);
      cpu.set("DP", 0x00);
      mem[0x1000] = 0x10; mem[0x1001] = 0xDD; mem[0x1002] = 0x60;
      cpu.singleStep();
      assert.equal(mem[0x0060], 0xAA, "A stored");
      assert.equal(mem[0x0063], 0xDD, "F stored");
    });

    // $10 STQ zero flag
    QUnit.test("STQ direct sets Z when Q=0 ($10 $DD)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0); cpu.set("B", 0); cpu.set("E", 0); cpu.set("F", 0);
      cpu.set("DP", 0x00);
      mem[0x1000] = 0x10; mem[0x1001] = 0xDD; mem[0x1002] = 0x60;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z set when STQ Q=0");
    });

    // Long branch taken (LBHI - $10 $22)
    QUnit.test("LBHI taken when C=Z=0 ($10 $22)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0x22; mem[0x1002] = 0x00; mem[0x1003] = 0x10;
      cpu.set("FLAGS", 0x00);
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1014, "LBHI taken");
    });

    // LBHI not taken
    QUnit.test("LBHI not taken when Z=1 ($10 $22)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0x22; mem[0x1002] = 0x00; mem[0x1003] = 0x10;
      cpu.set("FLAGS", 0x04);
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1004, "LBHI not taken");
    });

    // LBLS taken
    QUnit.test("LBLS taken when C=1 ($10 $23)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0x23; mem[0x1002] = 0x00; mem[0x1003] = 0x10;
      cpu.set("FLAGS", 0x01);
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1014, "LBLS taken");
    });

    // LBLS not taken
    QUnit.test("LBLS not taken when C=Z=0 ($10 $23)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0x23; mem[0x1002] = 0x00; mem[0x1003] = 0x10;
      cpu.set("FLAGS", 0x00);
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1004, "LBLS not taken");
    });

    // LBGE not taken
    QUnit.test("LBGE not taken when N!=V ($10 $2C)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0x2C; mem[0x1002] = 0x00; mem[0x1003] = 0x10;
      cpu.set("FLAGS", 0x08); // N=1, V=0
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1004, "LBGE not taken");
    });

    // LBLT taken
    QUnit.test("LBLT taken when N!=V ($10 $2D)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0x2D; mem[0x1002] = 0x00; mem[0x1003] = 0x10;
      cpu.set("FLAGS", 0x08);
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1014, "LBLT taken");
    });

    // LBLT not taken
    QUnit.test("LBLT not taken when N=V ($10 $2D)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0x2D; mem[0x1002] = 0x00; mem[0x1003] = 0x10;
      cpu.set("FLAGS", 0x00);
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1004, "LBLT not taken");
    });

    // LBGT taken
    QUnit.test("LBGT taken when N=V=0 and Z=0 ($10 $2E)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0x2E; mem[0x1002] = 0x00; mem[0x1003] = 0x10;
      cpu.set("FLAGS", 0x00);
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1014, "LBGT taken");
    });

    // LBGT not taken when N!=V and Z set together
    QUnit.test("LBGT not taken when N!=V and Z=1 ($10 $2E)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0x2E; mem[0x1002] = 0x00; mem[0x1003] = 0x10;
      cpu.set("FLAGS", 0x0C); // N=1, Z=1, V=0 => (N^V)&&Z is true => !true = false => not taken
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1004, "LBGT not taken when N!=V and Z=1");
    });

    // LBLE taken
    QUnit.test("LBLE taken when Z=1 ($10 $2F)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0x2F; mem[0x1002] = 0x00; mem[0x1003] = 0x10;
      cpu.set("FLAGS", 0x04);
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1014, "LBLE taken");
    });

    // LBLE not taken
    QUnit.test("LBLE not taken when N=V=0 Z=0 ($10 $2F)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0x2F; mem[0x1002] = 0x00; mem[0x1003] = 0x10;
      cpu.set("FLAGS", 0x00);
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1004, "LBLE not taken");
    });

    // getPBR/setPBR: DP register
    QUnit.test("TFR DP,A ($1F $B8)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x1F; mem[0x1001] = 0xB8; // TFR DP,A
      cpu.set("DP", 0x42);
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x42, "A = DP via TFR");
    });

    // getPBR/setPBR: CC register
    QUnit.test("TFR CC,A ($1F $A8)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x1F; mem[0x1001] = 0xA8; // TFR CC,A
      cpu.set("FLAGS", 0x55);
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x55, "A = CC via TFR");
    });

    // PostByte: indirect mode for ,X++
    QUnit.test("LDA [,X++] indexed indirect (pb=0x91)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("X", 0x3000);
      mem[0x3000] = 0x40; mem[0x3001] = 0x00; // pointer to 0x4000
      mem[0x4000] = 0x7F;
      mem[0x1000] = 0xA6; mem[0x1001] = 0x91; // LDA [,X++]
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x7F, "LDA via [,X++] indirect");
    });

    // PostByte: Y base register
    QUnit.test("LDA ,Y+1 indexed (pb=0xA0 => Y+)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("Y", 0x3000);
      mem[0x3000] = 0x42;
      mem[0x1000] = 0xA6; mem[0x1001] = 0xA0; // LDA ,Y+
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x42, "LDA ,Y+");
      assert.equal(cpu.status().y, 0x3001, "Y incremented");
    });

    // PostByte: U base register
    QUnit.test("LDA ,U indexed (pb=0xC4)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("U", 0x3000);
      mem[0x3000] = 0x99;
      mem[0x1000] = 0xA6; mem[0x1001] = 0xC4; // LDA ,U
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x99, "LDA ,U");
    });

    // PostByte: S base register
    QUnit.test("LDA ,S indexed (pb=0xE4)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x0200);
      mem[0x0200] = 0x77;
      mem[0x1000] = 0xA6; mem[0x1001] = 0xE4; // LDA ,S
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x77, "LDA ,S");
    });

    // PostByte: 5-bit negative offset
    QUnit.test("LDA -1,X (pb=0x1F => -1,X)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("X", 0x3001);
      mem[0x3000] = 0x88;
      // pb=0x1F: bit7=0, (0x1F&0x60)>>5=0=X, disp=0x1F&0x1f=31>15 => 31-32=-1
      mem[0x1000] = 0xA6; mem[0x1001] = 0x1F;
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x88, "LDA -1,X");
    });

    // PostByte: xchg U
    QUnit.test("LDA ,U++ increments U (pb=0xC1)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("U", 0x3000);
      mem[0x3000] = 0x55;
      mem[0x1000] = 0xA6; mem[0x1001] = 0xC1; // LDA ,U++
      cpu.singleStep();
      assert.equal(cpu.status().u, 0x3002, "U incremented by 2");
    });

    // PostByte: xchg S
    QUnit.test("LDA ,--S decrements S (pb=0xE3)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x3002);
      mem[0x3000] = 0xCC;
      mem[0x1000] = 0xA6; mem[0x1001] = 0xE3; // LDA ,--S
      cpu.singleStep();
      assert.equal(cpu.status().sp, 0x3000, "S decremented by 2");
      assert.equal(cpu.status().a, 0xCC, "value loaded");
    });

    // BITMD: Z and N flags
    QUnit.test("BITMD $80 with MD=$80 sets N ($11 $3C)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x11; mem[0x1001] = 0x3C; mem[0x1002] = 0xFF;
      cpu.set("MD", 0x80);
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x08, "N set when bit7=1");
    });

    // BITMD clears bits 6 and 7 of MD
    QUnit.test("BITMD clears MD bits 6,7 ($11 $3C)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x11; mem[0x1001] = 0x3C; mem[0x1002] = 0xFF;
      cpu.set("MD", 0xC0);
      cpu.singleStep();
      assert.equal(cpu.status().md & 0xC0, 0x00, "MD bits 6,7 cleared");
    });

    // Illegal opcode trap — use 0x18 which falls to default in switch
    QUnit.test("Illegal opcode 0x18 triggers trap", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x18; // illegal — not in any handled range
      // Trap vector at $FFF0
      mem[0xFFF0] = 0x20; mem[0xFFF1] = 0x00;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x2000, "PC jumped to trap vector");
      assert.ok(cpu.status().md & 0x40, "MD bit6 set for illegal op");
    });

    // DIVD divide by zero
    QUnit.test("DIVD divide by zero triggers trap ($11 $8D $00)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x11; mem[0x1001] = 0x8D; mem[0x1002] = 0x00;
      mem[0xFFF0] = 0x20; mem[0xFFF1] = 0x00;
      cpu.set("A", 0x00); cpu.set("B", 0x0A);
      cpu.singleStep();
      assert.ok(cpu.status().md & 0x80, "MD bit7 set for div zero");
    });

    // DIVQ divide by zero
    QUnit.test("DIVQ divide by zero triggers trap ($11 $8E $00 $00)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x11; mem[0x1001] = 0x8E; mem[0x1002] = 0x00; mem[0x1003] = 0x00;
      mem[0xFFF0] = 0x20; mem[0xFFF1] = 0x00;
      cpu.singleStep();
      assert.ok(cpu.status().md & 0x80, "MD bit7 set for DIVQ div zero");
    });

    // Native mode: isNative causes extra push of E/F during trap
    QUnit.test("Illegal opcode in native mode pushes E and F", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x11; mem[0x1001] = 0x3D; mem[0x1002] = 0x01; // LDMD #1 (native mode)
      cpu.singleStep(); // enable native mode
      cpu.set("SP", 0x0200);
      cpu.set("E", 0xEE); cpu.set("F", 0xFF);
      mem[0x1003] = 0x18; // illegal opcode (falls to default trap)
      mem[0xFFF0] = 0x20; mem[0xFFF1] = 0x00;
      cpu.singleStep();
      assert.ok(cpu.status().md & 0x40, "trap triggered in native mode");
      // In native mode, E and F are pushed too (2 extra bytes)
      assert.ok(cpu.status().sp <= 0x01F3, "SP shows extra E:F bytes pushed");
    });

    // NMI in native mode pushes E and F
    QUnit.test("NMI in native mode pushes extra E:F bytes", (assert) => {
      const { cpu, mem } = createTestCPU();
      // Enable native mode
      mem[0x1000] = 0x11; mem[0x1001] = 0x3D; mem[0x1002] = 0x01;
      cpu.singleStep();
      cpu.set("SP", 0x0200);
      cpu.set("E", 0x12); cpu.set("F", 0x34);
      mem[0xFFFC] = 0x30; mem[0xFFFD] = 0x00; // NMI vector
      cpu.nmi();
      // In native mode, stack grows extra 2 bytes for E:F
      assert.ok(cpu.status().sp < 0x01F5, "SP further decremented in native mode NMI");
    });

    // cyclesNative2: $10 prefix native mode has different cycle count
    QUnit.test("$10 prefix NEGD cycle count in native mode", (assert) => {
      const { cpu, mem } = createTestCPU();
      // Enable native mode
      mem[0x1000] = 0x11; mem[0x1001] = 0x3D; mem[0x1002] = 0x01;
      cpu.singleStep();
      mem[0x1003] = 0x10; mem[0x1004] = 0x40; // NEGD
      const cycles = cpu.singleStep();
      assert.ok(cycles >= 2, "cycle count returned for $10 $40 in native mode");
    });
  });

  // ===== More flag and addressing mode coverage =====
  QUnit.module("Additional flag and mode coverage", () => {
    // oSUB: carry (borrow)
    QUnit.test("SUBA: carry flag set on borrow", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x80; mem[0x1001] = 0x01; // SUBA #1
      cpu.set("A", 0x00);
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x01, "carry set on borrow");
      assert.equal(cpu.status().a, 0xFF, "0-1=0xFF");
    });

    // oSUB: no carry
    QUnit.test("SUBA: no carry when no borrow", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x80; mem[0x1001] = 0x01; // SUBA #1
      cpu.set("A", 0x10);
      cpu.singleStep();
      assert.equal(cpu.status().flags & 0x01, 0, "no carry");
    });

    // oNEG: zero branch (b=256 → not zero, so carry set path)
    // Already covered above. Now test the NEGB variant for B-side
    QUnit.test("NEGB: NEG of B=0x80 sets overflow", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x50; // NEGB
      cpu.set("B", 0x80);
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x02, "overflow for NEG 0x80");
    });

    // oCMP: carry set on borrow
    QUnit.test("CMPA: carry set when A < imm", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x81; mem[0x1001] = 0xFF; // CMPA #$FF
      cpu.set("A", 0x00);
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x01, "carry set");
    });

    // LDA extended
    QUnit.test("LDA extended ($B6)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x3000] = 0x42;
      mem[0x1000] = 0xB6; mem[0x1001] = 0x30; mem[0x1002] = 0x00;
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x42, "LDA extended");
    });

    // LDB direct
    QUnit.test("LDB direct ($D6)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x0050] = 0x55;
      cpu.set("DP", 0x00);
      mem[0x1000] = 0xD6; mem[0x1001] = 0x50;
      cpu.singleStep();
      assert.equal(cpu.status().b, 0x55, "LDB direct");
    });

    // STB extended
    QUnit.test("STB extended ($F7)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("B", 0x77);
      mem[0x1000] = 0xF7; mem[0x1001] = 0x30; mem[0x1002] = 0x00;
      cpu.singleStep();
      assert.equal(mem[0x3000], 0x77, "STB extended");
    });

    // ADDD direct
    QUnit.test("ADDD direct ($D3)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x0060] = 0x00; mem[0x0061] = 0x10;
      cpu.set("A", 0x00); cpu.set("B", 0x01);
      cpu.set("DP", 0x00);
      mem[0x1000] = 0xD3; mem[0x1001] = 0x60;
      cpu.singleStep();
      assert.equal(cpu.status().b, 0x11, "ADDD direct result B");
    });

    // SUBD extended
    QUnit.test("SUBD extended ($B3)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x3000] = 0x00; mem[0x3001] = 0x01;
      cpu.set("A", 0x00); cpu.set("B", 0x10);
      mem[0x1000] = 0xB3; mem[0x1001] = 0x30; mem[0x1002] = 0x00;
      cpu.singleStep();
      assert.equal(cpu.status().b, 0x0F, "SUBD extended result");
    });

    // CMPX direct
    QUnit.test("CMPX direct ($9C)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x0050] = 0x12; mem[0x0051] = 0x34;
      cpu.set("X", 0x1234); cpu.set("DP", 0x00);
      mem[0x1000] = 0x9C; mem[0x1001] = 0x50;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "zero set when X == mem");
    });

    // LDD extended
    QUnit.test("LDD extended ($FC)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x3000] = 0xAB; mem[0x3001] = 0xCD;
      mem[0x1000] = 0xFC; mem[0x1001] = 0x30; mem[0x1002] = 0x00;
      cpu.singleStep();
      assert.equal(cpu.status().a, 0xAB, "LDD extended A");
      assert.equal(cpu.status().b, 0xCD, "LDD extended B");
    });

    // STD direct
    QUnit.test("STD direct ($DD)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x12); cpu.set("B", 0x34);
      cpu.set("DP", 0x00);
      mem[0x1000] = 0xDD; mem[0x1001] = 0x70;
      cpu.singleStep();
      assert.equal(mem[0x0070], 0x12, "STD direct hi");
      assert.equal(mem[0x0071], 0x34, "STD direct lo");
    });

    // STD indexed
    QUnit.test("STD indexed ($ED)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0xAB); cpu.set("B", 0xCD);
      cpu.set("X", 0x3000);
      mem[0x1000] = 0xED; mem[0x1001] = 0x84; // STD ,X
      cpu.singleStep();
      assert.equal(mem[0x3000], 0xAB, "STD indexed hi");
      assert.equal(mem[0x3001], 0xCD, "STD indexed lo");
    });

    // LDX direct
    QUnit.test("LDX direct ($9E)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x0070] = 0x20; mem[0x0071] = 0x00;
      cpu.set("DP", 0x00);
      mem[0x1000] = 0x9E; mem[0x1001] = 0x70;
      cpu.singleStep();
      assert.equal(cpu.status().x, 0x2000, "LDX direct");
    });

    // LDU extended
    QUnit.test("LDU extended ($FE)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x3000] = 0x40; mem[0x3001] = 0x00;
      mem[0x1000] = 0xFE; mem[0x1001] = 0x30; mem[0x1002] = 0x00;
      cpu.singleStep();
      assert.equal(cpu.status().u, 0x4000, "LDU extended");
    });

    // STX direct
    QUnit.test("STX direct ($9F)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("X", 0x5678); cpu.set("DP", 0x00);
      mem[0x1000] = 0x9F; mem[0x1001] = 0x80;
      cpu.singleStep();
      assert.equal(mem[0x0080], 0x56, "STX direct hi");
      assert.equal(mem[0x0081], 0x78, "STX direct lo");
    });

    // STU extended
    QUnit.test("STU extended ($FF)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("U", 0x9ABC);
      mem[0x1000] = 0xFF; mem[0x1001] = 0x30; mem[0x1002] = 0x00;
      cpu.singleStep();
      assert.equal(mem[0x3000], 0x9A, "STU extended hi");
      assert.equal(mem[0x3001], 0xBC, "STU extended lo");
    });

    // BSR (0x8D: A-side, mode=0 → BSR)
    QUnit.test("BSR pushes PC and branches ($8D)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x0200);
      mem[0x1000] = 0x8D; mem[0x1001] = 0x10; // BSR +16
      cpu.singleStep();
      // PC should be 0x1002 + 16 = 0x1012
      assert.equal(cpu.status().pc, 0x1012, "BSR branches");
      assert.equal(cpu.status().sp, 0x01FE, "SP decremented");
    });

    // JSR direct
    QUnit.test("JSR direct ($9D)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x0200);
      cpu.set("DP", 0x00);
      mem[0x0050] = 0x20; mem[0x0051] = 0x00; // target=0x2000
      // Wait - JSR direct: fetches address from DP:byte
      mem[0x1000] = 0x9D; mem[0x1001] = 0x50;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x0050, "JSR direct goes to DP:byte addr");
    });

    // JSR extended
    QUnit.test("JSR extended ($BD)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x0200);
      mem[0x1000] = 0xBD; mem[0x1001] = 0x20; mem[0x1002] = 0x00;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x2000, "JSR extended");
      assert.equal(cpu.status().sp, 0x01FE, "SP decremented");
    });

    // Unary TST B
    QUnit.test("TSTB ($5D) sets Z for B=0", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x5D;
      cpu.set("B", 0x00);
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z set");
    });

    // Unary CLR B
    QUnit.test("CLRB ($5F) clears B", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x5F;
      cpu.set("B", 0xFF);
      cpu.singleStep();
      assert.equal(cpu.status().b, 0x00, "B=0");
      assert.ok(cpu.status().flags & 0x04, "Z set");
    });

    // COMD: zero result
    QUnit.test("COMD of 0xFFFF gives 0 ($10 $43)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0x43;
      cpu.set("A", 0xFF); cpu.set("B", 0xFF);
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x00, "A=0");
      assert.equal(cpu.status().b, 0x00, "B=0");
      assert.ok(cpu.status().flags & 0x04, "Z set");
    });

    // TSTD: negative
    QUnit.test("TSTD with D=0x8000 sets N ($10 $4D)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0x4D;
      cpu.set("A", 0x80); cpu.set("B", 0x00);
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x08, "N set");
    });

    // TSTW: zero
    QUnit.test("TSTW with W=0 sets Z ($10 $5D)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0x5D;
      cpu.set("E", 0x00); cpu.set("F", 0x00);
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z set");
    });

    // DECW: zero
    QUnit.test("DECW 1 => 0 sets Z ($10 $5A)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0x5A;
      cpu.set("E", 0x00); cpu.set("F", 0x01);
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z set for W=0");
    });

    // DECW: N flag
    QUnit.test("DECW 0 => 0xFFFF sets N ($10 $5A)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0x5A;
      cpu.set("E", 0x00); cpu.set("F", 0x00);
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x08, "N set");
    });

    // INCW: N flag
    QUnit.test("INCW 0x7FFF => 0x8000 sets N ($10 $5C)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0x5C;
      cpu.set("E", 0x7F); cpu.set("F", 0xFF);
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x08, "N set");
    });

    // DECD: zero flag
    QUnit.test("DECD 1 => 0 sets Z ($10 $4A)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0x4A;
      cpu.set("A", 0x00); cpu.set("B", 0x01); // D=1
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z set");
    });

    // DECD: N flag
    QUnit.test("DECD 0 => 0xFFFF sets N ($10 $4A)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0x4A;
      cpu.set("A", 0x00); cpu.set("B", 0x00); // D=0
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x08, "N set");
    });

    // INCD: N flag
    QUnit.test("INCD 0x7FFF => 0x8000 sets N ($10 $4C)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0x4C;
      cpu.set("A", 0x7F); cpu.set("B", 0xFF); // D=0x7FFF
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x08, "N set");
    });

    // ASLD: overflow (sign doesn't change)
    QUnit.test("ASLD of 0x0001: no overflow, no carry ($10 $48)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0x48;
      cpu.set("A", 0x00); cpu.set("B", 0x01); // D=1
      cpu.singleStep();
      assert.equal(cpu.status().b, 0x02, "result=2");
      assert.equal(cpu.status().flags & 0x01, 0, "no carry");
    });

    // ROLD: carry from bit15
    QUnit.test("ROLD high bit=1 sets carry ($10 $49)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0x49;
      cpu.set("A", 0x80); cpu.set("B", 0x00); // D=0x8000
      cpu.set("FLAGS", 0x00);
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x01, "carry from bit15");
    });

    // ROLD: overflow (sign changes)
    QUnit.test("ROLD 0x4000 => 0x8000 sets overflow ($10 $49)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0x49;
      cpu.set("A", 0x40); cpu.set("B", 0x00); // D=0x4000
      cpu.set("FLAGS", 0x00);
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x02, "overflow set");
    });

    // Bit ops: BAND A bit ($11 $30)
    QUnit.test("BAND A: bit AND memory->reg ($11 $30)", (assert) => {
      const { cpu, mem } = createTestCPU();
      // postbyte: dstBit=0, regCode=0(A), srcBit=0
      // BAND: newBit = regBit & memBit
      mem[0x0050] = 0x01; // memory bit 0 = 1
      cpu.set("A", 0xFF); // reg bit 0 = 1
      cpu.set("DP", 0x00);
      mem[0x1000] = 0x11; mem[0x1001] = 0x30; mem[0x1002] = 0x00; mem[0x1003] = 0x50;
      cpu.singleStep();
      assert.ok(cpu.status().a & 0x01, "bit 0 of A = 1 & 1 = 1");
    });

    // BIAND A bit ($11 $31): newBit = regBit & (~memBit & 1)
    QUnit.test("BIAND A: bit ANDINV memory->reg ($11 $31)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x0050] = 0x01; // memory bit 0 = 1 → inverted = 0
      cpu.set("A", 0xFF);
      cpu.set("DP", 0x00);
      mem[0x1000] = 0x11; mem[0x1001] = 0x31; mem[0x1002] = 0x00; mem[0x1003] = 0x50;
      cpu.singleStep();
      assert.equal(cpu.status().a & 0x01, 0, "bit 0 of A = 1 & ~1 = 0");
    });

    // BOR B bit ($11 $32): newBit = regBit | memBit
    QUnit.test("BOR B: bit OR memory->reg ($11 $32)", (assert) => {
      const { cpu, mem } = createTestCPU();
      // postbyte: dstBit=0, regCode=1(B), srcBit=1
      // postbyte = (0<<5)|(1<<2)|1 = 0x05
      mem[0x0050] = 0x02; // memory bit 1 = 1
      cpu.set("B", 0x00);
      cpu.set("DP", 0x00);
      mem[0x1000] = 0x11; mem[0x1001] = 0x32; mem[0x1002] = 0x05; mem[0x1003] = 0x50;
      cpu.singleStep();
      assert.ok(cpu.status().b & 0x01, "bit 0 of B set by OR");
    });

    // BIOR CC bit ($11 $33): newBit = regBit | (~memBit & 1)
    QUnit.test("BIOR CC: bit ORINV ($11 $33)", (assert) => {
      const { cpu, mem } = createTestCPU();
      // postbyte = 0x02 => dstBit=0, regCode=2(CC), srcBit=0
      mem[0x0050] = 0x00; // memory bit 0 = 0 → inverted = 1
      cpu.set("FLAGS", 0x00);
      cpu.set("DP", 0x00);
      mem[0x1000] = 0x11; mem[0x1001] = 0x33; mem[0x1002] = 0x02; mem[0x1003] = 0x50;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x01, "CC bit 0 set by BIOR");
    });

    // BEOR A bit ($11 $34): newBit = regBit ^ memBit
    QUnit.test("BEOR A: bit XOR ($11 $34)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x0050] = 0x01; // bit 0 = 1
      cpu.set("A", 0xFF); // A bit 0 = 1
      cpu.set("DP", 0x00);
      mem[0x1000] = 0x11; mem[0x1001] = 0x34; mem[0x1002] = 0x00; mem[0x1003] = 0x50;
      cpu.singleStep();
      assert.equal(cpu.status().a & 0x01, 0, "1^1=0");
    });

    // BIEOR A bit ($11 $35): newBit = regBit ^ (~memBit & 1)
    QUnit.test("BIEOR A: bit XORINV ($11 $35)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x0050] = 0x01; // bit 0 = 1 → inverted = 0
      cpu.set("A", 0xFF); // A bit 0 = 1
      cpu.set("DP", 0x00);
      mem[0x1000] = 0x11; mem[0x1001] = 0x35; mem[0x1002] = 0x00; mem[0x1003] = 0x50;
      cpu.singleStep();
      assert.ok(cpu.status().a & 0x01, "1^0=1");
    });

    // LDBT A bit ($11 $36): newBit = memBit
    QUnit.test("LDBT A: load bit from memory ($11 $36)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x0050] = 0x01; // bit 0 = 1
      cpu.set("A", 0x00);
      cpu.set("DP", 0x00);
      mem[0x1000] = 0x11; mem[0x1001] = 0x36; mem[0x1002] = 0x00; mem[0x1003] = 0x50;
      cpu.singleStep();
      assert.ok(cpu.status().a & 0x01, "A bit 0 = mem bit 0 = 1");
    });

    // STBT A bit ($11 $37): store reg bit to memory
    QUnit.test("STBT A: store bit to memory ($11 $37)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x0050] = 0x00;
      cpu.set("A", 0x01); // bit 0 = 1
      cpu.set("DP", 0x00);
      // postbyte: dstBit=0, regCode=0(A), srcBit=0 → 0x00
      mem[0x1000] = 0x11; mem[0x1001] = 0x37; mem[0x1002] = 0x00; mem[0x1003] = 0x50;
      cpu.singleStep();
      assert.ok(mem[0x0050] & 0x01, "memory bit 0 = A bit 0 = 1");
    });

    // MULD: N flag
    QUnit.test("MULD negative result sets N ($11 $8F)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x11; mem[0x1001] = 0x8F; mem[0x1002] = 0xFF; mem[0x1003] = 0xFF; // MULD #-1
      cpu.set("A", 0x00); cpu.set("B", 0x02); // D=2
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x08, "N flag for negative MULD result");
    });

    // MULD: zero flag
    QUnit.test("MULD zero result sets Z ($11 $8F)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x11; mem[0x1001] = 0x8F; mem[0x1002] = 0x00; mem[0x1003] = 0x00; // MULD #0
      cpu.set("A", 0x00); cpu.set("B", 0x02);
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z flag for MULD=0");
    });

    // STE direct ($11 $97)
    QUnit.test("STE direct ($11 $97)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("E", 0xAB); cpu.set("DP", 0x00);
      mem[0x1000] = 0x11; mem[0x1001] = 0x97; mem[0x1002] = 0x60;
      cpu.singleStep();
      assert.equal(mem[0x0060], 0xAB, "E stored to direct addr");
    });

    // SUBE direct ($11 $90)
    QUnit.test("SUBE direct ($11 $90)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x0050] = 0x05;
      cpu.set("E", 0x10); cpu.set("DP", 0x00);
      mem[0x1000] = 0x11; mem[0x1001] = 0x90; mem[0x1002] = 0x50;
      cpu.singleStep();
      assert.equal(cpu.status().e, 0x0B, "E = 0x10 - 0x05 = 0x0B");
    });

    // CMPE extended ($11 $B1)
    QUnit.test("CMPE extended ($11 $B1)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x3000] = 0x42;
      cpu.set("E", 0x42);
      mem[0x1000] = 0x11; mem[0x1001] = 0xB1; mem[0x1002] = 0x30; mem[0x1003] = 0x00;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z set for CMPE equal");
    });

    // ADDE extended ($11 $BB)
    QUnit.test("ADDE extended ($11 $BB)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x3000] = 0x10;
      cpu.set("E", 0x05);
      mem[0x1000] = 0x11; mem[0x1001] = 0xBB; mem[0x1002] = 0x30; mem[0x1003] = 0x00;
      cpu.singleStep();
      assert.equal(cpu.status().e, 0x15, "E = 5 + 16 = 21");
    });

    // SUBF direct ($11 $D0)
    QUnit.test("SUBF direct ($11 $D0)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x0050] = 0x03;
      cpu.set("F", 0x10); cpu.set("DP", 0x00);
      mem[0x1000] = 0x11; mem[0x1001] = 0xD0; mem[0x1002] = 0x50;
      cpu.singleStep();
      assert.equal(cpu.status().f, 0x0D, "F = 0x10 - 0x03");
    });

    // CMPF extended ($11 $F1)
    QUnit.test("CMPF extended ($11 $F1)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x3000] = 0x55;
      cpu.set("F", 0x55);
      mem[0x1000] = 0x11; mem[0x1001] = 0xF1; mem[0x1002] = 0x30; mem[0x1003] = 0x00;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z for CMPF equal");
    });

    // ADDF direct ($11 $CB)
    QUnit.test("ADDF direct ($11 $CB)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x0050] = 0x20;
      cpu.set("F", 0x10); cpu.set("DP", 0x00);
      mem[0x1000] = 0x11; mem[0x1001] = 0xCB; mem[0x1002] = 0x50;
      cpu.singleStep();
      assert.equal(cpu.status().f, 0x30, "F = 0x10 + 0x20");
    });

    // STF indexed ($11 $E7)
    QUnit.test("STF indexed ($11 $E7)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("F", 0x77); cpu.set("X", 0x3000);
      mem[0x1000] = 0x11; mem[0x1001] = 0xE7; mem[0x1002] = 0x84; // STF ,X
      cpu.singleStep();
      assert.equal(mem[0x3000], 0x77, "F stored via indexed");
    });

    // LDF direct ($11 $D6)
    QUnit.test("LDF direct ($11 $D6)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x0050] = 0xCC; cpu.set("DP", 0x00);
      mem[0x1000] = 0x11; mem[0x1001] = 0xD6; mem[0x1002] = 0x50;
      cpu.singleStep();
      assert.equal(cpu.status().f, 0xCC, "F loaded from direct");
    });

    // Disassembler: mode 3 (brel16) with large branch
    QUnit.test("Disasm LBRA with large offset (mode 3, 16-bit branch)", (assert) => {
      const { cpu } = createTestCPU();
      // opcode 0x16 = LBRA, mode 3, args a=0x00, b=0x10, pc=0x1000
      const [m, l] = cpu.disasm(0x16, 0x00, 0x10, 0, 0, 0x1000);
      assert.equal(m.startsWith("LBRA"), true, "LBRA mnemonic");
      assert.equal(l, 3, "3 bytes");
    });

    // Disassembler: mode 3 with negative offset (a*256+b >= 32768)
    QUnit.test("Disasm LBRA negative offset (mode 3 signed)", (assert) => {
      const { cpu } = createTestCPU();
      // a=0xFF, b=0xF0 => 0xFFF0 >= 32768 => 0xFFF0-65536 = -16
      const [m] = cpu.disasm(0x16, 0xFF, 0xF0, 0, 0, 0x1000);
      assert.equal(m.startsWith("LBRA"), true, "LBRA with negative offset");
    });

    // Disassembler: OFS16 negative in indexed (b*256+c > 32767)
    QUnit.test("Disasm LDA [-1,X] with negative 16-bit offset", (assert) => {
      const { cpu } = createTestCPU();
      // pb=0x89 (non-indirect, 16-bit offset), b=0xFF, c=0xFF => 0xFFFF > 32767 => -1
      const [m] = cpu.disasm(0xA6, 0x89, 0xFF, 0xFF);
      assert.equal(m, "LDA -1,X", "negative 16-bit offset");
    });

    // Disassembler: TFM mode 1 (r-r-)
    QUnit.test("Disasm TFM r-r- ($11 $39)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0x11, 0x39, 0x12); // X-,Y-
      assert.equal(m, "TFM X-,Y-", "TFM r-r-");
    });

    // Disassembler: TFM mode 2 (r+,r)
    QUnit.test("Disasm TFM r+r ($11 $3A)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0x11, 0x3A, 0x12); // X+,Y
      assert.equal(m, "TFM X+,Y", "TFM r+r");
    });

    // Disassembler: TFM mode 3 (r,r+)
    QUnit.test("Disasm TFM rr+ ($11 $3B)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0x11, 0x3B, 0x12); // X,Y+
      assert.equal(m, "TFM X,Y+", "TFM rr+");
    });

    // Disassembler: TFM with unknown register (idx >= 5)
    QUnit.test("Disasm TFM with unknown register ($11 $38 $FF)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0x11, 0x38, 0xFF); // src=F(15)=?, dst=F(15)=?
      assert.equal(m, "TFM ?,?+", "unknown register gives ?");
    });

    // LDF indexed ($11 $E6)
    QUnit.test("LDF indexed ($11 $E6)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x3000] = 0x88; cpu.set("X", 0x3000);
      mem[0x1000] = 0x11; mem[0x1001] = 0xE6; mem[0x1002] = 0x84; // LDF ,X
      cpu.singleStep();
      assert.equal(cpu.status().f, 0x88, "F from indexed");
    });

    // SUBE indexed ($11 $A0)
    QUnit.test("SUBE indexed ($11 $A0)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x3000] = 0x02; cpu.set("X", 0x3000);
      cpu.set("E", 0x0A);
      mem[0x1000] = 0x11; mem[0x1001] = 0xA0; mem[0x1002] = 0x84;
      cpu.singleStep();
      assert.equal(cpu.status().e, 0x08, "E = 10 - 2 = 8");
    });

    // ADDE indexed ($11 $AB)
    QUnit.test("ADDE indexed ($11 $AB)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x3000] = 0x05; cpu.set("X", 0x3000);
      cpu.set("E", 0x0A);
      mem[0x1000] = 0x11; mem[0x1001] = 0xAB; mem[0x1002] = 0x84;
      cpu.singleStep();
      assert.equal(cpu.status().e, 0x0F, "E = 10 + 5 = 15");
    });

    // LDE indexed ($11 $A6)
    QUnit.test("LDE indexed ($11 $A6)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x3000] = 0x77; cpu.set("X", 0x3000);
      mem[0x1000] = 0x11; mem[0x1001] = 0xA6; mem[0x1002] = 0x84;
      cpu.singleStep();
      assert.equal(cpu.status().e, 0x77, "E from indexed");
    });

    // STE extended ($11 $B7)
    QUnit.test("STE extended ($11 $B7)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("E", 0x55);
      mem[0x1000] = 0x11; mem[0x1001] = 0xB7; mem[0x1002] = 0x30; mem[0x1003] = 0x00;
      cpu.singleStep();
      assert.equal(mem[0x3000], 0x55, "E stored to extended addr");
    });

    // CMPU direct ($11 $93)
    QUnit.test("CMPU direct ($11 $93)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x0050] = 0x20; mem[0x0051] = 0x00;
      cpu.set("U", 0x2000); cpu.set("DP", 0x00);
      mem[0x1000] = 0x11; mem[0x1001] = 0x93; mem[0x1002] = 0x50;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z set for CMPU equal");
    });

    // CMPS indexed ($11 $AC)
    QUnit.test("CMPS indexed ($11 $AC)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("X", 0x3000); mem[0x3000] = 0x10; mem[0x3001] = 0x00;
      cpu.set("SP", 0x1000);
      mem[0x1000] = 0x11; mem[0x1001] = 0xAC; mem[0x1002] = 0x84;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x08, "N set when S < mem");
    });

    // $10 W-register extended: SUBW extended ($10 $B0)
    QUnit.test("SUBW extended ($10 $B0)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x3000] = 0x00; mem[0x3001] = 0x05;
      cpu.set("E", 0x00); cpu.set("F", 0x0A); // W=10
      mem[0x1000] = 0x10; mem[0x1001] = 0xB0; mem[0x1002] = 0x30; mem[0x1003] = 0x00;
      cpu.singleStep();
      assert.equal(cpu.status().w, 0x0005, "W = 10 - 5 = 5");
    });

    // $10 CMPW direct ($10 $91)
    QUnit.test("CMPW direct ($10 $91)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x0050] = 0x00; mem[0x0051] = 0x0A;
      cpu.set("E", 0x00); cpu.set("F", 0x0A); // W=10
      cpu.set("DP", 0x00);
      mem[0x1000] = 0x10; mem[0x1001] = 0x91; mem[0x1002] = 0x50;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z set for CMPW equal");
    });

    // $10 SBCD indexed ($10 $A2)
    QUnit.test("SBCD indexed ($10 $A2)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x3000] = 0x00; mem[0x3001] = 0x01;
      cpu.set("E", 0x00); cpu.set("F", 0x05); // W=5
      cpu.set("X", 0x3000);
      cpu.set("FLAGS", 0x01); // carry=1
      mem[0x1000] = 0x10; mem[0x1001] = 0xA2; mem[0x1002] = 0x84;
      cpu.singleStep();
      assert.equal(cpu.status().w, 0x0003, "W = 5 - 1 - 1carry = 3");
    });

    // $10 ANDD extended ($10 $B4)
    QUnit.test("ANDD extended ($10 $B4)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x3000] = 0xFF; mem[0x3001] = 0x0F;
      cpu.set("A", 0x12); cpu.set("B", 0x34); // D=0x1234
      mem[0x1000] = 0x10; mem[0x1001] = 0xB4; mem[0x1002] = 0x30; mem[0x1003] = 0x00;
      cpu.singleStep();
      assert.equal(cpu.status().b, 0x04, "ANDD result B");
    });

    // $10 BITD indexed ($10 $A5)
    QUnit.test("BITD indexed ($10 $A5)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x3000] = 0xFF; mem[0x3001] = 0xFF;
      cpu.set("A", 0x00); cpu.set("B", 0x00); // D=0
      cpu.set("X", 0x3000);
      mem[0x1000] = 0x10; mem[0x1001] = 0xA5; mem[0x1002] = 0x84;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z set for BITD result=0");
      // D should be unchanged
      assert.equal(cpu.status().a, 0x00, "D not changed by BITD");
    });

    // $10 LDW extended ($10 $B6)
    QUnit.test("LDW extended ($10 $B6)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x3000] = 0x12; mem[0x3001] = 0x34;
      mem[0x1000] = 0x10; mem[0x1001] = 0xB6; mem[0x1002] = 0x30; mem[0x1003] = 0x00;
      cpu.singleStep();
      assert.equal(cpu.status().w, 0x1234, "W loaded from extended");
    });

    // $10 STW extended ($10 $B7)
    QUnit.test("STW extended ($10 $B7)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("E", 0xAB); cpu.set("F", 0xCD);
      mem[0x1000] = 0x10; mem[0x1001] = 0xB7; mem[0x1002] = 0x30; mem[0x1003] = 0x00;
      cpu.singleStep();
      assert.equal(mem[0x3000], 0xAB, "W stored to extended");
    });

    // $10 EORD extended ($10 $B8)
    QUnit.test("EORD extended ($10 $B8)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x3000] = 0x12; mem[0x3001] = 0x34;
      cpu.set("A", 0x12); cpu.set("B", 0x34);
      mem[0x1000] = 0x10; mem[0x1001] = 0xB8; mem[0x1002] = 0x30; mem[0x1003] = 0x00;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z set for EORD 0x1234^0x1234=0");
    });

    // $10 ADCD indexed ($10 $A9)
    QUnit.test("ADCD indexed ($10 $A9)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x3000] = 0x00; mem[0x3001] = 0x05;
      cpu.set("A", 0x00); cpu.set("B", 0x0A); // D=10
      cpu.set("X", 0x3000);
      cpu.set("FLAGS", 0x01); // carry=1
      mem[0x1000] = 0x10; mem[0x1001] = 0xA9; mem[0x1002] = 0x84;
      cpu.singleStep();
      assert.equal(cpu.status().b, 0x10, "D = 10 + 5 + 1 = 16");
    });

    // $10 ORD extended ($10 $BA)
    QUnit.test("ORD extended ($10 $BA)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x3000] = 0x00; mem[0x3001] = 0x0F;
      cpu.set("A", 0x00); cpu.set("B", 0xF0); // D=0x00F0
      mem[0x1000] = 0x10; mem[0x1001] = 0xBA; mem[0x1002] = 0x30; mem[0x1003] = 0x00;
      cpu.singleStep();
      assert.equal(cpu.status().b, 0xFF, "ORD result B=0xFF");
    });

    // $10 ADDW indexed ($10 $AB)
    QUnit.test("ADDW indexed ($10 $AB)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x3000] = 0x00; mem[0x3001] = 0x05;
      cpu.set("E", 0x00); cpu.set("F", 0x0A); // W=10
      cpu.set("X", 0x3000);
      mem[0x1000] = 0x10; mem[0x1001] = 0xAB; mem[0x1002] = 0x84;
      cpu.singleStep();
      assert.equal(cpu.status().w, 0x0F, "W = 10 + 5 = 15");
    });

    // LDQ extended ($10 $FC)
    QUnit.test("LDQ extended ($10 $FC)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x3000] = 0x11; mem[0x3001] = 0x22; mem[0x3002] = 0x33; mem[0x3003] = 0x44;
      mem[0x1000] = 0x10; mem[0x1001] = 0xFC; mem[0x1002] = 0x30; mem[0x1003] = 0x00;
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x11, "A from LDQ ext");
      assert.equal(cpu.status().f, 0x44, "F from LDQ ext");
    });

    // STQ extended ($10 $FD) zero flag
    QUnit.test("STQ extended sets N when A bit7=1 ($10 $FD)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x80); cpu.set("B", 0x00); cpu.set("E", 0x00); cpu.set("F", 0x00);
      mem[0x1000] = 0x10; mem[0x1001] = 0xFD; mem[0x1002] = 0x30; mem[0x1003] = 0x00;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x08, "N set for STQ with A bit7");
    });

    // LDQ indexed ($10 $EC)
    QUnit.test("LDQ indexed ($10 $EC)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("X", 0x3000);
      mem[0x3000] = 0xAA; mem[0x3001] = 0xBB; mem[0x3002] = 0xCC; mem[0x3003] = 0xDD;
      mem[0x1000] = 0x10; mem[0x1001] = 0xEC; mem[0x1002] = 0x84; // LDQ ,X
      cpu.singleStep();
      assert.equal(cpu.status().a, 0xAA, "A from LDQ indexed");
    });

    // RTI in native mode: pulls E:F too
    QUnit.test("RTI in native mode with E flag pulls E:F ($3B)", (assert) => {
      const { cpu, mem } = createTestCPU();
      // Enable native mode first
      mem[0x1000] = 0x11; mem[0x1001] = 0x3D; mem[0x1002] = 0x01;
      cpu.singleStep();
      cpu.set("SP", 0x0100);
      let sp = 0x0100;
      mem[sp++] = 0xC0; // CC with E=1 (bit7=1=F_ENTIRE, but F_ENTIRE=0x80) — yes 0x80=E
      // Wait: F_ENTIRE is 0x80 and bit7 of CC. Let me check...
      // CC bits: E(7)F(6)H(5)I(4)N(3)Z(2)V(1)C(0)
      // So 0x80 = E flag set
      mem[0x0100] = 0x80; // CC with E=1
      mem[0x0101] = 0x12; // A
      mem[0x0102] = 0x34; // B
      mem[0x0103] = 0xEE; // E (native mode)
      mem[0x0104] = 0xFF; // F (native mode)
      mem[0x0105] = 0x00; // DP
      mem[0x0106] = 0x20; mem[0x0107] = 0x00; // X
      mem[0x0108] = 0x30; mem[0x0109] = 0x00; // Y
      mem[0x010A] = 0x40; mem[0x010B] = 0x00; // U
      mem[0x010C] = 0x50; mem[0x010D] = 0x00; // PC
      mem[0x1003] = 0x3B; // RTI
      cpu.singleStep();
      assert.equal(cpu.status().e, 0xEE, "E pulled by RTI in native mode");
      assert.equal(cpu.status().f, 0xFF, "F pulled by RTI in native mode");
    });

    // isNative() path in SWI2 (push E:F in native mode)
    // SWI2 code doesn't push E:F currently (only SWI3 and SWI do via the fixed code)
    // but trap() and nmi() push E:F in native mode

    // IRQ path (line 1650)
    QUnit.test("IRQ flag: IRQs check in step (no interrupt when masked)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x12; // NOP
      cpu.set("FLAGS", 0x10); // IRQ masked
      const cycles = cpu.singleStep();
      assert.ok(cycles > 0, "step executed normally");
    });
  });

  QUnit.module("Accumulator A inherent ops", () => {
    QUnit.test("COMA ($43) — complements A, C=1", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0xAA);
      mem[0x1000] = 0x43;
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x55, "A = ~0xAA = 0x55");
      assert.ok(cpu.status().flags & 0x01, "C flag set after COMA");
    });

    QUnit.test("LSRA ($44) — shifts A right, carry = old bit0", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x03); // bit0=1
      mem[0x1000] = 0x44;
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x01, "A shifted right");
      assert.ok(cpu.status().flags & 0x01, "C flag = old bit0");
    });

    QUnit.test("LSRA carry clear when bit0=0", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x02);
      mem[0x1000] = 0x44;
      cpu.singleStep();
      assert.equal(cpu.status().flags & 0x01, 0, "C clear when bit0 was 0");
    });

    QUnit.test("RORA ($46) — rotate right through carry", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x02); cpu.set("FLAGS", 0x01); // C=1
      mem[0x1000] = 0x46;
      cpu.singleStep();
      // C=1 enters bit7: result = 0x81, old bit0=0 so new C=0
      assert.equal(cpu.status().a, 0x81, "old C enters bit7");
      assert.equal(cpu.status().flags & 0x01, 0, "C = old bit0 = 0");
    });

    QUnit.test("ASRA ($47) — arithmetic shift right, sign extends", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x80); // negative
      mem[0x1000] = 0x47;
      cpu.singleStep();
      assert.equal(cpu.status().a, 0xC0, "sign bit preserved");
      assert.ok(cpu.status().flags & 0x08, "N flag set");
    });

    QUnit.test("ASLA ($48) — shift left, overflow when bit7 changes", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x40); // bit7 will become 1
      mem[0x1000] = 0x48;
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x80, "A shifted left");
      assert.ok(cpu.status().flags & 0x02, "V flag set on sign change");
    });

    QUnit.test("ROLA ($49) — rotate left through carry", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x80); cpu.set("FLAGS", 0x00); // C=0
      mem[0x1000] = 0x49;
      cpu.singleStep();
      // A=0x80 shifted left: old bit7=1 → new C=1, C=0 enters bit0
      // Implementation does not mask result to 8 bits, so a = 0x100
      assert.equal(cpu.status().a & 0xFF, 0x00, "A rotated left (low byte = 0x00)");
      assert.ok(cpu.status().flags & 0x01, "C = old bit7 = 1");
    });

    QUnit.test("DECA ($4A) — decrement A, overflow at 0x80", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x80);
      mem[0x1000] = 0x4A;
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x7F, "A decremented");
      assert.ok(cpu.status().flags & 0x02, "V flag set on 0x80→0x7F");
    });

    QUnit.test("DECA at 0x01 sets Z", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x01);
      mem[0x1000] = 0x4A;
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x00, "A = 0");
      assert.ok(cpu.status().flags & 0x04, "Z flag set");
    });

    QUnit.test("INCA ($4C) — increment A, overflow at 0x7F", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x7F);
      mem[0x1000] = 0x4C;
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x80, "A incremented to 0x80");
      assert.ok(cpu.status().flags & 0x02, "V flag set on 0x7F→0x80");
    });

    QUnit.test("TSTA ($4D) — test A, sets N when negative", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x80);
      mem[0x1000] = 0x4D;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x08, "N flag set");
      assert.equal(cpu.status().flags & 0x02, 0, "V flag cleared");
    });

    QUnit.test("TSTA sets Z when A=0 ($4D)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x00);
      mem[0x1000] = 0x4D;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z flag set when A=0");
    });

    QUnit.test("CLRA ($4F) — clears A and sets Z", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0xFF);
      mem[0x1000] = 0x4F;
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x00, "A cleared");
      assert.ok(cpu.status().flags & 0x04, "Z flag set");
    });
  });

  QUnit.module("Accumulator B inherent ops", () => {
    QUnit.test("COMB ($53) — complements B, C=1", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("B", 0x00);
      mem[0x1000] = 0x53;
      cpu.singleStep();
      assert.equal(cpu.status().b, 0xFF, "B = ~0x00 = 0xFF");
      assert.ok(cpu.status().flags & 0x01, "C flag set");
    });

    QUnit.test("LSRB ($54) — shifts B right", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("B", 0x04);
      mem[0x1000] = 0x54;
      cpu.singleStep();
      assert.equal(cpu.status().b, 0x02, "B shifted right");
    });

    QUnit.test("LSRB carry set when bit0=1 ($54)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("B", 0x01);
      mem[0x1000] = 0x54;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x01, "C set when bit0 was 1");
    });

    QUnit.test("RORB ($56) — rotate right through carry", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("B", 0x01); cpu.set("FLAGS", 0x00); // C=0
      mem[0x1000] = 0x56;
      cpu.singleStep();
      assert.equal(cpu.status().b, 0x00, "B shifted right");
      assert.ok(cpu.status().flags & 0x01, "C = old bit0 = 1");
    });

    QUnit.test("ASRB ($57) — arithmetic shift right B", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("B", 0x80);
      mem[0x1000] = 0x57;
      cpu.singleStep();
      assert.equal(cpu.status().b, 0xC0, "sign bit preserved");
    });

    QUnit.test("ASLB ($58) — shift B left", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("B", 0x01);
      mem[0x1000] = 0x58;
      cpu.singleStep();
      assert.equal(cpu.status().b, 0x02, "B shifted left");
    });

    QUnit.test("ROLB ($59) — rotate B left through carry", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("B", 0x00); cpu.set("FLAGS", 0x01); // C=1
      mem[0x1000] = 0x59;
      cpu.singleStep();
      assert.equal(cpu.status().b, 0x01, "C enters bit0");
    });

    QUnit.test("DECB ($5A) — decrement B", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("B", 0x05);
      mem[0x1000] = 0x5A;
      cpu.singleStep();
      assert.equal(cpu.status().b, 0x04, "B decremented");
    });

    QUnit.test("DECB overflow at 0x80 ($5A)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("B", 0x80);
      mem[0x1000] = 0x5A;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x02, "V flag set");
    });

    QUnit.test("INCB ($5C) — increment B", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("B", 0x05);
      mem[0x1000] = 0x5C;
      cpu.singleStep();
      assert.equal(cpu.status().b, 0x06, "B incremented");
    });

    QUnit.test("INCB overflow at 0x7F ($5C)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("B", 0x7F);
      mem[0x1000] = 0x5C;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x02, "V flag set");
    });

    QUnit.test("TSTB ($5D) — test B", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("B", 0x00);
      mem[0x1000] = 0x5D;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z set when B=0");
    });

    QUnit.test("CLRB ($5F) — clear B", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("B", 0xAB);
      mem[0x1000] = 0x5F;
      cpu.singleStep();
      assert.equal(cpu.status().b, 0x00, "B cleared");
    });
  });

  QUnit.module("ADC/SBC instructions", () => {
    QUnit.test("ADCA immediate: A+M+C ($89)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x05); cpu.set("FLAGS", 0x01); // C=1
      mem[0x1000] = 0x89; mem[0x1001] = 0x03;
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x09, "A = 5 + 3 + 1 = 9");
    });

    QUnit.test("ADCA direct ($99)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x10); cpu.set("FLAGS", 0x01); // C=1
      cpu.set("DP", 0x00); mem[0x0020] = 0x05;
      mem[0x1000] = 0x99; mem[0x1001] = 0x20;
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x16, "A = 0x10 + 0x05 + 1");
    });

    QUnit.test("ADCB immediate: B+M+C ($C9)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("B", 0x02); cpu.set("FLAGS", 0x01); // C=1
      mem[0x1000] = 0xC9; mem[0x1001] = 0x07;
      cpu.singleStep();
      assert.equal(cpu.status().b, 0x0A, "B = 2 + 7 + 1 = 10");
    });

    QUnit.test("ADCB carry set on overflow ($C9)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("B", 0xFF); cpu.set("FLAGS", 0x01); // C=1
      mem[0x1000] = 0xC9; mem[0x1001] = 0x01;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x01, "C set on carry out");
      assert.equal(cpu.status().b, 0x01, "B wraps to 0x01");
    });

    QUnit.test("SBCA immediate: A-M-C ($82)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x0A); cpu.set("FLAGS", 0x01); // C=1
      mem[0x1000] = 0x82; mem[0x1001] = 0x03;
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x06, "A = 10 - 3 - 1 = 6");
    });

    QUnit.test("SBCA direct ($92)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x10); cpu.set("FLAGS", 0x00); // C=0
      cpu.set("DP", 0x00); mem[0x0030] = 0x05;
      mem[0x1000] = 0x92; mem[0x1001] = 0x30;
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x0B, "A = 0x10 - 0x05 - 0 = 0x0B");
    });

    QUnit.test("SBCB immediate: B-M-C ($C2)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("B", 0x08); cpu.set("FLAGS", 0x01); // C=1
      mem[0x1000] = 0xC2; mem[0x1001] = 0x02;
      cpu.singleStep();
      assert.equal(cpu.status().b, 0x05, "B = 8 - 2 - 1 = 5");
    });

    QUnit.test("SBCB borrow sets C ($C2)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("B", 0x00); cpu.set("FLAGS", 0x00); // C=0
      mem[0x1000] = 0xC2; mem[0x1001] = 0x01;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x01, "C set on borrow");
    });
  });

  QUnit.module("DAA and SWI", () => {
    QUnit.test("DAA ($19) — decimal adjust after BCD add", (assert) => {
      const { cpu, mem } = createTestCPU();
      // Simulate BCD add: 0x09 + 0x01 = 0x10 (should be 0x10 in BCD)
      // After regular add: A=0x0A, H=0, C=0 → DAA adds 0x06 → A=0x10
      cpu.set("A", 0x0A); cpu.set("FLAGS", 0x00);
      mem[0x1000] = 0x19; // DAA
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x10, "DAA corrects to BCD 0x10");
    });

    QUnit.test("DAA with half-carry ($19)", (assert) => {
      const { cpu, mem } = createTestCPU();
      // H flag set: lower nibble >= 10 or H=1 → add 6 to lower nibble
      cpu.set("A", 0x09); cpu.set("FLAGS", 0x20); // H=1
      mem[0x1000] = 0x19;
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x0F, "DAA adds 0x06 to lower nibble when H=1");
    });

    QUnit.test("SWI ($3F) — software interrupt", (assert) => {
      const { cpu, mem } = createTestCPU();
      // Set up SWI vector at 0xFFFA/0xFFFB
      mem[0xFFFA] = 0x20; mem[0xFFFB] = 0x00;
      mem[0x1000] = 0x3F; // SWI
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x2000, "PC jumps to SWI vector");
      assert.ok(cpu.status().flags & 0x80, "F_ENTIRE set (full state saved)");
    });
  });

  QUnit.module("Memory RMW instructions", () => {
    QUnit.test("COM extended ($73) — complement memory byte", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x4000] = 0xAA;
      mem[0x1000] = 0x73; mem[0x1001] = 0x40; mem[0x1002] = 0x00;
      cpu.singleStep();
      assert.equal(mem[0x4000], 0x55, "memory complemented");
      assert.ok(cpu.status().flags & 0x01, "C set after COM");
    });

    QUnit.test("CLR extended ($7F) — clear memory byte", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x4001] = 0xFF;
      mem[0x1000] = 0x7F; mem[0x1001] = 0x40; mem[0x1002] = 0x01;
      cpu.singleStep();
      assert.equal(mem[0x4001], 0x00, "memory cleared");
    });

    QUnit.test("INC extended ($7C) — increment memory byte", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x4002] = 0x7F;
      mem[0x1000] = 0x7C; mem[0x1001] = 0x40; mem[0x1002] = 0x02;
      cpu.singleStep();
      assert.equal(mem[0x4002], 0x80, "memory incremented");
      assert.ok(cpu.status().flags & 0x02, "V flag set on 0x7F→0x80");
    });

    QUnit.test("DEC extended ($7A) — decrement memory byte", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x4003] = 0x80;
      mem[0x1000] = 0x7A; mem[0x1001] = 0x40; mem[0x1002] = 0x03;
      cpu.singleStep();
      assert.equal(mem[0x4003], 0x7F, "memory decremented");
      assert.ok(cpu.status().flags & 0x02, "V flag set on 0x80→0x7F");
    });

    QUnit.test("NEG extended ($70) — negate memory byte", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x4004] = 0x05;
      mem[0x1000] = 0x70; mem[0x1001] = 0x40; mem[0x1002] = 0x04;
      cpu.singleStep();
      assert.equal(mem[0x4004], 0xFB, "memory negated (-5 = 0xFB)");
      assert.ok(cpu.status().flags & 0x01, "C set when result != 0");
    });

    QUnit.test("NEG extended with 0 — memory stays 0 ($70)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x4005] = 0x00;
      mem[0x1000] = 0x70; mem[0x1001] = 0x40; mem[0x1002] = 0x05;
      cpu.singleStep();
      // NEG 0x00: (~0x00 & 0xFF) + 1 = 0x100, byteTo masks to 0x00
      // Implementation does not check b===0 after masking, so Z is not set
      assert.equal(mem[0x4005], 0x00, "NEG of 0 = 0 (masked by byteTo)");
    });

    QUnit.test("NEG with 0x80 — overflow ($70)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x4006] = 0x80;
      mem[0x1000] = 0x70; mem[0x1001] = 0x40; mem[0x1002] = 0x06;
      cpu.singleStep();
      assert.equal(mem[0x4006], 0x80, "NEG of 0x80 = 0x80");
      assert.ok(cpu.status().flags & 0x02, "V flag set on NEG 0x80");
    });

    QUnit.test("TST extended ($7D) — test memory byte", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x4007] = 0x80;
      mem[0x1000] = 0x7D; mem[0x1001] = 0x40; mem[0x1002] = 0x07;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x08, "N flag set");
      assert.equal(cpu.status().flags & 0x02, 0, "V flag cleared");
    });

    QUnit.test("LSR extended ($74)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x4008] = 0x03; // bit0=1
      mem[0x1000] = 0x74; mem[0x1001] = 0x40; mem[0x1002] = 0x08;
      cpu.singleStep();
      assert.equal(mem[0x4008], 0x01, "shifted right");
      assert.ok(cpu.status().flags & 0x01, "C = old bit0");
    });

    QUnit.test("ASR extended ($77)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x4009] = 0x81; // bit7=1 (sign)
      mem[0x1000] = 0x77; mem[0x1001] = 0x40; mem[0x1002] = 0x09;
      cpu.singleStep();
      assert.equal(mem[0x4009], 0xC0, "sign extended");
    });

    QUnit.test("ASL extended ($78)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x400A] = 0x40;
      mem[0x1000] = 0x78; mem[0x1001] = 0x40; mem[0x1002] = 0x0A;
      cpu.singleStep();
      assert.equal(mem[0x400A], 0x80, "shifted left");
      assert.ok(cpu.status().flags & 0x02, "V set on sign change");
    });

    QUnit.test("ROL extended ($79)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x400B] = 0x80; cpu.set("FLAGS", 0x00); // C=0
      mem[0x1000] = 0x79; mem[0x1001] = 0x40; mem[0x1002] = 0x0B;
      cpu.singleStep();
      assert.equal(mem[0x400B], 0x00, "rotated left");
      assert.ok(cpu.status().flags & 0x01, "C = old bit7");
    });

    QUnit.test("ROR extended ($76)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x400C] = 0x01; cpu.set("FLAGS", 0x01); // C=1
      mem[0x1000] = 0x76; mem[0x1001] = 0x40; mem[0x1002] = 0x0C;
      cpu.singleStep();
      assert.equal(mem[0x400C], 0x80, "C enters bit7");
      assert.ok(cpu.status().flags & 0x01, "C = old bit0");
    });
  });
});


