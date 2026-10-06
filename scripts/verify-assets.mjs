#!/usr/bin/env node
/**
 * G3D-11 资产许可证门（SPEC §5.4）
 *
 * 校验：
 * 1. dist 中每个模型/贴图/音频/插画/字体文件在清单中有条目
 * 2. 每个清单条目与 sprite 片段在 LICENSES.md 恰好 1 行且 11 列非空
 * 3. 许可证在白名单内
 * 4. status = "cleared"（来自 manifest；LICENSES 表无 status 列，以 manifest 为准）
 * 5. 来源 URL：http(s) 返回 2xx（可用 --skip-network）；程序化/自制/AI 生成检查路径存在
 * 6. G3D-ART：LicenseRef-AI-Generated 行须记录工具、提示词、生成日期、后处理与「法务审查:」标记；
 *    标记为「待 G3D-17」的资产输出 warning（不失败）—— G3D-17 上线前须由法务清零。
 *
 * 用法：
 *   node scripts/verify-assets.mjs
 *   node scripts/verify-assets.mjs --skip-network
 *   node scripts/verify-assets.mjs --manifest <path> --licenses <path> --dist <path> --root <path>
 *   node scripts/verify-assets.mjs --json  # 机器可读摘要
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, extname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const REQUIRE = createRequire(import.meta.url);

const LICENSE_WHITELIST = new Set([
  "CC0-1.0",
  "OFL-1.1",
  "LicenseRef-GoDesk-Original",
  "LicenseRef-Purchased",
  "LicenseRef-AI-Generated",
]);

export const AI_LICENSE = "LicenseRef-AI-Generated";
const AI_REQUIRED_MARKERS = ["工具：", "生成日期：", "提示词：", "后处理：", "法务审查:"];
export const AI_LEGAL_PENDING = "法务审查: 待 G3D-17";

const ASSET_EXTENSIONS = new Set([
  ".glb",
  ".gltf",
  ".ktx2",
  ".png",
  ".webp",
  ".jpg",
  ".jpeg",
  ".mp3",
  ".ogg",
  ".wav",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".svg",
]);

const SOURCE_TYPE_MAP = {
  procedural: "程序化",
  "self-made": "自制",
  cc0: "CC0",
  ofl: "OFL",
  purchased: "购买",
  "ai-generated": "AI生成",
};

function parseArgs(argv) {
  const out = {
    root: process.cwd(),
    dist: null,
    licenses: null,
    manifestModule: null,
    skipNetwork: false,
    json: false,
    fixturesRoot: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--skip-network") out.skipNetwork = true;
    else if (a === "--json") out.json = true;
    else if (a === "--root") out.root = resolve(argv[++i]);
    else if (a === "--dist") out.dist = resolve(argv[++i]);
    else if (a === "--licenses") out.licenses = resolve(argv[++i]);
    else if (a === "--manifest") out.manifestModule = resolve(argv[++i]);
    else if (a === "--fixtures") out.fixturesRoot = resolve(argv[++i]);
    else if (a === "--help" || a === "-h") {
      console.log("Usage: node scripts/verify-assets.mjs [--skip-network] [--json]");
      process.exit(0);
    }
  }
  out.dist = out.dist ?? join(out.root, "dist");
  out.licenses = out.licenses ?? join(out.root, "assets", "LICENSES.md");
  out.manifestModule =
    out.manifestModule ?? join(out.root, "src", "render3d", "assets", "manifest.ts");
  return out;
}

function walkFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walkFiles(p, acc);
    else acc.push(p);
  }
  return acc;
}

function isAssetFile(filePath) {
  return ASSET_EXTENSIONS.has(extname(filePath).toLowerCase());
}

/**
 * 解析 LICENSES.md 表格行。返回 { rows: Map<id, cols[]>, errors: string[] }
 */
export function parseLicensesMarkdown(text) {
  const errors = [];
  const rows = new Map();
  const lines = text.split(/\r?\n/);
  let headerSeen = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    const cells = trimmed
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length === 0) continue;
    if (!headerSeen) {
      if (cells[0] === "资产 id" || cells[0] === "资产id") {
        headerSeen = true;
      }
      continue;
    }
    if (cells.every((c) => /^:?-{3,}:?$/.test(c))) continue;
    if (cells.length !== 11) {
      errors.push(`LICENSES 行列数不是 11：${trimmed.slice(0, 80)}`);
      continue;
    }
    const empty = cells.findIndex((c) => c.length === 0);
    if (empty !== -1) {
      errors.push(`LICENSES 行存在空列（列 ${empty + 1}）：id=${cells[0] || "(空)"}`);
      continue;
    }
    const id = cells[0];
    if (rows.has(id)) {
      errors.push(`LICENSES 重复资产 id：${id}`);
      continue;
    }
    rows.set(id, cells);
  }
  if (!headerSeen) {
    errors.push("LICENSES.md 缺少表头「资产 id」");
  }
  return { rows, errors };
}

