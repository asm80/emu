/**
 * Intel 8085 CPU Emulator Tests
 *
 * Comprehensive test suite for ES6 8085 emulator implementation.
 * Tests instruction execution, flag handling, timing, and hardware compatibility.
 */

import QUnit from "qunit";
import create8085, { disasm } from "../src/8085.js";

QUnit.module("8085 CPU Emulator", () => {
  /**
   * Helper: Create CPU with simple memory array
   */
  const createTestCPU = () => {
    const mem = new Uint8Array(65536);
    const ports = new Uint8Array(256);

    const cpu = create8085({
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

    QUnit.test("DCR M - Decrement memory", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("H", 0x20);
      cpu.set("L", 0x00);
      mem[0x2000] = 0x50;
      mem[0x0000] = 0x35; // DCR M
      cpu.set("PC", 0x0000);
      cpu.steps(10);

      assert.equal(mem[0x2000], 0x4F, "Memory at HL decremented");
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

  QUnit.module("8085-Specific Instructions", () => {
    QUnit.test("RIM instruction reads port 99999 into bit 7 of A", (assert) => {
      const { cpu, mem, ports } = createTestCPU();

      // Test with port returning 0
      ports[99999 & 0xFF] = 0;
      cpu.set("A", 0x7F);
      mem[0] = 0x20; // RIM
      cpu.steps(4);

      let state = cpu.status();
      assert.equal(state.a & 0x80, 0, "Bit 7 cleared when port returns 0");
      assert.equal(state.a & 0x7F, 0x7F, "Lower 7 bits preserved");

      // Test with port returning non-zero
      cpu.reset();
      ports[99999 & 0xFF] = 0xFF;
      cpu.set("A", 0x00);
      mem[0] = 0x20; // RIM
      cpu.steps(4);

      state = cpu.status();
      assert.equal(state.a & 0x80, 0x80, "Bit 7 set when port returns non-zero");
    });

    QUnit.test("RIM preserves lower 7 bits of A register", (assert) => {
      const { cpu, mem, ports } = createTestCPU();

      ports[99999 & 0xFF] = 0xFF;
      cpu.set("A", 0x55);
      mem[0] = 0x20; // RIM
      cpu.steps(4);

      const state = cpu.status();
      assert.equal(state.a & 0x7F, 0x55, "Lower 7 bits unchanged");
    });

    QUnit.test("SIM instruction writes bits 6-7 of A to port 99999", (assert) => {
      const { cpu, mem, ports } = createTestCPU();

      // Test with 0x00
      cpu.set("A", 0x00);
      mem[0] = 0x30; // SIM
      cpu.steps(4);
      assert.equal(ports[99999 & 0xFF], 0x00, "Port receives 0x00");

      // Test with 0x40
      cpu.reset();
      cpu.set("A", 0x40);
      mem[0] = 0x30; // SIM
      cpu.steps(4);
      assert.equal(ports[99999 & 0xFF], 0x40, "Port receives 0x40");

      // Test with 0x80
      cpu.reset();
      cpu.set("A", 0x80);
      mem[0] = 0x30; // SIM
      cpu.steps(4);
      assert.equal(ports[99999 & 0xFF], 0x80, "Port receives 0x80");

      // Test with 0xC0
      cpu.reset();
      cpu.set("A", 0xC0);
      mem[0] = 0x30; // SIM
      cpu.steps(4);
      assert.equal(ports[99999 & 0xFF], 0xC0, "Port receives 0xC0");

      // Test with 0xFF (only bits 6-7 should be written)
      cpu.reset();
      cpu.set("A", 0xFF);
      mem[0] = 0x30; // SIM
      cpu.steps(4);
      assert.equal(ports[99999 & 0xFF], 0xC0, "Only bits 6-7 written");
    });

    QUnit.test("RIM and SIM have correct cycle timing", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0] = 0x20; // RIM
      cpu.steps(4);
      assert.equal(cpu.T(), 4, "RIM takes 4 cycles");

      cpu.reset();
      mem[0] = 0x30; // SIM
      cpu.steps(4);
      assert.equal(cpu.T(), 4, "SIM takes 4 cycles");
    });
  });

  QUnit.module("8085 Interrupt Handling", () => {
    QUnit.test("EI sets INTERRUPT flag (0x20) in F register", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0] = 0xFB; // EI
      cpu.steps(4);

      const state = cpu.status();
      assert.equal(state.f & 0x20, 0x20, "INTERRUPT flag set");
    });

    QUnit.test("DI clears INTERRUPT flag (0x20) in F register", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("F", 0xFF); // Set all flags
      mem[0] = 0xF3; // DI
      cpu.steps(4);

      const state = cpu.status();
      assert.equal(state.f & 0x20, 0x00, "INTERRUPT flag cleared");
    });

    QUnit.test("interrupt() checks INTERRUPT flag before executing", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("PC", 0x1000);
      cpu.set("SP", 0xF000);

      // Test with interrupts disabled
      cpu.set("F", 0x00); // Clear INTERRUPT flag
      cpu.interrupt(0x0038);

      let state = cpu.status();
      assert.equal(state.pc, 0x1000, "PC unchanged when interrupts disabled");

      // Test with interrupts enabled
      cpu.set("F", 0x20); // Set INTERRUPT flag
      cpu.interrupt(0x0038);

      state = cpu.status();
      assert.equal(state.pc, 0x0038, "PC set to vector when interrupts enabled");
      assert.equal(state.sp, 0xEFFE, "Return address pushed to stack");

      const returnAddr = mem[0xEFFE] | (mem[0xEFFF] << 8);
      assert.equal(returnAddr, 0x1000, "Correct return address on stack");
    });

    QUnit.test("PUSH PSW / POP PSW preserves INTERRUPT flag", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xF000);
      cpu.set("A", 0x42);
      cpu.set("F", 0x20); // Set INTERRUPT flag only

      mem[0] = 0xF5; // PUSH PSW
      cpu.steps(11);

      cpu.set("F", 0x00); // Clear flags
      mem[1] = 0xF1; // POP PSW
      cpu.steps(10);

      const state = cpu.status();
      assert.equal(state.f & 0x20, 0x20, "INTERRUPT flag restored");
      assert.equal(state.a, 0x42, "A register restored");
    });

    QUnit.test("INTERRUPT flag coexists with other flags", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("F", 0xE1); // Set SIGN, ZERO, CARRY, and INTERRUPT (0x80 + 0x40 + 0x20 + 0x01)
      mem[0] = 0xF3; // DI
      cpu.steps(4);

      const state = cpu.status();
      assert.equal(state.f & 0x20, 0x00, "INTERRUPT flag cleared");
      assert.equal(state.f & 0xC1, 0xC1, "Other flags preserved");
    });
  });

  QUnit.module("8085 Disassembler", () => {
    QUnit.test("Disassemble RIM instruction", (assert) => {
      const [mnemonic, length] = disasm(0x20, 0, 0, 0, 0);
      assert.equal(mnemonic, "RIM", "RIM disassembles correctly");
      assert.equal(length, 1, "RIM is 1 byte");
    });

    QUnit.test("Disassemble SIM instruction", (assert) => {
      const [mnemonic, length] = disasm(0x30, 0, 0, 0, 0);
      assert.equal(mnemonic, "SIM", "SIM disassembles correctly");
      assert.equal(length, 1, "SIM is 1 byte");
    });
  });

  QUnit.module("Additional RST Vectors (for coverage)", () => {
    QUnit.test("RST 1 - Restart to 0x08", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xF000);
      mem[0x0100] = 0xCF; // RST 1
      cpu.set("PC", 0x0100);
      cpu.steps(11);

      const state = cpu.status();
      assert.equal(state.pc, 0x08, "PC jumped to RST 1 vector");
      assert.equal(state.sp, 0xEFFE, "Return address pushed");
    });

    QUnit.test("RST 2 - Restart to 0x10", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xF000);
      mem[0x0100] = 0xD7; // RST 2
      cpu.set("PC", 0x0100);
      cpu.steps(11);

      const state = cpu.status();
      assert.equal(state.pc, 0x10, "PC jumped to RST 2 vector");
    });

    QUnit.test("RST 3 - Restart to 0x18", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xF000);
      mem[0x0100] = 0xDF; // RST 3
      cpu.set("PC", 0x0100);
      cpu.steps(11);

      const state = cpu.status();
      assert.equal(state.pc, 0x18, "PC jumped to RST 3 vector");
    });

    QUnit.test("RST 4 - Restart to 0x20", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xF000);
      mem[0x0100] = 0xE7; // RST 4
      cpu.set("PC", 0x0100);
      cpu.steps(11);

      const state = cpu.status();
      assert.equal(state.pc, 0x20, "PC jumped to RST 4 vector");
    });

    QUnit.test("RST 5 - Restart to 0x28", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xF000);
      mem[0x0100] = 0xEF; // RST 5
      cpu.set("PC", 0x0100);
      cpu.steps(11);

      const state = cpu.status();
      assert.equal(state.pc, 0x28, "PC jumped to RST 5 vector");
    });

    QUnit.test("RST 6 - Restart to 0x30", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xF000);
      mem[0x0100] = 0xF7; // RST 6
      cpu.set("PC", 0x0100);
      cpu.steps(11);

      const state = cpu.status();
      assert.equal(state.pc, 0x30, "PC jumped to RST 6 vector");
    });

    QUnit.test("RST 7 - Restart to 0x38", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xF000);
      mem[0x0100] = 0xFF; // RST 7
      cpu.set("PC", 0x0100);
      cpu.steps(11);

      const state = cpu.status();
      assert.equal(state.pc, 0x38, "PC jumped to RST 7 vector");
      assert.equal(state.sp, 0xEFFE, "Return address pushed");
    });
  });

  QUnit.module("Conditional Branches Coverage (all paths)", () => {
    QUnit.test("JNZ - Jump if not zero (taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("F", 0x00); // Clear zero flag
      mem[0x0000] = 0xC2; // JNZ nn
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x30;
      cpu.set("PC", 0x0000);
      cpu.steps(10);

      const state = cpu.status();
      assert.equal(state.pc, 0x3000, "Jump taken when zero flag clear");
    });

    QUnit.test("JNC - Jump if no carry (taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("F", 0x00); // Clear carry flag
      mem[0x0000] = 0xD2; // JNC nn
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x40;
      cpu.set("PC", 0x0000);
      cpu.steps(10);

      const state = cpu.status();
      assert.equal(state.pc, 0x4000, "Jump taken when carry clear");
    });

    QUnit.test("JNC - Jump if no carry (not taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("F", 0x01); // Set carry flag
      mem[0x0000] = 0xD2; // JNC nn
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x40;
      cpu.set("PC", 0x0000);
      cpu.steps(10);

      const state = cpu.status();
      assert.equal(state.pc, 0x0003, "Jump not taken when carry set");
    });

    QUnit.test("JPO - Jump if parity odd (taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("F", 0x00); // Clear parity flag (odd parity)
      mem[0x0000] = 0xE2; // JPO nn
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x50;
      cpu.set("PC", 0x0000);
      cpu.steps(10);

      const state = cpu.status();
      assert.equal(state.pc, 0x5000, "Jump taken when parity odd");
    });

    QUnit.test("JPO - Jump if parity odd (not taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("F", 0x04); // Set parity flag (even parity)
      mem[0x0000] = 0xE2; // JPO nn
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x50;
      cpu.set("PC", 0x0000);
      cpu.steps(10);

      const state = cpu.status();
      assert.equal(state.pc, 0x0003, "Jump not taken when parity even");
    });

    QUnit.test("JPE - Jump if parity even (taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("F", 0x04); // Set parity flag (even parity)
      mem[0x0000] = 0xEA; // JPE nn
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x60;
      cpu.set("PC", 0x0000);
      cpu.steps(10);

      const state = cpu.status();
      assert.equal(state.pc, 0x6000, "Jump taken when parity even");
    });

    QUnit.test("JPE - Jump if parity even (not taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("F", 0x00); // Clear parity flag (odd parity)
      mem[0x0000] = 0xEA; // JPE nn
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x60;
      cpu.set("PC", 0x0000);
      cpu.steps(10);

      const state = cpu.status();
      assert.equal(state.pc, 0x0003, "Jump not taken when parity odd");
    });

    QUnit.test("JP - Jump if positive (taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("F", 0x00); // Clear sign flag (positive)
      mem[0x0000] = 0xF2; // JP nn
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x70;
      cpu.set("PC", 0x0000);
      cpu.steps(10);

      const state = cpu.status();
      assert.equal(state.pc, 0x7000, "Jump taken when positive");
    });

    QUnit.test("JP - Jump if positive (not taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("F", 0x80); // Set sign flag (negative)
      mem[0x0000] = 0xF2; // JP nn
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x70;
      cpu.set("PC", 0x0000);
      cpu.steps(10);

      const state = cpu.status();
      assert.equal(state.pc, 0x0003, "Jump not taken when negative");
    });

    QUnit.test("JM - Jump if minus (taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("F", 0x80); // Set sign flag (negative)
      mem[0x0000] = 0xFA; // JM nn
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x80;
      cpu.set("PC", 0x0000);
      cpu.steps(10);

      const state = cpu.status();
      assert.equal(state.pc, 0x8000, "Jump taken when negative");
    });

    QUnit.test("JM - Jump if minus (not taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("F", 0x00); // Clear sign flag (positive)
      mem[0x0000] = 0xFA; // JM nn
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x80;
      cpu.set("PC", 0x0000);
      cpu.steps(10);

      const state = cpu.status();
      assert.equal(state.pc, 0x0003, "Jump not taken when positive");
    });
  });

  QUnit.module("Conditional Calls Coverage (all paths)", () => {
    QUnit.test("CNZ - Call if not zero (taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xF000);
      cpu.set("F", 0x00); // Clear zero flag
      mem[0x0000] = 0xC4; // CNZ nn
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x20;
      cpu.set("PC", 0x0000);
      cpu.steps(17);

      const state = cpu.status();
      assert.equal(state.pc, 0x2000, "Call taken when zero clear");
      assert.equal(state.sp, 0xEFFE, "Return address pushed");
    });

    QUnit.test("CNC - Call if no carry (taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xF000);
      cpu.set("F", 0x00); // Clear carry flag
      mem[0x0000] = 0xD4; // CNC nn
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x30;
      cpu.set("PC", 0x0000);
      cpu.steps(17);

      const state = cpu.status();
      assert.equal(state.pc, 0x3000, "Call taken when carry clear");
    });

    QUnit.test("CNC - Call if no carry (not taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xF000);
      cpu.set("F", 0x01); // Set carry flag
      mem[0x0000] = 0xD4; // CNC nn
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x30;
      cpu.set("PC", 0x0000);
      cpu.steps(11);

      const state = cpu.status();
      assert.equal(state.pc, 0x0003, "Call not taken when carry set");
      assert.equal(state.sp, 0xF000, "Stack unchanged");
    });

    QUnit.test("CC - Call if carry (taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xF000);
      cpu.set("F", 0x01); // Set carry flag
      mem[0x0000] = 0xDC; // CC nn
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x40;
      cpu.set("PC", 0x0000);
      cpu.steps(17);

      const state = cpu.status();
      assert.equal(state.pc, 0x4000, "Call taken when carry set");
    });

    QUnit.test("CC - Call if carry (not taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xF000);
      cpu.set("F", 0x00); // Clear carry flag
      mem[0x0000] = 0xDC; // CC nn
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x40;
      cpu.set("PC", 0x0000);
      cpu.steps(11);

      const state = cpu.status();
      assert.equal(state.pc, 0x0003, "Call not taken when carry clear");
    });

    QUnit.test("CPO - Call if parity odd (taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xF000);
      cpu.set("F", 0x00); // Clear parity flag (odd)
      mem[0x0000] = 0xE4; // CPO nn
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x50;
      cpu.set("PC", 0x0000);
      cpu.steps(17);

      const state = cpu.status();
      assert.equal(state.pc, 0x5000, "Call taken when parity odd");
    });

    QUnit.test("CPO - Call if parity odd (not taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xF000);
      cpu.set("F", 0x04); // Set parity flag (even)
      mem[0x0000] = 0xE4; // CPO nn
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x50;
      cpu.set("PC", 0x0000);
      cpu.steps(11);

      const state = cpu.status();
      assert.equal(state.pc, 0x0003, "Call not taken when parity even");
    });

    QUnit.test("CPE - Call if parity even (taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xF000);
      cpu.set("F", 0x04); // Set parity flag (even)
      mem[0x0000] = 0xEC; // CPE nn
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x60;
      cpu.set("PC", 0x0000);
      cpu.steps(17);

      const state = cpu.status();
      assert.equal(state.pc, 0x6000, "Call taken when parity even");
    });

    QUnit.test("CPE - Call if parity even (not taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xF000);
      cpu.set("F", 0x00); // Clear parity flag (odd)
      mem[0x0000] = 0xEC; // CPE nn
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x60;
      cpu.set("PC", 0x0000);
      cpu.steps(11);

      const state = cpu.status();
      assert.equal(state.pc, 0x0003, "Call not taken when parity odd");
    });

    QUnit.test("CP - Call if positive (taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xF000);
      cpu.set("F", 0x00); // Clear sign flag (positive)
      mem[0x0000] = 0xF4; // CP nn
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x70;
      cpu.set("PC", 0x0000);
      cpu.steps(17);

      const state = cpu.status();
      assert.equal(state.pc, 0x7000, "Call taken when positive");
    });

    QUnit.test("CP - Call if positive (not taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xF000);
      cpu.set("F", 0x80); // Set sign flag (negative)
      mem[0x0000] = 0xF4; // CP nn
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x70;
      cpu.set("PC", 0x0000);
      cpu.steps(11);

      const state = cpu.status();
      assert.equal(state.pc, 0x0003, "Call not taken when negative");
    });

    QUnit.test("CM - Call if minus (taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xF000);
      cpu.set("F", 0x80); // Set sign flag (negative)
      mem[0x0000] = 0xFC; // CM nn
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x80;
      cpu.set("PC", 0x0000);
      cpu.steps(17);

      const state = cpu.status();
      assert.equal(state.pc, 0x8000, "Call taken when negative");
    });

    QUnit.test("CM - Call if minus (not taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xF000);
      cpu.set("F", 0x00); // Clear sign flag (positive)
      mem[0x0000] = 0xFC; // CM nn
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x80;
      cpu.set("PC", 0x0000);
      cpu.steps(11);

      const state = cpu.status();
      assert.equal(state.pc, 0x0003, "Call not taken when positive");
    });
  });

  QUnit.module("Conditional Returns Coverage (all paths)", () => {
    QUnit.test("RNZ - Return if not zero (taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xEFFE);
      cpu.set("F", 0x00); // Clear zero flag
      mem[0xEFFE] = 0x00;
      mem[0xEFFF] = 0x10;
      mem[0x0000] = 0xC0; // RNZ
      cpu.set("PC", 0x0000);
      cpu.steps(11);

      const state = cpu.status();
      assert.equal(state.pc, 0x1000, "Return taken when zero clear");
      assert.equal(state.sp, 0xF000, "Stack pointer incremented");
    });

    QUnit.test("RZ - Return if zero (not taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xF000);
      cpu.set("F", 0x00); // Clear zero flag
      mem[0x0000] = 0xC8; // RZ
      cpu.set("PC", 0x0000);
      cpu.steps(5);

      const state = cpu.status();
      assert.equal(state.pc, 0x0001, "Return not taken, PC advanced");
      assert.equal(state.sp, 0xF000, "Stack unchanged");
    });

    QUnit.test("RNC - Return if no carry (taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xEFFE);
      cpu.set("F", 0x00); // Clear carry flag
      mem[0xEFFE] = 0x00;
      mem[0xEFFF] = 0x20;
      mem[0x0000] = 0xD0; // RNC
      cpu.set("PC", 0x0000);
      cpu.steps(11);

      const state = cpu.status();
      assert.equal(state.pc, 0x2000, "Return taken when carry clear");
    });

    QUnit.test("RNC - Return if no carry (not taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xF000);
      cpu.set("F", 0x01); // Set carry flag
      mem[0x0000] = 0xD0; // RNC
      cpu.set("PC", 0x0000);
      cpu.steps(5);

      const state = cpu.status();
      assert.equal(state.pc, 0x0001, "Return not taken when carry set");
      assert.equal(state.sp, 0xF000, "Stack unchanged");
    });

    QUnit.test("RC - Return if carry (taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xEFFE);
      cpu.set("F", 0x01); // Set carry flag
      mem[0xEFFE] = 0x00;
      mem[0xEFFF] = 0x30;
      mem[0x0000] = 0xD8; // RC
      cpu.set("PC", 0x0000);
      cpu.steps(11);

      const state = cpu.status();
      assert.equal(state.pc, 0x3000, "Return taken when carry set");
    });

    QUnit.test("RC - Return if carry (not taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xF000);
      cpu.set("F", 0x00); // Clear carry flag
      mem[0x0000] = 0xD8; // RC
      cpu.set("PC", 0x0000);
      cpu.steps(5);

      const state = cpu.status();
      assert.equal(state.pc, 0x0001, "Return not taken when carry clear");
    });

    QUnit.test("RPO - Return if parity odd (taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xEFFE);
      cpu.set("F", 0x00); // Clear parity flag (odd)
      mem[0xEFFE] = 0x00;
      mem[0xEFFF] = 0x40;
      mem[0x0000] = 0xE0; // RPO
      cpu.set("PC", 0x0000);
      cpu.steps(11);

      const state = cpu.status();
      assert.equal(state.pc, 0x4000, "Return taken when parity odd");
    });

    QUnit.test("RPO - Return if parity odd (not taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xF000);
      cpu.set("F", 0x04); // Set parity flag (even)
      mem[0x0000] = 0xE0; // RPO
      cpu.set("PC", 0x0000);
      cpu.steps(5);

      const state = cpu.status();
      assert.equal(state.pc, 0x0001, "Return not taken when parity even");
    });

    QUnit.test("RPE - Return if parity even (taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xEFFE);
      cpu.set("F", 0x04); // Set parity flag (even)
      mem[0xEFFE] = 0x00;
      mem[0xEFFF] = 0x50;
      mem[0x0000] = 0xE8; // RPE
      cpu.set("PC", 0x0000);
      cpu.steps(11);

      const state = cpu.status();
      assert.equal(state.pc, 0x5000, "Return taken when parity even");
    });

    QUnit.test("RPE - Return if parity even (not taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xF000);
      cpu.set("F", 0x00); // Clear parity flag (odd)
      mem[0x0000] = 0xE8; // RPE
      cpu.set("PC", 0x0000);
      cpu.steps(5);

      const state = cpu.status();
      assert.equal(state.pc, 0x0001, "Return not taken when parity odd");
    });

    QUnit.test("RP - Return if positive (taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xEFFE);
      cpu.set("F", 0x00); // Clear sign flag (positive)
      mem[0xEFFE] = 0x00;
      mem[0xEFFF] = 0x60;
      mem[0x0000] = 0xF0; // RP
      cpu.set("PC", 0x0000);
      cpu.steps(11);

      const state = cpu.status();
      assert.equal(state.pc, 0x6000, "Return taken when positive");
    });

    QUnit.test("RP - Return if positive (not taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xF000);
      cpu.set("F", 0x80); // Set sign flag (negative)
      mem[0x0000] = 0xF0; // RP
      cpu.set("PC", 0x0000);
      cpu.steps(5);

      const state = cpu.status();
      assert.equal(state.pc, 0x0001, "Return not taken when negative");
    });

    QUnit.test("RM - Return if minus (taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xEFFE);
      cpu.set("F", 0x80); // Set sign flag (negative)
      mem[0xEFFE] = 0x00;
      mem[0xEFFF] = 0x70;
      mem[0x0000] = 0xF8; // RM
      cpu.set("PC", 0x0000);
      cpu.steps(11);

      const state = cpu.status();
      assert.equal(state.pc, 0x7000, "Return taken when negative");
    });

    QUnit.test("RM - Return if minus (not taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xF000);
      cpu.set("F", 0x00); // Clear sign flag (positive)
      mem[0x0000] = 0xF8; // RM
      cpu.set("PC", 0x0000);
      cpu.steps(5);

      const state = cpu.status();
      assert.equal(state.pc, 0x0001, "Return not taken when positive");
    });
  });

  QUnit.module("Additional Edge Cases (for branch coverage)", () => {
    QUnit.test("JC - Jump if carry (not taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("F", 0x00); // Clear carry flag
      mem[0x0000] = 0xDA; // JC nn
      mem[0x0001] = 0x50;
      mem[0x0002] = 0x00;
      cpu.set("PC", 0x0000);
      cpu.steps(10);

      const state = cpu.status();
      assert.equal(state.pc, 0x0003, "Jump not taken when carry clear");
    });

    QUnit.test("CZ - Call if zero (not taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xF000);
      cpu.set("F", 0x00); // Clear zero flag
      mem[0x0000] = 0xCC; // CZ nn
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x20;
      cpu.set("PC", 0x0000);
      cpu.steps(11);

      const state = cpu.status();
      assert.equal(state.pc, 0x0003, "Call not taken when zero clear");
      assert.equal(state.sp, 0xF000, "Stack unchanged");
    });

    QUnit.test("CNZ - Call if not zero (not taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xF000);
      cpu.set("F", 0x40); // Set zero flag
      mem[0x0000] = 0xC4; // CNZ nn
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x20;
      cpu.set("PC", 0x0000);
      cpu.steps(11);

      const state = cpu.status();
      assert.equal(state.pc, 0x0003, "Call not taken when zero set");
      assert.equal(state.sp, 0xF000, "Stack unchanged");
    });

    QUnit.test("JZ - Jump if zero (not taken) edge case", (assert) => {
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

    QUnit.test("JNZ - Jump if not zero (not taken) edge case", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("F", 0x40); // Set zero flag
      mem[0x0000] = 0xC2; // JNZ nn
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x30;
      cpu.set("PC", 0x0000);
      cpu.steps(10);

      const state = cpu.status();
      assert.equal(state.pc, 0x0003, "Jump not taken when zero set");
    });

    QUnit.test("RZ - Return if zero (taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xEFFE);
      cpu.set("F", 0x40); // Set zero flag
      mem[0xEFFE] = 0x00;
      mem[0xEFFF] = 0x10;
      mem[0x0000] = 0xC8; // RZ
      cpu.set("PC", 0x0000);
      cpu.steps(11);

      const state = cpu.status();
      assert.equal(state.pc, 0x1000, "Return taken when zero set");
      assert.equal(state.sp, 0xF000, "Stack pointer incremented");
    });

    QUnit.test("RNZ - Return if not zero (not taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xF000);
      cpu.set("F", 0x40); // Set zero flag
      mem[0x0000] = 0xC0; // RNZ
      cpu.set("PC", 0x0000);
      cpu.steps(5);

      const state = cpu.status();
      assert.equal(state.pc, 0x0001, "Return not taken, PC advanced");
      assert.equal(state.sp, 0xF000, "Stack unchanged");
    });

    QUnit.test("SBI - Subtract immediate with borrow edge case", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x10);
      cpu.set("F", 0x01); // Set carry (borrow)
      mem[0x0000] = 0xDE; // SBI n
      mem[0x0001] = 0x05;
      cpu.set("PC", 0x0000);
      cpu.steps(7);

      const state = cpu.status();
      assert.equal(state.a, 0x0A, "A = 0x10 - 0x05 - 1 = 0x0A");
    });

    QUnit.test("ACI - Add immediate with carry edge case", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x10);
      cpu.set("F", 0x01); // Set carry
      mem[0x0000] = 0xCE; // ACI n
      mem[0x0001] = 0x05;
      cpu.set("PC", 0x0000);
      cpu.steps(7);

      const state = cpu.status();
      assert.equal(state.a, 0x16, "A = 0x10 + 0x05 + 1 = 0x16");
    });

    QUnit.test("POP HL - Pop stack to HL", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xEFFE);
      mem[0xEFFE] = 0x34;
      mem[0xEFFF] = 0x12;
      mem[0x0000] = 0xE1; // POP HL
      cpu.set("PC", 0x0000);
      cpu.steps(10);

      const state = cpu.status();
      assert.equal(state.h, 0x12, "H = high byte from stack");
      assert.equal(state.l, 0x34, "L = low byte from stack");
      assert.equal(state.sp, 0xF000, "SP incremented by 2");
    });

    QUnit.test("PUSH HL - Push HL to stack", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xF000);
      cpu.set("H", 0x56);
      cpu.set("L", 0x78);
      mem[0x0000] = 0xE5; // PUSH HL
      cpu.set("PC", 0x0000);
      cpu.steps(11);

      const state = cpu.status();
      assert.equal(state.sp, 0xEFFE, "SP decremented by 2");
      assert.equal(mem[0xEFFE], 0x78, "L pushed to stack");
      assert.equal(mem[0xEFFF], 0x56, "H pushed to stack");
    });

    QUnit.test("XRI - XOR immediate", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0xF0);
      mem[0x0000] = 0xEE; // XRI n
      mem[0x0001] = 0x0F;
      cpu.set("PC", 0x0000);
      cpu.steps(7);

      const state = cpu.status();
      assert.equal(state.a, 0xFF, "A = 0xF0 XOR 0x0F = 0xFF");
    });

    QUnit.test("POP D - Pop stack to DE", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xEFFE);
      mem[0xEFFE] = 0xAB;
      mem[0xEFFF] = 0xCD;
      mem[0x0000] = 0xD1; // POP D
      cpu.set("PC", 0x0000);
      cpu.steps(10);

      const state = cpu.status();
      assert.equal(state.d, 0xCD, "D = high byte from stack");
      assert.equal(state.e, 0xAB, "E = low byte from stack");
    });

    QUnit.test("PUSH D - Push DE to stack", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xF000);
      cpu.set("D", 0x11);
      cpu.set("E", 0x22);
      mem[0x0000] = 0xD5; // PUSH D
      cpu.set("PC", 0x0000);
      cpu.steps(11);

      const state = cpu.status();
      assert.equal(state.sp, 0xEFFE, "SP decremented");
      assert.equal(mem[0xEFFE], 0x22, "E pushed");
      assert.equal(mem[0xEFFF], 0x11, "D pushed");
    });

    QUnit.test("PUSH B - Push BC to stack", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xF000);
      cpu.set("B", 0x33);
      cpu.set("C", 0x44);
      mem[0x0000] = 0xC5; // PUSH B
      cpu.set("PC", 0x0000);
      cpu.steps(11);

      const state = cpu.status();
      assert.equal(mem[0xEFFE], 0x44, "C pushed");
      assert.equal(mem[0xEFFF], 0x33, "B pushed");
    });

    QUnit.test("POP B - Pop stack to BC", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xEFFE);
      mem[0xEFFE] = 0x55;
      mem[0xEFFF] = 0x66;
      mem[0x0000] = 0xC1; // POP B
      cpu.set("PC", 0x0000);
      cpu.steps(10);

      const state = cpu.status();
      assert.equal(state.b, 0x66, "B = high byte");
      assert.equal(state.c, 0x55, "C = low byte");
    });

    QUnit.test("MVI M,n - Move immediate to memory", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("H", 0x20);
      cpu.set("L", 0x00);
      mem[0x0000] = 0x36; // MVI M,n
      mem[0x0001] = 0x99;
      cpu.set("PC", 0x0000);
      cpu.steps(10);

      assert.equal(mem[0x2000], 0x99, "Immediate value written to memory at HL");
    });

    QUnit.test("DAD SP - Add SP to HL", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("H", 0x10);
      cpu.set("L", 0x00);
      cpu.set("SP", 0x0050);
      mem[0x0000] = 0x39; // DAD SP
      cpu.set("PC", 0x0000);
      cpu.steps(11);

      const state = cpu.status();
      assert.equal(state.h, 0x10, "H = 0x10");
      assert.equal(state.l, 0x50, "L = 0x50 (HL = 0x1000 + 0x0050)");
    });

    QUnit.test("INX SP - Increment SP", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xEFFF);
      mem[0x0000] = 0x33; // INX SP
      cpu.set("PC", 0x0000);
      cpu.steps(6);

      const state = cpu.status();
      assert.equal(state.sp, 0xF000, "SP incremented");
    });

    QUnit.test("DCX SP - Decrement SP", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xF000);
      mem[0x0000] = 0x3B; // DCX SP
      cpu.set("PC", 0x0000);
      cpu.steps(6);

      const state = cpu.status();
      assert.equal(state.sp, 0xEFFF, "SP decremented");
    });

    QUnit.test("INR A - Increment A", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x10);
      mem[0x0000] = 0x3C; // INR A
      cpu.set("PC", 0x0000);
      cpu.steps(5);

      const state = cpu.status();
      assert.equal(state.a, 0x11, "A incremented");
    });

    QUnit.test("DCR A - Decrement A", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x10);
      mem[0x0000] = 0x3D; // DCR A
      cpu.set("PC", 0x0000);
      cpu.steps(5);

      const state = cpu.status();
      assert.equal(state.a, 0x0F, "A decremented");
    });

    QUnit.test("DCR L - Decrement L", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("L", 0x10);
      mem[0x0000] = 0x2D; // DCR L
      cpu.set("PC", 0x0000);
      cpu.steps(5);

      const state = cpu.status();
      assert.equal(state.l, 0x0F, "L decremented");
    });

    QUnit.test("MVI L,n - Move immediate to L", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x2E; // MVI L,n
      mem[0x0001] = 0x88;
      cpu.set("PC", 0x0000);
      cpu.steps(7);

      const state = cpu.status();
      assert.equal(state.l, 0x88, "L loaded with immediate value");
    });

    QUnit.test("LXI SP,nn - Load immediate to SP", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x31; // LXI SP,nn
      mem[0x0001] = 0x00;
      mem[0x0002] = 0xE0;
      cpu.set("PC", 0x0000);
      cpu.steps(10);

      const state = cpu.status();
      assert.equal(state.sp, 0xE000, "SP loaded with immediate 16-bit value");
    });
  });

  QUnit.module("Flag Edge Cases (for branch coverage)", () => {
    QUnit.test("INR with halfcarry flag (0x0F -> 0x10)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("B", 0x0F);
      mem[0x0000] = 0x04; // INR B
      cpu.set("PC", 0x0000);
      cpu.steps(5);

      const state = cpu.status();
      assert.equal(state.b, 0x10, "B = 0x10");
      assert.ok(state.f & 0x10, "Halfcarry flag set when low nibble overflows");
    });

    QUnit.test("DCR with halfcarry flag (0x10 -> 0x0F)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("C", 0x10);
      mem[0x0000] = 0x0D; // DCR C
      cpu.set("PC", 0x0000);
      cpu.steps(5);

      const state = cpu.status();
      assert.equal(state.c, 0x0F, "C = 0x0F");
      assert.ok(state.f & 0x10, "Halfcarry flag set when borrow from upper nibble");
    });

    QUnit.test("ADD with halfcarry (0x0F + 0x01)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x0F);
      cpu.set("B", 0x01);
      mem[0x0000] = 0x80; // ADD B
      cpu.set("PC", 0x0000);
      cpu.steps(4);

      const state = cpu.status();
      assert.equal(state.a, 0x10, "A = 0x10");
      assert.ok(state.f & 0x10, "Halfcarry flag set on nibble overflow");
    });

    QUnit.test("SUB with halfcarry (0x10 - 0x01)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x10);
      cpu.set("B", 0x01);
      mem[0x0000] = 0x90; // SUB B
      cpu.set("PC", 0x0000);
      cpu.steps(4);

      const state = cpu.status();
      assert.equal(state.a, 0x0F, "A = 0x0F");
      assert.ok(state.f & 0x10, "Halfcarry flag set on nibble borrow");
    });

    QUnit.test("ADC with carry and halfcarry", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x0E);
      cpu.set("B", 0x01);
      cpu.set("F", 0x01); // Set carry
      mem[0x0000] = 0x88; // ADC B
      cpu.set("PC", 0x0000);
      cpu.steps(4);

      const state = cpu.status();
      assert.equal(state.a, 0x10, "A = 0x0E + 0x01 + carry(1) = 0x10");
      assert.ok(state.f & 0x10, "Halfcarry flag set");
    });

    QUnit.test("SBB with borrow and halfcarry", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x10);
      cpu.set("B", 0x00);
      cpu.set("F", 0x01); // Set carry (borrow)
      mem[0x0000] = 0x98; // SBB B
      cpu.set("PC", 0x0000);
      cpu.steps(4);

      const state = cpu.status();
      assert.equal(state.a, 0x0F, "A = 0x10 - 0x00 - borrow(1) = 0x0F");
      assert.ok(state.f & 0x10, "Halfcarry flag set");
    });

    QUnit.test("AND with halfcarry flag behavior", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x08);
      cpu.set("B", 0x08);
      mem[0x0000] = 0xA0; // ANA B
      cpu.set("PC", 0x0000);
      cpu.steps(4);

      const state = cpu.status();
      assert.ok(state.f & 0x10, "Halfcarry set when both operands have bit 3 set");
    });

    QUnit.test("AND without halfcarry", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x04);
      cpu.set("B", 0x04);
      mem[0x0000] = 0xA0; // ANA B
      cpu.set("PC", 0x0000);
      cpu.steps(4);

      const state = cpu.status();
      assert.notOk(state.f & 0x10, "Halfcarry clear when bit 3 not set in operands");
    });

    QUnit.test("ADD overflow sets carry", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0xFF);
      cpu.set("B", 0x02);
      mem[0x0000] = 0x80; // ADD B
      cpu.set("PC", 0x0000);
      cpu.steps(4);

      const state = cpu.status();
      assert.equal(state.a, 0x01, "A wraps to 0x01");
      assert.ok(state.f & 0x01, "Carry flag set on 8-bit overflow");
    });

    QUnit.test("SUB underflow sets carry", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x00);
      cpu.set("B", 0x01);
      mem[0x0000] = 0x90; // SUB B
      cpu.set("PC", 0x0000);
      cpu.steps(4);

      const state = cpu.status();
      assert.equal(state.a, 0xFF, "A wraps to 0xFF");
      assert.ok(state.f & 0x01, "Carry flag set on underflow");
    });

    QUnit.test("DAD overflow sets carry", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("H", 0xFF);
      cpu.set("L", 0xFF);
      cpu.set("B", 0x00);
      cpu.set("C", 0x02);
      mem[0x0000] = 0x09; // DAD B
      cpu.set("PC", 0x0000);
      cpu.steps(11);

      const state = cpu.status();
      assert.equal(state.h, 0x00, "H wrapped to 0x00");
      assert.equal(state.l, 0x01, "L = 0x01");
      assert.ok(state.f & 0x01, "Carry flag set on 16-bit overflow");
    });
  });

  QUnit.module("Trace and Utilities (for coverage)", () => {
    QUnit.test("trace() enables execution tracing", (assert) => {
      const { cpu, mem } = createTestCPU();

      // Enable trace
      cpu.trace(true);

      mem[0x0000] = 0x00; // NOP
      cpu.set("PC", 0x0000);

      // This should trigger goTrace() which calls console.log
      cpu.steps(4);

      // Disable trace
      cpu.trace(false);

      const state = cpu.status();
      assert.equal(state.pc, 1, "Instruction executed with trace enabled");
    });

    QUnit.test("Unknown opcode handled gracefully", (assert) => {
      const { cpu, mem } = createTestCPU();

      // Use an opcode that's not implemented (like 0x08 - NOP duplicate)
      // These are handled by the default case
      mem[0x0000] = 0x08; // This is a NOP duplicate
      cpu.set("PC", 0x0000);
      cpu.steps(4);

      const state = cpu.status();
      assert.equal(state.pc, 1, "PC advanced for unknown/duplicate opcode");
      assert.equal(cpu.T(), 4, "Default case takes 4 cycles");
    });

    QUnit.test("init() method exists for compatibility", (assert) => {
      const { cpu } = createTestCPU();

      // init() is a no-op but should exist
      cpu.init();
      assert.ok(true, "init() method callable");
    });

    QUnit.test("memr() reads memory correctly", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1234] = 0x99;
      assert.equal(cpu.memr(0x1234), 0x99, "memr() reads memory byte");
    });
  });

  QUnit.module("Comprehensive Disassembler (for coverage)", () => {
    QUnit.test("Disassemble register MOV instructions", (assert) => {
      assert.deepEqual(disasm(0x40, 0, 0), ["MOV B,B", 1], "MOV B,B");
      assert.deepEqual(disasm(0x41, 0, 0), ["MOV B,C", 1], "MOV B,C");
      assert.deepEqual(disasm(0x7E, 0, 0), ["MOV A,M", 1], "MOV A,M");
    });

    QUnit.test("Disassemble arithmetic instructions", (assert) => {
      assert.deepEqual(disasm(0x80, 0, 0), ["ADD B", 1], "ADD B");
      assert.deepEqual(disasm(0x88, 0, 0), ["ADC B", 1], "ADC B");
      assert.deepEqual(disasm(0xC6, 0x42, 0), ["ADI $42", 2], "ADI");
      assert.deepEqual(disasm(0xCE, 0x10, 0), ["ACI $10", 2], "ACI");
    });

    QUnit.test("Disassemble SUB instructions", (assert) => {
      assert.deepEqual(disasm(0x90, 0, 0), ["SUB B", 1], "SUB B");
      assert.deepEqual(disasm(0x98, 0, 0), ["SBB B", 1], "SBB B");
      assert.deepEqual(disasm(0xD6, 0x20, 0), ["SUI $20", 2], "SUI");
      assert.deepEqual(disasm(0xDE, 0x15, 0), ["SBI $15", 2], "SBI");
    });

    QUnit.test("Disassemble logical instructions", (assert) => {
      assert.deepEqual(disasm(0xA0, 0, 0), ["ANA B", 1], "ANA B");
      assert.deepEqual(disasm(0xE6, 0xFF, 0), ["ANI $FF", 2], "ANI");
      assert.deepEqual(disasm(0xA8, 0, 0), ["XRA B", 1], "XRA B");
      assert.deepEqual(disasm(0xEE, 0x55, 0), ["XRI $55", 2], "XRI");
      assert.deepEqual(disasm(0xB0, 0, 0), ["ORA B", 1], "ORA B");
      assert.deepEqual(disasm(0xF6, 0xAA, 0), ["ORI $AA", 2], "ORI");
    });

    QUnit.test("Disassemble compare instructions", (assert) => {
      assert.deepEqual(disasm(0xB8, 0, 0), ["CMP B", 1], "CMP B");
      assert.deepEqual(disasm(0xFE, 0x30, 0), ["CPI $30", 2], "CPI");
    });

    QUnit.test("Disassemble jump instructions", (assert) => {
      assert.deepEqual(disasm(0xC2, 0x00, 0x10), ["JNZ $1000", 3], "JNZ");
      assert.deepEqual(disasm(0xD2, 0x00, 0x20), ["JNC $2000", 3], "JNC");
      assert.deepEqual(disasm(0xDA, 0x00, 0x30), ["JC $3000", 3], "JC");
      assert.deepEqual(disasm(0xE2, 0x00, 0x40), ["JPO $4000", 3], "JPO");
      assert.deepEqual(disasm(0xEA, 0x00, 0x50), ["JPE $5000", 3], "JPE");
      assert.deepEqual(disasm(0xF2, 0x00, 0x60), ["JP $6000", 3], "JP");
      assert.deepEqual(disasm(0xFA, 0x00, 0x70), ["JM $7000", 3], "JM");
    });

    QUnit.test("Disassemble call instructions", (assert) => {
      assert.deepEqual(disasm(0xCD, 0x00, 0x10), ["CALL $1000", 3], "CALL");
      assert.deepEqual(disasm(0xC4, 0x00, 0x20), ["CNZ $2000", 3], "CNZ");
      assert.deepEqual(disasm(0xCC, 0x00, 0x30), ["CZ $3000", 3], "CZ");
      assert.deepEqual(disasm(0xD4, 0x00, 0x40), ["CNC $4000", 3], "CNC");
      assert.deepEqual(disasm(0xDC, 0x00, 0x50), ["CC $5000", 3], "CC");
    });

    QUnit.test("Disassemble return instructions", (assert) => {
      assert.deepEqual(disasm(0xC9, 0, 0), ["RET", 1], "RET");
      assert.deepEqual(disasm(0xC0, 0, 0), ["RNZ", 1], "RNZ");
      assert.deepEqual(disasm(0xC8, 0, 0), ["RZ", 1], "RZ");
      assert.deepEqual(disasm(0xD0, 0, 0), ["RNC", 1], "RNC");
      assert.deepEqual(disasm(0xD8, 0, 0), ["RC", 1], "RC");
    });

    QUnit.test("Disassemble RST instructions", (assert) => {
      assert.deepEqual(disasm(0xC7, 0, 0), ["RST 0", 1], "RST 0");
      assert.deepEqual(disasm(0xCF, 0, 0), ["RST 1", 1], "RST 1");
      assert.deepEqual(disasm(0xD7, 0, 0), ["RST 2", 1], "RST 2");
      assert.deepEqual(disasm(0xDF, 0, 0), ["RST 3", 1], "RST 3");
      assert.deepEqual(disasm(0xE7, 0, 0), ["RST 4", 1], "RST 4");
      assert.deepEqual(disasm(0xEF, 0, 0), ["RST 5", 1], "RST 5");
      assert.deepEqual(disasm(0xF7, 0, 0), ["RST 6", 1], "RST 6");
      assert.deepEqual(disasm(0xFF, 0, 0), ["RST 7", 1], "RST 7");
    });

    QUnit.test("Disassemble stack operations", (assert) => {
      assert.deepEqual(disasm(0xC5, 0, 0), ["PUSH B", 1], "PUSH B");
      assert.deepEqual(disasm(0xD5, 0, 0), ["PUSH D", 1], "PUSH D");
      assert.deepEqual(disasm(0xE5, 0, 0), ["PUSH H", 1], "PUSH H");
      assert.deepEqual(disasm(0xF5, 0, 0), ["PUSH PSW", 1], "PUSH PSW");
      assert.deepEqual(disasm(0xC1, 0, 0), ["POP B", 1], "POP B");
      assert.deepEqual(disasm(0xD1, 0, 0), ["POP D", 1], "POP D");
      assert.deepEqual(disasm(0xE1, 0, 0), ["POP H", 1], "POP H");
      assert.deepEqual(disasm(0xF1, 0, 0), ["POP PSW", 1], "POP PSW");
    });

    QUnit.test("Disassemble special instructions", (assert) => {
      assert.deepEqual(disasm(0x76, 0, 0), ["HLT", 1], "HLT");
      assert.deepEqual(disasm(0x27, 0, 0), ["DAA", 1], "DAA");
      assert.deepEqual(disasm(0x2F, 0, 0), ["CMA", 1], "CMA");
      assert.deepEqual(disasm(0x37, 0, 0), ["STC", 1], "STC");
      assert.deepEqual(disasm(0x3F, 0, 0), ["CMC", 1], "CMC");
      assert.deepEqual(disasm(0xEB, 0, 0), ["XCHG", 1], "XCHG");
      assert.deepEqual(disasm(0xE3, 0, 0), ["XTHL", 1], "XTHL");
      assert.deepEqual(disasm(0xE9, 0, 0), ["PCHL", 1], "PCHL");
      assert.deepEqual(disasm(0xF9, 0, 0), ["SPHL", 1], "SPHL");
    });

    QUnit.test("Disassemble I/O instructions", (assert) => {
      assert.deepEqual(disasm(0xD3, 0x10, 0), ["OUT $10", 2], "OUT");
      assert.deepEqual(disasm(0xDB, 0x20, 0), ["IN $20", 2], "IN");
    });
  });
});
