/**
 * 8080 Emulator End-to-End Demonstration
 *
 * Simple demonstration of the modernized ES6 8080 emulator.
 * Run with: node test/8080-demo.js
 */

import create8080 from "../src/8080.js";

// Create memory and I/O infrastructure
const mem = new Uint8Array(65536);

const cpu = create8080({
  byteAt: (addr) => mem[addr] || 0,
  byteTo: (addr, val) => { mem[addr] = val & 0xFF; },
  portOut: (port, val) => console.log(`OUT port ${port}: 0x${val.toString(16).toUpperCase()}`),
  portIn: (port) => 0xFF
});

console.log("8080 CPU Emulator ES6 - Demo\n");

// Test 1: Basic MVI instruction
console.log("Test 1: MVI A, 0x42");
cpu.reset();
cpu.set("PC", 0x0000);
mem[0x0000] = 0x3E; // MVI A, n
mem[0x0001] = 0x42;
cpu.steps(7); // MVI takes 7 cycles

const state1 = cpu.status();
console.log(`  A = 0x${state1.a.toString(16).toUpperCase()}`);
console.log(`  Cycles: ${cpu.T()}`);
console.log(`  ${state1.a === 0x42 ? '✓ PASS' : '✗ FAIL'}\n`);

// Test 2: Arithmetic operation
console.log("Test 2: ADD - Add two numbers (0x10 + 0x20)");
cpu.reset();
mem[0x0000] = 0x3E; // MVI A, 0x10
mem[0x0001] = 0x10;
mem[0x0002] = 0x06; // MVI B, 0x20
mem[0x0003] = 0x20;
mem[0x0004] = 0x80; // ADD B
cpu.steps(18);

const state2 = cpu.status();
console.log(`  A = 0x${state2.a.toString(16).toUpperCase()} (expected 0x30)`);
console.log(`  ${state2.a === 0x30 ? '✓ PASS' : '✗ FAIL'}\n`);

// Test 3: Memory operations
console.log("Test 3: Memory store/load");
cpu.reset();
mem[0x0000] = 0x3E; // MVI A, 0x99
mem[0x0001] = 0x99;
mem[0x0002] = 0x32; // STA (0x3000)
mem[0x0003] = 0x00;
mem[0x0004] = 0x30;
mem[0x0005] = 0x3E; // MVI A, 0x00
mem[0x0006] = 0x00;
mem[0x0007] = 0x3A; // LDA (0x3000)
mem[0x0008] = 0x00;
mem[0x0009] = 0x30;
cpu.steps(40);

const state3 = cpu.status();
console.log(`  Memory[0x3000] = 0x${mem[0x3000].toString(16).toUpperCase()}`);
console.log(`  A = 0x${state3.a.toString(16).toUpperCase()}`);
console.log(`  ${state3.a === 0x99 ? '✓ PASS' : '✗ FAIL'}\n`);

// Test 4: Loop execution
console.log("Test 4: Count from 0 to 5");
cpu.reset();
mem[0x0000] = 0x3E; // MVI A, 0
mem[0x0001] = 0x00;
mem[0x0002] = 0x06; // MVI B, 5
mem[0x0003] = 0x05;
// LOOP:
mem[0x0004] = 0x3C; // INR A
mem[0x0005] = 0x05; // DCR B
mem[0x0006] = 0xC2; // JNZ LOOP
mem[0x0007] = 0x04;
mem[0x0008] = 0x00;
cpu.steps(500); // Run enough cycles for loop

const state4 = cpu.status();
console.log(`  A = 0x${state4.a.toString(16).toUpperCase()} (expected 0x05)`);
console.log(`  B = 0x${state4.b.toString(16).toUpperCase()} (expected 0x00)`);
console.log(`  Total cycles: ${cpu.T()}`);
console.log(`  ${state4.a === 5 && state4.b === 0 ? '✓ PASS' : '✗ FAIL'}\n`);

// Test 5: Subroutine call
console.log("Test 5: CALL/RET subroutine");
cpu.reset();
cpu.set("SP", 0xF000);
mem[0x0000] = 0xCD; // CALL 0x0010
mem[0x0001] = 0x10;
mem[0x0002] = 0x00;
mem[0x0003] = 0x76; // HLT
// Subroutine at 0x0010
mem[0x0010] = 0x3E; // MVI A, 0x77
mem[0x0011] = 0x77;
mem[0x0012] = 0xC9; // RET
cpu.steps(50);

const state5 = cpu.status();
console.log(`  A = 0x${state5.a.toString(16).toUpperCase()} (expected 0x77)`);
console.log(`  PC = 0x${state5.pc.toString(16).toUpperCase()} (expected 0x0004 after HLT)`);
console.log(`  SP = 0x${state5.sp.toString(16).toUpperCase()} (expected 0xF000)`);
console.log(`  ${state5.a === 0x77 && state5.sp === 0xF000 ? '✓ PASS' : '✗ FAIL'}\n`);

// Test 6: Flag operations
console.log("Test 6: Flags - Zero and Carry");
cpu.reset();
mem[0x0000] = 0x3E; // MVI A, 0xFF
mem[0x0001] = 0xFF;
mem[0x0002] = 0xC6; // ADI 0x01
mem[0x0003] = 0x01;
cpu.steps(14);

const state6 = cpu.status();
const flags = cpu.flagsToString();
console.log(`  A = 0x${state6.a.toString(16).toUpperCase()} (wrapped to 0x00)`);
console.log(`  Flags: ${flags}`);
console.log(`  Zero flag: ${flags[1] === 'Z' ? 'SET' : 'CLEAR'}`);
console.log(`  Carry flag: ${flags[7] === 'C' ? 'SET' : 'CLEAR'}`);
console.log(`  ${state6.a === 0 && flags[1] === 'Z' && flags[7] === 'C' ? '✓ PASS' : '✗ FAIL'}\n`);

console.log("All demonstrations completed!");
console.log("\nModernized ES6 8080 Emulator:");
console.log("  ✓ Factory function pattern (no classes)");
console.log("  ✓ Arrow functions throughout");
console.log("  ✓ const/let only (no var)");
console.log("  ✓ ES6 modules (import/export)");
console.log("  ✓ Cycle-accurate execution");
console.log("  ✓ Hardware-compatible flags");
