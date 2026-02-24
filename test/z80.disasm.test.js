/**
 * Z80 Disassembler Test Suite
 *
 * Comprehensive tests for Z80 instruction disassembly
 */

import { disasm } from "../src/z80.js";

QUnit.module("Z80 Disassembler");

QUnit.test("Base instructions - 1 byte", (assert) => {
  assert.deepEqual(disasm(0x00, 0, 0, 0, 0, 0), ["NOP", 1], "NOP");
  assert.deepEqual(disasm(0x76, 0, 0, 0, 0, 0), ["HALT", 1], "HALT");
  assert.deepEqual(disasm(0x07, 0, 0, 0, 0, 0), ["RLCA", 1], "RLCA");
  assert.deepEqual(disasm(0x0F, 0, 0, 0, 0, 0), ["RRCA", 1], "RRCA");
  assert.deepEqual(disasm(0x17, 0, 0, 0, 0, 0), ["RLA", 1], "RLA");
  assert.deepEqual(disasm(0x1F, 0, 0, 0, 0, 0), ["RRA", 1], "RRA");
  assert.deepEqual(disasm(0x27, 0, 0, 0, 0, 0), ["DAA", 1], "DAA");
  assert.deepEqual(disasm(0x2F, 0, 0, 0, 0, 0), ["CPL", 1], "CPL");
  assert.deepEqual(disasm(0x37, 0, 0, 0, 0, 0), ["SCF", 1], "SCF");
  assert.deepEqual(disasm(0x3F, 0, 0, 0, 0, 0), ["CCF", 1], "CCF");
});

QUnit.test("Base instructions - LD reg,reg", (assert) => {
  assert.deepEqual(disasm(0x40, 0, 0, 0, 0, 0), ["LD    B,B", 1], "LD B,B");
  assert.deepEqual(disasm(0x41, 0, 0, 0, 0, 0), ["LD    B,C", 1], "LD B,C");
  assert.deepEqual(disasm(0x4F, 0, 0, 0, 0, 0), ["LD    C,A", 1], "LD C,A");
  assert.deepEqual(disasm(0x78, 0, 0, 0, 0, 0), ["LD    A,B", 1], "LD A,B");
  assert.deepEqual(disasm(0x7F, 0, 0, 0, 0, 0), ["LD    A,A", 1], "LD A,A");
});

QUnit.test("Base instructions - 2 byte immediate", (assert) => {
  assert.deepEqual(disasm(0x06, 0x42, 0, 0, 0, 0), ["LD    B,$42", 2], "LD B,n");
  assert.deepEqual(disasm(0x0E, 0xFF, 0, 0, 0, 0), ["LD    C,$FF", 2], "LD C,n");
  assert.deepEqual(disasm(0x3E, 0x00, 0, 0, 0, 0), ["LD    A,$00", 2], "LD A,n");
  assert.deepEqual(disasm(0x36, 0x55, 0, 0, 0, 0), ["LD    (HL),$55", 2], "LD (HL),n");
  assert.deepEqual(disasm(0xC6, 0x10, 0, 0, 0, 0), ["ADD   A,$10", 2], "ADD A,n");
  assert.deepEqual(disasm(0xD6, 0x20, 0, 0, 0, 0), ["SUB   $20", 2], "SUB n");
  assert.deepEqual(disasm(0xE6, 0x0F, 0, 0, 0, 0), ["AND   $0F", 2], "AND n");
  assert.deepEqual(disasm(0xF6, 0x80, 0, 0, 0, 0), ["OR    $80", 2], "OR n");
  assert.deepEqual(disasm(0xFE, 0x00, 0, 0, 0, 0), ["CP    $00", 2], "CP n");
});

