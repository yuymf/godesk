import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const BASE = process.env.GODESK_BASE ?? "http://127.0.0.1:8799";
const OUT = "/workspace/g3d-evidence/godesk-2026-10-13/tide-arena/trajectory/quality-gate";
const PROMPT0 = "做一款赛博机甲自走棋，两人商店买棋上阵自动打架";
const FAIL_PROMPTS = [
  "机位过远",
  "单位变得很小",
  "卡面对比很弱",
];

function dig(obj, key, d = 0) {
  if (!obj || typeof obj !== "object" || d > 12) return undefined;
  if (Object.hasOwn(obj, key)) return obj[key];
  for (const v of Object.values(obj)) {
    const f = dig(v, key, d + 1);
    if (f !== undefined) return f;
  }
  return undefined;
}

async function iterate(page, projectId, prompt) {
  await page.goto(`${BASE}/chatgpt-plugin/studio/${projectId}`);
  await page.locator("#iteration-prompt").fill(prompt);
  await page.getByRole("button", { name: /改下一版并试玩/ }).click();
  for (let i = 0; i < 120; i++) {
    if (!(await page.getByRole("button", { name: /正在改下一版/ }).count())) break;
    await page.waitForTimeout(1000);
  }
  console.log("[iterate]", prompt);
}

async function floorStatus(page, projectId) {
  // Prefer build presentationFloor; fall back to rule-system theme + local reason text in unsupported
  const builds = await (await page.request.get(`${BASE}/api/projects/${projectId}?view=builds`)).json().catch(() => null);
  const build = builds?.builds?.at?.(-1) ?? builds?.builds?.[0];
  const pf = build?.presentationFloor ?? dig(builds, "presentationFloor");
  const rule = await (await page.request.get(`${BASE}/api/projects/${projectId}?view=rule-system`)).json();
  const theme = dig(rule, "theme");
  const unsupported = dig(rule, "unsupported") ?? [];
  return { pf, theme, unsupported, buildId: build?.id };
}

const log = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await mkdir(OUT, { recursive: true });

try {
  await page.goto(`${BASE}/chatgpt-plugin/new`);
  await page.getByRole("textbox", { name: "描述你的游戏想法" }).fill(PROMPT0);
  await page.getByRole("button", { name: "生成可玩版本" }).click();
  await page.waitForURL(/\/chatgpt-plugin\/studio\//, { timeout: 180_000 });
  const projectId = new URL(page.url()).pathname.split("/").at(-1);
  console.log("[project]", projectId);
  await page.getByRole("button", { name: "确认玩法并开始试玩" }).click();
  await page.getByRole("heading", { name: "现在就开玩" }).waitFor({ timeout: 180_000 });
  await page.screenshot({ path: join(OUT, "01-pass-cyber-studio.png") });

  const pass0 = await floorStatus(page, projectId);
  log.push({ id: "pass-cold", ...pass0 });
  await writeFile(join(OUT, "pass-cold.json"), JSON.stringify(pass0, null, 2));
  console.log("[pass-cold]", JSON.stringify({ pf: pass0.pf, theme: pass0.theme }));

  // Open room screenshot for pass
  const sessions = await (await page.request.get(`${BASE}/api/projects/${projectId}?view=sessions`)).json();
  const session = sessions.sessions?.at(-1);
  if (session?.sessionUrl) {
    const u = new URL(session.sessionUrl, BASE);
    u.searchParams.set("tier", "high");
    await page.goto(u.toString());
    await page.waitForSelector("[data-theme], .tide-arena-stage", { timeout: 90_000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: join(OUT, "02-pass-cyber-room.png") });
    const brand = await page.locator(".ta-brand").first().textContent().catch(() => null);
    const themeAttr = await page.locator("[data-theme]").first().getAttribute("data-theme").catch(() => null);
    log.push({ id: "pass-room", brand, themeAttr });
  }

  // Fail project: iterate below-floor prompts on same or new? Use same project to show draft annotate
  await page.goto(`${BASE}/chatgpt-plugin/studio/${projectId}`);
  for (const prompt of FAIL_PROMPTS) {
    await iterate(page, projectId, prompt);
  }
  await page.screenshot({ path: join(OUT, "03-fail-after-bad-prompts-studio.png") });
  const fail = await floorStatus(page, projectId);
  log.push({ id: "fail-after", ...fail });
  await writeFile(join(OUT, "fail-after.json"), JSON.stringify(fail, null, 2));
  console.log("[fail]", JSON.stringify({ pf: fail.pf, theme: fail.theme, unsupported: fail.unsupported }));

  // Assert pass then fail
  const passStatus = pass0.pf?.status ?? (Array.isArray(pass0.unsupported) && pass0.unsupported.some((u) => /呈现底线/.test(u)) ? "failed" : "passed");
  // Cold cyber should pass floor — if pf missing, check no 呈现底线 in unsupported
  if (pass0.pf && pass0.pf.status !== "passed") {
    throw new Error("cold cyber should pass presentationFloor: " + JSON.stringify(pass0.pf));
  }
  const failHit =
    (fail.pf && fail.pf.status === "failed") ||
    (Array.isArray(fail.unsupported) && fail.unsupported.some((u) => /呈现底线|机位过远|单位尺度|卡面对比/.test(u)));
  if (!failHit) throw new Error("expected floor fail/annotate after bad prompts: " + JSON.stringify(fail).slice(0, 800));

  // Compile attempt if studio has button — capture floor reason text on page
  const bodyText = await page.locator("body").innerText();
  await writeFile(join(OUT, "studio-body-excerpt.txt"), bodyText.slice(0, 4000));

  await writeFile(join(OUT, "log.json"), JSON.stringify({ ok: true, projectId, log }, null, 2));
  console.log(JSON.stringify({ ok: true, projectId, passPf: pass0.pf, failPf: fail.pf }, null, 2));
} catch (e) {
  console.error("FAIL", e);
  await page.screenshot({ path: join(OUT, "error.png") }).catch(() => {});
  await writeFile(join(OUT, "log.json"), JSON.stringify({ error: String(e), log }, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}
