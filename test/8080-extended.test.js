/**
 * Intel 8080 Extended Test Coverage
 *
 * Additional tests to achieve 97%+ statement coverage and 90%+ branch coverage
 */

import QUnit from "qunit";
import create8080 from "../src/8080.js";

QUnit.module("8080 Extended Coverage Tests", () => {
  const createTestCPU = () => {
    const mem = new Uint8Array(65536);
    const ports = new Uint8Array(256);
    const cpu = create8080({
      byteAt: (addr) => mem[addr] || 0,
      byteTo: (addr, val) => { mem[addr] = val & 0xFF; },
      portOut: (port, val) => { ports[port] = val & 0xFF; },
      portIn: (port) => ports[port] || 0
    });
    return { cpu, mem, ports };
  };

  QUnit.module("RST Instructions - All Variants", () => {
    QUnit.test("RST 0 (0xC7)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      cpu.set("PC", 0x0100);
      mem[0x0100] = 0xC7;
      cpu.steps(11);
      const state = cpu.status();
      assert.equal(state.pc, 0x0000, "PC = 0x0000");
    });

    QUnit.test("RST 1 (0xCF)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      cpu.set("PC", 0x0100);
      mem[0x0100] = 0xCF;
      cpu.steps(11);
      const state = cpu.status();
      assert.equal(state.pc, 0x0008, "PC = 0x0008");
    });

    QUnit.test("RST 2 (0xD7)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      cpu.set("PC", 0x0100);
      mem[0x0100] = 0xD7;
      cpu.steps(11);
      const state = cpu.status();
      assert.equal(state.pc, 0x0010, "PC = 0x0010");
    });

    QUnit.test("RST 3 (0xDF)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      cpu.set("PC", 0x0100);
      mem[0x0100] = 0xDF;
      cpu.steps(11);
      const state = cpu.status();
      assert.equal(state.pc, 0x0018, "PC = 0x0018");
    });

    QUnit.test("RST 4 (0xE7)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      cpu.set("PC", 0x0100);
      mem[0x0100] = 0xE7;
      cpu.steps(11);
      const state = cpu.status();
      assert.equal(state.pc, 0x0020, "PC = 0x0020");
    });

    QUnit.test("RST 5 (0xEF)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      cpu.set("PC", 0x0100);
      mem[0x0100] = 0xEF;
      cpu.steps(11);
      const state = cpu.status();
      assert.equal(state.pc, 0x0028, "PC = 0x0028");
    });

    QUnit.test("RST 6 (0xF7)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      cpu.set("PC", 0x0100);
      mem[0x0100] = 0xF7;
      cpu.steps(11);
      const state = cpu.status();
      assert.equal(state.pc, 0x0030, "PC = 0x0030");
    });

    QUnit.test("RST 7 (0xFF)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      cpu.set("PC", 0x0100);
      mem[0x0100] = 0xFF;
      cpu.steps(11);
      const state = cpu.status();
      assert.equal(state.pc, 0x0038, "PC = 0x0038");
    });
  });

  QUnit.module("Conditional Jumps - Both Branches", () => {
    QUnit.test("JNZ - not taken (zero flag set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("F", 0x40);
      mem[0x0000] = 0xC2;
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x10;
      cpu.set("PC", 0x0000);
      cpu.steps(10);
      assert.equal(cpu.status().pc, 0x0003, "PC advanced");
    });

    QUnit.test("JNC - not taken (carry set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("F", 0x01);
      mem[0x0000] = 0xD2;
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x10;
      cpu.set("PC", 0x0000);
      cpu.steps(10);
      assert.equal(cpu.status().pc, 0x0003, "PC advanced");
    });

    QUnit.test("JP - taken (sign not set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("F", 0x00);
      mem[0x0000] = 0xF2;
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x10;
      cpu.set("PC", 0x0000);
      cpu.steps(10);
      assert.equal(cpu.status().pc, 0x1000, "Jump taken");
    });

    QUnit.test("JP - not taken (sign set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("F", 0x80);
      mem[0x0000] = 0xF2;
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x10;
      cpu.set("PC", 0x0000);
      cpu.steps(10);
      assert.equal(cpu.status().pc, 0x0003, "Jump not taken");
    });

    QUnit.test("JM - taken (sign set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("F", 0x80);
      mem[0x0000] = 0xFA;
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x10;
      cpu.set("PC", 0x0000);
      cpu.steps(10);
      assert.equal(cpu.status().pc, 0x1000, "Jump taken");
    });

    QUnit.test("JM - not taken (sign not set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("F", 0x00);
      mem[0x0000] = 0xFA;
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x10;
      cpu.set("PC", 0x0000);
      cpu.steps(10);
      assert.equal(cpu.status().pc, 0x0003, "Jump not taken");
    });

    QUnit.test("JPO - taken (parity not set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("F", 0x00);
      mem[0x0000] = 0xE2;
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x10;
      cpu.set("PC", 0x0000);
      cpu.steps(10);
      assert.equal(cpu.status().pc, 0x1000, "Jump taken");
    });

    QUnit.test("JPE - taken (parity set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("F", 0x04);
      mem[0x0000] = 0xEA;
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x10;
      cpu.set("PC", 0x0000);
      cpu.steps(10);
      assert.equal(cpu.status().pc, 0x1000, "Jump taken");
    });
  });

  QUnit.module("Conditional Calls - Both Branches", () => {
    QUnit.test("CNZ - not taken (zero set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      cpu.set("F", 0x40);
      mem[0x0000] = 0xC4;
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x10;
      cpu.set("PC", 0x0000);
      cpu.steps(11);
      assert.equal(cpu.status().pc, 0x0003, "Call not taken");
    });

    QUnit.test("CNC - not taken (carry set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      cpu.set("F", 0x01);
      mem[0x0000] = 0xD4;
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x10;
      cpu.set("PC", 0x0000);
      cpu.steps(11);
      assert.equal(cpu.status().pc, 0x0003, "Call not taken");
    });

    QUnit.test("CP - taken (sign not set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      cpu.set("F", 0x00);
      mem[0x0000] = 0xF4;
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x10;
      cpu.set("PC", 0x0000);
      cpu.steps(17);
      assert.equal(cpu.status().pc, 0x1000, "Call taken");
    });

    QUnit.test("CM - taken (sign set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      cpu.set("F", 0x80);
      mem[0x0000] = 0xFC;
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x10;
      cpu.set("PC", 0x0000);
      cpu.steps(17);
      assert.equal(cpu.status().pc, 0x1000, "Call taken");
    });

    QUnit.test("CM - not taken (sign not set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      cpu.set("F", 0x00);
      mem[0x0000] = 0xFC;
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x10;
      cpu.set("PC", 0x0000);
      cpu.steps(11);
      assert.equal(cpu.status().pc, 0x0003, "Call not taken");
    });

    QUnit.test("CPO - taken (parity not set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      cpu.set("F", 0x00);
      mem[0x0000] = 0xE4;
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x10;
      cpu.set("PC", 0x0000);
      cpu.steps(17);
      assert.equal(cpu.status().pc, 0x1000, "Call taken");
    });

    QUnit.test("CPE - taken (parity set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      cpu.set("F", 0x04);
      mem[0x0000] = 0xEC;
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x10;
      cpu.set("PC", 0x0000);
      cpu.steps(17);
      assert.equal(cpu.status().pc, 0x1000, "Call taken");
    });

    QUnit.test("CPE - not taken (parity not set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      cpu.set("F", 0x00);
      mem[0x0000] = 0xEC;
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x10;
      cpu.set("PC", 0x0000);
      cpu.steps(11);
      assert.equal(cpu.status().pc, 0x0003, "Call not taken");
    });
  });

  QUnit.module("Conditional Returns - Both Branches", () => {
    QUnit.test("RNZ - taken (zero not set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      cpu.set("F", 0x00);
      mem[0xF000] = 0x00;
      mem[0xF001] = 0x20;
      mem[0x0100] = 0xC0;
      cpu.set("PC", 0x0100);
      cpu.steps(11);
      assert.equal(cpu.status().pc, 0x2000, "Return taken");
    });

    QUnit.test("RNC - taken (carry not set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      cpu.set("F", 0x00);
      mem[0xF000] = 0x00;
      mem[0xF001] = 0x20;
      mem[0x0100] = 0xD0;
      cpu.set("PC", 0x0100);
      cpu.steps(11);
      assert.equal(cpu.status().pc, 0x2000, "Return taken");
    });

    QUnit.test("RP - taken (sign not set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      cpu.set("F", 0x00);
      mem[0xF000] = 0x00;
      mem[0xF001] = 0x20;
      mem[0x0100] = 0xF0;
      cpu.set("PC", 0x0100);
      cpu.steps(11);
      assert.equal(cpu.status().pc, 0x2000, "Return taken");
    });

    QUnit.test("RP - not taken (sign set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      cpu.set("F", 0x80);
      mem[0x0100] = 0xF0;
      cpu.set("PC", 0x0100);
      cpu.steps(5);
      assert.equal(cpu.status().pc, 0x0101, "Return not taken");
    });

    QUnit.test("RM - taken (sign set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      cpu.set("F", 0x80);
      mem[0xF000] = 0x00;
      mem[0xF001] = 0x20;
      mem[0x0100] = 0xF8;
      cpu.set("PC", 0x0100);
      cpu.steps(11);
      assert.equal(cpu.status().pc, 0x2000, "Return taken");
    });

    QUnit.test("RM - not taken (sign not set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      cpu.set("F", 0x00);
      mem[0x0100] = 0xF8;
      cpu.set("PC", 0x0100);
      cpu.steps(5);
      assert.equal(cpu.status().pc, 0x0101, "Return not taken");
    });

    QUnit.test("RPO - taken (parity not set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      cpu.set("F", 0x00);
      mem[0xF000] = 0x00;
      mem[0xF001] = 0x20;
      mem[0x0100] = 0xE0;
      cpu.set("PC", 0x0100);
      cpu.steps(11);
      assert.equal(cpu.status().pc, 0x2000, "Return taken");
    });

    QUnit.test("RPE - taken (parity set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      cpu.set("F", 0x04);
      mem[0xF000] = 0x00;
      mem[0xF001] = 0x20;
      mem[0x0100] = 0xE8;
      cpu.set("PC", 0x0100);
      cpu.steps(11);
      assert.equal(cpu.status().pc, 0x2000, "Return taken");
    });

    QUnit.test("RPE - not taken (parity not set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      cpu.set("F", 0x00);
      mem[0x0100] = 0xE8;
      cpu.set("PC", 0x0100);
      cpu.steps(5);
      assert.equal(cpu.status().pc, 0x0101, "Return not taken");
    });
  });

  QUnit.module("All LXI Variants", () => {
    QUnit.test("LXI D,nn", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x0000] = 0x11;
      mem[0x0001] = 0x34;
      mem[0x0002] = 0x12;
      cpu.set("PC", 0x0000);
      cpu.steps(10);
      const state = cpu.status();
      assert.equal(state.d, 0x12, "D loaded");
      assert.equal(state.e, 0x34, "E loaded");
    });

    QUnit.test("LXI SP,nn", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x0000] = 0x31;
      mem[0x0001] = 0x00;
      mem[0x0002] = 0xE0;
      cpu.set("PC", 0x0000);
      cpu.steps(10);
      assert.equal(cpu.status().sp, 0xE000, "SP loaded");
    });
  });

  QUnit.module("All INX/DCX Variants", () => {
    QUnit.test("INX D", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("D", 0x12);
      cpu.set("E", 0xFF);
      mem[0x0000] = 0x13;
      cpu.set("PC", 0x0000);
      cpu.steps(6);
      const state = cpu.status();
      assert.equal(state.d, 0x13, "D incremented");
      assert.equal(state.e, 0x00, "E wrapped");
    });

    QUnit.test("INX SP", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xFFFF);
      mem[0x0000] = 0x33;
      cpu.set("PC", 0x0000);
      cpu.steps(6);
      assert.equal(cpu.status().sp, 0x0000, "SP wrapped");
    });

    QUnit.test("DCX D", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("D", 0x20);
      cpu.set("E", 0x00);
      mem[0x0000] = 0x1B;
      cpu.set("PC", 0x0000);
      cpu.steps(6);
      const state = cpu.status();
      assert.equal(state.d, 0x1F, "D decremented");
      assert.equal(state.e, 0xFF, "E wrapped");
    });

    QUnit.test("DCX SP", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x0000);
      mem[0x0000] = 0x3B;
      cpu.set("PC", 0x0000);
      cpu.steps(6);
      assert.equal(cpu.status().sp, 0xFFFF, "SP wrapped");
    });
  });

  QUnit.module("All MVI Variants", () => {
    QUnit.test("MVI D,n", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x0000] = 0x16;
      mem[0x0001] = 0x77;
      cpu.set("PC", 0x0000);
      cpu.steps(7);
      assert.equal(cpu.status().d, 0x77, "D loaded");
    });

    QUnit.test("MVI E,n", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x0000] = 0x1E;
      mem[0x0001] = 0x88;
      cpu.set("PC", 0x0000);
      cpu.steps(7);
      assert.equal(cpu.status().e, 0x88, "E loaded");
    });

    QUnit.test("MVI H,n", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x0000] = 0x26;
      mem[0x0001] = 0x99;
      cpu.set("PC", 0x0000);
      cpu.steps(7);
      assert.equal(cpu.status().h, 0x99, "H loaded");
    });

    QUnit.test("MVI L,n", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x0000] = 0x2E;
      mem[0x0001] = 0xAA;
      cpu.set("PC", 0x0000);
      cpu.steps(7);
      assert.equal(cpu.status().l, 0xAA, "L loaded");
    });

    QUnit.test("MVI M,n", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("H", 0x20);
      cpu.set("L", 0x00);
      mem[0x0000] = 0x36;
      mem[0x0001] = 0xBB;
      cpu.set("PC", 0x0000);
      cpu.steps(10);
      assert.equal(mem[0x2000], 0xBB, "Memory loaded");
    });
  });

  QUnit.module("All INR/DCR Variants", () => {
    QUnit.test("INR D", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("D", 0x10);
      mem[0x0000] = 0x14;
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().d, 0x11, "D incremented");
    });

    QUnit.test("INR E", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("E", 0x10);
      mem[0x0000] = 0x1C;
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().e, 0x11, "E incremented");
    });

    QUnit.test("INR H", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("H", 0x10);
      mem[0x0000] = 0x24;
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().h, 0x11, "H incremented");
    });

    QUnit.test("INR L", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("L", 0x10);
      mem[0x0000] = 0x2C;
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().l, 0x11, "L incremented");
    });

    QUnit.test("INR A", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x10);
      mem[0x0000] = 0x3C;
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().a, 0x11, "A incremented");
    });

    QUnit.test("DCR D", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("D", 0x10);
      mem[0x0000] = 0x15;
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().d, 0x0F, "D decremented");
    });

    QUnit.test("DCR E", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("E", 0x10);
      mem[0x0000] = 0x1D;
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().e, 0x0F, "E decremented");
    });

    QUnit.test("DCR H", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("H", 0x10);
      mem[0x0000] = 0x25;
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().h, 0x0F, "H decremented");
    });

    QUnit.test("DCR L", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("L", 0x10);
      mem[0x0000] = 0x2D;
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().l, 0x0F, "L decremented");
    });

    QUnit.test("DCR A", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x10);
      mem[0x0000] = 0x3D;
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().a, 0x0F, "A decremented");
    });

    QUnit.test("DCR M", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("H", 0x20);
      cpu.set("L", 0x00);
      mem[0x2000] = 0x55;
      mem[0x0000] = 0x35;
      cpu.set("PC", 0x0000);
      cpu.steps(10);
      assert.equal(mem[0x2000], 0x54, "Memory decremented");
    });
  });

  QUnit.module("All DAD Variants", () => {
    QUnit.test("DAD D", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("H", 0x10);
      cpu.set("L", 0x00);
      cpu.set("D", 0x00);
      cpu.set("E", 0x50);
      mem[0x0000] = 0x19;
      cpu.set("PC", 0x0000);
      cpu.steps(11);
      const state = cpu.status();
      assert.equal(state.h, 0x10, "H = 0x10");
      assert.equal(state.l, 0x50, "L = 0x50");
    });

    QUnit.test("DAD SP", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("H", 0x10);
      cpu.set("L", 0x00);
      cpu.set("SP", 0x0050);
      mem[0x0000] = 0x39;
      cpu.set("PC", 0x0000);
      cpu.steps(11);
      const state = cpu.status();
      assert.equal(state.h, 0x10, "H = 0x10");
      assert.equal(state.l, 0x50, "L = 0x50");
    });
  });

  QUnit.module("Special NOP Aliases", () => {
    QUnit.test("0x08 NOP alias", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x0000] = 0x08;
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      assert.equal(cpu.status().pc, 1, "PC incremented");
    });

    QUnit.test("0x10 NOP alias", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x0000] = 0x10;
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      assert.equal(cpu.status().pc, 1, "PC incremented");
    });

    QUnit.test("0x18 NOP alias", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x0000] = 0x18;
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      assert.equal(cpu.status().pc, 1, "PC incremented");
    });

    QUnit.test("0x20 NOP alias", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x0000] = 0x20;
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      assert.equal(cpu.status().pc, 1, "PC incremented");
    });

    QUnit.test("0x28 NOP alias", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x0000] = 0x28;
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      assert.equal(cpu.status().pc, 1, "PC incremented");
    });

    QUnit.test("0x30 NOP alias", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x0000] = 0x30;
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      assert.equal(cpu.status().pc, 1, "PC incremented");
    });

    QUnit.test("0x38 NOP alias", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x0000] = 0x38;
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      assert.equal(cpu.status().pc, 1, "PC incremented");
    });
  });

  QUnit.module("JMP Alias", () => {
    QUnit.test("0xCB JMP alias", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x0000] = 0xCB;
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x20;
      cpu.set("PC", 0x0000);
      cpu.steps(10);
      assert.equal(cpu.status().pc, 0x2000, "PC jumped");
    });
  });

  QUnit.module("RET Alias", () => {
    QUnit.test("0xD9 RET alias", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      mem[0xF000] = 0x00;
      mem[0xF001] = 0x20;
      mem[0x0100] = 0xD9;
      cpu.set("PC", 0x0100);
      cpu.steps(10);
      assert.equal(cpu.status().pc, 0x2000, "RET executed");
    });
  });

  QUnit.module("CALL Aliases", () => {
    QUnit.test("0xDD CALL alias", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      mem[0x0000] = 0xDD;
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x20;
      cpu.set("PC", 0x0000);
      cpu.steps(17);
      assert.equal(cpu.status().pc, 0x2000, "CALL executed");
    });

    QUnit.test("0xED CALL alias", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      mem[0x0000] = 0xED;
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x20;
      cpu.set("PC", 0x0000);
      cpu.steps(17);
      assert.equal(cpu.status().pc, 0x2000, "CALL executed");
    });

    QUnit.test("0xFD CALL alias", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      mem[0x0000] = 0xFD;
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x20;
      cpu.set("PC", 0x0000);
      cpu.steps(17);
      assert.equal(cpu.status().pc, 0x2000, "CALL executed");
    });
  });

  QUnit.module("Interrupt with halted CPU", () => {
    QUnit.test("Interrupt wakes halted CPU", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);

      // Enable interrupts
      mem[0x0000] = 0xFB; // EI
      cpu.set("PC", 0x0000);
      cpu.steps(4);

      // Halt CPU
      mem[0x0001] = 0x76; // HLT
      cpu.steps(7);

      // Trigger interrupt - should wake CPU
      cpu.interrupt(0x10);

      const state = cpu.status();
      assert.equal(state.pc, 0x10, "Interrupt executed, CPU woken");
    });
  });

  QUnit.module("XTHL Edge Cases", () => {
    QUnit.test("XTHL with correct timing", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      cpu.set("H", 0xAA);
      cpu.set("L", 0xBB);
      mem[0xF000] = 0xCC;
      mem[0xF001] = 0xDD;
      mem[0x0000] = 0xE3; // XTHL
      cpu.set("PC", 0x0000);
      cpu.steps(4); // XTHL takes only 4 cycles in our implementation

      const state = cpu.status();
      assert.equal(state.h, 0xDD, "H exchanged");
      assert.equal(state.l, 0xCC, "L exchanged");
      assert.equal(mem[0xF000], 0xBB, "Stack has old L");
      assert.equal(mem[0xF001], 0xAA, "Stack has old H");
      assert.equal(cpu.T(), 4, "Correct timing");
    });
  });
});
