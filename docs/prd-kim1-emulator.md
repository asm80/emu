# PRD: KIM-1 Emulator

> Cesky: Emulátor KIM-1 — headless JS core + demo HTML stránka, stejný vzor jako PMI-80 a TEC-1.

---

## Overview

Add a KIM-1 (MOS Technology, 1976) emulator to `src/devices/kim/`, following the established frame-oriented, DOM-free pattern of `pmi80.js` and `tec1.js`. The emulator consists of two deliverables: a headless core module (`kim1.js`) and a browser demonstration page (`kim1.html`).

---

## Background & Hardware Reference

| Property | Value |
|---|---|
| CPU | MOS 6502 @ 1 MHz |
| ROM | Two 6530 RIOT chips — 1KB each: RIOT-002 at 0x1C00–0x1FFF (mirrored 0xFC00–0xFFFF), RIOT-003 at 0x1800–0x1BFF |
| RIOT I/O | RIOT-002: 0x1740–0x177F; RIOT-003: 0x1700–0x173F |
| RIOT RAM | RIOT-002: 0x17C0–0x17FF (64 B); RIOT-003: 0x1780–0x17BF (64 B) |
| Base RAM | 1KB at 0x0000–0x03FF |
| Display | 6 seven-segment LEDs: `[A1 A2] [A3 A4] [D1 D2]` (address high, address low, data) |
| Keyboard | 23 keys in 6-row × 4-col grid (see layout below) |
| Serial TTY | Bit-banged via RIOT-002 PA4/PA5; patched in emulation via GETCH/OUTCH trap |
| Cassette | RIOT-002 PA7 (out) / PA0 (in); bit-banging at ~1200 baud |
| SST | Single-Step Toggle — physical switch; triggers NMI for each instruction outside ROM |

### Memory Map (by ramSize option)

| Option | Extra RAM region | Historical equivalent |
|---|---|---|
| `"1k"` | None (0x0000–0x03FF only) | Stock KIM-1 |
| `"4k"` | 0x2000–0x2FFF | KIM-2 expansion (default) |
| `"8k"` | 0x2000–0x3FFF | KIM-3 expansion |
| `"64k"` | Full 64KB minus RIOT/ROM | Modern development use |

### Keyboard Layout (row-major, top to bottom)

```
[ GO ] [ ST ] [ BS ] [SST*]   (* = toggle switch, not momentary)
[ AD ] [ DA ] [ PC ] [  + ]
[  C ] [  D ] [  E ] [  F ]
[  8 ] [  9 ] [  A ] [  B ]
[  4 ] [  5 ] [  6 ] [  7 ]
[  0 ] [  1 ] [  2 ] [  3 ]
```

Key names in the API: `kbgo`, `kbst`, `kbbs`, `kbsst` (toggle), `kbad`, `kbda`, `kbpc`, `kbplus`, `kbc`–`kbf`, `kb8`–`kbb`, `kb4`–`kb7`, `kb0`–`kb3`.

---

## Deliverable 1: `src/devices/kim/kim1-rom.js`

Export the two ROM arrays extracted from `old/devices/emuKIM.js`:

```js
export const ROM_002 = [ /* 1024 bytes — 0x1C00 region */ ];
export const ROM_003 = [ /* 1024 bytes — 0x1800 region */ ];
```

No logic — pure data.

---

## Deliverable 2: `src/devices/kim/kim1.js`

### Module structure

```
kim1.js
  createKIM(options) — default export
  KEY_NAMES          — named export
```

### Options

```js
createKIM({
  sampleRate: 44100,   // for cassette audio timing (default: 44100)
  ramSize: "4k",       // "1k" | "4k" | "8k" | "64k" (default: "4k")
  rom002: Uint8Array,  // optional custom ROM (default: built-in ROM_002)
  rom003: Uint8Array,  // optional custom ROM (default: built-in ROM_003)
})
```

### RIOT implementation (inline)

