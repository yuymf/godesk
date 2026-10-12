import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

/**
 * G3D-17: production homepage always shows 汐屿 showcase (GODESK_FEATURE_TIDEWELL removed).
 * Static poster only — no WebGL canvas on the homepage.
 */
const evidenceDir = process.env.GODESK_E2E_EVIDENCE_DIR;

test.describe("G3D-17 Tidewell homepage showcase (default on)", () => {
  test("default homepage shows only the Tidewell hero with a static poster", async ({ page }) => {
    await page.goto("/");
    const gallery = page.getByRole("region", { name: "先玩一局现成的" });
    await expect(gallery.getByRole("button", { name: "先玩这一局" })).toHaveCount(1);
    await expect(gallery.getByRole("heading", { name: "汐屿", exact: true })).toBeVisible();
    await expect(gallery.getByRole("heading", { name: "港口十三号", exact: true })).toHaveCount(0);
    await expect(gallery.locator("[data-homepage-showcase='tidewell']")).toHaveCount(1);
    const poster = gallery.locator("img[src='/lobby/tidewell-hero-1200.webp'], img[srcset*='tidewell-hero']").first();
    await expect(poster).toBeVisible();
    await expect(gallery.locator("canvas")).toHaveCount(0);
    const src = await poster.getAttribute("src");
    expect(src).toMatch(/tidewell-hero-\d+\.webp$/);
  });

  test("desktop + iPhone full-chrome evidence screenshots", async ({ page }, testInfo) => {
    test.skip(!evidenceDir, "set GODESK_E2E_EVIDENCE_DIR to capture evidence");
    await mkdir(evidenceDir!, { recursive: true });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "汐屿", exact: true })).toBeVisible();
    await page.screenshot({
      path: `${evidenceDir}/desktop-1440x900-after-default-fullpage.png`,
      fullPage: true,
      animations: "disabled",
    });
    await page.screenshot({
      path: `${evidenceDir}/desktop-1440x900-after-default-viewport.png`,
      fullPage: false,
      animations: "disabled",
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "汐屿", exact: true })).toBeVisible();
    await page.screenshot({
      path: `${evidenceDir}/mobile-390x844-after-default-fullpage.png`,
      fullPage: true,
      animations: "disabled",
    });
    await page.screenshot({
      path: `${evidenceDir}/mobile-390x844-after-default-viewport.png`,
      fullPage: false,
      animations: "disabled",
    });

    testInfo.annotations.push({ type: "evidence", description: evidenceDir! });
  });
});
