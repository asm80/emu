/**
 * Floppy disk module tests.
 *
 * Covers geometry profiles, interleave addressing, sector read/write,
 * boundary validation, and profile auto-detection.
 */

import QUnit from "qunit";
import { createFloppy, DISK_PROFILES, detectProfile } from "../src/devices/floppy/floppy.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Create a floppy with all bytes set to 0xE5 (CP/M unused sector fill).
 *
 * @param {string} profileId - Key into DISK_PROFILES
 * @returns {{ floppy, profile }}
 */
const makeBlankFloppy = (profileId) => {
  const profile = DISK_PROFILES[profileId];
  const size = profile.tracks * profile.sides * profile.spt * profile.secSize;
  const image = new Uint8Array(size).fill(0xE5);
  return { floppy: createFloppy(image, profile), profile };
};

// ── createFloppy ─────────────────────────────────────────────────────────────

QUnit.test("readSector returns 128 bytes filled with 0xE5 on blank 8SD disk", (assert) => {
  const { floppy } = makeBlankFloppy("8SD");
  const sector = floppy.readSector(0, 0, 1);
  assert.equal(sector.length, 128, "sector length is 128");
  assert.ok(sector.every(b => b === 0xE5), "all bytes are 0xE5");
});

QUnit.test("writeSector + readSector round-trip preserves data", (assert) => {
  const { floppy } = makeBlankFloppy("8SD");
  const pattern = new Uint8Array(128).map((_, i) => i & 0xFF);
  floppy.writeSector(5, 0, 3, pattern);
  const back = floppy.readSector(5, 0, 3);
  assert.deepEqual(Array.from(back), Array.from(pattern), "data round-trips correctly");
});

QUnit.test("writeSector does not corrupt adjacent sectors", (assert) => {
  const { floppy } = makeBlankFloppy("8SD");
  const pattern = new Uint8Array(128).fill(0xAA);
  floppy.writeSector(5, 0, 3, pattern);
  const before = floppy.readSector(5, 0, 2);
  const after  = floppy.readSector(5, 0, 4);
  assert.ok(before.every(b => b === 0xE5), "sector before is untouched");
  assert.ok(after.every(b => b === 0xE5),  "sector after is untouched");
});

QUnit.test("out-of-range sector throws RangeError", (assert) => {
  const { floppy, profile } = makeBlankFloppy("8SD");
  assert.throws(
    () => floppy.readSector(0, 0, profile.spt + 1),
    RangeError,
    "sector beyond spt"
  );
  assert.throws(
    () => floppy.readSector(0, 0, 0),
    RangeError,
    "sector 0 (sectors are 1-based)"
  );
});

QUnit.test("out-of-range track throws RangeError", (assert) => {
  const { floppy, profile } = makeBlankFloppy("8SD");
  assert.throws(
    () => floppy.readSector(profile.tracks, 0, 1),
    RangeError,
    "track equal to tracks count"
  );
});

QUnit.test("image too small throws RangeError with message 'Image too small'", (assert) => {
  const profile = DISK_PROFILES["8SD"];
  const tinyImage = new Uint8Array(100);
  assert.throws(
    () => createFloppy(tinyImage, profile),
    (e) => e instanceof RangeError && e.message.includes("Image too small"),
    "throws RangeError mentioning 'Image too small'"
  );
});

// ── detectProfile ─────────────────────────────────────────────────────────────

QUnit.test("detectProfile returns 8SD for 256256-byte image", (assert) => {
  const image = new Uint8Array(77 * 1 * 26 * 128); // 256256
  const profile = detectProfile(image);
  assert.equal(profile, DISK_PROFILES["8SD"], "detected as 8SD");
});

QUnit.test("detectProfile returns 525DD for 737280-byte image", (assert) => {
  const image = new Uint8Array(80 * 2 * 9 * 512); // 737280
  const profile = detectProfile(image);
  assert.equal(profile, DISK_PROFILES["525DD"], "detected as 525DD");
});

QUnit.test("detectProfile returns 35HD for 1474560-byte image", (assert) => {
  const image = new Uint8Array(80 * 2 * 18 * 512); // 1474560
  const profile = detectProfile(image);
  assert.equal(profile, DISK_PROFILES["35HD"], "detected as 35HD");
});

QUnit.test("detectProfile returns null for unknown image size", (assert) => {
  const image = new Uint8Array(12345);
  assert.equal(detectProfile(image), null, "returns null for unknown geometry");
});

// ── Interleave ────────────────────────────────────────────────────────────────

QUnit.test("8SD interleave: logical sector 1 maps to physical sector 1 (byte offset 0)", (assert) => {
  const profile = DISK_PROFILES["8SD"];
  // interleave[0] = 1, so physSec=1, offset = (track*1 + 0)*spt*secSize + (1-1)*secSize = 0
  const image = new Uint8Array(77 * 26 * 128).fill(0x00);
  image[0] = 0x42; // byte at physical offset 0
  const floppy = createFloppy(image, profile);
  const sec = floppy.readSector(0, 0, 1);
  assert.equal(sec[0], 0x42, "logical sector 1 reads from physical offset 0");
});

QUnit.test("8SD interleave: logical sector 2 maps to physical sector 7", (assert) => {
  const profile = DISK_PROFILES["8SD"];
  // interleave[1] = 7, so physSec=7, offset = (7-1)*128 = 768
  const image = new Uint8Array(77 * 26 * 128).fill(0x00);
  image[768] = 0x99;
  const floppy = createFloppy(image, profile);
  const sec = floppy.readSector(0, 0, 2);
  assert.equal(sec[0], 0x99, "logical sector 2 reads from physical sector 7 (offset 768)");
});
