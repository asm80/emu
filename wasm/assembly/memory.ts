/**
 * Memory model for Intel 8080 WASM emulator.
 *
 * WASM linear memory layout (3 pages = 192 KB):
 *   0x00000–0x0FFFF  Page 0: AssemblyScript data section, runtime
 *   0x10000–0x1FFFF  Page 1: 64 KB CPU addressable space (RAM + ROM regions)
 *   0x20000–0x2000F  Register snapshot written by status()
 *   0x20010–0x2001F  Keyboard rows (16 bytes), written by main thread via SAB
 *   0x20020–0x2004F  Reserved
 */

// CPU memory base offset in WASM linear memory
// All CPU addresses (0x0000–0xFFFF) are translated to (CPU_BASE + addr)
export const CPU_BASE: i32 = 0x10000;

// Memory region type constants
export const REGION_RAM:  u8 = 0;
export const REGION_ROM:  u8 = 1;
export const REGION_MMIO: u8 = 2;

// Fixed offsets into WASM linear memory (above CPU space)
export const OFFSET_REGS:     i32 = 0x20000;
export const OFFSET_KEYBOARD: i32 = 0x20010;

// Intercept table — max 10 entries (< 10 is the documented typical usage)
const INTERCEPT_MAX: i32 = 10;
let interceptCount: i32 = 0;

const icStart = new StaticArray<u16>(10);
const icEnd   = new StaticArray<u16>(10);
const icType  = new StaticArray<u8>(10);

// JS-imported MMIO callbacks — called only for MMIO intercept ranges
@external("env", "js_mmioRead")
declare function js_mmioRead(addr: u16): u8;

@external("env", "js_mmioWrite")
declare function js_mmioWrite(addr: u16, val: u8): void;

// JS-imported I/O port callbacks (IN/OUT instructions)
@external("env", "js_portIn")
declare function js_portIn(port: u8): u8;

@external("env", "js_portOut")
declare function js_portOut(port: u8, val: u8): void;

/**
 * Configure one intercept entry. Call before starting emulation.
 * idx: 0–9, start/end: address range [start, end), type: REGION_ROM or REGION_MMIO
 */
export function configureIntercept(idx: i32, start: u16, end: u16, type: u8): void {
  if (idx < 0 || idx >= INTERCEPT_MAX) return;
  icStart[idx] = start;
  icEnd[idx]   = end;
  icType[idx]  = type;
}

export function setInterceptCount(n: i32): void {
  interceptCount = n < INTERCEPT_MAX ? n : INTERCEPT_MAX;
}

export function getInterceptCount(): i32 {
  return interceptCount;
}

/**
 * Read one byte from CPU address space.
 * Hot path: RAM access is a direct load<u8> with no overhead.
 * Cold path: MMIO intercept triggers js_mmioRead (JS callback).
 */
@inline
export function byteAt(addr: u16): u8 {
  for (let i: i32 = 0; i < interceptCount; i++) {
    if (addr >= icStart[i] && addr < icEnd[i]) {
      // ROM: reads are fine, fall through to load
      if (icType[i] == REGION_MMIO) return js_mmioRead(addr);
      break;
    }
  }
  return load<u8>(CPU_BASE + (addr as i32));
}

/**
 * Write one byte to CPU address space.
 * ROM intercepts: write is silently ignored.
 * MMIO intercepts: triggers js_mmioWrite (JS callback).
 * RAM: direct store<u8>.
 */
@inline
export function byteTo(addr: u16, val: u8): void {
  for (let i: i32 = 0; i < interceptCount; i++) {
    if (addr >= icStart[i] && addr < icEnd[i]) {
      if (icType[i] == REGION_ROM)  return;         // silently ignore ROM write
      if (icType[i] == REGION_MMIO) { js_mmioWrite(addr, val); return; }
    }
  }
  store<u8>(CPU_BASE + (addr as i32), val);
}

/** Read I/O port — delegates to JS callback. */
@inline
export function portIn(port: u8): u8 {
  return js_portIn(port);
}

/** Write I/O port — delegates to JS callback. */
@inline
export function portOut(port: u8, val: u8): void {
  js_portOut(port, val);
}

/** Direct memory read bypassing intercept table (for debugger). */
export function memGet(addr: u16): u8 {
  return load<u8>(CPU_BASE + (addr as i32));
}

/** Direct memory write bypassing intercept table (for debugger/ROM loading). */
export function memSet(addr: u16, val: u8): void {
  store<u8>(CPU_BASE + (addr as i32), val);
}
