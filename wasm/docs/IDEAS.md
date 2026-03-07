# Nápady a architektonické úvahy

---

## Periferie ve WASM místo JS

### Motivace

Aktuální architektura: CPU jádro v WASM, periferie (ACIA 6850/6551, Simple Serial)
v JS workeru. Každá IN/OUT instrukce překračuje WASM→JS hranici přes importovanou funkci:

```
WASM execute() → js_portIn(port) import → JS peripheral bus → vrátí hodnotu → zpět do WASM
```

### Co se skutečně děje při IN/OUT

Každé volání importované funkce stojí ~20–100 ns na V8. Polling smyčka čtoucí
status ACIA každých ~15 T-stavů při 2 MHz = **~130 000 volání `js_portIn` za sekundu**
= ~13 ms overhead za sekundu. I s `runTicks()` (celá smyčka uvnitř WASM) se tato
hranice překračuje per-instrukce — importy jsou volány přímo z `execute()`.

### Co by periferie ve WASM přinesly

**Eliminace per-instrukce boundary crossing**
`execute()` by volal `portIn(port)` jako běžnou WASM funkci — nulový overhead.
`runTicks()` by byl skutečně tight bez jakéhokoliv JS/WASM přechodu za běhu.

**Cycle-accurate timing**
Periferie v JS neví, kolik T-stavů uplynulo. Periferie v WASM má přístup k `regCycles`:

```typescript
// ACIA v AssemblyScript — přesný baud rate timer
if (regCycles - lastTxCycle >= cyclesPerBaud) { shiftNextBit(); }
```

Umožňuje simulovat reálnou přenosovou rychlost, přerušení ve správný okamžik, apod.

**Synchronní generování přerušení**
Teď musí přerušení přijít jako zpráva z JS (`{ type: "interrupt" }`).
Periferie v WASM by nastavila příznak přímo uvnitř `execute()`:

```typescript
// Po příjmu bytu do RX bufferu:
if (regInte && aciaIrqEnabled) { pendingInterrupt = true; }
// step() zkontroluje před dalším instruction fetch
```

### Co by nepomohlo

**TX výstup (WASM → terminál) stále potřebuje JS import.**
Terminál žije v JS/browseru — ACIA by musela volat `js_aciaOutput(charCode)` import.
Výstupní cesta zůstává stejná jako teď.

**RX input (klávesnice → WASM) taky.**
Byte z terminálu musí přes `postMessage` do workeru a odtud do WASM paměti.
Tohle se nemění — jde o asynchronní external event.

### Trade-off tabulka

| | Periferie v JS (teď) | Periferie ve WASM |
|---|---|---|
| IN/OUT overhead | ~20–100 ns / instrukce | 0 (WASM interní call) |
| Cycle-accurate timing | ✗ | ✓ |
| Synchronní IRQ | ✗ | ✓ |
| TX → terminál | JS callback | JS import (stejné) |
| RX ← terminál | `peripheral.in` zpráva | stejné |
| Flexibilita konfigurace | JS objekt za runtime | rekompilace AS |
| Složitost implementace | nízká | střední |

### Doporučená strategie

Praktická architektura kombinuje oboje:

- **CPU + timer/IRQ subsystém + CTC v WASM** — timing-critical, generují přerušení
- **Jednoduché I/O periferie (ACIA polling, Simple Serial) v JS** — overhead akceptovatelný

Přesun má smysl primárně pro:
- Interrupt controller (PIC 8259)
- Timer/counter (CTC Z80, PIT 8253)
- Přesnou emulaci baud rate (ACIA s reálnou rychlostí, ne "vždy ready")
