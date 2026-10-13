/**
 * Auto-battler unit asset attachment (generic): NL intent → search CC0 / use imported GLB /
 * procedural stylized fallback. Generation Plan reports searched / attached / fallback honestly.
 */
import type { AutoBattlerContent, AutoBattlerContentPatch, UnitDef } from "../src/runtime/adapters/auto-battler-content";
import { unitShape } from "../src/runtime/adapters/auto-battler-content";
import { pullCc0GlbFromPrompt, queryFromPrompt } from "./asset-pull";

export type AssetAttachIntent =
  | { kind: "search"; unitHint: string; queryHint?: string }
  | { kind: "imported"; unitHint: string }
  | { kind: "procedural"; unitHint?: string; allFallbacks?: boolean };

export type AssetPipelineReport = {
  searched: string[];
  attached: Array<{ unitId: string; unitName: string; modelRef: string; title?: string; via: "search" | "imported" }>;
  fallback: Array<{ unitId: string; unitName: string; proceduralPreset: string; reason: string }>;
  lines: string[];
};

type ProjectRequest = (path: string, init?: RequestInit) => Promise<Response>;

const UNIT_ALIAS: Array<[RegExp, string]> = [
  [/礁蟹|螃蟹|蟹|crab/i, "crab"],
  [/珊瑚巫|巫师|女巫|法师|witch|wizard/i, "witch"],
  [/螺号|海螺|conch/i, "conch"],
  [/潮刃|blade/i, "blade"],
  [/飞鱼|弓手|archer/i, "archer"],
  [/浪脊|骑|rider/i, "rider"],
  [/海葵|anemone/i, "anemone"],
  [/祭司|priest/i, "priest"],
  [/珍珠龟|龟|turtle/i, "turtle"],
  [/鲸盾|鲸|whale/i, "whale"],
  [/雾灯|灯|lantern/i, "lantern"],
  [/海风灵|精灵|spirit/i, "spirit"],
];

/** Resolve a unit hint (name/id/alias) against current roster — generic, not tide-hardcoded IDs only. */
export function resolveUnitHint(content: AutoBattlerContent, hint: string): UnitDef | undefined {
  const h = hint.trim();
  if (!h) return undefined;
  const byId = content.units.find((u) => u.id === h || u.name === h);
  if (byId) return byId;
  for (const [re, id] of UNIT_ALIAS) {
    if (re.test(h)) {
      const u = content.units.find((x) => x.id === id);
      if (u) return u;
    }
  }
  return content.units.find((u) => h.includes(u.name) || u.name.includes(h) || h.includes(u.id));
}

/**
 * Parse one clause into an asset-attach intent (0 = not mine).
 * Examples: 「给螃蟹换螃蟹模型」「给巫师挂导入的 GLB」「没有素材时用风格化棋子」
 */
export function parseAssetAttachClause(clause: string): AssetAttachIntent | null {
  const text = clause.trim();
  if (!text) return null;
  if (/(没有素材|找不到模型|无合适|风格化棋子|程序化棋子|用棋子兜底|保持棋子)/.test(text)) {
    const unitHint = text.match(/给\s*([^\s，,。给换挂用]+)/)?.[1]
      ?? text.match(/单位\s*([^\s，,。]+)/)?.[1];
    return { kind: "procedural", ...(unitHint ? { unitHint } : { allFallbacks: true }) };
  }
  if (/(挂导入|用导入|已导入).*(glb|GLB|模型)?|(glb|GLB).*(挂|导入)/.test(text) || /给.+挂导入/.test(text)) {
    const unitHint = text.match(/给\s*([^\s，,。给换挂]+)/)?.[1] ?? text.match(/([^\s，,。]+)(?:挂导入)/)?.[1];
    if (!unitHint) return null;
    return { kind: "imported", unitHint };
  }
  if (/(换|挂|搜|找|用).{0,6}(模型|glb|GLB|网格|mesh)/i.test(text) || /(模型|glb).{0,6}(换|挂|到)/i.test(text)) {
    const unitHint = text.match(/给\s*([^\s，,。给换挂]+)/)?.[1]
      ?? text.match(/把\s*([^\s，,。]+)/)?.[1]
      ?? text.match(/([^\s，,。]+)(?:换|挂)/)?.[1];
    if (!unitHint) return null;
    const queryHint = text.match(/(?:换|挂|搜|找|用)\s*([^\s，,。给]+)(?:模型|glb|GLB)/i)?.[1]
      ?? queryFromPrompt(text);
    return { kind: "search", unitHint, ...(queryHint ? { queryHint } : {}) };
  }
  return null;
}

function patchUnit(units: UnitDef[], id: string, patch: Partial<UnitDef>): UnitDef[] {
  return units.map((u) => {
    if (u.id !== id) return u;
    const next = { ...u, ...patch, traits: [...(patch.traits ?? u.traits)] };
    if (patch.modelRef === undefined && "modelRef" in patch) {
      const { modelRef: _drop, ...rest } = next as UnitDef & { modelRef?: string };
      return rest;
    }
    return next;
  });
}