/**
 * 从编译后的 JS 或通过动态 import 加载清单。
 * 对 .ts 源文件：用轻量正则提取 ASSET_MANIFEST 数组字面量不可靠；
 * 优先加载 dist 旁路或 fixtures JSON；默认尝试 import 旁路的 .mjs 导出。
 *
 * 本仓库约定：scripts/verify-assets.mjs 读取
 *   1) 若存在 scripts/fixtures/verify-assets/manifest.json 且 --fixtures
 *   2) 否则解析 manifest.ts 中导出的结构化 JSON 旁路文件
 *      src/render3d/assets/manifest.json（由本脚本旁路生成或手写同步）
 *   3) 否则用 Node 原生解析一个并行的 manifest.data.mjs
 */
export async function loadManifest(options) {
  if (options.fixturesRoot) {
    const p = join(options.fixturesRoot, "manifest.json");
    return JSON.parse(readFileSync(p, "utf8"));
  }
  const dataMjs = join(options.root, "src", "render3d", "assets", "manifest.data.mjs");
  if (existsSync(dataMjs)) {
    const mod = await import(pathToFileURL(dataMjs).href + `?t=${Date.now()}`);
    return mod.ASSET_MANIFEST ?? mod.default;
  }
  // Fallback: empty if only types exist and array is empty in .ts — parse empty
  const tsPath = options.manifestModule;
  const text = readFileSync(tsPath, "utf8");
  if (/ASSET_MANIFEST[^=]*=\s*Object\.freeze\(\s*\[\s*\]\s*\)/.test(text)) {
    return [];
  }
  throw new Error(
    `无法加载资产清单。请维护 src/render3d/assets/manifest.data.mjs 与 manifest.ts 同步（见 G3D-11）。\n` +
      `manifest.ts=${tsPath}`,
  );
}

async function checkSourceUrl(entry, root, skipNetwork) {
  const { source, license } = entry;
  const url = license.sourceUrl;
  if (source === "procedural" || source === "self-made" || source === "ai-generated") {
    const local = url.startsWith("/") ? join(root, url.slice(1)) : join(root, url);
    if (!existsSync(local)) {
      return `来源路径不存在（${source}）：${url} → ${local}`;
    }
    return null;
  }
  if (skipNetwork) return null;
  if (!/^https?:\/\//i.test(url)) {
    return `CC0/OFL/购买条目来源 URL 须为 http(s)：${entry.id} → ${url}`;
  }
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    if (res.ok) return null;
    // 部分站点拒 HEAD，再试 GET
    const res2 = await fetch(url, { method: "GET", redirect: "follow" });
    if (res2.ok) return null;
    return `来源 URL 非 2xx（${res2.status}）：${entry.id} → ${url}`;
  } catch (err) {
    return `来源 URL 请求失败：${entry.id} → ${url}（${err.message}）`;
  }
}

