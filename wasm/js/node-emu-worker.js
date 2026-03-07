/**
 * Intel 8080 WASM emulator — Node.js worker_threads entry point.
 *
 * Funkčně identický s emu-worker.js, ale používá Node.js API místo
 * browser Web Worker API:
 *   - parentPort místo onmessage/postMessage
 *   - readFileSync místo fetch()
 *   - WASM memory je instance.exports.memory (importMemory: false)
 *
 * Protokol zpráv je shodný s emu-worker.js — viz docs/worker.md.
 */

import { workerData, parentPort } from "worker_threads";
import { readFileSync }           from "fs";

import { createPeripheralBus } from "./peripheral-bus.js";
import { createAcia6850 }      from "./acia6850.js";
import { createAcia6551 }      from "./acia6551.js";
import { createSimpleSerial }  from "./simple-serial.js";

// ─── Konstanty ────────────────────────────────────────────────────────────────

const DEFAULT_CPU_FREQ = 2_000_000;

// Musí odpovídat OFFSET_REGS v memory.ts (stránka 2, 0x20000)
const OFFSET_REGS      = 0x20000;

// ─── Adaptéry periferií ───────────────────────────────────────────────────────
//
// Každý adaptér ví, jak vytvořit periferii z konfigurace a jak do ní
// doručit vstupní data (peripheral.in). Přidání nové periferie = nový klíč.

const PERIPHERAL_ADAPTERS = {
  "acia6850": {
    create: (cfg, onOutput) =>
      createAcia6850({
        basePort: cfg.basePort,
        onTx: (ch) => onOutput({ charCode: ch }),
      }),
    input: (dev, data) => dev.rxPush(data.charCode),
  },
  "acia6551": {
    create: (cfg, onOutput) =>
      createAcia6551({
        basePort: cfg.basePort,
        onTx: (ch) => onOutput({ charCode: ch }),
      }),
    input: (dev, data) => dev.rxPush(data.charCode),
  },
  "simple-serial": {
    create: (cfg, onOutput) =>
      createSimpleSerial({
        inPort:        cfg.inPort,
        outPort:       cfg.outPort,
        statusPort:    cfg.statusPort,
        availableMask: cfg.availableMask ?? 0x01,
        readyMask:     cfg.readyMask     ?? 0x02,
        onTx: (ch) => onOutput({ charCode: ch }),
      }),
    input: (dev, data) => dev.rxPush(data.charCode),
  },
};

// ─── Stav workeru ─────────────────────────────────────────────────────────────

let wasm        = null;   // WebAssembly.Instance
let cpuFreq     = DEFAULT_CPU_FREQ;
let totalT      = 0;
let running     = false;
let breakpoints = new Set();

let bus                = createPeripheralBus();
const peripheralRegistry = new Map();   // id → { dev, adapter }

const mmioRegions = [];   // MMIO dispatch tabulka (memory-mapped I/O)

// ─── WASM imports ─────────────────────────────────────────────────────────────

const makeImports = () => ({
  env: {
    js_mmioRead: (addr) => {
      for (const r of mmioRegions) {
        if (addr >= r.start && addr < r.end && r.read) return r.read(addr);
      }
      return 0xFF;
    },
    js_mmioWrite: (addr, val) => {
      for (const r of mmioRegions) {
        if (addr >= r.start && addr < r.end && r.write) { r.write(addr, val); return; }
      }
    },
    js_portIn:  (port) => bus.portIn(port),
    js_portOut: (port, val) => bus.portOut(port, val),
    abort: (_msg, _file, _line, _col) => { throw new Error("WASM abort"); },
  },
});

// ─── Helper: čtení registrů ze WASM paměti ────────────────────────────────────

const readRegs = () => {
  const buf   = wasm.exports.memory.buffer;
  const b     = OFFSET_REGS;
  const v16   = new Uint16Array(buf);
  const v8    = new Uint8Array(buf);
  const v32   = new Int32Array(buf);
  return {
    pc:     v16[b >> 1],
    sp:     v16[(b >> 1) + 1],
    a:      v8[b + 4],
    b:      v8[b + 5],
    c:      v8[b + 6],
    d:      v8[b + 7],
    e:      v8[b + 8],
    f:      v8[b + 9],
    h:      v8[b + 10],
    l:      v8[b + 11],
    cycles: v32[(b + 12) >> 2],
  };
};

