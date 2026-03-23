# KIM-1 Emulator

Headless JavaScript emulator of the MOS Technology KIM-1 single-board computer (1976).

- **CPU**: MOS 6502 @ 1 MHz
- **ROM**: Two MCS 6530 RRIOT chips — ROM_002 (1 KB at 0x1C00) and ROM_003 (1 KB at 0x1800)
- **RAM**: 1 KB base (0x0000–0x03FF), optionally expanded to 4 KB / 8 KB / 64 KB
- **I/O**: Two MCS 6530 RRIOT chips with memory-mapped ports and hardware timer
- **Display**: 6 seven-segment LED digits — two address high, two address low, two data
- **Keyboard**: 23 keys in a 6×4 matrix
- **Serial**: TTY terminal via ROM patch (no bit-bang emulation required)
- **Tape**: Cassette interface via bit-banged PA7 transitions; MOS papertape (.pap) file support

## Files

| File | Purpose |
|---|---|
| `kim1-rom.js` | ROM data — exports `ROM_002` and `ROM_003` as `Uint8Array` |
| `kim1.js` | Headless core — `createKIM` factory + `KEY_NAMES` export |
| `kim1.html` | Browser demo page |

---

## Quick Start

```js
import { createKIM, KEY_NAMES } from "./src/devices/kim/kim1.js";

const kim = createKIM({ ramSize: "4k" });
kim.reset();

// Animation loop (60 fps @ 1 MHz)
const T_PER_FRAME = Math.round(1_000_000 / 60); // ≈ 16667

function loop() {
  const { initialized, display } = kim.frame(T_PER_FRAME, {
    kb0: false, kb1: false, /* ... all keys ... */
  });

  if (initialized) {
    renderDisplay(display);       // display[0..5]: segment bitmasks
  }

  requestAnimationFrame(loop);
}

kim.reset();
requestAnimationFrame(loop);
```

---

## `createKIM(options)` — factory

```js
const kim = createKIM({
  ramSize:  "4k",         // RAM configuration (default: "4k")
  rom002:   Uint8Array,   // optional custom ROM_002 image (1024 bytes)
  rom003:   Uint8Array,   // optional custom ROM_003 image (1024 bytes)
});
```

### `ramSize` options

| Value | RAM regions | Historical equivalent |
|---|---|---|
| `"1k"` | 0x0000–0x03FF | Stock KIM-1 |
| `"4k"` (default) | + 0x2000–0x2FFF | KIM-2 expansion |
| `"8k"` | + 0x2000–0x3FFF | KIM-3 expansion |
| `"64k"` | + 0x0400–0xBFFF | Full address space |

---

## Instance API

### `kim.reset()`

Hard reset: reloads ROM, applies serial patches, resets CPU to the vector at 0xFFFC/0xFFFD,
clears display and queues. **Must be called before the first `frame()`.**

```js
kim.reset();
```

---

### `kim.frame(tStates, keyMatrix)` → `{ initialized, display }`

Executes one emulation frame.

