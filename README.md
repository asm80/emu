# @asm80/emu

Multi-CPU emulator and debugger for vintage processors. Part of the ASM80 toolchain ecosystem.

## Overview

ASM80 Emulator provides cycle-accurate emulation for 8-bit and 16-bit vintage CPUs. This package includes both legacy implementations (in `old/`) and modernized ES6 modules (in `src/`).

**NPM package:** `@asm80/emu`

## Features

- **Cycle-accurate emulation** - Precise timing for authentic behavior
- **Hardware compatibility** - Passes original CPU test suites (e.g., 8080 Exerciser)
- **Multiple architectures** - Support for Z80, 8080, 6502, 65816, 6800, 6809, 8008, 1802
- **Modern ES6 modules** - Clean, functional code using latest JavaScript standards
- **Comprehensive tests** - QUnit test suite with code coverage reporting

## Supported CPUs

| CPU   | Architecture | Status | Legacy | Modern ES6 |
|-------|--------------|--------|--------|------------|
| 8080  | Intel 8-bit  | ✓ Complete | ✓ | ✓ |
| 8085  | Intel 8-bit  | Legacy only | ✓ | - |
| Z80   | Zilog 8-bit  | Legacy only | ✓ | - |
| 6502  | MOS 8-bit    | Legacy only | ✓ | - |
| 65816 | WDC 16-bit   | Legacy only | ✓ | - |
| 6800  | Motorola 8-bit | Legacy only | ✓ | - |
| 6809  | Motorola 8-bit | Legacy only | ✓ | - |
| 8008  | Intel 8-bit  | Legacy only | ✓ | - |
| 1802  | RCA COSMAC   | Legacy only | ✓ | - |

## Installation

```bash
npm install @asm80/emu
```

## Quick Start

### Intel 8080 (Modern ES6)

```javascript
import create8080 from "@asm80/emu/8080.js";

// Setup memory
const memory = new Uint8Array(65536);

// Create CPU
const cpu = create8080({
  byteAt: (addr) => memory[addr] || 0,
  byteTo: (addr, val) => { memory[addr] = val & 0xFF; }
});

// Load and run program
cpu.reset();
memory[0x0000] = 0x3E; // MVI A, 0x42
memory[0x0001] = 0x42;
cpu.steps(7);

console.log(cpu.status().a); // 0x42
```

## Documentation

- **Modern ES6 modules:** See [`src/README.md`](src/README.md) for detailed API documentation
- **Legacy modules:** See [`old/`](old/) directory for original implementations
- **Project guidelines:** See [`CLAUDE.md`](CLAUDE.md) for code style and architecture

## Development

### Commands

```bash
# Run tests with coverage
npm test

# Run tests without coverage
npm run test:run

# Generate HTML coverage report
npm run test:report

# Generate text coverage report
npm run test:report:text

# Run demo
node test/8080-demo.js

# Publish to npm (bump version, tag, push, publish)
npm run pub
```

### Testing

Tests use QUnit framework with c8 for coverage:

```bash
npm test
```

Coverage reports are saved to `coverage/` folder.

Current coverage (8080 module): **80.18%** statements, **45.55%** branches

### Code Style

All new code follows these standards (enforced by `CLAUDE.md`):

- **ES6 modules** - `import`/`export` syntax
- **No classes** - Functional style with factory functions
- **Arrow functions** - `const fn = () => {}` instead of `function`
- **const/let only** - Never use `var`
- **Double quotes** - All string literals use `""`
- **English** - All documentation and comments in English

## Project Structure

```
asm80-emu/
├── src/              # Modern ES6 modules
│   ├── 8080.js      # Intel 8080 emulator (✓ Complete)
│   └── README.md    # Module documentation
├── old/              # Legacy implementations (2013-2021)
│   ├── 8080.js      # Intel 8080 (reference)
│   ├── z80core.js   # Zilog Z80
│   ├── 6502.js      # MOS 6502
│   └── ...          # Other CPUs
├── test/             # QUnit test suite
│   ├── 8080.test.js # 8080 comprehensive tests
│   └── 8080-demo.js # End-to-end demo
├── CLAUDE.md         # Project guidelines
├── package.json
└── README.md
```

## Migration Status

The project is in **active migration** from legacy to modern ES6 modules:

- ✅ **8080** - Complete with 86 tests passing, 80% coverage
- ⏳ **8085, Z80, 6502, etc.** - Pending migration

See [`src/README.md`](src/README.md) for detailed migration roadmap.

## Architecture

### Factory Pattern

Each emulator uses a factory function returning a closure-based API:

```javascript
export default (callbacks) => {
  let state = { /* registers */ };

  const privateHelper = () => { /* ... */ };

  return {
    reset: () => { /* ... */ },
    steps: (n) => { /* ... */ }
  };
};
```

### Memory Interface

Flexible callback-based memory system:

```javascript
{
  byteAt: (addr) => memory[addr],
  byteTo: (addr, val) => { memory[addr] = val; },
  portOut: (port, val) => { /* I/O write */ },
  portIn: (port) => { /* I/O read */ }
}
```

Supports:
- Simple arrays
- Memory-mapped I/O
- Banking/paging
- Debug hooks

## Related Projects

- **[@asm80/core](https://github.com/maly/asm80-core)** - Assembler for vintage CPUs
- **[ASM80.com](https://www.asm80.com/)** - Online IDE for retro assembly

## Contributing

Contributions welcome! When adding features:

1. Follow code style in `CLAUDE.md`
2. Add comprehensive tests (target 90%+ coverage)
3. Update documentation
4. Use factory pattern (no classes)
5. Maintain cycle accuracy

## Testing Against Reference

The 8080 emulator passes the **Intel 8080 Exerciser** test suite, ensuring hardware compatibility. Other CPUs should be tested against their respective test suites when modernizing.

## Performance

Cycle-accurate emulation with precise timing:
- Intel 8080: ~2 MHz equivalent on modern hardware
- Suitable for real-time emulation of vintage systems
- Optimized switch-case instruction dispatch

## Credits

Based on original work by:
- **Intel 8080/8085:** Chris Double (BSD-licensed, 2008) and Martin Maly
- **Other CPUs:** See individual legacy files for attribution

Special thanks to Roman Borik for hardware compatibility testing.

## License

BSD 2-Clause License

Copyright (C) 2013-2021 Martin Maly
Copyright (C) 2008 Chris Double (8080 core)

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE DEVELOPERS AND CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

## Version History

### 1.0.0 (Current)
- ✅ Modern ES6 Intel 8080 emulator
- ✅ Comprehensive test suite (86 tests)
- ✅ 80%+ code coverage
- ✅ Factory pattern architecture
- ✅ Full API documentation

See [GitHub releases](https://github.com/maly/asm80-emu/releases) for detailed changelog.
