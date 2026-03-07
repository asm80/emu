# PRD: Intel 8080 WASM Port with Web Worker

> Czech summary: Přepis jádra emulátoru Intel 8080 do AssemblyScript/WASM a jeho spuštění jako Web Worker s SharedArrayBuffer komunikací.

## Overview

The Intel 8080 CPU emulator (`src/8080.js`) is rewritten in AssemblyScript and compiled to a `.wasm` binary. The WASM module runs inside a Web Worker, isolating the emulation loop from the main UI thread. Communication between the Worker and the main thread uses `postMessage` for control/events and `SharedArrayBuffer` for zero-copy memory and keyboard state sharing.

This is a proof-of-concept (POC) scoped to the 8080 CPU only. The architecture established here serves as the template for all other CPUs (`z80`, `6502`, `6809`, etc.).

## User story

As a developer building a browser-based vintage computer emulator (e.g. PMD-85), I want the CPU emulation to run in a Web Worker backed by WASM, so that the UI thread is never blocked during emulation and audio/display output are delivered per animation frame with minimal overhead.

## Entry points

| Trigger | Location | Details |
|---------|----------|---------|
| `import` in Worker script | `asm80-emu/wasm/` subproject | Consumer creates Worker, sends init config, then drives it with `frame` messages |
| Init message | Worker `onmessage` | `{ type: 'init', cpuFreq, intercepts, romData }` — sets up WASM memory and intercept table |
| Frame message | Worker `onmessage` | `{ type: 'frame', tStates }` — runs emulation for the given number of T-states |
| Debugger messages | Worker `onmessage` | `{ type: 'step' \| 'run' \| 'stop' \| 'breakpoint', ... }` |

## Inputs

### Init message payload

| Parameter | Type | Format | Required | Default | Validation |
|-----------|------|--------|----------|---------|------------|
| `cpuFreq` | `number` | Hz, e.g. `2000000` | No | `2000000` | > 0 |
| `intercepts` | `Intercept[]` | Array of `{ start, end, type }` | No | `[]` | max 10 entries; `type` ∈ `'rom'`, `'mmio'` |
| `romData` | `{ offset: number, data: Uint8Array }[]` | Regions to copy into WASM memory | No | `[]` | offsets within 0–0xFFFF |

### Frame message payload

| Parameter | Type | Format | Required | Default | Validation |
|-----------|------|--------|----------|---------|------------|
| `tStates` | `number` | Integer, e.g. `33333` for 60 fps @ 2 MHz | Yes | — | > 0 |

### Keyboard SharedArrayBuffer

| Offset | Size | Content |
|--------|------|---------|
| `0x00–0x0F` | 16 bytes | Keyboard row state, written by main thread before each `frame` message |

### MMIO read callback (JS → WASM import)

Called synchronously from inside WASM when a read hits an MMIO intercept range.

```
js_mmioRead(addr: u16) → u8
```

### MMIO write callback (JS → WASM import)

Called synchronously from inside WASM when a write hits an MMIO intercept range.

```
js_mmioWrite(addr: u16, val: u8) → void
```

## Expected behavior

### Happy path

1. **Subproject setup**: Consumer runs `npm install` inside `asm80-emu/wasm/`, then `npm run build` to produce `out/8080.wasm`.
2. **Worker init**: Main thread creates `new Worker('emu-worker.js')`.
3. **Memory allocation**: Worker instantiates WASM with a `WebAssembly.Memory` of 2 pages (128 KB — 64 KB for CPU memory + 64 KB for Worker overhead). The main thread receives a reference to the same `SharedArrayBuffer` via `memory.buffer`.
4. **Configuration**: Main thread sends `{ type: 'init', intercepts, romData }`. Worker populates the WASM intercept table and copies ROM regions into WASM linear memory at the specified offsets.
5. **Keyboard setup**: Main thread writes current key row state into the keyboard SAB before each frame.
6. **Frame loop**:
   - Main thread fires `requestAnimationFrame`, writes keyboard state, sends `{ type: 'frame', tStates: 33333 }`.
   - Worker runs a tight JS loop calling `wasm.exports.step()` until accumulated T-states reach `tStates`.
   - `wasm.exports.step()` returns the number of T-states consumed by the executed instruction.
   - For each T-state increment, Worker records speaker bit transitions for audio downsampling.
   - Worker builds a `Float32Array` of audio samples (44 100 / 60 ≈ 735 samples per frame).
   - Worker posts `{ type: 'frameDone', audioBuffer: Float32Array.buffer }` with transfer of the audio buffer (no copy).
