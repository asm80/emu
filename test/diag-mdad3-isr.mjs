import { createZXS } from "../src/devices/zxs/zxspectrum.js";
import { readFileSync } from "fs";
import { disasm } from "../src/z80.js";

const zxs = createZXS({ model: "128k", sampleRate: 44100 });
const sna = new Uint8Array(readFileSync(new URL("../src/devices/zxs/mdad3.sna", import.meta.url)));
zxs.reset();
zxs.loadSNA(sna);

const ram = zxs.getRAM();

const readMem = (addr) => {
  if (addr < 0x4000) return 0xFF;
  if (addr < 0x8000) return ram[5 * 16384 + (addr - 0x4000)];  // bank 5
  if (addr < 0xC000) return ram[2 * 16384 + (addr - 0x8000)];  // bank 2
  return 0xFF;
};

// Z80 instruction T-states (approximate, non-contended, for common instructions)
const tStates = (b0, b1, len) => {
  if (b0 === 0x00) return 4;           // NOP
  if (b0 === 0x76) return 4;           // HALT
  if (b0 === 0x10) return 13;          // DJNZ (taken)
  if ((b0 & 0xC7) === 0x06) return 7; // LD r,n
  if ((b0 & 0xC7) === 0x46) return 7; // LD r,(HL)
  if (b0 === 0x3E) return 7;          // LD A,n
  if (b0 === 0x01) return 10;         // LD BC,nn
  if (b0 === 0x11) return 10;         // LD DE,nn
  if (b0 === 0x21) return 10;         // LD HL,nn
  if (b0 === 0xD3) return 11;         // OUT (n),A
  if (b0 === 0xED && b1 === 0x79) return 12; // OUT (C),A
  if (b0 === 0xED && b1 === 0x71) return 12; // OUT (C),0
  if ((b0 & 0xC0) === 0x40 && b0 !== 0x76) return 4; // LD r,r'
  if ((b0 & 0xF8) === 0xB8) return 4; // CP r
  if ((b0 & 0xF8) === 0xA8) return 4; // XOR r
  if ((b0 & 0xF8) === 0x80) return 4; // ADD r
  if (b0 === 0xFE) return 7;          // CP n
  if (b0 === 0xC3) return 10;         // JP nn
  if ((b0 & 0xC7) === 0xC2) return 10; // JP cc,nn
  if (b0 === 0x18) return 12;         // JR e
  if ((b0 & 0xE7) === 0x20) return 12; // JR cc,e (taken)
  if (b0 === 0xF5) return 11;         // PUSH AF
  if ((b0 & 0xCF) === 0xC5) return 11; // PUSH rr
  if (b0 === 0xF1) return 10;         // POP AF
  if ((b0 & 0xCF) === 0xC1) return 10; // POP rr
  if (b0 === 0xFB) return 4;          // EI
  if (b0 === 0xF3) return 4;          // DI
  if (b0 === 0xED && b1 === 0x4D) return 14; // RETI
  if (b0 === 0xED && b1 === 0x45) return 14; // RETN
  if (b0 === 0xC9) return 10;         // RET
  if ((b0 & 0xC7) === 0x04) return 4; // INC r
  if ((b0 & 0xC7) === 0x05) return 4; // DEC r
  if (b0 === 0x03 || b0 === 0x13 || b0 === 0x23 || b0 === 0x33) return 6; // INC rr
  if (b0 === 0x0B || b0 === 0x1B || b0 === 0x2B || b0 === 0x3B) return 6; // DEC rr
  return len * 4; // fallback
};

const disasmAt = (startPc, maxInsns = 100) => {
  let pc = startPc;
  let totalT = 0;
  for (let i = 0; i < maxInsns; i++) {
    const b0 = readMem(pc), b1 = readMem(pc+1), b2 = readMem(pc+2), b3 = readMem(pc+3);
    const [mnem, len] = disasm(b0, b1, b2, b3);
    const t = tStates(b0, b1, len);
    totalT += t;
    const bytes = [b0,b1,b2,b3].slice(0,len).map(b=>b.toString(16).padStart(2,'0')).join(' ');
    console.log(`  ${pc.toString(16).toUpperCase().padStart(4,'0')}: ${bytes.padEnd(12)} ${mnem.padEnd(20)} ; ${t}T (cumul: ${totalT}T)`);
    pc = (pc + len) & 0xFFFF;
    if (b0 === 0xED && (b1 === 0x4D || b1 === 0x45)) break;
    if (b0 === 0xC9) break;
    if (i > 50 && (b0 === 0xC3 || b0 === 0x18)) break; // stop at JP/JR to avoid loops
  }
  return totalT;
};

console.log("ISR at 0x8181 → JP 0x92ED\nDisassembling from 0x92ED:\n");
disasmAt(0x92ED);
