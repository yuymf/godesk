import { expect, type Page, test } from "@playwright/test";

test.afterEach(async ({ page }, testInfo) => {
  await page.screenshot({ path: testInfo.outputPath("final.png"), fullPage: true });
});

async function expectLightPlaySurface(page: Page) {
  const header = page.locator(".room-shell-header");
  await expect(header).toBeVisible();
  await expect
    .poll(async () => header.evaluate((el) => getComputedStyle(el).backgroundColor))
    .toBe("rgb(244, 250, 246)");
  await expect
    .poll(async () =>
      page.locator(".room-view").evaluate((el) => getComputedStyle(el).backgroundColor),
    )
    .toBe("rgb(232, 240, 235)");
  const log = page.locator(".action-log");
  await expect(log).toBeVisible();
  await expect
    .poll(async () => log.evaluate((el) => getComputedStyle(el).backgroundColor))
    .toBe("rgb(244, 250, 246)");
}

test.describe("ChatCut charter: source in, playable game out", () => {
  test("home composer is a light table and a starter chip is enough to generate", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "今天要做一款什么游戏？" })).toBeVisible();
    await expect(page.getByText("别人能立刻打开、立刻玩、还能联机的游戏")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("可编辑、可分享、可验证");
    await expect(page.getByText("分享联机")).toBeVisible();
    await expect(page.getByText("创作台")).toBeVisible();
    await expect(page.locator(".studio-home")).not.toContainText("GoDesk 服务暂时不可用");

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
    await expect(idea).toHaveValue(/身份牌/);
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
    await expect(idea).toHaveValue(/放置工人/);
    await expect(generate).toBeEnabled();

    await expect
      .poll(async () => page.evaluate(() => sessionStorage.getItem("godesk-composer-draft")))
      .toContain("放置工人");
    await page.reload();
    await expect
      .poll(async () => page.evaluate(() => sessionStorage.getItem("godesk-composer-draft")))
      .toContain("放置工人");
    await expect(idea).toHaveValue(/放置工人/);
    await expect(page.getByRole("button", { name: "轻桌游" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(generate).toBeEnabled();

    await page.getByRole("link", { name: "＋ 新游戏" }).click();
    await expect(idea).toHaveValue("");
    await expect(generate).toBeDisabled();

    await expect(page.getByRole("button", { name: "先玩这一局" })).toHaveCount(3);

    await page.getByRole("button", { name: "3人剧本杀" }).click();
    await generate.click();
    await page.waitForURL(/\/studio\//, { timeout: 90_000 });
    await expect(page.getByRole("heading", { name: "先看这一局怎么玩" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("3–3 人")).toBeVisible();
    await expect(page.getByRole("button", { name: "确认玩法并开始试玩" })).toBeVisible();
  });

  test("install page stays a light ChatCut contract", async ({ page }) => {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/chatgpt-plugin");
    await expect(page.getByRole("heading", { name: "让 Codex 直接使用 GoDesk。" })).toBeVisible();
    await expect(page.getByText("Codex Plugin · 0.2.0+codex.20260830")).toBeVisible();
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

    await page.getByRole("link", { name: "不用 Codex，直接做一局" }).click();
    await expect(page).toHaveURL(/\/chatgpt-plugin\/new$/);
    await expect(page.getByRole("heading", { name: "今天要做一款什么游戏？" })).toBeVisible();
  });

  test("灵感接力 becomes a joinable room where two people can play", async ({
    page,
    browser,
  }) => {
    await page.goto("/chatgpt-plugin/new");
    const ideaRelay = page.locator("article").filter({ hasText: "灵感接力" });
    await ideaRelay.getByRole("button", { name: "先玩这一局" }).click();
    await page.waitForURL(/\/chatgpt-plugin\/room\//, { timeout: 90_000 });

    await expect(page.getByRole("heading", { name: "灵感接力" })).toBeVisible();
    await expect(page.getByText("对方直接用浏览器加入，无需安装 Codex")).toBeVisible();
    await expectLightPlaySurface(page);

    const inviteUrl = await page.getByLabel("邀请链接").inputValue();
    expect(inviteUrl).toMatch(/\/chatgpt-plugin\/room\//);

    await page.getByLabel("你的席位").selectOption("0");
    await expect(page.getByText("轮到你了")).toBeVisible();
    await expect(page.getByRole("button", { name: /加入约束/ })).toBeVisible();

    await page.getByLabel("写下你的发言").fill("先把场景定在雨夜码头。");
    await page.getByRole("button", { name: "加入约束" }).click();
    await expect(page.getByText(/已提交/)).toBeVisible();
    await expect(page.getByText("座位 0 · 先把场景定在雨夜码头。")).toBeVisible();
    await expect(
      page.getByRole("paragraph").filter({ hasText: "等待另一位玩家完成行动" }),
    ).toBeVisible();

    const friendContext = await browser.newContext();
    const friendPage = await friendContext.newPage();
    await friendPage.goto(inviteUrl);
    await expect(friendPage.getByRole("heading", { name: "灵感接力" })).toBeVisible();
    await friendPage.getByLabel("你的席位").selectOption("1");
    await expect(friendPage.getByText("轮到你了")).toBeVisible();
    await friendPage.getByLabel("写下你的发言").fill("雨夜里多了一盏不肯灭的灯。");
    await friendPage.getByRole("button", { name: "扩展创意" }).click();
    await expect(friendPage.getByText(/已提交/)).toBeVisible();
    await expect(friendPage.getByText("座位 1 · 雨夜里多了一盏不肯灭的灯。")).toBeVisible();
    await friendContext.close();

    await page.getByRole("button", { name: "5 / 5" }).click();
    await page.getByPlaceholder(/目标很清楚/).fill("目标清楚，第二回合还可以更有张力。");
    await page.getByRole("button", { name: "提交反馈" }).click();
    await expect(page.getByText("✓ 反馈已保存")).toBeVisible();

    await page.getByRole("link", { name: "只读回放" }).click();
    await page.waitForURL(/\/chatgpt-plugin\/replay\//, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "灵感接力", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "这一局怎么打完的", level: 2 })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Read-only Replay");
    await expect(page.locator("body")).not.toContainText("Accepted actions");
    await expect
      .poll(async () =>
        page.locator(".replay-view").evaluate((el) => getComputedStyle(el).backgroundColor),
      )
      .toBe("rgb(232, 240, 235)");
    await expect
      .poll(async () =>
        page.locator(".room-shell-header").evaluate((el) => getComputedStyle(el).backgroundColor),
      )
      .toBe("rgb(244, 250, 246)");
    await expect(page.getByText(/座位 0 · 加入约束/)).toBeVisible();
    await expect(page.getByText(/座位 1 · 扩展创意/)).toBeVisible();
  });

  test("a starter chip generates a plan, then two people can play", async ({
    page,
    browser,
  }) => {
    await page.goto("/chatgpt-plugin/new");
    await page.getByRole("button", { name: "3人剧本杀" }).click();
    await page.getByRole("button", { name: "生成可玩版本" }).click();
    await page.waitForURL(/\/chatgpt-plugin\/studio\//, { timeout: 90_000 });
    await expect(page.getByRole("heading", { name: "先看这一局怎么玩" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("3–3 人")).toBeVisible();
    await expect(page.locator(".generation-plan-panel")).not.toContainText("这局还做不到");
    await expect(page.locator("body")).not.toContainText("Executable Kernel");
    await expect(page.locator("body")).not.toContainText("requires reconfiguration");
    await expect(page.locator(".generation-plan-panel")).toContainText("指控");
    await page.getByRole("button", { name: "确认玩法并开始试玩" }).click();
    await expect(page.getByRole("heading", { name: "现在就开玩" })).toBeVisible({
      timeout: 90_000,
    });
    const studioUrl = page.url();
    await page.getByRole("button", { name: "发布邀请链接" }).click();
    const tryLink = page.getByLabel("固定好友试玩链接");
    await expect(tryLink).toHaveValue(/\/chatgpt-plugin\/try\//, { timeout: 30_000 });
    const tryUrl = await tryLink.inputValue();

    await page.goto(tryUrl);
    await page.waitForURL(/\/chatgpt-plugin\/room\//, { timeout: 30_000 });

    await expect(page.getByText("对方直接用浏览器加入，无需安装 Codex")).toBeVisible();
    await expectLightPlaySurface(page);
    const inviteUrl = await page.getByLabel("邀请链接").inputValue();
    expect(inviteUrl).toMatch(/\/chatgpt-plugin\/room\//);

    await page.getByLabel("你的席位").selectOption("0");
    await expect(page.getByText("轮到你了")).toBeVisible();
    await expect(page.getByTestId("own-role")).toBeVisible();
    const creatorRole = await page.getByTestId("own-role").innerText();
    await page.getByLabel("这一轮你要说什么").fill("我觉得要先看谁在回避窗口。");
    await page.getByRole("button", { name: "发言" }).click();
    await expect(page.getByText("座位 0：我觉得要先看谁在回避窗口。")).toBeVisible();

    const friendContext = await browser.newContext();
    const friendPage = await friendContext.newPage();
    await friendPage.goto(inviteUrl);
    await friendPage.getByLabel("你的席位").selectOption("1");
    await expect(friendPage.getByText("轮到你了")).toBeVisible();
    await expect(friendPage.getByTestId("own-role")).toBeVisible();
    const friendRole = await friendPage.getByTestId("own-role").innerText();
    expect(friendRole).not.toEqual(creatorRole);
    await friendPage.getByLabel("这一轮你要说什么").fill("窗口那边的人一直不看我们。");
    await friendPage.getByRole("button", { name: "发言" }).click();
    await expect(friendPage.getByText("座位 1：窗口那边的人一直不看我们。")).toBeVisible();

    const thirdContext = await browser.newContext();
    const thirdPage = await thirdContext.newPage();
    await thirdPage.goto(inviteUrl);
    await thirdPage.getByLabel("你的席位").selectOption("2");
    await expect(thirdPage.getByText("轮到你了")).toBeVisible();
    await thirdPage.getByLabel("这一轮你要说什么").fill("那我们就进入指控。");
    await thirdPage.getByRole("button", { name: "发言" }).click();
    await expect(page.getByText("阶段：指控")).toBeVisible();
    await expect(page.getByText("轮到你了")).toBeVisible();
    await page.getByRole("button", { name: "指控座位 1" }).click();
    await expect(friendPage.getByText("轮到你了")).toBeVisible();
    await friendPage.getByRole("button", { name: "指控座位 0" }).click();
    await expect(thirdPage.getByText("轮到你了")).toBeVisible();
    await thirdPage.getByRole("button", { name: "指控座位 0" }).click();
    await expect(page.getByText(/凶手获胜|侦探与平民获胜/)).toBeVisible();
    await friendContext.close();
    await thirdContext.close();

    await page.goto(studioUrl);
    await expect(page.getByRole("heading", { name: "现在就开玩" })).toBeVisible();
    await expect(page.getByLabel("座位 0 的称呼")).toBeVisible({ timeout: 20_000 });
    await page.getByLabel("座位 0 的称呼").fill("创作者");
    await page.getByLabel("座位 1 的称呼").fill("朋友");
    await page.getByLabel("我确认这两位是真人").check();
    await page.getByRole("button", { name: "记下这是真人局" }).click();
    await expect(page.locator(".human-attest-done")).toContainText(
      "已记下：这是真人一起打的一局。",
    );
    await expect(page.locator(".human-attest-id")).toHaveText(/^finding_/);
    await expect(page.locator(".human-attest-session")).toHaveText(/^room_/);
    await expect(page.locator(".human-attest-replay")).toHaveText(/^replay_/);
    await expect(page.locator(".human-attest-hypothesis")).toHaveText(/^hypothesis_/);
  });

  test("港口十三号 opens a light harbor table and accepts a waiter", async ({ page }) => {
    await page.goto("/chatgpt-plugin/new");
    const harbor = page.locator("article").filter({ hasText: "港口十三号" });
    await harbor.getByRole("button", { name: "先玩这一局" }).click();
    await page.waitForURL(/\/chatgpt-plugin\/room\//, { timeout: 90_000 });

    await expect(page.getByRole("heading", { name: "港口十三号" })).toBeVisible();
    await expectLightPlaySurface(page);
    await expect(page.getByRole("heading", { name: "派遣伙计" })).toBeVisible();
    await expect(page.locator(".harbor-voyage-board")).toBeVisible();
    await expect
      .poll(async () =>
        page
          .locator(".harbor-voyage-board")
          .evaluate((el) => getComputedStyle(el).backgroundColor),
      )
      .toBe("rgb(255, 255, 255)");

    await page.getByLabel("你的席位").selectOption("0");
    await expect(page.getByText(/放置 1\/4 · 座位 0/)).toBeVisible();
    await page.getByRole("button", { name: /雪松木/ }).click();
    await expect(page.getByText("place:cedar")).toBeVisible();
    await expect(page.getByText(/放置 1\/4 · 座位 1/)).toBeVisible();
  });

  test("雾岭山庄 becomes a joinable hidden-role game", async ({ page, browser }) => {
    await page.goto("/chatgpt-plugin/new");
    const lodge = page.locator("article").filter({ hasText: "雾岭山庄" });
    await lodge.getByRole("button", { name: "先玩这一局" }).click();
    await page.waitForURL(/\/chatgpt-plugin\/room\//, { timeout: 90_000 });

    await expect(page.getByRole("heading", { name: "雾岭山庄" })).toBeVisible();
    await expectLightPlaySurface(page);
    await expect(page.getByText("阶段：公开发言")).toBeVisible();

    const inviteUrl = await page.getByLabel("邀请链接").inputValue();
    await page.getByLabel("你的席位").selectOption("0");
    await expect(page.getByText("轮到你了")).toBeVisible();
    const creatorRole = await page.getByTestId("own-role").innerText();
    await page.getByLabel("这一轮你要说什么").fill("阁楼的脚步不是风。");
    await page.getByRole("button", { name: "发言" }).click();
    await expect(page.getByText("座位 0：阁楼的脚步不是风。")).toBeVisible();

    const friendContext = await browser.newContext();
    const friendPage = await friendContext.newPage();
    await friendPage.goto(inviteUrl);
    await friendPage.getByLabel("你的席位").selectOption("1");
    await expect(friendPage.getByText("轮到你了")).toBeVisible();
    expect(await friendPage.getByTestId("own-role").innerText()).not.toEqual(creatorRole);
    await friendPage.getByLabel("这一轮你要说什么").fill("门厅的灯灭得太整齐。");
    await friendPage.getByRole("button", { name: "发言" }).click();
    await expect(friendPage.getByText("座位 1：门厅的灯灭得太整齐。")).toBeVisible();
    await friendContext.close();
  });

  test("聚会卡牌 starter deals hidden hands and plays a card", async ({ page }) => {
    await page.goto("/chatgpt-plugin/new");
    await page.getByRole("button", { name: "聚会卡牌" }).click();
    await page.getByRole("button", { name: "生成可玩版本" }).click();
    await page.waitForURL(/\/chatgpt-plugin\/studio\//, { timeout: 90_000 });
    await page.getByRole("button", { name: "确认玩法并开始试玩" }).click();
    await expect(page.getByRole("heading", { name: "现在就开玩" })).toBeVisible({
      timeout: 90_000,
    });
    await page.getByRole("button", { name: "发布邀请链接" }).click();
    const tryUrl = await page.getByLabel("固定好友试玩链接").inputValue();
    await page.goto(tryUrl);
    await page.waitForURL(/\/chatgpt-plugin\/room\//, { timeout: 30_000 });
    await page.getByLabel("你的席位").selectOption("0");
    await expect(page.getByLabel("你的手牌")).toBeVisible();
    await page.getByRole("button", { name: /打出 / }).first().click();
    await expect(page.getByText(/座位 0 打出/)).toBeVisible();
  });
});
