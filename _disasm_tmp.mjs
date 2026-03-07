import { readFileSync, writeFileSync } from "fs";

// 8080 disassembly table — extracted from src/8080.js (disasmTable only)
const T = [["NOP",1],["LXI B,#1",3],["STAX B",1],["INX B",1],["INR B",1],["DCR B",1],["MVI B,%1",2],["RLC",1],["-",1],["DAD B",1],["LDAX B",1],["DCX B",1],["INR C",1],["DCR C",1],["MVI C,%1",2],["RRC",1],["-",1],["LXI D,#1",3],["STAX D",1],["INX D",1],["INR D",1],["DCR D",1],["MVI D,%1",2],["RAL",1],["-",1],["DAD D",1],["LDAX D",1],["DCX D",1],["INR E",1],["DCR E",1],["MVI E,%1",2],["RAR",1],["RIM",1],["LXI H,#1",3],["SHLD #1",3],["INX H",1],["INR H",1],["DCR H",1],["MVI H,%1",2],["DAA",1],["-",1],["DAD H",1],["LHLD #1",3],["DCX H",1],["INR L",1],["DCR L",1],["MVI L,%1",2],["CMA",1],["SIM",1],["LXI SP,#1",3],["STA #1",3],["INX SP",1],["INR M",1],["DCR M",1],["MVI M,%1",2],["STC",1],["-",1],["DAD SP",1],["LDA #1",3],["DCX SP",1],["INR A",1],["DCR A",1],["MVI A,%1",2],["CMC",1],["MOV B,B",1],["MOV B,C",1],["MOV B,D",1],["MOV B,E",1],["MOV B,H",1],["MOV B,L",1],["MOV B,M",1],["MOV B,A",1],["MOV C,B",1],["MOV C,C",1],["MOV C,D",1],["MOV C,E",1],["MOV C,H",1],["MOV C,L",1],["MOV C,M",1],["MOV C,A",1],["MOV D,B",1],["MOV D,C",1],["MOV D,D",1],["MOV D,E",1],["MOV D,H",1],["MOV D,L",1],["MOV D,M",1],["MOV D,A",1],["MOV E,B",1],["MOV E,C",1],["MOV E,D",1],["MOV E,E",1],["MOV E,H",1],["MOV E,L",1],["MOV E,M",1],["MOV E,A",1],["MOV H,B",1],["MOV H,C",1],["MOV H,D",1],["MOV H,E",1],["MOV H,H",1],["MOV H,L",1],["MOV H,M",1],["MOV H,A",1],["MOV L,B",1],["MOV L,C",1],["MOV L,D",1],["MOV L,E",1],["MOV L,H",1],["MOV L,L",1],["MOV L,M",1],["MOV L,A",1],["MOV M,B",1],["MOV M,C",1],["MOV M,D",1],["MOV M,E",1],["MOV M,H",1],["MOV M,L",1],["HLT",1],["MOV M,A",1],["MOV A,B",1],["MOV A,C",1],["MOV A,D",1],["MOV A,E",1],["MOV A,H",1],["MOV A,L",1],["MOV A,M",1],["MOV A,A",1],["ADD B",1],["ADD C",1],["ADD D",1],["ADD E",1],["ADD H",1],["ADD L",1],["ADD M",1],["ADD A",1],["ADC B",1],["ADC C",1],["ADC D",1],["ADC E",1],["ADC H",1],["ADC L",1],["ADC M",1],["ADC A",1],["SUB B",1],["SUB C",1],["SUB D",1],["SUB E",1],["SUB H",1],["SUB L",1],["SUB M",1],["SUB A",1],["SBB B",1],["SBB C",1],["SBB D",1],["SBB E",1],["SBB H",1],["SBB L",1],["SBB M",1],["SBB A",1],["ANA B",1],["ANA C",1],["ANA D",1],["ANA E",1],["ANA H",1],["ANA L",1],["ANA M",1],["ANA A",1],["XRA B",1],["XRA C",1],["XRA D",1],["XRA E",1],["XRA H",1],["XRA L",1],["XRA M",1],["XRA A",1],["ORA B",1],["ORA C",1],["ORA D",1],["ORA E",1],["ORA H",1],["ORA L",1],["ORA M",1],["ORA A",1],["CMP B",1],["CMP C",1],["CMP D",1],["CMP E",1],["CMP H",1],["CMP L",1],["CMP M",1],["CMP A",1],["RNZ",1],["POP B",1],["JNZ #1",3],["JMP #1",3],["CNZ #1",3],["PUSH B",1],["ADI %1",2],["RST 0",1],["RZ",1],["RET",1],["JZ #1",3],["-",1],["CZ #1",3],["CALL #1",3],["ACI %1",2],["RST 1",1],["RNC",1],["POP D",1],["JNC #1",3],["OUT %1",2],["CNC #1",3],["PUSH D",1],["SUI %1",2],["RST 2",1],["RC",1],["-",1],["JC #1",3],["IN %1",2],["CC #1",3],["-",1],["SBI %1",2],["RST 3",1],["RPO",1],["POP H",1],["JPO #1",3],["XTHL",1],["CPO #1",3],["PUSH H",1],["ANI %1",2],["RST 4",1],["RPE",1],["PCHL",1],["JPE #1",3],["XCHG",1],["CPE #1",3],["-",1],["XRI %1",2],["RST 5",1],["RP",1],["POP PSW",1],["JP #1",3],["DI",1],["CP #1",3],["PUSH PSW",1],["ORI %1",2],["RST 6",1],["RM",1],["SPHL",1],["JM #1",3],["EI",1],["CM #1",3],["-",1],["CPI %1",2],["RST 7",1]];

