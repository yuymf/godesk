#!/usr/bin/env node
/**
 * G3D-14 follow-ups evidence (before / after): Othello full board draw calls on low / medium,
 * 2D seat chips after configure_render, iPhone 12 Pro horizontal overflow, felt close-ups.
 * Desktop 1440×900 + iPhone 12 Pro, headless Chromium + SwiftShader. Output stays out of git.
 * Usage: node scripts/g3d-14-followups-evidence.mjs <out-dir>   (G3D_ORIGIN, default http://127.0.0.1:8833)
 */
import { chromium, devices } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT = process.argv[2] || "/workspace/g3d-evidence/G3D-14-followups/run";
const ORIGIN = process.env.G3D_ORIGIN || "http://127.0.0.1:8833";
const BASE = `${ORIGIN}/chatgpt-plugin`;
const { defaultBrowserType: _ignored, ...iphone12Pro } = devices["iPhone 12 Pro"];
void _ignored;
const VIEWPORTS = {
  "desktop-1440x900": { viewport: { width: 1440, height: 900 } },
  "iphone12pro-390x844": iphone12Pro,
};

async function api(page, method, url, data) {
  const response = await page.request.fetch(`${ORIGIN}${url}`, { method, data, headers: data ? { "content-type": "application/json" } : undefined });
  if (!response.ok()) throw new Error(`${method} ${url} → ${response.status()} ${await response.text()}`);
  return response.json();
}

