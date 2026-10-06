#!/usr/bin/env node
/**
 * G3D-06 live-test evidence: desktop + iPhone 12 Pro, three tiers.
 * Uses Playwright Chromium with SwiftShader (no libEGL on box).
 */
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT = process.env.G3D_EVIDENCE_DIR || "/workspace/g3d-evidence/G3D-06";
const BASE = process.env.G3D_BASE_URL || "http://127.0.0.1:8799/chatgpt-plugin";
const HEX_ISLAND_PROMPT = "做一款可以与电脑对战的汐屿基础版";

const viewports = [
  { id: "desktop-1440x900", width: 1440, height: 900, isMobile: false },
  {
    id: "iphone12pro-390x844",
    width: 390,
    height: 844,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  },
];

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({
    args: [
      "--use-gl=swiftshader",
      "--enable-unsafe-swiftshader",
      "--use-angle=swiftshader",
      "--ignore-gpu-blocklist",
      "--enable-webgl",
    ],
  });

  const bootstrap = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await bootstrap.goto(`${BASE}/new`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await bootstrap.getByRole("textbox", { name: "描述你的游戏想法" }).fill(HEX_ISLAND_PROMPT);
  await bootstrap.getByRole("button", { name: "生成可玩版本" }).click();
  await bootstrap.waitForURL(/\/chatgpt-plugin\/studio\//, { timeout: 90_000 });
  await bootstrap.getByRole("button", { name: "确认玩法并开始试玩" }).click();
  await bootstrap.getByRole("heading", { name: "现在就开玩" }).waitFor({ timeout: 90_000 });
  const projectId = new URL(bootstrap.url()).pathname.split("/").at(-1);
  const origin = new URL(bootstrap.url()).origin;
  const { builds } = await (await bootstrap.request.get(`${origin}/api/projects/${projectId}?view=builds`)).json();
  const buildId = builds.at(-1).id;
  await bootstrap.close();

  const log = [];
  for (const vp of viewports) {
    for (const tier of ["high", "medium", "low"]) {
      const page = await browser.newPage({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.isMobile || false,
        hasTouch: vp.hasTouch || false,
        deviceScaleFactor: vp.deviceScaleFactor || 1,
      });
      const url = `${BASE}/play/${encodeURIComponent(buildId)}?tier=${tier}&perf=1`;
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
      const host = page.getByTestId("g3d-scene-host");
      await host.waitFor({ timeout: 30_000 });
      await page.locator("canvas").first().waitFor({ timeout: 30_000 }).catch(() => {});
      await page.waitForFunction(
        () => document.querySelector('[data-testid="g3d-scene-host"]')?.getAttribute("data-tier"),
        null,
        { timeout: 15_000 },
      ).catch(() => {});
      await page.waitForTimeout(2000);
      const attr = await host.getAttribute("data-tier");
      const file = path.join(OUT, `${vp.id}-tier-${tier}.png`);
      await page.screenshot({ path: file, fullPage: false });
      const snap = await page.evaluate(() => window.__godeskPerf?.snapshot?.() ?? null);
      log.push({ viewport: vp.id, requested: tier, dataTier: attr, snapshot: snap, file });
      console.log(vp.id, tier, "data-tier=", attr, "→", file);
      await page.close();
    }
  }

  // Settings page shot
  const settings = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await settings.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded" });
  await settings.getByTestId("render-quality-settings").waitFor();
  await settings.screenshot({ path: path.join(OUT, "settings-quality.png") });
  await settings.close();

  await writeFile(path.join(OUT, "tier-captures.json"), JSON.stringify(log, null, 2));
  await browser.close();
  console.log("done", OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
