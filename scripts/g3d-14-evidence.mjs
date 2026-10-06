#!/usr/bin/env node
/**
 * G3D-14 live-test evidence: generic 3D tabletop for the 4 spatial Kernels
 * (disc-flipping / network-route / worker-placement / harbor-voyage), desktop 1440×900 + iPhone 12 Pro.
 * Playwright headless Chromium + SwiftShader (no GPU on the box). Screenshots and JSON stay out of git.
 * Usage: node scripts/g3d-14-evidence.mjs <out-dir>   (G3D_BASE_URL, default http://127.0.0.1:8833/chatgpt-plugin)
 */
import { chromium, devices } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT = process.argv[2] || "/workspace/g3d-evidence/G3D-14/shots";
const BASE = process.env.G3D_BASE_URL || "http://127.0.0.1:8833/chatgpt-plugin";
const KERNELS = (process.env.G3D_KERNELS || "othello,network,worker,harbor").split(",");
const VIEWPORTS = (process.env.G3D_VIEWPORTS || "desktop,iphone").split(",");
const TIER = process.env.G3D_TIER || "medium";
const { defaultBrowserType: _ignored, ...iphone12Pro } = devices["iPhone 12 Pro"];
void _ignored;

const viewportDefs = {
  desktop: { id: "desktop-1440x900", context: { viewport: { width: 1440, height: 900 } } },
  iphone: { id: "iphone12pro-390x844", context: iphone12Pro },
};

