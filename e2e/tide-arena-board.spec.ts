import { chromium, expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { TIDE_ARENA_PROMPT, openLobbyCard, shareHrefFromStudio } from "./helpers/sol-max-baseline";

const evidenceDir = process.env.GODESK_E2E_EVIDENCE_DIR;

async function evidenceScreenshot(page: import("@playwright/test").Page, name: string) {
  if (!evidenceDir) return;
  await mkdir(evidenceDir, { recursive: true });
  await page.getByRole("region", { name: "潮阵对局" }).screenshot({
    path: `${evidenceDir}/${name}.png`,
  });
}

test("NL tide arena → configure_auto_battler → room shop+place+combat", async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/chatgpt-plugin/new");
  await page.getByRole("textbox", { name: "描述你的游戏想法" }).fill(TIDE_ARENA_PROMPT);
  await page.getByRole("button", { name: "生成可玩版本" }).click();
  await page.waitForURL(/\/chatgpt-plugin\/studio\//, { timeout: 90_000 });
  await expect(page.getByRole("heading", { name: "先看这一局怎么玩" })).toBeVisible({
    timeout: 30_000,
  });
  const projectId = new URL(page.url()).pathname.split("/").at(-1)!;
  const ruleBefore = await (
    await page.request.get(`/api/projects/${projectId}?view=rule-system`)
  ).json();
  const plan = await (
    await page.request.get(`/api/projects/${projectId}?view=generation-plan`)
  ).json();
  expect(ruleBefore.generation?.requestedMechanics).toEqual(["auto-battler"]);
  expect(plan.generationPlan?.proposedRuntime).toMatchObject({
    op: "configure_auto_battler",
    config: { playerCount: 2 },
  });
  await page.getByRole("button", { name: "确认玩法并开始试玩" }).click();
  await expect(page.getByRole("heading", { name: "现在就开玩" })).toBeVisible({
    timeout: 90_000,
  });
  const ruleAfter = await (
    await page.request.get(`/api/projects/${projectId}?view=rule-system`)
  ).json();
  expect(ruleAfter.runtimeSupport).toMatchObject({
    status: "executable",
    kernel: { type: "auto-battler-v1", playerCount: 2 },
  });
  const card = await openLobbyCard(page, projectId);
  await expect(card.locator('[data-lobby-mark="tide-arena"]')).toBeVisible();
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
    await page.getByLabel("你的席位").selectOption("1");
    await guestPage.getByLabel("你的席位").selectOption("0");
    const board = page.getByRole("region", { name: "潮阵对局" });
    const guestBoard = guestPage.getByRole("region", { name: "潮阵对局" });
    await expect(board).toBeVisible();
    await expect(guestBoard).toBeVisible();
    await expect(guestBoard).toContainText("商店");
    await evidenceScreenshot(guestPage, "tide-arena-shop");
    // Seat 0 buys first shop offer if enabled, then ready; seat 1 ready; place lock both → combat
    const buyBtn = guestBoard.locator(".tide-arena-card").first();
    if (await buyBtn.isEnabled()) {
      await buyBtn.click();
    }
    await guestBoard.getByRole("button", { name: "准备完毕" }).click();
    await board.getByRole("button", { name: "准备完毕" }).click();
    await expect(guestBoard).toContainText("布阵");
    await evidenceScreenshot(guestPage, "tide-arena-place");
    // Place first available unit if buttons exist
    const placeTarget = guestBoard.locator(".tide-arena-place-targets button").first();
    if (await placeTarget.count()) {
      await placeTarget.click();
    }
    await guestBoard.getByRole("button", { name: "锁定阵容" }).click();
    await board.getByRole("button", { name: "锁定阵容" }).click();
    await expect(guestBoard.getByRole("region", { name: "战斗日志" })).toBeVisible({
      timeout: 15_000,
    });
    await evidenceScreenshot(guestPage, "tide-arena-combat");
    await expect(guestBoard).toContainText(/第 2 回合|终局/);
    await evidenceScreenshot(guestPage, "tide-arena-resolve");
  } finally {
    await guest.close();
  }
});
