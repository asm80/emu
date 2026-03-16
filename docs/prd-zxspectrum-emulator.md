# PRD: ZX Spectrum Emulator Module

> Česky: Headless emulátor ZX Spectrum 48k/128k postavený na existující Z80 emulaci,
> s per-scanline renderingem, AY-3-8912 jako samostatným modulem, beeprem a SNA podporou.

---

## Overview

Add a headless ZX Spectrum emulator to the `src/devices/zxs/` directory, following the
established device-module pattern (PMD-85, PMI-80, CP/M). The emulator wraps the existing
Z80 CPU from `src/z80.js`, adds ULA timing, video rendering, audio (beeper + AY-3-8912),
keyboard, memory banking (128k), and SNA snapshot load/save.

The AY-3-8912 sound chip is extracted as a **standalone reusable module**
(`src/devices/ay3891x/ay3891x.js`) usable by any future machine emulator.

---

## Deliverables

| File | Description |
|---|---|
| `src/devices/ay3891x/ay3891x.js` | Standalone AY-3-8912 sound chip module |
| `src/devices/zxs/zxspectrum.js` | ZX Spectrum 48k/128k emulator (factory) |
| `src/devices/zxs/zxspectrum.html` | Minimal browser demo harness |
| `test/zxspectrum.test.js` | QUnit test suite |

ROM files already present: `src/devices/zxs/48.rom`, `src/devices/zxs/128-0.rom`,
`src/devices/zxs/128-1.rom`.

---

## Module 1: AY-3-8912 (`src/devices/ay3891x/ay3891x.js`)

### Factory signature

```javascript
export const createAY = ({ sampleRate = 44100, clockHz = 1773400 } = {}) => { ... }
```

### Registers

16 registers (indices 0–15), accessed via:
- `writeRegisterSelect(reg)` — set active register (mirrors port `0xFFFD` write)
- `writeRegisterValue(val)` — write to active register (mirrors port `0xBFFD` write)
- `readRegister()` — read active register (mirrors port `0xFFFD` read)

### Audio generation

- `generate(tStates)` → `Float32Array` — render audio samples for the given number of
  T-states; caller accumulates and flushes per frame.
- Output: mono float32 in range `[−1.0, 1.0]`.
- Three tone channels (A/B/C) + noise channel + envelope generator per AY-3-8912 spec.

### State

- `reset()` — clear all registers, silence output.
- `getState()` → plain object with all 16 register values (for snapshot export).
- `setState(obj)` — restore from plain object (for snapshot import).

---

## Module 2: ZX Spectrum (`src/devices/zxs/zxspectrum.js`)

### Factory signature

```javascript
export const createZXS = (options = {}) => { ... }
```

**Options:**

| Option | Type | Default | Description |
|---|---|---|---|
| `sampleRate` | number | 44100 | Audio sample rate in Hz |
| `model` | `"48k"` \| `"128k"` | auto | Override model; if omitted, inferred from `loadSNA` |

*Assumption: if `reset()` is called before any `loadSNA`, model defaults to `"48k"`.*

### Memory layout

**48k:**
- `0x0000–0x3FFF` ROM (16 KB, read-only)
- `0x4000–0xFFFF` RAM (48 KB)

**128k:**
- `0x0000–0x3FFF` ROM bank (switched via bit 4 of port `0x7FFD`; 2 ROM banks: `128-0.rom`, `128-1.rom`)
- `0x4000–0x7FFF` RAM bank 5 (fixed, contains screen)
- `0x8000–0xBFFF` RAM bank 2 (fixed)
- `0xC000–0xFFFF` RAM bank N (switchable via bits 0–2 of port `0x7FFD`)
- 8 RAM banks total (banks 0–7), each 16 KB

### Exported API

```javascript
{
  reset(),
  frame(tStates, keyMatrix),   // keyMatrix: Uint8Array(8)
  loadSNA(data),               // data: Uint8Array — 48k (49179 B) or 128k (131103 B)
  snapshot(),                  // returns Uint8Array in SNA format
  status(),                    // returns Z80 register snapshot (delegates to cpu.status())
  trace(bool),                 // delegates to cpu.trace()
  getBankingState(),           // returns { romBank, ramBank, pagingDisabled, screenBank }
  getRAM(),                    // returns full internal Uint8Array(65536 * banks)
}
```

