import { expect, test } from "@playwright/test";

// Scope: NL idea → auto-approved playable Build → Shared Session with share=.
// In-room speech click is a follow-up (action labels vary by generated Rule System).
test("one conversation idea becomes a shared session with share=", async ({ page }) => {
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
});
