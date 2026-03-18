# 6309 Emulator Design Spec

**Date:** 2026-03-18
**Status:** Approved

## Overview

Implement a Hitachi HD6309 CPU emulator as a new module in the `@asm80/emu` package.
The 6309 is a drop-in hardware replacement for the Motorola 6809 with additional undocumented
features: new registers, native execution mode with reduced cycle counts, ~80 new instructions,
and hardware traps for illegal opcodes and division by zero.

## Approach

Clean fork: copy `src/6809.js` → `src/6309.js`, then develop the 6309 module independently.
No shared code, no wrappers. Matches the pattern used by 8085 (extends 8080 independently).

## New Registers

| Register | Width | Description |
|---|---|---|
| E | 8-bit | Accumulator (high byte of W) |
| F | 8-bit | Accumulator (low byte of W) |
| W = E:F | 16-bit | Computed, like D = A:B |
| Q = D:W | 32-bit | Computed 32-bit accumulator |
| V | 16-bit | Value register, unaffected by reset |
| MD | 8-bit | Mode/status register |
| 0 | 8/16-bit | Zero register — always reads 0, writes discarded (inter-register instructions only, encoded as %1100/%1101) |

### MD Register Bits

| Bit | Access | Meaning |
|---|---|---|
| 0 | R/W | Execution mode: 0=emulation, 1=native |
| 1 | R/W | FIRQ behavior: 0=6809 style, 1=same as IRQ (full stack) |
| 6 | Read | Set on illegal instruction trap |
| 7 | Read | Set on division by zero trap |

Reset clears all MD bits.

## TFR/EXG Register Encoding

Extended bit patterns (4-bit):

| Pattern | Register | Notes |
|---|---|---|
| 0110 | W | 16-bit |
| 0111 | V | 16-bit |
| 1100 | 0 | Zero register (8/16-bit, writes discarded) |
| 1101 | 0 | Zero register (alias, same behavior) |
| 1110 | E | 8-bit |
| 1111 | F | 8-bit |

All 6809 register patterns remain unchanged.

## Execution Modes

### Emulation Mode (default)
- Executes at 6809 cycle counts
- Interrupt stack layout (high → low in memory): CC, A, B, DP, Xhi, Xlo, Yhi, Ylo, Uhi, Ulo, PChi, PClo
- All 6309 new instructions available

### Native Mode (MD bit 0 = 1)
- Reduced cycle counts (separate timing tables — see source: parenthesized values in `docs/6309/6309.txt` section 6)
- Interrupt stack layout (high → low in memory): **CC, A, B, E, F, DP, Xhi, Xlo, Yhi, Ylo, Uhi, Ulo, PChi, PClo**
  (E and F inserted between B and DP — 2 extra bytes vs emulation mode)
- RTI restores E and F as well
- Pull order: CC, A, B, E*, F*, DP, X, Y, U, PC (per techref, * = native mode only)

### FIRQ in Native Mode
If MD bit 1 = 1: FIRQ stores full register set (same as IRQ, not just CC+PC).

## Trap System

Trap vector: `$FFF0` (reserved/unused in 6809).

Trap triggers:
1. Illegal/undefined opcode fetched → sets MD bit 6
2. Division by zero (DIVD, DIVQ) → sets MD bit 7

On trap (always uses **S system stack**):
- Set bit 6 or bit 7 in MD
- Push registers (emulation or native stack layout, as appropriate)
- Jump via `$FFF0` vector

`BITMD #n` — AND MD with n, set **Z flag** (and N if applicable) based on result; C and V undefined. Then clear bits 6 and 7 of MD.
`LDMD #n` — Load n into MD bits 0 and 1 (switches native/emulation mode and FIRQ behavior).

## Timing Tables

Six cycle arrays:

```
cycles[]           — page 0, emulation mode
cyclesNative[]     — page 0, native mode
cycles10[]         — $10 prefix, emulation mode
cycles10Native[]   — $10 prefix, native mode
cycles11[]         — $11 prefix, emulation mode
cycles11Native[]   — $11 prefix, native mode
```

