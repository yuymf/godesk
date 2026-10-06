#!/usr/bin/env node
/**
 * G3D-08 water evidence: desktop 1440×900 + iPhone 12 Pro × tiers (swiftshader),
 * plus a short webm of water motion. Out: /workspace/g3d-evidence/G3D-08/
 */
import { chromium, devices } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT = process.argv[2] || "/workspace/g3d-evidence/G3D-08";
const BASE = process.env.G3D_BASE_URL || "http://127.0.0.1:8822/chatgpt-plugin";
const TIERS = (process.env.G3D_TIERS || "high,medium,low").split(",");
const VIEWPORTS = (process.env.G3D_VIEWPORTS || "desktop,iphone").split(",");
const PROMPT = "做一款可以与电脑对战的卡坦岛基础版";
const { defaultBrowserType: _ignored, ...iphone12Pro } = devices["iPhone 12 Pro"];
void _ignored;

const viewportDefs = {
  desktop: { id: "desktop-1440x900", context: { viewport: { width: 1440, height: 900 } } },
  iphone: { id: "iphone12pro-390x844", context: iphone12Pro },
};

async function waitWater(page) {
  const host = page.getByTestId("g3d-scene-host");
  await host.waitFor({ timeout: 60_000 });
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="g3d-scene-host"]');
    return el?.getAttribute("data-water") === "on";
  }, undefined, { timeout: 60_000 }).catch(() => null);
  await page.waitForTimeout(2_000);
  return host;
}

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
    await page.goto(shareUrl, { waitUntil: "domcontentloaded" });
    await page.getByLabel("你的席位").selectOption("0");
    const board = page.getByRole("region", { name: "卡坦六角岛" });
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
      await page.waitForTimeout(800);
    }
    if (process.env.G3D_SHARE_FILE) await writeFile(process.env.G3D_SHARE_FILE, shareUrl);
    console.log("placed", placed, "pieces");
    await page.close();
  }

  const withQuery = (url, extra) => {
    const next = new URL(url);
    for (const [key, value] of Object.entries(extra)) next.searchParams.set(key, value);
    return next.href;
  };

  const log = { captures: [], waterLogs: [] };
  for (const vpKey of VIEWPORTS) {
    const vp = viewportDefs[vpKey];
    for (const tier of TIERS) {
      const context = await browser.newContext(vp.context);
      const page = await context.newPage();
      const consoleLines = [];
      page.on("console", (msg) => {
        const text = msg.text();
        if (/godesk\.(water|tier|pbr)|error|warn/i.test(text)) {
          consoleLines.push(`${msg.type()}: ${text.slice(0, 300)}`);
          if (/godesk\.water/.test(text)) log.waterLogs.push(text);
        }
      });
      await page.goto(withQuery(shareUrl, { tier, perf: "1" }), {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      const host = await waitWater(page);
      const attrs = await host.evaluate((el) => ({
        tier: el.getAttribute("data-tier"),
        water: el.getAttribute("data-water"),
        waterDistMs: el.getAttribute("data-water-dist-ms"),
        pbr: el.getAttribute("data-pbr"),
        toneMapping: el.getAttribute("data-tone-mapping"),
        shadowMapSize: el.getAttribute("data-shadow-map-size"),
      }));
      const snapshot = await page.evaluate(() => window.__godeskPerf?.snapshot?.() ?? null);
      const pageFile = path.join(OUT, `${vp.id}-${tier}-page.png`);
      const canvasFile = path.join(OUT, `${vp.id}-${tier}-canvas.png`);
      await host.scrollIntoViewIfNeeded();
      await page.screenshot({ path: pageFile, fullPage: false });
      await host.screenshot({ path: canvasFile });
      log.captures.push({
        viewport: vp.id,
        requestedTier: tier,
        attrs,
        renderer: snapshot?.renderer ?? null,
        rendererPeak: snapshot?.rendererPeak ?? null,
        fps: snapshot?.fps ?? null,
        console: consoleLines.slice(0, 24),
        files: [pageFile, canvasFile],
      });
      console.log(vp.id, tier, JSON.stringify(attrs), "calls", snapshot?.renderer?.calls, "peak", snapshot?.rendererPeak?.calls);
      await context.close();
    }
  }

  // Short webm of water motion (desktop high).
  {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      recordVideo: { dir: OUT, size: { width: 1440, height: 900 } },
    });
    const page = await context.newPage();
    await page.goto(withQuery(shareUrl, { tier: "high", perf: "1" }), {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    const host = await waitWater(page);
    await host.scrollIntoViewIfNeeded();
    await page.waitForTimeout(8_000);
    await context.close();
    // Playwright names video by page; rename to stable path.
    const { readdir, rename } = await import("node:fs/promises");
    const files = await readdir(OUT);
    const webm = files.find((f) => f.endsWith(".webm"));
    if (webm) {
      const dest = path.join(OUT, "water-motion-desktop-high.webm");
      await rename(path.join(OUT, webm), dest);
      log.webm = dest;
      console.log("webm", dest);
    }
  }

  await writeFile(path.join(OUT, "captures.json"), `${JSON.stringify(log, null, 2)}\n`);
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