### `frame(tStates, keyMatrix)` return value

```javascript
{
  video: Uint8Array,    // RGBA, 448 × 312 pixels, reused buffer (in-place)
  audio: Float32Array,  // mono float32, length = Math.ceil(sampleRate * tStates / FCPU)
  borderColor: number,  // last border color (0–7) for the frame
}
```

---

## Timing & Rendering

### Clock frequencies

| Model | T-states/frame | CPU clock |
|---|---|---|
| 48k | 69888 | 3.5 MHz |
| 128k | 70908 | 3.5469 MHz |

Host is responsible for passing the correct `tStates` per call.
Recommended: `const tStates = model === "128k" ? 70908 : 69888`.

### Per-scanline rendering

Each scanline takes 224 T-states (48k) / 228 T-states (128k).
The ULA renders one scanline of pixels at the start of each scanline interval:

1. Execute CPU for `scanlineTStates` cycles.
2. Write pixels for this scanline into the RGBA buffer.
3. After all 312 scanlines: return the completed frame.

**Video output geometry:**

| Region | Lines | Pixels/line |
|---|---|---|
| Top border | 48 | 448 |
| Visible area | 192 | 448 |
| Bottom border | 56 | 448 |
| Blank (VSYNC) | 16 | 448 (black) |
| Left border | — | 48 px per visible line |
| Right border | — | 48 px per visible line |
| Pixel area | — | 256 px per visible line |
| Right + HBlank | — | 96 px per visible line (black) |

Total: 448 × 312 RGBA = 558,144 bytes, allocated once.

### Port `0xFF` (ULA floating bus)

During border/blank scanlines, reads from port `0xFF` return `0xFF`.
During active pixel scanlines, reads return the ULA data bus value for the current pixel
position (attribute byte of the pixel being rendered). This enables border timing tricks.

### Border color

Bits 0–2 of port `0xFE` (write) set the border color. The border color may change
mid-frame; each scanline captures the current border color at the time of rendering.

---

## Audio

### Beeper

- Port `0xFE` bit 4 (write) = beeper state (0/1).
- Sampled at each T-state boundary; generates square wave in the audio buffer.
- Mixed with AY output before returning from `frame()`.

### AY-3-8912

- Present in both 48k and 128k models.
- Port `0xFFFD` (write) = register select; (read) = register value.
- Port `0xBFFD` (write) = register value.
- Internally uses `createAY({ sampleRate, clockHz })`.
- AY clock: 1,773,400 Hz (48k) / 1,773,400 Hz (128k) — same for both.

### Audio mixing

`audio[i] = clamp(beeper[i] * 0.3 + ay[i] * 0.7, -1.0, 1.0)`

*Assumption: mix weights are a reasonable default; no option to configure them in v1.*

---

## Keyboard

`keyMatrix: Uint8Array(8)` — one byte per half-row, bit = key pressed (1 = pressed).

Half-row order (standard ZX Spectrum):

| Index | Keys |
|---|---|
| 0 | SHIFT, Z, X, C, V |
| 1 | A, S, D, F, G |
| 2 | Q, W, E, R, T |
| 3 | 1, 2, 3, 4, 5 |
| 4 | 0, 9, 8, 7, 6 |
| 5 | P, O, I, U, Y |
| 6 | ENTER, L, K, J, H |
| 7 | SPACE, SYM, M, N, B |

Port `0xFE` read: bits 0–4 = key states for selected half-row (address lines A8–A15).

---

## SNA Snapshot

### Load (`loadSNA(data: Uint8Array)`)

**48k (49179 bytes):**
- Bytes 0–26: register block (I, HL', DE', BC', AF', HL, DE, BC, IY, IX, IFF2, R, AF, SP, IM, border)
- Bytes 27–49178: 48 KB RAM image loaded at `0x4000`
- PC restored from stack (SP points into loaded RAM)

**128k (131103 bytes):**
- Bytes 0–26: same register block as 48k
- Bytes 27–49178: page loaded at `0xC000` at snapshot time
- Bytes 49179–49182: PC, port `0x7FFD` state, TR-DOS flag
- Bytes 49183–: remaining 7 RAM pages (16 KB each, pages 0,1,3,4,6,7 in order, page 2 and snapshot page excluded)

