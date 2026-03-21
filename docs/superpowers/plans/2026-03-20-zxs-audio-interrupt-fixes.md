# ZX Spectrum Audio & Interrupt Fixes Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three bugs in the ZX Spectrum browser emulator: AY chip silence in 48k mode, beeper crackling caused by audio sample rate mismatch, and interrupt timing running at RAF frequency instead of hardware 50 Hz.

**Architecture:** All changes are localized to `zxspectrum.js` (backend emulator logic) and `zxspectrum.html` (browser frontend/audio pipeline). No new files are created. Fix 1 removes `is128k` guards from AY I/O. Fix 2 threads `audioCtx.sampleRate` into the emulator. Fix 3 replaces the single per-frame interrupt call with a T-state counter that fires the interrupt at the correct 50 Hz period independent of RAF.

**Tech Stack:** Vanilla ES6 modules, Web Audio API (ScriptProcessor), QUnit tests (`npm test`).

**Spec:** `docs/superpowers/specs/2026-03-20-zxs-audio-interrupt-fixes-design.md`

---

## Chunk 1: Fix 1 — AY Available in 48k Mode

### Task 1: Remove `is128k` guard from AY port I/O

**Files:**
- Modify: `src/devices/zxs/zxspectrum.js` (portIn, portOut, frame mixing)

**Context:** The `portIn`, `portOut`, and `frame()` functions in `zxspectrum.js` all gate AY chip access behind `is128k`. A 48k machine with an AY chip (common in real hardware and emulation) never receives AY writes because `is128k` is false. The 128k memory paging guard at port `0x7FFD` must stay — only the AY lines change.

- [ ] **Step 1: Write failing test for AY in 48k mode**

