# Design: HD6309 Branch Coverage Improvement

**Date:** 2026-03-18
**Goal:** Increase `src/6309.js` branch coverage from 58.2% to 95%+
**Approach:** Extend `test/6309.test.js` with targeted QUnit modules

---

## Current State

- Total branches: 595
- Covered: 346 (58.2%)
- Target: 566+ (95%)
- New branches needed: ~220

## Strategy

Approach C: grouped test modules with table-driven tests inside each group.
- Primary: coverage (verify instruction executes without crash)
- Secondary: correctness where 6309 spec gives clear expected values

All new code appended to existing `test/6309.test.js`.

---

## Modules to Add

### 1. `PSHS/PULS register bits` (lines 942–1042)

Test each register bit individually and in combination:
- Push/pull each of: PC, U, Y, X, DP, B, A, CC (emulated mode)
- Push/pull E and F (native mode only — bits 0x01/0x02 of postbyte)
- Verify stack pointer decrements correctly
- Verify values restored match values saved

### 2. `TFR/EXG — extended 6309 registers (W, V, E, F, zero)` (lines 1097–1178)

Table-driven: `[opcode_postbyte, srcReg, srcVal, dstReg, expectedDstVal]`

Cover all register pairs involving W, V, E, F, zero (0xC/0xD):
- TFR A→E, TFR B→F, TFR W→D, TFR D→W
- TFR V→X, TFR X→V
- TFR A→zero (should be discarded), TFR zero→A (reads 0xFF or 0x00)
- EXG W↔D, EXG E↔A

Correctness: TFR D→W should set W = D value; TFR W→D should set D = W value.

### 3. `Base instruction addressing modes` (lines 1220–1560)

This cluster covers non-prefixed 6309 instructions in all four addressing modes.
Table-driven by `[opcode, mode, operand_bytes, expected_register_state]`:
- LD/ST/CMP/ADD/SUB instructions in direct, indexed, extended modes
- Instructions that have 6309-only variants (e.g., LD/ST with W, E, F registers)
- For each instruction group, test at least: direct page, extended, and indexed mode

### 4. `$10 prefix: LDY/STY/LDS/STS/CMPY` (lines 1637–1760)

Table-driven by addressing mode (imm/direct/indexed/extended) for:
- LDY imm/direct/indexed/extended — verify rY set, flags Z/N/V
- STY direct/indexed/extended — verify memory written
- LDS imm/direct/indexed/extended — verify rS set
- STS direct/indexed/extended — verify memory written
- CMPY imm/direct/indexed/extended — verify flags

### 5. `$10 prefix: Long branches` (lines 1819–1927)

For each long branch (LBRA, LBEQ, LBNE, LBCS, LBCC, LBVS, LBVC, LBMI, LBPL, LBGE, LBGT, LBLE, LBLT, LBHI, LBHS, LBLS):
- Test with condition met → branch taken (verify new PC)
- Test with condition not met → branch not taken (verify PC advances normally)

Note: LBRA is unconditional — only "taken" test applies.
Correctness: branch offset is signed 16-bit, verify both positive and negative offsets.

### 6. `Base instructions: LEAX/LEAY/RTI/MUL and RMW modes` (lines 1761–2150)

Cover uncovered branches in base (non-prefixed) instruction handling:
- LEAX/LEAY: verify zero-flag set when result = 0, clear when result ≠ 0
- RTI: test with F_ENTIRE set (pulls full register set) and without (pulls CC+PC only)
- RTI in native mode: verify E and F registers are pulled from stack
- MUL: verify zero-flag (A=0 or B=0) and carry-flag (bit 7 of result set/clear)
- RMW instructions (OIM/AIM/EIM/TIM) in direct and indexed and extended modes
- Short branches (BLT, BGT, BLE): condition met and not met

### 8. `$11 prefix: CMPU/CMPS` (lines 2160–2260)

Table-driven: `[opcode, regValue, memValue, expectedFlags]`
- CMPU imm/direct/indexed/extended
- CMPS imm/direct/indexed/extended
- Verify C, Z, N, V flags for: equal, greater, less cases

### 9. `$11 prefix: native mode ops` (lines 2261–2519)

E-register unary ops: COME, DECE, INCE, TSTE, CLRE
- Each with boundary values (0x00, 0x7F, 0x80, 0xFF) where flags differ

F-register unary ops: COMF, DECF, INCF, TSTF, CLRF
- Same boundary values

MULD: signed 16×16 → 32-bit into Q
- Correctness: 3 × 4 = 12 in Q

DIVD: D ÷ 8-bit → quotient in W, remainder in D (all addressing modes)
- **Required:** division by zero → trap (sets MD bit, no crash)
- Correctness: 10 ÷ 3 = quotient 3, remainder 1

DIVQ: Q ÷ 16-bit → quotient in W, remainder in D (all addressing modes)
- **Required:** division by zero → trap (sets MD bit, no crash)
- Correctness: basic positive case

BITMD: AND MD register with immediate, set Z/N flags, clear bits 6 and 7
LDMD: load immediate into MD bits 0 and 1

### 10. `Disassembler $10/$11` (lines 2999–3415)

Table-driven: `[byte0, byte1, byte2, byte3, expectedMnemonic, expectedLength]`

Cover all $10/$11 prefix mnemonics not yet tested:
- $10 prefix: LDY, STY, LDS, STS, CMPY, all long branches
- $11 prefix: CMPU, CMPS, COME, DECE, INCE, TSTE, CLRE, COMF, DECF, INCF, TSTF, CLRF
- Unknown $10 opcode → returns `["???", 2]`
- Unknown $11 opcode → returns `["???", 2]`

Note: verify return format is `[mnemonic_string, byte_length]` — consistent with 6309 disassembler (not Z80 which returns length 1 for unknown).

---

## File Changes

- **Modified:** `test/6309.test.js` — append 9 new `QUnit.module` blocks

---

## Success Criteria

- `npm test` passes with 0 failures
- `npm run test:report:text` shows `6309.js` branch coverage ≥ 95%
