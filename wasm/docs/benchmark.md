# WASM vs JS — výsledky benchmarku a závěry

## Metodika

Program: Intel 8080 mem-copy loop (MOV/STAX/INX/DCR/JNZ), ~39 T-states na vnitřní iteraci.
Parametry: 100 M ticků × 4 opakování, čas měřen uvnitř Web Workeru pomocí `performance.now()`.

Benchmark: `wasm/benchmark.html`, spuštění přes `npm run benchmark` (port 10203).

Varianty:
- **JS** — `src/8080.js` volaný z main threadu přes `cpu.steps(N)`
- **WASM step** — JS smyčka volající `exp.step()` pro každou instrukci (přechod JS↔WASM per instrukce)
- **WASM tight** — jediné volání `exp.runTicks(N)`, smyčka běží celá uvnitř WASM

## Výsledky (M ticks/s)

| Prohlížeč / prostředí | JS     | WASM step | WASM tight |
|-----------------------|--------|-----------|------------|
| Node.js 24            | ~480   | ~370      | ~480       |
| Chrome stable         | 557    | 233       | **309**    |
| Firefox               | 206    | 601       | **765**    |
| Vivaldi (Chromium)    | 564    | 437       | **908**    |
| MS Edge (ESM*)        | 21     | 11        | 37         |
| Playwright Chromium   | ~560   | ~410      | **786**    |

*Edge s Enhanced Security Mode — JIT vypnutý pro nedůvěryhodné weby.

## Analýza

### Chrome stable vs Vivaldi/Playwright

Oba jsou Chromium, ale Chrome stable má **V8 WASM Sandbox** (přidáno ~Chrome 95+) — bounds-check na JIT úrovni i pro pevně omezenou paměť. Vivaldi a Playwright tento flag nevynucují, proto dosahují 3× vyššího WASM výkonu. COOP/COEP hlavičky (`same-origin` / `require-corp`) tuto diferenci neovlivňují.

### Firefox

SpiderMonkey má slabší JIT pro dynamický JS (206 M t/s), ale agresivní AOT WASM kompilátor (765 M t/s). WASM je zde jasný vítěz oproti JS.

### WASM step z JS smyčky

Varianta s JS smyčkou volající `exp.step()` per instrukci je ve většině prohlížečů **pomalejší než čistý JS** — každé volání překračuje JS↔WASM hranici. Smysluplná je jedině `runTicks()` varianta (tight loop uvnitř WASM).

### Edge — Enhanced Security Mode

Microsoft Edge s ESM vypíná JIT kompilátor pro weby mimo důvěryhodné zóny — výsledky jsou na úrovni interpreteru (~20 M t/s). Řešení: přidat `localhost` do výjimek v `edge://settings/privacy`.

## Závěr: má smysl dělat 8bit emulátor ve WASM?

**Pro 8bitové CPU pravděpodobně ne.** Intel 8080 běží na 2 MHz = 2 M ticks/s. I nejpomalejší měřený JS výsledek (Firefox, 206 M t/s) je **100× nad potřebou**.

WASM přidělává problémy bez měřitelného přínosu pro uživatele:

- **Peripherals** — veškerá I/O teče přes JS callbacks (`js_portIn`, `js_portOut`); tight loop ztrácí smysl, jakmile CPU čeká na periferii.
- **Debugger** — instrumentace každého `step()` je v JS přirozená; v WASM vyžaduje export stavu a JS callback na každé instrukci.
- **Chrome stable** — WASM tight loop je zde pomalejší než čistý JS.
- **Toolchain** — AssemblyScript/Rust/Emscripten vs. prostý JS.

### Kdy WASM dává smysl

- Sdílené jádro v Rustu/C++ pro browser i native (bez přepisování).
- 16/32bit CPU s komplexní instrukční sadou (x86 JIT recompiler, N64 apod.).
- DSP, video dekodéry, raytracery — výpočetně náročné části kde JS nestačí.

### Doporučení pro ASM80

CPU jádro ponechat v JS (`src/8080.js`). WASM větev (`asm80-emu/wasm/`) je cenná jako referenční implementace a pro experimenty s výkonem, ale do produkce emulátoru přináší více složitosti než užitku.