Helper: `const isNative = () => (rMD & 1) !== 0`

Each `singleStep()` selects the correct table based on `isNative()`.

Source for native mode cycle values: parenthesized numbers in `docs/6309/6309.txt` section 6.
New instructions without a parenthesized native value use the same count for both modes.

## New Instructions

### Page 0 (no prefix)

| Opcode | Mnemonic | Mode | Description |
|---|---|---|---|
| $01 | OIM | DIRECT | OR immediate to memory (imm byte precedes direct addr) |
| $02 | AIM | DIRECT | AND immediate to memory |
| $05 | EIM | DIRECT | EOR immediate to memory |
| $0B | TIM | DIRECT | Test immediate against memory (AND, result to CC only) |
| $14 | SEXW | IMP | Sign extend W into D: D = 0xFFFF if W < 0, else 0x0000 |
| $61 | OIM | INDEXED | OR immediate to memory |
| $62 | AIM | INDEXED | AND immediate to memory |
| $65 | EIM | INDEXED | EOR immediate to memory |
| $6B | TIM | INDEXED | Test immediate against memory |
| $71 | OIM | EXTENDED | OR immediate to memory |
| $72 | AIM | EXTENDED | AND immediate to memory |
| $75 | EIM | EXTENDED | EOR immediate to memory |
| $7B | TIM | EXTENDED | Test immediate against memory |
| $CD | LDQ | IMMEDIATE | Load Q (32-bit) immediate (5 bytes: opcode + 4 data bytes) |

### Page $10 prefix

#### Inter-Register Operations
Result stored in R1 (second register operand). Uses 4-bit register encoding (including zero register).

| Opcode | Mnemonic | Description |
|---|---|---|
| $10 30 | ADDR r0,r1 | r1 = r1 + r0 |
| $10 31 | ADCR r0,r1 | r1 = r1 + r0 + C |
| $10 32 | SUBR r0,r1 | r1 = r1 - r0 |
| $10 33 | SBCR r0,r1 | r1 = r1 - r0 - C |
| $10 34 | ANDR r0,r1 | r1 = r1 & r0 |
| $10 35 | ORR r0,r1 | r1 = r1 \| r0 |
| $10 36 | EORR r0,r1 | r1 = r1 ^ r0 |
| $10 37 | CMPR r0,r1 | set flags for r1 - r0, no store |

#### Stack W
| Opcode | Mnemonic | Description |
|---|---|---|
| $10 38 | PSHSW | Push W (E then F) onto S stack |
| $10 39 | PULSW | Pull W (F then E) from S stack |
| $10 3A | PSHUW | Push W (E then F) onto U stack |
| $10 3B | PULUW | Pull W (F then E) from U stack |

#### D-register Ops (16-bit accumulator)
| Opcode | Mnemonic |
|---|---|
| $10 40 | NEGD |
| $10 43 | COMD |
| $10 44 | LSRD |
| $10 46 | RORD |
| $10 47 | ASRD |
| $10 48 | ASLD |
| $10 49 | ROLD |
| $10 4A | DECD |
| $10 4C | INCD |
| $10 4D | TSTD |
| $10 4F | CLRD |

#### W-register Ops (16-bit)
| Opcode | Mnemonic |
|---|---|
| $10 53 | COMW |
| $10 54 | LSRW |
| $10 56 | RORW |
| $10 59 | ROLW |
| $10 5A | DECW |
| $10 5C | INCW |
| $10 5D | TSTW |
| $10 5F | CLRW |

#### W 16-bit Arithmetic (all modes: IMMED/DIRECT/INDEXED/EXTENDED)
SUBW, CMPW, SBCD, ANDD, BITD, LDW, STW, EORD, ADCD, ORD, ADDW

#### Q load/store (32-bit)
LDQ (DIRECT, INDEXED, EXTENDED), STQ (DIRECT, INDEXED, EXTENDED)

### Page $11 prefix

