# PRD: CP/M Computer Emulator with Generic Floppy Module

> **Czech summary:** Headless emulátor CP/M počítače se Z80 CPU, obecným floppy modulem (8"/5.25"/3.5", SS/DS, SD/DD/HD), dvěma mechanikami, konverzní knihovnou diskových obrazů a testovací HTML stránkou s xterm.js terminálem.

---

## 1. Overview

Add a CP/M computer emulator (`src/devices/cpm/`) following the established PMD-85 / PMI-80 headless factory-function pattern. The emulator uses a Z80 CPU, a generic floppy disk controller module, and exposes a `frame(tStates)` API. A standalone test page (`src/devices/cpm/cpm.html`) provides an xterm.js terminal, drive LEDs, Reset button, and disk image loader.

---

## 2. Scope

### In scope
- `src/devices/cpm/cpm.js` — headless CP/M emulator (Z80 + FDC + serial I/O queues)
- `src/devices/floppy/floppy.js` — generic floppy disk module (geometry profiles, sector interleave, read/write)
- `src/devices/floppy/disk-image.js` — disk image format converter (raw `.cpm`/`.img`, IMD, CPCEMU/JOYCE `.dsk`)
- `src/devices/cpm/cpm-rom.js` — BIOS ROM exported as Intel HEX string (ported from `old/romCPM.js`)
- `src/devices/cpm/cpm.html` — test page with xterm.js terminal, drive LEDs, Reset, file input
- Unit tests: `test/cpm.test.js`, `test/floppy.test.js`

### Out of scope
- CPU snapshot/restore (handled by UI layer)
- Printer port output beyond a no-op callback
- Persistence of disk B (in-memory only; UI is responsible for save/load)
- Any display output beyond the serial terminal

---

## 3. File & Module Structure

```
src/
  devices/
    cpm/
      cpm.js          ← emulator factory (createCPM)
      cpm-rom.js      ← BIOS ROM constant
      cpm.html        ← test page
  floppy/
    floppy.js         ← generic floppy module (createFloppy)
    disk-image.js     ← format converters (raw, IMD, DSK)
test/
  cpm.test.js
  floppy.test.js
```

---

## 4. Generic Floppy Module — `src/devices/floppy/floppy.js`

### 4.1 Disk geometry profiles

| Profile ID | Description         | Tracks | Sides | Sectors/Track | Sector Size (B) | Default Interleave |
|------------|---------------------|--------|-------|---------------|------------------|--------------------|
| `8SD`      | 8" SS SD (CP/M std) | 77     | 1     | 26            | 128              | `[1,7,13,19,25,5,11,17,23,3,9,15,21,2,8,14,20,26,6,12,18,24,4,10,16,22]` |
| `525DD`    | 5.25" DS DD         | 80     | 2     | 9             | 512              | `null` (linear)    |
| `35HD`     | 3.5" DS HD          | 80     | 2     | 18            | 512              | `null` (linear)    |

Each profile object: `{ id, tracks, sides, sectorsPerTrack, sectorSize, interleave }`.
`interleave: null` means logical sector N maps directly to physical sector N (1-based).

### 4.2 Factory function

```js
export const createFloppy = (imageData, profile) => { ... }
```

- `imageData`: `Uint8Array` — raw disk image bytes (may be converted from IMD/DSK first)
- `profile`: profile object from `DISK_PROFILES` or custom descriptor
- Returns: `{ readSector(track, side, sector), writeSector(track, side, sector, data), getImage(), profile }`

### 4.3 Sector addressing

Logical address `(track, side, sector)` → physical byte offset:

```
physSector = interleave ? interleave[sector-1] : sector   // 1-based
byteOffset = (track * sides + side) * sectorsPerTrack * sectorSize
           + (physSector - 1) * sectorSize
```

### 4.4 Validation

- `readSector` / `writeSector` throw `RangeError` if track/side/sector are out of profile bounds.
- `imageData` shorter than `tracks × sides × sectorsPerTrack × sectorSize` bytes → throw `RangeError("Image too small")`.

### 4.5 Auto-detection

`export const detectProfile = (imageData)` — matches image byte length against all known profiles. Returns matching profile or `null`.

---

## 5. Disk Image Converter — `src/devices/floppy/disk-image.js`

### 5.1 Exports

```js
export const fromRaw   = (uint8array) => uint8array;              // pass-through, detect profile separately
export const fromIMD   = (uint8array) => { data, profile };       // parse IMD header, return raw + detected profile
export const fromDSK   = (uint8array) => { data, profile };       // CPCEMU/JOYCE .dsk → raw + profile
export const toRaw     = (floppy)     => floppy.getImage();
```

### 5.2 IMD parsing rules

- Parse ASCII header up to `0x1A` sentinel byte.
- Parse track records: mode byte, track, side, spt, sector-size code, sector map, optional cylinder/head/data maps, sector data.
- Reconstruct linear `Uint8Array` in `(track, side, sector)` order matching the detected geometry.
- If track geometry is consistent across all tracks → auto-select matching `DISK_PROFILES` entry; otherwise return a custom profile descriptor.
- Throw `Error("Invalid IMD")` if magic string `"IMD "` is absent.

### 5.3 DSK parsing rules (CPCEMU/JOYCE Extended DSK)

- Support both standard and extended DSK headers.
- Extended DSK: per-track sector sizes from track info blocks.
- Reconstruct linear `Uint8Array`; infer profile from header geometry fields.
- Throw `Error("Invalid DSK")` if signature `"MV - CPC"` or `"EXTENDED CPC DSK"` is absent.

---

## 6. CP/M Emulator — `src/devices/cpm/cpm.js`

### 6.1 Hardware model

| Resource     | Spec |
|--------------|------|
| CPU          | Z80 (from `../../z80.js`) |
| RAM          | 64 KB (Uint8Array, 0x0000–0xFFFF) |
| BIOS ROM     | Loaded from `cpm-rom.js` (Intel HEX), starts at 0xF200 |
| CPU clock    | Configurable, default 3,500,000 Hz |
| FDC ports    | Configurable, defaults: drive=10, track=11, sector=12, command=13, status=14, dmaLo=15, dmaHi=16 |
| CON OUT port | 1 (output character) |
| CON IN port  | 1 (read character) |
| CON STATUS   | 0 (0xFF = key waiting, 0x00 = empty) |
| LST port     | configurable, default ignored |

### 6.2 Factory function

```js
export const createCPM = (options = {}) => { ... }
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `fcpu` | number | 3_500_000 | CPU clock Hz |
| `ports` | object | see §6.1 | FDC and serial port numbers |
| `lstOut` | function(byte) | no-op | Printer port callback |

**Returns:**

```js
{
  reset(),                        // Load ROM, set PC=0xF200, SP=0x0000, clear queues
  frame(tStates),                 // Run tStates T-states; returns { initialized, output }
  insertDisk(drive, floppy),      // Mount floppy instance (drive: 0=A, 1=B)
  removeDisk(drive),              // Unmount drive
  sendKey(charCode),              // Push charCode into CON IN queue
  getDriveActivity(),             // Returns { 0: bool, 1: bool } — active this frame
  getRAM(),                       // Returns Uint8Array (live reference)
}
```

### 6.3 frame(tStates) contract

- Executes up to `tStates` T-states using `cpu.steps(tStates)`.
- **CON OUT** (port 1 OUT): each character byte is pushed onto an internal output queue.
- `frame()` returns `{ initialized: bool, output: Uint8Array }` where `output` contains all bytes written to CON OUT during this frame (may be empty, length 0).
- **CON IN** (port 0 IN → status, port 1 IN → data): dequeues from the input queue filled by `sendKey()`.
- Drive activity flag is set to `true` for any drive that had a sector read or write during the frame; cleared at the start of each frame.

### 6.4 FDC operation (port 13 command)

Commands (same as legacy `old/emuCPM.js`):

| Value | Operation |
|-------|-----------|
| 0     | Read sector: DMA ← disk[drive][track][sector] |
| 1     | Write sector: disk[drive][track][sector] ← DMA |

Status codes (port 14):

| Code | Meaning |
|------|---------|
| 0    | OK |
| 1    | Illegal drive |
| 2    | Illegal track |
| 3    | Illegal sector |
| 4    | No disk in drive |
| 5    | DMA overflow (read) |
| 6    | DMA overflow (write) |
| 7    | Unknown command |

### 6.5 ROM loading

`cpm-rom.js` exports:
```js
export const BIOS_HEX = "..."; // Intel HEX string from old/romCPM.js
```

`reset()` parses BIOS_HEX and writes bytes into RAM. No separate CCP/BDOS hex in scope — the legacy BIOS is self-contained.

**Assumption:** The old `romCPM.js` BIOS is complete and self-bootable with the same Z80 port map.

---

## 7. Test Page — `src/devices/cpm/cpm.html`

### 7.1 Layout

- Full-page xterm.js terminal (black background, green text, 80×24 minimum)
- Top bar:
  - Drive LEDs: **A:** and **B:** — blink orange when drive is active during a frame
  - **Reset** button — calls `cpm.reset()`, clears terminal
  - **Insert disk A** and **Insert disk B** — `<input type="file">` accepting `.cpm`, `.img`, `.imd`, `.dsk`
    - On file select: parse via `disk-image.js`, create `createFloppy()`, call `cpm.insertDisk(drive, floppy)`
    - Auto-detects geometry; if detection fails, shows an alert with profile options

### 7.2 Animation loop

Uses `requestAnimationFrame`. Each frame:
1. Compute `tStates = Math.floor(fcpu / 60)` (≈ 58 333 at 3.5 MHz / 60 fps).
2. Call `cpm.frame(tStates)`.
3. Write `result.output` bytes to xterm terminal via `term.write()`.
4. Update drive LEDs from `cpm.getDriveActivity()`.

### 7.3 Keyboard input

- `term.onData(data => { for each char: cpm.sendKey(char.charCodeAt(0)) })` — xterm provides key events already translated to CP/M-compatible ASCII.

### 7.4 Error handling

- File parse errors (bad IMD/DSK magic) → `alert("Cannot read disk image: " + err.message)`.
- Drive not ready (status 4) → silently reported in drive LED (dim red).

---

## 8. BIOS ROM Module — `src/devices/cpm/cpm-rom.js`

- Copy the Intel HEX strings verbatim from `old/romCPM.js`.
- Export as `export const BIOS_HEX = "..."`.
- No transformation — raw HEX is loaded by `reset()`.

---

## 9. Tests — `test/cpm.test.js` and `test/floppy.test.js`

### floppy.test.js

- `createFloppy` with `8SD` profile: `readSector(0,0,1)` returns 128 bytes.
- Out-of-range sector → `RangeError`.
- `writeSector` + `readSector` round-trip.
- `detectProfile`: known sizes return correct profile; unknown size returns `null`.
- Interleave: sector 1 of `8SD` maps to physical sector 1 (interleave[0]=1); sector 2 maps to 7.

### cpm.test.js

- After `reset()`, `getRAM()[0xF200]` contains first BIOS byte (0xC3 — JP opcode).
- `insertDisk(0, floppy)` + FDC port sequence → correct bytes returned at DMA address.
- `sendKey(65)` + `frame(...)` → CON IN port returns 65.
- Drive activity flag: `true` after FDC read, `false` after next frame with no FDC access.

---

## 10. Non-Goals

- No audio output.
- No video/graphics output.
- No CP/M file system layer in the emulator core (raw sector I/O only).
- No persistence of disk B (UI responsibility).
- No CPU snapshot/restore API.
- No support for more than 2 drives.
- No IMD write-back (read-only conversion).

---

## 11. Integration Points

- `src/z80.js` — existing Z80 factory, same callback interface as used by existing emulators.
- `old/romCPM.js` — source of BIOS HEX (read-only reference).
- `test/` — QUnit suite, same pattern as `pmd85.test.js`.
- npm package exports — no new entry point required (test page only, not library export).

---

## 12. Acceptance Criteria

1. `npm test` passes with no new failures; new tests have ≥ 80 % coverage on `floppy.js` and `cpm.js`.
2. `createFloppy` correctly reads/writes sectors for all three built-in profiles.
3. `detectProfile` identifies all three profiles by byte length.
4. `fromIMD` converts a valid IMD file without data loss (round-trip raw compare).
5. `fromDSK` converts both standard and extended DSK signatures.
6. `createCPM.reset()` loads BIOS at 0xF200 and sets PC correctly.
7. FDC read/write via port sequence matches legacy `old/emuCPM.js` behavior.
8. Test page boots CP/M in the browser terminal (A> prompt visible).
9. Disk B can be inserted/removed at runtime; write operations persist in-memory until page reload.
10. Drive LEDs blink during FDC activity and go dark when idle.

---

## 13. Assumptions

- **[ASSUMPTION]** The `old/romCPM.js` BIOS HEX is complete and self-bootable; no additional CCP/BDOS loading is required beyond what the BIOS already contains.
- **[ASSUMPTION]** The legacy port map (ports 0,1,10–16) is correct and sufficient for the BIOS to boot CP/M.
- **[ASSUMPTION]** xterm.js is loaded from CDN in the test page (no npm dependency added).
- **[ASSUMPTION]** Disk B is single-density 8" (`8SD`) when freshly initialized (empty 256,256-byte buffer with 0xE5 fill).
