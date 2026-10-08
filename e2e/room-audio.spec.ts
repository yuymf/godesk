import { devices, expect, test, type Locator, type Page } from "@playwright/test";
import { NORTH_STAR_HEX_ISLAND_PROMPT, shareHrefFromStudio } from "./helpers/sol-max-baseline";
import { clickTidewellBoardAction, openTidewellBoardTargets, claimTidewellSeat } from "./helpers/tidewell-actions";

/**
 * G3D-10：房间音效。素材（G3D-26 / G3D-27）合入前，引擎只记 cue 日志不出声；
 * 这里断言的是事件 → cue、AudioContext 解锁、声音设置持久化与曲目切换。
 * 注意：Playwright 的 evaluate / waitForFunction 以用户手势执行，会让页面获得用户激活，
 * 所以「首次 tap 前 suspended」只能在任何 evaluate 之前、通过 DOM 属性读取。
 */

test.use({ actionTimeout: 20_000 });

type CueEntry = { cue: string; source: string; played: boolean; reason?: string };

async function cueLog(page: Page): Promise<CueEntry[]> {
  return page.evaluate(() => (window.__godeskAudio?.log ?? []).map((e) => ({ cue: e.cue, source: e.source, played: e.played, reason: e.reason })));
}

async function audioSnapshot(page: Page) {
  return page.evaluate(() => window.__godeskAudio?.snapshot() ?? null);
}

async function waitForAudio(page: Page) {
  await page.waitForFunction(() => Boolean(window.__godeskAudio), undefined, { timeout: 30_000 });
}

/** 盘面可访问动作列表里的按钮；用 dispatchEvent，避开 3D canvas 对坐标点击的遮挡。 */
async function clickAction(board: Locator, name: RegExp) {
  const button = board.getByRole("button", { name }).first();
  await expect(button).toBeEnabled({ timeout: 20_000 });
  await button.dispatchEvent("click");
}

async function hasAction(board: Locator, name: RegExp): Promise<boolean> {
  const button = board.getByRole("button", { name }).first();
  return (await button.count()) > 0 && (await button.isEnabled());
}

