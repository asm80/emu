# ASM80 Emulator - Modern ES6 Implementation

Modern ES6 module implementation of multi-CPU emulator suite for vintage processors.

## Overview

This directory contains the modernized ES6 module versions of CPU emulators, migrated from the legacy codebase in `old/`. The emulators are cycle-accurate and hardware-compatible, suitable for use in both Node.js and browser environments.

## Available Emulators

### Intel 8080 (`8080.js`)

**Status:** ✓ Complete and tested

Cycle-accurate Intel 8080 CPU emulator. Passes the 8080 Exerciser test suite for hardware compatibility.

#### Usage

```javascript
import create8080, { disasm } from "@asm80/emu/8080.js";

// Create memory and I/O infrastructure
const memory = new Uint8Array(65536);

// Create CPU instance
const cpu = create8080({
  byteAt: (addr) => memory[addr] || 0,
  byteTo: (addr, val) => { memory[addr] = val & 0xFF; },
  portOut: (port, val) => console.log(`OUT ${port}: ${val}`),
  portIn: (port) => 0xFF
});

// Initialize and run
cpu.reset();
cpu.set("PC", 0x0000);

// Load program into memory
memory[0x0000] = 0x3E; // MVI A, 0x42
memory[0x0001] = 0x42;

// Execute 7 CPU cycles
cpu.steps(7);

// Get CPU state
const state = cpu.status();
console.log(state.a); // 0x42
console.log(cpu.T()); // 7 (total cycles)
```

#### API Reference

##### Factory Function

**`create8080(callbacks)`**

Creates a new 8080 CPU instance.

**Parameters:**
- `callbacks.byteAt(addr)` - Read byte from memory
- `callbacks.byteTo(addr, value)` - Write byte to memory
- `callbacks.portOut(port, value)` - (Optional) Write to I/O port
- `callbacks.portIn(port)` - (Optional) Read from I/O port
- `callbacks.ticks` - (Optional) Unused, for compatibility

**Returns:** CPU instance object

##### CPU Instance Methods

**`reset()`**
Reset CPU to initial state (PC=0, SP=0, all registers cleared).

**`steps(cycles)`**
Execute N CPU cycles.
- `cycles` - Number of cycles to execute

**`set(register, value)`**
Set register value.
- `register` - Register name (case-insensitive): "A", "B", "C", "D", "E", "H", "L", "F", "PC", "SP"
- `value` - Byte value (0-255) or word value (0-65535) for PC/SP

**`status()`**
Get snapshot of all registers.
- **Returns:** `{ pc, sp, a, b, c, d, e, f, h, l }`

**`T()`**
Get total cycle count since reset.
- **Returns:** Number of cycles executed

**`memr(addr)`**
Read memory byte (convenience wrapper).
- `addr` - Memory address
- **Returns:** Byte value

**`interrupt(vector)`**
Trigger hardware interrupt (if interrupts enabled).
- `vector` - Interrupt vector address (default: 0x38)

**`trace(enabled)`**
Enable/disable execution tracing to console.
- `enabled` - Boolean flag

**`flagsToString()`**
Format flags register as string.
- **Returns:** String like "SZ0A0P1C" (uppercase = set, lowercase = clear)

**`init()`**
Legacy compatibility function (no-op in ES6 version).

##### Disassembler

**`disasm(opcode, arg1, arg2)`**

Disassemble a single 8080 instruction.

**Parameters:**
- `opcode` - Instruction byte (0-255)
- `arg1` - First argument byte (for 2/3-byte instructions)
- `arg2` - Second argument byte (for 3-byte instructions)

**Returns:** `[mnemonic, length]`
- `mnemonic` - Assembly string (e.g., "MVI A,$42")
- `length` - Instruction length in bytes (1-3)

**Example:**
```javascript
const [asm, len] = disasm(0x3E, 0x42, 0);
// Returns: ["MVI A,$42", 2]
```

#### Flags

The 8080 flag register (F) contains:
- **Bit 7 (0x80):** Sign flag (S)
- **Bit 6 (0x40):** Zero flag (Z)
- **Bit 4 (0x10):** Auxiliary Carry (A/H)
- **Bit 2 (0x04):** Parity flag (P)
- **Bit 0 (0x01):** Carry flag (C)
- **Bit 1:** Always 1
- **Bits 3,5:** Always 0

