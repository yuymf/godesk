#!/usr/bin/env node
/**
 * G3D-JUDGE round-7 knife ④ — MUST show real robber hop + +N popup.
 * Uses ?judge=1 __g3dJudge.playMotionDemo() (real MotionController.hop + HUD event).
 * Also plays through setup placement so building drop-in is on tape.
 *
 *   node scripts/judge-motion-capture.mjs [--base URL] [--out path.webm]
 */
import { chromium } from "@playwright/test";
import { mkdir, copyFile, writeFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : f; };
const BASE = opt("base", process.env.JUDGE_BASE_URL || "http://127.0.0.1:8844/chatgpt-plugin");
const OUT = opt("out", "/workspace/g3d-evidence/judge/round-7/motion-hop-plusn.webm");
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
  await page.getByLabel("你的席位").selectOption("0").catch(async () => {
    await page.getByRole("radio", { name: /0/ }).first().click().catch(() => {});
  });
  await page.keyboard.press("Escape").catch(() => {});
  const board = page.getByRole("region", { name: "汐屿" });
  await page.locator("canvas").first().waitFor({ timeout: 60_000 });
  log("room ready — setup placements (building drop-in)");
  // Setup: place settlement + road so place() animation is on tape
  for (let i = 0; i < 2; i += 1) {
    const settle = board.getByRole("button", { name: /建造渔村|升级港镇/ }).first();
    if (await settle.isVisible().catch(() => false)) {
      await settle.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(900);
      // click a legal vertex on canvas — helper if available
      const canvas = page.locator("canvas").first();
      const box = await canvas.boundingBox();
      if (box) {
        await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.48);
        await page.waitForTimeout(600);
      }
    }
    const road = board.getByRole("button", { name: /铺设栈道/ }).first();
    if (await road.isVisible().catch(() => false)) {
      await road.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(500);
      const canvas = page.locator("canvas").first();
      const box = await canvas.boundingBox();
      if (box) await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
    }
    await page.waitForTimeout(2500);
  }
  log("waiting for __g3dJudge.playMotionDemo");
  await page.waitForFunction(() => typeof globalThis.__g3dJudge?.playMotionDemo === "function", null, { timeout: 60_000 });
  // Hold default framing and fire demo twice for clear hop + +N
  await page.evaluate(() => globalThis.__g3dJudge?.set?.("a-default"));
  await page.waitForTimeout(800);
  const ok1 = await page.evaluate(() => globalThis.__g3dJudge.playMotionDemo());
  log("demo1", ok1);
  await page.waitForTimeout(2800);
  const ok2 = await page.evaluate(() => globalThis.__g3dJudge.playMotionDemo());
  log("demo2", ok2);
  await page.waitForTimeout(3200);
  // Keep recording a beat on the +N / hopped board
  await page.waitForTimeout(1500);
  const video = page.video();
  await context.close();
  await browser.close();
  if (video) {
    const vpath = await video.path();
    await copyFile(vpath, OUT);
    log("wrote", OUT);
    await writeFile(OUT.replace(/\.webm$/, ".json"), JSON.stringify({ ok1, ok2, out: OUT }, null, 2));
  } else {
    throw new Error("no video recorded");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
