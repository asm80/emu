/**
 * PMD-85 tape (MGF) decoder and Intel HEX converter.
 *
 * Tape format (per PMD-85 ROM monitor):
 *   Leader : 16 × 0x00, 16 × 0x55
 *   Header : 14 bytes
 *              byte  0   : file number (BLKN)
 *              byte  1   : 0x3F (binary flag)
 *              bytes 2–3 : load address, little-endian
 *              bytes 4–5 : data length, little-endian
 *              bytes 6–13: filename, 8 ASCII chars (space-padded)
 *   Data   : <length> bytes  →  load at <load address>
 *   Rest   : ignored
 *
 * The .pmd file wrapper is a JSON array: ["label", [byte, byte, ...]]
 * where the inner array is the raw tape byte stream.
 *
 * @module pmd85-tape-decoder
 */

// ---------------------------------------------------------------------------
// Sync detection
// ---------------------------------------------------------------------------

/**
 * Find the next MGF leader (≥16 × 0x00 followed by ≥16 × 0x55) in `buf`
 * starting from `pos`. Any leading 0xFF bytes are skipped silently.
 *
 * @param {Uint8Array} buf
 * @param {number} pos
 * @returns {number} position immediately after the leader (= first header byte), or -1
 */
const findLeader = (buf, pos) => {
  while (pos < buf.length) {
    // Skip tape noise / 0xFF preamble
    while (pos < buf.length && buf[pos] === 0xFF) pos++;
    if (pos >= buf.length) return -1;

    // Count 0x00 bytes
    const zeroStart = pos;
    while (pos < buf.length && buf[pos] === 0x00) pos++;
    if (pos - zeroStart < 16) { pos++; continue; }   // not enough zeros — try again

    // Count 0x55 bytes
    const pilotStart = pos;
    while (pos < buf.length && buf[pos] === 0x55) pos++;
    if (pos - pilotStart < 16) { pos++; continue; }  // not enough pilot — try again

    return pos;  // positioned at first header byte
  }
  return -1;
};

// ---------------------------------------------------------------------------
// Core decoder
// ---------------------------------------------------------------------------

/**
 * Decode all MGF blocks from a raw PMD tape byte stream.
 *
 * @param {Uint8Array} tape  raw tape bytes (the inner byte array from the .pmd JSON)
 * @returns {Array<{
 *   blkn : number,      file/block number
 *   flag : number,      file type byte (0x3F = binary, 0x3E = BASIC, …)
 *   load : number,      load address (16-bit)
 *   dlen : number,      data length in bytes
 *   name : string,      8-char filename, trailing spaces trimmed
 *   bytes: Uint8Array,  data payload
 * }>}
 */
export const decodeMGF = (tape) => {
  const blocks = [];
  let pos = 0;

  while (pos < tape.length) {
    pos = findLeader(tape, pos);
    if (pos === -1) break;

    // Need at least 14 bytes for header + 1 extra byte the .pmd tools append
    if (pos + 15 > tape.length) break;

    const blkn = tape[pos];
    const flag = tape[pos + 1];   // file type: 0x3F = binary, 0x3E = BASIC, etc.
    const load = tape[pos + 2] | (tape[pos + 3] << 8);
    const dlen = tape[pos + 4] | (tape[pos + 5] << 8);
    const name = new TextDecoder("ascii")
      .decode(tape.subarray(pos + 6, pos + 14))
      .replace(/\0/g, " ")
      .trimEnd();

    // Skip 14-byte header + 1 extra byte (appended by .pmd tools, not part of format)
    pos += 15;

    // Read data payload
    const end = Math.min(pos + dlen, tape.length);
    const bytes = tape.slice(pos, end);
    pos = end;   // everything after data is ignored per format spec

    blocks.push({ blkn, flag, load, dlen, name, bytes });

    // Only one block per leader sequence; remaining tape content is ignored
    break;
  }

  return blocks;
};

// ---------------------------------------------------------------------------
// Intel HEX generator
// ---------------------------------------------------------------------------

/**
 * Compute the Intel HEX record checksum (two's complement of byte sum).
 *
 * @param {number[]} bytes
 * @returns {number}
 */
const ihexChecksum = (bytes) => ((~bytes.reduce((a, b) => a + b, 0)) + 1) & 0xFF;

/**
 * Format `val` as uppercase hex, zero-padded to `digits` characters.
 *
 * @param {number} val
 * @param {number} digits
 * @returns {string}
 */
const h = (val, digits) => val.toString(16).toUpperCase().padStart(digits, "0");

/**
 * Convert decoded MGF blocks to an Intel HEX string.
 *
 * Each block produces consecutive 16-byte data records (type 00) at the
 * block's load address, followed by a single EOF record (type 01).
 *
 * @param {ReturnType<typeof decodeMGF>} blocks
 * @returns {string}  Intel HEX text, lines separated by "\n"
 */
export const toIntelHex = (blocks) => {
  const lines = [];
  const REC = 16;   // bytes per data record

  for (const block of blocks) {
    let addr = block.load;
    let off  = 0;

    while (off < block.bytes.length) {
      const chunk = Math.min(REC, block.bytes.length - off);
      const data  = Array.from(block.bytes.subarray(off, off + chunk));
      const rec   = [chunk, (addr >> 8) & 0xFF, addr & 0xFF, 0x00, ...data];
      lines.push(`:${h(chunk,2)}${h(addr,4)}00${data.map(b => h(b,2)).join("")}${h(ihexChecksum(rec),2)}`);
      addr += chunk;
      off  += chunk;
    }
  }

  lines.push(":00000001FF");
  return lines.join("\n");
};

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Decode a .pmd tape file and produce Intel HEX output.
 *
 * Handles:
 *   - JSON-wrapped format : `["label", [byte, ...]]`
 *   - JSON with hex literals: `["label", [0xff, 0x00, ...]]`
 *   - Raw binary tape stream
 *
 * @param {Uint8Array} rawBytes  file contents as loaded from disk
 * @param {string}    [fileName]
 * @returns {{
 *   label  : string | null,
 *   blocks : ReturnType<typeof decodeMGF>,
 *   hex    : string,
 * }}
 */
export const decodePMDFile = (rawBytes, fileName = "") => {
  let tape  = rawBytes;
  let label = null;

  // Try JSON-wrapped format (with optional hex literals like 0xff)
  if (fileName.endsWith(".pmd") || fileName.endsWith(".pmdtape")) {
    try {
      const text       = new TextDecoder().decode(rawBytes);
      const normalized = text.replace(/0x([0-9a-fA-F]+)/gi, (_, h) => parseInt(h, 16));
      const parsed     = JSON.parse(normalized);

      if (Array.isArray(parsed) && parsed.length === 2 &&
          typeof parsed[0] === "string" && Array.isArray(parsed[1])) {
        label = parsed[0];
        tape  = new Uint8Array(parsed[1]);
      } else if (Array.isArray(parsed)) {
        tape = new Uint8Array(parsed);
      }
    } catch {
      // Fall through — treat as raw binary tape stream
    }
  }

  const blocks = decodeMGF(tape);
  return { label, blocks, hex: toIntelHex(blocks) };
};
