import { expect, type Locator, type Page } from "@playwright/test";

/** Expand the keyboard/assistive board-target drawer (G3D-13). */
export async function openTidewellBoardTargets(board: Locator): Promise<void> {
  const drawer = board.locator("details.hex-settlement-board-targets");
  await expect(drawer).toHaveCount(1, { timeout: 30_000 });
  if ((await drawer.getAttribute("open")) !== null) return;
  await drawer.locator("summary").click();
  // Controlled <details open>: wait until React commits open so clipped buttons re-enter a11y.
  await expect(drawer).toHaveAttribute("open", "", { timeout: 10_000 });
}

export async function clickTidewellBoardAction(
  board: Locator,
  name: RegExp,
): Promise<void> {
  await openTidewellBoardTargets(board);
  const button = board.getByRole("button", { name }).first();
  await expect(button).toBeVisible({ timeout: 20_000 });
  await button.click();
}

/** Claim a Tidewell seat (select lives in the top-bar ⚙ menu after 2h3). */
export async function claimTidewellSeat(page: Page, seat: string | number): Promise<void> {
  const select = page.getByLabel("你的席位");
  await expect(select).toHaveCount(1, { timeout: 30_000 });
  const menu = page.locator("details.tidewell-menu");
  if ((await menu.count()) > 0) {
    if ((await menu.getAttribute("open")) === null) {
      await menu.locator("summary").click();
      await expect(menu).toHaveAttribute("open", "", { timeout: 5_000 });
    }
  }
  await expect(select).toBeVisible({ timeout: 10_000 });
  await select.selectOption(String(seat));
  // Menu panel is position:fixed over the turn column — close so primary CTA is clickable.
  if ((await menu.count()) > 0 && (await menu.getAttribute("open")) !== null) {
    await menu.locator("summary").click();
    await expect(menu).not.toHaveAttribute("open", { timeout: 5_000 });
  }
}
