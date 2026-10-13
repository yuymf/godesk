import { chromium, expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { TIDE_ARENA_PROMPT, openLobbyCard, shareHrefFromStudio } from "./helpers/sol-max-baseline";

const evidenceDir = process.env.GODESK_E2E_EVIDENCE_DIR;

type Page = import("@playwright/test").Page;
type Slot = { kind: "cell" | "enemy"; boardIndex: number } | { kind: "bench"; benchIndex: number };

async function evidenceScreenshot(page: Page, name: string) {
  if (!evidenceDir) return;
  await mkdir(evidenceDir, { recursive: true });
  await page.waitForTimeout(400); // render-on-demand frame + overlay settle
  await page.getByRole("region", { name: "潮阵对局" }).screenshot({
    path: `${evidenceDir}/${name}.png`,
  });
}

async function slotPoint(page: Page, slot: Slot) {
  await page.waitForFunction(() => Boolean(window.__tideArena));
  return page.evaluate((s) => window.__tideArena!.screenOf(s as never), slot);
}

async function pointerDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
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
    const ownOnBoard = guestBoard.locator('.ta-anchor.is-own[data-on-bench="0"]');
    const ownOnBench = guestBoard.locator('.ta-anchor.is-own[data-on-bench="1"]');
    const enabledCard = guestBoard.locator(".tide-arena-card:enabled");
    // Seat 0 buys → unit lands on the bench, then is DRAGGED onto the 3D board.
    await enabledCard.first().click();
    await expect(ownOnBench).toHaveCount(1);
    await pointerDrag(guestPage, await slotPoint(guestPage, { kind: "bench", benchIndex: 0 }), await slotPoint(guestPage, { kind: "cell", boardIndex: 3 }));
    await expect(ownOnBoard).toHaveCount(1);
    await expect(ownOnBench).toHaveCount(0);
    // cell → cell move: the token follows to the back row.
    const back = await slotPoint(guestPage, { kind: "cell", boardIndex: 10 });
    await pointerDrag(guestPage, await slotPoint(guestPage, { kind: "cell", boardIndex: 3 }), back);
    await expect.poll(async () => {
      const box = await ownOnBoard.first().boundingBox();
      return box ? Math.abs(box.x + box.width / 2 - back.x) : 999;
    }).toBeLessThan(30);
    // Bench → sell zone sells.
    if (await enabledCard.count()) {
      await enabledCard.first().click();
      await expect(ownOnBench).toHaveCount(1);
      const sell = await guestBoard.locator("[data-tide-sell]").boundingBox();
      await pointerDrag(guestPage, await slotPoint(guestPage, { kind: "bench", benchIndex: 0 }), { x: sell!.x + sell!.width / 2, y: sell!.y + sell!.height / 2 });
      await expect(ownOnBench).toHaveCount(0);
    }
    if (await enabledCard.count()) {
      await enabledCard.first().click();
      await pointerDrag(guestPage, await slotPoint(guestPage, { kind: "bench", benchIndex: 0 }), await slotPoint(guestPage, { kind: "cell", boardIndex: 2 }));
    }
    await guestBoard.getByRole("button", { name: "准备完毕" }).click();
    // Seat 1 fields a unit too so combat has two sides.
    await board.locator(".tide-arena-card:enabled").first().click();
    await pointerDrag(page, await slotPoint(page, { kind: "bench", benchIndex: 0 }), await slotPoint(page, { kind: "cell", boardIndex: 4 }));
    await board.getByRole("button", { name: "准备完毕" }).click();
    await expect(guestBoard).toContainText("布阵");
    await expect(guestBoard.locator(".ta-anchor.is-enemy")).toHaveCount(1);
    await evidenceScreenshot(guestPage, "place-1440");
    await guestPage.setViewportSize({ width: 390, height: 844 });
    await evidenceScreenshot(guestPage, "place-390");
    await guestPage.setViewportSize({ width: 1440, height: 900 });
    const perf = await guestPage.evaluate(() => window.__tideArena!.perf());
    console.log(`[tide-arena perf] ${JSON.stringify(perf)}`);
    expect(perf.peakCalls).toBeLessThanOrEqual(80);
    expect(perf.peakTriangles).toBeLessThanOrEqual(300_000);
    await guestBoard.getByRole("button", { name: "锁定阵容" }).click();
    await board.getByRole("button", { name: "锁定阵容" }).click();
    await expect(guestBoard).toHaveAttribute("data-combat", "1", { timeout: 15_000 });
    // Shop is locked with icon + 「战斗中」 and drag is disabled.
    await expect(guestBoard.locator(".ta-shop-lock")).toContainText("战斗中");
    await expect(guestBoard.getByRole("region", { name: "战斗日志" }).or(guestBoard.getByLabel("战斗日志"))).toBeVisible();
    await evidenceScreenshot(guestPage, "combat-1440");
    await guestPage.setViewportSize({ width: 390, height: 844 });
    await evidenceScreenshot(guestPage, "combat-390");
    await guestPage.setViewportSize({ width: 1440, height: 900 });
    await expect(guestBoard).toContainText(/第 2 回合|终局/);
  } finally {
    await guest.close();
  }
});
