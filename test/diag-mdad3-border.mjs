import { createZXS } from "../src/devices/zxs/zxspectrum.js";
import { readFileSync } from "fs";

const zxs = createZXS({ model: "128k", sampleRate: 44100 });
const sna = new Uint8Array(readFileSync(new URL("../src/devices/zxs/mdad3.sna", import.meta.url)));
zxs.reset();
zxs.loadSNA(sna);

// Run to steady-state
for (let f = 0; f < 99; f++) zxs.frame();

// Capture frame 100 border changes
zxs.capturePortOut(1);
zxs.frame();
const captures = zxs.dumpPortCapture();

// 128k timing
const SCANLINE_T   = 228;
const VIS_START_T  = 8873;   // first top-border event
const ACTIVE_START = VIS_START_T + 24 * SCANLINE_T;   // first active line (14345)
const ACTIVE_END   = ACTIVE_START + 192 * SCANLINE_T; // first bottom-border line (58121)
const FRAME_T      = 70908;

// Filter border OUTs (port 0xFE = even port, bit0=0)
const borderChanges = captures.filter(e => (e.port & 1) === 0)
  .map(e => {
    const t = e.t;
    const region = t < VIS_START_T ? "vblank"
      : t < ACTIVE_START ? "top_border"
      : t < ACTIVE_END   ? "active"
      : t < FRAME_T      ? "bottom_border"
      : "post";
    const scanline = Math.floor((t - VIS_START_T) / SCANLINE_T);
    const lineT    = (t - VIS_START_T) % SCANLINE_T;
    return { t, val: e.val & 7, region, scanline, lineT };
  });

console.log(`Total border OUTs in frame 100: ${borderChanges.length}`);
console.log(`\nRegion breakdown:`);
for (const reg of ["vblank","top_border","active","bottom_border","post"]) {
  const n = borderChanges.filter(e => e.region === reg).length;
  console.log(`  ${reg.padEnd(14)}: ${n}`);
}

console.log(`\nFirst 40 border changes:`);
console.log("  T-state   region          scan  lineT  color");
for (const e of borderChanges.slice(0, 40)) {
  console.log(`  ${String(e.t).padStart(6)}  ${e.region.padEnd(14)}  ${String(e.scanline).padStart(3)}   ${String(e.lineT).padStart(4)}    ${e.val}`);
}
