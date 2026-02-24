/**
 * Motorola 6809 CPU Emulator - Comprehensive Tests
 *
 * Test suite covering MC6809 instructions, PostByte addressing modes,
 * and advanced features (TFR/EXG, LEA, MUL, dual stacks).
 */

import QUnit from "qunit";
import CPU6809 from "../src/6809.js";

QUnit.module("Motorola 6809 CPU Emulator", () => {
  /**
   * Helper: Create CPU with test memory
   */
  const createTestCPU = () => {
    const mem = new Uint8Array(65536);

    // Set reset vector to 0x1000
    mem[0xFFFE] = 0x10;
    mem[0xFFFF] = 0x00;

    const cpu = CPU6809();
    cpu.init(
      (addr, val) => { mem[addr] = val & 0xFF; },
      (addr) => mem[addr] || 0
    );

    return { cpu, mem };
  };

  QUnit.module("Initialization and Reset", () => {
    QUnit.test("CPU initializes with correct default values", (assert) => {
      const { cpu } = createTestCPU();

      const state = cpu.status();
      assert.equal(state.pc, 0x1000, "PC loaded from reset vector");
      assert.ok(state.flags & 0x50, "IRQ and FIRQ masks set after reset");
    });

    QUnit.test("Reset vector loaded correctly", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0xFFFE] = 0x80;
      mem[0xFFFF] = 0x00;

      cpu.reset();

      assert.equal(cpu.status().pc, 0x8000, "PC = reset vector");
    });
  });

  QUnit.module("Basic Load/Store Instructions", () => {
    QUnit.test("LDA immediate - Load A", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDA immediate
      mem[0x1001] = 0x42;

      cpu.steps(2);

      assert.equal(cpu.status().a, 0x42, "A = 0x42");
    });

    QUnit.test("LDB immediate - Load B", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xC6; // LDB immediate
      mem[0x1001] = 0x55;

      cpu.steps(2);

      assert.equal(cpu.status().b, 0x55, "B = 0x55");
    });

    QUnit.test("LDD immediate - Load D (16-bit)", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xCC; // LDD immediate
      mem[0x1001] = 0x12;
      mem[0x1002] = 0x34;

      cpu.steps(3);

      const state = cpu.status();
      assert.equal(state.a, 0x12, "A (high byte) = 0x12");
      assert.equal(state.b, 0x34, "B (low byte) = 0x34");
    });

    QUnit.test("LDX immediate - Load X", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x8E; // LDX immediate
      mem[0x1001] = 0xAB;
      mem[0x1002] = 0xCD;

      cpu.steps(3);

      assert.equal(cpu.status().x, 0xABCD, "X = 0xABCD");
    });

    QUnit.test("LDY immediate - Load Y", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x10; // Page 2 prefix
      mem[0x1001] = 0x8E; // LDY immediate
      mem[0x1002] = 0x12;
      mem[0x1003] = 0x34;

      cpu.steps(4);

      assert.equal(cpu.status().y, 0x1234, "Y = 0x1234");
    });

    QUnit.test("LDU immediate - Load U", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xCE; // LDU immediate
      mem[0x1001] = 0x56;
      mem[0x1002] = 0x78;

      cpu.steps(3);

      assert.equal(cpu.status().u, 0x5678, "U = 0x5678");
    });

    QUnit.test("LDS immediate - Load S", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x10; // Page 2 prefix
      mem[0x1001] = 0xCE; // LDS immediate
      mem[0x1002] = 0xF0;
      mem[0x1003] = 0x00;

      cpu.steps(4);

      assert.equal(cpu.status().sp, 0xF000, "S = 0xF000");
    });
  });

  QUnit.module("Arithmetic Operations", () => {
    QUnit.test("ADDA - Add to A", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDA immediate
      mem[0x1001] = 0x10;
      mem[0x1002] = 0x8B; // ADDA immediate
      mem[0x1003] = 0x20;

      cpu.steps(2); // LDA
      cpu.steps(2); // ADDA

      assert.equal(cpu.status().a, 0x30, "A = 0x10 + 0x20 = 0x30");
    });

    QUnit.test("ADDB - Add to B", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xC6; // LDB immediate
      mem[0x1001] = 0x05;
      mem[0x1002] = 0xCB; // ADDB immediate
      mem[0x1003] = 0x03;

      cpu.steps(2); // LDB
      cpu.steps(2); // ADDB

      assert.equal(cpu.status().b, 0x08, "B = 0x05 + 0x03 = 0x08");
    });

    QUnit.test("ADDD - Add to D (16-bit)", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xCC; // LDD immediate
      mem[0x1001] = 0x10;
      mem[0x1002] = 0x00;
      mem[0x1003] = 0xC3; // ADDD immediate
      mem[0x1004] = 0x00;
      mem[0x1005] = 0x50;

      cpu.steps(3); // LDD
      cpu.steps(4); // ADDD

      const d = (cpu.status().a << 8) | cpu.status().b;
      assert.equal(d, 0x1050, "D = 0x1000 + 0x0050 = 0x1050");
    });

    QUnit.test("SUBA - Subtract from A", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDA immediate
      mem[0x1001] = 0x50;
      mem[0x1002] = 0x80; // SUBA immediate
      mem[0x1003] = 0x30;

      cpu.steps(2); // LDA
      cpu.steps(2); // SUBA

      assert.equal(cpu.status().a, 0x20, "A = 0x50 - 0x30 = 0x20");
    });

    QUnit.test("MUL - Multiply A * B", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDA immediate
      mem[0x1001] = 0x05;
      mem[0x1002] = 0xC6; // LDB immediate
      mem[0x1003] = 0x06;
      mem[0x1004] = 0x3D; // MUL

      cpu.steps(2); // LDA
      cpu.steps(2); // LDB
      cpu.steps(11); // MUL (11 cycles)

      const d = (cpu.status().a << 8) | cpu.status().b;
      assert.equal(d, 0x001E, "D = 5 * 6 = 30 (0x001E)");
    });
  });

  QUnit.module("TFR/EXG Instructions", () => {
    QUnit.test("TFR X,Y - Transfer 16-bit", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x8E; // LDX immediate
      mem[0x1001] = 0x12;
      mem[0x1002] = 0x34;
      mem[0x1003] = 0x1F; // TFR
      mem[0x1004] = 0x12; // X->Y

      cpu.steps(3); // LDX
      cpu.steps(6); // TFR

      const state = cpu.status();
      assert.equal(state.x, 0x1234, "X = 0x1234");
      assert.equal(state.y, 0x1234, "Y = X");
    });

    QUnit.test("TFR A,B - Transfer 8-bit", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDA immediate
      mem[0x1001] = 0xAB;
      mem[0x1002] = 0x1F; // TFR
      mem[0x1003] = 0x89; // A->B

      cpu.steps(2); // LDA
      cpu.steps(6); // TFR

      const state = cpu.status();
      assert.equal(state.a, 0xAB, "A = 0xAB");
      assert.equal(state.b, 0xAB, "B = A");
    });

    QUnit.test("EXG X,Y - Exchange 16-bit", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x8E; // LDX immediate
      mem[0x1001] = 0x11;
      mem[0x1002] = 0x11;
      mem[0x1003] = 0x10; // Page 2
      mem[0x1004] = 0x8E; // LDY immediate
      mem[0x1005] = 0x22;
      mem[0x1006] = 0x22;
      mem[0x1007] = 0x1E; // EXG
      mem[0x1008] = 0x12; // X<->Y

      cpu.steps(3); // LDX
      cpu.steps(4); // LDY
      cpu.steps(8); // EXG

      const state = cpu.status();
      assert.equal(state.x, 0x2222, "X = 0x2222 (was Y)");
      assert.equal(state.y, 0x1111, "Y = 0x1111 (was X)");
    });
  });

  QUnit.module("Stack Operations", () => {
    QUnit.test("PSHS - Push multiple registers to S", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x10; // Page 2
      mem[0x1001] = 0xCE; // LDS immediate
      mem[0x1002] = 0xF0;
      mem[0x1003] = 0x00;
      mem[0x1004] = 0x86; // LDA immediate
      mem[0x1005] = 0x42;
      mem[0x1006] = 0xC6; // LDB immediate
      mem[0x1007] = 0x55;
      mem[0x1008] = 0x34; // PSHS
      mem[0x1009] = 0x06; // Push A,B

      cpu.steps(4); // LDS
      cpu.steps(2); // LDA
      cpu.steps(2); // LDB
      cpu.steps(5); // PSHS

      const state = cpu.status();
      assert.equal(mem[0xEFFF], 0x55, "B pushed to stack");
      assert.equal(mem[0xEFFE], 0x42, "A pushed to stack");
      assert.equal(state.sp, 0xEFFE, "S decremented by 2");
    });

    QUnit.test("PULS - Pull multiple registers from S", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0xEFFE] = 0x11; // B on stack
      mem[0xEFFF] = 0x22; // A on stack

      mem[0x1000] = 0x10; // Page 2
      mem[0x1001] = 0xCE; // LDS immediate
      mem[0x1002] = 0xEF;
      mem[0x1003] = 0xFE;
      mem[0x1004] = 0x35; // PULS
      mem[0x1005] = 0x06; // Pull A,B

      cpu.steps(4); // LDS
      cpu.steps(5); // PULS

      const state = cpu.status();
      assert.equal(state.a, 0x11, "A pulled from stack");
      assert.equal(state.b, 0x22, "B pulled from stack");
      assert.equal(state.sp, 0xF000, "S incremented by 2");
    });
  });

  QUnit.module("Branch Instructions", () => {
    QUnit.test("BRA - Branch always", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x20; // BRA
      mem[0x1001] = 0x10; // offset +16

      cpu.steps(3);

      assert.equal(cpu.status().pc, 0x1012, "PC = 0x1000 + 2 + 0x10");
    });

    QUnit.test("BEQ - Branch if equal (taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDA immediate
      mem[0x1001] = 0x00;
      mem[0x1002] = 0x27; // BEQ
      mem[0x1003] = 0x05; // offset +5

      cpu.steps(2); // LDA sets Z flag
      cpu.steps(3); // BEQ

      assert.equal(cpu.status().pc, 0x1009, "Branch taken");
    });

    QUnit.test("BNE - Branch if not equal (not taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86; // LDA immediate
      mem[0x1001] = 0x00; // Sets Z flag
      mem[0x1002] = 0x26; // BNE
      mem[0x1003] = 0x10;

      cpu.steps(2); // LDA
      cpu.steps(3); // BNE

      assert.equal(cpu.status().pc, 0x1004, "Branch not taken (Z=1)");
    });

    QUnit.test("LBRA - Long branch", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x16; // LBRA
      mem[0x1001] = 0x01; // offset high
      mem[0x1002] = 0x00; // offset low (+256)

      cpu.steps(5);

      assert.equal(cpu.status().pc, 0x1103, "PC = 0x1000 + 3 + 0x0100");
    });
  });

  QUnit.module("LEA Instructions", () => {
    QUnit.test("LEAX - Load effective address into X", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x30; // LEAX
      mem[0x1001] = 0x8C; // PC-relative

      cpu.steps(4);

      // LEAX loads address, not content
      assert.ok(cpu.status().x !== 0, "X loaded with address");
    });

    QUnit.test("LEAY - Load effective address into Y", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x31; // LEAY
      mem[0x1001] = 0x88; // offset

      cpu.steps(4);

      assert.ok(cpu.status().y !== 0, "Y loaded with address");
    });
  });

  QUnit.module("Disassembler (for coverage)", () => {
    QUnit.test("Inherent mode instructions", (assert) => {
      const dis = cpu => cpu.disasm;
      const { cpu } = createTestCPU();

      // 8-bit accumulator operations (inherent = 1 byte)
      assert.deepEqual(cpu.disasm(0x12, 0, 0, 0, 0, 0x1000), ["NOP", 1], "NOP");
      assert.deepEqual(cpu.disasm(0x3D, 0, 0, 0, 0, 0x1000), ["MUL", 1], "MUL");
      assert.deepEqual(cpu.disasm(0x1D, 0, 0, 0, 0, 0x1000), ["SEX", 1], "SEX");
      assert.deepEqual(cpu.disasm(0x3A, 0, 0, 0, 0, 0x1000), ["ABX", 1], "ABX");
      assert.deepEqual(cpu.disasm(0x39, 0, 0, 0, 0, 0x1000), ["RTS", 1], "RTS");
      assert.deepEqual(cpu.disasm(0x3B, 0, 0, 0, 0, 0x1000), ["RTI", 1], "RTI");
    });

    QUnit.test("Immediate mode 8-bit", (assert) => {
      const { cpu } = createTestCPU();

      assert.deepEqual(cpu.disasm(0x86, 0x42, 0, 0, 0, 0x1000), ["LDA #$42", 2], "LDA immediate");
      assert.deepEqual(cpu.disasm(0xC6, 0x55, 0, 0, 0, 0x1000), ["LDB #$55", 2], "LDB immediate");
      assert.deepEqual(cpu.disasm(0x8B, 0x10, 0, 0, 0, 0x1000), ["ADDA #$10", 2], "ADDA immediate");
      assert.deepEqual(cpu.disasm(0xCB, 0x20, 0, 0, 0, 0x1000), ["ADDB #$20", 2], "ADDB immediate");
      assert.deepEqual(cpu.disasm(0x80, 0x30, 0, 0, 0, 0x1000), ["SUBA #$30", 2], "SUBA immediate");
      assert.deepEqual(cpu.disasm(0xC0, 0x40, 0, 0, 0, 0x1000), ["SUBB #$40", 2], "SUBB immediate");
    });

    QUnit.test("Immediate mode 16-bit", (assert) => {
      const { cpu } = createTestCPU();

      assert.deepEqual(cpu.disasm(0xCC, 0x12, 0x34, 0, 0, 0x1000), ["LDD #$1234", 3], "LDD immediate");
      assert.deepEqual(cpu.disasm(0x8E, 0xAB, 0xCD, 0, 0, 0x1000), ["LDX #$ABCD", 3], "LDX immediate");
      assert.deepEqual(cpu.disasm(0xCE, 0x56, 0x78, 0, 0, 0x1000), ["LDU #$5678", 3], "LDU immediate");
      assert.deepEqual(cpu.disasm(0xC3, 0x00, 0x50, 0, 0, 0x1000), ["ADDD #$0050", 3], "ADDD immediate");
      assert.deepEqual(cpu.disasm(0x83, 0x00, 0x10, 0, 0, 0x1000), ["SUBD #$0010", 3], "SUBD immediate");
      assert.deepEqual(cpu.disasm(0x8C, 0x12, 0x34, 0, 0, 0x1000), ["CMPX #$1234", 3], "CMPX immediate");
    });

    QUnit.test("Page 2 (0x10) prefix instructions", (assert) => {
      const { cpu } = createTestCPU();

      assert.deepEqual(cpu.disasm(0x10, 0x8E, 0x12, 0x34, 0, 0x1000), ["LDY #$1234", 4], "LDY immediate");
      assert.deepEqual(cpu.disasm(0x10, 0xCE, 0xF0, 0x00, 0, 0x1000), ["LDS #$F000", 4], "LDS immediate");
      assert.deepEqual(cpu.disasm(0x10, 0x83, 0x00, 0x10, 0, 0x1000), ["CMPD #$0010", 4], "CMPD immediate");
      assert.deepEqual(cpu.disasm(0x10, 0x8C, 0xAB, 0xCD, 0, 0x1000), ["CMPY #$ABCD", 4], "CMPY immediate");
    });

    QUnit.test("Page 3 (0x11) prefix instructions", (assert) => {
      const { cpu } = createTestCPU();

      assert.deepEqual(cpu.disasm(0x11, 0x83, 0x00, 0x20, 0, 0x1000), ["CMPU #$0020", 4], "CMPU immediate");
      assert.deepEqual(cpu.disasm(0x11, 0x8C, 0x56, 0x78, 0, 0x1000), ["CMPS #$5678", 4], "CMPS immediate");
    });

    QUnit.test("Direct page addressing", (assert) => {
      const { cpu } = createTestCPU();

      assert.deepEqual(cpu.disasm(0x96, 0x50, 0, 0, 0, 0x1000), ["LDA $50", 4], "LDA direct");
      assert.deepEqual(cpu.disasm(0xD6, 0x60, 0, 0, 0, 0x1000), ["LDB $60", 4], "LDB direct");
      assert.deepEqual(cpu.disasm(0x97, 0x70, 0, 0, 0, 0x1000), ["STA $70", 4], "STA direct");
      assert.deepEqual(cpu.disasm(0xD7, 0x80, 0, 0, 0, 0x1000), ["STB $80", 4], "STB direct");
    });

    QUnit.test("Branch instructions", (assert) => {
      const { cpu } = createTestCPU();

      assert.deepEqual(cpu.disasm(0x20, 0x10, 0, 0, 0, 0x1000), ["BRA #$1012", 3], "BRA");
      assert.deepEqual(cpu.disasm(0x27, 0x05, 0, 0, 0, 0x1000), ["BEQ #$1007", 3], "BEQ");
      assert.deepEqual(cpu.disasm(0x26, 0x08, 0, 0, 0, 0x1000), ["BNE #$100A", 3], "BNE");
      assert.deepEqual(cpu.disasm(0x2C, 0xFE, 0, 0, 0, 0x1000), ["BGE #$1000", 3], "BGE backward");
      assert.deepEqual(cpu.disasm(0x2D, 0xFC, 0, 0, 0, 0x1000), ["BLT #$0FFE", 3], "BLT backward");
      assert.deepEqual(cpu.disasm(0x22, 0x03, 0, 0, 0, 0x1000), ["BHI #$1005", 3], "BHI");
      assert.deepEqual(cpu.disasm(0x23, 0x04, 0, 0, 0, 0x1000), ["BLS #$1006", 3], "BLS");
      assert.deepEqual(cpu.disasm(0x24, 0x02, 0, 0, 0, 0x1000), ["BCC #$1004", 3], "BCC");
      assert.deepEqual(cpu.disasm(0x25, 0x06, 0, 0, 0, 0x1000), ["BCS #$1008", 3], "BCS");
    });

    QUnit.test("TFR/EXG with register codes", (assert) => {
      const { cpu } = createTestCPU();

      assert.deepEqual(cpu.disasm(0x1F, 0x12, 0, 0, 0, 0x1000), ["TFR X,Y", 6], "TFR X,Y");
      assert.deepEqual(cpu.disasm(0x1F, 0x89, 0, 0, 0, 0x1000), ["TFR A,B", 6], "TFR A,B");
      assert.deepEqual(cpu.disasm(0x1E, 0x12, 0, 0, 0, 0x1000), ["EXG X,Y", 8], "EXG X,Y");
      assert.deepEqual(cpu.disasm(0x1E, 0x34, 0, 0, 0, 0x1000), ["EXG U,S", 8], "EXG U,S");
    });

    QUnit.test("LEA instructions", (assert) => {
      const { cpu } = createTestCPU();

      assert.deepEqual(cpu.disasm(0x30, 0x88, 0, 0, 0, 0x1000)[0], "LEAX ", "LEAX (starts with)");
      assert.deepEqual(cpu.disasm(0x31, 0x88, 0, 0, 0, 0x1000)[0], "LEAY ", "LEAY (starts with)");
      assert.deepEqual(cpu.disasm(0x32, 0x88, 0, 0, 0, 0x1000)[0], "LEAS ", "LEAS (starts with)");
      assert.deepEqual(cpu.disasm(0x33, 0x88, 0, 0, 0, 0x1000)[0], "LEAU ", "LEAU (starts with)");
    });

    QUnit.test("PSH/PUL with register masks", (assert) => {
      const { cpu } = createTestCPU();

      const pshsResult = cpu.disasm(0x34, 0x06, 0, 0, 0, 0x1000);
      assert.ok(pshsResult[0].startsWith("PSHS"), "PSHS instruction");

      const pulsResult = cpu.disasm(0x35, 0x06, 0, 0, 0, 0x1000);
      assert.ok(pulsResult[0].startsWith("PULS"), "PULS instruction");

      const pshuResult = cpu.disasm(0x36, 0x30, 0, 0, 0, 0x1000);
      assert.ok(pshuResult[0].startsWith("PSHU"), "PSHU instruction");

      const puluResult = cpu.disasm(0x37, 0x30, 0, 0, 0, 0x1000);
      assert.ok(puluResult[0].startsWith("PULU"), "PULU instruction");
    });
  });
});
