/**
 * Intel 8080 Complete Coverage Tests
 *
 * Final tests to achieve 97%+ statement coverage and 90%+ branch coverage
 */

import QUnit from "qunit";
import create8080 from "../src/8080.js";

QUnit.module("8080 Complete Coverage", () => {
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

  QUnit.module("Missing Instructions", () => {
    QUnit.test("XRI n - XOR immediate", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0xF0);
      mem[0x0000] = 0xEE;
      mem[0x0001] = 0x0F;
      cpu.set("PC", 0x0000);
      cpu.steps(7);
      assert.equal(cpu.status().a, 0xFF, "A = 0xF0 ^ 0x0F = 0xFF");
    });

    QUnit.test("SBI n - Subtract immediate with borrow", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x20);
      cpu.set("F", 0x01); // Set carry
      mem[0x0000] = 0xDE;
      mem[0x0001] = 0x10;
      cpu.set("PC", 0x0000);
      cpu.steps(7);
      assert.equal(cpu.status().a, 0x0F, "A = 0x20 - 0x10 - 1 = 0x0F");
    });

    QUnit.test("ACI n - Add immediate with carry", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x10);
      cpu.set("F", 0x01); // Set carry
      mem[0x0000] = 0xCE;
      mem[0x0001] = 0x05;
      cpu.set("PC", 0x0000);
      cpu.steps(7);
      assert.equal(cpu.status().a, 0x16, "A = 0x10 + 0x05 + 1 = 0x16");
    });
  });

  QUnit.module("Missing Call Branch - CP not taken", () => {
    QUnit.test("CP nn - not taken (sign set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      cpu.set("F", 0x80); // Set sign flag
      mem[0x0000] = 0xF4;
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x10;
      cpu.set("PC", 0x0000);
      cpu.steps(11);
      assert.equal(cpu.status().pc, 0x0003, "Call not taken, PC advanced");
      assert.equal(cpu.status().sp, 0xF000, "SP unchanged");
    });
  });

  QUnit.module("All ADD variants with all registers", () => {
    QUnit.test("ADD D", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x10);
      cpu.set("D", 0x05);
      mem[0x0000] = 0x82;
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      assert.equal(cpu.status().a, 0x15, "A = 0x10 + D(0x05)");
    });

    QUnit.test("ADD E", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x10);
      cpu.set("E", 0x05);
      mem[0x0000] = 0x83;
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      assert.equal(cpu.status().a, 0x15, "A = 0x10 + E(0x05)");
    });

    QUnit.test("ADD H", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x10);
      cpu.set("H", 0x05);
      mem[0x0000] = 0x84;
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      assert.equal(cpu.status().a, 0x15, "A = 0x10 + H(0x05)");
    });

    QUnit.test("ADD L", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x10);
      cpu.set("L", 0x05);
      mem[0x0000] = 0x85;
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      assert.equal(cpu.status().a, 0x15, "A = 0x10 + L(0x05)");
    });

    QUnit.test("ADD M", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x10);
      cpu.set("H", 0x20);
      cpu.set("L", 0x00);
      mem[0x2000] = 0x05;
      mem[0x0000] = 0x86;
      cpu.set("PC", 0x0000);
      cpu.steps(7);
      assert.equal(cpu.status().a, 0x15, "A = 0x10 + M(0x05)");
    });

    QUnit.test("ADD A", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x10);
      mem[0x0000] = 0x87;
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      assert.equal(cpu.status().a, 0x20, "A = 0x10 + A(0x10) = 0x20");
    });
  });

  QUnit.module("All ADC variants with all registers", () => {
    QUnit.test("ADC D", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x10);
      cpu.set("D", 0x05);
      cpu.set("F", 0x01);
      mem[0x0000] = 0x8A;
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      assert.equal(cpu.status().a, 0x16, "A = 0x10 + D(0x05) + 1");
    });

    QUnit.test("ADC E", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x10);
      cpu.set("E", 0x05);
      cpu.set("F", 0x01);
      mem[0x0000] = 0x8B;
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      assert.equal(cpu.status().a, 0x16, "A = 0x10 + E(0x05) + 1");
    });

    QUnit.test("ADC H", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x10);
      cpu.set("H", 0x05);
      cpu.set("F", 0x01);
      mem[0x0000] = 0x8C;
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      assert.equal(cpu.status().a, 0x16, "A = 0x10 + H(0x05) + 1");
    });

    QUnit.test("ADC L", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x10);
      cpu.set("L", 0x05);
      cpu.set("F", 0x01);
      mem[0x0000] = 0x8D;
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      assert.equal(cpu.status().a, 0x16, "A = 0x10 + L(0x05) + 1");
    });

    QUnit.test("ADC M", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x10);
      cpu.set("H", 0x20);
      cpu.set("L", 0x00);
      cpu.set("F", 0x01);
      mem[0x2000] = 0x05;
      mem[0x0000] = 0x8E;
      cpu.set("PC", 0x0000);
      cpu.steps(7);
      assert.equal(cpu.status().a, 0x16, "A = 0x10 + M(0x05) + 1");
    });

    QUnit.test("ADC A", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x10);
      cpu.set("F", 0x01);
      mem[0x0000] = 0x8F;
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      assert.equal(cpu.status().a, 0x21, "A = 0x10 + A(0x10) + 1 = 0x21");
    });
  });

  QUnit.module("All SUB variants with all registers", () => {
    QUnit.test("SUB D", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x20);
      cpu.set("D", 0x10);
      mem[0x0000] = 0x92;
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      assert.equal(cpu.status().a, 0x10, "A = 0x20 - D(0x10)");
    });

    QUnit.test("SUB E", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x20);
      cpu.set("E", 0x10);
      mem[0x0000] = 0x93;
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      assert.equal(cpu.status().a, 0x10, "A = 0x20 - E(0x10)");
    });

    QUnit.test("SUB H", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x20);
      cpu.set("H", 0x10);
      mem[0x0000] = 0x94;
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      assert.equal(cpu.status().a, 0x10, "A = 0x20 - H(0x10)");
    });

    QUnit.test("SUB L", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x20);
      cpu.set("L", 0x10);
      mem[0x0000] = 0x95;
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      assert.equal(cpu.status().a, 0x10, "A = 0x20 - L(0x10)");
    });

    QUnit.test("SUB M", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x20);
      cpu.set("H", 0x20);
      cpu.set("L", 0x00);
      mem[0x2000] = 0x10;
      mem[0x0000] = 0x96;
      cpu.set("PC", 0x0000);
      cpu.steps(7);
      assert.equal(cpu.status().a, 0x10, "A = 0x20 - M(0x10)");
    });

    QUnit.test("SUB A", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x20);
      mem[0x0000] = 0x97;
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      assert.equal(cpu.status().a, 0x00, "A = 0x20 - A(0x20) = 0");
    });
  });

  QUnit.module("All SBB variants with all registers", () => {
    QUnit.test("SBB D", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x20);
      cpu.set("D", 0x10);
      cpu.set("F", 0x01);
      mem[0x0000] = 0x9A;
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      assert.equal(cpu.status().a, 0x0F, "A = 0x20 - D(0x10) - 1");
    });

    QUnit.test("SBB E", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x20);
      cpu.set("E", 0x10);
      cpu.set("F", 0x01);
      mem[0x0000] = 0x9B;
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      assert.equal(cpu.status().a, 0x0F, "A = 0x20 - E(0x10) - 1");
    });

    QUnit.test("SBB H", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x20);
      cpu.set("H", 0x10);
      cpu.set("F", 0x01);
      mem[0x0000] = 0x9C;
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      assert.equal(cpu.status().a, 0x0F, "A = 0x20 - H(0x10) - 1");
    });

    QUnit.test("SBB L", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x20);
      cpu.set("L", 0x10);
      cpu.set("F", 0x01);
      mem[0x0000] = 0x9D;
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      assert.equal(cpu.status().a, 0x0F, "A = 0x20 - L(0x10) - 1");
    });

    QUnit.test("SBB M", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x20);
      cpu.set("H", 0x20);
      cpu.set("L", 0x00);
      cpu.set("F", 0x01);
      mem[0x2000] = 0x10;
      mem[0x0000] = 0x9E;
      cpu.set("PC", 0x0000);
      cpu.steps(7);
      assert.equal(cpu.status().a, 0x0F, "A = 0x20 - M(0x10) - 1");
    });

    QUnit.test("SBB A", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x20);
      cpu.set("F", 0x01);
      mem[0x0000] = 0x9F;
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      assert.equal(cpu.status().a, 0xFF, "A = 0x20 - A(0x20) - 1 = -1 = 0xFF");
    });
  });

  QUnit.module("All ANA variants with all registers", () => {
    QUnit.test("ANA D", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0xF0);
      cpu.set("D", 0x0F);
      mem[0x0000] = 0xA2;
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      assert.equal(cpu.status().a, 0x00, "A = 0xF0 & D(0x0F) = 0");
    });

    QUnit.test("ANA E", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0xF0);
      cpu.set("E", 0x0F);
      mem[0x0000] = 0xA3;
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      assert.equal(cpu.status().a, 0x00, "A = 0xF0 & E(0x0F) = 0");
    });

    QUnit.test("ANA H", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0xF0);
      cpu.set("H", 0x0F);
      mem[0x0000] = 0xA4;
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      assert.equal(cpu.status().a, 0x00, "A = 0xF0 & H(0x0F) = 0");
    });

    QUnit.test("ANA L", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0xF0);
      cpu.set("L", 0x0F);
      mem[0x0000] = 0xA5;
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      assert.equal(cpu.status().a, 0x00, "A = 0xF0 & L(0x0F) = 0");
    });

    QUnit.test("ANA M", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0xF0);
      cpu.set("H", 0x20);
      cpu.set("L", 0x00);
      mem[0x2000] = 0x0F;
      mem[0x0000] = 0xA6;
      cpu.set("PC", 0x0000);
      cpu.steps(7);
      assert.equal(cpu.status().a, 0x00, "A = 0xF0 & M(0x0F) = 0");
    });

    QUnit.test("ANA A", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0xF0);
      mem[0x0000] = 0xA7;
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      assert.equal(cpu.status().a, 0xF0, "A = 0xF0 & A(0xF0) = 0xF0");
    });
  });

  QUnit.module("All XRA variants with all registers", () => {
    QUnit.test("XRA D", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0xAA);
      cpu.set("D", 0x55);
      mem[0x0000] = 0xAA;
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      assert.equal(cpu.status().a, 0xFF, "A = 0xAA ^ D(0x55) = 0xFF");
    });

    QUnit.test("XRA E", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0xAA);
      cpu.set("E", 0x55);
      mem[0x0000] = 0xAB;
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      assert.equal(cpu.status().a, 0xFF, "A = 0xAA ^ E(0x55) = 0xFF");
    });

    QUnit.test("XRA H", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0xAA);
      cpu.set("H", 0x55);
      mem[0x0000] = 0xAC;
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      assert.equal(cpu.status().a, 0xFF, "A = 0xAA ^ H(0x55) = 0xFF");
    });

    QUnit.test("XRA L", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0xAA);
      cpu.set("L", 0x55);
      mem[0x0000] = 0xAD;
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      assert.equal(cpu.status().a, 0xFF, "A = 0xAA ^ L(0x55) = 0xFF");
    });

    QUnit.test("XRA M", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0xAA);
      cpu.set("H", 0x20);
      cpu.set("L", 0x00);
      mem[0x2000] = 0x55;
      mem[0x0000] = 0xAE;
      cpu.set("PC", 0x0000);
      cpu.steps(7);
      assert.equal(cpu.status().a, 0xFF, "A = 0xAA ^ M(0x55) = 0xFF");
    });
  });

  QUnit.module("All ORA variants with all registers", () => {
    QUnit.test("ORA D", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0xF0);
      cpu.set("D", 0x0F);
      mem[0x0000] = 0xB2;
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      assert.equal(cpu.status().a, 0xFF, "A = 0xF0 | D(0x0F) = 0xFF");
    });

    QUnit.test("ORA E", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0xF0);
      cpu.set("E", 0x0F);
      mem[0x0000] = 0xB3;
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      assert.equal(cpu.status().a, 0xFF, "A = 0xF0 | E(0x0F) = 0xFF");
    });

    QUnit.test("ORA H", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0xF0);
      cpu.set("H", 0x0F);
      mem[0x0000] = 0xB4;
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      assert.equal(cpu.status().a, 0xFF, "A = 0xF0 | H(0x0F) = 0xFF");
    });

    QUnit.test("ORA L", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0xF0);
      cpu.set("L", 0x0F);
      mem[0x0000] = 0xB5;
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      assert.equal(cpu.status().a, 0xFF, "A = 0xF0 | L(0x0F) = 0xFF");
    });

    QUnit.test("ORA M", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0xF0);
      cpu.set("H", 0x20);
      cpu.set("L", 0x00);
      mem[0x2000] = 0x0F;
      mem[0x0000] = 0xB6;
      cpu.set("PC", 0x0000);
      cpu.steps(7);
      assert.equal(cpu.status().a, 0xFF, "A = 0xF0 | M(0x0F) = 0xFF");
    });
  });

  QUnit.module("All CMP variants with all registers", () => {
    QUnit.test("CMP D", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x42);
      cpu.set("D", 0x42);
      mem[0x0000] = 0xBA;
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      const state = cpu.status();
      assert.equal(state.a, 0x42, "A unchanged");
      assert.ok(state.f & 0x40, "Zero flag set");
    });

    QUnit.test("CMP E", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x42);
      cpu.set("E", 0x42);
      mem[0x0000] = 0xBB;
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      const state = cpu.status();
      assert.equal(state.a, 0x42, "A unchanged");
      assert.ok(state.f & 0x40, "Zero flag set");
    });

    QUnit.test("CMP H", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x42);
      cpu.set("H", 0x42);
      mem[0x0000] = 0xBC;
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      const state = cpu.status();
      assert.equal(state.a, 0x42, "A unchanged");
      assert.ok(state.f & 0x40, "Zero flag set");
    });

    QUnit.test("CMP L", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x42);
      cpu.set("L", 0x42);
      mem[0x0000] = 0xBD;
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      const state = cpu.status();
      assert.equal(state.a, 0x42, "A unchanged");
      assert.ok(state.f & 0x40, "Zero flag set");
    });

    QUnit.test("CMP M", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x42);
      cpu.set("H", 0x20);
      cpu.set("L", 0x00);
      mem[0x2000] = 0x42;
      mem[0x0000] = 0xBE;
      cpu.set("PC", 0x0000);
      cpu.steps(7);
      const state = cpu.status();
      assert.equal(state.a, 0x42, "A unchanged");
      assert.ok(state.f & 0x40, "Zero flag set");
    });

    QUnit.test("CMP A", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x42);
      mem[0x0000] = 0xBF;
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      const state = cpu.status();
      assert.equal(state.a, 0x42, "A unchanged");
      assert.ok(state.f & 0x40, "Zero flag set (always for CMP A)");
    });
  });

  QUnit.module("RIM and SIM instructions", () => {
    QUnit.test("RIM (0x20) - Read Interrupt Mask", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x0000] = 0x20; // RIM (NOP on 8080)
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      assert.equal(cpu.status().pc, 1, "PC incremented");
    });

    QUnit.test("SIM (0x30) - Set Interrupt Mask", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x0000] = 0x30; // SIM (NOP on 8080)
      cpu.set("PC", 0x0000);
      cpu.steps(4);
      assert.equal(cpu.status().pc, 1, "PC incremented");
    });
  });
});