7. **Display render**: Main thread reads video RAM directly from the shared `WebAssembly.Memory` buffer (zero-copy) and draws to Canvas.
8. **Audio playback**: Main thread forwards the transferred audio buffer to an `AudioWorklet`.

### MMIO callback flow (during step)

When `wasm.exports.step()` internally calls `byteAt(addr)` and `addr` falls within an MMIO intercept range:
- WASM invokes the imported `js_mmioRead(addr)` synchronously.
- The JS handler (in the Worker) reads the peripheral state and returns the value.
- WASM continues execution with the returned value.
- This is synchronous — no `postMessage` round-trip involved.

Peripherals (UART, 8255, timers) live in the Worker alongside the WASM module. They are not in the main thread.

### Debugger flow

Outside of the frame loop, the Worker accepts debugger commands:

| Message in | Behavior | Message out |
|------------|----------|-------------|
| `{ type: 'step' }` | Execute one instruction | `{ type: 'status', regs, cycles }` |
| `{ type: 'run' }` | Run until breakpoint or `stop` | `{ type: 'break', pc }` on hit |
| `{ type: 'stop' }` | Halt running loop | `{ type: 'status', regs, cycles }` |
| `{ type: 'breakpoint', addr }` | Register breakpoint address | — |
| `{ type: 'setRegister', reg, value }` | Set CPU register via `wasm.exports.setReg(reg, value)` | — |

### Error handling

| Error condition | Worker behavior | Main thread receives |
|----------------|-----------------|----------------------|
| `wasm` fetch fails | Worker terminates | `{ type: 'error', message }` |
| `intercepts` array > 10 entries | Truncate to 10, continue | `{ type: 'warning', message }` |
| `romData` offset out of 0–0xFFFF range | Skip that region | `{ type: 'warning', message }` |
| `tStates` ≤ 0 in frame message | Ignore, post `frameDone` with empty audio | — |
| HLT instruction executed | Worker pauses loop | `{ type: 'halt', pc }` |
| WASM trap / unreachable | Worker catches, resets CPU | `{ type: 'error', message }` |

## Integration points

### Existing code (asm80-emu)

| File | Role | Interaction |
|------|------|-------------|
| `src/8080.js` | Reference implementation | WASM port must produce identical behavior; existing QUnit tests in `test/8080.test.js` are the acceptance oracle |
| `test/8080.test.js` | 86 QUnit tests incl. 8080 Exerciser | Run against WASM port to verify correctness |
| `test/8080-demo.js` | Demo runner | Adapt to drive WASM Worker for integration smoke test |

### New files (in `asm80-emu/wasm/`)

| File | Purpose |
|------|---------|
| `assembly/8080.ts` | AssemblyScript 8080 CPU implementation |
| `assembly/memory.ts` | byteAt / byteTo with intercept table |
| `assembly/index.ts` | Exports: `step()`, `reset()`, `status()`, `setReg()`, `getSpeakerBit()`, `configureIntercept()` |
| `js/emu-worker.js` | Web Worker entry point — init, frame loop, debugger commands |
| `js/keyboard.js` | SharedArrayBuffer keyboard helper (used by both sides) |
| `package.json` | AS devDependency, build scripts |
| `asconfig.json` | AssemblyScript compiler config |

### WASM exported API surface

```typescript
// Called from Worker JS tight loop
export function step(): i32          // execute one instruction, return T-states consumed
export function reset(): void
export function status(): void       // writes register snapshot to a fixed offset in memory
export function setReg(id: u8, value: u16): void
export function getSpeakerBit(): u8  // current speaker output bit (0 or 1)

// Called once during init
export function configureIntercept(
  index: i32, start: u16, end: u16, type: u8
): void
export function setInterceptCount(n: i32): void
```

