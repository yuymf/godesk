#!/usr/bin/env node
/**
 * G3D-13 Tidewell evidence: desktop 1440×900 + iPhone 12 Pro × tiers,
 * draw-call snapshots, HUD before/after (mobile drawer).
 * Out: /workspace/g3d-evidence/G3D-13/
 */
import { chromium, devices } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT = process.argv[2] || "/workspace/g3d-evidence/G3D-13";
const BASE = process.env.G3D_BASE_URL || "http://127.0.0.1:8822/chatgpt-plugin";
const TIERS = (process.env.G3D_TIERS || "high,medium,low").split(",");
const VIEWPORTS = (process.env.G3D_VIEWPORTS || "desktop,iphone").split(",");
const PROMPT = "做一款可以与电脑对战的汐屿六角岛资源建造游戏";
const { defaultBrowserType: _ignored, ...iphone12Pro } = devices["iPhone 12 Pro"];
void _ignored;

const viewportDefs = {
  desktop: { id: "desktop-1440x900", context: { viewport: { width: 1440, height: 900 } } },
  iphone: { id: "iphone12pro-390x844", context: iphone12Pro },
};

async function waitHost(page) {
  const host = page.getByTestId("g3d-scene-host");
  await host.waitFor({ timeout: 60_000 });
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="g3d-scene-host"]');
    return el?.getAttribute("data-water") === "on";
  }, undefined, { timeout: 60_000 }).catch(() => null);
  await page.waitForTimeout(1_500);
  return host;
}

