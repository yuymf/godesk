import { chromium } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const BASE = process.env.GODESK_BASE ?? "http://127.0.0.1:8799";
const OUT = process.env.GODESK_EVIDENCE_DIR
  ?? "/workspace/g3d-evidence/godesk-2026-10-13/tide-arena/trajectory/asset-vfx/mid-combat";
const PROMPT0 = "做一款两人自走棋，商店买棋上阵自动打架";
const SKILLS = ["螃蟹攻击带范围溅射", "巫师有治疗", "给新羁绊加护盾"];
const log = [];
const sha = (b) => createHash("sha256").update(b).digest("hex").slice(0, 16);

async function iterate(page, projectId, prompt) {
  await page.goto(`${BASE}/chatgpt-plugin/studio/${projectId}`);
  await page.locator("#iteration-prompt").fill(prompt);
  await page.getByRole("button", { name: /改下一版并试玩/ }).click();
  for (let i = 0; i < 90; i++) {
    const busy = await page.getByRole("button", { name: /正在改下一版/ }).count();
    if (!busy) break;
    await page.waitForTimeout(1000);
  }
  console.log("[iterate]", prompt);
}

async function fillBoard(page, board, n) {
  await page.waitForFunction(() => Boolean(window.__tideArena), null, { timeout: 30_000 });
  let placed = 0;
  for (let attempt = 0; attempt < 24 && placed < n; attempt++) {
    const cards = board.locator(".tide-arena-card:enabled");
    if (!(await cards.count())) {
      const refresh = board.getByRole("button", { name: "刷新" });
      if (await refresh.isEnabled().catch(() => false)) await refresh.click();
      await page.waitForTimeout(350);
      continue;
    }
    await cards.nth(0).click();
    await page.waitForTimeout(280);
    const from = await page.evaluate(() => window.__tideArena.screenOf({ kind: "bench", benchIndex: 0 }));
    const to = await page.evaluate((i) => window.__tideArena.screenOf({ kind: "cell", boardIndex: i }), placed);
    if (from?.x && to?.x) {
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(to.x, to.y, { steps: 6 });
      await page.mouse.up();
      placed += 1;
      await page.waitForTimeout(220);
    }
  }
  return placed;
}

const browser = await chromium.launch({ headless: true });
const host = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const guest = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await mkdir(OUT, { recursive: true });

