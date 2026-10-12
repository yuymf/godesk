#!/usr/bin/env node
/**
 * G3D-16: clean Tidewell homepage hero posters (board only, no HUD / perf).
 * Usage: GODESK_BASE_URL=http://127.0.0.1:8822 node scripts/render-tidewell-hero.mjs
 * Writes public/lobby/tidewell-hero-{1200,720}.{webp,avif} (+ legacy tidewell-hero.webp = 1200).
 */
import { chromium } from "@playwright/test";
import { mkdir, writeFile, stat, copyFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "../public/lobby");
const BASE = process.env.GODESK_BASE_URL || "http://127.0.0.1:8822";
const CREATOR = process.env.GODESK_DEV_CREATOR || "g3d-16-poster";
const SIZES = [
  { w: 1200, h: 675, stem: "tidewell-hero-1200" },
  { w: 720, h: 405, stem: "tidewell-hero-720" },
];

async function api(method, p, body) {
  const res = await fetch(`${BASE}${p}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-godesk-dev-creator": CREATOR,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${p} → ${res.status} ${await res.text()}`);
  return res.json();
}

async function waitJob(id) {
  for (let i = 0; i < 200; i += 1) {
    const job = await api("GET", `/api/jobs/${id}`);
    if (job.status === "succeeded" || job.status === "failed") return job;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`job ${id} timeout`);
}

function encodeStill(pngPath, outPath, { codec, quality }) {
  const args =
    codec === "webp"
      ? ["-y", "-i", pngPath, "-frames:v", "1", "-c:v", "libwebp", "-quality", String(quality), outPath]
      : [
          "-y",
          "-i",
          pngPath,
          "-frames:v",
          "1",
          "-c:v",
          "libaom-av1",
          "-still-picture",
          "1",
          "-crf",
          String(quality),
          outPath,
        ];
  const r = spawnSync("ffmpeg", args, { encoding: "utf8" });
  if (r.status !== 0) {
    console.warn(r.stderr || r.error);
    return false;
  }
  return true;
}

async function openBoardTargets(board) {
  const drawer = board.locator("details.hex-settlement-board-targets");
  if ((await drawer.count()) === 0) return;
  if ((await drawer.getAttribute("open")) !== null) return;
  await drawer.locator("summary").click().catch(() => null);
}

async function placeMidgame(page) {
  const board = page.getByRole("region", { name: "汐屿" });
  await board.waitFor({ timeout: 90_000 });
  const seat = page.getByLabel("你的席位");
  if (await seat.count()) {
    await seat.selectOption("0").catch(() => null);
  }
  // Claim / start if a primary CTA is present
  for (const name of ["加入座位", "开始对局", "入座", "确认"]) {
    const btn = page.getByRole("button", { name });
    if (await btn.count()) {
      await btn.first().click().catch(() => null);
      break;
    }
  }
  await page.getByTestId("g3d-scene-host").waitFor({ timeout: 90_000 });
  let placed = 0;
  for (let step = 0; step < 40 && placed < 10; step += 1) {
    await openBoardTargets(board);
    const candidates = [
      board.getByRole("button", { name: /建造渔村/ }),
      board.getByRole("button", { name: /铺设栈道/ }),
      board.getByRole("button", { name: /升级港镇/ }),
    ];
    let clicked = false;
    for (const group of candidates) {
      const count = await group.count();
      for (let i = 0; i < count; i += 1) {
        const btn = group.nth(i);
        if (await btn.isEnabled().catch(() => false)) {
          await btn.click({ force: true });
          placed += 1;
          clicked = true;
          break;
        }
      }
      if (clicked) break;
    }
    if (!clicked) break;
    await page.waitForTimeout(700);
  }
  console.log("placed steps", placed);
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const created = await api("POST", "/api/projects", {
    name: "汐屿海报",
    templateId: "tidewell-isles",
  });
  const projectId = created.project.id;
  const queued = await api("POST", `/api/projects/${projectId}/jobs`, {
    kind: "compile-build",
    expectedVersion: created.project.version,
    idempotencyKey: randomUUID(),
  });
  const job = await waitJob(queued.id);
  if (job.status !== "succeeded") throw new Error(job.error || "compile failed");
  const { builds } = await api("GET", `/api/projects/${projectId}?view=builds`);
  const buildId = builds[0].id;
  const session = await api("POST", `/api/builds/${buildId}/sessions`, {
    seed: 7,
    idempotencyKey: randomUUID(),
  });
  const sessionUrl = new URL(session.sessionUrl, BASE);
  // Play through setup on a normal room URL (no poster yet — need HUD buttons).
  const playUrl = sessionUrl.href;

  const browser = await chromium.launch({
    headless: true,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(playUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await placeMidgame(page);

  // Switch to poster mode (no perf): hide HUD, hero camera.
  sessionUrl.searchParams.delete("perf");
  sessionUrl.searchParams.set("poster", "1");
  sessionUrl.searchParams.set("tier", "high");
  await page.goto(sessionUrl.href, { waitUntil: "domcontentloaded", timeout: 90_000 });
  const host = page.getByTestId("g3d-scene-host");
  await host.waitFor({ timeout: 90_000 });
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="g3d-scene-host"]');
    return el?.getAttribute("data-water") === "on" && Boolean(window.__godeskPoster);
  }, undefined, { timeout: 90_000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.__godeskPoster?.setHeroView({ fill: 0.92, polarDeg: 46, azimuthDeg: 36 }));
  await page.waitForTimeout(800);

  // Capture at 2× device size for crisp downscale
  await page.setViewportSize({ width: 1200, height: 675 });
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__godeskPoster?.setHeroView({ fill: 0.92, polarDeg: 46, azimuthDeg: 36 }));
  await page.waitForTimeout(500);
  const masterPng = path.join(outDir, "tidewell-hero-master.png");
  await host.screenshot({ path: masterPng, type: "png" });

  const results = [];
  for (const size of SIZES) {
    const scaledPng = path.join(outDir, `${size.stem}.png`);
    const scale = spawnSync(
      "ffmpeg",
      ["-y", "-i", masterPng, "-vf", `scale=${size.w}:${size.h}:force_original_aspect_ratio=increase,crop=${size.w}:${size.h}`, scaledPng],
      { encoding: "utf8" },
    );
    if (scale.status !== 0) throw new Error(scale.stderr || "scale failed");
    const webp = path.join(outDir, `${size.stem}.webp`);
    const avif = path.join(outDir, `${size.stem}.avif`);
    if (!encodeStill(scaledPng, webp, { codec: "webp", quality: 78 })) throw new Error(`webp ${size.stem}`);
    const avifOk = encodeStill(scaledPng, avif, { codec: "avif", quality: 38 });
    const webpStat = await stat(webp);
    const avifStat = avifOk ? await stat(avif) : null;
    if (webpStat.size > 120 * 1024) {
      // Re-encode tighter
      encodeStill(scaledPng, webp, { codec: "webp", quality: 62 });
    }
    results.push({
      stem: size.stem,
      webp: (await stat(webp)).size,
      avif: avifStat?.size ?? null,
    });
  }

  // Legacy single-file alias used by older references → 1200 webp
  await copyFile(path.join(outDir, "tidewell-hero-1200.webp"), path.join(outDir, "tidewell-hero.webp"));
  console.log(JSON.stringify({ outDir, results, master: masterPng }, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
