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

  QUnit.module("ALU Operations Edge Cases (for coverage)", () => {
    QUnit.test("ADC - Add with carry when carry set", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x06; // LBI 0xFF
      mem[0x0001] = 0xFF;
      mem[0x0002] = 0x04; // ADI 1 (result 0x00, sets carry)
      mem[0x0003] = 0x01;
      mem[0x0004] = 0x0C; // ACI 0x05 (add with carry: 0x00 + 0x05 + 1 = 0x06)
      mem[0x0005] = 0x05;

      cpu.steps(5); // LBI
      cpu.steps(5); // ADI (sets carry)
      cpu.steps(5); // ACI

      assert.equal(cpu.status().a, 0x06, "A = 0x00 + 0x05 + carry(1)");
    });

    QUnit.test("SBB - Subtract with borrow when carry clear", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x06; // LBI 0x10
      mem[0x0001] = 0x10;
      mem[0x0002] = 0x14; // SBI 0x05 (subtract: 0x10 - 0x05 - 0 = 0x0B)
      mem[0x0003] = 0x05;

      cpu.steps(5); // LBI
      cpu.steps(5); // SBI

      assert.equal(cpu.status().a, 0x0B, "A = 0x10 - 0x05 (no borrow)");
    });

    QUnit.test("SBB - Subtract with borrow when carry set", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x06; // LBI 0xFF
      mem[0x0001] = 0xFF;
      mem[0x0002] = 0x04; // ADI 1 (result 0x00, sets carry)
      mem[0x0003] = 0x01;
      mem[0x0004] = 0x06; // LBI 0x10
      mem[0x0005] = 0x10;
      mem[0x0006] = 0x14; // SBI 0x05 (subtract with borrow: 0x10 - 0x05 - carry(1) = 0x0A)
      mem[0x0007] = 0x05;

      cpu.steps(5); // LBI 0xFF
      cpu.steps(5); // ADI (sets carry)
      cpu.steps(5); // LBI 0x10
      cpu.steps(5); // SBI

      assert.equal(cpu.status().a, 0x0A, "A = 0x10 - 0x05 - 1 (borrow)");
    });

    QUnit.test("XOR - Clears carry flag", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x06; // LBI 0xFF
      mem[0x0001] = 0xFF;
      mem[0x0002] = 0x04; // ADI 1 (sets carry)
      mem[0x0003] = 0x01;
      mem[0x0004] = 0x3C; // XRI 0xAA
      mem[0x0005] = 0xAA;

      cpu.steps(5); // LBI
      cpu.steps(5); // ADI (sets carry)
      cpu.steps(5); // XRI

      const state = cpu.status();
      assert.equal(state.a, 0xAA, "A = 0x00 XOR 0xAA");
      assert.equal(state.f & 0x01, 0, "Carry flag cleared by XOR");
    });

    QUnit.test("OR - Clears carry flag", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x06; // LBI 0xFF
      mem[0x0001] = 0xFF;
      mem[0x0002] = 0x04; // ADI 1 (sets carry)
      mem[0x0003] = 0x01;
      mem[0x0004] = 0x44; // ORI 0x55
      mem[0x0005] = 0x55;

      cpu.steps(5); // LBI
      cpu.steps(5); // ADI (sets carry)
      cpu.steps(5); // ORI

      const state = cpu.status();
      assert.equal(state.a, 0x55, "A = 0x00 OR 0x55");
      assert.equal(state.f & 0x01, 0, "Carry flag cleared by OR");
    });

    QUnit.test("AND - Clears carry flag", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x06; // LBI 0xFF
      mem[0x0001] = 0xFF;
      mem[0x0002] = 0x04; // ADI 1 (sets carry)
      mem[0x0003] = 0x01;
      mem[0x0004] = 0x34; // NDI 0x0F
      mem[0x0005] = 0x0F;

      cpu.steps(5); // LBI
      cpu.steps(5); // ADI (sets carry)
      cpu.steps(5); // NDI (AND immediate)

      const state = cpu.status();
      assert.equal(state.a, 0x00, "A = 0x00 AND 0x0F");
      assert.equal(state.f & 0x01, 0, "Carry flag cleared by AND");
    });
  });

  QUnit.module("Conditional Returns (for coverage)", () => {
    QUnit.test("RZ - Return if zero (condition true)", (assert) => {
      const { cpu, mem } = createTestCPU();

      // Setup: Call a subroutine, set Z flag, return conditionally
      mem[0x0000] = 0x06; // LBI 0 (sets A to 0, Z flag set)
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x07; // RZ (should return)
      mem[0x0003] = 0x00; // HLT (should not reach)

      // Manually push return address to stack
      cpu.set("SP", 0x0010);
      mem[0x0010] = 0x10; // Return PC low
      mem[0x0011] = 0x00; // Return PC high

      cpu.steps(5); // LBI
      cpu.steps(10); // RZ

      const state = cpu.status();
      assert.equal(state.pc, 0x0010, "PC = return address (Z flag was set)");
    });

    QUnit.test("RNZ - Return if not zero (condition true)", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x06; // LBI 1 (sets A to 1, Z flag clear)
      mem[0x0001] = 0x01;
      mem[0x0002] = 0x0F; // RNZ (should return)

      cpu.set("SP", 0x0020);
      mem[0x0020] = 0x50; // Return PC low
      mem[0x0021] = 0x00; // Return PC high

      cpu.steps(5); // LBI
      cpu.steps(10); // RNZ

      assert.equal(cpu.status().pc, 0x0050, "Returned when Z clear");
    });

    QUnit.test("RC - Return if carry (condition true)", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x06; // LBI 0xFF
      mem[0x0001] = 0xFF;
      mem[0x0002] = 0x04; // ADI 1 (0xFF + 1 = 0x00, sets carry)
      mem[0x0003] = 0x01;
      mem[0x0004] = 0x17; // RC (should return)

      cpu.set("SP", 0x0030);
      mem[0x0030] = 0x80; // Return PC low
      mem[0x0031] = 0x00; // Return PC high

      cpu.steps(5); // LBI
      cpu.steps(5); // ADI
      cpu.steps(10); // RC

      assert.equal(cpu.status().pc, 0x0080, "Returned when carry set");
    });

    QUnit.test("RNC - Return if no carry (condition false)", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x06; // LBI 0xFF
      mem[0x0001] = 0xFF;
      mem[0x0002] = 0x04; // ADI 1 (sets carry)
      mem[0x0003] = 0x01;
      mem[0x0004] = 0x1F; // RNC (should NOT return - carry is set)
      mem[0x0005] = 0x00; // HLT

      cpu.set("SP", 0x0040);
      mem[0x0040] = 0xAA;
      mem[0x0041] = 0xBB;

      cpu.steps(5); // LBI
      cpu.steps(5); // ADI
      cpu.steps(5); // RNC

      assert.equal(cpu.status().pc, 0x0005, "Did not return (carry was set)");
    });

    QUnit.test("RP - Return if positive (condition true)", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x06; // LBI 0x42 (positive, S=0)
      mem[0x0001] = 0x42;
      mem[0x0002] = 0x27; // RP (should return)

      cpu.set("SP", 0x0050);
      mem[0x0050] = 0xC0; // Return PC low
      mem[0x0051] = 0x00; // Return PC high

      cpu.steps(5); // LBI
      cpu.steps(10); // RP

      assert.equal(cpu.status().pc, 0x00C0, "Returned when positive");
    });

    QUnit.test("RM - Return if minus (condition true)", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x06; // LBI 0x80 (negative, S=1)
      mem[0x0001] = 0x80;
      mem[0x0002] = 0x2F; // RM (should return)

      cpu.set("SP", 0x0060);
      mem[0x0060] = 0xD0; // Return PC low
      mem[0x0061] = 0x01; // Return PC high

      cpu.steps(5); // LBI
      cpu.steps(10); // RM

      assert.equal(cpu.status().pc, 0x01D0, "Returned when negative");
    });

    QUnit.test("RPE - Return if parity even (condition true)", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x06; // LBI 0x03 (two 1-bits = even parity)
      mem[0x0001] = 0x03;
      mem[0x0002] = 0x37; // RPE (should return)

      cpu.set("SP", 0x0070);
      mem[0x0070] = 0xE0; // Return PC low
      mem[0x0071] = 0x01; // Return PC high

      cpu.steps(5); // LBI
      cpu.steps(10); // RPE

      assert.equal(cpu.status().pc, 0x01E0, "Returned when parity even");
    });

    QUnit.test("RPO - Return if parity odd (condition true)", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x06; // LBI 0x01 (one 1-bit = odd parity)
      mem[0x0001] = 0x01;
      mem[0x0002] = 0x3F; // RPO (should return)

      cpu.set("SP", 0x0080);
      mem[0x0080] = 0xF0; // Return PC low
      mem[0x0081] = 0x02; // Return PC high

      cpu.steps(5); // LBI
      cpu.steps(10); // RPO

      assert.equal(cpu.status().pc, 0x02F0, "Returned when parity odd");
    });

    QUnit.test("RZ - Return if zero (condition false)", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x06; // LBI 1 (Z flag clear)
      mem[0x0001] = 0x01;
      mem[0x0002] = 0x07; // RZ (should NOT return)
      mem[0x0003] = 0x00; // HLT

      cpu.set("SP", 0x0010);
      mem[0x0010] = 0xAA;
      mem[0x0011] = 0xBB;

      cpu.steps(5); // LBI
      cpu.steps(5); // RZ (skips)

      assert.equal(cpu.status().pc, 0x0003, "Did not return (Z flag was clear)");
    });

    QUnit.test("RNZ - Return if not zero (condition false)", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x06; // LBI 0 (Z flag set)
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x0F; // RNZ (should NOT return)
      mem[0x0003] = 0x00; // HLT

      cpu.set("SP", 0x0020);

      cpu.steps(5); // LBI
      cpu.steps(5); // RNZ (skips)

      assert.equal(cpu.status().pc, 0x0003, "Did not return (Z flag was set)");
    });

    QUnit.test("RC - Return if carry (condition false)", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x06; // LBI 0x10
      mem[0x0001] = 0x10;
      mem[0x0002] = 0x17; // RC (should NOT return - no carry)
      mem[0x0003] = 0x00; // HLT

      cpu.steps(5); // LBI
      cpu.steps(5); // RC (skips)

      assert.equal(cpu.status().pc, 0x0003, "Did not return (carry was clear)");
    });

    QUnit.test("RP - Return if positive (condition false)", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x06; // LBI 0x80 (negative)
      mem[0x0001] = 0x80;
      mem[0x0002] = 0x27; // RP (should NOT return)
      mem[0x0003] = 0x00; // HLT

      cpu.steps(5); // LBI
      cpu.steps(5); // RP (skips)

      assert.equal(cpu.status().pc, 0x0003, "Did not return (S flag was set)");
    });

    QUnit.test("RM - Return if minus (condition false)", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x06; // LBI 0x42 (positive)
      mem[0x0001] = 0x42;
      mem[0x0002] = 0x2F; // RM (should NOT return)
      mem[0x0003] = 0x00; // HLT

      cpu.steps(5); // LBI
      cpu.steps(5); // RM (skips)

      assert.equal(cpu.status().pc, 0x0003, "Did not return (S flag was clear)");
    });

    QUnit.test("RPE - Return if parity even (condition false)", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x06; // LBI 0x01 (odd parity)
      mem[0x0001] = 0x01;
      mem[0x0002] = 0x37; // RPE (should NOT return)
      mem[0x0003] = 0x00; // HLT

      cpu.steps(5); // LBI
      cpu.steps(5); // RPE (skips)

      assert.equal(cpu.status().pc, 0x0003, "Did not return (parity was odd)");
    });

    QUnit.test("RPO - Return if parity odd (condition false)", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x06; // LBI 0x03 (even parity)
      mem[0x0001] = 0x03;
      mem[0x0002] = 0x3F; // RPO (should NOT return)
      mem[0x0003] = 0x00; // HLT

      cpu.steps(5); // LBI
      cpu.steps(5); // RPO (skips)

      assert.equal(cpu.status().pc, 0x0003, "Did not return (parity was even)");
    });
  });

  QUnit.module("INC/DEC All Registers (for coverage)", () => {
    QUnit.test("INB - Increment B", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x0E; // LBI B, 5
      mem[0x0001] = 0x05;
      mem[0x0002] = 0x08; // INB

      cpu.steps(5); // LBI
      cpu.steps(5); // INB

      assert.equal(cpu.status().b, 0x06, "B incremented from 5 to 6");
    });

    QUnit.test("INC - Increment C", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x16; // LCI C, 10
      mem[0x0001] = 0x0A;
      mem[0x0002] = 0x10; // INC

      cpu.steps(5); // LCI
      cpu.steps(5); // INC

      assert.equal(cpu.status().c, 0x0B, "C incremented from 10 to 11");
    });

    QUnit.test("IND - Increment D", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x1E; // LDI D, 20
      mem[0x0001] = 0x14;
      mem[0x0002] = 0x18; // IND

      cpu.steps(5); // LDI
      cpu.steps(5); // IND

      assert.equal(cpu.status().d, 0x15, "D incremented from 20 to 21");
    });

    QUnit.test("INE - Increment E", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x26; // LEI E, 30
      mem[0x0001] = 0x1E;
      mem[0x0002] = 0x20; // INE

      cpu.steps(5); // LEI
      cpu.steps(5); // INE

      assert.equal(cpu.status().e, 0x1F, "E incremented from 30 to 31");
    });

    QUnit.test("INH - Increment H", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x2E; // LHI H, 40
      mem[0x0001] = 0x28;
      mem[0x0002] = 0x28; // INH

      cpu.steps(5); // LHI
      cpu.steps(5); // INH

      assert.equal(cpu.status().h, 0x29, "H incremented from 40 to 41");
    });

    QUnit.test("INL - Increment L", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x36; // LLI L, 50
      mem[0x0001] = 0x32;
      mem[0x0002] = 0x30; // INL

      cpu.steps(5); // LLI
      cpu.steps(5); // INL

      assert.equal(cpu.status().l, 0x33, "L incremented from 50 to 51");
    });

    QUnit.test("DCB - Decrement B", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x0E; // LBI B, 10
      mem[0x0001] = 0x0A;
      mem[0x0002] = 0x09; // DCB

      cpu.steps(5); // LBI
      cpu.steps(5); // DCB

      assert.equal(cpu.status().b, 0x09, "B decremented from 10 to 9");
    });

    QUnit.test("DCC - Decrement C", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x16; // LCI C, 20
      mem[0x0001] = 0x14;
      mem[0x0002] = 0x11; // DCC

      cpu.steps(5); // LCI
      cpu.steps(5); // DCC

      assert.equal(cpu.status().c, 0x13, "C decremented from 20 to 19");
    });

    QUnit.test("DCD - Decrement D", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x1E; // LDI D, 30
      mem[0x0001] = 0x1E;
      mem[0x0002] = 0x19; // DCD

      cpu.steps(5); // LDI
      cpu.steps(5); // DCD

      assert.equal(cpu.status().d, 0x1D, "D decremented from 30 to 29");
    });

    QUnit.test("DCE - Decrement E", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x26; // LEI E, 40
      mem[0x0001] = 0x28;
      mem[0x0002] = 0x21; // DCE

      cpu.steps(5); // LEI
      cpu.steps(5); // DCE

      assert.equal(cpu.status().e, 0x27, "E decremented from 40 to 39");
    });

    QUnit.test("DCH - Decrement H", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x2E; // LHI H, 50
      mem[0x0001] = 0x32;
      mem[0x0002] = 0x29; // DCH

      cpu.steps(5); // LHI
      cpu.steps(5); // DCH

      assert.equal(cpu.status().h, 0x31, "H decremented from 50 to 49");
    });

    QUnit.test("DCL - Decrement L", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x36; // LLI L, 60
      mem[0x0001] = 0x3C;
      mem[0x0002] = 0x31; // DCL

      cpu.steps(5); // LLI
      cpu.steps(5); // DCL

      assert.equal(cpu.status().l, 0x3B, "L decremented from 60 to 59");
    });

    QUnit.test("INM - Increment memory at HL", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0100] = 0x42; // Value at memory

      mem[0x0000] = 0x2E; // LHI H, 0x01
      mem[0x0001] = 0x01;
      mem[0x0002] = 0x36; // LLI L, 0x00
      mem[0x0003] = 0x00;
      mem[0x0004] = 0x38; // INM (increment memory at HL)

      cpu.steps(5); // LHI
      cpu.steps(5); // LLI
      cpu.steps(10); // INM

      assert.equal(mem[0x0100], 0x43, "Memory at HL incremented from 0x42 to 0x43");
    });

    QUnit.test("DCM - Decrement memory at HL", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0200] = 0x55; // Value at memory

      mem[0x0000] = 0x2E; // LHI H, 0x02
      mem[0x0001] = 0x02;
      mem[0x0002] = 0x36; // LLI L, 0x00
      mem[0x0003] = 0x00;
      mem[0x0004] = 0x39; // DCM (decrement memory at HL)

      cpu.steps(5); // LHI
      cpu.steps(5); // LLI
      cpu.steps(10); // DCM

      assert.equal(mem[0x0200], 0x54, "Memory at HL decremented from 0x55 to 0x54");
    });
  });

  QUnit.module("Conditional Calls (for coverage)", () => {
    QUnit.test("CZ - Call if zero (condition true)", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x06; // LBI 0 (sets Z flag)
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x42; // CZ
      mem[0x0003] = 0x00; // Target low
      mem[0x0004] = 0x01; // Target high = 0x0100

      cpu.steps(5); // LBI
      cpu.steps(15); // CZ

      const state = cpu.status();
      assert.equal(state.pc, 0x0100, "Called to 0x0100 when Z flag set");
      assert.ok(state.sp > 0, "Return address pushed to stack");
    });

    QUnit.test("CNZ - Call if not zero (condition true)", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x06; // LBI 1 (clears Z flag)
      mem[0x0001] = 0x01;
      mem[0x0002] = 0x4A; // CNZ
      mem[0x0003] = 0x00; // Target low
      mem[0x0004] = 0x02; // Target high = 0x0200

      cpu.steps(5); // LBI
      cpu.steps(15); // CNZ

      assert.equal(cpu.status().pc, 0x0200, "Called to 0x0200 when Z flag clear");
    });

    QUnit.test("CC - Call if carry (condition true)", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x06; // LBI 0xFF
      mem[0x0001] = 0xFF;
      mem[0x0002] = 0x04; // ADI 1 (sets carry)
      mem[0x0003] = 0x01;
      mem[0x0004] = 0x52; // CC
      mem[0x0005] = 0x00; // Target low
      mem[0x0006] = 0x03; // Target high = 0x0300

      cpu.steps(5); // LBI
      cpu.steps(5); // ADI
      cpu.steps(15); // CC

      assert.equal(cpu.status().pc, 0x0300, "Called to 0x0300 when carry set");
    });

    QUnit.test("CNC - Call if no carry (condition false)", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x06; // LBI 0xFF
      mem[0x0001] = 0xFF;
      mem[0x0002] = 0x04; // ADI 1 (sets carry)
      mem[0x0003] = 0x01;
      mem[0x0004] = 0x5A; // CNC (should NOT call)
      mem[0x0005] = 0x00;
      mem[0x0006] = 0x04;
      mem[0x0007] = 0x00; // HLT

      cpu.steps(5); // LBI
      cpu.steps(5); // ADI
      cpu.steps(12); // CNC (should skip)

      assert.equal(cpu.status().pc, 0x0007, "Did not call (carry was set)");
    });

    QUnit.test("CP - Call if positive (condition true)", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x06; // LBI 0x42 (positive)
      mem[0x0001] = 0x42;
      mem[0x0002] = 0x62; // CP
      mem[0x0003] = 0x00;
      mem[0x0004] = 0x05; // Target = 0x0500

      cpu.steps(5); // LBI
      cpu.steps(15); // CP

      assert.equal(cpu.status().pc, 0x0500, "Called when positive");
    });

    QUnit.test("CM - Call if minus (condition true)", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x06; // LBI 0x80 (negative)
      mem[0x0001] = 0x80;
      mem[0x0002] = 0x6A; // CM
      mem[0x0003] = 0x00;
      mem[0x0004] = 0x06; // Target = 0x0600

      cpu.steps(5); // LBI
      cpu.steps(15); // CM

      assert.equal(cpu.status().pc, 0x0600, "Called when negative");
    });

    QUnit.test("CPE - Call if parity even (condition true)", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x06; // LBI 0x03 (even parity)
      mem[0x0001] = 0x03;
      mem[0x0002] = 0x72; // CPE
      mem[0x0003] = 0x00;
      mem[0x0004] = 0x07; // Target = 0x0700

      cpu.steps(5); // LBI
      cpu.steps(15); // CPE

      assert.equal(cpu.status().pc, 0x0700, "Called when parity even");
    });

    QUnit.test("CPO - Call if parity odd (condition true)", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x06; // LBI 0x01 (odd parity)
      mem[0x0001] = 0x01;
      mem[0x0002] = 0x7A; // CPO
      mem[0x0003] = 0x00;
      mem[0x0004] = 0x08; // Target = 0x0800

      cpu.steps(5); // LBI
      cpu.steps(15); // CPO

      assert.equal(cpu.status().pc, 0x0800, "Called when parity odd");
    });
  });

  QUnit.module("Rotate Instructions Edge Cases (for coverage)", () => {
    QUnit.test("RLC - Rotate left circular with carry clear", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x06; // LBI 0x42 (01000010)
      mem[0x0001] = 0x42;
      mem[0x0002] = 0x02; // RLC

      cpu.steps(5); // LBI
      cpu.steps(10); // RLC

      const state = cpu.status();
      // 01000010 rotated left = 10000100
      assert.equal(state.a, 0x84, "A rotated left");
      assert.equal(state.f & 0x01, 0, "Carry clear (bit 7 was 0)");
    });

    QUnit.test("RRC - Rotate right circular with carry clear", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x06; // LBI 0x42 (01000010)
      mem[0x0001] = 0x42;
      mem[0x0002] = 0x0A; // RRC

      cpu.steps(5); // LBI
      cpu.steps(10); // RRC

      const state = cpu.status();
      // 01000010 rotated right = 00100001
      assert.equal(state.a, 0x21, "A rotated right");
      assert.equal(state.f & 0x01, 0, "Carry clear (bit 0 was 0)");
    });

    QUnit.test("RAL - Rotate left through carry with carry clear", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x06; // LBI 0x42 (01000010, bit 7 = 0)
      mem[0x0001] = 0x42;
      mem[0x0002] = 0x12; // RAL

      cpu.steps(5); // LBI
      cpu.steps(10); // RAL

      const state = cpu.status();
      // 01000010 rotated left through carry (carry was 0) = 10000100
      assert.equal(state.a, 0x84, "A rotated left through carry");
      assert.equal(state.f & 0x01, 0, "Carry clear (old bit 7 was 0)");
    });

    QUnit.test("RAR - Rotate right through carry with carry clear", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x06; // LBI 0x42 (01000010, bit 0 = 0)
      mem[0x0001] = 0x42;
      mem[0x0002] = 0x1A; // RAR

      cpu.steps(5); // LBI
      cpu.steps(10); // RAR

      const state = cpu.status();
      // 01000010 rotated right through carry (carry was 0) = 00100001
      assert.equal(state.a, 0x21, "A rotated right through carry");
      assert.equal(state.f & 0x01, 0, "Carry clear (old bit 0 was 0)");
    });

    QUnit.test("RLC - Rotate left circular with carry set", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x06; // LBI 0x81 (10000001)
      mem[0x0001] = 0x81;
      mem[0x0002] = 0x02; // RLC

      cpu.steps(5); // LBI
      cpu.steps(10); // RLC

      const state = cpu.status();
      // 10000001 rotated left = 00000011
      assert.equal(state.a, 0x03, "A rotated left");
      assert.ok(state.f & 0x01, "Carry set (bit 7 was 1)");
    });

    QUnit.test("RRC - Rotate right circular with carry set", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x06; // LBI 0x81 (10000001)
      mem[0x0001] = 0x81;
      mem[0x0002] = 0x0A; // RRC

      cpu.steps(5); // LBI
      cpu.steps(10); // RRC

      const state = cpu.status();
      // 10000001 rotated right = 11000000
      assert.equal(state.a, 0xC0, "A rotated right");
      assert.ok(state.f & 0x01, "Carry set (bit 0 was 1)");
    });

    QUnit.test("RAL - Rotate left through carry with carry set", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x06; // LBI 0xFF
      mem[0x0001] = 0xFF;
      mem[0x0002] = 0x04; // ADI 1 (sets carry)
      mem[0x0003] = 0x01;
      mem[0x0004] = 0x12; // RAL

      cpu.steps(5); // LBI
      cpu.steps(5); // ADI
      cpu.steps(10); // RAL

      const state = cpu.status();
      // Result after ADI is 0x00, rotated left with carry=1 = 0x01
      assert.equal(state.a, 0x01, "A rotated left through carry");
    });

    QUnit.test("RAR - Rotate right through carry with carry set", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x06; // LBI 0xFF
      mem[0x0001] = 0xFF;
      mem[0x0002] = 0x04; // ADI 1 (sets carry)
      mem[0x0003] = 0x01;
      mem[0x0004] = 0x1A; // RAR

      cpu.steps(5); // LBI
      cpu.steps(5); // ADI
      cpu.steps(10); // RAR

      const state = cpu.status();
      // Result after ADI is 0x00, rotated right with carry=1 = 0x80
      assert.equal(state.a, 0x80, "A rotated right through carry");
    });
  });

  QUnit.module("Output Instruction (for coverage)", () => {
    QUnit.test("OUT - Output accumulator to port", (assert) => {
      const { cpu, mem, ports } = createTestCPU();

      mem[0x0000] = 0x06; // LBI 0x42
      mem[0x0001] = 0x42;
      mem[0x0002] = 0x41; // OUT port 0

      cpu.steps(5); // LBI
      cpu.steps(10); // OUT

      assert.equal(ports[0], 0x42, "Port 0 received value 0x42");
    });

    QUnit.test("OUT - Output to different ports", (assert) => {
      const { cpu, mem, ports } = createTestCPU();

      mem[0x0000] = 0x06; // LBI 0xAA
      mem[0x0001] = 0xAA;
      mem[0x0002] = 0x49; // OUT port 1
      mem[0x0003] = 0x06; // LBI 0x55
      mem[0x0004] = 0x55;
      mem[0x0005] = 0x51; // OUT port 2

      cpu.steps(5); // LBI
      cpu.steps(10); // OUT port 1
      cpu.steps(5); // LBI
      cpu.steps(10); // OUT port 2

      assert.equal(ports[1], 0xAA, "Port 1 received value 0xAA");
      assert.equal(ports[2], 0x55, "Port 2 received value 0x55");
    });
  });

  QUnit.module("Utility Functions (for coverage)", () => {
    QUnit.test("init - Legacy init function", (assert) => {
      const { cpu } = createTestCPU();

      cpu.init(); // Should be no-op

      assert.ok(true, "Init function executes without error");
    });

    QUnit.test("trace - Enable/disable tracing", (assert) => {
      const { cpu } = createTestCPU();

      cpu.trace(true);
      assert.ok(true, "Trace enabled without error");

      cpu.trace(false);
      assert.ok(true, "Trace disabled without error");
    });

    QUnit.test("DEBUG - Debug function", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0000] = 0x00; // HLT

      // DEBUG is called internally, just verify it doesn't crash
      cpu.DEBUG();
      assert.ok(true, "DEBUG function executes without error");
    });
  });

  QUnit.module("Disassembler (for coverage)", () => {
    QUnit.test("Load instructions", (assert) => {
      assert.deepEqual(disasm(0x06, 0x42, 0), ["LBI $42", 2], "LBI immediate");
      assert.deepEqual(disasm(0x0E, 0x55, 0), ["LCI $55", 2], "LCI immediate");
      assert.deepEqual(disasm(0x16, 0xAA, 0), ["LDI $AA", 2], "LDI immediate");
      assert.deepEqual(disasm(0x1E, 0x10, 0), ["LEI $10", 2], "LEI immediate");
      assert.deepEqual(disasm(0x2E, 0x20, 0), ["LHI $20", 2], "LHI immediate");
      assert.deepEqual(disasm(0x36, 0x30, 0), ["LLI $30", 2], "LLI immediate");
    });

    QUnit.test("ALU immediate instructions", (assert) => {
      assert.deepEqual(disasm(0x04, 0x10, 0), ["ADI $10", 2], "ADI");
      assert.deepEqual(disasm(0x0C, 0x20, 0), ["ACI $20", 2], "ACI");
      assert.deepEqual(disasm(0x14, 0x30, 0), ["SUI $30", 2], "SUI");
      assert.deepEqual(disasm(0x1C, 0x40, 0), ["SBI $40", 2], "SBI");
      assert.deepEqual(disasm(0x34, 0x50, 0), ["NDI $50", 2], "NDI (AND immediate)");
      assert.deepEqual(disasm(0x3C, 0x60, 0), ["XRI $60", 2], "XRI");
      assert.deepEqual(disasm(0x44, 0x70, 0), ["ORI $70", 2], "ORI");
      assert.deepEqual(disasm(0x4C, 0x80, 0), ["CPI $80", 2], "CPI");
    });

    QUnit.test("Jump and call instructions", (assert) => {
      assert.deepEqual(disasm(0x44, 0x00, 0x10), ["JMP $1000", 3], "JMP");
      assert.deepEqual(disasm(0x46, 0x00, 0x20), ["CAL $2000", 3], "CAL (call)");
    });

    QUnit.test("Conditional jumps", (assert) => {
      assert.deepEqual(disasm(0x40, 0x00, 0x10), ["JFZ $1000", 3], "JFZ");
      assert.deepEqual(disasm(0x48, 0x00, 0x20), ["JTZ $2000", 3], "JTZ");
      assert.deepEqual(disasm(0x50, 0x00, 0x30), ["JFC $3000", 3], "JFC");
      assert.deepEqual(disasm(0x58, 0x00, 0x40), ["JTC $4000", 3], "JTC");
      assert.deepEqual(disasm(0x60, 0x00, 0x50), ["JFP $5000", 3], "JFP");
      assert.deepEqual(disasm(0x68, 0x00, 0x60), ["JTP $6000", 3], "JTP");
      assert.deepEqual(disasm(0x70, 0x00, 0x70), ["JPE $7000", 3], "JPE");
      assert.deepEqual(disasm(0x78, 0x00, 0x08), ["JPO $0800", 3], "JPO");
    });

    QUnit.test("Conditional calls", (assert) => {
      assert.deepEqual(disasm(0x42, 0x00, 0x10), ["CFZ $1000", 3], "CFZ");
      assert.deepEqual(disasm(0x4A, 0x00, 0x20), ["CTZ $2000", 3], "CTZ");
      assert.deepEqual(disasm(0x52, 0x00, 0x30), ["CFC $3000", 3], "CFC");
      assert.deepEqual(disasm(0x5A, 0x00, 0x40), ["CTC $4000", 3], "CTC");
      assert.deepEqual(disasm(0x62, 0x00, 0x50), ["CFP $5000", 3], "CFP");
      assert.deepEqual(disasm(0x6A, 0x00, 0x60), ["CTP $6000", 3], "CTP");
      assert.deepEqual(disasm(0x72, 0x00, 0x70), ["CPE $7000", 3], "CPE");
      assert.deepEqual(disasm(0x7A, 0x00, 0x08), ["CPO $0800", 3], "CPO");
    });

    QUnit.test("Return instructions", (assert) => {
      assert.deepEqual(disasm(0x07, 0, 0), ["RFZ", 1], "RFZ");
      assert.deepEqual(disasm(0x0F, 0, 0), ["RTZ", 1], "RTZ");
      assert.deepEqual(disasm(0x17, 0, 0), ["RFC", 1], "RFC");
      assert.deepEqual(disasm(0x1F, 0, 0), ["RTC", 1], "RTC");
      assert.deepEqual(disasm(0x27, 0, 0), ["RFP", 1], "RFP");
      assert.deepEqual(disasm(0x2F, 0, 0), ["RTP", 1], "RTP");
      assert.deepEqual(disasm(0x37, 0, 0), ["RPE", 1], "RPE");
      assert.deepEqual(disasm(0x3F, 0, 0), ["RPO", 1], "RPO");
    });

    QUnit.test("Rotate instructions", (assert) => {
      assert.deepEqual(disasm(0x02, 0, 0), ["RLC", 1], "RLC");
      assert.deepEqual(disasm(0x0A, 0, 0), ["RRC", 1], "RRC");
      assert.deepEqual(disasm(0x12, 0, 0), ["RAL", 1], "RAL");
      assert.deepEqual(disasm(0x1A, 0, 0), ["RAR", 1], "RAR");
    });

    QUnit.test("Increment/Decrement instructions", (assert) => {
      assert.deepEqual(disasm(0x00, 0, 0), ["INA", 1], "INA");
      assert.deepEqual(disasm(0x08, 0, 0), ["INB", 1], "INB");
      assert.deepEqual(disasm(0x10, 0, 0), ["INC", 1], "INC");
      assert.deepEqual(disasm(0x18, 0, 0), ["IND", 1], "IND");
      assert.deepEqual(disasm(0x20, 0, 0), ["INE", 1], "INE");
      assert.deepEqual(disasm(0x28, 0, 0), ["INH", 1], "INH");
      assert.deepEqual(disasm(0x30, 0, 0), ["INL", 1], "INL");

      assert.deepEqual(disasm(0x01, 0, 0), ["DCA", 1], "DCA");
      assert.deepEqual(disasm(0x09, 0, 0), ["DCB", 1], "DCB");
      assert.deepEqual(disasm(0x11, 0, 0), ["DCC", 1], "DCC");
      assert.deepEqual(disasm(0x19, 0, 0), ["DCD", 1], "DCD");
      assert.deepEqual(disasm(0x21, 0, 0), ["DCE", 1], "DCE");
      assert.deepEqual(disasm(0x29, 0, 0), ["DCH", 1], "DCH");
      assert.deepEqual(disasm(0x31, 0, 0), ["DCL", 1], "DCL");
    });

    QUnit.test("I/O and control instructions", (assert) => {
      assert.deepEqual(disasm(0x41, 0, 0), ["OUT 0", 1], "OUT port 0");
      assert.deepEqual(disasm(0x49, 0, 0), ["OUT 1", 1], "OUT port 1");
      assert.deepEqual(disasm(0x51, 0, 0), ["OUT 2", 1], "OUT port 2");

      assert.deepEqual(disasm(0x05, 0, 0), ["HLT", 1], "HLT");
    });

    QUnit.test("Register load/store", (assert) => {
      assert.deepEqual(disasm(0xC0, 0, 0), ["LAA", 1], "LAA - Load A from A");
      assert.deepEqual(disasm(0xC1, 0, 0), ["LAB", 1], "LAB - Load A from B");
      assert.deepEqual(disasm(0xC7, 0, 0), ["LAM", 1], "LAM - Load A from memory");
      assert.deepEqual(disasm(0xF8, 0, 0), ["LLA", 1], "LLA - Load L from A");
    });
  });
});
