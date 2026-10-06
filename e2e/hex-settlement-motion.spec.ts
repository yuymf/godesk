import { expect, type Browser, type Locator, type Page, test } from "@playwright/test";

/**
 * G3D-09: motion durations (place 280 / dice 900 / turn camera 600), reduced motion → 0 ms,
 * and input is not lost while a tween is in flight.
 * Seat 1 is a second browser context on the same share link (rooms have no in-room bot).
 */
type MotionEntry = { kind: string; id: string; durationMs: number; reduced: boolean };
const CATAN_PROMPT = "做一款可以与电脑对战的卡坦岛基础版";

async function openRoom(page: Page) {
  await page.goto("/chatgpt-plugin/new");
  await page.getByRole("textbox", { name: "描述你的游戏想法" }).fill(CATAN_PROMPT);
  await page.getByRole("button", { name: "生成可玩版本" }).click();
  await page.waitForURL(/\/chatgpt-plugin\/studio\//, { timeout: 90_000 });
  await page.getByRole("button", { name: "确认玩法并开始试玩" }).click();
  await expect(page.getByRole("heading", { name: "现在就开玩" })).toBeVisible({ timeout: 90_000 });
  const projectId = new URL(page.url()).pathname.split("/").at(-1)!;
  await page.goto("/chatgpt-plugin/games");
  const card = page.locator(".lobby-card").filter({ has: page.locator(`a[href$="/studio/${projectId}"]`) });
  await card.getByRole("link", { name: "继续这一局" }).click();
  await page.waitForURL(/\/chatgpt-plugin\/room\//, { timeout: 30_000 });
  await page.getByLabel("你的席位").selectOption("0");
  const board = page.getByRole("region", { name: "卡坦六角岛" });
  await expect(page.getByRole("img", { name: "卡坦六角岛" })).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1, { timeout: 30_000 });
  // G3D-08: wait for tide-water mount+shader warm so cold compile does not eat the mid-tween click budget.
  await expect(page.getByTestId("g3d-scene-host")).toHaveAttribute("data-water", "on", { timeout: 60_000 });
  return board;
}

async function joinSeat1(browser: Browser, url: string, reducedMotion: "reduce" | "no-preference") {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion });
  const page = await ctx.newPage();
  await page.goto(url);
  await page.getByLabel("你的席位").selectOption("1");
  const board = page.getByRole("region", { name: "卡坦六角岛" });
  await expect(board).toBeVisible({ timeout: 30_000 });
  return { ctx, page, board };
}

const motionLog = (page: Page) =>
  page.evaluate(() => ((globalThis as { __g3dMotionLog?: MotionEntry[] }).__g3dMotionLog ?? []).slice());

async function setupTurn(board: Locator) {
  await board.getByRole("button", { name: /放置定居点/ }).first().click();
  await board.getByRole("button", { name: /放置道路/ }).first().click();
}

for (const mode of ["no-preference", "reduce"] as const) {
  test(`G3D-09 motion · reducedMotion=${mode}`, async ({ browser }) => {
    test.setTimeout(240_000);
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: mode });
    const page = await ctx.newPage();
    const board = await openRoom(page);
    const hud = board.getByRole("region", { name: "对局状态" });
    const reduced = mode === "reduce";

    // Input during animation: settlement place starts a 280 ms tween; the road
    // click lands immediately (well inside the tween) and must still be applied.
    await board.getByRole("button", { name: /放置定居点/ }).first().click();
    const road = board.getByRole("button", { name: /放置道路/ }).first();
    await road.waitFor({ state: "visible" });
    const tPlace = await page.evaluate(() => performance.now());
    // dispatchEvent: intentional mid-tween input (placement 280 ms); avoids Playwright hit-check flakes while the canvas keeps redrawing waves.
    await road.dispatchEvent("click");
    const tRoad = await page.evaluate(() => performance.now());
    await expect(hud).toContainText("place_road");
    if (!reduced) expect(tRoad - tPlace).toBeLessThan(1_500);

    const opp = await joinSeat1(browser, page.url(), mode);
    // Setup snake order for 2 seats: 0, 1, 1, 0.
    await setupTurn(opp.board);
    await setupTurn(opp.board);
    await expect(hud).toContainText("轮到你行动", { timeout: 20_000 });
    await setupTurn(board);
    await expect(hud).toContainText("掷骰", { timeout: 20_000 });
    await board.getByRole("button", { name: /掷骰/ }).first().click();
    await expect(hud).toContainText(/骰子 \d \+ \d/, { timeout: 20_000 });
    await page.waitForTimeout(1_200);

    const log = await motionLog(page);
    const byKind = (kind: string) => log.filter((entry) => entry.kind === kind);
    expect(byKind("place").length).toBeGreaterThanOrEqual(4);
    expect(byKind("dice").length).toBeGreaterThanOrEqual(1);
    expect(byKind("camera").length).toBeGreaterThanOrEqual(1);
    if (reduced) {
      for (const entry of log) {
        expect(entry.durationMs, `${entry.kind}:${entry.id}`).toBe(0);
        expect(entry.reduced).toBe(true);
      }
    } else {
      for (const entry of byKind("place")) expect(entry.durationMs).toBe(280);
      for (const entry of byKind("dice")) expect(entry.durationMs).toBe(900);
      // Camera may be skipped by the 3 s drag grace only when the user dragged; here it runs.
      for (const entry of byKind("camera")) expect(entry.durationMs).toBe(600);
    }
    console.log(`[G3D-09 ${mode}] motion log`, JSON.stringify(log.map((e) => `${e.kind}:${e.durationMs}`)));
    await opp.ctx.close();
    await ctx.close();
  });
}
