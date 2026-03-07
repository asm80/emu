# PRD: PMD-85 Headless Emulator Module

> Czech summary: Headless ES6 modul emulátoru PMD-85 (8080 CPU + porty + ROM monitor) s jednoduchou HTML demo stránkou jako referenčním hostitelem.

## Overview

A self-contained ES6 module (`src/pmd85.js`) that encapsulates the full PMD-85 computer emulation: Intel 8080 CPU, memory map, ROM monitor, keyboard matrix, audio generation, LED state, and tape interface. The module has **no DOM dependencies** — it exposes a frame-oriented API that any host (browser page, test harness, future React/Vue component) can drive.

A companion demo page (`demo/pmd85.html`) serves as the reference host: it sets up a `<canvas>`, handles `AudioContext`, maps physical keyboard events to the PMD-85 matrix, and drives the frame loop.

## User story

As a developer embedding a PMD-85 emulator into a web page, I want to import a single ES6 module that runs the full machine and gives me per-frame audio samples, LED state, and direct access to video RAM — so I can plug it into my own rendering, audio, and UI without touching emulator internals.

## Entry points

| Trigger | Location | Details |
|---------|----------|---------|
| `import` | `src/pmd85.js` | Named export `createPMD` factory function |
| `createPMD(options)` | Module factory | Creates and returns a PMD-85 instance; does NOT auto-reset |
| `pmd.reset()` | Instance method | Resets CPU to PC=0x8000, loads ROM, clears RAM |
| `pmd.frame(tStates, keyMatrix)` | Instance method | Main loop driver — call once per animation frame |

## Inputs

### `createPMD(options)` — factory options

| Parameter | Type | Required | Default | Notes |
|-----------|------|----------|---------|-------|
| `sampleRate` | `number` | No | `44100` | Audio sample rate in Hz (pass `audioCtx.sampleRate`) |
| `rom` | `Uint8Array` | No | Hardcoded monitor | Custom ROM image at offset 0x8000; must be ≤ 4096 bytes |

### `pmd.frame(tStates, keyMatrix)` — arguments

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `tStates` | `number` | Yes | T-states to execute; e.g. `Math.floor(2000000 / fps)` |
| `keyMatrix` | `Uint8Array(16)` | Yes | Keyboard state: index = column (0–15), bits 0–4 = rows 0–4, bit set = key pressed. Must be pre-filled by host before each call. |

### `pmd.tape.setReadBuffer(data)` — argument

| Parameter | Type | Notes |
|-----------|------|-------|
| `data` | `Uint8Array` | Tape data to play back; module resets internal read pointer to 0 |

### `pmd.setCpuRegister(reg, value)` — arguments

| Parameter | Type | Notes |
|-----------|------|-------|
| `reg` | `string` | Register name, case-insensitive: `"A"`, `"B"`, `"C"`, `"D"`, `"E"`, `"H"`, `"L"`, `"F"`, `"PC"`, `"SP"` |
| `value` | `number` | Byte (0–255) for 8-bit registers; word (0–65535) for PC/SP |

## Expected behavior

### Initialization flow

```
const pmd = createPMD({ sampleRate: audioCtx.sampleRate });
// At this point: module exists but CPU is not reset — frame() returns { initialized: false }

pmd.reset();
// ROM is loaded into 0x8000–0x8FFF, RAM cleared, CPU PC=0x8000
// All subsequent frame() calls run the emulator
```

The host may start its `requestAnimationFrame` loop **before** calling `pmd.reset()`. Frames called before `reset()` return `{ initialized: false }` and are silent no-ops.

### `pmd.frame(tStates, keyMatrix)` — happy path

1. Module runs `cpu.steps(tStates)` internally — the 8080 emulator core from `src/8080.js`.
2. During execution, I/O port handlers fire synchronously:
   - **Port 0xF4 OUT**: stores PA (keyboard column select)
   - **Port 0xF5 IN**: reads `keyMatrix[PA & 0x0F]` and returns inverted (active-low) row bits
   - **Port 0xF6 OUT/IN**: speaker bits (0–2) + LED bits (3–5); speaker transitions are recorded for audio generation
   - **Port 0xF8–0xFA**: ROM pager (ROMPA/B/C registers)
   - **Port 0x1E IN**: returns next byte from tape read buffer; if buffer exhausted, returns `0x00`
   - **Port 0x1E OUT**: appends byte to tape write buffer
   - **Port 0x1F IN**: returns `0x01` (tape ready) + bit 1 set if read buffer has unread data