QUnit.test("Base instructions - 3 byte immediate", (assert) => {
  assert.deepEqual(disasm(0x01, 0x34, 0x12, 0, 0, 0), ["LD    BC,$1234", 3], "LD BC,nn");
  assert.deepEqual(disasm(0x11, 0x78, 0x56, 0, 0, 0), ["LD    DE,$5678", 3], "LD DE,nn");
  assert.deepEqual(disasm(0x21, 0xCD, 0xAB, 0, 0, 0), ["LD    HL,$ABCD", 3], "LD HL,nn");
  assert.deepEqual(disasm(0x31, 0x00, 0xF0, 0, 0, 0), ["LD    SP,$F000", 3], "LD SP,nn");
  assert.deepEqual(disasm(0xC3, 0x00, 0x80, 0, 0, 0), ["JP    $8000", 3], "JP nn");
  assert.deepEqual(disasm(0xCD, 0x00, 0x00, 0, 0, 0), ["CALL  $0000", 3], "CALL nn");
});

QUnit.test("Relative jumps", (assert) => {
  assert.deepEqual(disasm(0x18, 0x00, 0, 0, 0, 0x1000), ["JR    1002", 2], "JR +0");
  assert.deepEqual(disasm(0x18, 0x05, 0, 0, 0, 0x1000), ["JR    1007", 2], "JR +5");
  assert.deepEqual(disasm(0x18, 0xFE, 0, 0, 0, 0x1000), ["JR    1000", 2], "JR -2");
  assert.deepEqual(disasm(0x20, 0x10, 0, 0, 0, 0x2000), ["JR    NZ,2012", 2], "JR NZ,n");
  assert.deepEqual(disasm(0x28, 0xF0, 0, 0, 0, 0x3000), ["JR    Z,2FF2", 2], "JR Z,n");
  assert.deepEqual(disasm(0x10, 0x0A, 0, 0, 0, 0x5000), ["DJNZ  500C", 2], "DJNZ n");
});

QUnit.test("CB prefix - Rotate and shift", (assert) => {
  assert.deepEqual(disasm(0xCB, 0x00, 0, 0, 0, 0), ["RLC   B", 2], "RLC B");
  assert.deepEqual(disasm(0xCB, 0x07, 0, 0, 0, 0), ["RLC   A", 2], "RLC A");
  assert.deepEqual(disasm(0xCB, 0x08, 0, 0, 0, 0), ["RRC   B", 2], "RRC B");
  assert.deepEqual(disasm(0xCB, 0x10, 0, 0, 0, 0), ["RL    B", 2], "RL B");
  assert.deepEqual(disasm(0xCB, 0x18, 0, 0, 0, 0), ["RR    B", 2], "RR B");
  assert.deepEqual(disasm(0xCB, 0x20, 0, 0, 0, 0), ["SLA   B", 2], "SLA B");
  assert.deepEqual(disasm(0xCB, 0x28, 0, 0, 0, 0), ["SRA   B", 2], "SRA B");
  assert.deepEqual(disasm(0xCB, 0x30, 0, 0, 0, 0), ["SLL   B", 2], "SLL B");
  assert.deepEqual(disasm(0xCB, 0x38, 0, 0, 0, 0), ["SRL   B", 2], "SRL B");
  assert.deepEqual(disasm(0xCB, 0x06, 0, 0, 0, 0), ["RLC   (HL)", 2], "RLC (HL)");
});

QUnit.test("CB prefix - BIT, RES, SET", (assert) => {
  assert.deepEqual(disasm(0xCB, 0x40, 0, 0, 0, 0), ["BIT   0,B", 2], "BIT 0,B");
  assert.deepEqual(disasm(0xCB, 0x46, 0, 0, 0, 0), ["BIT   0,(HL)", 2], "BIT 0,(HL)");
  assert.deepEqual(disasm(0xCB, 0x7F, 0, 0, 0, 0), ["BIT   7,A", 2], "BIT 7,A");
  assert.deepEqual(disasm(0xCB, 0x80, 0, 0, 0, 0), ["RES   0,B", 2], "RES 0,B");
  assert.deepEqual(disasm(0xCB, 0x86, 0, 0, 0, 0), ["RES   0,(HL)", 2], "RES 0,(HL)");
  assert.deepEqual(disasm(0xCB, 0xBF, 0, 0, 0, 0), ["RES   7,A", 2], "RES 7,A");
  assert.deepEqual(disasm(0xCB, 0xC0, 0, 0, 0, 0), ["SET   0,B", 2], "SET 0,B");
  assert.deepEqual(disasm(0xCB, 0xC6, 0, 0, 0, 0), ["SET   0,(HL)", 2], "SET 0,(HL)");
  assert.deepEqual(disasm(0xCB, 0xFF, 0, 0, 0, 0), ["SET   7,A", 2], "SET 7,A");
});

