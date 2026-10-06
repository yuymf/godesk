import { expect, type Locator } from "@playwright/test";

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
