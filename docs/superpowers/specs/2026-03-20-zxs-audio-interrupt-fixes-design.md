# ZX Spectrum Audio & Interrupt Fixes — Design Spec

**Date:** 2026-03-20
**Status:** Approved

## Problem Summary

Three independent bugs in the ZX Spectrum emulator (`src/devices/zxs/`):

1. **AY silence in 48k mode** — AY port I/O and audio generation are gated behind `is128k`, so games using AY on a 48k machine produce no sound.
2. **Beeper crackling** — `AudioContext` and `createZXS` use hardcoded `sampleRate: 44100`, but browsers may run the AudioContext at 48000 Hz. The resulting mismatch means the ring buffer drains faster than it fills, causing dropouts/crackling.
3. **Interrupt at RAF frequency (~60 Hz) instead of 50 Hz** — `cpu.interrupt()` is called once per `frame()` call, which fires at the animation loop frequency. ZX Spectrum hardware interrupts at exactly 50 Hz. Music players synchronized to the interrupt play too fast on 60 Hz displays.

---

## Fix 1: AY Available in 48k Mode

### Affected file: `src/devices/zxs/zxspectrum.js`

Remove the `is128k` guard from three locations:

**portIn** — AY register read:
```js
// Before (only 128k):
if (is128k && (fullAddr & 0xC002) === 0xC000) return ay.readRegister();

// After (always):
if ((fullAddr & 0xC002) === 0xC000) return ay.readRegister();
```

**portOut** — AY register select and write:
```js
// Before:
if (is128k && (fullAddr & 0xC002) === 0xC000) ay.writeRegisterSelect(val);
if (is128k && (fullAddr & 0xC002) === 0x8000) ay.writeRegisterValue(val);

// After:
if ((fullAddr & 0xC002) === 0xC000) ay.writeRegisterSelect(val);
if ((fullAddr & 0xC002) === 0x8000) ay.writeRegisterValue(val);
```

**frame()** — AY audio generation and mixing:
```js
// Before:
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

// After (always mix AY):
const ayBuf = ay.generate(tStates);
for (let i = 0; i < numSamples; i++) {
  const mixed = beeperBuf[i] + (i < ayBuf.length ? ayBuf[i] : 0);
  audioBuffer[i] = mixed > 1.0 ? 1.0 : mixed;
}
```

> **Note:** Additive mixing (with saturation clamp at 1.0) preserves beeper amplitude when AY is silent. The 0.5/0.5 weighted average would halve beeper volume even when AY produces no signal.

The `is128k` guard on the 128k memory paging register (port 0x7FFD) is **not changed** — paging remains 128k-only.

Note on `portOut` ordering: the three AY `if` blocks appear after the ULA and paging blocks in the current source. Their relative order and the paging guard (`is128k && (fullAddr & 0xC002) === 0x4000`) are unchanged — only the `is128k` prefix is removed from the two AY lines. The paging block cannot be accidentally triggered by AY port addresses because `0xFFFD & 0xC002 = 0xC000 ≠ 0x4000` and `0xBFFD & 0xC002 = 0x8000 ≠ 0x4000`.

---

## Fix 2: Use AudioContext Sample Rate

### Affected file: `src/devices/zxs/zxspectrum.html`

**Root cause:** `new AudioContext({ sampleRate: 44100 })` is a hint, not a guarantee. The browser may use 48000 Hz. The emulator must receive the actual sample rate the AudioContext is using.

**Changes:**

1. `initAudio()` must be called **before** `startEmulator()` in all code paths, including the auto-start at page load. Since browser policy prevents AudioContext without user gesture, the auto-start creates the emulator with a safe fallback of 44100; audio is only truly active after the first user interaction.

2. `startEmulator(model)` reads `audioCtx ? audioCtx.sampleRate : 44100`:
```js
const startEmulator = (model) => {
  const sr = audioCtx ? audioCtx.sampleRate : 44100;
  zxs = createZXS({ model, sampleRate: sr });
  zxs.reset();
  statusEl.textContent = `Running ${model}`;
};
```

