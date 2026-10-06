import { expect, type Page, test } from "@playwright/test";
import { clickTidewellBoardAction, openTidewellBoardTargets } from "./helpers/tidewell-actions";

/** Frozen Sol max baseline prompts (GameSpec fixtures). */
const TIDEWELL_PROMPT = "做一款可以与电脑对战的汐屿基础版";
const OTHELLO_PROMPT = "做一款可以与电脑对战的黑白棋";
const visualEvidence = process.env.GODESK_VISUAL_EVIDENCE;

async function capture(page: Page, name: string) {
  if (!visualEvidence) return;
  await page.screenshot({ path: `${visualEvidence}-${name}.png`, animations: "disabled" });
}

async function generateApproveAndPlayable(page: Page, prompt: string): Promise<string> {
  await page.goto("/chatgpt-plugin/new");
  await capture(page, "home");
  await page.getByRole("textbox", { name: "描述你的游戏想法" }).fill(prompt);
  await page.getByRole("button", { name: "生成可玩版本" }).click();
  await page.waitForURL(/\/chatgpt-plugin\/studio\//, { timeout: 90_000 });
  await expect(page.getByRole("heading", { name: "先看这一局怎么玩" })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "确认玩法并开始试玩" }).click();
  await expect(page.getByRole("heading", { name: "现在就开玩" })).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.getByRole("link", { name: "独立打开这一局" })).toBeVisible();
  const projectId = new URL(page.url()).pathname.split("/").at(-1);
  expect(projectId).toBeTruthy();
  return projectId!;
}

async function openLobbyCard(page: Page, projectId: string) {
  await page.getByRole("navigation", { name: "主导航" }).getByRole("link", { name: "我的游戏" }).click();
  await page.waitForURL(/\/chatgpt-plugin\/games$/);
  const card = page.locator(".lobby-card").filter({
    has: page.locator(`a[href$="/studio/${projectId}"]`),
  });
  await expect(card).toBeVisible();
  return card;
}

async function assertBoardHudNotClipped(page: Page, boardName: string) {
  const board = page.getByRole("region", { name: boardName });
  await expect(board).toBeVisible();
  const hud = board.getByRole("region", { name: "对局状态" });
  await expect(hud).toBeVisible();
  const box = await board.boundingBox();
  const viewport = page.viewportSize();
  expect(box).toBeTruthy();
  expect(viewport).toBeTruthy();
  expect(box!.width).toBeGreaterThan(40);
  expect(box!.height).toBeGreaterThan(40);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 2);
  // Primary HUD / board should not sit fully above the fold-out of reach.
  expect(box!.y).toBeLessThan(viewport!.height);
}

test.describe("dual-genre boards: Othello + Tidewell generate → lobby → act", () => {
  test("黑白棋: studio playable, lobby mark, legal place, HUD authority", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });

    const projectId = await generateApproveAndPlayable(page, OTHELLO_PROMPT);

    const card = await openLobbyCard(page, projectId);
    await capture(page, "lobby");
    await expect(card.locator('[data-lobby-mark="othello"]')).toBeVisible();
    await expect(card.locator('[data-lobby-mark="tidewell"]')).toHaveCount(0);
    await expect(card.locator('[data-lobby-mark="othello"] img')).toHaveAttribute("alt", "");
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await card.getByRole("button", { name: "复制邀请链接" }).click();
    await expect(card.getByRole("button", { name: "已复制邀请链接" })).toBeVisible();

    await card.getByRole("link", { name: "继续这一局" }).click();
    await page.waitForURL(/\/chatgpt-plugin\/room\//, { timeout: 30_000 });
    expect(new URL(page.url()).searchParams.get("share")).toBeTruthy();

    const board = page.getByRole("region", { name: "黑白棋盘" });
    await expect(board).toBeVisible();
    await expect(board.getByRole("region", { name: "对局状态" })).toBeVisible();
    await expect(page.getByRole("grid", { name: "黑白棋盘" })).toBeVisible();

    await page.getByLabel("你的席位").selectOption("0");
    await expect(board.getByRole("region", { name: "对局状态" })).toContainText("轮到你落子");
    await capture(page, "room-othello");

    // Cells expose role=gridcell (not button) so legal places stay in the grid a11y tree.
    const legal = board.getByRole("gridcell", { name: /可落子/ });
    const pass = board.getByRole("button", { name: "停着（无合法落子）" });
    await expect
      .poll(async () => (await legal.count()) + (await pass.count()))
      .toBeGreaterThan(0);
    if ((await legal.count()) === 0) {
      await expect(pass).toBeVisible();
      await pass.click();
      await expect(board.getByRole("region", { name: "对局状态" })).toContainText("最近停着");
    } else {
      await legal.first().click();
      await expect(board.getByRole("region", { name: "对局状态" })).toContainText("最近落子");
      // Authority: opening 2–2 becomes e.g. 黑 4 / 白 1 after one place+flip.
      await expect(board.getByLabel("子数")).toContainText(/黑\s*[3-9]/);
      await expect(board.getByLabel("子数")).toContainText(/白\s*[0-2]/);
    }

    // Narrow: board + HUD still reachable / not clipped.
    await page.setViewportSize({ width: 390, height: 844 });
    await assertBoardHudNotClipped(page, "黑白棋盘");
    await expect(board.getByRole("region", { name: "对局状态" })).toBeVisible();
  });

  test("汐屿: studio playable, lobby hex mark, setup settlement, HUD update", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });

    const projectId = await generateApproveAndPlayable(page, TIDEWELL_PROMPT);

    const card = await openLobbyCard(page, projectId);
    await expect(card.locator('[data-lobby-mark="tidewell"]')).toBeVisible();
    await expect(card.locator('[data-lobby-mark="othello"]')).toHaveCount(0);
    await expect(card.locator('[data-lobby-mark="tidewell"] img')).toHaveAttribute("alt", "");

    await card.getByRole("link", { name: "继续这一局" }).click();
    await page.waitForURL(/\/chatgpt-plugin\/room\//, { timeout: 30_000 });
    expect(new URL(page.url()).searchParams.get("share")).toBeTruthy();

    const board = page.getByRole("region", { name: "汐屿" });
    await expect(board).toBeVisible();
    const hud = board.getByRole("region", { name: "对局状态" });
    await expect(hud).toBeVisible();
    await expect(hud).toContainText("初始放置");
    await expect(page.getByRole("img", { name: "汐屿" })).toBeVisible();

    await page.getByLabel("你的席位").selectOption("0");
    await expect(hud).toContainText("轮到你行动");
    await capture(page, "room-tidewell");
    await expect(board.getByLabel("你的资源")).toBeVisible();

    const { openTidewellBoardTargets } = await import("./helpers/tidewell-actions");
    await openTidewellBoardTargets(board);
    const settlement = board.getByRole("button", { name: /建造渔村/ });
    await expect(settlement.first()).toBeVisible();
    await settlement.first().click();

    // Authority: last action + phase / resources region reflect the setup place.
    await expect(hud).toContainText("建造渔村");
    await expect(hud).toContainText("初始放置");
    await expect(board.getByLabel("你的资源")).toBeVisible();
    // After settlement, setup wants a road — legal road hits appear.
    await expect(board.getByRole("button", { name: /铺设栈道/ }).first()).toBeVisible({
      timeout: 15_000,
    });

    await assertBoardHudNotClipped(page, "汐屿");
  });
});
