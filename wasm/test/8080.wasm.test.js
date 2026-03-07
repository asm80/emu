/**
 * Intel 8080 WASM emulator tests.
 *
 * Adapts the original test/8080.test.js to run against the WASM port.
 * The createTestCPU() wrapper presents an identical interface to the JS version,
 * so test bodies can be copied 1:1.
 *
 * Run: npm test  (requires out/8080.wasm to be built first)
 */

import QUnit from "qunit";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WASM_PATH = resolve(__dirname, "../out/8080.wasm");

// ─── WASM instantiation ───────────────────────────────────────────────────────

let wasmModule = null;

const loadWasm = async () => {
  if (wasmModule) return wasmModule;
  const bytes = readFileSync(WASM_PATH);
  wasmModule  = await WebAssembly.compile(bytes);
  return wasmModule;
};

/**
 * Create a fresh WASM CPU instance with isolated 64 KB memory.
 * Returns { cpu, mem, ports } — same shape as JS createTestCPU().
 */
const createTestCPU = async () => {
  const mod = await loadWasm();

  const ports = new Uint8Array(256);

  const instance = await WebAssembly.instantiate(mod, {
    env: {
      js_mmioRead:  (_addr) => 0xFF,
      js_mmioWrite: (_addr, _val) => {},
      js_portIn:    (port) => ports[port & 0xFF] || 0,
      js_portOut:   (port, val) => { ports[port & 0xFF] = val & 0xFF; },
      // Required by AssemblyScript runtime (called on assertion failure in debug builds)
      abort: (_msg, _file, _line, _col) => { throw new Error("WASM abort"); },
    },
  });

  const exp = instance.exports;
  // WASM uses its own internal memory (importMemory: false in asconfig.json)
  // Use instance.exports.memory — NOT an externally created WebAssembly.Memory
  const wasmBuf = exp.memory.buffer;

  // Register ID mapping (matches cpu.ts cpuSetReg)
  const REG_IDS = { PC: 0, SP: 1, A: 2, B: 3, C: 4, D: 5, E: 6, H: 7, L: 8, F: 9 };

  // Memory layout:
  //   0x00000–0x0FFFF  page 0: AS data section (flagTable, daaTable, etc.)
  //   0x10000–0x1FFFF  page 1: CPU 64 KB address space
  //   0x20000+         page 2: register snapshot, keyboard SAB
  const OFFSET_REGS = 0x20000;
  const metaView8   = new Uint8Array(wasmBuf);
  const metaView16  = new Uint16Array(wasmBuf);
  const metaView32  = new Int32Array(wasmBuf);
  // CPU address space view: page 1 (0x10000–0x1FFFF)
  const mem         = new Uint8Array(wasmBuf, 0x10000, 65536);

  const readStatus = () => {
    const b = OFFSET_REGS;
    return {
      pc:     metaView16[b >> 1],
      sp:     metaView16[(b >> 1) + 1],
      a:      metaView8[b + 4],
      b:      metaView8[b + 5],
      c:      metaView8[b + 6],
      d:      metaView8[b + 7],
      e:      metaView8[b + 8],
      f:      metaView8[b + 9],
      h:      metaView8[b + 10],
      l:      metaView8[b + 11],
      cycles: metaView32[(b + 12) >> 2],
    };
  };

  // Reset and clear memory for isolation between tests
  exp.reset();
  mem.fill(0);   // clears CPU address space (0x0000–0xFFFF)
  ports.fill(0);

  const cpu = {
    reset: () => { exp.reset(); mem.fill(0); ports.fill(0); },

    step: () => exp.step(),

    steps: (n) => {
      let t = n;
      while (t > 0) t -= exp.step();
    },

    status: () => { exp.status(); return readStatus(); },

    set: (reg, value) => {
      const id = REG_IDS[reg.toUpperCase()];
      if (id !== undefined) exp.setReg(id, value);
    },

    T: () => { exp.status(); return readStatus().cycles; },

    memr: (addr) => mem[addr & 0xFFFF],

    interrupt: (vector) => exp.interrupt(vector || 0x38),

    // flagsToString() — replicated from JS version
    flagsToString: () => {
      exp.status();
      const f = readStatus().f;
      const fx = "SZ0A0P1C";
      let s = "";
      for (let i = 0; i < 8; i++) {
        const bit = f & (0x80 >> i);
        s += bit ? fx[i] : fx[i].toLowerCase();
      }
      return s;
    },
  };

  return { cpu, mem, ports };
};

