#!/usr/bin/env node
/**
 * G3D-17 上线前清单（发布闸门）自动化 —— 当前为 warning 模式，G3D-17 时一键改为阻断。
 *
 * 检查项（id）：
 *   asset-legal        `LicenseRef-AI-Generated` 待法务审查条数（`verify-assets --json` 的 summary.aiPendingLegalReview），须为 0
 *   size-budgets       size-limit + scripts/check-size-budgets.mjs（需要先 `pnpm build`）；超限 = fail，余量 < 2% = warn
 *   lighthouse         lighthouserc.json 里仍为 "warn" 级的断言（LCP / TBT / CLS）；给了 --lighthouse 目录时按 median-run 对照阈值
 *   draw-calls         perf:ci 报告（ci-budgets.json → launchChecklist.tierDrawCalls）按档位对照 SPEC §4.6.3（high 150 / medium 100 / low 60）
 *   hud-raw-action-ids perf:ci 报告（launchChecklist.hudRawActionIds）：Room 可见文本 / aria-label 中的原始动作 id 数，须为 0
 *
 * 状态：pass / warn / fail / missing（输入缺失）。
 * 模式：
 *   warn（默认）：只输出报告与 GitHub ::warning 注解，退出码 0（脚本自身出错除外）。
 *   block       ：任一检查项非 pass → 退出码 1。G3D-17 时把 CI 的 GODESK_LAUNCH_GATE 设为 block（见 docs/perf/launch-checklist.md）。
 *   --block <id,...> / GODESK_LAUNCH_GATE_BLOCK：warn 模式下只让列出的检查项阻断（逐项转正）。
 *
 * 用法：
 *   node scripts/launch-checklist.mjs [--perf perf-results/ci-budgets.json] [--lighthouse .lighthouseci]
 *        [--only id,...] [--mode warn|block] [--block id,...] [--out launch-checklist.json]
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { TIER_BUDGETS } from "./perf/budgets.mjs";

export const CHECK_IDS = ["asset-legal", "size-budgets", "lighthouse", "draw-calls", "hud-raw-action-ids"];
const TITLES = {
  "asset-legal": "AI 生成资产法务审查清零",
  "size-budgets": "包体预算",
  lighthouse: "Lighthouse LCP / TBT / CLS 阈值（warn → error）",
  "draw-calls": "分档 draw call 预算（§4.6.3）",
  "hud-raw-action-ids": "HUD 不露原始动作 id",
};
/** size 余量低于该比例记 warn。 */
export const SIZE_HEADROOM_WARN_RATIO = 0.02;

const item = (id, status, summary, details = {}) => ({ id, title: TITLES[id], status, summary, details });

// ---------- 纯评估函数（scripts/launch-checklist.test.mjs 覆盖） ----------

/** @param {{ ok?: boolean, summary?: { aiPendingLegalReview?: number }, errors?: string[] } | null} verify */
export function evaluateAssetLegal(verify) {
  if (!verify?.summary) return item("asset-legal", "missing", "未拿到 verify-assets 摘要");
  const pending = verify.summary.aiPendingLegalReview ?? 0;
  const details = { aiPendingLegalReview: pending, verifyAssetsOk: verify.ok ?? null, verifyAssetsErrors: verify.errors?.length ?? 0 };
  if (verify.ok === false) return item("asset-legal", "fail", `verify-assets 本身失败（${details.verifyAssetsErrors} 个错误）`, details);
  if (pending > 0) return item("asset-legal", "warn", `${pending} 项 LicenseRef-AI-Generated 待法务审查（须清零）`, details);
  return item("asset-legal", "pass", "无待法务审查的 AI 生成资产", details);
}

/**
 * @param {{ sizeLimit: Array<{ name: string, size: number, sizeLimit: number, passed: boolean }> | null, budgetLines: string[] | null }} input
 */
