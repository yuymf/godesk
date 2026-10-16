import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const BASE = process.env.GODESK_BASE ?? "http://127.0.0.1:8799";
const OUT = "/workspace/g3d-evidence/godesk-2026-10-13/tide-arena/trajectory/kernel-generalize";
const PROMPT0 = "做一款赛博机甲自走棋，两人商店买棋上阵自动打架";
const STEPS = [
  { id: "theme", prompt: "换成熔岩主题" },
  { id: "model", prompt: "给钻头机兵换机器人模型" },
  { id: "board", prompt: "棋盘改成8列" },
];

function dig(obj, key, d = 0) {
  if (!obj || typeof obj !== "object" || d > 12) return undefined;
  if (Object.hasOwn(obj, key)) return obj[key];
  for (const v of Object.values(obj)) {
    const f = dig(v, key, d + 1);
    if (f !== undefined) return f;
  }
  return undefined;
}

async function iterate(page, projectId, prompt) {
  await page.goto(`${BASE}/chatgpt-plugin/studio/${projectId}`);
  await page.locator("#iteration-prompt").fill(prompt);
  await page.getByRole("button", { name: /改下一版并试玩/ }).click();
  for (let i = 0; i < 120; i++) {
    if (!(await page.getByRole("button", { name: /正在改下一版/ }).count())) break;
    await page.waitForTimeout(1000);
  }
  console.log("[iterate]", prompt);
}

async function fillBoard(page, board, n) {
  await page.waitForFunction(() => Boolean(window.__tideArena), null, { timeout: 60_000 });
  let placed = 0;
  for (let attempt = 0; attempt < 28 && placed < n; attempt++) {
    const cards = board.locator(".tide-arena-card:enabled");
    if (!(await cards.count())) {
      const refresh = board.getByRole("button", { name: "刷新" });
      if (await refresh.isEnabled().catch(() => false)) await refresh.click();
      await page.waitForTimeout(350);
      continue;
    }
    await cards.nth(0).click();
    await page.waitForTimeout(280);
    const from = await page.evaluate(() => window.__tideArena.screenOf({ kind: "bench", benchIndex: 0 }));
    const to = await page.evaluate((i) => window.__tideArena.screenOf({ kind: "cell", boardIndex: i }), placed);
    if (from?.x && to?.x) {
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(to.x, to.y, { steps: 6 });
      await page.mouse.up();
      placed += 1;
      await page.waitForTimeout(220);
    }
  }
  return placed;
}

const log = [];
const browser = await chromium.launch({ headless: true });
const host = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const guest = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await mkdir(OUT, { recursive: true });

