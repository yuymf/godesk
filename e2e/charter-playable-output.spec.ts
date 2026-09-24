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

    // W5-02 / W4-07: conversation Replay is transcript genre surface — not score-grid chrome.
    const conversationReplay = page.locator(".conversation-replay-card");
    await expect(conversationReplay.first()).toBeVisible();
    await expect(conversationReplay.first()).toContainText("发言记录");
    const replayTranscript = page
      .locator(".conversation-replay-card .speech-transcript")
      .filter({ hasText: "先把场景定在雨夜码头。" });
    await expect(replayTranscript).toBeVisible();
    await expect(replayTranscript).toContainText("雨夜里多了一盏不肯灭的灯。");
    await expect(page.locator(".score-grid")).toHaveCount(0);
    await expect(page.locator(".hand-play-replay-card")).toHaveCount(0);
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
    await expect(page.getByText("阶段：已揭晓")).toBeVisible();

    // W6-01: resolve must surface all seats' identities on Room (not only winner sentence).
    const roomRoles = page.getByLabel("揭晓身份");
    await expect(roomRoles).toBeVisible();
    await expect(roomRoles).toContainText("座位 0：");
    await expect(roomRoles).toContainText("座位 1：");
    await expect(roomRoles).toContainText("座位 2：");
    await expect(roomRoles).toContainText(/凶手阵营|侦探阵营/);

    // W6-01 / W4-07: resolved Replay reveals roles; mid-game hide (W5-04) stays separate.
    await page.getByRole("link", { name: "只读回放" }).click();
    await page.waitForURL(/\/chatgpt-plugin\/replay\//, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "这一局怎么打完的", level: 2 })).toBeVisible();
    const hiddenRoleReplay = page.locator(".hidden-role-replay-card");
    await expect(hiddenRoleReplay.filter({ hasText: "阶段：已揭晓" }).first()).toBeVisible();
    const revealed = page.locator(".hidden-role-replay-roles");
    await expect(revealed.first()).toBeVisible();
    await expect(revealed.first()).toContainText(/凶手|侦探|平民/);
    await expect(revealed.first()).toContainText("座位 0：");
    await expect(page.locator(".accusation-log").first()).toBeVisible();
    await expect(page.locator(".score-grid")).toHaveCount(0);
    await expect(page.locator(".hand-play-replay-card")).toHaveCount(0);
    await expect(page.locator(".conversation-replay-card")).toHaveCount(0);

    await friendContext.close();
    await thirdContext.close();
  });

  test("港口十三号 reaches mid-voyage roll with friend seats (W5-05)", async ({
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
    // W4-03 / W5-05: settlecoast is a 2D presentation bar — never invent 3D.
    await expect(page.locator("canvas")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("WebGL");
    await expect(page.locator("body")).not.toContainText("GameFactory-3D");

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

    const thirdContext = await browser.newContext();
    const thirdPage = await thirdContext.newPage();
    await thirdPage.goto(inviteUrl);
    await expect(thirdPage.getByTestId("harbor-voyage-board")).toBeVisible();

    // Three seats claim; two placement rounds (6 places) unlock movement → roll.
    await page.getByLabel("你的席位").selectOption("0");
    await friendPage.getByLabel("你的席位").selectOption("1");
    await thirdPage.getByLabel("你的席位").selectOption("2");

    async function placeHarborTarget(
      actor: Page,
      targetId: string,
      seat: number,
      placementRound: number,
    ) {
      await expect(actor.getByTestId("harbor-phase-label")).toHaveText("放置阶段");
      await expect(
        actor.getByText(new RegExp(`放置 ${placementRound}/4 · 座位 ${seat}`)),
      ).toBeVisible();
      const target = actor.locator(`[data-target-id="${targetId}"]`);
      await expect(target).toBeEnabled();
      await target.click();
      await expect(actor.locator(".action-log")).toContainText(`place:${targetId}`);
    }

    // Round 1 — cargo docks.
    await placeHarborTarget(page, "cedar", 0, 1);
    await placeHarborTarget(friendPage, "cobalt", 1, 1);
    await placeHarborTarget(thirdPage, "amber", 2, 1);

    // Round 2 — port / yard / pilot; last seat ends round → 航行阶段.
    await placeHarborTarget(page, "port-c", 0, 2);
    await placeHarborTarget(friendPage, "yard-c", 1, 2);
    await placeHarborTarget(thirdPage, "pilot-small", 2, 2);

    // W5-05: non-place genre action (roll / move) after friend seats finish placement.
    await expect(page.getByTestId("harbor-phase-label")).toHaveText("航行阶段", {
      timeout: 30_000,
    });
    await expect(page.getByTestId("harbor-phase-detail")).toContainText(/第\s*1\/3\s*轮掷骰/);
    await expect(page.getByTestId("harbor-movement-console")).toContainText(/航行\s*1\/3/);
    const roll = page.getByRole("button", { name: /掷骰并航行/ });
    await expect(roll).toBeEnabled();
    await roll.click();
    await expect(page.locator(".action-log")).toContainText(/roll:\d+,\d+,\d+/);
    await expect(page.getByTestId("harbor-cargo-tracks")).toContainText(/本轮\s*\+/);
    // First sail returns to placement round 3 — mid-voyage progressed without settle/3D.
    await expect(page.getByTestId("harbor-phase-label")).toHaveText("放置阶段", {
      timeout: 30_000,
    });
    await expect(page.getByText(/放置 3\/4 · 座位 0/)).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(0);

    await friendContext.close();
    await thirdContext.close();
  });

  test("港口十三号 seats through to settle / late-voyage end (W6-03)", async ({
    page,
    browser,
  }) => {
    // Kernel settle is unit-tested; charter still lacked voyage-end / 已结算 surface.
    // No short-voyage hook — drive the honest 4 placement + 3 sail + pilot path.
    test.setTimeout(180_000);

    await page.goto("/chatgpt-plugin/new");
    const harbor = page.locator("article").filter({ hasText: "港口十三号" });
    await harbor.getByRole("button", { name: "先玩这一局" }).click();
    await page.waitForURL(/\/chatgpt-plugin\/room\//, { timeout: 90_000 });

    await expect(page.getByRole("heading", { name: "港口十三号" })).toBeVisible();
    await expect(page.getByTestId("harbor-voyage-board")).toBeVisible();
    await expect(page.getByTestId("harbor-phase-label")).toHaveText("放置阶段");
    // ADR 0012: settlecoast / 港口十三号 = 2D presentation bar, never 3D.
    await expect(page.locator("canvas")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("WebGL");
    await expect(page.locator("body")).not.toContainText("GameFactory-3D");

    const inviteUrl = await page.getByLabel("邀请链接").inputValue();
    const friendContext = await browser.newContext();
    const friendPage = await friendContext.newPage();
    await friendPage.goto(inviteUrl);
    const thirdContext = await browser.newContext();
    const thirdPage = await thirdContext.newPage();
    await thirdPage.goto(inviteUrl);

    await page.getByLabel("你的席位").selectOption("0");
    await friendPage.getByLabel("你的席位").selectOption("1");
    await thirdPage.getByLabel("你的席位").selectOption("2");

    async function placeHarborTarget(
      actor: Page,
      targetId: string,
      seat: number,
      placementRound: number,
    ) {
      await expect(actor.getByTestId("harbor-phase-label")).toHaveText("放置阶段");
      await expect(
        actor.getByText(new RegExp(`放置 ${placementRound}/4 · 座位 ${seat}`)),
      ).toBeVisible();
      const target = actor.locator(`[data-target-id="${targetId}"]`);
      await expect(target).toBeEnabled();
      await target.click();
      await expect(actor.locator(".action-log")).toContainText(`place:${targetId}`);
    }

    async function rollSail(expectedRound: number) {
      await expect(page.getByTestId("harbor-phase-label")).toHaveText("航行阶段", {
        timeout: 30_000,
      });
      await expect(page.getByTestId("harbor-phase-detail")).toContainText(
        new RegExp(`第\\s*${expectedRound}/3\\s*轮掷骰`),
      );
      await expect(page.getByTestId("harbor-movement-console")).toContainText(
        new RegExp(`航行\\s*${expectedRound}/3`),
      );
      const roll = page.getByRole("button", { name: /掷骰并航行/ });
      await expect(roll).toBeEnabled();
      await roll.click();
      await expect(page.locator(".action-log")).toContainText(/roll:\d+,\d+,\d+/);
    }

    // Round 1–2 → first sail (same mid-voyage unlock as W5-05).
    await placeHarborTarget(page, "cedar", 0, 1);
    await placeHarborTarget(friendPage, "cobalt", 1, 1);
    await placeHarborTarget(thirdPage, "amber", 2, 1);
    await placeHarborTarget(page, "port-c", 0, 2);
    await placeHarborTarget(friendPage, "yard-c", 1, 2);
    await placeHarborTarget(thirdPage, "pilot-small", 2, 2);
    await rollSail(1);

    // Round 3 → second sail.
    await expect(page.getByTestId("harbor-phase-label")).toHaveText("放置阶段", {
      timeout: 30_000,
    });
    await placeHarborTarget(page, "insurance", 0, 3);
    await placeHarborTarget(friendPage, "port-a", 1, 3);
    await placeHarborTarget(thirdPage, "yard-a", 2, 3);
    await rollSail(2);

    // Round 4 → pilot (seat 0 never took pilot → skip) → final sail → settle.
    await expect(page.getByTestId("harbor-phase-label")).toHaveText("放置阶段", {
      timeout: 30_000,
    });
    await placeHarborTarget(page, "port-b", 0, 4);
    await placeHarborTarget(friendPage, "yard-b", 1, 4);
    await placeHarborTarget(thirdPage, "pirates", 2, 4);

    await expect(page.getByTestId("harbor-phase-label")).toHaveText("领航阶段", {
      timeout: 30_000,
    });
    await expect(page.getByTestId("harbor-phase-detail")).toContainText("末次移动前调整");
    const skipPilot = page.getByRole("button", { name: "跳过领航" });
    await expect(skipPilot).toBeEnabled();
    await skipPilot.click();
    await expect(page.locator(".action-log")).toContainText("pilot:skip");

    await rollSail(3);

    // W6-03: late-voyage settle surface — 已结算 + cargo outcomes + 2D bar only.
    await expect(page.getByTestId("harbor-voyage-board")).toHaveAttribute(
      "data-harbor-phase",
      "resolved",
    );
    await expect(page.getByTestId("harbor-phase-label")).toHaveText("已结算", {
      timeout: 30_000,
    });
    await expect(page.getByTestId("harbor-phase-detail")).toContainText(/座位\s*\d+\s*领先/);
    await expect(page.getByTestId("harbor-movement-console")).toContainText("已结算");
    await expect(page.getByTestId("harbor-cargo-tracks")).toContainText(
      /抵达港口|进入干坞|遭私掠截获/,
    );
    await expect(page.locator(".game-log")).toContainText(/航次结算/);
    await expect(page.getByTestId("harbor-player-ledger")).toBeVisible();
    await expect(page.getByTestId("harbor-dock-group-port")).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("WebGL");
    await expect(page.locator("body")).not.toContainText("GameFactory-3D");
    // Friend seats still see the same 2D settle surface (no 3D).
    await expect(friendPage.getByTestId("harbor-phase-label")).toHaveText("已结算", {
      timeout: 30_000,
    });
    await expect(friendPage.locator("canvas")).toHaveCount(0);

    await friendContext.close();
    await thirdContext.close();
  });

  test("雾岭山庄 speaks mid-game and Replay hides roles", async ({ page, browser }) => {
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

    // W5-04 / W4-07: mid-game Replay shows transcript genre surface; roles stay hidden until resolved.
    await page.getByRole("link", { name: "只读回放" }).click();
    await page.waitForURL(/\/chatgpt-plugin\/replay\//, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "这一局怎么打完的", level: 2 })).toBeVisible();
    const hiddenRoleReplay = page.locator(".hidden-role-replay-card");
    await expect(hiddenRoleReplay.first()).toBeVisible();
    await expect(hiddenRoleReplay.first()).toContainText("身份对局");
    await expect(hiddenRoleReplay.first()).toContainText(/阶段：公开发言/);
    const lodgeTranscript = page
      .locator(".hidden-role-replay-card .speech-transcript")
      .filter({ hasText: "阁楼的脚步不是风。" });
    await expect(lodgeTranscript).toBeVisible();
    await expect(lodgeTranscript).toContainText("门厅的灯灭得太整齐。");
    await expect(page.locator(".hidden-role-replay-roles")).toHaveCount(0);
    await expect(page.locator(".score-grid")).toHaveCount(0);
    await expect(page.locator(".conversation-replay-card")).toHaveCount(0);
    await expect(page.locator(".hand-play-replay-card")).toHaveCount(0);
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

  test("聚会卡牌 plays a card and Replay keeps hand-play genre objects", async ({ page }) => {
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

    // W5-02 / W4-07: Replay primary surface is hand-play genre objects, not score-grid.
    await page.getByRole("link", { name: "只读回放" }).click();
    await page.waitForURL(/\/chatgpt-plugin\/replay\//, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "这一局怎么打完的", level: 2 })).toBeVisible();
    const handReplay = page.locator(".hand-play-replay-card");
    await expect(handReplay.first()).toBeVisible();
    await expect(handReplay.first()).toContainText("手牌对局");
    await expect(page.locator(".play-area").filter({ hasText: /座位 0 打出/ }).first()).toBeVisible();
    await expect(page.locator(".replay-hands").first()).toBeVisible();
    await expect(page.locator(".action-log")).toContainText(/座位 0 ·/);
    await expect(page.locator(".score-grid")).toHaveCount(0);
    await expect(page.locator(".conversation-replay-card")).toHaveCount(0);
  });

  test("轻桌游 gathers wood, converts at 工坊, and Replay keeps genre objects", async ({
    page,
    browser,
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
    await expect(board).toContainText(/兑换\s*1\s*木材→建筑/);

    await page.getByLabel("你的席位").selectOption("0");
    const placeResource = page.getByRole("button", { name: "放置到资源区" });
    await expect(placeResource).toBeEnabled();
    await placeResource.click();

    // Genre action: place-on-region gathers wood (not score-only chrome).
    await expect(page.locator(".action-log")).toContainText(/place:region-\d+/);
    await expect(board).toContainText("派工人前往资源区");
    await expect(board.locator(".worker-placement-seats")).toContainText(/木材\s*1/);
    // Convert needs wood; after P0 gathers, turn advances — workshop stays closed for empty-wood seats.
    await expect(page.getByRole("button", { name: "放置到工坊" })).toBeDisabled();

    // W5-03 / W4-01 FP8: friend seat advances turn so P0 can convert at 工坊.
    const inviteUrl = await page.getByLabel("邀请链接").inputValue();
    const friendContext = await browser.newContext();
    const friendPage = await friendContext.newPage();
    await friendPage.goto(inviteUrl);
    await expect(friendPage.locator(".worker-placement-board")).toBeVisible();
    await friendPage.getByLabel("你的席位").selectOption("1");
    const friendPlaceResource = friendPage.getByRole("button", { name: "放置到资源区" });
    await expect(friendPlaceResource).toBeEnabled();
    await friendPlaceResource.click();
    await expect(friendPage.locator(".action-log")).toContainText(/place:region-\d+/);
    await expect(
      friendPage.locator(".worker-placement-board .worker-placement-seats"),
    ).toContainText(/木材\s*1/);
    await friendContext.close();

    // P0 converts wood → building at 工坊 (genre convert action).
    const placeWorkshop = page.getByRole("button", { name: "放置到工坊" });
    await expect(placeWorkshop).toBeEnabled({ timeout: 30_000 });
    await placeWorkshop.click();
    await expect(page.locator(".action-log")).toContainText(/place:region-\d+/);
    await expect(board.locator(".game-log")).toContainText(/花费木材\s*1.*建成\s*1\s*座建筑/);
    const seatZero = board.locator(".worker-placement-seats > div").first();
    await expect(seatZero).toContainText(/木材\s*0/);
    await expect(seatZero).toContainText(/建筑\s*1/);
    // Economy progress is buildings, not resolvePoints theater.
    await expect(board.locator(".worker-placement-seats")).not.toContainText(/·\s*分\s*\d/);

    await page.getByRole("link", { name: "只读回放" }).click();
    await page.waitForURL(/\/chatgpt-plugin\/replay\//, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "这一局怎么打完的", level: 2 })).toBeVisible();
    const replayBoard = page.locator(".worker-placement-board");
    await expect(replayBoard).toBeVisible();
    await expect(replayBoard).toContainText("资源区");
    await expect(replayBoard).toContainText("工坊");
    await expect(replayBoard).toContainText(/兑换\s*1\s*木材→建筑/);
    await expect(replayBoard).toContainText("派工人前往");
    await expect(replayBoard.locator(".game-log")).toContainText(/建成\s*1\s*座建筑/);
    await expect(replayBoard.locator(".worker-placement-seats")).toContainText(/建筑\s*1/);
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
