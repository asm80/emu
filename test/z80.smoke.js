/**
 * Z80 CPU Emulator Smoke Tests
 *
 * Comprehensive smoke tests covering all major Z80 functionality:
 * - Basic operations and data transfer
 * - Arithmetic and logic operations
 * - Register operations (main and alternate banks)
 * - Index registers (IX/IY)
 * - Special registers (I, R)
 * - Flag handling (including undocumented Y/X flags)
 * - Prefix instructions (CB, ED, DD, FD)
 * - Interrupt modes (IM 0, 1, 2)
 * - Stack operations
 * - Cycle counting
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import z80 from "../src/z80.js";

describe("Z80 Smoke Tests", () => {
  let cpu;
  let memory;

  beforeEach(() => {
    // Create 64KB memory
    memory = new Uint8Array(65536);

    // Create CPU instance
    cpu = z80({
      byteTo: (addr, value) => {
        memory[addr & 0xFFFF] = value & 0xFF;
      },
      byteAt: (addr) => memory[addr & 0xFFFF],
      portOut: (port, value) => {},
      portIn: (port) => 0xFF
    });

    cpu.reset();
  });

  describe("Basic Functionality", () => {
    it("should load and execute NOP", () => {
      memory[0] = 0x00; // NOP
      cpu.step();
      const state = cpu.status();
      assert.strictEqual(state.pc, 1, "PC should increment");
    });

    it("should load immediate to register", () => {
      memory[0] = 0x3E; // LD A,n
      memory[1] = 0x42;
      cpu.step();
      const state = cpu.status();
      assert.strictEqual(state.a, 0x42, "A should be 0x42");
      assert.strictEqual(state.pc, 2, "PC should advance 2 bytes");
    });

    it("should load 16-bit immediate", () => {
      memory[0] = 0x21; // LD HL,nn
      memory[1] = 0x34;
      memory[2] = 0x12;
      cpu.step();
      const state = cpu.status();
      assert.strictEqual(state.hl, 0x1234, "HL should be 0x1234");
    });

    it("should transfer between registers", () => {
      memory[0] = 0x3E; // LD A,0x42
      memory[1] = 0x42;
      memory[2] = 0x47; // LD B,A
      cpu.steps(20);
      const state = cpu.status();
      assert.strictEqual(state.b, 0x42, "B should equal A");
    });
  });

  describe("Arithmetic Operations", () => {
    it("should add immediate to A", () => {
      memory[0] = 0x3E; // LD A,5
      memory[1] = 0x05;
      memory[2] = 0xC6; // ADD A,3
      memory[3] = 0x03;
      cpu.steps(20);
      const state = cpu.status();
      assert.strictEqual(state.a, 8, "A should be 5+3=8");
      assert.strictEqual(state.f & 0x01, 0, "Carry should be clear");
    });

    it("should set carry flag on overflow", () => {
      memory[0] = 0x3E; // LD A,0xFF
      memory[1] = 0xFF;
      memory[2] = 0xC6; // ADD A,2
      memory[3] = 0x02;
      cpu.steps(20);
      const state = cpu.status();
      assert.strictEqual(state.a, 1, "A should be 0x01 (wrapped)");
      assert.strictEqual(state.f & 0x01, 1, "Carry should be set");
    });

    it("should subtract with borrow", () => {
      memory[0] = 0x3E; // LD A,10
      memory[1] = 0x0A;
      memory[2] = 0xD6; // SUB 5
      memory[3] = 0x05;
      cpu.steps(20);
      const state = cpu.status();
      assert.strictEqual(state.a, 5, "A should be 10-5=5");
      assert.strictEqual(state.f & 0x02, 0x02, "N flag should be set");
    });

    it("should increment register", () => {
      memory[0] = 0x06; // LD B,0x7F
      memory[1] = 0x7F;
      memory[2] = 0x04; // INC B
      cpu.steps(20);
      const state = cpu.status();
      assert.strictEqual(state.b, 0x80, "B should be 0x80");
      assert.strictEqual(state.f & 0x04, 0x04, "Overflow flag should be set");
    });

    it("should decrement register", () => {
      memory[0] = 0x06; // LD B,1
      memory[1] = 0x01;
      memory[2] = 0x05; // DEC B
      cpu.steps(20);
      const state = cpu.status();
      assert.strictEqual(state.b, 0, "B should be 0");
      assert.strictEqual(state.f & 0x40, 0x40, "Zero flag should be set");
    });
  });

  describe("Logical Operations", () => {
    it("should AND registers", () => {
      memory[0] = 0x3E; // LD A,0x0F
      memory[1] = 0x0F;
      memory[2] = 0x06; // LD B,0xF0
      memory[3] = 0xF0;
      memory[4] = 0xA0; // AND B
      cpu.steps(30);
      const state = cpu.status();
      assert.strictEqual(state.a, 0, "A should be 0");
      assert.strictEqual(state.f & 0x10, 0x10, "Half-carry should be set");
    });

    it("should XOR registers", () => {
      memory[0] = 0x3E; // LD A,0xFF
      memory[1] = 0xFF;
      memory[2] = 0xAF; // XOR A
      cpu.steps(20);
      const state = cpu.status();
      assert.strictEqual(state.a, 0, "A should be 0");
      assert.strictEqual(state.f & 0x40, 0x40, "Zero flag should be set");
    });

    it("should OR registers", () => {
      memory[0] = 0x3E; // LD A,0x0F
      memory[1] = 0x0F;
      memory[2] = 0x06; // LD B,0xF0
      memory[3] = 0xF0;
      memory[4] = 0xB0; // OR B
      cpu.steps(30);
      const state = cpu.status();
      assert.strictEqual(state.a, 0xFF, "A should be 0xFF");
    });

    it("should compare registers", () => {
      memory[0] = 0x3E; // LD A,5
      memory[1] = 0x05;
      memory[2] = 0x06; // LD B,5
      memory[3] = 0x05;
      memory[4] = 0xB8; // CP B
      cpu.steps(30);
      const state = cpu.status();
      assert.strictEqual(state.a, 5, "A should be unchanged");
      assert.strictEqual(state.f & 0x40, 0x40, "Zero flag should be set");
    });
  });

  describe("Alternate Registers", () => {
    it("should exchange AF with AF'", () => {
      memory[0] = 0x3E; // LD A,0x42
      memory[1] = 0x42;
      memory[2] = 0x08; // EX AF,AF'
      memory[3] = 0x3E; // LD A,0x99
      memory[4] = 0x99;
      memory[5] = 0x08; // EX AF,AF'
      cpu.steps(50);
      const state = cpu.status();
      assert.strictEqual(state.a, 0x42, "A should be restored to 0x42");
    });

    it("should exchange register banks with EXX", () => {
      memory[0] = 0x01; // LD BC,0x1234
      memory[1] = 0x34;
      memory[2] = 0x12;
      memory[3] = 0xD9; // EXX
      memory[4] = 0x01; // LD BC,0x5678
      memory[5] = 0x78;
      memory[6] = 0x56;
      memory[7] = 0xD9; // EXX
      cpu.steps(50);
      const state = cpu.status();
      assert.strictEqual(state.bc, 0x1234, "BC should be restored");
    });
  });

  describe("Index Registers", () => {
    it("should load IX", () => {
      memory[0] = 0xDD; // LD IX,0x4000
      memory[1] = 0x21;
      memory[2] = 0x00;
      memory[3] = 0x40;
      cpu.steps(20);
      const state = cpu.status();
      assert.strictEqual(state.ix, 0x4000, "IX should be 0x4000");
    });

    it("should load IY", () => {
      memory[0] = 0xFD; // LD IY,0x5000
      memory[1] = 0x21;
      memory[2] = 0x00;
      memory[3] = 0x50;
      cpu.steps(20);
      const state = cpu.status();
      assert.strictEqual(state.iy, 0x5000, "IY should be 0x5000");
    });

    it("should use IX with offset", () => {
      memory[0] = 0xDD; // LD IX,0x4000
      memory[1] = 0x21;
      memory[2] = 0x00;
      memory[3] = 0x40;
      memory[4] = 0xDD; // LD (IX+5),0x42
      memory[5] = 0x36;
      memory[6] = 0x05;
      memory[7] = 0x42;
      memory[0x4005] = 0x00; // Target location
      cpu.steps(50);
      assert.strictEqual(memory[0x4005], 0x42, "Memory at IX+5 should be 0x42");
    });

    it("should increment IX", () => {
      memory[0] = 0xDD; // LD IX,0x1000
      memory[1] = 0x21;
      memory[2] = 0x00;
      memory[3] = 0x10;
      memory[4] = 0xDD; // INC IX
      memory[5] = 0x23;
      cpu.steps(30);
      const state = cpu.status();
      assert.strictEqual(state.ix, 0x1001, "IX should be incremented");
    });
  });

  describe("Special Registers", () => {
    it("should set I register", () => {
      memory[0] = 0x3E; // LD A,0x38
      memory[1] = 0x38;
      memory[2] = 0xED; // LD I,A
      memory[3] = 0x47;
      cpu.steps(30);
      const state = cpu.status();
      assert.strictEqual(state.i, 0x38, "I should be 0x38");
    });

    it("should read I register", () => {
      cpu.set("I", 0x55);
      memory[0] = 0xED; // LD A,I
      memory[1] = 0x57;
      cpu.steps(20);
      const state = cpu.status();
      assert.strictEqual(state.a, 0x55, "A should equal I");
    });

    it("should increment R register on instruction fetch", () => {
      const r_before = cpu.status().r;
      memory[0] = 0x00; // NOP
      memory[1] = 0x00; // NOP
      memory[2] = 0x00; // NOP
      memory[3] = 0x00; // NOP
      memory[4] = 0x00; // NOP
      cpu.step();
      cpu.step();
      cpu.step();
      cpu.step();
      cpu.step();
      const r_after = cpu.status().r;
      // R should increment by 5 (masked to 7 bits for low byte)
      const diff = (r_after - r_before) & 0x7F;
      assert.strictEqual(diff, 5, "R should increment by 5");
    });
  });

  describe("CB Prefix (Bit Operations)", () => {
    it("should rotate left through carry", () => {
      memory[0] = 0x3E; // LD A,0x81
      memory[1] = 0x81;
      memory[2] = 0xCB; // RL A
      memory[3] = 0x17;
      cpu.steps(30);
      const state = cpu.status();
      assert.strictEqual(state.a, 0x02, "A should be 0x02");
      assert.strictEqual(state.f & 0x01, 0x01, "Carry should be set");
    });

    it("should test bit", () => {
      memory[0] = 0x3E; // LD A,0x40
      memory[1] = 0x40;
      memory[2] = 0xCB; // BIT 6,A
      memory[3] = 0x77;
      cpu.steps(30);
      const state = cpu.status();
      assert.strictEqual(state.f & 0x40, 0, "Zero flag should be clear (bit 6 is set)");
    });

    it("should set bit", () => {
      memory[0] = 0x3E; // LD A,0x00
      memory[1] = 0x00;
      memory[2] = 0xCB; // SET 5,A
      memory[3] = 0xEF;
      cpu.steps(30);
      const state = cpu.status();
      assert.strictEqual(state.a, 0x20, "A should have bit 5 set");
    });

    it("should reset bit", () => {
      memory[0] = 0x3E; // LD A,0xFF
      memory[1] = 0xFF;
      memory[2] = 0xCB; // RES 3,A
      memory[3] = 0x9F;
      cpu.steps(30);
      const state = cpu.status();
      assert.strictEqual(state.a, 0xF7, "A should have bit 3 cleared");
    });
  });

  describe("ED Prefix (Extended Instructions)", () => {
    it("should perform block transfer (LDI)", () => {
      cpu.set("HL", 0x1000);
      cpu.set("DE", 0x2000);
      cpu.set("BC", 0x0001);
      memory[0x1000] = 0x42;
      memory[0] = 0xED; // LDI
      memory[1] = 0xA0;
      cpu.steps(30);
      const state = cpu.status();
      assert.strictEqual(memory[0x2000], 0x42, "Byte should be transferred");
      assert.strictEqual(state.hl, 0x1001, "HL should increment");
      assert.strictEqual(state.de, 0x2001, "DE should increment");
      assert.strictEqual(state.bc, 0x0000, "BC should decrement");
    });

    it("should add with carry to HL", () => {
      memory[0] = 0x21; // LD HL,0x1000
      memory[1] = 0x00;
      memory[2] = 0x10;
      memory[3] = 0x01; // LD BC,0x0500
      memory[4] = 0x00;
      memory[5] = 0x05;
      memory[6] = 0xED; // ADC HL,BC
      memory[7] = 0x4A;
      cpu.steps(50);
      const state = cpu.status();
      assert.strictEqual(state.hl, 0x1500, "HL should be 0x1500");
    });

    it("should negate accumulator", () => {
      memory[0] = 0x3E; // LD A,5
      memory[1] = 0x05;
      memory[2] = 0xED; // NEG
      memory[3] = 0x44;
      cpu.steps(30);
      const state = cpu.status();
      assert.strictEqual(state.a, 0xFB, "A should be -5 (two's complement)");
      assert.strictEqual(state.f & 0x01, 0x01, "Carry should be set");
    });
  });

  describe("Stack Operations", () => {
    it("should push and pop", () => {
      memory[0] = 0x21; // LD HL,0x1234
      memory[1] = 0x34;
      memory[2] = 0x12;
      memory[3] = 0xE5; // PUSH HL
      memory[4] = 0xE1; // POP HL
      cpu.set("SP", 0xFFFE);
      cpu.steps(50);
      const state = cpu.status();
      assert.strictEqual(state.hl, 0x1234, "HL should be preserved");
      assert.strictEqual(state.sp, 0xFFFE, "SP should be restored");
    });

    it("should call and return", () => {
      memory[0] = 0xCD; // CALL 0x1000
      memory[1] = 0x00;
      memory[2] = 0x10;
      memory[0x1000] = 0xC9; // RET
      cpu.set("SP", 0xFFFE);
      cpu.step(); // CALL
      cpu.step(); // RET
      const state = cpu.status();
      assert.strictEqual(state.pc, 3, "PC should return to after CALL");
    });
  });

  describe("Jumps", () => {
    it("should jump unconditionally", () => {
      memory[0] = 0xC3; // JP 0x1000
      memory[1] = 0x00;
      memory[2] = 0x10;
      cpu.step();
      const state = cpu.status();
      assert.strictEqual(state.pc, 0x1000, "PC should jump to 0x1000");
    });

    it("should jump conditionally (taken)", () => {
      memory[0] = 0xAF; // XOR A (set Z flag)
      memory[1] = 0xCA; // JP Z,0x1000
      memory[2] = 0x00;
      memory[3] = 0x10;
      cpu.step(); // XOR A
      cpu.step(); // JP Z,0x1000
      const state = cpu.status();
      assert.strictEqual(state.pc, 0x1000, "PC should jump when Z set");
    });

    it("should jump conditionally (not taken)", () => {
      memory[0] = 0x3E; // LD A,1 (clear Z flag)
      memory[1] = 0x01;
      memory[2] = 0xCA; // JP Z,0x1000
      memory[3] = 0x00;
      memory[4] = 0x10;
      cpu.step(); // LD A,1
      cpu.step(); // JP Z,0x1000 (not taken)
      const state = cpu.status();
      assert.strictEqual(state.pc, 5, "PC should not jump when Z clear");
    });

    it("should relative jump", () => {
      memory[0] = 0x18; // JR +10
      memory[1] = 0x0A;
      cpu.step();
      const state = cpu.status();
      assert.strictEqual(state.pc, 12, "PC should be 0+2+10=12");
    });
  });

  describe("Interrupt Modes", () => {
    it("should set interrupt mode 0", () => {
      memory[0] = 0xED; // IM 0
      memory[1] = 0x46;
      cpu.steps(20);
      const state = cpu.status();
      assert.strictEqual(state.im, 0, "IM should be 0");
    });

    it("should set interrupt mode 1", () => {
      memory[0] = 0xED; // IM 1
      memory[1] = 0x56;
      cpu.steps(20);
      const state = cpu.status();
      assert.strictEqual(state.im, 1, "IM should be 1");
    });

    it("should set interrupt mode 2", () => {
      memory[0] = 0xED; // IM 2
      memory[1] = 0x5E;
      cpu.steps(20);
      const state = cpu.status();
      assert.strictEqual(state.im, 2, "IM should be 2");
    });

    it("should enable interrupts", () => {
      memory[0] = 0xFB; // EI
      cpu.step();
      const state = cpu.status();
      assert.strictEqual(state.iff1, 1, "IFF1 should be set");
      assert.strictEqual(state.iff2, 1, "IFF2 should be set");
    });

    it("should disable interrupts", () => {
      memory[0] = 0xFB; // EI
      memory[1] = 0xF3; // DI
      cpu.steps(20);
      const state = cpu.status();
      assert.strictEqual(state.iff1, 0, "IFF1 should be clear");
      assert.strictEqual(state.iff2, 0, "IFF2 should be clear");
    });

    it("should handle interrupt in IM 1", () => {
      memory[0] = 0xFB; // EI
      memory[1] = 0x00; // NOP
      memory[0x0038] = 0xC9; // RET at interrupt handler
      cpu.set("SP", 0xFFFE);
      cpu.steps(20);
      cpu.interrupt(); // Request interrupt
      cpu.steps(30);
      const state = cpu.status();
      assert.strictEqual(state.iff1, 0, "Interrupts should be disabled");
    });
  });

  describe("Halt", () => {
    it("should halt execution", () => {
      memory[0] = 0x76; // HALT
      cpu.step();
      const state = cpu.status();
      assert.strictEqual(state.halted, true, "CPU should be halted");
      assert.strictEqual(state.pc, 0, "PC should stay on HALT");
    });
  });

  describe("Cycle Counting", () => {
    it("should count cycles correctly", () => {
      memory[0] = 0x00; // NOP (4 cycles)
      memory[1] = 0x00; // NOP (4 cycles)
      const t_before = cpu.T();
      cpu.step(); // 4 cycles
      cpu.step(); // 4 cycles
      const t_after = cpu.T();
      assert.strictEqual(t_after - t_before, 8, "Should execute 8 T-states (2 NOPs)");
    });

    it("should count multi-byte instruction cycles", () => {
      memory[0] = 0x3E; // LD A,n (7 cycles)
      memory[1] = 0x42;
      const t_before = cpu.T();
      cpu.step();
      const t_after = cpu.T();
      assert.strictEqual(t_after - t_before, 7, "LD A,n should take 7 cycles");
    });
  });

  describe("Flag Handling", () => {
    it("should set sign flag on negative result", () => {
      memory[0] = 0x3E; // LD A,0x80
      memory[1] = 0x80;
      memory[2] = 0xC6; // ADD A,0
      memory[3] = 0x00;
      cpu.steps(30);
      const state = cpu.status();
      assert.strictEqual(state.f & 0x80, 0x80, "Sign flag should be set");
    });

    it("should set zero flag", () => {
      memory[0] = 0xAF; // XOR A
      cpu.step();
      const state = cpu.status();
      assert.strictEqual(state.f & 0x40, 0x40, "Zero flag should be set");
    });

    it("should set undocumented Y/X flags from result", () => {
      memory[0] = 0x3E; // LD A,0x28 (has Y and X bits)
      memory[1] = 0x28;
      memory[2] = 0xC6; // ADD A,0
      memory[3] = 0x00;
      cpu.steps(30);
      const state = cpu.status();
      assert.strictEqual(state.f & 0x20, 0x20, "Y flag should be set");
      assert.strictEqual(state.f & 0x08, 0x08, "X flag should be set");
    });

    it("should format flags to string", () => {
      memory[0] = 0xAF; // XOR A (sets Z and P flags)
      cpu.step();
      const flags = cpu.flagsToString();
      assert.match(flags, /Z/, "Should show Z flag set");
      assert.match(flags, /P/, "Should show P flag set");
    });
  });

  describe("Public API", () => {
    it("should get status", () => {
      const state = cpu.status();
      assert.ok(typeof state.pc === "number", "Should have PC");
      assert.ok(typeof state.sp === "number", "Should have SP");
      assert.ok(typeof state.af === "number", "Should have AF");
    });

    it("should set register", () => {
      cpu.set("A", 0x42);
      const state = cpu.status();
      assert.strictEqual(state.a, 0x42, "A should be 0x42");
    });

    it("should read memory", () => {
      memory[0x1234] = 0x99;
      const value = cpu.memr(0x1234);
      assert.strictEqual(value, 0x99, "Should read memory");
    });

    it("should reset CPU", () => {
      cpu.set("PC", 0x1234);
      cpu.set("A", 0x42);
      cpu.reset();
      const state = cpu.status();
      assert.strictEqual(state.pc, 0, "PC should be reset");
      assert.strictEqual(state.a, 0, "A should be reset");
    });
  });
});