In `test/zxspectrum.test.js` (create if it doesn't exist), add:

```js
import { createZXS } from "../src/devices/zxs/zxspectrum.js";

QUnit.module("ZXS AY 48k", () => {
  QUnit.test("AY audio output is non-zero in 48k mode after programming volume", (assert) => {
    const zxs = createZXS({ model: "48k", sampleRate: 44100 });
    zxs.reset();

    // Build a minimal 48k SNA that places a Z80 program at 0x4000 with PC=0x4000.
    // The program programs AY: select reg 8 (vol A), write 0x0F (max volume).
    // After HALT, the AY is live and ay.generate() should produce non-zero samples.
    //
    // Program bytes at address 0x4000 (= ram48 offset 0):
    //   01 FD FF  LD BC, 0xFFFD  ; AY select-register port
    //   3E 08     LD A, 8        ; register 8 = channel A volume
    //   ED 79     OUT (C), A     ; select register 8
    //   01 FD BF  LD BC, 0xBFFD  ; AY data port
    //   3E 0F     LD A, 0x0F    ; volume = 15 (max), no envelope
    //   ED 79     OUT (C), A     ; write volume
    //   76        HALT
    const prog = [
      0x01, 0xFD, 0xFF,  // LD BC, 0xFFFD
      0x3E, 0x08,        // LD A, 8
      0xED, 0x79,        // OUT (C), A
      0x01, 0xFD, 0xBF,  // LD BC, 0xBFFD
      0x3E, 0x0F,        // LD A, 0x0F
      0xED, 0x79,        // OUT (C), A
      0x76,              // HALT
    ];

    // Construct a 48k SNA (49179 bytes).
    // Header: SP = 0xFFFE, IM = 1. PC is stored on the stack.
    // ram48 is indexed from 0 (= address 0x4000). SNA RAM starts at byte 27.
    // Stack at 0xFFFE = ram48 offset 0xBFFE = SNA offset 27+0xBFFE = 49177.
    const sna = new Uint8Array(49179);
    sna[23] = 0xFE; sna[24] = 0xFF;  // SP = 0xFFFE
    sna[25] = 1;                      // IM = 1
    sna[49177] = 0x00;                // PC low  = 0x00 → PC = 0x4000
    sna[49178] = 0x40;                // PC high = 0x40
    for (let i = 0; i < prog.length; i++) sna[27 + i] = prog[i];

    zxs.loadSNA(sna);

    // Run one frame — CPU executes the program, programs AY volume, then HALTs.
    const result = zxs.frame(69888, new Uint8Array(8));
    const audio = result.audio;
    const hasNonZero = Array.from(audio).some(s => s !== 0);
    assert.true(hasNonZero, "AY audio should be non-zero on 48k after programming channel A volume");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run 2>&1 | grep -A3 "AY 48k"
```
Expected: test fails — no non-zero audio samples because AY is silent in 48k.

- [ ] **Step 3: Remove `is128k` guard from `portIn` — AY register read**

In `src/devices/zxs/zxspectrum.js`, find and edit:

```js
// BEFORE (line ~384):
if (is128k && (fullAddr & 0xC002) === 0xC000) return ay.readRegister();

// AFTER:
if ((fullAddr & 0xC002) === 0xC000) return ay.readRegister();
```

- [ ] **Step 4: Remove `is128k` guard from `portOut` — AY register select and write**

In `src/devices/zxs/zxspectrum.js`, find and edit:

```js
// BEFORE (lines ~416-419):
if (is128k && (fullAddr & 0xC002) === 0xC000) ay.writeRegisterSelect(val);
if (is128k && (fullAddr & 0xC002) === 0x8000) ay.writeRegisterValue(val);

// AFTER:
if ((fullAddr & 0xC002) === 0xC000) ay.writeRegisterSelect(val);
if ((fullAddr & 0xC002) === 0x8000) ay.writeRegisterValue(val);
```

Note: the `is128k &&` guard on the paging block (`(fullAddr & 0xC002) === 0x4000`) immediately above these lines must NOT be changed.

- [ ] **Step 5: Remove `is128k` guard from AY audio generation in `frame()`**

In `src/devices/zxs/zxspectrum.js`, find and replace the mixing block:

```js
// BEFORE:
if (is128k) {
  const ayBuf = ay.generate(tStates);
  for (let i = 0; i < numSamples; i++) {
    audioBuffer[i] = beeperBuf[i] * 0.5 + (i < ayBuf.length ? ayBuf[i] : 0) * 0.5;
  }
} else {
  for (let i = 0; i < numSamples; i++) {
    audioBuffer[i] = beeperBuf[i];
  }
}

// AFTER:
const ayBuf = ay.generate(tStates);
for (let i = 0; i < numSamples; i++) {
  audioBuffer[i] = beeperBuf[i] * 0.5 + (i < ayBuf.length ? ayBuf[i] : 0) * 0.5;
}
```

- [ ] **Step 6: Run tests**

```bash
npm test
```
Expected: all existing tests pass + new AY 48k test passes.

- [ ] **Step 7: Commit**

```bash
git add src/devices/zxs/zxspectrum.js test/zxspectrum.test.js
git commit -m "feat(zxs): enable AY chip in 48k mode"
```

---

## Chunk 2: Fix 2 — Use AudioContext Sample Rate

### Task 2: Thread actual AudioContext sample rate into emulator

**Files:**
- Modify: `src/devices/zxs/zxspectrum.html` (startEmulator, RING_BITS comment)

**Context:** The HTML creates an `AudioContext` with `{ sampleRate: 44100 }` as a hint, but browsers (especially Chrome on Windows with 48 kHz hardware) may run the context at 48000 Hz. The emulator must be created with `audioCtx.sampleRate` — the actual rate — not the hardcoded 44100. Additionally, the `RING_BITS` comment should reflect the correct buffer duration at both rates.

Note: There are no automated tests for the HTML frontend. Verification is manual in the browser.

Note on the remaining hardcoded `44100` in `initAudio()` at line 68: `new AudioContext({ sampleRate: 44100 })` is intentionally left unchanged. It is a browser hint that helps match hardware where possible (e.g. on 44100 Hz systems). The actual operative rate is always read back from `audioCtx.sampleRate` in `startEmulator`. Do NOT change the `AudioContext` constructor argument.

- [ ] **Step 1: Update `startEmulator` to use `audioCtx.sampleRate`**

In `src/devices/zxs/zxspectrum.html`, find:

```js
const startEmulator = (model) => {
  zxs = createZXS({ model, sampleRate: 44100 });
  zxs.reset();
  statusEl.textContent = `Running ${model}`;
};
```

Replace with:

```js
const startEmulator = (model) => {
  const sr = audioCtx ? audioCtx.sampleRate : 44100;
  zxs = createZXS({ model, sampleRate: sr });
  zxs.reset();
  statusEl.textContent = `Running ${model}`;
};
```

- [ ] **Step 2: Update `RING_BITS` comment**

In `src/devices/zxs/zxspectrum.html`, find:

```js
const RING_BITS = 13;                  // 8192 samples ≈ 186 ms at 44100 Hz
```

Replace with:

```js
const RING_BITS = 13;                  // 8192 samples ≈ 171–186 ms depending on AudioContext sample rate
```

- [ ] **Step 3: Verify in browser**

Open `src/devices/zxs/zxspectrum.html` in a browser. Open DevTools console and run:

```js
audioCtx.sampleRate
```

Expected: the emulator's internal sample rate matches this value. Beeper sound should not crackle on 48 kHz systems.

- [ ] **Step 4: Run existing tests (no regression)**

```bash
npm test
```
Expected: all tests pass (HTML changes do not affect JS unit tests).

- [ ] **Step 5: Commit**

```bash
git add src/devices/zxs/zxspectrum.html
git commit -m "fix(zxs): use AudioContext.sampleRate instead of hardcoded 44100"
```

---

## Chunk 3: Fix 3 — 50 Hz Interrupt Independent of RAF

### Task 3: Replace per-frame interrupt with T-state counter

**Files:**
- Modify: `src/devices/zxs/zxspectrum.js` (new state variables, frame loop, reset)

**Context:** Currently `cpu.interrupt(0xFF)` is called once at the top of each `frame()` call, which fires interrupts at the RAF display frequency (~60 Hz). The ZX Spectrum ULA generates interrupts at exactly 50 Hz. Music players synchronised to the interrupt run ~20% too fast. The fix: maintain a T-state counter (`interruptCounter`) that persists across `frame()` calls and fires the interrupt precisely every 69888 T-states (48k) or 70908 T-states (128k). The frame execution loop is split around the interrupt when it falls mid-frame. Video scanlines are rendered proportionally to keep per-scanline border color changes correct.

### Task 3a: Add interrupt period constants and state variable

- [ ] **Step 1: Write failing test for 50 Hz interrupt timing**

In `test/zxspectrum.test.js`, add:

```js
QUnit.module("ZXS interrupt timing", () => {
  QUnit.test("interrupt fires once per 69888 T-states regardless of frame split", (assert) => {
    // Observable: the ZX Spectrum 48k ROM's IM1 handler at 0x0038 increments
    // the FRAMES counter at RAM address 0x5C78 on every interrupt.
    // With IFF=1 and a HALT program, every interrupt fires the ROM handler.
    //
    // Old (broken) behavior: cpu.interrupt() fires once per frame() call → 3 interrupts
    // across 3 calls → FRAMES = 3.
    // New (correct) behavior: interrupt fires once per 69888 T-states → 1 interrupt
    // across 3 calls summing to 69888 T-states → FRAMES = 1.

    // Build a 48k SNA: IFF=1, IM=1, SP=0xFFFE, PC=0x4000, program = HALT.
    // The ROM's IM1 handler handles the interrupt and increments FRAMES.
    const makeSNA = () => {
      const sna = new Uint8Array(49179);
      sna[19] = 0x04;        // IFF flags: bit 2 = IFF1 = 1 (interrupts enabled)
      sna[23] = 0xFE; sna[24] = 0xFF;  // SP = 0xFFFE
      sna[25] = 1;           // IM = 1
      // PC on stack: ram48[0xFFFE - 0x4000] = sna[27 + 0xBFFE] = sna[49177]
      sna[49177] = 0x00; sna[49178] = 0x40;  // PC = 0x4000
      sna[27] = 0x76;        // HALT at 0x4000 — loops, accepts interrupts when IFF=1
      return sna;
    };

    // FRAMES low byte is at address 0x5C78 = ram48 offset 0x1C78 = 7288
    const FRAMES_OFFSET = 0x5C78 - 0x4000;

    // Reference: 1 frame of exactly 69888 T-states → exactly 1 interrupt
    const zxsRef = createZXS({ model: "48k", sampleRate: 44100 });
    zxsRef.loadSNA(makeSNA());
    zxsRef.frame(69888, new Uint8Array(8));
    const refFrames = zxsRef.getRAM()[FRAMES_OFFSET];

    // Test: 3 frames of 23296 T-states each (sum = 69888)
    const zxs = createZXS({ model: "48k", sampleRate: 44100 });
    zxs.loadSNA(makeSNA());
    zxs.frame(23296, new Uint8Array(8));
    zxs.frame(23296, new Uint8Array(8));
    zxs.frame(23296, new Uint8Array(8));
    const testFrames = zxs.getRAM()[FRAMES_OFFSET];

    assert.equal(refFrames, 1, "reference: exactly 1 interrupt in 69888 T-states");
    assert.equal(testFrames, refFrames, "split frames: same interrupt count as single frame");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run 2>&1 | grep -A5 "interrupt timing"
```
Expected: test fails — `testFrames` = 3 (old code fires interrupt per frame() call) while `refFrames` = 1.

- [ ] **Step 3: Add interrupt period constants to `zxspectrum.js`**

In `src/devices/zxs/zxspectrum.js`, after the existing machine constants block (after `BOTTOM_BORDER` etc.), add:

```js
/** Exact T-states between 50 Hz ULA maskable interrupts. */
const INTERRUPT_PERIOD_48  = 69888;
const INTERRUPT_PERIOD_128 = 70908;
```

- [ ] **Step 4: Add `interruptPeriod` and `interruptCounter` state variables**

In `src/devices/zxs/zxspectrum.js`, inside the `createZXS` factory, after the `frameCount` declaration (around line 267), add:

```js
/** T-states between 50 Hz ULA interrupts for this model. */
const interruptPeriod = is128k ? INTERRUPT_PERIOD_128 : INTERRUPT_PERIOD_48;
/** T-states remaining until the next ULA interrupt. Persists across frame() calls. */
let interruptCounter = interruptPeriod;
```

### Task 3b: Rewrite the frame execution loop

- [ ] **Step 5: Replace the frame execution loop in `frame()`**

In `src/devices/zxs/zxspectrum.js`, locate the existing frame loop (roughly lines 585–611):

```js
// Frame interrupt (IM1 → RST 0x38)
cpu.interrupt(0xFF);

const flashPhase = (frameCount >> 4) & 1;

// Distribute tStates proportionally across VISIBLE_LINES, then retrace.
// Tape is advanced lazily inside portIn at the exact T-state of each
// IN (0xFE) instruction, so no per-scanline advancement is needed here.
let tDone = 0;
for (let line = 0; line < VISIBLE_LINES; line++) {
  const lineTarget = Math.round(tStates * (line + 1) / SCANLINES);
  const lineT = lineTarget - tDone;
  if (lineT > 0) cpu.steps(lineT);
  tDone = lineTarget;
  renderScanline(line, borderColor, flashPhase);
}
// Retrace lines (no rendering)
const retraceT = tStates - tDone;
if (retraceT > 0) cpu.steps(retraceT);
```

Replace with:

```js
const flashPhase = (frameCount >> 4) & 1;

// Execute tStates T-states, injecting the ULA 50 Hz interrupt at the correct
// T-state position. interruptCounter persists across frame() calls so the
// interrupt fires at exactly 69888 (48k) or 70908 (128k) T-state intervals
// regardless of how large each frame slice is.
//
// Scanlines are rendered proportionally to preserve mid-frame border color
// changes. tRendered tracks frame-relative T-states executed so far.
let remaining = tStates;
let tRendered = 0;

const renderChunk = (chunk) => {
  // Render visible scanlines whose proportional T-state position falls
  // within [tRendered, tRendered + chunk). Retrace lines are not rendered.
  for (let line = 0; line < VISIBLE_LINES; line++) {
    const lineT = Math.round(tStates * line / SCANLINES);
    if (lineT >= tRendered && lineT < tRendered + chunk) {
      renderScanline(line, borderColor, flashPhase);
    }
  }
};

while (remaining > 0) {
  if (interruptCounter <= remaining) {
    // Execute up to the interrupt
    const tBefore = cpu.T();
    if (interruptCounter > 0) cpu.steps(interruptCounter);
    const actual = cpu.T() - tBefore;
    renderChunk(actual);
    tRendered += actual;

    // Fire the ULA interrupt
    cpu.interrupt(0xFF);

    remaining -= actual;
    interruptCounter = interruptPeriod;
  } else {
    // No interrupt in this slice
    const tBefore = cpu.T();
    cpu.steps(remaining);
    const actual = cpu.T() - tBefore;
    renderChunk(actual);
    tRendered += actual;

    interruptCounter -= actual;
    remaining = 0;
  }
}
```

- [ ] **Step 6: Remove the old tape flush block and move it after the new loop**

The existing tape flush block after the old loop (roughly lines 607–611):

```js
// Flush any remaining tape T-states not consumed by IN instructions
if (tapePlaying) {
  const elapsed = cpu.T() - tapeTBase;
  if (elapsed > 0) advanceTape(elapsed);
  tapeTBase = cpu.T();
}
```

This block must remain after the new execution loop, unchanged. Verify it is still present after the edit.

### Task 3c: Reset `interruptCounter` on `reset()`

- [ ] **Step 7: Add `interruptCounter` reset**

In `src/devices/zxs/zxspectrum.js`, inside the `reset()` method, find:

```js
borderColor = 7; frameCount = 0;
```

Replace with:

```js
borderColor = 7; frameCount = 0; interruptCounter = interruptPeriod;
```

### Task 3d: Verify and commit

- [ ] **Step 8: Run all tests**

```bash
npm test
```
Expected: all tests pass including the new interrupt timing test.

- [ ] **Step 9: Manual browser verification**

Open `src/devices/zxs/zxspectrum.html`. Load a 128k SNA with interrupt-driven music (e.g. `dictator.sna` from `src/devices/zxs/`). Verify the music tempo is correct (not ~20% too fast as before).

- [ ] **Step 10: Commit**

```bash
git add src/devices/zxs/zxspectrum.js test/zxspectrum.test.js
git commit -m "fix(zxs): fire ULA interrupt at 50 Hz independent of animation loop"
```

---

## Summary

| Task | Files | Commit message |
|------|-------|----------------|
| 1 — AY 48k | `zxspectrum.js`, `test/zxspectrum.test.js` | `feat(zxs): enable AY chip in 48k mode` |
| 2 — Sample rate | `zxspectrum.html` | `fix(zxs): use AudioContext.sampleRate instead of hardcoded 44100` |
| 3 — Interrupt | `zxspectrum.js`, `test/zxspectrum.test.js` | `fix(zxs): fire ULA interrupt at 50 Hz independent of animation loop` |
