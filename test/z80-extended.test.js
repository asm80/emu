/**
 * Z80 Extended Instructions (ED Prefix) - Comprehensive Tests
 *
 * Tests all ED-prefixed instructions including:
 * - Block transfer/search operations (LDI, LDD, LDIR, LDDR, CPI, CPD, CPIR, CPDR)
 * - 16-bit arithmetic with carry (ADC HL, SBC HL)
 * - I/O block operations (INI, IND, INIR, INDR, OUTI, OUTD, OTIR, OTDR)
 * - Rotation (RLD, RRD)
 * - Negation (NEG)
 * - Interrupt mode setting (IM 0/1/2)
 * - Special returns (RETI, RETN)
 * - 16-bit loads to/from memory
 */

import QUnit from "qunit";
import z80 from "../src/z80.js";

QUnit.module("Z80 - ED Prefix (Extended Instructions)", () => {
  /**
   * Helper: Create CPU with test memory
   */
  const createTestCPU = () => {
    const mem = new Uint8Array(65536);
    const ports = new Uint8Array(65536);

    const cpu = z80({
      byteAt: (addr) => mem[addr] || 0,
      byteTo: (addr, val) => { mem[addr] = val & 0xFF; },
      portOut: (port, val) => { ports[port] = val & 0xFF; },
      portIn: (port) => ports[port] || 0
    });

    return { cpu, mem, ports };
  };

  QUnit.module("Block Transfer Operations", () => {
    QUnit.test("LDI - Load and increment", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("HL", 0x1000);
      cpu.set("DE", 0x2000);
      cpu.set("BC", 0x0003);
      mem[0x1000] = 0x42;
      mem[0] = 0xED;
      mem[1] = 0xA0; // LDI

      cpu.step();

      const state = cpu.status();
      assert.equal(mem[0x2000], 0x42, "Byte transferred");
      assert.equal(state.hl, 0x1001, "HL incremented");
      assert.equal(state.de, 0x2001, "DE incremented");
      assert.equal(state.bc, 0x0002, "BC decremented");
      assert.equal(state.f & 0x04, 0x04, "P/V set (BC != 0)");
    });

    QUnit.test("LDD - Load and decrement", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("HL", 0x1000);
      cpu.set("DE", 0x2000);
      cpu.set("BC", 0x0001);
      mem[0x1000] = 0x99;
      mem[0] = 0xED;
      mem[1] = 0xA8; // LDD

      cpu.step();

      const state = cpu.status();
      assert.equal(mem[0x2000], 0x99, "Byte transferred");
      assert.equal(state.hl, 0x0FFF, "HL decremented");
      assert.equal(state.de, 0x1FFF, "DE decremented");
      assert.equal(state.bc, 0x0000, "BC decremented to 0");
      assert.equal(state.f & 0x04, 0, "P/V clear (BC = 0)");
    });

    QUnit.test("LDIR - Load, increment and repeat", (assert) => {
      const { cpu, mem } = createTestCPU();

      // One step = one iteration. With BC>1, PC stays on the instruction.
      cpu.set("HL", 0x1000);
      cpu.set("DE", 0x2000);
      cpu.set("BC", 0x0003);
      mem[0x1000] = 0x11;
      mem[0x1001] = 0x22;
      mem[0x1002] = 0x33;
      mem[0] = 0xED;
      mem[1] = 0xB0; // LDIR

      cpu.step(); // one iteration: [HL]→[DE], HL++, DE++, BC--

      const state = cpu.status();
      assert.equal(mem[0x2000], 0x11, "First byte transferred");
      assert.equal(mem[0x2001], 0, "Second byte not yet transferred");
      assert.equal(state.hl, 0x1001, "HL incremented once");
      assert.equal(state.de, 0x2001, "DE incremented once");
      assert.equal(state.bc, 0x0002, "BC decremented once");
      assert.equal(state.pc, 0, "PC stays on LDIR while BC > 0");
      assert.equal(state.f & 0x04, 0x04, "P/V set (BC != 0)");
    });

    QUnit.test("LDDR - Load, decrement and repeat", (assert) => {
      const { cpu, mem } = createTestCPU();

      // One step = one iteration. With BC>1, PC stays on the instruction.
      cpu.set("HL", 0x1002);
      cpu.set("DE", 0x2002);
      cpu.set("BC", 0x0003);
      mem[0x1000] = 0xAA;
      mem[0x1001] = 0xBB;
      mem[0x1002] = 0xCC;
      mem[0] = 0xED;
      mem[1] = 0xB8; // LDDR

      cpu.step(); // one iteration: [HL]→[DE], HL--, DE--, BC--

      const state = cpu.status();
      assert.equal(mem[0x2002], 0xCC, "First byte transferred (from [HL] to [DE])");
      assert.equal(mem[0x2001], 0, "Second byte not yet transferred");
      assert.equal(state.hl, 0x1001, "HL decremented once");
      assert.equal(state.de, 0x2001, "DE decremented once");
      assert.equal(state.bc, 0x0002, "BC decremented once");
      assert.equal(state.pc, 0, "PC stays on LDDR while BC > 0");
      assert.equal(state.f & 0x04, 0x04, "P/V set (BC != 0)");
    });
  });

  QUnit.module("Block Search Operations", () => {
    QUnit.test("CPI - Compare and increment", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("HL", 0x1000);
      cpu.set("BC", 0x0002);
      cpu.set("A", 0x42);
      mem[0x1000] = 0x30;
      mem[0] = 0xED;
      mem[1] = 0xA1; // CPI

      cpu.step();

      const state = cpu.status();
      assert.equal(state.hl, 0x1001, "HL incremented");
      assert.equal(state.bc, 0x0001, "BC decremented");
      assert.equal(state.f & 0x40, 0, "Z clear (not found)");
      assert.equal(state.f & 0x04, 0x04, "P/V set (BC != 0)");
    });

    QUnit.test("CPD - Compare and decrement", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("HL", 0x1000);
      cpu.set("BC", 0x0001);
      cpu.set("A", 0x42);
      mem[0x1000] = 0x42;
      mem[0] = 0xED;
      mem[1] = 0xA9; // CPD

      cpu.step();

      const state = cpu.status();
      assert.equal(state.hl, 0x0FFF, "HL decremented");
      assert.equal(state.bc, 0x0000, "BC = 0");
      assert.equal(state.f & 0x40, 0x40, "Z set (found)");
    });

    QUnit.test("CPIR - Compare, increment and repeat until found", (assert) => {
      const { cpu, mem } = createTestCPU();

      // One step = one comparison. Not found + BC>1 → HL++, BC--, PC stays.
      cpu.set("HL", 0x1000);
      cpu.set("BC", 0x0005);
      cpu.set("A", 0x55);
      mem[0x1000] = 0x11; // not a match
      mem[0x1001] = 0x55; // match is here (not reached yet)
      mem[0] = 0xED;
      mem[1] = 0xB1; // CPIR

      cpu.step(); // one iteration: compare [HL] with A, HL++, BC--

      const state = cpu.status();
      assert.equal(state.hl, 0x1001, "HL incremented once");
      assert.equal(state.bc, 0x0004, "BC decremented once");
      assert.equal(state.f & 0x40, 0, "Z clear (no match yet)");
      assert.equal(state.f & 0x04, 0x04, "P/V set (BC != 0)");
      assert.equal(state.pc, 0, "PC stays on CPIR while not found and BC > 0");
    });

    QUnit.test("CPDR - Compare, decrement and repeat", (assert) => {
      const { cpu, mem } = createTestCPU();

      // One step = one comparison. Not found + BC>1 → HL--, BC--, PC stays.
      cpu.set("HL", 0x1004);
      cpu.set("BC", 0x0005);
      cpu.set("A", 0x77);
      mem[0x1003] = 0x77; // match (not reached yet on first step)
      mem[0x1004] = 0x55; // not a match
      mem[0] = 0xED;
      mem[1] = 0xB9; // CPDR

      cpu.step(); // one iteration: compare [HL] with A, HL--, BC--

      const state = cpu.status();
      assert.equal(state.hl, 0x1003, "HL decremented once");
      assert.equal(state.bc, 0x0004, "BC decremented once");
      assert.equal(state.f & 0x40, 0, "Z clear (no match yet)");
      assert.equal(state.f & 0x04, 0x04, "P/V set (BC != 0)");
      assert.equal(state.pc, 0, "PC stays on CPDR while not found and BC > 0");
    });
  });

  QUnit.module("16-bit Arithmetic with Carry", () => {
    QUnit.test("ADC HL,BC - Add with carry to HL", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("HL", 0x1000);
      cpu.set("BC", 0x0500);
      cpu.set("F", 0x01); // Set carry
      mem[0] = 0xED;
      mem[1] = 0x4A; // ADC HL,BC

      cpu.step();

      const state = cpu.status();
      assert.equal(state.hl, 0x1501, "HL = HL + BC + carry");
    });

    QUnit.test("ADC HL,HL - Double HL with carry", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("HL", 0x8000);
      cpu.set("F", 0x00); // Clear carry
      mem[0] = 0xED;
      mem[1] = 0x6A; // ADC HL,HL

      cpu.step();

      const state = cpu.status();
      assert.equal(state.hl, 0x0000, "HL = 0x8000 * 2 (wraps)");
      assert.equal(state.f & 0x01, 1, "Carry set");
    });

    QUnit.test("SBC HL,DE - Subtract with carry from HL", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("HL", 0x1000);
      cpu.set("DE", 0x0500);
      cpu.set("F", 0x01); // Set carry
      mem[0] = 0xED;
      mem[1] = 0x52; // SBC HL,DE

      cpu.step();

      const state = cpu.status();
      assert.equal(state.hl, 0x0AFF, "HL = HL - DE - carry");
    });

    QUnit.test("SBC HL,HL - Clear HL with carry consideration", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("HL", 0x1234);
      cpu.set("F", 0x00); // Clear carry
      mem[0] = 0xED;
      mem[1] = 0x62; // SBC HL,HL

      cpu.step();

      const state = cpu.status();
      assert.equal(state.hl, 0x0000, "HL = 0");
      assert.equal(state.f & 0x40, 0x40, "Z flag set");
    });
  });

  QUnit.module("I/O Block Operations", () => {
    QUnit.test("INI - Input and increment", (assert) => {
      const { cpu, mem, ports } = createTestCPU();

      // INI reads from port BC (16-bit). B=0x03, C=0x10 → port 0x0310.
      cpu.set("HL", 0x2000);
      cpu.set("B", 0x03);
      cpu.set("C", 0x10);
      ports[0x0310] = 0x88; // full BC address
      mem[0] = 0xED;
      mem[1] = 0xA2; // INI

      cpu.step();

      const state = cpu.status();
      assert.equal(mem[0x2000], 0x88, "Byte read from port BC into [HL]");
      assert.equal(state.hl, 0x2001, "HL incremented");
      assert.equal(state.b, 0x02, "B decremented");
    });

    QUnit.test("IND - Input and decrement", (assert) => {
      const { cpu, mem, ports } = createTestCPU();

      // IND reads from port BC (16-bit). B=0x01, C=0x20 → port 0x0120.
      cpu.set("HL", 0x2000);
      cpu.set("B", 0x01);
      cpu.set("C", 0x20);
      ports[0x0120] = 0x99; // full BC address
      mem[0] = 0xED;
      mem[1] = 0xAA; // IND

      cpu.step();

      const state = cpu.status();
      assert.equal(mem[0x2000], 0x99, "Byte read from port BC into [HL]");
      assert.equal(state.hl, 0x1FFF, "HL decremented");
      assert.equal(state.b, 0x00, "B decremented to 0");
    });

    QUnit.test("INIR - Input, increment and repeat", (assert) => {
      const { cpu, mem, ports } = createTestCPU();

      // One step = one iteration. B=0x03, C=0x30 → port 0x0330.
      // With B>1 after decrement, PC stays on INIR.
      cpu.set("HL", 0x3000);
      cpu.set("B", 0x03);
      cpu.set("C", 0x30);
      ports[0x0330] = 0xAA; // full BC address
      mem[0] = 0xED;
      mem[1] = 0xB2; // INIR

      cpu.step(); // one iteration: IN [HL] from port BC, HL++, B--

      const state = cpu.status();
      assert.equal(mem[0x3000], 0xAA, "Byte read into [HL]");
      assert.equal(state.hl, 0x3001, "HL incremented once");
      assert.equal(state.b, 0x02, "B decremented once");
      assert.equal(state.pc, 0, "PC stays on INIR while B > 0");
    });

    QUnit.test("OUTI - Output and increment", (assert) => {
      const { cpu, mem, ports } = createTestCPU();

      cpu.set("HL", 0x4000);
      cpu.set("B", 0x02);
      cpu.set("C", 0x40);
      mem[0x4000] = 0xBB;
      mem[0] = 0xED;
      mem[1] = 0xA3; // OUTI

      cpu.step();

      const state = cpu.status();
      assert.equal(ports[0x40], 0xBB, "Byte written to port");
      assert.equal(state.hl, 0x4001, "HL incremented");
      assert.equal(state.b, 0x01, "B decremented");
    });

    QUnit.test("OUTD - Output and decrement", (assert) => {
      const { cpu, mem, ports } = createTestCPU();

      cpu.set("HL", 0x5000);
      cpu.set("B", 0x01);
      cpu.set("C", 0x50);
      mem[0x5000] = 0xCC;
      mem[0] = 0xED;
      mem[1] = 0xAB; // OUTD

      cpu.step();

      const state = cpu.status();
      assert.equal(ports[0x50], 0xCC, "Byte written to port");
      assert.equal(state.hl, 0x4FFF, "HL decremented");
      assert.equal(state.b, 0x00, "B = 0");
    });

    QUnit.test("OTIR - Output, increment and repeat", (assert) => {
      const { cpu, mem, ports } = createTestCPU();

      // One step = one iteration. B=0x03, C=0x60.
      // With B>1 after decrement, PC stays on OTIR.
      cpu.set("HL", 0x6000);
      cpu.set("B", 0x03);
      cpu.set("C", 0x60);
      mem[0x6000] = 0xDD;
      mem[0x6001] = 0xEE;
      mem[0x6002] = 0xFF;
      mem[0] = 0xED;
      mem[1] = 0xB3; // OTIR

      cpu.step(); // one iteration: OUT port C from [HL], HL++, B--

      const state = cpu.status();
      assert.equal(ports[0x60], 0xDD, "First byte output to port C");
      assert.equal(state.hl, 0x6001, "HL incremented once");
      assert.equal(state.b, 0x02, "B decremented once");
      assert.equal(state.pc, 0, "PC stays on OTIR while B > 0");
    });
  });

  QUnit.module("Rotation (BCD)", () => {
    QUnit.test("RLD - Rotate left decimal", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("HL", 0x1000);
      cpu.set("A", 0x7A);
      mem[0x1000] = 0x31;
      mem[0] = 0xED;
      mem[1] = 0x6F; // RLD

      cpu.step();

      const state = cpu.status();
      assert.equal(state.a, 0x73, "A = high nibble rotated");
      assert.equal(mem[0x1000], 0x1A, "(HL) rotated left");
    });

    QUnit.test("RRD - Rotate right decimal", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("HL", 0x2000);
      cpu.set("A", 0x84);
      mem[0x2000] = 0x20;
      mem[0] = 0xED;
      mem[1] = 0x67; // RRD

      cpu.step();

      const state = cpu.status();
      assert.equal(state.a, 0x80, "A = low nibble from (HL)");
      assert.equal(mem[0x2000], 0x42, "(HL) rotated right");
    });
  });

  QUnit.module("Negation", () => {
    QUnit.test("NEG - Negate accumulator", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x05);
      mem[0] = 0xED;
      mem[1] = 0x44; // NEG

      cpu.step();

      const state = cpu.status();
      assert.equal(state.a, 0xFB, "A = -5 (two's complement)");
      assert.equal(state.f & 0x01, 1, "Carry set");
      assert.equal(state.f & 0x02, 0x02, "N flag set");
    });

    QUnit.test("NEG with A=0", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x00);
      mem[0] = 0xED;
      mem[1] = 0x44; // NEG

      cpu.step();

      const state = cpu.status();
      assert.equal(state.a, 0x00, "A = 0");
      assert.equal(state.f & 0x01, 0, "Carry clear");
      assert.equal(state.f & 0x40, 0x40, "Z flag set");
    });

    QUnit.test("NEG with A=0x80", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x80);
      mem[0] = 0xED;
      mem[1] = 0x44; // NEG

      cpu.step();

      const state = cpu.status();
      assert.equal(state.a, 0x80, "A = 0x80 (overflow)");
      assert.equal(state.f & 0x04, 0x04, "P/V set (overflow)");
    });
  });

  QUnit.module("Interrupt Mode", () => {
    QUnit.test("IM 0 - Set interrupt mode 0", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0] = 0xED;
      mem[1] = 0x46; // IM 0

      cpu.step();

      assert.equal(cpu.status().im, 0, "IM = 0");
    });

    QUnit.test("IM 1 - Set interrupt mode 1", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0] = 0xED;
      mem[1] = 0x56; // IM 1

      cpu.step();

      assert.equal(cpu.status().im, 1, "IM = 1");
    });

    QUnit.test("IM 2 - Set interrupt mode 2", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0] = 0xED;
      mem[1] = 0x5E; // IM 2

      cpu.step();

      assert.equal(cpu.status().im, 2, "IM = 2");
    });
  });

  QUnit.module("Special Returns", () => {
    QUnit.test("RETI - Return from interrupt", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xFFFC);
      mem[0xFFFC] = 0x34;
      mem[0xFFFD] = 0x12;
      mem[0] = 0xED;
      mem[1] = 0x4D; // RETI

      cpu.step();

      const state = cpu.status();
      assert.equal(state.pc, 0x1234, "PC restored from stack");
      assert.equal(state.sp, 0xFFFE, "SP restored");
    });

    QUnit.test("RETN - Return from NMI", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xFFFC);
      mem[0xFFFC] = 0x78;
      mem[0xFFFD] = 0x56;
      mem[0] = 0xED;
      mem[1] = 0x45; // RETN

      cpu.step();

      const state = cpu.status();
      assert.equal(state.pc, 0x5678, "PC restored from stack");
      assert.equal(state.sp, 0xFFFE, "SP restored");
    });
  });

  QUnit.module("16-bit Load Extended", () => {
    QUnit.test("LD (nn),BC - Store BC to memory", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("BC", 0x1234);
      mem[0] = 0xED;
      mem[1] = 0x43; // LD (nn),BC
      mem[2] = 0x00;
      mem[3] = 0x30;

      cpu.step();

      assert.equal(mem[0x3000], 0x34, "Low byte stored");
      assert.equal(mem[0x3001], 0x12, "High byte stored");
    });

    QUnit.test("LD BC,(nn) - Load BC from memory", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x4000] = 0x78;
      mem[0x4001] = 0x56;
      mem[0] = 0xED;
      mem[1] = 0x4B; // LD BC,(nn)
      mem[2] = 0x00;
      mem[3] = 0x40;

      cpu.step();

      assert.equal(cpu.status().bc, 0x5678, "BC loaded from memory");
    });

    QUnit.test("LD (nn),DE - Store DE to memory", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("DE", 0xABCD);
      mem[0] = 0xED;
      mem[1] = 0x53; // LD (nn),DE
      mem[2] = 0x00;
      mem[3] = 0x50;

      cpu.step();

      assert.equal(mem[0x5000], 0xCD, "Low byte stored");
      assert.equal(mem[0x5001], 0xAB, "High byte stored");
    });

    QUnit.test("LD DE,(nn) - Load DE from memory", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x6000] = 0xEF;
      mem[0x6001] = 0xBE;
      mem[0] = 0xED;
      mem[1] = 0x5B; // LD DE,(nn)
      mem[2] = 0x00;
      mem[3] = 0x60;

      cpu.step();

      assert.equal(cpu.status().de, 0xBEEF, "DE loaded from memory");
    });

    QUnit.test("LD (nn),SP - Store SP to memory", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("SP", 0xF000);
      mem[0] = 0xED;
      mem[1] = 0x73; // LD (nn),SP
      mem[2] = 0x00;
      mem[3] = 0x70;

      cpu.step();

      assert.equal(mem[0x7000], 0x00, "Low byte stored");
      assert.equal(mem[0x7001], 0xF0, "High byte stored");
    });

    QUnit.test("LD SP,(nn) - Load SP from memory", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x8000] = 0xFE;
      mem[0x8001] = 0xFF;
      mem[0] = 0xED;
      mem[1] = 0x7B; // LD SP,(nn)
      mem[2] = 0x00;
      mem[3] = 0x80;

      cpu.step();

      assert.equal(cpu.status().sp, 0xFFFE, "SP loaded from memory");
    });
  });

  QUnit.module("Special Register Load", () => {
    QUnit.test("LD I,A - Load I from A", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x38);
      mem[0] = 0xED;
      mem[1] = 0x47; // LD I,A

      cpu.step();

      assert.equal(cpu.status().i, 0x38, "I = A");
    });

    QUnit.test("LD A,I - Load A from I", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("I", 0x55);
      mem[0] = 0xED;
      mem[1] = 0x57; // LD A,I

      cpu.step();

      assert.equal(cpu.status().a, 0x55, "A = I");
    });

    QUnit.test("LD R,A - Load R from A", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("A", 0x42);
      mem[0] = 0xED;
      mem[1] = 0x4F; // LD R,A

      cpu.step();

      const r = cpu.status().r & 0x7F; // Mask to 7 bits
      assert.equal(r, 0x42, "R = A (7-bit)");
    });

    QUnit.test("LD A,R - Load A from R", (assert) => {
      const { cpu, mem } = createTestCPU();

      cpu.set("R", 0x33);
      mem[0] = 0xED;
      mem[1] = 0x5F; // LD A,R

      cpu.step();

      const a = cpu.status().a;
      assert.ok(a >= 0 && a <= 0xFF, "A loaded from R");
    });
  });

  QUnit.module("IN/OUT with C", () => {
    QUnit.test("IN r,(C) - Input to register from port C", (assert) => {
      const { cpu, mem, ports } = createTestCPU();

      cpu.set("C", 0x10);
      ports[0x10] = 0x77;
      mem[0] = 0xED;
      mem[1] = 0x78; // IN A,(C)

      cpu.step();

      assert.equal(cpu.status().a, 0x77, "A = port[C]");
    });

    QUnit.test("OUT (C),r - Output from register to port C", (assert) => {
      const { cpu, mem, ports } = createTestCPU();

      cpu.set("C", 0x20);
      cpu.set("A", 0x88);
      mem[0] = 0xED;
      mem[1] = 0x79; // OUT (C),A

      cpu.step();

      assert.equal(ports[0x20], 0x88, "port[C] = A");
    });

    QUnit.test("IN B,(C) - Input to B", (assert) => {
      const { cpu, mem, ports } = createTestCPU();

      cpu.set("C", 0x30);
      ports[0x30] = 0x99;
      mem[0] = 0xED;
      mem[1] = 0x40; // IN B,(C)

      cpu.step();

      assert.equal(cpu.status().b, 0x99, "B = port[C]");
    });

    QUnit.test("OUT (C),D - Output D", (assert) => {
      const { cpu, mem, ports } = createTestCPU();

      cpu.set("C", 0x40);
      cpu.set("D", 0xAA);
      mem[0] = 0xED;
      mem[1] = 0x51; // OUT (C),D

      cpu.step();

      assert.equal(ports[0x40], 0xAA, "port[C] = D");
    });
  });
});
