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
    await expect
      .poll(async () =>
        page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--canvas").trim()),
      )
      .toBe("#e8f0eb");
    await expect
      .poll(async () => page.evaluate(() => getComputedStyle(document.documentElement).fontFamily))
      .not.toMatch(/Inter/i);
    const exampleCard = page.locator(".studio-examples .example-grid article").first();
    await expect(exampleCard).toBeVisible();
    await expect
      .poll(async () => exampleCard.evaluate((el) => getComputedStyle(el).backgroundColor))
      .toBe("rgb(255, 255, 255)");

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
    await expect(page).not.toHaveURL(/[?&]plan=/);
    await expect(page.getByRole("heading", { name: "先看这一局怎么玩" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("3–3 人")).toBeVisible();
    await expect(page.getByRole("button", { name: "确认玩法并开始试玩" })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Game Project");
    await expect(page.locator("body")).not.toContainText("GoDesk Agent");
    await expect(page.locator("body")).not.toContainText("Feedback Inbox");
  });

  test("install page stays a light ChatCut contract", async ({ page }) => {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/chatgpt-plugin");
    await expect(page.getByRole("heading", { name: "让 Codex 直接使用 GoDesk。" })).toBeVisible();
    await expect(page.getByText("Codex Plugin · 0.2.0+codex.20260830")).toBeVisible();
    await expect(page.getByText("对标 ChatCut")).toBeVisible();
    await expect(page.getByRole("heading", { name: "装进 Codex，上传剧本或规则，得到别人能一起玩的游戏。" })).toBeVisible();
    await expect(page.locator(".install-steps")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("不可变 Build");
    await expect(page.locator("body")).not.toContainText("五项状态全部成立");
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
    await expect(page.locator("body")).not.toContainText("这次试玩要验证");
    await expect(page.locator(".room-experiment-brief")).toHaveCount(0);
    await expectLightPlaySurface(page);

    // W4-08 / W3-02: conversation Room is transcript + turn-budget first — no primary score race chrome.
    await expect(page.locator(".conversation-board")).toBeVisible();
    await expect(page.locator(".conversation-turn-budget")).toContainText(/回合预算\s*\d+\s*\/\s*\d+/);
    await expect(page.locator(".score-track")).toHaveCount(0);
    await expect(page.locator(".score-grid")).toHaveCount(0);

    const inviteUrl = await page.getByLabel("邀请链接").inputValue();
    expect(inviteUrl).toMatch(/\/chatgpt-plugin\/room\//);

    await page.getByLabel("你的席位").selectOption("0");
    await expect(page.getByText("轮到你了")).toBeVisible();
    await expect(page.getByRole("button", { name: /加入约束/ })).toBeVisible();

    await page.getByLabel("写下你的发言").fill("先把场景定在雨夜码头。");
    await page.getByRole("button", { name: "加入约束" }).click();
    await expect(page.getByText(/已提交/)).toBeVisible();
    await expect(page.getByText("座位 0 · 先把场景定在雨夜码头。")).toBeVisible();
    await expect(page.locator(".speech-transcript")).toContainText("先把场景定在雨夜码头。");
    await expect(page.locator(".score-track")).toHaveCount(0);
    await expect(page.locator(".action-log")).not.toContainText(/[＋+]\d+\s*分/);
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
    await expect(page).not.toHaveURL(/[?&]plan=/);
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
    await expect(page.locator("body")).not.toContainText("Game Project");
    await expect(page.locator("body")).not.toContainText("GoDesk Agent");
    await expect(page.locator("body")).not.toContainText("Feedback Inbox");
    await expect(page.locator("body")).not.toContainText("Create Shared Session");
    await expect(page.getByText("高级：完整规则 JSON")).toBeVisible();
    await expect(page.locator("#ruleSystem-structure")).toBeHidden();
    await expect(page.locator("#validation")).not.toHaveAttribute("open");
    await expect(page.locator("#hypothesis-question")).toBeHidden();
    await expect(page.locator(".session-hypothesis-selector")).toBeHidden();
    await page.getByRole("button", { name: "发布邀请链接" }).click();
    const tryLink = page.getByLabel("固定好友试玩链接");
    await expect(tryLink).toHaveValue(/\/chatgpt-plugin\/try\//, { timeout: 30_000 });
    const tryUrl = await tryLink.inputValue();

    await page.goto(tryUrl);
    await page.waitForURL(/\/chatgpt-plugin\/room\//, { timeout: 30_000 });

    await expect(page.getByText("对方直接用浏览器加入，无需安装 Codex")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("这次试玩要验证");
    await expect(page.locator(".room-experiment-brief")).toHaveCount(0);
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
  });

  test("港口十三号 opens a light harbor table and accepts a waiter", async ({
    page,
    browser,
  }) => {
    await page.goto("/chatgpt-plugin/new");
    const harbor = page.locator("article").filter({ hasText: "港口十三号" });
    await harbor.getByRole("button", { name: "先玩这一局" }).click();
    await page.waitForURL(/\/chatgpt-plugin\/room\//, { timeout: 90_000 });

    await expect(page.getByRole("heading", { name: "港口十三号" })).toBeVisible();
    await expectLightPlaySurface(page);
    await expect(page.getByRole("heading", { name: "派遣伙计" })).toBeVisible();
    await expect(page.getByTestId("harbor-voyage-board")).toBeVisible();
    await expect(page.getByTestId("harbor-phase-chrome")).toBeVisible();
    await expect(page.getByTestId("harbor-phase-label")).toHaveText("放置阶段");
    await expect(page.getByTestId("harbor-cargo-tracks")).toBeVisible();
    await expect(page.getByTestId("harbor-cargo-track-amber")).toContainText("琥珀货");
    await expect(page.getByTestId("harbor-cargo-track-cobalt")).toContainText("钴蓝绸");
    await expect(page.getByTestId("harbor-cargo-track-cedar")).toContainText("雪松木");
    await expect(page.getByTestId("harbor-dock-group-cargo")).toBeVisible();
    await expect(page.getByTestId("harbor-dock-group-port")).toContainText("东栈桥");
    await expect(page.getByTestId("harbor-dock-group-yard")).toContainText("干坞甲");
    await expect(page.getByTestId("harbor-dock-group-special")).toContainText("小领航");
    await expect
      .poll(async () =>
        page
          .getByTestId("harbor-voyage-board")
          .evaluate((el) => getComputedStyle(el).backgroundColor),
      )
      .toBe("rgb(255, 255, 255)");

    const inviteUrl = await page.getByLabel("邀请链接").inputValue();
    const friendContext = await browser.newContext();
    const friendPage = await friendContext.newPage();
    await friendPage.goto(inviteUrl);
    await expect(friendPage.getByTestId("harbor-cargo-tracks")).toBeVisible();
    await expect(friendPage.getByTestId("harbor-cargo-track-cedar")).toContainText(
      "雪松木",
    );
    await expect(friendPage.getByTestId("harbor-dock-group-port")).toContainText(
      "东栈桥",
    );
    await expect(friendPage.getByTestId("harbor-phase-label")).toHaveText("放置阶段");
    await friendContext.close();

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

  test("opening preview from a compiled Build goes to the play URL", async ({
    page,
  }) => {
    await page.goto("/chatgpt-plugin/new");
    await page.getByRole("button", { name: "聚会卡牌" }).click();
    await page.getByRole("button", { name: "生成可玩版本" }).click();
    await page.waitForURL(/\/chatgpt-plugin\/studio\//, { timeout: 90_000 });
    await page.getByRole("button", { name: "确认玩法并开始试玩" }).click();
    await expect(page.getByRole("heading", { name: "现在就开玩" })).toBeVisible({
      timeout: 90_000,
    });

    await page.getByText("查看可玩版本与操作").click();
    await page.getByRole("button", { name: "打开预览" }).click();
    await page.waitForURL(/\/chatgpt-plugin\/play\//);
    await expect(page.getByText("这个版本长什么样")).toBeVisible();
    await expect(page.getByText("hand-play-v1", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "回工作室" })).toBeVisible();
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

  test("轻桌游 places a worker on a named region and Replay keeps genre objects", async ({
    page,
  }) => {
    await page.goto("/chatgpt-plugin/new");
    await page.getByRole("button", { name: "轻桌游" }).click();
    await page.getByRole("button", { name: "生成可玩版本" }).click();
    await page.waitForURL(/\/chatgpt-plugin\/studio\//, { timeout: 90_000 });
    await expect(page.getByRole("heading", { name: "先看这一局怎么玩" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator(".generation-plan-panel")).not.toContainText("这局还做不到");
    await page.getByRole("button", { name: "确认玩法并开始试玩" }).click();
    await expect(page.getByRole("heading", { name: "现在就开玩" })).toBeVisible({
      timeout: 90_000,
    });
    await page.getByRole("button", { name: "发布邀请链接" }).click();
    const tryUrl = await page.getByLabel("固定好友试玩链接").inputValue();
    expect(tryUrl).toMatch(/\/chatgpt-plugin\/try\//);
    await page.goto(tryUrl);
    await page.waitForURL(/\/chatgpt-plugin\/room\//, { timeout: 30_000 });

    await expectLightPlaySurface(page);
    const board = page.locator(".worker-placement-board");
    await expect(board).toBeVisible();
    await expect(page.getByRole("button", { name: "放置到资源区" })).toBeVisible();
    await expect(page.getByRole("button", { name: "放置到工坊" })).toBeVisible();

    await page.getByLabel("你的席位").selectOption("0");
    const placeResource = page.getByRole("button", { name: "放置到资源区" });
    await expect(placeResource).toBeEnabled();
    await placeResource.click();

    // Genre action: place-on-region (not score-only chrome).
    await expect(page.locator(".action-log")).toContainText(/place:region-\d+/);
    await expect(board).toContainText("派工人前往资源区");
    await expect(board.locator(".worker-placement-seats")).toContainText(/木材\s*1/);

    await page.getByRole("link", { name: "只读回放" }).click();
    await page.waitForURL(/\/chatgpt-plugin\/replay\//, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "这一局怎么打完的", level: 2 })).toBeVisible();
    const replayBoard = page.locator(".worker-placement-board");
    await expect(replayBoard).toBeVisible();
    await expect(replayBoard).toContainText("资源区");
    await expect(replayBoard).toContainText("派工人前往资源区");
    await expect(page.locator(".action-log")).toContainText(/place:region-\d+/);
    await expect(page.locator(".score-grid")).toHaveCount(0);
  });

  test("trick-taking refuse shows 这局还做不到 on pending plan (W5-01)", async ({
    page,
  }) => {
    await page.goto("/chatgpt-plugin/new");
    const idea = page.getByRole("textbox", { name: "描述你的游戏想法" });
    await idea.fill(
      "四人各有手牌。轮流出牌必须跟牌，同花色最大者吃墩。最终赢得最多墩的人获胜。",
    );
    await page.getByRole("button", { name: "生成可玩版本" }).click();
    await page.waitForURL(/\/chatgpt-plugin\/studio\//, { timeout: 90_000 });
    await expect(page.getByRole("heading", { name: "先看这一局怎么玩" })).toBeVisible({
      timeout: 30_000,
    });

    const unsupported = page.getByTestId("generation-plan-unsupported");
    await expect(unsupported).toBeVisible();
    await expect(unsupported.getByText("这局还做不到")).toBeVisible();
    await expect(unsupported).toContainText(/非计分手牌环|出牌计分|不会用出牌计分顶替/);
    await expect(page.locator(".generation-plan-panel")).not.toContainText("先到目标分");

    const approve = page.getByRole("button", { name: "确认玩法并开始试玩" });
    await expect(approve).toBeDisabled();
    await expect(page.getByText(/当前还没有可执行内核/)).toBeVisible();
  });
});
