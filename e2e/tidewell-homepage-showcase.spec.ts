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

  test("更多示例 lists 汐屿 first and its poster paints in a full-page capture", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/?examples=all");
    const gallery = page.getByRole("region", { name: "先玩一局现成的" });
    await expect(gallery.getByRole("button", { name: "先玩这一局" })).toHaveCount(4);
    await expect(gallery.locator("article h3").first()).toHaveText("汐屿");
    const poster = gallery.locator(".example-artwork-tidewell-isles img");
    await expect.poll(() => poster.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    // Regression: decoding="async" left the below-fold poster undecoded in full-page captures.
    expect(await poster.getAttribute("decoding")).not.toBe("async");
    await page.waitForLoadState("networkidle");
    const shot = await page.screenshot({ fullPage: true, clip: (await poster.boundingBox())! });
    const colours = await page.evaluate(async (b64) => {
      const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
      const canvas = new OffscreenCanvas(48, 27);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bmp, 0, 0, 48, 27);
      const data = ctx.getImageData(0, 0, 48, 27).data;
      const set = new Set<string>();
      for (let i = 0; i < data.length; i += 4) set.add(`${data[i] >> 3},${data[i + 1] >> 3},${data[i + 2] >> 3}`);
      return set.size;
    }, shot.toString("base64"));
    expect(colours).toBeGreaterThan(50);
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
