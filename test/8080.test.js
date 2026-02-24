/**
 * Intel 8080 CPU Emulator Tests
 *
 * Comprehensive test suite for ES6 8080 emulator implementation.
 * Tests instruction execution, flag handling, timing, and hardware compatibility.
 */

import QUnit from "qunit";
import create8080, { disasm } from "../src/8080.js";

QUnit.module("8080 CPU Emulator", () => {
  /**
   * Helper: Create CPU with simple memory array
   */
  const createTestCPU = () => {
    const mem = new Uint8Array(65536);
    const ports = new Uint8Array(256);

    const cpu = create8080({
      byteAt: (addr) => mem[addr] || 0,
      byteTo: (addr, val) => {
        mem[addr] = val & 0xFF;
      },
      portOut: (port, val) => {
        ports[port] = val & 0xFF;
      },
      portIn: (port) => ports[port] || 0
    });

    return { cpu, mem, ports };
  };

  QUnit.module("Initialization and Reset", () => {
    QUnit.test("CPU initializes with correct default values", (assert) => {
      const { cpu } = createTestCPU();
      const state = cpu.status();

      assert.equal(state.pc, 0, "PC starts at 0");
      assert.equal(state.sp, 0, "SP starts at 0");
      assert.equal(state.a, 0, "A register is 0");
      assert.equal(state.b, 0, "B register is 0");
      assert.equal(state.c, 0, "C register is 0");
      assert.equal(state.d, 0, "D register is 0");
      assert.equal(state.e, 0, "E register is 0");
      assert.equal(state.h, 0, "H register is 0");
      assert.equal(state.l, 0, "L register is 0");
      assert.equal(state.f, 2, "Flags initialized to 0x02");
    });

    QUnit.test("Reset clears all registers", (assert) => {
      const { cpu } = createTestCPU();

      cpu.set("PC", 0x1234);
      cpu.set("A", 0x42);
      cpu.set("B", 0x55);
      cpu.reset();

      const state = cpu.status();
      assert.equal(state.pc, 0, "PC reset to 0");
      assert.equal(state.a, 0, "A reset to 0");
      assert.equal(state.b, 0, "B reset to 0");
    });

    QUnit.test("Cycle counter starts at 0", (assert) => {
      const { cpu } = createTestCPU();
      assert.equal(cpu.T(), 0, "Cycle counter is 0");
    });
  });

  QUnit.module("Register Manipulation", () => {
    QUnit.test("Set and get single registers", (assert) => {
      const { cpu } = createTestCPU();

      cpu.set("A", 0x42);
      cpu.set("B", 0x12);
      cpu.set("PC", 0x1000);
      cpu.set("SP", 0xF000);

      const state = cpu.status();
      assert.equal(state.a, 0x42, "A register set correctly");
      assert.equal(state.b, 0x12, "B register set correctly");
      assert.equal(state.pc, 0x1000, "PC set correctly");
      assert.equal(state.sp, 0xF000, "SP set correctly");
    });

    QUnit.test("Register names are case-insensitive", (assert) => {
      const { cpu } = createTestCPU();

      cpu.set("a", 0x11);
      cpu.set("B", 0x22);
      cpu.set("pc", 0x100);

      const state = cpu.status();
      assert.equal(state.a, 0x11, "Lowercase 'a' works");
      assert.equal(state.b, 0x22, "Uppercase 'B' works");
      assert.equal(state.pc, 0x100, "Lowercase 'pc' works");
    });
  });

  QUnit.module("Basic Instructions", () => {
    QUnit.test("NOP - No operation", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x00; // NOP
      cpu.set("PC", 0x0000);
      cpu.steps(4);

      const state = cpu.status();
      assert.equal(state.pc, 1, "PC incremented");
      assert.equal(cpu.T(), 4, "NOP takes 4 cycles");
    });

    QUnit.test("MVI A,n - Load immediate to A", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x3E; // MVI A,n
      mem[0x0001] = 0x42;
      cpu.set("PC", 0x0000);
      cpu.steps(7);

      const state = cpu.status();
      assert.equal(state.a, 0x42, "A loaded with immediate value");
      assert.equal(state.pc, 2, "PC advanced 2 bytes");
      assert.equal(cpu.T(), 7, "MVI takes 7 cycles");
    });

    QUnit.test("MVI B,n / MVI C,n - Load immediate to B/C", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x06; // MVI B,n
      mem[0x0001] = 0x11;
      mem[0x0002] = 0x0E; // MVI C,n
      mem[0x0003] = 0x22;

      cpu.set("PC", 0x0000);
      cpu.steps(14);

      const state = cpu.status();
      assert.equal(state.b, 0x11, "B loaded correctly");
      assert.equal(state.c, 0x22, "C loaded correctly");
    });

    QUnit.test("HLT - Halt instruction", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x76; // HLT
      mem[0x0001] = 0x3E; // MVI A,42 (should not execute)
      mem[0x0002] = 0x42;

      cpu.set("PC", 0x0000);
      cpu.steps(20); // Try to execute multiple cycles

      const state = cpu.status();
      assert.equal(state.a, 0, "A not modified after HLT");
      assert.equal(cpu.T(), 20, "Cycles consumed while halted");
    });
  });

  QUnit.module("MOV Instructions", () => {
    QUnit.test("MOV B,C - Move register to register", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("C", 0x55);
      mem[0x0000] = 0x41; // MOV B,C
      cpu.set("PC", 0x0000);
      cpu.steps(5);

      const state = cpu.status();
      assert.equal(state.b, 0x55, "B copied from C");
      assert.equal(state.c, 0x55, "C unchanged");
    });

    QUnit.test("MOV A,M - Move memory to A", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1234] = 0x99;
      cpu.set("H", 0x12);
      cpu.set("L", 0x34);
      mem[0x0000] = 0x7E; // MOV A,M
      cpu.set("PC", 0x0000);
      cpu.steps(7);

      const state = cpu.status();
      assert.equal(state.a, 0x99, "A loaded from memory at HL");
    });

    QUnit.test("MOV M,B - Move register to memory", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("B", 0x77);
      cpu.set("H", 0x20);
      cpu.set("L", 0x00);
      mem[0x0000] = 0x70; // MOV M,B
      cpu.set("PC", 0x0000);
      cpu.steps(7);

      assert.equal(mem[0x2000], 0x77, "Memory at HL set to B value");
    });
  });

  QUnit.module("Arithmetic - ADD", () => {
    QUnit.test("ADD B - Simple addition", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x10);
      cpu.set("B", 0x05);
      mem[0x0000] = 0x80; // ADD B
      cpu.set("PC", 0x0000);
      cpu.steps(4);

      const state = cpu.status();
      assert.equal(state.a, 0x15, "A = 0x10 + 0x05 = 0x15");
    });

    QUnit.test("ADD - Carry flag set on overflow", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0xFF);
      cpu.set("B", 0x01);
      mem[0x0000] = 0x80; // ADD B
      cpu.set("PC", 0x0000);
      cpu.steps(4);

      const state = cpu.status();
      assert.equal(state.a, 0x00, "A wraps to 0x00");
      assert.ok(state.f & 0x01, "Carry flag set");
    });

    QUnit.test("ADD - Zero flag set when result is zero", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x00);
      cpu.set("B", 0x00);
      mem[0x0000] = 0x80; // ADD B
      cpu.set("PC", 0x0000);
      cpu.steps(4);

      const state = cpu.status();
      assert.ok(state.f & 0x40, "Zero flag set");
    });

    QUnit.test("ADD - Sign flag set when bit 7 is 1", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x80);
      cpu.set("B", 0x01);
      mem[0x0000] = 0x80; // ADD B
      cpu.set("PC", 0x0000);
      cpu.steps(4);

      const state = cpu.status();
      assert.equal(state.a, 0x81, "Result is 0x81");
      assert.ok(state.f & 0x80, "Sign flag set");
    });

    QUnit.test("ADC - Add with carry", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x10);
      cpu.set("B", 0x05);
      cpu.set("F", 0x01); // Set carry flag
      mem[0x0000] = 0x88; // ADC B
      cpu.set("PC", 0x0000);
      cpu.steps(4);

      const state = cpu.status();
      assert.equal(state.a, 0x16, "A = 0x10 + 0x05 + carry(1) = 0x16");
    });

    QUnit.test("ADI - Add immediate", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x20);
      mem[0x0000] = 0xC6; // ADI n
      mem[0x0001] = 0x15;
      cpu.set("PC", 0x0000);
      cpu.steps(7);

      const state = cpu.status();
      assert.equal(state.a, 0x35, "A = 0x20 + 0x15 = 0x35");
    });
  });

  QUnit.module("Arithmetic - SUB", () => {
    QUnit.test("SUB B - Simple subtraction", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x20);
      cpu.set("B", 0x10);
      mem[0x0000] = 0x90; // SUB B
      cpu.set("PC", 0x0000);
      cpu.steps(4);

      const state = cpu.status();
      assert.equal(state.a, 0x10, "A = 0x20 - 0x10 = 0x10");
    });

    QUnit.test("SUB - Carry flag on underflow", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x05);
      cpu.set("B", 0x10);
      mem[0x0000] = 0x90; // SUB B
      cpu.set("PC", 0x0000);
      cpu.steps(4);

      const state = cpu.status();
      assert.equal(state.a, 0xF5, "A wraps around");
      assert.ok(state.f & 0x01, "Carry flag set on underflow");
    });

    QUnit.test("SBB - Subtract with borrow", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x20);
      cpu.set("B", 0x10);
      cpu.set("F", 0x01); // Set carry (borrow)
      mem[0x0000] = 0x98; // SBB B
      cpu.set("PC", 0x0000);
      cpu.steps(4);

      const state = cpu.status();
      assert.equal(state.a, 0x0F, "A = 0x20 - 0x10 - 1 = 0x0F");
    });

    QUnit.test("SUI - Subtract immediate", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x50);
      mem[0x0000] = 0xD6; // SUI n
      mem[0x0001] = 0x20;
      cpu.set("PC", 0x0000);
      cpu.steps(7);

      const state = cpu.status();
      assert.equal(state.a, 0x30, "A = 0x50 - 0x20 = 0x30");
    });
  });

  QUnit.module("Logical Operations", () => {
    QUnit.test("ANA - AND with register", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0xF0);
      cpu.set("B", 0x0F);
      mem[0x0000] = 0xA0; // ANA B
      cpu.set("PC", 0x0000);
      cpu.steps(4);

      const state = cpu.status();
      assert.equal(state.a, 0x00, "A = 0xF0 & 0x0F = 0x00");
      assert.ok(state.f & 0x40, "Zero flag set");
    });

    QUnit.test("ANI - AND immediate", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0xFF);
      mem[0x0000] = 0xE6; // ANI n
      mem[0x0001] = 0x55;
      cpu.set("PC", 0x0000);
      cpu.steps(7);

      const state = cpu.status();
      assert.equal(state.a, 0x55, "A = 0xFF & 0x55 = 0x55");
    });

    QUnit.test("XRA - XOR with register", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0xAA);
      cpu.set("B", 0x55);
      mem[0x0000] = 0xA8; // XRA B
      cpu.set("PC", 0x0000);
      cpu.steps(4);

      const state = cpu.status();
      assert.equal(state.a, 0xFF, "A = 0xAA ^ 0x55 = 0xFF");
    });

    QUnit.test("XRA A - Common idiom to zero A", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x99);
      mem[0x0000] = 0xAF; // XRA A
      cpu.set("PC", 0x0000);
      cpu.steps(4);

      const state = cpu.status();
      assert.equal(state.a, 0x00, "A zeroed");
      assert.ok(state.f & 0x40, "Zero flag set");
    });

    QUnit.test("ORA - OR with register", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0xF0);
      cpu.set("B", 0x0F);
      mem[0x0000] = 0xB0; // ORA B
      cpu.set("PC", 0x0000);
      cpu.steps(4);

      const state = cpu.status();
      assert.equal(state.a, 0xFF, "A = 0xF0 | 0x0F = 0xFF");
    });

    QUnit.test("ORI - OR immediate", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x80);
      mem[0x0000] = 0xF6; // ORI n
      mem[0x0001] = 0x01;
      cpu.set("PC", 0x0000);
      cpu.steps(7);

      const state = cpu.status();
      assert.equal(state.a, 0x81, "A = 0x80 | 0x01 = 0x81");
    });

    QUnit.test("CMA - Complement A", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0xAA);
      mem[0x0000] = 0x2F; // CMA
      cpu.set("PC", 0x0000);
      cpu.steps(4);

      const state = cpu.status();
      assert.equal(state.a, 0x55, "A complemented: ~0xAA = 0x55");
    });
  });

  QUnit.module("Compare Operations", () => {
    QUnit.test("CMP - Compare equal", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x42);
      cpu.set("B", 0x42);
      mem[0x0000] = 0xB8; // CMP B
      cpu.set("PC", 0x0000);
      cpu.steps(4);

      const state = cpu.status();
      assert.equal(state.a, 0x42, "A unchanged");
      assert.ok(state.f & 0x40, "Zero flag set when equal");
    });

    QUnit.test("CMP - Compare less than", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x10);
      cpu.set("B", 0x20);
      mem[0x0000] = 0xB8; // CMP B
      cpu.set("PC", 0x0000);
      cpu.steps(4);

      const state = cpu.status();
      assert.ok(state.f & 0x01, "Carry flag set when A < B");
    });

    QUnit.test("CPI - Compare immediate", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x30);
      mem[0x0000] = 0xFE; // CPI n
      mem[0x0001] = 0x30;
      cpu.set("PC", 0x0000);
      cpu.steps(7);

      const state = cpu.status();
      assert.ok(state.f & 0x40, "Zero flag set when A == immediate");
    });
  });

  QUnit.module("Increment/Decrement", () => {
    QUnit.test("INR B - Increment register", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("B", 0x10);
      mem[0x0000] = 0x04; // INR B
      cpu.set("PC", 0x0000);
      cpu.steps(5);

      const state = cpu.status();
      assert.equal(state.b, 0x11, "B incremented");
    });

    QUnit.test("INR - Zero flag on overflow", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("B", 0xFF);
      mem[0x0000] = 0x04; // INR B
      cpu.set("PC", 0x0000);
      cpu.steps(5);

      const state = cpu.status();
      assert.equal(state.b, 0x00, "B wraps to 0");
      assert.ok(state.f & 0x40, "Zero flag set");
    });

    QUnit.test("DCR C - Decrement register", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("C", 0x10);
      mem[0x0000] = 0x0D; // DCR C
      cpu.set("PC", 0x0000);
      cpu.steps(5);

      const state = cpu.status();
      assert.equal(state.c, 0x0F, "C decremented");
    });

    QUnit.test("INR M - Increment memory", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("H", 0x20);
      cpu.set("L", 0x00);
      mem[0x2000] = 0x99;
      mem[0x0000] = 0x34; // INR M
      cpu.set("PC", 0x0000);
      cpu.steps(10);

      assert.equal(mem[0x2000], 0x9A, "Memory at HL incremented");
    });
  });

  QUnit.module("16-bit Operations", () => {
    QUnit.test("LXI B,nn - Load immediate to BC", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x01; // LXI B,nn
      mem[0x0001] = 0x34;
      mem[0x0002] = 0x12;
      cpu.set("PC", 0x0000);
      cpu.steps(10);

      const state = cpu.status();
      assert.equal(state.b, 0x12, "B = high byte");
      assert.equal(state.c, 0x34, "C = low byte");
    });

    QUnit.test("LXI H,nn - Load immediate to HL", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x21; // LXI H,nn
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x20;
      cpu.set("PC", 0x0000);
      cpu.steps(10);

      const state = cpu.status();
      assert.equal(state.h, 0x20, "H = 0x20");
      assert.equal(state.l, 0x00, "L = 0x00");
    });

    QUnit.test("INX B - Increment BC pair", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("B", 0x12);
      cpu.set("C", 0xFF);
      mem[0x0000] = 0x03; // INX B
      cpu.set("PC", 0x0000);
      cpu.steps(6);

      const state = cpu.status();
      assert.equal(state.b, 0x13, "B incremented when C overflows");
      assert.equal(state.c, 0x00, "C wraps to 0");
    });

    QUnit.test("DCX H - Decrement HL pair", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("H", 0x20);
      cpu.set("L", 0x00);
      mem[0x0000] = 0x2B; // DCX H
      cpu.set("PC", 0x0000);
      cpu.steps(6);

      const state = cpu.status();
      assert.equal(state.h, 0x1F, "H decremented");
      assert.equal(state.l, 0xFF, "L wraps to 0xFF");
    });

    QUnit.test("DAD B - Add BC to HL", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("H", 0x10);
      cpu.set("L", 0x00);
      cpu.set("B", 0x00);
      cpu.set("C", 0x50);
      mem[0x0000] = 0x09; // DAD B
      cpu.set("PC", 0x0000);
      cpu.steps(11);

      const state = cpu.status();
      assert.equal(state.h, 0x10, "H = 0x10");
      assert.equal(state.l, 0x50, "L = 0x50 (HL = 0x1000 + 0x0050)");
    });
  });

  QUnit.module("Stack Operations", () => {
    QUnit.test("PUSH B / POP D - Stack operations", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xF000);
      cpu.set("B", 0x12);
      cpu.set("C", 0x34);

      mem[0x0000] = 0xC5; // PUSH B
      mem[0x0001] = 0xD1; // POP D
      cpu.set("PC", 0x0000);
      cpu.steps(21);

      const state = cpu.status();
      assert.equal(state.d, 0x12, "D = pushed B value");
      assert.equal(state.e, 0x34, "E = pushed C value");
      assert.equal(state.sp, 0xF000, "SP restored");
    });

    QUnit.test("PUSH PSW / POP PSW - Save/restore A and flags", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xF000);
      cpu.set("A", 0x99);
      cpu.set("F", 0x47); // Bit 1 is always set to 1, bits 3,5 always 0

      mem[0x0000] = 0xF5; // PUSH PSW
      cpu.set("PC", 0x0000);
      cpu.steps(11);

      cpu.set("A", 0x00);
      cpu.set("F", 0x00);

      mem[0x0001] = 0xF1; // POP PSW
      cpu.set("PC", 0x0001);
      cpu.steps(10);

      const state = cpu.status();
      assert.equal(state.a, 0x99, "A restored");
      // After POP, flags will be modified by flag normalization (bit 1 set, bits 3,5 cleared)
      assert.equal(state.f & 0xD5, 0x47 & 0xD5, "Flags restored (ignoring bits 1,3,5)");
    });
  });

  QUnit.module("Jump Instructions", () => {
    QUnit.test("JMP nn - Unconditional jump", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0xC3; // JMP nn
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x20;
      cpu.set("PC", 0x0000);
      cpu.steps(10);

      const state = cpu.status();
      assert.equal(state.pc, 0x2000, "PC jumped to 0x2000");
    });

    QUnit.test("JZ nn - Jump if zero (taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("F", 0x40); // Set zero flag
      mem[0x0000] = 0xCA; // JZ nn
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x10;
      cpu.set("PC", 0x0000);
      cpu.steps(10);

      const state = cpu.status();
      assert.equal(state.pc, 0x1000, "Jump taken when zero flag set");
    });

    QUnit.test("JZ nn - Jump if zero (not taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("F", 0x00); // Clear zero flag
      mem[0x0000] = 0xCA; // JZ nn
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x10;
      cpu.set("PC", 0x0000);
      cpu.steps(10);

      const state = cpu.status();
      assert.equal(state.pc, 0x0003, "Jump not taken, PC advances");
    });

    QUnit.test("JC nn - Jump if carry", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("F", 0x01); // Set carry flag
      mem[0x0000] = 0xDA; // JC nn
      mem[0x0001] = 0x50;
      mem[0x0002] = 0x00;
      cpu.set("PC", 0x0000);
      cpu.steps(10);

      const state = cpu.status();
      assert.equal(state.pc, 0x0050, "Jump taken when carry set");
    });
  });

  QUnit.module("Call and Return", () => {
    QUnit.test("CALL nn / RET - Subroutine call", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xF000);
      mem[0x0000] = 0xCD; // CALL nn
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x10;
      mem[0x1000] = 0xC9; // RET

      cpu.set("PC", 0x0000);
      cpu.steps(17);

      let state = cpu.status();
      assert.equal(state.pc, 0x1000, "PC jumped to subroutine");

      cpu.steps(10);
      state = cpu.status();
      assert.equal(state.pc, 0x0003, "PC returned to after CALL");
      assert.equal(state.sp, 0xF000, "SP restored");
    });

    QUnit.test("CZ nn - Conditional call (taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xF000);
      cpu.set("F", 0x40); // Set zero flag
      mem[0x0000] = 0xCC; // CZ nn
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x20;

      cpu.set("PC", 0x0000);
      cpu.steps(17);

      const state = cpu.status();
      assert.equal(state.pc, 0x2000, "Call taken when zero flag set");
      assert.equal(state.sp, 0xEFFE, "Return address pushed");
    });

    QUnit.test("RNZ - Conditional return (not taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xF000);
      cpu.set("F", 0x40); // Set zero flag
      mem[0x0000] = 0xC0; // RNZ
      cpu.set("PC", 0x0000);
      cpu.steps(5);

      const state = cpu.status();
      assert.equal(state.pc, 0x0001, "Return not taken, PC advanced");
      assert.equal(state.sp, 0xF000, "SP unchanged");
    });
  });

  QUnit.module("Rotate Instructions", () => {
    QUnit.test("RLC - Rotate left", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0xAA); // 10101010
      mem[0x0000] = 0x07; // RLC
      cpu.set("PC", 0x0000);
      cpu.steps(4);

      const state = cpu.status();
      assert.equal(state.a, 0x55, "A rotated left (bit 7 to bit 0)");
      assert.ok(state.f & 0x01, "Carry set from bit 7");
    });

    QUnit.test("RRC - Rotate right", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x55); // 01010101
      mem[0x0000] = 0x0F; // RRC
      cpu.set("PC", 0x0000);
      cpu.steps(4);

      const state = cpu.status();
      assert.equal(state.a, 0xAA, "A rotated right (bit 0 to bit 7)");
      assert.ok(state.f & 0x01, "Carry set from bit 0");
    });

    QUnit.test("RAL - Rotate left through carry", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0xB5); // 10110101
      cpu.set("F", 0x01); // Carry = 1
      mem[0x0000] = 0x17; // RAL
      cpu.set("PC", 0x0000);
      cpu.steps(4);

      const state = cpu.status();
      assert.equal(state.a, 0x6B, "A rotated left, carry into bit 0");
    });

    QUnit.test("RAR - Rotate right through carry", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0xB5); // 10110101
      cpu.set("F", 0x01); // Carry = 1
      mem[0x0000] = 0x1F; // RAR
      cpu.set("PC", 0x0000);
      cpu.steps(4);

      const state = cpu.status();
      assert.equal(state.a, 0xDA, "A rotated right, carry into bit 7");
    });
  });

  QUnit.module("Memory Operations", () => {
    QUnit.test("STA (nn) - Store A direct", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x77);
      mem[0x0000] = 0x32; // STA (nn)
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x30;
      cpu.set("PC", 0x0000);
      cpu.steps(13);

      assert.equal(mem[0x3000], 0x77, "A stored at address 0x3000");
    });

    QUnit.test("LDA (nn) - Load A direct", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x3000] = 0x88;
      mem[0x0000] = 0x3A; // LDA (nn)
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x30;
      cpu.set("PC", 0x0000);
      cpu.steps(13);

      const state = cpu.status();
      assert.equal(state.a, 0x88, "A loaded from address 0x3000");
    });

    QUnit.test("SHLD (nn) - Store HL direct", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("H", 0x12);
      cpu.set("L", 0x34);
      mem[0x0000] = 0x22; // SHLD (nn)
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x40;
      cpu.set("PC", 0x0000);
      cpu.steps(16);

      assert.equal(mem[0x4000], 0x34, "L stored at 0x4000");
      assert.equal(mem[0x4001], 0x12, "H stored at 0x4001");
    });

    QUnit.test("LHLD (nn) - Load HL direct", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x4000] = 0x56;
      mem[0x4001] = 0x78;
      mem[0x0000] = 0x2A; // LHLD (nn)
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x40;
      cpu.set("PC", 0x0000);
      cpu.steps(16);

      const state = cpu.status();
      assert.equal(state.l, 0x56, "L loaded from 0x4000");
      assert.equal(state.h, 0x78, "H loaded from 0x4001");
    });

    QUnit.test("STAX B - Store A indirect via BC", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x99);
      cpu.set("B", 0x20);
      cpu.set("C", 0x50);
      mem[0x0000] = 0x02; // STAX B
      cpu.set("PC", 0x0000);
      cpu.steps(7);

      assert.equal(mem[0x2050], 0x99, "A stored at address BC");
    });

    QUnit.test("LDAX D - Load A indirect via DE", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x3000] = 0xAB;
      cpu.set("D", 0x30);
      cpu.set("E", 0x00);
      mem[0x0000] = 0x1A; // LDAX D
      cpu.set("PC", 0x0000);
      cpu.steps(7);

      const state = cpu.status();
      assert.equal(state.a, 0xAB, "A loaded from address DE");
    });
  });

  QUnit.module("I/O Operations", () => {
    QUnit.test("OUT (n),A - Output to port", (assert) => {
      const { cpu, mem, ports } = createTestCPU();

      cpu.set("A", 0x77);
      mem[0x0000] = 0xD3; // OUT (n),A
      mem[0x0001] = 0x10;
      cpu.set("PC", 0x0000);
      cpu.steps(10);

      assert.equal(ports[0x10], 0x77, "A written to port 0x10");
    });

    QUnit.test("IN A,(n) - Input from port", (assert) => {
      const { cpu, mem, ports } = createTestCPU();

      ports[0x20] = 0x88;
      mem[0x0000] = 0xDB; // IN A,(n)
      mem[0x0001] = 0x20;
      cpu.set("PC", 0x0000);
      cpu.steps(10);

      const state = cpu.status();
      assert.equal(state.a, 0x88, "A read from port 0x20");
    });
  });

  QUnit.module("Special Instructions", () => {
    QUnit.test("XCHG - Exchange DE and HL", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("D", 0x11);
      cpu.set("E", 0x22);
      cpu.set("H", 0x33);
      cpu.set("L", 0x44);
      mem[0x0000] = 0xEB; // XCHG
      cpu.set("PC", 0x0000);
      cpu.steps(4);

      const state = cpu.status();
      assert.equal(state.d, 0x33, "D = old H");
      assert.equal(state.e, 0x44, "E = old L");
      assert.equal(state.h, 0x11, "H = old D");
      assert.equal(state.l, 0x22, "L = old E");
    });

    QUnit.test("XTHL - Exchange top of stack with HL", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xF000);
      cpu.set("H", 0x12);
      cpu.set("L", 0x34);
      mem[0xF000] = 0x56;
      mem[0xF001] = 0x78;

      mem[0x0000] = 0xE3; // XTHL
      cpu.set("PC", 0x0000);
      cpu.steps(4);

      const state = cpu.status();
      assert.equal(state.h, 0x78, "H = value from stack+1");
      assert.equal(state.l, 0x56, "L = value from stack");
      assert.equal(mem[0xF000], 0x34, "Stack = old L");
      assert.equal(mem[0xF001], 0x12, "Stack+1 = old H");
    });

    QUnit.test("SPHL - Load SP from HL", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("H", 0xE0);
      cpu.set("L", 0x00);
      mem[0x0000] = 0xF9; // SPHL
      cpu.set("PC", 0x0000);
      cpu.steps(6);

      const state = cpu.status();
      assert.equal(state.sp, 0xE000, "SP loaded from HL");
    });

    QUnit.test("PCHL - Jump to address in HL", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("H", 0x25);
      cpu.set("L", 0x00);
      mem[0x0000] = 0xE9; // PCHL
      cpu.set("PC", 0x0000);
      cpu.steps(4);

      const state = cpu.status();
      assert.equal(state.pc, 0x2500, "PC = HL");
    });

    QUnit.test("STC - Set carry flag", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("F", 0x00);
      mem[0x0000] = 0x37; // STC
      cpu.set("PC", 0x0000);
      cpu.steps(4);

      const state = cpu.status();
      assert.ok(state.f & 0x01, "Carry flag set");
    });

    QUnit.test("CMC - Complement carry flag", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("F", 0x00);
      mem[0x0000] = 0x3F; // CMC
      cpu.set("PC", 0x0000);
      cpu.steps(4);

      let state = cpu.status();
      assert.ok(state.f & 0x01, "Carry toggled to 1");

      mem[0x0001] = 0x3F; // CMC
      cpu.set("PC", 0x0001);
      cpu.steps(4);

      state = cpu.status();
      assert.notOk(state.f & 0x01, "Carry toggled to 0");
    });
  });

  QUnit.module("Interrupt Handling", () => {
    QUnit.test("EI - Enable interrupts", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0xFB; // EI
      cpu.set("PC", 0x0000);
      cpu.steps(4);

      // Internal inte flag is not exposed, but we can test by triggering interrupt
      cpu.set("PC", 0x0100);
      cpu.interrupt(0x08);

      const state = cpu.status();
      assert.equal(state.pc, 0x08, "Interrupt taken when enabled");
    });

    QUnit.test("DI - Disable interrupts", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0xFB; // EI
      mem[0x0001] = 0xF3; // DI
      cpu.set("PC", 0x0000);
      cpu.steps(8);

      cpu.set("PC", 0x0100);
      cpu.interrupt(0x08);

      const state = cpu.status();
      assert.equal(state.pc, 0x0100, "Interrupt ignored when disabled");
    });

    QUnit.test("RST - Restart instruction", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xF000);
      mem[0x0100] = 0xC7; // RST 0
      cpu.set("PC", 0x0100);
      cpu.steps(11);

      const state = cpu.status();
      assert.equal(state.pc, 0x0000, "PC jumped to RST 0 vector");
      assert.equal(state.sp, 0xEFFE, "Return address pushed");
    });
  });

  QUnit.module("DAA Instruction", () => {
    QUnit.test("DAA - Decimal adjust after addition", (assert) => {
      const { cpu, mem } = createTestCPU();

      // DAA test: 0x09 + 0x08 = 0x11, which is valid BCD (represents 11)
      // For proper BCD: 9 + 8 = 17 decimal, so we need 0x17
      // This happens because lower nibble 9+8=17 decimal needs carry to upper nibble
      cpu.set("A", 0x09);
      mem[0x0000] = 0xC6; // ADI 0x08
      mem[0x0001] = 0x08;
      cpu.set("PC", 0x0000);
      cpu.steps(7);

      const state = cpu.status();
      // After binary add: 0x09 + 0x08 = 0x11 (17 decimal, but as hex looks like "11")
      assert.equal(state.a, 0x11, "After ADD: A = 0x11 (binary sum)");

      // Now apply DAA
      mem[0x0002] = 0x27; // DAA
      cpu.set("PC", 0x0002);
      cpu.steps(4);
      const state2 = cpu.status();
      assert.equal(state2.a, 0x17, "After DAA: A = 0x17 (BCD corrected for 9+8=17)");
    });
  });

  QUnit.module("Disassembler", () => {
    QUnit.test("Disassemble NOP", (assert) => {
      const [mnemonic, length] = disasm(0x00, 0, 0);
      assert.equal(mnemonic, "NOP", "NOP disassembled");
      assert.equal(length, 1, "NOP is 1 byte");
    });

    QUnit.test("Disassemble MVI A,n", (assert) => {
      const [mnemonic, length] = disasm(0x3E, 0x42, 0);
      assert.equal(mnemonic, "MVI A,$42", "MVI A,n disassembled with operand");
      assert.equal(length, 2, "MVI is 2 bytes");
    });

    QUnit.test("Disassemble JMP nn", (assert) => {
      const [mnemonic, length] = disasm(0xC3, 0x00, 0x20);
      assert.equal(mnemonic, "JMP $2000", "JMP nn disassembled with address");
      assert.equal(length, 3, "JMP is 3 bytes");
    });

    QUnit.test("Disassemble LXI H,nn", (assert) => {
      const [mnemonic, length] = disasm(0x21, 0x34, 0x12);
      assert.equal(mnemonic, "LXI H,$1234", "LXI H,nn disassembled");
      assert.equal(length, 3, "LXI is 3 bytes");
    });
  });

  QUnit.module("Cycle Timing", () => {
    QUnit.test("NOP takes 4 cycles", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x0000] = 0x00;
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      assert.equal(cpu.T(), 4, "NOP = 4 cycles");
    });

    QUnit.test("MVI takes 7 cycles", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x0000] = 0x3E;
      mem[0x0001] = 0x42;
      cpu.set("PC", 0x0000);
      cpu.steps(7);
      assert.equal(cpu.T(), 7, "MVI = 7 cycles");
    });

    QUnit.test("MOV register takes 5 cycles", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x0000] = 0x41; // MOV B,C
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.T(), 5, "MOV reg = 5 cycles");
    });

    QUnit.test("MOV from memory takes 7 cycles", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x0000] = 0x7E; // MOV A,M
      cpu.set("PC", 0x0000);
      cpu.steps(7);
      assert.equal(cpu.T(), 7, "MOV from M = 7 cycles");
    });

    QUnit.test("CALL takes 17 cycles", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      mem[0x0000] = 0xCD;
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x10;
      cpu.set("PC", 0x0000);
      cpu.steps(17);
      assert.equal(cpu.T(), 17, "CALL = 17 cycles");
    });
  });

  QUnit.module("Integration Tests", () => {
    QUnit.test("Complete program: Add two numbers", (assert) => {
      const { cpu, mem } = createTestCPU();

      // Program: Load 0x10 into B, 0x20 into C, add them to A
      mem[0x0000] = 0x06; // MVI B,0x10
      mem[0x0001] = 0x10;
      mem[0x0002] = 0x0E; // MVI C,0x20
      mem[0x0003] = 0x20;
      mem[0x0004] = 0x80; // ADD B
      mem[0x0005] = 0x81; // ADD C
      mem[0x0006] = 0x76; // HLT

      cpu.set("PC", 0x0000);
      cpu.steps(100); // Run until halted

      const state = cpu.status();
      assert.equal(state.a, 0x30, "A = 0x10 + 0x20 = 0x30");
      assert.equal(state.b, 0x10, "B = 0x10");
      assert.equal(state.c, 0x20, "C = 0x20");
    });

    QUnit.test("Complete program: Count loop", (assert) => {
      const { cpu, mem } = createTestCPU();

      // Program: Loop 5 times, incrementing A each iteration
      mem[0x0000] = 0x06; // MVI B,5
      mem[0x0001] = 0x05;
      mem[0x0002] = 0x3E; // LOOP: MVI A,0
      mem[0x0003] = 0x00;
      mem[0x0004] = 0x3C; // LOOP2: INR A
      mem[0x0005] = 0x05; // DCR B
      mem[0x0006] = 0xC2; // JNZ LOOP2
      mem[0x0007] = 0x04;
      mem[0x0008] = 0x00;
      mem[0x0009] = 0x76; // HLT

      cpu.set("PC", 0x0000);
      cpu.steps(500);

      const state = cpu.status();
      assert.equal(state.a, 0x05, "A incremented 5 times");
      assert.equal(state.b, 0x00, "B decremented to 0");
    });

    QUnit.test("Complete program: Subroutine call", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xF000);

      // Main: CALL SUB, then HLT
      mem[0x0000] = 0xCD; // CALL 0x0010
      mem[0x0001] = 0x10;
      mem[0x0002] = 0x00;
      mem[0x0003] = 0x76; // HLT

      // Subroutine: Load A with 0x99, then RET
      mem[0x0010] = 0x3E; // MVI A,0x99
      mem[0x0011] = 0x99;
      mem[0x0012] = 0xC9; // RET

      cpu.set("PC", 0x0000);
      cpu.steps(100);

      const state = cpu.status();
      assert.equal(state.a, 0x99, "Subroutine executed");
      assert.equal(state.pc, 0x0004, "Returned to after CALL+1 then halted");
    });

    QUnit.test("Complete program: Memory block copy", (assert) => {
      const { cpu, mem } = createTestCPU();

      // Copy 3 bytes from 0x2000 to 0x3000
      mem[0x2000] = 0xAA;
      mem[0x2001] = 0xBB;
      mem[0x2002] = 0xCC;

      mem[0x0000] = 0x21; // LXI H,0x2000 (source)
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x20;
      mem[0x0003] = 0x11; // LXI D,0x3000 (dest)
      mem[0x0004] = 0x00;
      mem[0x0005] = 0x30;
      mem[0x0006] = 0x06; // MVI B,3 (count)
      mem[0x0007] = 0x03;

      // LOOP:
      mem[0x0008] = 0x7E; // MOV A,M
      mem[0x0009] = 0x12; // STAX D
      mem[0x000A] = 0x23; // INX H
      mem[0x000B] = 0x13; // INX D
      mem[0x000C] = 0x05; // DCR B
      mem[0x000D] = 0xC2; // JNZ LOOP
      mem[0x000E] = 0x08;
      mem[0x000F] = 0x00;
      mem[0x0010] = 0x76; // HLT

      cpu.set("PC", 0x0000);
      cpu.steps(1000);

      assert.equal(mem[0x3000], 0xAA, "Byte 1 copied");
      assert.equal(mem[0x3001], 0xBB, "Byte 2 copied");
      assert.equal(mem[0x3002], 0xCC, "Byte 3 copied");
    });
  });

  QUnit.module("Flags String", () => {
    QUnit.test("flagsToString formats correctly", (assert) => {
      const { cpu } = createTestCPU();

      cpu.set("F", 0x00);
      assert.equal(cpu.flagsToString(), "sz0a0p1c", "All flags clear");

      cpu.set("F", 0xFF);
      assert.equal(cpu.flagsToString(), "SZ0A0P1C", "All flags set");

      cpu.set("F", 0x41); // Zero + Carry
      assert.equal(cpu.flagsToString(), "sZ0a0p1C", "Zero and Carry set");
    });
  });
});
