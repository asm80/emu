# ZX Spectrum Deferred FrameBuffer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the scanline-driven RGBA renderer in `zxspectrum.js` with a JSSpeccy3-style deferred frameBuffer that captures raw ULA output at per-8T granularity, giving accurate border effects, flash rendering, and floating bus values.

**Architecture:** A pre-built `screenEventsTable` (Uint32Array) lists every ULA video event with its exact frame-relative T-state. `updateFramebuffer(t)` is called reactively on VRAM writes and border color changes — it flushes pending events into a raw `frameBuffer` log. At end of `frame()` a single `decodeFrameBuffer()` pass converts the log to RGBA pixels.

**Tech Stack:** JavaScript ES6 modules, Uint32Array (events table), Uint8Array (frameBuffer + videoBuffer), Uint32Array view (RGBA videoView). QUnit for tests. Run tests with `npm run test:run`.

**Spec:** `docs/superpowers/specs/2026-03-21-zxs-deferred-framebuffer-design.md`

**Branch:** `feat/zxs-deferred-framebuffer` (already created, based on master)

---

## File Map

| File | Change |
|---|---|
| `src/devices/zxs/zxspectrum.js` | All implementation changes |
| `test/zxspectrum.test.js` | New tests + update floating bus tests |

### What will be added to `zxspectrum.js`
- `buildScreenEventsTable()` — called in `reset()`
- `screenEventsTable`, `frameBuffer`, `screenEventPtr`, `frameBufferPtr`, `floatingBusValue`
- `updateFramebuffer(t)`
- `decodeFrameBuffer(flashPhase)`
- VRAM write hook in `byteTo` (line ~492)
- `updateFramebuffer()` calls in `portOut` (line ~558) and `portIn` (line ~544)

### What will be removed from `zxspectrum.js`
- `renderScanline()` (lines 600–653) — replaced by `decodeFrameBuffer()`
- `floatingBusAt()` (lines 344–372) — replaced by `floatingBusValue` in `updateFramebuffer()`
- `borderEvents`, `borderColorAtFrameStart`, `getBorderColorAtT()` (lines 319–323, 782–789)
- Scanline loop inside `frame()` (lines 767–830) — replaced by simple `cpu.steps()` + flush

### What stays unchanged
- `contentionTable`, `buildContentionTable()`, `contentionAt()`, `ioContentionForPort()` — I/O contention is independent
- Beeper, AY, tape, SNA load/save — untouched
- Public API surface: `frame()`, `reset()`, `loadSNA()`, `status()`, etc.

---

## ULA Timing Reference

You will need these numbers throughout. Memorise them.

```
ZX Spectrum 48k — scanline = 224 T-states:
  T=  0 ..  23   Left border   (24T = 3 × 8T groups = 48px)
  T= 24 .. 151   Active display (128T = 32 × 4T fetches = 256px)
  T=152 .. 175   Right border  (24T = 3 × 8T groups = 48px)
  T=176 .. 223   HBlank        (48T, not visible)

Visible frame starts at T = 14335 - 48*224 = 3583 (frame-relative)

ZX Spectrum 128k — scanline = 228T, screen start = 14361, visStartT = 3417
```

Event counts per scanline:
- Active scanline:  3 (left border) + 32 (pixels, 4T each) + 3 (right border) = 38
- Border scanline:  3 (left border) + 16 (border, 8T each) + 3 (right border) = 22

Total events: 48×22 + 192×38 + 56×22 = 1056 + 7296 + 1232 = **9584**

---

## Chunk 1: screenEventsTable

### Task 1: `buildScreenEventsTable()` + new state variables

**Files:**
- Modify: `src/devices/zxs/zxspectrum.js` — add after line 451 (`ioContentionExtra`)
- Modify: `test/zxspectrum.test.js` — add new test module

#### Background for implementors

The screenEventsTable is a Uint32Array where each event occupies 2 consecutive u32 slots:
- `table[ptr]`   = frame-relative T-state of the event
- `table[ptr+1]` = `0xFFFFFFFF` for a border event (ULA outputs border color)
             OR `pixAddr | (attrAddr << 16)` for a pixel event (ULA fetches VRAM)

The pixel address formula for ZX Spectrum VRAM:
```javascript
// y = display line 0-191, xByte = byte column 0-31
const pixAddr  = ((y & 0xC0) << 5) | ((y & 0x07) << 8) | ((y & 0x38) << 2) | xByte;
const attrAddr = 0x1800 | ((y >> 3) * 32) | xByte;
// pixAddr max = 0x17FF (13 bits), attrAddr max = 0x1AFF (13 bits) — both fit in 16 bits
```

- [ ] **Step 1: Add new state variables** — insert after line 451 (`let ioContentionExtra = 0;`) in `zxspectrum.js`:

```javascript
  // ── Deferred frameBuffer (JSSpeccy3-style ULA log) ────────────────────────

  /** Pre-computed ULA video events for one full frame. Built at reset(). */
  let screenEventsTable = new Uint32Array(0);

  /** Raw ULA output log: border color bytes and pixel+attr byte pairs. */
  const frameBuffer = new Uint8Array(16880);

  /** Next unprocessed index in screenEventsTable. Reset each frame. */
  let screenEventPtr = 0;

  /** Next write index in frameBuffer. Reset each frame. */
  let frameBufferPtr = 0;

  /** Last byte the ULA fetched from VRAM. 0xFF during border/blanking. */
  let floatingBusValue = 0xFF;
```

- [ ] **Step 2: Write the failing tests** — add this module to `test/zxspectrum.test.js` after the existing `I/O contention` module:

```javascript
// ── screenEventsTable ─────────────────────────────────────────────────────────

QUnit.module("screenEventsTable (48k)", () => {

  QUnit.test("first event T-state = visStartT = 3583", (assert) => {
    const zxs = make48();
    const tbl = zxs.getScreenEventsTable();
    assert.strictEqual(tbl[0], 3583, "first event at T=3583");
  });

  QUnit.test("first event is a border event (data = 0xFFFFFFFF)", (assert) => {
    const zxs = make48();
    const tbl = zxs.getScreenEventsTable();
    assert.strictEqual(tbl[1], 0xFFFFFFFF, "first event is border");
  });

  QUnit.test("first pixel event T-state = screenStart + 24 = 14359", (assert) => {
    // Active line 0 = visible line 48, lineBaseT = 3583 + 48*224 = 14335
    // First pixel event at lineBaseT + 24 = 14359
    const zxs = make48();
    const tbl = zxs.getScreenEventsTable();
    // Skip 48 border scanlines × 22 events = 1056 events = 2112 u32 slots
    const firstActiveEventIdx = 1056 * 2;
    // First 3 events of active line are left-border (data=0xFFFFFFFF)
    // 4th event (index 3, slot 6) is the first pixel event
    const firstPixelIdx = firstActiveEventIdx + 3 * 2;
    assert.strictEqual(tbl[firstPixelIdx], 14359, "first pixel event T=14359");
  });

  QUnit.test("first pixel event has data != 0xFFFFFFFF", (assert) => {
    const zxs = make48();
    const tbl = zxs.getScreenEventsTable();
    const firstPixelIdx = 1056 * 2 + 3 * 2;
    assert.notStrictEqual(tbl[firstPixelIdx + 1], 0xFFFFFFFF, "pixel event has address data");
  });

  QUnit.test("active line 0, xByte=0: pixAddr=0x0000, attrAddr=0x1800", (assert) => {
    const zxs = make48();
    const tbl = zxs.getScreenEventsTable();
    const firstPixelDataIdx = 1056 * 2 + 3 * 2 + 1;
    const data = tbl[firstPixelDataIdx];
    const pixAddr  = data & 0xFFFF;
    const attrAddr = data >> 16;
    assert.strictEqual(pixAddr,  0x0000, "pixAddr=0x0000 for y=0, xByte=0");
    assert.strictEqual(attrAddr, 0x1800, "attrAddr=0x1800 for y=0, xByte=0");
  });

  QUnit.test("active line 8, xByte=0: pixAddr=0x0100", (assert) => {
    // y=8: pixAddr = ((8 & 0xC0)<<5) | ((8 & 0x07)<<8) | ((8 & 0x38)<<2) | 0
    //             = 0 | (0<<8) | (8<<2) | 0 = 0x0020? Let's compute:
    // y=8: 0xC0&8=0, 0x07&8=0, 0x38&8=8 → (8<<2)=32=0x20
    // pixAddr = 0x0020
    // Actually: y=8, 0x07&8=0, 0x38&8=8, 0xC0&8=0 → ((0)<<5)|((0)<<8)|((8)<<2)|0 = 32 = 0x0020
    const zxs = make48();
    const tbl = zxs.getScreenEventsTable();
    // Active line 8 = visible line 56
    // Events before: 48 border scanlines (22 each) + 8 active scanlines (38 each) = 1056 + 304 = 1360 events
    const lineEventStart = 1360 * 2;
    const firstPixelDataIdx = lineEventStart + 3 * 2 + 1;
    const data = tbl[firstPixelDataIdx];
    const pixAddr = data & 0xFFFF;
    assert.strictEqual(pixAddr, 0x0020, "pixAddr=0x0020 for y=8, xByte=0");
  });

  QUnit.test("table terminates with 0xFFFFFFFF sentinel", (assert) => {
    const zxs = make48();
    const tbl = zxs.getScreenEventsTable();
    // 9584 events × 2 slots = 19168, then terminator at [19168] and [19169]
    assert.strictEqual(tbl[9584 * 2],     0xFFFFFFFF, "terminator T-state");
    assert.strictEqual(tbl[9584 * 2 + 1], 0xFFFFFFFF, "terminator data");
  });

});
```

- [ ] **Step 3: Run tests to verify they fail**

```
npm run test:run 2>&1 | grep -A2 "screenEventsTable"
```

Expected: tests fail because `getScreenEventsTable` is not defined.

