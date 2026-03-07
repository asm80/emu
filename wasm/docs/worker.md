# Worker — protokol zpráv

Emulátor běží v **izolovaném vlákně** (Web Worker / Node.js `worker_threads`).
Hlavní vlákno komunikuje se workerem asynchronně pomocí `postMessage`.

---

## Implementace

| Soubor | Prostředí | Poznámka |
|--------|-----------|----------|
| `js/emu-worker.js` | Browser (Web Worker) | Používá `onmessage`, `postMessage`, `fetch` |
| `js/node-emu-worker.js` | Node.js (`worker_threads`) | Používá `parentPort`, `readFileSync` |

Protokol zpráv je **identický** v obou implementacích.

---

## Životní cyklus

```
Hlavní vlákno                 Worker
     │                           │
     │──── init ────────────────►│  načte WASM, nakonfiguruje intercept, nahraje ROM
     │◄─── ready ────────────────│
     │                           │
     │──── memWriteBlock ────────►│  nahraje program do RAM
     │──── frame ────────────────►│  spustí tight loop (33 333 T při 60 fps / 2 MHz)
     │◄─── frameDone ────────────│  vrátí audio buffer
     │                           │
     │──── step ─────────────────►│  jeden krok (debugger)
     │◄─── status ───────────────│
     │                           │
     │──── interrupt ────────────►│
     │──── reset ────────────────►│
     │──── breakpoint ───────────►│
```

---

## Zprávy: Hlavní vlákno → Worker

### `init`

Inicializuje WASM modul. Musí být první zpráva.

```javascript
worker.postMessage({
  type:    "init",
  wasmPath: "./out/8080.wasm",   // Node.js: cesta k souboru
  // wasmUrl: "...",              // Browser: URL pro fetch
  cpuFreq:  2_000_000,           // Hz, výchozí 2 MHz (volitelné)
  intercepts: [                  // Definice ROM/MMIO oblastí (volitelné)
    { start: 0x0000, end: 0x1000, type: "rom"  },
    { start: 0xF800, end: 0xFFFF, type: "mmio" },
  ],
  romRegions: [                  // Počáteční obsah paměti (volitelné)
    { offset: 0x0000, data: ArrayBuffer },
  ],
});
```

**Odpověď:** `ready` nebo `error`

> `romRegions.data` lze předat jako Transferable pro nulovou kopii:
> `worker.postMessage(msg, [region.data])`

---

### `frame`

Provede jeden animační frame — tight loop na `tStates` T-stavů.
Sbírá audio vzorky reproduktoru.

```javascript
worker.postMessage({
  type:    "frame",
  tStates: 33_333,   // typicky Math.round(cpuFreq / fps)
});
```

**Odpověď:** `frameDone` (nebo `break` pokud byl zasažen breakpoint)

---

### `step`

Provede právě jednu instrukci.

```javascript
worker.postMessage({ type: "step" });
```

**Odpověď:** `status`

---

### `reset`

Resetuje CPU (PC=0, všechny registry vynulovány). Neresetuje obsah paměti.

```javascript
worker.postMessage({ type: "reset" });
```

*Bez odpovědi.*

---

### `memWrite`

Zapíše jeden bajt na CPU adresu (bypass intercept — vhodné pro debugger).

```javascript
worker.postMessage({ type: "memWrite", addr: 0x1000, value: 0x3E });
```

*Bez odpovědi.*

---

### `memWriteBlock`

Zapíše blok bajtů na CPU adresu jednou operací. Efektivnější než opakované
`memWrite`. Lze předat jako Transferable (nulová kopie).

```javascript
const program = new Uint8Array([0xC3, 0x00, 0x10]);
worker.postMessage(
  { type: "memWriteBlock", addr: 0x0000, data: program.buffer },
  [program.buffer],   // transfer — po odeslání buffer v main threadu zanikne
);
```

*Bez odpovědi.*

---

### `setReg`