Auto-detection: `data.length === 49179` → 48k; `data.length === 131103` → 128k.
Any other size → throw `Error("Invalid SNA file: unexpected size <N>")`.

### Save (`snapshot(): Uint8Array`)

Produces SNA blob matching the format above for the current machine state.
For 128k: captures all 8 RAM banks; current RAM page C000 is determined from `getBankingState().ramBank`.

---

## `getBankingState()` return value (128k only)

```javascript
{
  romBank: 0 | 1,         // active ROM bank
  ramBank: 0–7,           // active RAM bank at 0xC000
  pagingDisabled: bool,   // bit 5 of port 0x7FFD (paging lock)
  screenBank: 5 | 7,      // which bank is used as screen (bit 3 of 0x7FFD)
}
```

For 48k model, returns `null`.

---

## Browser Demo (`src/devices/zxs/zxspectrum.html`)

Minimal self-contained harness:
- `<canvas>` 448 × 312 (or 2× scaled for readability)
- `AudioContext` + `ScriptProcessorNode` (or `AudioWorklet` if feasible) for audio
- `requestAnimationFrame` loop calling `frame(tStates, keyMatrix)`
- Keyboard event listeners mapping physical keys to ZX Spectrum matrix
- File `<input>` for drag-and-drop or browse SNA file loading
- No external dependencies — plain ES modules

---

## Test Suite (`test/zxspectrum.test.js`)

Minimum test coverage:

| Test | Description |
|---|---|
| AY register read/write | Write reg 0, read back |
| AY audio length | `generate(69888)` returns correct sample count |
| AY reset | All registers zero after reset |
| SNA 48k load | Load known SNA, verify PC and memory byte |
| SNA 128k load | Load known 128k SNA, verify banking state |
| SNA round-trip | `loadSNA(snapshot())` preserves all registers |
| SNA invalid size | Throws on wrong-length input |
| Keyboard read | Set key in matrix, read port 0xFE, verify bit |
| Border color | Write port 0xFE, verify returned borderColor |
| Frame length | `frame()` returns video buffer of correct byte length |
| 128k paging | Write port 0x7FFD, verify `getBankingState()` |
| Paging lock | After lock bit set, further port 0x7FFD writes ignored |
| reset() | CPU at ROM start (PC = 0x0000) after reset |
| trace() | Does not throw; delegates to Z80 |

---

## Non-Goals (v1)

- TAP / TZX tape loading or saving
- Pentagon / Scorpion / other clones
- Multiface / Interface 1 / RS-232
- Network or multiplayer
- AY stereo panning modes (ABC/ACB)
- Save states in any format other than SNA
- Built-in keyboard mapping UI

---

## Assumptions

- **A1:** Default model before any `loadSNA` call is `"48k"`.
- **A2:** Audio mix weights (beeper 0.3 / AY 0.7) are fixed in v1.
- **A3:** AY clock is 1,773,400 Hz for both 48k and 128k models.
- **A4:** Blank/VSYNC scanlines (lines 256–311) render as black pixels.
- **A5:** `ScriptProcessorNode` is acceptable for the demo harness; AudioWorklet is optional.
- **A6:** Port `0xFF` floating bus returns attribute byte only (not pixel byte) for simplicity.

---

## Acceptance Criteria

1. All QUnit tests pass (`npm test` exits 0).
2. `frame()` video buffer is exactly `448 * 312 * 4` bytes.
3. `frame()` audio buffer length equals `Math.ceil(sampleRate * tStates / FCPU)`.
4. 48k SNA round-trip preserves all Z80 registers and full RAM.
5. 128k SNA round-trip preserves all registers, all 8 RAM banks, and banking state.
6. Border color changes mid-frame are reflected per scanline in the RGBA output.
7. `reset()` sets PC = 0x0000 and clears RAM without requiring a prior `loadSNA`.
8. AY module is importable independently without importing `zxspectrum.js`.
9. Browser demo loads an SNA file and runs without console errors in Chrome/Firefox.
10. `trace(true)` delegates to Z80 without throwing.