QUnit.test("ED prefix - Basic extended instructions", (assert) => {
  assert.deepEqual(disasm(0xED, 0x44, 0, 0, 0, 0), ["NEG", 2], "NEG");
  assert.deepEqual(disasm(0xED, 0x45, 0, 0, 0, 0), ["RETN", 2], "RETN");
  assert.deepEqual(disasm(0xED, 0x4D, 0, 0, 0, 0), ["RETI", 2], "RETI");
  assert.deepEqual(disasm(0xED, 0x46, 0, 0, 0, 0), ["IM    0", 2], "IM 0");
  assert.deepEqual(disasm(0xED, 0x56, 0, 0, 0, 0), ["IM    1", 2], "IM 1");
  assert.deepEqual(disasm(0xED, 0x5E, 0, 0, 0, 0), ["IM    2", 2], "IM 2");
  assert.deepEqual(disasm(0xED, 0x67, 0, 0, 0, 0), ["RRD", 2], "RRD");
  assert.deepEqual(disasm(0xED, 0x6F, 0, 0, 0, 0), ["RLD", 2], "RLD");
});

QUnit.test("ED prefix - Block instructions", (assert) => {
  assert.deepEqual(disasm(0xED, 0xA0, 0, 0, 0, 0), ["LDI", 2], "LDI");
  assert.deepEqual(disasm(0xED, 0xA1, 0, 0, 0, 0), ["CPI", 2], "CPI");
  assert.deepEqual(disasm(0xED, 0xA2, 0, 0, 0, 0), ["INI", 2], "INI");
  assert.deepEqual(disasm(0xED, 0xA3, 0, 0, 0, 0), ["OUTI", 2], "OUTI");
  assert.deepEqual(disasm(0xED, 0xB0, 0, 0, 0, 0), ["LDIR", 2], "LDIR");
  assert.deepEqual(disasm(0xED, 0xB1, 0, 0, 0, 0), ["CPIR", 2], "CPIR");
  assert.deepEqual(disasm(0xED, 0xB8, 0, 0, 0, 0), ["LDDR", 2], "LDDR");
  assert.deepEqual(disasm(0xED, 0xB9, 0, 0, 0, 0), ["CPDR", 2], "CPDR");
});

QUnit.test("ED prefix - 16-bit loads", (assert) => {
  assert.deepEqual(disasm(0xED, 0x43, 0x00, 0x80, 0, 0), ["LD    ($8000),BC", 4], "LD (nn),BC");
  assert.deepEqual(disasm(0xED, 0x4B, 0x34, 0x12, 0, 0), ["LD    BC,($1234)", 4], "LD BC,(nn)");
  assert.deepEqual(disasm(0xED, 0x53, 0x78, 0x56, 0, 0), ["LD    ($5678),DE", 4], "LD (nn),DE");
  assert.deepEqual(disasm(0xED, 0x5B, 0xCD, 0xAB, 0, 0), ["LD    DE,($ABCD)", 4], "LD DE,(nn)");
  assert.deepEqual(disasm(0xED, 0x73, 0x00, 0xF0, 0, 0), ["LD    ($F000),SP", 4], "LD (nn),SP");
  assert.deepEqual(disasm(0xED, 0x7B, 0xFF, 0xFF, 0, 0), ["LD    SP,($FFFF)", 4], "LD SP,(nn)");
});