`status()` writes register values to a fixed reserved region of WASM linear memory (e.g. offset `0x10000`), readable by the Worker without an extra return value encoding.

## Scope boundary

This feature does NOT:

- Port any CPU other than 8080 (Z80, 6502, etc. are future work following this template).
- Implement any specific peripheral (UART, 8255) — the MMIO callback interface is provided; peripheral logic is consumer responsibility.
- Replace or modify the existing JS `src/8080.js` — both implementations coexist.
- Provide a full computer emulator UI — this is the CPU + memory layer only.
- Handle audio mixing or AudioWorklet registration — the Worker delivers raw `Float32Array` samples; the consumer owns AudioWorklet setup.
- Implement display rendering — the consumer reads video RAM directly from the shared WASM memory buffer.
- Support `SharedArrayBuffer` polyfills — COOP/COEP headers are the consumer's responsibility.
- Support Node.js — this WASM Worker subproject targets browsers only.

## Acceptance criteria

- [ ] `npm run build` inside `asm80-emu/wasm/` produces `out/8080.wasm` without errors.
- [ ] All 86 existing QUnit tests in `test/8080.test.js` pass when run against the WASM port (adapted test harness).
- [ ] The 8080 Exerciser test suite passes (same requirement as the JS implementation).
- [ ] A frame message with `tStates: 33333` completes and posts `frameDone` with a `Float32Array` of exactly 735 samples.
- [ ] Keyboard SAB written by main thread is read correctly by WASM `portIn` within the same frame.
- [ ] An MMIO intercept write triggers `js_mmioWrite` synchronously; a plain RAM write does not.
- [ ] A ROM intercept write is silently ignored; a ROM intercept read returns the value in WASM memory.
- [ ] `{ type: 'step' }` debugger message executes exactly one instruction and returns correct `regs`.
- [ ] `{ type: 'breakpoint', addr: X }` causes a running loop to stop at PC=X and post `{ type: 'break', pc: X }`.
- [ ] Main thread can read video RAM from the shared `WebAssembly.Memory` buffer without any `postMessage`.
- [ ] Audio buffer is transferred (not copied) — `Float32Array.buffer.byteLength` in Worker is 0 after `postMessage`.

## Technical notes

### AssemblyScript constraints relevant to this port

- No closures capturing mutable variables across function boundaries — use module-level `let` for CPU registers.
- No `function` keyword — use `function` declarations (AS supports both, unlike the JS style guide; standard AS style applies here).
- `StaticArray<T>` for fixed-size lookup tables (parity, DAA, disasm) — more cache-friendly than `Array<T>`.
- `@inline` decorator on `byteAt`/`byteTo` — eliminates function call overhead for the hot path.
- `load<u8>(addr)` / `store<u8>(addr, val)` are direct WASM `i32.load8_u` / `i32.store8` instructions with no bounds checking overhead (AS `--noAssert` in release build).

### Memory layout (WASM linear memory)

```
Page 0 (64 KB):  0x00000–0x0FFFF   CPU addressable memory (RAM + ROM regions)
Page 1 (64 KB):  0x10000–0x1000F   Register snapshot (written by status())
                 0x10010–0x1001F   Keyboard rows (16 bytes, written by main thread via SAB)
                 0x10020–0x1002F   Intercept table metadata
```

### Audio downsampling

```
CPU frequency:   2 000 000 Hz
Audio rate:      44 100 Hz
T-states/sample: 2 000 000 / 44 100 ≈ 45.35
```

Worker accumulates speaker bit transitions during the frame loop and writes one sample per 45.35 T-states elapsed. Output range: `+0.5` (speaker on) / `-0.5` (speaker off).

### Project location

`asm80-emu/wasm/` — standalone npm subproject with its own `package.json`. Not published to npm independently; consumed by referencing the built `out/8080.wasm` directly. The parent `asm80-emu` package is unmodified.
