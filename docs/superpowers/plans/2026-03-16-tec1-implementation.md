# TEC-1 Emulator Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement TEC-1 computer emulator following PMI-80 pattern with frame-based API

**Architecture:** Frame-based emulator with audio synchronization, using Z80 CPU, 8255 PPI for I/O, 6-digit 7-segment display, and buzzer audio

**Tech Stack:** JavaScript (ES6 modules), Z80 CPU emulator, Web Audio API for sound

---

## Chunk 1: Create device directory and ROM file

**Files:**
- Create: `src/devices/tec/tecdoc.js` (monitor ROM)
- Reference: `old/devices/emuTEC.js` (ROM data at lines 3-186)

- [ ] **Step 1: Create src/devices/tec/ directory**

```bash
mkdir -p src/devices/tec
```

- [ ] **Step 2: Extract ROM from old implementation**

Extract the ROM array from old/devices/emuTEC.js (lines 3-186) and create tecdoc.js:

```javascript
// TEC-1 Monitor ROM (2KB)
// Source: old/devices/emuTEC.js

export const MONITOR_ROM = new Uint8Array([
  /* 0000 */
  0xC3, 0x80, 0x05, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xC3, 0x20, 0x03, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
  // ... (full 2KB array)
]);
```

- [ ] **Step 3: Verify ROM is exactly 2048 bytes (0x800)**

Check the array length matches 2048 bytes.

---

## Chunk 2: Create main TEC-1 emulator

**Files:**
- Create: `src/devices/tec/tec1.js`
- Reference: `src/devices/pmi/pmi80.js` (pattern to follow)
- Dependencies: `src/z80.js`, `src/devices/tec/tecdoc.js`

- [ ] **Step 1: Write the basic structure**

```javascript
import createZ80 from "../../z80.js";
import { MONITOR_ROM } from "./tecdoc.js";

const FCPU = 2000000; // 2 MHz

export const KEY_NAMES = [
  "kb0","kb1","kb2","kb3","kb4","kb5","kb6","kb7","kb8","kb9",
  "kba","kbb","kbc","kbd","kbe","kbf",
  "kbplus","kbminus","kbgo","kbad",
];

export const createTEC = (options = {}) => {
  const sampleRate = options.sampleRate ?? 44100;
  const ram = new Uint8Array(65536);

  // Port registers (8255 PPI)
  let portA = 0; // Keyboard input
  let portB = 0; // Display multiplex + buzzer
  let portC = 0; // Display data

  // Display state (6 digits)
  const displayState = new Array(6).fill(null);

  // Audio
  const tPerSample = FCPU / sampleRate;
  const audioBuffer = new Float32Array(Math.ceil(sampleRate / 10) + 2);
  let buzzer = false;
  let audioEvents = [];
  let audioBaseT = 0;

  // Keyboard
  let currentKeys = {};

  // CPU
  let cpu = null;

  // ... rest of implementation
};
```

- [ ] **Step 2: Implement memory functions**

```javascript
const byteTo = (addr, value) => {
  if (addr >= 0x0000 && addr <= 0x07FF) return; // ROM is read-only
  ram[addr] = value & 0xFF;
};

const byteAt = (addr) => {
  if (addr >= 0x0000 && addr <= 0x07FF) return MONITOR_ROM[addr];
  return ram[addr] ?? 0;
};
```

- [ ] **Step 3: Implement port I/O**

```javascript
const portOut = (addr, value) => {
  const port = addr & 0x0F;
  if (port === 1) {
    portB = value & 0xFF;
    // Bit 7 = buzzer (0 = on, 1 = off, inverted)
    const newBuzzer = (value & 0x80) === 0;
    if (newBuzzer !== buzzer) {
      audioEvents.push([cpu.t, newBuzzer ? 1 : 0]);
      buzzer = newBuzzer;
    }
    // Display digit select - bits 0-5 map to digits 5,4,3,2,1,0
    if (portB & 0x01) displayState[5] = portC;
    if (portB & 0x02) displayState[4] = portC;
    if (portB & 0x04) displayState[3] = portC;
    if (portB & 0x08) displayState[2] = portC;
    if (portB & 0x10) displayState[1] = portC;
    if (portB & 0x20) displayState[0] = portC;
  } else if (port === 2) {
    portC = value & 0xFF;
  }
};

const portIn = (addr) => {
  const port = addr & 0x0F;
  if (port === 0) {
    // Keyboard - return key code or 0xFF
    const k = currentKeys;
    if (k.kb0) return 0x00;
    if (k.kb1) return 0x01;
    // ... all 20 keys
    return 0xFF;
  }
  return 0xFF;
};
```

- [ ] **Step 4: Implement frame() method**

```javascript
let initialized = false;

const frame = (tStates, keys) => {
  if (!cpu) {
    return { initialized: false, display: [], audio: new Float32Array(0) };
  }
  currentKeys = keys ?? {};
  audioEvents = [];
  audioBaseT = cpu.t;

  // Reset display state
  for (let i = 0; i < 6; i++) displayState[i] = null;

  cpu.steps(tStates);

  // Generate audio
  const audio = generateAudio(tStates);

  return { initialized: true, display: [...displayState], audio };
};

const generateAudio = (tStates) => {
  // ... audio generation logic matching PMI-80
};
```

- [ ] **Step 5: Implement reset() and exports**

```javascript
const reset = () => {
  cpu = createZ80({ byteAt, byteTo, portIn, portOut });
  cpu.reset();
  buzzer = false;
  audioEvents = [];
  initialized = true;
};

return { reset, frame, getDisplay: () => [...displayState] };
```

- [ ] **Step 6: Verify the file compiles**

Run: `node -c src/devices/tec/tec1.js`
Expected: No syntax errors

---

## Chunk 3: Verify implementation

**Files:**
- Test: Basic module loading test
- Reference: `src/devices/pmi/pmi80.js` for API pattern

- [ ] **Step 1: Create simple test**

```javascript
// test-tec.js
import { createTEC, KEY_NAMES } from "./src/devices/tec/tec1.js";

console.log("KEY_NAMES:", KEY_NAMES);
console.log("Keys count:", KEY_NAMES.length); // Should be 20

const tec = createTEC({ sampleRate: 44100 });
tec.reset();

console.log("TEC-1 initialized successfully");

const result = tec.frame(10000, { kb0: true });
console.log("Display:", result.display);
console.log("Audio length:", result.audio.length);
```

- [ ] **Step 2: Run test**

```bash
node --experimental-modules test-tec.js 2>/dev/null || node test-tec.js
```

Expected: "TEC-1 initialized successfully" + valid display/audio output

- [ ] **Step 3: Verify keyboard codes**

Test all 20 keys return correct codes:
- kb0-kb9 → 0x00-0x09
- kba-kbf → 0x0A-0x0F
- kbplus → 0x10
- kbminus → 0x11
- kbgo → 0x12
- kbad → 0x13

---

## Implementation Notes

1. **CPU**: Uses Z80 @ 2MHz (not 8080 like PMI-80)
2. **Memory**: ROM at 0x0000-0x07FF, RAM at 0x0800-0x0FFF
3. **Ports**: 8255 PPI at ports 0, 1, 2 (using lower nibble)
4. **Display**: 6 digits, multiplexed - digit select on port 1, segment data on port 2
5. **Audio**: Buzzer on bit 7 of port 1 (inverted: 0=on, 1=off)
6. **Keyboard**: Direct key code return on port 0 read
