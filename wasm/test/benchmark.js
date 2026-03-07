/**
 * Benchmark: Intel 8080 JS vs WASM — 1 000 000 ticků, 3 opakování
 *
 * Program (Intel HEX):
 *   :100000003E233C21393006FF7E12132305C208002F
 *   :03001000C300002A
 *
 * Disassembly (outer loop od 0x0000, inner loop 0x0008–0x000F):
 *   0000: 3E 23     MVI A,0x23    7T  init
 *   0002: 3C        INR A         5T
 *   0003: 21 39 30  LXI H,0x3039 10T  HL = src (RAM 0x3039)
 *   0006: 06 FF     MVI B,0xFF    7T  B = 255 (počítadlo)
 *   0008: 7E        MOV A,[HL]    7T  čti byte z RAM ← memory read
 *   0009: 12        STAX D        7T  piš na [DE] ← memory write
 *   000A: 13        INX D         5T
 *   000B: 23        INX H         5T
 *   000C: 05        DCR B         5T
 *   000D: C2 08 00  JNZ 0x0008   10T  (taken 254×)
 *   0010: C3 00 00  JMP 0x0000   10T
 * Inner smyčka: 255× (7+7+5+5+5+10)T = 255×39T = 9 945T
 * + outer overhead: ~46T → celkem ~9 991T/vnější iteraci.
 * Reálná zátěž: čtení + zápis paměti, větvení, 16bit registry.
 *
 * Spustit:
 *   node test/benchmark.js
 */

import { readFileSync }            from "fs";
import { resolve, dirname }        from "path";
import { fileURLToPath }           from "url";
import CPU8080                     from "../../src/8080.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WASM_PATH = resolve(__dirname, "../out/8080.wasm");
const TICKS     = 550_000_000;
const RUNS      = 4;

// ─── Pomocné funkce ───────────────────────────────────────────────────────────

const fmt = (ms) => ms.toFixed(2).padStart(8) + " ms";
const mips = (ms) => (TICKS / ms / 1000).toFixed(2).padStart(7) + " M ticks/s";

function printResult(label, times) {
  console.log(`\n  ${label}`);
  for (let i = 0; i < times.length; i++) {
    console.log(`    Run ${i + 1}: ${fmt(times[i])}  (${mips(times[i])})`);
  }
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  console.log(`    Avg:   ${fmt(avg)}  (${mips(avg)})`);
}

// ─── Intel HEX parser ─────────────────────────────────────────────────────────

/**
 * Parsuje Intel HEX text a vrátí pole { addr, data } záznamů.
 * Podporuje pouze typ 0x00 (Data) a 0x01 (EOF).
 */
function parseIntelHex(hexText) {
  const records = [];
  for (const line of hexText.trim().split(/\r?\n/)) {
    if (!line.startsWith(":")) continue;
    const bytes = line.slice(1).match(/../g).map(h => parseInt(h, 16));
    const byteCount = bytes[0];
    const addr      = (bytes[1] << 8) | bytes[2];
    const recType   = bytes[3];
    if (recType === 0x01) break;             // EOF record
    if (recType !== 0x00) continue;          // přeskočit non-data záznamy
    records.push({ addr, data: bytes.slice(4, 4 + byteCount) });
  }
  return records;
}

/**
 * Z pole záznamů sestaví Uint8Array s offsetem + délkou pokrývající vše.
 * Vrátí { image: Uint8Array, baseAddr: number }.
 */
function hexToImage(records) {
  if (records.length === 0) return { image: new Uint8Array(0), baseAddr: 0 };
  const baseAddr = records[0].addr;
  const lastRec  = records[records.length - 1];
  const size     = lastRec.addr + lastRec.data.length - baseAddr;
  const image    = new Uint8Array(size);
  for (const { addr, data } of records) {
    image.set(data, addr - baseAddr);
  }
  return { image, baseAddr };
}

// ─── Testovací program (Intel HEX) ────────────────────────────────────────────

const HEX_SRC = `
:100000003E233C21393006FF7E12132305C208002F
:03001000C300002A
:00000001FF
`;

const { image: PROGRAM, baseAddr: PROGRAM_BASE } = hexToImage(parseIntelHex(HEX_SRC));

// ─── JS benchmark ─────────────────────────────────────────────────────────────