Implement `createRIOT(hookFn)` as an internal factory (not exported). Each RIOT instance exposes:

- `byteAt(offset)` — reads port A, port B, DDRA, DDRB, timer
- `byteTo(offset, value)` — writes ports, sets timer with divisor (1/8/64/1024)
- `tick(tStates)` — advances internal timer
- `portA(value)` / `portB(value)` — inject external pin state
- Timer overflow flag exposed for IRQ/NMI routing (not used by stock KIM-1 ROM but available)

RIOT register map follows the original 6530: offsets 0–3 = port data/DDR, 4–7/C–F = timer write (with/without IRQ enable), 6/E = timer read.

### ROM patching — Serial TTY

At `reset()`, patch two locations in the working RAM copy of ROM_002:

| Symbol | ROM address | Patch |
|---|---|---|
| `GETCH` | 0x1E5A | `JSR` to trap handler → read from internal input queue |
| `OUTCH` | 0x1EA0 | `JSR` to trap handler → write to internal output buffer |

The patch vectors are written into unused RAM at 0x00F0–0x00FF (safe zero-page area not used by KIM-1 monitor). The baud-rate detection loop at boot is also patched to `NOP` chains so the emulator does not hang.

**Assumption**: patch addresses are derived from the ROM disassembly in `old/devices/emuKIM.js`; verify against actual ROM bytes before finalizing.

### Serial API (on returned instance)

```js
kim.serial.input(string)   // queue characters into KIM's GETCH buffer
kim.serial.getOutput()     // return and clear accumulated OUTCH output (string)
kim.serial.outputReady()   // boolean — true if unread output exists
```

Characters are 7-bit ASCII. The KIM-1 monitor expects uppercase; `input()` does NOT auto-uppercase — the host is responsible.

### Cassette / Tape API (on returned instance)

Interval-based timing buffer (same pattern as PMI-80), plus MOS papertape format support:

```js
kim.tape.record()             // start recording PA7 transitions (intervals in T-states)
kim.tape.play()               // start playback from write buffer into PA0
kim.tape.stop()               // stop recording or playback
kim.tape.isRecording()        // boolean
kim.tape.isPlaying()          // boolean
kim.tape.getRecorded()        // returns interval array (T-state deltas between edges)
kim.tape.setReadBuffer(arr)   // set playback buffer (interval array)

kim.tape.loadPAP(string)      // parse MOS papertape text (.pap), write bytes to RAM,
                              //   returns { ok: true, blocks: N } or { ok: false, error: string }
kim.tape.savePAP(startAddr, endAddr)  // dump RAM range as MOS papertape string
```

**MOS Papertape record format** (one record per line):
```
;LLAAAADDDDDDDDDDDDDDDDDDDDDDDDSShh
  LL     = byte count (hex, 2 chars, max 0x18 = 24)
  AAAA   = start address (hex, 4 chars)
  DD...  = data bytes (LL × 2 hex chars)
  SS     = 16-bit checksum (sum of AAAA bytes + all DD bytes, low byte, hex 2 chars)
  hh     = high byte of checksum
```
End record: `;0000040001` (standard KIM-1 end-of-tape marker).

### frame() API

```js
const { display, initialized } = kim.frame(tStates, keyMatrix);
```

- `tStates` — number of 6502 T-states to execute this frame
- `keyMatrix` — object `{ kbgo: bool, kbst: bool, ... }` for all 23 key names; `kbsst` is persistent toggle state maintained by host
- Returns:
  - `display[0..5]` — segment bitmask (0–127) or `null` (digit not refreshed this frame → host preserves last value / afterglow)
  - `initialized` — `false` until `reset()` is called; host skips rendering

Segment bit mapping (same as PMI-80):
`bit0=a, bit1=b, bit2=c, bit3=d, bit4=e, bit5=f, bit6=g` (no decimal point on KIM-1 display)

### Display multiplexing

