/**
 * FUSE Z80 Test Runner
 * Parses tests.in and tests.expected, runs each test through the Z80 emulator,
 * and reports register/T-state/memory mismatches.
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import z80 from "../../src/z80.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Parse FUSE tests.in file into an array of test inputs.
 * @param {string} text - Full file contents
 * @returns {Array<{name: string, regs: object, special: object, memory: Array}>}
 */
const parseTestsIn = (text) => {
  const tests = [];
  const lines = text.split(/\r?\n/);
  let i = 0;

  while (i < lines.length) {
    // Skip blank lines between tests
    if (lines[i].trim() === "") { i++; continue; }

    const name = lines[i].trim();
    i++;

    // Register pair line: AF BC DE HL AF' BC' DE' HL' IX IY SP PC MEMPTR
    const regTokens = lines[i].trim().split(/\s+/);
    i++;
    const regs = {
      af:     parseInt(regTokens[0], 16),
      bc:     parseInt(regTokens[1], 16),
      de:     parseInt(regTokens[2], 16),
      hl:     parseInt(regTokens[3], 16),
      afAlt:  parseInt(regTokens[4], 16),
      bcAlt:  parseInt(regTokens[5], 16),
      deAlt:  parseInt(regTokens[6], 16),
      hlAlt:  parseInt(regTokens[7], 16),
      ix:     parseInt(regTokens[8], 16),
      iy:     parseInt(regTokens[9], 16),
      sp:     parseInt(regTokens[10], 16),
      pc:     parseInt(regTokens[11], 16),
      // regTokens[12] is MEMPTR — not used
    };

    // Special line: I R IFF1 IFF2 IM <halted> <tstates>
    // I and R are hex; IFF1, IFF2, IM, halted are 0/1 integers; tstates is decimal
    const specTokens = lines[i].trim().split(/\s+/);
    i++;
    const special = {
      i:       parseInt(specTokens[0], 16),
      r:       parseInt(specTokens[1], 16),
      iff1:    parseInt(specTokens[2], 10),
      iff2:    parseInt(specTokens[3], 10),
      im:      parseInt(specTokens[4], 10),
      halted:  parseInt(specTokens[5], 10),
      tstates: parseInt(specTokens[6], 10),
    };

    // Memory lines: <addr> <byte> <byte> ... -1
    // End of test block: a standalone line containing only "-1"
    const memory = [];
    while (i < lines.length) {
      const line = lines[i].trim();
      i++;
      if (line === "-1") break;
      if (line === "") continue;
      const tokens = line.split(/\s+/);
      const addr = parseInt(tokens[0], 16);
      const bytes = [];
      for (let j = 1; j < tokens.length; j++) {
        if (tokens[j] === "-1") break;
        bytes.push(parseInt(tokens[j], 16));
      }
      memory.push({ addr, bytes });
    }

    tests.push({ name, regs, special, memory });
  }

  return tests;
};

/**
 * Parse FUSE tests.expected file into an array of expected results.
 * @param {string} text - Full file contents
 * @returns {Array<{name: string, regs: object, special: object, memChanges: Array}>}
 */
const parseTestsExpected = (text) => {
  const tests = [];
  const lines = text.split(/\r?\n/);
  let i = 0;

  while (i < lines.length) {
    // Skip blank lines between tests
    if (lines[i].trim() === "") { i++; continue; }

    const name = lines[i].trim();
    i++;

    // Skip event lines: second token is a memory/port-access type keyword
    while (i < lines.length) {
      const tokens = lines[i].trim().split(/\s+/);
      if (/^(MC|MR|MW|PC|PR|PW)$/.test(tokens[1])) { i++; continue; }
      break;
    }

    // Register pair line: AF BC DE HL AF' BC' DE' HL' IX IY SP PC MEMPTR
    const regTokens = lines[i].trim().split(/\s+/);
    i++;
    const regs = {
      af:     parseInt(regTokens[0], 16),
      bc:     parseInt(regTokens[1], 16),
      de:     parseInt(regTokens[2], 16),
      hl:     parseInt(regTokens[3], 16),
      afAlt:  parseInt(regTokens[4], 16),
      bcAlt:  parseInt(regTokens[5], 16),
      deAlt:  parseInt(regTokens[6], 16),
      hlAlt:  parseInt(regTokens[7], 16),
      ix:     parseInt(regTokens[8], 16),
      iy:     parseInt(regTokens[9], 16),
      sp:     parseInt(regTokens[10], 16),
      pc:     parseInt(regTokens[11], 16),
      // regTokens[12] is MEMPTR — not used
    };

    // Special line: I R IFF1 IFF2 IM <halted> <tstates>
    const specTokens = lines[i].trim().split(/\s+/);
    i++;
    const special = {
      i:       parseInt(specTokens[0], 16),
      r:       parseInt(specTokens[1], 16),
      iff1:    parseInt(specTokens[2], 10),
      iff2:    parseInt(specTokens[3], 10),
      im:      parseInt(specTokens[4], 10),
      halted:  parseInt(specTokens[5], 10),
      tstates: parseInt(specTokens[6], 10),
    };

    // Memory-change lines: <addr> <byte> -1   (one entry per changed byte)
    // A blank line (or EOF) ends the test block
    const memChanges = [];
    while (i < lines.length) {
      const line = lines[i].trim();
      if (line === "") { i++; break; }
      i++;
      const tokens = line.split(/\s+/);
      const addr = parseInt(tokens[0], 16);
      for (let j = 1; j < tokens.length; j++) {
        if (tokens[j] === "-1") break;
        memChanges.push({ addr: addr + (j - 1), byte: parseInt(tokens[j], 16) });
      }
    }

    tests.push({ name, regs, special, memChanges });
  }

  return tests;
};