- [ ] **Step 4: Implement `buildScreenEventsTable()`** — add after the new state variables (after `let floatingBusValue`):

```javascript
  /**
   * Build the pre-computed ULA video event table for one full frame.
   * Each event = 2 × u32: [frameRelativeT, data].
   * data = 0xFFFFFFFF for border events, or lo16=pixAddr | hi16=attrAddr for pixel events.
   * Must be called after is128k/screenBank are set (i.e. in reset() and after bank switch).
   *
   * @returns {Uint32Array} Event table (9584 events × 2 + 2 terminator)
   */
  const buildScreenEventsTable = () => {
    const scanlineT   = is128k ? TSTATE_PER_LINE_128 : TSTATE_PER_LINE_48;
    const screenStart = is128k ? SCREEN_START_T_128  : SCREEN_START_T_48;
    const visStartT   = screenStart - TOP_BORDER * scanlineT;
    const table = new Uint32Array(9584 * 2 + 2);
    let ptr = 0;

    for (let line = 0; line < VISIBLE_LINES; line++) {
      const lineBaseT = visStartT + line * scanlineT;
      const isActive  = line >= TOP_BORDER && line < TOP_BORDER + ACTIVE_LINES;
      const y         = line - TOP_BORDER;  // 0–191 for active lines

      // Left border: 3 × 8T groups at T=0, 8, 16 → 3×16px = 48px
      for (let g = 0; g < 3; g++) {
        table[ptr++] = lineBaseT + g * 8;
        table[ptr++] = 0xFFFFFFFF;
      }

      if (isActive) {
        // Active display: 32 × 4T fetches starting at T=24 → 32 × 8px = 256px
        for (let xByte = 0; xByte < 32; xByte++) {
          const pixAddr  = ((y & 0xC0) << 5) | ((y & 0x07) << 8) |
                           ((y & 0x38) << 2) | xByte;
          const attrAddr = 0x1800 | ((y >> 3) * 32) | xByte;
          table[ptr++] = lineBaseT + 24 + xByte * 4;
          table[ptr++] = pixAddr | (attrAddr << 16);
        }
      } else {
        // Border across active-display width: 16 × 8T groups → 16×16px = 256px
        for (let g = 0; g < 16; g++) {
          table[ptr++] = lineBaseT + 24 + g * 8;
          table[ptr++] = 0xFFFFFFFF;
        }
      }

      // Right border: 3 × 8T groups at T=152, 160, 168 → 3×16px = 48px
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

- [ ] **Step 5: Call `buildScreenEventsTable()` in `reset()`** — add inside `reset()` after `cpu.reset()`:

```javascript
      screenEventsTable = buildScreenEventsTable();
```

- [ ] **Step 6: Export `getScreenEventsTable`** — add to the returned public API object (near `trace`, `contentionAt`, etc.):

```javascript
    getScreenEventsTable: () => screenEventsTable,
```

- [ ] **Step 7: Run tests to verify they pass**

```
npm run test:run 2>&1 | grep -E "screenEventsTable|not ok|# fail"
```

Expected: all 6 screenEventsTable tests pass, `# fail 0`.

- [ ] **Step 8: Commit**

```bash
git add src/devices/zxs/zxspectrum.js test/zxspectrum.test.js
git commit -m "feat(zxs): add buildScreenEventsTable and deferred framebuffer state"
```

---

## Chunk 2: updateFramebuffer

### Task 2: `updateFramebuffer(t)` with floating bus

**Files:**
- Modify: `src/devices/zxs/zxspectrum.js` — add after `buildScreenEventsTable()`
- Modify: `test/zxspectrum.test.js` — add new module

#### Background for implementors

`updateFramebuffer(currentT)` processes all pending screenEvents whose T-state ≤ `currentT`.
It maintains `screenEventPtr` (which event to process next) and `frameBufferPtr` (where to write in frameBuffer).

For each event:
- **Border event** (`data === 0xFFFFFFFF`): write `borderColor` (0–7) as 1 byte → `floatingBusValue = 0xFF`
- **Pixel event**: read `ram48[pixAddr]` and `ram48[attrAddr]` → write 2 bytes → `floatingBusValue = attrByte`

For 128k: use `ram128[screenBank * 16384 + addr]` instead of `ram48[addr]`.

The key invariant: events are in chronological T-state order, so we just scan forward until `evT > currentT`.

- [ ] **Step 1: Write failing tests** — add after the screenEventsTable module in `test/zxspectrum.test.js`:

```javascript
// ── updateFramebuffer ─────────────────────────────────────────────────────────

QUnit.module("updateFramebuffer (48k)", () => {

  // Helper: run frame() but capture internal state by running to a specific T
  // We test updateFramebuffer indirectly via frame() output and floatingBusValue.

  QUnit.test("during border, floatingBusValue is 0xFF", (assert) => {
    const zxs = make48();
    // T=0 is border — run portIn at T≈0 (before active display)
    // We can't directly call updateFramebuffer, but we can test via frame()
    // by running a program that does IN A,(FF) very early in the frame.
    // For now, test via getFloatingBusValue() after a partial frame run.
    // (This test will need getFloatingBusValue export.)
    zxs.reset();
    // Initially floatingBusValue = 0xFF (border at frame start)
    assert.strictEqual(zxs.getFloatingBusValue(), 0xFF,
      "floatingBusValue starts at 0xFF (border)");
  });

  QUnit.test("after flush at T=14359, floatingBusValue = attrByte at 0x1800", (assert) => {
    // T=14359 = first pixel event (active line 0, xByte=0)
    // If we flush up to T=14359, the event at T=14359 is processed:
    //   pixAddr=0x0000, attrAddr=0x1800 → floatingBusValue = ram48[0x1800]
    const zxs = make48();
    const ram = zxs.getRAM();
    ram[0x0000] = 0xAB;  // pixel byte
    ram[0x1800] = 0xCD;  // attr byte
    zxs.updateFramebufferTo(14359);
    assert.strictEqual(zxs.getFloatingBusValue(), 0xCD,
      "floatingBusValue = attrByte after pixel event");
  });

  QUnit.test("after flush at T=14355 (still border), floatingBusValue = 0xFF", (assert) => {
    // T=14355 = within left border of active line 0 (lineBaseT=14335, border at T=14335,14343,14351)
    // Last border event at T=14351, next pixel event at T=14359
    const zxs = make48();
    const ram = zxs.getRAM();
    ram[0x1800] = 0xCD;
    zxs.updateFramebufferTo(14355);
    assert.strictEqual(zxs.getFloatingBusValue(), 0xFF,
      "floatingBusValue = 0xFF still in left border");
  });

  QUnit.test("frameBuffer byte at offset 0 = borderColor after first event", (assert) => {
    const zxs = make48();
    zxs.updateFramebufferTo(3583);  // first event T=3583 (border)
    // borderColor starts at 7 (white)
    assert.strictEqual(zxs.getFrameBufferByte(0), 7,
      "first frameBuffer byte = borderColor=7");
  });

  QUnit.test("pixel event writes pixelByte then attrByte", (assert) => {
    const zxs = make48();
    const ram = zxs.getRAM();
    ram[0x0000] = 0x55;  // pixel byte at offset 0
    ram[0x1800] = 0x38;  // attr byte at 0x1800
    // Flush just past first pixel event (T=14359)
    zxs.updateFramebufferTo(14360);
    // frameBuffer up to first pixel event:
    // - 48 border scanlines × 22 events × 1B = 2288 border bytes
    // Then active line 0: 3 border events × 1B = 3 bytes, then pixel event = 2 bytes
    const pixelOffset = 1056 + 3;  // 1056 border events before active, +3 left-border events
    assert.strictEqual(zxs.getFrameBufferByte(pixelOffset),     0x55, "pixelByte written");
    assert.strictEqual(zxs.getFrameBufferByte(pixelOffset + 1), 0x38, "attrByte written");
  });

});
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm run test:run 2>&1 | grep -E "updateFramebuffer|getFloatingBusValue|updateFramebufferTo|getFrameBufferByte"
```

Expected: all fail — functions not defined.

- [ ] **Step 3: Implement `updateFramebuffer()`** — add after `buildScreenEventsTable()`:

```javascript
  /**
   * Process all pending ULA video events up to (and including) currentT.
   *
   * Called reactively on VRAM writes, border color changes, and floating bus reads.
   * Maintains screenEventPtr and frameBufferPtr across calls within a frame.
   * Updates floatingBusValue with the last byte the ULA fetched.
   *
   * @param {number} currentT - Frame-relative T-state upper bound (inclusive)
   */
  const updateFramebuffer = (currentT) => {
    while (true) {
      const evT = screenEventsTable[screenEventPtr];
      if (evT > currentT || evT === 0xFFFFFFFF) break;
      const data = screenEventsTable[screenEventPtr + 1];
      if (data === 0xFFFFFFFF) {
        // Border event: ULA outputs border color, bus = 0xFF
        frameBuffer[frameBufferPtr++] = borderColor;
        floatingBusValue = 0xFF;
      } else {
        // Pixel event: ULA fetches pixel+attr from VRAM
        const pixAddr  = data & 0xFFFF;
        const attrAddr = data >> 16;
        const vramBase = is128k ? screenBank * 16384 : 0;
        const ram      = is128k ? ram128 : ram48;
        const pixByte  = ram[vramBase + pixAddr];
        const attrByte = ram[vramBase + attrAddr];
        frameBuffer[frameBufferPtr++] = pixByte;
        frameBuffer[frameBufferPtr++] = attrByte;
        floatingBusValue = attrByte;
      }
      screenEventPtr += 2;
    }
  };
```

- [ ] **Step 4: Export test helpers** — add to the returned public API object:

