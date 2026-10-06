import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

/**
 * G3D-16: homepage showcase flag.
 * Default off → classic three cards; ?tidewell=1 → single 汐屿 hero (static poster, no canvas).
 */
const evidenceDir = process.env.GODESK_E2E_EVIDENCE_DIR;

test.describe("G3D-16 Tidewell homepage showcase", () => {
  test("flag off keeps the classic three example cards", async ({ page }) => {
    await page.goto("/");
    const gallery = page.getByRole("region", { name: "先玩一局现成的" });
    await expect(gallery.getByRole("button", { name: "先玩这一局" })).toHaveCount(3);
    await expect(gallery.getByRole("heading", { name: "港口十三号", exact: true })).toBeVisible();
    await expect(gallery.getByRole("heading", { name: "汐屿", exact: true })).toHaveCount(0);
    await expect(gallery.locator("[data-homepage-showcase='classic']")).toHaveCount(1);
  });

  test("flag on shows only the Tidewell hero with a static poster", async ({ page }) => {
    await page.goto("/?tidewell=1");
    const gallery = page.getByRole("region", { name: "先玩一局现成的" });
    await expect(gallery.getByRole("button", { name: "先玩这一局" })).toHaveCount(1);
    await expect(gallery.getByRole("heading", { name: "汐屿", exact: true })).toBeVisible();
    await expect(gallery.getByRole("heading", { name: "港口十三号", exact: true })).toHaveCount(0);
    await expect(gallery.locator("[data-homepage-showcase='tidewell']")).toHaveCount(1);
    const poster = gallery.locator("img[src='/lobby/tidewell-hero-1200.webp'], img[srcset*='tidewell-hero']").first();
    await expect(poster).toBeVisible();
    // Homepage must not mount a WebGL canvas for the showcase (LCP / budget).
    await expect(gallery.locator("canvas")).toHaveCount(0);
    // Poster must be the clean hero asset, not a Room page capture.
    const src = await poster.getAttribute("src");
    expect(src).toMatch(/tidewell-hero-\d+\.webp$/);
  });

  test("flag-on desktop + iPhone evidence screenshots", async ({ page }, testInfo) => {
    test.skip(!evidenceDir, "set GODESK_E2E_EVIDENCE_DIR to capture evidence");
    await mkdir(evidenceDir!, { recursive: true });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/?tidewell=1");
    await expect(page.getByRole("heading", { name: "汐屿", exact: true })).toBeVisible();
    await page.screenshot({
      path: `${evidenceDir}/desktop-1440x900-flag-on.png`,
      fullPage: true,
      animations: "disabled",
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?tidewell=1");
    await expect(page.getByRole("heading", { name: "汐屿", exact: true })).toBeVisible();
    await page.screenshot({
      path: `${evidenceDir}/iphone12pro-390x844-flag-on.png`,
      fullPage: true,
      animations: "disabled",
    });

    await page.goto("/");
    await page.screenshot({
      path: `${evidenceDir}/iphone12pro-390x844-flag-off.png`,
      fullPage: true,
      animations: "disabled",
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.screenshot({
      path: `${evidenceDir}/desktop-1440x900-flag-off.png`,
      fullPage: true,
      animations: "disabled",
    });

    testInfo.annotations.push({ type: "evidence", description: evidenceDir! });
  });
});
