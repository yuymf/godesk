/**
 * Gap2 follow-up evidence: real CC0 crab + named imported attach.
 * Requires wrangler on :8799 and real 3d-asset-server on :8787 with local:rocky-shore-crab.
 */
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const BASE = process.env.GODESK_BASE ?? "http://127.0.0.1:8799";
const OUT = process.env.GODESK_EVIDENCE_DIR
  ?? "/workspace/g3d-evidence/godesk-2026-10-13/tide-arena/trajectory/asset-vfx";
const PROMPT0 = "做一款两人自走棋，商店买棋上阵自动打架";
const log = [];

async function waitJob(page, projectId, timeout = 180_000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const r = await page.request.get(`${BASE}/api/projects/${projectId}?view=jobs`);
    const j = await r.json();
    const jobs = j.jobs ?? j ?? [];
    const last = Array.isArray(jobs) ? jobs[0] : null;
    if (last && (last.status === "succeeded" || last.status === "failed")) return last;
    await page.waitForTimeout(1000);
  }
  throw new Error("job timeout");
}

async function snapBoard(page, name) {
  await page.waitForTimeout(600);
  const board = page.getByRole("region", { name: "潮阵对局" });
  if (await board.count()) {
    await board.screenshot({ path: join(OUT, `${name}.png`) });
  } else {
    await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: false });
  }
}

async function openRoomAndPlace(page, projectId, tag) {
  const sessions = await (await page.request.get(`${BASE}/api/projects/${projectId}?view=sessions`)).json();
  const session = sessions.sessions?.at(-1) ?? sessions.at?.(-1);
  let roomUrl = session?.sessionUrl ?? session?.url;
  if (!roomUrl) throw new Error("no session");
  const u = new URL(roomUrl, BASE);
  u.searchParams.set("tier", "high");
  await page.goto(u.toString());
  await page.waitForTimeout(1500);
  // pick seat if needed
  const seat = page.getByLabel("你的席位");
  if (await seat.count()) {
    try { await seat.selectOption("0"); } catch {}
  }
  const board = page.getByRole("region", { name: "潮阵对局" });
  await board.waitFor({ timeout: 60_000 });
  // buy + place one unit if shop open
  const card = board.locator(".tide-arena-card:enabled").first();
  if (await card.count()) {
    await card.click();
    await page.waitForTimeout(400);
    const hasArena = await page.evaluate(() => Boolean(window.__tideArena));
    if (hasArena) {
      const from = await page.evaluate(() => window.__tideArena.screenOf({ kind: "bench", benchIndex: 0 }));
      const to = await page.evaluate(() => window.__tideArena.screenOf({ kind: "cell", boardIndex: 3 }));
      if (from && to) {
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await page.mouse.move(to.x, to.y, { steps: 8 });
        await page.mouse.up();
      }
    }
  }
  await snapBoard(page, tag);
  const models = await page.evaluate(() => {
    const host = document.querySelector("[data-imported-models], [data-tide-arena]");
    return {
      importedAttr: document.querySelector("[data-imported-models]")?.getAttribute("data-imported-models"),
      hasTideArena: Boolean(window.__tideArena),
    };
  });
  log.push({ tag, room: page.url(), models });
  return page.url();
}