async function openBoardTargets(board) {
  const drawer = board.locator("details.hex-settlement-board-targets");
  if ((await drawer.count()) === 0) return;
  if ((await drawer.getAttribute("open")) !== null) return;
  await drawer.locator("summary").click();
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
    const board = page.getByRole("region", { name: "汐屿六角岛" });
    await board.waitFor({ timeout: 60_000 });
    let placed = 0;
    for (let step = 0; step < 24 && placed < 4; step += 1) {
      await openBoardTargets(board);
      const settle = board.getByRole("button", { name: /建造渔村/ }).first();
      const road = board.getByRole("button", { name: /铺设栈道/ }).first();
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

  const log = { captures: [], budgets: { mediumMax: 100, lowMax: 60 }, rgLegacyBrand: 0 };
  for (const vpKey of VIEWPORTS) {
    const vp = viewportDefs[vpKey];
    for (const tier of TIERS) {
      const context = await browser.newContext(vp.context);
      const page = await context.newPage();
      await page.goto(withQuery(shareUrl, { tier, perf: "1" }), {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      const host = await waitHost(page);
      const board = page.getByRole("region", { name: "汐屿六角岛" });
      const attrs = await host.evaluate((el) => ({
        tier: el.getAttribute("data-tier"),
        water: el.getAttribute("data-water"),
        pbr: el.getAttribute("data-pbr"),
        shadowMapSize: el.getAttribute("data-shadow-map-size"),
      }));
      const snapshot = await page.evaluate(() => window.__godeskPerf?.snapshot?.() ?? null);
      const pageFile = path.join(OUT, `${vp.id}-${tier}-page.png`);
      const canvasFile = path.join(OUT, `${vp.id}-${tier}-canvas.png`);
      await host.scrollIntoViewIfNeeded();
      await page.screenshot({ path: pageFile, fullPage: false });
      await host.screenshot({ path: canvasFile });

      if (vpKey === "iphone" && tier === "high") {
        const closed = path.join(OUT, "hud-mobile-before-drawer-closed.png");
        const open = path.join(OUT, "hud-mobile-after-drawer-open.png");
        await board.screenshot({ path: closed });
        await openBoardTargets(board);
        await board.screenshot({ path: open });
        log.hudBeforeAfter = [closed, open];
      }

      const calls = snapshot?.renderer?.calls ?? null;
      const peak = snapshot?.rendererPeak?.calls ?? null;
      log.captures.push({
        viewport: vp.id,
        requestedTier: tier,
        attrs,
        renderer: snapshot?.renderer ?? null,
        rendererPeak: snapshot?.rendererPeak ?? null,
        fps: snapshot?.fps ?? null,
        files: [pageFile, canvasFile],
        drawCallsSteady: calls,
        drawCallsPeak: peak,
      });
      console.log(vp.id, tier, "calls", calls, "peak", peak, "attrs", attrs);
      await context.close();
    }
  }

  // Production UI: no perf overlay without ?perf=1
  {
    const context = await browser.newContext(viewportDefs.desktop.context);
    const page = await context.newPage();
    await page.goto(shareUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await waitHost(page);
    const hasPerf = await page.locator(".g3d-perf-overlay, [data-testid='g3d-perf-overlay']").count();
    const prodShot = path.join(OUT, "desktop-no-perf-overlay.png");
    await page.screenshot({ path: prodShot, fullPage: false });
    log.prodPerfOverlayCount = hasPerf;
    log.prodShot = prodShot;
    await context.close();
  }


  // One-browser vs real Room AI (G3D-04b lobby「和电脑对战」)
  try {
    const context = await browser.newContext(viewportDefs.desktop.context);
    const page = await context.newPage();
    await page.goto(`${BASE}/new`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.getByRole("textbox", { name: "描述你的游戏想法" }).fill(PROMPT);
    await page.getByRole("button", { name: "生成可玩版本" }).click();
    await page.waitForURL(/\/chatgpt-plugin\/studio\//, { timeout: 120_000 });
    await page.getByRole("button", { name: "确认玩法并开始试玩" }).click();
    await page.getByRole("heading", { name: "现在就开玩" }).waitFor({ timeout: 120_000 });
    const projectId = new URL(page.url()).pathname.split("/").at(-1);
    await page.goto(`${BASE}/game`);
    // Newest Tidewell build is sorted first; prefer the card for this projectId when present.
    const card = page.locator(".lobby-card").filter({ has: page.locator(`a[href*="/studio/${projectId}"]`) });
    const vsAi = (await card.count())
      ? card.getByRole("button", { name: "和电脑对战" }).first()
      : page.locator("button.lobby-vs-computer").first();
    await vsAi.waitFor({ state: "visible", timeout: 60_000 });
    await vsAi.click();
    await page.waitForURL(/\/chatgpt-plugin\/room\//, { timeout: 60_000 });
    await page.getByLabel("你的席位").selectOption("0");
    const board = page.getByRole("region", { name: "汐屿六角岛" });
    await board.waitFor({ timeout: 60_000 });
    await waitHost(page);
    for (let i = 0; i < 48; i += 1) {
      const status = await board.getByRole("region", { name: "对局状态" }).innerText().catch(() => "");
      if (/对局结束|获胜/.test(status)) break;
      if (/电脑思考中/.test(status)) {
        await page.waitForTimeout(1_200);
        continue;
      }
      await openBoardTargets(board);
      const settle = board.getByRole("button", { name: /建造渔村/ }).first();
      const road = board.getByRole("button", { name: /铺设栈道/ }).first();
      const roll = board.getByRole("button", { name: /掷骰/ }).first();
      const endTurn = board.getByRole("button", { name: /结束回合/ }).first();
      if (await settle.isVisible().catch(() => false) && await settle.isEnabled().catch(() => false)) {
        await settle.dispatchEvent("click");
      } else if (await road.isVisible().catch(() => false) && await road.isEnabled().catch(() => false)) {
        await road.dispatchEvent("click");
      } else if (await roll.isVisible().catch(() => false) && await roll.isEnabled().catch(() => false)) {
        await roll.dispatchEvent("click");
      } else if (await endTurn.isVisible().catch(() => false) && await endTurn.isEnabled().catch(() => false)) {
        await endTurn.dispatchEvent("click");
      }
      await page.waitForTimeout(900);
    }
    const aiShot = path.join(OUT, "desktop-vs-room-ai-midgame.png");
    await page.screenshot({ path: aiShot, fullPage: false });
    const host = page.getByTestId("g3d-scene-host");
    const aiCanvas = path.join(OUT, "desktop-vs-room-ai-canvas.png");
    await host.screenshot({ path: aiCanvas }).catch(() => null);
    log.roomAi = { files: [aiShot, aiCanvas], url: page.url() };
    await context.close();
  } catch (err) {
    log.roomAiError = String(err?.message ?? err);
    console.warn("room AI evidence failed", err);
  }

  await writeFile(path.join(OUT, "captures.json"), JSON.stringify(log, null, 2));
  console.log("wrote", path.join(OUT, "captures.json"));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
