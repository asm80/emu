# asm80-emu · WASM port — přehled

Tento podprojekt je **proof-of-concept portace Intel 8080 emulátoru** do WebAssembly
pomocí [AssemblyScript](https://www.assemblyscript.org/). Cílem je uvolnit hlavní UI
vlákno: emulátor běží v **Web Workeru** a komunikuje se zbytkem aplikace zprávami.

---

## Struktura adresáře

```
wasm/
├── assembly/          AssemblyScript zdrojové soubory (→ WASM)
│   ├── tables.ts      Lookup tabulky (flagTable, daaTable)
│   ├── memory.ts      Model paměti — byteAt/byteTo, intercept tabulka
│   ├── cpu.ts         Jádro CPU Intel 8080
│   └── index.ts       Veřejné API (re-exporty)
│
├── js/                JavaScript obálky
│   ├── emu-worker.js      Browser Web Worker
│   ├── node-emu-worker.js Node.js worker_threads varianta
│   └── keyboard.js        SharedArrayBuffer helper pro klávesnici
│
├── test/              Testovací soubory (QUnit + Node.js)
│   ├── 8080.wasm.test.js       Unit testy CPU (33 testů)
│   ├── worker.integration.test.js  Integrační testy workeru (8 testů)
│   └── jmp-smoke.js            Minimální smoke test
│
├── docs/              Tato dokumentace
│   ├── README.md      (tento soubor)
│   ├── assembly.md    Popis AssemblyScript implementace
│   └── worker.md      Protokol Worker zpráv
│
├── out/               Výstup sestavení (generováno)
│   ├── 8080.wasm
│   └── 8080.debug.wasm
│
├── asconfig.json      Konfigurace AssemblyScript kompilátoru
└── package.json       npm skripty a závislosti
```

---

## Rychlý start

```bash
# Instalace závislostí (jen jednou)
npm install

# Sestavení WASM
npm run build

# Unit testy CPU
npm test

# Integrační testy workeru
npm run test:worker

# Smoke test — jeden příkaz, výsledek OK/FAIL
node test/jmp-smoke.js
```

Vyžaduje **Node.js ≥ 22**.

---

## Klíčové koncepty

### Paměťový model (3 WASM stránky = 192 KB)

```
0x00000 – 0x0FFFF   Stránka 0: AssemblyScript data segment (tabulky, globální proměnné)
0x10000 – 0x1FFFF   Stránka 1: 64 KB CPU adresní prostor (RAM + ROM oblasti)
0x20000 – 0x2001F   Stránka 2: metadata (snímek registrů + klávesnice SAB)
```

CPU adresy `0x0000–0xFFFF` se mapují na lineární paměť `0x10000–0x1FFFF`
(konstanta `CPU_BASE = 0x10000`). Stránka 0 je vyhrazena pro AssemblyScript
runtime, aby nedocházelo ke kolizi s CPU pamětí.

### Intercept tabulka (ROM a MMIO)

Většina přístupů do paměti je přímý `load/store` do lineární paměti.
Výjimky jsou oblasti registrované v intercept tabulce (max. 10 položek):

- **ROM** — zápis je tiše ignorován, čtení projde normálně
- **MMIO** — čtení/zápis deleguje na JS callback (`js_mmioRead` / `js_mmioWrite`)

### Worker architektura

Emulátor běží výhradně ve workeru. Hlavní vlákno posílá zprávy a čeká
na odpovědi — viz [`worker.md`](./worker.md).

### Audio

Worker sbírá vzorky reproduktoru během frame smyčky. 2 MHz CPU → 44 100 Hz
audio: jeden vzorek každých ~45,35 T-stavů. Výsledný `Float32Array` (735 vzorků
při 60 fps) je předán jako Transferable — bez kopírování.

---

## Soubory nezahrnuté v POC

- IDEv2 integrace (assembler, debugger UI)
- Ostatní CPU (Z80, 6502…) — stávající `src/` zůstávají beze změny
- SharedArrayBuffer pro audio (nahrazen Transferable v tomto POC)
