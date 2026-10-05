import { expect, test, type Page } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";

/** G3D-07：SPEC §3.7 CSS tokens（纸色表面 + 实阴影）。 */
const G3D_CSS_TOKENS: Record<string, string> = {
  "--surface-canvas": "#f6f1e7",
  "--surface-paper": "#fbf8f1",
  "--surface-raised": "#ffffff",
  "--surface-board": "#e9e1d0",
  "--surface-sunken": "#f5f5f5",
  "--shadow-soft": "0 1px 2px rgba(41, 33, 20, 0.08), 0 2px 6px rgba(41, 33, 20, 0.06)",
  "--shadow-card": "0 2px 4px rgba(41, 33, 20, 0.08), 0 8px 24px rgba(41, 33, 20, 0.12)",
  "--shadow-float": "0 6px 12px rgba(41, 33, 20, 0.10), 0 20px 48px rgba(41, 33, 20, 0.18)",
  "--hud-glass": "rgba(251, 248, 241, 0.86)",
};

async function expectDesignTokens(page: Page) {
  // 生产构建会压缩自定义属性（0.10 → .1），所以把 token 与期望值各自挂到探针元素上，比较浏览器解析后的值。
  const resolved = await page.evaluate((entries) => {
    const probe = document.createElement("div");
    document.body.appendChild(probe);
    const resolve = (property: "boxShadow" | "backgroundColor", value: string) => {
      probe.style[property] = "";
      probe.style[property] = value;
      return getComputedStyle(probe)[property];
    };
    const result = Object.fromEntries(entries.map(([name, expected]) => {
      const property = name.startsWith("--shadow") ? "boxShadow" : "backgroundColor";
      return [name, { actual: resolve(property, `var(${name})`), expected: resolve(property, expected) }];
    }));
    probe.remove();
    return result;
  }, Object.entries(G3D_CSS_TOKENS));
  for (const [name, { actual, expected }] of Object.entries(resolved)) {
    expect(actual, name).toBe(expected);
    expect(actual, `${name} 已定义`).not.toMatch(/^(none|rgba\(0, 0, 0, 0\))$/);
  }
  // 实阴影：作曲区与画廊插画用 token 阴影（不再是 none），页面底色仍为白。
  const composerShadow = await page.locator(".studio-composer").evaluate((el) => getComputedStyle(el).boxShadow);
  expect(composerShadow).toContain("rgba(41, 33, 20, 0.12)");
  const artworkShadow = await page.locator(".example-artwork").first().evaluate((el) => getComputedStyle(el).boxShadow);
  expect(artworkShadow).toContain("rgba(41, 33, 20, 0.06)");
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(255, 255, 255)");
}

