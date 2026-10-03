import { expect, test } from "@playwright/test";

// Source → generated project → Shared Session → a real conversation action.
test("one conversation idea becomes a shared session with share=", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/chatgpt-plugin/new");
  const idea = page.getByRole("textbox", { name: "描述你的游戏想法" });
  await expect(page.locator(".studio-composer textarea")).toHaveCount(1);
  await idea.fill(
    "三位玩家轮流发言扩展同一个点子；每回合必须写一句回应，12 回合后结束。",
  );
  await idea.press("Control+Enter");
  await page.waitForURL(/\/chatgpt-plugin\/studio\//, { timeout: 90_000 });
  await expect(page.getByText("可进入项目：")).toBeVisible();

  // Auto generate already mints Build + Shared Session — CTA is 「新开一局」, open share=.
  await expect(page.getByRole("heading", { name: "现在就开玩" })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByRole("button", { name: "新开一局" })).toBeVisible();
  await page.getByRole("link", { name: "独立打开这一局" }).click();
  await page.waitForURL(/\/chatgpt-plugin\/room\//, { timeout: 30_000 });
  expect(new URL(page.url()).searchParams.get("share")).toBeTruthy();
  await page.getByLabel("你的席位").selectOption("0");
  await page.getByLabel("写下你的发言").fill("从雨夜码头开始讲这个故事。");
  await page.getByRole("region", { name: "你的行动" }).getByRole("button").first().click();
  await expect(page.locator(".speech-transcript")).toContainText("从雨夜码头开始讲这个故事。");
  // A generated invitation must still open its playable state after reload.
  const invitation = page.url();
  await page.reload();
  await expect(page).toHaveURL(invitation);
  await expect(page.locator(".speech-transcript")).toContainText("从雨夜码头开始讲这个故事。");
});

test("a failed entry submit keeps the idea and retries through the same action", async ({ page }) => {
  let createRequests = 0;
  await page.route("**/api/projects", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    createRequests += 1;
    if (createRequests === 1) {
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "暂时无法创建项目" }),
      });
    }
    return route.continue();
  });

  await page.goto("/chatgpt-plugin/new");
  const idea = page.getByRole("textbox", { name: "描述你的游戏想法" });
  await idea.fill("三位玩家轮流发言扩展同一个点子；每回合必须写一句回应，12 回合后结束。");
  const submit = page.getByRole("button", { name: "生成可玩版本" });
  await submit.click();
  await expect(page.getByRole("alert")).toContainText("暂时无法创建项目");
  await expect(idea).toHaveValue(/三位玩家轮流发言/);
  await submit.click();
  await page.waitForURL(/\/chatgpt-plugin\/studio\//, { timeout: 90_000 });
  expect(createRequests).toBe(2);
  await expect(page.getByRole("heading", { name: "这一局的玩法" })).toBeVisible();

  await page.goBack();
  await expect(idea).toHaveValue(/三位玩家轮流发言/);
  await page.goForward();
  await expect(page.getByRole("heading", { name: "这一局的玩法" })).toBeVisible();
});
