# ZX Spectrum Deferred FrameBuffer Design

> **For agentic workers:** Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan.

**Goal:** Replace the current scanline-driven RGBA renderer with a JSSpeccy3-style deferred frameBuffer that captures raw ULA output at per-8T granularity, enabling accurate border effects, flash/cursor rendering, and floating bus values.

**Architecture:** A pre-built `screenEventsTable` lists every ULA video event (border or pixel fetch) with its exact frame-relative T-state. `updateFramebuffer(t)` is called on every VRAM write and border color change — it flushes all pending events up to T into a raw `frameBuffer` log. At end of frame a single `decodeFrameBuffer()` pass converts the log to RGBA pixels.

**Tech Stack:** JavaScript ES6 modules, Uint32Array (events table), Uint8Array (frameBuffer), Uint32Array view (RGBA videoBuffer).

---

## ULA Timing Reference (48k)

```
Scanline = 224 T-states:
  T=  0 ..  23   Left border   (24T = 3 × 8T groups = 48px at 2px/T)
  T= 24 .. 151   Active display (128T = 32 × 4T fetches = 32 bytes = 256px)
  T=152 .. 175   Right border  (24T = 3 × 8T groups = 48px)
  T=176 .. 223   HBlank        (48T, not visible)

Visible frame starts at T = SCREEN_START_T_48 - TOP_BORDER * 224 = 14335 - 48*224 = 3583
```

For 128k: scanlineT=228, SCREEN_START_T_128=14361, visStartT=14361-48*228=3417.

---

## Data Structures

### screenEventsTable — Uint32Array

Pre-computed once at `reset()`. Each event = 2 × u32:

```
u32[0] = frame-relative T-state of event start
u32[1] = 0xFFFFFFFF          → border event (16px wide)
          otherwise: lo16 = pixelAddr (VRAM offset 0x0000..0x17FF)
                     hi16 = attrAddr  (VRAM offset 0x1800..0x1AFF)
                                        → pixel event (8px wide)
Table terminated by entry: [0xFFFFFFFF, 0xFFFFFFFF]
```

Event count per scanline:
- Active scanline:  3 (left border) + 32 (pixels) + 3 (right border) = 38 events
- Border scanline:  3 (left border) + 16 (border across active width) + 3 (right border) = 22 events

Total events:
```
 48 × 22 = 1 056   top border
192 × 38 = 7 296   active display
 56 × 22 = 1 232   bottom border
──────────────────
           9 584   events × 2 u32 = 76 672 bytes + 2 u32 terminator
```

### frameBuffer — Uint8Array (~15 728 bytes)

Raw ULA output log, written by `updateFramebuffer()`:

```
border event → 1 byte  (border color index 0–7, renderer → 16 RGBA pixels)
pixel event  → 2 bytes (pixelByte, attrByte,    renderer → 8 RGBA pixels)
```

Size: `(1 056 + 1 232) × 1 + 7 296 × 2 = 2 288 + 14 592 = 16 880 bytes`

### Internal state variables

```javascript
let screenEventsTable  // Uint32Array — pre-built event table
let frameBuffer        // Uint8Array  — raw ULA log
let screenEventPtr     // index into screenEventsTable (next event to process)
let frameBufferPtr     // index into frameBuffer (next write position)
let floatingBusValue   // last byte ULA fetched from VRAM (0xFF during border/blanking)
```

---

## Core Functions

### `buildScreenEventsTable()`

Called once at `reset()` and when 128k screen bank changes.

```javascript
const buildScreenEventsTable = () => {
  const scanlineT   = is128k ? TSTATE_PER_LINE_128 : TSTATE_PER_LINE_48;
  const screenStart = is128k ? SCREEN_START_T_128  : SCREEN_START_T_48;
  const visStartT   = screenStart - TOP_BORDER * scanlineT;
  const table = new Uint32Array(9584 * 2 + 2);
  let ptr = 0;

  for (let line = 0; line < VISIBLE_LINES; line++) {
    const lineBaseT = visStartT + line * scanlineT;
    const isActive  = line >= TOP_BORDER && line < TOP_BORDER + ACTIVE_LINES;
    const y         = line - TOP_BORDER;

    // Left border: 3 × 8T groups at T=0,8,16
    for (let g = 0; g < 3; g++) {
      table[ptr++] = lineBaseT + g * 8;
      table[ptr++] = 0xFFFFFFFF;
    }

    if (isActive) {
      // Active display: 32 × 4T fetches at T=24,28,...,148
      for (let xByte = 0; xByte < 32; xByte++) {
        const pixAddr  = ((y & 0xC0) << 5) | ((y & 0x07) << 8) |
                         ((y & 0x38) << 2) | xByte;
        const attrAddr = 0x1800 | ((y >> 3) * 32) | xByte;
        table[ptr++] = lineBaseT + 24 + xByte * 4;
        table[ptr++] = pixAddr | (attrAddr << 16);
      }
    } else {
      // Border across active width: 16 × 8T groups at T=24,32,...,144
      for (let g = 0; g < 16; g++) {
        table[ptr++] = lineBaseT + 24 + g * 8;
        table[ptr++] = 0xFFFFFFFF;
      }
    }

    // Right border: 3 × 8T groups at T=152,160,168
    for (let g = 0; g < 3; g++) {
      table[ptr++] = lineBaseT + 152 + g * 8;
      table[ptr++] = 0xFFFFFFFF;
    }
  }

  // Terminator
  table[ptr++] = 0xFFFFFFFF;
  table[ptr++] = 0xFFFFFFFF;
  return table;
};
```