```javascript
    getFloatingBusValue:   () => floatingBusValue,
    getFrameBufferByte:    (i) => frameBuffer[i],
    updateFramebufferTo:   (t) => {
      // Reset pointers first so tests start from frame beginning
      if (screenEventPtr === 0 && frameBufferPtr === 0) {
        floatingBusValue = 0xFF;
      }
      updateFramebuffer(t);
    },
```

  **Note:** `updateFramebufferTo` is only for testing — production code calls `updateFramebuffer()` directly.

- [ ] **Step 5: Run tests to verify they pass**

```
npm run test:run 2>&1 | grep -E "updateFramebuffer|# fail"
```

Expected: all 5 updateFramebuffer tests pass, `# fail 0`.

- [ ] **Step 6: Commit**

```bash
git add src/devices/zxs/zxspectrum.js test/zxspectrum.test.js
git commit -m "feat(zxs): implement updateFramebuffer with reactive ULA event processing"
```

---

## Chunk 3: decodeFrameBuffer

### Task 3: `decodeFrameBuffer(flashPhase)`

**Files:**
- Modify: `src/devices/zxs/zxspectrum.js` — add after `updateFramebuffer()`
- Modify: `test/zxspectrum.test.js` — add new module

#### Background for implementors

`decodeFrameBuffer(flashPhase)` walks through `screenEventsTable` and `frameBuffer` in parallel to produce the final RGBA `videoView`. The table tells us what type each entry is (border=16px, pixel=8px) and where in the output to put it. `frameBuffer` gives us the raw byte values recorded during execution.

Pixel position tracking: maintain `line` (0–295) and `xPixel` (0–351). After writing to xPixel+N pixels, advance xPixel by N. When xPixel reaches SCREEN_W (352), reset to 0 and increment line.

For active pixel events: decode the attr byte into ink/paper with bright and flash:
```javascript
const bright   = (attrByte & 0x40) ? 8 : 0;
let   inkIdx   = (attrByte & 0x07) | bright;
let   paperIdx = ((attrByte >> 3) & 0x07) | bright;
if ((attrByte & 0x80) && flashPhase) { swap ink and paper; }
```

- [ ] **Step 1: Write failing tests** — add after the `updateFramebuffer` module:

```javascript
// ── decodeFrameBuffer ─────────────────────────────────────────────────────────

QUnit.module("decodeFrameBuffer (48k)", () => {

  // Helper: run a complete frame with given VRAM state and check videoBuffer
  const runFrameAndGetPixel = (zxs, x, y) => {
    zxs.frame(69888, null);
    const buf = zxs.getVideoBuffer();
    const offset = (y * 352 + x) * 4;
    return { r: buf[offset], g: buf[offset + 1], b: buf[offset + 2] };
  };

  QUnit.test("border color 0 (black) fills top-border scanline", (assert) => {
    const zxs = make48();
    const ram = zxs.getRAM();
    // Set border via OUT 0xFE — but we can't do that without a running CPU.
    // Instead, test that border=7 (default white after reset) fills border pixels.
    // Top border line 0, pixel 0 should be white (border color 7).
    zxs.reset();
    const { r, g, b } = runFrameAndGetPixel(zxs, 0, 0);
    // ZX white = RGB(215,215,215)
    assert.strictEqual(r, 215, "border pixel R=215 (white)");
    assert.strictEqual(g, 215, "border pixel G=215 (white)");
    assert.strictEqual(b, 215, "border pixel B=215 (white)");
  });

  QUnit.test("all-zero VRAM: active area is black paper, black ink", (assert) => {
    // attr byte 0x00 = paper 0 (black), ink 0 (black), no flash, no bright
    // pixel byte 0x00 = all bits 0 = all paper color = all black
    const zxs = make48();
    zxs.reset();
    // VRAM is zeroed by reset(). Run frame.
    const { r, g, b } = runFrameAndGetPixel(zxs, 48, 48);  // first active pixel
    assert.strictEqual(r, 0, "active pixel R=0 (black paper)");
    assert.strictEqual(g, 0, "active pixel G=0 (black paper)");
    assert.strictEqual(b, 0, "active pixel B=0 (black paper)");
  });

  QUnit.test("pixel byte 0xFF with attr ink=7 paper=0: ink pixels are white", (assert) => {
    const zxs = make48();
    zxs.reset();
    const ram = zxs.getRAM();
    ram[0x0000] = 0xFF;  // all bits set → all ink
    ram[0x1800] = 0x07;  // ink=7 (white), paper=0 (black), no bright
    const { r, g, b } = runFrameAndGetPixel(zxs, 48, 48);  // active line 0, first pixel
    assert.strictEqual(r, 215, "ink pixel R=215 (white)");
    assert.strictEqual(g, 215, "ink pixel G=215 (white)");
    assert.strictEqual(b, 215, "ink pixel B=215 (white)");
  });

  QUnit.test("flash attr with flashPhase=0: ink is ink (no swap)", (assert) => {
    // attr = 0x87: flash=1, paper=0(black), ink=7(white) — flashPhase=0 → ink stays white
    const zxs = make48();
    zxs.reset();
    const ram = zxs.getRAM();
    ram[0x0000] = 0xFF;   // all ink bits
    ram[0x1800] = 0x87;   // flash=1, ink=7(white), paper=0(black)
    // Frame 0: flashPhase = (0 >> 4) & 1 = 0 → no swap
    const { r, g, b } = runFrameAndGetPixel(zxs, 48, 48);
    assert.strictEqual(r, 215, "flashPhase=0: ink pixel is white (no swap)");
  });

  QUnit.test("flash attr with flashPhase=1: ink and paper swapped", (assert) => {
    const zxs = make48();
    zxs.reset();
    const ram = zxs.getRAM();
    ram[0x0000] = 0xFF;   // all ink bits
    ram[0x1800] = 0x87;   // flash=1, ink=7(white), paper=0(black)
    // Run 16 frames to reach flashPhase=1
    for (let i = 0; i < 16; i++) zxs.frame(69888, null);
    const buf = zxs.getVideoBuffer();
    const offset = (48 * 352 + 48) * 4;  // active line 0, first pixel
    // flashPhase=1 → ink becomes paper (black), paper becomes ink (white)
    // pixel bit is set → normally ink (white), but swapped → paper (black)
    assert.strictEqual(buf[offset],     0, "flashPhase=1: swapped to paper (black R=0)");
    assert.strictEqual(buf[offset + 1], 0, "flashPhase=1: swapped to paper (black G=0)");
    assert.strictEqual(buf[offset + 2], 0, "flashPhase=1: swapped to paper (black B=0)");
  });

});
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm run test:run 2>&1 | grep -E "decodeFrameBuffer|# fail"
```