// ─── Tests — copied from test/8080.test.js with async createTestCPU() ─────────
// The test bodies below are identical to the original; only QUnit.test callbacks
// are async and createTestCPU() is awaited.

QUnit.module("8080 WASM CPU Emulator", () => {

  QUnit.module("Initialization and Reset", () => {
    QUnit.test("CPU initializes with correct default values", async (assert) => {
      const { cpu } = await createTestCPU();
      const state = cpu.status();
      assert.equal(state.pc, 0,  "PC starts at 0");
      assert.equal(state.sp, 0,  "SP starts at 0");
      assert.equal(state.a,  0,  "A register is 0");
      assert.equal(state.b,  0,  "B register is 0");
      assert.equal(state.c,  0,  "C register is 0");
      assert.equal(state.d,  0,  "D register is 0");
      assert.equal(state.e,  0,  "E register is 0");
      assert.equal(state.h,  0,  "H register is 0");
      assert.equal(state.l,  0,  "L register is 0");
      assert.equal(state.f,  2,  "Flags initialized to 0x02");
    });

    QUnit.test("Reset clears all registers", async (assert) => {
      const { cpu, mem } = await createTestCPU();
      // MVI A, 0x42
      mem[0] = 0x3E; mem[1] = 0x42;
      cpu.steps(7);
      cpu.reset();
      const state = cpu.status();
      assert.equal(state.pc, 0, "PC reset to 0");
      assert.equal(state.a,  0, "A register cleared");
      assert.equal(state.f,  2, "Flags reset to 0x02");
    });

    QUnit.test("step() returns T-states consumed", async (assert) => {
      const { cpu, mem } = await createTestCPU();
      mem[0] = 0x00; // NOP = 4 T-states
      const t = cpu.step();
      assert.equal(t, 4, "NOP consumes 4 T-states");
    });
  });

  QUnit.module("Register Manipulation", () => {
    QUnit.test("set() and status() round-trip", async (assert) => {
      const { cpu } = await createTestCPU();
      cpu.set("A", 0x42);
      cpu.set("B", 0x10);
      cpu.set("PC", 0x1234);
      const s = cpu.status();
      assert.equal(s.a,  0x42,   "A set correctly");
      assert.equal(s.b,  0x10,   "B set correctly");
      assert.equal(s.pc, 0x1234, "PC set correctly");
    });

    QUnit.test("T() returns cumulative cycles", async (assert) => {
      const { cpu, mem } = await createTestCPU();
      mem[0] = 0x00; mem[1] = 0x00; // NOP NOP
      cpu.steps(8);
      assert.equal(cpu.T(), 8, "Two NOPs = 8 cycles");
    });

    QUnit.test("memr() reads memory", async (assert) => {
      const { cpu, mem } = await createTestCPU();
      mem[0x1234] = 0xAB;
      assert.equal(cpu.memr(0x1234), 0xAB, "memr returns correct value");
    });
  });

  QUnit.module("Basic Instructions", () => {
    QUnit.test("NOP — 4 cycles, PC advances by 1", async (assert) => {
      const { cpu, mem } = await createTestCPU();
      mem[0] = 0x00;
      const t = cpu.step();
      assert.equal(t,             4, "NOP = 4 T-states");
      assert.equal(cpu.status().pc, 1, "PC = 1 after NOP");
    });

    QUnit.test("MVI A,n — loads immediate into A", async (assert) => {
      const { cpu, mem } = await createTestCPU();
      mem[0] = 0x3E; mem[1] = 0x42; // MVI A, 0x42
      cpu.steps(7);
      assert.equal(cpu.status().a, 0x42, "A = 0x42");
    });

    QUnit.test("MOV B,A — copies A to B", async (assert) => {
      const { cpu, mem } = await createTestCPU();
      mem[0] = 0x3E; mem[1] = 0x55; // MVI A,0x55
      mem[2] = 0x47;                  // MOV B,A
      cpu.steps(12);
      assert.equal(cpu.status().b, 0x55, "B = A = 0x55");
    });

    QUnit.test("HLT — sets halted, step returns 1", async (assert) => {
      const { cpu, mem } = await createTestCPU();
      mem[0] = 0x76; // HLT
      cpu.step();    // execute HLT
      const t = cpu.step(); // while halted
      assert.equal(t, 1, "Halted step returns 1 T-state");
    });
  });

  QUnit.module("Arithmetic", () => {
    QUnit.test("ADD B — adds B to A, sets flags", async (assert) => {
      const { cpu, mem } = await createTestCPU();
      mem[0] = 0x3E; mem[1] = 0x05; // MVI A,5
      mem[2] = 0x06; mem[3] = 0x03; // MVI B,3
      mem[4] = 0x80;                  // ADD B
      cpu.steps(18);
      const s = cpu.status();
      assert.equal(s.a, 8, "A = 5 + 3 = 8");
      assert.equal(s.f & 0x01, 0, "Carry clear");
    });

    QUnit.test("ADD B — carry flag set on overflow", async (assert) => {
      const { cpu, mem } = await createTestCPU();
      mem[0] = 0x3E; mem[1] = 0xFF; // MVI A,0xFF
      mem[2] = 0x06; mem[3] = 0x01; // MVI B,1
      mem[4] = 0x80;                  // ADD B
      cpu.steps(18);
      const s = cpu.status();
      assert.equal(s.a, 0, "A wraps to 0");
      assert.equal(s.f & 0x01, 1, "Carry set");
    });

    QUnit.test("SUB B — subtracts B from A", async (assert) => {
      const { cpu, mem } = await createTestCPU();
      mem[0] = 0x3E; mem[1] = 0x0A; // MVI A,10
      mem[2] = 0x06; mem[3] = 0x03; // MVI B,3
      mem[4] = 0x90;                  // SUB B
      cpu.steps(18);
      assert.equal(cpu.status().a, 7, "A = 10 - 3 = 7");
    });

    QUnit.test("DAD B — 16-bit add HL += BC", async (assert) => {
      const { cpu, mem } = await createTestCPU();
      mem[0] = 0x21; mem[1] = 0x00; mem[2] = 0x10; // LXI H,0x1000
      mem[3] = 0x01; mem[4] = 0x00; mem[5] = 0x20; // LXI B,0x2000
      mem[6] = 0x09;                                  // DAD B
      cpu.steps(41);
      const s = cpu.status();
      assert.equal((s.h << 8) | s.l, 0x3000, "HL = 0x1000 + 0x2000 = 0x3000");
    });
  });

  QUnit.module("Logical Operations", () => {
    QUnit.test("ANA B — AND", async (assert) => {
      const { cpu, mem } = await createTestCPU();
      mem[0] = 0x3E; mem[1] = 0xF0; // MVI A,0xF0
      mem[2] = 0x06; mem[3] = 0x0F; // MVI B,0x0F
      mem[4] = 0xA0;                  // ANA B
      cpu.steps(18);
      assert.equal(cpu.status().a, 0, "0xF0 AND 0x0F = 0x00");
    });

    QUnit.test("ORA B — OR", async (assert) => {
      const { cpu, mem } = await createTestCPU();
      mem[0] = 0x3E; mem[1] = 0xF0; // MVI A,0xF0
      mem[2] = 0x06; mem[3] = 0x0F; // MVI B,0x0F
      mem[4] = 0xB0;                  // ORA B
      cpu.steps(18);
      assert.equal(cpu.status().a, 0xFF, "0xF0 OR 0x0F = 0xFF");
    });

    QUnit.test("XRA B — XOR", async (assert) => {
      const { cpu, mem } = await createTestCPU();
      mem[0] = 0x3E; mem[1] = 0xFF; // MVI A,0xFF
      mem[2] = 0x06; mem[3] = 0xFF; // MVI B,0xFF
      mem[4] = 0xA8;                  // XRA B
      cpu.steps(18);
      assert.equal(cpu.status().a, 0, "0xFF XOR 0xFF = 0");
    });
  });

  QUnit.module("Stack Operations", () => {
    QUnit.test("PUSH/POP BC round-trip", async (assert) => {
      const { cpu, mem } = await createTestCPU();
      cpu.set("SP", 0xF000);
      mem[0] = 0x01; mem[1] = 0x34; mem[2] = 0x12; // LXI B,0x1234
      mem[3] = 0xC5;                                  // PUSH B
      mem[4] = 0x01; mem[5] = 0x00; mem[6] = 0x00; // LXI B,0
      mem[7] = 0xC1;                                  // POP B
      cpu.steps(52);
      const s = cpu.status();
      assert.equal((s.b << 8) | s.c, 0x1234, "BC restored after PUSH/POP");
    });
  });

  QUnit.module("Jump Instructions", () => {
    QUnit.test("JMP — unconditional jump", async (assert) => {
      const { cpu, mem } = await createTestCPU();
      mem[0] = 0xC3; mem[1] = 0x10; mem[2] = 0x00; // JMP 0x0010
      cpu.step();
      assert.equal(cpu.status().pc, 0x10, "PC = 0x0010 after JMP");
    });

    QUnit.test("JZ — jump if zero flag set", async (assert) => {
      const { cpu, mem } = await createTestCPU();
      cpu.set("F", 0x42);                             // Z flag set (0x40 | 0x02)
      mem[0] = 0xCA; mem[1] = 0x10; mem[2] = 0x00;  // JZ 0x0010
      cpu.steps(10);
      assert.equal(cpu.status().pc, 0x10, "Jumped to 0x0010 (Z was set)");
    });

    QUnit.test("JNZ — no jump when zero flag set", async (assert) => {
      const { cpu, mem } = await createTestCPU();
      cpu.set("F", 0x42);                             // Z flag set (0x40 | 0x02)
      mem[0] = 0xC2; mem[1] = 0x10; mem[2] = 0x00;  // JNZ 0x0010
      cpu.steps(10);
      assert.equal(cpu.status().pc, 3, "No jump, PC advanced past JNZ");
    });
  });

  QUnit.module("Call and Return", () => {
    QUnit.test("CALL / RET round-trip", async (assert) => {
      const { cpu, mem } = await createTestCPU();
      cpu.set("SP", 0xF000);
      mem[0] = 0xCD; mem[1] = 0x10; mem[2] = 0x00; // CALL 0x0010
      mem[0x10] = 0xC9;                               // RET
      cpu.step();  // CALL
      assert.equal(cpu.status().pc, 0x10, "PC = 0x0010 after CALL");
      cpu.step();  // RET
      assert.equal(cpu.status().pc, 3, "PC = 3 after RET");
    });
  });

  QUnit.module("I/O Operations", () => {
    QUnit.test("OUT (n),A writes to port", async (assert) => {
      const { cpu, mem, ports } = await createTestCPU();
      mem[0] = 0x3E; mem[1] = 0xAB; // MVI A,0xAB
      mem[2] = 0xD3; mem[3] = 0x10; // OUT 0x10,A
      cpu.steps(17);
      assert.equal(ports[0x10], 0xAB, "Port 0x10 = 0xAB");
    });

    QUnit.test("IN A,(n) reads from port", async (assert) => {
      const { cpu, mem, ports } = await createTestCPU();
      ports[0x20] = 0x55;
      mem[0] = 0xDB; mem[1] = 0x20; // IN A,0x20
      cpu.step();
      assert.equal(cpu.status().a, 0x55, "A = 0x55 from port 0x20");
    });
  });

  QUnit.module("Cycle Timing", () => {
    QUnit.test("NOP = 4, MVI = 7, MOV r,r = 5, MOV M = 7", async (assert) => {
      const { cpu, mem } = await createTestCPU();
      mem[0] = 0x00; // NOP      4
      mem[1] = 0x3E; mem[2] = 0x00; // MVI A,0  7
      mem[3] = 0x47; // MOV B,A  5
      mem[4] = 0x46; // MOV B,M  7 (reads from [HL]=0x0000)
      assert.equal(cpu.step(), 4, "NOP = 4");
      assert.equal(cpu.step(), 7, "MVI A,n = 7");
      assert.equal(cpu.step(), 5, "MOV B,A = 5");
      assert.equal(cpu.step(), 7, "MOV B,M = 7");
    });

    QUnit.test("CALL = 17, RET = 10", async (assert) => {
      const { cpu, mem } = await createTestCPU();
      cpu.set("SP", 0xF000);
      mem[0]    = 0xCD; mem[1] = 0x10; mem[2] = 0x00; // CALL 0x0010
      mem[0x10] = 0xC9;                                  // RET
      assert.equal(cpu.step(), 17, "CALL = 17");
      assert.equal(cpu.step(), 10, "RET = 10");
    });
  });

  QUnit.module("Special Instructions", () => {
    QUnit.test("RLC — rotate left through carry", async (assert) => {
      const { cpu, mem } = await createTestCPU();
      mem[0] = 0x3E; mem[1] = 0x80; // MVI A,0x80
      mem[2] = 0x07;                  // RLC
      cpu.steps(11);
      const s = cpu.status();
      assert.equal(s.a,       0x01, "A rotated: 0x80 → 0x01");
      assert.equal(s.f & 1,   1,    "Carry set (MSB was 1)");
    });

    QUnit.test("DAA — decimal adjust", async (assert) => {
      const { cpu, mem } = await createTestCPU();
      mem[0] = 0x3E; mem[1] = 0x09; // MVI A,0x09
      mem[2] = 0x06; mem[3] = 0x01; // MVI B,0x01
      mem[4] = 0x80;                  // ADD B  → A=0x0A
      mem[5] = 0x27;                  // DAA    → A=0x10 (BCD)
      cpu.steps(25);
      assert.equal(cpu.status().a, 0x10, "9+1 BCD = 0x10");
    });

    QUnit.test("CMA — complement A", async (assert) => {
      const { cpu, mem } = await createTestCPU();
      mem[0] = 0x3E; mem[1] = 0x55; // MVI A,0x55
      mem[2] = 0x2F;                  // CMA
      cpu.steps(11);
      assert.equal(cpu.status().a, 0xAA, "~0x55 = 0xAA");
    });

    QUnit.test("XCHG — swaps DE and HL", async (assert) => {
      const { cpu, mem } = await createTestCPU();
      mem[0] = 0x21; mem[1] = 0x34; mem[2] = 0x12; // LXI H,0x1234
      mem[3] = 0x11; mem[4] = 0x78; mem[5] = 0x56; // LXI D,0x5678
      mem[6] = 0xEB;                                  // XCHG
      cpu.steps(41);
      const s = cpu.status();
      assert.equal((s.h << 8) | s.l, 0x5678, "HL = old DE = 0x5678");
      assert.equal((s.d << 8) | s.e, 0x1234, "DE = old HL = 0x1234");
    });
  });

  QUnit.module("Interrupt Handling", () => {
    QUnit.test("interrupt() respects INTE flag — ignored when disabled", async (assert) => {
      const { cpu, mem } = await createTestCPU();
      cpu.set("SP", 0xF000);
      mem[0] = 0x00; // NOP (INTE stays 0)
      cpu.step();
      const pcBefore = cpu.status().pc;
      cpu.interrupt(0x38);
      assert.equal(cpu.status().pc, pcBefore, "Interrupt ignored when INTE=0");
    });

    QUnit.test("interrupt() accepted after EI", async (assert) => {
      const { cpu, mem } = await createTestCPU();
      cpu.set("SP", 0xF000);
      mem[0] = 0xFB; // EI
      cpu.step();
      cpu.interrupt(0x08);
      assert.equal(cpu.status().pc, 0x08, "PC jumped to interrupt vector");
    });
  });

  QUnit.module("flagsToString", () => {
    QUnit.test("flags after zero result", async (assert) => {
      const { cpu } = await createTestCPU();
      // Set F directly with Z=1 (0x40), S=0, P=1 (0x04), always-1 (0x02)
      cpu.set("F", 0x46);  // Z|P|1 = 0x40|0x04|0x02
      const fs = cpu.flagsToString();
      assert.ok(fs.includes("Z"), "Z flag uppercase (set)");
      assert.ok(fs.includes("s"), "S flag lowercase (clear)");
    });
  });

});
