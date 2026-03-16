/**
 * CP/M Headless Emulator Module
 *
 * Emulates a Z80-based CP/M computer with two 8" single-density floppy drives,
 * a console port (IN/OUT 0/1), and a generic FDC (ports 10–16).
 *
 * This module has NO DOM dependencies — it exposes a frame-oriented API that
 * any host (browser page, test harness, Node.js script) can drive.
 *
 * Architecture: Z80 CPU at 3.5 MHz, 64 KB RAM, BIOS at 0xF200, CP/M at 0xDC00.
 *
 * Port map:
 *   IN  0  — CON status: 0xFF if key available, else 0x00
 *   IN  1  — CON data: next key byte from input queue
 *   IN  4  — always 0xFF (LST status — always ready)
 *   IN  13 — FDC ready: always 0xFF (no async I/O)
 *   IN  14 — FDC last command status
 *   OUT 1  — CON OUT: byte pushed to output queue
 *   OUT 10 — FDC: select drive
 *   OUT 11 — FDC: set track
 *   OUT 12 — FDC: set sector
 *   OUT 13 — FDC: execute command (0=read, 1=write)
 *   OUT 15 — FDC: DMA address low byte
 *   OUT 16 — FDC: DMA address high byte
 *
 * @example
 * import { createCPM } from "./src/devices/cpm/cpm.js";
 * import { createFloppy } from "./src/devices/floppy/floppy.js";
 * import { BOOT_DISK, DISK_PROFILES } from "./src/devices/cpm/cpm-rom.js";
 *
 * const cpm = createCPM();
 * cpm.insertDisk(0, createFloppy(BOOT_DISK, DISK_PROFILES["8SD"]));
 * cpm.reset();
 * // In animation loop:
 * const { output } = cpm.frame(Math.floor(3_500_000 / 60));
 * term.write(output);
 */

import createZ80 from "../../z80.js";
import { BIOS_HEX, CPM_HEX } from "./cpm-rom.js";

/**
 * Default CPU clock frequency in Hz.
 * @type {number}
 */
const DEFAULT_FCPU = 3_500_000;

/**
 * Parse an Intel HEX string and write the data bytes into a Uint8Array.
 *
 * @param {string}     hex - Intel HEX encoded string
 * @param {Uint8Array} ram - Target memory array
 */
const loadHex = (hex, ram) => {
  for (const line of hex.split("\n")) {
    if (line[0] !== ":") continue;
    const len  = parseInt(line.slice(1, 3), 16);
    const addr = parseInt(line.slice(3, 7), 16);
    const type = parseInt(line.slice(7, 9), 16);
    if (type !== 0) continue;
    for (let i = 0; i < len; i++) {
      ram[addr + i] = parseInt(line.slice(9 + i * 2, 11 + i * 2), 16);
    }
  }
};

/**
 * Create a new CP/M emulator instance.
 *
 * The instance is NOT initialized after creation — call reset() before frame().
 * This allows the host to start its animation loop immediately and handle the
 * uninitialized state gracefully via the { initialized: false } frame result.
 *
 * @param {object}   [options]          - Configuration options
 * @param {number}   [options.fcpu]     - CPU clock speed in Hz (default: 3_500_000)
 * @param {function} [options.lstOut]   - Callback for LST port output bytes
 * @returns {object} CP/M emulator instance
 */