QUnit.test("DD prefix - IX register operations", (assert) => {
  assert.deepEqual(disasm(0xDD, 0x21, 0x34, 0x12, 0, 0), ["LD    IX,$1234", 4], "LD IX,nn");
  assert.deepEqual(disasm(0xDD, 0x22, 0x00, 0x80, 0, 0), ["LD    ($8000),IX", 4], "LD (nn),IX");
  assert.deepEqual(disasm(0xDD, 0x2A, 0x34, 0x12, 0, 0), ["LD    IX,($1234)", 4], "LD IX,(nn)");
  assert.deepEqual(disasm(0xDD, 0x23, 0, 0, 0, 0), ["INC   IX", 2], "INC IX");
  assert.deepEqual(disasm(0xDD, 0x2B, 0, 0, 0, 0), ["DEC   IX", 2], "DEC IX");
  assert.deepEqual(disasm(0xDD, 0x09, 0, 0, 0, 0), ["ADD   IX,BC", 2], "ADD IX,BC");
  assert.deepEqual(disasm(0xDD, 0x29, 0, 0, 0, 0), ["ADD   IX,IX", 2], "ADD IX,IX");
  assert.deepEqual(disasm(0xDD, 0xE1, 0, 0, 0, 0), ["POP   IX", 2], "POP IX");
  assert.deepEqual(disasm(0xDD, 0xE5, 0, 0, 0, 0), ["PUSH  IX", 2], "PUSH IX");
  assert.deepEqual(disasm(0xDD, 0xE9, 0, 0, 0, 0), ["JP    (IX)", 2], "JP (IX)");
});

QUnit.test("DD prefix - Indexed addressing with positive offset", (assert) => {
  assert.deepEqual(disasm(0xDD, 0x7E, 0x05, 0, 0, 0), ["LD    A,(IX+$05)", 3], "LD A,(IX+d)");
  assert.deepEqual(disasm(0xDD, 0x46, 0x10, 0, 0, 0), ["LD    B,(IX+$10)", 3], "LD B,(IX+d)");
  assert.deepEqual(disasm(0xDD, 0x70, 0x00, 0, 0, 0), ["LD    (IX+$00),B", 3], "LD (IX+d),B");
  assert.deepEqual(disasm(0xDD, 0x77, 0x7F, 0, 0, 0), ["LD    (IX+$7F),A", 3], "LD (IX+d),A");
  assert.deepEqual(disasm(0xDD, 0x34, 0x01, 0, 0, 0), ["INC   (IX+$01)", 3], "INC (IX+d)");
  assert.deepEqual(disasm(0xDD, 0x35, 0x02, 0, 0, 0), ["DEC   (IX+$02)", 3], "DEC (IX+d)");
  assert.deepEqual(disasm(0xDD, 0x86, 0x03, 0, 0, 0), ["ADD   A,(IX+$03)", 3], "ADD A,(IX+d)");
});

QUnit.test("DD prefix - Indexed addressing with negative offset", (assert) => {
  assert.deepEqual(disasm(0xDD, 0x7E, 0xFE, 0, 0, 0), ["LD    A,(IX-$02)", 3], "LD A,(IX-2)");
  assert.deepEqual(disasm(0xDD, 0x46, 0x80, 0, 0, 0), ["LD    B,(IX-$80)", 3], "LD B,(IX-128)");
  assert.deepEqual(disasm(0xDD, 0x77, 0xFF, 0, 0, 0), ["LD    (IX-$01),A", 3], "LD (IX-1),A");
});

QUnit.test("DD prefix - IX high/low operations", (assert) => {
  assert.deepEqual(disasm(0xDD, 0x24, 0, 0, 0, 0), ["INC   IXH", 2], "INC IXH");
  assert.deepEqual(disasm(0xDD, 0x2C, 0, 0, 0, 0), ["INC   IXL", 2], "INC IXL");
  assert.deepEqual(disasm(0xDD, 0x44, 0, 0, 0, 0), ["LD    B,IXH", 2], "LD B,IXH");
  assert.deepEqual(disasm(0xDD, 0x7C, 0, 0, 0, 0), ["LD    A,IXH", 2], "LD A,IXH");
  assert.deepEqual(disasm(0xDD, 0x84, 0, 0, 0, 0), ["ADD   A,IXH", 2], "ADD A,IXH");
});

