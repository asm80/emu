/**
 * Integrační test Node.js workeru pro Intel 8080 WASM emulátor.
 *
 * Testuje celý round-trip: hlavní vlákno → worker → odpověď.
 *
 * Spustit: npm run test:worker
 */

import QUnit          from "qunit";
import { Worker }     from "worker_threads";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname  = dirname(fileURLToPath(import.meta.url));
const WORKER_PATH = resolve(__dirname, "../js/node-emu-worker.js");
const WASM_PATH   = resolve(__dirname, "../out/8080.wasm");

// ─── Helper: vytvoří worker a čeká na první zprávu daného typu ───────────────

function createWorker() {
  const w = new Worker(WORKER_PATH);
  // Sbíráme chyby, aby nezrušily celý test process
  w.on("error", (err) => console.error("Worker error:", err));
  return w;
}

/**
 * Pošle zprávu workeru a vrátí Promise, který se splní při první odpovědi
 * s `msg.type === expectedType`.
 */
function send(worker, msg, expectedType) {
  return new Promise((resolve, reject) => {
    const onMsg = (reply) => {
      if (reply.type === expectedType) {
        worker.off("message", onMsg);
        resolve(reply);
      } else if (reply.type === "error") {
        worker.off("message", onMsg);
        reject(new Error("Worker error: " + reply.message));
      }
    };
    worker.on("message", onMsg);
    worker.postMessage(msg);
  });
}

/** Inicializuje worker s WASM a vrátí ho po přijetí 'ready'. */
async function initWorker(opts = {}) {
  const w = createWorker();
  await send(w, { type: "init", wasmPath: WASM_PATH, ...opts }, "ready");
  return w;
}

// ─── Testy ────────────────────────────────────────────────────────────────────

QUnit.module("Worker integrace — init & step", () => {

  QUnit.test("init: worker pošle 'ready' po načtení WASM", async (assert) => {
    const w = createWorker();
    const reply = await send(w, { type: "init", wasmPath: WASM_PATH }, "ready");
    assert.equal(reply.type, "ready", "Odpověď je 'ready'");
    w.terminate();
  });

  QUnit.test("step: NOP vrátí PC=1, cycles=4", async (assert) => {
    const w = await initWorker();

    // Nahraje NOP (0x00) na adresu 0x0000 přes memWrite
    w.postMessage({ type: "memWrite", addr: 0x0000, value: 0x00 });

    const reply = await send(w, { type: "step" }, "status");
    assert.equal(reply.regs.pc, 1, "PC = 1 po NOP");
    assert.equal(reply.regs.cycles, 4, "Spotřebovány 4 T-stavy");
    w.terminate();
  });

  QUnit.test("step: MVI A,0x42 nahraje hodnotu do A", async (assert) => {
    const w = await initWorker();

    // MVI A,0x42 = 0x3E 0x42
    w.postMessage({ type: "memWrite", addr: 0, value: 0x3E });
    w.postMessage({ type: "memWrite", addr: 1, value: 0x42 });

    const reply = await send(w, { type: "step" }, "status");
    assert.equal(reply.regs.a, 0x42, "A = 0x42 po MVI A,0x42");
    assert.equal(reply.regs.cycles, 7,  "Spotřebováno 7 T-stavů");
    w.terminate();
  });

  QUnit.test("reset: PC se vrátí na 0", async (assert) => {
    const w = await initWorker();

    // Krokneme jednou
    w.postMessage({ type: "memWrite", addr: 0, value: 0x00 }); // NOP
    await send(w, { type: "step" }, "status");

    // Reset a step
    w.postMessage({ type: "reset" });
    w.postMessage({ type: "memWrite", addr: 0, value: 0x00 });
    const reply = await send(w, { type: "step" }, "status");

    assert.equal(reply.regs.pc, 1, "PC = 1 po reset + step");
    w.terminate();
  });

});

