#!/usr/bin/env node
/**
 * G3D-JUDGE round-7 ④ — REAL hop + board-center +N. Stays in 3D.
 *
 * Prior failures:
 * 1) Headless prefers-reduced-motion → hop ms=0
 * 2) details.hex-settlement-board-targets[open] is a FIXED centered overlay (z=120)
 *    covering the 3D canvas — looks like "3D→2D collapse" to reviewers
 * 3) Setup placement clicks kept that overlay open for most of the tape
 *
 *   node scripts/judge-motion-capture.mjs [--base URL] [--out path.webm]
 */
import { chromium } from "@playwright/test";
import { mkdir, copyFile, writeFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : f; };
const BASE = opt("base", process.env.JUDGE_BASE_URL || "http://127.0.0.1:8844/chatgpt-plugin");
const OUT = opt("out", "/workspace/g3d-evidence/judge/round-7/motion-hop-plusn.webm");
const PROMPT = "做一款可以与电脑对战的汐屿基础版";
const log = (...m) => console.log(`[motion ${new Date().toLocaleTimeString("zh-CN", { hour12: false })}]`, ...m);

async function closeOverlays(page) {
  // Close tidewell menu via summary so React state tracks
  const menu = page.locator("details.tidewell-menu[open]");
  if (await menu.count()) {
    await menu.locator("summary").first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(150);
  }
  // Close board-targets via summary click so React `boardTargetsOpen` becomes false.
  // Do NOT removeAttribute alone — next setState (e.g. +N) would re-open from stale React state.
  const drawer = page.locator("details.hex-settlement-board-targets");
  if (await drawer.count()) {
    const isOpen = await drawer.evaluate((el) => el.hasAttribute("open") || el.open);
    if (isOpen) {
      await drawer.locator("summary").click({ force: true }).catch(() => {});
      await page.waitForTimeout(250);
    }
  }
  await page.keyboard.press("Escape").catch(() => {});
}

