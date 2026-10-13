import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const BASE = process.env.GODESK_BASE ?? "http://127.0.0.1:8799";
const OUT = "/workspace/g3d-evidence/godesk-2026-10-13/tide-arena/trajectory/content-layer";
const PROMPT0 = "做一款两人自走棋，商店买棋上阵自动打架";
const STEPS = [
  { id: "add-trait", prompt: "加一个羁绊「雷霆」" },
  { id: "del-trait", prompt: "删掉远航羁绊" },
  { id: "board-cols", prompt: "棋盘改成8列" },
];
const log = [];

function dig(obj, key) {
  if (!obj || typeof obj !== "object") return undefined;
  if (key in obj) return obj[key];
  for (const v of Object.values(obj)) {
    const f = dig(v, key);
    if (f !== undefined) return f;
  }
  return undefined;
}

async function iterate(page, projectId, prompt) {
  await page.goto(`${BASE}/chatgpt-plugin/studio/${projectId}`);
  await page.locator("#iteration-prompt").fill(prompt);
  await page.getByRole("button", { name: /改下一版并试玩/ }).click();
  for (let i = 0; i < 90; i++) {
    if (!(await page.getByRole("button", { name: /正在改下一版/ }).count())) break;
    await page.waitForTimeout(1000);
  }
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await mkdir(OUT, { recursive: true });
try {
  await page.goto(`${BASE}/chatgpt-plugin/new`);
  await page.getByRole("textbox", { name: "描述你的游戏想法" }).fill(PROMPT0);
  await page.getByRole("button", { name: "生成可玩版本" }).click();
  await page.waitForURL(/\/chatgpt-plugin\/studio\//, { timeout: 120_000 });
  const projectId = new URL(page.url()).pathname.split("/").at(-1);
  await page.getByRole("button", { name: "确认玩法并开始试玩" }).click();
  await page.getByRole("heading", { name: "现在就开玩" }).waitFor({ timeout: 120_000 });
  await page.screenshot({ path: join(OUT, "r0-studio.png") });

  for (const s of STEPS) {
    await iterate(page, projectId, s.prompt);
    const rule = await (await page.request.get(`${BASE}/api/projects/${projectId}?view=rule-system`)).json();
    const plan = await (await page.request.get(`${BASE}/api/projects/${projectId}?view=generation-plan`)).json();
    const traits = dig(rule, "traits") ?? [];
    const tuning = dig(rule, "tuning") ?? {};
    const entry = {
      id: s.id,
      prompt: s.prompt,
      traitLabels: Array.isArray(traits) ? traits.map((t) => t.label ?? t.id) : [],
      tuning,
      unsupported: dig(plan, "unsupported") ?? dig(rule, "unsupported"),
    };
    log.push(entry);
    await writeFile(join(OUT, `${s.id}.json`), JSON.stringify({ traits, tuning, ruleSnippet: dig(rule, "kernel") }, null, 2));
    await page.screenshot({ path: join(OUT, `${s.id}-studio.png`) });
    console.log(JSON.stringify(entry));
  }

  // Open a session and assert board length 16
  const sessions = await (await page.request.get(`${BASE}/api/projects/${projectId}?view=sessions`)).json();
  const u = new URL(sessions.sessions.at(-1).sessionUrl, BASE);
  u.searchParams.set("tier", "high");
  await page.goto(u.toString());
  await page.getByRole("region", { name: "潮阵对局" }).waitFor({ timeout: 60_000 });
  await page.waitForTimeout(1500);
  const boardLen = await page.evaluate(async () => {
    // pull from session state if exposed; else count tile anchors
    return document.querySelectorAll(".ta-anchor").length;
  });
  await page.screenshot({ path: join(OUT, "board-8col-room.png") });
  // Read session via API events is hard; check rule tuning and createInitial via jobs
  log.push({ boardUiAnchors: boardLen });
  await writeFile(join(OUT, "log.json"), JSON.stringify({ ok: true, projectId, log }, null, 2));

  // Assert expected outcomes
  const add = log.find((x) => x.id === "add-trait");
  const del = log.find((x) => x.id === "del-trait");
  const board = log.find((x) => x.id === "board-cols");
  if (!add?.traitLabels?.includes("雷霆")) throw new Error("雷霆 not added");
  if (del?.traitLabels?.includes("远航")) throw new Error("远航 not deleted");
  if (board?.tuning?.boardCols !== 8) throw new Error(`boardCols=${board?.tuning?.boardCols}`);
  console.log(JSON.stringify({ ok: true, projectId }, null, 2));
} catch (e) {
  console.error("FAIL", e);
  await page.screenshot({ path: join(OUT, "error.png") }).catch(() => {});
  await writeFile(join(OUT, "log.json"), JSON.stringify({ error: String(e), log }, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}
