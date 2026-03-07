/**
 * Integrační testy: ACIA 6850 + Worker (Node.js)
 *
 * Testuje, že worker správně:
 *   1. Konfiguruje ACIA 6850 z `init.peripherals`
 *   2. Emituje `peripheral.out` při TX byte (CPU → terminál)
 *   3. Přijímá `peripheral.in` a doručuje byte do RX bufferu (terminál → CPU)
 *
 * Spustit:
 *   node test/serial.integration.test.js
 */

import { Worker }      from "worker_threads";
import { resolve, dirname } from "path";
import { fileURLToPath }    from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKER_PATH = resolve(__dirname, "../js/node-emu-worker.js");
const WASM_PATH   = resolve(__dirname, "../out/8080.wasm");

// ─── Pomocné funkce ───────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function ok(label, cond) {
  if (cond) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

/**
 * Spustí worker, odešle zprávy, vrátí Promise s přijatými zprávami.
 * @param {object[]} messages      - zprávy k odeslání (v pořadí)
 * @param {object}   collectFilter - { type: string, count: number } — kolik zpráv daného typu sbírat
 * @param {number}   timeout       - ms
 */
function runWorker(messages, collectFilter, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const w = new Worker(WORKER_PATH);
    const collected = [];
    const timer = setTimeout(() => {
      w.terminate();
      reject(new Error(`Timeout po ${timeout} ms (sesbíráno ${collected.length}/${collectFilter.count} zpráv '${collectFilter.type}')`));
    }, timeout);

    w.on("message", (msg) => {
      if (msg.type === collectFilter.type) {
        collected.push(msg);
        if (collected.length >= collectFilter.count) {
          clearTimeout(timer);
          w.terminate();
          resolve(collected);
        }
      }
      if (msg.type === "error") {
        clearTimeout(timer);
        w.terminate();
        reject(new Error("Worker error: " + msg.message));
      }
      // Po ready — odeslat zbývající zprávy
      if (msg.type === "ready") {
        for (let i = 1; i < messages.length; i++) {
          w.postMessage(messages[i]);
        }
      }
    });

    w.on("error", (e) => { clearTimeout(timer); reject(e); });

    // Odeslat init jako první
    w.postMessage(messages[0]);
  });
}

// ─── Test 1: TX — CPU pošle 'A' přes ACIA 6850 ───────────────────────────────
//
// Program: inicializuje ACIA, čeká na TDRE, pošle 0x41 ('A'), pak HLT
//
// ACIA 6850 na portech 0x80 (control/status) a 0x81 (data):
//
//   0000: 3E 03     MVI A,0x03      ; master reset (CR[1:0] = 11)
//   0002: D3 80     OUT 0x80
//   0004: 3E 11     MVI A,0x11      ; 8-bit, /64 clock
//   0006: D3 80     OUT 0x80
//   0008: DB 80     IN  0x80        ; čti status
//   000A: E6 02     ANI 0x02        ; test TDRE (bit 1)
//   000C: CA 08 00  JZ  0x0008      ; čekej dokud TDRE=0
//   000F: 3E 41     MVI A,0x41      ; 'A'
//   0011: D3 81     OUT 0x81        ; TX
//   0013: 76        HLT

async function testTx() {
  console.log("\n── Test 1: CPU TX byte přes ACIA 6850 ───────────────────────");

  const program = Uint8Array.from([
    0x3E, 0x03,        // MVI A,0x03
    0xD3, 0x80,        // OUT 0x80  (control — master reset)
    0x3E, 0x11,        // MVI A,0x11
    0xD3, 0x80,        // OUT 0x80  (control — 8-bit)
    0xDB, 0x80,        // IN  0x80  (status)
    0xE6, 0x02,        // ANI 0x02  (TDRE)
    0xCA, 0x08, 0x00,  // JZ  0x0008
    0x3E, 0x41,        // MVI A,0x41  ('A')
    0xD3, 0x81,        // OUT 0x81  (data)
    0x76,              // HLT
  ]);

  const msgs = await runWorker(
    [
      {
        type: "init",
        wasmPath: WASM_PATH,
        peripherals: [{ type: "acia6850", id: "serial", basePort: 0x80 }],
      },
      { type: "memWriteBlock", addr: 0x0000, data: program.buffer },
      { type: "frame", tStates: 200 },  // dostatek T-stavů pro program
    ],
    { type: "peripheral.out", count: 1 },
  );

  ok("přijata zpráva peripheral.out", msgs.length === 1);
  ok("id = 'serial'", msgs[0].id === "serial");
  ok("data.charCode = 0x41 ('A')", msgs[0].data?.charCode === 0x41);
}

