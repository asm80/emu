/**
 * Smoke tests for Hitachi HD6309 CPU emulator
 *
 * Tests critical functionality:
 * - Module loading
 * - Reset functionality
 * - Basic operations (LDA, ADD, STA)
 * - TFR/EXG instructions (the PROBLEM area)
 * - Dual stack operations (S and U)
 * - Direct page register (DP)
 */

import QUnit from "qunit";
import CPU6309 from "../src/6309.js";

QUnit.module("HD6309 Smoke Tests");

const makeCPU = (mem) => CPU6309({
  byteTo: (addr, val) => { mem[addr] = val; },
  byteAt: (addr) => mem[addr],
});

QUnit.test("Module loads and initializes", (assert) => {
  const mem = new Uint8Array(0x10000);
  const cpu = makeCPU(mem);
  assert.ok(cpu, "CPU factory returns object");
  assert.ok(cpu.reset, "reset method exists");
  assert.ok(cpu.steps, "steps method exists");
  assert.ok(cpu.status, "status method exists");
  assert.ok(cpu.interrupt, "interrupt method exists");
  assert.ok(cpu.nmi, "nmi method exists");
  assert.ok(cpu.set, "set method exists");
  assert.ok(cpu.flagsToString, "flagsToString method exists");
  assert.ok(cpu.disasm, "disasm method exists");
});

QUnit.test("Reset initializes CPU properly", (assert) => {
  const mem = new Uint8Array(0x10000);
  mem[0xfffe] = 0x80; // Reset vector high byte
  mem[0xffff] = 0x00; // Reset vector low byte

  const cpu = makeCPU(mem);

  const state = cpu.status();
  assert.equal(state.pc, 0x8000, "PC loaded from reset vector");
  assert.equal(state.flags & 0x50, 0x50, "IRQ and FIRQ masks set after reset");
});

QUnit.test("Basic LDA immediate", (assert) => {
  const mem = new Uint8Array(0x10000);
  mem[0xfffe] = 0x10; // Reset vector
  mem[0xffff] = 0x00;

  mem[0x1000] = 0x86; // LDA immediate
  mem[0x1001] = 0x42; // Value $42

  const cpu = makeCPU(mem);

  cpu.steps(2); // Execute LDA

  const state = cpu.status();
  assert.equal(state.a, 0x42, "A register loaded with $42");
  assert.equal(state.pc, 0x1002, "PC advanced by 2 bytes");
});

QUnit.test("ADD operation sets flags correctly", (assert) => {
  const mem = new Uint8Array(0x10000);
  mem[0xfffe] = 0x10; // Reset vector
  mem[0xffff] = 0x00;

  mem[0x1000] = 0x86; // LDA immediate
  mem[0x1001] = 0x80; // Value $80 (negative)
  mem[0x1002] = 0x8b; // ADDA immediate
  mem[0x1003] = 0x80; // Add $80

  const cpu = makeCPU(mem);

  cpu.steps(4); // Execute LDA + ADDA

  const state = cpu.status();
  assert.equal(state.a, 0x00, "A = $80 + $80 = $00 (with carry)");
  assert.ok(state.flags & 0x04, "Zero flag set");
  assert.ok(state.flags & 0x01, "Carry flag set");
  assert.ok(state.flags & 0x02, "Overflow flag set (signed overflow)");
});

QUnit.test("TFR instruction works correctly (16-bit to 16-bit)", (assert) => {
  const mem = new Uint8Array(0x10000);
  mem[0xfffe] = 0x10; // Reset vector
  mem[0xffff] = 0x00;

  mem[0x1000] = 0x8e; // LDX immediate (16-bit)
  mem[0x1001] = 0x12; // $1234
  mem[0x1002] = 0x34;
  mem[0x1003] = 0x1f; // TFR X,Y
  mem[0x1004] = 0x12; // X=1, Y=2

  const cpu = makeCPU(mem);

  cpu.steps(7); // Execute LDX + TFR

  const state = cpu.status();
  assert.equal(state.x, 0x1234, "X = $1234");
  assert.equal(state.y, 0x1234, "Y transferred from X");
});