try {
  await host.goto(`${BASE}/chatgpt-plugin/new`);
  await host.getByRole("textbox", { name: "描述你的游戏想法" }).fill(PROMPT0);
  await host.getByRole("button", { name: "生成可玩版本" }).click();
  await host.waitForURL(/\/chatgpt-plugin\/studio\//, { timeout: 180_000 });
  const projectId = new URL(host.url()).pathname.split("/").at(-1);
  console.log("[project]", projectId);
  await host.getByRole("button", { name: "确认玩法并开始试玩" }).click();
  await host.getByRole("heading", { name: "现在就开玩" }).waitFor({ timeout: 180_000 });
  await host.screenshot({ path: join(OUT, "01-studio-cyber.png") });

  const rule0 = await (await host.request.get(`${BASE}/api/projects/${projectId}?view=rule-system`)).json();
  const cold = {
    branding: dig(rule0, "branding"),
    theme: dig(rule0, "theme"),
    traitLabels: (dig(rule0, "traits") ?? []).map((t) => t.label),
    sampleUnits: (dig(rule0, "units") ?? []).slice(0, 4).map((u) => u.name),
  };
  log.push({ id: "cold-start", ...cold });
  await writeFile(join(OUT, "cold-start-kernel.json"), JSON.stringify({
    branding: cold.branding, theme: cold.theme, traits: dig(rule0, "traits"), units: dig(rule0, "units"),
  }, null, 2));
  console.log("[cold]", JSON.stringify(cold));
  if (cold.traitLabels.includes("潮汐") || cold.traitLabels.includes("珊瑚咒")) {
    throw new Error("tide traits in cyber cold-start");
  }
  if (cold.branding?.title !== "机甲自走棋") throw new Error("branding " + JSON.stringify(cold.branding));

  for (const s of STEPS) {
    await iterate(host, projectId, s.prompt);
    const rule = await (await host.request.get(`${BASE}/api/projects/${projectId}?view=rule-system`)).json();
    const units = dig(rule, "units") ?? [];
    const snap = {
      id: s.id,
      prompt: s.prompt,
      branding: dig(rule, "branding"),
      theme: dig(rule, "theme"),
      tuning: dig(rule, "tuning"),
      modelRefs: units.filter((u) => u.modelRef).map((u) => ({ id: u.id, name: u.name, modelRef: u.modelRef })),
      unsupported: dig(rule, "unsupported"),
      traitLabels: (dig(rule, "traits") ?? []).map((t) => t.label),
    };
    log.push(snap);
    await writeFile(join(OUT, `${s.id}.json`), JSON.stringify(snap, null, 2));
    await host.screenshot({ path: join(OUT, `02-${s.id}-studio.png`) });
    console.log("[ok]", JSON.stringify({ id: snap.id, theme: snap.theme, tuning: snap.tuning, modelRefs: snap.modelRefs }));
  }

  const themeStep = log.find((x) => x.id === "theme");
  const modelStep = log.find((x) => x.id === "model");
  const boardStep = log.find((x) => x.id === "board");
  if (themeStep?.theme?.preset !== "ember") throw new Error("theme not ember");
  if (!modelStep?.modelRefs?.length) throw new Error("no modelRef: " + JSON.stringify(modelStep?.unsupported)?.slice(0, 400));
  if (boardStep?.tuning?.boardCols !== 8) throw new Error("boardCols not 8");

  const sessions = await (await host.request.get(`${BASE}/api/projects/${projectId}?view=sessions`)).json();
  const u = new URL(sessions.sessions.at(-1).sessionUrl, BASE);
  u.searchParams.set("tier", "high");
  const room = u.toString();
  await Promise.all([host.goto(room), guest.goto(room)]);
  await host.waitForTimeout(1200);
  await guest.getByLabel("你的席位").selectOption("0");
  await host.getByLabel("你的席位").selectOption("1");

  const gBoard = guest.getByRole("region", { name: /对局/ });
  const hBoard = host.getByRole("region", { name: /对局/ });
  await gBoard.waitFor({ timeout: 90_000 });
  await hBoard.waitFor({ timeout: 90_000 });

  const ownAnchors = await guest.locator('.ta-anchor[data-half="own"]').count();
  console.log("[anchors own]", ownAnchors);
  if (ownAnchors !== 16) throw new Error(`own anchors ${ownAnchors} want 16`);

  await guest.screenshot({ path: join(OUT, "03-room-shop.png") });
  const brandText = await guest.locator(".ta-brand").first().textContent();
  const dataTheme = await guest.locator("[data-theme]").first().getAttribute("data-theme");

  const gp = await fillBoard(guest, gBoard, 3);
  console.log("[guest placed]", gp);
  await gBoard.getByRole("button", { name: /准备完毕/ }).click();
  await host.waitForTimeout(800);
  const hp = await fillBoard(host, hBoard, 3);
  console.log("[host placed]", hp);
  if (gp < 1 || hp < 1) throw new Error(`placed guest=${gp} host=${hp}`);
  await hBoard.getByRole("button", { name: /准备完毕/ }).click();
  await guest.screenshot({ path: join(OUT, "04-room-place.png") });

  await guest.waitForTimeout(600);
  const gLock = gBoard.getByRole("button", { name: /锁定阵容|准备完毕/ });
  const hLock = hBoard.getByRole("button", { name: /锁定阵容|准备完毕/ });
  if (await gLock.isEnabled().catch(() => false)) await gLock.click();
  await host.waitForTimeout(400);
  if (await hLock.isEnabled().catch(() => false)) await hLock.click();
  console.log("[locked]");

  await guest.waitForFunction(
    () => {
      const r = document.querySelector("[data-replay]")?.getAttribute("data-replay");
      return r === "playing" || r === "done";
    },
    null,
    { timeout: 90_000 },
  );
  await guest.waitForTimeout(800);
  await guest.screenshot({ path: join(OUT, "05-room-combat.png") });
  await guest.screenshot({ path: join(OUT, "06-theme-ember-room.png") });

  // Model evidence: unit with modelRef should be on board; studio already has kernel json
  await writeFile(join(OUT, "log.json"), JSON.stringify({
    ok: true,
    projectId,
    brandText,
    dataTheme,
    anchorsOwn: ownAnchors,
    placed: { guest: gp, host: hp },
    log,
  }, null, 2));
  console.log(JSON.stringify({ ok: true, projectId, brandText, dataTheme, anchorsOwn: ownAnchors }, null, 2));
} catch (e) {
  console.error("FAIL", e);
  await host.screenshot({ path: join(OUT, "error.png") }).catch(() => {});
  await writeFile(join(OUT, "log.json"), JSON.stringify({ error: String(e), log }, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}
