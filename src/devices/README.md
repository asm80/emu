# Integrating a Device Emulator into a Browser Host

This document describes patterns and pitfalls for wiring a device-level emulator
(CPU + memory + I/O) into a browser page. The lessons here were distilled from
building the PMD-85 headless emulator (`pmd/pmd85.js`) and its demo host
(`demo/pmd85.html`), but the principles apply to any vintage machine.

---

## The Three Loops

A working emulator host needs exactly three independent loops, each running at
its own rate and on its own schedule. Mixing them causes the hardest bugs to
debug.

```
┌─────────────────────────────────────────────────┐
│  CPU loop      — runs inside ScriptProcessor    │
│  Render loop   — runs on requestAnimationFrame  │
│  Tape/disk I/O — synchronous, driven by CPU     │
└─────────────────────────────────────────────────┘
```

---

## 1. CPU / Audio Loop (ScriptProcessorNode)

The Web Audio API's `ScriptProcessorNode` is the best scheduler for a CPU
emulator: it fires at a fixed wall-clock interval, it is driven by the audio
hardware (so it cannot skip), and it gives you an output buffer to fill with
sound samples simultaneously.

```js
const audioCtx   = new AudioContext();
const sampleRate  = audioCtx.sampleRate;          // typically 44100 or 48000
const bufferSize  = 4096;                          // must be power of 2 ≥ 2048
const processor   = audioCtx.createScriptProcessor(bufferSize, 0, 1);

processor.connect(audioCtx.destination);

processor.onaudioprocess = (e) => {
  const out     = e.outputBuffer.getChannelData(0);
  const samples = out.length;                      // == bufferSize

  // Run the CPU for exactly as many cycles as correspond to this audio frame.
  // Typical vintage CPUs run at 2–4 MHz; audio at 48 kHz means ~100 CPU
  // cycles per sample.
  const cpuCyclesPerSample = CPU_CLOCK_HZ / sampleRate;

  for (let i = 0; i < samples; i++) {
    cpu.singleStep();                              // advance CPU one or more steps
    out[i] = getCurrentAudioSample();             // read speaker/beeper state
  }
};
```

### Critical: size the internal audio buffer correctly

The device module accumulates audio samples between calls. The internal buffer
**must** hold at least `bufferSize` samples, or you get clicks and dropouts:

```js
// WRONG — sampleRate/30 ≈ 1600 samples < bufferSize (4096) → crackling
const audioBuffer = new Float32Array(sampleRate / 30);

// CORRECT — always larger than the ScriptProcessor buffer size
const audioBuffer = new Float32Array(Math.ceil(sampleRate / 10) + 2);
```

The rule: `internalBuffer.length ≥ bufferSize * safetyMargin` (1.5× is enough).

### Why not AudioWorklet?

`AudioWorklet` is the modern replacement, but `ScriptProcessorNode` is simpler,
runs synchronously, and is sufficient for emulators that do not need sub-millisecond
latency. Use it freely; deprecation warnings are cosmetic.

---

## 2. Render Loop (requestAnimationFrame)

**Never render to canvas inside the ScriptProcessor callback.**

`onaudioprocess` runs on the main thread but is called from within the audio
subsystem's scheduling context. DOM operations inside it block the audio thread,
causing exactly the crackling you tried to fix. Keep them completely separate:

```js
// BAD — blocks audio
processor.onaudioprocess = (e) => {
  runCpu(e.outputBuffer);
  renderDisplay(canvas, ram);   // ← kills audio quality
};

// GOOD — two independent loops
processor.onaudioprocess = (e) => {
  runCpu(e.outputBuffer);       // audio only
};

const rafLoop = () => {
  if (!running) return;
  renderDisplay(canvas, ram);   // rendering only, ~60 fps
  requestAnimationFrame(rafLoop);
};
requestAnimationFrame(rafLoop);
```

`requestAnimationFrame` fires at ~60 Hz regardless of audio buffer size, which
is the right rate for display anyway (vintage machines typically ran at 50–60 Hz
video).

---

## 3. Memory Map and ROM Mirroring

Vintage CPUs often have incompletely decoded address lines. A 4 KB ROM chip with
only 12 address pins connected to a 16-bit bus appears at **every** 4 KB
boundary within the chip-select range. You must replicate this in `byteTo` and
in `reset()`.

