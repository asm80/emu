/**
 * Z80 Prefix Instruction Tests
 *
 * Tests CB, ED, DD, and FD prefix handlers
 */

import QUnit from "qunit";
import z80 from "../src/z80.js";

const { module: describe, test } = QUnit;

describe("Z80 - CB Prefix (Bit Operations)", (hooks) => {
  let cpu;
  let memory;

  hooks.beforeEach(() => {
    memory = new Uint8Array(65536);
    cpu = z80({
      byteAt: (addr) => memory[addr & 0xFFFF],
      byteTo: (addr, value) => { memory[addr & 0xFFFF] = value & 0xFF; }
    });
  });

  test("RLC B - Rotate left circular", (assert) => {
    cpu.set("B", 0x88);
    memory[0] = 0xCB;  // CB prefix
    memory[1] = 0x00;  // RLC B
    cpu.step();
    const status = cpu.status();
    assert.equal(status.b, 0x11, "B rotated left: 0x88 -> 0x11");
    assert.equal(status.f & 0x01, 0x01, "Carry flag set (bit 7 was 1)");
  });

  test("RRC C - Rotate right circular", (assert) => {
    cpu.set("C", 0x11);
    memory[0] = 0xCB;  // CB prefix
    memory[1] = 0x09;  // RRC C
    cpu.step();
    const status = cpu.status();
    assert.equal(status.c, 0x88, "C rotated right: 0x11 -> 0x88");
    assert.equal(status.f & 0x01, 0x01, "Carry flag set (bit 0 was 1)");
  });

  test("RL D - Rotate left through carry", (assert) => {
    cpu.set("D", 0x80);
    cpu.set("F", 0x01); // Set carry
    memory[0] = 0xCB;
    memory[1] = 0x12;  // RL D
    cpu.step();
    const status = cpu.status();
    assert.equal(status.d, 0x01, "D rotated left with carry");
    assert.equal(status.f & 0x01, 0x01, "Carry flag set from bit 7");
  });

  test("RR E - Rotate right through carry", (assert) => {
    cpu.set("E", 0x01);
    cpu.set("F", 0x01); // Set carry
    memory[0] = 0xCB;
    memory[1] = 0x1B;  // RR E
    cpu.step();
    const status = cpu.status();
    assert.equal(status.e, 0x80, "E rotated right with carry");
    assert.equal(status.f & 0x01, 0x01, "Carry flag set from bit 0");
  });

  test("SLA H - Shift left arithmetic", (assert) => {
    cpu.set("H", 0x42);
    memory[0] = 0xCB;
    memory[1] = 0x24;  // SLA H
    cpu.step();
    const status = cpu.status();
    assert.equal(status.h, 0x84, "H shifted left: 0x42 -> 0x84");
  });

  test("SRA L - Shift right arithmetic", (assert) => {
    cpu.set("L", 0x84);
    memory[0] = 0xCB;
    memory[1] = 0x2D;  // SRA L
    cpu.step();
    const status = cpu.status();
    assert.equal(status.l, 0xC2, "L shifted right preserving sign bit");
  });

  test("SRL A - Shift right logical", (assert) => {
    cpu.set("A", 0x84);
    memory[0] = 0xCB;
    memory[1] = 0x3F;  // SRL A
    cpu.step();
    const status = cpu.status();
    assert.equal(status.a, 0x42, "A shifted right: 0x84 -> 0x42");
  });

  test("BIT 7,A - Test bit", (assert) => {
    cpu.set("A", 0x80);
    memory[0] = 0xCB;
    memory[1] = 0x7F;  // BIT 7,A
    cpu.step();
    const status = cpu.status();
    assert.equal(status.a, 0x80, "A unchanged");
    assert.equal(status.f & 0x40, 0x00, "Zero flag clear (bit is set)");
    assert.equal(status.f & 0x10, 0x10, "Half-carry flag set");
  });

  test("BIT 0,B - Test bit zero", (assert) => {
    cpu.set("B", 0x00);
    memory[0] = 0xCB;
    memory[1] = 0x40;  // BIT 0,B
    cpu.step();
    const status = cpu.status();
    assert.equal(status.f & 0x40, 0x40, "Zero flag set (bit is clear)");
    assert.equal(status.f & 0x04, 0x04, "Parity flag set");
  });

  test("SET 5,C - Set bit", (assert) => {
    cpu.set("C", 0x00);
    memory[0] = 0xCB;
    memory[1] = 0xE9;  // SET 5,C
    cpu.step();
    const status = cpu.status();
    assert.equal(status.c, 0x20, "Bit 5 set in C");
  });

  test("RES 3,D - Reset bit", (assert) => {
    cpu.set("D", 0xFF);
    memory[0] = 0xCB;
    memory[1] = 0x9A;  // RES 3,D
    cpu.step();
    const status = cpu.status();
    assert.equal(status.d, 0xF7, "Bit 3 cleared in D");
  });

  test("RLC (HL) - Rotate memory", (assert) => {
    cpu.set("HL", 0x1000);
    memory[0x1000] = 0x88;
    memory[0] = 0xCB;
    memory[1] = 0x06;  // RLC (HL)
    cpu.step();
    assert.equal(memory[0x1000], 0x11, "Memory rotated left");
  });
});