export async function fulfillAssetAttachIntents(input: {
  env: Env;
  projectRequest: ProjectRequest;
  projectId: string;
  content: AutoBattlerContent;
  intents: AssetAttachIntent[];
  idempotencyKey: string;
}): Promise<{ content: AutoBattlerContent; contentPatch: AutoBattlerContentPatch; report: AssetPipelineReport }> {
  let units: UnitDef[] = input.content.units.map((u) => ({ ...u, traits: [...u.traits] }));
  const report: AssetPipelineReport = { searched: [], attached: [], fallback: [], lines: [] };

  const listImported = async () => {
    const res = await input.projectRequest(`/projects/${input.projectId}?view=imported-assets`);
    if (!res.ok) return [] as Array<{ id: string; title?: string; path?: string; mimeType?: string }>;
    const body = await res.json() as { assets?: Array<{ id: string; title?: string; path?: string; mimeType?: string }> };
    return (body.assets ?? []).filter((a) => /\.glb$/i.test(a.path ?? "") || a.mimeType === "model/gltf-binary");
  };

  for (let i = 0; i < input.intents.length; i += 1) {
    const intent = input.intents[i]!;
    if (intent.kind === "procedural") {
      const targets = intent.allFallbacks
        ? units.filter((u) => u.modelRef)
        : (() => {
            const u = intent.unitHint ? resolveUnitHint({ ...input.content, units }, intent.unitHint) : undefined;
            return u ? [u] : [];
          })();
      if (!targets.length && intent.unitHint) {
        report.lines.push(`资产：未识别单位「${intent.unitHint}」，无法改用风格化棋子。`);
        continue;
      }
      for (const u of targets) {
        const proceduralPreset = unitShape(u);
        units = patchUnit(units, u.id, { modelRef: undefined, proceduralPreset, shape: proceduralPreset });
        report.fallback.push({ unitId: u.id, unitName: u.name, proceduralPreset, reason: "创作者要求风格化/无素材兜底" });
        report.lines.push(`资产：${u.name} 使用程序化风格化棋子（${proceduralPreset}）`);
      }
      if (intent.allFallbacks && !targets.length) {
        report.lines.push("资产：当前无挂模型单位；新挂接失败时将用程序化风格化棋子兜底。");
      }
      continue;
    }

    const unit = resolveUnitHint({ ...input.content, units }, intent.unitHint);
    if (!unit) {
      report.lines.push(`资产：未识别单位「${intent.unitHint}」，跳过挂模型。`);
      continue;
    }

    if (intent.kind === "imported") {
      const imported = await listImported();
      const pick = imported[0];
      if (!pick) {
        const proceduralPreset = unitShape(unit);
        units = patchUnit(units, unit.id, { modelRef: undefined, proceduralPreset, shape: proceduralPreset });
        report.fallback.push({ unitId: unit.id, unitName: unit.name, proceduralPreset, reason: "项目尚无导入 GLB" });
        report.lines.push(`资产：项目无导入 GLB → ${unit.name} 用程序化风格化棋子（${proceduralPreset}）`);
        continue;
      }
      units = patchUnit(units, unit.id, { modelRef: pick.id });
      report.attached.push({ unitId: unit.id, unitName: unit.name, modelRef: pick.id, title: pick.title, via: "imported" });
      report.lines.push(`资产：已挂导入 GLB「${pick.title ?? pick.id}」→ ${unit.name}`);
      continue;
    }

    // search
    const query = intent.queryHint || queryFromPrompt(`${intent.unitHint} 模型`) || intent.unitHint;
    report.searched.push(query);
    try {
      const pulled = await pullCc0GlbFromPrompt(
        input.env,
        input.projectRequest,
        input.projectId,
        `给单位加一个${query}模型`,
        `${input.idempotencyKey}:asset:${i}:${unit.id}`,
      );
      const imported = await listImported();
      const entry = imported.find((a) => a.id.includes(pulled.asset.nativeId) || a.title === pulled.asset.title) ?? imported[imported.length - 1];
      if (!entry) throw new Error("导入后未找到资产条目");
      units = patchUnit(units, unit.id, { modelRef: entry.id });
      report.attached.push({ unitId: unit.id, unitName: unit.name, modelRef: entry.id, title: pulled.asset.title, via: "search" });
      report.lines.push(`资产：搜索「${query}」→ ${pulled.asset.title}（${pulled.asset.id}）已挂到 ${unit.name}`);
    } catch (reason) {
      const msg = reason instanceof Error ? reason.message : String(reason);
      const proceduralPreset = unitShape(unit);
      units = patchUnit(units, unit.id, { modelRef: undefined, proceduralPreset, shape: proceduralPreset });
      report.fallback.push({ unitId: unit.id, unitName: unit.name, proceduralPreset, reason: msg });
      report.lines.push(`资产：搜索「${query}」失败（${msg}）→ ${unit.name} 用程序化风格化棋子（${proceduralPreset}）`);
    }
  }

  return {
    content: { ...input.content, units },
    contentPatch: { units },
    report,
  };
}
