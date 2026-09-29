import { expect, test } from "@playwright/test";

test("source reaches lobby, Shared Session action, and saved settings on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/chatgpt-plugin/new");
  await page.getByRole("textbox", { name: "描述你的游戏想法" }).fill(
    "三位玩家轮流发言扩展同一个点子；每回合必须写一句回应，12 回合后结束。",
  );
  await page.getByRole("button", { name: "生成可玩版本" }).click();
  await page.waitForURL(/\/chatgpt-plugin\/studio\//, { timeout: 90_000 });
  const projectId = new URL(page.url()).pathname.split("/").at(-1);
  await expect(page.getByRole("heading", { name: "现在就开玩" })).toBeVisible({ timeout: 90_000 });

  await page.getByRole("navigation", { name: "主导航" }).getByRole("link", { name: "我的游戏" }).click();
  await page.waitForURL(/\/chatgpt-plugin\/games$/);
  const card = page.locator(".lobby-card").filter({ has: page.locator(`a[href$="/studio/${projectId}"]`) });
  await expect(card.getByRole("link", { name: "继续这一局" })).toBeVisible();
  let buildAttempts = 0;
  await page.route("**/api/builds/*", async (route) => {
    buildAttempts += 1;
    if (buildAttempts === 1) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "玩法暂时不可用" }) });
    return route.continue();
  });
  await card.getByRole("link", { name: "继续这一局" }).click();
  await page.waitForURL(/\/chatgpt-plugin\/room\//);
  expect(new URL(page.url()).searchParams.get("share")).toBeTruthy();
  await expect(page.getByRole("alert")).toContainText("玩法暂时不可用");
  await page.getByRole("button", { name: "重试" }).click();
  await expect(page.getByLabel("你的席位")).toBeVisible();
  expect(buildAttempts).toBe(2);
  await page.getByLabel("你的席位").selectOption("0");
  await page.getByLabel("写下你的发言").fill("雨夜码头响起了钟声。");
  await page.getByRole("region", { name: "你的行动" }).getByRole("button").first().click();
  await expect(page.locator(".speech-transcript")).toContainText("雨夜码头响起了钟声。");

  await page.getByRole("link", { name: "设置" }).click();
  await page.waitForURL(/\/chatgpt-plugin\/settings$/);
  await page.getByRole("radio", { name: "English" }).check();
  await page.reload();
  await expect(page.getByRole("radio", { name: "English" })).toBeChecked();
  await page.goBack();
  await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
});

test("lobby load error has a working retry on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  let attempts = 0;
  await page.route("**/api/projects", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    attempts += 1;
    if (attempts === 1) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "暂时不可用" }) });
    return route.continue();
  });
  await page.goto("/chatgpt-plugin/games");
  await expect(page.getByRole("alert")).toContainText("暂时不可用");
  await page.getByRole("button", { name: "重试" }).click();
  await expect(page.getByRole("heading", { name: "我的游戏" })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(attempts).toBe(2);
});

test("empty lobby offers one keyboard reachable create path", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/projects", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ projects: [] }),
  }));
  await page.goto("/chatgpt-plugin/games");
  await expect(page.getByRole("heading", { name: "还没有游戏" })).toBeVisible();
  const create = page.getByRole("link", { name: "创建第一款游戏" });
  await create.focus();
  await expect(create).toBeFocused();
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/chatgpt-plugin\/new$/);
  await expect(page.getByRole("textbox", { name: "描述你的游戏想法" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "还没有游戏" })).toBeVisible();
});
