import { expect, type Locator, type Page, test } from "@playwright/test";
import { clickTidewellBoardAction, openTidewellBoardTargets, claimTidewellSeat } from "./helpers/tidewell-actions";
import { mkdirSync } from "node:fs";

/**
 * G3D-04b: Room AI seat. One human browser only — seat 1 is "电脑", driven
 * server-side by the DO alarm through the Executable Kernel.
 *
 * - Default CI: the AI seat takes both of its snake-setup turns.
 * - `@slow` (GODESK_E2E_SLOW=1): full game to game over vs the AI seat on
 *   desktop 1440×900 (mouse) and iPhone 12 Pro 390×844 (touch).
 */
const TIDEWELL_PROMPT = "做一款可以与电脑对战的汐屿基础版";

async function openAiRoom(page: Page) {
  await page.goto("/chatgpt-plugin/new");
  await page.getByRole("textbox", { name: "描述你的游戏想法" }).fill(TIDEWELL_PROMPT);
  await page.getByRole("button", { name: "生成可玩版本" }).click();
  await page.waitForURL(/\/chatgpt-plugin\/studio\//, { timeout: 90_000 });
  await page.getByRole("button", { name: "确认玩法并开始试玩" }).click();
  await expect(page.getByRole("heading", { name: "现在就开玩" })).toBeVisible({ timeout: 90_000 });
  const projectId = new URL(page.url()).pathname.split("/").at(-1)!;
  await page.goto("/chatgpt-plugin/games");
  const card = page.locator(".lobby-card").filter({ has: page.locator(`a[href$="/studio/${projectId}"]`) });
  await card.getByRole("button", { name: "和电脑对战" }).click();
  await page.waitForURL(/\/chatgpt-plugin\/room\//, { timeout: 30_000 });
  const menu = page.locator("details.tidewell-menu");
  await menu.locator("summary").click();
  await expect(menu).toHaveAttribute("open", "", { timeout: 5_000 });
  const seatSelect = page.getByLabel("你的席位");
  await expect(seatSelect).toBeVisible({ timeout: 10_000 });
  await expect(seatSelect.locator("option[value='1']")).toHaveText(/电脑/);
  await expect(seatSelect.locator("option[value='1']")).toHaveAttribute("disabled", "");
  await seatSelect.selectOption("0");
  const board = page.getByRole("region", { name: "汐屿" });
  await expect(page.getByRole("img", { name: "汐屿" })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("canvas")).toHaveCount(1, { timeout: 30_000 });
  await expect(board.locator(".tidewell-player-card").filter({ hasText: "电脑" })).toHaveCount(1);
  return board;
}

function roomId(page: Page) {
  return new URL(page.url()).pathname.split("/").filter(Boolean).at(-1)!;
}

async function sessionActions(page: Page) {
  const response = await page.request.get(`/api/sessions/${roomId(page)}`);
  expect(response.ok()).toBe(true);
  const session = await response.json() as {
    aiSeats?: number[];
    acceptedActions: Array<{ seat: number; actionId: string; intentId: string; sequence: number }>;
    state: { status: string; winnerSeat: number | null };
  };
  return session;
}

test("G3D-04b · AI seat takes its setup turns (single human browser)", async ({ browser }) => {
  test.setTimeout(240_000);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const board = await openAiRoom(page);
  const hud = board.getByRole("region", { name: "对局状态" });
  await expect(hud).toContainText("轮到你行动");
  await clickTidewellBoardAction(board, /建造渔村/);
  await openTidewellBoardTargets(board);
  await board.getByRole("button", { name: /铺设栈道/ }).first().click();
  // Snake setup 0, 1, 1, 0 — the computer plays both of its turns by itself.
  await expect(hud).toContainText("电脑思考中", { timeout: 15_000 });
  await expect(hud).toContainText("轮到你行动", { timeout: 30_000 });
  const session = await sessionActions(page);
  expect(session.aiSeats).toEqual([1]);
  const ai = session.acceptedActions.filter((action) => action.seat === 1);
  expect(ai.map((action) => action.actionId)).toEqual([
    "place_settlement", "place_road", "place_settlement", "place_road",
  ]);
  for (const action of ai) expect(action.intentId).toBe(`ai_${action.sequence}`);
  // G3D-13 evidence (outside repo): one-browser vs Room AI mid-setup
  const evidenceDir = process.env.GODESK_EVIDENCE_DIR;
  if (evidenceDir) {
    mkdirSync(evidenceDir, { recursive: true });
    await page.screenshot({ path: `${evidenceDir}/desktop-vs-room-ai-midgame.png`, fullPage: false });
    await page.getByTestId("g3d-scene-host").screenshot({ path: `${evidenceDir}/desktop-vs-room-ai-canvas.png` }).catch(() => null);
  }
  await ctx.close();
});

const PRIORITY: Array<[RegExp, number]> = [
  [/升级港镇/, 100], [/建造渔村/, 90], [/打出骑士/, 60], [/购买发展卡/, 55], [/铺设栈道/, 50],
  [/打出道路建设/, 45], [/移动雾灯/, 40], [/弃牌/, 38], [/掷骰/, 35], [/银行贸易/, 10], [/结束回合/, 1],
];
const score = (label: string) => PRIORITY.find(([re]) => re.test(label))?.[1] ?? -1;

async function bestButton(board: Locator, trades: number) {
  const buttons = board.getByRole("button");
  const info = await buttons.evaluateAll((elements) =>
    elements.map((element) => ({
      label: (element.textContent || "").trim(),
      enabled: !(element as HTMLButtonElement).disabled,
    })));
  let index = -1;
  let best = -1;
  info.forEach((entry, i) => {
    let value = entry.enabled ? score(entry.label) : -1;
    if (value === 10 && trades >= 2) value = -1;
    if (value > best) { index = i; best = value; }
  });
  return { button: index >= 0 ? buttons.nth(index) : null, value: best };
}

for (const mobile of [false, true]) {
  const tag = mobile ? "ep-i-iphone12pro-390x844" : "ep-d-desktop-1440x900";
  test(`G3D-04b @slow · full game vs AI seat · ${tag}`, async ({ browser }, testInfo) => {
    test.setTimeout(3_600_000);
    const out = process.env.GODESK_EVIDENCE_DIR ?? testInfo.outputPath("evidence");
    mkdirSync(out, { recursive: true });
    const ctx = await browser.newContext(mobile
      ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
      : { viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const board = await openAiRoom(page);
    const hud = board.getByRole("region", { name: "对局状态" });
    const img = page.getByRole("img", { name: "汐屿" });
    await expect(page.locator("svg polygon")).toHaveCount(0);
    await page.screenshot({ path: `${out}/${tag}-start.png` });
    let mine = 0;
    let trades = 0;
    let idle = 0;
    let sawAiThinking = false;
    const t0 = Date.now();
    for (let step = 0; step < 40_000; step += 1) {
      const text = (await hud.innerText()).replace(/\s+/g, " ");
      if (/对局结束/.test(text)) {
        await page.waitForTimeout(1_000);
        await img.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${out}/${tag}-winner.png` });
        await page.screenshot({ path: `${out}/${tag}-winner-full.png`, fullPage: true });
        const session = await sessionActions(page);
        const ai = session.acceptedActions.filter((action) => action.seat === 1);
        const kinds = [...new Set(ai.map((action) => action.actionId))].sort();
        console.log(`[${tag}] GAME_OVER human(${mobile ? "tap" : "click"})=${mine} ai=${ai.length} total=${session.acceptedActions.length} in ${Math.round((Date.now() - t0) / 1000)}s winner=${session.state.winnerSeat} aiKinds=${kinds.join(",")} :: ${text}`);
        expect(session.state.status).toBe("complete");
        expect(sawAiThinking).toBe(true);
        expect(ai.length).toBeGreaterThan(20);
        for (const action of ai) expect(action.intentId).toBe(`ai_${action.sequence}`);
        // No double moves: sequences strictly increase by one.
        session.acceptedActions.forEach((action, i) => expect(action.sequence).toBe(i + 1));
        await ctx.close();
        return;
      }
      if (!/轮到你行动/.test(text)) {
        if (/电脑思考中/.test(text)) sawAiThinking = true;
        trades = 0;
        idle += 1;
        if (idle > 600) {
          await page.screenshot({ path: `${out}/${tag}-stuck.png` });
          throw new Error(`${tag}: AI seat stalled :: ${text}`);
        }
        await page.waitForTimeout(150);
        continue;
      }
      const { button, value } = await bestButton(board, trades);
      if (!button || value < 0) {
        idle += 1;
        if (idle > 600) throw new Error(`${tag}: no legal button :: ${text}`);
        await page.waitForTimeout(150);
        continue;
      }
      idle = 0;
      try {
        await button.scrollIntoViewIfNeeded({ timeout: 3_000 });
        if (mobile) await button.tap({ timeout: 4_000 });
        else await button.click({ timeout: 4_000 });
        mine += 1;
        if (value === 10) trades += 1;
      } catch {
        await page.waitForTimeout(150);
        continue;
      }
      await page.waitForTimeout(80);
      if (mine === 2 || mine % 50 === 0) {
        await img.scrollIntoViewIfNeeded().catch(() => undefined);
        await page.screenshot({ path: `${out}/${tag}-mid-${String(mine).padStart(4, "0")}.png` });
        console.log(`[${tag}] human=${mine} t=${Math.round((Date.now() - t0) / 1000)}s HUD=${text.slice(0, 160)}`);
      }
    }
    throw new Error(`${tag}: no game over within step budget`);
  });
}
