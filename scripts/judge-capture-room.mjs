#!/usr/bin/env node
/**
 * step3 · 通用 Room 评审截图（dev tooling；输出不入库）。judge-capture.mjs 只认汐屿；
 * 这里吃任意 Shared Session URL（例如插件 MCP `create_shared_session` 返回的 sessionUrl），
 * 入座 0 号席位、按托盘里第一个可用行动走几步，再按同名机位出图，供 judge-compose 并排。
 *
 *   node scripts/judge-capture-room.mjs --room <sessionUrl> --out <dir> [--moves 2] [--viewports desktop]
 *
 * 输出：<out>/<vp>-a-default(-page).png、<vp>-b-terrain-closeup(-page).png、<vp>-d-hand-hud.png、run.json
 * 机位：`?judge=1` 下 SceneHost 暴露 `__g3dJudge.set(preset)`（正交桌面：a = 整盘，b = 棋子最密一簇近景）。
 */
import { chromium, devices } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const ROOM = opt("room");
const OUT = opt("out");
if (!ROOM || !OUT) {
  console.error("usage: node scripts/judge-capture-room.mjs --room <sessionUrl> --out <dir> [--moves N] [--viewports desktop,iphone]");
  process.exit(2);
}
const MOVES = Number(opt("moves", "2"));
const { defaultBrowserType: _ignored, ...iphone12Pro } = devices["iPhone 12 Pro"];
void _ignored;
const VP = {
  desktop: { id: "desktop", context: { viewport: { width: 1440, height: 900 } } },
  iphone: { id: "iphone", context: { ...iphone12Pro, viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 } },
};
const log = (...m) => console.log(`[room-judge ${new Date().toLocaleTimeString("zh-CN", { hour12: false })}]`, ...m);

async function settle(page, ms = 1_500) {
  await page.waitForFunction(() => !globalThis.__g3dMotionBusy?.(), undefined, { timeout: 15_000 }).catch(() => null);
  await page.waitForTimeout(ms);
}

async function shot(page, vp, id, preset, files) {
  if (preset) await page.evaluate((p) => globalThis.__g3dJudge.set(p), preset);
  await settle(page);
  const host = page.getByTestId("g3d-scene-host").first();
  const canvas = path.join(OUT, `${vp.id}-${id}.png`);
  const whole = path.join(OUT, `${vp.id}-${id}-page.png`);
  await page.screenshot({ path: whole, fullPage: false, timeout: 120_000 });
  await host.screenshot({ path: canvas, animations: "disabled", timeout: 120_000 });
  files.push({ id, preset, canvas, page: whole });
  log(vp.id, id, "→", whole);
}

async function myTurn(page) {
  return page.locator(".tabletop-action-row button:not([disabled])").count();
}

async function run(browser, key) {
  const vp = VP[key];
  const context = await browser.newContext(vp.context);
  const page = await context.newPage();
  const url = new URL(ROOM);
  url.searchParams.set("judge", "1");
  await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const menu = page.locator("details.tidewell-menu");
  await menu.locator("summary").click();
  const seat = page.getByLabel("你的席位");
  await seat.waitFor({ state: "visible", timeout: 60_000 });
  if ((await seat.inputValue().catch(() => "")) !== "0") await seat.selectOption("0");
  await menu.locator("summary").click().catch(() => null);
  await page.waitForFunction(() => typeof globalThis.__g3dJudge?.set === "function"
    && document.querySelector('[data-testid="g3d-scene-host"]')?.dataset.tabletopCamera, undefined, { timeout: 90_000 });
  await page.waitForTimeout(2_500);
  const actions = [];
  for (let i = 0; i < MOVES; i += 1) {
    const t0 = Date.now();
    while (Date.now() - t0 < 60_000 && (await myTurn(page)) === 0) await page.waitForTimeout(300);
    const buttons = page.locator(".tabletop-action-row button:not([disabled])");
    const n = await buttons.count();
    if (!n) break;
    // 确定性：取中间一段（避免总铺同一侧），两个视口同 seed 同选择。
    const pick = buttons.nth(Math.floor(n / 2));
    actions.push((await pick.innerText()).replace(/\s+/g, " "));
    await pick.click();
    await page.waitForTimeout(1_200);
  }
  // 等电脑走完，回到我的回合（盘面上有合法虚线高亮）。
  const t1 = Date.now();
  while (Date.now() - t1 < 60_000 && (await myTurn(page)) === 0) await page.waitForTimeout(300);
  const files = [];
  await shot(page, vp, "a-default", "a-default", files);
  await shot(page, vp, "b-terrain-closeup", "b-terrain", files);
  await page.evaluate(() => globalThis.__g3dJudge.set("a-default"));
  await settle(page);
  const dHud = path.join(OUT, `${vp.id}-d-hand-hud.png`);
  await page.screenshot({ path: dHud, fullPage: false });
  files.push({ id: "d-hand-hud", page: dHud });
  log(vp.id, "d-hand-hud →", dHud);
  const camera = await page.getByTestId("g3d-scene-host").first().getAttribute("data-tabletop-camera");
  const hud = (await page.locator(".tidewell-topbar").innerText().catch(() => "")).replace(/\s+/g, " ");
  await context.close();
  return { viewport: vp.id, url: url.href, actions, camera, hud, files };
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const runs = [];
for (const key of opt("viewports", "desktop").split(",")) {
  try {
    runs.push(await run(browser, key));
  } catch (err) {
    runs.push({ viewport: key, error: String(err?.stack ?? err) });
    console.error(key, err);
  }
}
await writeFile(path.join(OUT, "run.json"), JSON.stringify({ room: ROOM, at: new Date().toISOString(), runs }, null, 2));
await browser.close();
if (runs.some((r) => r.error)) process.exit(1);
