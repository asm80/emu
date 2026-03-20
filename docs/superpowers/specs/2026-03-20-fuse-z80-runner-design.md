# FUSE Z80 Test Runner — Design Spec

**Date:** 2026-03-20
**Status:** Approved

## Overview

A custom Node.js test runner that executes the FUSE Z80 test suite against the `@asm80/emu` Z80 emulator. The runner parses the standard FUSE `tests.in` / `tests.expected` files, runs each test through the emulator, and reports results comparing registers, T-states, and memory changes.

## Scope

- **In scope:** Register verification, T-state verification, memory-change verification, `halted` state verification
- **Out of scope:** Memory contention event ordering (MC/MR/MW event timeline) — reserved for future option C
- **MEMPTR:** Not verified — the Z80 emulator does not expose MEMPTR via `status()`
- **`test:fuse` is intentionally standalone** — it is not integrated with `npm test` (QUnit suite) to avoid polluting coverage output with thousands of FUSE sub-tests

## File Structure

```
test/fuse-z80/
  runner.js         ← new: the test runner (ES module)
  tests.in          ← existing FUSE input file
  tests.expected    ← existing FUSE expected output file
```

`package.json` gets one new script:
```json
"test:fuse": "node test/fuse-z80/runner.js"
```

## Input Format (`tests.in`)

Each test block:
```
<name>
AF BC DE HL AF' BC' DE' HL' IX IY SP PC MEMPTR
I R IFF1 IFF2 IM <halted> <tstates>
<addr> <byte> <byte> ... -1
...more memory lines...
-1
```

All register pairs are 4-digit hex. All single registers (I, R, IFF1, IFF2, IM) are hex.
`<tstates>` is decimal — passed to `cpu.steps()`.
Blank lines between test blocks must be skipped by the parser.

## Expected Format (`tests.expected`)

Each test block:
```
<name>
<time> <type> <address> [<data>]   ← zero or more event lines (ignored)
AF BC DE HL AF' BC' DE' HL' IX IY SP PC MEMPTR
I R IFF1 IFF2 IM <halted> <tstates>
<addr> <byte> -1                   ← zero or more memory-change lines, each ending with -1
                                   ← blank line ends the test block
```

Parsing notes:
- Event lines are detected by having a numeric first token (the timestamp) — skip them
- Memory-change lines each have the form `<addr> <byte> -1` — one address, one byte, then `-1`
- A blank line (or EOF) terminates the test block

## Architecture

### `parseTestsIn(text)`
Returns `Array<TestInput>`:
```js
{
  name: string,
  regs: { af, bc, de, hl, afAlt, bcAlt, deAlt, hlAlt, ix, iy, sp, pc },
  special: { i, r, iff1, iff2, im, halted, tstates },
  memory: [{ addr, bytes }]   // bytes is an array
}
```

### `parseTestsExpected(text)`
Returns `Array<TestExpected>`:
```js
{
  name: string,
  regs: { af, bc, de, hl, afAlt, bcAlt, deAlt, hlAlt, ix, iy, sp, pc },
  special: { i, r, iff1, iff2, im, halted, tstates },
  memChanges: [{ addr, byte }]   // one entry per changed byte
}
```

### `runTest(input, expected)`

**A new CPU instance is created for every test** — this ensures `cpu.T()` starts at 0 and register state is clean.

1. Allocate `Uint8Array(65536)`
2. Write `input.memory` into the array
3. **Create a new Z80 CPU** with `byteAt`/`byteTo` callbacks (fresh instance per test)
4. Set registers via `cpu.set()`:
   - `AF`, `BC`, `DE`, `HL`, `AF_`, `BC_`, `DE_`, `HL_`, `IX`, `IY`, `SP`, `PC`
   - `I`, `R`, `IFF1`, `IFF2`, `IM`
5. If `input.special.halted === 1`: write a `HALT` opcode (0x76) at the current PC, call `cpu.singleStep()` to enter halted state, then reset `cpu.T()` to 0 by reconstructing the CPU — **OR** document as a known limitation (no FUSE test uses `halted = 1` as initial state; if encountered, skip with a warning)
6. Call `cpu.steps(input.special.tstates)`
7. Read `cpu.status()` and `cpu.T()`
8. Compare against expected — collect mismatches

**Note on `halted` initial state:** All known FUSE tests have `halted = 0` as initial state. The runner will log a warning and skip any test with `halted = 1` as initial input, since `cpu.set()` does not accept a `"HALTED"` key.

### Register Mapping

| FUSE field | `cpu.set()` key | `status()` key |
|-----------|----------------|----------------|
| AF        | `"AF"`         | `af`           |
| BC        | `"BC"`         | `bc`           |
| DE        | `"DE"`         | `de`           |
| HL        | `"HL"`         | `hl`           |
| AF'       | `"AF_"`        | `af_`          |
| BC'       | `"BC_"`        | `bc_`          |
| DE'       | `"DE_"`        | `de_`          |
| HL'       | `"HL_"`        | `hl_`          |
| IX        | `"IX"`         | `ix`           |
| IY        | `"IY"`         | `iy`           |
| SP        | `"SP"`         | `sp`           |
| PC        | `"PC"`         | `pc`           |
| I         | `"I"`          | `i`            |
| R         | `"R"`          | `r`            |
| IFF1      | `"IFF1"`       | `iff1`         |
| IFF2      | `"IFF2"`       | `iff2`         |
| IM        | `"IM"`         | `im`           |

### Verification

For each test, check:
1. All 17 registers in the mapping table above
2. `halted`: `status().halted` === `expected.special.halted`
3. T-states: `cpu.T()` === `expected.special.tstates`
4. Memory: for each `{ addr, byte }` in `expected.memChanges`, verify `mem[addr] === byte`

A test **fails** if any single check mismatches.

### Reporter

After all tests:
```
FUSE Z80: 15432 passed, 3 failed

FAILED: 02_1
  af:     expected 1300, got 1302
  pc:     expected 0001, got 0002
  tstates expected 7, got 8

FAILED: cb46_1
  ...
```

Exit code `0` if all pass, `1` if any fail (enables CI usage).

## T-states Handling

FUSE sets `tstates = 1` in `.in` as a sentinel to trigger one instruction. `cpu.steps(1)` runs the loop until at least 1 T-state has elapsed — since even the shortest Z80 instruction takes 4 T-states, this always executes exactly one complete instruction. The expected `tstates` in `.expected` is the actual cycle count consumed by that instruction (e.g. 4, 7, 10, etc.). We verify `cpu.T() === expected.special.tstates`.

## Constraints

- ES module (`"type": "module"` in package.json — already present in this project)
- No new npm dependencies — uses only Node.js built-ins (`fs`, `path`, `url`)
- Reads files synchronously at startup for simplicity