const h2 = v => v.toString(16).toUpperCase().padStart(2, "0");
const h4 = v => v.toString(16).toUpperCase().padStart(4, "0");

const disasm = (op, a, b) => {
  const [mn, sz] = T[op];
  const s = mn
    .replace("#1", `$${h2(b)}${h2(a)}`)
    .replace("%1", `$${h2(a)}`);
  return [s, sz];
};

// ── Parse Intel HEX and disassemble ──────────────────────────────────────────
const disasmHex = (hexFile, label, outFile) => {
  const mem = new Uint8Array(65536);
  let minAddr = 0xFFFF, maxAddr = 0;

  for (const line of readFileSync(hexFile, "utf8").split("\n")) {
    if (!line.startsWith(":")) continue;
    const bytes = line.slice(1).match(/../g).map(h => parseInt(h, 16));
    const len  = bytes[0];
    const addr = (bytes[1] << 8) | bytes[2];
    const type = bytes[3];
    if (type !== 0x00) continue;
    for (let i = 0; i < len; i++) {
      mem[addr + i] = bytes[4 + i];
      if (addr + i < minAddr) minAddr = addr + i;
      if (addr + i > maxAddr) maxAddr = addr + i;
    }
  }

  const out = [
    `; ${label}  —  PMD-85  Intel 8080 disassembly`,
    `; org $${h4(minAddr)}   size ${maxAddr - minAddr + 1} bytes`,
    ``,
    `        ORG  $${h4(minAddr)}`,
    ``,
  ];

  let pc = minAddr;
  while (pc <= maxAddr) {
    const [mn, sz] = disasm(mem[pc], mem[pc + 1], mem[pc + 2]);
    const raw = Array.from(mem.slice(pc, pc + sz)).map(h2).join(" ").padEnd(8);
    out.push(`${h4(pc)}:  ${raw}  ${mn}`);
    pc += sz;
  }

  writeFileSync(outFile, out.join("\n") + "\n");
  console.log(`Written ${outFile} — ${out.length - 5} instructions, ${pc - minAddr} bytes`);
};

// Re-generate willy.hex from the original willy.pmd, skipping first data byte (0x92)
// so that 0x02 lands at the load address 0x7D6C
import { decodePMDFile } from "./src/devices/pmd/pmd85-tape-decoder.js";
const willyPmd = readFileSync("src/devices/pmd/willy.pmd");
const { blocks: [willyBlock] } = decodePMDFile(
  new Uint8Array(willyPmd.buffer, willyPmd.byteOffset, willyPmd.byteLength), "willy.pmd"
);
// Skip byte 0 (0x92), keep load address unchanged
const willyData = willyBlock.bytes.subarray(2);
const willyLoad = willyBlock.load;
const willyOut = [];
const REC = 16;
for (let off = 0; off < willyData.length; off += REC) {
  const addr  = willyLoad + off;
  const chunk = Math.min(REC, willyData.length - off);
  const data  = Array.from(willyData.subarray(off, off + chunk));
  const rec   = [chunk, (addr >> 8) & 0xFF, addr & 0xFF, 0x00, ...data];
  const chk   = ((~rec.reduce((a, b) => a + b, 0)) + 1) & 0xFF;
  willyOut.push(`:${h2(chunk)}${h4(addr)}00${data.map(h2).join("")}${h2(chk)}`);
}
willyOut.push(":00000001FF");
writeFileSync("src/devices/pmd/willy.hex", willyOut.join("\n") + "\n");
console.log(`Re-written willy.hex — $${h4(willyLoad)} = 0x${h2(willyData[0])}, skipped 0x92`);

disasmHex("src/devices/pmd/manic.hex", "manic.pmd", "src/devices/pmd/manic.asm");
disasmHex("src/devices/pmd/willy.hex", "willy.pmd", "src/devices/pmd/willy.asm");