#### Cycle Timing

All instructions use authentic 8080 cycle timing:
- NOP: 4 cycles
- MOV reg,reg: 5 cycles
- MOV reg,M: 7 cycles
- MVI reg,n: 7 cycles
- LXI rp,nn: 10 cycles
- CALL: 17 cycles
- RET: 10 cycles
- See Intel 8080 datasheet for complete timing

#### Hardware Compatibility

This emulator is **cycle-accurate** and **hardware-compatible**:
- ✓ Passes Intel 8080 Exerciser test suite
- ✓ Authentic flag behavior using lookup tables
- ✓ Correct auxiliary carry calculation
- ✓ Accurate DAA (Decimal Adjust Accumulator) implementation
- ✓ Proper interrupt handling

## Code Style

All modules follow these conventions (see `CLAUDE.md`):

- **ES6 modules** - `import`/`export` syntax
- **No classes** - Functional style with factory functions
- **Arrow functions** - `const fn = () => {}` instead of `function fn() {}`
- **const/let only** - Never use `var`
- **Double quotes** - All string literals use `""`
- **JSDoc comments** - Every exported function documented
- **English** - All code, comments, and documentation in English

## Testing

Run the test suite:

```bash
npm test                 # Run tests with coverage
npm run test:run         # Run without coverage report
npm run test:report      # Generate HTML coverage report
```

Run the demo:

```bash
node test/8080-demo.js
```

## Migration Status

| CPU    | Legacy File     | Modern File | Status      | Tests | Coverage |
|--------|----------------|-------------|-------------|-------|----------|
| 8080   | `old/8080.js`  | `src/8080.js` | ✓ Complete | 86/86 | 80%      |
| 8085   | `old/8085.js`  | -           | Pending     | -     | -        |
| Z80    | `old/z80*.js`  | -           | Pending     | -     | -        |
| 6502   | `old/6502.js`  | -           | Pending     | -     | -        |
| 65816  | `old/65816.js` | -           | Pending     | -     | -        |
| 6800   | `old/6800.js`  | -           | Pending     | -     | -        |
| 6809   | `old/6809.js`  | -           | Pending     | -     | -        |
| 8008   | `old/8008.js`  | -           | Pending     | -     | -        |
| 1802   | `old/1802.js`  | -           | Pending     | -     | -        |

## Architecture Notes

### Factory Pattern (No Classes)

Each CPU emulator uses a factory function that returns an object with public methods:

```javascript
export default (callbacks) => {
  // Private state in closure
  let registers = { /* ... */ };

  // Private helpers
  const helperFunc = () => { /* ... */ };

  // Public API
  return {
    reset: () => { /* ... */ },
    steps: (n) => { /* ... */ },
    // ... other methods
  };
};
```

Benefits:
- Encapsulation without classes
- Clear separation of public/private API
- Functional programming style
- Easy to test and mock

### Memory Callbacks

The callback-based memory interface allows flexible integration:

- **Bare arrays** - Simple `Uint8Array` for testing
- **Memory-mapped I/O** - Intercept reads/writes to special addresses
- **Banking** - Implement paged memory systems
- **Debugging** - Log all memory access
- **Emulation hooks** - Trigger events on specific addresses

### Cycle Accuracy

Precise cycle counting enables:
- Authentic timing-sensitive software
- Interrupt handling at correct moments
- Sound/video synchronization
- Performance profiling

## Contributing

When adding a new CPU emulator:

1. Study existing emulators in `old/` for instruction set and timing
2. Create new ES6 module in `src/` following 8080.js pattern
3. Use factory function pattern (no classes)
4. Preserve cycle-accurate timing from legacy code
5. Implement comprehensive test suite in `test/`
6. Target 90%+ code coverage
7. Add JSDoc comments for all exports
8. Update this README with new emulator details

## License

BSD 2-Clause License (see main LICENSE file)

Based on original work:
- Intel 8080: Chris Double (BSD) and Martin Maly
- Other CPUs: See individual legacy files for attribution
