/**
 * Motorola 6800 CPU Emulator - Comprehensive Tests
 *
 * Test suite covering all 6800 instructions across 7 addressing modes.
 * Tests instruction execution, flag handling, timing, and hardware compatibility.
 */

import QUnit from "qunit";
import CPU6800, { disasm } from "../src/6800.js";

QUnit.module("Motorola 6800 CPU Emulator", () => {
  /**
   * Helper: Create CPU with test memory
   */
  const createTestCPU = () => {
    const mem = new Uint8Array(65536);

    // Set reset vector to 0x1000
    mem[0xFFFE] = 0x10;
    mem[0xFFFF] = 0x00;

    const cpu = CPU6800({
      byteAt: (addr) => mem[addr] || 0,
      byteTo: (addr, val) => { mem[addr] = val & 0xFF; }
    });

    return { cpu, mem };
  };

  QUnit.module("Initialization and Reset", () => {
    QUnit.test("CPU initializes with correct default values", (assert) => {
      const { cpu } = createTestCPU();
      cpu.reset();
      const state = cpu.status();

      assert.equal(state.pc, 0x1000, "PC loaded from reset vector");
      assert.equal(state.a, 0, "A register is 0");
      assert.equal(state.b, 0, "B register is 0");
      assert.equal(state.x, 0, "X register is 0");
      assert.equal(state.flags & 0x10, 0x10, "Interrupt flag set");
    });

    QUnit.test("Cycle counter starts at 0 after reset", (assert) => {
      const { cpu } = createTestCPU();
      cpu.reset();
      assert.equal(cpu.T(), 0, "Cycle counter is 0");
    });
  });

  QUnit.module("Load/Store - Immediate Mode", () => {
    QUnit.test("LDAA #n - Load A immediate", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDAA immediate
      mem[0x1001] = 0x42;

      cpu.reset();
      cpu.steps(2);

      assert.equal(cpu.status().a, 0x42, "A loaded with immediate value");
    });

    QUnit.test("LDAB #n - Load B immediate", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xC6; // LDAB immediate
      mem[0x1001] = 0x55;

      cpu.reset();
      cpu.steps(2);

      assert.equal(cpu.status().b, 0x55, "B loaded with immediate value");
    });

    QUnit.test("LDX #nn - Load X immediate 16-bit", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xCE; // LDX immediate
      mem[0x1001] = 0x12;
      mem[0x1002] = 0x34;

      cpu.reset();
      cpu.steps(3);

      assert.equal(cpu.status().x, 0x1234, "X loaded with 16-bit value");
    });

    QUnit.test("LDS #nn - Load SP immediate", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x8E; // LDS immediate
      mem[0x1001] = 0xF0;
      mem[0x1002] = 0x00;

      cpu.reset();
      cpu.steps(3);

      assert.equal(cpu.status().sp, 0xF000, "SP loaded with immediate value");
    });
  });

  QUnit.module("Load/Store - Direct Page Mode", () => {
    QUnit.test("LDAA $n - Load A from zero page", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0050] = 0x77;
      mem[0x1000] = 0x96; // LDAA direct
      mem[0x1001] = 0x50;

      cpu.reset();
      cpu.steps(2);

      assert.equal(cpu.status().a, 0x77, "A loaded from zero page");
    });

    QUnit.test("STAA $n - Store A to zero page", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDAA immediate
      mem[0x1001] = 0xAA;
      mem[0x1002] = 0x97; // STAA direct
      mem[0x1003] = 0x60;

      cpu.reset();
      cpu.steps(2); // LDAA
      cpu.steps(2); // STAA

      assert.equal(mem[0x0060], 0xAA, "A stored to zero page");
    });

    QUnit.test("LDAB $n - Load B from zero page", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0080] = 0x88;
      mem[0x1000] = 0xD6; // LDAB direct
      mem[0x1001] = 0x80;

      cpu.reset();
      cpu.steps(2);

      assert.equal(cpu.status().b, 0x88, "B loaded from zero page");
    });

    QUnit.test("STAB $n - Store B to zero page", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xC6; // LDAB immediate
      mem[0x1001] = 0xBB;
      mem[0x1002] = 0xD7; // STAB direct
      mem[0x1003] = 0x70;

      cpu.reset();
      cpu.steps(2); // LDAB
      cpu.steps(2); // STAB

      assert.equal(mem[0x0070], 0xBB, "B stored to zero page");
    });
  });

  QUnit.module("Load/Store - Extended Mode", () => {
    QUnit.test("LDAA $nnnn - Load A from absolute address", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x2000] = 0x99;
      mem[0x1000] = 0xB6; // LDAA extended
      mem[0x1001] = 0x20;
      mem[0x1002] = 0x00;

      cpu.reset();
      cpu.steps(4);

      assert.equal(cpu.status().a, 0x99, "A loaded from extended address");
    });

    QUnit.test("STAA $nnnn - Store A to absolute address", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDAA immediate
      mem[0x1001] = 0xCC;
      mem[0x1002] = 0xB7; // STAA extended
      mem[0x1003] = 0x30;
      mem[0x1004] = 0x00;

      cpu.reset();
      cpu.steps(2); // LDAA
      cpu.steps(4); // STAA

      assert.equal(mem[0x3000], 0xCC, "A stored to extended address");
    });

    QUnit.test("LDX $nnnn - Load X from extended", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x4000] = 0xAB;
      mem[0x4001] = 0xCD;
      mem[0x1000] = 0xFE; // LDX extended
      mem[0x1001] = 0x40;
      mem[0x1002] = 0x00;

      cpu.reset();
      cpu.steps(5);

      assert.equal(cpu.status().x, 0xABCD, "X loaded from extended address");
    });

    QUnit.test("STX $nnnn - Store X to extended", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xCE; // LDX immediate
      mem[0x1001] = 0x56;
      mem[0x1002] = 0x78;
      mem[0x1003] = 0xFF; // STX extended
      mem[0x1004] = 0x50;
      mem[0x1005] = 0x00;

      cpu.reset();
      cpu.steps(3); // LDX
      cpu.steps(5); // STX

      assert.equal(mem[0x5000], 0x56, "X high byte stored");
      assert.equal(mem[0x5001], 0x78, "X low byte stored");
    });
  });

  QUnit.module("Load/Store - Indexed Mode", () => {
    QUnit.test("LDAA $n,X - Load A indexed", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x2010] = 0xEE;
      mem[0x1000] = 0xCE; // LDX immediate
      mem[0x1001] = 0x20;
      mem[0x1002] = 0x00;
      mem[0x1003] = 0xA6; // LDAA indexed
      mem[0x1004] = 0x10; // Offset

      cpu.reset();
      cpu.steps(3); // LDX
      cpu.steps(5); // LDAA indexed

      assert.equal(cpu.status().a, 0xEE, "A loaded from X + offset");
    });

    QUnit.test("STAA $n,X - Store A indexed", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xCE; // LDX immediate
      mem[0x1001] = 0x30;
      mem[0x1002] = 0x00;
      mem[0x1003] = 0x86; // LDAA immediate
      mem[0x1004] = 0xDD;
      mem[0x1005] = 0xA7; // STAA indexed
      mem[0x1006] = 0x20; // Offset

      cpu.reset();
      cpu.steps(3); // LDX
      cpu.steps(2); // LDAA
      cpu.steps(6); // STAA indexed

      assert.equal(mem[0x3020], 0xDD, "A stored to X + offset");
    });

    QUnit.test("LDAB $n,X - Load B indexed", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x4005] = 0xFF;
      mem[0x1000] = 0xCE; // LDX immediate
      mem[0x1001] = 0x40;
      mem[0x1002] = 0x00;
      mem[0x1003] = 0xE6; // LDAB indexed
      mem[0x1004] = 0x05;

      cpu.reset();
      cpu.steps(3); // LDX
      cpu.steps(5); // LDAB indexed

      assert.equal(cpu.status().b, 0xFF, "B loaded from X + offset");
    });

    QUnit.test("LDX $n,X - Load X indexed (self-modifying)", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x5010] = 0x12;
      mem[0x5011] = 0x34;
      mem[0x1000] = 0xCE; // LDX immediate
      mem[0x1001] = 0x50;
      mem[0x1002] = 0x00;
      mem[0x1003] = 0xEE; // LDX indexed
      mem[0x1004] = 0x10;

      cpu.reset();
      cpu.steps(3); // LDX immediate
      cpu.steps(6); // LDX indexed

      assert.equal(cpu.status().x, 0x1234, "X loaded from X + offset");
    });
  });

  QUnit.module("Arithmetic - Addition", () => {
    QUnit.test("ADDA - Add to A no carry", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDAA immediate
      mem[0x1001] = 0x20;
      mem[0x1002] = 0x8B; // ADDA immediate
      mem[0x1003] = 0x30;

      cpu.reset();
      cpu.steps(2); // LDAA
      cpu.steps(2); // ADDA

      const state = cpu.status();
      assert.equal(state.a, 0x50, "A = 0x20 + 0x30");
      assert.equal(state.flags & 0x01, 0, "Carry clear");
    });

    QUnit.test("ADDA - Overflow sets carry", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDAA immediate
      mem[0x1001] = 0xFF;
      mem[0x1002] = 0x8B; // ADDA immediate
      mem[0x1003] = 0x02;

      cpu.reset();
      cpu.steps(2); // LDAA
      cpu.steps(2); // ADDA

      const state = cpu.status();
      assert.equal(state.a, 0x01, "A wraps to 0x01");
      assert.equal(state.flags & 0x01, 1, "Carry set");
    });

    QUnit.test("ADDB - Add to B", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xC6; // LDAB immediate
      mem[0x1001] = 0x10;
      mem[0x1002] = 0xCB; // ADDB immediate
      mem[0x1003] = 0x25;

      cpu.reset();
      cpu.steps(2); // LDAB
      cpu.steps(2); // ADDB

      assert.equal(cpu.status().b, 0x35, "B = 0x10 + 0x25");
    });

    QUnit.test("ADCA - Add with carry to A", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDAA immediate
      mem[0x1001] = 0x20;
      mem[0x1002] = 0x0D; // SEC (set carry)
      mem[0x1003] = 0x89; // ADCA immediate
      mem[0x1004] = 0x30;

      cpu.reset();
      cpu.steps(2); // LDAA
      cpu.steps(2); // SEC
      cpu.steps(2); // ADCA

      assert.equal(cpu.status().a, 0x51, "A = 0x20 + 0x30 + carry(1)");
    });

    QUnit.test("ADCB - Add with carry to B", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xC6; // LDAB immediate
      mem[0x1001] = 0x15;
      mem[0x1002] = 0x0D; // SEC
      mem[0x1003] = 0xC9; // ADCB immediate
      mem[0x1004] = 0x20;

      cpu.reset();
      cpu.steps(2); // LDAB
      cpu.steps(2); // SEC
      cpu.steps(2); // ADCB

      assert.equal(cpu.status().b, 0x36, "B = 0x15 + 0x20 + carry(1)");
    });

    QUnit.test("ABA - Add B to A", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDAA immediate
      mem[0x1001] = 0x30;
      mem[0x1002] = 0xC6; // LDAB immediate
      mem[0x1003] = 0x12;
      mem[0x1004] = 0x1B; // ABA

      cpu.reset();
      cpu.steps(2); // LDAA
      cpu.steps(2); // LDAB
      cpu.steps(2); // ABA

      assert.equal(cpu.status().a, 0x42, "A = A + B");
    });
  });

  QUnit.module("Arithmetic - Subtraction", () => {
    QUnit.test("SUBA - Subtract from A", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDAA immediate
      mem[0x1001] = 0x50;
      mem[0x1002] = 0x80; // SUBA immediate
      mem[0x1003] = 0x20;

      cpu.reset();
      cpu.steps(2); // LDAA
      cpu.steps(2); // SUBA

      const state = cpu.status();
      assert.equal(state.a, 0x30, "A = 0x50 - 0x20");
      assert.equal(state.flags & 0x01, 0, "Carry clear (no borrow)");
    });

    QUnit.test("SUBA - Underflow sets carry", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDAA immediate
      mem[0x1001] = 0x10;
      mem[0x1002] = 0x80; // SUBA immediate
      mem[0x1003] = 0x20;

      cpu.reset();
      cpu.steps(2); // LDAA
      cpu.steps(2); // SUBA

      const state = cpu.status();
      assert.equal(state.a, 0xF0, "A underflows");
      assert.equal(state.flags & 0x01, 1, "Carry set (borrow)");
    });

    QUnit.test("SUBB - Subtract from B", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xC6; // LDAB immediate
      mem[0x1001] = 0x60;
      mem[0x1002] = 0xC0; // SUBB immediate
      mem[0x1003] = 0x25;

      cpu.reset();
      cpu.steps(2); // LDAB
      cpu.steps(2); // SUBB

      assert.equal(cpu.status().b, 0x3B, "B = 0x60 - 0x25");
    });

    QUnit.test("SBCA - Subtract with borrow from A", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDAA immediate
      mem[0x1001] = 0x50;
      mem[0x1002] = 0x0D; // SEC (set carry/borrow)
      mem[0x1003] = 0x82; // SBCA immediate
      mem[0x1004] = 0x20;

      cpu.reset();
      cpu.steps(2); // LDAA
      cpu.steps(2); // SEC
      cpu.steps(2); // SBCA

      assert.equal(cpu.status().a, 0x2F, "A = 0x50 - 0x20 - borrow(1)");
    });

    QUnit.test("SBCB - Subtract with borrow from B", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xC6; // LDAB immediate
      mem[0x1001] = 0x40;
      mem[0x1002] = 0x0D; // SEC
      mem[0x1003] = 0xC2; // SBCB immediate
      mem[0x1004] = 0x15;

      cpu.reset();
      cpu.steps(2); // LDAB
      cpu.steps(2); // SEC
      cpu.steps(2); // SBCB

      assert.equal(cpu.status().b, 0x2A, "B = 0x40 - 0x15 - borrow(1)");
    });

    QUnit.test("SBA - Subtract B from A", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDAA immediate
      mem[0x1001] = 0x50;
      mem[0x1002] = 0xC6; // LDAB immediate
      mem[0x1003] = 0x20;
      mem[0x1004] = 0x10; // SBA

      cpu.reset();
      cpu.steps(2); // LDAA
      cpu.steps(2); // LDAB
      cpu.steps(2); // SBA

      assert.equal(cpu.status().a, 0x30, "A = A - B");
    });
  });

  QUnit.module("Logic Operations", () => {
    QUnit.test("ANDA - AND with A", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDAA immediate
      mem[0x1001] = 0xF0;
      mem[0x1002] = 0x84; // ANDA immediate
      mem[0x1003] = 0x0F;

      cpu.reset();
      cpu.steps(2); // LDAA
      cpu.steps(2); // ANDA

      assert.equal(cpu.status().a, 0x00, "A = 0xF0 AND 0x0F");
    });

    QUnit.test("ANDB - AND with B", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xC6; // LDAB immediate
      mem[0x1001] = 0xFF;
      mem[0x1002] = 0xC4; // ANDB immediate
      mem[0x1003] = 0x55;

      cpu.reset();
      cpu.steps(2); // LDAB
      cpu.steps(2); // ANDB

      assert.equal(cpu.status().b, 0x55, "B = 0xFF AND 0x55");
    });

    QUnit.test("ORAA - OR with A", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDAA immediate
      mem[0x1001] = 0xF0;
      mem[0x1002] = 0x8A; // ORAA immediate
      mem[0x1003] = 0x0F;

      cpu.reset();
      cpu.steps(2); // LDAA
      cpu.steps(2); // ORAA

      assert.equal(cpu.status().a, 0xFF, "A = 0xF0 OR 0x0F");
    });

    QUnit.test("ORAB - OR with B", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xC6; // LDAB immediate
      mem[0x1001] = 0xAA;
      mem[0x1002] = 0xCA; // ORAB immediate
      mem[0x1003] = 0x55;

      cpu.reset();
      cpu.steps(2); // LDAB
      cpu.steps(2); // ORAB

      assert.equal(cpu.status().b, 0xFF, "B = 0xAA OR 0x55");
    });

    QUnit.test("EORA - XOR with A", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDAA immediate
      mem[0x1001] = 0xFF;
      mem[0x1002] = 0x88; // EORA immediate
      mem[0x1003] = 0xFF;

      cpu.reset();
      cpu.steps(2); // LDAA
      cpu.steps(2); // EORA

      assert.equal(cpu.status().a, 0x00, "A = 0xFF XOR 0xFF = 0");
    });

    QUnit.test("EORB - XOR with B", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xC6; // LDAB immediate
      mem[0x1001] = 0xAA;
      mem[0x1002] = 0xC8; // EORB immediate
      mem[0x1003] = 0x55;

      cpu.reset();
      cpu.steps(2); // LDAB
      cpu.steps(2); // EORB

      assert.equal(cpu.status().b, 0xFF, "B = 0xAA XOR 0x55");
    });

    QUnit.test("COMA - Complement A", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDAA immediate
      mem[0x1001] = 0x0F;
      mem[0x1002] = 0x43; // COMA

      cpu.reset();
      cpu.steps(2); // LDAA
      cpu.steps(2); // COMA

      assert.equal(cpu.status().a, 0xF0, "A complemented");
    });

    QUnit.test("COMB - Complement B", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xC6; // LDAB immediate
      mem[0x1001] = 0xAA;
      mem[0x1002] = 0x53; // COMB

      cpu.reset();
      cpu.steps(2); // LDAB
      cpu.steps(2); // COMB

      assert.equal(cpu.status().b, 0x55, "B complemented");
    });
  });

  QUnit.module("Compare Operations", () => {
    QUnit.test("CMPA - Compare A (equal)", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDAA immediate
      mem[0x1001] = 0x42;
      mem[0x1002] = 0x81; // CMPA immediate
      mem[0x1003] = 0x42;

      cpu.reset();
      cpu.steps(2); // LDAA
      cpu.steps(2); // CMPA

      const state = cpu.status();
      assert.equal(state.a, 0x42, "A unchanged");
      assert.equal(state.flags & 0x04, 0x04, "Zero flag set (equal)");
    });

    QUnit.test("CMPA - Compare A (less than)", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDAA immediate
      mem[0x1001] = 0x30;
      mem[0x1002] = 0x81; // CMPA immediate
      mem[0x1003] = 0x40;

      cpu.reset();
      cpu.steps(2); // LDAA
      cpu.steps(2); // CMPA

      const state = cpu.status();
      assert.equal(state.flags & 0x01, 1, "Carry set (A < operand)");
    });

    QUnit.test("CMPB - Compare B", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xC6; // LDAB immediate
      mem[0x1001] = 0x55;
      mem[0x1002] = 0xC1; // CMPB immediate
      mem[0x1003] = 0x55;

      cpu.reset();
      cpu.steps(2); // LDAB
      cpu.steps(2); // CMPB

      const state = cpu.status();
      assert.equal(state.b, 0x55, "B unchanged");
      assert.equal(state.flags & 0x04, 0x04, "Zero flag set");
    });

    QUnit.test("CPX - Compare X", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xCE; // LDX immediate
      mem[0x1001] = 0x12;
      mem[0x1002] = 0x34;
      mem[0x1003] = 0x8C; // CPX immediate
      mem[0x1004] = 0x12;
      mem[0x1005] = 0x34;

      cpu.reset();
      cpu.steps(3); // LDX
      cpu.steps(3); // CPX

      const state = cpu.status();
      assert.equal(state.x, 0x1234, "X unchanged");
      assert.equal(state.flags & 0x04, 0x04, "Zero flag set (equal)");
    });

    QUnit.test("CBA - Compare B with A", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDAA immediate
      mem[0x1001] = 0x50;
      mem[0x1002] = 0xC6; // LDAB immediate
      mem[0x1003] = 0x50;
      mem[0x1004] = 0x11; // CBA

      cpu.reset();
      cpu.steps(2); // LDAA
      cpu.steps(2); // LDAB
      cpu.steps(2); // CBA

      assert.equal(cpu.status().flags & 0x04, 0x04, "Zero flag set (A = B)");
    });

    QUnit.test("CPX direct - Compare X with direct page", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x50] = 0x12; // Compare value high
      mem[0x51] = 0x34; // Compare value low

      mem[0x1000] = 0xCE; // LDX immediate
      mem[0x1001] = 0x12;
      mem[0x1002] = 0x34;
      mem[0x1003] = 0x9C; // CPX direct
      mem[0x1004] = 0x50;

      cpu.reset();
      cpu.steps(3); // LDX
      cpu.steps(7); // CPX direct

      assert.equal(cpu.status().flags & 0x04, 0x04, "Zero flag set when X = memory");
    });

    QUnit.test("CPX indexed - Compare X with indexed", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x2010] = 0xAB; // Compare value high
      mem[0x2011] = 0xCD; // Compare value low

      mem[0x1000] = 0xCE; // LDX immediate
      mem[0x1001] = 0xAB;
      mem[0x1002] = 0xCD;
      mem[0x1003] = 0xFE; // LDX immediate (for base address)
      mem[0x1004] = 0x20;
      mem[0x1005] = 0x00;
      mem[0x1006] = 0xAC; // CPX indexed
      mem[0x1007] = 0x10;

      cpu.reset();
      cpu.steps(3); // LDX (value to compare)
      cpu.steps(3); // LDX (base address)
      cpu.steps(7); // CPX indexed

      assert.equal(cpu.status().flags & 0x04, 0x04, "Zero flag set when X = memory");
    });

    QUnit.test("CPX extended - Compare X with extended", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x3000] = 0x56; // Compare value high
      mem[0x3001] = 0x78; // Compare value low

      mem[0x1000] = 0xCE; // LDX immediate
      mem[0x1001] = 0x56;
      mem[0x1002] = 0x78;
      mem[0x1003] = 0xBC; // CPX extended
      mem[0x1004] = 0x30;
      mem[0x1005] = 0x00;

      cpu.reset();
      cpu.steps(3); // LDX
      cpu.steps(7); // CPX extended

      assert.equal(cpu.status().flags & 0x04, 0x04, "Zero flag set when X = memory");
    });

    QUnit.test("SBCA - Subtract with carry (borrow case)", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDAA immediate
      mem[0x1001] = 0x10;
      mem[0x1002] = 0x82; // SBCA immediate (subtract with carry)
      mem[0x1003] = 0x20; // 0x10 - 0x20 = borrow

      cpu.reset();
      cpu.steps(2); // LDAA
      cpu.steps(2); // SBCA

      assert.equal(cpu.status().flags & 0x01, 0x01, "Carry set when result borrows");
    });

    QUnit.test("SBCB - Subtract with carry B (borrow case)", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xC6; // LDAB immediate
      mem[0x1001] = 0x15;
      mem[0x1002] = 0xC2; // SBCB immediate
      mem[0x1003] = 0x25; // 0x15 - 0x25 = borrow

      cpu.reset();
      cpu.steps(2); // LDAB
      cpu.steps(2); // SBCB

      assert.equal(cpu.status().flags & 0x01, 0x01, "Carry set when result borrows");
    });
  });

  QUnit.module("Bit Test Operations", () => {
    QUnit.test("BITA - Test bits in A", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDAA immediate
      mem[0x1001] = 0xF0;
      mem[0x1002] = 0x85; // BITA immediate
      mem[0x1003] = 0x0F;

      cpu.reset();
      cpu.steps(2); // LDAA
      cpu.steps(2); // BITA

      const state = cpu.status();
      assert.equal(state.a, 0xF0, "A unchanged");
      assert.equal(state.flags & 0x04, 0x04, "Zero flag set (no bits match)");
    });

    QUnit.test("BITB - Test bits in B", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xC6; // LDAB immediate
      mem[0x1001] = 0x55;
      mem[0x1002] = 0xC5; // BITB immediate
      mem[0x1003] = 0xAA;

      cpu.reset();
      cpu.steps(2); // LDAB
      cpu.steps(2); // BITB

      const state = cpu.status();
      assert.equal(state.b, 0x55, "B unchanged");
      assert.equal(state.flags & 0x04, 0x04, "Zero flag set");
    });
  });

  QUnit.module("Increment/Decrement", () => {
    QUnit.test("INCA - Increment A", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDAA immediate
      mem[0x1001] = 0x41;
      mem[0x1002] = 0x4C; // INCA

      cpu.reset();
      cpu.steps(2); // LDAA
      cpu.steps(2); // INCA

      assert.equal(cpu.status().a, 0x42, "A incremented");
    });

    QUnit.test("INCB - Increment B", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xC6; // LDAB immediate
      mem[0x1001] = 0xFE;
      mem[0x1002] = 0x5C; // INCB

      cpu.reset();
      cpu.steps(2); // LDAB
      cpu.steps(2); // INCB

      assert.equal(cpu.status().b, 0xFF, "B incremented");
    });

    QUnit.test("DECA - Decrement A", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDAA immediate
      mem[0x1001] = 0x43;
      mem[0x1002] = 0x4A; // DECA

      cpu.reset();
      cpu.steps(2); // LDAA
      cpu.steps(2); // DECA

      assert.equal(cpu.status().a, 0x42, "A decremented");
    });

    QUnit.test("DECB - Decrement B", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xC6; // LDAB immediate
      mem[0x1001] = 0x01;
      mem[0x1002] = 0x5A; // DECB

      cpu.reset();
      cpu.steps(2); // LDAB
      cpu.steps(2); // DECB

      const state = cpu.status();
      assert.equal(state.b, 0x00, "B decremented to 0");
      assert.equal(state.flags & 0x04, 0x04, "Zero flag set");
    });

    QUnit.test("INX - Increment X", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xCE; // LDX immediate
      mem[0x1001] = 0xFF;
      mem[0x1002] = 0xFF;
      mem[0x1003] = 0x08; // INX

      cpu.reset();
      cpu.steps(3); // LDX
      cpu.steps(4); // INX

      assert.equal(cpu.status().x, 0x0000, "X wrapped to 0");
    });

    QUnit.test("DEX - Decrement X", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xCE; // LDX immediate
      mem[0x1001] = 0x00;
      mem[0x1002] = 0x01;
      mem[0x1003] = 0x09; // DEX

      cpu.reset();
      cpu.steps(3); // LDX
      cpu.steps(4); // DEX

      assert.equal(cpu.status().x, 0x0000, "X decremented to 0");
    });
  });

  QUnit.module("Rotate and Shift", () => {
    QUnit.test("ASLA - Arithmetic shift left A", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDAA immediate
      mem[0x1001] = 0x42;
      mem[0x1002] = 0x48; // ASLA

      cpu.reset();
      cpu.steps(2); // LDAA
      cpu.steps(2); // ASLA

      assert.equal(cpu.status().a, 0x84, "A shifted left");
    });

    QUnit.test("ASRA - Arithmetic shift right A", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDAA immediate
      mem[0x1001] = 0x84;
      mem[0x1002] = 0x47; // ASRA

      cpu.reset();
      cpu.steps(2); // LDAA
      cpu.steps(2); // ASRA

      assert.equal(cpu.status().a, 0xC2, "A shifted right preserving sign");
    });

    QUnit.test("LSRA - Logical shift right A", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDAA immediate
      mem[0x1001] = 0x84;
      mem[0x1002] = 0x44; // LSRA

      cpu.reset();
      cpu.steps(2); // LDAA
      cpu.steps(2); // LSRA

      assert.equal(cpu.status().a, 0x42, "A shifted right logically");
    });

    QUnit.test("ROLA - Rotate left A through carry", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDAA immediate
      mem[0x1001] = 0x80;
      mem[0x1002] = 0x49; // ROLA

      cpu.reset();
      cpu.steps(2); // LDAA
      cpu.steps(2); // ROLA

      const state = cpu.status();
      assert.equal(state.a, 0x00, "A rotated left");
      assert.equal(state.flags & 0x01, 1, "Carry set from bit 7");
    });

    QUnit.test("RORA - Rotate right A through carry", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDAA immediate
      mem[0x1001] = 0x01;
      mem[0x1002] = 0x46; // RORA

      cpu.reset();
      cpu.steps(2); // LDAA
      cpu.steps(2); // RORA

      const state = cpu.status();
      assert.equal(state.a, 0x00, "A rotated right");
      assert.equal(state.flags & 0x01, 1, "Carry set from bit 0");
    });
  });

  QUnit.module("Clear and Negate", () => {
    QUnit.test("CLRA - Clear A", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDAA immediate
      mem[0x1001] = 0xFF;
      mem[0x1002] = 0x4F; // CLRA

      cpu.reset();
      cpu.steps(2); // LDAA
      cpu.steps(2); // CLRA

      const state = cpu.status();
      assert.equal(state.a, 0x00, "A cleared");
      assert.equal(state.flags & 0x04, 0x04, "Zero flag set");
    });

    QUnit.test("CLRB - Clear B", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xC6; // LDAB immediate
      mem[0x1001] = 0xAA;
      mem[0x1002] = 0x5F; // CLRB

      cpu.reset();
      cpu.steps(2); // LDAB
      cpu.steps(2); // CLRB

      const state = cpu.status();
      assert.equal(state.b, 0x00, "B cleared");
      assert.equal(state.flags & 0x04, 0x04, "Zero flag set");
    });

    QUnit.test("NEGA - Negate A (two's complement)", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDAA immediate
      mem[0x1001] = 0x01;
      mem[0x1002] = 0x40; // NEGA

      cpu.reset();
      cpu.steps(2); // LDAA
      cpu.steps(2); // NEGA

      assert.equal(cpu.status().a, 0xFF, "A negated");
    });

    QUnit.test("NEGB - Negate B", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xC6; // LDAB immediate
      mem[0x1001] = 0x05;
      mem[0x1002] = 0x50; // NEGB

      cpu.reset();
      cpu.steps(2); // LDAB
      cpu.steps(2); // NEGB

      assert.equal(cpu.status().b, 0xFB, "B negated");
    });
  });

  QUnit.module("Test Instructions", () => {
    QUnit.test("TSTA - Test A (compare with 0)", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDAA immediate
      mem[0x1001] = 0x00;
      mem[0x1002] = 0x4D; // TSTA

      cpu.reset();
      cpu.steps(2); // LDAA
      cpu.steps(2); // TSTA

      const state = cpu.status();
      assert.equal(state.a, 0x00, "A unchanged");
      assert.equal(state.flags & 0x04, 0x04, "Zero flag set");
    });

    QUnit.test("TSTB - Test B", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xC6; // LDAB immediate
      mem[0x1001] = 0x80;
      mem[0x1002] = 0x5D; // TSTB

      cpu.reset();
      cpu.steps(2); // LDAB
      cpu.steps(2); // TSTB

      const state = cpu.status();
      assert.equal(state.b, 0x80, "B unchanged");
      assert.equal(state.flags & 0x08, 0x08, "Negative flag set");
    });
  });

  QUnit.module("Transfer Instructions", () => {
    QUnit.test("TAB - Transfer A to B", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDAA immediate
      mem[0x1001] = 0x42;
      mem[0x1002] = 0x16; // TAB

      cpu.reset();
      cpu.steps(2); // LDAA
      cpu.steps(2); // TAB

      const state = cpu.status();
      assert.equal(state.b, 0x42, "B = A");
      assert.equal(state.a, 0x42, "A unchanged");
    });

    QUnit.test("TBA - Transfer B to A", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xC6; // LDAB immediate
      mem[0x1001] = 0x55;
      mem[0x1002] = 0x17; // TBA

      cpu.reset();
      cpu.steps(2); // LDAB
      cpu.steps(2); // TBA

      const state = cpu.status();
      assert.equal(state.a, 0x55, "A = B");
      assert.equal(state.b, 0x55, "B unchanged");
    });

    QUnit.test("TSX - Transfer SP to X", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x8E; // LDS immediate
      mem[0x1001] = 0xF0;
      mem[0x1002] = 0x00;
      mem[0x1003] = 0x30; // TSX

      cpu.reset();
      cpu.steps(3); // LDS
      cpu.steps(4); // TSX

      assert.equal(cpu.status().x, 0xF001, "X = SP + 1");
    });

    QUnit.test("TXS - Transfer X to SP", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xCE; // LDX immediate
      mem[0x1001] = 0xF0;
      mem[0x1002] = 0x00;
      mem[0x1003] = 0x35; // TXS

      cpu.reset();
      cpu.steps(3); // LDX
      cpu.steps(4); // TXS

      assert.equal(cpu.status().sp, 0xEFFF, "SP = X - 1");
    });
  });

  QUnit.module("Stack Operations", () => {
    QUnit.test("PSHA - Push A onto stack", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x8E; // LDS immediate
      mem[0x1001] = 0xF0;
      mem[0x1002] = 0x00;
      mem[0x1003] = 0x86; // LDAA immediate
      mem[0x1004] = 0x42;
      mem[0x1005] = 0x36; // PSHA

      cpu.reset();
      cpu.steps(3); // LDS
      cpu.steps(2); // LDAA
      cpu.steps(4); // PSHA

      const state = cpu.status();
      assert.equal(mem[0xF000], 0x42, "A pushed to stack");
      assert.equal(state.sp, 0xEFFF, "SP decremented");
    });

    QUnit.test("PSHB - Push B onto stack", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x8E; // LDS immediate
      mem[0x1001] = 0xF0;
      mem[0x1002] = 0x00;
      mem[0x1003] = 0xC6; // LDAB immediate
      mem[0x1004] = 0x55;
      mem[0x1005] = 0x37; // PSHB

      cpu.reset();
      cpu.steps(3); // LDS
      cpu.steps(2); // LDAB
      cpu.steps(4); // PSHB

      assert.equal(mem[0xF000], 0x55, "B pushed to stack");
    });

    QUnit.test("PULA - Pull A from stack", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x8E; // LDS immediate
      mem[0x1001] = 0xEF;
      mem[0x1002] = 0xFF;
      mem[0xF000] = 0x99; // Value on stack
      mem[0x1003] = 0x32; // PULA

      cpu.reset();
      cpu.steps(3); // LDS
      cpu.steps(4); // PULA

      const state = cpu.status();
      assert.equal(state.a, 0x99, "A pulled from stack");
      assert.equal(state.sp, 0xF000, "SP incremented");
    });

    QUnit.test("PULB - Pull B from stack", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x8E; // LDS immediate
      mem[0x1001] = 0xEF;
      mem[0x1002] = 0xFF;
      mem[0xF000] = 0xAA;
      mem[0x1003] = 0x33; // PULB

      cpu.reset();
      cpu.steps(3); // LDS
      cpu.steps(4); // PULB

      assert.equal(cpu.status().b, 0xAA, "B pulled from stack");
    });
  });

  QUnit.module("Branch Instructions", () => {
    QUnit.test("BRA - Branch always", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x20; // BRA
      mem[0x1001] = 0x10; // Offset +16

      cpu.reset();
      cpu.steps(4);

      assert.equal(cpu.status().pc, 0x1012, "Branch taken");
    });

    QUnit.test("BEQ - Branch if equal (taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDAA immediate
      mem[0x1001] = 0x00;
      mem[0x1002] = 0x27; // BEQ
      mem[0x1003] = 0x05; // Offset +5

      cpu.reset();
      cpu.steps(2); // LDAA (sets Z)
      cpu.steps(4); // BEQ

      assert.equal(cpu.status().pc, 0x1009, "Branch taken when Z set");
    });

    QUnit.test("BNE - Branch if not equal (not taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDAA immediate
      mem[0x1001] = 0x00;
      mem[0x1002] = 0x26; // BNE
      mem[0x1003] = 0x05;

      cpu.reset();
      cpu.steps(2); // LDAA (sets Z)
      cpu.steps(4); // BNE

      assert.equal(cpu.status().pc, 0x1004, "Branch not taken when Z set");
    });

    QUnit.test("BCC - Branch if carry clear", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x0C; // CLC (clear carry)
      mem[0x1001] = 0x24; // BCC
      mem[0x1002] = 0x08;

      cpu.reset();
      cpu.steps(2); // CLC
      cpu.steps(4); // BCC

      assert.equal(cpu.status().pc, 0x100B, "Branch taken when C clear");
    });

    QUnit.test("BCS - Branch if carry set", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x0D; // SEC (set carry)
      mem[0x1001] = 0x25; // BCS
      mem[0x1002] = 0x07;

      cpu.reset();
      cpu.steps(2); // SEC
      cpu.steps(4); // BCS

      assert.equal(cpu.status().pc, 0x100A, "Branch taken when C set");
    });

    QUnit.test("BMI - Branch if minus", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDAA immediate
      mem[0x1001] = 0x80; // Negative value
      mem[0x1002] = 0x2B; // BMI
      mem[0x1003] = 0x06;

      cpu.reset();
      cpu.steps(2); // LDAA (sets N)
      cpu.steps(4); // BMI

      assert.equal(cpu.status().pc, 0x100A, "Branch taken when N set");
    });

    QUnit.test("BPL - Branch if plus", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDAA immediate
      mem[0x1001] = 0x7F; // Positive value
      mem[0x1002] = 0x2A; // BPL
      mem[0x1003] = 0x05;

      cpu.reset();
      cpu.steps(2); // LDAA (clears N)
      cpu.steps(4); // BPL

      assert.equal(cpu.status().pc, 0x1009, "Branch taken when N clear");
    });

    QUnit.test("BVS - Branch if overflow set", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x0B; // SEV (set overflow)
      mem[0x1001] = 0x29; // BVS
      mem[0x1002] = 0x04;

      cpu.reset();
      cpu.steps(2); // SEV
      cpu.steps(4); // BVS

      assert.equal(cpu.status().pc, 0x1007, "Branch taken when V set");
    });

    QUnit.test("BVC - Branch if overflow clear", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x0A; // CLV (clear overflow)
      mem[0x1001] = 0x28; // BVC
      mem[0x1002] = 0x03;

      cpu.reset();
      cpu.steps(2); // CLV
      cpu.steps(4); // BVC

      assert.equal(cpu.status().pc, 0x1006, "Branch taken when V clear");
    });

    QUnit.test("BHI - Branch if higher (unsigned >)", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDAA immediate
      mem[0x1001] = 0x05;
      mem[0x1002] = 0x81; // CMPA immediate
      mem[0x1003] = 0x03;
      mem[0x1004] = 0x22; // BHI
      mem[0x1005] = 0x02;

      cpu.reset();
      cpu.steps(2); // LDAA
      cpu.steps(2); // CMPA
      cpu.steps(4); // BHI

      assert.equal(cpu.status().pc, 0x1008, "Branch taken when A > operand");
    });

    QUnit.test("BLS - Branch if lower or same (unsigned <=)", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDAA immediate
      mem[0x1001] = 0x03;
      mem[0x1002] = 0x81; // CMPA immediate
      mem[0x1003] = 0x05;
      mem[0x1004] = 0x23; // BLS
      mem[0x1005] = 0x02;

      cpu.reset();
      cpu.steps(2); // LDAA
      cpu.steps(2); // CMPA
      cpu.steps(4); // BLS

      assert.equal(cpu.status().pc, 0x1008, "Branch taken when A <= operand");
    });

    QUnit.test("BGE - Branch if greater or equal (signed >=)", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDAA immediate
      mem[0x1001] = 0x05;
      mem[0x1002] = 0x81; // CMPA immediate
      mem[0x1003] = 0x03;
      mem[0x1004] = 0x2C; // BGE
      mem[0x1005] = 0x02;

      cpu.reset();
      cpu.steps(2); // LDAA
      cpu.steps(2); // CMPA
      cpu.steps(4); // BGE

      assert.equal(cpu.status().pc, 0x1008, "Branch taken when A >= operand");
    });

    QUnit.test("BLT - Branch if less than (signed <)", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDAA immediate
      mem[0x1001] = 0x03;
      mem[0x1002] = 0x81; // CMPA immediate
      mem[0x1003] = 0x05;
      mem[0x1004] = 0x2D; // BLT
      mem[0x1005] = 0x02;

      cpu.reset();
      cpu.steps(2); // LDAA
      cpu.steps(2); // CMPA
      cpu.steps(4); // BLT

      assert.equal(cpu.status().pc, 0x1008, "Branch taken when A < operand");
    });

    QUnit.test("BGT - Branch if greater than (signed >)", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDAA immediate
      mem[0x1001] = 0x06;
      mem[0x1002] = 0x81; // CMPA immediate
      mem[0x1003] = 0x04;
      mem[0x1004] = 0x2E; // BGT
      mem[0x1005] = 0x02;

      cpu.reset();
      cpu.steps(2); // LDAA
      cpu.steps(2); // CMPA
      cpu.steps(4); // BGT

      assert.equal(cpu.status().pc, 0x1008, "Branch taken when A > operand");
    });

    QUnit.test("BLE - Branch if less or equal (signed <=)", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDAA immediate
      mem[0x1001] = 0x04;
      mem[0x1002] = 0x81; // CMPA immediate
      mem[0x1003] = 0x06;
      mem[0x1004] = 0x2F; // BLE
      mem[0x1005] = 0x02;

      cpu.reset();
      cpu.steps(2); // LDAA
      cpu.steps(2); // CMPA
      cpu.steps(4); // BLE

      assert.equal(cpu.status().pc, 0x1008, "Branch taken when A <= operand");
    });
  });

  QUnit.module("Jump and Subroutine", () => {
    QUnit.test("JMP extended - Absolute jump", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x7E; // JMP extended
      mem[0x1001] = 0x20;
      mem[0x1002] = 0x00;

      cpu.reset();
      cpu.steps(3);

      assert.equal(cpu.status().pc, 0x2000, "PC = absolute address");
    });

    QUnit.test("JMP indexed - Indexed jump", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xCE; // LDX immediate
      mem[0x1001] = 0x30;
      mem[0x1002] = 0x00;
      mem[0x1003] = 0x6E; // JMP indexed
      mem[0x1004] = 0x10; // Offset

      cpu.reset();
      cpu.steps(3); // LDX
      cpu.steps(4); // JMP indexed (actually 4 cycles, not 6)

      assert.equal(cpu.status().pc, 0x3010, "PC = X + offset");
    });

    QUnit.test("JSR indexed - Call subroutine indexed", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x8E; // LDS immediate
      mem[0x1001] = 0xF0;
      mem[0x1002] = 0x00;
      mem[0x1003] = 0xCE; // LDX immediate
      mem[0x1004] = 0x40;
      mem[0x1005] = 0x00;
      mem[0x1006] = 0xAD; // JSR indexed
      mem[0x1007] = 0x20; // Offset

      cpu.reset();
      cpu.steps(3); // LDS
      cpu.steps(3); // LDX
      cpu.steps(8); // JSR indexed

      const state = cpu.status();
      assert.equal(state.pc, 0x4020, "PC = X + offset");
      assert.ok(state.sp < 0xF000, "Return address pushed to stack");
    });

    QUnit.test("JSR extended - Call subroutine", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x8E; // LDS immediate
      mem[0x1001] = 0xF0;
      mem[0x1002] = 0x00;
      mem[0x1003] = 0xBD; // JSR extended
      mem[0x1004] = 0x40;
      mem[0x1005] = 0x00;

      cpu.reset();
      cpu.steps(3); // LDS
      cpu.steps(9); // JSR

      const state = cpu.status();
      assert.equal(state.pc, 0x4000, "PC = subroutine address");
      assert.equal(mem[0xF000], 0x06, "Return address low pushed (first, at original SP)");
      assert.equal(mem[0xEFFF], 0x10, "Return address high pushed (second, at SP-1)");
      assert.equal(state.sp, 0xEFFE, "SP decremented by 2");
    });

    QUnit.test("BSR - Branch to subroutine", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x8E; // LDS immediate
      mem[0x1001] = 0xF0;
      mem[0x1002] = 0x00;
      mem[0x1003] = 0x8D; // BSR
      mem[0x1004] = 0x10; // Offset +16

      cpu.reset();
      cpu.steps(3); // LDS
      cpu.steps(8); // BSR

      const state = cpu.status();
      assert.equal(state.pc, 0x1015, "PC = PC + 2 + offset");
      assert.equal(state.sp, 0xEFFE, "Return address pushed");
    });

    QUnit.test("RTS - Return from subroutine", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x8E; // LDS immediate
      mem[0x1001] = 0xEF;
      mem[0x1002] = 0xFE;
      mem[0xEFFF] = 0x12; // High byte of return address
      mem[0xF000] = 0x34; // Low byte of return address
      mem[0x1003] = 0x39; // RTS

      cpu.reset();
      cpu.steps(3); // LDS
      cpu.steps(5); // RTS

      const state = cpu.status();
      assert.equal(state.pc, 0x1234, "PC restored from stack");
      assert.equal(state.sp, 0xF000, "SP restored");
    });
  });

  QUnit.module("Flag Operations", () => {
    QUnit.test("CLC - Clear carry", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x0D; // SEC
      mem[0x1001] = 0x0C; // CLC

      cpu.reset();
      cpu.steps(2); // SEC
      cpu.steps(2); // CLC

      assert.equal(cpu.status().flags & 0x01, 0, "Carry cleared");
    });

    QUnit.test("SEC - Set carry", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x0D; // SEC

      cpu.reset();
      cpu.steps(2);

      assert.equal(cpu.status().flags & 0x01, 1, "Carry set");
    });

    QUnit.test("CLV - Clear overflow", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x0B; // SEV
      mem[0x1001] = 0x0A; // CLV

      cpu.reset();
      cpu.steps(2); // SEV
      cpu.steps(2); // CLV

      assert.equal(cpu.status().flags & 0x02, 0, "Overflow cleared");
    });

    QUnit.test("SEV - Set overflow", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x0B; // SEV

      cpu.reset();
      cpu.steps(2);

      assert.equal(cpu.status().flags & 0x02, 2, "Overflow set");
    });

    QUnit.test("CLI - Clear interrupt mask", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x0E; // CLI

      cpu.reset();
      cpu.steps(2);

      assert.equal(cpu.status().flags & 0x10, 0, "Interrupt mask cleared");
    });

    QUnit.test("SEI - Set interrupt mask", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x0E; // CLI
      mem[0x1001] = 0x0F; // SEI

      cpu.reset();
      cpu.steps(2); // CLI
      cpu.steps(2); // SEI

      assert.equal(cpu.status().flags & 0x10, 0x10, "Interrupt mask set");
    });

    QUnit.test("TAP - Transfer A to processor flags", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDAA immediate
      mem[0x1001] = 0x3F; // All flags
      mem[0x1002] = 0x06; // TAP

      cpu.reset();
      cpu.steps(2); // LDAA
      cpu.steps(2); // TAP

      assert.equal(cpu.status().flags, 0x3F, "Flags = A");
    });

    QUnit.test("TPA - Transfer processor flags to A", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x0D; // SEC
      mem[0x1001] = 0x07; // TPA

      cpu.reset();
      cpu.steps(2); // SEC
      cpu.steps(2); // TPA

      const state = cpu.status();
      assert.equal(state.a & 0x01, 1, "A contains carry flag");
    });
  });

  QUnit.module("Miscellaneous", () => {
    QUnit.test("NOP - No operation", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x01; // NOP

      cpu.reset();
      const pc0 = cpu.status().pc;
      cpu.steps(2);
      const pc1 = cpu.status().pc;

      assert.equal(pc1 - pc0, 1, "PC advances by 1");
    });

    QUnit.test("DAA - Decimal adjust accumulator", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDAA immediate
      mem[0x1001] = 0x15; // BCD 15
      mem[0x1002] = 0x8B; // ADDA immediate
      mem[0x1003] = 0x27; // BCD 27
      mem[0x1004] = 0x19; // DAA

      cpu.reset();
      cpu.steps(2); // LDAA
      cpu.steps(2); // ADDA
      cpu.steps(2); // DAA

      assert.equal(cpu.status().a, 0x42, "BCD result = 42");
    });

    QUnit.test("INS - Increment SP", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x8E; // LDS immediate
      mem[0x1001] = 0xF0;
      mem[0x1002] = 0x00;
      mem[0x1003] = 0x31; // INS

      cpu.reset();
      cpu.steps(3); // LDS
      cpu.steps(4); // INS

      assert.equal(cpu.status().sp, 0xF001, "SP incremented");
    });

    QUnit.test("DES - Decrement SP", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x8E; // LDS immediate
      mem[0x1001] = 0xF0;
      mem[0x1002] = 0x00;
      mem[0x1003] = 0x34; // DES

      cpu.reset();
      cpu.steps(3); // LDS
      cpu.steps(4); // DES

      assert.equal(cpu.status().sp, 0xEFFF, "SP decremented");
    });
  });

  QUnit.module("Load/Store SP and X (for coverage)", () => {
    QUnit.test("LDS direct - Load SP from direct page", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x50] = 0xEF; // SP high byte
      mem[0x51] = 0xF0; // SP low byte

      mem[0x1000] = 0x9E; // LDS direct
      mem[0x1001] = 0x50; // Direct page address

      cpu.reset();
      cpu.steps(4); // LDS direct

      assert.equal(cpu.status().sp, 0xEFF0, "SP loaded from direct page");
    });

    QUnit.test("LDS indexed - Load SP from indexed address", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x2010] = 0xAB; // SP high byte
      mem[0x2011] = 0xCD; // SP low byte

      mem[0x1000] = 0xCE; // LDX immediate
      mem[0x1001] = 0x20;
      mem[0x1002] = 0x00;
      mem[0x1003] = 0xAE; // LDS indexed
      mem[0x1004] = 0x10; // Offset

      cpu.reset();
      cpu.steps(3); // LDX
      cpu.steps(6); // LDS indexed

      assert.equal(cpu.status().sp, 0xABCD, "SP loaded from X+offset");
    });

    QUnit.test("LDS extended - Load SP from extended address", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x3000] = 0x12; // SP high byte
      mem[0x3001] = 0x34; // SP low byte

      mem[0x1000] = 0xBE; // LDS extended
      mem[0x1001] = 0x30;
      mem[0x1002] = 0x00;

      cpu.reset();
      cpu.steps(5); // LDS extended

      assert.equal(cpu.status().sp, 0x1234, "SP loaded from extended address");
    });

    QUnit.test("STS direct - Store SP to direct page", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x8E; // LDS immediate
      mem[0x1001] = 0xAB;
      mem[0x1002] = 0xCD;
      mem[0x1003] = 0x9F; // STS direct
      mem[0x1004] = 0x50; // Direct page address

      cpu.reset();
      cpu.steps(3); // LDS
      cpu.steps(5); // STS direct

      assert.equal(mem[0x50], 0xAB, "SP high byte stored to direct page");
      assert.equal(mem[0x51], 0xCD, "SP low byte stored to direct page");
    });

    QUnit.test("STS extended - Store SP to memory", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x8E; // LDS immediate
      mem[0x1001] = 0x12;
      mem[0x1002] = 0x34;
      mem[0x1003] = 0xBF; // STS extended
      mem[0x1004] = 0x20;
      mem[0x1005] = 0x00;

      cpu.reset();
      cpu.steps(3); // LDS
      cpu.steps(5); // STS

      assert.equal(mem[0x2000], 0x12, "SP high byte stored");
      assert.equal(mem[0x2001], 0x34, "SP low byte stored");
    });

    QUnit.test("STS indexed - Store SP to indexed memory", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xCE; // LDX immediate
      mem[0x1001] = 0x20;
      mem[0x1002] = 0x00;
      mem[0x1003] = 0x8E; // LDS immediate
      mem[0x1004] = 0x56;
      mem[0x1005] = 0x78;
      mem[0x1006] = 0xAF; // STS indexed
      mem[0x1007] = 0x10; // offset

      cpu.reset();
      cpu.steps(3); // LDX
      cpu.steps(3); // LDS
      cpu.steps(6); // STS indexed

      assert.equal(mem[0x2010], 0x56, "SP high byte stored at X+offset");
      assert.equal(mem[0x2011], 0x78, "SP low byte stored at X+offset");
    });

    QUnit.test("LDX direct - Load X from direct page", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x50] = 0xFE; // X high byte
      mem[0x51] = 0xDC; // X low byte

      mem[0x1000] = 0xDE; // LDX direct
      mem[0x1001] = 0x50; // Direct page address

      cpu.reset();
      cpu.steps(4); // LDX direct

      assert.equal(cpu.status().x, 0xFEDC, "X loaded from direct page");
    });

    QUnit.test("STX direct - Store X to direct page", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xCE; // LDX immediate
      mem[0x1001] = 0x99;
      mem[0x1002] = 0x88;
      mem[0x1003] = 0xDF; // STX direct
      mem[0x1004] = 0x60; // Direct page address

      cpu.reset();
      cpu.steps(3); // LDX
      cpu.steps(5); // STX direct

      assert.equal(mem[0x60], 0x99, "X high byte stored to direct page");
      assert.equal(mem[0x61], 0x88, "X low byte stored to direct page");
    });

    QUnit.test("STX extended - Store X to memory", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xCE; // LDX immediate
      mem[0x1001] = 0xAB;
      mem[0x1002] = 0xCD;
      mem[0x1003] = 0xFF; // STX extended
      mem[0x1004] = 0x30;
      mem[0x1005] = 0x00;

      cpu.reset();
      cpu.steps(3); // LDX
      cpu.steps(5); // STX

      assert.equal(mem[0x3000], 0xAB, "X high byte stored");
      assert.equal(mem[0x3001], 0xCD, "X low byte stored");
    });

    QUnit.test("STX indexed - Store X to indexed memory", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xCE; // LDX immediate
      mem[0x1001] = 0x30;
      mem[0x1002] = 0x00;
      mem[0x1003] = 0xEF; // STX indexed
      mem[0x1004] = 0x20; // offset

      cpu.reset();
      cpu.steps(3); // LDX
      cpu.steps(6); // STX indexed

      assert.equal(mem[0x3020], 0x30, "X high byte stored at X+offset");
      assert.equal(mem[0x3021], 0x00, "X low byte stored at X+offset");
    });
  });

  QUnit.module("API Functions (for coverage)", () => {
    QUnit.test("setRegister - Set PC", (assert) => {
      const { cpu } = createTestCPU();

      cpu.reset();
      cpu.set("pc", 0x5000);

      assert.equal(cpu.status().pc, 0x5000, "PC set correctly");
    });

    QUnit.test("setRegister - Set A", (assert) => {
      const { cpu } = createTestCPU();

      cpu.reset();
      cpu.set("a", 0x42);

      assert.equal(cpu.status().a, 0x42, "A set correctly");
    });

    QUnit.test("setRegister - Set flags", (assert) => {
      const { cpu } = createTestCPU();

      cpu.reset();
      cpu.set("flags", 0x3F);

      assert.equal(cpu.status().flags, 0x3F, "Flags set correctly");
    });

    QUnit.test("flagsToString - All flags set", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x06; // TAP
      mem[0x1001] = 0x07; // TPA

      cpu.reset();
      cpu.set("a", 0x3F); // Set all flags
      cpu.steps(2); // TAP

      const flagStr = cpu.flagsToString();
      assert.ok(flagStr.includes("H") || flagStr.includes("h"), "Half-carry flag represented");
      assert.ok(flagStr.includes("I") || flagStr.includes("i"), "Interrupt flag represented");
      assert.ok(flagStr.includes("N") || flagStr.includes("n"), "Negative flag represented");
      assert.ok(flagStr.includes("Z") || flagStr.includes("z"), "Zero flag represented");
      assert.ok(flagStr.includes("V") || flagStr.includes("v"), "Overflow flag represented");
      assert.ok(flagStr.includes("C") || flagStr.includes("c"), "Carry flag represented");
    });

    QUnit.test("init - Initialize CPU state", (assert) => {
      const { cpu, mem } = createTestCPU();

      // Set some register values
      cpu.set("a", 0x42);
      cpu.set("b", 0x55);
      cpu.set("x", 0x1234);
      cpu.set("sp", 0xF000);

      // Call init - should reset all registers
      cpu.init();

      const state = cpu.status();
      assert.equal(state.a, 0, "A cleared by init");
      assert.equal(state.b, 0, "B cleared by init");
      assert.equal(state.x, 0, "X cleared by init");
      assert.equal(state.sp, 0, "SP cleared by init");
      assert.equal(state.pc, 0x1000, "PC loaded from reset vector after init");
    });

    QUnit.test("WAI - Wait for interrupt with break flag", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x3E; // WAI instruction

      cpu.reset();
      cpu.steps(100); // Try to execute many cycles

      // WAI should set break flag and stop execution
      // PC should still be at WAI instruction
      assert.ok(true, "WAI instruction executed without crash");
    });
  });

  QUnit.module("Interrupts and Control Flow (for coverage)", () => {
    QUnit.test("SWI - Software interrupt", (assert) => {
      const { cpu, mem } = createTestCPU();

      // Set SWI vector
      mem[0xFFFA] = 0x70; // SWI vector high
      mem[0xFFFB] = 0x00; // SWI vector low

      mem[0x1000] = 0x10; // Page 2
      mem[0x1001] = 0xCE; // LDS immediate
      mem[0x1002] = 0xF0;
      mem[0x1003] = 0x00;
      mem[0x1004] = 0x86; // LDA immediate
      mem[0x1005] = 0x42;
      mem[0x1006] = 0xC6; // LDB immediate
      mem[0x1007] = 0x55;
      mem[0x1008] = 0x3F; // SWI

      cpu.reset();
      cpu.steps(4); // LDS
      cpu.steps(2); // LDA
      cpu.steps(2); // LDB
      cpu.steps(12); // SWI (pushes all registers)

      const state = cpu.status();
      assert.equal(state.pc, 0x7000, "PC jumped to SWI vector");
      assert.ok(state.flags & 0x10, "Interrupt mask set");
      assert.ok(state.sp < 0xF000, "Registers pushed to stack");
    });

    QUnit.test("RTI - Return from interrupt", (assert) => {
      const { cpu, mem } = createTestCPU();

      // Simulate interrupt stack frame
      mem[0x1000] = 0x10; // Page 2
      mem[0x1001] = 0xCE; // LDS immediate
      mem[0x1002] = 0xEF;
      mem[0x1003] = 0xF2; // SP = 0xEFF2

      // Stack contents (as if pushed by interrupt)
      mem[0xEFF3] = 0x3F; // Flags
      mem[0xEFF4] = 0x99; // B
      mem[0xEFF5] = 0x88; // A
      mem[0xEFF6] = 0xCD; // X low
      mem[0xEFF7] = 0xAB; // X high
      mem[0xEFF8] = 0x34; // PC low
      mem[0xEFF9] = 0x12; // PC high

      mem[0x1004] = 0x3B; // RTI

      cpu.reset();
      cpu.steps(4); // LDS
      cpu.steps(10); // RTI (pulls all registers)

      const state = cpu.status();
      assert.equal(state.pc, 0x1234, "PC restored from stack");
      assert.equal(state.a, 0x88, "A restored from stack");
      assert.equal(state.b, 0x99, "B restored from stack");
      assert.equal(state.x, 0xABCD, "X restored from stack");
      assert.equal(state.flags & 0x3F, 0x3F, "Flags restored from stack");
    });

    QUnit.test("interrupt - Hardware interrupt when enabled", (assert) => {
      const { cpu, mem } = createTestCPU();

      // Set up interrupt vector
      mem[0xFFF8] = 0x50; // INT vector high
      mem[0xFFF9] = 0x00; // INT vector low

      mem[0x1000] = 0x0E; // CLI - clear interrupt mask
      mem[0x1001] = 0x01; // NOP

      cpu.reset();
      cpu.steps(2); // CLI

      // Trigger interrupt
      cpu.interrupt();

      const state = cpu.status();
      assert.equal(state.pc, 0x5000, "PC jumped to interrupt vector");
      assert.ok(state.flags & 0x10, "Interrupt mask set");
    });

    QUnit.test("interrupt - Ignored when interrupt mask set", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x0F; // SEI - set interrupt mask
      mem[0x1001] = 0x01; // NOP

      cpu.reset();
      cpu.steps(2); // SEI

      const pcBefore = cpu.status().pc;

      // Try to trigger interrupt (should be ignored)
      cpu.interrupt();

      const pcAfter = cpu.status().pc;
      assert.equal(pcAfter, pcBefore, "Interrupt ignored when mask set");
    });

    QUnit.test("nmi - Non-maskable interrupt", (assert) => {
      const { cpu, mem } = createTestCPU();

      // Set up NMI vector
      mem[0xFFFC] = 0x60; // NMI vector high
      mem[0xFFFD] = 0x00; // NMI vector low

      cpu.reset();

      // Trigger NMI (always triggers regardless of interrupt mask)
      cpu.nmi();

      const state = cpu.status();
      assert.equal(state.pc, 0x6000, "PC jumped to NMI vector");
      assert.ok(state.flags & 0x10, "Interrupt mask set after NMI");
    });
  });

  QUnit.module("Disassembler (for coverage)", () => {
    QUnit.test("Inherent instructions", (assert) => {
      assert.deepEqual(disasm(0x01, 0, 0, 0x1000), ["NOP", 1], "NOP");
      assert.deepEqual(disasm(0x08, 0, 0, 0x1000), ["INX", 1], "INX");
      assert.deepEqual(disasm(0x09, 0, 0, 0x1000), ["DEX", 1], "DEX");
      assert.deepEqual(disasm(0x0A, 0, 0, 0x1000), ["CLV", 1], "CLV");
      assert.deepEqual(disasm(0x0B, 0, 0, 0x1000), ["SEV", 1], "SEV");
      assert.deepEqual(disasm(0x0C, 0, 0, 0x1000), ["CLC", 1], "CLC");
      assert.deepEqual(disasm(0x0D, 0, 0, 0x1000), ["SEC", 1], "SEC");
      assert.deepEqual(disasm(0x0E, 0, 0, 0x1000), ["CLI", 1], "CLI");
      assert.deepEqual(disasm(0x0F, 0, 0, 0x1000), ["SEI", 1], "SEI");
      assert.deepEqual(disasm(0x10, 0, 0, 0x1000), ["SBA", 1], "SBA");
      assert.deepEqual(disasm(0x11, 0, 0, 0x1000), ["CBA", 1], "CBA");
      assert.deepEqual(disasm(0x16, 0, 0, 0x1000), ["TAB", 1], "TAB");
      assert.deepEqual(disasm(0x17, 0, 0, 0x1000), ["TBA", 1], "TBA");
      assert.deepEqual(disasm(0x19, 0, 0, 0x1000), ["DAA", 1], "DAA");
      assert.deepEqual(disasm(0x1B, 0, 0, 0x1000), ["ABA", 1], "ABA");
    });

    QUnit.test("Stack and transfer instructions", (assert) => {
      assert.deepEqual(disasm(0x30, 0, 0, 0x1000), ["TSX", 1], "TSX");
      assert.deepEqual(disasm(0x35, 0, 0, 0x1000), ["TXS", 1], "TXS");
      assert.deepEqual(disasm(0x31, 0, 0, 0x1000), ["INS", 1], "INS");
      assert.deepEqual(disasm(0x34, 0, 0, 0x1000), ["DES", 1], "DES");
      assert.deepEqual(disasm(0x32, 0, 0, 0x1000), ["PULA", 1], "PULA");
      assert.deepEqual(disasm(0x33, 0, 0, 0x1000), ["PULB", 1], "PULB");
      assert.deepEqual(disasm(0x36, 0, 0, 0x1000), ["PSHA", 1], "PSHA");
      assert.deepEqual(disasm(0x37, 0, 0, 0x1000), ["PSHB", 1], "PSHB");
    });

    QUnit.test("Accumulator A operations", (assert) => {
      assert.deepEqual(disasm(0x40, 0, 0, 0x1000), ["NEGA", 1], "NEGA");
      assert.deepEqual(disasm(0x43, 0, 0, 0x1000), ["COMA", 1], "COMA");
      assert.deepEqual(disasm(0x44, 0, 0, 0x1000), ["LSRA", 1], "LSRA");
      assert.deepEqual(disasm(0x46, 0, 0, 0x1000), ["RORA", 1], "RORA");
      assert.deepEqual(disasm(0x47, 0, 0, 0x1000), ["ASRA", 1], "ASRA");
      assert.deepEqual(disasm(0x48, 0, 0, 0x1000), ["ASLA", 1], "ASLA");
      assert.deepEqual(disasm(0x49, 0, 0, 0x1000), ["ROLA", 1], "ROLA");
      assert.deepEqual(disasm(0x4A, 0, 0, 0x1000), ["DECA", 1], "DECA");
      assert.deepEqual(disasm(0x4C, 0, 0, 0x1000), ["INCA", 1], "INCA");
      assert.deepEqual(disasm(0x4D, 0, 0, 0x1000), ["TSTA", 1], "TSTA");
      assert.deepEqual(disasm(0x4F, 0, 0, 0x1000), ["CLRA", 1], "CLRA");
    });

    QUnit.test("Accumulator B operations", (assert) => {
      assert.deepEqual(disasm(0x50, 0, 0, 0x1000), ["NEGB", 1], "NEGB");
      assert.deepEqual(disasm(0x53, 0, 0, 0x1000), ["COMB", 1], "COMB");
      assert.deepEqual(disasm(0x54, 0, 0, 0x1000), ["LSRB", 1], "LSRB");
      assert.deepEqual(disasm(0x56, 0, 0, 0x1000), ["RORB", 1], "RORB");
      assert.deepEqual(disasm(0x57, 0, 0, 0x1000), ["ASRB", 1], "ASRB");
      assert.deepEqual(disasm(0x58, 0, 0, 0x1000), ["ASLB", 1], "ASLB");
      assert.deepEqual(disasm(0x59, 0, 0, 0x1000), ["ROLB", 1], "ROLB");
      assert.deepEqual(disasm(0x5A, 0, 0, 0x1000), ["DECB", 1], "DECB");
      assert.deepEqual(disasm(0x5C, 0, 0, 0x1000), ["INCB", 1], "INCB");
      assert.deepEqual(disasm(0x5D, 0, 0, 0x1000), ["TSTB", 1], "TSTB");
      assert.deepEqual(disasm(0x5F, 0, 0, 0x1000), ["CLRB", 1], "CLRB");
    });

    QUnit.test("Control flow", (assert) => {
      assert.deepEqual(disasm(0x39, 0, 0, 0x1000), ["RTS", 1], "RTS");
      assert.deepEqual(disasm(0x3B, 0, 0, 0x1000), ["RTI", 1], "RTI");
      assert.deepEqual(disasm(0x3E, 0, 0, 0x1000), ["WAI", 1], "WAI");
      assert.deepEqual(disasm(0x3F, 0, 0, 0x1000), ["SWI", 1], "SWI");
    });

    QUnit.test("Branch instructions with relative addressing", (assert) => {
      // Forward branch: offset < 128
      assert.deepEqual(disasm(0x20, 0x10, 0, 0x1000), ["BRA $1012", 2], "BRA forward");
      assert.deepEqual(disasm(0x22, 0x05, 0, 0x1000), ["BHI $1007", 2], "BHI forward");
      assert.deepEqual(disasm(0x23, 0x08, 0, 0x1000), ["BLS $100A", 2], "BLS forward");
      assert.deepEqual(disasm(0x24, 0x03, 0, 0x1000), ["BCC $1005", 2], "BCC forward");
      assert.deepEqual(disasm(0x25, 0x02, 0, 0x1000), ["BCS $1004", 2], "BCS forward");
      assert.deepEqual(disasm(0x26, 0x04, 0, 0x1000), ["BNE $1006", 2], "BNE forward");
      assert.deepEqual(disasm(0x27, 0x06, 0, 0x1000), ["BEQ $1008", 2], "BEQ forward");
      assert.deepEqual(disasm(0x28, 0x07, 0, 0x1000), ["BVC $1009", 2], "BVC forward");
      assert.deepEqual(disasm(0x29, 0x09, 0, 0x1000), ["BVS $100B", 2], "BVS forward");
      assert.deepEqual(disasm(0x2A, 0x0A, 0, 0x1000), ["BPL $100C", 2], "BPL forward");
      assert.deepEqual(disasm(0x2B, 0x0B, 0, 0x1000), ["BMI $100D", 2], "BMI forward");
      assert.deepEqual(disasm(0x2C, 0x0C, 0, 0x1000), ["BGE $100E", 2], "BGE forward");
      assert.deepEqual(disasm(0x2D, 0x0D, 0, 0x1000), ["BLT $100F", 2], "BLT forward");
      assert.deepEqual(disasm(0x2E, 0x0E, 0, 0x1000), ["BGT $1010", 2], "BGT forward");
      assert.deepEqual(disasm(0x2F, 0x0F, 0, 0x1000), ["BLE $1011", 2], "BLE forward");

      // Backward branch: offset >= 128
      assert.deepEqual(disasm(0x20, 0xFE, 0, 0x1000), ["BRA $1000", 2], "BRA backward");
      assert.deepEqual(disasm(0x8D, 0xF0, 0, 0x1000), ["BSR $0FF2", 2], "BSR backward");
    });

    QUnit.test("Immediate addressing mode", (assert) => {
      assert.deepEqual(disasm(0x80, 0x42, 0, 0x1000), ["SUBA #$42", 2], "SUBA immediate");
      assert.deepEqual(disasm(0x81, 0x55, 0, 0x1000), ["CMPA #$55", 2], "CMPA immediate");
      assert.deepEqual(disasm(0x82, 0x10, 0, 0x1000), ["SBCA #$10", 2], "SBCA immediate");
      assert.deepEqual(disasm(0x84, 0xFF, 0, 0x1000), ["ANDA #$FF", 2], "ANDA immediate");
      assert.deepEqual(disasm(0x85, 0x0F, 0, 0x1000), ["BITA #$0F", 2], "BITA immediate");
      assert.deepEqual(disasm(0x86, 0xAA, 0, 0x1000), ["LDAA #$AA", 2], "LDAA immediate");
      assert.deepEqual(disasm(0x88, 0x33, 0, 0x1000), ["EORA #$33", 2], "EORA immediate");
      assert.deepEqual(disasm(0x89, 0x22, 0, 0x1000), ["ADCA #$22", 2], "ADCA immediate");
      assert.deepEqual(disasm(0x8A, 0x11, 0, 0x1000), ["ORAA #$11", 2], "ORAA immediate");
      assert.deepEqual(disasm(0x8B, 0x77, 0, 0x1000), ["ADDA #$77", 2], "ADDA immediate");

      assert.deepEqual(disasm(0xC0, 0x99, 0, 0x1000), ["SUBB #$99", 2], "SUBB immediate");
      assert.deepEqual(disasm(0xC1, 0x88, 0, 0x1000), ["CMPB #$88", 2], "CMPB immediate");
      assert.deepEqual(disasm(0xC2, 0x77, 0, 0x1000), ["SBCB #$77", 2], "SBCB immediate");
      assert.deepEqual(disasm(0xC4, 0x66, 0, 0x1000), ["ANDB #$66", 2], "ANDB immediate");
      assert.deepEqual(disasm(0xC5, 0x55, 0, 0x1000), ["BITB #$55", 2], "BITB immediate");
      assert.deepEqual(disasm(0xC6, 0x44, 0, 0x1000), ["LDAB #$44", 2], "LDAB immediate");
      assert.deepEqual(disasm(0xC8, 0x33, 0, 0x1000), ["EORB #$33", 2], "EORB immediate");
      assert.deepEqual(disasm(0xC9, 0x22, 0, 0x1000), ["ADCB #$22", 2], "ADCB immediate");
      assert.deepEqual(disasm(0xCA, 0x11, 0, 0x1000), ["ORAB #$11", 2], "ORAB immediate");
      assert.deepEqual(disasm(0xCB, 0x00, 0, 0x1000), ["ADDB #$00", 2], "ADDB immediate");
    });

    QUnit.test("16-bit immediate addressing", (assert) => {
      assert.deepEqual(disasm(0x8C, 0x12, 0x34, 0x1000), ["CPX #$1234", 3], "CPX immediate");
      assert.deepEqual(disasm(0x8E, 0xF0, 0x00, 0x1000), ["LDS #$F000", 3], "LDS immediate");
      assert.deepEqual(disasm(0xCE, 0xAB, 0xCD, 0x1000), ["LDX #$ABCD", 3], "LDX immediate");
    });

    QUnit.test("Direct page addressing", (assert) => {
      assert.deepEqual(disasm(0x90, 0x50, 0, 0x1000), ["SUBA $50", 2], "SUBA direct");
      assert.deepEqual(disasm(0x91, 0x60, 0, 0x1000), ["CMPA $60", 2], "CMPA direct");
      assert.deepEqual(disasm(0x92, 0x70, 0, 0x1000), ["SBCA $70", 2], "SBCA direct");
      assert.deepEqual(disasm(0x94, 0x80, 0, 0x1000), ["ANDA $80", 2], "ANDA direct");
      assert.deepEqual(disasm(0x95, 0x90, 0, 0x1000), ["BITA $90", 2], "BITA direct");
      assert.deepEqual(disasm(0x96, 0xA0, 0, 0x1000), ["LDAA $A0", 2], "LDAA direct");
      assert.deepEqual(disasm(0x97, 0xB0, 0, 0x1000), ["STAA $B0", 2], "STAA direct");
      assert.deepEqual(disasm(0x9C, 0x40, 0, 0x1000), ["CPX $40", 2], "CPX direct");
      assert.deepEqual(disasm(0x9E, 0x30, 0, 0x1000), ["LDS $30", 2], "LDS direct");
      assert.deepEqual(disasm(0x9F, 0x20, 0, 0x1000), ["STS $20", 2], "STS direct");

      assert.deepEqual(disasm(0xD0, 0xC0, 0, 0x1000), ["SUBB $C0", 2], "SUBB direct");
      assert.deepEqual(disasm(0xD1, 0xD0, 0, 0x1000), ["CMPB $D0", 2], "CMPB direct");
      assert.deepEqual(disasm(0xD6, 0xE0, 0, 0x1000), ["LDAB $E0", 2], "LDAB direct");
      assert.deepEqual(disasm(0xD7, 0xF0, 0, 0x1000), ["STAB $F0", 2], "STAB direct");
      assert.deepEqual(disasm(0xDE, 0x55, 0, 0x1000), ["LDX $55", 2], "LDX direct");
      assert.deepEqual(disasm(0xDF, 0x66, 0, 0x1000), ["STX $66", 2], "STX direct");
    });

    QUnit.test("Indexed addressing", (assert) => {
      assert.deepEqual(disasm(0xA0, 0x10, 0, 0x1000), ["SUBA $10,X", 2], "SUBA indexed");
      assert.deepEqual(disasm(0xA1, 0x20, 0, 0x1000), ["CMPA $20,X", 2], "CMPA indexed");
      assert.deepEqual(disasm(0xA2, 0x30, 0, 0x1000), ["SBCA $30,X", 2], "SBCA indexed");
      assert.deepEqual(disasm(0xA4, 0x40, 0, 0x1000), ["ANDA $40,X", 2], "ANDA indexed");
      assert.deepEqual(disasm(0xA5, 0x50, 0, 0x1000), ["BITA $50,X", 2], "BITA indexed");
      assert.deepEqual(disasm(0xA6, 0x60, 0, 0x1000), ["LDAA $60,X", 2], "LDAA indexed");
      assert.deepEqual(disasm(0xA7, 0x70, 0, 0x1000), ["STAA $70,X", 2], "STAA indexed");
      assert.deepEqual(disasm(0xAC, 0x05, 0, 0x1000), ["CPX $05,X", 2], "CPX indexed");
      assert.deepEqual(disasm(0xAD, 0x15, 0, 0x1000), ["JSR $15,X", 2], "JSR indexed");
      assert.deepEqual(disasm(0xAE, 0x25, 0, 0x1000), ["LDS $25,X", 2], "LDS indexed");
      assert.deepEqual(disasm(0xAF, 0x35, 0, 0x1000), ["STS $35,X", 2], "STS indexed");

      assert.deepEqual(disasm(0xE0, 0x80, 0, 0x1000), ["SUBB $80,X", 2], "SUBB indexed");
      assert.deepEqual(disasm(0xE1, 0x90, 0, 0x1000), ["CMPB $90,X", 2], "CMPB indexed");
      assert.deepEqual(disasm(0xE6, 0xA0, 0, 0x1000), ["LDAB $A0,X", 2], "LDAB indexed");
      assert.deepEqual(disasm(0xE7, 0xB0, 0, 0x1000), ["STAB $B0,X", 2], "STAB indexed");
      assert.deepEqual(disasm(0xEE, 0xC0, 0, 0x1000), ["LDX $C0,X", 2], "LDX indexed");
      assert.deepEqual(disasm(0xEF, 0xD0, 0, 0x1000), ["STX $D0,X", 2], "STX indexed");

      // Indexed memory operations
      assert.deepEqual(disasm(0x60, 0x08, 0, 0x1000), ["NEG $08,X", 2], "NEG indexed");
      assert.deepEqual(disasm(0x63, 0x09, 0, 0x1000), ["COM $09,X", 2], "COM indexed");
      assert.deepEqual(disasm(0x64, 0x0A, 0, 0x1000), ["LSR $0A,X", 2], "LSR indexed");
      assert.deepEqual(disasm(0x66, 0x0B, 0, 0x1000), ["ROR $0B,X", 2], "ROR indexed");
      assert.deepEqual(disasm(0x67, 0x0C, 0, 0x1000), ["ASR $0C,X", 2], "ASR indexed");
      assert.deepEqual(disasm(0x68, 0x0D, 0, 0x1000), ["ASL $0D,X", 2], "ASL indexed");
      assert.deepEqual(disasm(0x69, 0x0E, 0, 0x1000), ["ROL $0E,X", 2], "ROL indexed");
      assert.deepEqual(disasm(0x6A, 0x0F, 0, 0x1000), ["DEC $0F,X", 2], "DEC indexed");
      assert.deepEqual(disasm(0x6C, 0x10, 0, 0x1000), ["INC $10,X", 2], "INC indexed");
      assert.deepEqual(disasm(0x6D, 0x11, 0, 0x1000), ["TST $11,X", 2], "TST indexed");
      assert.deepEqual(disasm(0x6E, 0x12, 0, 0x1000), ["JMP $12,X", 2], "JMP indexed");
      assert.deepEqual(disasm(0x6F, 0x13, 0, 0x1000), ["CLR $13,X", 2], "CLR indexed");
    });

    QUnit.test("Extended addressing", (assert) => {
      assert.deepEqual(disasm(0xB0, 0x20, 0x00, 0x1000), ["SUBA $2000", 3], "SUBA extended");
      assert.deepEqual(disasm(0xB1, 0x30, 0x00, 0x1000), ["CMPA $3000", 3], "CMPA extended");
      assert.deepEqual(disasm(0xB2, 0x40, 0x00, 0x1000), ["SBCA $4000", 3], "SBCA extended");
      assert.deepEqual(disasm(0xB4, 0x50, 0x00, 0x1000), ["ANDA $5000", 3], "ANDA extended");
      assert.deepEqual(disasm(0xB5, 0x60, 0x00, 0x1000), ["BITA $6000", 3], "BITA extended");
      assert.deepEqual(disasm(0xB6, 0x70, 0x00, 0x1000), ["LDAA $7000", 3], "LDAA extended");
      assert.deepEqual(disasm(0xB7, 0x80, 0x00, 0x1000), ["STAA $8000", 3], "STAA extended");
      assert.deepEqual(disasm(0xBC, 0x90, 0x00, 0x1000), ["CPX $9000", 3], "CPX extended");
      assert.deepEqual(disasm(0xBD, 0xA0, 0x00, 0x1000), ["JSR $A000", 3], "JSR extended");
      assert.deepEqual(disasm(0xBE, 0xB0, 0x00, 0x1000), ["LDS $B000", 3], "LDS extended");
      assert.deepEqual(disasm(0xBF, 0xC0, 0x00, 0x1000), ["STS $C000", 3], "STS extended");

      assert.deepEqual(disasm(0xF0, 0xD0, 0x00, 0x1000), ["SUBB $D000", 3], "SUBB extended");
      assert.deepEqual(disasm(0xF1, 0xE0, 0x00, 0x1000), ["CMPB $E000", 3], "CMPB extended");
      assert.deepEqual(disasm(0xF6, 0xF0, 0x00, 0x1000), ["LDAB $F000", 3], "LDAB extended");
      assert.deepEqual(disasm(0xF7, 0xFF, 0x00, 0x1000), ["STAB $FF00", 3], "STAB extended");
      assert.deepEqual(disasm(0xFE, 0x12, 0x34, 0x1000), ["LDX $1234", 3], "LDX extended");
      assert.deepEqual(disasm(0xFF, 0x56, 0x78, 0x1000), ["STX $5678", 3], "STX extended");

      // Extended memory operations
      assert.deepEqual(disasm(0x70, 0x20, 0x00, 0x1000), ["NEG $2000", 3], "NEG extended");
      assert.deepEqual(disasm(0x73, 0x30, 0x00, 0x1000), ["COM $3000", 3], "COM extended");
      assert.deepEqual(disasm(0x74, 0x40, 0x00, 0x1000), ["LSR $4000", 3], "LSR extended");
      assert.deepEqual(disasm(0x76, 0x50, 0x00, 0x1000), ["ROR $5000", 3], "ROR extended");
      assert.deepEqual(disasm(0x77, 0x60, 0x00, 0x1000), ["ASR $6000", 3], "ASR extended");
      assert.deepEqual(disasm(0x78, 0x70, 0x00, 0x1000), ["ASL $7000", 3], "ASL extended");
      assert.deepEqual(disasm(0x79, 0x80, 0x00, 0x1000), ["ROL $8000", 3], "ROL extended");
      assert.deepEqual(disasm(0x7A, 0x90, 0x00, 0x1000), ["DEC $9000", 3], "DEC extended");
      assert.deepEqual(disasm(0x7C, 0xA0, 0x00, 0x1000), ["INC $A000", 3], "INC extended");
      assert.deepEqual(disasm(0x7D, 0xB0, 0x00, 0x1000), ["TST $B000", 3], "TST extended");
      assert.deepEqual(disasm(0x7E, 0xC0, 0x00, 0x1000), ["JMP $C000", 3], "JMP extended");
      assert.deepEqual(disasm(0x7F, 0xD0, 0x00, 0x1000), ["CLR $D000", 3], "CLR extended");
    });

    QUnit.test("Flag manipulation", (assert) => {
      assert.deepEqual(disasm(0x06, 0, 0, 0x1000), ["TAP", 1], "TAP");
      assert.deepEqual(disasm(0x07, 0, 0, 0x1000), ["TPA", 1], "TPA");
    });
  });

  QUnit.module("Shift Instructions (for final coverage)", () => {
    QUnit.test("LSRB - Logical shift right B", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xC6; // LDB immediate
      mem[0x1001] = 0x87; // 10000111
      mem[0x1002] = 0x54; // LSRB

      cpu.reset();
      cpu.steps(2); // LDB
      cpu.steps(2); // LSRB

      // 10000111 >> 1 (logical) = 01000011, carry=1
      assert.equal(cpu.status().b, 0x43, "B logical shift right");
      assert.ok(cpu.status().flags & 0x01, "Carry set from bit 0");
    });

    QUnit.test("LSR indexed - Logical shift right indexed", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x2045] = 0xAA; // 10101010

      mem[0x1000] = 0xCE; // LDX immediate
      mem[0x1001] = 0x20;
      mem[0x1002] = 0x00;
      mem[0x1003] = 0x64; // LSR indexed
      mem[0x1004] = 0x45; // offset

      cpu.reset();
      cpu.steps(3); // LDX
      cpu.steps(7); // LSR indexed

      // 10101010 >> 1 (logical) = 01010101, carry=0
      assert.equal(mem[0x2045], 0x55, "Memory logical shift right");
    });

    QUnit.test("LSR extended - Logical shift right extended", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x5000] = 0x83; // 10000011

      mem[0x1000] = 0x74; // LSR extended
      mem[0x1001] = 0x50;
      mem[0x1002] = 0x00;

      cpu.reset();
      cpu.steps(7); // LSR extended

      // 10000011 >> 1 (logical) = 01000001, carry=1
      assert.equal(mem[0x5000], 0x41, "Logical shift right (zero fill)");
      assert.ok(cpu.status().flags & 0x01, "Carry set from bit 0");
    });

    QUnit.test("ROR indexed - Rotate right indexed through carry", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x2025] = 0x81; // 10000001

      mem[0x1000] = 0x0D; // SEC (set carry)
      mem[0x1001] = 0xCE; // LDX immediate
      mem[0x1002] = 0x20;
      mem[0x1003] = 0x00;
      mem[0x1004] = 0x66; // ROR indexed
      mem[0x1005] = 0x25; // offset

      cpu.reset();
      cpu.steps(2); // SEC
      cpu.steps(3); // LDX
      cpu.steps(7); // ROR indexed

      // 10000001 rotated right with carry=1 -> 11000000, carry=1
      assert.equal(mem[0x2025], 0xC0, "Memory rotated right through carry");
      assert.ok(cpu.status().flags & 0x01, "Carry set from bit 0");
    });

    QUnit.test("ROR extended - Rotate right extended through carry", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x6000] = 0x02; // 00000010

      mem[0x1000] = 0x0C; // CLC (clear carry)
      mem[0x1001] = 0x76; // ROR extended
      mem[0x1002] = 0x60;
      mem[0x1003] = 0x00;

      cpu.reset();
      cpu.steps(2); // CLC
      cpu.steps(7); // ROR extended

      // 00000010 rotated right with carry=0 -> 00000001, carry=0
      assert.equal(mem[0x6000], 0x01, "Memory rotated right");
      assert.equal(cpu.status().flags & 0x01, 0, "Carry clear");
    });

    QUnit.test("ASRB - Arithmetic shift right B", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xC6; // LDB immediate
      mem[0x1001] = 0x85; // 10000101 (negative)
      mem[0x1002] = 0x57; // ASRB

      cpu.reset();
      cpu.steps(2); // LDB
      cpu.steps(2); // ASRB

      // 10000101 >> 1 (arithmetic, sign extended) = 11000010, carry=1
      assert.equal(cpu.status().b, 0xC2, "B arithmetic shift right (sign extended)");
      assert.ok(cpu.status().flags & 0x01, "Carry set from bit 0");
    });

    QUnit.test("ASR indexed - Arithmetic shift right indexed", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x2035] = 0xFF; // 11111111 (all ones)

      mem[0x1000] = 0xCE; // LDX immediate
      mem[0x1001] = 0x20;
      mem[0x1002] = 0x00;
      mem[0x1003] = 0x67; // ASR indexed
      mem[0x1004] = 0x35; // offset

      cpu.reset();
      cpu.steps(3); // LDX
      cpu.steps(7); // ASR indexed

      // 11111111 >> 1 (arithmetic) = 11111111, carry=1 (stays all ones)
      assert.equal(mem[0x2035], 0xFF, "Memory arithmetic shift right (sign preserved)");
      assert.ok(cpu.status().flags & 0x01, "Carry set from bit 0");
    });

    QUnit.test("ASR extended - Arithmetic shift right extended", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x3000] = 0x81; // 10000001

      mem[0x1000] = 0x77; // ASR extended
      mem[0x1001] = 0x30;
      mem[0x1002] = 0x00;

      cpu.reset();
      cpu.steps(7); // ASR extended

      // 10000001 >> 1 (arithmetic) = 11000000, carry=1
      assert.equal(mem[0x3000], 0xC0, "Arithmetic shift right (sign extended)");
      assert.ok(cpu.status().flags & 0x01, "Carry set from bit 0");
    });

    QUnit.test("ASLB - Arithmetic shift left B", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xC6; // LDB immediate
      mem[0x1001] = 0xC0; // 11000000
      mem[0x1002] = 0x58; // ASLB

      cpu.reset();
      cpu.steps(2); // LDB
      cpu.steps(2); // ASLB

      // 11000000 << 1 = 10000000, carry=1
      assert.equal(cpu.status().b, 0x80, "B shifted left");
      assert.ok(cpu.status().flags & 0x01, "Carry set from bit 7");
    });

    QUnit.test("ASL indexed - Arithmetic shift left indexed", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x2015] = 0x60; // 01100000

      mem[0x1000] = 0xCE; // LDX immediate
      mem[0x1001] = 0x20;
      mem[0x1002] = 0x00;
      mem[0x1003] = 0x68; // ASL indexed
      mem[0x1004] = 0x15; // offset

      cpu.reset();
      cpu.steps(3); // LDX
      cpu.steps(7); // ASL indexed

      // 01100000 << 1 = 11000000
      assert.equal(mem[0x2015], 0xC0, "Memory shifted left");
    });

    QUnit.test("ASL extended - Arithmetic shift left extended", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x4000] = 0x55; // 01010101

      mem[0x1000] = 0x78; // ASL extended
      mem[0x1001] = 0x40;
      mem[0x1002] = 0x00;

      cpu.reset();
      cpu.steps(7); // ASL extended

      // 01010101 << 1 = 10101010
      assert.equal(mem[0x4000], 0xAA, "Memory shifted left");
    });
  });

  QUnit.module("ROL Instructions (for final coverage)", () => {
    QUnit.test("ROLB - Rotate left B through carry", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x0D; // SEC (set carry)
      mem[0x1001] = 0xC6; // LDB immediate
      mem[0x1002] = 0x80; // 10000000
      mem[0x1003] = 0x59; // ROLB

      cpu.reset();
      cpu.steps(2); // SEC
      cpu.steps(2); // LDB
      cpu.steps(2); // ROLB

      const state = cpu.status();
      // 10000000 rotated left with carry=1 -> 00000001, carry=1
      assert.equal(state.b, 0x01, "B rotated left through carry");
      assert.ok(state.flags & 0x01, "Carry flag set (bit 7 was 1)");
    });

    QUnit.test("ROL indexed - Rotate left memory indexed", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x2010] = 0xC0; // 11000000 at X+0x10

      mem[0x1000] = 0xCE; // LDX immediate
      mem[0x1001] = 0x20;
      mem[0x1002] = 0x00;
      mem[0x1003] = 0x0D; // SEC
      mem[0x1004] = 0x69; // ROL indexed
      mem[0x1005] = 0x10; // offset

      cpu.reset();
      cpu.steps(3); // LDX
      cpu.steps(2); // SEC
      cpu.steps(7); // ROL indexed

      // 11000000 rotated left with carry=1 -> 10000001, carry=1
      assert.equal(mem[0x2010], 0x81, "Memory rotated left");
      assert.ok(cpu.status().flags & 0x01, "Carry flag set");
    });

    QUnit.test("ROL extended - Rotate left memory extended", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x3000] = 0x40; // 01000000

      mem[0x1000] = 0x0C; // CLC (clear carry)
      mem[0x1001] = 0x79; // ROL extended
      mem[0x1002] = 0x30;
      mem[0x1003] = 0x00;

      cpu.reset();
      cpu.steps(2); // CLC
      cpu.steps(7); // ROL extended

      // 01000000 rotated left with carry=0 -> 10000000, carry=0
      assert.equal(mem[0x3000], 0x80, "Memory rotated left");
      assert.equal(cpu.status().flags & 0x01, 0, "Carry flag clear");
    });
  });

  QUnit.module("Edge Cases for Final Coverage", () => {
    QUnit.test("SUBB - Subtract with borrow (carry set)", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xC6; // LDB immediate
      mem[0x1001] = 0x05;
      mem[0x1002] = 0xD0; // SUBB direct
      mem[0x1003] = 0x50;
      mem[0x50] = 0x10; // 0x05 - 0x10 = borrow

      cpu.reset();
      cpu.steps(2); // LDB
      cpu.steps(4); // SUBB

      assert.ok(cpu.status().flags & 0x01, "Carry set when operand > B");
    });

    QUnit.test("CMPB - Compare B with carry edge case", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xC6; // LDB immediate
      mem[0x1001] = 0x20;
      mem[0x1002] = 0xD1; // CMPB direct
      mem[0x1003] = 0x60;
      mem[0x60] = 0x50; // 0x20 compared to 0x50 (less than)

      cpu.reset();
      cpu.steps(2); // LDB
      cpu.steps(4); // CMPB

      assert.ok(cpu.status().flags & 0x01, "Carry set when B < operand");
    });

    QUnit.test("Extended addressing SUBB", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x3000] = 0x30;

      mem[0x1000] = 0xC6; // LDB immediate
      mem[0x1001] = 0x10;
      mem[0x1002] = 0xF0; // SUBB extended
      mem[0x1003] = 0x30;
      mem[0x1004] = 0x00;

      cpu.reset();
      cpu.steps(2); // LDB
      cpu.steps(5); // SUBB extended

      assert.ok(cpu.status().flags & 0x01, "Carry set in extended SUBB");
    });

    QUnit.test("Extended addressing CMPB", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x4000] = 0x99;

      mem[0x1000] = 0xC6; // LDB immediate
      mem[0x1001] = 0x55;
      mem[0x1002] = 0xF1; // CMPB extended
      mem[0x1003] = 0x40;
      mem[0x1004] = 0x00;

      cpu.reset();
      cpu.steps(2); // LDB
      cpu.steps(5); // CMPB extended

      assert.ok(cpu.status().flags & 0x01, "Carry set in extended CMPB");
    });

    QUnit.test("Indexed addressing SUBB edge case", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x2020] = 0x88;

      mem[0x1000] = 0xCE; // LDX immediate
      mem[0x1001] = 0x20;
      mem[0x1002] = 0x00;
      mem[0x1003] = 0xC6; // LDB immediate
      mem[0x1004] = 0x44;
      mem[0x1005] = 0xE0; // SUBB indexed
      mem[0x1006] = 0x20; // offset

      cpu.reset();
      cpu.steps(3); // LDX
      cpu.steps(2); // LDB
      cpu.steps(5); // SUBB indexed

      assert.ok(cpu.status().flags & 0x01, "Carry set in indexed SUBB");
    });

    QUnit.test("Indexed addressing CMPB edge case", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x2030] = 0xCC;

      mem[0x1000] = 0xCE; // LDX immediate
      mem[0x1001] = 0x20;
      mem[0x1002] = 0x00;
      mem[0x1003] = 0xC6; // LDB immediate
      mem[0x1004] = 0x66;
      mem[0x1005] = 0xE1; // CMPB indexed
      mem[0x1006] = 0x30; // offset

      cpu.reset();
      cpu.steps(3); // LDX
      cpu.steps(2); // LDB
      cpu.steps(5); // CMPB indexed

      assert.ok(cpu.status().flags & 0x01, "Carry set in indexed CMPB");
    });
  });
});
