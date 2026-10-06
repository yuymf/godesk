#!/usr/bin/env node
/**
 * G3D-JUDGE knife ④ — record robber hop + resource +N popup.
 *   node scripts/judge-motion-capture.mjs [--base URL] [--out path.webm]
 */
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : f; };
const BASE = opt("base", process.env.JUDGE_BASE_URL || "http://127.0.0.1:8844/chatgpt-plugin");
const OUT = opt("out", "/workspace/g3d-evidence/judge/round-6/motion-hop-plusn.webm");
const PROMPT = "做一款可以与电脑对战的汐屿基础版";

const log = (...m) => console.log(`[motion ${new Date().toLocaleTimeString("zh-CN", { hour12: false })}]`, ...m);

async function main() {
  await mkdir(path.dirname(OUT), { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: path.dirname(OUT), size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/new`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("textbox", { name: "描述你的游戏想法" }).fill(PROMPT);
  await page.getByRole("button", { name: "生成可玩版本" }).click();
  await page.waitForURL(/\/studio\//, { timeout: 120_000 });
  await page.getByRole("button", { name: "确认玩法并开始试玩" }).click();
  await page.getByRole("heading", { name: "现在就开玩" }).waitFor({ timeout: 120_000 });
  const projectId = new URL(page.url()).pathname.split("/").at(-1);
  await page.goto(`${BASE}/games`, { waitUntil: "domcontentloaded" });
  const card = page.locator(".lobby-card").filter({ has: page.locator(`a[href$="/studio/${projectId}"]`) });
  await card.getByRole("button", { name: "和电脑对战" }).click();
  await page.waitForURL(/\/room\//, { timeout: 60_000 });
  const url = new URL(page.url());
  url.searchParams.set("judge", "1");
  await page.goto(url.href, { waitUntil: "domcontentloaded" });
  const menu = page.locator("details.tidewell-menu");
  await menu.locator("summary").click();
  await page.getByRole("radio", { name: /0|席位 0|座位 0/ }).first().click().catch(() => {});
  await page.keyboard.press("Escape").catch(() => {});
  log("room ready — sampling 90s for hop / +N");
  // poke legal actions to progress toward robber move / gains
  const end = Date.now() + 90_000;
  while (Date.now() < end) {
    const btn = page.getByRole("button").filter({ hasText: /掷骰|铺设|建造|升级|结束回合|移动雾灯/ }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ timeout: 2000 }).catch(() => {});
    }
    await page.waitForTimeout(1500);
  }
  const video = page.video();
  await context.close();
  await browser.close();
  if (video) {
    const vpath = await video.path();
    const { copyFile } = await import("node:fs/promises");
    await copyFile(vpath, OUT);
    log("wrote", OUT);
  } else {
    await writeFile(OUT.replace(/\.webm$/, ".txt"), "no video — check playwright recordVideo\n");
    log("no video");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