Nastaví CPU registr podle numerického ID.

```javascript
worker.postMessage({ type: "setReg", id: 0, value: 0x1000 }); // PC = 0x1000
```

ID registrů viz [`assembly.md`](./assembly.md#id-registrů-pro-setreg).

*Bez odpovědi.*

---

### `interrupt`

Vyvolá hardwarové přerušení (pokud `INTE=1`). Výchozí vektor je `0x38` (RST 7).

```javascript
worker.postMessage({ type: "interrupt", vector: 0x08 }); // RST 1
```

*Bez odpovědi.*

---

### `breakpoint` / `clearBreakpoints`

Přidá nebo smaže breakpoint adresy. Breakpoint zastaví frame smyčku.

```javascript
worker.postMessage({ type: "breakpoint", addr: 0x1234 });
worker.postMessage({ type: "clearBreakpoints" });
```

*Bez odpovědi.*

---

## Zprávy: Worker → Hlavní vlákno

### `ready`

Emulátor je připraven přijímat příkazy.

```javascript
{ type: "ready" }
```

---

### `frameDone`

Frame byl dokončen. `audioBuffer` je Transferable `ArrayBuffer` obsahující
`Float32Array` s ~735 vzorky (při 60 fps). Každý vzorek je `+0.5` nebo `-0.5`.

```javascript
{ type: "frameDone", audioBuffer: ArrayBuffer }

// Přijmout:
const samples = new Float32Array(e.data.audioBuffer);
audioContext.createBuffer(1, samples.length, 44100);
```

---

### `status`

Snímek registrů po `step` nebo `stop`.

```javascript
{
  type: "status",
  regs: {
    pc: number,   // 16 bit
    sp: number,   // 16 bit
    a: number, b: number, c: number, d: number,
    e: number, f: number, h: number, l: number,  // 8 bit
    cycles: number,  // i32 — celkový počet T-stavů od reset
  }
}
```

---

### `break`

Breakpoint byl zasažen během frame smyčky.
Posílá se před `frameDone`.

```javascript
{ type: "break", pc: number }
```

---

### `halt`

CPU provedla instrukci HLT.

```javascript
{ type: "halt", pc: number }
```

---

### `error`

Chyba při inicializaci nebo za běhu.

```javascript
{ type: "error", message: string }
```

---

## Audio — jak funguje downsampling

Při 2 MHz CPU a 44 100 Hz audio výstupu připadá na jeden vzorek
přibližně **45,35 T-stavů**. Worker počítá:

```javascript
const tPerSample = cpuFreq / AUDIO_RATE;   // 2 000 000 / 44 100 ≈ 45.35

// V tight loop po každém step():
const expected = Math.floor((totalT - frameStartT) / tPerSample);
while (sampleIdx < expected) {
  audioSamples[sampleIdx++] = getSpeakerBit() ? +0.5 : -0.5;
}
```

Výsledkem je 735 vzorků na frame (při 60 fps), předaných jako Transferable
bez kopírování.

---

## Keyboard — SharedArrayBuffer (js/keyboard.js)

Pro klávesnici je k dispozici helper využívající `SharedArrayBuffer`:
hlavní vlákno zapisuje stav kláves před každým frame, worker čte synchronně.

```javascript
// Hlavní vlákno
import { createKeyboardWriter } from "./js/keyboard.js";
const sab    = new SharedArrayBuffer(16);
const kbWriter = createKeyboardWriter(sab);
kbWriter.setRow(2, 0b00000100);  // řádek 2, bit 2 stisknut

// Worker — čte při IN instrukci přes portIn callback
import { createKeyboardReader } from "./js/keyboard.js";
const kbReader = createKeyboardReader(sab);
const row = kbReader.getRow(2);
```

> Keyboard helper je připraven ale není zapojen do node-emu-worker.js — consumer
> si jej napojí přes `js_portIn` callback v MMIO konfiguraci.
