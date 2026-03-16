# PRD: PMI-80 Emulator Module

> Czech summary: Headless ES6 modul emulující PMI-80 počítač — 8080 CPU, 9místný 8-segmentový displej, maticová klávesnice 25 kláves, timing-based magnetofon.

---

## 1. Overview

Create a headless ES6 emulator module for the PMI-80 microcomputer, following the same architectural pattern as `src/devices/pmd/pmd85.js`. The module has no DOM dependencies and exposes a frame-oriented API.

---

## 2. Files to Create

| File | Purpose |
|------|---------|
| `src/devices/pmi/pmi80.js` | Main emulator module (named export `createPMI`) |
| `src/devices/pmi/pmi80-rom.js` | Monitor ROM as `Uint8Array` (named export `MONITOR_ROM`) |
| `src/devices/pmi/pmi80.html` | Static demo page (no build step, Canvas/SVG display) |

---

## 3. Hardware Specifications

| Parameter | Value |
|-----------|-------|
| CPU | Intel 8080A |
| Clock | 1 108 000 Hz (`FCPU = 1108000`) |
| ROM | 1 KB monitor at 0x0000–0x03FF (read-only) |
| RAM | addresses 0x0400–0xFFFF (writes to 0x0000–0x03FF silently ignored) |
| PPI | Intel 8255 equivalent at ports 0xF8–0xFB |
| Display | 9-digit × 8-segment (a–g + decimal point), value 0–255 per digit |
| Keyboard | 25-key matrix, internally mapped to port reads |

### 3.1 Port Map (derived from `emuPMI.js`)

| Port | Direction | Usage |
|------|-----------|-------|
| 0xF8 | OUT | PPI Port A — segment data (active-low, i.e. `255 - PA` = segment bitmask) |
| 0xF9 | OUT | PPI Port B — bit0: 1-bit audio output (square wave speaker) |
| 0xFA | IN/OUT | PPI Port C — lower nibble: digit address (`segment = 15 - (PC & 0x0F)`); upper nibble OUT: tape signal bit7; upper nibble IN: keyboard row bits [6:4] |
| 0xFB | OUT | PPI Control register |

### 3.2 Display Multiplexing

The CPU refresh loop writes PA (segment data) and PC (digit address) in a tight loop. On every PA write the emulator updates an internal `displayState: Array(9)`:

- `displayState[i] = null` — digit `i` not written during current frame
- `displayState[i] = 0–255` — segment bitmask written during current frame (bit0=a, bit1=b, …, bit6=g, bit7=dp)

`frame()` returns a **snapshot** of `displayState` then resets all entries to `null` for the next frame. The host is responsible for persistence/afterglow rendering.

### 3.3 Keyboard Matrix

Internal mapping (not delegated to host). 25 keys, plain-object input:

```
{ kb0–kb9, kba–kbf, kbeq, kbs, kbl, kbm, kbbr, kbr, kbex, kbi, kbre }
```

Matrix decode table (from `emuPMI.js` `PMIKB` function):

| segment (15 - PC&0x0F) | bit2 (key, active-low) | bit1 | bit0 |
|---|---|---|---|
| 8 | kb1 | kb3 | kbeq |
| 7 | kb5 | kb7 | — |
| 6 | kb9 | kbb | — |
| 5 | kbc | kbe | kbm |
| 4 | kbd | kbf | kbbr |
| 3 | kbex | kbr | — |
| 2 | kb8 | kba | kbl |
| 1 | kb4 | kb6 | kbs |
| 0 | kb0 | kb2 | — |

`portIn(0xFA)` computes keyboard bits from current `keyMatrix` and merges them into the upper nibble of PC read value (bits [6:4]).

Named export `KEY_NAMES: string[]` — array of all 25 valid key name strings, for host use when mapping physical keyboard events.

### 3.4 Tape (Timing-Based)

Matches the `mgo`/`mgi` pattern from the original code.

**Recording:** Emulator internally monitors bit7 of PA on every `portOut(0xF8)`. On each transition of that bit, it appends the T-state interval since the last transition to an internal `tapeFrames: number[]` buffer. Host calls `tape.getRecorded()` to retrieve the array.

**Playback:** Host provides a `number[]` array of intervals. The emulator advances through intervals using current CPU T-state counter and returns the correct bit7 value when `portIn(0xFA)` is called.

**Transport states:** `play()`, `record()`, `stop()` — same semantics as PMD tape API.

---

## 4. Public API — `createPMI(options?)`

```javascript
export const createPMI = (options = {}) => { ... };
```

Options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `rom` | `Uint8Array` | built-in `MONITOR_ROM` | Custom 1024-byte ROM image |

### Returned object methods

| Method | Returns | Description |
|--------|---------|-------------|
| `reset()` | `void` | Clear RAM, load ROM at 0x0000–0x03FF, CPU reset (PC=0x0000), clear ports, display, sound. Tape buffers persist. |
| `frame(tStates, keyMatrix)` | see below | Execute tStates T-states, return display snapshot |
| `steps(tStates)` | `void` | Execute without returning display |
| `cpuSingleStep()` | `number` | Execute one instruction, return T-states consumed |
| `getCpuStatus()` | register object | Snapshot of CPU registers |
| `setCpuRegister(reg, value)` | `void` | Set a CPU register by name |
| `getRAM()` | `Uint8Array` | Direct reference to 64 KB RAM |
| `tape.*` | — | Tape interface (see §3.4) |