3. Audio samples are generated from speaker bit transitions collected during execution, downsampled to `sampleRate`. Output range: `+0.5` (speaker on) / `-0.5` (speaker off). Sample count: `Math.ceil(sampleRate / fps)` — varies slightly frame to frame.
4. Method returns:

```js
{
  initialized: true,
  audio: Float32Array,          // audio samples for this frame
  leds: { r: bool, y: bool, g: bool }  // LED state at end of frame
}
```

### Frame result before `reset()`

```js
{ initialized: false }
```

No CPU execution, no audio, no errors thrown.

### Video RAM access (zero-copy)

```js
const ram = pmd.getRAM();        // Uint8Array(65536) — direct reference, not a copy
const vram = ram.subarray(0xC000, 0x10000);  // 16 KB video region
```

Host reads VRAM directly after each frame. VRAM byte encoding (unchanged from hardware):
- Bits 0–5: 6 horizontal pixels (bit 0 = leftmost)
- Bit 6: brightness (`1` = 255, `0` = 192)
- Bit 7: blink flag — host decides when to blank blinking characters

Memory map:
```
0x0000–0x7FFF   RAM (user space)
0x8000–0x8FFF   ROM monitor (write-protected — writes silently ignored)
0x9000–0xBFFF   RAM
0xC000–0xFFFF   Video RAM
```

### Keyboard matrix format

```
keyMatrix: Uint8Array(16)
  index = column (0–15), matching PMD-85 hardware columns K0–K15
  bit 0 = row 0 (K0 key in column)
  bit 1 = row 1
  bit 2 = row 2
  bit 3 = row 3
  bit 4 = row 4
  bit set = key pressed
```

The module inverts this internally to produce active-low values for the CPU.

### Debugger / step mode

The host can stop the frame loop and use these methods for debugging:

```js
pmd.cpuSingleStep()      // execute one instruction → returns T-states consumed (number)
pmd.steps(tStates)       // execute N T-states (no audio generation, no frame result)
pmd.getCpuStatus()       // → { pc, sp, a, b, c, d, e, h, l, f } — snapshot, not live reference
pmd.setCpuRegister(reg, value)
```