// ─── Test 2: RX — terminál pošle 'B', CPU přečte přes ACIA 6850 ──────────────
//
// Program: čeká na RDRF (bit 0), přečte byte, zapíše ho zpět na TX, HLT
// (Echo: přijatý znak vrátí na TX → dostaneme peripheral.out)
//
//   0000: DB 80     IN  0x80        ; čti status
//   0002: E6 01     ANI 0x01        ; test RDRF (bit 0)
//   0004: CA 00 00  JZ  0x0000      ; čekej
//   0007: DB 81     IN  0x81        ; čti RX data
//   0009: D3 81     OUT 0x81        ; TX echo
//   000B: 76        HLT

async function testRx() {
  console.log("\n── Test 2: RX byte přes ACIA 6850 (echo) ────────────────────");

  const program = Uint8Array.from([
    0xDB, 0x80,        // IN  0x80  (status)
    0xE6, 0x01,        // ANI 0x01  (RDRF)
    0xCA, 0x00, 0x00,  // JZ  0x0000
    0xDB, 0x81,        // IN  0x81  (RX data)
    0xD3, 0x81,        // OUT 0x81  (TX echo)
    0x76,              // HLT
  ]);

  // Spustíme worker — po ready odešleme program + rxPush + frame
  const msgs = await runWorker(
    [
      {
        type: "init",
        wasmPath: WASM_PATH,
        peripherals: [{ type: "acia6850", id: "serial", basePort: 0x80 }],
      },
      { type: "memWriteBlock", addr: 0x0000, data: program.buffer },
      { type: "peripheral.in", id: "serial", data: { charCode: 0x42 } },  // 'B'
      { type: "frame", tStates: 300 },
    ],
    { type: "peripheral.out", count: 1 },
  );

  ok("přijata zpráva peripheral.out (echo)", msgs.length === 1);
  ok("id = 'serial'", msgs[0].id === "serial");
  ok("data.charCode = 0x42 ('B') — echo", msgs[0].data?.charCode === 0x42);
}

// ─── Test 3: Simple Serial TX ─────────────────────────────────────────────────
//
//   status port 0x82: bit0 = RX ready, bit1 = TX ready (vždy 1)
//   in     port 0x80
//   out    port 0x81
//
//   0000: DB 82     IN  0x82        ; čti status
//   0002: E6 02     ANI 0x02        ; test TX ready (bit 1)
//   0004: CA 00 00  JZ  0x0000
//   0007: 3E 43     MVI A,0x43      ; 'C'
//   0009: D3 81     OUT 0x81
//   000B: 76        HLT

async function testSimpleSerial() {
  console.log("\n── Test 3: Simple Serial TX ──────────────────────────────────");

  const program = Uint8Array.from([
    0xDB, 0x82,        // IN  0x82  (status)
    0xE6, 0x02,        // ANI 0x02  (TX ready)
    0xCA, 0x00, 0x00,  // JZ  0x0000
    0x3E, 0x43,        // MVI A,0x43  ('C')
    0xD3, 0x81,        // OUT 0x81  (TX)
    0x76,              // HLT
  ]);

  const msgs = await runWorker(
    [
      {
        type: "init",
        wasmPath: WASM_PATH,
        peripherals: [{
          type: "simple-serial",
          id: "serial",
          inPort: 0x80,
          outPort: 0x81,
          statusPort: 0x82,
          availableMask: 0x01,
          readyMask: 0x02,
        }],
      },
      { type: "memWriteBlock", addr: 0x0000, data: program.buffer },
      { type: "frame", tStates: 200 },
    ],
    { type: "peripheral.out", count: 1 },
  );

  ok("přijata zpráva peripheral.out", msgs.length === 1);
  ok("id = 'serial'", msgs[0].id === "serial");
  ok("data.charCode = 0x43 ('C')", msgs[0].data?.charCode === 0x43);
}

// ─── Hlavní ───────────────────────────────────────────────────────────────────

console.log("\nIntegrační testy: Peripheral Bus + WASM Worker");
console.log("=".repeat(55));

try {
  await testTx();
  await testRx();
  await testSimpleSerial();
} catch (e) {
  console.error("\nChyba:", e.message);
  failed++;
}

console.log(`\n${"─".repeat(55)}`);
console.log(`Výsledek: ${passed} OK, ${failed} SELHALO`);
if (failed > 0) process.exit(1);