```js
const { initialized, display } = kim.frame(16667, keyMatrix);
```

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `tStates` | `number` | 6502 T-states to execute. Use `Math.round(1_000_000 / fps)` — e.g. 16667 for 60 fps |
| `keyMatrix` | `object` | Key state map — see [Key Names](#key-names) |

**Return value:**

| Field | Type | Description |
|---|---|---|
| `initialized` | `boolean` | `false` until `reset()` has been called; host should skip rendering |
| `display` | `Array<number\|null>` | Six segment bitmasks (0–127), or `null` if digit was not refreshed this frame (host should preserve previous value — afterglow) |

**Display bit mapping** (same for all six digits):

```
bit 0 = segment a (top)
bit 1 = segment b (upper right)
bit 2 = segment c (lower right)
bit 3 = segment d (bottom)
bit 4 = segment e (lower left)
bit 5 = segment f (upper left)
bit 6 = segment g (middle)
```

**Display digit order** (left to right):

```
display[0] display[1]  display[2] display[3]  display[4] display[5]
  A-high     A-high      A-low      A-low       Data        Data
```

---

### Key Names

`KEY_NAMES` is an exported array of all valid key name strings. Pass key states as booleans
in the `keyMatrix` argument to `frame()`.

**Physical layout (6 rows × 4 columns):**

```
[ GO  ] [ ST  ] [ BS  ] [ SST ]   ← row 0
[ AD  ] [ DA  ] [ PC  ] [  +  ]   ← row 1
[  C  ] [  D  ] [  E  ] [  F  ]   ← row 2
[  8  ] [  9  ] [  A  ] [  B  ]   ← row 3
[  4  ] [  5  ] [  6  ] [  7  ]   ← row 4
[  0  ] [  1  ] [  2  ] [  3  ]   ← row 5
```

**Key name strings:**

| Physical key | Name | Notes |
|---|---|---|
| GO | `kbgo` | Run program from current address |
| ST | `kbst` | Stop — calls `kim.nmi()` on release; do not pass in keyMatrix |
| BS | `kbbs` | Back Space |
| SST | `kbsst` | Single-Step Toggle — **persistent state** managed by host |
| AD | `kbad` | Address mode |
| DA | `kbda` | Data mode |
| PC | `kbpc` | Program Counter display |
| + | `kbplus` | Increment / next |
| C–F | `kbc` `kbd` `kbe` `kbf` | Hex digits |
| 8–B | `kb8` `kb9` `kba` `kbb` | Hex digits |
| 4–7 | `kb4` `kb5` `kb6` `kb7` | Hex digits |
| 0–3 | `kb0` `kb1` `kb2` `kb3` | Hex digits |
| RS | `kbrs` | Reset — calls `kim.reset()` on release; do not pass in keyMatrix |

**Special key handling** — these two keys are NOT passed via `keyMatrix`; the host must call
the corresponding methods directly:

```js
// RS (Reset) key — on mouseup / keyup:
kim.reset();

// ST (Stop) key — on mouseup / keyup:
kim.nmi();
```

**SST (Single-Step Toggle)** is a persistent hardware switch, not a momentary key. The host
maintains its state and passes it every frame:

```js
let sstOn = false;

// SST button click:
sstOn = !sstOn;

// Every frame:
kim.frame(T_PER_FRAME, { ...keys, kbsst: sstOn });
```

When `kbsst` is `true`, the emulator executes one instruction per call and fires an NMI after
each instruction whose PC falls outside the ROM range (0x1800–0x1FFF).

---

### `kim.nmi()`

Triggers a 6502 NMI. Used for the ST (Stop) key and any external interrupt.

### `kim.interrupt()`

Triggers a 6502 IRQ.

---

### `kim.serial` — TTY Terminal

The KIM-1 monitor's GETCH and OUTCH routines are patched at `reset()` to use a virtual
serial queue. No bit-bang timing is emulated.

```js
// Send characters to the KIM-1 (queued for GETCH)
kim.serial.input("AD\r");           // uppercase recommended; \r = Enter

// Read characters produced by OUTCH since last call
const out = kim.serial.getOutput(); // returns string, clears buffer

// Check if output is waiting (useful to avoid empty string appends)
if (kim.serial.outputReady()) {
  terminal.append(kim.serial.getOutput());
}
```

**Notes:**
- Characters are 7-bit ASCII.
- The monitor uses the TTY interface when the RS-232 terminal mode is active. Switch to TTY
  mode by connecting to the terminal and pressing any key, or by sending commands directly.
- `input()` does not auto-uppercase — the host is responsible.

**Typical integration loop:**

```js
function loop() {
  kim.frame(T_PER_FRAME, buildKeyMatrix());

  // Drain output every frame
  const out = kim.serial.getOutput();
  if (out) terminalEl.textContent += out;

  requestAnimationFrame(loop);
}
```

---

### `kim.tape` — Cassette Tape Interface

#### Recording

```js
kim.tape.record();   // start recording PA7 transitions
// ... run emulator for a while ...
kim.tape.stop();

const intervals = kim.tape.getRecorded(); // T-state interval array
```

#### Playback

```js
kim.tape.setReadBuffer(intervals);  // load interval array
kim.tape.play();                    // start feeding PA0 with the signal
// ... run emulator ...
kim.tape.stop();

kim.tape.isPlaying();    // boolean
kim.tape.isRecording();  // boolean
```

The interval array stores T-state deltas between PA bit-7 edge transitions. The first element
is a pre-leader delay. This format is identical to what `record()` produces, so
record → stop → setReadBuffer(getRecorded()) → play is a valid round-trip.

#### MOS Papertape (.pap) — direct RAM load

`loadPAP` writes bytes **directly into RAM** — no cassette simulation, no timing. The program
is immediately available for execution.

```js
const result = kim.tape.loadPAP(papText);
// result: { ok: boolean, blocks: number, warnings: string[] }

if (result.ok && result.blocks > 0) {
  console.log(`Loaded ${result.blocks} block(s)`);
  if (result.warnings.length) console.warn(result.warnings);
  // Navigate to the loaded address using AD key, then press GO
}
```

```js
// Dump RAM range as .pap text
const papText = kim.tape.savePAP(0x0200, 0x02FF);
```

**Papertape record format** (one record per line):

```
;LLAAAAdd...ddHHLL
  LL   = byte count (2 hex digits, max 0x18 = 24)
  AAAA = load address (4 hex digits, big-endian)
  dd   = data bytes (LL × 2 hex digits)
  HH   = checksum high byte (2 hex digits)
  LL   = checksum low byte (2 hex digits)
Checksum = (count + addrHi + addrLo + Σdata) & 0xFFFF, stored big-endian.
End record: ;0000040001
```

After loading via `loadPAP`, run the program with the KIM-1 keyboard:
1. Press **AD**, enter the start address (e.g. `0200`), press **GO**.

---

### `kim.getRAM()` → `Uint8Array`

Returns a zero-copy reference to the full 64 KB RAM buffer. ROM regions (0x1800–0x1FFF) are
also stored here after `reset()`. Useful for debuggers and memory viewers.

```js
const ram = kim.getRAM();
console.log(ram[0x0200]);  // read byte at address 0x0200
ram[0x0300] = 0xEA;        // write NOP at 0x0300 (bypasses memory map)
```

### `kim.getCpuStatus()` → `object`

Returns a 6502 register snapshot: `{ pc, sp, a, x, y, flags }`.

### `kim.setCpuRegister(reg, value)`

Sets a CPU register by name. Useful for debuggers.

```js
kim.setCpuRegister("PC", 0x0200);
kim.setCpuRegister("A",  0xFF);
```

---

## Memory Map

| Address range | Region |
|---|---|
| 0x0000–0x03FF | Base RAM (always present) |
| 0x1700–0x173F | RIOT-003 I/O registers |
| 0x1740–0x177F | RIOT-002 I/O registers |
| 0x1780–0x17BF | RIOT-003 internal RAM (64 B) |
| 0x17C0–0x17FF | RIOT-002 internal RAM (64 B) |
| 0x1800–0x1BFF | ROM_003 |
| 0x1C00–0x1FFF | ROM_002 |
| 0x2000–0x2FFF | Expansion RAM (ramSize ≥ "4k") |
| 0x2000–0x3FFF | Expansion RAM (ramSize ≥ "8k") |
| 0x0400–0xBFFF | Full expansion (ramSize = "64k") |
| 0xBFFE | Virtual serial IN (GETCH patch) |
| 0xBFFF | Virtual serial OUT (OUTCH patch) |
| 0xFC00–0xFFFF | ROM_002 mirror (reset/NMI/IRQ vectors) |

---

## KIM-1 Monitor — Common Operations

The stock KIM-1 monitor (in ROM) supports the following keyboard operations:

| Keys | Action |
|---|---|
| **AD** `AAAA` **+** | Set address to examine / modify |
| **AD** `AAAA` **DA** `DD` **+** | Write byte DD at address AAAA, advance |
| **DA** `DD` **+** | Write data byte at current address, advance |
| **PC** | Display current PC |
| **GO** | Execute from current address |
| **ST** | Stop (NMI) |
| **BS** | Back Space (decrement address) |

---

## Integration Example — `requestAnimationFrame` loop

```js
import { createKIM, KEY_NAMES } from "./kim1.js";

const T_PER_FRAME = Math.round(1_000_000 / 60);
const kim = createKIM({ ramSize: "4k" });

// Key state
const keyState = Object.fromEntries(KEY_NAMES.map(k => [k, false]));
let sstOn = false;

document.addEventListener("keydown", e => {
  // map e.key to KIM key name, set keyState[name] = true
});
document.addEventListener("keyup", e => {
  const name = /* map */ null;
  if (name === "kbrs") { kim.reset(); return; }
  if (name === "kbst") { kim.nmi();   return; }
  if (name === "kbsst") { sstOn = !sstOn; return; }
  if (name) keyState[name] = false;
});

// Display canvas setup (6 digits)
const canvas = document.getElementById("display");
const ctx    = canvas.getContext("2d");
const afterglow = new Array(6).fill(0);

function renderDisplay(display) {
  for (let d = 0; d < 6; d++) {
    if (display[d] !== null) afterglow[d] = display[d];
    drawDigit(ctx, d, afterglow[d]);  // your segment rendering function
  }
}

// Terminal
const termEl = document.getElementById("terminal");
function drainSerial() {
  const out = kim.serial.getOutput();
  if (out) termEl.textContent += out;
}

// Main loop
kim.reset();
(function loop() {
  const { initialized, display } = kim.frame(T_PER_FRAME, {
    ...keyState,
    kbsst: sstOn,
  });

  if (initialized) renderDisplay(display);
  drainSerial();

  requestAnimationFrame(loop);
})();
```

---

## ROM Patches Applied at `reset()`

The emulator modifies the RAM-resident copy of ROM_002 at startup to enable the virtual
serial interface and skip the baud-rate detection loop:

| Address | Patch | Purpose |
|---|---|---|
| 0x1E5A (GETCH) | `LDA $BFFE; RTS` | Read character from virtual serial IN queue |
| 0x1EA0 (OUTCH) | `STA $BFFF; RTS` | Write character to virtual serial OUT queue |
| 0x00EF (CNTH30) | `0x07` | Pre-seed baud rate high byte — bypasses measurement loop |
| 0x00F0 (CNTL30) | `0x27` | Pre-seed baud rate low byte |

These patches use addresses 0xBFFE and 0xBFFF, which are in unmapped space on the original
hardware and will never conflict with user programs (unless `ramSize: "64k"` is used and the
program explicitly writes to those addresses).