### `updateFramebuffer(currentT)`

Called on: VRAM write, border color change, portIn odd port, end of frame.
Processes all pending screenEvents with T-state ≤ currentT.

```javascript
const updateFramebuffer = (currentT) => {
  while (true) {
    const evT = screenEventsTable[screenEventPtr];
    if (evT > currentT || evT === 0xFFFFFFFF) break;
    const data = screenEventsTable[screenEventPtr + 1];
    if (data === 0xFFFFFFFF) {
      frameBuffer[frameBufferPtr++] = borderColor;
      floatingBusValue = 0xFF;
    } else {
      const vramBase = is128k ? screenBank * 16384 : 0;
      const pixAddr  = data & 0xFFFF;
      const attrAddr = data >> 16;
      const pixByte  = is128k ? ram128[vramBase + pixAddr] : ram48[pixAddr];
      const attrByte = is128k ? ram128[vramBase + attrAddr] : ram48[attrAddr];
      frameBuffer[frameBufferPtr++] = pixByte;
      frameBuffer[frameBufferPtr++] = attrByte;
      floatingBusValue = attrByte;
    }
    screenEventPtr += 2;
  }
};
```

### `decodeFrameBuffer(flashPhase)`

Called once at end of `frame()`. Converts raw frameBuffer to RGBA videoBuffer.
Iterates screenEventsTable in parallel to know event type and pixel position.

```javascript
const decodeFrameBuffer = (flashPhase) => {
  let fbPtr  = 0;
  let evPtr  = 0;
  let line   = 0;
  let xPixel = 0;

  while (true) {
    const evT = screenEventsTable[evPtr];
    if (evT === 0xFFFFFFFF) break;
    const data = screenEventsTable[evPtr + 1];
    evPtr += 2;

    const rowBase = line * SCREEN_W;

    if (data === 0xFFFFFFFF) {
      // border: 16 pixels of same color
      const rgba = ZX_PALETTE_RGBA[frameBuffer[fbPtr++]];
      for (let i = 0; i < 16; i++) videoView[rowBase + xPixel + i] = rgba;
      xPixel += 16;
    } else {
      // pixel: 8 pixels ink/paper from attribute
      const pixByte  = frameBuffer[fbPtr++];
      const attrByte = frameBuffer[fbPtr++];
      const bright   = (attrByte & 0x40) ? 8 : 0;
      let   inkIdx   = (attrByte & 0x07) | bright;
      let   paperIdx = ((attrByte >> 3) & 0x07) | bright;
      if ((attrByte & 0x80) && flashPhase) {
        const tmp = inkIdx; inkIdx = paperIdx; paperIdx = tmp;
      }
      const ink   = ZX_PALETTE_RGBA[inkIdx];
      const paper = ZX_PALETTE_RGBA[paperIdx];
      for (let bit = 7; bit >= 0; bit--) {
        videoView[rowBase + xPixel + (7 - bit)] =
          (pixByte >> bit) & 1 ? ink : paper;
      }
      xPixel += 8;
    }

    if (xPixel >= SCREEN_W) {
      xPixel = 0;
      line++;
    }
  }
};
```

---

## Integration Points

### `byteTo` callback — VRAM write hook

```javascript
const byteTo = (addr, val) => {
  if (addr >= 0x4000 && addr < 0x5B00) {
    // Flush all events up to current T BEFORE the write takes effect.
    // Events processed after this point will read the new VRAM value.
    updateFramebuffer(cpu.T() - frameBaseT);
  }
  // ... normal memory write
};
```

Address range 0x4000–0x5AFF covers pixel RAM (0x4000–0x57FF) and attribute RAM (0x5800–0x5AFF).