Expected: tests fail because `decodeFrameBuffer` doesn't exist yet (frame() still uses old renderScanline).

- [ ] **Step 3: Implement `decodeFrameBuffer()`** — add after `updateFramebuffer()`:

```javascript
  /**
   * Decode the raw frameBuffer into the RGBA videoView.
   *
   * Called once per frame after updateFramebuffer(frameLen) has flushed all events.
   * Walks screenEventsTable and frameBuffer in parallel; each event determines
   * whether to write 16 border pixels or decode 8 ink/paper pixels.
   *
   * @param {number} flashPhase - 0 or 1; when 1, flash attributes swap ink/paper
   */
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
        // Border event: 16 pixels of the same border color
        const rgba = ZX_PALETTE_RGBA[frameBuffer[fbPtr++]];
        for (let i = 0; i < 16; i++) videoView[rowBase + xPixel + i] = rgba;
        xPixel += 16;
      } else {
        // Pixel event: 8 pixels decoded from pixel byte + attribute byte
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

      // Advance to next scanline after 352 pixels
      if (xPixel >= SCREEN_W) {
        xPixel = 0;
        line++;
      }
    }
  };
```

- [ ] **Step 4: Wire `decodeFrameBuffer` into `frame()`** — in the `frame()` method, locate the current render loop (lines ~767–830 containing `renderChunk`). Replace the entire block from `let remaining = tStates;` through to the end of the `while (remaining > 0)` loop with:

```javascript
      // Reset deferred frameBuffer pointers for this frame
      screenEventPtr   = 0;
      frameBufferPtr   = 0;
      floatingBusValue = 0xFF;

      const frameLen = is128k ? FRAME_T_128 : FRAME_T_48;
      let remaining = tStates;

      // Execute T-states. updateFramebuffer() is called reactively via hooks
      // in byteTo (VRAM write) and portOut (border color change).
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

      // Flush any events the CPU didn't trigger reactively (e.g. no VRAM writes)
      updateFramebuffer(frameLen);
      // Decode raw ULA log to RGBA pixels
      decodeFrameBuffer(flashPhase);
```

  Also **remove** these lines from `frame()` that are no longer needed (they appear around lines 750–795):
  - `borderColorAtFrameStart = borderColor;`
  - `borderEvents = [];`
  - All of `getBorderColorAtT`, `renderChunk`, `scanlineT`, `visibleStartT` locals

- [ ] **Step 5: Run tests to verify decodeFrameBuffer tests pass**

```
npm run test:run 2>&1 | grep -E "decodeFrameBuffer|# fail"
```

Expected: all 5 decodeFrameBuffer tests pass.

- [ ] **Step 6: Run all tests**

```
npm run test:run 2>&1 | grep "# fail"
```

Expected: `# fail 0`

- [ ] **Step 7: Commit**

```bash
git add src/devices/zxs/zxspectrum.js test/zxspectrum.test.js
git commit -m "feat(zxs): implement decodeFrameBuffer and wire into frame() loop"
```

---

## Chunk 4: Reactive hooks + cleanup

### Task 4: Wire `updateFramebuffer()` into `byteTo` and `portOut`/`portIn`

**Files:**
- Modify: `src/devices/zxs/zxspectrum.js` only

This is the crucial step that makes the deferred rendering actually work. Without these hooks, `updateFramebuffer()` only sees the VRAM state at end-of-frame (wrong). With them, every VRAM write and border change causes the ULA log to capture the correct value at the correct T-state.