QUnit.test("FD prefix - IY register operations", (assert) => {
  assert.deepEqual(disasm(0xFD, 0x21, 0xCD, 0xAB, 0, 0), ["LD    IY,$ABCD", 4], "LD IY,nn");
  assert.deepEqual(disasm(0xFD, 0x22, 0x00, 0x40, 0, 0), ["LD    ($4000),IY", 4], "LD (nn),IY");
  assert.deepEqual(disasm(0xFD, 0x2A, 0xFF, 0xFF, 0, 0), ["LD    IY,($FFFF)", 4], "LD IY,(nn)");
  assert.deepEqual(disasm(0xFD, 0x23, 0, 0, 0, 0), ["INC   IY", 2], "INC IY");
  assert.deepEqual(disasm(0xFD, 0x7E, 0x10, 0, 0, 0), ["LD    A,(IY+$10)", 3], "LD A,(IY+d)");
  assert.deepEqual(disasm(0xFD, 0x77, 0xF0, 0, 0, 0), ["LD    (IY-$10),A", 3], "LD (IY-16),A");
});

QUnit.test("DDCB prefix - Indexed bit operations with IX", (assert) => {
  assert.deepEqual(disasm(0xDD, 0xCB, 0x05, 0x06, 0, 0), ["RLC   (IX+$05)", 4], "RLC (IX+d)");
  assert.deepEqual(disasm(0xDD, 0xCB, 0x02, 0x0E, 0, 0), ["RRC   (IX+$02)", 4], "RRC (IX+d)");
  assert.deepEqual(disasm(0xDD, 0xCB, 0x00, 0x46, 0, 0), ["BIT   0,(IX+$00)", 4], "BIT 0,(IX+d)");
  assert.deepEqual(disasm(0xDD, 0xCB, 0x10, 0x7E, 0, 0), ["BIT   7,(IX+$10)", 4], "BIT 7,(IX+d)");
  assert.deepEqual(disasm(0xDD, 0xCB, 0x01, 0x86, 0, 0), ["RES   0,(IX+$01)", 4], "RES 0,(IX+d)");
  assert.deepEqual(disasm(0xDD, 0xCB, 0xFF, 0xCE, 0, 0), ["SET   1,(IX-$01)", 4], "SET 1,(IX-1)");
});

QUnit.test("FDCB prefix - Indexed bit operations with IY", (assert) => {
  assert.deepEqual(disasm(0xFD, 0xCB, 0x03, 0x16, 0, 0), ["RL    (IY+$03)", 4], "RL (IY+d)");
  assert.deepEqual(disasm(0xFD, 0xCB, 0xFE, 0x66, 0, 0), ["BIT   4,(IY-$02)", 4], "BIT 4,(IY-2)");
  assert.deepEqual(disasm(0xFD, 0xCB, 0x20, 0xF6, 0, 0), ["SET   6,(IY+$20)", 4], "SET 6,(IY+d)");
});

QUnit.test("Edge cases", (assert) => {
  // Test with undefined operands
  assert.deepEqual(disasm(0x00), ["NOP", 1], "NOP with undefined operands");

  // Test relative jump wrapping
  assert.deepEqual(disasm(0x18, 0x7F, 0, 0, 0, 0xFFF0), ["JR    0071", 2], "JR forward wrap");

  // Test 4-byte indexed immediate
  assert.deepEqual(disasm(0xDD, 0x36, 0x05, 0x42, 0, 0), ["LD    (IX+$05),$42", 4], "LD (IX+d),n");
  assert.deepEqual(disasm(0xFD, 0x36, 0xFE, 0xFF, 0, 0), ["LD    (IY-$02),$FF", 4], "LD (IY-2),n");
});
