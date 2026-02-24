/**
 * Intel 8080 Final Coverage Tests
 *
 * Last set of tests to reach 97%+ statements and 90%+ branches
 */

import QUnit from "qunit";
import create8080 from "../src/8080.js";

QUnit.module("8080 Final Coverage", () => {
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

  QUnit.module("Missing PUSH/POP", () => {
    QUnit.test("PUSH HL", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      cpu.set("H", 0x12);
      cpu.set("L", 0x34);
      mem[0x0000] = 0xE5;
      cpu.set("PC", 0x0000);
      cpu.steps(11);
      assert.equal(mem[0xEFFE], 0x34, "L pushed");
      assert.equal(mem[0xEFFF], 0x12, "H pushed");
    });

    QUnit.test("POP HL", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0xF000);
      mem[0xF000] = 0x56;
      mem[0xF001] = 0x78;
      mem[0x0000] = 0xE1;
      cpu.set("PC", 0x0000);
      cpu.steps(10);
      const state = cpu.status();
      assert.equal(state.l, 0x56, "L popped");
      assert.equal(state.h, 0x78, "H popped");
    });
  });

  QUnit.module("JPE - not taken branch", () => {
    QUnit.test("JPE nn - not taken (parity not set)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("F", 0x00); // Parity not set
      mem[0x0000] = 0xEA;
      mem[0x0001] = 0x00;
      mem[0x0002] = 0x10;
      cpu.set("PC", 0x0000);
      cpu.steps(10);
      assert.equal(cpu.status().pc, 0x0003, "Jump not taken, PC advanced");
    });
  });

  QUnit.module("All MOV combinations - Complete Matrix", () => {
    // MOV D,x
    QUnit.test("MOV D,B", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("B", 0x42);
      mem[0x0000] = 0x50;
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().d, 0x42, "D = B");
    });

    QUnit.test("MOV D,C", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("C", 0x42);
      mem[0x0000] = 0x51;
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().d, 0x42, "D = C");
    });

    QUnit.test("MOV D,D", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("D", 0x42);
      mem[0x0000] = 0x52;
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().d, 0x42, "D = D");
    });

    QUnit.test("MOV D,E", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("E", 0x42);
      mem[0x0000] = 0x53;
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().d, 0x42, "D = E");
    });

    QUnit.test("MOV D,H", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("H", 0x42);
      mem[0x0000] = 0x54;
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().d, 0x42, "D = H");
    });

    QUnit.test("MOV D,L", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("L", 0x42);
      mem[0x0000] = 0x55;
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().d, 0x42, "D = L");
    });

    QUnit.test("MOV D,M", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("H", 0x20);
      cpu.set("L", 0x00);
      mem[0x2000] = 0x42;
      mem[0x0000] = 0x56;
      cpu.set("PC", 0x0000);
      cpu.steps(7);
      assert.equal(cpu.status().d, 0x42, "D = M");
    });

    QUnit.test("MOV D,A", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x42);
      mem[0x0000] = 0x57;
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().d, 0x42, "D = A");
    });

    // MOV E,x
    QUnit.test("MOV E,B", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("B", 0x42);
      mem[0x0000] = 0x58;
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().e, 0x42, "E = B");
    });

    QUnit.test("MOV E,C", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("C", 0x42);
      mem[0x0000] = 0x59;
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().e, 0x42, "E = C");
    });

    QUnit.test("MOV E,D", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("D", 0x42);
      mem[0x0000] = 0x5A;
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().e, 0x42, "E = D");
    });

    QUnit.test("MOV E,E", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("E", 0x42);
      mem[0x0000] = 0x5B;
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().e, 0x42, "E = E");
    });

    QUnit.test("MOV E,H", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("H", 0x42);
      mem[0x0000] = 0x5C;
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().e, 0x42, "E = H");
    });

    QUnit.test("MOV E,L", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("L", 0x42);
      mem[0x0000] = 0x5D;
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().e, 0x42, "E = L");
    });

    QUnit.test("MOV E,M", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("H", 0x20);
      cpu.set("L", 0x00);
      mem[0x2000] = 0x42;
      mem[0x0000] = 0x5E;
      cpu.set("PC", 0x0000);
      cpu.steps(7);
      assert.equal(cpu.status().e, 0x42, "E = M");
    });

    QUnit.test("MOV E,A", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x42);
      mem[0x0000] = 0x5F;
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().e, 0x42, "E = A");
    });

    // MOV H,x
    QUnit.test("MOV H,B", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("B", 0x42);
      mem[0x0000] = 0x60;
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().h, 0x42, "H = B");
    });

    QUnit.test("MOV H,C", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("C", 0x42);
      mem[0x0000] = 0x61;
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().h, 0x42, "H = C");
    });

    QUnit.test("MOV H,D", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("D", 0x42);
      mem[0x0000] = 0x62;
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().h, 0x42, "H = D");
    });

    QUnit.test("MOV H,E", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("E", 0x42);
      mem[0x0000] = 0x63;
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().h, 0x42, "H = E");
    });

    QUnit.test("MOV H,H", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("H", 0x42);
      mem[0x0000] = 0x64;
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().h, 0x42, "H = H");
    });

    QUnit.test("MOV H,L", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("L", 0x42);
      mem[0x0000] = 0x65;
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().h, 0x42, "H = L");
    });

    QUnit.test("MOV H,M", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("H", 0x20);
      cpu.set("L", 0x00);
      mem[0x2000] = 0x42;
      mem[0x0000] = 0x66;
      cpu.set("PC", 0x0000);
      cpu.steps(7);
      assert.equal(cpu.status().h, 0x42, "H = M");
    });

    QUnit.test("MOV H,A", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x42);
      mem[0x0000] = 0x67;
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().h, 0x42, "H = A");
    });

    // MOV L,x
    QUnit.test("MOV L,B", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("B", 0x42);
      mem[0x0000] = 0x68;
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().l, 0x42, "L = B");
    });

    QUnit.test("MOV L,C", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("C", 0x42);
      mem[0x0000] = 0x69;
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().l, 0x42, "L = C");
    });

    QUnit.test("MOV L,D", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("D", 0x42);
      mem[0x0000] = 0x6A;
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().l, 0x42, "L = D");
    });

    QUnit.test("MOV L,E", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("E", 0x42);
      mem[0x0000] = 0x6B;
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().l, 0x42, "L = E");
    });

    QUnit.test("MOV L,H", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("H", 0x42);
      mem[0x0000] = 0x6C;
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().l, 0x42, "L = H");
    });

    QUnit.test("MOV L,L", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("L", 0x42);
      mem[0x0000] = 0x6D;
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().l, 0x42, "L = L");
    });

    QUnit.test("MOV L,M", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("H", 0x20);
      cpu.set("L", 0x00);
      mem[0x2000] = 0x42;
      mem[0x0000] = 0x6E;
      cpu.set("PC", 0x0000);
      cpu.steps(7);
      assert.equal(cpu.status().l, 0x42, "L = M");
    });

    QUnit.test("MOV L,A", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x42);
      mem[0x0000] = 0x6F;
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().l, 0x42, "L = A");
    });

    // MOV M,x
    QUnit.test("MOV M,B", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("B", 0x42);
      cpu.set("H", 0x20);
      cpu.set("L", 0x00);
      mem[0x0000] = 0x70;
      cpu.set("PC", 0x0000);
      cpu.steps(7);
      assert.equal(mem[0x2000], 0x42, "M = B");
    });

    QUnit.test("MOV M,C", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("C", 0x42);
      cpu.set("H", 0x20);
      cpu.set("L", 0x00);
      mem[0x0000] = 0x71;
      cpu.set("PC", 0x0000);
      cpu.steps(7);
      assert.equal(mem[0x2000], 0x42, "M = C");
    });

    QUnit.test("MOV M,D", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("D", 0x42);
      cpu.set("H", 0x20);
      cpu.set("L", 0x00);
      mem[0x0000] = 0x72;
      cpu.set("PC", 0x0000);
      cpu.steps(7);
      assert.equal(mem[0x2000], 0x42, "M = D");
    });

    QUnit.test("MOV M,E", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("E", 0x42);
      cpu.set("H", 0x20);
      cpu.set("L", 0x00);
      mem[0x0000] = 0x73;
      cpu.set("PC", 0x0000);
      cpu.steps(7);
      assert.equal(mem[0x2000], 0x42, "M = E");
    });

    QUnit.test("MOV M,H", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("H", 0x20);
      cpu.set("L", 0x00);
      mem[0x0000] = 0x74;
      cpu.set("PC", 0x0000);
      cpu.steps(7);
      assert.equal(mem[0x2000], 0x20, "M = H");
    });

    QUnit.test("MOV M,L", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("H", 0x20);
      cpu.set("L", 0x42);
      mem[0x0000] = 0x75;
      cpu.set("PC", 0x0000);
      cpu.steps(7);
      assert.equal(mem[0x2042], 0x42, "M = L");
    });

    QUnit.test("MOV M,A", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x42);
      cpu.set("H", 0x20);
      cpu.set("L", 0x00);
      mem[0x0000] = 0x77;
      cpu.set("PC", 0x0000);
      cpu.steps(7);
      assert.equal(mem[0x2000], 0x42, "M = A");
    });

    // MOV A,x
    QUnit.test("MOV A,B", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("B", 0x42);
      mem[0x0000] = 0x78;
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().a, 0x42, "A = B");
    });

    QUnit.test("MOV A,C", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("C", 0x42);
      mem[0x0000] = 0x79;
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().a, 0x42, "A = C");
    });

    QUnit.test("MOV A,D", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("D", 0x42);
      mem[0x0000] = 0x7A;
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().a, 0x42, "A = D");
    });

    QUnit.test("MOV A,E", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("E", 0x42);
      mem[0x0000] = 0x7B;
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().a, 0x42, "A = E");
    });

    QUnit.test("MOV A,H", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("H", 0x42);
      mem[0x0000] = 0x7C;
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().a, 0x42, "A = H");
    });

    QUnit.test("MOV A,L", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("L", 0x42);
      mem[0x0000] = 0x7D;
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().a, 0x42, "A = L");
    });

    QUnit.test("MOV A,M", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("H", 0x20);
      cpu.set("L", 0x00);
      mem[0x2000] = 0x42;
      mem[0x0000] = 0x7E;
      cpu.set("PC", 0x0000);
      cpu.steps(7);
      assert.equal(cpu.status().a, 0x42, "A = M");
    });

    QUnit.test("MOV A,A", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x42);
      mem[0x0000] = 0x7F;
      cpu.set("PC", 0x0000);
      cpu.steps(5);
      assert.equal(cpu.status().a, 0x42, "A = A");
    });
  });
});