The KIM-1 monitor scans 6 digits via RIOT-002 port B. `frame()` decodes the scan sequence and returns the composite `display[]` snapshot at end of frame.

### SST (Single-Step Toggle)

When `keyMatrix.kbsst === true`, after each instruction that completes with PC outside the ROM range (0x1800–0x1FFF), `frame()` triggers an NMI before the next instruction. This matches the behavior of the original hardware switch and the legacy `emuKIM.js` implementation.

### Key matrix decoding (RIOT-002 port A)

The keyboard is scanned by the monitor writing to port B (column select) and reading port A (row data). Decoding:

| Port B scan value | Row keys (bit 6..0, active-low) |
|---|---|
| segment −2 (0x08) | kbpc, kbgo, kbplus, kbda, kbad, kbf, kbe |
| segment −3 (0x18) | kbd, kbc, kbb, kba, kb9, kb8, kb7 |
| segment −4 (0x28) | kb6, kb5, kb4, kb3, kb2, kb1, kb0 |

Special keys handled outside `frame()`:
- `kbrs` (RS/Reset) → call `kim.reset()`
- `kbst` (ST/Stop) → call `kim.nmi()`
- `kbbs` (BS/Back Space) → mapped as regular key in matrix row −2 position (kbbs replaces kbgo in the old code — verify against ROM)

**Assumption**: BS key matrix position derived from `emuKIM.js`; confirm during implementation.

### Additional instance methods

```js
kim.reset()       // hard reset: reload ROM patch, reset CPU to 0xFFFC vector, clear display
kim.nmi()         // trigger NMI (ST key / stop)
kim.interrupt()   // trigger IRQ
kim.setSST(bool)  // convenience — not mandatory (host can pass via keyMatrix.kbsst)
```

---

## Deliverable 3: `src/devices/kim/kim1.html`

### Layout (always-visible split view)

```
+------------------------------------------+
|  KIM-1 Emulator              [RAM: v]    |
+------------------------------------------+
|  [ 7-segment display  AA AA DD ]          |
|  [ 6×4 keyboard grid            ]         |
|  [ RS button ]  [ SST indicator ]         |
+------------------------------------------+
|  TTY Terminal                             |
|  +--------------------------------------+ |
|  | [output textarea — monospace, dark]  | |
|  +--------------------------------------+ |
|  [input field] [Send] [Clear]            |
+------------------------------------------+
|  Tape: [Rec] [Play] [Stop] [Load .pap]   |
|        [Save .pap]  [status text]        |
+------------------------------------------+
```

### Display rendering (Canvas 2D)

- Internal canvas: digits sized identically to PMI-80 (DW=26, DH=46, GAP=6)
- CSS 2× scaling for crisp pixels
- Segment color on: `#ff4400`, off: `#331100`
- Afterglow: preserve last non-null value per digit (same as PMI-80)
- Digit order: left to right = display[0]..display[5], labeled `A  A  D  D` under the canvas (two address digits, space, two more address digits, space, two data digits)

### Keyboard rendering (CSS Grid 4-column)

- 6 rows × 4 columns
- Each key: dark background, monochrome label, pressed state = green tint + translateY(2px)
- SST key: rendered as a toggle — when active, permanently green with "SST ON" label; click toggles state
- RS key displayed separately below keyboard (red tint, triggers `kim.reset()` on mouseup)
- ST key in grid row 1, triggers `kim.nmi()` on mouseup (not held)

### TTY Terminal

- Output: `<pre>` or `<textarea readonly>` — dark background, green monospace text, fixed height (~200px), auto-scroll to bottom on new output
- Input: single-line `<input type="text">` + Send button; pressing Enter also sends
- Sent text is echoed to output immediately (local echo, since KIM-1 monitor does not echo in all modes)
- Output polling: every animation frame, call `kim.serial.getOutput()` and append to terminal
- Clear button: clears the terminal display only (does not affect emulator state)

### RAM size selector

