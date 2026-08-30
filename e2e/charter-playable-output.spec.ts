import { expect, test } from "@playwright/test";

test.afterEach(async ({ page }, testInfo) => {
  await page.screenshot({ path: testInfo.outputPath("final.png"), fullPage: true });
});

test.describe("ChatCut charter: source in, playable game out", () => {
  test("home composer is a light table and a starter chip is enough to generate", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "今天要做一款什么游戏？" })).toBeVisible();
    await expect(page.getByText("别人能立刻打开、立刻玩、还能联机的游戏")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("可编辑、可分享、可验证");
    await expect(page.getByText("分享联机")).toBeVisible();

    const sidebar = page.locator(".studio-sidebar");
    await expect(sidebar).toBeVisible();
    await expect
      .poll(async () => sidebar.evaluate((el) => getComputedStyle(el).backgroundColor))
      .toBe("rgb(244, 250, 246)");
    await expect
      .poll(async () => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
      .toBe("rgb(232, 240, 235)");

    const idea = page.getByRole("textbox", { name: "描述你的游戏想法" });
    const generate = page.getByRole("button", { name: "生成可玩版本" });
    await expect(generate).toBeDisabled();

    await page.getByRole("button", { name: "3人剧本杀" }).click();
    await expect(idea).toHaveValue(/别墅里/);
    await expect(page.getByRole("button", { name: "3人剧本杀" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(generate).toBeEnabled();

    await page.getByRole("button", { name: "聚会卡牌" }).click();
    await expect(idea).toHaveValue(/手牌/);
    await expect(page.getByRole("button", { name: "聚会卡牌" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(generate).toBeEnabled();

    await page.getByRole("button", { name: "轻桌游" }).click();
    await expect(idea).toHaveValue(/城市地图/);
    await expect(generate).toBeEnabled();

    await expect(page.getByRole("button", { name: "先玩这一局" })).toHaveCount(3);
  });

  test("install page stays a light ChatCut contract", async ({ page }) => {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/chatgpt-plugin");
    await expect(page.getByRole("heading", { name: "让 Codex 直接使用 GoDesk。" })).toBeVisible();
    await expect(page.getByText("对标 ChatCut")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("开始制作并验证我的第一个规则游戏");
    await expect(page.locator("body")).not.toContainText("记录一条明确标注证据类型的验证结论");
    await expect
      .poll(async () =>
        page.locator(".install-guide").evaluate((el) => getComputedStyle(el).backgroundColor),
      )
      .toBe("rgb(232, 240, 235)");

    await page.getByRole("button", { name: "复制这一句话" }).click();
    await expect(page.getByRole("button", { name: "已复制" })).toBeVisible();
  });

  test("灵感接力 becomes a joinable room where two people can play", async ({
    page,
    browser,
  }) => {
    await page.goto("/");
    const ideaRelay = page.locator("article").filter({ hasText: "灵感接力" });
    await ideaRelay.getByRole("button", { name: "先玩这一局" }).click();
    await page.waitForURL(/\/room\//, { timeout: 90_000 });

    await expect(page.getByRole("heading", { name: "灵感接力" })).toBeVisible();
    await expect(page.getByText("对方直接用浏览器加入，无需安装 Codex")).toBeVisible();

    const inviteUrl = await page.getByLabel("邀请链接").inputValue();
    expect(inviteUrl).toMatch(/\/room\//);

    await page.getByLabel("你的席位").selectOption("0");
    await expect(page.getByText("轮到你了")).toBeVisible();
    await expect(page.getByText("加入约束")).toBeVisible();

    await page.getByRole("button", { name: "行动 2 +2 创意分" }).click();
    await expect(page.getByText(/已提交/)).toBeVisible();
    await expect(
      page.getByRole("paragraph").filter({ hasText: "等待另一位玩家完成行动" }),
    ).toBeVisible();

    const friendContext = await browser.newContext();
    const friendPage = await friendContext.newPage();
    await friendPage.goto(inviteUrl);
    await expect(friendPage.getByRole("heading", { name: "灵感接力" })).toBeVisible();
    await friendPage.getByLabel("你的席位").selectOption("1");
    await expect(friendPage.getByText("轮到你了")).toBeVisible();
    await friendPage.getByRole("button", { name: "行动 1 +1 创意分" }).click();
    await expect(friendPage.getByText(/已提交/)).toBeVisible();
    await friendContext.close();
  });
});