- [ ] **Step 1: Write failing test for reactive VRAM hook** — add to `test/zxspectrum.test.js` inside the `decodeFrameBuffer` module (or as a separate module):

```javascript
QUnit.module("reactive VRAM hook (48k)", () => {

  QUnit.test("VRAM write mid-frame: scanlines before write show old value, after show new", (assert) => {
    // This test uses a two-frame approach:
    // Frame 1: set ram[0x0000]=0xAA (attr ink=2 cyan-ish, paper=0)
    //          This affects active line 0 pixel column 0.
    // Frame 2: Before active line 0 is scanned (T=14359), write ram[0x0000]=0xFF
    //          Because of the reactive hook, the frameBuffer will capture 0xFF
    //          (the ULA hadn't fetched that address yet, so the write takes effect).
    // We can't do mid-frame writes in test without running a Z80 program.
    // So instead: verify that what frame() renders matches end-of-frame VRAM state
    // for lines scanned AFTER a reset (the simple case where hook fires at end).
    const zxs = make48();
    zxs.reset();
    const ram = zxs.getRAM();
    ram[0x0000] = 0xFF;   // pixel byte: all bits set
    ram[0x1800] = 0x07;   // ink=7(white), paper=0(black)
    zxs.frame(69888, null);
    const buf = zxs.getVideoBuffer();
    const offset = (48 * 352 + 48) * 4;  // active line 0, x=48 = first active pixel
    assert.strictEqual(buf[offset],     215, "ink pixel white R=215");
    assert.strictEqual(buf[offset + 1], 215, "ink pixel white G=215");
    assert.strictEqual(buf[offset + 2], 215, "ink pixel white B=215");
  });

});
```

- [ ] **Step 2: Run test** — should already pass (basic VRAM→pixel path). If it fails, fix before proceeding.

- [ ] **Step 3: Add VRAM write hook to `byteTo`** — replace the current `byteTo` function (lines ~492–501):

```javascript
  const byteTo = (addr, val) => {
    if (addr < 0x4000) return;  // ROM is read-only
    // Flush ULA events up to current T BEFORE the write takes effect.
    // Events already flushed will read old VRAM; events flushed after will read new.
    if (addr >= 0x4000 && addr < 0x5B00) {
      updateFramebuffer(cpu.T() - frameBaseT);
    }
    if (is128k) {
      if (addr < 0x8000) { ram128[5 * 16384 + (addr - 0x4000)] = val & 0xFF; return; }
      if (addr < 0xC000) { ram128[2 * 16384 + (addr - 0x8000)] = val & 0xFF; return; }
      ram128[ramBank * 16384 + (addr - 0xC000)] = val & 0xFF;
    } else {
      ram48[addr - 0x4000] = val & 0xFF;
    }
  };
```

- [ ] **Step 4: Add border flush to `portOut`** — replace the ULA write block inside `portOut` (lines ~558–566). Change:

```javascript
    if ((fullAddr & 0x0001) === 0) {
      const newBorder = val & 0x07;
      borderEvents.push(cpu.T() - frameBaseT, newBorder);
      borderColor = newBorder;
```

To:

```javascript
    if ((fullAddr & 0x0001) === 0) {
      const newBorder = val & 0x07;
      if (newBorder !== borderColor) {
        updateFramebuffer(cpu.T() - frameBaseT);  // flush before color change
      }
      borderColor = newBorder;
```

- [ ] **Step 5: Update `portIn` floating bus path** — replace the floating bus lines (around line 544):

```javascript
    // Odd unhandled port: floating bus (ULA drives the last VRAM byte it fetched)
    const result = floatingBusAt(cpu.T() - frameBaseT + ioContentionExtra);
    ioContentionExtra += ioContentionForPort(port, fullAddr, cpu.T() - frameBaseT + ioContentionExtra);
    return result;
```

With:

```javascript
    // Odd unhandled port: floating bus (ULA drives the last VRAM byte it fetched)
    updateFramebuffer(cpu.T() - frameBaseT + ioContentionExtra);
    ioContentionExtra += ioContentionForPort(port, fullAddr, cpu.T() - frameBaseT + ioContentionExtra);
    return floatingBusValue;
```

- [ ] **Step 6: Run all tests**

```
npm run test:run 2>&1 | grep "# fail"
```

Expected: `# fail 0`

- [ ] **Step 7: Commit**

```bash
git add src/devices/zxs/zxspectrum.js
git commit -m "feat(zxs): wire updateFramebuffer hooks into byteTo, portOut, portIn"
```

---

### Task 5: Remove dead code

**Files:**
- Modify: `src/devices/zxs/zxspectrum.js`
- Modify: `test/zxspectrum.test.js`

Now that the new system is wired up, remove everything it replaced.

- [ ] **Step 1: Delete `floatingBusAt()` function** — remove lines 333–372 (the JSDoc + entire function body). This function is no longer called.

- [ ] **Step 2: Delete `renderScanline()` function** — remove lines 591–653 (JSDoc + entire function body).