async function iterate(page, projectId, prompt) {
  await page.goto(`${BASE}/chatgpt-plugin/studio/${projectId}`);
  await page.locator("#iteration-prompt").waitFor({ timeout: 30_000 });
  await page.locator("#iteration-prompt").fill(prompt);
  const btn = page.getByRole("button", { name: /改下一版并试玩/ });
  await btn.click();
  // may need confirm plan
  await page.waitForTimeout(2000);
  const confirm = page.getByRole("button", { name: /确认玩法|确认并/ });
  if (await confirm.count() && await confirm.first().isVisible()) {
    await confirm.first().click();
  }
  await page.waitForTimeout(3000);
  // wait for job
  for (let i = 0; i < 120; i++) {
    const body = await page.locator("body").innerText();
    if (/规则校验通过|已保存|改下一版并试玩/.test(body) && !/正在改下一版|正在处理/.test(body)) break;
    await page.waitForTimeout(1000);
  }
  const rule = await (await page.request.get(`${BASE}/api/projects/${projectId}?view=rule-system`)).json();
  const plan = await (await page.request.get(`${BASE}/api/projects/${projectId}?view=generation-plan`)).json();
  return { rule, plan };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await mkdir(OUT, { recursive: true });

try {
  // health
  const h = await fetch("http://127.0.0.1:8787/health").then(r => r.json());
  const search = await fetch("http://127.0.0.1:8787/v1/search?q=crab&type=model&free=true&downloadable=true&limit=5").then(r => r.json());
  log.push({ sidecar: h, crabTop: (search.results ?? []).slice(0, 3).map(r => ({ id: r.id, title: r.title, lic: r.license?.name, formats: r.formats })) });

  await page.goto(`${BASE}/chatgpt-plugin/new`);
  await page.getByRole("textbox", { name: "描述你的游戏想法" }).fill(PROMPT0);
  await page.getByRole("button", { name: "生成可玩版本" }).click();
  await page.waitForURL(/\/chatgpt-plugin\/studio\//, { timeout: 120_000 });
  const projectId = new URL(page.url()).pathname.split("/").at(-1);
  await page.screenshot({ path: join(OUT, "r0-plan.png") });
  await page.getByRole("button", { name: "确认玩法并开始试玩" }).click();
  await page.getByRole("heading", { name: "现在就开玩" }).waitFor({ timeout: 120_000 });
  await page.screenshot({ path: join(OUT, "r0-studio.png") });

  await openRoomAndPlace(page, projectId, "before-default-place");

  // p1 real crab model
  const p1 = await iterate(page, projectId, "给螃蟹换螃蟹模型");
  const units1 = p1.rule?.runtimeSupport?.kernel?.content?.units
    ?? p1.rule?.runtimeSupport?.config?.content?.units
    ?? [];
  // dig units from runtimeSupport
  const digUnits = (rule) => {
    const rs = rule?.runtimeSupport ?? rule;
    const k = rs?.kernel ?? rs;
    return k?.content?.units ?? k?.config?.content?.units ?? rs?.content?.units ?? [];
  };
  const u1 = digUnits(p1.rule);
  const crab1 = (u1.length ? u1 : digDeep(p1.rule)).find?.(x => x.id === "crab");
  function digDeep(obj, path = []) {
    if (!obj || typeof obj !== "object") return [];
    if (Array.isArray(obj.units) && obj.units[0]?.id) return obj.units;
    for (const v of Object.values(obj)) {
      const f = digDeep(v);
      if (f.length) return f;
    }
    return [];
  }
  const unitsP1 = digDeep(p1.rule);
  log.push({
    step: "p1-crab-search",
    prompt: "给螃蟹换螃蟹模型",
    crab: unitsP1.find(u => u.id === "crab"),
    unsupported: p1.plan?.generationPlan?.proposedRuntime?.config?.unsupported
      ?? p1.rule?.runtimeSupport?.unsupported,
    planUnsupported: JSON.stringify(p1.plan).slice(0, 2000),
  });
  await writeFile(join(OUT, "p1-kernel.json"), JSON.stringify({ units: unitsP1.filter(u => ["crab","witch"].includes(u.id)) }, null, 2));
  await openRoomAndPlace(page, projectId, "after-crab-model-place");
  await page.goto(`${BASE}/chatgpt-plugin/studio/${projectId}`);
  await page.screenshot({ path: join(OUT, "p1-crab-search-studio.png") });

  // p2 named import
  const p2 = await iterate(page, projectId, "用刚导入的 rocky-shore-crab.glb 挂到巫师");
  const unitsP2 = digDeep(p2.rule);
  log.push({
    step: "p2-named-import",
    prompt: "用刚导入的 rocky-shore-crab.glb 挂到巫师",
    witch: unitsP2.find(u => u.id === "witch"),
    unsupported: p2.plan?.generationPlan?.proposedRuntime?.config?.unsupported
      ?? p2.rule?.runtimeSupport?.unsupported,
  });
  await writeFile(join(OUT, "p2-kernel.json"), JSON.stringify({ units: unitsP2.filter(u => ["crab","witch"].includes(u.id)) }, null, 2));
  await openRoomAndPlace(page, projectId, "after-named-import-witch");
  await page.goto(`${BASE}/chatgpt-plugin/studio/${projectId}`);
  await page.screenshot({ path: join(OUT, "p2-named-import-studio.png") });

  await writeFile(join(OUT, "log-gap2.json"), JSON.stringify(log, null, 2));
  await writeFile(join(OUT, "rule-system-gap2.json"), JSON.stringify(p2.rule, null, 2));
  console.log(JSON.stringify({ ok: true, projectId, crab: unitsP1.find(u => u.id === "crab"), witch: unitsP2.find(u => u.id === "witch") }, null, 2));
} catch (e) {
  console.error("FAIL", e);
  await page.screenshot({ path: join(OUT, "error.png") }).catch(() => {});
  await writeFile(join(OUT, "log-gap2.json"), JSON.stringify(log.concat({ error: String(e), stack: e.stack }), null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}
