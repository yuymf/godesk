import { expect, type Page } from "@playwright/test";

/** Frozen Sol max baseline prompts (GameSpec fixtures). */
export const TIDEWELL_PROMPT = "做一款可以与电脑对战的汐屿基础版";
export const NORTH_STAR_TIDEWELL_PROMPT = "帮我生成一个汐屿游戏";
export const OTHELLO_PROMPT = "做一款可以与电脑对战的黑白棋";
export const NORTH_STAR_OTHELLO_PROMPT = "帮我生成一个黑白棋游戏";
export const NORTH_STAR_OTHELLO_ALT_PROMPT = "做一款翻转棋 othello";
export const NETWORK_PROMPT = "做一款线路网络桌游，玩家铺设路线连接城市";
export const CARD_AREA_PROMPT = "做一款卡牌区域控制游戏，玩家出牌争夺区域";
export const AUCTION_PROMPT = "做一款拍卖竞价桌游";

/** Off-corpus prompts — must never silent-bind Tidewell or Othello. */
export const UNSEEN_PROMPTS = [
  NETWORK_PROMPT,
  CARD_AREA_PROMPT,
  "随便做个桌游",
] as const;

/** Still refuse silent hex/disc/network after PR12 (vague only). */
export const OTHER_UNSEEN_PROMPTS = [
  "随便做个桌游",
] as const;

export async function generateApproveAndPlayable(
  page: Page,
  prompt: string,
): Promise<string> {
  await page.goto("/chatgpt-plugin/new");
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

export async function openLobbyCard(page: Page, projectId: string) {
  await page
    .getByRole("navigation", { name: "主导航" })
    .getByRole("link", { name: "我的游戏" })
    .click();
  await page.waitForURL(/\/chatgpt-plugin\/games$/);
  return page.locator(".lobby-card").filter({
    has: page.locator(`a[href$="/studio/${projectId}"]`),
  });
}

export async function shareHrefFromStudio(page: Page): Promise<string> {
  const link = page.getByRole("link", { name: "独立打开这一局" });
  await expect(link).toBeVisible();
  const href = await link.getAttribute("href");
  expect(href).toBeTruthy();
  return new URL(href!, page.url()).href;
}