describe("Z80 - ED Prefix (Extended Instructions)", (hooks) => {
  let cpu;
  let memory;

  hooks.beforeEach(() => {
    memory = new Uint8Array(65536);
    cpu = z80({
      byteAt: (addr) => memory[addr & 0xFFFF],
      byteTo: (addr, value) => { memory[addr & 0xFFFF] = value & 0xFF; }
    });
  });

  test("LDI - Load and increment", (assert) => {
    cpu.set("HL", 0x1000);
    cpu.set("DE", 0x2000);
    cpu.set("BC", 0x0003);
    memory[0x1000] = 0x42;
    memory[0] = 0xED;
    memory[1] = 0xA0;  // LDI
    cpu.step();
    const status = cpu.status();
    assert.equal(memory[0x2000], 0x42, "Byte copied from (HL) to (DE)");
    assert.equal(status.hl, 0x1001, "HL incremented");
    assert.equal(status.de, 0x2001, "DE incremented");
    assert.equal(status.bc, 0x0002, "BC decremented");
  });

  test("LDIR - Load, increment and repeat", (assert) => {
    cpu.set("HL", 0x1000);
    cpu.set("DE", 0x2000);
    cpu.set("BC", 0x0003);
    memory[0x1000] = 0x11;
    memory[0x1001] = 0x22;
    memory[0x1002] = 0x33;
    memory[0] = 0xED;
    memory[1] = 0xB0;  // LDIR

    // Execute until BC reaches 0
    let maxIterations = 100;
    while (cpu.status().bc !== 0 && maxIterations-- > 0) {
      cpu.step();
    }

    assert.equal(memory[0x2000], 0x11, "First byte copied");
    assert.equal(memory[0x2001], 0x22, "Second byte copied");
    assert.equal(memory[0x2002], 0x33, "Third byte copied");
    assert.equal(cpu.status().bc, 0, "BC reached zero");
  });

  test("CPI - Compare and increment", (assert) => {
    cpu.set("HL", 0x1000);
    cpu.set("BC", 0x0005);
    cpu.set("A", 0x42);
    memory[0x1000] = 0x42;
    memory[0] = 0xED;
    memory[1] = 0xA1;  // CPI
    cpu.step();
    const status = cpu.status();
    assert.equal(status.hl, 0x1001, "HL incremented");
    assert.equal(status.bc, 0x0004, "BC decremented");
    assert.equal(status.f & 0x40, 0x40, "Zero flag set (match)");
  });

  test("NEG - Negate accumulator", (assert) => {
    cpu.set("A", 0x10);
    memory[0] = 0xED;
    memory[1] = 0x44;  // NEG
    cpu.step();
    const status = cpu.status();
    assert.equal(status.a, 0xF0, "A negated (two's complement)");
    assert.equal(status.f & 0x02, 0x02, "Subtract flag set");
  });

  test("IM 1 - Set interrupt mode", (assert) => {
    memory[0] = 0xED;
    memory[1] = 0x56;  // IM 1
    cpu.step();
    const status = cpu.status();
    assert.equal(status.im, 1, "Interrupt mode set to 1");
  });

  test("RETN - Return from NMI", (assert) => {
    cpu.set("SP", 0xFFFE);
    cpu.set("IFF2", 1);
    memory[0xFFFE] = 0x34;
    memory[0xFFFF] = 0x12;
    memory[0] = 0xED;
    memory[1] = 0x45;  // RETN
    cpu.step();
    const status = cpu.status();
    assert.equal(status.pc, 0x1234, "PC loaded from stack");
    assert.equal(status.iff1, 1, "IFF1 copied from IFF2");
  });

  test("ADC HL,BC - 16-bit add with carry", (assert) => {
    cpu.set("HL", 0x1000);
    cpu.set("BC", 0x0234);
    cpu.set("F", 0x01); // Set carry
    memory[0] = 0xED;
    memory[1] = 0x4A;  // ADC HL,BC
    cpu.step();
    const status = cpu.status();
    assert.equal(status.hl, 0x1235, "HL = HL + BC + carry");
  });

  test("SBC HL,DE - 16-bit subtract with carry", (assert) => {
    cpu.set("HL", 0x1000);
    cpu.set("DE", 0x0234);
    cpu.set("F", 0x01); // Set carry
    memory[0] = 0xED;
    memory[1] = 0x52;  // SBC HL,DE
    cpu.step();
    const status = cpu.status();
    assert.equal(status.hl, 0x0DCB, "HL = HL - DE - carry");
  });

  test("RRD - Rotate right decimal", (assert) => {
    cpu.set("A", 0x84);
    cpu.set("HL", 0x1000);
    memory[0x1000] = 0x20;
    memory[0] = 0xED;
    memory[1] = 0x67;  // RRD
    cpu.step();
    const status = cpu.status();
    assert.equal(status.a, 0x80, "A high nibble preserved, low from (HL) low");
    assert.equal(memory[0x1000], 0x42, "Memory rotated");
  });

  test("RLD - Rotate left decimal", (assert) => {
    cpu.set("A", 0x7A);
    cpu.set("HL", 0x1000);
    memory[0x1000] = 0x31;
    memory[0] = 0xED;
    memory[1] = 0x6F;  // RLD
    cpu.step();
    const status = cpu.status();
    assert.equal(status.a, 0x73, "A = A high + (HL) high");
    assert.equal(memory[0x1000], 0x1A, "Memory rotated");
  });

  test("LD (nn),BC - Store 16-bit register", (assert) => {
    cpu.set("BC", 0x1234);
    memory[0] = 0xED;
    memory[1] = 0x43;  // LD (nn),BC
    memory[2] = 0x00;
    memory[3] = 0x20;
    cpu.step();
    assert.equal(memory[0x2000], 0x34, "Low byte stored");
    assert.equal(memory[0x2001], 0x12, "High byte stored");
  });

  test("LD BC,(nn) - Load 16-bit register", (assert) => {
    memory[0x2000] = 0x56;
    memory[0x2001] = 0x78;
    memory[0] = 0xED;
    memory[1] = 0x4B;  // LD BC,(nn)
    memory[2] = 0x00;
    memory[3] = 0x20;
    cpu.step();
    const status = cpu.status();
    assert.equal(status.bc, 0x7856, "BC loaded from memory");
  });
});

