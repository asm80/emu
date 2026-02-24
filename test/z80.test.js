/**
 * Zilog Z80 CPU Emulator - Comprehensive Tests
 *
 * Test suite covering all Z80 base instructions (non-prefix).
 * Tests instruction execution, flag handling, timing, and hardware compatibility.
 */

import QUnit from "qunit";
import z80 from "../src/z80.js";

QUnit.module("Z80 CPU Emulator", () => {
  /**
   * Helper: Create CPU with simple memory array
   */
  const createTestCPU = () => {
    const mem = new Uint8Array(65536);
    const ports = new Uint8Array(256);

    const cpu = z80({
      byteAt: (addr) => mem[addr] || 0,
      byteTo: (addr, val) => { mem[addr] = val & 0xFF; },
      portOut: (port, val) => { ports[port] = val & 0xFF; },
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
      assert.equal(state.f, 0, "Flags are 0");
      assert.equal(state.iff1, 0, "IFF1 is 0");
      assert.equal(state.iff2, 0, "IFF2 is 0");
    });

    QUnit.test("Reset clears all registers", (assert) => {
      const { cpu } = createTestCPU();

      cpu.set("PC", 0x1234);
      cpu.set("A", 0x42);
      cpu.set("BC", 0x5678);
      cpu.reset();

      const state = cpu.status();
      assert.equal(state.pc, 0, "PC reset to 0");
      assert.equal(state.a, 0, "A reset to 0");
      assert.equal(state.bc, 0, "BC reset to 0");
    });

    QUnit.test("Cycle counter starts at 0", (assert) => {
      const { cpu } = createTestCPU();
      assert.equal(cpu.T(), 0, "Cycle counter is 0");
    });
  });

  QUnit.module("8-bit Load Group", () => {
    QUnit.test("LD r,r' - Register to register", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("B", 0x42);
      mem[0] = 0x47; // LD B,A
      mem[1] = 0x48; // LD C,B
      cpu.set("A", 0x99);

      cpu.step(); // LD B,A
      let state = cpu.status();
      assert.equal(state.b, 0x99, "LD B,A copies A to B");

      cpu.step(); // LD C,B
      state = cpu.status();
      assert.equal(state.c, 0x99, "LD C,B copies B to C");
    });

    QUnit.test("LD r,n - Load immediate", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0] = 0x3E; // LD A,n
      mem[1] = 0x42;
      mem[2] = 0x06; // LD B,n
      mem[3] = 0x55;

      cpu.step();
      assert.equal(cpu.status().a, 0x42, "LD A,n loads immediate");

      cpu.step();
      assert.equal(cpu.status().b, 0x55, "LD B,n loads immediate");
    });

    QUnit.test("LD r,(HL) - Load from memory via HL", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("HL", 0x1000);
      mem[0x1000] = 0xAB;
      mem[0] = 0x7E; // LD A,(HL)

      cpu.step();
      assert.equal(cpu.status().a, 0xAB, "LD A,(HL) loads from memory");
    });

    QUnit.test("LD (HL),r - Store to memory via HL", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("HL", 0x2000);
      cpu.set("A", 0xCD);
      mem[0] = 0x77; // LD (HL),A

      cpu.step();
      assert.equal(mem[0x2000], 0xCD, "LD (HL),A stores to memory");
    });

    QUnit.test("LD (HL),n - Store immediate to memory", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("HL", 0x3000);
      mem[0] = 0x36; // LD (HL),n
      mem[1] = 0x88;

      cpu.step();
      assert.equal(mem[0x3000], 0x88, "LD (HL),n stores immediate");
    });

    QUnit.test("LD A,(BC) - Load A from (BC)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("BC", 0x4000);
      mem[0x4000] = 0x77;
      mem[0] = 0x0A; // LD A,(BC)

      cpu.step();
      assert.equal(cpu.status().a, 0x77, "LD A,(BC) loads from BC address");
    });

    QUnit.test("LD A,(DE) - Load A from (DE)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("DE", 0x5000);
      mem[0x5000] = 0x99;
      mem[0] = 0x1A; // LD A,(DE)

      cpu.step();
      assert.equal(cpu.status().a, 0x99, "LD A,(DE) loads from DE address");
    });

    QUnit.test("LD (BC),A - Store A to (BC)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("BC", 0x6000);
      cpu.set("A", 0xBB);
      mem[0] = 0x02; // LD (BC),A

      cpu.step();
      assert.equal(mem[0x6000], 0xBB, "LD (BC),A stores A");
    });

    QUnit.test("LD (DE),A - Store A to (DE)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("DE", 0x7000);
      cpu.set("A", 0xCC);
      mem[0] = 0x12; // LD (DE),A

      cpu.step();
      assert.equal(mem[0x7000], 0xCC, "LD (DE),A stores A");
    });

    QUnit.test("LD A,(nn) - Load A from absolute address", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x8000] = 0xEE;
      mem[0] = 0x3A; // LD A,(nn)
      mem[1] = 0x00;
      mem[2] = 0x80;

      cpu.step();
      assert.equal(cpu.status().a, 0xEE, "LD A,(nn) loads from address");
    });

    QUnit.test("LD (nn),A - Store A to absolute address", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0xFF);
      mem[0] = 0x32; // LD (nn),A
      mem[1] = 0x00;
      mem[2] = 0x90;

      cpu.step();
      assert.equal(mem[0x9000], 0xFF, "LD (nn),A stores A");
    });
  });

  QUnit.module("16-bit Load Group", () => {
    QUnit.test("LD dd,nn - Load 16-bit immediate", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0] = 0x01; // LD BC,nn
      mem[1] = 0x34;
      mem[2] = 0x12;

      cpu.step();
      assert.equal(cpu.status().bc, 0x1234, "LD BC,nn loads 16-bit immediate");
    });

    QUnit.test("LD HL,(nn) - Load HL from memory", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x78;
      mem[0x1001] = 0x56;
      mem[0] = 0x2A; // LD HL,(nn)
      mem[1] = 0x00;
      mem[2] = 0x10;

      cpu.step();
      assert.equal(cpu.status().hl, 0x5678, "LD HL,(nn) loads from memory");
    });

    QUnit.test("LD (nn),HL - Store HL to memory", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("HL", 0xABCD);
      mem[0] = 0x22; // LD (nn),HL
      mem[1] = 0x00;
      mem[2] = 0x20;

      cpu.step();
      assert.equal(mem[0x2000], 0xCD, "Low byte stored");
      assert.equal(mem[0x2001], 0xAB, "High byte stored");
    });

    QUnit.test("LD SP,HL - Transfer HL to SP", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("HL", 0xF000);
      mem[0] = 0xF9; // LD SP,HL

      cpu.step();
      assert.equal(cpu.status().sp, 0xF000, "SP = HL");
    });

    QUnit.test("PUSH qq - Push register pair", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xFFFE);
      cpu.set("BC", 0x1234);
      mem[0] = 0xC5; // PUSH BC

      cpu.step();
      assert.equal(mem[0xFFFD], 0x12, "High byte pushed");
      assert.equal(mem[0xFFFC], 0x34, "Low byte pushed");
      assert.equal(cpu.status().sp, 0xFFFC, "SP decremented by 2");
    });

    QUnit.test("POP qq - Pop register pair", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xFFFC);
      mem[0xFFFC] = 0x78;
      mem[0xFFFD] = 0x56;
      mem[0] = 0xC1; // POP BC

      cpu.step();
      assert.equal(cpu.status().bc, 0x5678, "BC restored from stack");
      assert.equal(cpu.status().sp, 0xFFFE, "SP incremented by 2");
    });
  });

  QUnit.module("8-bit Arithmetic", () => {
    QUnit.test("ADD A,r - Add register to A", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x10);
      cpu.set("B", 0x20);
      mem[0] = 0x80; // ADD A,B

      cpu.step();
      const state = cpu.status();
      assert.equal(state.a, 0x30, "A = A + B");
      assert.equal(state.f & 0x01, 0, "Carry clear");
    });

    QUnit.test("ADD A,n - Add immediate", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x50);
      mem[0] = 0xC6; // ADD A,n
      mem[1] = 0x30;

      cpu.step();
      assert.equal(cpu.status().a, 0x80, "A = A + n");
    });

    QUnit.test("ADD A - Overflow sets carry", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0xFF);
      cpu.set("B", 0x02);
      mem[0] = 0x80; // ADD A,B

      cpu.step();
      const state = cpu.status();
      assert.equal(state.a, 0x01, "A wraps");
      assert.equal(state.f & 0x01, 1, "Carry set");
    });

    QUnit.test("ADC A,r - Add with carry", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x10);
      cpu.set("C", 0x20);
      cpu.set("F", 0x01); // Set carry
      mem[0] = 0x89; // ADC A,C

      cpu.step();
      assert.equal(cpu.status().a, 0x31, "A = A + C + carry");
    });

    QUnit.test("SUB r - Subtract register from A", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x50);
      cpu.set("B", 0x20);
      mem[0] = 0x90; // SUB B

      cpu.step();
      const state = cpu.status();
      assert.equal(state.a, 0x30, "A = A - B");
      assert.equal(state.f & 0x02, 0x02, "N flag set");
    });

    QUnit.test("SUB - Underflow sets carry", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x10);
      cpu.set("B", 0x20);
      mem[0] = 0x90; // SUB B

      cpu.step();
      const state = cpu.status();
      assert.equal(state.a, 0xF0, "A underflows");
      assert.equal(state.f & 0x01, 1, "Carry set on borrow");
    });

    QUnit.test("SBC A,r - Subtract with carry", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x50);
      cpu.set("C", 0x20);
      cpu.set("F", 0x01); // Set carry
      mem[0] = 0x99; // SBC A,C

      cpu.step();
      assert.equal(cpu.status().a, 0x2F, "A = A - C - carry");
    });

    QUnit.test("AND r - Logical AND", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0xF0);
      cpu.set("B", 0x0F);
      mem[0] = 0xA0; // AND B

      cpu.step();
      const state = cpu.status();
      assert.equal(state.a, 0x00, "A = A AND B");
      assert.equal(state.f & 0x40, 0x40, "Zero flag set");
      assert.equal(state.f & 0x10, 0x10, "Half-carry set");
    });

    QUnit.test("OR r - Logical OR", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0xF0);
      cpu.set("B", 0x0F);
      mem[0] = 0xB0; // OR B

      cpu.step();
      assert.equal(cpu.status().a, 0xFF, "A = A OR B");
    });

    QUnit.test("XOR r - Logical XOR", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0xFF);
      mem[0] = 0xAF; // XOR A

      cpu.step();
      const state = cpu.status();
      assert.equal(state.a, 0x00, "A XOR A = 0");
      assert.equal(state.f & 0x40, 0x40, "Zero flag set");
    });

    QUnit.test("CP r - Compare", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x42);
      cpu.set("B", 0x42);
      mem[0] = 0xB8; // CP B

      cpu.step();
      const state = cpu.status();
      assert.equal(state.a, 0x42, "A unchanged");
      assert.equal(state.f & 0x40, 0x40, "Zero flag set (equal)");
      assert.equal(state.f & 0x02, 0x02, "N flag set");
    });

    QUnit.test("INC r - Increment register", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("B", 0x7F);
      mem[0] = 0x04; // INC B

      cpu.step();
      const state = cpu.status();
      assert.equal(state.b, 0x80, "B incremented");
      assert.equal(state.f & 0x04, 0x04, "Overflow flag set");
    });

    QUnit.test("DEC r - Decrement register", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("C", 0x01);
      mem[0] = 0x0D; // DEC C

      cpu.step();
      const state = cpu.status();
      assert.equal(state.c, 0x00, "C decremented");
      assert.equal(state.f & 0x40, 0x40, "Zero flag set");
    });

    QUnit.test("INC (HL) - Increment memory", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("HL", 0x1000);
      mem[0x1000] = 0xFF;
      mem[0] = 0x34; // INC (HL)

      cpu.step();
      assert.equal(mem[0x1000], 0x00, "Memory incremented and wrapped");
    });

    QUnit.test("DEC (HL) - Decrement memory", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("HL", 0x2000);
      mem[0x2000] = 0x00;
      mem[0] = 0x35; // DEC (HL)

      cpu.step();
      assert.equal(mem[0x2000], 0xFF, "Memory decremented and wrapped");
    });
  });

  QUnit.module("16-bit Arithmetic", () => {
    QUnit.test("ADD HL,ss - Add register pair to HL", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("HL", 0x1000);
      cpu.set("BC", 0x0500);
      mem[0] = 0x09; // ADD HL,BC

      cpu.step();
      assert.equal(cpu.status().hl, 0x1500, "HL = HL + BC");
    });

    QUnit.test("ADD HL - Carry flag", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("HL", 0xFFFF);
      cpu.set("BC", 0x0002);
      mem[0] = 0x09; // ADD HL,BC

      cpu.step();
      const state = cpu.status();
      assert.equal(state.hl, 0x0001, "HL wraps");
      assert.equal(state.f & 0x01, 1, "Carry flag set");
    });

    QUnit.test("INC ss - Increment register pair", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("DE", 0xFFFF);
      mem[0] = 0x13; // INC DE

      cpu.step();
      assert.equal(cpu.status().de, 0x0000, "DE incremented and wrapped");
    });

    QUnit.test("DEC ss - Decrement register pair", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("HL", 0x0000);
      mem[0] = 0x2B; // DEC HL

      cpu.step();
      assert.equal(cpu.status().hl, 0xFFFF, "HL decremented and wrapped");
    });
  });

  QUnit.module("Rotate and Shift", () => {
    QUnit.test("RLCA - Rotate left circular A", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x80);
      mem[0] = 0x07; // RLCA

      cpu.step();
      const state = cpu.status();
      assert.equal(state.a, 0x01, "A rotated left");
      assert.equal(state.f & 0x01, 1, "Carry set from bit 7");
    });

    QUnit.test("RRCA - Rotate right circular A", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x01);
      mem[0] = 0x0F; // RRCA

      cpu.step();
      const state = cpu.status();
      assert.equal(state.a, 0x80, "A rotated right");
      assert.equal(state.f & 0x01, 1, "Carry set from bit 0");
    });

    QUnit.test("RLA - Rotate left through carry", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x80);
      cpu.set("F", 0x01); // Set carry
      mem[0] = 0x17; // RLA

      cpu.step();
      const state = cpu.status();
      assert.equal(state.a, 0x01, "A rotated with carry inserted");
      assert.equal(state.f & 0x01, 1, "Carry from bit 7");
    });

    QUnit.test("RRA - Rotate right through carry", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x01);
      cpu.set("F", 0x01); // Set carry
      mem[0] = 0x1F; // RRA

      cpu.step();
      const state = cpu.status();
      assert.equal(state.a, 0x80, "A rotated with carry inserted");
      assert.equal(state.f & 0x01, 1, "Carry from bit 0");
    });
  });

  QUnit.module("Jump and Call", () => {
    QUnit.test("JP nn - Unconditional jump", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0] = 0xC3; // JP nn
      mem[1] = 0x00;
      mem[2] = 0x10;

      cpu.step();
      assert.equal(cpu.status().pc, 0x1000, "PC jumps to address");
    });

    QUnit.test("JP cc,nn - Conditional jump (taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("F", 0x40); // Set zero flag
      mem[0] = 0xCA; // JP Z,nn
      mem[1] = 0x00;
      mem[2] = 0x20;

      cpu.step();
      assert.equal(cpu.status().pc, 0x2000, "Jump taken when Z set");
    });

    QUnit.test("JP cc,nn - Conditional jump (not taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("F", 0x00); // Clear zero flag
      mem[0] = 0xCA; // JP Z,nn
      mem[1] = 0x00;
      mem[2] = 0x20;

      cpu.step();
      assert.equal(cpu.status().pc, 3, "Jump not taken when Z clear");
    });

    QUnit.test("JR e - Relative jump", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0] = 0x18; // JR e
      mem[1] = 0x0A; // +10

      cpu.step();
      assert.equal(cpu.status().pc, 12, "PC = 0 + 2 + 10");
    });

    QUnit.test("JR e - Backward relative jump", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("PC", 0x100);
      mem[0x100] = 0x18; // JR e
      mem[0x101] = 0xFC; // -4 (two's complement)

      cpu.step();
      assert.equal(cpu.status().pc, 0xFE, "PC jumps backward");
    });

    QUnit.test("JR cc,e - Conditional relative (taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("F", 0x40); // Set zero
      mem[0] = 0x28; // JR Z,e
      mem[1] = 0x05;

      cpu.step();
      assert.equal(cpu.status().pc, 7, "Relative jump taken");
    });

    QUnit.test("JP (HL) - Indirect jump", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("HL", 0x3000);
      mem[0] = 0xE9; // JP (HL)

      cpu.step();
      assert.equal(cpu.status().pc, 0x3000, "PC = HL");
    });

    QUnit.test("DJNZ e - Decrement and jump if not zero", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("B", 0x02);
      mem[0] = 0x10; // DJNZ +5
      mem[1] = 0x05;

      cpu.step();
      const state = cpu.status();
      assert.equal(state.b, 0x01, "B decremented");
      assert.equal(state.pc, 7, "Jump taken (B != 0)");
    });

    QUnit.test("DJNZ e - No jump when B=0", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("B", 0x01);
      mem[0] = 0x10; // DJNZ +5
      mem[1] = 0x05;

      cpu.step();
      const state = cpu.status();
      assert.equal(state.b, 0x00, "B decremented to 0");
      assert.equal(state.pc, 2, "Jump not taken (B = 0)");
    });

    QUnit.test("CALL nn - Call subroutine", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xFFFE);
      mem[0] = 0xCD; // CALL nn
      mem[1] = 0x00;
      mem[2] = 0x50;

      cpu.step();
      const state = cpu.status();
      assert.equal(state.pc, 0x5000, "PC jumps to subroutine");
      assert.equal(mem[0xFFFD], 0x00, "Return address high");
      assert.equal(mem[0xFFFC], 0x03, "Return address low");
      assert.equal(state.sp, 0xFFFC, "SP decremented");
    });

    QUnit.test("RET - Return from subroutine", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xFFFC);
      mem[0xFFFC] = 0x34;
      mem[0xFFFD] = 0x12;
      mem[0] = 0xC9; // RET

      cpu.step();
      const state = cpu.status();
      assert.equal(state.pc, 0x1234, "PC restored");
      assert.equal(state.sp, 0xFFFE, "SP restored");
    });

    QUnit.test("CALL cc,nn - Conditional call", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xFFFE);
      cpu.set("F", 0x01); // Set carry
      mem[0] = 0xDC; // CALL C,nn
      mem[1] = 0x00;
      mem[2] = 0x60;

      cpu.step();
      assert.equal(cpu.status().pc, 0x6000, "Call taken when C set");
    });

    QUnit.test("RET cc - Conditional return", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xFFFC);
      cpu.set("F", 0x40); // Set zero
      mem[0xFFFC] = 0x78;
      mem[0xFFFD] = 0x56;
      mem[0] = 0xC8; // RET Z

      cpu.step();
      assert.equal(cpu.status().pc, 0x5678, "Return taken when Z set");
    });
  });

  QUnit.module("Miscellaneous", () => {
    QUnit.test("NOP - No operation", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0] = 0x00; // NOP

      cpu.step();
      assert.equal(cpu.status().pc, 1, "PC advances");
      assert.equal(cpu.T(), 4, "4 T-states");
    });

    QUnit.test("HALT - Stop execution", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0] = 0x76; // HALT

      cpu.step();
      const state = cpu.status();
      assert.ok(state.halted, "CPU halted");
      assert.equal(state.pc, 0, "PC stays at HALT");
    });

    QUnit.test("DI - Disable interrupts", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0] = 0xFB; // EI
      mem[1] = 0xF3; // DI

      cpu.step();
      cpu.step();

      const state = cpu.status();
      assert.equal(state.iff1, 0, "IFF1 cleared");
      assert.equal(state.iff2, 0, "IFF2 cleared");
    });

    QUnit.test("EI - Enable interrupts", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0] = 0xFB; // EI

      cpu.step();

      const state = cpu.status();
      assert.equal(state.iff1, 1, "IFF1 set");
      assert.equal(state.iff2, 1, "IFF2 set");
    });

    QUnit.test("CPL - Complement A", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x0F);
      mem[0] = 0x2F; // CPL

      cpu.step();
      assert.equal(cpu.status().a, 0xF0, "A complemented");
    });

    QUnit.test("SCF - Set carry flag", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0] = 0x37; // SCF

      cpu.step();
      assert.equal(cpu.status().f & 0x01, 1, "Carry flag set");
    });

    QUnit.test("CCF - Complement carry flag", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("F", 0x01); // Set carry
      mem[0] = 0x3F; // CCF

      cpu.step();
      assert.equal(cpu.status().f & 0x01, 0, "Carry flag cleared");
    });

    QUnit.test("DAA - Decimal adjust accumulator", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x15);
      cpu.set("B", 0x27);
      mem[0] = 0x80; // ADD A,B
      mem[1] = 0x27; // DAA

      cpu.step();
      cpu.step();

      assert.equal(cpu.status().a, 0x42, "BCD result corrected");
    });

    QUnit.test("EX DE,HL - Exchange DE and HL", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("DE", 0x1234);
      cpu.set("HL", 0x5678);
      mem[0] = 0xEB; // EX DE,HL

      cpu.step();
      const state = cpu.status();
      assert.equal(state.de, 0x5678, "DE = old HL");
      assert.equal(state.hl, 0x1234, "HL = old DE");
    });

    QUnit.test("EX AF,AF' - Exchange AF with shadow", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("AF", 0x1234);
      mem[0] = 0x08; // EX AF,AF'
      cpu.step();

      cpu.set("AF", 0x5678);
      mem[1] = 0x08; // EX AF,AF'
      cpu.step();

      assert.equal(cpu.status().af, 0x1234, "AF restored");
    });

    QUnit.test("EXX - Exchange register banks", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("BC", 0x1111);
      cpu.set("DE", 0x2222);
      cpu.set("HL", 0x3333);
      mem[0] = 0xD9; // EXX
      cpu.step();

      cpu.set("BC", 0x4444);
      cpu.set("DE", 0x5555);
      cpu.set("HL", 0x6666);
      mem[1] = 0xD9; // EXX
      cpu.step();

      const state = cpu.status();
      assert.equal(state.bc, 0x1111, "BC restored");
      assert.equal(state.de, 0x2222, "DE restored");
      assert.equal(state.hl, 0x3333, "HL restored");
    });
  });

  QUnit.module("I/O Operations", () => {
    QUnit.test("OUT (n),A - Output to port", (assert) => {
      const { cpu, mem, ports } = createTestCPU();

      cpu.set("A", 0x42);
      mem[0] = 0xD3; // OUT (n),A
      mem[1] = 0x10;

      cpu.step();
      assert.equal(ports[0x10], 0x42, "Byte output to port");
    });

    QUnit.test("IN A,(n) - Input from port", (assert) => {
      const { cpu, mem, ports } = createTestCPU();

      ports[0x20] = 0x99;
      mem[0] = 0xDB; // IN A,(n)
      mem[1] = 0x20;

      cpu.step();
      assert.equal(cpu.status().a, 0x99, "Byte read from port");
    });
  });

  QUnit.module("RST Instructions", () => {
    QUnit.test("RST 0 - Restart to 0x0000", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("PC", 0x100);
      cpu.set("SP", 0xFFFE);
      mem[0x100] = 0xC7; // RST 0

      cpu.step();
      const state = cpu.status();
      assert.equal(state.pc, 0x0000, "PC = 0x0000");
      assert.equal(state.sp, 0xFFFC, "Return address pushed");
    });

    QUnit.test("RST 38H - Restart to 0x0038", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xFFFE);
      mem[0] = 0xFF; // RST 38H

      cpu.step();
      assert.equal(cpu.status().pc, 0x0038, "PC = 0x0038");
    });
  });

  QUnit.module("Cycle Timing", () => {
    QUnit.test("Instructions consume correct T-states", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0] = 0x00; // NOP (4 T)
      mem[1] = 0x3E; // LD A,n (7 T)
      mem[2] = 0x42;

      const t0 = cpu.T();
      cpu.step();
      const t1 = cpu.T();
      cpu.step();
      const t2 = cpu.T();

      assert.equal(t1 - t0, 4, "NOP takes 4 T-states");
      assert.equal(t2 - t1, 7, "LD A,n takes 7 T-states");
    });
  });

  QUnit.module("Flag Behavior", () => {
    QUnit.test("Zero flag set when result is 0", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x42);
      mem[0] = 0x90; // SUB B (B=0)

      cpu.step();
      assert.equal(cpu.status().f & 0x40, 0, "Z not set (A != 0)");

      cpu.set("A", 0x00);
      mem[1] = 0x90; // SUB B
      cpu.step();
      assert.equal(cpu.status().f & 0x40, 0x40, "Z set (A = 0)");
    });

    QUnit.test("Sign flag set when bit 7 is 1", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x80);
      mem[0] = 0xC6; // ADD A,0
      mem[1] = 0x00;

      cpu.step();
      assert.equal(cpu.status().f & 0x80, 0x80, "S flag set");
    });

    QUnit.test("Parity flag set on even parity", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x00); // Even parity (0 bits)
      mem[0] = 0xB7; // OR A

      cpu.step();
      assert.equal(cpu.status().f & 0x04, 0x04, "P flag set (even)");
    });
  });
});
