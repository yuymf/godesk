import { devices, expect, test, type Page } from "@playwright/test";
import { NORTH_STAR_CATAN_PROMPT, shareHrefFromStudio } from "./helpers/sol-max-baseline";

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

test("hex-settlement room audio: cues from play events, touch unlock, settings persist, track switch", async ({ page, browser }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/chatgpt-plugin/new");
  await page.getByRole("textbox", { name: "描述你的游戏想法" }).fill(NORTH_STAR_CATAN_PROMPT);
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
    await guestPage.getByRole("heading").first().tap();
    await expect(audioRoot).toHaveAttribute("data-audio-context", "running");
    await waitForAudio(guestPage);

    await page.goto(shareUrl);
    await waitForAudio(page);
    await page.getByLabel("你的席位").selectOption("1");
    await guestPage.getByLabel("你的席位").selectOption("0");

    const guestBoard = guestPage.getByRole("region", { name: "卡坦六角岛" });
    const hostBoard = page.getByRole("region", { name: "卡坦六角岛" });
    // 手机视口下 main 上 2D 盘面的热点被 3D canvas 盖住（DPR > 1 时 canvas 溢出，G3D-05 #110 已修，
    // 2D 盘面由 G3D-18 删除），所以这里直接派发 click。
    await guestBoard.getByRole("button", { name: /放置定居点/ }).first().dispatchEvent("click");
    await expect(guestBoard.getByRole("button", { name: /放置道路/ }).first()).toBeVisible();
    await guestBoard.getByRole("button", { name: /放置道路/ }).first().dispatchEvent("click");

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
    const hostSettle = hostBoard.getByRole("button", { name: /放置定居点/ }).first();
    await expect(hostSettle).toBeVisible();
    await hostSettle.hover();
    await expect.poll(async () => (await cueLog(page)).map((e) => e.cue)).toContain("hover");

    // 声音设置（桌面端）：panel / toggle cue、静音、音量、曲目切换，刷新后保持。
    await page.getByRole("heading").first().click();
    await expect(page.locator("[data-sound-settings]")).toHaveAttribute("data-audio-context", "running");
    await expect.poll(async () => (await audioSnapshot(page))?.currentTrack, { timeout: 15_000 }).toBe("theme");
    await page.getByRole("button", { name: /声音设置/ }).click();
    const panel = page.getByRole("group", { name: "声音设置" });
    await expect(panel).toBeVisible();
    await panel.getByLabel("曲目").selectOption("finale");
    await expect.poll(async () => (await audioSnapshot(page))?.currentTrack).toBe("finale");
    await panel.getByLabel("音乐音量").fill("30");
    await panel.getByLabel("声音").uncheck();
    const settingsBefore = (await audioSnapshot(page))?.settings;
    expect(settingsBefore).toEqual({ enabled: false, music: 0.3, sfx: 0.8, track: "finale" });
    expect((await cueLog(page)).map((e) => e.cue)).toEqual(expect.arrayContaining(["panel", "toggle"]));

    await page.reload();
    await waitForAudio(page);
    expect((await audioSnapshot(page))?.settings).toEqual(settingsBefore);
    await page.getByRole("button", { name: /声音设置/ }).click();
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
