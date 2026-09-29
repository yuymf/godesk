import { expect, test } from "@playwright/test";
import {
  CARD_AREA_PROMPT,
  generateApproveAndPlayable,
  openLobbyCard,
} from "./helpers/sol-max-baseline";

test.describe("PR12 hand-play card-area thin board", () => {
  test("卡牌区域控制: studio playable, lobby mark, play card, HUD authority", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });

    const projectId = await generateApproveAndPlayable(page, CARD_AREA_PROMPT);

    const card = await openLobbyCard(page, projectId);
    await expect(card.locator('[data-lobby-mark="card"]')).toBeVisible();
    await expect(card.locator('[data-lobby-mark="catan"]')).toHaveCount(0);
    await expect(card.locator('[data-lobby-mark="othello"]')).toHaveCount(0);
    await expect(card.locator('[data-lobby-mark="network"]')).toHaveCount(0);
    await expect(card.locator('[data-lobby-mark="card"] img')).toHaveAttribute(
      "alt",
      "",
    );

    await card.getByRole("link", { name: "继续这一局" }).click();
    await page.waitForURL(/\/chatgpt-plugin\/room\//, { timeout: 30_000 });
    expect(new URL(page.url()).searchParams.get("share")).toBeTruthy();

    const board = page.getByRole("region", { name: "手牌与出牌区" });
    await expect(board).toBeVisible();

    await page.getByLabel("你的席位").selectOption("0");

    const playButton = page.getByRole("button", { name: /打出 / });
    await expect.poll(async () => playButton.count()).toBeGreaterThan(0);
    await playButton.first().click();
    await expect(board).toContainText(/座位 0 打出/);
  });
});
