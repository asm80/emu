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

      assert.deepEqual(cpu.disasm(0x96, 0x50, 0, 0, 0, 0x1000), ["LDA $50", 2], "LDA direct");
      assert.deepEqual(cpu.disasm(0xD6, 0x60, 0, 0, 0, 0x1000), ["LDB $60", 2], "LDB direct");
      assert.deepEqual(cpu.disasm(0x97, 0x70, 0, 0, 0, 0x1000), ["STA $70", 2], "STA direct");
      assert.deepEqual(cpu.disasm(0xD7, 0x80, 0, 0, 0, 0x1000), ["STB $80", 2], "STB direct");
    });

    QUnit.test("Branch instructions", (assert) => {
      const { cpu } = createTestCPU();

      assert.deepEqual(cpu.disasm(0x20, 0x10, 0, 0, 0, 0x1000), ["BRA #$1012", 2], "BRA");
      assert.deepEqual(cpu.disasm(0x27, 0x05, 0, 0, 0, 0x1000), ["BEQ #$1007", 2], "BEQ");
      assert.deepEqual(cpu.disasm(0x26, 0x08, 0, 0, 0, 0x1000), ["BNE #$100A", 2], "BNE");
      assert.deepEqual(cpu.disasm(0x2C, 0xFE, 0, 0, 0, 0x1000), ["BGE #$1000", 2], "BGE backward");
      assert.deepEqual(cpu.disasm(0x2D, 0xFC, 0, 0, 0, 0x1000), ["BLT #$0FFE", 2], "BLT backward");
      assert.deepEqual(cpu.disasm(0x22, 0x03, 0, 0, 0, 0x1000), ["BHI #$1005", 2], "BHI");
      assert.deepEqual(cpu.disasm(0x23, 0x04, 0, 0, 0, 0x1000), ["BLS #$1006", 2], "BLS");
      assert.deepEqual(cpu.disasm(0x24, 0x02, 0, 0, 0, 0x1000), ["BCC #$1004", 2], "BCC");
      assert.deepEqual(cpu.disasm(0x25, 0x06, 0, 0, 0, 0x1000), ["BCS #$1008", 2], "BCS");
    });

    QUnit.test("TFR/EXG with register codes", (assert) => {
      const { cpu } = createTestCPU();

      assert.deepEqual(cpu.disasm(0x1F, 0x12, 0, 0, 0, 0x1000), ["TFR X,Y", 2], "TFR X,Y");
      assert.deepEqual(cpu.disasm(0x1F, 0x89, 0, 0, 0, 0x1000), ["TFR A,B", 2], "TFR A,B");
      assert.deepEqual(cpu.disasm(0x1E, 0x12, 0, 0, 0, 0x1000), ["EXG X,Y", 2], "EXG X,Y");
      assert.deepEqual(cpu.disasm(0x1E, 0x34, 0, 0, 0, 0x1000), ["EXG U,S", 2], "EXG U,S");
    });

    QUnit.test("LEA instructions", (assert) => {
      const { cpu } = createTestCPU();

      assert.ok(cpu.disasm(0x30, 0x88, 0, 0, 0, 0x1000)[0].startsWith("LEAX "), "LEAX (starts with)");
      assert.ok(cpu.disasm(0x31, 0x88, 0, 0, 0, 0x1000)[0].startsWith("LEAY "), "LEAY (starts with)");
      assert.ok(cpu.disasm(0x32, 0x88, 0, 0, 0, 0x1000)[0].startsWith("LEAS "), "LEAS (starts with)");
      assert.ok(cpu.disasm(0x33, 0x88, 0, 0, 0, 0x1000)[0].startsWith("LEAU "), "LEAU (starts with)");
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

  QUnit.module("Direct Page Addressing", () => {
    QUnit.test("LDA direct - load from direct page", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0050] = 0x42;      // Data at direct page address
      mem[0x1000] = 0x96;      // LDA direct
      mem[0x1001] = 0x50;      // offset

      cpu.steps(4);
      assert.equal(cpu.status().a, 0x42, "A loaded from $0050");
    });

    QUnit.test("STA direct - store to direct page", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86;      // LDA immediate
      mem[0x1001] = 0x99;
      mem[0x1002] = 0x97;      // STA direct
      mem[0x1003] = 0x60;

      cpu.steps(6);
      assert.equal(mem[0x0060], 0x99, "Memory[0x0060] = 0x99");
    });

    QUnit.test("LDB direct - load B from direct page", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0070] = 0x33;
      mem[0x1000] = 0xD6;      // LDB direct
      mem[0x1001] = 0x70;

      cpu.steps(4);
      assert.equal(cpu.status().b, 0x33, "B loaded from $0070");
    });

    QUnit.test("STB direct - store B to direct page", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xC6;      // LDB immediate
      mem[0x1001] = 0x77;
      mem[0x1002] = 0xD7;      // STB direct
      mem[0x1003] = 0x80;

      cpu.steps(6);
      assert.equal(mem[0x0080], 0x77, "Memory[0x0080] = 0x77");
    });
  });

  QUnit.module("Extended Addressing", () => {
    QUnit.test("LDA extended - load from 16-bit address", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x2000] = 0xAB;
      mem[0x1000] = 0xB6;      // LDA extended
      mem[0x1001] = 0x20;
      mem[0x1002] = 0x00;

      cpu.steps(5);
      assert.equal(cpu.status().a, 0xAB, "A loaded from $2000");
    });

    QUnit.test("STA extended - store to 16-bit address", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86;      // LDA immediate
      mem[0x1001] = 0x55;
      mem[0x1002] = 0xB7;      // STA extended
      mem[0x1003] = 0x30;
      mem[0x1004] = 0x00;

      cpu.steps(7);
      assert.equal(mem[0x3000], 0x55, "Memory[0x3000] = 0x55");
    });

    QUnit.test("LDB extended - load B from 16-bit address", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x4000] = 0xCD;
      mem[0x1000] = 0xF6;      // LDB extended
      mem[0x1001] = 0x40;
      mem[0x1002] = 0x00;

      cpu.steps(5);
      assert.equal(cpu.status().b, 0xCD, "B loaded from $4000");
    });

    QUnit.test("STB extended - store B to 16-bit address", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xC6;      // LDB immediate
      mem[0x1001] = 0xEF;
      mem[0x1002] = 0xF7;      // STB extended
      mem[0x1003] = 0x50;
      mem[0x1004] = 0x00;

      cpu.steps(7);
      assert.equal(mem[0x5000], 0xEF, "Memory[0x5000] = 0xEF");
    });

    QUnit.test("LDX extended - load X from 16-bit address", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x2000] = 0x12;
      mem[0x2001] = 0x34;
      mem[0x1000] = 0xBE;      // LDX extended
      mem[0x1001] = 0x20;
      mem[0x1002] = 0x00;

      cpu.steps(5);
      assert.equal(cpu.status().x, 0x1234, "X loaded from $2000");
    });

    QUnit.test("STX extended - store X to 16-bit address", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x8E;      // LDX immediate
      mem[0x1001] = 0xAB;
      mem[0x1002] = 0xCD;
      mem[0x1003] = 0xBF;      // STX extended
      mem[0x1004] = 0x60;
      mem[0x1005] = 0x00;

      cpu.steps(8);
      assert.equal(mem[0x6000], 0xAB, "High byte stored");
      assert.equal(mem[0x6001], 0xCD, "Low byte stored");
    });
  });

  QUnit.module("Indexed Addressing", () => {
    QUnit.test("LDA indexed ,X - load via X register", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x2000] = 0x77;
      // LDX #$2000, then LDA ,X (postbyte 0x84 = ,X no offset)
      mem[0x1000] = 0x8E;      // LDX immediate
      mem[0x1001] = 0x20;
      mem[0x1002] = 0x00;
      mem[0x1003] = 0xA6;      // LDA indexed
      mem[0x1004] = 0x84;      // postbyte: ,X (register direct)

      cpu.steps(8);
      assert.equal(cpu.status().a, 0x77, "A loaded via X");
    });

    QUnit.test("STA indexed ,X - store via X register", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86;      // LDA immediate
      mem[0x1001] = 0x42;
      mem[0x1002] = 0x8E;      // LDX immediate
      mem[0x1003] = 0x30;
      mem[0x1004] = 0x00;
      mem[0x1005] = 0xA7;      // STA indexed
      mem[0x1006] = 0x84;      // postbyte: ,X

      cpu.steps(11);
      assert.equal(mem[0x3000], 0x42, "A stored via X");
    });

    QUnit.test("LDA indexed ,X+ (post-increment)", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x2000] = 0x55;
      mem[0x1000] = 0x8E;      // LDX #$2000
      mem[0x1001] = 0x20;
      mem[0x1002] = 0x00;
      mem[0x1003] = 0xA6;      // LDA indexed
      mem[0x1004] = 0x80;      // postbyte: ,X+

      cpu.steps(8);
      const state = cpu.status();
      assert.equal(state.a, 0x55, "A loaded");
      assert.equal(state.x, 0x2001, "X post-incremented");
    });

    QUnit.test("LDB indexed ,Y - load B via Y register", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x4000] = 0xCC;
      // LDY #$4000
      mem[0x1000] = 0x10;      // Page 2 prefix
      mem[0x1001] = 0x8E;      // LDY immediate
      mem[0x1002] = 0x40;
      mem[0x1003] = 0x00;
      mem[0x1004] = 0xE6;      // LDB indexed
      mem[0x1005] = 0xA4;      // postbyte: ,Y

      cpu.steps(9);
      assert.equal(cpu.status().b, 0xCC, "B loaded via Y");
    });

    QUnit.test("LDA indexed with 8-bit offset from X", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x2005] = 0x88;
      mem[0x1000] = 0x8E;      // LDX #$2000
      mem[0x1001] = 0x20;
      mem[0x1002] = 0x00;
      mem[0x1003] = 0xA6;      // LDA indexed
      mem[0x1004] = 0x88;      // postbyte: 8-bit offset from X
      mem[0x1005] = 0x05;      // offset = +5

      cpu.steps(9);
      assert.equal(cpu.status().a, 0x88, "A loaded at X+5");
    });
  });

  QUnit.module("Conditional Branches", () => {
    QUnit.test("BCC - Branch if carry clear (taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      // Clear carry with ANDCC
      mem[0x1000] = 0x1C;      // ANDCC
      mem[0x1001] = 0xFE;      // clear carry bit
      mem[0x1002] = 0x24;      // BCC
      mem[0x1003] = 0x05;      // offset +5

      cpu.steps(1);
      cpu.steps(1);
      assert.equal(cpu.status().pc, 0x1009, "Branch taken to 0x1009");
    });

    QUnit.test("BCS - Branch if carry set (taken)", (assert) => {
      const { cpu, mem } = createTestCPU();

      // Set carry with ORCC
      mem[0x1000] = 0x1A;      // ORCC
      mem[0x1001] = 0x01;      // set carry bit
      mem[0x1002] = 0x25;      // BCS
      mem[0x1003] = 0x05;      // offset +5

      cpu.steps(1);
      cpu.steps(1);
      assert.equal(cpu.status().pc, 0x1009, "Branch taken to 0x1009");
    });

    QUnit.test("BGT - Branch if greater than", (assert) => {
      const { cpu, mem } = createTestCPU();

      // Clear N, V, Z flags (result is positive, non-zero)
      mem[0x1000] = 0x1C;      // ANDCC
      mem[0x1001] = 0x8F;      // clear N, V, Z
      mem[0x1002] = 0x2E;      // BGT
      mem[0x1003] = 0x04;      // offset +4

      cpu.steps(1);
      cpu.steps(1);
      assert.equal(cpu.status().pc, 0x1008, "BGT taken to 0x1008");
    });

    QUnit.test("BLE - Branch if less or equal (Z set)", (assert) => {
      const { cpu, mem } = createTestCPU();

      // Set Z flag
      mem[0x1000] = 0x1A;      // ORCC
      mem[0x1001] = 0x04;      // set Z bit
      mem[0x1002] = 0x2F;      // BLE
      mem[0x1003] = 0x04;      // offset +4

      cpu.steps(1);
      cpu.steps(1);
      assert.equal(cpu.status().pc, 0x1008, "BLE taken when Z set");
    });

    QUnit.test("LBSR - Long branch to subroutine", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x17;      // LBSR
      mem[0x1001] = 0x00;      // offset high
      mem[0x1002] = 0x10;      // offset low = +16

      cpu.steps(9);
      assert.equal(cpu.status().pc, 0x1013, "LBSR jumped to 0x1013");
    });
  });

  QUnit.module("ALU Direct/Extended Operations", () => {
    QUnit.test("ADDA direct - add from memory", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0020] = 0x10;
      mem[0x1000] = 0x86;      // LDA #$20
      mem[0x1001] = 0x20;
      mem[0x1002] = 0x9B;      // ADDA direct
      mem[0x1003] = 0x20;

      cpu.steps(6);
      assert.equal(cpu.status().a, 0x30, "A = 0x20 + 0x10 = 0x30");
    });

    QUnit.test("CMPA extended - compare A with memory", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x3000] = 0x42;
      mem[0x1000] = 0x86;      // LDA #$42
      mem[0x1001] = 0x42;
      mem[0x1002] = 0xB1;      // CMPA extended
      mem[0x1003] = 0x30;
      mem[0x1004] = 0x00;

      cpu.steps(7);
      const state = cpu.status();
      assert.ok(state.flags & 0x04, "Zero flag set when A == mem");
      assert.equal(state.a, 0x42, "A unchanged after CMP");
    });

    QUnit.test("ANDA direct - AND A with memory", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0030] = 0x0F;
      mem[0x1000] = 0x86;      // LDA #$FF
      mem[0x1001] = 0xFF;
      mem[0x1002] = 0x94;      // ANDA direct
      mem[0x1003] = 0x30;

      cpu.steps(6);
      assert.equal(cpu.status().a, 0x0F, "A = 0xFF AND 0x0F = 0x0F");
    });

    QUnit.test("ORAA direct - OR A with memory", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0040] = 0x0F;
      mem[0x1000] = 0x86;      // LDA #$F0
      mem[0x1001] = 0xF0;
      mem[0x1002] = 0x9A;      // ORA direct
      mem[0x1003] = 0x40;

      cpu.steps(6);
      assert.equal(cpu.status().a, 0xFF, "A = 0xF0 OR 0x0F = 0xFF");
    });

    QUnit.test("NEG direct - negate memory byte", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0050] = 0x05;
      mem[0x1000] = 0x00;      // NEG direct
      mem[0x1001] = 0x50;

      cpu.steps(6);
      assert.equal(mem[0x0050], 0xFB, "Memory negated: 0x05 -> 0xFB");
    });

    QUnit.test("INC direct - increment memory byte", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0060] = 0x0A;
      mem[0x1000] = 0x0C;      // INC direct
      mem[0x1001] = 0x60;

      cpu.steps(6);
      assert.equal(mem[0x0060], 0x0B, "Memory incremented: 0x0A -> 0x0B");
    });

    QUnit.test("DEC direct - decrement memory byte", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0070] = 0x0A;
      mem[0x1000] = 0x0A;      // DEC direct
      mem[0x1001] = 0x70;

      cpu.steps(6);
      assert.equal(mem[0x0070], 0x09, "Memory decremented: 0x0A -> 0x09");
    });

    QUnit.test("ASL direct - arithmetic shift left", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0080] = 0x01;
      mem[0x1000] = 0x08;      // ASL direct
      mem[0x1001] = 0x80;

      cpu.steps(6);
      assert.equal(mem[0x0080], 0x02, "Shifted left: 0x01 -> 0x02");
    });

    QUnit.test("LSR direct - logical shift right", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x0090] = 0x04;
      mem[0x1000] = 0x04;      // LSR direct
      mem[0x1001] = 0x90;

      cpu.steps(6);
      assert.equal(mem[0x0090], 0x02, "Shifted right: 0x04 -> 0x02");
    });

    QUnit.test("ROL direct - rotate left through carry", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x00A0] = 0x40;
      // Set carry
      mem[0x1000] = 0x1A;      // ORCC
      mem[0x1001] = 0x01;      // set C
      mem[0x1002] = 0x09;      // ROL direct
      mem[0x1003] = 0xA0;

      cpu.steps(6);
      assert.equal(mem[0x00A0], 0x81, "0x40 ROL with C=1 = 0x81");
    });

    QUnit.test("ROR direct - rotate right through carry", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x00B0] = 0x01;
      // Set carry
      mem[0x1000] = 0x1A;      // ORCC
      mem[0x1001] = 0x01;      // set C
      mem[0x1002] = 0x06;      // ROR direct
      mem[0x1003] = 0xB0;

      cpu.steps(6);
      assert.equal(mem[0x00B0], 0x80, "0x01 ROR with C=1 = 0x80");
    });

    QUnit.test("TST direct - test memory byte (flags only)", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x00C0] = 0x00;
      mem[0x1000] = 0x0D;      // TST direct
      mem[0x1001] = 0xC0;

      cpu.steps(6);
      assert.ok(cpu.status().flags & 0x04, "Zero flag set for zero value");
    });

    QUnit.test("CLR direct - clear memory byte", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x00D0] = 0xFF;
      mem[0x1000] = 0x0F;      // CLR direct
      mem[0x1001] = 0xD0;

      cpu.steps(6);
      assert.equal(mem[0x00D0], 0x00, "Memory cleared to 0");
    });

    QUnit.test("COM direct - complement memory byte", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x00E0] = 0xAA;
      mem[0x1000] = 0x03;      // COM direct
      mem[0x1001] = 0xE0;

      cpu.steps(6);
      assert.equal(mem[0x00E0], 0x55, "0xAA complemented to 0x55");
    });
  });

  QUnit.module("JMP/JSR Instructions", () => {
    QUnit.test("JMP direct - jump to direct page address", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x0E;      // JMP direct
      mem[0x1001] = 0x50;      // target $0050

      cpu.steps(3);
      assert.equal(cpu.status().pc, 0x0050, "PC = 0x0050");
    });

    QUnit.test("JMP extended - jump to 16-bit address", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x7E;      // JMP extended
      mem[0x1001] = 0x20;
      mem[0x1002] = 0x00;

      cpu.steps(4);
      assert.equal(cpu.status().pc, 0x2000, "PC = 0x2000");
    });

    QUnit.test("JSR direct - call subroutine at direct address", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x9D;      // JSR direct
      mem[0x1001] = 0x50;
      mem[0x0050] = 0x39;      // RTS

      cpu.steps(10);
      assert.equal(cpu.status().pc, 0x1002, "Returned to 0x1002 after RTS");
    });

    QUnit.test("JSR extended - call subroutine at 16-bit address", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xBD;      // JSR extended
      mem[0x1001] = 0x20;
      mem[0x1002] = 0x00;
      mem[0x2000] = 0x39;      // RTS

      cpu.steps(12);
      assert.equal(cpu.status().pc, 0x1003, "Returned to 0x1003 after RTS");
    });
  });

  QUnit.module("8-bit ALU Inherent Instructions", () => {
    QUnit.test("NEGA - Negate A", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86;      // LDA #5
      mem[0x1001] = 0x05;
      mem[0x1002] = 0x40;      // NEGA

      cpu.steps(4);
      assert.equal(cpu.status().a, 0xFB, "A = -5 = 0xFB");
    });

    QUnit.test("COMA - Complement A", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86;      // LDA #$AA
      mem[0x1001] = 0xAA;
      mem[0x1002] = 0x43;      // COMA

      cpu.steps(4);
      assert.equal(cpu.status().a, 0x55, "A complemented: 0xAA -> 0x55");
    });

    QUnit.test("LSRA - Logical shift right A", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86;      // LDA #4
      mem[0x1001] = 0x04;
      mem[0x1002] = 0x44;      // LSRA

      cpu.steps(4);
      assert.equal(cpu.status().a, 0x02, "A shifted right: 4 -> 2");
    });

    QUnit.test("RORA - Rotate right A through carry", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86;      // LDA #$01
      mem[0x1001] = 0x01;
      mem[0x1002] = 0x46;      // RORA

      cpu.steps(4);
      assert.ok(cpu.status().flags & 0x01, "Bit shifted into carry");
      assert.equal(cpu.status().a, 0x00, "A = 0 (bit shifted out)");
    });

    QUnit.test("ASRA - Arithmetic shift right A", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86;      // LDA #$80 (negative)
      mem[0x1001] = 0x80;
      mem[0x1002] = 0x47;      // ASRA

      cpu.steps(4);
      assert.equal(cpu.status().a, 0xC0, "Sign bit preserved: 0x80 -> 0xC0");
    });

    QUnit.test("ASLA - Arithmetic shift left A", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86;      // LDA #$01
      mem[0x1001] = 0x01;
      mem[0x1002] = 0x48;      // ASLA

      cpu.steps(4);
      assert.equal(cpu.status().a, 0x02, "A shifted left: 1 -> 2");
    });

    QUnit.test("ROLA - Rotate left A through carry", (assert) => {
      const { cpu, mem } = createTestCPU();

      // Set carry, then rotate
      mem[0x1000] = 0x86;      // LDA #$40
      mem[0x1001] = 0x40;
      mem[0x1002] = 0x1A;      // ORCC
      mem[0x1003] = 0x01;      // set C
      mem[0x1004] = 0x49;      // ROLA

      cpu.steps(7);
      assert.equal(cpu.status().a, 0x81, "0x40 ROLA with C=1 = 0x81");
    });

    QUnit.test("DECA - Decrement A", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86;      // LDA #5
      mem[0x1001] = 0x05;
      mem[0x1002] = 0x4A;      // DECA

      cpu.steps(4);
      assert.equal(cpu.status().a, 0x04, "A = 5 - 1 = 4");
    });

    QUnit.test("INCA - Increment A", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86;      // LDA #5
      mem[0x1001] = 0x05;
      mem[0x1002] = 0x4C;      // INCA

      cpu.steps(4);
      assert.equal(cpu.status().a, 0x06, "A = 5 + 1 = 6");
    });

    QUnit.test("TSTA - Test A (flags only)", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86;      // LDA #0
      mem[0x1001] = 0x00;
      mem[0x1002] = 0x4D;      // TSTA

      cpu.steps(4);
      assert.ok(cpu.status().flags & 0x04, "Zero flag set");
    });

    QUnit.test("CLRA - Clear A", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0x86;      // LDA #$FF
      mem[0x1001] = 0xFF;
      mem[0x1002] = 0x4F;      // CLRA

      cpu.steps(4);
      assert.equal(cpu.status().a, 0x00, "A cleared to 0");
    });

    QUnit.test("NEGB - Negate B", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xC6;      // LDB #3
      mem[0x1001] = 0x03;
      mem[0x1002] = 0x50;      // NEGB

      cpu.steps(4);
      assert.equal(cpu.status().b, 0xFD, "B = -3 = 0xFD");
    });

    QUnit.test("COMB - Complement B", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xC6;      // LDB #$0F
      mem[0x1001] = 0x0F;
      mem[0x1002] = 0x53;      // COMB

      cpu.steps(4);
      assert.equal(cpu.status().b, 0xF0, "B complemented: 0x0F -> 0xF0");
    });

    QUnit.test("INCB - Increment B", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xC6;      // LDB #9
      mem[0x1001] = 0x09;
      mem[0x1002] = 0x5C;      // INCB

      cpu.steps(4);
      assert.equal(cpu.status().b, 0x0A, "B = 9 + 1 = 0x0A");
    });

    QUnit.test("DECB - Decrement B", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xC6;      // LDB #9
      mem[0x1001] = 0x09;
      mem[0x1002] = 0x5A;      // DECB

      cpu.steps(4);
      assert.equal(cpu.status().b, 0x08, "B = 9 - 1 = 8");
    });

    QUnit.test("CLRB - Clear B", (assert) => {
      const { cpu, mem } = createTestCPU();

      mem[0x1000] = 0xC6;      // LDB #$FF
      mem[0x1001] = 0xFF;
      mem[0x1002] = 0x5F;      // CLRB

      cpu.steps(4);
      assert.equal(cpu.status().b, 0x00, "B cleared to 0");
    });
  });
});
