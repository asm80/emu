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

// --- Smoke test (replaced in Task 3) ---
const rawIn = readFileSync(join(__dirname, "tests.in"), "utf8");
const rawExp = readFileSync(join(__dirname, "tests.expected"), "utf8");
const testsIn = parseTestsIn(rawIn);
const testsExp = parseTestsExpected(rawExp);
console.log(`Parsed ${testsIn.length} inputs, ${testsExp.length} expected results`);
if (testsIn.length !== testsExp.length) {
  console.error("ERROR: count mismatch between tests.in and tests.expected");
  process.exit(1);
}
console.log("First expected:", JSON.stringify(testsExp[0], null, 2));
