/**
 * Intel 8080 WASM emulator — Web Worker entry point.
 *
 * Message protocol (main thread → Worker):
 *   { type: 'init', wasmUrl, intercepts?, romRegions?, cpuFreq? }
 *   { type: 'frame', tStates }
 *   { type: 'step' }
 *   { type: 'run' }
 *   { type: 'stop' }
 *   { type: 'reset' }
 *   { type: 'breakpoint', addr }
 *   { type: 'clearBreakpoints' }
 *   { type: 'setReg', id, value }
 *   { type: 'memWrite', addr, value }
 *   { type: 'interrupt', vector }
 *
 * Message protocol (Worker → main thread):
 *   { type: 'ready', memoryBuffer }          — after init, transfers shared memory ref
 *   { type: 'frameDone', audioBuffer }       — after each frame (transfer)
 *   { type: 'status', regs }                 — after step/stop/run
 *   { type: 'break', pc }                    — breakpoint hit
 *   { type: 'halt', pc }                     — HLT instruction executed
 *   { type: 'error', message }               — init or runtime error
 */

// Default CPU frequency (Hz) — overridden by init message
const DEFAULT_CPU_FREQ = 2_000_000;
const AUDIO_RATE       = 44_100;
const OFFSET_REGS      = 0x10010;  // matches memory.ts OFFSET_REGS

let wasm         = null;   // WebAssembly instance
let wasmMemory   = null;   // WebAssembly.Memory
let memView      = null;   // Uint8Array over full WASM memory
let cpuFreq      = DEFAULT_CPU_FREQ;
let totalT       = 0;
let running      = false;
let breakpoints  = new Set();

// MMIO dispatch table — populated by consumer via 'init' intercepts config
// Each entry: { start, end, read(addr), write(addr, val) }
const mmioRegions = [];

// Speaker bit — updated by portOut handler, polled per T-state
let speakerBit = 0;

// ─── Reg ID constants (must match cpu.ts cpuSetReg IDs) ───────────────────────
const REG_ID = {
  PC: 0, SP: 1, A: 2, B: 3, C: 4, D: 5, E: 6, H: 7, L: 8, F: 9,
};

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
    js_portIn: (port) => {
      for (const r of mmioRegions) {
        if (r.portRead) return r.portRead(port);
      }
      return 0xFF;
    },
    js_portOut: (port, val) => {
      for (const r of mmioRegions) {
        if (r.portWrite) { r.portWrite(port, val); }
      }
      // Speaker bit is tracked externally — consumer must call wasm.exports.setSpeakerBit()
      // or update speakerBit via portWrite callback
    },
  },
});

// ─── Helper: read register snapshot from WASM memory ─────────────────────────

const readRegs = () => {
  // Layout written by cpuStatus() in cpu.ts:
  // PC(2) SP(2) A B C D E F H L cycles(8) at OFFSET_REGS
  const base = OFFSET_REGS;
  const view16 = new Uint16Array(wasmMemory.buffer);
  const view8  = new Uint8Array(wasmMemory.buffer);
  const view64 = new BigInt64Array(wasmMemory.buffer);

  const b16 = base >> 1;
  const b64 = (base + 12) >> 3;

  return {
    pc:     view16[b16],
    sp:     view16[b16 + 1],
    a:      view8[base + 4],
    b:      view8[base + 5],
    c:      view8[base + 6],
    d:      view8[base + 7],
    e:      view8[base + 8],
    f:      view8[base + 9],
    h:      view8[base + 10],
    l:      view8[base + 11],
    cycles: Number(view64[b64]),
  };
};

// ─── Message handler ──────────────────────────────────────────────────────────

