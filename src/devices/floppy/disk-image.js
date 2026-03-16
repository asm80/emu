/**
 * Disk Image Format Converters
 *
 * Converts between common floppy image formats (IMD, DSK) and raw linear
 * Uint8Array images compatible with createFloppy(). Also provides detectProfile
 * re-export for convenience.
 *
 * Supported formats:
 * - Raw (.img/.cpm): flat byte array, no header
 * - IMD: ImageDisk format with ASCII header ending at 0x1A sentinel
 * - DSK: standard ("MV - CPC") and extended ("EXTENDED CPC DSK") formats
 *
 * @module disk-image
 */

import { detectProfile } from "./floppy.js";

/**
 * Return a raw image as-is (identity conversion).
 *
 * @param {Uint8Array} uint8array - Raw disk image bytes
 * @returns {Uint8Array} Same bytes
 */
export const fromRaw = (uint8array) => uint8array;

/**
 * Parse an IMD (ImageDisk) file into a flat linear image.
 *
 * IMD format: ASCII text header, terminated by 0x1A. Followed by track records:
 *   [mode:1][cyl:1][side:1][spt:1][secSizeCode:1][sectorMap:spt][data...]
 * secSizeCode: 0=128, 1=256, 2=512, 3=1024, 4=2048, 5=4096, 6=8192
 *
 * @param {Uint8Array} uint8array - Raw IMD file bytes
 * @returns {{ data: Uint8Array, profile: object|null }} Decoded image and detected profile
 * @throws {Error} If file does not start with "IMD "
 */
export const fromIMD = (uint8array) => {
  const header = String.fromCharCode(...uint8array.subarray(0, 4));
  if (header !== "IMD ") throw new Error("Invalid IMD");

  // Skip ASCII header up to 0x1A sentinel
  let pos = uint8array.indexOf(0x1A) + 1;
  if (pos === 0) throw new Error("Invalid IMD");

  const SEC_SIZES = [128, 256, 512, 1024, 2048, 4096, 8192];

  // First pass: determine total image size
  const tracks = [];
  let scanPos = pos;
  while (scanPos < uint8array.length) {
    const spt         = uint8array[scanPos + 3];
    const secSizeCode = uint8array[scanPos + 4];
    const secSize     = SEC_SIZES[secSizeCode] ?? 128;
    const cyl         = uint8array[scanPos + 1];
    const side        = uint8array[scanPos + 2] & 0x01;
    const sectorMap   = uint8array.subarray(scanPos + 5, scanPos + 5 + spt);
    let tPos = scanPos + 5 + spt;
    const sectors = [];
    for (let s = 0; s < spt; s++) {
      const recType = uint8array[tPos++];
      let sectorData;
      if (recType === 0x00) {
        // Unavailable
        sectorData = new Uint8Array(secSize).fill(0xE5);
      } else if (recType === 0x01) {
        // Normal data
        sectorData = uint8array.slice(tPos, tPos + secSize);
        tPos += secSize;
      } else if (recType === 0x02) {
        // Compressed: all bytes are the fill value
        sectorData = new Uint8Array(secSize).fill(uint8array[tPos++]);
      } else {
        sectorData = new Uint8Array(secSize).fill(0xE5);
        tPos += secSize;
      }
      sectors.push({ logSec: sectorMap[s], data: sectorData });
    }
    tracks.push({ cyl, side, spt, secSize, sectors });
    scanPos = tPos;
  }

  // Build flat image sorted by cylinder/side, sectors by logical number
  const totalBytes = tracks.reduce((sum, t) => sum + t.spt * t.secSize, 0);
  const data = new Uint8Array(totalBytes).fill(0xE5);
  let offset = 0;
  const sorted = [...tracks].sort((a, b) => a.cyl !== b.cyl ? a.cyl - b.cyl : a.side - b.side);
  for (const trk of sorted) {
    for (let s = 1; s <= trk.spt; s++) {
      const sec = trk.sectors.find(x => x.logSec === s);
      if (sec) data.set(sec.data, offset + (s - 1) * trk.secSize);
    }
    offset += trk.spt * trk.secSize;
  }

  return { data, profile: detectProfile(data) };
};

/**
 * Parse a DSK (CPC disk image) file into a flat linear image.
 *
 * Supports both standard ("MV - CPC") and extended ("EXTENDED CPC DSK") headers.
 *
 * @param {Uint8Array} uint8array - Raw DSK file bytes
 * @returns {{ data: Uint8Array, profile: object|null }} Decoded image and detected profile
 * @throws {Error} If file does not have a recognized DSK signature
 */
export const fromDSK = (uint8array) => {
  const sig8  = String.fromCharCode(...uint8array.subarray(0, 8));
  const sig16 = String.fromCharCode(...uint8array.subarray(0, 16));
  const isExtended = sig16 === "EXTENDED CPC DSK";
  const isStandard = sig8 === "MV - CPC";
  if (!isExtended && !isStandard) throw new Error("Invalid DSK");

  const numTracks = uint8array[0x30];
  const numSides  = uint8array[0x31];

  let pos = 0x100; // Track info starts at offset 256
  const chunks = [];

  for (let t = 0; t < numTracks * numSides; t++) {
    if (pos >= uint8array.length) break;
    const spt         = uint8array[pos + 0x15];
    const secSizeCode = uint8array[pos + 0x16];
    const secSize     = isExtended ? 0 : (128 << secSizeCode);
    let dataPos = pos + 0x100;

    const sectors = [];
    for (let s = 0; s < spt; s++) {
      const infoOff = pos + 0x18 + s * 8;
      const logSec  = uint8array[infoOff + 2];
      const sSize   = isExtended
        ? (uint8array[infoOff + 6] | (uint8array[infoOff + 7] << 8))
        : (128 << uint8array[infoOff + 3]);
      sectors.push({ logSec, data: uint8array.slice(dataPos, dataPos + sSize), size: sSize });
      dataPos += sSize;
    }
    chunks.push({ spt, sectors });

    const trackSize = isExtended
      ? (uint8array[0x34 + t] << 8)
      : ((uint8array[0x32] | (uint8array[0x33] << 8)));
    pos += trackSize || (spt * (128 << secSizeCode) + 0x100);
  }

  // Flatten: each track is sequential sectors ordered by logical number
  const trackBytes = chunks.map(c =>
    c.sectors.reduce((sum, s) => sum + s.size, 0));
  const total = trackBytes.reduce((a, b) => a + b, 0);
  const data = new Uint8Array(total).fill(0xE5);
  let off = 0;
  for (let i = 0; i < chunks.length; i++) {
    const { sectors } = chunks[i];
    const sorted = [...sectors].sort((a, b) => a.logSec - b.logSec);
    let secOff = 0;
    for (const sec of sorted) {
      data.set(sec.data, off + secOff);
      secOff += sec.size;
    }
    off += trackBytes[i];
  }

  return { data, profile: detectProfile(data) };
};

/**
 * Export the raw image from a floppy instance.
 *
 * @param {{ getImage: function }} floppy - Floppy disk instance
 * @returns {Uint8Array} Raw disk image bytes
 */
export const toRaw = (floppy) => floppy.getImage();
