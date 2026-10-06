import { expect, test } from "@playwright/test";
import { clickTidewellBoardAction, openTidewellBoardTargets } from "./helpers/tidewell-actions";

/** G3D-04 EP-I: iPhone 12 Pro touch emulation can tap a legal action (no HUD/header overlap). */
test("汐屿 room: iPhone 12 Pro touch taps a legal settlement", async ({ browser }) => {
  test.setTimeout(150_000);
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  try {
    await page.goto("/chatgpt-plugin/new");
    await page.getByRole("textbox", { name: "描述你的游戏想法" }).fill("做一款可以与电脑对战的汐屿基础版");
    await page.getByRole("button", { name: "生成可玩版本" }).click();
    await page.waitForURL(/\/chatgpt-plugin\/studio\//, { timeout: 90_000 });
    await page.getByRole("button", { name: "确认玩法并开始试玩" }).click();
    await expect(page.getByRole("heading", { name: "现在就开玩" })).toBeVisible({ timeout: 90_000 });
    const projectId = new URL(page.url()).pathname.split("/").at(-1)!;
    await page.goto("/chatgpt-plugin/games");
    const card = page.locator(".lobby-card").filter({
      has: page.locator(`a[href$="/studio/${projectId}"]`),
    });
    await card.getByRole("link", { name: "继续这一局" }).click();
    await page.waitForURL(/\/chatgpt-plugin\/room\//);
    await page.getByLabel("你的席位").selectOption("0");
    const board = page.getByRole("region", { name: "汐屿" });
    await expect(page.getByRole("img", { name: "汐屿" })).toBeVisible();
    const { openTidewellBoardTargets } = await import("./helpers/tidewell-actions");
    await openTidewellBoardTargets(board);
    await board.getByRole("button", { name: /建造渔村/ }).first().tap({ timeout: 10_000 });
    await expect(board.getByRole("region", { name: "对局状态" })).toContainText("建造渔村");
    await board.getByRole("button", { name: /铺设栈道/ }).first().tap({ timeout: 10_000 });
    await expect(board.getByRole("region", { name: "对局状态" })).toContainText("铺设栈道");
  } finally {
    await ctx.close();
  }
});