### `portOut` — border color change

```javascript
if ((fullAddr & 0x0001) === 0) {
  updateFramebuffer(cpu.T() - frameBaseT); // flush before color change
  borderColor = val & 0x07;
  // MIC/EAR bits handled separately (beeper)
}
```

### `portIn` — floating bus (odd unhandled port)

```javascript
// Kempston joystick check first
if (!(port & 0xE0)) return 0;
// Floating bus: advance ULA state to current T, return last fetched byte
updateFramebuffer(cpu.T() - frameBaseT);
return floatingBusValue;
```

### `frame()` — simplified main loop

```javascript
frame: (tStates, keyMatrix) => {
  // ... keyboard, tape, audio init unchanged ...

  // Reset framebuffer pointers for this frame
  screenEventPtr = 0;
  frameBufferPtr = 0;
  floatingBusValue = 0xFF;

  const flashPhase = (frameCount >> 4) & 1;
  const frameLen   = is128k ? FRAME_T_128 : FRAME_T_48;

  // Execute all T-states (updateFramebuffer called reactively via hooks)
  let remaining = tStates;
  while (remaining > 0) {
    if (interruptCounter <= remaining) {
      const tBefore = cpu.T();
      cpu.steps(interruptCounter);
      remaining -= cpu.T() - tBefore;
      cpu.interrupt(0xFF);
      interruptCounter = interruptPeriod;
    } else {
      const tBefore = cpu.T();
      cpu.steps(remaining);
      interruptCounter -= cpu.T() - tBefore;
      remaining = 0;
    }
  }

  // Flush remaining events and decode to RGBA
  updateFramebuffer(frameLen);
  decodeFrameBuffer(flashPhase);

  frameCount++;
  // ... audio generation unchanged ...
}
```

---

## Files Changed

| File | Change |
|---|---|
| `src/devices/zxs/zxspectrum.js` | All changes (see below) |
| `test/zxspectrum.test.js` | Update/add tests |

### zxspectrum.js — what is added

- `buildScreenEventsTable()` — new function
- `screenEventsTable`, `frameBuffer`, `screenEventPtr`, `frameBufferPtr`, `floatingBusValue` — new variables
- `updateFramebuffer(t)` — new function
- `decodeFrameBuffer(flashPhase)` — new function, replaces `renderScanline()`
- VRAM write hook in `byteTo`
- `updateFramebuffer()` calls in `portOut` and `portIn`

### zxspectrum.js — what is removed

- `renderScanline()` — replaced by `decodeFrameBuffer()`
- `floatingBusAt()` — replaced by `floatingBusValue` in `updateFramebuffer()`
- `borderEvents`, `borderColorAtFrameStart`, `getBorderColorAtT()` — no longer needed
- Scanline-driven loop in `frame()` — replaced by simple `cpu.steps()` + flush

### zxspectrum.js — what is kept unchanged

- `contentionTable`, `buildContentionTable()`, `contentionAt()` — I/O contention is independent
- `ioContentionForPort()` — I/O contention logic unchanged
- Beeper, AY, tape — unchanged
- Public API surface: `frame()`, `reset()`, `loadSNA()`, `status()`, etc. — unchanged

---

## Testing

### New tests to add (`test/zxspectrum.test.js`)

**`buildScreenEventsTable`** module:
- First event T-state = visStartT (T=3583 for 48k)
- Event at T=3583+48*224+24 = first active pixel event, data ≠ 0xFFFFFFFF
- Event at T=3583 is border (data === 0xFFFFFFFF)
- Active line 0, xByte=0: pixAddr=0x0000, attrAddr=0x1800
- Active line 8, xByte=0: pixAddr=0x0100 (y=8 → third=0,row=1 → addr=0x0100)
- Table terminates with 0xFFFFFFFF

**`updateFramebuffer + decodeFrameBuffer`** module:
- Single border color → all border pixels correct RGBA
- Write pixel byte to 0x4000 before active scan → pixel visible in output
- Write pixel byte to 0x4000 AFTER active scan for that line → old value visible (new value next frame)
- Flash attribute: flashPhase=0 → ink on set bits; flashPhase=1 → paper on set bits

**`floating bus via updateFramebuffer`** module:
- During border/blanking: floatingBusValue = 0xFF
- During active display: floatingBusValue = last attr byte fetched

### Existing tests to update

- `floating bus (48k)` module: tests currently call `floatingBusAt()` directly — rewrite to use `frame()` with a controlled VRAM state and verify portIn return value
- `contention table` and `I/O contention` modules: no changes needed
