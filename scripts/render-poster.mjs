#!/usr/bin/env node
/**
 * G3D-18 / G3D-16 / §5.5 I-06: offline lobby thumbnail + homepage hero posters.
 * Usage: node scripts/render-poster.mjs
 * Writes:
 *   public/lobby/hex-settlement-thumb.webp (≤ 30 KB)
 *   public/lobby/tidewell-hero.webp (≤ 120 KB)
 * When cwebp is unavailable, leaves committed WebP files as source of truth.
 */
import { chromium } from "@playwright/test";
import { mkdir, writeFile, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "../public/lobby");
const outThumbWebp = path.join(outDir, "hex-settlement-thumb.webp");
const outThumbPng = path.join(outDir, "hex-settlement-thumb.png");
const outHeroWebp = path.join(outDir, "tidewell-hero.webp");
const outHeroPng = path.join(outDir, "tidewell-hero.png");

function islandHtml(width, height) {
  const sx = width / 256;
  const sy = height / 256;
  const scale = Math.min(sx, sy);
  return `<!doctype html><html><body style="margin:0;background:#1a4a6e">
<canvas id="c" width="${width}" height="${height}"></canvas>
<script>
const c = document.getElementById('c');
const g = c.getContext('2d');
g.fillStyle = '#1a4a6e'; g.fillRect(0,0,${width},${height});
const tiles = [
  [128,70,'#2f7d4a'],[168,95,'#b85a3a'],[168,145,'#7fbf5a'],
  [128,170,'#d4b13a'],[88,145,'#6b7380'],[88,95,'#c9b896'],
  [128,120,'#2f7d4a'],[208,120,'#b85a3a'],[48,120,'#7fbf5a'],
  [148,50,'#d4b13a'],[108,50,'#6b7380'],[188,170,'#2f7d4a'],
  [68,170,'#b85a3a'],[188,70,'#c9b896'],[68,70,'#7fbf5a'],
  [128,220,'#6b7380'],[168,195,'#d4b13a'],[88,195,'#2f7d4a'],
  [128,20,'#b85a3a']
];
const sx = ${sx}, sy = ${sy}, scale = ${scale};
function hex(x,y,r,fill){
  g.beginPath();
  for(let i=0;i<6;i++){
    const a=Math.PI/180*(60*i);
    const px=x+r*Math.cos(a), py=y+r*Math.sin(a);
    i?g.lineTo(px,py):g.moveTo(px,py);
  }
  g.closePath(); g.fillStyle=fill; g.fill();
  g.strokeStyle='#0d2a3d'; g.lineWidth=2*scale; g.stroke();
}
for (const [x,y,f] of tiles) hex(x*sx,y*sy,22*scale,f);
g.fillStyle='#1a1a1a'; g.beginPath(); g.arc(128*sx,120*sy,8*scale,0,Math.PI*2); g.fill();
</script></body></html>`;
}

async function renderPoster({ width, height, pngPath, webpPath, maxBytes, label }) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width, height } });
  await page.setContent(islandHtml(width, height), { waitUntil: "load" });
  await mkdir(outDir, { recursive: true });
  const png = await page.locator("canvas").screenshot({ type: "png" });
  await browser.close();
  await writeFile(pngPath, png);
  const cwebp = spawnSync("cwebp", ["-q", "72", pngPath, "-o", webpPath], {
    encoding: "utf8",
  });
  if (cwebp.status === 0) {
    const st = await stat(webpPath);
    if (st.size > maxBytes) throw new Error(`${label} ${st.size} exceeds ${maxBytes} bytes`);
    console.log(`wrote ${webpPath} (${st.size} bytes)`);
    return true;
  }
  console.warn(`cwebp unavailable for ${label}; leaving committed WebP untouched; wrote PNG for inspection`);
  console.warn(cwebp.stderr || cwebp.error || "");
  return false;
}

const thumbOk = await renderPoster({
  width: 256,
  height: 256,
  pngPath: outThumbPng,
  webpPath: outThumbWebp,
  maxBytes: 30 * 1024,
  label: "thumbnail",
});
const heroOk = await renderPoster({
  width: 960,
  height: 540,
  pngPath: outHeroPng,
  webpPath: outHeroWebp,
  maxBytes: 120 * 1024,
  label: "hero",
});
process.exit(thumbOk && heroOk ? 0 : 0);
