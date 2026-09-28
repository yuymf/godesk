import { expect, test } from "@playwright/test";

test("one conversation idea becomes a shared session with a recorded speech action", async ({ page }) => {
  await page.goto("/chatgpt-plugin/new");
  await page.getByRole("textbox", { name: "描述你的游戏想法" }).fill(
    "三位玩家轮流发言扩展同一个点子；每回合必须写一句回应，12 回合后结束。",
  );
  await page.getByRole("button", { name: "生成可玩版本" }).click();
  await page.waitForURL(/\/chatgpt-plugin\/studio\//, { timeout: 90_000 });
  await expect(page.getByText("玩法已确认。可以直接开玩，或改下一版。")).toBeVisible();

  await page.getByRole("button", { name: "生成新版本" }).click();
  await expect(page.getByRole("heading", { name: "现在就开玩" })).toBeVisible({ timeout: 90_000 });
  await page.getByRole("button", { name: "开始试玩" }).click();
  await page.getByRole("link", { name: "独立打开这一局" }).click();
  await page.waitForURL(/\/chatgpt-plugin\/room\//, { timeout: 30_000 });
  expect(new URL(page.url()).searchParams.get("share")).toBeTruthy();

  await page.getByLabel("你的席位").selectOption("0");
  await page.getByLabel("写下你的发言").fill("雨夜码头出现一封神秘来信。");
  await page.locator(".conversation-board button").filter({ hasText: /扩展|回应|发言/ }).first().click();
  await expect(page.locator(".speech-transcript")).toContainText("雨夜码头出现一封神秘来信。");
});