```js
// Example: 4 KB ROM mirrored 4× into 0x8000–0xBFFF (A12/A13 unconnected)
const reset = () => {
  // Copy ROM into all four mirror positions
  const rom4k = rom.subarray(0, 4096);
  for (let mirror = 0; mirror < 4; mirror++) {
    ram.set(rom4k, 0x8000 + mirror * 0x1000);
  }
};

// Write-protect the entire mirrored region
const byteTo = (addr, val) => {
  if (addr >= 0x8000 && addr < 0xC000) return;  // ROM area — ignore writes
  ram[addr] = val;
};
```

Forgetting the mirroring causes mysterious crashes when the program jumps to an
address in the mirror range expecting ROM to be there.

---

## 4. Keyboard Capture (F-keys and Browser Shortcuts)

Standard `addEventListener("keydown", handler)` runs in the **bubble** phase,
after the browser has already processed special keys (F5 = reload, F12 = devtools, etc.).
Add `{ capture: true }` to intercept in the **capture** phase, before the browser acts:

```js
window.addEventListener("keydown", (e) => {
  if (e.altKey || e.metaKey) return;   // let Alt+F4, Cmd+Q etc. pass through
  mapKey(e.keyCode);
  e.preventDefault();                  // suppress browser default for ALL other keys
}, { capture: true });

window.addEventListener("keyup", (e) => {
  if (e.altKey || e.metaKey) return;
  unmapKey(e.keyCode);
  e.preventDefault();
}, { capture: true });
```

With `{ capture: true }` and `e.preventDefault()`, F1–F12 all reach the
emulator and none trigger browser menus. The only safe exceptions are OS-level
shortcuts (Alt+F4, Cmd+Q) which cannot be intercepted at all.

---

## 5. Tape / Disk: Synchronous I/O

Tape and disk reads on vintage hardware were driven by the CPU polling a status
port in a tight loop. Emulate this the same way: make `portIn()` return the
next tape bit/byte when the CPU asks, and advance the tape head as a side effect.

```js
// The CPU calls portIn(TAPE_PORT) thousands of times per second.
// Each call just returns the next bit/byte from the tape buffer.
portIn: (port) => {
  if (port === TAPE_STATUS_PORT) return tapeReady() ? 0x02 : 0x00;
  if (port === TAPE_DATA_PORT)   return tapeReadByte();
  return 0xFF;
},
```

No timers, no async — the CPU loop is the scheduler.

---

## 6. Starting and Stopping Cleanly

```js
let running = false;

const start = () => {
  if (running) return;
  running = true;
  audioCtx.resume();             // AudioContext starts suspended on iOS/Chrome
  requestAnimationFrame(rafLoop);
};

const stop = () => {
  running = false;
  audioCtx.suspend();
};
```

Always call `audioCtx.resume()` in response to a user gesture (click, keypress).
Browsers block audio autoplay without a gesture.

---

## 7. Device Module Contract

A well-structured device module (`pmd85.js` style) should export:

```js
export default (options) => {
  // options: { sampleRate, canvas?, ... }

  return {
    reset(),                   // cold boot
    steps(n),                  // run N CPU cycles; returns audio samples array
    getRAM(),                  // Uint8Array view of full address space
    tape: {
      load(Uint8Array),        // insert tape
      rewind(),                // seek to start
    },
    keyboard: {
      keyDown(keyCode),
      keyUp(keyCode),
    },
  };
};
```

Keep the module **headless**: no DOM access, no canvas, no Audio inside it.
The host page owns all browser APIs; the module owns the CPU, memory, and I/O.
This makes the module testable in Node.js without a browser.

---

## Checklist

| Concern | Correct approach |
|---|---|
| CPU timing | Run inside `onaudioprocess`, cycle-count driven by `sampleRate` |
| Audio buffer size | `≥ ScriptProcessor bufferSize` (never `sampleRate/30`) |
| Rendering | Separate `requestAnimationFrame` loop, never inside audio callback |
| ROM mirroring | Replicate in `reset()` and write-protect in `byteTo()` |
| F-key capture | `addEventListener(..., { capture: true })` + `preventDefault()` |
| AudioContext start | Call `resume()` inside a user-gesture handler |
| Module design | Headless — no DOM, no Audio; host page wires everything together |