- [ ] **Step 3: Delete border event state** — remove these lines:
  - `let borderEvents = [];` (line ~320)
  - `let borderColorAtFrameStart = 7;` (line ~322)
  - Their reset in `reset()`: `borderColorAtFrameStart = 7; borderEvents = [];` (line ~722)

- [ ] **Step 4: Remove `borderEvents.push(...)` from `portOut`** — the line `borderEvents.push(cpu.T() - frameBaseT, newBorder);` that remains after Step 4 of Task 4 should be gone. Verify it's not there.

- [ ] **Step 5: Remove `floatingBusAt` from public API** — find `floatingBusAt,` in the returned object (line ~1010) and remove it.

- [ ] **Step 6: Remove `updateFramebufferTo` and `getFrameBufferByte` from public API** — these were test helpers added in Task 2 Step 4. Remove them and instead expose:

```javascript
    // Keep for tests — expose internal frame buffer via getScreenEventsTable already exported
    getFloatingBusValue: () => floatingBusValue,
```

  Remove `updateFramebufferTo` (it reset pointers in a fragile way — tests should use `frame()` end-to-end instead).

- [ ] **Step 7: Update floating bus tests** — the existing `floating bus (48k)` module (lines ~489–555 in test file) calls `zxs.floatingBusAt()` directly. Rewrite these tests to work through `frame()`:

```javascript
QUnit.module("floating bus (48k)", () => {

  // Helper: run a minimal frame, inject a specific VRAM state, read portIn result.
  // We test floating bus by checking getFloatingBusValue() after frame().
  // The frame() flushes updateFramebuffer(frameLen) at end, so floatingBusValue
  // reflects the last active-display ULA fetch in the frame.

  QUnit.test("floatingBusValue is attrByte of last active pixel after full frame", (assert) => {
    const zxs = make48();
    zxs.reset();
    const ram = zxs.getRAM();
    // Last active pixel: active line 191, xByte 31
    // y=191: attrAddr = 0x1800 + (191>>3)*32 + 31 = 0x1800 + 23*32 + 31 = 0x1800 + 767 = 0x1AFF
    ram[0x1AFF] = 0x42;
    zxs.frame(69888, null);
    // Last pixel event in active display fetches attrAddr=0x1AFF
    assert.strictEqual(zxs.getFloatingBusValue(), 0x42,
      "floatingBusValue = last attr byte of active display");
  });

  QUnit.test("floatingBusValue is 0xFF after frame (bottom border follows active)", (assert) => {
    // After all active display events, border events follow → floatingBusValue resets to 0xFF
    const zxs = make48();
    zxs.reset();
    zxs.frame(69888, null);
    assert.strictEqual(zxs.getFloatingBusValue(), 0xFF,
      "floatingBusValue = 0xFF at end of frame (bottom border)");
  });

});
```

- [ ] **Step 8: Run all tests**

```
npm run test:run 2>&1 | grep "# fail"
```

Expected: `# fail 0`

- [ ] **Step 9: Commit**

```bash
git add src/devices/zxs/zxspectrum.js test/zxspectrum.test.js
git commit -m "refactor(zxs): remove renderScanline, floatingBusAt, borderEvents — replaced by deferred framebuffer"
```

---

## Chunk 5: Final verification

### Task 6: Full test suite + coverage check

- [ ] **Step 1: Run full test suite with coverage**

```
npm test 2>&1 | tail -30
```

Expected: `# fail 0`, coverage for `zxspectrum.js` ≥ 85% (was ~90% before).

- [ ] **Step 2: Check for any remaining references to deleted functions**

```bash
grep -n "floatingBusAt\|renderScanline\|borderEvents\|getBorderColorAtT\|borderColorAtFrameStart" src/devices/zxs/zxspectrum.js
```

Expected: no matches.

- [ ] **Step 3: Verify public API is unchanged** — check that `frame()`, `reset()`, `loadSNA()`, `snapshot()`, `status()`, `getRAM()`, `contentionAt()`, `ioContentionForPort()`, `loadTAP()`, `loadTZX()`, `tapePlay()`, `tapeStop()` are all still present and exported.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "test(zxs): verify deferred framebuffer — all tests pass"
```

---

## Quick Reference: Key Addresses

| Symbol | Value | Meaning |
|---|---|---|
| `SCREEN_START_T_48` | 14335 | T-state when ULA starts first active pixel (48k) |
| `TSTATE_PER_LINE_48` | 224 | T-states per scanline (48k) |
| `visStartT` (48k) | 3583 | `14335 - 48*224` — first visible scanline T-state |
| `FRAME_T_48` | 69888 | Total T-states per frame (48k) |
| VRAM pixel range | `0x4000–0x57FF` | As offsets into ram48: `0x0000–0x17FF` |
| VRAM attr range | `0x5800–0x5AFF` | As offsets into ram48: `0x1800–0x1AFF` |
| frameBuffer size | 16880 bytes | `2288 border + 14592 pixel+attr` |
| screenEventsTable size | 19170 u32 | `9584 events × 2 + 2 terminator` |