The display remains readable from `pmd.getRAM()` at any time, so the host canvas can keep updating even while the CPU is stopped (last frame's VRAM is frozen).

### Tape interface

```js
// Playback
pmd.tape.setReadBuffer(Uint8Array);   // load tape data; resets read pointer to 0
pmd.tape.readPos();                   // → number — current read pointer position

// Recording
pmd.tape.getWriteBuffer();            // → Uint8Array — all bytes written so far
pmd.tape.clearWriteBuffer();          // reset write buffer to empty
```

Read and write buffers are independent. Both can be active simultaneously (e.g. record while playing).

When the read buffer is exhausted, port 0x1E returns `0x00` and port 0x1F bit 1 is clear.

### `pmd.reset()`

- Clears RAM (0x0000–0xFFFF set to `0x00`)
- Loads ROM into 0x8000–0x8FFF (default or custom)
- Resets CPU: PC=0x8000, SP=0x7FFF, all registers 0
- Clears LED state, speaker state
- Does NOT clear tape buffers (allows tape to persist across resets, matching real hardware)

## Full public API surface

```js
// Factory
export const createPMD = (options?) => ({

  // Lifecycle
  reset(),
  frame(tStates, keyMatrix) → { initialized, audio?, leds? },

  // CPU control (for debugger / step mode)
  cpuSingleStep() → tStatesConsumed,
  steps(tStates),
  getCpuStatus() → { pc, sp, a, b, c, d, e, h, l, f },
  setCpuRegister(reg, value),

  // Memory
  getRAM() → Uint8Array,           // direct reference — zero-copy

  // Tape
  tape: {
    setReadBuffer(Uint8Array),
    readPos() → number,
    getWriteBuffer() → Uint8Array,
    clearWriteBuffer(),
  },
});
```

## Files to create

| File | Purpose |
|------|---------|
| `src/devices/pmd/pmd85.js` | Headless emulator module — main deliverable |
| `src/devices/pmd/pmd85-rom.js` | ROM monitor as named export `Uint8Array`; parsed from existing `old/devices/romPMD.js` Intel HEX strings |
| `demo/pmd85.html` | Reference host: canvas (576×512 px, 2× scaled), AudioContext + ScriptProcessor, keyboard mapping, tape UI |

`demo/pmd85.html` is a **self-contained single file** (no build step, no bundler) using ES module `<script type="module">`.

## Scope boundary

This feature does NOT:

- Add any DOM, Canvas, or Web Audio code to `src/pmd85.js`
- Support Web Workers or SharedArrayBuffer
- Implement Z80 or any other CPU (uses existing `src/8080.js` as-is)
- Modify `src/8080.js` (the existing 8080 emulator is consumed unchanged)
- Provide a built-in debugger UI (only the data API)
- Handle blink timing — host reads VRAM bit 7 and decides when to blank
- Implement ROM pager logic beyond storing ROMPA/B/C register values and returning `ROM[ROMPB + 256*ROMPC]` on port 0xF8 read
- Publish to npm as a separate package (lives in `src/` alongside other emulators)

## Integration points

| Existing file | Role | Usage |
|---------------|------|-------|
| `src/8080.js` | Intel 8080 CPU | Imported by `pmd85.js`; `create8080(callbacks)` factory called at `createPMD()` time |
| `old/devices/romPMD.js` | ROM monitor source | Intel HEX strings parsed once and baked into `src/devices/pmd/pmd85-rom.js` as `Uint8Array` |
| `old/devices/emuPMD.js` | Legacy reference | Read-only reference for port logic, keyboard matrix layout, audio bit mapping |

## Acceptance criteria

- [ ] `import { createPMD } from "./src/devices/pmd/pmd85.js"` works in a browser ES module context
- [ ] `pmd.frame(tStates, keyMatrix)` called before `pmd.reset()` returns `{ initialized: false }` without throwing
- [ ] After `pmd.reset()`, `pmd.getCpuStatus().pc` equals `0x8000`
- [ ] Write to `0x8000–0x8FFF` via CPU is silently ignored (ROM write protection)
- [ ] `pmd.frame()` returns a `Float32Array` of `Math.ceil(sampleRate / fps)` samples (±1 sample tolerance)
- [ ] Audio samples are in range `[-0.5, +0.5]`
- [ ] `pmd.getRAM()` returns the same `Uint8Array` reference on every call (not a copy)
- [ ] `pmd.tape.setReadBuffer(data)` followed by 10 port 0x1E reads returns the first 10 bytes of `data`
- [ ] `pmd.tape.getWriteBuffer()` after 5 port 0x1E OUT writes contains exactly those 5 bytes
- [ ] `pmd.cpuSingleStep()` returns a positive integer (T-states consumed)
- [ ] `pmd.setCpuRegister("A", 0x42)` followed by `pmd.getCpuStatus().a` returns `0x42`
- [ ] `demo/pmd85.html` opens in a modern browser without a server (or with `file://`) and boots to PMD-85 monitor prompt
- [ ] Keyboard input in `demo/pmd85.html` reaches the emulator (typing `M` in monitor mode shows memory dump prompt)
- [ ] LED indicators in demo reflect port 0xF6 bits 3–5
- [ ] Custom ROM passed as `createPMD({ rom: myRomData })` is loaded at 0x8000 instead of the default monitor

## Technical notes

### Audio downsampling

```
CPU frequency:  2 000 000 Hz
Example rate:   44 100 Hz
T-states/sample: 2 000 000 / 44 100 ≈ 45.35
```

Module accumulates speaker bit transitions as `[tStateOffset, bits]` pairs during `frame()`. After `cpu.steps()` completes, one pass over the transition log generates the `Float32Array`. No intermediate buffer allocation in steady state (reuse a pre-allocated buffer sized to `ceil(sampleRate / 50)`).

### Port 0xF5 — keyboard read

```js
// portIn(0xF5):
const col = PA & 0x0F;
const pressed = keyMatrix[col];          // host-provided byte, bits 0-4 = rows
let result = 0;
for (let row = 0; row < 5; row++) {
  if (pressed & (1 << row)) result |= (1 << row);
}
return (~result) & 0xFF;                 // active-low inversion
```

Shift key (row special) and STOP key are standard rows in the matrix — host maps them like any other key.

### Code style

Follows project conventions (`src/` modules): `const`/`let`, arrow functions, factory function pattern, double quotes, JSDoc on all exports. No classes.

### Directory layout

```
src/
  devices/
    pmd/
      pmd85.js        ← headless emulator module
      pmd85-rom.js    ← ROM monitor as Uint8Array
demo/
  pmd85.html          ← reference host (self-contained, no build step)
```
