/**
 * Keyboard SharedArrayBuffer helper.
 *
 * Keyboard state occupies 16 bytes at OFFSET_KEYBOARD (0x10010) in WASM memory.
 * Main thread writes row state; WASM reads it via portIn() without any round-trip.
 *
 * Usage (main thread):
 *   const kb = createKeyboardWriter(wasmMemoryBuffer);
 *   kb.setRow(0, 0b10110101);
 *
 * Usage (Worker, for portIn dispatch):
 *   const kb = createKeyboardReader(wasmMemoryBuffer);
 *   const rowValue = kb.getRow(port - KB_BASE_PORT);
 */

export const OFFSET_KEYBOARD = 0x10010;
export const KEYBOARD_ROWS   = 16;

/**
 * Create a writer for the keyboard SAB region (main thread side).
 * @param {ArrayBuffer|SharedArrayBuffer} buffer — WASM memory buffer
 */
export const createKeyboardWriter = (buffer) => {
  const view = new Uint8Array(buffer, OFFSET_KEYBOARD, KEYBOARD_ROWS);
  return {
    setRow: (row, value) => { view[row & 0x0F] = value & 0xFF; },
    clear:  ()           => { view.fill(0); },
  };
};

/**
 * Create a reader for the keyboard SAB region (Worker side).
 * @param {ArrayBuffer|SharedArrayBuffer} buffer — WASM memory buffer
 */
export const createKeyboardReader = (buffer) => {
  const view = new Uint8Array(buffer, OFFSET_KEYBOARD, KEYBOARD_ROWS);
  return {
    getRow: (row) => view[row & 0x0F] || 0,
  };
};