describe("Z80 - DD Prefix (IX Operations)", (hooks) => {
  let cpu;
  let memory;

  hooks.beforeEach(() => {
    memory = new Uint8Array(65536);
    cpu = z80({
      byteAt: (addr) => memory[addr & 0xFFFF],
      byteTo: (addr, value) => { memory[addr & 0xFFFF] = value & 0xFF; }
    });
  });

  test("LD IX,nn - Load IX immediate", (assert) => {
    memory[0] = 0xDD;
    memory[1] = 0x21;  // LD IX,nn
    memory[2] = 0x34;
    memory[3] = 0x12;
    cpu.step();
    const status = cpu.status();
    assert.equal(status.ix, 0x1234, "IX loaded with immediate value");
  });

  test("INC IX - Increment IX", (assert) => {
    cpu.set("IX", 0x1000);
    memory[0] = 0xDD;
    memory[1] = 0x23;  // INC IX
    cpu.step();
    const status = cpu.status();
    assert.equal(status.ix, 0x1001, "IX incremented");
  });

  test("LD (IX+d),n - Store to indexed address", (assert) => {
    cpu.set("IX", 0x1000);
    memory[0] = 0xDD;
    memory[1] = 0x36;  // LD (IX+d),n
    memory[2] = 0x05;  // offset
    memory[3] = 0x42;  // value
    cpu.step();
    assert.equal(memory[0x1005], 0x42, "Value stored at IX+5");
  });

  test("LD A,(IX+d) - Load from indexed address", (assert) => {
    cpu.set("IX", 0x1000);
    memory[0x1005] = 0x99;
    memory[0] = 0xDD;
    memory[1] = 0x7E;  // LD A,(IX+d)
    memory[2] = 0x05;  // offset
    cpu.step();
    const status = cpu.status();
    assert.equal(status.a, 0x99, "A loaded from IX+5");
  });

  test("INC (IX+d) - Increment indexed memory", (assert) => {
    cpu.set("IX", 0x1000);
    memory[0x1003] = 0x42;
    memory[0] = 0xDD;
    memory[1] = 0x34;  // INC (IX+d)
    memory[2] = 0x03;  // offset
    cpu.step();
    assert.equal(memory[0x1003], 0x43, "Memory at IX+3 incremented");
  });

  test("ADD A,(IX+d) - Add indexed memory to A", (assert) => {
    cpu.set("IX", 0x1000);
    cpu.set("A", 0x10);
    memory[0x1002] = 0x20;
    memory[0] = 0xDD;
    memory[1] = 0x86;  // ADD A,(IX+d)
    memory[2] = 0x02;  // offset
    cpu.step();
    const status = cpu.status();
    assert.equal(status.a, 0x30, "A = A + (IX+2)");
  });

  test("ADD IX,BC - 16-bit addition", (assert) => {
    cpu.set("IX", 0x1000);
    cpu.set("BC", 0x0234);
    memory[0] = 0xDD;
    memory[1] = 0x09;  // ADD IX,BC
    cpu.step();
    const status = cpu.status();
    assert.equal(status.ix, 0x1234, "IX = IX + BC");
  });

  test("Negative offset - LD B,(IX-5)", (assert) => {
    cpu.set("IX", 0x1000);
    memory[0x0FFB] = 0x77;  // IX + (-5) = 0x1000 - 5
    memory[0] = 0xDD;
    memory[1] = 0x46;  // LD B,(IX+d)
    memory[2] = 0xFB;  // -5 in two's complement
    cpu.step();
    const status = cpu.status();
    assert.equal(status.b, 0x77, "B loaded from IX-5");
  });
});

