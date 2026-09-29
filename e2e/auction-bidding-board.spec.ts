import { expect, test } from "@playwright/test";
import { AUCTION_PROMPT, generateApproveAndPlayable, openLobbyCard, shareHrefFromStudio } from "./helpers/sol-max-baseline";

test("auction prompt → lobby → share= guest bid → host pass → award", async ({ page, browser }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const projectId = await generateApproveAndPlayable(page, AUCTION_PROMPT);
  const card = await openLobbyCard(page, projectId);
  await expect(card.locator('[data-lobby-mark="auction"]')).toBeVisible();
  for (const mark of ["catan", "othello", "network", "card"]) {
    await expect(card.locator(`[data-lobby-mark="${mark}"]`)).toHaveCount(0);
  }
  await page.goto(`/chatgpt-plugin/studio/${projectId}`);
  const shareUrl = await shareHrefFromStudio(page);
  expect(new URL(shareUrl).searchParams.get("share")).toBeTruthy();
  const guest = await browser.newContext();
  try {
    const guestPage = await guest.newPage();
    await page.goto(shareUrl);
    await guestPage.goto(shareUrl);
    await guestPage.waitForURL(/\/chatgpt-plugin\/room\//);
    expect(new URL(guestPage.url()).searchParams.get("share")).toBeTruthy();
    await page.getByLabel("你的席位").selectOption("1");
    await guestPage.getByLabel("你的席位").selectOption("0");
    const board = page.getByRole("region", { name: "拍卖竞价桌" });
    const guestBoard = guestPage.getByRole("region", { name: "拍卖竞价桌" });
    await expect(board).toBeVisible();
    await expect(guestBoard).toBeVisible();
    const guestHud = guestBoard.getByRole("region", { name: "拍卖状态" });
    await expect(guestHud).toContainText("轮到座位 0 出价或放弃");
    await expect(guestHud).toContainText("当前出价：0");
    await expect(guestBoard.getByRole("region", { name: "座位筹码与得分" })).toContainText("筹码 20");
    await expect(board.getByRole("button", { name: "出价", exact: true })).toBeDisabled();
    await guestBoard.getByLabel("出价金额").fill("7");
    await guestBoard.getByRole("button", { name: "出价", exact: true }).click();
    await expect(board.getByRole("region", { name: "拍卖状态" })).toContainText("当前出价：7");
    await board.getByRole("button", { name: "放弃" }).click();
    await expect(board.getByRole("region", { name: "拍卖状态" })).toContainText("成交 · 座位 0 获得拍品");
    await expect(guestHud).toContainText("成交 · 座位 0 获得拍品");
    await expect(guestBoard.getByRole("region", { name: "座位筹码与得分" })).toContainText("筹码 13");
    await expect(guestBoard.getByRole("region", { name: "座位筹码与得分" })).toContainText("得分 10");
  } finally {
    await guest.close();
  }
});