async function generate(page, prompt) {
  await page.goto(`${BASE}/new`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("textbox", { name: "描述你的游戏想法" }).fill(prompt);
  await page.getByRole("button", { name: "生成可玩版本" }).click();
  await page.waitForURL(/\/chatgpt-plugin\/studio\//, { timeout: 120_000 });
  await page.getByRole("button", { name: "确认玩法并开始试玩" }).click();
  await page.getByRole("heading", { name: "现在就开玩" }).waitFor({ timeout: 120_000 });
  const href = await page.getByRole("link", { name: "独立打开这一局" }).getAttribute("href");
  return new URL(href, page.url()).href;
}

async function clickIfEnabled(locator) {
  if ((await locator.count()) && (await locator.isEnabled().catch(() => false))) {
    await locator.dispatchEvent("click");
    return true;
  }
  return false;
}

const SETUPS = {
  othello: {
    async room(page) {
      return generate(page, "做一款可以与电脑对战的黑白棋");
    },
    async advance(page) {
      await page.getByLabel("你的席位").selectOption("0");
      const board = page.getByRole("grid", { name: "黑白棋盘" }).first();
      for (let move = 0; move < 3; move += 1) {
        const cell = board.locator("button.othello-cell.is-legal:not([disabled])").first();
        await cell.waitFor({ timeout: 30_000 }).catch(() => {});
        if (!(await clickIfEnabled(cell))) break;
        await page.waitForTimeout(2_500);
      }
    },
  },
  network: {
    async room(page) {
      return generate(page, "做一款线路网络桌游，玩家铺设路线连接城市");
    },
    async advance(page) {
      await page.getByLabel("你的席位").selectOption("0");
      for (let move = 0; move < 2; move += 1) {
        const edge = page.locator('[aria-label^="可占领"]').first();
        await edge.waitFor({ timeout: 30_000 }).catch(() => {});
        if (!(await clickIfEnabled(edge))) break;
        await page.waitForTimeout(2_500);
      }
    },
  },
  worker: {
    async room(page) {
      await page.goto(`${BASE}/new`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.getByRole("button", { name: "轻桌游" }).click();
      await page.getByRole("button", { name: "生成可玩版本" }).click();
      await page.waitForURL(/\/chatgpt-plugin\/studio\//, { timeout: 120_000 });
      await page.getByRole("button", { name: "确认玩法并开始试玩" }).click();
      await page.getByRole("heading", { name: "现在就开玩" }).waitFor({ timeout: 120_000 });
      const href = await page.getByRole("link", { name: "独立打开这一局" }).getAttribute("href");
      return new URL(href, page.url()).href;
    },
    async advance(page) {
      await page.getByLabel("你的席位").selectOption("0");
      await clickIfEnabled(page.getByRole("button", { name: "放置到资源区" }));
      await page.waitForTimeout(2_500);
    },
  },
  harbor: {
    async room(page) {
      await page.goto(`${BASE}/new`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.getByText("先玩一局现成的").click();
      await page.locator("article").filter({ hasText: "港口十三号" }).getByRole("button", { name: "先玩这一局" }).click();
      await page.waitForURL(/\/chatgpt-plugin\/room\//, { timeout: 90_000 });
      return page.url();
    },
    async advance(page) {
      await page.getByLabel("你的席位").selectOption("0").catch(() => {});
      await clickIfEnabled(page.locator('button[data-target-id="amber"]').first());
      await page.waitForTimeout(2_500);
    },
  },
};

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  const log = { tier: TIER, captures: [] };
  for (const kernel of KERNELS) {
    const setup = SETUPS[kernel];
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const roomUrl = await setup.room(page);
    await page.goto(roomUrl, { waitUntil: "domcontentloaded" });
    await setup.advance(page);
    await page.close();
    for (const vpKey of VIEWPORTS) {
      const vp = viewportDefs[vpKey];
      const context = await browser.newContext(vp.context);
      const p = await context.newPage();
      const consoleLines = [];
      p.on("console", (msg) => {
        if (/godesk\.(tier|pbr)|error|warn/i.test(msg.text())) consoleLines.push(`${msg.type()}: ${msg.text().slice(0, 300)}`);
      });
      const url = new URL(roomUrl);
      url.searchParams.set("tier", TIER);
      url.searchParams.set("perf", "1");
      await p.goto(url.href, { waitUntil: "domcontentloaded", timeout: 60_000 });
      // 以座位 0 视角截图：轮到自己时合法目标提示环可见。
      await p.getByLabel("你的席位").selectOption("0").catch(() => {});
      const stage = p.getByTestId("tabletop-stage").first();
      await stage.waitFor({ timeout: 60_000 });
      await stage.locator("canvas").waitFor({ timeout: 60_000 });
      await p.waitForFunction(() => {
        const host = document.querySelector('[data-testid="tabletop-stage"] [data-testid="g3d-scene-host"]');
        return host && (host.getAttribute("data-pbr") === "512" || host.getAttribute("data-pbr") === "256" || host.getAttribute("data-pbr") === "error");
      }, null, { timeout: 90_000 }).catch(() => {});
      await p.waitForTimeout(2_500);
      await stage.scrollIntoViewIfNeeded();
      // 截图时隐藏 ?perf=1 覆盖层（数据另存 capture-log.json）。
      await p.addStyleTag({ content: '[data-testid="g3d-perf-overlay"]{display:none!important}' });
      const base = `${kernel}-${vp.id}-${TIER}`;
      await stage.screenshot({ path: path.join(OUT, `${base}-stage.png`) });
      await p.screenshot({ path: path.join(OUT, `${base}-page.png`), fullPage: false });
      const info = await p.evaluate(() => {
        const host = document.querySelector('[data-testid="tabletop-stage"] [data-testid="g3d-scene-host"]');
        const perf = window.__godeskPerf?.snapshot?.() ?? null;
        return {
          tier: host?.getAttribute("data-tier"),
          pbr: host?.getAttribute("data-pbr"),
          sceneNodes: host?.getAttribute("data-scene-nodes"),
          canvases: document.querySelectorAll("canvas").length,
          perf,
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        };
      });
      let leak = null;
      if (vpKey === "desktop" && process.env.G3D_LEAK !== "0") {
        // 泄漏：原地重建 10 次，几何 / 纹理回到同档位基线，卸载时残留为 0（与 perf:ci 同口径）。
        for (let index = 0; index < 10; index += 1) {
          await p.evaluate(() => window.__godeskPerf?.remount());
          await p.waitForTimeout(700);
        }
        await p.waitForTimeout(1_500);
        leak = await p.evaluate(() => window.__godeskPerf?.snapshot()?.lifecycle ?? null);
      }
      log.captures.push({ kernel, viewport: vp.id, ...info, leak, console: consoleLines.slice(0, 20) });
      console.log(base, JSON.stringify({
        ...info,
        perf: info.perf ? { tier: info.perf.tier, renderer: info.perf.renderer, rendererPeak: info.perf.rendererPeak, interactiveMs: info.perf.interactiveMs } : null,
      }));
      await context.close();
    }
  }
  await writeFile(path.join(OUT, "capture-log.json"), JSON.stringify(log, null, 2));
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
