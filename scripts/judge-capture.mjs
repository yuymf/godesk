#!/usr/bin/env node
/**
 * G3D-JUDGE 评审截图（dev tooling；输出不入库）。
 *
 *   node scripts/judge-capture.mjs <round> [--viewports desktop,iphone] [--base URL] [--actions 60]
 *
 * 起本地汐屿（Tidewell）对电脑房间（默认 http://127.0.0.1:8844），确定性流程：固定 prompt →
 * 编译 → 大厅「和电脑对战」→ 0 号席位 → 脚本化行动（优先级策略，同 room-ai-seat e2e）。
 * 每个视口单独开一局（同一 seed，结束时比对棋盘与骰点是否一致，写进 run.json）。
 * 机位：URL 带 `?judge=1` 时 SceneHost 暴露 `__g3dJudge.set(preset)`（src/render3d/judge-camera.ts）；
 * 不带 `perf=1`，评审截图里没有性能浮层。
 *
 * 输出：/workspace/g3d-evidence/judge/round-<N>/tidewell/<vp>-<id>.png（3D 画布）
 *       以及 <vp>-<id>-page.png（整页视口，含 HUD），run.json。
 *   a-default  默认整盘          b-terrain-closeup  地形近景（森林/牧场/山地/麦田）
 *   c-coast    海岸+水+崖壁+港口  d-hand-hud        资源手牌 + HUD（整页）
 *   e-placement 可放置位高亮（布置阶段）  f-dice  掷骰   g-midgame 中局多棋子
 */
import { chromium, devices } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const round = args.find((a) => !a.startsWith("--"));
if (!round) {
  console.error("usage: node scripts/judge-capture.mjs <round> [--viewports desktop,iphone] [--base URL] [--actions N]");
  process.exit(2);
}
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const BASE = opt("base", process.env.JUDGE_BASE_URL || "http://127.0.0.1:8844/chatgpt-plugin");
const VIEWPORTS = opt("viewports", "desktop,iphone").split(",");
const MID_ACTIONS = Number(opt("actions", "60"));
const ROOT = process.env.JUDGE_ROOT || "/workspace/g3d-evidence/judge";
const OUT = path.join(ROOT, `round-${round}`, "tidewell");
const PROMPT = "做一款可以与电脑对战的汐屿基础版";
const { defaultBrowserType: _ignored, ...iphone12Pro } = devices["iPhone 12 Pro"];
void _ignored;
const VP = {
  desktop: { id: "desktop", context: { viewport: { width: 1440, height: 900 } }, mobile: false },
  // iPhone 12 Pro：390×844、DPR 3、isMobile + hasTouch。
  iphone: { id: "iphone", context: { ...iphone12Pro, viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 }, mobile: true },
};

const PRIORITY = [
  [/升级港镇/, 100], [/建造渔村/, 90], [/打出骑士/, 60], [/购买发展卡/, 55], [/铺设栈道/, 50],
  [/打出道路建设/, 45], [/移动雾灯/, 40], [/弃牌/, 38], [/掷骰/, 35], [/银行贸易/, 10], [/结束回合/, 1],
];
const score = (label) => PRIORITY.find(([re]) => re.test(label))?.[1] ?? -1;
const log = (...m) => console.log(`[judge ${new Date().toLocaleTimeString("zh-CN", { hour12: false })}]`, ...m);

