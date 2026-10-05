import { expect, test } from "@playwright/test";

test("settings: 画质 / 省电 persist to localStorage", async ({ page }) => {
  await page.goto("/chatgpt-plugin/settings");
  const panel = page.getByTestId("render-quality-settings");
  await expect(panel).toBeVisible();
  await panel.getByRole("radio", { name: "清晰 1.5×" }).check();
  await panel.getByRole("radio", { name: "开", exact: true }).check();
  expect(await page.evaluate(() => localStorage.getItem("godesk.render.tier"))).toBe("high");
  expect(await page.evaluate(() => localStorage.getItem("godesk.render.saver"))).toBe("on");

  await page.reload();
  await expect(panel.getByRole("radio", { name: "清晰 1.5×" })).toBeChecked();
  await expect(panel.getByRole("radio", { name: "开", exact: true })).toBeChecked();
});