### `frame(tStates, keyMatrix)` return value

```javascript
// Before reset():
{ initialized: false }

// After reset():
{
  initialized: true,
  display: Array(9),  // null = not written this frame; 0–255 = segment bitmask
  audio: Float32Array // samples for this frame (same pattern as PMD)
}
```

Audio is generated from PB0 transitions (1-bit square wave), sampled at `options.sampleRate` (default 44100). The `createPMI` options object accepts `sampleRate` identical to `createPMD`.

`keyMatrix` parameter: plain object with boolean keys matching `KEY_NAMES`. Unknown keys are ignored. Missing keys default to `false` (not pressed). Validation: none — invalid key names are silently ignored.

### Tape interface

| Method | Description |
|--------|-------------|
| `tape.setReadBuffer(intervals: number[])` | Load interval array for playback |
| `tape.play()` | Start playback (releases CPU wait loop) |
| `tape.record()` | Start recording (clears write buffer) |
| `tape.stop()` | Stop transport |
| `tape.rewind()` | Reset playback pointer to start |
| `tape.getRecorded(): number[]` | Get recorded intervals array (copy) |
| `tape.clearRecorded()` | Clear write buffer |
| `tape.isPlaying(): boolean` | Playback active? |
| `tape.isRecording(): boolean` | Recording active? |

---

## 5. ROM Module — `pmi80-rom.js`

Extract the Intel HEX string embedded in `emuPMI.js` (lines 2–67), parse it at module load time, and export:

```javascript
export const MONITOR_ROM = new Uint8Array(1024); // decoded monitor ROM
```

Validation: if parsed HEX data yields fewer than 1 bytes at any address in 0x0000–0x03FF, the gap is filled with `0xFF`.

---

## 6. Demo — `pmi80.html`

- Static HTML file, no build step, ES module imports via `<script type="module">`
- Canvas or inline SVG rendering of 9-digit 8-segment display

### Main loop — same construction as PMD demo

Uses Web Audio API `ScriptProcessorNode` (or `AudioWorklet`) as the timing source, identical to the PMD pattern:
1. Audio node requests a buffer of N samples → compute `tStates = N * (FCPU / sampleRate)`
2. Call `pmi.frame(tStates, keyMatrix)` → fill audio buffer with `frame.audio`, render display
3. `requestAnimationFrame` is used only for display rendering, not for CPU pacing

This ensures CPU speed stays locked to audio clock regardless of display frame rate.

### Other demo requirements

- Physical keyboard mapping: numpad 0–9 → kb0–kb9, A–F → kba–kbf, Enter → kbeq, and the remaining special keys as in the original `keydecode()` table
- Buttons: Reset, INT (triggers interrupt 0x38), tape Record / Play / Stop / Save / Load (localStorage, `.pmitape` = JSON array)
- No external dependencies (no jQuery, no UI framework)

---

## 7. Non-Goals

- No tape signal rendered as audio (tape uses timing-based format, not audio)
- No test file (no existing PMD test to mirror)
- No tape file format converter (`pmi80-tape-decoder.js`)
- No Z80 / 6502 / other CPU support — 8080 only
- No debugger UI in the demo

---

## 8. Assumptions

- **[ASSUMPTION]** PMI-80 clock = 1 108 000 Hz (user-confirmed)
- **[ASSUMPTION]** ROM occupies exactly 0x0000–0x03FF; writes to this range are silently dropped
- **[ASSUMPTION]** Tape transport signal: playback active = `portIn(0xFA)` bit7 follows interval array; stopped = returns 0x80 (idle high, matching `mgplast` initial value in original code)
- **[ASSUMPTION]** PPI Port B (0xF9) bit0 drives a 1-bit speaker; other bits are unused (reads return 0xFF)
- **[ASSUMPTION]** `kbi` (Interrupt key) and `kbre` (Reset key) are NOT part of the keyboard matrix; they are handled outside the `frame()` call by the host (trigger `interrupt(0x38)` and `reset()` respectively)

---

## 9. Acceptance Criteria

1. `createPMI()` returns an object with all documented methods.
2. After `reset()`, `getCpuStatus().pc === 0x0000` and `getRAM()[0x0000]` equals first byte of monitor ROM.
3. `frame(tStates, {})` with all keys false returns `{ initialized: true, display: Array(9) }` where all entries are `null` (CPU hasn't written any digit yet — only true for the very first frame before monitor runs its refresh loop; after several frames, digits show monitor values).
4. Writing port 0xF8 and 0xFA with valid digit address updates the correct `display[i]` entry.
5. Tape: after `tape.record()`, PA bit7 transitions captured as intervals; `tape.getRecorded()` returns non-empty array after CPU runs tape write code.
6. `KEY_NAMES` is a string array of exactly 25 elements, each matching a key in the keyboard matrix table.
7. Demo HTML renders display and responds to keyboard input without errors in a modern browser.
