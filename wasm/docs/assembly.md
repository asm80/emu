# AssemblyScript implementace CPU 8080

Popis interní struktury WASM modulu — pro vývojáře, kteří chtějí rozumět nebo
upravovat AssemblyScript zdrojové kódy v `assembly/`.

---

## Proč AssemblyScript

AssemblyScript je podmnožina TypeScriptu kompilovaná přes
[Binaryen](https://github.com/WebAssembly/binaryen) do WASM. Oproti ručně psanému
WASM textu nebo Emscripten/C má výhody:

- Čitelná TypeScript-like syntaxe
- Explicitní typy (`u8`, `u16`, `i32`) bez skrytých konverzí
- `@inline` dekorátor pro hot-path funkce bez function call overhead
- `runtime: "stub"` = nulový GC overhead (vhodné pro tight loop emulátor)

---

## Soubory

### `tables.ts` — lookup tabulky

Dvě globální statické tabulky inicializované v data segmentu (kompile-time):

| Tabulka     | Typ               | Velikost  | Popis |
|-------------|-------------------|-----------|-------|
| `flagTable` | `StaticArray<u8>` | 256 B     | Flagy S/Z/P pro výsledek 0–255 |
| `daaTable`  | `StaticArray<i32>`| 4 096 B   | Opravy pro DAA instrukci (1024 × i32) |

Tabulky jsou `@lazy` module-level konstanty — umístěny do WASM data segmentu,
ne alokovány za běhu.

> **Pozor:** Lokální `StaticArray` uvnitř funkce by se alokoval na heapu
> při každém volání. S `runtime: "stub"` (bez GC) by paměť rychle docházela.
> Vždy používej module-level `@lazy const` pro lookup tabulky.

---

### `memory.ts` — model paměti

#### Konstanty

```typescript
CPU_BASE        = 0x10000   // offset CPU prostoru v WASM linear memory
OFFSET_REGS     = 0x20000   // snímek registrů (cpuStatus() sem zapisuje)
OFFSET_KEYBOARD = 0x20010   // 16 bajtů klávesnicových řádků (SAB)

REGION_RAM  = 0
REGION_ROM  = 1
REGION_MMIO = 2
```

#### Intercept tabulka

```typescript
// Tři paralelní pole, max. 10 položek
StaticArray<u16> icStart   // počáteční adresa oblasti
StaticArray<u16> icEnd     // koncová adresa (exkluzivní)
StaticArray<u8>  icType    // REGION_ROM nebo REGION_MMIO
```

Každý přístup do paměti prochází lineárním průchodem intercept tabulkou
(`interceptCount` položek). Pro typické použití (< 10 oblastí) je overhead
zanedbatelný; `@inline` zajistí inlining do každého volajícího.

#### `byteAt(addr: u16): u8`

```
pro každou intercept položku:
  pokud addr ∈ [icStart, icEnd):
    pokud MMIO → js_mmioRead(addr) a vrátit
    pokud ROM  → přeskočit (číst z RAM)
vrátit load<u8>(CPU_BASE + addr)
```

#### `byteTo(addr: u16, val: u8): void`

```
pro každou intercept položku:
  pokud addr ∈ [icStart, icEnd):
    pokud ROM  → tiše ignorovat a vrátit
    pokud MMIO → js_mmioWrite(addr, val) a vrátit
store<u8>(CPU_BASE + addr, val)
```

#### JS importy (MMIO a I/O porty)

```typescript
@external("env", "js_mmioRead")  declare function js_mmioRead(addr: u16): u8;
@external("env", "js_mmioWrite") declare function js_mmioWrite(addr: u16, val: u8): void;
@external("env", "js_portIn")    declare function js_portIn(port: u8): u8;
@external("env", "js_portOut")   declare function js_portOut(port: u8, val: u8): void;
```

Tyto funkce musí být předány při `WebAssembly.instantiate()` jako `env` importy.

#### Debugger přístup (bypass intercept)

```typescript
memGet(addr: u16): u8          // přímé čtení, ignoruje intercept
memSet(addr: u16, val: u8)     // přímý zápis, ignoruje intercept (i ROM!)
```

`memSet` záměrně obchází ROM ochranu — slouží pro nahrávání paměti z debuggeru
nebo při inicializaci.

---

### `cpu.ts` — jádro Intel 8080

#### Globální proměnné (registry)

Všechny registry jsou module-level proměnné (ne closure, ne objekt):

```typescript
let regA, regB, regC, regD, regE, regF, regH, regL: u8
let regPC, regSP: u16
let regInte, regHalted: u8   // přerušení povolena, CPU zastavena
let regCycles: i32            // celkový počet spotřebovaných T-stavů
let speakerBit: u8            // aktuální stav reproduktoru (pro audio)
```

#### Flagy

```typescript
CARRY     = 0x01
PARITY    = 0x04
HALFCARRY = 0x10
ZERO      = 0x40
SIGN      = 0x80
```

Bity 1, 3, 5 jsou fixní (bit 1 vždy 1, ostatní vždy 0). Po každém `execute()`
se flagy normalizují: `regF = (regF & 0xD7) | 0x02`.

#### Registrové páry

```typescript
bc(): u16  /  setBC(n: u16)   // B:C
de(): u16  /  setDE(n: u16)   // D:E
hl(): u16  /  setHL(n: u16)   // H:L
af(): u16  /  setAF(n: u16)   // A:F (pro PUSH/POP PSW)
```

#### Dynamický přístup k registrům (`getReg8` / `setReg8`)

8080 kóduje zdrojový/cílový registr jako 3bitové pole v opkódu. JS verze
používá `regs[REG[src]]` (dynamický přístup). AS verze používá `switch`:

```typescript
// r: 0=B 1=C 2=D 3=E 4=H 5=L 6=M([HL]) 7=A
getReg8(r: i32): u8     // vrátí hodnotu registru r
setReg8(r: i32, v: u8)  // zapíše hodnotu do registru r
```

Případ `r=6` (M) čte/zapisuje do paměti na adrese `HL`.

#### Veřejné API (exportováno přes `index.ts`)

| Export        | Typ         | Popis |
|---------------|-------------|-------|
| `reset()`     | `() → void` | Nuluje všechny registry, `regF=2` |
| `step()`      | `() → i32`  | Provede jednu instrukci, vrátí počet T-stavů |
| `status()`    | `() → void` | Zapíše snímek registrů do `OFFSET_REGS` |
| `setReg(id, value)` | `(u8, u16) → void` | Nastaví registr (viz ID tabulka níže) |
| `interrupt(vector)` | `(u16) → void` | Vyvolá hardwarové přerušení |
| `getCycles()` | `() → i32`  | Vrátí celkový počet T-stavů |
| `getPC()`     | `() → u16`  | Vrátí aktuální PC |
| `isHalted()`  | `() → u8`   | 1 pokud CPU je v HLT stavu |
| `getSpeakerBit()` / `setSpeakerBit(v)` | `u8` | Stav reproduktoru |

**ID registrů pro `setReg(id, value)`:**

| ID | Registr |
|----|---------|
| 0  | PC      |
| 1  | SP      |
| 2  | A       |
| 3  | B       |
| 4  | C       |
| 5  | D       |
| 6  | E       |
| 7  | H       |
| 8  | L       |
| 9  | F       |

#### Snímek registrů — layout `OFFSET_REGS` (0x20000)

```
offset  typ     registr
+0      u16     PC
+2      u16     SP
+4      u8      A
+5      u8      B
+6      u8      C
+7      u8      D
+8      u8      E
+9      u8      F
+10     u8      H
+11     u8      L
+12     i32     cycles
```

Celkem 16 bajtů. JS čte takto:

```javascript
const buf = instance.exports.memory.buffer;
const b   = 0x20000;
const pc  = new Uint16Array(buf)[b >> 1];
const a   = new Uint8Array(buf)[b + 4];
const cy  = new Int32Array(buf)[(b + 12) >> 2];
```

---

### `index.ts` — veřejné API

Pouze re-exportuje symboly z `memory.ts` a `cpu.ts` s přejmenováním:

```typescript
cpuReset    → reset
cpuStep     → step
cpuStatus   → status
cpuSetReg   → setReg
cpuInterrupt→ interrupt
cpuGetCycles→ getCycles
cpuGetPC    → getPC
cpuIsHalted → isHalted
```

---

## Sestavení

```bash
npm run build      # release (O3, noAssert, wasm-opt)  → out/8080.wasm (~20 KB)
npm run build:dev  # debug (O0, s assertions)          → out/8080.debug.wasm
```

`asconfig.json`:
- `runtime: "stub"` — bump-pointer alokátor, bez GC
- `initialMemory: 3, maximumMemory: 3` — přesně 3 stránky (192 KB), více nelze
- `noAssert: true` — v release odstraní bounds checks (výkon)
- `optimizeLevel: 3, shrinkLevel: 1` — agresivní optimalizace + wasm-opt

---

## Časté pasti

| Problém | Příčina | Řešení |
|---------|---------|--------|
| WASM abort při prvním ALU volání | Lokální `StaticArray` v hot funkci alokuje heap, paměť dojde | Přesuň na `@lazy` module-level |
| CPU čte nuly místo programu | `mem.fill(0)` smaže AS data segment | CPU prostor je na `0x10000`, ne na `0x0000` |
| Test čte špatné registry | JS čte z externího `WebAssembly.Memory`, WASM píše do vlastního | Vždy čti z `instance.exports.memory.buffer` |
| i32 přetečení v T-stavech | `regCycles` jako `i64` způsoboval nesprávnou typ. inferenci v AS | Používej `i32` (dostačující pro ~2 mld. T-stavů) |
