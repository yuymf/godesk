import { expect, type Browser, type Page, test } from "@playwright/test";
import { clickTidewellBoardAction, openTidewellBoardTargets } from "./helpers/tidewell-actions";
import {
  HEX_ISLAND_PROMPT,
  OTHELLO_PROMPT,
  generateApproveAndPlayable,
  shareHrefFromStudio,
} from "./helpers/sol-max-baseline";

/**
 * Sol max PR10 — share= dual-genre guest join.
 * Matrix rows covered here (test.step names): 一句话生成 → share= 交接 (+ one legal act).
 * Lobby / host-board act remain in e2e/dual-genre-boards.spec.ts.
 */

async function guestJoinClaimAndAct(
  browser: Browser,
  shareUrl: string,
  genre: "othello" | "hexIsland",
) {
  const guest = await browser.newContext();
  try {
    const page = await guest.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(shareUrl);
    await page.waitForURL(/\/chatgpt-plugin\/room\//, { timeout: 30_000 });
    expect(new URL(page.url()).searchParams.get("share")).toBeTruthy();

    await page.getByLabel("你的席位").selectOption("0");

    if (genre === "othello") {
      const board = page.getByRole("region", { name: "黑白棋盘" });
      await expect(board).toBeVisible();
      await expect(board.getByRole("region", { name: "对局状态" })).toContainText(
        "轮到你落子",
      );
      const legal = board.getByRole("gridcell", { name: /可落子/ });
      const pass = board.getByRole("button", { name: "停着（无合法落子）" });
      await expect
        .poll(async () => (await legal.count()) + (await pass.count()))
        .toBeGreaterThan(0);
      if ((await legal.count()) === 0) {
        await pass.click();
        await expect(board.getByRole("region", { name: "对局状态" })).toContainText(
          "最近停着",
        );
      } else {
        await legal.first().click();
        await expect(board.getByRole("region", { name: "对局状态" })).toContainText(
          "最近落子",
        );
        await expect(board.getByLabel("子数")).toContainText(/黑\s*[3-9]/);
      }
    } else {
      const board = page.getByRole("region", { name: "汐屿" });
      await expect(board).toBeVisible();
      const hud = board.getByRole("region", { name: "对局状态" });
      await expect(hud).toContainText("轮到你行动");
      await clickTidewellBoardAction(board, /建造渔村/);
      await expect(hud).toContainText("建造渔村");
      await expect(
        board.getByRole("button", { name: /铺设栈道/ }).first(),
      ).toBeVisible({ timeout: 15_000 });
    }
  } finally {
    await guest.close();
  }
}

async function assertShareError(page: Page, roomUrl: string, message: RegExp) {
  await page.goto(roomUrl);
  await expect(
    page.getByRole("heading", { name: "这个 Shared Session 打不开。" }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("alert")).toContainText(message);
}

test.describe("PR10 share= dual-genre guest join", () => {
  test("黑白棋: 一句话生成 → share= 交接 guest claim + legal place", async ({
    page,
    browser,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });

    let shareUrl = "";
    await test.step("一句话生成 + approve → playable share link", async () => {
      await generateApproveAndPlayable(page, OTHELLO_PROMPT);
      shareUrl = await shareHrefFromStudio(page);
      expect(new URL(shareUrl).searchParams.get("share")).toBeTruthy();
    });

    await test.step("share= 交接: second context claims seat and acts", async () => {
      await guestJoinClaimAndAct(browser, shareUrl, "othello");
    });
  });

  test("汐屿: 一句话生成 → share= 交接 guest claim + setup settlement", async ({
    page,
    browser,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });

    let shareUrl = "";
    await test.step("一句话生成 + approve → playable share link", async () => {
      await generateApproveAndPlayable(page, HEX_ISLAND_PROMPT);
      shareUrl = await shareHrefFromStudio(page);
      expect(new URL(shareUrl).searchParams.get("share")).toBeTruthy();
    });

    await test.step("share= 交接: second context claims seat and acts", async () => {
      await guestJoinClaimAndAct(browser, shareUrl, "hexIsland");
    });
  });

  test("missing / invalid share token shows a clear Shared Session error", async ({
    page,
    browser,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });

    await generateApproveAndPlayable(page, OTHELLO_PROMPT);
    const shareUrl = await shareHrefFromStudio(page);
    const valid = new URL(shareUrl);

    await test.step("missing share= query", async () => {
      const guest = await browser.newContext();
      try {
        const joined = await guest.newPage();
        const missing = new URL(valid.href);
        missing.searchParams.delete("share");
        await assertShareError(joined, missing.href, /缺少 share=/);
      } finally {
        await guest.close();
      }
    });

    await test.step("invalid / forged share token", async () => {
      const guest = await browser.newContext();
      try {
        const joined = await guest.newPage();
        const forged = new URL(valid.href);
        forged.searchParams.set("share", "not-a-valid.share-token");
        await assertShareError(joined, forged.href, /无效或已失效/);
      } finally {
        await guest.close();
      }
    });
  });
});
