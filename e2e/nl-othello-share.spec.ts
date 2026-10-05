import { chromium, expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import {
  NORTH_STAR_OTHELLO_PROMPT,
  openLobbyCard,
  shareHrefFromStudio,
} from "./helpers/sol-max-baseline";

const evidenceDir = process.env.GODESK_E2E_EVIDENCE_DIR;

async function evidenceScreenshot(page: Page, name: string) {
  if (!evidenceDir) return;
  await mkdir(evidenceDir, { recursive: true });
  await page.getByRole("region", { name: "黑白棋盘" }).screenshot({
    path: `${evidenceDir}/${name}.png`,
  });
}

test("NL Othello proposal → disc-flipping build → share= guest legal place", async ({ page, browser }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/chatgpt-plugin/new");
  await page.getByRole("textbox", { name: "描述你的游戏想法" }).fill(NORTH_STAR_OTHELLO_PROMPT);
  await page.getByRole("button", { name: "生成可玩版本" }).click();
  await page.waitForURL(/\/chatgpt-plugin\/studio\//, { timeout: 90_000 });
  await expect(page.getByRole("heading", { name: "先看这一局怎么玩" })).toBeVisible({ timeout: 30_000 });

  const projectId = new URL(page.url()).pathname.split("/").at(-1)!;
  const ruleBefore = await (await page.request.get(`/api/projects/${projectId}?view=rule-system`)).json();
  const plan = await (await page.request.get(`/api/projects/${projectId}?view=generation-plan`)).json();
  expect(ruleBefore.generation?.sourcePrompt).toBe(NORTH_STAR_OTHELLO_PROMPT);
  expect(ruleBefore.generation?.requestedMechanics).toEqual(["disc-flipping"]);
  expect(plan.generationPlan?.proposedRuntime).toMatchObject({
    op: "configure_disc_flipping",
    config: { playerCount: 2, rows: 8, cols: 8 },
  });
  await page.getByRole("button", { name: "确认玩法并开始试玩" }).click();
  await expect(page.getByRole("heading", { name: "现在就开玩" })).toBeVisible({ timeout: 90_000 });
  const ruleAfter = await (await page.request.get(`/api/projects/${projectId}?view=rule-system`)).json();
  expect(ruleAfter.runtimeSupport).toMatchObject({
    status: "executable",
    kernel: { type: "disc-flipping-v1", playerCount: 2, rows: 8, cols: 8 },
  });
  // GameSpec v2 (G3D-12): the generated spatial game carries a 3D render declaration.
  expect(ruleAfter.presentation).not.toHaveProperty("theme");
  expect(ruleAfter.gameSpec).toMatchObject({
    schemaVersion: 2,
    render: { engine: "three-webgl2", preset: "tabletop-day", water: { enabled: false } },
  });
  expect(ruleAfter.gameSpec.render).toEqual(ruleAfter.presentation.render);
  await page.getByText("游戏结构", { exact: true }).click();
  await expect(page.getByText("渲染预设：tabletop-day")).toBeVisible();

  const card = await openLobbyCard(page, projectId);
  await expect(card.locator('[data-lobby-mark="othello"]')).toBeVisible();
  const thumbnail = card.locator('[data-lobby-mark="othello"] img');
  const thumbnailBounds = await thumbnail.boundingBox();
  const frameBounds = await card.locator('[data-lobby-mark="othello"]').boundingBox();
  expect(thumbnailBounds).not.toBeNull();
  expect(frameBounds).not.toBeNull();
  expect(thumbnailBounds!.height).toBeLessThanOrEqual(frameBounds!.height + 1);
  expect(thumbnailBounds!.width).toBeLessThanOrEqual(frameBounds!.width + 1);
  for (const mark of ["auction", "catan", "network", "card"]) {
    await expect(card.locator(`[data-lobby-mark="${mark}"]`)).toHaveCount(0);
  }

  await page.goto(`/chatgpt-plugin/studio/${projectId}`);
  const shareUrl = await shareHrefFromStudio(page);
  expect(new URL(shareUrl).searchParams.get("share")).toBeTruthy();
  const guestBrowser = process.env.GODESK_GUEST_CDP_URL
    ? await chromium.connectOverCDP(process.env.GODESK_GUEST_CDP_URL)
    : browser;
  const guest = await guestBrowser.newContext();
  try {
    const guestPage = await guest.newPage();
    await guestPage.setViewportSize({ width: 1440, height: 900 });
    await page.goto(shareUrl);
    await guestPage.goto(shareUrl);
    await guestPage.waitForURL(/\/chatgpt-plugin\/room\//);
    expect(new URL(guestPage.url()).searchParams.get("share")).toBeTruthy();
    await page.getByLabel("你的席位").selectOption("1");
    await guestPage.getByLabel("你的席位").selectOption("0");

    const hostBoard = page.getByRole("region", { name: "黑白棋盘" });
    const guestBoard = guestPage.getByRole("region", { name: "黑白棋盘" });
    await expect(hostBoard).toBeVisible();
    await expect(guestBoard).toBeVisible();
    await expect(guestBoard.getByRole("grid", { name: "黑白棋盘" })).toBeVisible();
    const hostHud = hostBoard.getByRole("region", { name: "对局状态" });
    const guestHud = guestBoard.getByRole("region", { name: "对局状态" });
    await expect(hostHud).toContainText("座位 0 · 黑");
    await expect(hostHud).toContainText("等待对方 · 座位 0");
    await expect(guestHud).toContainText("座位 0 · 黑");
    await expect(guestHud).toContainText("轮到你落子");
    await expect(hostBoard.getByRole("gridcell", { name: /可落子/ })).toHaveCount(0);
    await expect(hostBoard.getByLabel("子数")).toContainText(/黑\s*2/);
    await expect(guestBoard.getByLabel("子数")).toContainText(/白\s*2/);
    await evidenceScreenshot(guestPage, "othello-guest-opening");

    const legal = guestBoard.getByRole("gridcell", { name: /可落子/ });
    const pass = guestBoard.getByRole("button", { name: "停着（无合法落子）" });
    await expect.poll(async () => (await legal.count()) + (await pass.count())).toBeGreaterThan(0);
    if ((await legal.count()) === 0) {
      await pass.click();
      await expect(hostHud).toContainText("最近停着");
      await expect(guestHud).toContainText("最近停着");
    } else {
      await legal.first().click();
      await expect(hostHud).toContainText("最近落子");
      await expect(guestHud).toContainText("最近落子");
      await expect(hostBoard.getByLabel("子数")).toContainText(/黑\s*4/);
      await expect(guestBoard.getByLabel("子数")).toContainText(/黑\s*4/);
      await expect(hostBoard.getByLabel("子数")).toContainText(/白\s*1/);
      await expect(guestBoard.getByLabel("子数")).toContainText(/白\s*1/);
    }
    await expect(hostHud).toContainText("座位 1 · 白");
    await expect(guestHud).toContainText("座位 1 · 白");
    await expect(hostHud).toContainText("轮到你落子");
    await expect(guestHud).toContainText("等待对方 · 座位 1");
    await expect(guestBoard.getByRole("gridcell", { name: /可落子/ })).toHaveCount(0);
    await evidenceScreenshot(guestPage, "othello-guest-action");
  } finally {
    await guest.close();
  }
});
