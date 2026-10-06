import type { Locator, Page } from "@playwright/test";

/** Expand the keyboard/assistive board-target drawer (G3D-13). */
export async function openTidewellBoardTargets(board: Locator): Promise<void> {
  const drawer = board.locator("details.hex-settlement-board-targets");
  if ((await drawer.count()) === 0) return;
  const open = await drawer.getAttribute("open");
  if (open !== null) return;
  await drawer.locator("summary").click();
}

export async function clickTidewellBoardAction(
  board: Locator,
  name: RegExp,
): Promise<void> {
  await openTidewellBoardTargets(board);
  await board.getByRole("button", { name }).first().click();
}
