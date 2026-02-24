/**
 * CDP1802 smoke test - basic verification that module loads
 */

import create1802 from "../src/1802.js";

// Create minimal memory system
const mem = new Uint8Array(65536);

// Create CPU instance
const cpu = create1802({
  byteAt: (addr) => mem[addr] || 0,
  byteTo: (addr, val) => { mem[addr] = val & 0xFF; }
});

// Test reset
cpu.reset();
const status = cpu.status();

console.log("CDP1802 Smoke Test:");
console.log("  PC after reset:", status.pc);
console.log("  P register:", status.p);
console.log("  X register:", status.x);
console.log("  D accumulator:", status.d);

// Verify initial state
if (status.pc === 0 && status.p === 0 && status.x === 0) {
  console.log("✓ CDP1802 module loads and resets correctly");
} else {
  console.log("✗ CDP1802 initialization failed");
  process.exit(1);
}