async function generate(page) {
  await page.goto(`${BASE}/new`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("textbox", { name: "描述你的游戏想法" }).fill("做一款两人翻转棋");
  await page.getByRole("button", { name: "生成可玩版本" }).click();
  await page.waitForURL(/\/chatgpt-plugin\/studio\//, { timeout: 120_000 });
  const projectId = new URL(page.url()).pathname.split("/").at(-1);
  await page.getByRole("button", { name: "确认玩法并开始试玩" }).click();
  await page.getByRole("heading", { name: "现在就开玩" }).waitFor({ timeout: 120_000 });
  const href = await page.getByRole("link", { name: "独立打开这一局" }).getAttribute("href");
  return { projectId, roomUrl: new URL(href, page.url()).href };
}

/** 两个浏览器上下文各占一个席位，轮流落子 / 停着，把一局翻转棋下到终局（满盘或双方停着）。 */
async function playToEnd(browser, roomUrl, log) {
  const seats = [];
  for (const seat of ["0", "1"]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    await p.goto(roomUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await p.getByRole("region", { name: "黑白棋盘" }).waitFor({ timeout: 60_000 });
    await p.getByLabel("你的席位").selectOption(seat);
    await p.waitForTimeout(600);
    seats.push({ ctx, p, region: p.getByRole("region", { name: "黑白棋盘" }) });
  }
  let idle = 0;
  let moves = 0;
  for (let turn = 0; turn < 200 && idle < 12; turn += 1) {
    const status = (await seats[0].region.locator(".othello-hud-status").innerText().catch(() => "")) || "";
    if (/结束|胜|平局/.test(status)) break;
    const seat = Number(/座位\s*(\d)/.exec(status)?.[1] ?? "0");
    const { p, region } = seats[seat];
    const before = (await region.locator(".othello-hud-last").innerText().catch(() => "")) + status;
    const cell = region.locator("button.othello-cell.is-legal:not([disabled])").first();
    const pass = region.getByRole("button", { name: "停着（无合法落子）" });
    await p.waitForTimeout(120);
    if (await cell.count()) {
      await cell.click();
      moves += 1;
      idle = 0;
    } else if ((await pass.count()) && (await pass.isEnabled())) {
      await pass.click();
      idle += 1;
    } else {
      idle += 1;
      // 席位页偶尔漏掉一次房间推送：连续空转时重载该席位页并重新选座。
      if (idle % 3 === 0) {
        await p.reload({ waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => {});
        await region.waitFor({ timeout: 60_000 }).catch(() => {});
        await p.getByLabel("你的席位").selectOption(String(seat)).catch(() => {});
      }
      await p.waitForTimeout(800);
      continue;
    }
    await seats[0].p.waitForFunction((prev) => {
      const region = document.querySelector('[aria-label="黑白棋盘"]');
      const text = (region?.querySelector(".othello-hud-last")?.textContent ?? "") + (region?.querySelector(".othello-hud-status")?.textContent ?? "");
      return text !== prev;
    }, before, { timeout: 10_000 }).catch(() => {});
  }
  log.moves = moves;
  log.fullBoardDiscs = await seats[0].region.locator(".othello-disc").count();
  log.finalStatus = await seats[0].region.locator(".othello-hud-status").innerText().catch(() => "");
  for (const { p, ctx } of seats) {
    await p.goto("about:blank");
    await ctx.close();
  }
  return log.fullBoardDiscs;
}

async function settle(p) {
  const stage = p.getByTestId("tabletop-stage").first();
  await stage.locator("canvas").waitFor({ timeout: 60_000 });
  await p.waitForFunction(() => {
    const host = document.querySelector('[data-testid="tabletop-stage"] [data-testid="g3d-scene-host"]');
    const pbr = host?.getAttribute("data-pbr");
    return Boolean(host?.getAttribute("data-scene-nodes")) && pbr && pbr !== "pending";
  }, null, { timeout: 90_000 }).catch(() => {});
  await p.waitForTimeout(2_500);
  return stage;
}

async function capture(browser, url, name, { tier, perf = true, extra = "" }, log) {
  const results = {};
  for (const [vpId, context] of Object.entries(VIEWPORTS)) {
    const ctx = await browser.newContext(context);
    const p = await ctx.newPage();
    const target = new URL(url);
    if (tier) target.searchParams.set("tier", tier);
    if (perf) target.searchParams.set("perf", "1");
    for (const [k, v] of new URLSearchParams(extra)) target.searchParams.set(k, v);
    await p.goto(target.href, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const stage = await settle(p);
    await p.addStyleTag({ content: '[data-testid="g3d-perf-overlay"]{display:none!important}' });
    const base = `${name}-${vpId}`;
    await stage.scrollIntoViewIfNeeded();
    const box1 = await stage.boundingBox();
    await p.waitForTimeout(500);
    const box2 = await stage.boundingBox();
    try {
      await stage.screenshot({ path: path.join(OUT, `${base}-stage.png`), timeout: 15_000 });
    } catch {
      // 元素持续不“稳定”时退回整页裁剪（并记录两次包围盒，便于排查布局抖动）。
      if (box2) await p.screenshot({ path: path.join(OUT, `${base}-stage.png`), clip: box2 });
    }
    await p.getByRole("region", { name: "对局状态" }).first().screenshot({ path: path.join(OUT, `${base}-hud.png`) }).catch(() => {});
    await p.screenshot({ path: path.join(OUT, `${base}-page.png`) });
    const info = await p.evaluate(() => {
      const perfSnap = window.__godeskPerf?.snapshot?.() ?? null;
      const swatch = (cls) => {
        const el = document.querySelector(`.othello-disc-swatch.${cls}`);
        return el ? getComputedStyle(el).backgroundColor : null;
      };
      const disc = (cls) => {
        const el = document.querySelector(`.othello-disc.${cls}`);
        return el ? getComputedStyle(el).backgroundImage : null;
      };
      const vw = document.documentElement.clientWidth;
      const overflowing = [...document.querySelectorAll("body *")]
        .filter((el) => el.getBoundingClientRect().right > vw + 0.5)
        .slice(0, 8)
        .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join(".")} right=${el.getBoundingClientRect().right.toFixed(1)}`);
      return {
        perf: perfSnap ? { calls: perfSnap.renderer?.calls, peak: perfSnap.rendererPeak?.calls, triangles: perfSnap.renderer?.triangles, tier: perfSnap.tier } : null,
        sceneNodes: document.querySelector('[data-testid="g3d-scene-host"]')?.getAttribute("data-scene-nodes"),
        pbr: document.querySelector('[data-testid="g3d-scene-host"]')?.getAttribute("data-pbr"),
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: vw,
        overflowing,
        swatches: { seat0: swatch("is-black"), seat1: swatch("is-white") },
        discs: { seat0: disc("is-black"), seat1: disc("is-white") },
      };
    });
    results[vpId] = { ...info, stageBoxes: [box1, box2] };
    await p.goto("about:blank");
    await ctx.close();
  }
  log.captures[name] = results;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const log = { origin: ORIGIN, captures: {} };
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const { projectId, roomUrl } = await generate(page);
  log.projectId = projectId;
  await playToEnd(browser, roomUrl, log);
  await capture(browser, roomUrl, "full-board-low", { tier: "low" }, log);
  await capture(browser, roomUrl, "full-board-medium", { tier: "medium" }, log);

  // configure_render：与 G3D-15 第二刀同一组 patch（水面 + 低太阳 + 酒红 / 金棋子）。
  const patches = [
    { water: { enabled: true, shallow: "#3fa7c9" } },
    { lighting: { sun: { elevationDeg: 18 } } },
    { materials: { seat0: { base: "#7a1f2b", roughness: 0.25, metalness: 0.35 }, seat1: { base: "#e8c35a", roughness: 0.25, metalness: 0.35 } } },
  ];
  for (const [index, patch] of patches.entries()) {
    const { version } = await api(page, "GET", `/api/projects/${projectId}`);
    const response = await page.request.post(`${ORIGIN}/mcp`, {
      headers: { accept: "application/json, text/event-stream", "content-type": "application/json" },
      data: { jsonrpc: "2.0", id: 900 + index, method: "tools/call", params: { name: "apply_project_patch", arguments: {
        projectId, expectedVersion: version, idempotencyKey: `fu-${projectId}-${index}`, operations: [{ op: "configure_render", patch }],
      } } },
    });
    if (!response.ok()) throw new Error(`mcp ${response.status()}`);
  }
  const { version } = await api(page, "GET", `/api/projects/${projectId}`);
  const job = await api(page, "POST", `/api/projects/${projectId}/jobs`, { kind: "compile-build", expectedVersion: version, idempotencyKey: `fu-${projectId}-compile` });
  let done = job;
  for (let i = 0; i < 60 && !/succeeded|failed/.test(done.status); i += 1) {
    await page.waitForTimeout(500);
    done = await api(page, "GET", `/api/jobs/${job.id}`);
  }
  const session = await api(page, "POST", `/api/builds/${done.result.build.id}/sessions`, { seed: 42, idempotencyKey: `fu-${projectId}-session` });
  const recolored = new URL(session.sessionUrl, ORIGIN).href;
  log.recoloredRoom = recolored;
  await capture(browser, recolored, "recolored", { tier: "medium" }, log);
  await capture(browser, recolored, "recolored-pbr-off", { tier: "medium", extra: "pbr=0" }, log);
  await writeFile(path.join(OUT, "capture-log.json"), JSON.stringify(log, null, 2));
  await browser.close();
  console.log(JSON.stringify(log, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
