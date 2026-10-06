#!/usr/bin/env node
/**
 * G3D-07 live-test evidence: in-game WebGL screenshots, desktop 1440×900 + iPhone 12 Pro emulation,
 * per tier (high / medium / low). Playwright headless Chromium with SwiftShader (box has no GPU).
 * Usage: node capture.mjs <out-dir>   (G3D_BASE_URL, default http://127.0.0.1:8833/chatgpt-plugin)
 */
import { chromium, devices } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT = process.argv[2] || "/workspace/g3d-evidence/G3D-07/shots";
const BASE = process.env.G3D_BASE_URL || "http://127.0.0.1:8833/chatgpt-plugin";
const TIERS = (process.env.G3D_TIERS || "high,medium,low").split(",");
const VIEWPORTS = (process.env.G3D_VIEWPORTS || "desktop,iphone").split(",");
const PROMPT = "做一款可以与电脑对战的汐屿基础版";
const { defaultBrowserType: _ignored, ...iphone12Pro } = devices["iPhone 12 Pro"];
void _ignored;

const viewportDefs = {
  desktop: { id: "desktop-1440x900", context: { viewport: { width: 1440, height: 900 } } },
  iphone: { id: "iphone12pro-390x844", context: iphone12Pro },
};

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  let shareUrl = process.env.G3D_SHARE_URL;
  if (!shareUrl) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${BASE}/new`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.getByRole("textbox", { name: "描述你的游戏想法" }).fill(PROMPT);
    await page.getByRole("button", { name: "生成可玩版本" }).click();
    await page.waitForURL(/\/chatgpt-plugin\/studio\//, { timeout: 120_000 });
    await page.getByRole("button", { name: "确认玩法并开始试玩" }).click();
    await page.getByRole("heading", { name: "现在就开玩" }).waitFor({ timeout: 120_000 });
    const href = await page.getByRole("link", { name: "独立打开这一局" }).getAttribute("href");
    shareUrl = new URL(href, page.url()).href;
    // Same room for every capture (同机位同局面): place setup pieces once as seat 0.
    await page.goto(shareUrl, { waitUntil: "domcontentloaded" });
    await page.getByLabel("你的席位").selectOption("0");
    const board = page.getByRole("region", { name: "汐屿" });
    await board.waitFor({ timeout: 60_000 });
    let placed = 0;
    for (let step = 0; step < 24 && placed < 4; step += 1) {
      const settle = board.getByRole("button", { name: /放置定居点/ }).first();
      const road = board.getByRole("button", { name: /放置道路/ }).first();
      if ((await settle.count()) && (await settle.isEnabled().catch(() => false))) {
        await settle.dispatchEvent("click");
        placed += 1;
      } else if ((await road.count()) && (await road.isEnabled().catch(() => false))) {
        await road.dispatchEvent("click");
        placed += 1;
      }
      await page.waitForTimeout(1_000);
    }
    if (process.env.G3D_SHARE_FILE) await writeFile(process.env.G3D_SHARE_FILE, shareUrl);
    console.log("placed", placed, "pieces in", shareUrl.replace(/share=[^&]+/, "share=<redacted>"));
    await page.close();
  }
  const withQuery = (url, extra) => {
    const next = new URL(url);
    for (const [key, value] of Object.entries(extra)) next.searchParams.set(key, value);
    return next.href;
  };
  const log = { captures: [] };
  for (const vpKey of VIEWPORTS) {
    const vp = viewportDefs[vpKey];
    for (const tier of TIERS) {
      const context = await browser.newContext(vp.context);
      const page = await context.newPage();
      const consoleLines = [];
      page.on("console", (msg) => {
        const text = msg.text();
        if (/godesk\.(tier|pbr)|error|warn/i.test(text)) consoleLines.push(`${msg.type()}: ${text.slice(0, 300)}`);
      });
      const ktx2 = [];
      page.on("response", (response) => {
        if (/\.ktx2$|basis_transcoder/.test(response.url())) ktx2.push({ url: new URL(response.url()).pathname, status: response.status() });
      });
      await page.goto(withQuery(shareUrl, { tier, ...(process.env.G3D_PERF === "0" ? {} : { perf: "1" }) }), { waitUntil: "domcontentloaded", timeout: 60_000 });
      const host = page.getByTestId("g3d-scene-host");
      await host.waitFor({ timeout: 60_000 });
      const pbr = process.env.G3D_NO_PBR_WAIT === "1" ? "n/a" : await page.waitForFunction(() => {
        const value = document.querySelector('[data-testid="g3d-scene-host"]')?.getAttribute("data-pbr");
        return value && value !== "pending" ? value : null;
      }, undefined, { timeout: 60_000 }).then((h) => h.jsonValue()).catch(() => "timeout");
      await page.waitForTimeout(2_500);
      const attrs = await host.evaluate((el) => ({ tier: el.getAttribute("data-tier"), pbr: el.getAttribute("data-pbr"), toneMapping: el.getAttribute("data-tone-mapping"), shadowMapSize: el.getAttribute("data-shadow-map-size") }));
      const snapshot = await page.evaluate(() => window.__godeskPerf?.snapshot?.() ?? null);
      const pageFile = path.join(OUT, `${vp.id}-${tier}-page.png`);
      const canvasFile = path.join(OUT, `${vp.id}-${tier}-canvas.png`);
      await host.scrollIntoViewIfNeeded();
      await page.screenshot({ path: pageFile, fullPage: false });
      await host.screenshot({ path: canvasFile });
      log.captures.push({ viewport: vp.id, requestedTier: tier, attrs, pbr, renderer: snapshot?.renderer ?? null, rendererPeak: snapshot?.rendererPeak ?? null, gpuMemoryEstimateBytes: snapshot?.gpuMemoryEstimateBytes ?? null, fps: snapshot?.fps ?? null, ktx2Responses: ktx2.length, ktx2Failed: ktx2.filter((r) => r.status >= 400), console: consoleLines.slice(0, 20), files: [pageFile, canvasFile] });
      console.log(vp.id, tier, JSON.stringify(attrs), "calls", snapshot?.renderer?.calls, "peak", snapshot?.rendererPeak?.calls, "ktx2", ktx2.length);
      await context.close();
    }
  }
  await writeFile(path.join(OUT, "captures.json"), `${JSON.stringify(log, null, 2)}\n`);
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
