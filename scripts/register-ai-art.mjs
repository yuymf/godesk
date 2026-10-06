#!/usr/bin/env node
/**
 * G3D-ART：把 scripts/process-ai-art.py 产出的 AI 资产登记进
 * src/render3d/assets/manifest.ts、manifest.data.mjs 与 assets/LICENSES.md（幂等，可重跑）。
 * 提示词来源：docs/art/ai-provenance.md（入库的提示词全文记录）。
 */
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const PROV = "docs/art/ai-provenance.md";
const TOOL = "Grok Bot GenerateImage";
const DATE = "2026-10-06";
const LEGAL = "法务审查: 待 G3D-17";

// 从 provenance 文档读取 raw id → 完整提示词
const provText = readFileSync(join(ROOT, PROV), "utf8");
const PROMPTS = {};
for (const line of provText.split("\n")) {
  const m = line.match(/^\| (\w\d\w?) \| `[^`]+` \| (.+) \|$/);
  if (m) PROMPTS[m[1]] = m[2].trim();
}

const TEX = {
  "t01-pine": ["T1", "松林"], "t02-clay": ["T4", "赭土"], "t03-meadow": ["T2", "草甸"],
  "t04-wheat": ["T3b", "麦田"], "t05-reef": ["T5", "礁岩"], "t06-sand": ["T6", "沙洲"],
  "t08-wood": ["T8", "码头木板"], "t11-parchment": ["N1", "点数筹码面"],
};
const CARDS = {
  "resource-wood": ["C1", "资源卡·松林"], "resource-brick": ["C2", "资源卡·赭土"],
  "resource-sheep": ["C3", "资源卡·盐草"], "resource-wheat": ["C4", "资源卡·麦垄"],
  "resource-ore": ["C5", "资源卡·礁岩"], "dev-fog-signal": ["C6", "发展卡·雾灯令"],
};
const ICON_NAMES = { wood: "木材", brick: "砖", sheep: "羊毛", wheat: "麦", ore: "矿" };

/** @type {{id:string,file:string,kind:string,tier:string,name:string,raw:string,post:string,existing:boolean}[]} */
const items = [];
for (const [tid, [raw, cn]] of Object.entries(TEX)) {
  for (const res of [512, 256]) {
    for (const slot of ["baseColor", "normal", "orm"]) {
      const post = tid === "t11-parchment"
        ? (slot === "baseColor" ? `圆盘裁切→圆外以边缘色填充→${res}²→toktx ETC1S` : `由 AI albedo 亮度推导 ${slot}（自有算法）→${res}²→toktx`)
        : (slot === "baseColor"
          ? `中心方块裁切→1024→逐轴 offset-by-half 羽化混合无缝化${tid === "t08-wood" ? "→去饱和 0.25、提亮 1.55（漂流木灰，木色由 token 决定）" : ""}→${res}²→toktx ETC1S`
          : `由无缝 AI albedo 亮度高度场推导 ${slot}（自有算法，非 AI）→${res}²→toktx ${slot === "normal" ? "UASTC+zstd" : "ETC1S"}`);
      items.push({
        id: `texture/${tid}/${res}/${slot}`,
        file: `assets/textures/pbr/${tid}/${res}/${slot}.ktx2`,
        kind: "texture", tier: res === 512 ? "high-medium" : "low",
        name: `${tid} ${res} ${slot}（${cn}）`, raw, post, existing: true,
      });
    }
  }
}
for (const [name, [raw, cn]] of Object.entries(CARDS)) {
  items.push({
    id: `illustration/${name}`, file: `assets/illustrations/cards/${name}.webp`, kind: "illustration", tier: "all",
    name: cn, raw, post: `1280x720 中心裁切到 ${name.startsWith("dev") ? "2:3→512x768" : "3:4→384x512"}→WebP q82（原位替换）`, existing: true,
  });
}
for (const [k, cn] of Object.entries(ICON_NAMES)) {
  for (const px of [128, 64]) {
    items.push({
      id: `ui/ai-icon-${k}-${px}`, file: `assets/ui/ai/icons/${k}-${px}.webp`, kind: "ui", tier: "all",
      name: `资源图标·${cn} ${px}px`, raw: "S4", post: `S4 中按描边分割裁出→描边泛洪键出羊皮纸底为 alpha→${px}²→WebP`, existing: false,
    });
  }
}
items.push({ id: "ui/ai-panel-frame", file: "assets/ui/ai/panel-frame.webp", kind: "ui", tier: "all", name: "HUD 面板框 9-slice", raw: "S3",
  post: "S3 左块裁切→重建 9-slice（四角取原角花、四边取素边条、中心纸色；去掉中饰与内部残影）→WebP；切片见 assets/ui/ai/nine-slice.json", existing: false });
items.push({ id: "ui/ai-card-frame", file: "assets/ui/ai/card-frame.webp", kind: "ui", tier: "all", name: "卡框 9-slice", raw: "S3",
  post: "S3 右块裁切→羊皮纸底键出 alpha→插画窗不透明→WebP；切片见 assets/ui/ai/nine-slice.json", existing: false });
for (const px of [256, 128]) {
  items.push({ id: `ui/ai-number-token-face-${px}`, file: `assets/ui/ai/number-token-face-${px}.webp`, kind: "ui", tier: "all",
    name: `点数筹码面 ${px}px`, raw: "N1", post: `N1 圆盘检测裁切→圆形 alpha→${px}²→WebP`, existing: false });
}

for (const it of items) {
  if (!PROMPTS[it.raw]) throw new Error(`provenance 缺少 ${it.raw} 的提示词`);
  it.bytes = statSync(join(ROOT, it.file)).size;
  it.note = `工具：${TOOL}；生成日期：${DATE}；提示词：「${PROMPTS[it.raw]}」；后处理：${it.post}；${LEGAL}`;
}

// ---- manifest ----
const dataPath = join(ROOT, "src/render3d/assets/manifest.data.mjs");
const tsPath = join(ROOT, "src/render3d/assets/manifest.ts");
const mod = await import(pathToFileURL(dataPath).href + `?t=${Date.now()}`);
const manifest = JSON.parse(JSON.stringify(mod.ASSET_MANIFEST));
const byId = new Map(manifest.map((e, i) => [e.id, i]));
for (const it of items) {
  const entry = {
    id: it.id, file: it.file, kind: it.kind, bytes: it.bytes, tier: it.tier, source: "ai-generated",
    license: {
      spdx: "LicenseRef-AI-Generated", sourceUrl: PROV, author: `${TOOL}（AI 生成，俞孟凡 / GoDesk 委托）`,
      obtainedAt: DATE, modified: true, modificationNote: `AI 生图（${it.raw}）；${it.post}`, orderRef: "n/a",
      status: "cleared", legalReview: "pending-G3D-17",
    },
  };
  if (byId.has(it.id)) manifest[byId.get(it.id)] = entry;
  else { byId.set(it.id, manifest.length); manifest.push(entry); }
}
const body = manifest.map((e) => JSON.stringify(e, null, 2).replace(/\n/g, "\n  ").replace(/^/, "")).join(",\n");
function replaceArray(text, openRe) {
  const m = text.match(openRe);
  if (!m) throw new Error("manifest array start not found");
  const start = m.index + m[0].length;
  const end = text.indexOf("\n]", start);
  return text.slice(0, start) + "\n" + body + text.slice(end);
}
writeFileSync(dataPath, replaceArray(readFileSync(dataPath, "utf8"), /export const ASSET_MANIFEST = Object\.freeze\(\[/));
writeFileSync(tsPath, replaceArray(readFileSync(tsPath, "utf8"), /Object\.freeze\(\n\[/));

// ---- LICENSES.md ----
const licPath = join(ROOT, "assets/LICENSES.md");
let lic = readFileSync(licPath, "utf8");
const lines = lic.split("\n");
const rowFor = (it) => `| ${it.id} | ${it.file} | ${it.name} | AI生成 | ${PROV} | LicenseRef-AI-Generated | ${TOOL}（AI 生成） | ${DATE} | 是 | ${it.note} | G3D-ART |`;
const done = new Set();
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/^\| ([^|]+?) \|/);
  if (!m) continue;
  const it = items.find((x) => x.id === m[1]);
  if (it) { lines[i] = rowFor(it); done.add(it.id); }
}
// 新行插在表格最后一行之后
let last = -1;
for (let i = 0; i < lines.length; i++) if (/^\| /.test(lines[i])) last = i;
const add = items.filter((x) => !done.has(x.id)).map(rowFor);
lines.splice(last + 1, 0, ...add);
writeFileSync(licPath, lines.join("\n"));
console.log(`registered ${items.length} AI assets (${add.length} new rows)`);
