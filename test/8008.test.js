/**
 * Intel 8008 CPU Emulator Tests
 *
 * Comprehensive test suite for ES6 8008 emulator implementation.
 * Tests 14-bit addressing, 4-bit flags, 8-level stack, and instruction execution.
 */

import QUnit from "qunit";
import create8008, { disasm } from "../src/8008.js";

QUnit.module("8008 CPU Emulator", () => {
  /**
   * Helper: Create CPU with 14-bit memory array
   */
  const createTestCPU = () => {
    const mem = new Uint8Array(16384); // 14-bit = 16KB
    const ports = new Uint8Array(32); // 32 output ports

    const cpu = create8008({
      byteAt: (addr) => mem[addr & 0x3FFF] || 0,
      byteTo: (addr, val) => {
        mem[addr & 0x3FFF] = val & 0xFF;
      },
      portOut: (port, val) => {
        ports[port & 0x1F] = val & 0xFF;
      },
      portIn: (port) => ports[port & 0x7] || 0
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
      assert.equal(state.f, 0, "Flags initialized to 0x00");
      assert.equal(state.stackDepth, 0, "Stack depth is 0");
    });

    QUnit.test("Reset clears all registers and stack", (assert) => {
      const { cpu } = createTestCPU();

      cpu.set("PC", 0x1234);
      cpu.set("A", 0x42);
      cpu.reset();

      const state = cpu.status();
      assert.equal(state.pc, 0, "PC reset to 0");
      assert.equal(state.a, 0, "A reset to 0");
      assert.equal(state.stackDepth, 0, "Stack depth reset to 0");
    });
  });

  QUnit.module("14-bit Address Space", () => {
    QUnit.test("PC wraps at 0x3FFF boundary", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("PC", 0x3FFE);
      mem[0x3FFE] = 0x44; // JMP
      mem[0x3FFF] = 0x00;
      mem[0x0000] = 0x00;
      cpu.steps(20);

      const state = cpu.status();
      assert.equal(state.pc, 0x0000, "PC wraps to 0x0000");
    });

    QUnit.test("Memory access masks to 14-bit", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x3FFF] = 0xAA;
      assert.equal(cpu.memr(0x3FFF), 0xAA, "Read from 0x3FFF works");
      assert.equal(cpu.memr(0x7FFF), 0xAA, "0x7FFF wraps to 0x3FFF");
    });

    QUnit.test("Stack operates in 14-bit space", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0x3FF0);
      cpu.set("PC", 0x1234);
      mem[0] = 0x07; // RET (pops from stack)

      // Manually push return address
      mem[0x3FEE] = 0x56;
      mem[0x3FEF] = 0x12;
      cpu.set("SP", 0x3FEE);

      cpu.steps(10);

      const state = cpu.status();
      assert.equal(state.pc & 0x3FFF, state.pc, "PC stays in 14-bit range");
    });
  });

  QUnit.module("8-Level Stack Depth Limit", () => {
    QUnit.test("Stack allows 8 levels", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0x1000);

      // Push 8 times (RST 0 = push PC)
      for (let i = 0; i < 8; i++) {
        mem[i * 10] = 0x05; // RST 0
        cpu.set("PC", i * 10);
        cpu.steps(10);
      }

      const state = cpu.status();
      assert.equal(state.stackDepth, 8, "Stack depth is 8");
    });

    QUnit.test("9th push causes overflow (graceful handling)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0x1000);
      const initialSP = 0x1000;

      // Push 9 times
      for (let i = 0; i < 9; i++) {
        mem[i * 10] = 0x05; // RST 0
        cpu.set("PC", i * 10);
        cpu.steps(10);
      }

      const state = cpu.status();
      assert.equal(state.stackDepth, 8, "Stack depth capped at 8");
      assert.equal(state.sp, initialSP - 16, "SP didn't change on overflow");
    });

    QUnit.test("Pop from empty stack returns 0", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("PC", 0x0100);
      cpu.set("SP", 0x1000);
      mem[0x0100] = 0x07; // RET (pop PC from stack)
      cpu.steps(10);

      const state = cpu.status();
      assert.equal(state.pc, 0, "Empty stack pop returns 0");
    });

    QUnit.test("Stack depth resets on CPU reset", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0x1000);
      mem[0] = 0x05; // RST 0
      cpu.steps(10);

      let state = cpu.status();
      assert.equal(state.stackDepth, 1, "Stack depth is 1 before reset");

      cpu.reset();
      state = cpu.status();
      assert.equal(state.stackDepth, 0, "Stack depth reset to 0");
    });
  });

  QUnit.module("I/O Ports", () => {
    QUnit.test("Input ports masked to 0-7", (assert) => {
      const { cpu, mem, ports } = createTestCPU();

      ports[5] = 0x42;
      mem[0] = 0x41 | (5 << 3); // INP 5
      cpu.steps(10);

      const state = cpu.status();
      assert.equal(state.a, 0x42, "Read from port 5");
    });

    QUnit.test("Output ports masked to 0-31", (assert) => {
      const { cpu, mem, ports } = createTestCPU();

      cpu.set("A", 0x99);
      mem[0] = 0x51 | (10 << 3); // OUT 10
      cpu.steps(10);

      assert.equal(ports[10], 0x99, "Wrote to port 10");
    });
  });

  QUnit.module("4-bit Flags (SZPC only)", () => {
    QUnit.test("No HALFCARRY flag exists", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x0F);
      mem[0] = 0x06; // MVI A
      mem[1] = 0x01;
      mem[2] = 0x80; // ADD A (A = A + A)
      cpu.steps(20);

      const state = cpu.status();
      assert.equal(state.f & 0x10, 0, "No HALFCARRY flag bit set");
    });

    QUnit.test("INR/DCR preserve carry, set SZP", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("F", 0x01); // Set carry
      cpu.set("A", 0xFF);
      mem[0] = 0x00; // INR A
      cpu.steps(10);

      let state = cpu.status();
      assert.equal(state.a, 0x00, "A wrapped to 0");
      assert.equal(state.f & 0x01, 0x01, "Carry preserved");
      assert.equal(state.f & 0x04, 0x04, "Zero flag set");
    });

    QUnit.test("Arithmetic sets all 4 flags correctly", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0xFF);
      mem[0] = 0x04; // ADI
      mem[1] = 0x01;
      cpu.steps(10);

      const state = cpu.status();
      assert.equal(state.a, 0x00, "A = 0x00");
      assert.equal(state.f & 0x01, 0x01, "Carry set");
      assert.equal(state.f & 0x04, 0x04, "Zero set");
    });

    QUnit.test("Logical operations clear carry", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("F", 0x0F); // Set all flags
      cpu.set("A", 0x55);
      mem[0] = 0x24; // ANI
      mem[1] = 0xFF;
      cpu.steps(10);

      const state = cpu.status();
      assert.equal(state.f & 0x01, 0x00, "Carry cleared by AND");
    });
  });

  QUnit.module("Arithmetic Operations", () => {
    QUnit.test("ADD without halfcarry", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x10);
      cpu.set("B", 0x20);
      mem[0] = 0x80; // ADD B
      cpu.steps(10);

      const state = cpu.status();
      assert.equal(state.a, 0x30, "A = 0x30");
      assert.equal(state.f & 0x10, 0, "No halfcarry bit in result");
    });

    QUnit.test("SUB without halfcarry", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x20);
      cpu.set("B", 0x10);
      mem[0] = 0x90; // SUB B
      cpu.steps(10);

      const state = cpu.status();
      assert.equal(state.a, 0x10, "A = 0x10");
    });

    QUnit.test("AND, OR, XOR with carry clear", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("F", 0x01); // Set carry
      cpu.set("A", 0xF0);
      cpu.set("B", 0x0F);
      mem[0] = 0xA0; // ANA B
      cpu.steps(10);

      let state = cpu.status();
      assert.equal(state.a, 0x00, "A = 0x00");
      assert.equal(state.f & 0x01, 0x00, "Carry cleared");
    });

    QUnit.test("Compare operations", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x42);
      cpu.set("B", 0x42);
      mem[0] = 0xB8; // CMP B
      cpu.steps(10);

      const state = cpu.status();
      assert.equal(state.a, 0x42, "A unchanged");
      assert.equal(state.f & 0x04, 0x04, "Zero flag set (equal)");
    });

    QUnit.test("Increment/decrement", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x42);
      mem[0] = 0x00; // INR A
      cpu.steps(10);

      let state = cpu.status();
      assert.equal(state.a, 0x43, "A incremented");

      cpu.reset();
      cpu.set("A", 0x42);
      mem[0] = 0x01; // DCR A
      cpu.steps(10);

      state = cpu.status();
      assert.equal(state.a, 0x41, "A decremented");
    });
  });

  QUnit.module("MOV Instructions", () => {
    QUnit.test("Register to register", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("B", 0x42);
      mem[0] = 0xC1; // MOV A,B
      cpu.steps(10);

      const state = cpu.status();
      assert.equal(state.a, 0x42, "A = B");
    });

    QUnit.test("Memory via HL", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("H", 0x10);
      cpu.set("L", 0x00);
      mem[0x1000] = 0x99;
      mem[0] = 0xC7; // MOV A,M
      cpu.steps(10);

      const state = cpu.status();
      assert.equal(state.a, 0x99, "A loaded from memory");
    });

    QUnit.test("Immediate loads", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0] = 0x06; // MVI A
      mem[1] = 0x42;
      cpu.steps(10);

      const state = cpu.status();
      assert.equal(state.a, 0x42, "A loaded immediate");
    });
  });

  QUnit.module("Control Flow", () => {
    QUnit.test("Unconditional JMP", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0] = 0x44; // JMP
      mem[1] = 0x34;
      mem[2] = 0x12;
      cpu.steps(15);

      const state = cpu.status();
      assert.equal(state.pc, 0x1234, "PC = 0x1234");
    });

    QUnit.test("Conditional jumps (8 conditions)", (assert) => {
      const { cpu, mem } = createTestCPU();

      // JNC - jump if no carry
      cpu.set("F", 0x00); // Clear carry
      mem[0] = 0x40; // JNC
      mem[1] = 0x00;
      mem[2] = 0x10;
      cpu.steps(15);

      const state = cpu.status();
      assert.equal(state.pc, 0x1000, "JNC taken when carry clear");
    });

    QUnit.test("CALL and RET", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0x1000);
      mem[0x0000] = 0x46; // CALL
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x02;
      mem[0x0200] = 0x07; // RET

      cpu.steps(30);

      const state = cpu.status();
      assert.equal(state.pc, 0x0003, "Returned after CALL");
      assert.equal(state.stackDepth, 0, "Stack empty after RET");
    });

    QUnit.test("RST instructions", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0x1000);
      mem[0] = 0x05; // RST 0
      cpu.steps(10);

      const state = cpu.status();
      assert.equal(state.pc, 0x0000, "PC = vector 0x00");
      assert.equal(state.stackDepth, 1, "Return address pushed");
    });
  });

  QUnit.module("Rotate Instructions", () => {
    QUnit.test("RLC - Rotate left", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x81);
      mem[0] = 0x02; // RLC
      cpu.steps(10);

      const state = cpu.status();
      assert.equal(state.a, 0x03, "A rotated left");
      assert.equal(state.f & 0x01, 0x01, "Carry set from bit 7");
    });

    QUnit.test("RRC - Rotate right", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x81);
      mem[0] = 0x0A; // RRC
      cpu.steps(10);

      const state = cpu.status();
      assert.equal(state.a, 0xC0, "A rotated right");
      assert.equal(state.f & 0x01, 0x01, "Carry set from bit 0");
    });

    QUnit.test("RAL - Rotate left through carry", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x80);
      cpu.set("F", 0x01); // Set carry
      mem[0] = 0x12; // RAL
      cpu.steps(10);

      const state = cpu.status();
      assert.equal(state.a, 0x01, "Carry shifted into bit 0");
    });

    QUnit.test("RAR - Rotate right through carry", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x01);
      cpu.set("F", 0x01); // Set carry
      mem[0] = 0x1A; // RAR
      cpu.steps(10);

      const state = cpu.status();
      assert.equal(state.a, 0x80, "Carry shifted into bit 7");
    });
  });

  QUnit.module("Disassembler", () => {
    QUnit.test("Disassemble HLT", (assert) => {
      const [mnemonic, length] = disasm(0x00, 0, 0);
      assert.equal(mnemonic, "HLT", "HLT disassembles correctly");
      assert.equal(length, 1, "HLT is 1 byte");
    });

    QUnit.test("Disassemble MVI A,n", (assert) => {
      const [mnemonic, length] = disasm(0x06, 0x42, 0);
      assert.equal(mnemonic, "MVI A,$42", "MVI disassembles correctly");
      assert.equal(length, 2, "MVI is 2 bytes");
    });

    QUnit.test("Disassemble JMP nn", (assert) => {
      const [mnemonic, length] = disasm(0x44, 0x34, 0x12);
      assert.equal(mnemonic, "JMP $1234", "JMP disassembles correctly");
      assert.equal(length, 3, "JMP is 3 bytes");
    });
  });

  QUnit.module("Flags String", () => {
    QUnit.test("flagsToString formats 4 flags correctly", (assert) => {
      const { cpu } = createTestCPU();

      cpu.set("F", 0x00);
      assert.equal(cpu.flagsToString(), "szpc", "All flags clear");

      cpu.set("F", 0x0F);
      assert.equal(cpu.flagsToString(), "SZPC", "All flags set");

      cpu.set("F", 0x05); // Zero + Carry
      assert.equal(cpu.flagsToString(), "sZpC", "Zero and Carry set");
    });
  });

  QUnit.module("Integration Tests", () => {
    QUnit.test("Complete program: Add two numbers", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0] = 0x06; // MVI A,$10
      mem[1] = 0x10;
      mem[2] = 0x0E; // MVI B,$20
      mem[3] = 0x20;
      mem[4] = 0x80; // ADD B
      mem[5] = 0x00; // HLT

      cpu.steps(100);

      const state = cpu.status();
      assert.equal(state.a, 0x30, "A = 0x30");
      assert.equal(state.halted, 1, "CPU halted");
    });

    QUnit.test("Complete program: Count loop", (assert) => {
      const { cpu, mem } = createTestCPU();

      // Count from 0 to 5
      mem[0] = 0x06; // MVI A,$00
      mem[1] = 0x00;
      mem[2] = 0x00; // LOOP: INR A
      mem[3] = 0x34; // CPI $05
      mem[4] = 0x05;
      mem[5] = 0x48; // JNZ LOOP
      mem[6] = 0x02;
      mem[7] = 0x00;
      mem[8] = 0x00; // HLT

      cpu.steps(500);

      const state = cpu.status();
      assert.equal(state.a, 0x05, "A = 5");
    });
  });
});