QUnit.test("TFR 8-bit to 8-bit works", (assert) => {
  const mem = new Uint8Array(0x10000);
  mem[0xfffe] = 0x10;
  mem[0xffff] = 0x00;

  mem[0x1000] = 0x86; // LDA immediate
  mem[0x1001] = 0xAB; // $AB
  mem[0x1002] = 0x1f; // TFR A,B
  mem[0x1003] = 0x89; // A=8, B=9

  const cpu = makeCPU(mem);

  cpu.steps(4); // Execute LDA + TFR

  const state = cpu.status();
  assert.equal(state.a, 0xAB, "A = $AB");
  assert.equal(state.b, 0xAB, "B transferred from A");
});

QUnit.test("TFR mixed sizes is no-op (FIXED BUG)", (assert) => {
  const mem = new Uint8Array(0x10000);
  mem[0xfffe] = 0x10;
  mem[0xffff] = 0x00;

  mem[0x1000] = 0x8e; // LDX immediate
  mem[0x1001] = 0x12; // $1234
  mem[0x1002] = 0x34;
  mem[0x1003] = 0x86; // LDA immediate
  mem[0x1004] = 0x56; // $56
  mem[0x1005] = 0x1f; // TFR X,A (16-bit to 8-bit - INVALID!)
  mem[0x1006] = 0x18; // X=1, A=8

  const cpu = makeCPU(mem);

  cpu.steps(7); // Execute LDX + LDA + TFR

  const state = cpu.status();
  assert.equal(state.x, 0x1234, "X unchanged");
  assert.equal(state.a, 0x56, "A unchanged (mixed-size TFR treated as no-op)");
});

QUnit.test("EXG exchanges registers", (assert) => {
  const mem = new Uint8Array(0x10000);
  mem[0xfffe] = 0x10;
  mem[0xffff] = 0x00;

  mem[0x1000] = 0x8e; // LDX immediate
  mem[0x1001] = 0xAA; // $AAAA
  mem[0x1002] = 0xAA;
  mem[0x1003] = 0x10; // LDY immediate
  mem[0x1004] = 0x8e;
  mem[0x1005] = 0xBB; // $BBBB
  mem[0x1006] = 0xBB;
  mem[0x1007] = 0x1e; // EXG X,Y
  mem[0x1008] = 0x12; // X=1, Y=2

  const cpu = makeCPU(mem);

  cpu.steps(10); // Execute LDX + LDY + EXG

  const state = cpu.status();
  assert.equal(state.x, 0xBBBB, "X now contains original Y value");
  assert.equal(state.y, 0xAAAA, "Y now contains original X value");
});

QUnit.test("System stack (S) operations", (assert) => {
  const mem = new Uint8Array(0x10000);
  mem[0xfffe] = 0x10;
  mem[0xffff] = 0x00;

  mem[0x1000] = 0x10; // LDS immediate
  mem[0x1001] = 0xce;
  mem[0x1002] = 0x20; // S = $2000
  mem[0x1003] = 0x00;
  mem[0x1004] = 0x86; // LDA immediate
  mem[0x1005] = 0x42;
  mem[0x1006] = 0x34; // PSHS A
  mem[0x1007] = 0x02; // Push A register

  const cpu = makeCPU(mem);

  cpu.steps(12); // Execute LDS + LDA + PSHS

  const state = cpu.status();
  assert.equal(state.sp, 0x1FFF, "S decremented after push");
  assert.equal(mem[0x1FFF], 0x42, "A value pushed to stack");
});

QUnit.test("User stack (U) operations", (assert) => {
  const mem = new Uint8Array(0x10000);
  mem[0xfffe] = 0x10;
  mem[0xffff] = 0x00;

  mem[0x1000] = 0xce; // LDU immediate
  mem[0x1001] = 0x30; // U = $3000
  mem[0x1002] = 0x00;
  mem[0x1003] = 0x86; // LDA immediate
  mem[0x1004] = 0x99;
  mem[0x1005] = 0x36; // PSHU A
  mem[0x1006] = 0x02; // Push A to U stack

  const cpu = makeCPU(mem);

  cpu.steps(11); // Execute LDU + LDA + PSHU

  const state = cpu.status();
  assert.equal(state.u, 0x2FFF, "U decremented after push");
  assert.equal(mem[0x2FFF], 0x99, "A value pushed to U stack");
});

