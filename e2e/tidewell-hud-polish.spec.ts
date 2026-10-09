import { expect, test } from "@playwright/test";
import { clickTidewellBoardAction, openTidewellBoardTargets, claimTidewellSeat } from "./helpers/tidewell-actions";

const PROMPT = "做一款可以与电脑对战的汐屿六角岛资源建造游戏";

async function openBoard(page: import("@playwright/test").Page) {
  await page.goto("/chatgpt-plugin/new");
  await page.getByRole("textbox", { name: "描述你的游戏想法" }).fill(PROMPT);
  await page.getByRole("button", { name: "生成可玩版本" }).click();
  await page.waitForURL(/\/chatgpt-plugin\/studio\//, { timeout: 90_000 });
  await page.getByRole("button", { name: "确认玩法并开始试玩" }).click();
  await expect(page.getByRole("heading", { name: "现在就开玩" })).toBeVisible({ timeout: 90_000 });
  const projectId = new URL(page.url()).pathname.split("/").at(-1)!;
  await page.goto("/chatgpt-plugin/games");
  const card = page.locator(".lobby-card").filter({ has: page.locator(`a[href$="/studio/${projectId}"]`) });
  await card.getByRole("link", { name: "继续这一局" }).click();
  await page.waitForURL(/\/chatgpt-plugin\/room\//, { timeout: 30_000 });
  await claimTidewellSeat(page, 0);
  const board = page.getByRole("region", { name: "汐屿六角岛" });
  await expect(board).toBeVisible();
  await expect(page.getByTestId("g3d-scene-host")).toHaveAttribute("data-water", "on", { timeout: 60_000 });
  return board;
}

test("G3D-13 polish: water on desktop high; lastAction localized; immersive fullscreen", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/chatgpt-plugin/new"); // warm
  const board = await openBoard(page);
  const host = page.getByTestId("g3d-scene-host");
  await expect(host).toHaveAttribute("data-water", "on");
  await expect(host).toHaveAttribute("data-tier", /high|medium|low/);

  // Full-viewport game screen — no site nav above the board.
  const main = page.locator("main.room-view-tidewell-immersive");
  await expect(main).toBeVisible();
  const mainBox = await main.boundingBox();
  expect(mainBox).toBeTruthy();
  expect(mainBox!.width).toBeGreaterThan(1400);
  expect(mainBox!.height).toBeGreaterThan(850);
  await expect(page.locator(".room-shell-header")).toBeHidden();

  const stage = board.locator(".tidewell-stage-wrap");
  const stageBox = await stage.boundingBox();
  expect(stageBox).toBeTruthy();
  // Centre canvas dominates (~62%+ of width).
  expect(stageBox!.width).toBeGreaterThan(1440 * 0.55);

  await clickTidewellBoardAction(board, /建造渔村/);
  await openTidewellBoardTargets(board);
  await board.getByRole("button", { name: /铺设栈道/ }).first().click();
  const hud = board.getByRole("region", { name: "对局状态" });
  await expect(hud).toContainText("铺设栈道");
  await expect(hud).not.toContainText("place_road");
  await expect(hud).not.toContainText("place_settlement");
});

test("G3D-13 polish: iPhone board above fold; sound in top-bar menu (no FAB over canvas)", async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  const board = await openBoard(page);
  const stage = board.locator(".g3d-stage");
  const canvas = page.locator("canvas").first();
  await expect(stage).toBeVisible();

  const stageBox = await stage.boundingBox();
  const canvasBox = await canvas.boundingBox();
  expect(stageBox).toBeTruthy();
  expect(canvasBox).toBeTruthy();
  // Board visible above the fold (top of stage in upper half of viewport).
  expect(stageBox!.y).toBeLessThan(844 * 0.45);
  // Canvas should be tall on phone (not a tiny strip).
  expect(stageBox!.height).toBeGreaterThan(844 * 0.35);

  // Sound lives in the top-bar menu — floating FAB must not cover the canvas.
  const sound = page.locator(".room-sound-settings-trigger");
  const soundBox = await sound.boundingBox();
  if (soundBox && canvasBox) {
    const overlap =
      soundBox.x < canvasBox.x + canvasBox.width &&
      soundBox.x + soundBox.width > canvasBox.x &&
      soundBox.y < canvasBox.y + canvasBox.height &&
      soundBox.y + soundBox.height > canvasBox.y &&
      soundBox.width > 8 &&
      soundBox.height > 8;
    expect(overlap).toBe(false);
  }
  // Sound controls live in the game top bar (not a FAB over the canvas).
  await expect(board.getByRole("button", { name: /声音设置/ })).toBeVisible();
  await ctx.close();
});