async function expectGameMark(page: Page, markUrl: string) {
  const marks = page.locator(".godesk-mark");
  await expect(marks.first()).toBeVisible();
  for (const mark of await marks.all()) {
    await expect(mark).toHaveAttribute("src", markUrl);
    await expect.poll(() => mark.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
  }
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", markUrl);
}

for (const viewport of [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "compact-desktop", width: 1280, height: 720 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`${viewport.name} gallery opens a game and a friend joins to take a turn`, async ({ page, browser }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto("/chatgpt-plugin");
    const markUrl = await page.locator('link[rel="icon"]').getAttribute("href");
    if (!markUrl) throw new Error("GoDesk favicon is missing");
    const favicon = await page.request.get(markUrl);
    expect(favicon.ok()).toBe(true);
    expect(favicon.headers()["content-type"]).toContain("image/svg+xml");
    expect(await favicon.text()).toBe(await readFile("src/assets/godesk-mark.svg", "utf8"));
    await expectGameMark(page, markUrl);
    await page.getByRole("link", { name: "不用 Connector，直接做一局" }).click();
    await expect(page).toHaveURL(/\/chatgpt-plugin\/new$/);
    await expectGameMark(page, markUrl);
    await page.evaluate(() => document.fonts.ready);
    const navigation = page.getByRole("navigation", { name: "主导航" });
    await expect(navigation.getByRole("link", { name: "我的游戏" })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "在 Codex 中使用" })).toBeVisible();
    const source = page.getByRole("textbox", { name: "描述你的游戏想法" });
    await source.focus();
    await expect(source).toBeFocused();
    await page.getByRole("button", { name: "聚会卡牌" }).click();
    await expect(source).toHaveValue(/手牌/);
    await expect(page.getByRole("button", { name: "生成可玩版本" })).toBeEnabled();
    await source.fill("");
    await page.getByRole("heading", { name: /把想法变成游戏，\s*邀请朋友一起玩。/ }).click();

    const gallery = page.getByRole("region", { name: "先玩一局现成的" });
    await expect(gallery.getByRole("button", { name: "先玩这一局" })).toHaveCount(3);
    await expectDesignTokens(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    const submitBox = await page.getByRole("button", { name: "生成可玩版本" }).boundingBox();
    expect(submitBox).not.toBeNull();
    expect(submitBox!.y + submitBox!.height).toBeLessThanOrEqual(viewport.height);
    if (viewport.name === "mobile") {
      const examplesBox = await gallery.getByRole("heading", { name: "先玩一局现成的" }).boundingBox();
      expect(examplesBox).not.toBeNull();
      expect(examplesBox!.y + examplesBox!.height).toBeLessThanOrEqual(viewport.height);
    }
    const evidenceDir = process.env.GODESK_E2E_EVIDENCE_DIR;
    if (evidenceDir) await mkdir(evidenceDir, { recursive: true });
    await page.locator(".shell-header").screenshot({ path: evidenceDir ? `${evidenceDir}/brand-${viewport.name}.png` : testInfo.outputPath("brand.png") });
    await page.screenshot({ path: evidenceDir ? `${evidenceDir}/home-${viewport.name}.png` : testInfo.outputPath("home.png"), fullPage: true });

    const example = gallery.locator("article").filter({ has: page.getByRole("heading", { name: "灵感接力", exact: true }) });
    const start = example.getByRole("button", { name: "先玩这一局" });
    await start.focus();
    await expect(start).toBeFocused();
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/room\//, { timeout: 90_000 });
    await expectGameMark(page, markUrl);
    const inviteUrl = await page.getByLabel("邀请链接").inputValue();
    expect(new URL(inviteUrl).searchParams.get("share")).toBeTruthy();
    await page.getByLabel("你的席位").selectOption("0");
    await page.getByLabel("写下你的发言").fill("画廊里的一张地图指向了码头。");
    await page.getByRole("button", { name: "加入约束" }).click();
    await expect(page.locator(".speech-transcript")).toContainText("画廊里的一张地图指向了码头。");

    const friend = await browser.newContext({ viewport });
    try {
      const friendPage = await friend.newPage();
      await friendPage.goto(inviteUrl);
      await expectGameMark(friendPage, markUrl);
      await friendPage.getByLabel("你的席位").selectOption("1");
      await friendPage.getByLabel("写下你的发言").fill("我们沿着地图找到了第一艘船。");
      await friendPage.getByRole("button", { name: "扩展创意" }).click();
      await expect(page.locator(".speech-transcript")).toContainText("我们沿着地图找到了第一艘船。");
      await expect(friendPage.locator(".speech-transcript")).toContainText("画廊里的一张地图指向了码头。");
      expect(await friendPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await friendPage.screenshot({ path: evidenceDir ? `${evidenceDir}/session-${viewport.name}.png` : testInfo.outputPath("joined-session.png"), fullPage: true });
    } finally {
      await friend.close();
    }
    await page.getByRole("link", { name: "只读回放" }).click();
    await expect(page.getByRole("heading", { name: "这一局怎么打完的" })).toBeVisible();
    await expectGameMark(page, markUrl);
    await expect(page.locator(".conversation-replay-card .speech-transcript").filter({ hasText: "我们沿着地图找到了第一艘船。" }).first()).toBeVisible();
    await page.getByRole("link", { name: "回工作室" }).click();
    await expect(page.locator(".creator-brand")).toBeVisible();
    await expectGameMark(page, markUrl);
    await page.getByRole("link", { name: "GoDesk", exact: true }).click();
    await expect(page.getByRole("heading", { name: /把想法变成游戏，\s*邀请朋友一起玩。/ })).toBeVisible();
    const rulebookName = "朋友周末一起玩的三人身份与线索规则说明.txt";
    await page.getByLabel("附上剧本或规则", { exact: true }).setInputFiles({
      name: rulebookName,
      mimeType: "text/plain",
      buffer: Buffer.from("三人剧本杀，每人有身份牌和私密线索，轮流发言后指认凶手。"),
    });
    await expect(page.locator(".studio-dropzone strong").first()).toHaveText(rulebookName);
    await expect(page.locator(".studio-dropzone small").first()).toContainText("点击替换");
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=", "base64");
    await page.getByLabel("添加图片", { exact: true }).setInputFiles([
      { name: "map.png", mimeType: "image/png", buffer: png },
      { name: "card.png", mimeType: "image/png", buffer: png },
    ]);
    await expect(page.locator(".studio-dropzone strong").last()).toHaveText("2 张图片");
    await expect(page.getByText("卡牌、地图或参考图 · 可选", { exact: true })).toBeVisible();
    const imageUse = page.getByLabel("这些图片怎么用");
    await expect(imageUse).toHaveValue("visual-reference");
    await imageUse.selectOption("project-asset");
    await expect(imageUse).toHaveValue("project-asset");
    await expect(page.getByRole("button", { name: "生成可玩版本" })).toBeEnabled();
    if (viewport.name === "mobile") {
      await page.setViewportSize({ width: 320, height: 844 });
      for (const link of await page.getByRole("navigation", { name: "主导航" }).getByRole("link").all()) {
        await expect(link).toBeVisible();
      }
      await source.fill("我们要一起玩一个有很长规则说明的游戏。".repeat(100));
      await expect(source).toHaveValue(/很长规则说明/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.setViewportSize(viewport);
    }
    await page.getByRole("link", { name: "我的游戏", exact: true }).click();
    await page.waitForURL(/\/games$/);
    await expect(page.getByRole("heading", { name: "我的游戏", exact: true })).toBeVisible();
    await expectGameMark(page, markUrl);
    await expect(page.getByRole("link", { name: "继续这一局" }).first()).toBeVisible();
    const lobbyCard = page.locator(".lobby-card").filter({ has: page.getByRole("heading", { name: "灵感接力", exact: true }) }).first();
    await expect(lobbyCard.locator('[data-lobby-mark="conversation"] svg')).toBeVisible();
    await page.screenshot({ path: evidenceDir ? `${evidenceDir}/gallery-${viewport.name}.png` : testInfo.outputPath("gallery.png"), fullPage: false });
    await page.getByRole("link", { name: "设置", exact: true }).click();
    await expect(page.getByRole("heading", { name: "设置", exact: true })).toBeVisible();
    await expectGameMark(page, markUrl);
  });
}
