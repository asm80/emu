/**
 * CP/M emulator tests.
 *
 * Covers ROM loading, FDC read/write, console I/O, drive activity tracking,
 * and pre-reset guard behavior.
 */

import QUnit from "qunit";
import { createCPM } from "../src/devices/cpm/cpm.js";
import { createFloppy, DISK_PROFILES } from "../src/devices/floppy/floppy.js";
import { BOOT_DISK } from "../src/devices/cpm/cpm-rom.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Create a blank 8SD floppy disk (all 0xE5).
 *
 * @returns {object} Floppy instance
 */
const makeBlank8SD = () => {
  const profile = DISK_PROFILES["8SD"];
  const size = profile.tracks * profile.sides * profile.spt * profile.secSize;
  return createFloppy(new Uint8Array(size).fill(0xE5), profile);
};

// ── ROM loading ──────────────────────────────────────────────────────────────

QUnit.test("after reset(), BIOS is loaded: RAM[0xF200] === 0xC3 (JP opcode)", (assert) => {
  const cpm = createCPM();
  cpm.reset();
  assert.equal(cpm.getRAM()[0xF200], 0xC3, "first byte of BIOS is JP opcode 0xC3");
});

QUnit.test("after reset(), CP/M is loaded: RAM[0xDC00] === 0xC3 (JP opcode)", (assert) => {
  const cpm = createCPM();
  cpm.reset();
  assert.equal(cpm.getRAM()[0xDC00], 0xC3, "first byte of CP/M is JP opcode 0xC3");
});

// ── FDC ──────────────────────────────────────────────────────────────────────

QUnit.test("FDC read: data written to floppy sector appears at DMA address in RAM", (assert) => {
  const cpm = createCPM();
  const floppy = makeBlank8SD();

  // Pre-write known data at the flat byte offset the FDC will read.
  // FDC uses: offset = (trk * 26 + (sec-1)) * 128 — physical flat access, no interleave.
  // For track=1, sector=2: offset = (1*26 + 1)*128 = 3456
  const pattern = new Uint8Array(128).map((_, i) => (i + 1) & 0xFF);
  floppy.writeRaw(3456, pattern);

  cpm.insertDisk(0, floppy);
  cpm.reset();

  const ram = cpm.getRAM();

  // Simulate BIOS calling FDC ports to trigger a read:
  // Port 10 = drive 0, port 11 = track 1, port 12 = sector 2
  // Port 15 = DMA low, port 16 = DMA high (0x8000)
  // Port 13 command 0 = read
  // We write directly via CPU port simulation by using the public API to
  // set FDC registers via a minimal CP/M program.
  // Instead, verify via directly placing bytes and using frame().

  // Actually, since we need to trigger portOut, we inject a tiny Z80 program:
  // OUT (10),A ; OUT (11),A ; OUT (12),A ; OUT (15),A ; OUT (16),A ; OUT (13),A
  // Place at 0xF200 (BIOS start overwritten for test)
  const prog = [
    0x3E, 0x00, 0xD3, 0x0A,  // LD A,0 ; OUT (10),A   — drive 0
    0x3E, 0x01, 0xD3, 0x0B,  // LD A,1 ; OUT (11),A   — track 1
    0x3E, 0x02, 0xD3, 0x0C,  // LD A,2 ; OUT (12),A   — sector 2
    0x3E, 0x00, 0xD3, 0x0F,  // LD A,0 ; OUT (15),A   — DMA low = 0x00
    0x3E, 0x80, 0xD3, 0x10,  // LD A,0x80 ; OUT (16),A — DMA high = 0x80 → addr 0x8000
    0x3E, 0x00, 0xD3, 0x0D,  // LD A,0 ; OUT (13),A   — FDC read command
    0x76,                     // HALT
  ];
  for (let i = 0; i < prog.length; i++) ram[0xF200 + i] = prog[i];

  cpm.frame(10000);

  const dmaData = Array.from(ram.slice(0x8000, 0x8000 + 128));
  assert.deepEqual(dmaData, Array.from(pattern), "FDC read placed sector bytes at DMA address 0x8000");
});

// ── Console I/O ──────────────────────────────────────────────────────────────

