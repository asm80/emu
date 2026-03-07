/**
 * Benchmark Web Worker — měří WASM výkon přímo uvnitř workeru.
 *
 * Přijímá zprávu:
 *   { variant: "step"|"runTicks", program: ArrayBuffer, programBase: number,
 *     ticks: number, runs: number }
 *
 * Odpovídá:
 *   { type: "done", times: number[] }   — naměřené časy v ms (runs položek)
 *   { type: "error", message: string }
 *
 * Čas se měří uvnitř workeru pomocí performance.now() — vyhýbáme se latenci
 * postMessage, která by zkreslila výsledek.
 */

import { createPeripheralBus } from "./peripheral-bus.js";

const WASM_URL = new URL("../out/8080.wasm", import.meta.url).href;

// Načteme WASM jednou — sdílíme instanci mezi runy
let wasmInstance = null;

async function getWasm() {
  if (wasmInstance) return wasmInstance;
  const bus = createPeripheralBus();
  const imports = {
    env: {
      js_mmioRead:  () => 0xFF,
      js_mmioWrite: () => {},
      js_portIn:    (port) => bus.portIn(port),
      js_portOut:   (port, val) => bus.portOut(port, val),
      abort: () => { throw new Error("WASM abort"); },
    },
  };
  const res    = await fetch(WASM_URL);
  const bytes  = await res.arrayBuffer();
  const result = await WebAssembly.instantiate(bytes, imports);
  wasmInstance = result.instance;
  return wasmInstance;
}

onmessage = async ({ data }) => {
  const { variant, program, programBase, ticks, runs } = data;
  const prog = new Uint8Array(program);

  try {
    const wasm = await getWasm();
    const exp  = wasm.exports;
    // CPU paměť leží na offsetu 0x10000 v WASM linear memory
    const mem  = new Uint8Array(exp.memory.buffer, 0x10000, 65536);

    const times = [];

    for (let run = 0; run < runs; run++) {
      // Reset paměti a CPU před každým runem
      mem.fill(0);
      mem.set(prog, programBase);
      exp.reset();

      const t0 = performance.now();

      if (variant === "step") {
        // Varianta A: JS smyčka, WASM step() per instrukce
        let total = 0;
        while (total < ticks) total += exp.step();
      } else {
        // Varianta B: WASM tight loop — jediné volání přes hranici
        exp.runTicks(ticks);
      }

      times.push(performance.now() - t0);
    }

    postMessage({ type: "done", times });
  } catch (e) {
    const msg = (e instanceof Error) ? e.message : String(e);
    postMessage({ type: "error", message: msg || "neznámá chyba" });
  }
};