try {
  console.log("[start]");
  await host.goto(`${BASE}/chatgpt-plugin/new`);
  await host.getByRole("textbox", { name: "描述你的游戏想法" }).fill(PROMPT0);
  await host.getByRole("button", { name: "生成可玩版本" }).click();
  await host.waitForURL(/\/chatgpt-plugin\/studio\//, { timeout: 120_000 });
  const projectId = new URL(host.url()).pathname.split("/").at(-1);
  console.log("[project]", projectId);
  await host.getByRole("button", { name: "确认玩法并开始试玩" }).click();
  await host.getByRole("heading", { name: "现在就开玩" }).waitFor({ timeout: 120_000 });
  for (const s of SKILLS) await iterate(host, projectId, s);

  const rule = await (await host.request.get(`${BASE}/api/projects/${projectId}?view=rule-system`)).json();
  await writeFile(join(OUT, "rule-system.json"), JSON.stringify(rule, null, 2));

  const sessions = await (await host.request.get(`${BASE}/api/projects/${projectId}?view=sessions`)).json();
  const u = new URL(sessions.sessions.at(-1).sessionUrl, BASE);
  u.searchParams.set("tier", "high");
  const room = u.toString();
  await Promise.all([host.goto(room), guest.goto(room)]);
  await host.waitForTimeout(1200);
  await guest.getByLabel("你的席位").selectOption("0");
  await host.getByLabel("你的席位").selectOption("1");
  const gBoard = guest.getByRole("region", { name: "潮阵对局" });
  const hBoard = host.getByRole("region", { name: "潮阵对局" });
  await gBoard.waitFor({ timeout: 60_000 });
  await hBoard.waitFor({ timeout: 60_000 });

  // Seat 0 acts first in shop
  const gp = await fillBoard(guest, gBoard, 3);
  console.log("[guest placed]", gp);
  await gBoard.getByRole("button", { name: /准备完毕/ }).click();
  // Seat 1 becomes active
  await host.waitForTimeout(800);
  const hp = await fillBoard(host, hBoard, 3);
  console.log("[host placed]", hp);
  log.push({ placed: { guest: gp, host: hp } });
  if (gp < 1 || hp < 1) throw new Error(`need units both sides, got guest=${gp} host=${hp}`);
  await hBoard.getByRole("button", { name: /准备完毕/ }).click();

  // Place phase: both lock
  await guest.waitForTimeout(600);
  const gLock = gBoard.getByRole("button", { name: /锁定阵容|准备完毕/ });
  const hLock = hBoard.getByRole("button", { name: /锁定阵容|准备完毕/ });
  if (await gLock.isEnabled().catch(() => false)) await gLock.click();
  await host.waitForTimeout(400);
  if (await hLock.isEnabled().catch(() => false)) await hLock.click();
  console.log("[locked]");

  const prepPng = await gBoard.screenshot({ path: join(OUT, "prep-control.png") });
  // Note: may already be in combat; still use as control if captured before seek
  const prepHash = sha(prepPng);

  await guest.waitForFunction(() => document.querySelector("[data-replay]")?.getAttribute("data-replay") === "playing", null, { timeout: 90_000 });
  await guest.waitForFunction(() => typeof window.__tideArena?.firstVfxAt === "function", null, { timeout: 10_000 });
  console.log("[replay playing]");

  // Re-take prep-like control from a pre-first-vfx seek if needed — use hash of frame at ms=0
  await guest.evaluate(() => window.__tideArena.seekReplay(0));
  await guest.waitForTimeout(200);
  const zeroBuf = await gBoard.screenshot({ path: join(OUT, "replay-t0.png") });
  const zeroHash = sha(zeroBuf);

  const hashes = { prep: prepHash, t0: zeroHash };
  const presets = [
    { preset: "shield", file: "mid-shield-ring.png" },
    { preset: "aoe", file: "mid-aoe-ring.png" },
    { preset: "heal", file: "mid-heal-glow.png" },
  ];
  for (const { preset, file } of presets) {
    let t = await guest.evaluate((p) => window.__tideArena.firstVfxAt(p), preset);
    console.log("[vfx]", preset, t);
    log.push({ preset, vfxAt: t });
    if (t < 0) t = 500;
    await guest.evaluate((ms) => window.__tideArena.seekReplay(ms), t + 120);
    await guest.waitForTimeout(280);
    const attr = await guest.evaluate(() => document.querySelector("[data-replay]")?.getAttribute("data-replay"));
    const buf = await gBoard.screenshot({ path: join(OUT, file) });
    const h = sha(buf);
    hashes[preset] = h;
    log.push({ preset, file, replayAttr: attr, hash: h });
    console.log("[shot]", file, attr, h);
    if (attr === "done") throw new Error(`${preset} on resolve/done`);
    if (h === zeroHash) throw new Error(`${preset} hash equals t0`);
  }

  await guest.evaluate(() => window.__tideArena.seekReplay(1e9));
  await guest.waitForTimeout(700);
  const resolveBuf = await gBoard.screenshot({ path: join(OUT, "resolve-control.png") });
  const resolveHash = sha(resolveBuf);
  hashes.resolve = resolveHash;
  for (const { preset } of presets) {
    if (hashes[preset] === resolveHash) throw new Error(`${preset} hash equals resolve`);
    log.push({ preset, neResolve: hashes[preset] !== resolveHash, neT0: hashes[preset] !== zeroHash });
  }

  await writeFile(join(OUT, "log.json"), JSON.stringify({ ok: true, projectId, hashes, log }, null, 2));
  console.log(JSON.stringify({ ok: true, projectId, hashes }, null, 2));
} catch (e) {
  console.error("FAIL", e);
  await guest.screenshot({ path: join(OUT, "error.png") }).catch(() => {});
  await writeFile(join(OUT, "log.json"), JSON.stringify({ error: String(e), stack: e.stack, log }, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}