function benchJS() {
  const mem = new Uint8Array(65536);

  const cpu = CPU8080({
    byteAt: (addr) => mem[addr & 0xFFFF],
    byteTo: (addr, val) => { mem[addr & 0xFFFF] = val; },
    portIn:  (_port) => 0,
    portOut: (_port, _val) => {},
  });

  // JS API: steps(n) spotřebuje n T-stavů (interně volá step() ve smyčce)
  const times = [];
  for (let run = 0; run < RUNS; run++) {
    // Program přepisuje RAM (STAX D, DE=0 po reset) → nutný reset paměti
    mem.fill(0);
    mem.set(PROGRAM, PROGRAM_BASE);
    cpu.reset();
    const t0 = performance.now();
    cpu.steps(TICKS);
    times.push(performance.now() - t0);
  }
  return times;
}

// ─── WASM benchmark ───────────────────────────────────────────────────────────

async function benchWASM() {
  const bytes  = readFileSync(WASM_PATH);
  const { instance } = await WebAssembly.instantiate(bytes, {
    env: {
      js_mmioRead:  (_addr)       => 0,
      js_mmioWrite: (_addr, _val) => {},
      js_portIn:    (_port)       => 0,
      js_portOut:   (_port, _val) => {},
      abort: () => { throw new Error("WASM abort"); },
    },
  });

  const ex  = instance.exports;
  // CPU prostor je na stránce 1 (0x10000–0x1FFFF) — Uint8Array pro čistý reset
  const mem = new Uint8Array(ex.memory.buffer, 0x10000, 65536);

  // WASM: step() vrací spotřebované T-stavy — počítáme stejně jako JS steps()
  const times = [];
  for (let run = 0; run < RUNS; run++) {
    ex.reset();
    mem.fill(0);
    mem.set(PROGRAM, PROGRAM_BASE);
    const t0 = performance.now();
    let totalT = 0;
    while (totalT < TICKS) totalT += ex.step();
    times.push(performance.now() - t0);
  }
  return times;
}

// ─── WASM tight-loop benchmark (runTicks — smyčka celá uvnitř WASM) ───────────

async function benchWASMTight() {
  const bytes  = readFileSync(WASM_PATH);
  const { instance } = await WebAssembly.instantiate(bytes, {
    env: {
      js_mmioRead:  (_addr)       => 0,
      js_mmioWrite: (_addr, _val) => {},
      js_portIn:    (_port)       => 0,
      js_portOut:   (_port, _val) => {},
      abort: () => { throw new Error("WASM abort"); },
    },
  });

  const ex  = instance.exports;
  const mem = new Uint8Array(ex.memory.buffer, 0x10000, 65536);

  // runTicks(n): celá smyčka uvnitř WASM, jedno volání přes hranici na celý blok
  const times = [];
  for (let run = 0; run < RUNS; run++) {
    ex.reset();
    mem.fill(0);
    mem.set(PROGRAM, PROGRAM_BASE);
    const t0 = performance.now();
    ex.runTicks(TICKS);
    times.push(performance.now() - t0);
  }
  return times;
}

// ─── Hlavní ───────────────────────────────────────────────────────────────────

console.log(`\n8080 Benchmark — ${TICKS.toLocaleString()} ticků × ${RUNS} opakování`);
console.log("=".repeat(60));
console.log("(Program: mem-copy loop — MOV/STAX/INX/DCR/JNZ, ~39 T/inner iteraci)\n");

console.log("── JS (src/8080.js) ──────────────────────────────────────");
const jsT = benchJS();
printResult("JavaScript", jsT);

console.log("\n── WASM step() z JS smyčky ───────────────────────────────");
const wasmT = await benchWASM();
printResult("WASM (step z JS)", wasmT);

console.log("\n── WASM runTicks() — smyčka uvnitř WASM ─────────────────");
const wasmTightT = await benchWASMTight();
printResult("WASM (tight loop)", wasmTightT);

const jsAvg       = jsT.reduce((a, b) => a + b, 0)       / jsT.length;
const wasmAvg     = wasmT.reduce((a, b) => a + b, 0)     / wasmT.length;
const wasmTightAvg= wasmTightT.reduce((a, b) => a + b, 0)/ wasmTightT.length;
const ratio   = jsAvg / wasmAvg;

const ratioTight  = jsAvg / wasmTightAvg;

console.log("\n── Srovnání (průměry) ────────────────────────────────────");
const cmp = (label, r) => r >= 1
  ? `  ${label}: JS ${r.toFixed(2)}× rychlejší`
  : `  ${label}: WASM ${(1/r).toFixed(2)}× rychlejší`;
console.log(cmp("WASM step/JS loop vs JS  ", ratio));
console.log(cmp("WASM tight loop   vs JS  ", ratioTight));
console.log();