export function evaluateSizeBudgets({ sizeLimit, budgetLines }) {
  if (!sizeLimit && !budgetLines) return item("size-budgets", "missing", "未拿到 size-limit / check-size-budgets 输出（先 pnpm build）");
  const rows = [];
  for (const entry of sizeLimit ?? []) {
    rows.push({ name: `size-limit · ${entry.name}`, sizeBytes: entry.size, limitBytes: entry.sizeLimit, unit: 1000, ok: entry.passed });
  }
  for (const line of budgetLines ?? []) {
    const match = /^(.+?):.*total=([\d.]+)KB limit=([\d.]+)KB (OK|FAIL)\s*$/.exec(line.trim());
    if (!match) continue;
    rows.push({ name: match[1], sizeBytes: Math.round(Number(match[2]) * 1024), limitBytes: Math.round(Number(match[3]) * 1024), unit: 1024, ok: match[4] === "OK" });
  }
  if (!rows.length) return item("size-budgets", "missing", "size 输出无法解析");
  for (const row of rows) row.headroomRatio = row.limitBytes ? (row.limitBytes - row.sizeBytes) / row.limitBytes : null;
  const failed = rows.filter((row) => !row.ok);
  const tight = rows.filter((row) => row.ok && row.headroomRatio !== null && row.headroomRatio < SIZE_HEADROOM_WARN_RATIO);
  // size-limit 用十进制 kB，check-size-budgets 用 KiB（标作 KB），各按原口径显示。
  const fmt = (row) => `${row.name} ${(row.sizeBytes / row.unit).toFixed(2)} / ${(row.limitBytes / row.unit).toFixed(2)} ${row.unit === 1000 ? "kB" : "KB"}`;
  if (failed.length) return item("size-budgets", "fail", `超限：${failed.map(fmt).join("；")}`, { rows });
  if (tight.length) return item("size-budgets", "warn", `余量 < ${SIZE_HEADROOM_WARN_RATIO * 100}%：${tight.map(fmt).join("；")}`, { rows });
  return item("size-budgets", "pass", `${rows.length} 项全部在预算内`, { rows });
}