onmessage = async ({ data }) => {
  switch (data.type) {

    case "init": {
      try {
        cpuFreq = data.cpuFreq || DEFAULT_CPU_FREQ;

        // Allocate 2 WASM pages (128 KB) — page 0: CPU memory, page 1: metadata
        wasmMemory = new WebAssembly.Memory({ initial: 2, maximum: 2 });
        memView    = new Uint8Array(wasmMemory.buffer);

        // Fetch and instantiate WASM module
        const response = await fetch(data.wasmUrl);
        const bytes    = await response.arrayBuffer();
        const result   = await WebAssembly.instantiate(bytes, {
          ...makeImports(),
          env: { ...makeImports().env, memory: wasmMemory },
        });
        wasm = result.instance;

        // Reset CPU
        wasm.exports.reset();
        totalT = 0;

        // Configure intercept table from init message
        if (data.intercepts) {
          let idx = 0;
          for (const ic of data.intercepts) {
            const typeId = ic.type === "rom" ? 1 : 2;
            wasm.exports.configureIntercept(idx++, ic.start, ic.end, typeId);
          }
          wasm.exports.setInterceptCount(data.intercepts.length);
        }

        // Copy ROM/initial memory regions
        if (data.romRegions) {
          for (const region of data.romRegions) {
            const src  = new Uint8Array(region.data);
            const dest = new Uint8Array(wasmMemory.buffer, region.offset, src.length);
            dest.set(src);
          }
        }

        // Send ready — share memory buffer reference (not transfer, it's shared)
        postMessage({ type: "ready", memoryBuffer: wasmMemory.buffer });
      } catch (e) {
        postMessage({ type: "error", message: e.message });
      }
      break;
    }

    case "frame": {
      if (!wasm) { postMessage({ type: "error", message: "Not initialized" }); break; }

      const targetT       = totalT + (data.tStates | 0);
      const samplesCount  = Math.ceil(AUDIO_RATE / 60);
      const audioSamples  = new Float32Array(samplesCount);
      const tPerSample    = cpuFreq / AUDIO_RATE;
      const frameStartT   = totalT;
      let sampleIdx       = 0;

      while (totalT < targetT) {
        totalT += wasm.exports.step();

        // Poll speaker bit (consumer updates via setSpeakerBit export)
        speakerBit = wasm.exports.getSpeakerBit();

        // Downsample: map T-states → audio samples
        const expected = Math.floor((totalT - frameStartT) / tPerSample);
        while (sampleIdx < expected && sampleIdx < samplesCount) {
          audioSamples[sampleIdx++] = speakerBit ? 0.5 : -0.5;
        }

        // Breakpoint check during frame
        if (breakpoints.has(wasm.exports.getPC())) {
          wasm.exports.status();
          const regs = readRegs();
          postMessage({ type: "break", pc: regs.pc });
          postMessage({ type: "frameDone", audioBuffer: audioSamples.buffer },
                      [audioSamples.buffer]);
          return;
        }
      }

      postMessage(
        { type: "frameDone", audioBuffer: audioSamples.buffer },
        [audioSamples.buffer],
      );
      break;
    }

    case "step": {
      if (!wasm) break;
      wasm.exports.step();
      wasm.exports.status();
      postMessage({ type: "status", regs: readRegs() });
      break;
    }

    case "run": {
      if (!wasm) break;
      running = true;
      // Run until breakpoint, HLT, or 'stop' message (checked via running flag)
      // Note: in a real Worker this would use a chunked loop with setTimeout(0)
      // to allow 'stop' messages through. For POC: synchronous chunk loop.
      const CHUNK = 10_000;
      const loop = () => {
        if (!running) return;
        for (let i = 0; i < CHUNK; i++) {
          wasm.exports.step();
          const pc = wasm.exports.getPC();
          if (breakpoints.has(pc)) {
            running = false;
            wasm.exports.status();
            postMessage({ type: "break", pc });
            return;
          }
          if (wasm.exports.isHalted()) {
            running = false;
            wasm.exports.status();
            postMessage({ type: "halt", pc });
            return;
          }
        }
        // Yield to allow incoming messages
        setTimeout(loop, 0);
      };
      loop();
      break;
    }

    case "stop": {
      running = false;
      if (wasm) {
        wasm.exports.status();
        postMessage({ type: "status", regs: readRegs() });
      }
      break;
    }

    case "reset": {
      if (wasm) { wasm.exports.reset(); totalT = 0; }
      break;
    }

    case "breakpoint": {
      breakpoints.add(data.addr);
      break;
    }

    case "clearBreakpoints": {
      breakpoints.clear();
      break;
    }

    case "setReg": {
      if (wasm) wasm.exports.setReg(data.id, data.value);
      break;
    }

    case "memWrite": {
      if (wasm) wasm.exports.memSet(data.addr, data.value);
      break;
    }

    case "interrupt": {
      if (wasm) wasm.exports.interrupt(data.vector || 0x38);
      break;
    }
  }
};
