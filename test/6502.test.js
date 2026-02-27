/**
 * MOS 6502 CPU Emulator Tests
 *
 * Comprehensive test suite for ES6 6502 emulator implementation.
 * Tests instruction execution, addressing modes, flag handling, and timing.
 */

import QUnit from "qunit";
import create6502 from "../src/6502.js";

QUnit.module("6502 CPU Emulator", () => {
  /**
   * Helper: Create CPU with simple memory array
   */
  const createTestCPU = () => {
    const mem = new Uint8Array(65536);

    const cpu = create6502({
      byteAt: (addr) => mem[addr] || 0,
      byteTo: (addr, val) => {
        mem[addr] = val & 0xFF;
      }
    });

    return { cpu, mem };
  };

  QUnit.module("Initialization and Reset", () => {
    QUnit.test("CPU initializes with correct default values", (assert) => {
      const { cpu } = createTestCPU();
      const state = cpu.status();

      assert.equal(state.a, 0, "A register is 0");
      assert.equal(state.x, 0, "X register is 0");
      assert.equal(state.y, 0, "Y register is 0");
      assert.equal(state.sp, 0xFD, "SP starts at 0xFD");
    });

    QUnit.test("Reset loads PC from reset vector", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0xFFFC] = 0x00;
      mem[0xFFFD] = 0x02; // Reset to $0200

      cpu.reset();
      const state = cpu.status();

      assert.equal(state.pc, 0x0200, "PC loaded from reset vector");
    });
  });

  QUnit.module("Register Manipulation", () => {
    QUnit.test("Set and get single registers", (assert) => {
      const { cpu } = createTestCPU();

      cpu.set("A", 0x42);
      cpu.set("X", 0x12);
      cpu.set("Y", 0x34);
      cpu.set("PC", 0x1000);
      cpu.set("SP", 0xF0);

      const state = cpu.status();
      assert.equal(state.a, 0x42, "A register set correctly");
      assert.equal(state.x, 0x12, "X register set correctly");
      assert.equal(state.y, 0x34, "Y register set correctly");
      assert.equal(state.pc, 0x1000, "PC set correctly");
      assert.equal(state.sp, 0xF0, "SP set correctly");
    });
  });

  QUnit.module("Load Instructions", () => {
    QUnit.test("LDA immediate - Load A with immediate value", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0200] = 0xA9; // LDA #$42
      mem[0x0201] = 0x42;

      cpu.set("PC", 0x0200);
      cpu.steps(2);

      const state = cpu.status();
      assert.equal(state.a, 0x42, "A loaded with $42");
      assert.equal(state.pc, 0x0202, "PC advanced by 2");
    });

    QUnit.test("LDX immediate - Load X with immediate value", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0200] = 0xA2; // LDX #$55
      mem[0x0201] = 0x55;

      cpu.set("PC", 0x0200);
      cpu.steps(2);

      const state = cpu.status();
      assert.equal(state.x, 0x55, "X loaded with $55");
    });

    QUnit.test("LDY immediate - Load Y with immediate value", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0200] = 0xA0; // LDY #$AA
      mem[0x0201] = 0xAA;

      cpu.set("PC", 0x0200);
      cpu.steps(2);

      const state = cpu.status();
      assert.equal(state.y, 0xAA, "Y loaded with $AA");
    });

    QUnit.test("LDA zero page - Load A from zero page", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0050] = 0x99; // Data at zero page $50
      mem[0x0200] = 0xA5; // LDA $50
      mem[0x0201] = 0x50;

      cpu.set("PC", 0x0200);
      cpu.steps(3);

      const state = cpu.status();
      assert.equal(state.a, 0x99, "A loaded from zero page");
    });

    QUnit.test("LDA absolute - Load A from absolute address", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1234] = 0x77; // Data at $1234
      mem[0x0200] = 0xAD; // LDA $1234
      mem[0x0201] = 0x34;
      mem[0x0202] = 0x12;

      cpu.set("PC", 0x0200);
      cpu.steps(4);

      const state = cpu.status();
      assert.equal(state.a, 0x77, "A loaded from absolute address");
    });
  });

  QUnit.module("Store Instructions", () => {
    QUnit.test("STA zero page - Store A to zero page", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x42);
      mem[0x0200] = 0x85; // STA $50
      mem[0x0201] = 0x50;

      cpu.set("PC", 0x0200);
      cpu.steps(3);

      assert.equal(mem[0x0050], 0x42, "A stored to zero page");
    });

    QUnit.test("STX zero page - Store X to zero page", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("X", 0x55);
      mem[0x0200] = 0x86; // STX $60
      mem[0x0201] = 0x60;

      cpu.set("PC", 0x0200);
      cpu.steps(3);

      assert.equal(mem[0x0060], 0x55, "X stored to zero page");
    });

    QUnit.test("STY zero page - Store Y to zero page", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("Y", 0xAA);
      mem[0x0200] = 0x84; // STY $70
      mem[0x0201] = 0x70;

      cpu.set("PC", 0x0200);
      cpu.steps(3);

      assert.equal(mem[0x0070], 0xAA, "Y stored to zero page");
    });

    QUnit.test("STA absolute - Store A to absolute address", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x99);
      mem[0x0200] = 0x8D; // STA $1234
      mem[0x0201] = 0x34;
      mem[0x0202] = 0x12;

      cpu.set("PC", 0x0200);
      cpu.steps(4);

      assert.equal(mem[0x1234], 0x99, "A stored to absolute address");
    });
  });

  QUnit.module("Transfer Instructions", () => {
    QUnit.test("TAX - Transfer A to X", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x42);
      mem[0x0200] = 0xAA; // TAX

      cpu.set("PC", 0x0200);
      cpu.steps(2);

      const state = cpu.status();
      assert.equal(state.x, 0x42, "X = A");
      assert.equal(state.a, 0x42, "A unchanged");
    });

    QUnit.test("TAY - Transfer A to Y", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x55);
      mem[0x0200] = 0xA8; // TAY

      cpu.set("PC", 0x0200);
      cpu.steps(2);

      const state = cpu.status();
      assert.equal(state.y, 0x55, "Y = A");
    });

    QUnit.test("TXA - Transfer X to A", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("X", 0x77);
      mem[0x0200] = 0x8A; // TXA

      cpu.set("PC", 0x0200);
      cpu.steps(2);

      const state = cpu.status();
      assert.equal(state.a, 0x77, "A = X");
    });

    QUnit.test("TYA - Transfer Y to A", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("Y", 0x88);
      mem[0x0200] = 0x98; // TYA

      cpu.set("PC", 0x0200);
      cpu.steps(2);

      const state = cpu.status();
      assert.equal(state.a, 0x88, "A = Y");
    });

    QUnit.test("TSX - Transfer SP to X", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xF0);
      mem[0x0200] = 0xBA; // TSX

      cpu.set("PC", 0x0200);
      cpu.steps(2);

      const state = cpu.status();
      assert.equal(state.x, 0xF0, "X = SP");
    });

    QUnit.test("TXS - Transfer X to SP", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("X", 0xE0);
      mem[0x0200] = 0x9A; // TXS

      cpu.set("PC", 0x0200);
      cpu.steps(2);

      const state = cpu.status();
      assert.equal(state.sp, 0xE0, "SP = X");
    });
  });

  QUnit.module("Arithmetic - ADC", () => {
    QUnit.test("ADC immediate - Simple addition", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x10);
      mem[0x0200] = 0x69; // ADC #$05
      mem[0x0201] = 0x05;

      cpu.set("PC", 0x0200);
      cpu.steps(2);

      const state = cpu.status();
      assert.equal(state.a, 0x15, "A = 0x10 + 0x05 = 0x15");
    });

    QUnit.test("ADC with carry flag set", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x10);
      cpu.set("FLAGS", 0x01); // Set carry
      mem[0x0200] = 0x69; // ADC #$05
      mem[0x0201] = 0x05;

      cpu.set("PC", 0x0200);
      cpu.steps(2);

      const state = cpu.status();
      assert.equal(state.a, 0x16, "A = 0x10 + 0x05 + carry(1) = 0x16");
    });

    QUnit.test("ADC sets carry on overflow", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0xFF);
      mem[0x0200] = 0x69; // ADC #$01
      mem[0x0201] = 0x01;

      cpu.set("PC", 0x0200);
      cpu.steps(2);

      const state = cpu.status();
      assert.equal(state.a, 0x00, "A wraps to 0x00");
      assert.ok(state.flags & 0x01, "Carry flag set");
    });

    QUnit.test("ADC sets zero flag", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x00);
      mem[0x0200] = 0x69; // ADC #$00
      mem[0x0201] = 0x00;

      cpu.set("PC", 0x0200);
      cpu.steps(2);

      const state = cpu.status();
      assert.ok(state.flags & 0x02, "Zero flag set");
    });
  });

  QUnit.module("Arithmetic - SBC", () => {
    QUnit.test("SBC immediate - Simple subtraction", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x20);
      cpu.set("FLAGS", 0x01); // Set carry (no borrow)
      mem[0x0200] = 0xE9; // SBC #$10
      mem[0x0201] = 0x10;

      cpu.set("PC", 0x0200);
      cpu.steps(2);

      const state = cpu.status();
      assert.equal(state.a, 0x10, "A = 0x20 - 0x10 = 0x10");
    });

    QUnit.test("SBC with borrow (carry clear)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x20);
      cpu.set("FLAGS", 0x00); // Clear carry (borrow)
      mem[0x0200] = 0xE9; // SBC #$10
      mem[0x0201] = 0x10;

      cpu.set("PC", 0x0200);
      cpu.steps(2);

      const state = cpu.status();
      assert.equal(state.a, 0x0F, "A = 0x20 - 0x10 - 1 = 0x0F");
    });

    QUnit.test("SBC clears carry on underflow", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x05);
      cpu.set("FLAGS", 0x01); // Set carry
      mem[0x0200] = 0xE9; // SBC #$10
      mem[0x0201] = 0x10;

      cpu.set("PC", 0x0200);
      cpu.steps(2);

      const state = cpu.status();
      assert.notOk(state.flags & 0x01, "Carry flag cleared on underflow");
    });
  });

  QUnit.module("Increment/Decrement", () => {
    QUnit.test("INX - Increment X", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("X", 0x10);
      mem[0x0200] = 0xE8; // INX

      cpu.set("PC", 0x0200);
      cpu.steps(2);

      const state = cpu.status();
      assert.equal(state.x, 0x11, "X incremented");
    });

    QUnit.test("INY - Increment Y", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("Y", 0x20);
      mem[0x0200] = 0xC8; // INY

      cpu.set("PC", 0x0200);
      cpu.steps(2);

      const state = cpu.status();
      assert.equal(state.y, 0x21, "Y incremented");
    });

    QUnit.test("DEX - Decrement X", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("X", 0x10);
      mem[0x0200] = 0xCA; // DEX

      cpu.set("PC", 0x0200);
      cpu.steps(2);

      const state = cpu.status();
      assert.equal(state.x, 0x0F, "X decremented");
    });

    QUnit.test("DEY - Decrement Y", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("Y", 0x20);
      mem[0x0200] = 0x88; // DEY

      cpu.set("PC", 0x0200);
      cpu.steps(2);

      const state = cpu.status();
      assert.equal(state.y, 0x1F, "Y decremented");
    });

    QUnit.test("INC zero page - Increment memory", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0050] = 0x42;
      mem[0x0200] = 0xE6; // INC $50
      mem[0x0201] = 0x50;

      cpu.set("PC", 0x0200);
      cpu.steps(5);

      assert.equal(mem[0x0050], 0x43, "Memory incremented");
    });

    QUnit.test("DEC zero page - Decrement memory", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0050] = 0x42;
      mem[0x0200] = 0xC6; // DEC $50
      mem[0x0201] = 0x50;

      cpu.set("PC", 0x0200);
      cpu.steps(5);

      assert.equal(mem[0x0050], 0x41, "Memory decremented");
    });
  });

  QUnit.module("Logical Operations", () => {
    QUnit.test("AND immediate - Bitwise AND", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0xFF);
      mem[0x0200] = 0x29; // AND #$55
      mem[0x0201] = 0x55;

      cpu.set("PC", 0x0200);
      cpu.steps(2);

      const state = cpu.status();
      assert.equal(state.a, 0x55, "A = 0xFF AND 0x55 = 0x55");
    });

    QUnit.test("ORA immediate - Bitwise OR", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0xF0);
      mem[0x0200] = 0x09; // ORA #$0F
      mem[0x0201] = 0x0F;

      cpu.set("PC", 0x0200);
      cpu.steps(2);

      const state = cpu.status();
      assert.equal(state.a, 0xFF, "A = 0xF0 OR 0x0F = 0xFF");
    });

    QUnit.test("EOR immediate - Bitwise XOR", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0xAA);
      mem[0x0200] = 0x49; // EOR #$55
      mem[0x0201] = 0x55;

      cpu.set("PC", 0x0200);
      cpu.steps(2);

      const state = cpu.status();
      assert.equal(state.a, 0xFF, "A = 0xAA XOR 0x55 = 0xFF");
    });
  });

  QUnit.module("Comparison Instructions", () => {
    QUnit.test("CMP - Compare A (equal)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x42);
      mem[0x0200] = 0xC9; // CMP #$42
      mem[0x0201] = 0x42;

      cpu.set("PC", 0x0200);
      cpu.steps(2);

      const state = cpu.status();
      assert.ok(state.flags & 0x02, "Zero flag set when equal");
      assert.ok(state.flags & 0x01, "Carry flag set when A >= operand");
    });

    QUnit.test("CMP - Compare A (less than)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x10);
      mem[0x0200] = 0xC9; // CMP #$20
      mem[0x0201] = 0x20;

      cpu.set("PC", 0x0200);
      cpu.steps(2);

      const state = cpu.status();
      assert.notOk(state.flags & 0x01, "Carry flag clear when A < operand");
    });

    QUnit.test("CPX - Compare X", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("X", 0x30);
      mem[0x0200] = 0xE0; // CPX #$30
      mem[0x0201] = 0x30;

      cpu.set("PC", 0x0200);
      cpu.steps(2);

      const state = cpu.status();
      assert.ok(state.flags & 0x02, "Zero flag set when X equal");
    });

    QUnit.test("CPY - Compare Y", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("Y", 0x40);
      mem[0x0200] = 0xC0; // CPY #$40
      mem[0x0201] = 0x40;

      cpu.set("PC", 0x0200);
      cpu.steps(2);

      const state = cpu.status();
      assert.ok(state.flags & 0x02, "Zero flag set when Y equal");
    });
  });

  QUnit.module("Branch Instructions", () => {
    QUnit.test("BEQ - Branch if equal (taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("FLAGS", 0x02); // Set zero flag
      mem[0x0200] = 0xF0; // BEQ +5
      mem[0x0201] = 0x05;

      cpu.set("PC", 0x0200);
      cpu.steps(3);

      const state = cpu.status();
      assert.equal(state.pc, 0x0207, "Branch taken to PC+2+5");
    });

    QUnit.test("BEQ - Branch if equal (not taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("FLAGS", 0x00); // Clear zero flag
      mem[0x0200] = 0xF0; // BEQ +5
      mem[0x0201] = 0x05;

      cpu.set("PC", 0x0200);
      cpu.steps(2);

      const state = cpu.status();
      assert.equal(state.pc, 0x0202, "Branch not taken, PC advances");
    });

    QUnit.test("BNE - Branch if not equal (taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("FLAGS", 0x00); // Clear zero flag
      mem[0x0200] = 0xD0; // BNE +10
      mem[0x0201] = 0x0A;

      cpu.set("PC", 0x0200);
      cpu.steps(3);

      const state = cpu.status();
      assert.equal(state.pc, 0x020C, "Branch taken");
    });

    QUnit.test("BCS - Branch if carry set (taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("FLAGS", 0x01); // Set carry flag
      mem[0x0200] = 0xB0; // BCS +8
      mem[0x0201] = 0x08;

      cpu.set("PC", 0x0200);
      cpu.steps(3);

      const state = cpu.status();
      assert.equal(state.pc, 0x020A, "Branch taken when carry set");
    });

    QUnit.test("BCC - Branch if carry clear (taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("FLAGS", 0x00); // Clear carry flag
      mem[0x0200] = 0x90; // BCC +6
      mem[0x0201] = 0x06;

      cpu.set("PC", 0x0200);
      cpu.steps(3);

      const state = cpu.status();
      assert.equal(state.pc, 0x0208, "Branch taken when carry clear");
    });

    QUnit.test("BMI - Branch if minus (taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("FLAGS", 0x80); // Set negative flag
      mem[0x0200] = 0x30; // BMI +4
      mem[0x0201] = 0x04;

      cpu.set("PC", 0x0200);
      cpu.steps(3);

      const state = cpu.status();
      assert.equal(state.pc, 0x0206, "Branch taken when negative");
    });

    QUnit.test("BPL - Branch if plus (taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("FLAGS", 0x00); // Clear negative flag
      mem[0x0200] = 0x10; // BPL +7
      mem[0x0201] = 0x07;

      cpu.set("PC", 0x0200);
      cpu.steps(3);

      const state = cpu.status();
      assert.equal(state.pc, 0x0209, "Branch taken when positive");
    });
  });

  QUnit.module("Stack Operations", () => {
    QUnit.test("PHA - Push A to stack", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x42);
      cpu.set("SP", 0xFF);
      mem[0x0200] = 0x48; // PHA

      cpu.set("PC", 0x0200);
      cpu.steps(3);

      const state = cpu.status();
      assert.equal(state.sp, 0xFE, "SP decremented");
      assert.equal(mem[0x01FF], 0x42, "A pushed to stack");
    });

    QUnit.test("PLA - Pull A from stack", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xFE);
      mem[0x01FF] = 0x99;
      mem[0x0200] = 0x68; // PLA

      cpu.set("PC", 0x0200);
      cpu.steps(4);

      const state = cpu.status();
      assert.equal(state.a, 0x99, "A pulled from stack");
      assert.equal(state.sp, 0xFF, "SP incremented");
    });

    QUnit.test("PHP - Push processor status", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("FLAGS", 0xC3);
      cpu.set("SP", 0xFF);
      mem[0x0200] = 0x08; // PHP

      cpu.set("PC", 0x0200);
      cpu.steps(3);

      const state = cpu.status();
      assert.equal(state.sp, 0xFE, "SP decremented");
      // Flags pushed with break flag set
      assert.equal(mem[0x01FF] & 0xCF, 0xC3 & 0xCF, "Flags pushed (ignoring B bits)");
    });

    QUnit.test("PLP - Pull processor status", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xFE);
      mem[0x01FF] = 0xC3;
      mem[0x0200] = 0x28; // PLP

      cpu.set("PC", 0x0200);
      cpu.steps(4);

      const state = cpu.status();
      assert.equal(state.sp, 0xFF, "SP incremented");
      assert.equal(state.flags & 0xCF, 0xC3 & 0xCF, "Flags restored");
    });
  });

  QUnit.module("Jump and Subroutine", () => {
    QUnit.test("JMP absolute - Jump to address", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0200] = 0x4C; // JMP $1234
      mem[0x0201] = 0x34;
      mem[0x0202] = 0x12;

      cpu.set("PC", 0x0200);
      cpu.steps(3);

      const state = cpu.status();
      assert.equal(state.pc, 0x1234, "PC set to jump target");
    });

    QUnit.test("JSR - Jump to subroutine", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xFF);
      mem[0x0200] = 0x20; // JSR $3000
      mem[0x0201] = 0x00;
      mem[0x0202] = 0x30;

      cpu.set("PC", 0x0200);
      cpu.steps(6);

      const state = cpu.status();
      assert.equal(state.pc, 0x3000, "PC = subroutine address");
      assert.equal(state.sp, 0xFD, "Return address pushed (2 bytes)");

      // Return address is PC+2 (0x0202)
      const returnAddr = mem[0x01FF] | (mem[0x01FE] << 8);
      assert.equal(returnAddr, 0x0202, "Correct return address pushed");
    });

    QUnit.test("RTS - Return from subroutine", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xFD);
      mem[0x01FF] = 0x02; // Return to $0203
      mem[0x01FE] = 0x02;
      mem[0x0300] = 0x60; // RTS

      cpu.set("PC", 0x0300);
      cpu.steps(6);

      const state = cpu.status();
      assert.equal(state.pc, 0x0203, "PC = return address + 1");
      assert.equal(state.sp, 0xFF, "SP restored");
    });
  });

  QUnit.module("Flag Manipulation", () => {
    QUnit.test("CLC - Clear carry flag", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("FLAGS", 0xFF);
      mem[0x0200] = 0x18; // CLC

      cpu.set("PC", 0x0200);
      cpu.steps(2);

      const state = cpu.status();
      assert.notOk(state.flags & 0x01, "Carry flag cleared");
    });

    QUnit.test("SEC - Set carry flag", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("FLAGS", 0x00);
      mem[0x0200] = 0x38; // SEC

      cpu.set("PC", 0x0200);
      cpu.steps(2);

      const state = cpu.status();
      assert.ok(state.flags & 0x01, "Carry flag set");
    });

    QUnit.test("CLI - Clear interrupt flag", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("FLAGS", 0xFF);
      mem[0x0200] = 0x58; // CLI

      cpu.set("PC", 0x0200);
      cpu.steps(2);

      const state = cpu.status();
      assert.notOk(state.flags & 0x04, "Interrupt flag cleared");
    });

    QUnit.test("SEI - Set interrupt flag", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("FLAGS", 0x00);
      mem[0x0200] = 0x78; // SEI

      cpu.set("PC", 0x0200);
      cpu.steps(2);

      const state = cpu.status();
      assert.ok(state.flags & 0x04, "Interrupt flag set");
    });

    QUnit.test("CLV - Clear overflow flag", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("FLAGS", 0xFF);
      mem[0x0200] = 0xB8; // CLV

      cpu.set("PC", 0x0200);
      cpu.steps(2);

      const state = cpu.status();
      assert.notOk(state.flags & 0x40, "Overflow flag cleared");
    });

    QUnit.test("CLD - Clear decimal flag", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("FLAGS", 0xFF);
      mem[0x0200] = 0xD8; // CLD

      cpu.set("PC", 0x0200);
      cpu.steps(2);

      const state = cpu.status();
      assert.notOk(state.flags & 0x08, "Decimal flag cleared");
    });

    QUnit.test("SED - Set decimal flag", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("FLAGS", 0x00);
      mem[0x0200] = 0xF8; // SED

      cpu.set("PC", 0x0200);
      cpu.steps(2);

      const state = cpu.status();
      assert.ok(state.flags & 0x08, "Decimal flag set");
    });
  });

  QUnit.module("Shift and Rotate", () => {
    QUnit.test("ASL A - Arithmetic shift left A", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x40);
      mem[0x0200] = 0x0A; // ASL A

      cpu.set("PC", 0x0200);
      cpu.steps(2);

      const state = cpu.status();
      assert.equal(state.a, 0x80, "A shifted left");
      assert.notOk(state.flags & 0x01, "Carry clear (bit 7 was 0)");
    });

    QUnit.test("LSR A - Logical shift right A", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x81);
      mem[0x0200] = 0x4A; // LSR A

      cpu.set("PC", 0x0200);
      cpu.steps(2);

      const state = cpu.status();
      assert.equal(state.a, 0x40, "A shifted right");
      assert.ok(state.flags & 0x01, "Carry set (bit 0 was 1)");
    });

    QUnit.test("ROL A - Rotate left A", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x81);
      cpu.set("FLAGS", 0x00); // Carry clear
      mem[0x0200] = 0x2A; // ROL A

      cpu.set("PC", 0x0200);
      cpu.steps(2);

      const state = cpu.status();
      assert.equal(state.a, 0x02, "A rotated left (bit 7 to carry, carry to bit 0)");
      assert.ok(state.flags & 0x01, "Carry set from bit 7");
    });

    QUnit.test("ROR A - Rotate right A", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x81);
      cpu.set("FLAGS", 0x00); // Carry clear
      mem[0x0200] = 0x6A; // ROR A

      cpu.set("PC", 0x0200);
      cpu.steps(2);

      const state = cpu.status();
      assert.equal(state.a, 0x40, "A rotated right (bit 0 to carry, carry to bit 7)");
      assert.ok(state.flags & 0x01, "Carry set from bit 0");
    });
  });

  QUnit.module("No-op and BRK", () => {
    QUnit.test("NOP - No operation", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0200] = 0xEA; // NOP

      cpu.set("PC", 0x0200);
      cpu.steps(2);

      const state = cpu.status();
      assert.equal(state.pc, 0x0201, "PC advanced by 1");
    });

    QUnit.test("BRK - Break instruction", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xFF);
      mem[0xFFFE] = 0x00; // IRQ vector
      mem[0xFFFF] = 0x30;
      mem[0x0200] = 0x00; // BRK

      cpu.set("PC", 0x0200);
      cpu.steps(7);

      const state = cpu.status();
      assert.equal(state.pc, 0x3000, "PC = IRQ vector");
      assert.ok(state.flags & 0x04, "Interrupt flag set");
    });
  });

  QUnit.module("Addressing Modes", () => {
    QUnit.test("Zero page,X addressing", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("X", 0x05);
      mem[0x0055] = 0x77; // Data at $50 + X
      mem[0x0200] = 0xB5; // LDA $50,X
      mem[0x0201] = 0x50;

      cpu.set("PC", 0x0200);
      cpu.steps(4);

      const state = cpu.status();
      assert.equal(state.a, 0x77, "A loaded from zero page + X");
    });

    QUnit.test("Zero page,Y addressing", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("Y", 0x03);
      mem[0x0063] = 0x88; // Data at $60 + Y
      mem[0x0200] = 0xB6; // LDX $60,Y
      mem[0x0201] = 0x60;

      cpu.set("PC", 0x0200);
      cpu.steps(4);

      const state = cpu.status();
      assert.equal(state.x, 0x88, "X loaded from zero page + Y");
    });

    QUnit.test("Absolute,X addressing", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("X", 0x10);
      mem[0x1244] = 0x99; // Data at $1234 + X
      mem[0x0200] = 0xBD; // LDA $1234,X
      mem[0x0201] = 0x34;
      mem[0x0202] = 0x12;

      cpu.set("PC", 0x0200);
      cpu.steps(4);

      const state = cpu.status();
      assert.equal(state.a, 0x99, "A loaded from absolute + X");
    });

    QUnit.test("Absolute,Y addressing", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("Y", 0x20);
      mem[0x1254] = 0xAA; // Data at $1234 + Y
      mem[0x0200] = 0xB9; // LDA $1234,Y
      mem[0x0201] = 0x34;
      mem[0x0202] = 0x12;

      cpu.set("PC", 0x0200);
      cpu.steps(4);

      const state = cpu.status();
      assert.equal(state.a, 0xAA, "A loaded from absolute + Y");
    });

    QUnit.test("Indexed indirect (X) addressing", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("X", 0x04);
      mem[0x0024] = 0x34; // Pointer at $20 + X points to $1234
      mem[0x0025] = 0x12;
      mem[0x1234] = 0xBB; // Data at address from pointer

      mem[0x0200] = 0xA1; // LDA ($20,X)
      mem[0x0201] = 0x20;

      cpu.set("PC", 0x0200);
      cpu.steps(6);

      const state = cpu.status();
      assert.equal(state.a, 0xBB, "A loaded via indexed indirect");
    });

    QUnit.test("Indirect indexed (Y) addressing", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("Y", 0x10);
      mem[0x0030] = 0x00; // Pointer at $30 points to $1200
      mem[0x0031] = 0x12;
      mem[0x1210] = 0xCC; // Data at pointer + Y

      mem[0x0200] = 0xB1; // LDA ($30),Y
      mem[0x0201] = 0x30;

      cpu.set("PC", 0x0200);
      cpu.steps(5);

      const state = cpu.status();
      assert.equal(state.a, 0xCC, "A loaded via indirect indexed");
    });

    QUnit.test("JMP indirect - Jump via pointer", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x34; // Pointer at $1000 points to $5678
      mem[0x1001] = 0x56;

      mem[0x0200] = 0x6C; // JMP ($1000)
      mem[0x0201] = 0x00;
      mem[0x0202] = 0x10;

      cpu.set("PC", 0x0200);
      cpu.steps(5);

      const state = cpu.status();
      assert.equal(state.pc, 0x5634, "PC = address from pointer");
    });
  });

  QUnit.module("Utility Functions", () => {
    QUnit.test("flagsToString formats flags correctly", (assert) => {
      const { cpu } = createTestCPU();

      cpu.set("FLAGS", 0x00);
      assert.equal(cpu.flagsToString(), "nv-bdizc", "All flags clear");

      cpu.set("FLAGS", 0xFF);
      assert.equal(cpu.flagsToString(), "NV-BDIZC", "All flags set");

      cpu.set("FLAGS", 0x83); // N, Z, C set
      assert.equal(cpu.flagsToString(), "Nv-bdiZC", "Mixed flags");
    });

    QUnit.test("T() returns cycle count", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0200] = 0xEA; // NOP (2 cycles)
      mem[0x0201] = 0xEA; // NOP (2 cycles)

      cpu.set("PC", 0x0200);
      cpu.steps(4);

      assert.equal(cpu.T(), 4, "Cycle counter tracks correctly");
    });
  });
});
