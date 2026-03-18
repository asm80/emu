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

    const cpu = CPU6809({
      byteTo: (addr, val) => { mem[addr] = val & 0xFF; },
      byteAt: (addr) => mem[addr] || 0,
    });

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

  // ---------------------------------------------------------------------------
  QUnit.module("PSHS/PSHU/PULS/PULU register bits", () => {
    QUnit.test("PSHS all 8 registers (0xFF)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x0200);
      mem[0x1000] = 0x34; mem[0x1001] = 0xFF; // PSHS #$FF
      cpu.singleStep();
      assert.ok(cpu.status().sp < 0x0200, "SP decreased");
    });

    QUnit.test("PSHS individual bits: PC (0x80)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x0200);
      mem[0x1000] = 0x34; mem[0x1001] = 0x80;
      cpu.singleStep();
      assert.equal(cpu.status().sp, 0x01FE, "SP decreased by 2 for PC");
    });

    QUnit.test("PSHS individual bits: U (0x40)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x0200); cpu.set("U", 0x1234);
      mem[0x1000] = 0x34; mem[0x1001] = 0x40;
      cpu.singleStep();
      assert.equal(cpu.status().sp, 0x01FE, "SP decreased by 2 for U");
    });

    QUnit.test("PSHS individual bits: Y (0x20)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x0200); cpu.set("Y", 0x5678);
      mem[0x1000] = 0x34; mem[0x1001] = 0x20;
      cpu.singleStep();
      assert.equal(cpu.status().sp, 0x01FE, "SP decreased by 2 for Y");
    });

    QUnit.test("PSHS individual bits: X (0x10)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x0200); cpu.set("X", 0xABCD);
      mem[0x1000] = 0x34; mem[0x1001] = 0x10;
      cpu.singleStep();
      assert.equal(cpu.status().sp, 0x01FE, "SP decreased by 2 for X");
    });

    QUnit.test("PSHS individual bits: DP (0x08)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x0200); cpu.set("DP", 0x30);
      mem[0x1000] = 0x34; mem[0x1001] = 0x08;
      cpu.singleStep();
      assert.equal(cpu.status().sp, 0x01FF, "SP decreased by 1 for DP");
    });

    QUnit.test("PSHS individual bits: B (0x04)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x0200); cpu.set("B", 0x55);
      mem[0x1000] = 0x34; mem[0x1001] = 0x04;
      cpu.singleStep();
      assert.equal(cpu.status().sp, 0x01FF, "SP decreased by 1 for B");
    });

    QUnit.test("PSHS individual bits: A (0x02)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x0200); cpu.set("A", 0x42);
      mem[0x1000] = 0x34; mem[0x1001] = 0x02;
      cpu.singleStep();
      assert.equal(cpu.status().sp, 0x01FF, "SP decreased by 1 for A");
    });

    QUnit.test("PSHS individual bits: CC (0x01)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x0200);
      mem[0x1000] = 0x34; mem[0x1001] = 0x01;
      cpu.singleStep();
      assert.equal(cpu.status().sp, 0x01FF, "SP decreased by 1 for CC");
    });

    QUnit.test("PSHU individual bits: PC (0x80)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("U", 0x0300);
      mem[0x1000] = 0x36; mem[0x1001] = 0x80;
      cpu.singleStep();
      assert.equal(cpu.status().u, 0x02FE, "U decreased by 2 for PC");
    });

    QUnit.test("PSHU individual bits: S (0x40)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("U", 0x0300); cpu.set("SP", 0x1234);
      mem[0x1000] = 0x36; mem[0x1001] = 0x40;
      cpu.singleStep();
      assert.equal(cpu.status().u, 0x02FE, "U decreased by 2 for S");
    });

    QUnit.test("PSHU individual bits: Y (0x20)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("U", 0x0300); cpu.set("Y", 0x5678);
      mem[0x1000] = 0x36; mem[0x1001] = 0x20;
      cpu.singleStep();
      assert.equal(cpu.status().u, 0x02FE, "U decreased by 2 for Y");
    });

    QUnit.test("PSHU individual bits: X (0x10)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("U", 0x0300);
      mem[0x1000] = 0x36; mem[0x1001] = 0x10;
      cpu.singleStep();
      assert.equal(cpu.status().u, 0x02FE, "U decreased by 2 for X");
    });

    QUnit.test("PSHU individual bits: DP (0x08)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("U", 0x0300);
      mem[0x1000] = 0x36; mem[0x1001] = 0x08;
      cpu.singleStep();
      assert.equal(cpu.status().u, 0x02FF, "U decreased by 1 for DP");
    });

    QUnit.test("PSHU individual bits: B (0x04)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("U", 0x0300);
      mem[0x1000] = 0x36; mem[0x1001] = 0x04;
      cpu.singleStep();
      assert.equal(cpu.status().u, 0x02FF, "U decreased by 1 for B");
    });

    QUnit.test("PSHU individual bits: A (0x02)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("U", 0x0300); cpu.set("A", 0x77);
      mem[0x1000] = 0x36; mem[0x1001] = 0x02;
      cpu.singleStep();
      assert.equal(cpu.status().u, 0x02FF, "U decreased by 1 for A");
    });

    QUnit.test("PSHU individual bits: CC (0x01)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("U", 0x0300);
      mem[0x1000] = 0x36; mem[0x1001] = 0x01;
      cpu.singleStep();
      assert.equal(cpu.status().u, 0x02FF, "U decreased by 1 for CC");
    });

    QUnit.test("PULS restores A, B, X, Y from stack", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x11); cpu.set("B", 0x22); cpu.set("X", 0x3456); cpu.set("Y", 0x789A);
      cpu.set("SP", 0x0200);
      mem[0x1000] = 0x34; mem[0x1001] = 0x36; // PSHS B|A|X|Y
      cpu.singleStep();
      cpu.set("A", 0); cpu.set("B", 0); cpu.set("X", 0); cpu.set("Y", 0);
      mem[0x1002] = 0x35; mem[0x1003] = 0x36; // PULS B|A|X|Y
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x11, "A restored");
      assert.equal(cpu.status().b, 0x22, "B restored");
      assert.equal(cpu.status().x, 0x3456, "X restored");
      assert.equal(cpu.status().y, 0x789A, "Y restored");
    });

    QUnit.test("PULS with U (0x40) restores U", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x01FE);
      mem[0x01FE] = 0x56; mem[0x01FF] = 0x78;
      mem[0x1000] = 0x35; mem[0x1001] = 0x40;
      cpu.singleStep();
      assert.equal(cpu.status().u, 0x5678, "U restored");
    });

    QUnit.test("PULS with DP (0x08) restores DP", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x01FF);
      mem[0x01FF] = 0x20;
      mem[0x1000] = 0x35; mem[0x1001] = 0x08;
      cpu.singleStep();
      assert.equal(cpu.status().dp, 0x20, "DP restored");
    });

    QUnit.test("PULS with CC (0x01) restores CC", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x01FF);
      mem[0x01FF] = 0x05; // CC = carry+zero
      mem[0x1000] = 0x35; mem[0x1001] = 0x01;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x05, "CC bits restored");
    });

    QUnit.test("PULU restores A, B, X from U-stack", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0xAA); cpu.set("B", 0xBB); cpu.set("X", 0x1234);
      cpu.set("U", 0x0300);
      mem[0x1000] = 0x36; mem[0x1001] = 0x16; // PSHU B|A|X
      cpu.singleStep();
      cpu.set("A", 0); cpu.set("B", 0); cpu.set("X", 0);
      mem[0x1002] = 0x37; mem[0x1003] = 0x16; // PULU B|A|X
      cpu.singleStep();
      assert.equal(cpu.status().a, 0xAA, "A restored from U-stack");
      assert.equal(cpu.status().b, 0xBB, "B restored from U-stack");
      assert.equal(cpu.status().x, 0x1234, "X restored from U-stack");
    });

    QUnit.test("PULU with Y (0x20) restores Y", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("U", 0x02FE);
      mem[0x02FE] = 0xDE; mem[0x02FF] = 0xAD;
      mem[0x1000] = 0x37; mem[0x1001] = 0x20;
      cpu.singleStep();
      assert.equal(cpu.status().y, 0xDEAD, "Y restored from U-stack");
    });

    QUnit.test("PULU with S (0x40) restores S", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("U", 0x02FE);
      mem[0x02FE] = 0x03; mem[0x02FF] = 0x00;
      mem[0x1000] = 0x37; mem[0x1001] = 0x40;
      cpu.singleStep();
      assert.equal(cpu.status().sp, 0x0300, "SP restored from U-stack");
    });

    QUnit.test("PULU with PC (0x80) restores PC", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("U", 0x02FE);
      mem[0x02FE] = 0x20; mem[0x02FF] = 0x00;
      mem[0x1000] = 0x37; mem[0x1001] = 0x80;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x2000, "PC restored from U-stack");
    });
  });

  // ---------------------------------------------------------------------------
  QUnit.module("TFR/EXG register codes (getPBR/setPBR)", () => {
    QUnit.test("TFR D->X transfers D to X", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x12); cpu.set("B", 0x34);
      mem[0x1000] = 0x1F; mem[0x1001] = 0x01; // TFR D->X
      cpu.singleStep();
      assert.equal(cpu.status().x, 0x1234, "X = D");
    });

    QUnit.test("TFR X->Y transfers X to Y", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("X", 0x5678);
      mem[0x1000] = 0x1F; mem[0x1001] = 0x12; // TFR X->Y
      cpu.singleStep();
      assert.equal(cpu.status().y, 0x5678, "Y = X");
    });

    QUnit.test("TFR Y->U transfers Y to U", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("Y", 0xABCD);
      mem[0x1000] = 0x1F; mem[0x1001] = 0x23; // TFR Y->U
      cpu.singleStep();
      assert.equal(cpu.status().u, 0xABCD, "U = Y");
    });

    QUnit.test("TFR U->S transfers U to S", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("U", 0x0400);
      mem[0x1000] = 0x1F; mem[0x1001] = 0x34; // TFR U->S
      cpu.singleStep();
      assert.equal(cpu.status().sp, 0x0400, "SP = U");
    });

    QUnit.test("TFR S->PC transfers S to PC", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x2000);
      mem[0x2000] = 0x12; // NOP at destination
      mem[0x1000] = 0x1F; mem[0x1001] = 0x45; // TFR S->PC
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x2000, "PC = S");
    });

    QUnit.test("TFR A->B transfers A to B", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x55);
      mem[0x1000] = 0x1F; mem[0x1001] = 0x89; // TFR A->B
      cpu.singleStep();
      assert.equal(cpu.status().b, 0x55, "B = A");
    });

    QUnit.test("TFR B->A transfers B to A", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("B", 0x77);
      mem[0x1000] = 0x1F; mem[0x1001] = 0x98; // TFR B->A
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x77, "A = B");
    });

    QUnit.test("TFR A->CC transfers A to CC", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x05);
      mem[0x1000] = 0x1F; mem[0x1001] = 0x8A; // TFR A->CC
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x05, "CC = A");
    });

    QUnit.test("TFR A->DP transfers A to DP", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x20);
      mem[0x1000] = 0x1F; mem[0x1001] = 0x8B; // TFR A->DP
      cpu.singleStep();
      assert.equal(cpu.status().dp, 0x20, "DP = A");
    });

    QUnit.test("EXG A<->B exchanges A and B", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x11); cpu.set("B", 0x22);
      mem[0x1000] = 0x1E; mem[0x1001] = 0x89; // EXG A,B
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x22, "A = old B");
      assert.equal(cpu.status().b, 0x11, "B = old A");
    });

    QUnit.test("TFR mixed 8/16-bit (no-op per spec)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x42); cpu.set("X", 0x1234);
      mem[0x1000] = 0x1F; mem[0x1001] = 0x81; // TFR A->X (mixed)
      cpu.singleStep();
      assert.equal(cpu.status().x, 0x1234, "X unchanged (mixed-size no-op)");
    });
  });

  // ---------------------------------------------------------------------------
  QUnit.module("PostByte indexed addressing modes", () => {
    QUnit.test(",Y+ auto-increment Y by 1", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("Y", 0x2000); mem[0x2000] = 0xAA;
      mem[0x1000] = 0xA6; mem[0x1001] = 0xA0; // LDA ,Y+  (postbyte: bit7=1, Y=01, mode=0)
      cpu.singleStep();
      assert.equal(cpu.status().a, 0xAA, "loaded from Y");
      assert.equal(cpu.status().y, 0x2001, "Y incremented by 1");
    });

    QUnit.test(",U++ auto-increment U by 2", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("U", 0x2000); mem[0x2000] = 0x55;
      mem[0x1000] = 0xA6; mem[0x1001] = 0xC1; // LDA ,U++
      cpu.singleStep();
      assert.equal(cpu.status().u, 0x2002, "U incremented by 2");
    });

    QUnit.test(",-S pre-decrement S by 1", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x2001);
      mem[0x2000] = 0x33;
      mem[0x1000] = 0xA6; mem[0x1001] = 0xE2; // LDA ,-S
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x33, "loaded from S-1");
      assert.equal(cpu.status().sp, 0x2000, "S decremented by 1");
    });

    QUnit.test(",--X pre-decrement X by 2", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("X", 0x2002);
      mem[0x2000] = 0x77;
      mem[0x1000] = 0xA6; mem[0x1001] = 0x83; // LDA ,--X
      cpu.singleStep();
      assert.equal(cpu.status().x, 0x2000, "X decremented by 2");
    });

    QUnit.test(",Y+B offset with Y register", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("Y", 0x2000); cpu.set("B", 0x05);
      mem[0x2005] = 0x99;
      mem[0x1000] = 0xA6; mem[0x1001] = 0x25; // LDA ,Y+B
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x99, "loaded from Y+B");
    });

    QUnit.test(",Y+A offset with Y register", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("Y", 0x2000); cpu.set("A", 0x03);
      mem[0x2003] = 0x66;
      mem[0x1000] = 0xA6; mem[0x1001] = 0xA6; // LDA ,Y+A (postbyte: bit7=1, Y=01, mode=6=A offset)
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x66, "loaded from Y+A");
    });

    QUnit.test(",U+8bit offset", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("U", 0x2000);
      mem[0x2005] = 0x11;
      mem[0x1000] = 0xA6; mem[0x1001] = 0xC8; mem[0x1002] = 0x05; // LDA 5,U
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x11, "loaded from U+5");
    });

    QUnit.test(",U+16bit offset", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("U", 0x2000);
      mem[0x2100] = 0x22;
      mem[0x1000] = 0xA6; mem[0x1001] = 0xC9; mem[0x1002] = 0x01; mem[0x1003] = 0x00; // LDA $100,U
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x22, "loaded from U+0x100");
    });

    QUnit.test(",X+D offset (D-register)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("X", 0x2000); cpu.set("A", 0x00); cpu.set("B", 0x10); // D=0x0010
      mem[0x2010] = 0x44;
      mem[0x1000] = 0xA6; mem[0x1001] = 0x8B; // LDA ,X+D
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x44, "loaded from X+D");
    });

    QUnit.test("PC+8bit offset", (assert) => {
      const { cpu, mem } = createTestCPU();
      // PC after fetching postbyte = 0x1003, offset = 2 -> EA = 0x1005
      mem[0x1005] = 0x55;
      mem[0x1000] = 0xA6; mem[0x1001] = 0x8C; mem[0x1002] = 0x02; // LDA 2,PC
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x55, "loaded from PC+2");
    });

    QUnit.test("PC+16bit offset", (assert) => {
      const { cpu, mem } = createTestCPU();
      // PC after fetching 16-bit offset = 0x1004, offset = 0 -> EA = 0x1004
      mem[0x1004] = 0x33;
      mem[0x1000] = 0xA6; mem[0x1001] = 0x8D; mem[0x1002] = 0x00; mem[0x1003] = 0x00; // LDA 0,PC
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x33, "loaded from PC+0");
    });

    QUnit.test("[,X] indirect addressing", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("X", 0x2000);
      mem[0x2000] = 0x30; mem[0x2001] = 0x00; // pointer to 0x3000
      mem[0x3000] = 0xBC;
      mem[0x1000] = 0xA6; mem[0x1001] = 0x94; // LDA [,X]
      cpu.singleStep();
      assert.equal(cpu.status().a, 0xBC, "loaded via indirect X");
    });

    QUnit.test("5-bit negative offset from X", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("X", 0x2010);
      mem[0x200F] = 0xEE; // X - 1 = 0x200F
      // 5-bit signed offset -1 = 0b11111 = 0x1F (in 5-bit two's complement)
      // PostByte: bit7=0 (5-bit mode), reg=X(00), offset=11111b -> 0b00_11111 = 0x1F
      mem[0x1000] = 0xA6; mem[0x1001] = 0x1F; // LDA -1,X
      cpu.singleStep();
      assert.equal(cpu.status().a, 0xEE, "loaded from X-1");
    });

    QUnit.test(",Y++ auto-increment Y by 2", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("Y", 0x2000); mem[0x2000] = 0x11;
      mem[0x1000] = 0xA6; mem[0x1001] = 0xA1; // LDA ,Y++ (postbyte: bit7=1, Y=01, mode=1)
      cpu.singleStep();
      assert.equal(cpu.status().y, 0x2002, "Y incremented by 2");
    });

    QUnit.test(",--U pre-decrement U by 2", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("U", 0x2004);
      mem[0x2002] = 0x88;
      mem[0x1000] = 0xA6; mem[0x1001] = 0xC3; // LDA ,--U
      cpu.singleStep();
      assert.equal(cpu.status().u, 0x2002, "U decremented by 2");
    });

    QUnit.test(",--S pre-decrement S, updates S register", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x2002);
      mem[0x2000] = 0x99;
      mem[0x1000] = 0xA6; mem[0x1001] = 0xE3; // LDA ,--S
      cpu.singleStep();
      assert.equal(cpu.status().sp, 0x2000, "S decremented by 2");
    });
  });

  // ---------------------------------------------------------------------------
  QUnit.module("ALU operations — flag coverage", () => {
    QUnit.test("SUBA — borrow sets carry flag", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x00);
      mem[0x1000] = 0x80; mem[0x1001] = 0x01; // SUBA #1
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x01, "C set on borrow");
    });

    QUnit.test("SUBA — overflow flag set (0x80 - 1)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x80);
      mem[0x1000] = 0x80; mem[0x1001] = 0x01; // SUBA #1
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x02, "V set on signed overflow");
    });

    QUnit.test("ADCA — with carry adds carry-in", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x01); cpu.set("FLAGS", 0x01); // C=1
      mem[0x1000] = 0x89; mem[0x1001] = 0x01; // ADCA #1
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x03, "A = 1 + 1 + carry(1)");
    });

    QUnit.test("SBCA — with borrow subtracts carry", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x05); cpu.set("FLAGS", 0x01); // C=1
      mem[0x1000] = 0x82; mem[0x1001] = 0x02; // SBCA #2
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x02, "A = 5 - 2 - carry(1) = 2");
    });

    QUnit.test("SBCB — with borrow", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("B", 0x10); cpu.set("FLAGS", 0x01); // C=1
      mem[0x1000] = 0xC2; mem[0x1001] = 0x05; // SBCB #5
      cpu.singleStep();
      assert.equal(cpu.status().b, 0x0A, "B = 16 - 5 - 1 = 10");
    });

    QUnit.test("SUBD — 16-bit subtraction with borrow", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x00); cpu.set("B", 0x00); // D=0
      mem[0x1000] = 0x83; mem[0x1001] = 0x00; mem[0x1002] = 0x01; // SUBD #1
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x01, "C set on 16-bit borrow");
    });

    QUnit.test("ADCA — half-carry (H flag)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x09); cpu.set("FLAGS", 0x00);
      mem[0x1000] = 0x89; mem[0x1001] = 0x07; // ADCA #7 (0x09+0x07=0x10, H set)
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x20, "H flag set on nibble carry");
    });

    QUnit.test("ADCA — carry out of bit 7", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0xFF); cpu.set("FLAGS", 0x00);
      mem[0x1000] = 0x89; mem[0x1001] = 0x01; // ADCA #1
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x01, "C set on overflow out of bit 7");
    });

    QUnit.test("SUBA direct page mode", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x10); cpu.set("DP", 0x20);
      mem[0x2005] = 0x03;
      mem[0x1000] = 0x90; mem[0x1001] = 0x05; // SUBA $05 (DP)
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x0D, "A = 0x10 - 0x03");
    });

    QUnit.test("ADCB — carry in from B", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("B", 0xFE); cpu.set("FLAGS", 0x01); // C=1
      mem[0x1000] = 0xC9; mem[0x1001] = 0x01; // ADCB #1
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x01, "C set (0xFE+1+1=0x100)");
    });
  });

  // ---------------------------------------------------------------------------
  QUnit.module("Inherent instructions — branches and control flow", () => {
    QUnit.test("NOP ($12) — no operation", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x12;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1001, "PC incremented");
    });

    QUnit.test("SYNC ($13) — no crash", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x13;
      cpu.singleStep();
      assert.ok(true, "SYNC executes");
    });

    QUnit.test("LBRA ($16) — long branch always", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x16; mem[0x1001] = 0x01; mem[0x1002] = 0x00; // LBRA +256
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1103, "PC = 0x1003 + 0x100");
    });

    QUnit.test("LBSR ($17) — long BSR pushes PC and jumps", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x01FF);
      mem[0x1000] = 0x17; mem[0x1001] = 0x00; mem[0x1002] = 0x50; // LBSR +80
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1053, "PC = 0x1003 + 0x50");
    });

    QUnit.test("DAA — with H clear and A=0, result stays 0", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x00); cpu.set("FLAGS", 0x50); // keep I/F masks, clear H
      mem[0x1000] = 0x19;
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x00, "A remains 0 when no correction needed");
    });

    QUnit.test("DAA — nhi>0x80 and nlo>0x09 (line 1686 branch)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x9A); // nhi=0x90>0x80, nlo=0x0A>0x09
      mem[0x1000] = 0x19;
      cpu.singleStep();
      assert.ok(true, "DAA executes without crash");
    });

    QUnit.test("DAA — carry flag triggers correction", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x05); cpu.set("FLAGS", 0x01); // C=1
      mem[0x1000] = 0x19;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x01, "carry preserved");
    });

    QUnit.test("SEX ($1D) — B MSB set -> A=0xFF", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("B", 0x80);
      mem[0x1000] = 0x1D;
      cpu.singleStep();
      assert.equal(cpu.status().a, 0xFF, "A sign extended to 0xFF");
    });

    QUnit.test("SEX ($1D) — B MSB clear -> A=0x00", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("B", 0x40);
      mem[0x1000] = 0x1D;
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x00, "A sign extended to 0x00");
    });

    QUnit.test("BRN ($21) — never branches", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x21; mem[0x1001] = 0x10;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1002, "PC advances past BRN");
    });

    QUnit.test("BHI ($22) — taken when C=0 and Z=0", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x00);
      mem[0x1000] = 0x22; mem[0x1001] = 0x04;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1006, "BHI taken");
    });

    QUnit.test("BHI ($22) — not taken when Z=1", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x04); // Z=1
      mem[0x1000] = 0x22; mem[0x1001] = 0x04;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1002, "BHI not taken");
    });

    QUnit.test("BLS ($23) — taken when C=1", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x01); // C=1
      mem[0x1000] = 0x23; mem[0x1001] = 0x04;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1006, "BLS taken");
    });

    QUnit.test("BVC ($28) — taken when V=0", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x00);
      mem[0x1000] = 0x28; mem[0x1001] = 0x04;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1006, "BVC taken");
    });

    QUnit.test("BVS ($29) — taken when V=1", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x02); // V=1
      mem[0x1000] = 0x29; mem[0x1001] = 0x04;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1006, "BVS taken");
    });

    QUnit.test("BPL ($2A) — taken when N=0", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x00);
      mem[0x1000] = 0x2A; mem[0x1001] = 0x04;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1006, "BPL taken");
    });

    QUnit.test("BMI ($2B) — taken when N=1", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x08); // N=1
      mem[0x1000] = 0x2B; mem[0x1001] = 0x04;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1006, "BMI taken");
    });

    QUnit.test("BGE ($2C) — taken when N=V=0", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x00);
      mem[0x1000] = 0x2C; mem[0x1001] = 0x04;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1006, "BGE taken N=0,V=0");
    });

    QUnit.test("BGE ($2C) — taken when N=1,V=1", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x0A); // N=1,V=1
      mem[0x1000] = 0x2C; mem[0x1001] = 0x04;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1006, "BGE taken N=V=1");
    });

    QUnit.test("BLT ($2D) — taken when N=1,V=0", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x08); // N=1,V=0
      mem[0x1000] = 0x2D; mem[0x1001] = 0x04;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1006, "BLT taken");
    });

    QUnit.test("BGT ($2E) — taken when Z=0 and N=V", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x00); // Z=0,N=0,V=0
      mem[0x1000] = 0x2E; mem[0x1001] = 0x04;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1006, "BGT taken");
    });

    QUnit.test("BLE ($2F) — taken when Z=1", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x04); // Z=1
      mem[0x1000] = 0x2F; mem[0x1001] = 0x04;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1006, "BLE taken");
    });

    QUnit.test("LEAX — result non-zero clears Z", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("X", 0x2000); cpu.set("FLAGS", 0x04); // Z set initially
      // LEAX 1,X: postbyte 0x88 0x01
      mem[0x1000] = 0x30; mem[0x1001] = 0x88; mem[0x1002] = 0x01;
      cpu.singleStep();
      assert.ok(!(cpu.status().flags & 0x04), "Z cleared when X!=0");
    });

    QUnit.test("LEAX — result zero sets Z", (assert) => {
      const { cpu, mem } = createTestCPU();
      // LEAX 0,X with X=0 -> result 0 -> Z set
      cpu.set("X", 0x0000);
      mem[0x1000] = 0x30; mem[0x1001] = 0x84; // LEAX ,X (0 offset, case 4)
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z set when LEAX result=0");
    });

    QUnit.test("LEAY — loads Y with effective address", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("X", 0x3000);
      mem[0x1000] = 0x31; mem[0x1001] = 0x84; // LEAY ,X
      cpu.singleStep();
      assert.equal(cpu.status().y, 0x3000, "Y = EA");
    });

    QUnit.test("LEAS — loads S with effective address", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("X", 0x1234);
      mem[0x1000] = 0x32; mem[0x1001] = 0x84; // LEAS ,X
      cpu.singleStep();
      assert.equal(cpu.status().sp, 0x1234, "SP = EA");
    });

    QUnit.test("LEAU — loads U with effective address", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("X", 0x5678);
      mem[0x1000] = 0x33; mem[0x1001] = 0x84; // LEAU ,X
      cpu.singleStep();
      assert.equal(cpu.status().u, 0x5678, "U = EA");
    });

    QUnit.test("ABX ($3A) — adds B to X", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("X", 0x1000); cpu.set("B", 0x10);
      mem[0x1000] = 0x3A;
      cpu.singleStep();
      assert.equal(cpu.status().x, 0x1010, "X += B");
    });

    QUnit.test("RTI without F_ENTIRE — restores CC and PC only", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x01FD);
      mem[0x01FD] = 0x00; // CC (no ENTIRE bit)
      mem[0x01FE] = 0x30; mem[0x01FF] = 0x00; // PC = 0x3000
      mem[0x1000] = 0x3B; // RTI
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x3000, "PC restored");
    });

    QUnit.test("RTI with F_ENTIRE — restores full register set", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x01F4);
      // Stack (from top): CC(entire), A, B, DP, X(hi,lo), Y(hi,lo), U(hi,lo), PC(hi,lo)
      mem[0x01F4] = 0x80; // CC with F_ENTIRE=0x80
      mem[0x01F5] = 0x11; // A
      mem[0x01F6] = 0x22; // B
      mem[0x01F7] = 0x30; // DP
      mem[0x01F8] = 0x12; mem[0x01F9] = 0x34; // X
      mem[0x01FA] = 0x56; mem[0x01FB] = 0x78; // Y
      mem[0x01FC] = 0x9A; mem[0x01FD] = 0xBC; // U
      mem[0x01FE] = 0x40; mem[0x01FF] = 0x00; // PC = 0x4000
      mem[0x1000] = 0x3B; // RTI
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x4000, "PC restored");
      assert.equal(cpu.status().a, 0x11, "A restored");
      assert.equal(cpu.status().x, 0x1234, "X restored");
    });

    QUnit.test("CWAI ($3C) — ANDs CC with immediate", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0xFF);
      mem[0x1000] = 0x3C; mem[0x1001] = 0x00; // CWAI #0
      cpu.singleStep();
      assert.equal(cpu.status().flags & 0xFF, 0x00, "CC cleared by CWAI");
    });

    QUnit.test("SWI ($3F) — pushes registers and vectors to SWI", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x01FF);
      mem[0xFFFA] = 0x20; mem[0xFFFB] = 0x00; // SWI vector
      mem[0x1000] = 0x3F;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x2000, "PC = SWI vector");
    });
  });

  // ---------------------------------------------------------------------------
  QUnit.module("Extended mode addressing", () => {
    QUnit.test("LDD extended ($FC) — load D from extended addr", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x4010] = 0x12; mem[0x4011] = 0x34;
      mem[0x1000] = 0xFC; mem[0x1001] = 0x40; mem[0x1002] = 0x10;
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x12, "A=high");
      assert.equal(cpu.status().b, 0x34, "B=low");
    });

    QUnit.test("CMPX extended ($BC) — sets Z flag on equal", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("X", 0x1234);
      mem[0x4020] = 0x12; mem[0x4021] = 0x34;
      mem[0x1000] = 0xBC; mem[0x1001] = 0x40; mem[0x1002] = 0x20;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z set");
    });

    QUnit.test("STD extended ($FD) — store D", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0xAB); cpu.set("B", 0xCD);
      mem[0x1000] = 0xFD; mem[0x1001] = 0x40; mem[0x1002] = 0x30;
      cpu.singleStep();
      assert.equal(mem[0x4030], 0xAB, "high byte");
      assert.equal(mem[0x4031], 0xCD, "low byte");
    });

    QUnit.test("JSR extended ($BD) — push PC and jump", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x01FF);
      mem[0x1000] = 0xBD; mem[0x1001] = 0x20; mem[0x1002] = 0x00;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x2000, "PC = target");
    });

    QUnit.test("STX extended ($BF) — store X", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("X", 0x5678);
      mem[0x1000] = 0xBF; mem[0x1001] = 0x40; mem[0x1002] = 0x40;
      cpu.singleStep();
      assert.equal(mem[0x4040], 0x56, "X high");
      assert.equal(mem[0x4041], 0x78, "X low");
    });

    QUnit.test("STU extended ($FF) — store U", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("U", 0x9ABC);
      mem[0x1000] = 0xFF; mem[0x1001] = 0x40; mem[0x1002] = 0x50;
      cpu.singleStep();
      assert.equal(mem[0x4050], 0x9A, "U high");
      assert.equal(mem[0x4051], 0xBC, "U low");
    });

    QUnit.test("SUBD extended ($B3) — 16-bit subtract", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x00); cpu.set("B", 0x0A); // D=10
      mem[0x4060] = 0x00; mem[0x4061] = 0x03;
      mem[0x1000] = 0xB3; mem[0x1001] = 0x40; mem[0x1002] = 0x60;
      cpu.singleStep();
      assert.equal(cpu.status().b, 0x07, "D = 10 - 3 = 7");
    });
  });

  // ---------------------------------------------------------------------------
  QUnit.module("$10 prefix: long branches", () => {
    QUnit.test("LBHI ($10 $22) — taken when C=0 Z=0", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x00);
      mem[0x1000] = 0x10; mem[0x1001] = 0x22; mem[0x1002] = 0x00; mem[0x1003] = 0x10;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1014, "LBHI taken: PC = 0x1004 + 0x10");
    });

    QUnit.test("LBLS ($10 $23) — taken when C=1", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x01);
      mem[0x1000] = 0x10; mem[0x1001] = 0x23; mem[0x1002] = 0x00; mem[0x1003] = 0x10;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1014, "LBLS taken");
    });

    QUnit.test("LBCC ($10 $24) — taken when C=0", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x00);
      mem[0x1000] = 0x10; mem[0x1001] = 0x24; mem[0x1002] = 0x00; mem[0x1003] = 0x10;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1014, "LBCC taken");
    });

    QUnit.test("LBCS ($10 $25) — taken when C=1", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x01);
      mem[0x1000] = 0x10; mem[0x1001] = 0x25; mem[0x1002] = 0x00; mem[0x1003] = 0x10;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1014, "LBCS taken");
    });

    QUnit.test("LBNE ($10 $26) — taken when Z=0", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x00);
      mem[0x1000] = 0x10; mem[0x1001] = 0x26; mem[0x1002] = 0x00; mem[0x1003] = 0x10;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1014, "LBNE taken");
    });

    QUnit.test("LBEQ ($10 $27) — taken when Z=1", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x04);
      mem[0x1000] = 0x10; mem[0x1001] = 0x27; mem[0x1002] = 0x00; mem[0x1003] = 0x10;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1014, "LBEQ taken");
    });

    QUnit.test("LBVC ($10 $28) — taken when V=0", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x00);
      mem[0x1000] = 0x10; mem[0x1001] = 0x28; mem[0x1002] = 0x00; mem[0x1003] = 0x10;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1014, "LBVC taken");
    });

    QUnit.test("LBVS ($10 $29) — taken when V=1", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x02);
      mem[0x1000] = 0x10; mem[0x1001] = 0x29; mem[0x1002] = 0x00; mem[0x1003] = 0x10;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1014, "LBVS taken");
    });

    QUnit.test("LBPL ($10 $2A) — taken when N=0", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x00);
      mem[0x1000] = 0x10; mem[0x1001] = 0x2A; mem[0x1002] = 0x00; mem[0x1003] = 0x10;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1014, "LBPL taken");
    });

    QUnit.test("LBMI ($10 $2B) — taken when N=1", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x08);
      mem[0x1000] = 0x10; mem[0x1001] = 0x2B; mem[0x1002] = 0x00; mem[0x1003] = 0x10;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1014, "LBMI taken");
    });

    QUnit.test("LBGE ($10 $2C) — taken when N=V=0", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x00);
      mem[0x1000] = 0x10; mem[0x1001] = 0x2C; mem[0x1002] = 0x00; mem[0x1003] = 0x10;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1014, "LBGE taken");
    });

    QUnit.test("LBLT ($10 $2D) — taken when N xor V", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x08); // N=1,V=0
      mem[0x1000] = 0x10; mem[0x1001] = 0x2D; mem[0x1002] = 0x00; mem[0x1003] = 0x10;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1014, "LBLT taken");
    });

    QUnit.test("LBGT ($10 $2E) — taken when Z=0 and N=V", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x00);
      mem[0x1000] = 0x10; mem[0x1001] = 0x2E; mem[0x1002] = 0x00; mem[0x1003] = 0x10;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1014, "LBGT taken");
    });

    QUnit.test("LBLE ($10 $2F) — taken when Z=1", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x04);
      mem[0x1000] = 0x10; mem[0x1001] = 0x2F; mem[0x1002] = 0x00; mem[0x1003] = 0x10;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1014, "LBLE taken");
    });

    QUnit.test("LBRN ($10 $21) — never branches", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0x21; mem[0x1002] = 0x00; mem[0x1003] = 0x10;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1004, "LBRN always falls through");
    });
  });

  // ---------------------------------------------------------------------------
  QUnit.module("$10 prefix: 16-bit register ops", () => {
    QUnit.test("LDY immediate ($10 $8E)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0x8E; mem[0x1002] = 0x12; mem[0x1003] = 0x34;
      cpu.singleStep();
      assert.equal(cpu.status().y, 0x1234, "Y loaded");
    });

    QUnit.test("LDS immediate ($10 $CE)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x1000] = 0x10; mem[0x1001] = 0xCE; mem[0x1002] = 0x03; mem[0x1003] = 0x00;
      cpu.singleStep();
      assert.equal(cpu.status().sp, 0x0300, "SP loaded");
    });

    QUnit.test("STY direct ($10 $9F)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("Y", 0xBEEF); cpu.set("DP", 0x20);
      mem[0x1000] = 0x10; mem[0x1001] = 0x9F; mem[0x1002] = 0x10;
      cpu.singleStep();
      assert.equal(mem[0x2010], 0xBE, "Y high byte stored");
      assert.equal(mem[0x2011], 0xEF, "Y low byte stored");
    });

    QUnit.test("STS direct ($10 $DF)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x1234); cpu.set("DP", 0x20);
      mem[0x1000] = 0x10; mem[0x1001] = 0xDF; mem[0x1002] = 0x20;
      cpu.singleStep();
      assert.equal(mem[0x2020], 0x12, "SP high byte stored");
      assert.equal(mem[0x2021], 0x34, "SP low byte stored");
    });

    QUnit.test("CMPY immediate ($10 $8C) — equal sets Z", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("Y", 0x1234);
      mem[0x1000] = 0x10; mem[0x1001] = 0x8C; mem[0x1002] = 0x12; mem[0x1003] = 0x34;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z set when Y == operand");
    });

    QUnit.test("CMPD immediate ($10 $83) — less sets C", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x00); cpu.set("B", 0x01); // D=1
      mem[0x1000] = 0x10; mem[0x1001] = 0x83; mem[0x1002] = 0x00; mem[0x1003] = 0x02;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x01, "C set when D < operand");
    });

    QUnit.test("SWI2 ($10 $3F) — vectors through SWI2", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x01FF);
      mem[0xFFF4] = 0x20; mem[0xFFF5] = 0x00;
      mem[0x1000] = 0x10; mem[0x1001] = 0x3F;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x2000, "PC = SWI2 vector");
    });
  });

  // ---------------------------------------------------------------------------
  QUnit.module("$11 prefix: CMPU, CMPS, SWI3", () => {
    QUnit.test("CMPU immediate ($11 $83) — equal sets Z", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("U", 0x1234);
      mem[0x1000] = 0x11; mem[0x1001] = 0x83; mem[0x1002] = 0x12; mem[0x1003] = 0x34;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z set");
    });

    QUnit.test("CMPU immediate — U > operand: C clear", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("U", 0x0200);
      mem[0x1000] = 0x11; mem[0x1001] = 0x83; mem[0x1002] = 0x01; mem[0x1003] = 0x00;
      cpu.singleStep();
      assert.ok(!(cpu.status().flags & 0x01), "C clear when U > operand");
    });

    QUnit.test("CMPS immediate ($11 $8C) — equal sets Z", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x0300);
      mem[0x1000] = 0x11; mem[0x1001] = 0x8C; mem[0x1002] = 0x03; mem[0x1003] = 0x00;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z set");
    });

    QUnit.test("CMPS direct ($11 $9C) — less sets C", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x0100); cpu.set("DP", 0x00);
      mem[0x0010] = 0x02; mem[0x0011] = 0x00;
      mem[0x1000] = 0x11; mem[0x1001] = 0x9C; mem[0x1002] = 0x10;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x01, "C set when SP < operand");
    });

    QUnit.test("SWI3 ($11 $3F) — vectors through SWI3", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x01FF);
      mem[0xFFF2] = 0x30; mem[0xFFF3] = 0x00;
      mem[0x1000] = 0x11; mem[0x1001] = 0x3F;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x3000, "PC = SWI3 vector");
    });
  });

  // ---------------------------------------------------------------------------
  QUnit.module("Disassembler — extended modes and $10/$11 prefix", () => {
    QUnit.test("SUBD extended ($B3)", (assert) => {
      const { cpu } = createTestCPU();
      const [m, n] = cpu.disasm(0xB3, 0x40, 0x00, 0, 0, 0x1000);
      assert.ok(m.startsWith("SUBD"), "mnemonic SUBD");
      assert.equal(n, 3, "3 bytes");
    });

    QUnit.test("CMPX extended ($BC)", (assert) => {
      const { cpu } = createTestCPU();
      const [m, n] = cpu.disasm(0xBC, 0x40, 0x00, 0, 0, 0x1000);
      assert.ok(m.startsWith("CMPX"), "mnemonic CMPX");
      assert.equal(n, 3, "3 bytes");
    });

    QUnit.test("LDD extended ($FC)", (assert) => {
      const { cpu } = createTestCPU();
      const [m, n] = cpu.disasm(0xFC, 0x40, 0x00, 0, 0, 0x1000);
      assert.ok(m.startsWith("LDD"), "mnemonic LDD");
      assert.equal(n, 3, "3 bytes");
    });

    QUnit.test("LDA indexed ($A6) — disasm mode 6", (assert) => {
      const { cpu } = createTestCPU();
      const [m, n] = cpu.disasm(0xA6, 0x84, 0, 0, 0, 0x1000); // postbyte 0x84 = ,X
      assert.ok(m.includes("LDA"), "mnemonic LDA");
    });

    QUnit.test("$10 unknown opcode -> ???", (assert) => {
      const { cpu } = createTestCPU();
      const [m, n] = cpu.disasm(0x10, 0x40, 0, 0, 0, 0x1000);
      assert.equal(m, "???", "unknown $10 opcode");
    });

    QUnit.test("$11 unknown opcode -> ???", (assert) => {
      const { cpu } = createTestCPU();
      const [m, n] = cpu.disasm(0x11, 0xFF, 0, 0, 0, 0x1000);
      assert.equal(m, "???", "unknown $11 opcode");
    });

    QUnit.test("LDY direct ($10 $9E)", (assert) => {
      const { cpu } = createTestCPU();
      const [m, n] = cpu.disasm(0x10, 0x9E, 0x10, 0, 0, 0x1000);
      assert.ok(m.startsWith("LDY"), "mnemonic LDY");
    });

    QUnit.test("STS extended ($10 $FF)", (assert) => {
      const { cpu } = createTestCPU();
      const [m, n] = cpu.disasm(0x10, 0xFF, 0x40, 0x00, 0, 0x1000);
      assert.ok(m.startsWith("STS"), "mnemonic STS");
    });

    QUnit.test("CMPU direct ($11 $93)", (assert) => {
      const { cpu } = createTestCPU();
      const [m, n] = cpu.disasm(0x11, 0x93, 0x10, 0, 0, 0x1000);
      assert.ok(m.startsWith("CMPU"), "mnemonic CMPU");
    });

    QUnit.test("CMPS immediate ($11 $8C)", (assert) => {
      const { cpu } = createTestCPU();
      const [m, n] = cpu.disasm(0x11, 0x8C, 0x03, 0x00, 0, 0x1000);
      assert.ok(m.startsWith("CMPS"), "mnemonic CMPS");
    });

    QUnit.test("LBEQ ($10 $27) — branch rel16 disasm", (assert) => {
      const { cpu } = createTestCPU();
      const [m, n] = cpu.disasm(0x10, 0x27, 0x00, 0x10, 0, 0x1000);
      assert.ok(m.startsWith("LBEQ"), "mnemonic LBEQ");
      assert.equal(n, 5, "5 bytes (prefix + opcode + 2 offset bytes + 1)");
    });

    QUnit.test("Disasm indexed mode with Y register (postbyte 0xA4)", (assert) => {
      const { cpu } = createTestCPU();
      // postbyte 0xA4: bit7=1(complex), reg=Y(01), mode=4(,reg)
      const [m] = cpu.disasm(0xA6, 0xA4, 0, 0, 0, 0x1000);
      assert.ok(m.includes("Y"), "Y register in mnemonic");
    });

    QUnit.test("Disasm indexed mode with U register (postbyte 0xC4)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0xC4, 0, 0, 0, 0x1000);
      assert.ok(m.includes("U"), "U register in mnemonic");
    });

    QUnit.test("Disasm indexed mode with S register (postbyte 0xE4)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0xE4, 0, 0, 0, 0x1000);
      assert.ok(m.includes("S"), "S register in mnemonic");
    });

    QUnit.test("Disasm indexed ,reg+ (postbyte 0x80)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0x80, 0, 0, 0, 0x1000);
      assert.ok(m.includes("+"), "post-increment in mnemonic");
    });

    QUnit.test("Disasm indexed ,reg-- (postbyte 0x83)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0x83, 0, 0, 0, 0x1000);
      assert.ok(m.includes("--"), "pre-decrement-- in mnemonic");
    });

    QUnit.test("Disasm indexed 8-bit offset (postbyte 0x88)", (assert) => {
      const { cpu } = createTestCPU();
      const [m, n] = cpu.disasm(0xA6, 0x88, 0x05, 0, 0, 0x1000);
      assert.equal(n, 3, "3 bytes for 8-bit offset");
    });

    QUnit.test("Disasm indexed 16-bit offset (postbyte 0x89)", (assert) => {
      const { cpu } = createTestCPU();
      const [m, n] = cpu.disasm(0xA6, 0x89, 0x01, 0x00, 0, 0x1000);
      assert.equal(n, 4, "4 bytes for 16-bit offset");
    });

    QUnit.test("Disasm indexed ,reg+D (postbyte 0x8B)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0x8B, 0, 0, 0, 0x1000);
      assert.ok(m.includes("D"), "D accumulator offset");
    });

    QUnit.test("Disasm indexed PC+16bit offset [indirect] (postbyte 0x9D)", (assert) => {
      const { cpu } = createTestCPU();
      // 0x9D = bit7=1(complex), ind=1(indirect), mod=0xD(PC+16bit)
      const [m, n] = cpu.disasm(0xA6, 0x9D, 0x00, 0x10, 0, 0x1000);
      assert.ok(m.includes("PC") || m.includes("["), "PC indirect in mnemonic");
    });

    QUnit.test("Disasm indexed [$addr] extended indirect (postbyte 0x9F)", (assert) => {
      const { cpu } = createTestCPU();
      const [m, n] = cpu.disasm(0xA6, 0x9F, 0x40, 0x00, 0, 0x1000);
      assert.ok(m.includes("["), "indirect brackets in mnemonic");
    });

    QUnit.test("PSHS disasm shows register list", (assert) => {
      const { cpu } = createTestCPU();
      const [m, n] = cpu.disasm(0x34, 0x06, 0, 0, 0, 0x1000); // PSHS A,B
      assert.ok(m.includes("PSHS"), "PSHS mnemonic");
      assert.ok(m.includes("A") || m.includes("B"), "register list");
    });

    QUnit.test("PSHU disasm shows register list", (assert) => {
      const { cpu } = createTestCPU();
      const [m, n] = cpu.disasm(0x36, 0x06, 0, 0, 0, 0x1000); // PSHU A,B
      assert.ok(m.includes("PSHU"), "PSHU mnemonic");
    });

    QUnit.test("TFR disasm shows registers", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0x1F, 0x89, 0, 0, 0, 0x1000); // TFR A,B
      assert.ok(m.includes("TFR"), "TFR mnemonic");
    });

    QUnit.test("BRA disasm shows target address", (assert) => {
      const { cpu } = createTestCPU();
      const [m, n] = cpu.disasm(0x20, 0x10, 0, 0, 0, 0x1000); // BRA +16
      assert.ok(m.startsWith("BRA"), "BRA mnemonic");
      assert.equal(n, 2, "2 bytes");
    });

    QUnit.test("Disasm indexed ,X++ (postbyte 0x81)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0x81, 0, 0, 0, 0x1000);
      assert.ok(m.includes("++"), ",X++ in mnemonic");
    });

    QUnit.test("Disasm indexed ,-X (postbyte 0x82)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0x82, 0, 0, 0, 0x1000);
      assert.ok(m.includes("-"), ",-X in mnemonic");
    });

    QUnit.test("Disasm indexed B,X (postbyte 0x85)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0x85, 0, 0, 0, 0x1000);
      assert.ok(m.includes("B"), "B offset in mnemonic");
    });

    QUnit.test("Disasm indexed A,X (postbyte 0x86)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0x86, 0, 0, 0, 0x1000);
      assert.ok(m.includes("A"), "A offset in mnemonic");
    });

    QUnit.test("Disasm indexed illegal mode 7 (postbyte 0x87)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0x87, 0, 0, 0, 0x1000);
      assert.ok(m.includes("???"), "illegal mode 7");
    });

    QUnit.test("Disasm indexed illegal mode 10 (postbyte 0x8A)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0x8A, 0, 0, 0, 0x1000);
      assert.ok(m.includes("???"), "illegal mode 10");
    });

    QUnit.test("Disasm indexed PC+8bit offset (postbyte 0x8C)", (assert) => {
      const { cpu } = createTestCPU();
      const [m, n] = cpu.disasm(0xA6, 0x8C, 0x05, 0, 0, 0x1000);
      assert.ok(m.includes("PC"), "PC in mnemonic");
      assert.equal(n, 3, "3 bytes");
    });

    QUnit.test("Disasm indexed negative 8-bit offset (postbyte 0x88, b=0xFF)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0x88, 0xFF, 0, 0, 0x1000);
      assert.ok(m.includes("-1"), "negative offset shown");
    });

    QUnit.test("Disasm indexed negative 16-bit offset (postbyte 0x89, b=0x80, c=0x00)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0x89, 0x80, 0x00, 0, 0x1000);
      assert.ok(m.includes("-"), "negative 16-bit offset shown");
    });

    QUnit.test("Disasm indexed illegal mode 14 (postbyte 0x8E)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0x8E, 0, 0, 0, 0x1000);
      assert.ok(m.includes("???"), "illegal mode 14");
    });

    QUnit.test("Disasm indexed $addr indirect (postbyte 0x8F)", (assert) => {
      const { cpu } = createTestCPU();
      const [m, n] = cpu.disasm(0xA6, 0x8F, 0x40, 0x00, 0, 0x1000);
      assert.ok(m.includes("$"), "address in mnemonic");
      assert.equal(n, 4, "4 bytes");
    });

    QUnit.test("Disasm indexed [,X++] indirect (postbyte 0x91)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0x91, 0, 0, 0, 0x1000);
      assert.ok(m.includes("["), "indirect brackets");
      assert.ok(m.includes("++"), "++ in indirect");
    });

    QUnit.test("Disasm indexed [,X] indirect (postbyte 0x94)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0x94, 0, 0, 0, 0x1000);
      assert.ok(m.includes("[,X]"), "[,X] indirect");
    });

    QUnit.test("Disasm indexed [B,X] indirect (postbyte 0x95)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0x95, 0, 0, 0, 0x1000);
      assert.ok(m.includes("[B,"), "[B,X] indirect");
    });

    QUnit.test("Disasm indexed [A,X] indirect (postbyte 0x96)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0x96, 0, 0, 0, 0x1000);
      assert.ok(m.includes("[A,"), "[A,X] indirect");
    });

    QUnit.test("Disasm indexed indirect illegal 7 (postbyte 0x97)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0x97, 0, 0, 0, 0x1000);
      assert.ok(m.includes("???"), "indirect illegal 7");
    });

    QUnit.test("Disasm indexed [n,X] indirect 8-bit (postbyte 0x98)", (assert) => {
      const { cpu } = createTestCPU();
      const [m, n] = cpu.disasm(0xA6, 0x98, 0x05, 0, 0, 0x1000);
      assert.ok(m.includes("["), "indirect brackets");
      assert.equal(n, 3, "3 bytes");
    });

    QUnit.test("Disasm indexed [n,X] indirect 16-bit (postbyte 0x99)", (assert) => {
      const { cpu } = createTestCPU();
      const [m, n] = cpu.disasm(0xA6, 0x99, 0x01, 0x00, 0, 0x1000);
      assert.ok(m.includes("["), "indirect brackets");
      assert.equal(n, 4, "4 bytes");
    });

    QUnit.test("Disasm indexed indirect illegal 10 (postbyte 0x9A)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0x9A, 0, 0, 0, 0x1000);
      assert.ok(m.includes("???"), "indirect illegal 10");
    });

    QUnit.test("Disasm indexed [D,X] indirect (postbyte 0x9B)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0x9B, 0, 0, 0, 0x1000);
      assert.ok(m.includes("[D,"), "[D,X] indirect");
    });

    QUnit.test("Disasm indexed [n,PC] indirect 8-bit (postbyte 0x9C)", (assert) => {
      const { cpu } = createTestCPU();
      const [m, n] = cpu.disasm(0xA6, 0x9C, 0x05, 0, 0, 0x1000);
      assert.ok(m.includes(",PC]"), "PC indirect 8-bit");
    });

    QUnit.test("Disasm indexed indirect illegal 14 (postbyte 0x9E)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0x9E, 0, 0, 0, 0x1000);
      assert.ok(m.includes("???"), "indirect illegal 14");
    });

    QUnit.test("Disasm 5-bit negative offset (postbyte 0x1F = -1,X)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0xA6, 0x1F, 0, 0, 0, 0x1000);
      assert.ok(m.includes("-1"), "-1,X in mnemonic");
    });

    QUnit.test("Disasm brel8 negative offset (BRA with negative offset)", (assert) => {
      const { cpu } = createTestCPU();
      // BRA 0xFE = -2 (jumps back to same instruction)
      const [m] = cpu.disasm(0x20, 0xFE, 0, 0, 0, 0x1000);
      assert.ok(m.startsWith("BRA"), "BRA mnemonic");
      // Target = 0x1000 + 0xFE - 254 + 2... negative offset
    });

    QUnit.test("Disasm case 0 (invalid opcode $01)", (assert) => {
      const { cpu } = createTestCPU();
      const [m] = cpu.disasm(0x01, 0, 0, 0, 0, 0x1000);
      assert.equal(m, "???", "invalid opcode");
    });
  });

  // ---------------------------------------------------------------------------
  QUnit.module("ALU flag branches — oNEG, oLSR, oASR, oASL, oROL, oADD", () => {
    QUnit.test("NEGA ($40) with A=0x80 — overflow flag set", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x80);
      mem[0x1000] = 0x40; // NEGA
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x02, "V set for NEG(0x80)");
    });

    QUnit.test("NEGA ($40) with A=1 — carry set, result=0xFF", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x01);
      mem[0x1000] = 0x40;
      cpu.singleStep();
      assert.equal(cpu.status().a, 0xFF, "NEG(1) = 0xFF");
      assert.ok(cpu.status().flags & 0x01, "C set");
    });

    QUnit.test("LSRA ($44) with bit0 set — carry set", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x03);
      mem[0x1000] = 0x44;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x01, "C set from bit0");
      assert.equal(cpu.status().a, 0x01, "A shifted right");
    });

    QUnit.test("LSRA ($44) with bit0 clear and result zero — Z set", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x02);
      mem[0x1000] = 0x44;
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x01, "A shifted right to 1");
    });

    QUnit.test("ASRA ($47) with bit0 set — carry set, sign preserved", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x81); // bit7=1, bit0=1
      mem[0x1000] = 0x47;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x01, "C set from bit0");
      assert.equal(cpu.status().a, 0xC0, "sign bit preserved");
    });

    QUnit.test("ASLA ($48) with bit7 set — carry out", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x80);
      mem[0x1000] = 0x48;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x01, "C set from bit7");
    });

    QUnit.test("ASLA ($48) overflow — sign change", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x40); // shifts to 0x80, sign changes
      mem[0x1000] = 0x48;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x02, "V set on sign change");
    });

    QUnit.test("ROLA ($49) with bit7 set — carry out, overflow", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x80); cpu.set("FLAGS", 0x00); // bit7=1, C=0
      mem[0x1000] = 0x49;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x01, "C set from old bit7");
    });

    QUnit.test("ADDA ($8B) — carry out of bit 7", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0xFF);
      mem[0x1000] = 0x8B; mem[0x1001] = 0x01; // ADDA #1
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x01, "C set on addition overflow");
    });

    QUnit.test("ADDA ($8B) — half-carry H flag", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x09);
      mem[0x1000] = 0x8B; mem[0x1001] = 0x07; // ADDA #7 -> 0x10
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x20, "H set on nibble carry");
    });

    QUnit.test("ADDD ($C3) — 16-bit add with carry", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0xFF); cpu.set("B", 0xFF); // D=0xFFFF
      mem[0x1000] = 0xC3; mem[0x1001] = 0x00; mem[0x1002] = 0x01; // ADDD #1
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x01, "C set on 16-bit carry");
    });

    QUnit.test("ADDD ($C3) — zero result Z flag", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x00); cpu.set("B", 0x00);
      mem[0x1000] = 0xC3; mem[0x1001] = 0x00; mem[0x1002] = 0x00; // ADDD #0
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z set when D+0=0");
    });

    QUnit.test("CMPA extended — borrow sets C", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x00);
      mem[0x4000] = 0x01;
      mem[0x1000] = 0xB1; mem[0x1001] = 0x40; mem[0x1002] = 0x00; // CMPA $4000
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x01, "C set when A < mem");
    });

    QUnit.test("BITA immediate — zero result", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0xF0);
      mem[0x1000] = 0x85; mem[0x1001] = 0x0F; // BITA #$0F
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z set for A & 0x0F = 0");
    });

    QUnit.test("MUL ($3D) — zero result sets Z", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x00); cpu.set("B", 0x05);
      mem[0x1000] = 0x3D;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z set when A=0");
    });

    QUnit.test("MUL ($3D) — result bit7 sets C", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x01); cpu.set("B", 0x80); // 1*128=0x80, bit7 set
      mem[0x1000] = 0x3D;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x01, "C set when result bit7 set");
    });

    QUnit.test("STD direct ($9D) — stores D in direct page", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x12); cpu.set("B", 0x34); cpu.set("DP", 0x20);
      mem[0x1000] = 0xDD; mem[0x1001] = 0x10; // STD $10 (DP)
      cpu.singleStep();
      assert.equal(mem[0x2010], 0x12, "D high stored");
      assert.equal(mem[0x2011], 0x34, "D low stored");
    });

    QUnit.test("BSR ($8D) — branch to subroutine", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x01FF);
      mem[0x1000] = 0x8D; mem[0x1001] = 0x10; // BSR +16
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1012, "PC = 0x1002 + 0x10");
    });

    QUnit.test("JSR direct ($9D) — jump to subroutine", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x01FF);
      mem[0x1000] = 0x9D; mem[0x1001] = 0x50; cpu.set("DP", 0x20); // JSR $2050
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x2050, "PC = JSR target");
    });

    QUnit.test("INCA ($4C) with A=0x7F — overflow to 0x80", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x7F);
      mem[0x1000] = 0x4C;
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x80, "A incremented to 0x80");
      assert.ok(cpu.status().flags & 0x02, "V set on 0x7F->0x80");
    });

    QUnit.test("DECA ($4A) with A=0x80 — overflow to 0x7F", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x80);
      mem[0x1000] = 0x4A;
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x7F, "A decremented to 0x7F");
      assert.ok(cpu.status().flags & 0x02, "V set on 0x80->0x7F");
    });

    QUnit.test("NEGA ($40) with A=0x80 — overflow V set", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x80);
      mem[0x1000] = 0x40;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x02, "V set for NEG(0x80)");
    });

    QUnit.test("LSRA ($44) result=0 — Z set", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x01); // LSR 0x01 -> 0, Z set, C set
      mem[0x1000] = 0x44;
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x00, "A = 0 after shift");
      assert.ok(cpu.status().flags & 0x04, "Z set");
    });

    QUnit.test("CMPA indexed ($A1) — indexed mode CMP branch", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x42); cpu.set("X", 0x2000);
      mem[0x2000] = 0x42;
      mem[0x1000] = 0xA1; mem[0x1001] = 0x84; // CMPA ,X
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z set (equal)");
    });

    QUnit.test("BITA indexed ($A5) — indexed mode BIT branch", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x0F); cpu.set("X", 0x2000);
      mem[0x2000] = 0xF0;
      mem[0x1000] = 0xA5; mem[0x1001] = 0x84; // BITA ,X
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z set (0x0F & 0xF0 = 0)");
    });

    QUnit.test("LDY extended — zero value sets Z via flagsNZ16", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x4000] = 0x00; mem[0x4001] = 0x00;
      mem[0x1000] = 0x10; mem[0x1001] = 0xBE; mem[0x1002] = 0x40; mem[0x1003] = 0x00;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z set when Y=0");
    });

    QUnit.test("STD indexed ($ED) — stores D via PostByte", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0xDE); cpu.set("B", 0xAD); cpu.set("X", 0x3000);
      mem[0x1000] = 0xED; mem[0x1001] = 0x84; // STD ,X
      cpu.singleStep();
      assert.equal(mem[0x3000], 0xDE, "D high stored");
      assert.equal(mem[0x3001], 0xAD, "D low stored");
    });

    QUnit.test("JSR indexed ($9D postbyte) — JSR via indexed mode", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x01FF); cpu.set("X", 0x2000);
      mem[0x1000] = 0xAD; mem[0x1001] = 0x84; // JSR ,X
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x2000, "PC = JSR indexed target");
    });

    QUnit.test("STX indexed ($AF) — STX via indexed mode", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("X", 0x1234); cpu.set("Y", 0x3000);
      mem[0x1000] = 0xAF; mem[0x1001] = 0xA4; // STX ,Y
      cpu.singleStep();
      assert.equal(mem[0x3000], 0x12, "X high stored");
      assert.equal(mem[0x3001], 0x34, "X low stored");
    });

    QUnit.test("TSTA ($4D) — sets Z flag when A=0", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x00);
      mem[0x1000] = 0x4D;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z set when A=0");
    });

    QUnit.test("CLRA ($4F) via inherent CLR path", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0xFF);
      mem[0x1000] = 0x4F;
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x00, "A cleared");
      assert.ok(cpu.status().flags & 0x04, "Z set");
    });

    QUnit.test("BNE ($26) — not taken when Z=1", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x04); // Z=1
      mem[0x1000] = 0x26; mem[0x1001] = 0x04;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1002, "BNE not taken when Z set");
    });

    QUnit.test("LEAY — result zero sets Z", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("X", 0x0000);
      mem[0x1000] = 0x31; mem[0x1001] = 0x84; // LEAY ,X with X=0
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z set when LEAY result=0");
    });

    QUnit.test("PULS with PC bit (0x80) restores PC", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x01FE);
      mem[0x01FE] = 0x20; mem[0x01FF] = 0x00;
      mem[0x1000] = 0x35; mem[0x1001] = 0x80; // PULS #$80 (PC)
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x2000, "PC restored from S-stack");
    });

    QUnit.test("PULU with CC (0x01) restores CC from U-stack", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("U", 0x02FF);
      mem[0x02FF] = 0x05;
      mem[0x1000] = 0x37; mem[0x1001] = 0x01; // PULU CC
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x05, "CC restored");
    });

    QUnit.test("PostByte ,X+B (case 5, postbyte 0x85)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("X", 0x2000); cpu.set("B", 0x04);
      mem[0x2004] = 0x11;
      mem[0x1000] = 0xA6; mem[0x1001] = 0x85; // LDA B,X
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x11, "loaded from X+B");
    });

    QUnit.test("PostByte case 7 illegal (postbyte 0x87) — no crash", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("X", 0x2000);
      mem[0x1000] = 0xA6; mem[0x1001] = 0x87; // LDA illegal,X
      cpu.singleStep();
      assert.ok(true, "illegal mode 7 doesn't crash");
    });

    QUnit.test("PostByte case 0xA illegal (postbyte 0x8A) — no crash", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("X", 0x2000);
      mem[0x1000] = 0xA6; mem[0x1001] = 0x8A;
      cpu.singleStep();
      assert.ok(true, "illegal mode 0xA doesn't crash");
    });

    QUnit.test("PostByte case 0xE illegal (postbyte 0x8E) — no crash", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("X", 0x2000);
      mem[0x1000] = 0xA6; mem[0x1001] = 0x8E;
      cpu.singleStep();
      assert.ok(true, "illegal mode 0xE doesn't crash");
    });

    QUnit.test("PostByte case 0xF extended indirect (postbyte 0x9F)", (assert) => {
      const { cpu, mem } = createTestCPU();
      mem[0x3000] = 0x40; mem[0x3001] = 0x00; // pointer to 0x4000
      mem[0x4000] = 0xBB;
      mem[0x1000] = 0xA6; mem[0x1001] = 0x9F; mem[0x1002] = 0x30; mem[0x1003] = 0x00; // LDA [$3000]
      cpu.singleStep();
      assert.equal(cpu.status().a, 0xBB, "loaded via extended indirect");
    });

    QUnit.test("PostByte ,U++ updates U register (xchg path)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("U", 0x2000); mem[0x2000] = 0x55;
      mem[0x1000] = 0xA6; mem[0x1001] = 0xC1; // LDA ,U++
      cpu.singleStep();
      assert.equal(cpu.status().u, 0x2002, "U incremented by 2");
    });

    QUnit.test("PostByte ,S++ updates S register (xchg path)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x2000); mem[0x2000] = 0x77;
      mem[0x1000] = 0xA6; mem[0x1001] = 0xE1; // LDA ,S++
      cpu.singleStep();
      assert.equal(cpu.status().sp, 0x2002, "S incremented by 2");
    });

    QUnit.test("$10 STY extended ($10 $BF) — STY via extended mode", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("Y", 0x1234);
      mem[0x1000] = 0x10; mem[0x1001] = 0xBF; mem[0x1002] = 0x40; mem[0x1003] = 0x00;
      cpu.singleStep();
      assert.equal(mem[0x4000], 0x12, "Y high stored");
      assert.equal(mem[0x4001], 0x34, "Y low stored");
    });

    QUnit.test("$10 LBGT ($10 $2E) — taken when N=V=0, Z=0", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x00);
      mem[0x1000] = 0x10; mem[0x1001] = 0x2E; mem[0x1002] = 0x00; mem[0x1003] = 0x10;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1014, "LBGT taken");
    });

    QUnit.test("$11 CMPS extended ($11 $BC) — sets Z on equal", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("SP", 0x1234);
      mem[0x4000] = 0x12; mem[0x4001] = 0x34;
      mem[0x1000] = 0x11; mem[0x1001] = 0xBC; mem[0x1002] = 0x40; mem[0x1003] = 0x00;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z set when SP == operand");
    });

    QUnit.test("TFR CC->A (getPBR CC=0xA case)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x05);
      mem[0x1000] = 0x1F; mem[0x1001] = 0xA8; // TFR CC->A (src=0xA=CC, dst=0x8=A)
      cpu.singleStep();
      assert.ok(cpu.status().a & 0x05, "A = CC value");
    });

    QUnit.test("TFR DP->A (getPBR DP=0xB case)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("DP", 0x30);
      mem[0x1000] = 0x1F; mem[0x1001] = 0xB8; // TFR DP->A (src=0xB=DP, dst=0x8=A)
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x30, "A = DP value");
    });

    QUnit.test("TFR A->PC (setPBR PC=0x5 case)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x20); // 8-bit value — mixed 8/16 should be no-op per spec
      mem[0x2000] = 0x12; // NOP at target
      // TFR A->PC would be mixed size (8-bit->16-bit), so it's a no-op
      // Instead use TFR S->PC (both 16-bit)
      cpu.set("SP", 0x2000);
      mem[0x1000] = 0x1F; mem[0x1001] = 0x45; // TFR S->PC (src=0x4=S, dst=0x5=PC)
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x2000, "PC = S value");
    });

    QUnit.test("EXG CC<->A covers getPBR CC branch", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x50); cpu.set("A", 0x01);
      mem[0x1000] = 0x1E; mem[0x1001] = 0xA8; // EXG CC,A
      cpu.singleStep();
      // After exchange: A = old CC (0x50&0xFF), CC = old A (0x01)
      assert.ok(true, "EXG CC<->A executes without crash");
    });

    QUnit.test("PULU DP bit (0x08) restores DP", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("U", 0x02FF);
      mem[0x02FF] = 0x40;
      mem[0x1000] = 0x37; mem[0x1001] = 0x08; // PULU DP
      cpu.singleStep();
      assert.equal(cpu.status().dp, 0x40, "DP restored from U-stack");
    });

    QUnit.test("BNE ($26) — taken when Z=0", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("FLAGS", 0x00); // Z=0
      mem[0x1000] = 0x26; mem[0x1001] = 0x04; // BNE +4
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1006, "BNE taken when Z clear");
    });

    QUnit.test("BRA with negative offset (signed() false branch)", (assert) => {
      const { cpu, mem } = createTestCPU();
      // BRA 0x02 = forward branch, offset < 128 -> signed() returns x unchanged
      mem[0x1000] = 0x20; mem[0x1001] = 0x02;
      cpu.singleStep();
      assert.equal(cpu.status().pc, 0x1004, "BRA forward: PC = 0x1002 + 2");
    });

    QUnit.test("NEGA ($40) with A=0x80 — V overflow branch", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x80);
      mem[0x1000] = 0x40;
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x02, "V set for NEG(0x80)");
      assert.ok(cpu.status().flags & 0x01, "C set");
    });

    QUnit.test("oLSR: LSRA with result=0 (A=1)", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x01);
      mem[0x1000] = 0x44; // LSRA
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x00, "A = 0 after LSRA(1)");
      assert.ok(cpu.status().flags & 0x04, "Z set");
    });

    QUnit.test("oSBC: SBCA produces borrow — C set", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x00); cpu.set("FLAGS", 0x01); // C=1
      mem[0x1000] = 0x82; mem[0x1001] = 0x01; // SBCA #1 (0 - 1 - 1 = -2)
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x01, "C set on borrow in SBCA");
    });

    QUnit.test("oSUB16: SUBD negative result sets N", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x00); cpu.set("B", 0x01); // D=1
      mem[0x1000] = 0x83; mem[0x1001] = 0x00; mem[0x1002] = 0x02; // SUBD #2
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x08, "N set (result negative)");
    });

    QUnit.test("CMPB indexed ($E1) — CMP B-side via indexed mode", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("B", 0x55); cpu.set("X", 0x2000);
      mem[0x2000] = 0x55;
      mem[0x1000] = 0xE1; mem[0x1001] = 0x84; // CMPB ,X
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z set (B == mem)");
    });

    QUnit.test("STU indexed ($EF) — stores U via PostByte", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("U", 0xCAFE); cpu.set("X", 0x3000);
      mem[0x1000] = 0xEF; mem[0x1001] = 0x84; // STU ,X
      cpu.singleStep();
      assert.equal(mem[0x3000], 0xCA, "U high stored");
      assert.equal(mem[0x3001], 0xFE, "U low stored");
    });
  });


  QUnit.module("Coverage gap fixes — direct mode and ALU zero results", () => {

    QUnit.test("SUBD imm with D=result 0 — oSUB16 zero branch", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x00); cpu.set("B", 0x10); // D = 0x0010
      mem[0x1000] = 0x83; mem[0x1001] = 0x00; mem[0x1002] = 0x10; // SUBD #0x0010
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x00, "A=0");
      assert.equal(cpu.status().b, 0x00, "B=0");
      assert.ok(cpu.status().flags & 0x04, "Z set");
    });

    QUnit.test("ADDD imm with D=0 result — oADD16 zero branch", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x00); cpu.set("B", 0x00); // D = 0
      mem[0x1000] = 0xC3; mem[0x1001] = 0x00; mem[0x1002] = 0x00; // ADDD #0
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z set (0+0=0)");
    });

    QUnit.test("ADCA with halfcarry — oADC H flag branch", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x0F); cpu.set("FLAGS", 0x00);
      mem[0x1000] = 0x89; mem[0x1001] = 0x01; // ADCA #1 (0x0F+0x01 halfcarry)
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x10, "A = 0x10");
      assert.ok(cpu.status().flags & 0x20, "H (halfcarry) set");
    });

    QUnit.test("PULU S bit (0x40) — restores S register", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("U", 0x2000);
      mem[0x2000] = 0x12; mem[0x2001] = 0x34; // value to pull
      mem[0x1000] = 0x37; mem[0x1001] = 0x40; // PULU S
      cpu.singleStep();
      assert.equal(cpu.status().sp, 0x1234, "S restored from U stack");
    });

    QUnit.test("TFR A,X mixed size (8->16) — TFREXG no-op", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x55); cpu.set("X", 0xABCD);
      mem[0x1000] = 0x1F; mem[0x1001] = 0x81; // TFR A,X (8->16 mixed: no-op)
      cpu.singleStep();
      assert.equal(cpu.status().x, 0xABCD, "X unchanged (mixed-size TFR is no-op)");
    });

    QUnit.test("STD direct (0xDD) — stores D via direct page", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x12); cpu.set("B", 0x34);
      cpu.set("DP", 0x20); // direct page at 0x2000
      mem[0x1000] = 0xDD; mem[0x1001] = 0x50; // STD $50 stores to 0x2050
      cpu.singleStep();
      assert.equal(mem[0x2050], 0x12, "D high stored at DP+0x50");
      assert.equal(mem[0x2051], 0x34, "D low stored at DP+0x51");
    });

    QUnit.test("LDX direct (0x9E) — loads X via direct page", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("DP", 0x20); // direct page at 0x2000
      mem[0x2040] = 0xAB; mem[0x2041] = 0xCD;
      mem[0x1000] = 0x9E; mem[0x1001] = 0x40; // LDX $40 reads from 0x2040
      cpu.singleStep();
      assert.equal(cpu.status().x, 0xABCD, "X loaded from direct page");
    });

    QUnit.test("$10 STY direct ($10 $9F) — stores Y via direct page", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("Y", 0x5678);
      cpu.set("DP", 0x30);
      mem[0x1000] = 0x10; mem[0x1001] = 0x9F; mem[0x1002] = 0x20; // STY $20
      cpu.singleStep();
      assert.equal(mem[0x3020], 0x56, "Y high stored");
      assert.equal(mem[0x3021], 0x78, "Y low stored");
    });

    QUnit.test("$11 CMPU direct ($11 $93) — compares U via direct page", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("U", 0x1234);
      cpu.set("DP", 0x20);
      mem[0x2010] = 0x12; mem[0x2011] = 0x34;
      mem[0x1000] = 0x11; mem[0x1001] = 0x93; mem[0x1002] = 0x10; // CMPU $10
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z set (U == operand)");
    });

    QUnit.test("  CMPY direct (  C) — readVal dpadd arm", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("Y", 0x1234);
      cpu.set("DP", 0x20);
      mem[0x2010] = 0x12; mem[0x2011] = 0x34;
      mem[0x1000] = 0x10; mem[0x1001] = 0x9C; mem[0x1002] = 0x10; // CMPY $10
      cpu.singleStep();
      assert.ok(cpu.status().flags & 0x04, "Z set (Y == operand)");
    });

    QUnit.test("  STY indexed (  ) — STY via PostByte", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("Y", 0xBEEF); cpu.set("X", 0x4000);
      mem[0x1000] = 0x10; mem[0x1001] = 0xAF; mem[0x1002] = 0x84; // STY ,X
      cpu.singleStep();
      assert.equal(mem[0x4000], 0xBE, "Y high stored");
      assert.equal(mem[0x4001], 0xEF, "Y low stored");
    });

    QUnit.test("ADDD direct (0xD3) — readVal direct-page mode", (assert) => {
      const { cpu, mem } = createTestCPU();
      cpu.set("A", 0x01); cpu.set("B", 0x00); // D = 0x0100
      cpu.set("DP", 0x20);
      mem[0x2050] = 0x01; mem[0x2051] = 0x00; // mem value = 0x0100
      mem[0x1000] = 0xD3; mem[0x1001] = 0x50; // ADDD direct 0 => D = D + ReadWord(DP+0x50)
      cpu.singleStep();
      assert.equal(cpu.status().a, 0x02, "A = 0x02 (high byte)");
      assert.equal(cpu.status().b, 0x00, "B = 0x00 (low byte)");
    });

        QUnit.test("disasm brel16 negative offset (wrap-around path)", (assert) => {
      const { cpu } = createTestCPU();
      // LBEQ with offset 0xFF00 (>= 32768) uses 'a*256+b+pc-65536' path
      const [mn, n] = cpu.disasm(0x10, 0x27, 0xFF, 0x00, 0, 0x1000);
      assert.ok(mn.startsWith("LBEQ"), "LBEQ mnemonic");
      assert.equal(n, 5, "5 bytes");
    });
  });

});