const median = (values) => {
  const sorted = values.filter((v) => typeof v === "number" && Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** lhr 里取某个断言的数值（categories:* 取 score，其余取 audits[id].numericValue）。 */
function lhrValue(lhr, auditId) {
  if (auditId.startsWith("categories:")) return lhr.categories?.[auditId.slice("categories:".length)]?.score ?? null;
  return lhr.audits?.[auditId]?.numericValue ?? null;
}

/**
 * @param {object} rc lighthouserc.json 内容
 * @param {object[] | null} lhrs .lighthouseci/lhr-*.json（可为空：只报告配置里仍为 warn 的断言）
 */
export function evaluateLighthouse(rc, lhrs) {
  const matrix = rc?.ci?.assert?.assertMatrix;
  if (!Array.isArray(matrix)) return item("lighthouse", "missing", "lighthouserc.json 没有 assertMatrix");
  const rows = [];
  for (const group of matrix) {
    const pattern = new RegExp(group.matchingUrlPattern);
    const runs = (lhrs ?? []).filter((lhr) => [lhr.requestedUrl, lhr.finalUrl, lhr.finalDisplayedUrl].some((url) => url && pattern.test(url)));
    for (const [auditId, assertion] of Object.entries(group.assertions ?? {})) {
      const [level, options = {}] = Array.isArray(assertion) ? assertion : [assertion];
      if (level !== "warn") continue;
      const actual = runs.length ? median(runs.map((lhr) => lhrValue(lhr, auditId))) : null;
      const limit = options.maxNumericValue ?? options.minScore ?? null;
      const kind = options.minScore !== undefined ? "min" : "max";
      const within = actual === null || limit === null ? null : kind === "max" ? actual <= limit : actual >= limit;
      rows.push({ urlPattern: group.matchingUrlPattern, auditId, level, limit, kind, actual, runs: runs.length, within });
    }
  }
  if (!rows.length) return item("lighthouse", "pass", "lighthouserc.json 已无 warn 级断言（已转 error）", { rows });
  const over = rows.filter((row) => row.within === false);
  const fmt = (row) => `${/room/i.test(row.urlPattern) ? "Room" : "首页"} ${row.auditId} ${row.actual === null ? "未测" : Math.round(row.actual * 1000) / 1000}${row.kind === "max" ? " ≤ " : " ≥ "}${row.limit}`;
  if (over.length) return item("lighthouse", "fail", `超阈值（仍为 warn 级）：${over.map(fmt).join("；")}`, { rows });
  return item("lighthouse", "warn", `${rows.length} 条断言仍为 warn 级，G3D-17 须改为 error：${rows.map(fmt).join("；")}`, { rows });
}

/** @param {object | null} perfReport perf:ci 的 ci-budgets.json */
export function evaluateDrawCalls(perfReport, budgets = TIER_BUDGETS) {
  const probes = perfReport?.launchChecklist?.tierDrawCalls;
  if (!Array.isArray(probes) || !probes.length) return item("draw-calls", "missing", "perf 报告里没有 launchChecklist.tierDrawCalls（跑 pnpm perf:ci）");
  const rows = probes.map((probe) => {
    const limit = budgets[probe.requestedTier]?.drawCalls ?? null;
    const worst = Math.max(probe.calls ?? -1, probe.peak ?? -1);
    const ok = probe.error || limit === null || worst < 0 ? null : worst <= limit;
    return { ...probe, limit, ok };
  });
  const fmt = (row) => `${row.requestedTier} 稳态 ${row.calls ?? "?"} / 峰值 ${row.peak ?? "?"} ≤ ${row.limit}${row.actualTier && row.actualTier !== row.requestedTier ? `（实际档位 ${row.actualTier}）` : ""}`;
  const over = rows.filter((row) => row.ok === false);
  const unmeasured = rows.filter((row) => row.ok === null);
  if (over.length) return item("draw-calls", "fail", `超预算：${over.map(fmt).join("；")}`, { rows });
  if (unmeasured.length) return item("draw-calls", "warn", `未测得：${unmeasured.map((row) => `${row.requestedTier}${row.error ? `（${row.error}）` : ""}`).join("；")}`, { rows });
  return item("draw-calls", "pass", rows.map(fmt).join("；"), { rows });
}

/** @param {object | null} perfReport */
export function evaluateHud(perfReport) {
  const scans = perfReport?.launchChecklist?.hudRawActionIds;
  if (!Array.isArray(scans) || !scans.length) return item("hud-raw-action-ids", "missing", "perf 报告里没有 launchChecklist.hudRawActionIds（跑 pnpm perf:ci）");
  const errored = scans.filter((scan) => scan.error);
  const total = scans.reduce((sum, scan) => sum + (scan.count ?? 0), 0);
  const per = scans.map((scan) => `${scan.viewport}${scan.seat === null ? "（旁观）" : ""} ${scan.error ? `出错（${scan.error}）` : `${scan.count} 处 / ${scan.unique ?? "?"} 种`}`).join("；");
  if (total > 0) {
    const example = scans.flatMap((scan) => scan.samples ?? []).slice(0, 3).map((s) => `「${s.context}」`).join(" ");
    return item("hud-raw-action-ids", "warn", `Room 露出原始动作 id（${per}）例：${example}`, { scans });
  }
  if (errored.length) return item("hud-raw-action-ids", "warn", `扫描未完成：${per}`, { scans });
  return item("hud-raw-action-ids", "pass", `未发现原始动作 id（${per}）`, { scans });
}

/**
 * @param {Array<{ id: string, status: string }>} items
 * @param {{ mode?: "warn" | "block", block?: string[] }} options
 * @returns {{ exitCode: number, blocking: string[] }}
 */
export function decideExit(items, { mode = "warn", block = [] } = {}) {
  const blockingIds = mode === "block" ? items.map((entry) => entry.id) : block;
  const blocking = items.filter((entry) => blockingIds.includes(entry.id) && entry.status !== "pass").map((entry) => entry.id);
  return { exitCode: blocking.length ? 1 : 0, blocking };
}

const ICON = { pass: "✅", warn: "⚠️", fail: "❌", missing: "❔" };

export function renderMarkdown(items, { mode, blocking }) {
  const lines = [
    `### G3D-17 上线前清单（模式：${mode === "block" ? "阻断" : "warning"}）`,
    "",
    "| 检查项 | 状态 | 说明 |",
    "| --- | --- | --- |",
    ...items.map((entry) => `| ${entry.title}（\`${entry.id}\`） | ${ICON[entry.status] ?? ""} ${entry.status}${blocking.includes(entry.id) ? " · 阻断" : ""} | ${entry.summary.replace(/\|/g, "\\|")} |`),
    "",
    mode === "block" ? "阻断模式：任一项非 pass 即失败。" : "warning 模式：不影响 CI 结果。转阻断见 `docs/perf/launch-checklist.md`。",
  ];
  return `${lines.join("\n")}\n`;
}

// ---------- 采集（CLI） ----------

function readJson(path) {
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return null; }
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function collectAssetLegal() {
  const { stdout } = run(process.execPath, ["scripts/verify-assets.mjs", "--skip-network", "--json"]);
  try { return JSON.parse(stdout); } catch { return null; }
}

function collectSize() {
  let sizeLimit = null;
  const sl = run("pnpm", ["exec", "size-limit", "--json"]);
  try { sizeLimit = JSON.parse(sl.stdout.slice(sl.stdout.indexOf("["))); } catch { sizeLimit = null; }
  const budgets = existsSync("dist/assets") ? run(process.execPath, ["scripts/check-size-budgets.mjs"]) : null;
  return { sizeLimit, budgetLines: budgets ? budgets.stdout.split("\n").filter(Boolean) : null };
}

function collectLighthouse(dir) {
  if (!dir || !existsSync(dir)) return null;
  return readdirSync(dir).filter((name) => /^lhr-.*\.json$/.test(name)).map((name) => readJson(join(dir, name))).filter(Boolean);
}

async function main() {
  const { values } = parseArgs({
    options: {
      perf: { type: "string" },
      lighthouse: { type: "string" },
      only: { type: "string" },
      mode: { type: "string" },
      block: { type: "string" },
      out: { type: "string" },
    },
  });
  const mode = (values.mode ?? process.env.GODESK_LAUNCH_GATE ?? "warn").trim() === "block" ? "block" : "warn";
  const block = (values.block ?? process.env.GODESK_LAUNCH_GATE_BLOCK ?? "").split(",").map((v) => v.trim()).filter(Boolean);
  const only = values.only ? values.only.split(",").map((v) => v.trim()) : CHECK_IDS;
  const unknown = [...only, ...block].filter((id) => !CHECK_IDS.includes(id));
  if (unknown.length) throw new Error(`未知检查项：${unknown.join(", ")}（可选：${CHECK_IDS.join(", ")}）`);

  const perfReport = values.perf ? readJson(resolve(values.perf)) : null;
  const items = [];
  for (const id of only) {
    if (id === "asset-legal") items.push(evaluateAssetLegal(collectAssetLegal()));
    if (id === "size-budgets") items.push(evaluateSizeBudgets(collectSize()));
    if (id === "lighthouse") items.push(evaluateLighthouse(readJson("lighthouserc.json"), collectLighthouse(values.lighthouse)));
    if (id === "draw-calls") items.push(evaluateDrawCalls(perfReport));
    if (id === "hud-raw-action-ids") items.push(evaluateHud(perfReport));
  }
  const { exitCode, blocking } = decideExit(items, { mode, block });
  const markdown = renderMarkdown(items, { mode, blocking });
  process.stdout.write(markdown);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
  if (process.env.GITHUB_ACTIONS) {
    for (const entry of items.filter((e) => e.status !== "pass")) {
      const level = blocking.includes(entry.id) ? "error" : "warning";
      console.log(`::${level} title=G3D-17 上线前清单 · ${entry.id}::${entry.summary.replace(/\r?\n/g, " ").slice(0, 900)}`);
    }
  }
  if (values.out) {
    writeFileSync(values.out, `${JSON.stringify({ schema: "godesk-launch-checklist/v1", mode, blocking, items, capturedAt: new Date().toISOString() }, null, 2)}\n`);
  }
  process.exitCode = exitCode;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 2;
  });
}
