/**
 * Motorola 6800 CPU Emulator - Smoke Tests
 *
 * Basic verification that the 6800 emulator module loads and executes
 * fundamental instructions correctly.
 */

import QUnit from "qunit";
import CPU6800 from "../src/6800.js";

QUnit.module("6800 Smoke Tests", () => {
  QUnit.test("Module loads and creates instance", (assert) => {
    const memory = new Array(65536).fill(0);

    const cpu = CPU6800({
      byteTo: (addr, value) => { memory[addr & 0xffff] = value & 0xff; },
      byteAt: (addr) => memory[addr & 0xffff] & 0xff
    });

    assert.ok(cpu, "CPU instance created");
    assert.ok(typeof cpu.reset === "function", "reset method exists");
    assert.ok(typeof cpu.steps === "function", "steps method exists");
    assert.ok(typeof cpu.status === "function", "status method exists");
  });

  QUnit.test("Reset initializes CPU state", (assert) => {
    const memory = new Array(65536).fill(0);

    // Set reset vector to 0x1000
    memory[0xfffe] = 0x10;
    memory[0xffff] = 0x00;

    const cpu = CPU6800({
      byteTo: (addr, value) => { memory[addr & 0xffff] = value & 0xff; },
      byteAt: (addr) => memory[addr & 0xffff] & 0xff
    });

    cpu.reset();
    const state = cpu.status();

    assert.equal(state.pc, 0x1000, "PC loaded from reset vector");
    assert.equal(state.a, 0, "Accumulator A cleared");
    assert.equal(state.b, 0, "Accumulator B cleared");
    assert.equal(state.x, 0, "Index register X cleared");
    assert.equal(state.flags & 0x10, 0x10, "Interrupt flag set");
  });

  QUnit.test("LDA immediate - Load accumulator A", (assert) => {
    const memory = new Array(65536).fill(0);

    // Set reset vector
    memory[0xfffe] = 0x10;
    memory[0xffff] = 0x00;

    // Program: LDAA #$42 at 0x1000
    memory[0x1000] = 0x86; // LDAA immediate
    memory[0x1001] = 0x42; // Value

    const cpu = CPU6800({
      byteTo: (addr, value) => { memory[addr & 0xffff] = value & 0xff; },
      byteAt: (addr) => memory[addr & 0xffff] & 0xff
    });

    cpu.reset();
    cpu.steps(2); // Execute one instruction

    const state = cpu.status();
    assert.equal(state.a, 0x42, "Accumulator A loaded with 0x42");
    assert.equal(state.pc, 0x1002, "PC advanced by 2 bytes");
  });

  QUnit.test("LDB immediate - Load accumulator B", (assert) => {
    const memory = new Array(65536).fill(0);

    memory[0xfffe] = 0x10;
    memory[0xffff] = 0x00;

    // Program: LDAB #$55
    memory[0x1000] = 0xc6; // LDAB immediate
    memory[0x1001] = 0x55;

    const cpu = CPU6800({
      byteTo: (addr, value) => { memory[addr & 0xffff] = value & 0xff; },
      byteAt: (addr) => memory[addr & 0xffff] & 0xff
    });

    cpu.reset();
    cpu.steps(2);

    const state = cpu.status();
    assert.equal(state.b, 0x55, "Accumulator B loaded with 0x55");
  });

  QUnit.test("ADD operation and flag updates", (assert) => {
    const memory = new Array(65536).fill(0);

    memory[0xfffe] = 0x10;
    memory[0xffff] = 0x00;

    // Program:
    // LDAA #$20
    // ADDA #$30
    memory[0x1000] = 0x86; // LDAA immediate
    memory[0x1001] = 0x20;
    memory[0x1002] = 0x8b; // ADDA immediate
    memory[0x1003] = 0x30;

    const cpu = CPU6800({
      byteTo: (addr, value) => { memory[addr & 0xffff] = value & 0xff; },
      byteAt: (addr) => memory[addr & 0xffff] & 0xff
    });

    cpu.reset();
    cpu.steps(2); // LDAA
    cpu.steps(2); // ADDA

    const state = cpu.status();
    assert.equal(state.a, 0x50, "A = 0x20 + 0x30 = 0x50");
    assert.equal(state.flags & 0x04, 0x00, "Zero flag clear");
    assert.equal(state.flags & 0x08, 0x00, "Negative flag clear");
  });

  QUnit.test("Store to memory", (assert) => {
    const memory = new Array(65536).fill(0);

    memory[0xfffe] = 0x10;
    memory[0xffff] = 0x00;

    // Program:
    // LDAA #$AA
    // STAA $50
    memory[0x1000] = 0x86; // LDAA immediate
    memory[0x1001] = 0xaa;
    memory[0x1002] = 0x97; // STAA direct
    memory[0x1003] = 0x50; // Address

    const cpu = CPU6800({
      byteTo: (addr, value) => { memory[addr & 0xffff] = value & 0xff; },
      byteAt: (addr) => memory[addr & 0xffff] & 0xff
    });

    cpu.reset();
    cpu.steps(2); // LDAA
    cpu.steps(2); // STAA

    assert.equal(memory[0x50], 0xaa, "Value stored to memory at 0x50");
  });

  QUnit.test("Zero flag set when result is zero", (assert) => {
    const memory = new Array(65536).fill(0);

    memory[0xfffe] = 0x10;
    memory[0xffff] = 0x00;

    // Program:
    // LDAA #$42
    // SUBA #$42  (result should be 0)
    memory[0x1000] = 0x86; // LDAA immediate
    memory[0x1001] = 0x42;
    memory[0x1002] = 0x80; // SUBA immediate
    memory[0x1003] = 0x42;

    const cpu = CPU6800({
      byteTo: (addr, value) => { memory[addr & 0xffff] = value & 0xff; },
      byteAt: (addr) => memory[addr & 0xffff] & 0xff
    });

    cpu.reset();
    cpu.steps(2); // LDAA
    cpu.steps(2); // SUBA

    const state = cpu.status();
    assert.equal(state.a, 0, "Result is zero");
    assert.equal(state.flags & 0x04, 0x04, "Zero flag set");
  });

  QUnit.test("Negative flag set when result is negative", (assert) => {
    const memory = new Array(65536).fill(0);

    memory[0xfffe] = 0x10;
    memory[0xffff] = 0x00;

    // Program: LDAA #$FF (which has bit 7 set)
    memory[0x1000] = 0x86; // LDAA immediate
    memory[0x1001] = 0xff;

    const cpu = CPU6800({
      byteTo: (addr, value) => { memory[addr & 0xffff] = value & 0xff; },
      byteAt: (addr) => memory[addr & 0xffff] & 0xff
    });

    cpu.reset();
    cpu.steps(2);

    const state = cpu.status();
    assert.equal(state.a, 0xff, "A = 0xFF");
    assert.equal(state.flags & 0x08, 0x08, "Negative flag set");
  });

  QUnit.test("Index register operations", (assert) => {
    const memory = new Array(65536).fill(0);

    memory[0xfffe] = 0x10;
    memory[0xffff] = 0x00;

    // Program: LDX #$1234
    memory[0x1000] = 0xce; // LDX immediate
    memory[0x1001] = 0x12;
    memory[0x1002] = 0x34;

    const cpu = CPU6800({
      byteTo: (addr, value) => { memory[addr & 0xffff] = value & 0xff; },
      byteAt: (addr) => memory[addr & 0xffff] & 0xff
    });

    cpu.reset();
    cpu.steps(3);

    const state = cpu.status();
    assert.equal(state.x, 0x1234, "X loaded with 0x1234");
  });

  QUnit.test("Indexed addressing mode", (assert) => {
    const memory = new Array(65536).fill(0);

    memory[0xfffe] = 0x10;
    memory[0xffff] = 0x00;

    // Set up data at 0x2010
    memory[0x2010] = 0x99;

    // Program:
    // LDX #$2000
    // LDAA $10,X  (loads from 0x2010)
    memory[0x1000] = 0xce; // LDX immediate
    memory[0x1001] = 0x20;
    memory[0x1002] = 0x00;
    memory[0x1003] = 0xa6; // LDAA indexed
    memory[0x1004] = 0x10; // Offset

    const cpu = CPU6800({
      byteTo: (addr, value) => { memory[addr & 0xffff] = value & 0xff; },
      byteAt: (addr) => memory[addr & 0xffff] & 0xff
    });

    cpu.reset();
    cpu.steps(3); // LDX
    cpu.steps(5); // LDAA indexed

    const state = cpu.status();
    assert.equal(state.a, 0x99, "Loaded value from indexed address");
  });

  QUnit.test("Cycle counting is accurate", (assert) => {
    const memory = new Array(65536).fill(0);

    memory[0xfffe] = 0x10;
    memory[0xffff] = 0x00;

    // LDAA immediate takes 2 cycles
    memory[0x1000] = 0x86;
    memory[0x1001] = 0x42;

    const cpu = CPU6800({
      byteTo: (addr, value) => { memory[addr & 0xffff] = value & 0xff; },
      byteAt: (addr) => memory[addr & 0xffff] & 0xff
    });

    cpu.reset();
    const initialCycles = cpu.T();
    cpu.steps(2);
    const finalCycles = cpu.T();

    assert.equal(finalCycles - initialCycles, 2, "LDAA immediate took 2 cycles");
  });
});
