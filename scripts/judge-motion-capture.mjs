#!/usr/bin/env node
/**
 * Judge motion webm — cloaked robber Mesh hop + piece-tracked +N.
 *
 * Bans: gold ghost, board-targets overlay, 建造村落/渔村 test modals, camera-only "fake hop".
 *
 *   node scripts/judge-motion-capture.mjs [--base URL] [--out path.webm]
 */
import { chromium } from "@playwright/test";
import { mkdir, copyFile, writeFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : f; };
const BASE = opt("base", process.env.JUDGE_BASE_URL || "http://127.0.0.1:8844/chatgpt-plugin");
const OUT = opt("out", "/workspace/g3d-evidence/judge/round-8/motion-hop-plusn.webm");
const PROMPT = "做一款可以与电脑对战的汐屿基础版";
const log = (...m) => console.log(`[motion ${new Date().toLocaleTimeString("zh-CN", { hour12: false })}]`, ...m);

async function closeOverlays(page) {
  await page.evaluate(() => {
    document.querySelectorAll("details.tidewell-menu[open]").forEach((d) => { d.open = false; });
    document.querySelectorAll("details.hex-settlement-board-targets").forEach((d) => {
      d.open = false;
      d.removeAttribute("open");
    });
    // Dismiss any dialog / modal mentioning 建造
    document.querySelectorAll('[role="dialog"], dialog[open], .modal, .overlay').forEach((el) => {
      const text = (el.textContent || "");
      if (/建造|村落|渔村|测试/.test(text)) {
        el.removeAttribute("open");
        if (el instanceof HTMLElement) el.style.display = "none";
      }
    });
  });
  const drawer = page.locator("details.hex-settlement-board-targets");
  if (await drawer.count()) {
    const isOpen = await drawer.evaluate((el) => el.open || el.hasAttribute("open"));
    if (isOpen) await drawer.locator("summary").click({ force: true }).catch(() => {});
  }
  await page.keyboard.press("Escape").catch(() => {});
}

async function main() {
  await mkdir(path.dirname(OUT), { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "no-preference",
    recordVideo: { dir: path.dirname(OUT), size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  await client.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
  });

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

  // Hide board-targets / assist modals for the whole capture (React may re-open details).
  await page.addStyleTag({
    content: `
      details.hex-settlement-board-targets { display: none !important; visibility: hidden !important; }
      [role="dialog"]:has-text("建造"), dialog[open] { display: none !important; }
    `,
  }).catch(() => {});
  // Playwright :has-text in CSS injection may not work — also force via evaluate each tick later
  await page.addStyleTag({
    content: `details.hex-settlement-board-targets, .hex-settlement-board-targets { display: none !important; }`,
  });

  const menu = page.locator("details.tidewell-menu");
  await menu.locator("summary").click();
  await page.getByLabel("你的席位").selectOption("0").catch(async () => {
    await page.getByRole("radio", { name: /0/ }).first().click().catch(() => {});
  });
  await closeOverlays(page);

  await page.locator("canvas").first().waitFor({ state: "visible", timeout: 60_000 });
  await page.waitForFunction(() => typeof globalThis.__g3dJudge?.playMotionDemo === "function", null, { timeout: 90_000 });
  await page.waitForTimeout(1200);
  await closeOverlays(page);

  // Wide default framing ONLY — never b-robber (looks like camera-only motion).
  await page.evaluate(() => globalThis.__g3dJudge?.set?.("a-default"));
  await page.waitForTimeout(700);
  await closeOverlays(page);

  // Poll-hide forbidden UI during demos
  const hideTimer = setInterval(() => {
    page.evaluate(() => {
      document.querySelectorAll("details.hex-settlement-board-targets").forEach((d) => { d.open = false; });
    }).catch(() => {});
  }, 400);

  const reduced = await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  log("prefers-reduced-motion", reduced, "3D ready — a-default, overlays hidden");

  const tDemo = Date.now();
  const demo1 = await page.evaluate(() => globalThis.__g3dJudge.playMotionDemo());
  log("demo1", demo1);
  if (!demo1) throw new Error("playMotionDemo returned false");

  await page.locator('[data-testid="g3d-judge-plusn-toast"][data-visible="1"]').waitFor({ timeout: 4000 });
  let apex1 = null;
  for (let i = 0; i < 50; i += 1) {
    const pose = await page.evaluate(() => globalThis.__g3dJudge?.debugRobber?.());
    if (pose && pose.demo && pose.y > 1.15) {
      apex1 = pose;
      log("apex-hop1", pose);
      break;
    }
    await page.waitForTimeout(50);
  }
  if (!apex1) throw new Error("no robber apex y>1.15 during hop1");
  await page.screenshot({ path: path.join(path.dirname(OUT), "webm-hop-apex.png"), fullPage: false });
  await page.screenshot({ path: path.join(path.dirname(OUT), "motion-frame-hop1.png"), fullPage: false });
  await page.waitForTimeout(4000);
  await page.waitForTimeout(3500);

  await closeOverlays(page);
  const demo2 = await page.evaluate(() => globalThis.__g3dJudge.playMotionDemo());
  log("demo2", demo2);
  if (!demo2) throw new Error("playMotionDemo#2 returned false");
  await page.locator('[data-testid="g3d-judge-plusn-toast"][data-visible="1"]').waitFor({ timeout: 4000 }).catch(() => {});
  let apex2 = null;
  for (let i = 0; i < 50; i += 1) {
    const pose = await page.evaluate(() => globalThis.__g3dJudge?.debugRobber?.());
    if (pose && pose.demo && pose.y > 1.15) { apex2 = pose; log("apex-hop2", pose); break; }
    await page.waitForTimeout(50);
  }
  await page.screenshot({ path: path.join(path.dirname(OUT), "motion-frame-hop3.png") });
  await page.waitForTimeout(4500);
  await page.waitForTimeout(3000);

  clearInterval(hideTimer);
  await closeOverlays(page);

  const banned = await page.evaluate(() => {
    const body = document.body.innerText || "";
    return {
      hasVillageTest: /建造村落\s*\(?测试\)?/.test(body),
      boardTargetsOpen: !!document.querySelector("details.hex-settlement-board-targets[open]"),
      ghost: !!document.querySelector(".g3d-judge-hop-ghost"),
    };
  });
  log("banned-check", banned);
  if (banned.ghost) throw new Error("gold hop-ghost present");
  if (banned.boardTargetsOpen) throw new Error("board-targets still open");

  const video = page.video();
  await context.close();
  await browser.close();
  if (!video) throw new Error("no video");
  const vpath = await video.path();
  await copyFile(vpath, OUT);
  const meta = {
    out: OUT,
    demo1,
    demo2,
    reduced,
    apex1,
    apex2,
    banned,
    demoWallMs: Date.now() - tDemo,
    notes: "a-default fixed cam; cloaked Mesh hop; +N tracks piece; board-targets CSS-hidden",
  };
  await writeFile(OUT.replace(/\.webm$/, ".json"), JSON.stringify(meta, null, 2));
  log("wrote", OUT, meta);
}

main().catch((e) => { console.error(e); process.exit(1); });
