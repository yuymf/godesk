import { expect, test } from "@playwright/test";
import { clickTidewellBoardAction, openTidewellBoardTargets, claimTidewellSeat } from "./helpers/tidewell-actions";

/** G3D-18: preview and replay mount the read-only 3D SceneHost (no SVG board). */
const TIDEWELL_PROMPT = "做一款可以与电脑对战的汐屿基础版";

test("汐屿: preview + replay render 3D canvas, no SVG board", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/chatgpt-plugin/new");
  await page.getByRole("textbox", { name: "描述你的游戏想法" }).fill(TIDEWELL_PROMPT);
  await page.getByRole("button", { name: "生成可玩版本" }).click();
  await page.waitForURL(/\/chatgpt-plugin\/studio\//, { timeout: 90_000 });
  await page.getByRole("button", { name: "确认玩法并开始试玩" }).click();
  await expect(page.getByRole("heading", { name: "现在就开玩" })).toBeVisible({
    timeout: 90_000,
  });
  const projectId = new URL(page.url()).pathname.split("/").at(-1)!;

  // Preview: opening position in 3D.
  const { builds } = await (
    await page.request.get(`/api/projects/${projectId}?view=builds`)
  ).json();
  expect(builds.length).toBeGreaterThan(0);
  const buildId = builds.at(-1).id as string;
  await page.goto(`/chatgpt-plugin/play/${encodeURIComponent(buildId)}`);
  const preview = page.getByRole("region", { name: "汐屿可玩桌面" });
  await expect(preview).toBeVisible({ timeout: 30_000 });
  await expect(preview.getByRole("img", { name: "汐屿" })).toBeVisible();
  await expect(preview.locator("canvas")).toHaveCount(1, { timeout: 30_000 });
  await expect(preview.locator("svg polygon")).toHaveCount(0);

  // Replay: room state after one setup settlement, read-only 3D.
  await page.goto(`/chatgpt-plugin/studio/${projectId}`);
  await page.getByRole("button", { name: "发布邀请链接" }).click();
  const tryUrl = await page.getByLabel("固定好友试玩链接").inputValue();
  await page.goto(tryUrl);
  await page.waitForURL(/\/chatgpt-plugin\/room\//, { timeout: 30_000 });
  await claimTidewellSeat(page, 0);
  const board = page.getByRole("region", { name: "汐屿" });
  const { clickTidewellBoardAction } = await import("./helpers/tidewell-actions");
  await clickTidewellBoardAction(board, /建造渔村/);
  await expect(board.getByRole("region", { name: "对局状态" })).toContainText(
    "建造渔村",
  );
  await page.getByRole("link", { name: "只读回放" }).click();
  await page.waitForURL(/\/chatgpt-plugin\/replay\//, { timeout: 30_000 });
  const replayBoard = page.getByRole("region", { name: "汐屿" });
  await expect(replayBoard).toBeVisible();
  await expect(replayBoard.locator("canvas")).toHaveCount(1, { timeout: 30_000 });
  await expect(replayBoard.locator("svg polygon")).toHaveCount(0);
  // Read-only: no action buttons.
  await expect(replayBoard.getByRole("button", { name: /放置/ })).toHaveCount(0);
});
