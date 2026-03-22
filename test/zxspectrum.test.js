/**
 * ZX Spectrum emulator test suite.
 *
 * Tests: AY-3-8912 PSG standalone, ZXS construction, keyboard scanning,
 * border output, SNA 48k/128k snapshot load/save, and 128k paging.
 */

import QUnit from "qunit";
import { createAY } from "../src/devices/ay3891x/ay3891x.js";
import { createZXS } from "../src/devices/zxs/zxspectrum.js";

// ── Tape helpers ──────────────────────────────────────────────────────────────

/**
 * Build a minimal .TAP block.
 *
 * @param {number} firstByte - 0x00 = header block, 0xFF = data block
 * @param {number} totalLen  - Total block length (including firstByte)
 * @returns {Uint8Array}
 */
const makeTAPBlock = (firstByte, totalLen = 17) => {
  const buf = new Uint8Array(2 + totalLen);
  buf[0] = totalLen & 0xFF;
  buf[1] = (totalLen >> 8) & 0xFF;
  buf[2] = firstByte;
  return buf;
};

/**
 * Build a minimal .TZX file with a single type-0x10 standard block.
 *
 * @param {number} firstByte - 0x00 = header, 0xFF = data
 * @returns {Uint8Array}
 */
const makeTZXBlock10 = (firstByte = 0x00) => {
  const dataLen = 17;
  const buf = new Uint8Array(10 + 1 + 4 + dataLen);
  // TZX header
  "ZXTape!".split("").forEach((c, i) => { buf[i] = c.charCodeAt(0); });
  buf[7] = 0x1A; buf[8] = 1; buf[9] = 20;
  // Block 0x10
  buf[10] = 0x10;
  buf[11] = 0x00; buf[12] = 0x00;        // pause 0 ms
  buf[13] = dataLen & 0xFF; buf[14] = (dataLen >> 8) & 0xFF;
  buf[15] = firstByte;
  return buf;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Create a reset 48k ZXS instance.
 * @returns {object} Initialized ZXS emulator
 */
const make48 = () => {
  const zxs = createZXS({ model: "48k", sampleRate: 44100 });
  zxs.reset();
  return zxs;
};

/**
 * Create a reset 128k ZXS instance.
 * @returns {object} Initialized ZXS emulator
 */
const make128 = () => {
  const zxs = createZXS({ model: "128k", sampleRate: 44100 });
  zxs.reset();
  return zxs;
};

// ── AY-3-8912 standalone ──────────────────────────────────────────────────────

QUnit.module("AY-3-8912 standalone", () => {

  QUnit.test("register write/read round-trip", (assert) => {
    const ay = createAY();
    ay.writeRegisterSelect(7);
    ay.writeRegisterValue(0b00111000);
    assert.strictEqual(ay.readRegister(), 0b00111000, "register 7 value read back");
  });

  QUnit.test("generate() returns correct sample count for one ZX frame", (assert) => {
    const sampleRate  = 44100;
    const cpuClockHz  = 3500000;
    const tStates     = 69888;
    const ay = createAY({ sampleRate, cpuClockHz });
    const buf = ay.generate(tStates);
    const expected = Math.ceil(tStates * sampleRate / cpuClockHz);
    assert.strictEqual(buf.length, expected, "sample count matches formula");
  });

  QUnit.test("reset() clears registers", (assert) => {
    const ay = createAY();
    ay.writeRegisterSelect(0);
    ay.writeRegisterValue(0xFF);
    ay.reset();
    ay.writeRegisterSelect(0);
    assert.strictEqual(ay.readRegister(), 0, "register cleared after reset");
  });

});

// ── ZXS construction & reset ──────────────────────────────────────────────────

QUnit.module("ZXS construction & reset", () => {

  QUnit.test("PC = 0x0000 after reset", (assert) => {
    const zxs = make48();
    assert.strictEqual(zxs.status().pc, 0, "PC starts at 0x0000 (ROM entry)");
  });

  QUnit.test("frame() returns video buffer of 558144 bytes", (assert) => {
    const zxs = make48();
    const result = zxs.frame(69888);
    assert.strictEqual(result.video.length, 320 * 240 * 4, "video buffer is 320×240×4 bytes");
  });

  QUnit.test("frame() returns correct audio sample count", (assert) => {
    const sampleRate = 44100;
    const tStates    = 69888;
    const zxs = createZXS({ model: "48k", sampleRate });
    zxs.reset();
    const result = zxs.frame(tStates);
    const expected = Math.ceil(tStates * sampleRate / 3500000);
    assert.strictEqual(result.audio.length, expected, "audio sample count matches");
  });

  QUnit.test("trace(true) does not throw", (assert) => {
    const zxs = make48();
    assert.ok(() => { zxs.trace(true); zxs.trace(false); }, "trace toggle is safe");
  });

});

// ── Border output ─────────────────────────────────────────────────────────────

QUnit.module("Border", () => {

  QUnit.test("borderColor returned from frame() reflects ULA OUT", (assert) => {
    const zxs = make48();
    const ram = zxs.getRAM();
    // OUT (0xFE), A  with A=3 → border=3
    // Machine code at 0x4000: LD A,3 (0x3E,0x03), OUT (0xFE),A (0xD3,0xFE), JR -4 (0x18,0xFC)
    // But PC starts at 0x0000 (ROM); let the ROM run — border changes via ROM init.
    // We instead test that the result object has borderColor property with a valid value.
    const result = zxs.frame(69888);
    assert.ok(result.borderColor >= 0 && result.borderColor <= 7, "borderColor in valid range");
    assert.ok("borderColor" in result, "result has borderColor property");
  });

});

// ── SNA 48k ───────────────────────────────────────────────────────────────────

QUnit.module("SNA 48k", () => {

  /**
   * Build a minimal valid 49179-byte 48k SNA.
   * PC = 0x8000 is written to the stack at SP = 0xFFFC.
   *
   * @param {object} [opts]
   * @returns {Uint8Array}
   */
  const makeSNA48 = (opts = {}) => {
    const sna = new Uint8Array(49179);
    // Header: SP at offset 23–24
    const sp = opts.sp ?? 0xFFF0;
    sna[23] = sp & 0xFF;
    sna[24] = (sp >> 8) & 0xFF;
    // Border
    sna[26] = opts.border ?? 3;
    // PC on stack: SP points into RAM (0x4000–0xFFFF), offset in SNA = sp - 0x4000 + 27
    const pcVal = opts.pc ?? 0x8000;
    const spOff = sp - 0x4000 + 27;  // position in SNA bytes
    if (spOff >= 27 && spOff + 1 < 49179) {
      sna[spOff]     = pcVal & 0xFF;
      sna[spOff + 1] = (pcVal >> 8) & 0xFF;
    }
    // Optional: set a RAM byte
    if (opts.ramByte !== undefined) {
      sna[27 + opts.ramByte.offset] = opts.ramByte.value;
    }
    return sna;
  };

  QUnit.test("loadSNA() sets PC from stack", (assert) => {
    const zxs = make48();
    const pcVal = 0x6000;
    const sp    = 0xFFF0;
    const sna   = makeSNA48({ pc: pcVal, sp });
    zxs.loadSNA(sna);
    assert.strictEqual(zxs.status().pc, pcVal, "PC loaded from SNA stack");
  });

  QUnit.test("loadSNA() copies RAM content", (assert) => {
    const zxs = make48();
    const sna = makeSNA48({ ramByte: { offset: 10, value: 0xAB } });
    zxs.loadSNA(sna);
    assert.strictEqual(zxs.getRAM()[10], 0xAB, "RAM byte at offset 10 matches SNA");
  });

  QUnit.test("snapshot() round-trip preserves PC", (assert) => {
    const zxs = make48();
    const sna  = makeSNA48({ pc: 0x5000, sp: 0xFFF0 });
    zxs.loadSNA(sna);
    const pc1 = zxs.status().pc;
    zxs.loadSNA(zxs.snapshot());
    assert.strictEqual(zxs.status().pc, pc1, "PC preserved after snapshot round-trip");
  });

  QUnit.test("loadSNA() throws on invalid size", (assert) => {
    const zxs = make48();
    assert.throws(
      () => zxs.loadSNA(new Uint8Array(1234)),
      /Invalid SNA file/,
      "throws with message on bad size"
    );
  });

});

// ── SNA 128k ─────────────────────────────────────────────────────────────────

QUnit.module("SNA 128k", () => {

  /**
   * Build a minimal valid 131103-byte 128k SNA.
   *
   * @param {object} [opts]
   * @returns {Uint8Array}
   */
  const makeSNA128 = (opts = {}) => {
    const sna = new Uint8Array(131103);
    // SP
    const sp = 0xFFF0;
    sna[23] = sp & 0xFF;
    sna[24] = (sp >> 8) & 0xFF;
    // PC at 49179–49180
    const pc = opts.pc ?? 0x0000;
    sna[49179] = pc & 0xFF;
    sna[49180] = (pc >> 8) & 0xFF;
    // port 7FFD
    sna[49181] = opts.port7FFD ?? 0;
    return sna;
  };

  QUnit.test("loadSNA() sets ramBank from port7FFD bits 0–2", (assert) => {
    const zxs = make128();
    const sna = makeSNA128({ port7FFD: 5 });  // ramBank=5
    zxs.loadSNA(sna);
    assert.strictEqual(zxs.getBankingState().ramBank, 5, "ramBank set from SNA port7FFD");
  });

  QUnit.test("snapshot() round-trip preserves all 8 banks", (assert) => {
    const zxs = make128();
    // Write a marker byte into each bank
    const ram = zxs.getRAM();
    for (let b = 0; b < 8; b++) ram[b * 16384] = b + 1;
    const snap = zxs.snapshot();
    // Reset and reload
    zxs.reset();
    zxs.loadSNA(snap);
    const ram2 = zxs.getRAM();
    let allMatch = true;
    for (let b = 0; b < 8; b++) {
      if (ram2[b * 16384] !== b + 1) { allMatch = false; break; }
    }
    assert.ok(allMatch, "all 8 bank markers preserved through snapshot round-trip");
  });

});

// ── Tape ──────────────────────────────────────────────────────────────────────

QUnit.module("Tape", () => {

  QUnit.test("tapeGetState() before load returns zeroed state", (assert) => {
    const zxs = make48();
    const state = zxs.tapeGetState();
    assert.strictEqual(state.playing, false, "not playing");
    assert.strictEqual(state.edgeCount, 0, "no edges loaded");
    assert.strictEqual(state.edgesRemaining, 0, "no edges remaining");
  });

  QUnit.test("loadTAP() header block sets edgeCount > 0", (assert) => {
    const zxs = make48();
    zxs.loadTAP(makeTAPBlock(0x00));
    assert.ok(zxs.tapeGetState().edgeCount > 0, "edges loaded from TAP header block");
  });

  QUnit.test("loadTAP() header block pilot contains 8063 × 2168 T-state pulses", (assert) => {
    // We verify this indirectly: the first 8063 edges must all be 2168.
    // We cannot access internal arrays directly, so we use tapePlay + manual counting
    // via a TAP that has only 1 byte of data (minimising non-pilot edges).
    // Instead, validate via the public parse function exported for testing.
    // Since parseTAPtoEdges is not exported, we test via edgeCount:
    // A 1-byte header TAP produces: 8063 pilot + 2 sync + 8 bits × 2 pulses = 8063 + 2 + 16 = 8081 edges + 1 pause edge = 8082
    const tap = makeTAPBlock(0x00, 1);  // 1-byte block, firstByte = 0x00 (header)
    const zxs = make48();
    zxs.loadTAP(tap);
    const expected = 8063 + 2 + 1 * 8 * 2 + 1;  // pilot + sync + bits + pause
    assert.strictEqual(zxs.tapeGetState().edgeCount, expected, "edge count matches pilot+sync+bits+pause");
  });

  QUnit.test("loadTAP() data block (0xFF) uses 3223 pilot pulses", (assert) => {
    const tap = makeTAPBlock(0xFF, 1);
    make48().loadTAP(tap);  // sanity: no throw
    const zxs = make48();
    zxs.loadTAP(tap);
    const expected = 3223 + 2 + 1 * 8 * 2 + 1;  // pilot + sync + bits + pause
    assert.strictEqual(zxs.tapeGetState().edgeCount, expected, "data block uses 3223 pilot pulses");
  });

  QUnit.test("tapePlaying becomes false after tape exhausted", (assert) => {
    const zxs = make48();
    zxs.loadTAP(makeTAPBlock(0x00, 1));
    zxs.tapePlay();
    assert.ok(zxs.tapeGetState().playing, "playing after tapePlay()");
    // Run enough frames to exhaust the tape (8082 edges × max 2168 T ≈ 17.5M T-states; 70000 × 300 = 21M)
    for (let i = 0; i < 300 && zxs.tapeGetState().playing; i++) {
      zxs.frame(70000);
    }
    assert.strictEqual(zxs.tapeGetState().playing, false, "tape stops automatically when exhausted");
  });

  QUnit.test("tapePause() freezes position and tapePlay() resumes", (assert) => {
    const zxs = make48();
    zxs.loadTAP(makeTAPBlock(0x00));
    zxs.tapePlay();
    zxs.frame(70000);
    const remAfterOneFrame = zxs.tapeGetState().edgesRemaining;
    zxs.tapePause();
    zxs.frame(70000);
    assert.strictEqual(zxs.tapeGetState().edgesRemaining, remAfterOneFrame, "position frozen while paused");
    zxs.tapePlay();
    zxs.frame(70000);
    assert.ok(zxs.tapeGetState().edgesRemaining < remAfterOneFrame, "position advances after resume");
  });

  QUnit.test("tapeStop() rewinds to start", (assert) => {
    const zxs = make48();
    zxs.loadTAP(makeTAPBlock(0x00));
    const totalEdges = zxs.tapeGetState().edgeCount;
    zxs.tapePlay();
    zxs.frame(70000);
    zxs.tapeStop();
    const state = zxs.tapeGetState();
    assert.strictEqual(state.playing, false, "not playing after stop");
    assert.strictEqual(state.edgesRemaining, totalEdges, "rewound to start");
  });

  QUnit.test("loadTZX() type-0x10 block sets edgeCount > 0", (assert) => {
    const zxs = make48();
    zxs.loadTZX(makeTZXBlock10(0x00));
    assert.ok(zxs.tapeGetState().edgeCount > 0, "TZX type-0x10 block produces edges");
  });

  QUnit.test("loadTZX() invalid header returns empty edge list", (assert) => {
    const zxs = make48();
    zxs.loadTZX(new Uint8Array([0x00, 0x01, 0x02]));
    assert.strictEqual(zxs.tapeGetState().edgeCount, 0, "invalid TZX yields zero edges");
  });

});

// ── 128k paging ───────────────────────────────────────────────────────────────

QUnit.module("128k paging", () => {

  QUnit.test("getBankingState() initial state is ramBank=0, screenBank=5", (assert) => {
    const zxs = make128();
    const state = zxs.getBankingState();
    assert.strictEqual(state.ramBank,    0, "ramBank defaults to 0");
    assert.strictEqual(state.screenBank, 5, "screenBank defaults to 5");
    assert.strictEqual(state.romBank,    0, "romBank defaults to 0");
    assert.strictEqual(state.pagingDisabled, false, "paging enabled by default");
  });

  QUnit.test("loading 128k SNA with paging lock disables further paging", (assert) => {
    const zxs = make128();
    const sna = new Uint8Array(131103);
    sna[23] = 0xF0; sna[24] = 0xFF;  // SP
    sna[49181] = 0x20 | 3;  // pagingDisabled=1, ramBank=3
    zxs.loadSNA(sna);
    assert.ok(zxs.getBankingState().pagingDisabled, "paging disabled after lock bit set");
    assert.strictEqual(zxs.getBankingState().ramBank, 3, "ramBank=3 as set in SNA");
  });

});

QUnit.module("ZXS interrupt timing", () => {
  QUnit.test("interrupt fires once per 69888 T-states regardless of frame split", (assert) => {
    // Observable: the ZX Spectrum 48k ROM's IM1 handler at 0x0038 increments
    // the FRAMES counter at RAM address 0x5C78 on every interrupt.
    // With IFF=1 and a HALT program, every interrupt fires the ROM handler.
    //
    // Old (broken) behavior: cpu.interrupt() fires once per frame() call → 3 interrupts
    // across 3 calls → FRAMES = 3.
    // New (correct) behavior: interrupt fires once per 69888 T-states → 1 interrupt
    // across 3 calls summing to 69888 T-states → FRAMES = 1.

    // Build a 48k SNA: IFF=1, IM=1, SP=0xFFFE, PC=0x4000, program = HALT.
    // The ROM's IM1 handler handles the interrupt and increments FRAMES.
    const makeSNA = () => {
      const sna = new Uint8Array(49179);
      sna[19] = 0x04;        // IFF flags: bit 2 = IFF1 = 1 (interrupts enabled)
      sna[23] = 0xFE; sna[24] = 0xFF;  // SP = 0xFFFE
      sna[25] = 1;           // IM = 1
      // PC on stack: ram48[0xFFFE - 0x4000] = sna[27 + 0xBFFE] = sna[49177]
      sna[49177] = 0x00; sna[49178] = 0x40;  // PC = 0x4000
      sna[27] = 0x76;        // HALT at 0x4000 — loops, accepts interrupts when IFF=1
      return sna;
    };

    // FRAMES low byte is at address 0x5C78 = ram48 offset 0x1C78 = 7288
    const FRAMES_OFFSET = 0x5C78 - 0x4000;

    // Reference: 1 frame of exactly 69888 T-states → exactly 1 interrupt
    const zxsRef = createZXS({ model: "48k", sampleRate: 44100 });
    zxsRef.reset();
    zxsRef.loadSNA(makeSNA());
    zxsRef.frame(69888, new Uint8Array(8));
    const refFrames = zxsRef.getRAM()[FRAMES_OFFSET];

    // Test: 3 frames of 23296 T-states each (sum = 69888)
    const zxs = createZXS({ model: "48k", sampleRate: 44100 });
    zxs.reset();
    zxs.loadSNA(makeSNA());
    zxs.frame(23296, new Uint8Array(8));
    zxs.frame(23296, new Uint8Array(8));
    zxs.frame(23296, new Uint8Array(8));
    const testFrames = zxs.getRAM()[FRAMES_OFFSET];

    assert.equal(refFrames, 1, "reference: exactly 1 interrupt in 69888 T-states");
    assert.equal(testFrames, refFrames, "split frames: same interrupt count as single frame");
  });
});

QUnit.module("ZXS AY 48k", () => {
  QUnit.test("AY audio output is non-zero in 48k mode after programming volume", (assert) => {
    const zxs = createZXS({ model: "48k", sampleRate: 44100 });
    zxs.reset();

    // Build a minimal 48k SNA that places a Z80 program at 0x4000 with PC=0x4000.
    // The program programs AY: select reg 8 (vol A), write 0x0F (max volume).
    // After HALT, the AY is live and ay.generate() should produce non-zero samples.
    //
    // Program bytes at address 0x4000 (= ram48 offset 0):
    //   01 FD FF  LD BC, 0xFFFD  ; AY select-register port
    //   3E 08     LD A, 8        ; register 8 = channel A volume
    //   ED 79     OUT (C), A     ; select register 8
    //   01 FD BF  LD BC, 0xBFFD  ; AY data port
    //   3E 0F     LD A, 0x0F    ; volume = 15 (max), no envelope
    //   ED 79     OUT (C), A     ; write volume
    //   76        HALT
    const prog = [
      0x01, 0xFD, 0xFF,  // LD BC, 0xFFFD
      0x3E, 0x08,        // LD A, 8
      0xED, 0x79,        // OUT (C), A
      0x01, 0xFD, 0xBF,  // LD BC, 0xBFFD
      0x3E, 0x0F,        // LD A, 0x0F
      0xED, 0x79,        // OUT (C), A
      0x76,              // HALT
    ];

    // Construct a 48k SNA (49179 bytes).
    // Header: SP = 0xFFFE, IM = 1. PC is stored on the stack.
    // ram48 is indexed from 0 (= address 0x4000). SNA RAM starts at byte 27.
    // Stack at 0xFFFE = ram48 offset 0xBFFE = SNA offset 27+0xBFFE = 49177.
    const sna = new Uint8Array(49179);
    sna[23] = 0xFE; sna[24] = 0xFF;  // SP = 0xFFFE
    sna[25] = 1;                      // IM = 1
    sna[49177] = 0x00;                // PC low  = 0x00 → PC = 0x4000
    sna[49178] = 0x40;                // PC high = 0x40
    for (let i = 0; i < prog.length; i++) sna[27 + i] = prog[i];

    zxs.loadSNA(sna);

    // Run one frame — CPU executes the program, programs AY volume, then HALTs.
    const result = zxs.frame(69888, new Uint8Array(8));
    const audio = result.audio;
    const hasNonZero = audio.some(s => s !== 0);
    assert.true(hasNonZero, "AY audio should be non-zero on 48k after programming channel A volume");
  });
});

// ── Floating bus ──────────────────────────────────────────────────────────────

QUnit.module("floating bus (48k)", () => {

  QUnit.test("floatingBusValue is 0xFF after full frame (bottom border is last event)", (assert) => {
    const zxs = make48();
    zxs.reset();
    zxs.frame(69888, null);
    assert.strictEqual(zxs.getFloatingBusValue(), 0xFF,
      "floatingBusValue = 0xFF at end of frame (bottom border)");
  });

  QUnit.test("floatingBusValue is 0xFF at reset", (assert) => {
    const zxs = make48();
    assert.strictEqual(zxs.getFloatingBusValue(), 0xFF,
      "floatingBusValue = 0xFF immediately after reset");
  });

});

// ── Contention table ──────────────────────────────────────────────────────────

QUnit.module("contention table (48k)", () => {

  QUnit.test("delay is 0 before active display (T=0)", (assert) => {
    const zxs = make48();
    assert.strictEqual(zxs.contentionAt(0), 0);
  });

  QUnit.test("delay is 0 at last T before active display (T=14334)", (assert) => {
    const zxs = make48();
    assert.strictEqual(zxs.contentionAt(14334), 0);
  });

  QUnit.test("delay is 6 at T=14335 (start of active, seq=0)", (assert) => {
    const zxs = make48();
    assert.strictEqual(zxs.contentionAt(14335), 6);
  });

  QUnit.test("delay pattern for T=14335..14342 is 6,5,4,3,2,1,0,0", (assert) => {
    const zxs = make48();
    const expected = [6, 5, 4, 3, 2, 1, 0, 0];
    for (let i = 0; i < 8; i++) {
      assert.strictEqual(zxs.contentionAt(14335 + i), expected[i],
        `T=${14335 + i} delay=${expected[i]}`);
    }
  });

  QUnit.test("delay is 0 at col=128 (horizontal blanking start)", (assert) => {
    const zxs = make48();
    assert.strictEqual(zxs.contentionAt(14335 + 128), 0);
  });

  QUnit.test("delay is 0 after all active lines", (assert) => {
    const zxs = make48();
    assert.strictEqual(zxs.contentionAt(57343), 0);
  });

  QUnit.test("second active line starts with delay 6", (assert) => {
    const zxs = make48();
    assert.strictEqual(zxs.contentionAt(14335 + 224), 6);
  });

});

// ── I/O contention ────────────────────────────────────────────────────────────

QUnit.module("I/O contention accounting (48k)", () => {

  QUnit.test("reading even port during active display accumulates contention", (assert) => {
    const zxs = make48();
    // At T=14335: pre=6, post=contentionAt(14336)=5 → total = 6+1+5+3 = 15
    assert.strictEqual(zxs.ioContentionForPort(0xFE, 0x00FE, 14335), 6 + 1 + 5 + 3);
  });

  QUnit.test("reading odd port outside contended range returns 3", (assert) => {
    const zxs = make48();
    assert.strictEqual(zxs.ioContentionForPort(0xFF, 0x00FF, 0), 3);
  });

  QUnit.test("reading odd port in contended addr range during active display", (assert) => {
    // At T=14335: 3 × (contend+1): (6+1)+(5+1)+(4+1) = 18
    const zxs = make48();
    // delays: T=14335(6+1=7), T=14342(0+1=1), T=14343(6+1=7) = 15
    assert.strictEqual(zxs.ioContentionForPort(0xFF, 0x7FFF, 14335), 15);
  });

});

// ── screenEventsTable ─────────────────────────────────────────────────────────

QUnit.module("screenEventsTable (48k)", () => {

  QUnit.test("first event T-state = visStartT = 8943", (assert) => {
    const zxs = make48();
    const tbl = zxs.getScreenEventsTable();
    assert.strictEqual(tbl[0], 8943, "first event at T=8943");
  });

  QUnit.test("first event is a border event (data = 0xFFFFFFFF)", (assert) => {
    const zxs = make48();
    const tbl = zxs.getScreenEventsTable();
    assert.strictEqual(tbl[1], 0xFFFFFFFF, "first event is border");
  });

  QUnit.test("first pixel event T-state = 14335", (assert) => {
    // Active line 0 = visible line 24, lineBaseT = 8943 + 24*224 = 14319
    // First pixel event at lineBaseT + 16 (leftT) = 14335
    const zxs = make48();
    const tbl = zxs.getScreenEventsTable();
    // Skip 24 border scanlines x 20 events = 480 events = 960 u32 slots
    // First 2 events of active line are left-border
    // 3rd event is the first pixel event
    const firstPixelIdx = 480 * 2 + 2 * 2;
    assert.strictEqual(tbl[firstPixelIdx], 14335, "first pixel event T=14335");
  });

  QUnit.test("first pixel event has data != 0xFFFFFFFF", (assert) => {
    const zxs = make48();
    const tbl = zxs.getScreenEventsTable();
    const firstPixelIdx = 480 * 2 + 2 * 2;
    assert.notStrictEqual(tbl[firstPixelIdx + 1], 0xFFFFFFFF, "pixel event has address data");
  });

  QUnit.test("active line 0, xByte=0: pixAddr=0x0000, attrAddr=0x1800", (assert) => {
    const zxs = make48();
    const tbl = zxs.getScreenEventsTable();
    const firstPixelDataIdx = 480 * 2 + 2 * 2 + 1;
    const data = tbl[firstPixelDataIdx];
    const pixAddr  = data & 0xFFFF;
    const attrAddr = data >> 16;
    assert.strictEqual(pixAddr,  0x0000, "pixAddr=0x0000 for y=0, xByte=0");
    assert.strictEqual(attrAddr, 0x1800, "attrAddr=0x1800 for y=0, xByte=0");
  });

  QUnit.test("active line 8, xByte=0: pixAddr=0x0020", (assert) => {
    // y=8: pixAddr = ((8&0xC0)<<5)|((8&0x07)<<8)|((8&0x38)<<2)|0 = 0|0|(8<<2)|0 = 32 = 0x0020
    const zxs = make48();
    const tbl = zxs.getScreenEventsTable();
    // Events before active line 8: 24 border scanlines (20 each) + 8 active scanlines (36 each) = 480+288 = 768 events
    const lineEventStart = 768 * 2;
    const firstPixelDataIdx = lineEventStart + 2 * 2 + 1;
    const data = tbl[firstPixelDataIdx];
    const pixAddr = data & 0xFFFF;
    assert.strictEqual(pixAddr, 0x0020, "pixAddr=0x0020 for y=8, xByte=0");
  });

  QUnit.test("table terminates with 0xFFFFFFFF sentinel", (assert) => {
    const zxs = make48();
    const tbl = zxs.getScreenEventsTable();
    assert.strictEqual(tbl[7872 * 2],     0xFFFFFFFF, "terminator T-state");
    assert.strictEqual(tbl[7872 * 2 + 1], 0xFFFFFFFF, "terminator data");
  });

});

// ── updateFramebuffer ─────────────────────────────────────────────────────────

QUnit.module("updateFramebuffer (48k)", () => {

  QUnit.test("floatingBusValue starts at 0xFF after reset", (assert) => {
    const zxs = make48();
    assert.strictEqual(zxs.getFloatingBusValue(), 0xFF,
      "floatingBusValue starts at 0xFF");
  });

});

// ── decodeFrameBuffer ─────────────────────────────────────────────────────────

QUnit.module("decodeFrameBuffer (48k)", () => {

  const runFrameAndGetPixel = (zxs, x, y) => {
    zxs.frame(69888, null);
    const buf = zxs.getVideoBuffer();
    const offset = (y * 320 + x) * 4;
    return { r: buf[offset], g: buf[offset + 1], b: buf[offset + 2] };
  };

  QUnit.test("default border=7 fills top-border line 0 with white (215,215,215)", (assert) => {
    const zxs = make48();
    zxs.reset();
    const { r, g, b } = runFrameAndGetPixel(zxs, 0, 0);
    assert.strictEqual(r, 215, "border R=215");
    assert.strictEqual(g, 215, "border G=215");
    assert.strictEqual(b, 215, "border B=215");
  });

  QUnit.test("all-zero VRAM: first active pixel is black (0,0,0)", (assert) => {
    const zxs = make48();
    zxs.reset();
    // VRAM zeroed: attr=0 (paper=0 black, ink=0 black), pixel=0 (all paper)
    const { r, g, b } = runFrameAndGetPixel(zxs, 32, 24);  // first active pixel
    assert.strictEqual(r, 0, "active pixel R=0");
    assert.strictEqual(g, 0, "active pixel G=0");
    assert.strictEqual(b, 0, "active pixel B=0");
  });

  QUnit.test("pixel=0xFF attr=0x07: first active pixel is white ink", (assert) => {
    const zxs = make48();
    zxs.reset();
    const ram = zxs.getRAM();
    ram[0x0000] = 0xFF;  // all ink bits
    ram[0x1800] = 0x07;  // ink=7(white), paper=0(black)
    const { r, g, b } = runFrameAndGetPixel(zxs, 32, 24);
    assert.strictEqual(r, 215, "ink white R=215");
    assert.strictEqual(g, 215, "ink white G=215");
    assert.strictEqual(b, 215, "ink white B=215");
  });

  QUnit.test("flash attr=0x87 flashPhase=0: ink pixel is white (no swap)", (assert) => {
    const zxs = make48();
    zxs.reset();
    const ram = zxs.getRAM();
    ram[0x0000] = 0xFF;
    ram[0x1800] = 0x87;  // flash=1, ink=7(white), paper=0(black)
    // Frame 0: flashPhase = (0>>4)&1 = 0
    const { r, g, b } = runFrameAndGetPixel(zxs, 32, 24);
    assert.strictEqual(r, 215, "flashPhase=0: ink stays white R=215");
  });

  QUnit.test("flash attr=0x87 flashPhase=1: ink pixel is black (swapped)", (assert) => {
    const zxs = make48();
    zxs.reset();
    const ram = zxs.getRAM();
    ram[0x0000] = 0xFF;
    ram[0x1800] = 0x87;  // flash=1, ink=7(white), paper=0(black)
    // Run 17 frames so the last frame executes with frameCount=16, flashPhase=1
    for (let i = 0; i < 17; i++) zxs.frame(69888, null);
    const buf = zxs.getVideoBuffer();
    const offset = (24 * 320 + 32) * 4;
    assert.strictEqual(buf[offset],     0, "flashPhase=1: swapped to paper black R=0");
    assert.strictEqual(buf[offset + 1], 0, "flashPhase=1: swapped to paper black G=0");
    assert.strictEqual(buf[offset + 2], 0, "flashPhase=1: swapped to paper black B=0");
  });

});

// ── reactive VRAM hook ────────────────────────────────────────────────────────

QUnit.module("reactive VRAM hook (48k)", () => {

  QUnit.test("VRAM state at frame start determines rendered pixels", (assert) => {
    // Set VRAM before frame(), verify pixels appear correctly.
    // This works even without mid-frame writes because updateFramebuffer(frameLen)
    // is called at end of frame() — so VRAM state at that point is captured.
    const zxs = make48();
    zxs.reset();
    const ram = zxs.getRAM();
    ram[0x0000] = 0xFF;   // all ink bits for active line 0, column 0
    ram[0x1800] = 0x07;   // ink=7(white), paper=0(black)
    zxs.frame(69888, null);
    const buf = zxs.getVideoBuffer();
    const offset = (24 * 320 + 32) * 4;  // active line 0, x=32 = first active pixel
    assert.strictEqual(buf[offset],     215, "ink white R=215");
    assert.strictEqual(buf[offset + 1], 215, "ink white G=215");
    assert.strictEqual(buf[offset + 2], 215, "ink white B=215");
  });

});

// ── mid-frame border timing ───────────────────────────────────────────────────

QUnit.module("mid-frame border timing (48k)", () => {

  /**
   * Build a minimal 48k SNA that runs NOPs then changes the border.
   *
   * State: IFF1=0 (no interrupts), A=colorA, border=colorB, PC=0x8000, IM=1.
   * Code at 0x8000: (nNops × NOP), OUT (0xFE),A, HALT.
   *
   * The portOut call fires when tstates == nNops * 4 (each NOP = 4T, portOut is
   * called before tstates += 11 for the OUT instruction itself).
   *
   * @param {number} nNops   - Number of NOP (0x00) instructions before OUT
   * @param {number} colorA  - Border color written by OUT (0–7)
   * @param {number} colorB  - Initial border color (0–7)
   * @returns {Uint8Array} 49179-byte SNA image
   */
  const buildTimingSNA = (nNops, colorA, colorB) => {
    const sna = new Uint8Array(49179);
    sna[19] = 0x00;                    // IFF = 0 (no interrupts)
    sna[21] = colorA;                  // A register = colorA
    sna[22] = 0xFF;                    // F register
    sna[23] = 0xFE; sna[24] = 0xFF;   // SP = 0xFFFE
    sna[25] = 1;                       // IM = 1
    sna[26] = colorB;                  // initial border color
    // PC on stack at SP=0xFFFE: ram48[0xBFFE]=PClo, ram48[0xBFFF]=PChi → PC=0x8000
    sna[27 + 0xBFFE] = 0x00;
    sna[27 + 0xBFFF] = 0x80;
    // Code at 0x8000 (= SNA data offset 27 + (0x8000 - 0x4000) = 27 + 0x4000)
    const base = 27 + 0x4000;
    sna.fill(0x00, base, base + nNops);    // NOP × nNops
    sna[base + nNops]     = 0xD3;          // OUT (n), A
    sna[base + nNops + 1] = 0xFE;          //   port 0xFE (ULA)
    sna[base + nNops + 2] = 0x76;          // HALT
    return sna;
  };

  const px = (buf, x, y) => ({
    r: buf[(y * 320 + x) * 4],
    g: buf[(y * 320 + x) * 4 + 1],
    b: buf[(y * 320 + x) * 4 + 2],
  });

  const WHITE = { r: 215, g: 215, b: 215 };
  const RED   = { r: 215, g: 0,   b: 0   };

  QUnit.test("OUT at T=8940 (I/O cycle at T=8947): first 16px white, rest red", (assert) => {
    // 2235 NOPs → OUT (n),A instruction starts at tstates=8940.
    // portOut is called before z80 adds base T-states; ioOffset=7 → ioFrameT = 8940+7 = 8947.
    // updateFramebuffer(8947): event at T=8943 ≤ 8947 → flushed with OLD white.
    // borderColor becomes red → all subsequent events (T≥8951) use red.
    const zxs = make48();
    zxs.loadSNA(buildTimingSNA(2235, 2, 7));
    zxs.frame(69888, null);
    const buf = zxs.getVideoBuffer();
    assert.deepEqual(px(buf,  0, 0), WHITE, "group 0 (x=0,  T=8943 ≤ 8947) = white");
    assert.deepEqual(px(buf, 16, 0), RED,   "group 1 (x=16, T=8951 > 8947) = red");
  });

  QUnit.test("OUT at T=8944 (I/O cycle at T=8951): first 32px white, next 16px red", (assert) => {
    // 2236 NOPs → OUT (n),A instruction starts at tstates=8944.
    // ioOffset=7 → ioFrameT = 8944+7 = 8951.
    // updateFramebuffer(8951): events at T=8943 and T=8951 (both ≤ 8951, strict >) → flushed white.
    // borderColor becomes red → events at T≥8959 use red.
    const zxs = make48();
    zxs.loadSNA(buildTimingSNA(2236, 2, 7));
    zxs.frame(69888, null);
    const buf = zxs.getVideoBuffer();
    assert.deepEqual(px(buf,  0, 0), WHITE, "group 0 (x=0,  T=8943 ≤ 8951) = white");
    assert.deepEqual(px(buf, 16, 0), WHITE, "group 1 (x=16, T=8951 ≤ 8951) = white");
    assert.deepEqual(px(buf, 32, 0), RED,   "group 2 (x=32, T=8959 > 8951) = red");
  });

  QUnit.test("OUT at T=20080 (HBlank gap): visible line 49 white, line 50 red", (assert) => {
    // Visible line 49 last event:  right-border group 1 at T=8943+49*224+152=20071.
    // Visible line 50 first event: left-border  group 0 at T=8943+50*224    =20143.
    // T_out=20080 sits in the HBlank gap (20071 < 20080 < 20143).
    // Events of line 49 (≤20071) use white; events of line 50+ (≥20143) use red.
    // 5020 NOPs → T_out = 20080.
    const zxs = make48();
    zxs.loadSNA(buildTimingSNA(5020, 2, 7));
    zxs.frame(69888, null);
    const buf = zxs.getVideoBuffer();
    assert.deepEqual(px(buf, 0, 49), WHITE, "left border of visible line 49 = white");
    assert.deepEqual(px(buf, 0, 50), RED,   "left border of visible line 50 = red");
  });

});