QUnit.test("Direct page register (DP) affects addressing", (assert) => {
  const mem = new Uint8Array(0x10000);
  mem[0xfffe] = 0x10;
  mem[0xffff] = 0x00;

  mem[0x1000] = 0x86; // LDA immediate
  mem[0x1001] = 0x20; // DP = $20
  mem[0x1002] = 0x1f; // TFR A,DP
  mem[0x1003] = 0x8b; // A=8, DP=11

  mem[0x1004] = 0x96; // LDA direct page
  mem[0x1005] = 0x50; // Offset $50 (actual addr = $2050)

  mem[0x2050] = 0xCD; // Data at $2050

  const cpu = makeCPU(mem);

  cpu.steps(12); // Execute LDA immediate (2) + TFR (6) + LDA direct (4)

  const state = cpu.status();
  assert.equal(state.dp, 0x20, "DP = $20");
  assert.equal(state.a, 0xCD, "A loaded from DP:$50 = $2050");
});

QUnit.test("Interrupt handling (IRQ)", (assert) => {
  const mem = new Uint8Array(0x10000);
  mem[0xfffe] = 0x10; // Reset vector
  mem[0xffff] = 0x00;
  mem[0xfff8] = 0x20; // IRQ vector
  mem[0xfff9] = 0x00;

  mem[0x1000] = 0x10; // LDS immediate
  mem[0x1001] = 0xce;
  mem[0x1002] = 0x20; // S = $2000
  mem[0x1003] = 0x00;
  mem[0x1004] = 0x1c; // ANDCC immediate
  mem[0x1005] = 0xEF; // Clear I flag (enable interrupts)

  const cpu = makeCPU(mem);

  cpu.steps(10); // Execute LDS + ANDCC

  const stateBefore = cpu.status();
  assert.equal((stateBefore.flags & 0x10), 0, "I flag cleared (IRQ enabled)");

  cpu.interrupt(); // Trigger IRQ

  const stateAfter = cpu.status();
  assert.equal(stateAfter.pc, 0x2000, "PC vectored to IRQ handler");
  assert.ok(stateAfter.flags & 0x10, "I flag set (IRQ masked)");
  assert.ok(stateAfter.flags & 0x40, "F flag set (FIRQ masked)");
  assert.ok(stateAfter.flags & 0x80, "E flag set (entire state saved)");
  assert.ok(stateAfter.sp < 0x2000, "Stack pointer decremented (state saved)");
});

QUnit.test("NMI handling (Non-Maskable Interrupt)", (assert) => {
  const mem = new Uint8Array(0x10000);
  mem[0xfffe] = 0x10; // Reset vector
  mem[0xffff] = 0x00;
  mem[0xfffc] = 0x30; // NMI vector
  mem[0xfffd] = 0x00;

  mem[0x1000] = 0x10; // LDS immediate
  mem[0x1001] = 0xce;
  mem[0x1002] = 0x20; // S = $2000
  mem[0x1003] = 0x00;

  const cpu = makeCPU(mem);

  cpu.steps(5); // Execute LDS
  cpu.nmi(); // Trigger NMI

  const state = cpu.status();
  assert.equal(state.pc, 0x3000, "PC vectored to NMI handler");
  assert.ok(state.flags & 0x10, "I flag set (IRQ masked during NMI)");
  assert.ok(state.flags & 0x40, "F flag set (FIRQ masked during NMI)");
  assert.ok(state.flags & 0x80, "E flag set (entire state saved)");
});

QUnit.test("Flags to string conversion", (assert) => {
  const mem = new Uint8Array(0x10000);
  mem[0xfffe] = 0x10;
  mem[0xffff] = 0x00;

  const cpu = makeCPU(mem);

  cpu.set("FLAGS", 0xFF); // All flags set
  assert.equal(cpu.flagsToString(), "EFHINZVC", "All flags uppercase when set");

  cpu.set("FLAGS", 0x00); // All flags clear
  assert.equal(cpu.flagsToString(), "efhinzvc", "All flags lowercase when clear");

  cpu.set("FLAGS", 0x05); // Zero and Carry set
  assert.equal(cpu.flagsToString(), "efhinZvC", "Mixed case shows flag state");
});
