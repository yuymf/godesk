import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const BASE = process.env.GODESK_BASE ?? "http://127.0.0.1:8799";
const OUT = process.env.GODESK_EVIDENCE_DIR
  ?? "/workspace/g3d-evidence/godesk-2026-10-13/tide-arena/trajectory/asset-vfx";
const PROMPT0 = "做一款两人自走棋，商店买棋上阵自动打架";
const PROMPTS = [
  { id: "p1-aoe", text: "螃蟹攻击带范围溅射", shot: "combat-aoe-splash" },
  { id: "p2-heal", text: "巫师有治疗", shot: "combat-heal" },
  { id: "p3-shield", text: "给新羁绊加护盾", shot: "combat-shield" },
];
const log = [];

function digUnits(obj) {
  if (!obj || typeof obj !== "object") return [];
  if (Array.isArray(obj.units) && obj.units[0]?.id) return obj.units;
  for (const v of Object.values(obj)) {
    const f = digUnits(v);
    if (f.length) return f;
  }
  return [];
}
function digTraits(obj) {
  if (!obj || typeof obj !== "object") return [];
  if (Array.isArray(obj.traits) && obj.traits[0]?.id) return obj.traits;
  for (const v of Object.values(obj)) {
    const f = digTraits(v);
    if (f.length) return f;
  }
  return [];
}

async function iterate(page, projectId, prompt) {
  await page.goto(`${BASE}/chatgpt-plugin/studio/${projectId}`);
  await page.locator("#iteration-prompt").waitFor({ timeout: 30_000 });
  await page.locator("#iteration-prompt").fill(prompt);
  await page.getByRole("button", { name: /改下一版并试玩/ }).click();
  await page.waitForTimeout(2000);
  const confirm = page.getByRole("button", { name: /确认玩法|确认并/ });
  if (await confirm.count() && await confirm.first().isVisible()) await confirm.first().click();
  for (let i = 0; i < 150; i++) {
    const body = await page.locator("body").innerText();
    if (/规则校验通过|已保存/.test(body) && !/正在改下一版|正在处理/.test(body)) break;
    await page.waitForTimeout(1000);
  }
  const rule = await (await page.request.get(`${BASE}/api/projects/${projectId}?view=rule-system`)).json();
  const plan = await (await page.request.get(`${BASE}/api/projects/${projectId}?view=generation-plan`)).json();
  return { rule, plan };
}

async function runCombatShot(page, projectId, shotName) {
  const sessions = await (await page.request.get(`${BASE}/api/projects/${projectId}?view=sessions`)).json();
  const session = sessions.sessions?.at(-1);
  const u = new URL(session.sessionUrl, BASE);
  u.searchParams.set("tier", "high");
  // host + guest contexts
  const browser = page.context().browser();
  const guestCtx = await browser.newContext();
  const guest = await guestCtx.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await guest.setViewportSize({ width: 1440, height: 900 });
  await page.goto(u.toString());
  await guest.goto(u.toString());
  await page.waitForTimeout(800);
  try { await page.getByLabel("你的席位").selectOption("1"); } catch {}
  try { await guest.getByLabel("你的席位").selectOption("0"); } catch {}
  const gBoard = guest.getByRole("region", { name: "潮阵对局" });
  const hBoard = page.getByRole("region", { name: "潮阵对局" });
  await gBoard.waitFor({ timeout: 60_000 });
  await hBoard.waitFor({ timeout: 60_000 });

  async function buyPlace(p, board, cell) {
    for (let n = 0; n < 3; n++) {
      const card = board.locator(".tide-arena-card:enabled").first();
      if (!(await card.count())) break;
      await card.click();
      await p.waitForTimeout(300);
      const has = await p.evaluate(() => Boolean(window.__tideArena));
      if (!has) continue;
      const from = await p.evaluate(() => window.__tideArena.screenOf({ kind: "bench", benchIndex: 0 }));
      const to = await p.evaluate((c) => window.__tideArena.screenOf({ kind: "cell", boardIndex: c }), cell + n);
      if (from && to) {
        await p.mouse.move(from.x, from.y);
        await p.mouse.down();
        await p.mouse.move(to.x, to.y, { steps: 6 });
        await p.mouse.up();
      }
      await p.waitForTimeout(200);
    }
  }
  await buyPlace(guest, gBoard, 2);
  await buyPlace(page, hBoard, 2);
  // ready both
  const gReady = gBoard.getByRole("button", { name: "准备完毕" });
  const hReady = hBoard.getByRole("button", { name: "准备完毕" });
  if (await gReady.count()) await gReady.click();
  if (await hReady.count()) await hReady.click();
  // wait combat / replay
  await guest.waitForTimeout(2500);
  // try to catch mid combat text
  for (let i = 0; i < 40; i++) {
    const txt = await gBoard.innerText();
    if (/战斗|回放|攻击|射击|恢复|特效/.test(txt)) break;
    await guest.waitForTimeout(500);
  }
  await guest.waitForTimeout(800);
  await gBoard.screenshot({ path: join(OUT, `${shotName}.png`) });
  log.push({ shot: shotName, url: guest.url() });
  await guestCtx.close();
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await mkdir(OUT, { recursive: true });
try {
  await page.goto(`${BASE}/chatgpt-plugin/new`);
  await page.getByRole("textbox", { name: "描述你的游戏想法" }).fill(PROMPT0);
  await page.getByRole("button", { name: "生成可玩版本" }).click();
  await page.waitForURL(/\/chatgpt-plugin\/studio\//, { timeout: 120_000 });
  const projectId = new URL(page.url()).pathname.split("/").at(-1);
  await page.getByRole("button", { name: "确认玩法并开始试玩" }).click();
  await page.getByRole("heading", { name: "现在就开玩" }).waitFor({ timeout: 120_000 });

  for (const p of PROMPTS) {
    const res = await iterate(page, projectId, p.text);
    const units = digUnits(res.rule);
    const traits = digTraits(res.rule);
    const unsupported = res.plan?.generationPlan?.proposedRuntime?.config?.unsupported
      ?? res.rule?.runtimeSupport?.unsupported;
    log.push({
      step: p.id,
      prompt: p.text,
      crabFx: units.find((u) => u.id === "crab")?.combatFx,
      witchFx: units.find((u) => u.id === "witch")?.combatFx,
      traits: traits.map((t) => ({ id: t.id, label: t.label, effect: t.effect })),
      unsupported,
      notes: JSON.stringify(res.plan).match(/技能：[^\"]+/g)?.slice(0, 6),
    });
    await writeFile(join(OUT, `${p.id}-kernel.json`), JSON.stringify({
      units: units.filter((u) => ["crab", "witch"].includes(u.id)),
      traits: traits.filter((t) => t.effect),
    }, null, 2));
    await runCombatShot(page, projectId, p.shot);
  }
  await writeFile(join(OUT, "log-gap3.json"), JSON.stringify(log, null, 2));
  console.log(JSON.stringify({ ok: true, projectId, log }, null, 2));
} catch (e) {
  console.error("FAIL", e);
  await page.screenshot({ path: join(OUT, "error-gap3.png") }).catch(() => {});
  await writeFile(join(OUT, "log-gap3.json"), JSON.stringify(log.concat({ error: String(e), stack: e.stack }), null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}