3. All event handlers that call `startEmulator` already call `initAudio()` first — this is unchanged. The auto-start at line 252 does **not** call `initAudio()` (can't — no user gesture), so it will use the 44100 fallback until the user interacts and audio initializes, at which point `startEmulator` re-runs with the correct rate.

4. The `RING_SIZE` constant (8192 samples) remains unchanged. At 48000 Hz it represents ~171 ms of buffer instead of ~186 ms at 44100 Hz — still well above the ScriptProcessor callback interval (~43 ms at 48000 Hz). The comment on `RING_BITS` should be updated to reflect this: `// 8192 samples ≈ 171–186 ms depending on AudioContext sample rate`.

---

## Fix 3: 50 Hz Interrupt Independent of RAF

### Affected file: `src/devices/zxs/zxspectrum.js`

**Root cause:** `cpu.interrupt(0xFF)` is called at the top of every `frame()` call. The caller drives `frame()` from `requestAnimationFrame`, which fires at the display refresh rate (60, 75, 144 Hz…). The ZX Spectrum ULA generates a maskable interrupt at exactly 50 Hz.

### New state variables (added to the closure)

> **Prerequisite:** `src/z80.js` `steps()` must burn HALT cycles to ensure it always advances by at least N T-states even when the CPU is halted. Without this, `cpu.steps(0)` returns `actual=0`, causing `interruptCounter <= remaining` to remain true and the interrupt to fire twice per frame.

```js
/** T-states between 50 Hz ULA interrupts (exact hardware values). */
const INTERRUPT_PERIOD_48  = 69888;
const INTERRUPT_PERIOD_128 = 70908;
const interruptPeriod = is128k ? INTERRUPT_PERIOD_128 : INTERRUPT_PERIOD_48;
/** T-states remaining until the next interrupt. Persists across frame() calls. */
let interruptCounter = interruptPeriod;
```

Use the exact hardware values — do **not** compute via `Math.round(fcpu / 50)`:
- 48k: **69_888** T-states (3_500_000 / 50 = 70_000 — the formula gives a 112 T-state error per interrupt)
- 128k: **70_908** T-states (3_546_900 / 50 = 70_938 — the formula gives a 30 T-state error per interrupt, accumulating to 1500 T-states/second of drift)

### Frame execution loop

Replace the current single `cpu.interrupt()` + scanline loop with an interrupt-aware execution loop:

```
remaining = tStates
while remaining > 0:
  if interruptCounter <= remaining:
    tBefore = cpu.T()
    cpu.steps(interruptCounter)          // minimum budget — may overshoot
    actual = cpu.T() - tBefore          // actual T-states consumed
    render scanlines in [tRendered, tRendered + actual)
    tRendered += actual
    fire cpu.interrupt(0xFF)
    remaining -= actual                  // use actual, not requested budget
    interruptCounter = interruptPeriod
  else:
    tBefore = cpu.T()
    cpu.steps(remaining)
    actual = cpu.T() - tBefore
    render scanlines in [tRendered, tRendered + actual)
    tRendered += actual
    interruptCounter -= actual
    remaining = 0
```

`cpu.steps(n)` executes until at least `n` T-states have elapsed; the last instruction may overshoot by up to ~23 T-states (longest Z80 instruction). Always use the `cpu.T()` delta as the actual count to avoid drift in `interruptCounter`.

This design is intentionally robust to variable `tStates` per `frame()` call — the RAF loop passes a dt-derived value that varies each call. `interruptCounter` persists across calls and decrements by actual T-states consumed, so the interrupt fires at the correct absolute position regardless of frame slice size.

### Video rendering during split frames

The scanline rendering currently distributes T-states proportionally across `SCANLINES`. With a potential mid-frame interrupt split, the T-state cursor approach must be used — **do not batch-render all scanlines at the end of `frame()`**, as that would break programs that change the border color mid-frame (a common technique in demos and games).

Required approach:
- Track a **frame-relative T-state cursor** (`tRendered`, starts at 0 each `frame()` call).
- After each `cpu.steps(chunk)` call, render all scanlines whose proportional T-state position falls within `[tRendered, tRendered + chunk)`:
  ```js
  // render scanlines covered by [tRendered, tRendered + chunk)
  for (let line = 0; line < VISIBLE_LINES; line++) {
    const lineT = Math.round(tStates * line / SCANLINES);
    if (lineT >= tRendered && lineT < tRendered + chunk) {
      renderScanline(line, borderColor, flashPhase);
    }
  }
  tRendered += chunk;
  ```
- This preserves per-scanline border color accuracy regardless of how many execution chunks the frame is split into.

### Reset

On `reset()`, set `interruptCounter = interruptPeriod` so the first interrupt fires after exactly one 50 Hz period.

---

## Files Changed

| File | Change |
|------|--------|
| `src/devices/zxs/zxspectrum.js` | Fix 1 (AY guards), Fix 3 (interrupt counter + frame loop) |
| `src/devices/zxs/zxspectrum.html` | Fix 2 (sampleRate from AudioContext, update `RING_BITS` comment) |
| `src/z80.js` | Fix 3 prerequisite: HALT cycles now burn T-states to satisfy steps(N) invariant |
| `test/zxspectrum.test.js` | Fix 1 test (ZXS AY 48k), Fix 3 test (ZXS interrupt timing) |

No changes to `src/devices/ay3891x/ay3891x.js`.

---

## Testing

- Load a 48k SNA of a game known to use AY (e.g. games with AY music on 48k+) — verify sound.
- Load a 128k SNA with AY music — verify sound unchanged.
- Open browser DevTools, check `audioCtx.sampleRate` — verify it matches what was passed to `createZXS`.
- Load a game with interrupt-driven music player (e.g. any 128k game with menu music) — verify tempo matches original hardware speed.
- Verify no regression in beeper-only games.
