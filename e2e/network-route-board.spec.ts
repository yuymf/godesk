import { expect, test } from "@playwright/test";
import {
  NETWORK_PROMPT,
  generateApproveAndPlayable,
  openLobbyCard,
} from "./helpers/sol-max-baseline";

test.describe("PR14 network-route HUD + lobby thumb", () => {
  test("线路网络: studio playable, lobby mark, claim edge, HUD authority", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });

    const projectId = await generateApproveAndPlayable(page, NETWORK_PROMPT);

    const card = await openLobbyCard(page, projectId);
    await expect(card.locator('[data-lobby-mark="network"]')).toBeVisible();
    await expect(card.locator('[data-lobby-mark="hexIsland"]')).toHaveCount(0);
    await expect(card.locator('[data-lobby-mark="othello"]')).toHaveCount(0);
    await expect(card.locator('[data-lobby-mark="network"] img')).toHaveAttribute(
      "alt",
      "",
    );

    await card.getByRole("link", { name: "继续这一局" }).click();
    await page.waitForURL(/\/chatgpt-plugin\/room\//, { timeout: 30_000 });
    expect(new URL(page.url()).searchParams.get("share")).toBeTruthy();

    const board = page.getByRole("region", { name: "线路网络盘" });
    await expect(board).toBeVisible();
    // T062 · desk-stage-hud carries turn authority (nested 对局状态 region retired).
    const hud = board.locator(".desk-stage-hud");
    await expect(hud).toBeVisible();

    await page.getByLabel("你的席位").selectOption("0");
    await expect(hud).toContainText("轮到你铺线");

    const legal = board.getByRole("button", { name: /^可占领/ });
    await expect.poll(async () => legal.count()).toBeGreaterThan(0);
    await legal.first().click();
    await expect(board.locator(".desk-stage-hud-supply")).toContainText(/1\s*:\s*0/);
  });
});
