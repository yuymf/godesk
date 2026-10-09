#!/usr/bin/env node
/**
 * Judge motion — locked camera + cloaked robber Mesh hop (R7 e2a5b3d path).
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
  });
  const drawer = page.locator("details.hex-settlement-board-targets");
  if (await drawer.count()) {
    const isOpen = await drawer.evaluate((el) => el.open || el.hasAttribute("open"));
    if (isOpen) await drawer.locator("summary").click({ force: true }).catch(() => {});
  }
  await page.keyboard.press("Escape").catch(() => {});
}

async function sampleYs(page, n = 3, gapMs = 80) {
  const out = [];
  for (let i = 0; i < n; i += 1) {
    out.push(await page.evaluate(() => globalThis.__g3dJudge?.debugRobber?.()));
    if (i < n - 1) await page.waitForTimeout(gapMs);
  }
  return out;
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
  // R18: +N source timeline (ghost-toast audit) + 3D boot reveal timeline (2D→3D residual audit).
  await page.addInitScript(() => {
    const t0 = performance.now();
    const tl = [];
    const boot = [];
    const prev = new Map();
    globalThis.__judgeIdSeq = 0;
    let lastBoot = "";
    const vis = (el) => {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") return 0;
      return Number(cs.opacity || "1");
    };
    setInterval(() => {
      const t = Math.round(performance.now() - t0);
      const seen = new Map();
      document.querySelectorAll(".g3d-judge-plusn-toast, .tidewell-resource-pop").forEach((el) => {
        // Key by element identity (index keys shift when HUD pops unmount → false rise/fall pairs).
        const i = (el.__judgeId ??= ++globalThis.__judgeIdSeq);
        const kind = el.classList.contains("g3d-judge-plusn-toast") ? "demo-toast" : "hud-pop";
        const op = kind === "demo-toast" && el.getAttribute("data-visible") !== "1" ? 0 : vis(el);
        const r = el.getBoundingClientRect();
        if (op > 0.05 && r.width > 0) seen.set(`${kind}#${i}`, { kind, text: (el.textContent || "").trim(), op: +op.toFixed(2), y: Math.round(r.top), onscreen: r.bottom > 0 && r.top < innerHeight });
      });
      for (const [k, v] of seen) if (!prev.has(k)) tl.push({ t, rise: true, ...v });
      for (const [k, v] of prev) if (!seen.has(k)) tl.push({ t, rise: false, kind: v.kind, text: v.text, y: v.y });
      prev.clear();
      for (const [k, v] of seen) prev.set(k, v);
      const host = document.querySelector('[data-testid="g3d-scene-host"]');
      const cv = host?.querySelector("canvas");
      const b = `${host?.getAttribute("data-boot") ?? "-"}|${cv ? getComputedStyle(cv).opacity : "-"}|water=${host?.getAttribute("data-water") ?? "-"}|props=${host?.getAttribute("data-terrain-props") ?? "-"}|pbr=${host?.getAttribute("data-pbr") ?? "-"}`;
      if (b !== lastBoot) { boot.push({ t, b }); lastBoot = b; }
      // R19: canvas fade length (CSS transition on the 3D canvas) for the boot report.
      if (cv && !globalThis.__judgeFadeCss) {
        const d = getComputedStyle(cv).transitionDuration;
        if (d && d !== "0s") globalThis.__judgeFadeCss = d;
      }
    }, 100);
    globalThis.__judgePlusN = () => tl;
    globalThis.__judgeBoot = () => boot;
  });
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
  await page.waitForTimeout(1000);
  await closeOverlays(page);

  // Fixed close-up on robber, then HARD LOCK (no pan/tilt/zoom for remaining tape).
  await page.evaluate(() => globalThis.__g3dJudge?.set?.("b-robber"));
  await page.waitForTimeout(900);
  const locked = await page.evaluate(() => globalThis.__g3dJudge?.lockCamera?.());
  log("camera locked", locked);
  await closeOverlays(page);

  const rest = await page.evaluate(() => {
    const r = globalThis.__g3dJudge?.debugRobber?.();
    return r ? { x: r.x, y: r.y, z: r.z } : null;
  });
  log("rest pose (pre-demo)", rest);

  const reduced = await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  log("prefers-reduced-motion", reduced);

  const tDemo = Date.now();
  const demo1 = await page.evaluate(() => globalThis.__g3dJudge.playMotionDemo());
  log("demo1", demo1);
  if (!demo1 || !demo1.hopMs) throw new Error("playMotionDemo failed");

  // Wait for elevated HOLD (demo ends hop at y = rest + apexHeight).
  const elevMin = (rest?.y ?? 0.28) + 2.0;
  const dir = path.dirname(OUT);
  const triple = [];
  const stills = [];
  let apexPose = null;
  for (let i = 0; i < 120 && stills.length < 3; i += 1) {
    const shot = await page.evaluate((minY) => {
      const api = globalThis.__g3dJudge;
      const pose = api?.debugRobber?.();
      if (!pose?.demo || pose.y < minY) return { pose, dataUrl: null };
      return api.captureFrame?.() ?? { pose, dataUrl: null };
    }, elevMin);
    if (shot?.dataUrl && shot.pose && shot.pose.y >= elevMin) {
      triple.push(shot.pose);
      stills.push(shot.dataUrl);
      if (!apexPose) apexPose = shot.pose;
      log("apex sample", stills.length, "y=", shot.pose.y.toFixed(2));
    } else if (stills.length > 0 && stills.length < 3) {
      // reset streak only if we dropped below after starting
      if (!shot?.pose || shot.pose.y < elevMin) {
        /* keep collecting — hold window is long */
      }
    }
    await page.waitForTimeout(50);
  }
  if (stills.length < 3) throw new Error(`self-fail: only ${stills.length}/3 elevated stills; last=${JSON.stringify(triple.at(-1))}`);
  log("apexPose", apexPose);
  // R9 FYI self-check: floating +N must stay stable across apex hold (no mid-hold hard cut).
  const toastSamples = [];
  for (let i = 0; i < 8; i += 1) {
    const t = await page.evaluate(() => {
      const el = document.querySelector(".g3d-judge-plusn-toast");
      if (!el || el.getAttribute("data-visible") !== "1") return null;
      return el.textContent || "";
    });
    if (t) toastSamples.push(t);
    await page.waitForTimeout(200);
  }
  const uniqueToast = [...new Set(toastSamples)];
  log("toastSamples", toastSamples);
  if (uniqueToast.length !== 1) {
    throw new Error(`self-fail: mid-hold +N hard cut → ${JSON.stringify(uniqueToast)}`);
  }
  const { writeFileSync } = await import("node:fs");
  const outNames = ["webm-hop-apex.png", "webm-hop-apex-a.png", "webm-hop-apex-b.png", "webm-hop-apex-c.png"];
  for (let i = 0; i < Math.min(3, stills.length); i++) {
    const b64 = stills[i].replace(/^data:image\/png;base64,/, "");
    writeFileSync(path.join(dir, outNames[i]), Buffer.from(b64, "base64"));
  }
  writeFileSync(path.join(dir, "webm-hop-apex-c.png"), Buffer.from(stills[Math.min(2, stills.length - 1)].replace(/^data:image\/png;base64,/, ""), "base64"));
  // Also Playwright screenshot during hold (compositor path) as backup
  await page.screenshot({ path: path.join(dir, "webm-hop-apex-pw.png"), type: "png" });
  const holdCheck = await page.evaluate(() => globalThis.__g3dJudge?.debugRobber?.());
  log("holdCheck after pw screenshot", holdCheck);

  // Finish hop1 + return + hop2 cycle
  await page.waitForTimeout(7500);
  await closeOverlays(page);
  // Re-assert lock (set must not be called again)
  await page.evaluate(() => globalThis.__g3dJudge?.lockCamera?.());
  const demo2 = await page.evaluate(() => globalThis.__g3dJudge.playMotionDemo());
  log("demo2", demo2);
  const triple2 = [];
  for (let i = 0; i < 80 && triple2.length < 3; i += 1) {
    const pose = await page.evaluate(() => globalThis.__g3dJudge?.debugRobber?.());
    if (pose?.demo && pose.y >= elevMin) triple2.push(pose);
    else if (triple2.length > 0 && triple2.length < 3) triple2.length = 0;
    await page.waitForTimeout(35);
  }
  log("apex2 triple", triple2.map((p) => ({ y: p.y, demo: p.demo })));
  if (triple2.length < 3) throw new Error(`self-fail hop2: only ${triple2.length}/3 elevated`);
  await page.waitForTimeout(9000);

  await closeOverlays(page);
  const banned = await page.evaluate(() => ({
    boardTargetsOpen: !!document.querySelector("details.hex-settlement-board-targets[open]"),
    ghost: !!document.querySelector(".g3d-judge-hop-ghost"),
  }));
  if (banned.ghost || banned.boardTargetsOpen) throw new Error(`banned UI: ${JSON.stringify(banned)}`);

  const plusNTimeline = await page.evaluate(() => globalThis.__judgePlusN?.() ?? []);
  const bootTimeline = await page.evaluate(() => globalThis.__judgeBoot?.() ?? []);
  const fadeCss = await page.evaluate(() => globalThis.__judgeFadeCss ?? null);
  // R19 boot summary: veil → reveal (data-boot ready) → canvas fully opaque; no 2D/cream frame in between.
  const opacityOf = (e) => Number(e.b.split("|")[1]);
  const revealAt = bootTimeline.find((e) => e.b.startsWith("ready"))?.t ?? null;
  const firstVisible = bootTimeline.find((e) => opacityOf(e) > 0)?.t ?? null;
  const fullAt = bootTimeline.find((e) => opacityOf(e) >= 1)?.t ?? null;
  const fade = {
    transitionCss: fadeCss,
    transitionMs: fadeCss ? Math.round(parseFloat(fadeCss) * (fadeCss.endsWith("ms") ? 1 : 1000)) : null,
    revealAt,
    firstVisibleAt: firstVisible,
    opaqueAt: fullAt,
    sampledFadeMs: firstVisible !== null && fullAt !== null ? fullAt - firstVisible : null,
    waterOnBeforeReveal: bootTimeline.some((e) => e.b.includes("water=on") && e.b.startsWith("pending")) || bootTimeline.find((e) => e.b.startsWith("ready"))?.b.includes("water=on") === true,
    pbrAtReveal: bootTimeline.find((e) => e.b.startsWith("ready"))?.b.split("pbr=")[1] ?? null,
  };
  const rises = plusNTimeline.filter((e) => e.rise);
  const falls = plusNTimeline.filter((e) => !e.rise);
  const riseKinds = [...new Set(rises.map((e) => e.kind))];
  // Ghost toast = the same demo gain floats up from more than one source / more than once per demo.
  const ghostToast = riseKinds.length > 1 || rises.filter((e) => e.kind === "demo-toast").length > 2;
  log("plusN rises", rises);
  log("boot timeline", bootTimeline);

  const video = page.video();
  await context.close();
  await browser.close();
  if (!video) throw new Error("no video");
  await copyFile(await video.path(), OUT);
  const meta = {
    out: OUT,
    demo1,
    demo2,
    rest,
    apexPose,
    toastLine: uniqueToast[0],
    toastSamples,
    triple: triple.map((p) => p && { y: p.y, x: p.x, z: p.z, demo: p.demo }),
    triple2: triple2.map((p) => p && { y: p.y, demo: p.demo }),
    reduced,
    locked,
    banned,
    demoWallMs: Date.now() - tDemo,
    plusN: { riseKinds, rises, falls, ghostToast },
    bootTimeline,
    fade,
    notes: "b-robber THEN lockCamera; Mesh hop apexHeight=2.6 hold-hover; 3 elevated Y samples; stable +N across apex hold (R9 FYI)",
  };
  await writeFile(OUT.replace(/\.webm$/, ".json"), JSON.stringify(meta, null, 2));
  log("wrote", OUT, meta);
}

main().catch((e) => { console.error(e); process.exit(1); });