/**
 * Run one FUSE test and return an array of mismatch strings.
 * Returns empty array if the test passes.
 * @param {object} input - Parsed test input
 * @param {object} expected - Parsed expected result
 * @returns {string[]} List of mismatch descriptions, or ["SKIPPED: ..."] if skipped
 */
const runTest = (input, expected) => {
  if (input.special.halted !== 0) {
    return [`SKIPPED: initial halted=${input.special.halted} not supported`];
  }

  const mem = new Uint8Array(65536);

  // Write initial memory
  for (const { addr, bytes } of input.memory) {
    for (let j = 0; j < bytes.length; j++) {
      mem[addr + j] = bytes[j];
    }
  }

  // A fresh CPU instance is created per test so cpu.T() starts at 0
  const cpu = z80({
    byteAt: (addr) => mem[addr],
    byteTo: (addr, val) => { mem[addr] = val & 0xFF; },
  });

  // Set registers
  cpu.set("AF",   input.regs.af);
  cpu.set("BC",   input.regs.bc);
  cpu.set("DE",   input.regs.de);
  cpu.set("HL",   input.regs.hl);
  cpu.set("AF_",  input.regs.afAlt);
  cpu.set("BC_",  input.regs.bcAlt);
  cpu.set("DE_",  input.regs.deAlt);
  cpu.set("HL_",  input.regs.hlAlt);
  cpu.set("IX",   input.regs.ix);
  cpu.set("IY",   input.regs.iy);
  cpu.set("SP",   input.regs.sp);
  cpu.set("PC",   input.regs.pc);
  cpu.set("I",    input.special.i);
  cpu.set("R",    input.special.r);
  cpu.set("IFF1", input.special.iff1);
  cpu.set("IFF2", input.special.iff2);
  cpu.set("IM",   input.special.im);

  // Execute for the test's T-state budget
  cpu.steps(input.special.tstates);

  const state = cpu.status();
  const mismatches = [];

  // Verify registers — expKey is in expected.regs or expected.special
  const regMap = [
    ["af",   "af",    state.af],
    ["bc",   "bc",    state.bc],
    ["de",   "de",    state.de],
    ["hl",   "hl",    state.hl],
    ["af'",  "afAlt", state.af_],
    ["bc'",  "bcAlt", state.bc_],
    ["de'",  "deAlt", state.de_],
    ["hl'",  "hlAlt", state.hl_],
    ["ix",   "ix",    state.ix],
    ["iy",   "iy",    state.iy],
    ["sp",   "sp",    state.sp],
    ["pc",   "pc",    state.pc],
    ["i",    "i",     state.i],
    ["r",    "r",     state.r],
    ["iff1", "iff1",  state.iff1],
    ["iff2", "iff2",  state.iff2],
    ["im",   "im",    state.im],
  ];

  for (const [label, expKey, got] of regMap) {
    const exp = expKey in expected.regs ? expected.regs[expKey] : expected.special[expKey];
    if (got !== exp) {
      mismatches.push(
        `  ${label.padEnd(6)}: expected ${exp.toString(16).padStart(4, "0")}, got ${got.toString(16).padStart(4, "0")}`
      );
    }
  }

  // Verify halted
  const gotHalted = state.halted ? 1 : 0;
  if (gotHalted !== expected.special.halted) {
    mismatches.push(`  halted: expected ${expected.special.halted}, got ${gotHalted}`);
  }

  // Verify T-states — cpu.T() returns total cycles since construction
  const gotT = cpu.T();
  if (gotT !== expected.special.tstates) {
    mismatches.push(`  tstates: expected ${expected.special.tstates}, got ${gotT}`);
  }

  // Verify memory changes
  for (const { addr, byte } of expected.memChanges) {
    if (mem[addr] !== byte) {
      mismatches.push(
        `  mem[${addr.toString(16).padStart(4, "0")}]: expected ${byte.toString(16).padStart(2, "0")}, got ${mem[addr].toString(16).padStart(2, "0")}`
      );
    }
  }

  return mismatches;
};

const main = () => {
  const rawIn = readFileSync(join(__dirname, "tests.in"), "utf8");
  const rawExp = readFileSync(join(__dirname, "tests.expected"), "utf8");
  const testsIn = parseTestsIn(rawIn);
  const testsExp = parseTestsExpected(rawExp);

  if (testsIn.length !== testsExp.length) {
    console.error(`ERROR: tests.in has ${testsIn.length} tests but tests.expected has ${testsExp.length}`);
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;
  let skipped = 0;
  const failures = [];

  for (let i = 0; i < testsIn.length; i++) {
    const mismatches = runTest(testsIn[i], testsExp[i]);
    if (mismatches.length === 0) {
      passed++;
    } else if (mismatches[0].startsWith("SKIPPED:")) {
      skipped++;
    } else {
      failed++;
      failures.push({ name: testsIn[i].name, mismatches });
    }
  }

  // Print failures
  for (const { name, mismatches } of failures) {
    console.log(`\nFAILED: ${name}`);
    for (const m of mismatches) console.log(m);
  }

  const skipNote = skipped > 0 ? `, ${skipped} skipped` : "";
  console.log(`\nFUSE Z80: ${passed} passed, ${failed} failed${skipNote}`);
  process.exit(failed > 0 ? 1 : 0);
};

// Only run when executed directly (not when imported by QUnit)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
