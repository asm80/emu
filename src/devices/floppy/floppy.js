/**
 * Generic Floppy Disk Module
 *
 * Provides a sector-addressable floppy disk abstraction over a flat Uint8Array
 * image. Supports multiple geometry profiles including 8" single-density (8SD),
 * 5.25" double-density (525DD), and 3.5" high-density (35HD).
 *
 * Interleave tables map logical sector numbers (1-based) to physical positions
 * on the disk surface, matching original CP/M skew factors for compatibility.
 *
 * @module floppy
 */

/**
 * Disk geometry profiles.
 * Each profile describes the physical layout of a disk image.
 *
 * @type {Object.<string, {tracks:number, sides:number, spt:number, secSize:number, interleave:number[]|null}>}
 */
export const DISK_PROFILES = {
  "8SD": {
    tracks:    77,
    sides:     1,
    spt:       26,
    secSize:   128,
    interleave: [1,7,13,19,25,5,11,17,23,3,9,15,21,2,8,14,20,26,6,12,18,24,4,10,16,22],
  },
  "525DD": {
    tracks:    80,
    sides:     2,
    spt:       9,
    secSize:   512,
    interleave: null,
  },
  "35HD": {
    tracks:    80,
    sides:     2,
    spt:       18,
    secSize:   512,
    interleave: null,
  },
  // 80-track double-sided, 16 sectors × 256 B — used by some CP/M IMD images (e.g. Turbo Pascal)
  "80DS16": {
    tracks:    80,
    sides:     2,
    spt:       16,
    secSize:   256,
    interleave: null,
  },
  // 58-track single-sided, 26 sectors × 128 B — used by CPM18.DSK and similar compact images
  "58SS26": {
    tracks:    58,
    sides:     1,
    spt:       26,
    secSize:   128,
    interleave: null,
  },
};

/**
 * Detect a disk profile from image size.
 *
 * @param {Uint8Array} imageData - Raw disk image bytes
 * @returns {object|null} Matching profile object, or null if no match
 */
export const detectProfile = (imageData) => {
  for (const profile of Object.values(DISK_PROFILES)) {
    const expected = profile.tracks * profile.sides * profile.spt * profile.secSize;
    if (imageData.length === expected) return profile;
  }
  return null;
};

/**
 * Compute flat byte offset for a given track/side/sector address.
 *
 * @param {object} profile   - Disk geometry profile
 * @param {number} track     - Track number (0-based)
 * @param {number} side      - Side number (0-based)
 * @param {number} sector    - Logical sector number (1-based)
 * @returns {number} Byte offset into flat image
 */
const sectorOffset = (profile, track, side, sector) => {
  const { sides, spt, secSize, interleave } = profile;
  const physSector = interleave ? interleave[sector - 1] : sector;
  return ((track * sides + side) * spt + (physSector - 1)) * secSize;
};

/**
 * Create a floppy disk instance from a raw image buffer and geometry profile.
 *
 * @param {Uint8Array} imageData - Raw disk image. Must be at least tracks*sides*spt*secSize bytes.
 * @param {object}     profile   - Geometry profile (from DISK_PROFILES or fromIMD/fromDSK result)
 * @returns {{ readSector, writeSector, getImage, profile }} Floppy disk instance
 * @throws {RangeError} If imageData is smaller than the geometry requires
 */
export const createFloppy = (imageData, profile) => {
  const required = profile.tracks * profile.sides * profile.spt * profile.secSize;
  if (imageData.length < required) {
    throw new RangeError(`Image too small: need ${required} bytes, got ${imageData.length}`);
  }

  // Work on a copy so callers cannot mutate the original buffer
  const data = new Uint8Array(imageData.buffer ?? imageData).slice(0, required);

  /**
   * Validate track/side/sector and throw RangeError if out of bounds.
   *
   * @param {number} track  - Track number (0-based)
   * @param {number} side   - Side number (0-based)
   * @param {number} sector - Logical sector (1-based)
   */
  const validate = (track, side, sector) => {
    if (track < 0 || track >= profile.tracks)
      throw new RangeError(`Track ${track} out of range [0, ${profile.tracks - 1}]`);
    if (side < 0 || side >= profile.sides)
      throw new RangeError(`Side ${side} out of range [0, ${profile.sides - 1}]`);
    if (sector < 1 || sector > profile.spt)
      throw new RangeError(`Sector ${sector} out of range [1, ${profile.spt}]`);
  };

  return {
    /**
     * Read one sector from the disk.
     *
     * @param {number} track  - Track number (0-based)
     * @param {number} side   - Side number (0-based)
     * @param {number} sector - Logical sector number (1-based)
     * @returns {Uint8Array} Copy of the sector bytes (secSize bytes)
     */
    readSector(track, side, sector) {
      validate(track, side, sector);
      const off = sectorOffset(profile, track, side, sector);
      return data.slice(off, off + profile.secSize);
    },

    /**
     * Write one sector to the disk image.
     *
     * @param {number}     track   - Track number (0-based)
     * @param {number}     side    - Side number (0-based)
     * @param {number}     sector  - Logical sector number (1-based)
     * @param {Uint8Array} bytes   - Exactly secSize bytes to write
     */
    writeSector(track, side, sector, bytes) {
      validate(track, side, sector);
      const off = sectorOffset(profile, track, side, sector);
      data.set(bytes.subarray(0, profile.secSize), off);
    },

    /**
     * Read bytes at a raw flat byte offset without any interleave translation.
     * Used by FDC emulation where the BIOS has already applied sector skew.
     *
     * @param {number} byteOffset - Byte offset into the flat image
     * @param {number} length     - Number of bytes to read
     * @returns {Uint8Array} View into internal data (not a copy)
     */
    readRaw(byteOffset, length) {
      return data.subarray(byteOffset, byteOffset + length);
    },

    /**
     * Write bytes at a raw flat byte offset without any interleave translation.
     * Used by FDC emulation where the BIOS has already applied sector skew.
     *
     * @param {number}     byteOffset - Byte offset into the flat image
     * @param {Uint8Array} bytes      - Bytes to write
     */
    writeRaw(byteOffset, bytes) {
      data.set(bytes.subarray(0, Math.min(bytes.length, data.length - byteOffset)), byteOffset);
    },

    /**
     * Return the current full disk image as a Uint8Array.
     *
     * @returns {Uint8Array} Disk image snapshot
     */
    getImage() {
      return data.slice();
    },

    /** Geometry profile this floppy was created with. */
    profile,
  };
};