QUnit.test("sendKey() enqueues byte; CON status port returns 0xFF, data port returns byte", (assert) => {
  const cpm = createCPM();
  cpm.reset();

  cpm.sendKey(65); // 'A'

  const ram = cpm.getRAM();
  // Inject: IN A,(0) ; LD (0x8000),A ; IN A,(1) ; LD (0x8001),A ; HALT
  const prog = [
    0xDB, 0x00,              // IN A,(0)
    0x32, 0x00, 0x80,        // LD (0x8000),A
    0xDB, 0x01,              // IN A,(1)
    0x32, 0x01, 0x80,        // LD (0x8001),A
    0x76,                    // HALT
  ];
  for (let i = 0; i < prog.length; i++) ram[0xF200 + i] = prog[i];

  cpm.frame(10000);

  assert.equal(ram[0x8000], 0xFF, "CON status (port 0) returns 0xFF when key is available");
  assert.equal(ram[0x8001], 65,   "CON data (port 1) returns the enqueued key byte");
});

QUnit.test("frame() returns output bytes written to port 1", (assert) => {
  const cpm = createCPM();
  cpm.reset();

  const ram = cpm.getRAM();
  // Inject: OUT (1), 'H' ; OUT (1), 'i' ; HALT
  const prog = [
    0x3E, 0x48, 0xD3, 0x01,  // LD A,'H' ; OUT (1),A
    0x3E, 0x69, 0xD3, 0x01,  // LD A,'i' ; OUT (1),A
    0x76,                    // HALT
  ];
  for (let i = 0; i < prog.length; i++) ram[0xF200 + i] = prog[i];

  const { output } = cpm.frame(10000);
  assert.equal(output.length, 2, "two bytes in output");
  assert.equal(output[0], 0x48, "first byte is 'H'");
  assert.equal(output[1], 0x69, "second byte is 'i'");
});

// ── Drive activity ────────────────────────────────────────────────────────────

QUnit.test("getDriveActivity() is true after FDC read, false after next frame with no FDC", (assert) => {
  const cpm = createCPM();
  const floppy = makeBlank8SD();
  cpm.insertDisk(0, floppy);
  cpm.reset();

  const ram = cpm.getRAM();
  const prog = [
    0x3E, 0x00, 0xD3, 0x0A,  // drive 0
    0x3E, 0x00, 0xD3, 0x0B,  // track 0
    0x3E, 0x01, 0xD3, 0x0C,  // sector 1
    0x3E, 0x00, 0xD3, 0x0F,  // DMA low
    0x3E, 0x80, 0xD3, 0x10,  // DMA high
    0x3E, 0x00, 0xD3, 0x0D,  // FDC read
    0x76,
  ];
  for (let i = 0; i < prog.length; i++) ram[0xF200 + i] = prog[i];

  cpm.frame(10000);
  assert.ok(cpm.getDriveActivity()[0], "drive A activity true after FDC read");

  // Next frame: HALT immediately — no FDC access
  ram[0xF200] = 0x76;
  cpm.frame(10000);
  assert.notOk(cpm.getDriveActivity()[0], "drive A activity false after idle frame");
});

// ── Pre-reset guard ───────────────────────────────────────────────────────────

QUnit.test("frame() before reset() returns { initialized: false }", (assert) => {
  const cpm = createCPM();
  const result = cpm.frame(100000);
  assert.equal(result.initialized, false, "initialized is false before reset()");
  assert.equal(result.output.length, 0, "output is empty before reset()");
});

// ── removeDisk ────────────────────────────────────────────────────────────────

QUnit.test("removeDisk() causes FDC status 4 on next command", (assert) => {
  const cpm = createCPM();
  const floppy = makeBlank8SD();
  cpm.insertDisk(0, floppy);
  cpm.reset();
  cpm.removeDisk(0);

  const ram = cpm.getRAM();
  // Inject FDC read command, then read status port into memory
  const prog = [
    0x3E, 0x00, 0xD3, 0x0A,  // drive 0
    0x3E, 0x00, 0xD3, 0x0B,  // track 0
    0x3E, 0x01, 0xD3, 0x0C,  // sector 1
    0x3E, 0x00, 0xD3, 0x0F,
    0x3E, 0x80, 0xD3, 0x10,
    0x3E, 0x00, 0xD3, 0x0D,  // FDC read — should fail (no disk)
    0xDB, 0x0E,              // IN A,(14) — read FDC status
    0x32, 0x00, 0x80,        // LD (0x8000),A
    0x76,
  ];
  for (let i = 0; i < prog.length; i++) ram[0xF200 + i] = prog[i];

  cpm.frame(10000);
  assert.equal(ram[0x8000], 4, "FDC status is 4 (no disk) when drive is empty");
});
