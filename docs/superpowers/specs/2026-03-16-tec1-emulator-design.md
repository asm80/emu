# TEC-1 Emulator Design Specification

## Overview
New TEC-1 computer emulator implementation following the same pattern as PMI-80 (frame-based API with audio synchronization).

## Hardware Specifications

| Component | Value |
|-----------|-------|
| CPU | Z80 @ 2 MHz |
| RAM | 2 KB (6116 SRAM) at 0x0800-0x0FFF |
| ROM | 2 KB Monitor at 0x0000-0x07FF |
| Display | 6× 7-segment LED (multiplexed) |
| Keyboard | 20 keys (0-9, A-F, +, -, GO, AD) |
| I/O | 8255 PPI at ports 0, 1, 2 |
| Audio | Buzzer on port 1, bit 7 |

## Port Mapping (8255 PPI)

| Port | Address | Direction | Function |
|------|---------|-----------|----------|
| Port A | 0x00 | Input | Keyboard data |
| Port B | 0x01 | Output | Display multiplex (IC9) + buzzer (bit 7) |
| Port C | 0x02 | Output | Display segment data (IC10) |

## Keyboard Codes

| Key | Code |
|-----|------|
| 0-9 | 0x00-0x09 |
| A-F | 0x0A-0x0F |
| + | 0x10 |
| - | 0x11 |
| GO | 0x12 |
| AD | 0x13 |

## Display

- 6 digits, multiplexed via IC9 (digit select) and IC10 (segment data)
- Same displayState pattern as PMI-80
- Each digit: 7-segment LED (segments a-g)

## Audio

- Buzzer on bit 7 of port 1
- 0 = on, 1 = off (inverted logic)
- Frame-based audio generation matching PMI-80 pattern

## File Structure

```
src/devices/tec/
├── tec1.js        # Main emulator (createTEC factory)
└── tec1-rom.js    # Monitor ROM (2 KB)
```

## API

```javascript
import { createTEC } from "./src/devices/tec/tec1.js";

const tec = createTEC({ sampleRate: 44100 });
tec.reset();

// In animation loop:
const { display, audio } = tec.frame(tStates, {
  kb0: false, kb1: true, ...  // key states
});
```

## Port Addressing

Port address uses lower nibble (addr & 0x0F), so ports 0, 1, 2 also respond at 0x10, 0x11, 0x12, etc.

## Keyboard KEY_NAMES

```javascript
export const KEY_NAMES = [
  "kb0","kb1","kb2","kb3","kb4","kb5","kb6","kb7","kb8","kb9",
  "kba","kbb","kbc","kbd","kbe","kbf",
  "kbplus","kbminus","kbgo","kbad",
];
```

## Dependencies

- Z80 CPU emulator (src/z80.js)
- Monitor ROM (src/devices/tec/tec1-rom.js)

## Features Not Implemented

- Tape interface (not requested)
- Memory-mapped I/O beyond 8255

## References

- Old implementation: old/devices/emuTEC.js
- Reference implementation: src/devices/pmi/pmi80.js
- Documentation: old/devices/TEC-1 TEC-1A.pdf