async function createProject(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/new`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("textbox", { name: "描述你的游戏想法" }).fill(PROMPT);
  await page.getByRole("button", { name: "生成可玩版本" }).click();
  await page.waitForURL(/\/studio\//, { timeout: 120_000 });
  await page.getByRole("button", { name: "确认玩法并开始试玩" }).click();
  await page.getByRole("heading", { name: "现在就开玩" }).waitFor({ timeout: 120_000 });
  const projectId = new URL(page.url()).pathname.split("/").at(-1);
  await page.close();
  return projectId;
}

async function openAiRoom(page, projectId) {
  await page.goto(`${BASE}/games`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const card = page.locator(".lobby-card").filter({ has: page.locator(`a[href$="/studio/${projectId}"]`) });
  await card.getByRole("button", { name: "和电脑对战" }).click();
  await page.waitForURL(/\/room\//, { timeout: 60_000 });
  const url = new URL(page.url());
  url.searchParams.set("judge", "1");
  await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const seat = page.getByLabel("你的席位");
  await seat.waitFor({ timeout: 60_000 });
  if ((await seat.inputValue().catch(() => "")) !== "0") await seat.selectOption("0");
  const board = page.getByRole("region", { name: "汐屿" });
  await board.waitFor({ timeout: 60_000 });
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="g3d-scene-host"]');
    return el?.getAttribute("data-water") === "on" && typeof globalThis.__g3dJudge?.set === "function";
  }, undefined, { timeout: 90_000 });
  await page.waitForTimeout(2_000);
  return { board, url: url.href };
}

async function settle(page, ms = 1_200) {
  await page.waitForFunction(() => !globalThis.__g3dMotionBusy?.(), undefined, { timeout: 15_000 }).catch(() => null);
  await page.waitForTimeout(ms);
}

async function shot(page, vp, id, preset, files) {
  if (preset) await page.evaluate((p) => globalThis.__g3dJudge.set(p), preset);
  await settle(page);
  const host = page.getByTestId("g3d-scene-host").first();
  await host.scrollIntoViewIfNeeded().catch(() => null);
  await page.waitForTimeout(300);
  const canvas = path.join(OUT, `${vp.id}-${id}.png`);
  const whole = path.join(OUT, `${vp.id}-${id}-page.png`);
  await host.screenshot({ path: canvas, animations: "disabled" });
  await page.screenshot({ path: whole, fullPage: false });
  files.push({ id, preset, canvas, page: whole });
  log(vp.id, id, "→", canvas);
}

async function hudText(board) {
  return (await board.getByRole("region", { name: "对局状态" }).innerText().catch(() => "")).replace(/\s+/g, " ");
}

async function waitMyTurn(page, board, timeoutMs = 60_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const text = await hudText(board);
    if (/对局结束/.test(text)) return "over";
    if (/轮到你行动/.test(text)) return "mine";
    await page.waitForTimeout(250);
  }
  return "timeout";
}

async function clickBest(page, board, vp, filter = null, trades = 0) {
  const drawer = board.locator("details.hex-settlement-board-targets");
  if ((await drawer.count()) && (await drawer.getAttribute("open")) === null) {
    await drawer.locator("summary").click().catch(() => null);
    await page.waitForTimeout(200);
  }
  const buttons = board.getByRole("button");
  const info = await buttons.evaluateAll((els) => els.map((el) => ({ label: (el.textContent || "").trim(), enabled: !el.disabled })));
  let index = -1;
  let best = -1;
  info.forEach((entry, i) => {
    let value = entry.enabled ? score(entry.label) : -1;
    if (filter && !filter.test(entry.label)) value = -1;
    if (value === 10 && trades >= 2) value = -1;
    if (value > best) { index = i; best = value; }
  });
  if (index < 0 || best < 0) return null;
  const button = buttons.nth(index);
  const label = info[index].label;
  try {
    await button.scrollIntoViewIfNeeded({ timeout: 3_000 });
    if (vp.mobile) await button.tap({ timeout: 4_000 });
    else await button.click({ timeout: 4_000 });
  } catch {
    await button.dispatchEvent("click").catch(() => null);
  }
  return label;
}

async function boardState(page) {
  return page.evaluate(() => ({
    numbers: globalThis.__g3dBoardNumbers ?? null,
  }));
}

async function session(page) {
  const roomId = new URL(page.url()).pathname.split("/").filter(Boolean).at(-1);
  const res = await page.request.get(`${BASE.replace(/\/chatgpt-plugin$/, "")}/chatgpt-plugin/api/sessions/${roomId}`).catch(() => null);
  if (!res?.ok()) return null;
  const body = await res.json();
  return {
    acceptedActions: body.acceptedActions?.length ?? null,
    actions: (body.acceptedActions ?? []).map((a) => `${a.seat}:${a.actionId}`),
    status: body.state?.status ?? null,
  };
}

async function runViewport(browser, projectId, vpKey) {
  const vp = VP[vpKey];
  const context = await browser.newContext(vp.context);
  const page = await context.newPage();
  const files = [];
  const { board, url } = await openAiRoom(page, projectId);
  log(vp.id, "room", url);

  // 布置阶段：轮到我放渔村 → 可放置位高亮。
  await waitMyTurn(page, board);
  await shot(page, vp, "e-placement", "a-default", files);

  // 蛇形布置：我 2 次（渔村 + 栈道），电脑自动下。
  for (let i = 0; i < 4; i += 1) {
    if ((await waitMyTurn(page, board, 90_000)) !== "mine") break;
    const label = await clickBest(page, board, vp, /建造渔村|铺设栈道/);
    if (!label) break;
    await page.waitForTimeout(600);
  }
  // 主阶段第一次轮到我（只有「掷骰」合法 → 盘面没有放置高亮环）：整盘 / 地形近景 / 海岸。
  if ((await waitMyTurn(page, board, 90_000)) === "mine") {
    await shot(page, vp, "a-default", "a-default", files);
    await shot(page, vp, "b-terrain-closeup", "b-terrain", files);
    await shot(page, vp, "c-coast", "c-coast", files);
    await page.evaluate(() => globalThis.__g3dJudge.set("a-default"));
  }
  // 掷骰。
  let rolled = false;
  for (let i = 0; i < 6 && !rolled; i += 1) {
    if ((await waitMyTurn(page, board, 90_000)) !== "mine") break;
    const label = await clickBest(page, board, vp, /掷骰/);
    if (label) {
      rolled = true;
      await page.evaluate(() => globalThis.__g3dJudge.set("f-dice"));
      await page.waitForTimeout(650);
      const mid = path.join(OUT, `${vp.id}-f-dice-rolling.png`);
      await page.getByTestId("g3d-scene-host").first().screenshot({ path: mid }).catch(() => null);
      await shot(page, vp, "f-dice", "f-dice", files);
    } else {
      await clickBest(page, board, vp, /建造渔村|铺设栈道|结束回合/);
      await page.waitForTimeout(600);
    }
  }
  // 资源手牌 + HUD：整页（默认机位）。
  await page.evaluate(() => globalThis.__g3dJudge.set("a-default"));
  await settle(page);
  const hand = page.locator(".hex-settlement-hand, [aria-label*='手牌'], [aria-label*='资源']").first();
  if (await hand.count()) await hand.scrollIntoViewIfNeeded().catch(() => null);
  const dHud = path.join(OUT, `${vp.id}-d-hand-hud.png`);
  await page.screenshot({ path: dHud, fullPage: false });
  const dFull = path.join(OUT, `${vp.id}-d-hand-hud-full.png`);
  await page.screenshot({ path: dFull, fullPage: true });
  files.push({ id: "d-hand-hud", canvas: dHud, page: dFull });
  log(vp.id, "d-hand-hud →", dHud);

  // 中局：按优先级策略继续行动。
  let mine = 0;
  let trades = 0;
  const t0 = Date.now();
  while (mine < MID_ACTIONS && Date.now() - t0 < 6 * 60_000) {
    const turn = await waitMyTurn(page, board, 90_000);
    if (turn !== "mine") break;
    const label = await clickBest(page, board, vp, null, trades);
    if (!label) { await page.waitForTimeout(300); continue; }
    if (/银行贸易/.test(label)) trades += 1;
    if (/结束回合/.test(label)) trades = 0;
    mine += 1;
    await page.waitForTimeout(120);
  }
  await shot(page, vp, "g-midgame", "g-midgame", files);
  await shot(page, vp, "g-midgame-default", "a-default", files);

  const state = { ...(await boardState(page)), session: await session(page), humanActions: mine, rolled };
  await context.close();
  return { viewport: vp.id, url, files, state };
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  const projectId = await createProject(browser);
  log("project", projectId);
  const runs = [];
  for (const vpKey of VIEWPORTS) {
    try {
      runs.push(await runViewport(browser, projectId, vpKey));
    } catch (err) {
      runs.push({ viewport: vpKey, error: String(err?.stack ?? err) });
      console.error(vpKey, err);
    }
  }
  const boards = runs.map((r) => JSON.stringify(r.state?.numbers ?? null));
  const deterministicBoard = boards.every((b) => b === boards[0]);
  const prefixes = runs.map((r) => (r.state?.session?.actions ?? []).slice(0, 12).join(","));
  const deterministicSetup = prefixes.every((p) => p === prefixes[0]);
  const out = { round, base: BASE, projectId, at: new Date().toISOString(), deterministicBoard, deterministicSetup, runs };
  await writeFile(path.join(OUT, "run.json"), JSON.stringify(out, null, 2));
  log("wrote", path.join(OUT, "run.json"), { deterministicBoard, deterministicSetup });
  await browser.close();
  if (runs.some((r) => r.error)) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