QUnit.module("Worker integrace — frame loop", () => {

  QUnit.test("frame: vrátí 'frameDone' s audio bufferem", async (assert) => {
    const w = await initWorker({ cpuFreq: 2_000_000 });

    // 33 333 T-stavů odpovídá jednomu animation framu při 60 fps a 2 MHz
    const tStates = Math.round(2_000_000 / 60);
    const reply   = await send(w, { type: "frame", tStates }, "frameDone");

    assert.ok(reply.audioBuffer instanceof ArrayBuffer, "audioBuffer je ArrayBuffer");
    const samples = new Float32Array(reply.audioBuffer);
    assert.equal(samples.length, Math.ceil(44_100 / 60), `~735 audio vzorků (got ${samples.length})`);
    w.terminate();
  });

  QUnit.test("frame: audio vzorky mají hodnotu ±0.5", async (assert) => {
    const w = await initWorker({ cpuFreq: 2_000_000 });

    const tStates = Math.round(2_000_000 / 60);
    const reply   = await send(w, { type: "frame", tStates }, "frameDone");

    const samples = new Float32Array(reply.audioBuffer);
    const valid   = [...samples].every((s) => s === 0.5 || s === -0.5);
    assert.ok(valid, "Každý vzorek je přesně +0.5 nebo -0.5");
    w.terminate();
  });

  QUnit.test("frame: breakpoint zastaví smyčku a pošle 'break' před 'frameDone'", async (assert) => {
    const w = await initWorker();

    // NOP smyčka: 0x00 (NOP) na adrese 0, 1, 2, ...
    for (let i = 0; i < 10; i++) w.postMessage({ type: "memWrite", addr: i, value: 0x00 });

    // Breakpoint na PC=5 (po 5 NOPech)
    w.postMessage({ type: "breakpoint", addr: 5 });

    // Čekáme na 'break' zprávu
    const breakReply = await send(w, { type: "frame", tStates: 10_000 }, "break");
    assert.equal(breakReply.pc, 5, "Break na PC=5");
    w.terminate();
  });

});

QUnit.module("Worker integrace — ROM intercept", () => {

  QUnit.test("ROM oblast ignoruje zápis přes CPU instrukci", async (assert) => {
    // ROM na 0x0000–0x00FF obsahuje:
    //   0x0000: MVI A,0xAA   (3E AA)  — nahraje hodnotu do A
    //   0x0002: MOV M,A      (77)     — pokus zapsat A → [HL=0x0000], musí být ignorován (ROM)
    //   0x0003: JMP 0x0003   (C3 03 00) — zůstan
    const rom = new Uint8Array([
      0x3E, 0xAA,       // MVI A, 0xAA
      0x77,             // MOV M, A  — zápis do [HL=0x0000], ale HL je 0 (init)
      0xC3, 0x03, 0x00, // JMP 0x0003
    ]);
    const w = await initWorker({
      intercepts: [{ start: 0x0000, end: 0x0100, type: "rom" }],
      romRegions:  [{ offset: 0x0000, data: rom.buffer }],
    });

    // Krok 1: MVI A,0xAA — PC přejde na 2
    const s1 = await send(w, { type: "step" }, "status");
    assert.equal(s1.regs.a,  0xAA, "A = 0xAA po MVI");
    assert.equal(s1.regs.pc, 2,    "PC = 2 po MVI");

    // Krok 2: MOV M,A — pokus zapsat do ROM adresy 0x0000 (HL=0x0000)
    // ROM intercept to musí tiše ignorovat; PC přejde na 3
    const s2 = await send(w, { type: "step" }, "status");
    assert.equal(s2.regs.pc, 3, "PC = 3 po MOV M,A");

    // Krok 3: JMP 0x0003 — PC skočí na 3 (nekonečná smyčka), rom[0] musí být stále 0x3E
    const s3 = await send(w, { type: "step" }, "status");
    assert.equal(s3.regs.pc, 3, "JMP se opakuje na PC=3");

    w.terminate();
  });

});
