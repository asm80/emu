import { createZXS } from "../src/devices/zxs/zxspectrum.js";
import { readFileSync, writeFileSync } from "fs";

const zxs = createZXS({ model: "128k", sampleRate: 44100 });
const sna = new Uint8Array(readFileSync(new URL("../src/devices/zxs/mdad3.sna", import.meta.url)));
zxs.reset();
zxs.loadSNA(sna);

for (let f = 0; f < 99; f++) zxs.frame();

zxs.capturePortOut(1);
zxs.frame();
const captures = zxs.dumpPortCapture();

const SCANLINE_T  = 228;
const VIS_START_T = 8873;

// Show ALL border OUTs in order with lineT within their scanline
const borderOuts = captures
  .filter(e => (e.port & 1) === 0)
  .map(e => {
    const scanline = Math.floor((e.t - VIS_START_T) / SCANLINE_T);
    const lineT    = e.t - VIS_START_T - scanline * SCANLINE_T;
    return { t: e.t, val: e.val & 7, scanline, lineT };
  })
  .sort((a, b) => a.t - b.t);

// Events in the screenEventsTable for a top-border line:
// lineT = 0, 8, 16, 24, 32, 40, 48, 56, 64, 72, 80, 88, 96, 104, 112, 120, 128, 136, 144, 152
// Each covers 16px. updateFramebuffer(t) fires event if evT <= t.
const EVENTS = [0,8,16,24,32,40,48,56,64,72,80,88,96,104,112,120,128,136,144,152];

console.log("Scanline | lineT | color | next event lineT | effect x-start");
console.log("---------|-------|-------|------------------|---------------");
for (const o of borderOuts) {
  const nextEv = EVENTS.find(e => e > o.lineT) ?? 160;
  const xStart = nextEv <= 8 ? (nextEv / 2 * 2)  // approx
    : nextEv <= 16 ? (nextEv - 0) * 2
    : 0 + (nextEv) * 2;  // rough: each 8T = 16px
  console.log(`  ${String(o.scanline).padStart(3)}    | ${String(o.lineT).padStart(5)} | ${o.val}     | ${String(nextEv).padStart(16)} | x=${nextEv * 2}`);
}

// Also check: what do events at lineT=0 and lineT=8 see as border color?
// (they fire from the PREVIOUS scanline's last border color)
console.log("\n--- Summary for scanlines 9-20 (first and last OUT) ---");
const scanlines = {};
for (const o of borderOuts) {
  if (!scanlines[o.scanline]) scanlines[o.scanline] = [];
  scanlines[o.scanline].push(o);
}
for (const [sl, outs] of Object.entries(scanlines)) {
  const n = parseInt(sl);
  if (n < 9) continue;
  const first = outs[0], last = outs[outs.length - 1];
  const colorOuts = outs.filter(o => o.val !== 0);
  console.log(`Scanline ${n}: ${outs.length} OUTs, first lineT=${first.lineT} color=${first.val}, last lineT=${last.lineT} color=${last.val}, colored: ${colorOuts.length}`);
}

// Save PPM for visual verification
const buf = zxs.getVideoBuffer();
const W = 320, H = 240;
const header = `P6\n${W} ${H}\n255\n`;
const rgb = Buffer.alloc(W * H * 3);
for (let i = 0; i < W * H; i++) {
  rgb[i*3]   = buf[i*4];
  rgb[i*3+1] = buf[i*4+1];
  rgb[i*3+2] = buf[i*4+2];
}
writeFileSync("src/devices/zxs/diag-mdad3-f100.ppm", Buffer.concat([Buffer.from(header), rgb]));
console.log("\nSaved diag-mdad3-f100.ppm");