#### Bit Operations (DIRECT mode only, special postbyte)
Instructions: BAND, BIAND, BOR, BIOR, BEOR, BIEOR, LDBT, STBT

Postbyte format: `dstBit[2:0] : srcBit[2:0] : reg[1:0]`
where reg: 00=A, 01=B, 10=CC, 11=undefined.

Note: `6309.txt` lists opcode $11 $34 as "NEOR" — this is a typo in that document. The correct mnemonic is BEOR (per techref). Implement as BEOR.

#### Block Transfer (TFM)
| Opcode | Mnemonic | Description |
|---|---|---|
| $11 38 | TFM r+,r+ | Transfer block, both pointers increment |
| $11 39 | TFM r-,r- | Transfer block, both pointers decrement |
| $11 3A | TFM r+,r | Transfer to fixed dest (I/O output) |
| $11 3B | TFM r,r+ | Transfer from fixed src (I/O input) |

Pointer registers: X, Y, U, S, D. Block count in W. W decrements to 0.
Cycle count: 6 + 3n (emulation), where n = number of bytes transferred.

#### MD Register Ops
| Opcode | Mnemonic | Description |
|---|---|---|
| $11 3C | BITMD #n | AND MD with n, update Z (and N) flag, clear bits 6 and 7 of MD |
| $11 3D | LDMD #n | Load n into MD bits 0 and 1 |

#### E-register Ops
| Ops | Description |
|---|---|
| COME, DECE, INCE, TSTE, CLRE | Single-byte E ops |
| SUBE, CMPE, LDE, STE, ADDE | E arithmetic (IMMED/DIRECT/INDEXED/EXTENDED) |

#### F-register Ops
| Ops | Description |
|---|---|
| COMF, DECF, INCF, TSTF, CLRF | Single-byte F ops |
| SUBF, CMPF, LDF, STF, ADDF | F arithmetic (IMMED/DIRECT/INDEXED/EXTENDED) |

#### Multiply / Divide
| Mnemonic | Description |
|---|---|
| MULD | D × 16-bit operand → Q (signed 16×16→32 bit) |
| DIVD | D ÷ 8-bit operand → **quotient in W**, **remainder in D** |
| DIVQ | Q ÷ 16-bit operand → **quotient in W**, **remainder in D** |

All three support IMMED, DIRECT, INDEXED, EXTENDED modes.
Division by zero triggers trap ($FFF0 vector), sets MD bit 7.

## Disassembler

`export const disasm = (op, arg1, arg2, arg3, arg4) => [mnemonic, byteLength]`

Covers all three opcode pages. Handles prefix bytes $10 and $11.
All new mnemonics returned with correct operand formatting.
Unknown/undefined opcodes return `["???", 1]`.

## Files

| File | Description |
|---|---|
| `src/6309.js` | Main emulator module (fork of 6809.js) |
| `test/6309.test.js` | TDD test suite for all 6309-specific features |
| `test/6309.smoke.js` | Smoke tests (adapted from 6809.smoke.js) |

`package.json` exports entry: `"./6309": "./src/6309.js"`

## Test Structure

Tests written first (TDD). Groups:

1. **New registers** — initial state, read/write via `set()`/`status()`, zero register behavior
2. **MD register** — LDMD switches native mode, BITMD clears flags, Z flag behavior
3. **TFR/EXG** — new register encodings (W, V, E, F, zero register)
4. **Native mode timing** — cycle counts differ for representative instructions
5. **Native mode interrupt stack** — E and F pushed/popped between B and DP correctly
6. **Trap** — illegal opcode triggers $FFF0 vector; div-by-zero triggers trap; MD bits set
7. **Page 0 new instructions** — OIM/AIM/EIM/TIM, SEXW, LDQ
8. **Page $10 instructions** — inter-register ops, D/W ops, LDW/STW, LDQ/STQ, PSHSW/PULSW
9. **Page $11 instructions** — E/F ops, TFM, bit ops (BAND etc.), MULD/DIVD/DIVQ
10. **Disassembler** — spot checks across all three pages, unknown opcode returns `["???", 1]`
