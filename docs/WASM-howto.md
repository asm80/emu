# Záměr: WASM port asm80-emu + Web Worker architektura

## Motivace

Současná JS implementace CPU jader funguje spolehlivě, ale běží v hlavním UI threadu. Při kontinuálním `run` blokuje vykreslování. Cílem je:

1. Zkompilovat CPU jádra do WebAssembly (AssemblyScript → `.wasm`)
2. Spustit emulátor jako Web Worker — UI thread není nikdy blokován
3. Komunikovat přes SharedArrayBuffer a postMessage — minimální overhead

---

## Nástroj: AssemblyScript

[AssemblyScript](https://www.assemblyscript.org/) kompiluje TypeScript-like jazyk do WASM přes Binaryen. Je vhodný proto, že:

- Syntaxe blízká stávajícímu JS kódu — přepis je z velké části mechanický
- Přímý přístup k WASM lineární paměti (`load<u8>`, `store<u8>`)
- 64 KB memory buffer žije přímo v WASM linear memory — JS/Worker k němu sahá jako `Uint8Array` přes `memory.buffer`, bez kopírování
- Instrukce `switch/case` a lookup tables (parity, flags) se přepisují 1:1

---

## Memory model

### Stávající stav

Současný interface:

```javascript
const cpu = createZ80({
  byteAt: (addr) => { ... },
  byteTo: (addr, val) => { ... },
  portIn:  (port) => { ... },
  portOut: (port, val) => { ... },
});
```

Callbacks `byteAt`/`byteTo` nejsou pomalé abstrakce přes celou paměť. Fungují takto:

```javascript
byteAt: (addr) => {
  if (addr >= 0xFF00 && addr < 0xFF10) return uart.read(addr);  // MMIO
  return buffer[addr];  // 99.9 % případů — flat 64 KB buffer
}
```

Typicky méně než 10 range checků. Zbytek je přímý přístup do bufferu.

### WASM model

64 KB buffer přesuneme do WASM lineární paměti. JS callback se volá **jen pro MMIO rozsahy**:

```typescript
// AssemblyScript
@external("env", "js_portRead")
declare function js_portRead(addr: u16): u8;

@external("env", "js_portWrite")
declare function js_portWrite(addr: u16, val: u8): void;

// Intercept tabulka — nastavená z JS před startem, max ~10 záznamů
let interceptCount: i32 = 0;
const interceptStart = new StaticArray<u16>(10);
const interceptEnd   = new StaticArray<u16>(10);
const interceptType  = new StaticArray<u8>(10);  // ROM=1, MMIO=2

@inline
function byteAt(addr: u16): u8 {
  for (let i = 0; i < interceptCount; i++) {
    if (addr >= interceptStart[i] && addr < interceptEnd[i]) {
      if (interceptType[i] == MMIO) return js_portRead(addr);
      return load<u8>(addr);  // ROM — čtení OK, zápis ignorujeme
    }
  }
  return load<u8>(addr);  // RAM — přímá WASM instrukce i32.load8_u
}

@inline
function byteTo(addr: u16, val: u8): void {
  for (let i = 0; i < interceptCount; i++) {
    if (addr >= interceptStart[i] && addr < interceptEnd[i]) {
      if (interceptType[i] == ROM)  return;  // tiše ignoruj zápis do ROM
      if (interceptType[i] == MMIO) { js_portWrite(addr, val); return; }
    }
  }
  store<u8>(addr, val);  // RAM
}
```

Intercept tabulka se nastaví z JS jednorázově při inicializaci podle `.emu` konfigurace. Za runtimu je overhead loop přes <10 záznamů, pouze pokud adresa nespadá do RAM.

---

## Web Worker architektura

### Rozdělení odpovědností

```
Main thread                          Worker
────────────────────────────         ──────────────────────────────
IDE, editor, debugger UI             WASM CPU jádro
Canvas rendering                     Periférie (UART, 8255, timer…)
AudioWorklet                         Keyboard state (čte SharedArrayBuffer)
Keyboard events (píše SAB)           Audio sample sběr
postMessage: příkazy debuggeru  ──▶  tight emulation loop
postMessage: frame kick         ──▶
                                ◀──  postMessage: frameDone + audio buffer
                                ◀──  postMessage: terminal char, break event
```

### Klíčový princip

**Worker nikdy nečeká na main thread během frame loopu.** Vše co potřebuje (stav kláves) je připraveno předem v SharedArrayBuffer. Main thread nikdy nečeká na Worker — jen zpracuje výsledek až přijde.

---

## Animation frame — tok dat (příklad: PMD-85)

PMD-85: CPU 8080 @ 2 MHz, displej jako bitmapa v interní RAM, zvuk přes 8255.

```
60 fps → 1 frame = 1/60 s → 2 000 000 / 60 ≈ 33 333 T-states
Audio:   44 100 Hz / 60 fps = 735 sampů na frame
```

### Main thread

```javascript
requestAnimationFrame(() => {
  // 1. Napiš aktuální stav kláves do SharedArrayBuffer
  for (let row = 0; row < 16; row++) {
    keyboardSAB[row] = getKeyRow(row);
  }

  // 2. Kick Worker — spusť jeden frame
  worker.postMessage({ type: 'frame' });
});

worker.onmessage = ({ data }) => {
  if (data.type !== 'frameDone') return;

  // 3. Vykresli display — čti přímo ze sdílené RAM, žádná kopie
  renderDisplay(ctx, videoRamView);

  // 4. Předej audio buffer AudioWorklet (transfer ownership, bez kopie)
  audioWorklet.port.postMessage(
    { samples: data.audioBuffer },
    [data.audioBuffer]
  );
};
```

### Worker

```javascript
onmessage = ({ data }) => {
  if (data.type !== 'frame') return;

  const targetT    = totalT + 33333;
  const audioSamples = new Float32Array(735);
  let sampleIdx    = 0;
  let speakerState = 0;

  // Tight loop — čistý WASM, žádné přerušení z JS
  while (totalT < targetT) {
    totalT += wasm.exports.step();  // vrátí počet T aktuální instrukce

    // Sběr audio: downsample 2 MHz → 44 100 Hz
    // 1 audio sample ≈ každých 45 T-states (2 000 000 / 44 100)
    const expectedSample = Math.floor(
      (totalT - frameStartT) / (2000000 / 44100)
    );
    while (sampleIdx < expectedSample && sampleIdx < 735) {
      audioSamples[sampleIdx++] = speakerState ? 0.5 : -0.5;
    }

    // Speaker bit — 8255 ho zapsal do sdíleného registru
    speakerState = wasm.exports.getSpeakerBit();
  }

  postMessage(
    { type: 'frameDone', audioBuffer: audioSamples.buffer },
    [audioSamples.buffer]  // transfer ownership — bez kopie
  );
};
```

---

## SharedArrayBuffer layout

```
Sdílená paměť (WebAssembly.Memory — 64 KB + extra):

Offset 0x0000 – 0xFFFF   64 KB paměť počítače
                          Worker (WASM) sem zapisuje, main thread čte
                          Video RAM leží v příslušném rozsahu (např. 0xC000–)

Oddělený SAB (keyboard):
Offset 0x00 – 0x0F       Řádky klávesnice (16 bajtů)
                          Main thread zapisuje z keydown/keyup,
                          WASM čte přes portIn() — synchronně, zero overhead
```

---

## Debugger příkazy

Debugger komunikuje standardním postMessage, mimo frame loop:

```
UI → Worker:   { type: 'step' }
UI → Worker:   { type: 'run' }
UI → Worker:   { type: 'stop' }
UI → Worker:   { type: 'breakpoint', addr: 0x1234 }
UI → Worker:   { type: 'setRegister', reg: 'A', value: 0xFF }

Worker → UI:   { type: 'status', regs: { pc, sp, a, b, ... }, cycles: N }
Worker → UI:   { type: 'break', pc: 0x1234 }
Worker → UI:   { type: 'terminal', char: 0x41 }
```

---

## Přepis CPU jader — co je snadné, co ne

| Aspekt | Obtížnost | Poznámka |
|---|---|---|
| Registry jako lokální proměnné | Snadné | `let regA: u8 = 0` |
| `switch/case` instrukce (256 case) | Snadné | 1:1 přepis |
| Lookup tables (parity, flags) | Snadné | `StaticArray<u8>` |
| Factory function → class | Střední | AS nemá closures přes GC heap |
| MMIO callbacks jako importy | Střední | `@external("env", ...)` |
| 65816 dynamický 8/16-bit mode | Střední | Podmíněná logika zůstává |

Celkem ~13 000 řádků JS napříč 9 CPU. Přepis je z velké části mechanický.

---

## Doporučené pořadí implementace

1. **Proof of concept** — 8080 jádro v AssemblyScript, flat RAM, bez MMIO
2. **Intercept tabulka** — ROM a MMIO rozsahy, JS callbacks pro periférie
3. **Worker wrapper** — postMessage interface, frame loop, keyboard SAB
4. **Audio** — sběr speaker přechodů, downsample, AudioWorklet
5. **Display** — SharedArrayBuffer přístup z main threadu, Canvas rendering
6. **Zbylá CPU jádra** — Z80, 6502, 6809, … (stejný vzor)
7. **Debugger** — postMessage příkazy, breakpointy uvnitř Workeru
