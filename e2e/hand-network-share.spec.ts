import { expect, type Browser, test } from "@playwright/test";
import {
  CARD_AREA_PROMPT,
  NETWORK_PROMPT,
  generateApproveAndPlayable,
  openLobbyCard,
  shareHrefFromStudio,
} from "./helpers/sol-max-baseline";

/**
 * PR15 — share= guest join for hand-play + network-route (align #82 / PR10).
 * Host: 一句话生成 → lobby thumb → mint share=.
 * Guest: second context opens share= → claim seat → one legal act → HUD updates.
 */

async function guestJoinClaimAndAct(
  browser: Browser,
  shareUrl: string,
  genre: "hand-play" | "network",
) {
  const guest = await browser.newContext();
  try {
    const page = await guest.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(shareUrl);
    await page.waitForURL(/\/chatgpt-plugin\/room\//, { timeout: 30_000 });
    expect(new URL(page.url()).searchParams.get("share")).toBeTruthy();

    await page.getByLabel("你的席位").selectOption("0");

    if (genre === "hand-play") {
      const board = page.getByRole("region", { name: "手牌与出牌区" });
      await expect(board).toBeVisible();
      const hud = board.getByRole("region", { name: "对局状态" });
      await expect(hud).toContainText("轮到你出牌");
      const playButton = page.getByRole("button", { name: /打出 / });
      await expect.poll(async () => playButton.count()).toBeGreaterThan(0);
      await playButton.first().click();
      await expect(board).toContainText(/座位 0 打出/);
      await expect(hud).toContainText("最近打出");
      await expect(hud.getByLabel("分数")).toContainText(/座位 0 · [1-9]/);
    } else {
      const board = page.getByRole("region", { name: "线路网络盘" });
      await expect(board).toBeVisible();
      const hud = board.getByRole("region", { name: "对局状态" });
      await expect(hud).toContainText("轮到你铺线");
      const legal = board.locator('[aria-label^="可占领"]');
      await expect.poll(async () => legal.count()).toBeGreaterThan(0);
      await legal.first().click();
      await expect(hud).toContainText("最近占领");
      await expect(board.getByLabel("已铺路线")).toContainText(/座位 0 · [1-9]/);
      await expect(board.getByLabel("枢纽")).toBeVisible();
      await expect(board.getByLabel("连通进度")).toBeVisible();
    }
  } finally {
    await guest.close();
  }
}

test.describe("PR15 share= hand-play + network guest join", () => {
  test("卡牌区域控制: 一句话生成 → lobby thumb → share= guest claim + play", async ({
    page,
    browser,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });

    let shareUrl = "";
    let projectId = "";
    await test.step("一句话生成 + approve → playable + lobby card thumb", async () => {
      projectId = await generateApproveAndPlayable(page, CARD_AREA_PROMPT);
      const card = await openLobbyCard(page, projectId);
      await expect(card.locator('[data-lobby-mark="card"]')).toBeVisible();
      await expect(card.locator('[data-lobby-mark="network"]')).toHaveCount(0);
      await page.goto(`/chatgpt-plugin/studio/${projectId}`);
      await expect(page.getByRole("heading", { name: "现在就开玩" })).toBeVisible({
        timeout: 30_000,
      });
      shareUrl = await shareHrefFromStudio(page);
      expect(new URL(shareUrl).searchParams.get("share")).toBeTruthy();
    });

    await test.step("share= 交接: second context claims seat and plays a card", async () => {
      await guestJoinClaimAndAct(browser, shareUrl, "hand-play");
    });
  });

  test("线路网络: 一句话生成 → lobby thumb → share= guest claim + claim edge", async ({
    page,
    browser,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });

    let shareUrl = "";
    let projectId = "";
    await test.step("一句话生成 + approve → playable + lobby network thumb", async () => {
      projectId = await generateApproveAndPlayable(page, NETWORK_PROMPT);
      const card = await openLobbyCard(page, projectId);
      await expect(card.locator('[data-lobby-mark="network"]')).toBeVisible();
      await expect(card.locator('[data-lobby-mark="card"]')).toHaveCount(0);
      await page.goto(`/chatgpt-plugin/studio/${projectId}`);
      await expect(page.getByRole("heading", { name: "现在就开玩" })).toBeVisible({
        timeout: 30_000,
      });
      shareUrl = await shareHrefFromStudio(page);
      expect(new URL(shareUrl).searchParams.get("share")).toBeTruthy();
    });

    await test.step("share= 交接: second context claims seat and claims an edge", async () => {
      await guestJoinClaimAndAct(browser, shareUrl, "network");
    });
  });
});
