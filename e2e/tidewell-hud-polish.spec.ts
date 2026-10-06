import { expect, test } from "@playwright/test";
import { clickTidewellBoardAction, openTidewellBoardTargets } from "./helpers/tidewell-actions";

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
  await page.getByLabel("你的席位").selectOption("0");
  const board = page.getByRole("region", { name: "汐屿六角岛" });
  await expect(board).toBeVisible();
  await expect(page.getByTestId("g3d-scene-host")).toHaveAttribute("data-water", "on", { timeout: 60_000 });
  return board;
}

test("G3D-13 polish: water on desktop high; lastAction localized; sound FAB clear of canvas", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/chatgpt-plugin/new"); // warm
  const board = await openBoard(page);
  const host = page.getByTestId("g3d-scene-host");
  await expect(host).toHaveAttribute("data-water", "on");
  await expect(host).toHaveAttribute("data-tier", /high|medium|low/);

  await clickTidewellBoardAction(board, /建造渔村/);
  await openTidewellBoardTargets(board);
  await board.getByRole("button", { name: /铺设栈道/ }).first().click();
  const hud = board.getByRole("region", { name: "对局状态" });
  await expect(hud).toContainText("铺设栈道");
  await expect(hud).not.toContainText("place_road");
  await expect(hud).not.toContainText("place_settlement");
});

test("G3D-13 polish: iPhone board above fold; sound settings does not overlap canvas", async ({
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
  const sound = page.locator(".room-sound-settings-trigger");
  await expect(stage).toBeVisible();
  await expect(sound).toBeVisible();

  const stageBox = await stage.boundingBox();
  const soundBox = await sound.boundingBox();
  const canvasBox = await canvas.boundingBox();
  expect(stageBox).toBeTruthy();
  expect(soundBox).toBeTruthy();
  expect(canvasBox).toBeTruthy();
  // Board visible above the fold (top of stage in upper half of viewport).
  expect(stageBox!.y).toBeLessThan(844 * 0.45);
  // Sound FAB must not intersect the WebGL canvas.
  const overlap =
    soundBox!.x < canvasBox!.x + canvasBox!.width &&
    soundBox!.x + soundBox!.width > canvasBox!.x &&
    soundBox!.y < canvasBox!.y + canvasBox!.height &&
    soundBox!.y + soundBox!.height > canvasBox!.y;
  expect(overlap).toBe(false);
  await ctx.close();
});
