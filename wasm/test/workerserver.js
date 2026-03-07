/**
 * Minimální statický HTTP server pro browser benchmark.
 * Slouží obsah wasm/ adresáře na http://localhost:10203
 *
 * Spustit:
 *   node test/workerserver.js
 * Pak otevřít:
 *   http://localhost:10203/wasm/benchmark.html
 *
 * ROOT je asm80-emu/ (o úroveň výš než wasm/) aby byl dostupný i src/8080.js
 * pro JS variantu benchmarku (import "../../src/8080.js" z benchmark.html).
 */

import { createServer } from "http";
import { readFile }     from "fs/promises";
import { resolve, extname, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const PORT = 10203;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "text/javascript; charset=utf-8",
  ".wasm": "application/wasm",
  ".map":  "application/json",
};

createServer(async (req, res) => {
  const url  = req.url === "/" ? "/wasm/benchmark.html" : req.url;
  const file = resolve(ROOT, "." + url);

  // Zabezpečení: nepouštět ven z ROOT
  if (!file.startsWith(ROOT)) {
    res.writeHead(403); res.end("Forbidden"); return;
  }

  try {
    const data = await readFile(file);
    const ext  = extname(file);
    res.writeHead(200, {
      "Content-Type":  MIME[ext] ?? "application/octet-stream",
      "Cache-Control": "no-cache",
      "Cross-Origin-Opener-Policy":   "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    });
    res.end(data);
  } catch {
    res.writeHead(404); res.end("Not found: " + url);
  }
}).listen(PORT, () => {
  console.log(`Benchmark server: http://localhost:${PORT}/wasm/benchmark.html`);
});