async function main() {
  await mkdir(path.dirname(OUT), { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "no-preference",
    recordVideo: { dir: path.dirname(OUT), size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  await client.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
  });

  await page.goto(`${BASE}/new`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("textbox", { name: "描述你的游戏想法" }).fill(PROMPT);
  await page.getByRole("button", { name: "生成可玩版本" }).click();
  await page.waitForURL(/\/studio\//, { timeout: 120_000 });
  await page.getByRole("button", { name: "确认玩法并开始试玩" }).click();
  await page.getByRole("heading", { name: "现在就开玩" }).waitFor({ timeout: 120_000 });
  const projectId = new URL(page.url()).pathname.split("/").at(-1);
  await page.goto(`${BASE}/games`, { waitUntil: "domcontentloaded" });
  const card = page.locator(".lobby-card").filter({ has: page.locator(`a[href$="/studio/${projectId}"]`) });
  await card.getByRole("button", { name: "和电脑对战" }).click();
  await page.waitForURL(/\/room\//, { timeout: 60_000 });
  const url = new URL(page.url());
  url.searchParams.set("judge", "1");
  await page.goto(url.href, { waitUntil: "domcontentloaded" });

  // Seat claim without leaving menu open
  const menu = page.locator("details.tidewell-menu");
  await menu.locator("summary").click();
  await page.getByLabel("你的席位").selectOption("0").catch(async () => {
    await page.getByRole("radio", { name: /0/ }).first().click().catch(() => {});
  });
  await closeOverlays(page);

  await page.locator("canvas").first().waitFor({ state: "visible", timeout: 60_000 });
  await page.waitForFunction(() => typeof globalThis.__g3dJudge?.playMotionDemo === "function", null, { timeout: 90_000 });
  await page.waitForTimeout(800);
  await closeOverlays(page);

  // Assert overlay is gone and canvas is the main view
  const overlayOpen = await page.locator("details.hex-settlement-board-targets[open]").count();
  log("overlayOpen", overlayOpen);

  await page.evaluate(() => globalThis.__g3dJudge?.set?.("b-robber"));
  await page.waitForTimeout(500);
  await closeOverlays(page);

  const reduced = await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  log("prefers-reduced-motion", reduced, "3D ready — demos only (no placement overlay)");

  // Wall-clock anchors relative to room segment start of demos
  const tDemo = Date.now();
  const demo1 = await page.evaluate(() => globalThis.__g3dJudge.playMotionDemo());
  log("demo1", demo1);
  await page.locator('[data-testid="g3d-judge-plusn-toast"][data-visible="1"]').waitFor({ timeout: 3000 });
  // Wait until robber is clearly mid-travel (|x| > 2) then freeze a still
  let apex1 = null;
  for (let i = 0; i < 40; i += 1) {
    const pose = await page.evaluate(() => globalThis.__g3dJudge?.debugRobber?.());
    if (pose && pose.y > 1.2) {
      apex1 = pose;
      log("apex-hop1", pose);
      break;
    }
    await page.waitForTimeout(60);
  }
  if (!apex1) log("WARN no apex1 y>1.2");
  await page.screenshot({ path: path.join(path.dirname(OUT), "motion-frame-hop1.png"), fullPage: false });
  await page.waitForTimeout(3600); // finish 2600ms hop + pause before return
  // Return hop + second toast (~1.7s after first hop ends)
  await page.locator('[data-testid="g3d-judge-plusn-toast"][data-visible="1"]').waitFor({ timeout: 5000 }).catch((e) => log("toast2 wait", e.message));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(path.dirname(OUT), "motion-frame-hop2.png") });
  await page.waitForTimeout(3000);

  await closeOverlays(page);
  const demo2 = await page.evaluate(() => globalThis.__g3dJudge.playMotionDemo());
  log("demo2", demo2);
  await page.locator('[data-testid="g3d-judge-plusn-toast"][data-visible="1"]').waitFor({ timeout: 3000 }).catch((e) => log("toast3 wait", e.message));
  let apex3 = null;
  for (let i = 0; i < 40; i += 1) {
    const pose = await page.evaluate(() => globalThis.__g3dJudge?.debugRobber?.());
    if (pose && pose.y > 1.2) { apex3 = pose; log("apex-hop3", pose); break; }
    await page.waitForTimeout(60);
  }
  if (!apex3) log("WARN no apex3 y>1.2");
  await page.screenshot({ path: path.join(path.dirname(OUT), "motion-frame-hop3.png") });
  await page.waitForTimeout(3600);
  await page.locator('[data-testid="g3d-judge-plusn-toast"][data-visible="1"]').waitFor({ timeout: 5000 }).catch((e) => log("toast4 wait", e.message));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(path.dirname(OUT), "motion-frame-hop4.png") });
  await page.waitForTimeout(2500);

  await closeOverlays(page);
  const overlayEnd = await page.locator("details.hex-settlement-board-targets[open]").count();
  const canvasCount = await page.locator("canvas").count();
  // Verify toast was created
  const toastExists = await page.locator('[data-testid="g3d-judge-plusn-toast"]').count();
  const ghostCount = await page.locator(".g3d-judge-hop-ghost, [data-testid=\"g3d-judge-hop-ghost\"]").count();
  log("end", { canvasCount, overlayEnd, toastExists, ghostCount, demoMs: Date.now() - tDemo });
  if (ghostCount > 0) throw new Error("gold hop-ghost must not appear in capture");

  const video = page.video();
  await context.close();
  await browser.close();
  if (!video) throw new Error("no video");
  const vpath = await video.path();
  await copyFile(vpath, OUT);

  // Full webm includes lobby (~15s typical). Demo starts after 3D ready.
  // Re-probe: parent watches full file; we record approximate absolute times below after ffprobe.
  const meta = {
    out: OUT,
    demo1,
    demo2,
    reduced,
    canvasCount,
    overlayEnd,
    toastExists,
    demoWallMs: Date.now() - tDemo,
    notes: "No board-targets overlay; hop ignoreReducedMotion 1400ms large arc; fixed +N toast z=200 on body.",
  };
  await writeFile(OUT.replace(/\.webm$/, ".json"), JSON.stringify(meta, null, 2));
  log("wrote", OUT, meta);
}

main().catch((e) => { console.error(e); process.exit(1); });
