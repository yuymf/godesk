import { chromium, expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { AUCTION_PROMPT, openLobbyCard, shareHrefFromStudio } from "./helpers/sol-max-baseline";

const evidenceDir = process.env.GODESK_E2E_EVIDENCE_DIR;

async function evidenceScreenshot(page: import("@playwright/test").Page, name: string) {
  if (!evidenceDir) return;
  await mkdir(evidenceDir, { recursive: true });
  await page.getByRole("region", { name: "拍卖竞价桌" }).screenshot({
    path: `${evidenceDir}/${name}.png`,
  });
}

test("NL auction proposal → playable build → share= guest bid → award", async ({ page, browser }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/chatgpt-plugin/new");
  await page.getByRole("textbox", { name: "描述你的游戏想法" }).fill(AUCTION_PROMPT);
  await page.getByRole("button", { name: "生成可玩版本" }).click();
  await page.waitForURL(/\/chatgpt-plugin\/studio\//, { timeout: 90_000 });
  await expect(page.getByRole("heading", { name: "先看这一局怎么玩" })).toBeVisible({ timeout: 30_000 });
  const projectId = new URL(page.url()).pathname.split("/").at(-1)!;
  const ruleBefore = await (await page.request.get(`/api/projects/${projectId}?view=rule-system`)).json();
  const plan = await (await page.request.get(`/api/projects/${projectId}?view=generation-plan`)).json();
  expect(ruleBefore.generation?.requestedMechanics).toEqual(["auction-bidding"]);
  expect(plan.generationPlan?.proposedRuntime).toMatchObject({
    op: "configure_auction_bidding",
    config: { playerCount: 2 },
  });
  await page.getByRole("button", { name: "确认玩法并开始试玩" }).click();
  await expect(page.getByRole("heading", { name: "现在就开玩" })).toBeVisible({ timeout: 90_000 });
  const ruleAfter = await (await page.request.get(`/api/projects/${projectId}?view=rule-system`)).json();
  expect(ruleAfter.runtimeSupport).toMatchObject({
    status: "executable",
    kernel: { type: "auction-bidding-v1", playerCount: 2 },
  });
  const card = await openLobbyCard(page, projectId);
  await expect(card.locator('[data-lobby-mark="auction"]')).toBeVisible();
  for (const mark of ["catan", "othello", "network", "card"]) {
    await expect(card.locator(`[data-lobby-mark="${mark}"]`)).toHaveCount(0);
  }
  await page.goto(`/chatgpt-plugin/studio/${projectId}`);
  const shareUrl = await shareHrefFromStudio(page);
  expect(new URL(shareUrl).searchParams.get("share")).toBeTruthy();
  const guestBrowser = process.env.GODESK_GUEST_CDP_URL
    ? await chromium.connectOverCDP(process.env.GODESK_GUEST_CDP_URL)
    : browser;
  const guest = await guestBrowser.newContext();
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
    await evidenceScreenshot(guestPage, "auction-guest-hud");
    await expect(board.getByRole("button", { name: "出价", exact: true })).toBeDisabled();
    await guestBoard.getByLabel("出价金额").fill("7");
    await guestBoard.getByRole("button", { name: "出价", exact: true }).click();
    await expect(board.getByRole("region", { name: "拍卖状态" })).toContainText("当前出价：7");
    await expect(guestHud).toContainText("当前出价：7");
    await evidenceScreenshot(guestPage, "auction-guest-bid");
    await board.getByRole("button", { name: "放弃" }).click();
    await expect(board.getByRole("region", { name: "拍卖状态" })).toContainText("成交 · 座位 0 获得拍品");
    await expect(guestHud).toContainText("成交 · 座位 0 获得拍品");
    await expect(guestBoard.getByRole("region", { name: "座位筹码与得分" })).toContainText("筹码 13");
    await expect(guestBoard.getByRole("region", { name: "座位筹码与得分" })).toContainText("得分 10");
    await evidenceScreenshot(guestPage, "auction-guest-award");
  } finally {
    await guest.close();
  }
});
