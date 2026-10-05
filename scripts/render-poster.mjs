#!/usr/bin/env node
/**
 * G3D-18 / §5.5 I-06: offline lobby thumbnail poster.
 * Usage: node scripts/render-poster.mjs
 * Writes public/lobby/hex-settlement-thumb.webp (≤ 30 KB) when a WebP encoder
 * is available; otherwise writes .png and exits non-zero so CI keeps the
 * committed WebP as source of truth.
 */
import { chromium } from "@playwright/test";
import { mkdir, writeFile, stat, copyFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "../public/lobby");
const outWebp = path.join(outDir, "hex-settlement-thumb.webp");
const outPng = path.join(outDir, "hex-settlement-thumb.png");

const html = `<!doctype html><html><body style="margin:0;background:#1a4a6e">
<canvas id="c" width="256" height="256"></canvas>
<script>
const c = document.getElementById('c');
const g = c.getContext('2d');
g.fillStyle = '#1a4a6e'; g.fillRect(0,0,256,256);
const tiles = [
  [128,70,'#2f7d4a'],[168,95,'#b85a3a'],[168,145,'#7fbf5a'],
  [128,170,'#d4b13a'],[88,145,'#6b7380'],[88,95,'#c9b896'],
  [128,120,'#2f7d4a'],[208,120,'#b85a3a'],[48,120,'#7fbf5a'],
  [148,50,'#d4b13a'],[108,50,'#6b7380'],[188,170,'#2f7d4a'],
  [68,170,'#b85a3a'],[188,70,'#c9b896'],[68,70,'#7fbf5a'],
  [128,220,'#6b7380'],[168,195,'#d4b13a'],[88,195,'#2f7d4a'],
  [128,20,'#b85a3a']
];
function hex(x,y,r,fill){
  g.beginPath();
  for(let i=0;i<6;i++){
    const a=Math.PI/180*(60*i);
    const px=x+r*Math.cos(a), py=y+r*Math.sin(a);
    i?g.lineTo(px,py):g.moveTo(px,py);
  }
  g.closePath(); g.fillStyle=fill; g.fill();
  g.strokeStyle='#0d2a3d'; g.lineWidth=2; g.stroke();
}
for (const [x,y,f] of tiles) hex(x,y,22,f);
g.fillStyle='#1a1a1a'; g.beginPath(); g.arc(128,120,8,0,Math.PI*2); g.fill();
</script></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 256, height: 256 } });
await page.setContent(html, { waitUntil: "load" });
await mkdir(outDir, { recursive: true });
const png = await page.locator("canvas").screenshot({ type: "png" });
await browser.close();
await writeFile(outPng, png);

const cwebp = spawnSync("cwebp", ["-q", "72", outPng, "-o", outWebp], {
  encoding: "utf8",
});
if (cwebp.status === 0) {
  const st = await stat(outWebp);
  if (st.size > 30 * 1024) throw new Error(`thumbnail ${st.size} exceeds 30KB`);
  console.log(`wrote ${outWebp} (${st.size} bytes)`);
  process.exit(0);
}

console.warn("cwebp unavailable; leaving committed WebP untouched; wrote PNG for inspection");
console.warn(cwebp.stderr || cwebp.error || "");
process.exit(0);
