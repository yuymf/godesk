import { expect, type Locator, type Page } from "@playwright/test";

/** Expand the keyboard/assistive board-target drawer (G3D-13). */
export async function openTidewellBoardTargets(board: Locator): Promise<void> {
  const drawer = board.locator("details.hex-settlement-board-targets");
  // Product only mounts this <details> when the viewer has place_* legal actions
  // (your turn). Wait for mount — not just visibility of the board region.
  await expect(drawer).toHaveCount(1, { timeout: 60_000 });
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

async function hardCloseTidewellMenus(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll("details.tidewell-menu")) {
      if (el instanceof HTMLDetailsElement) {
        el.open = false;
        el.removeAttribute("open");
      }
    }
  });
}

/**
 * Close every Tidewell ⚙ <details.tidewell-menu> so the turn column / primary
 * CTA is clickable. Summary force-click alone is flaky after selectOption
 * (fixed panel / 反馈 chip intercept; native toggle sometimes no-ops; seat
 * claim can remount chrome asynchronously).
 */
export async function closeTidewellMenu(page: Page): Promise<void> {
  const openMenus = page.locator("details.tidewell-menu[open]");
  if ((await openMenus.count()) === 0) return;

  // 1) Toggle via summary (force — panel can cover the gear).
  const n = await openMenus.count();
  for (let i = 0; i < n; i++) {
    const menu = openMenus.nth(i);
    if ((await menu.count()) === 0) continue;
    if ((await menu.getAttribute("open")) === null) continue;
    await menu.locator("summary").click({ force: true }).catch(() => undefined);
  }
  if ((await openMenus.count()) === 0) return;

  // 2) Escape (product may listen; native details ignores — cheap).
  await page.keyboard.press("Escape").catch(() => undefined);
  if ((await openMenus.count()) === 0) return;

  // 3) Outside click near origin (away from fixed panel at top-right).
  await page.mouse.click(4, 4).catch(() => undefined);
  if ((await openMenus.count()) === 0) return;

  // 4) Hard close — reliable for native <details>.
  await hardCloseTidewellMenus(page);
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
  // Product closes on change; helper retries because claim re-renders can leave
  // (or remount) an open menu that covers the primary CTA.
  await expect
    .poll(
      async () => {
        await closeTidewellMenu(page);
        await hardCloseTidewellMenus(page);
        return page.locator("details.tidewell-menu[open]").count();
      },
      { timeout: 5_000, intervals: [50, 100, 200, 400] },
    )
    .toBe(0);
}