export async function verifyAssets(options) {
  const errors = [];
  const warnings = [];

  if (!existsSync(options.licenses)) {
    errors.push(`缺少 ${options.licenses}`);
    return { ok: false, errors, warnings, summary: {} };
  }

  const licensesText = readFileSync(options.licenses, "utf8");
  const { rows: licenseRows, errors: parseErrors } = parseLicensesMarkdown(licensesText);
  errors.push(...parseErrors);

  let manifest;
  try {
    manifest = await loadManifest(options);
  } catch (err) {
    errors.push(err.message);
    return { ok: false, errors, warnings, summary: {} };
  }

  const manifestIds = new Map(); // id -> entry (or parent for fragments)
  for (const entry of manifest) {
    if (manifestIds.has(entry.id)) {
      errors.push(`清单重复 id：${entry.id}`);
    }
    manifestIds.set(entry.id, entry);
    for (const frag of entry.spriteFragments ?? []) {
      if (manifestIds.has(frag)) {
        errors.push(`清单重复 sprite 片段 id：${frag}`);
      }
      manifestIds.set(frag, { ...entry, id: frag, isFragment: true, parentId: entry.id });
    }
  }

  // ② 每个条目与片段在 LICENSES 恰好 1 行
  for (const id of manifestIds.keys()) {
    if (!licenseRows.has(id)) {
      errors.push(`LICENSES.md 缺行：${id}`);
    }
  }
  for (const id of licenseRows.keys()) {
    if (!manifestIds.has(id)) {
      errors.push(`LICENSES.md 有行但不在清单：${id}`);
    }
  }

  // ③ ④ 白名单 + cleared
  for (const entry of manifest) {
    if (!LICENSE_WHITELIST.has(entry.license.spdx)) {
      errors.push(
        `许可证不在白名单：${entry.id} → ${entry.license.spdx}（允许：${[...LICENSE_WHITELIST].join(", ")}）`,
      );
    }
    if (entry.license.status !== "cleared") {
      errors.push(`license.status 必须为 cleared：${entry.id} → ${entry.license.status}`);
    }
    const row = licenseRows.get(entry.id);
    if (row) {
      const spdxCol = row[5];
      if (spdxCol !== entry.license.spdx) {
        errors.push(
          `LICENSES SPDX 与清单不一致：${entry.id} 表=${spdxCol} 清单=${entry.license.spdx}`,
        );
      }
      const expectedType = SOURCE_TYPE_MAP[entry.source];
      if (expectedType && row[3] !== expectedType) {
        warnings.push(
          `来源类型中文列建议为「${expectedType}」：${entry.id} 表=${row[3]}`,
        );
      }
    }
    for (const frag of entry.spriteFragments ?? []) {
      const frow = licenseRows.get(frag);
      if (frow && !LICENSE_WHITELIST.has(frow[5])) {
        errors.push(`片段许可证不在白名单：${frag} → ${frow[5]}`);
      }
    }
  }

  // ⑥ AI 生成资产：记录完整性（error）+ 法务审查待办（warning）
  const aiPending = [];
  for (const [id, row] of licenseRows) {
    if (row[5] !== AI_LICENSE) continue;
    const note = row[9];
    const missing = AI_REQUIRED_MARKERS.filter((m) => !note.includes(m));
    if (missing.length) {
      errors.push(`AI 资产 LICENSES 行缺少记录项（${missing.join("、")}）：${id}`);
    }
    if (note.includes(AI_LEGAL_PENDING)) aiPending.push(id);
  }
  for (const entry of manifest) {
    if (entry.license.spdx === AI_LICENSE && entry.license.legalReview === "pending-G3D-17" && !aiPending.includes(entry.id)) {
      aiPending.push(entry.id);
    }
  }
  if (aiPending.length) {
    warnings.push(
      `AI 生成资产待法务审查（G3D-17 上线前须清零，共 ${aiPending.length} 项）：${aiPending.join(", ")}`,
    );
  }

  // ⑤ 来源
  for (const entry of manifest) {
    const err = await checkSourceUrl(entry, options.root, options.skipNetwork);
    if (err) errors.push(err);
  }

  // ① dist 资产文件 ⊆ 清单
  // 工具链产物（Basis 转码器、pdf.js worker、打包主包）不要求进游戏素材清单。
  const TOOLCHAIN_DIST_RE =
    /(^|\/)(basis_transcoder|pdf\.worker|pdf-|main-|index-|render3d-assets-|three-)/i;
  const distAssets = walkFiles(options.dist).filter(isAssetFile);
  const manifestFiles = new Set(
    manifest.map((e) => e.file.replace(/^\//, "").replace(/\\/g, "/")),
  );
  for (const abs of distAssets) {
    const rel = relative(options.dist, abs).replace(/\\/g, "/");
    if (TOOLCHAIN_DIST_RE.test(rel)) continue;
    const base = rel.split("/").pop() || rel;
    // 清单可用源路径或稳定逻辑路径；与 hashed dist 文件名做后缀 / 包含匹配
    const matched = [...manifestFiles].some((f) => {
      const fb = f.split("/").pop() || f;
      return (
        rel === f ||
        rel.endsWith(f) ||
        f.endsWith(rel) ||
        base.includes(fb.replace(/\.[^.]+$/, "")) ||
        fb.includes(base.replace(/-[A-Za-z0-9_-]{6,}\.[^.]+$/, "").replace(/\.[^.]+$/, ""))
      );
    });
    const isGameLike =
      /\.(glb|gltf|ktx2|mp3|ogg|woff2|webp)$/i.test(rel) ||
      rel.includes("/g3d/") ||
      rel.includes("/models/") ||
      rel.includes("/textures/") ||
      rel.includes("/audio/") ||
      rel.includes("/illustrations/");
    if (isGameLike && !matched) {
      errors.push(`dist 中未登记资产文件：${rel}`);
    }
  }

  const summary = {
    manifestEntries: manifest.length,
    licenseRows: licenseRows.size,
    expectedRows: manifestIds.size,
    distAssetFiles: distAssets.length,
    errorCount: errors.length,
    aiPendingLegalReview: aiPending.length,
  };

  return { ok: errors.length === 0, errors, warnings, summary };
}

async function main() {
  const options = parseArgs(process.argv);
  const result = await verifyAssets(options);
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("verify-assets summary:", result.summary);
    for (const w of result.warnings) {
      console.warn("WARN:", w);
      // GitHub Actions 注解：在 CI 摘要里显示为 warning（不影响退出码）
      if (process.env.GITHUB_ACTIONS && w.startsWith("AI 生成资产待法务审查")) {
        console.log(`::warning title=AI 资产待法务审查（G3D-17）::${w.slice(0, 900)}`);
      }
    }
    for (const e of result.errors) console.error("ERROR:", e);
    if (result.ok) {
      console.log("verify-assets: OK");
    } else {
      console.error(`verify-assets: FAILED (${result.errors.length} errors)`);
    }
  }
  process.exit(result.ok ? 0 : 1);
}

const isDirect =
  Boolean(process.argv[1]) &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirect) {
  main();
}
