import { chromium, expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { clickTidewellBoardAction, openTidewellBoardTargets, claimTidewellSeat } from "./helpers/tidewell-actions";
import {
  NORTH_STAR_TIDEWELL_PROMPT,
  openLobbyCard,
  shareHrefFromStudio,
} from "./helpers/sol-max-baseline";

const evidenceDir = process.env.GODESK_E2E_EVIDENCE_DIR;

async function evidenceScreenshot(page: Page, name: string) {
  if (!evidenceDir) return;
  await mkdir(evidenceDir, { recursive: true });
  await page.getByRole("region", { name: "汐屿" }).screenshot({
    path: `${evidenceDir}/${name}.png`,
  });
}

test("NL Tidewell proposal → hex-settlement build → share= guest setup settlement", async ({ page, browser }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/chatgpt-plugin/new");
  await page.getByRole("textbox", { name: "描述你的游戏想法" }).fill(NORTH_STAR_TIDEWELL_PROMPT);
  await page.getByRole("button", { name: "生成可玩版本" }).click();
  await page.waitForURL(/\/chatgpt-plugin\/studio\//, { timeout: 90_000 });
  await expect(page.getByRole("heading", { name: "先看这一局怎么玩" })).toBeVisible({ timeout: 30_000 });

  const projectId = new URL(page.url()).pathname.split("/").at(-1)!;
  const ruleBefore = await (await page.request.get(`/api/projects/${projectId}?view=rule-system`)).json();
  const plan = await (await page.request.get(`/api/projects/${projectId}?view=generation-plan`)).json();
  expect(ruleBefore.generation?.sourcePrompt).toBe(NORTH_STAR_TIDEWELL_PROMPT);
  expect(ruleBefore.generation?.requestedMechanics).toEqual(["hex-settlement"]);
  expect(plan.generationPlan?.proposedRuntime).toMatchObject({
    op: "configure_hex_settlement",
    config: { playerCount: 2, victoryPointsToWin: 10 },
  });
  await page.getByRole("button", { name: "确认玩法并开始试玩" }).click();
  await expect(page.getByRole("heading", { name: "现在就开玩" })).toBeVisible({ timeout: 90_000 });
  const ruleAfter = await (await page.request.get(`/api/projects/${projectId}?view=rule-system`)).json();
  expect(ruleAfter.runtimeSupport).toMatchObject({
    status: "executable",
    kernel: { type: "hex-settlement-v1", playerCount: 2, victoryPointsToWin: 10 },
  });
  // GameSpec v2 (G3D-12): island games default to an animated-water 3D declaration.
  expect(ruleAfter.gameSpec).toMatchObject({
    schemaVersion: 2,
    render: { engine: "three-webgl2", water: { enabled: true } },
  });
  expect(ruleAfter.gameSpec.render.bindings.map((binding: { objectKind: string }) => binding.objectKind)).toEqual(
    expect.arrayContaining(["tile-wood", "settlement", "city", "road", "robber"]),
  );

  const card = await openLobbyCard(page, projectId);
  await expect(card.locator('[data-lobby-mark="tidewell"]')).toBeVisible();
  for (const mark of ["auction", "othello", "network", "card"]) {
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
    await claimTidewellSeat(page, 1);
    await claimTidewellSeat(guestPage, 0);
    const hostBoard = page.getByRole("region", { name: "汐屿" });
    const guestBoard = guestPage.getByRole("region", { name: "汐屿" });
    await expect(hostBoard).toBeVisible();
    await expect(guestBoard).toBeVisible();
    await expect(guestBoard.getByRole("img", { name: "汐屿" })).toBeVisible();
    const hostHud = hostBoard.getByRole("region", { name: "对局状态" });
    const guestHud = guestBoard.getByRole("region", { name: "对局状态" });
    await expect(hostHud).toContainText("座位 0 · 阶段 初始放置");
    await expect(hostHud).toContainText("等待对方 · 座位 0");
    await expect(guestHud).toContainText("座位 0 · 阶段 初始放置");
    await expect(guestHud).toContainText("轮到你行动");
    await expect(hostBoard.getByRole("button", { name: /建造渔村/ })).toHaveCount(0);
    await expect(guestBoard.getByLabel("你的资源")).toBeVisible();
    await evidenceScreenshot(guestPage, "tidewell-guest-setup");

    await clickTidewellBoardAction(guestBoard, /建造渔村/);
    await expect(hostHud).toContainText("建造渔村");
    await expect(guestHud).toContainText("建造渔村");
    await expect(hostHud.getByLabel("胜利点")).toContainText("座位 0 · 1 胜利点");
    await expect(guestHud.getByLabel("胜利点")).toContainText("座位 0 · 1 胜利点");
    await expect(guestBoard.getByRole("button", { name: /铺设栈道/ }).first()).toBeVisible();
    await expect(hostBoard.getByRole("button", { name: /铺设栈道/ })).toHaveCount(0);
    await evidenceScreenshot(guestPage, "tidewell-guest-settlement");
  } finally {
    await guest.close();
  }
});
