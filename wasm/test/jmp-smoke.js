/**
 * Smoke test: JMP 0x3412
 * Spustí worker, nahraje JMP instrukci a ověří, že PC = 0x3412.
 */

import { Worker }    from "worker_threads";
import { resolve, dirname } from "path";
import { fileURLToPath }    from "url";

const __dirname  = dirname(fileURLToPath(import.meta.url));
const WORKER     = resolve(__dirname, "../js/node-emu-worker.js");
const WASM       = resolve(__dirname, "../out/8080.wasm");

const w = new Worker(WORKER);

const msg = (type) => new Promise((ok, fail) => {
  const h = (m) => {
    if (m.type === type)          { w.off("message", h); ok(m); }
    else if (m.type === "error")  { w.off("message", h); fail(new Error(m.message)); }
  };
  w.on("message", h);
});

// init
w.postMessage({ type: "init", wasmPath: WASM });
await msg("ready");

// nahrát JMP 0x3412 na adresu 0x0000 — jeden blokový zápis
const program = new Uint8Array([0xC3, 0x12, 0x34]);
w.postMessage({ type: "memWriteBlock", addr: 0x0000, data: program.buffer }, [program.buffer]);

// jeden krok
w.postMessage({ type: "step" });
const { regs } = await msg("status");

const ok = regs.pc === 0x3412;
console.log(`PC = 0x${regs.pc.toString(16).toUpperCase().padStart(4,"0")}  →  ${ok ? "OK" : "FAIL (očekáváno 0x3412)"}`);

w.terminate();
process.exit(ok ? 0 : 1);