- `<select>` dropdown: `1K (stock)` / `4K (KIM-2)` / `8K (KIM-3)` / `64K (full)`
- Default: `4K (KIM-2)`
- Changing selector calls `kim.reset()` with new ramSize — reinitializes emulator

### Tape controls

- **Rec**: `kim.tape.record()` — button goes red while recording
- **Play**: plays back current buffer
- **Stop**: stops rec/playback
- **Load .pap**: `<input type="file" accept=".pap">` — reads file text, calls `kim.tape.loadPAP()`, shows success/error in tape-info span
- **Save .pap**: prompts for address range (two hex inputs: start / end), calls `kim.tape.savePAP()`, triggers file download as `program.pap`
- Status text: shows mode (Recording / Playing / idle + interval count)

### Main loop

- AudioContext not used (no audio output)
- `requestAnimationFrame` loop runs `kim.frame(tStatesPerFrame, keyMatrix)` where `tStatesPerFrame = Math.round(1_000_000 / 60)` (≈ 16667 T-states at 1 MHz / 60 fps)
- Click-to-start overlay (same pattern as PMI-80) to satisfy browser autoplay policy even without audio — removed on first click, emulator starts

### Keyboard mapping (PC keyboard → KIM key)

| PC key | KIM key |
|---|---|
| 0–9 (top row + numpad) | kb0–kb9 |
| A–F | kba–kbf |
| Enter | kbgo |
| Escape | RS (reset) |
| Delete / Backspace | kbbs |
| Space | kbplus |
| Z | kbad |
| X | kbda |
| P | kbpc |
| S | kbst (NMI) |
| ScrollLock / Tab | kbsst (toggle) |

---

## Non-Goals

- No audio output buffer in `frame()` return value (no buzzer/speaker on KIM-1)
- No disassembler export (not part of this feature)
- No test file in this PRD (tests can be added separately)
- No npm package entry point change (kim1 is a device, not a CPU)
- No RS-232 / WebSerial integration (terminal is fully simulated)
- No `.kim` binary tape format (interval-only internal format is sufficient alongside `.pap`)

---

## File Checklist

- [ ] `src/devices/kim/kim1-rom.js` — ROM data export
- [ ] `src/devices/kim/kim1.js` — headless core (`createKIM`, `KEY_NAMES`)
- [ ] `src/devices/kim/kim1.html` — browser demo page

---

## Acceptance Criteria

1. `createKIM()` returns an object with `frame()`, `reset()`, `nmi()`, `serial`, `tape` properties.
2. After `reset()`, `frame()` returns `initialized: true` and `display` with 6 elements.
3. Pressing AD key (via keyMatrix) followed by a hex address and `=` causes the monitor to display the address on the 7-segment display.
4. Characters sent via `kim.serial.input("HELLO\r")` appear in `kim.serial.getOutput()`.
5. `kim.tape.savePAP(0x0200, 0x020F)` returns a string containing `;` records with correct checksums.
6. `kim.tape.loadPAP(papString)` loads bytes into RAM and returns `{ ok: true }`.
7. SST mode: when `kbsst: true` and PC is outside 0x1800–0x1FFF, each instruction triggers NMI.
8. RAM size `"4k"` makes addresses 0x2000–0x2FFF readable/writable; `"1k"` does not.
9. HTML page renders display, keyboard, terminal, and tape controls without errors in a modern browser.
10. Changing RAM selector calls reset and preserves terminal content.

---

## Assumptions (labeled)

- **[A1]** GETCH patch address is 0x1E5A and OUTCH is 0x1EA0 — verify against ROM_002 disassembly.
- **[A2]** BS key matrix position mirrors the legacy `emuKIM.js` row −2 decoding — verify during implementation.
- **[A3]** Zero-page 0x00F0–0x00FF is safe for patch jump vectors (not used by KIM-1 monitor internal variables) — verify against monitor source.
- **[A4]** NMI vector at 0x17FA/0x17FB is pre-initialized by the ROM itself on reset.