test("hex-settlement room audio: cues from play events, touch unlock, settings persist, track switch", async ({ page, browser }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/chatgpt-plugin/new");
  await page.getByRole("textbox", { name: "描述你的游戏想法" }).fill(NORTH_STAR_HEX_ISLAND_PROMPT);
  await page.getByRole("button", { name: "生成可玩版本" }).click();
  await page.waitForURL(/\/chatgpt-plugin\/studio\//, { timeout: 90_000 });
  await page.getByRole("button", { name: "确认玩法并开始试玩" }).click();
  await expect(page.getByRole("heading", { name: "现在就开玩" })).toBeVisible({ timeout: 90_000 });
  const shareUrl = await shareHrefFromStudio(page);

  // 访客：EP-I 触摸模拟（iPhone 12 Pro 参数）。
  const { defaultBrowserType: _webkit, ...iphone12Pro } = devices["iPhone 12 Pro"];
  void _webkit;
  const guest = await browser.newContext(iphone12Pro);
  try {
    const guestPage = await guest.newPage();
    // 首次 tap 前 AudioContext 挂起，tap 后运行（Chromium 自动播放策略）。
    // Playwright 的定位 / evaluate 都以用户手势执行，会让页面提前获得用户激活。所以在音频
    // chunk 加载完、AudioContext 建好之前，只做被动等待（导航、网络事件、定时），不碰 DOM。
    const audioChunk = guestPage.waitForResponse((response) => /\/assets\/RoomAudio-[^/]+\.css$/.test(response.url()), { timeout: 60_000 });
    await guestPage.goto(shareUrl);
    await audioChunk;
    await guestPage.waitForTimeout(2_000);
    const audioRoot = guestPage.locator("[data-sound-settings]");
    await expect(audioRoot).toHaveAttribute("data-audio-context", "suspended", { timeout: 30_000 });
    await guestPage.getByRole("region", { name: "汐屿六角岛" }).click();
    await expect(audioRoot).toHaveAttribute("data-audio-context", "running");
    await waitForAudio(guestPage);

    await page.goto(shareUrl);
    await waitForAudio(page);
    await claimTidewellSeat(page, 1);
    await claimTidewellSeat(guestPage, 0);
    await expect(guestPage.getByLabel("你的席位")).toHaveValue("0");

    const guestBoard = guestPage.getByRole("region", { name: "汐屿六角岛" });
    const hostBoard = page.getByRole("region", { name: "汐屿六角岛" });
    // 手机视口下盘面目标抽屉默认收起；打开后再点（clipped 列表对 getByRole 不可见）。
    await clickTidewellBoardAction(guestBoard, /建造渔村/);
    await openTidewellBoardTargets(guestBoard);
    await expect(guestBoard.getByRole("button", { name: /铺设栈道/ }).first()).toBeVisible();
    await guestBoard.getByRole("button", { name: /铺设栈道/ }).first().dispatchEvent("click");

    // 两端都从房间快照差量得到 place / road cue。
    for (const p of [page, guestPage]) {
      await expect.poll(async () => (await cueLog(p)).map((e) => e.source)).toEqual(
        expect.arrayContaining([expect.stringMatching(/^action:place_settlement#/), expect.stringMatching(/^action:place_road#/)]),
      );
      const cues = (await cueLog(p)).map((e) => e.cue);
      expect(cues).toEqual(expect.arrayContaining(["place", "road"]));
    }
    expect((await cueLog(guestPage)).map((e) => e.cue)).toContain("select");

    // 桌面端 hover / select：轮到座位 1。
    await openTidewellBoardTargets(hostBoard);
    const hostSettle = hostBoard.getByRole("button", { name: /建造渔村/ }).first();
    await expect(hostSettle).toBeVisible();
    await hostSettle.hover();
    await expect.poll(async () => (await cueLog(page)).map((e) => e.cue)).toContain("hover");

    // 走完初始放置（2 人蛇形，余下 3 个定居点 + 3 条道路），再由座位 0 掷骰、结束回合：dice / turn（及可能的 gain）。
    const boards = [hostBoard, guestBoard];
    const setupAction = /^(建造渔村|铺设栈道) · /;
    for (let step = 0; step < 6; step += 1) {
      let active: Locator | null = null;
      await expect.poll(async () => {
        for (const board of boards) if (await hasAction(board, setupAction)) active = board;
        return active !== null;
      }, { timeout: 30_000 }).toBe(true);
      await clickAction(active as unknown as Locator, setupAction);
      await expect.poll(async () => (await cueLog(page)).filter((e) => e.source.startsWith("action:")).length, { timeout: 20_000 })
        .toBeGreaterThanOrEqual(3 + step);
    }
    await clickAction(guestBoard, /^掷骰$/);
    // 掷出 7 时先处理弃牌 / 移动雾灯，直到出现「结束回合」。
    for (let guard = 0; guard < 12 && !(await hasAction(guestBoard, /^结束回合$/)); guard += 1) {
      for (const board of boards) {
        if (await hasAction(board, /^(弃牌|移动雾灯)/)) await clickAction(board, /^(弃牌|移动雾灯)/);
      }
      await guestPage.waitForTimeout(500);
    }
    await clickAction(guestBoard, /^结束回合$/);
    for (const p of [page, guestPage]) {
      await expect.poll(async () => (await cueLog(p)).map((e) => e.source), { timeout: 20_000 }).toEqual(
        expect.arrayContaining([expect.stringMatching(/^action:roll_dice#/), expect.stringMatching(/^action:end_turn#/)]),
      );
      expect((await cueLog(p)).map((e) => e.cue)).toEqual(expect.arrayContaining(["dice", "turn"]));
    }

    // 动作被服务端拒绝 → 错误文案 → illegal（拦一次 intents 请求，返回 409）。
    await page.route("**/api/sessions/*/intents**", (route) =>
      route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "illegal_action" }) }), { times: 1 });
    await clickAction(hostBoard, /^掷骰$/);
    await expect.poll(async () => (await cueLog(page)).map((e) => e.cue), { timeout: 20_000 }).toContain("illegal");
    expect((await cueLog(page)).find((e) => e.cue === "illegal")?.source).toBe("ui:error");

    // 声音设置（桌面端）：panel / toggle cue、静音、音量、曲目切换，刷新后保持。
    await page.getByRole("region", { name: "汐屿六角岛" }).click();
    await expect(page.locator("[data-sound-settings]")).toHaveAttribute("data-audio-context", "running");
    await expect.poll(async () => (await audioSnapshot(page))?.currentTrack, { timeout: 15_000 }).toBe("theme");
    await page.locator(".tidewell-sound-chip").click();
    const panel = page.getByRole("group", { name: "声音设置" });
    await expect(panel).toBeVisible();
    await panel.getByLabel("曲目").selectOption("finale");
    await expect.poll(async () => (await audioSnapshot(page))?.currentTrack).toBe("finale");
    await panel.getByLabel("音乐音量").fill("30");
    await panel.getByLabel("声音").uncheck();
    const settingsBefore = (await audioSnapshot(page))?.settings;
    expect(settingsBefore).toEqual({ enabled: false, music: 0.3, sfx: 0.8, track: "finale" });
    expect((await cueLog(page)).map((e) => e.cue)).toEqual(expect.arrayContaining(["panel", "toggle"]));

    // 证据：两端 cue 日志里出现过的 cue（PR 评论引用）。
    const seenCues = [...new Set([...(await cueLog(page)), ...(await cueLog(guestPage))].map((e) => e.cue))].sort();
    console.log(`[room-audio] cues seen in e2e: ${seenCues.join(", ")}`);
    expect(seenCues).toEqual(expect.arrayContaining(["dice", "hover", "illegal", "panel", "place", "road", "select", "toggle", "turn"]));

    await page.reload();
    await waitForAudio(page);
    expect((await audioSnapshot(page))?.settings).toEqual(settingsBefore);
    await page.locator(".tidewell-sound-chip").click();
    const panelAfter = page.getByRole("group", { name: "声音设置" });
    await expect(panelAfter.getByLabel("声音")).not.toBeChecked();
    await expect(panelAfter.getByLabel("曲目")).toHaveValue("finale");
    await expect(panelAfter.getByLabel("音乐音量")).toHaveValue("30");

    // 静音时 cue 照常记日志但不播放。
    await page.evaluate(() => window.__godeskAudio?.play({ cue: "win", source: "e2e" }));
    expect((await cueLog(page)).at(-1)).toMatchObject({ cue: "win", played: false, reason: "muted" });
  } finally {
    await guest.close();
  }
});