// ─── Handler zpráv z hlavního vlákna ──────────────────────────────────────────

parentPort.on("message", async (data) => {
  switch (data.type) {

    case "init": {
      try {
        cpuFreq = data.cpuFreq || DEFAULT_CPU_FREQ;

        // Node.js: načteme WASM ze souboru místo fetch()
        const bytes  = readFileSync(data.wasmPath);
        const result = await WebAssembly.instantiate(bytes, makeImports());
        wasm = result.instance;

        // Reset CPU a čítač T-stavů
        wasm.exports.reset();
        totalT = 0;

        // Konfigurace intercept tabulky (ROM / MMIO oblasti)
        if (data.intercepts) {
          let idx = 0;
          for (const ic of data.intercepts) {
            const typeId = ic.type === "rom" ? 1 : 2;
            wasm.exports.configureIntercept(idx++, ic.start, ic.end, typeId);
          }
          wasm.exports.setInterceptCount(data.intercepts.length);
        }

        // Nahrání počátečního obsahu paměti (ROM, bootloader apod.)
        if (data.romRegions) {
          for (const region of data.romRegions) {
            const src  = new Uint8Array(region.data);
            // CPU paměť začíná na CPU_BASE (0x10000) v WASM linear memory
            const dest = new Uint8Array(wasm.exports.memory.buffer, 0x10000 + region.offset, src.length);
            dest.set(src);
          }
        }

        // Registrace periferií
        bus.unregisterAll();
        peripheralRegistry.clear();

        for (const cfg of (data.peripherals ?? [])) {
          const adapter = PERIPHERAL_ADAPTERS[cfg.type];
          if (!adapter) continue;
          const id = cfg.id ?? `${cfg.type}-${cfg.basePort ?? cfg.statusPort}`;
          const onOutput = (outData) =>
            parentPort.postMessage({ type: "peripheral.out", id, data: outData });
          const dev = adapter.create(cfg, onOutput);
          bus.register(dev);
          peripheralRegistry.set(id, { dev, adapter });
        }

        parentPort.postMessage({ type: "ready" });
      } catch (e) {
        parentPort.postMessage({ type: "error", message: e.message });
      }
      break;
    }

    case "frame": {
      if (!wasm) { parentPort.postMessage({ type: "error", message: "Not initialized" }); break; }

      const targetT = totalT + (data.tStates | 0);

      while (totalT < targetT) {
        totalT += wasm.exports.step();

        // Breakpoint check
        if (breakpoints.has(wasm.exports.getPC())) {
          wasm.exports.status();
          parentPort.postMessage({ type: "break", pc: readRegs().pc });
          parentPort.postMessage({ type: "frameDone" });
          return;
        }
      }

      parentPort.postMessage({ type: "frameDone" });
      break;
    }

    case "step": {
      if (!wasm) break;
      wasm.exports.step();
      wasm.exports.status();
      parentPort.postMessage({ type: "status", regs: readRegs() });
      break;
    }

    case "reset": {
      if (wasm) { wasm.exports.reset(); totalT = 0; }
      bus.reset();
      break;
    }

    case "breakpoint":      { breakpoints.add(data.addr);  break; }
    case "clearBreakpoints":{ breakpoints.clear();          break; }

    case "setReg": {
      if (wasm) wasm.exports.setReg(data.id, data.value);
      break;
    }

    case "memWrite": {
      if (wasm) wasm.exports.memSet(data.addr, data.value);
      break;
    }

    case "memWriteBlock": {
      // Zkopíruje blok dat (ArrayBuffer) na CPU adresu data.addr jedním set()
      // Volitelně lze předat data.data jako Transferable (ArrayBuffer) — nulová kopie
      if (wasm) {
        const src  = new Uint8Array(data.data);
        const dest = new Uint8Array(wasm.exports.memory.buffer, 0x10000 + (data.addr & 0xFFFF), src.length);
        dest.set(src);
      }
      break;
    }

    case "raiseIrq": {
      if (wasm) wasm.exports.raiseIrq(data.vector ?? 0x38);
      break;
    }

    case "peripheral.in": {
      // Doručí data do periferie identifikované id-em
      const entry = peripheralRegistry.get(data.id);
      if (entry) entry.adapter.input(entry.dev, data.data);
      break;
    }
  }
});