export const createCPM = (options = {}) => {
  const lstOut = options.lstOut ?? (() => {});

  // ── Memory ──────────────────────────────────────────────────────────────────

  /** Full 64 KB RAM — all writable, no ROM protection. */
  const ram = new Uint8Array(65536);

  let initialized = false;

  // ── Console I/O ──────────────────────────────────────────────────────────────

  /** Pending input bytes from sendKey() calls, consumed by port 1 reads. */
  const inputQueue = [];

  /** Output bytes produced by port 1 writes, returned by frame(). */
  const outputQueue = [];

  // ── FDC state ────────────────────────────────────────────────────────────────

  const fdc = {
    drv:    0,
    trk:    0,
    sec:    1,
    dma:    0,
    status: 0,
  };

  // ── Drive state ──────────────────────────────────────────────────────────────

  /** Floppy instances for drives A: (0) and B: (1). null = no disk. */
  const drives = [null, null];

  /** Per-drive activity flag — true if FDC was accessed this frame. */
  let driveActivity = [false, false];

  // ── CPU callbacks ────────────────────────────────────────────────────────────

  const byteAt = (addr) => ram[addr] || 0;
  const byteTo = (addr, val) => { ram[addr] = val & 0xFF; };

  const portIn = (port) => {
    switch (port & 0xFF) {
      case 0:  return inputQueue.length > 0 ? 0xFF : 0x00;
      case 1:  return inputQueue.length > 0 ? inputQueue.shift() : 0x00;
      case 4:  return 0xFF;
      case 13: return 0xFF;
      case 14: return fdc.status;
      default: return 0x1A;
    }
  };

  const portOut = (port, value) => {
    switch (port & 0xFF) {
      case 1:
        outputQueue.push(value & 0xFF);
        return;

      case 10:
        fdc.drv = value & 0xFF;
        return;

      case 11:
        fdc.trk = value & 0xFF;
        return;

      case 12:
        fdc.sec = value & 0xFF;
        return;

      case 15:
        fdc.dma = (fdc.dma & 0xFF00) | (value & 0xFF);
        return;

      case 16:
        fdc.dma = (fdc.dma & 0x00FF) | ((value & 0xFF) << 8);
        return;

      case 13: {
        // Execute FDC command
        const { drv, trk, sec, dma } = fdc;

        if (drv >= drives.length || drv < 0) {
          fdc.status = 1; // illegal drive number
          return;
        }
        if (drives[drv] === null) {
          fdc.status = 4; // no disk in drive
          return;
        }

        // The BIOS is hardcoded for 8SD geometry: 26 sectors/track, 128 bytes/sector.
        // It applies its own SECTRAN skew table before writing to FDC ports, so
        // `sec` here is already a PHYSICAL sector number (post-skew).
        // We must NOT apply interleave again — use a flat byte offset exactly as
        // the legacy emuCPM.js did: offset = (trk * SPT + (sec-1)) * SEC_SIZE.
        const BIOS_SPT      = 26;
        const BIOS_SEC_SIZE = 128;
        const flatOffset    = (trk * BIOS_SPT + (sec - 1)) * BIOS_SEC_SIZE;
        const imageSize     = drives[drv].profile.tracks
                            * drives[drv].profile.sides
                            * drives[drv].profile.spt
                            * drives[drv].profile.secSize;

        if (sec < 1) {
          fdc.status = 3; // sector 0 is never valid
          return;
        }
        if (flatOffset + BIOS_SEC_SIZE > imageSize) {
          fdc.status = 3; // address beyond image
          return;
        }
        if (dma > 65536 - BIOS_SEC_SIZE) {
          fdc.status = value === 0 ? 5 : 6; // DMA overflow
          return;
        }

        if (value === 0) {
          // Read sector → RAM at DMA (raw flat access, no interleave)
          ram.set(drives[drv].readRaw(flatOffset, BIOS_SEC_SIZE), dma);
          fdc.status = 0;
          if (drv < 2) driveActivity[drv] = true;
        } else if (value === 1) {
          // Write sector ← RAM at DMA (raw flat access, no interleave)
          drives[drv].writeRaw(flatOffset, ram.subarray(dma, dma + BIOS_SEC_SIZE));
          fdc.status = 0;
          if (drv < 2) driveActivity[drv] = true;
        } else {
          fdc.status = 7; // unknown command
        }
        return;
      }

      default:
        lstOut(value & 0xFF);
        return;
    }
  };

  // ── CPU ──────────────────────────────────────────────────────────────────────

  const cpu = createZ80({ byteAt, byteTo, portIn, portOut });

  // ── Public API ───────────────────────────────────────────────────────────────

  return {
    /**
     * Reset the emulator: reload ROM images, reset CPU, clear I/O queues.
     * Must be called at least once before frame() will execute instructions.
     */
    reset() {
      ram.fill(0);
      loadHex(CPM_HEX, ram);
      loadHex(BIOS_HEX, ram);
      cpu.reset();
      cpu.set("PC", 0xF200);
      cpu.set("SP", 0x0000);
      inputQueue.length  = 0;
      outputQueue.length = 0;
      fdc.drv = 0;
      fdc.trk = 0;
      fdc.sec = 1;
      fdc.dma = 0;
      fdc.status = 0;
      driveActivity = [false, false];
      initialized = true;
    },

    /**
     * Advance emulation by tStates CPU cycles.
     *
     * If called before reset(), returns { initialized: false } without
     * executing any CPU instructions.
     *
     * @param {number} tStates - Number of T-states (CPU cycles) to execute
     * @returns {{ initialized: false }
     *          |{ initialized: true, output: Uint8Array }}
     */
    frame(tStates) {
      if (!initialized) return { initialized: false, output: new Uint8Array(0) };
      driveActivity = [false, false];
      cpu.steps(tStates);
      const output = new Uint8Array(outputQueue);
      outputQueue.length = 0;
      return { initialized: true, output };
    },

    /**
     * Insert a floppy disk into a drive.
     *
     * @param {number} driveIndex - Drive number (0 = A:, 1 = B:)
     * @param {object} floppy     - Floppy instance from createFloppy()
     */
    insertDisk(driveIndex, floppy) {
      drives[driveIndex] = floppy;
    },

    /**
     * Remove the disk from a drive (leaves drive empty).
     *
     * @param {number} driveIndex - Drive number (0 = A:, 1 = B:)
     */
    removeDisk(driveIndex) {
      drives[driveIndex] = null;
    },

    /**
     * Enqueue a key byte for the CP/M console input (BIOS CONIN).
     * The byte will be returned the next time the CPU reads port 1.
     *
     * @param {number} keyCode - ASCII byte value (0–255)
     */
    sendKey(keyCode) {
      inputQueue.push(keyCode & 0xFF);
    },

    /**
     * Return per-drive activity flags from the most recent frame().
     * True means the FDC accessed that drive during the last frame.
     *
     * @returns {boolean[]} Array of two booleans [driveA, driveB]
     */
    getDriveActivity() {
      return [driveActivity[0], driveActivity[1]];
    },

    /**
     * Return the current RAM contents.
     *
     * @returns {Uint8Array} 64 KB RAM snapshot (live reference, not a copy)
     */
    getRAM() {
      return ram;
    },
  };
};
