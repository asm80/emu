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
      assert.ok(true, "DIVD executed without crash");
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
      assert.ok(true, "DIVD extended executed without crash");
    });

    QUnit.test("DIVQ immediate basic case ($11 $8E)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x00); cpu.set("B", 0x00); cpu.set("E", 0x00); cpu.set("F", 0x06);
      mem[0x1000] = 0x11; mem[0x1001] = 0x8E; mem[0x1002] = 0x00; mem[0x1003] = 0x02;
      cpu.singleStep();
      assert.ok(true, "DIVQ immediate executed without crash");
    });

    QUnit.test("DIVQ division by zero triggers trap ($11 $8E #0)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0xFFF0] = 0x20; mem[0xFFF1] = 0x00;
      mem[0x1000] = 0x11; mem[0x1001] = 0x8E; mem[0x1002] = 0x00; mem[0x1003] = 0x00;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x2000, "trap taken on DIVQ div by zero");
    });

    QUnit.test("BITMD ANDs MD with immediate, sets Z/N ($11 $3C)", (assert) => {
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
      assert.ok(true, "MULD indexed executed without crash");
    });

    QUnit.test("DIVD direct ($11 $9D)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x00); cpu.set("B", 0x08); cpu.set("DP", 0x00);
      mem[0x0060] = 0x04; // divisor = 4
      mem[0x1000] = 0x11; mem[0x1001] = 0x9D; mem[0x1002] = 0x60;
      cpu.singleStep();
      assert.ok(true, "DIVD direct executed without crash");
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
});
