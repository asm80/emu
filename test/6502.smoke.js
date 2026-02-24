/**
 * MOS 6502 smoke test - basic verification that module loads and executes
 */

import create6502 from "../src/6502.js";

// Create minimal memory system
const mem = new Uint8Array(65536);

// Write reset vector to $FFFC (little-endian)
mem[0xFFFC] = 0x00;
mem[0xFFFD] = 0x02; // Reset to $0200

// Write simple test program at $0200
// LDA #$42  (Load A with $42)
mem[0x0200] = 0xA9; // LDA immediate
mem[0x0201] = 0x42;
// TAX       (Transfer A to X)
mem[0x0202] = 0xAA;
// INX       (Increment X)
mem[0x0203] = 0xE8;
// BRK       (Break)
mem[0x0204] = 0x00;

// Create CPU instance
const cpu = create6502({
  byteAt: (addr) => mem[addr] || 0,
  byteTo: (addr, val) => { mem[addr] = val & 0xFF; }
});

// Test reset
cpu.reset();
let status = cpu.status();

console.log("MOS 6502 Smoke Test:");
console.log("  PC after reset:", "$" + status.pc.toString(16).toUpperCase());
console.log("  SP after reset:", status.sp);

// Verify reset vector loaded correctly
if (status.pc === 0x0200) {
  console.log("  ✓ Reset vector loaded correctly");
} else {
  console.log("  ✗ Reset vector failed - expected $0200, got $" + status.pc.toString(16).toUpperCase());
  process.exit(1);
}

// Execute LDA #$42 (2 cycles)
cpu.steps(2);
status = cpu.status();

if (status.a === 0x42) {
  console.log("  ✓ LDA immediate works (A = $42)");
} else {
  console.log("  ✗ LDA failed - expected $42, got $" + status.a.toString(16).toUpperCase());
  process.exit(1);
}

// Execute TAX (2 cycles)
cpu.steps(2);
status = cpu.status();

if (status.x === 0x42) {
  console.log("  ✓ TAX works (X = $42)");
} else {
  console.log("  ✗ TAX failed - expected $42, got $" + status.x.toString(16).toUpperCase());
  process.exit(1);
}

// Execute INX (2 cycles)
cpu.steps(2);
status = cpu.status();

if (status.x === 0x43) {
  console.log("  ✓ INX works (X = $43)");
} else {
  console.log("  ✗ INX failed - expected $43, got $" + status.x.toString(16).toUpperCase());
  process.exit(1);
}

// Check flag operations
const flagStr = cpu.flagsToString();
console.log("  Status flags:", flagStr);

// Test cycle counting
const cycles = cpu.T();
console.log("  Total cycles:", cycles);

if (cycles > 0) {
  console.log("  ✓ Cycle counting works");
} else {
  console.log("  ✗ Cycle counting failed");
  process.exit(1);
}

console.log("\n✓ MOS 6502 module loads and executes correctly");