describe("Z80 - FD Prefix (IY Operations)", (hooks) => {
  let cpu;
  let memory;

  hooks.beforeEach(() => {
    memory = new Uint8Array(65536);
    cpu = z80({
      byteAt: (addr) => memory[addr & 0xFFFF],
      byteTo: (addr, value) => { memory[addr & 0xFFFF] = value & 0xFF; }
    });
  });

  test("LD IY,nn - Load IY immediate", (assert) => {
    memory[0] = 0xFD;
    memory[1] = 0x21;  // LD IY,nn
    memory[2] = 0x56;
    memory[3] = 0x78;
    cpu.step();
    const status = cpu.status();
    assert.equal(status.iy, 0x7856, "IY loaded with immediate value");
  });

  test("LD (IY+d),n - Store to IY-indexed address", (assert) => {
    cpu.set("IY", 0x2000);
    memory[0] = 0xFD;
    memory[1] = 0x36;  // LD (IY+d),n
    memory[2] = 0x10;  // offset
    memory[3] = 0xAA;  // value
    cpu.step();
    assert.equal(memory[0x2010], 0xAA, "Value stored at IY+16");
  });

  test("ADD IY,DE - 16-bit addition with IY", (assert) => {
    cpu.set("IY", 0x3000);
    cpu.set("DE", 0x0456);
    memory[0] = 0xFD;
    memory[1] = 0x19;  // ADD IY,DE
    cpu.step();
    const status = cpu.status();
    assert.equal(status.iy, 0x3456, "IY = IY + DE");
  });
});

describe("Z80 - DDCB/FDCB Prefixes (Indexed Bit Operations)", (hooks) => {
  let cpu;
  let memory;

  hooks.beforeEach(() => {
    memory = new Uint8Array(65536);
    cpu = z80({
      byteAt: (addr) => memory[addr & 0xFFFF],
      byteTo: (addr, value) => { memory[addr & 0xFFFF] = value & 0xFF; }
    });
  });

  test("RLC (IX+d) - Rotate indexed memory", (assert) => {
    cpu.set("IX", 0x1000);
    memory[0x1005] = 0x88;
    memory[0] = 0xDD;
    memory[1] = 0xCB;
    memory[2] = 0x05;  // offset
    memory[3] = 0x06;  // RLC (HL) -> RLC (IX+d)
    cpu.step();
    assert.equal(memory[0x1005], 0x11, "Memory at IX+5 rotated left");
  });

  test("BIT 3,(IX+d) - Test bit in indexed memory", (assert) => {
    cpu.set("IX", 0x1000);
    memory[0x1002] = 0x08;  // Only bit 3 set
    memory[0] = 0xDD;
    memory[1] = 0xCB;
    memory[2] = 0x02;  // offset
    memory[3] = 0x5E;  // BIT 3,(HL) -> BIT 3,(IX+d)
    cpu.step();
    const status = cpu.status();
    assert.equal(status.f & 0x40, 0x00, "Zero flag clear (bit 3 is set)");
  });

  test("SET 5,(IY+d) - Set bit in IY-indexed memory", (assert) => {
    cpu.set("IY", 0x2000);
    memory[0x2003] = 0x00;
    memory[0] = 0xFD;
    memory[1] = 0xCB;
    memory[2] = 0x03;  // offset
    memory[3] = 0xEE;  // SET 5,(HL) -> SET 5,(IY+d)
    cpu.step();
    assert.equal(memory[0x2003], 0x20, "Bit 5 set at IY+3");
  });

  test("RES 7,(IX+d) - Reset bit in indexed memory", (assert) => {
    cpu.set("IX", 0x1000);
    memory[0x1001] = 0xFF;
    memory[0] = 0xDD;
    memory[1] = 0xCB;
    memory[2] = 0x01;  // offset
    memory[3] = 0xBE;  // RES 7,(HL) -> RES 7,(IX+d)
    cpu.step();
    assert.equal(memory[0x1001], 0x7F, "Bit 7 cleared at IX+1");
  });
});
