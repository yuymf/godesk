/**
 * Generic markdown rules-book table → auto-battler content.
 * Column headers matched fuzzily (ZH/EN aliases). Not genre-specific.
 */
import {
  CONTENT_LIMITS,
  UNIT_SHAPE_PRESETS,
  type AutoBattlerContentPatch,
  type TraitDef,
  type UnitDef,
  type UnitShapePreset,
} from "../src/runtime/adapters/auto-battler-content";
import type { AutoBattlerBranding } from "../src/runtime/adapters/auto-battler-packs";

type RulesBookTableParse = {
  /** Content fields extracted from tables (units and/or traits). */
  patch?: AutoBattlerContentPatch;
  /** Tuning knobs from key/value setup tables (初始生命/金币/计时…). */
  tuning?: Record<string, number>;
  /** Honest notes for unknown headers / bad rows (never silently dropped). */
  unsupported: string[];
  /** True when at least one unit or trait table was recognized. */
  found: boolean;
  /** Idea text with markdown tables removed (for clause-level NL parsers). */
  ideaWithoutTables: string;
};

type MdTable = { headers: string[]; rows: string[][]; start: number; end: number };

const UNIT_ALIASES: Record<string, RegExp> = {
  id: /^(id|标识|编号|id\s*建议)$/i,
  name: /^(名称|名字|单位|棋子|角色|英雄|name|unit)$/i,
  cost: /^(费|费用|花费|价格|cost)$/i,
  atk: /^(攻|攻击|攻击力|atk|attack)$/i,
  hp: /^(血|生命|生命值|血量|hp|health)$/i,
  traits: /^(羁绊|特质|种族|synergy|trait|traits)$/i,
  shape: /^(外形|造型|外观|shape|preset)$/i,
};

const TRAIT_ALIASES: Record<string, RegExp> = {
  id: /^(id|标识|编号)$/i,
  name: /^(名称|名字|羁绊|羁绊名|label|name|trait)$/i,
  tiers: /^(档位|阶|人数档|门槛|tiers?)$/i,
  effectKind: /^(效果种类|效果类型|效果|kind|effect)$/i,
  values: /^(数值|数值（按档）|按档数值|values?|效果数值)$/i,
  atkBonus: /^(攻加成|攻击加成|atkbonus|atk\s*bonus)$/i,
  hpBonus: /^(血加成|生命加成|hpbonus|hp\s*bonus)$/i,
  glyph: /^(字|字标|glyph|符号)$/i,
};

const SHAPE_WORDS: Array<[RegExp, UnitShapePreset]> = [
  [/蟹|钳/, "crab"], [/螺|号角/, "conch"], [/刀|刃|剑/, "blade"], [/弓|箭|射手|飞鱼/, "archer"],
  [/骑|坐骑|浪/, "rider"], [/葵|花|触手/, "anemone"], [/巫|女巫|法师|火法/, "witch"], [/祭司|法杖|牧师|熔祭/, "priest"],
  [/龟|壳|盾卫|玄武/, "turtle"], [/鲸|盾|坦克|领主/, "whale"], [/灯|提灯/, "lantern"], [/灵|精灵|幽灵|鳗|电|游侠|影刃/, "spirit"],
];

function splitRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((c) => c.trim());
}

function isSepRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((c) => /^:?-{3,}:?$/.test(c.replace(/\s/g, "")));
}

/** Extract GFM-style pipe tables from text. */
export function extractMarkdownTables(text: string): MdTable[] {
  const lines = text.split(/\r?\n/);
  const tables: MdTable[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!/\|/.test(line)) {
      i += 1;
      continue;
    }
    const headers = splitRow(line);
    if (headers.length < 2) {
      i += 1;
      continue;
    }
    const next = lines[i + 1];
    if (!next || !isSepRow(splitRow(next))) {
      i += 1;
      continue;
    }
    const rows: string[][] = [];
    let j = i + 2;
    while (j < lines.length && /\|/.test(lines[j]!) && !isSepRow(splitRow(lines[j]!))) {
      const cells = splitRow(lines[j]!);
      if (cells.some((c) => c.length > 0)) rows.push(cells);
      j += 1;
    }
    // char offsets for stripping
    let start = 0;
    for (let k = 0; k < i; k++) start += lines[k]!.length + 1;
    let end = start;
    for (let k = i; k < j; k++) end += lines[k]!.length + 1;
    tables.push({ headers, rows, start, end: Math.min(end, text.length) });
    i = j;
  }
  return tables;
}

function mapHeaders(headers: string[], aliases: Record<string, RegExp>): { map: Record<string, number>; unknown: string[] } {
  const map: Record<string, number> = {};
  const unknown: string[] = [];
  headers.forEach((h, idx) => {
    const key = h.replace(/\s+/g, " ").trim();
    let hit: string | undefined;
    for (const [field, re] of Object.entries(aliases)) {
      if (re.test(key)) {
        hit = field;
        break;
      }
    }
    if (hit) {
      if (map[hit] === undefined) map[hit] = idx;
    } else if (key && key !== "---") {
      unknown.push(key);
    }
  });
  return { map, unknown };
}

function cell(row: string[], idx: number | undefined): string {
  if (idx === undefined) return "";
  return (row[idx] ?? "").trim();
}

function parseNumList(raw: string): number[] {
  return raw
    .split(/[/／、,，和\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n));
}

function parseIntCell(raw: string): number | undefined {
  const m = raw.match(/-?\d+/);
  if (!m) return undefined;
  return Number(m[0]);
}

function slugFrom(raw: string, taken: Set<string>, fallbackPrefix: string): string {
  let id = raw
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
  if (!id) id = `${fallbackPrefix}${taken.size + 1}`;
  let out = id;
  let n = 2;
  while (taken.has(out)) out = `${id}_${n++}`.slice(0, 32);
  taken.add(out);
  return out;
}

function parseEffectKind(raw: string): { kind: string; label: string } | undefined {
  if (!raw) return undefined;
  const kindMatch = raw.match(/\b(shield_start|heal_first_strike|extra_hit|reflect|aoe_on_hit)\b/i);
  const paren = raw.match(/[（(]([^）)]{1,24})[）)]/);
  if (kindMatch) {
    return { kind: kindMatch[1]!.toLowerCase(), label: paren?.[1]?.trim() || kindMatch[1]! };
  }
  // ZH hints
  if (/护盾|开战护盾/.test(raw)) return { kind: "shield_start", label: paren?.[1]?.trim() || "护盾" };
  if (/治疗|愈伤|回血/.test(raw)) return { kind: "heal_first_strike", label: paren?.[1]?.trim() || "治疗" };
  if (/额外|追击|连击/.test(raw)) return { kind: "extra_hit", label: paren?.[1]?.trim() || "额外打击" };
  if (/反伤|反射/.test(raw)) return { kind: "reflect", label: paren?.[1]?.trim() || "反伤" };
  if (/溅射|aoe/i.test(raw)) return { kind: "aoe_on_hit", label: paren?.[1]?.trim() || "溅射" };
  return undefined;
}


const KV_KEY_ALIASES: Array<[RegExp, string, (raw: string) => number | undefined]> = [
  [/初始\s*(生命|血量|血|hp)/i, "startHp", (raw) => {
    const n = parseIntCell(raw); return n !== undefined && n >= 1 && n <= 200 ? n : undefined;
  }],
  [/初始\s*(金币|金钱|gold)/i, "startGold", (raw) => {
    const n = parseIntCell(raw); return n !== undefined && n >= 0 && n <= 99 ? n : undefined;
  }],
  [/(商店|购买).*(时|秒|限时)|备战.*(商店)/i, "prepShopSeconds", (raw) => {
    const n = parseIntCell(raw); return n !== undefined && n >= 5 && n <= 180 ? n : undefined;
  }],
  [/(布阵|上阵).*(时|秒|限时)/i, "prepPlaceSeconds", (raw) => {
    const n = parseIntCell(raw); return n !== undefined && n >= 5 && n <= 180 ? n : undefined;
  }],
];

function isKvSetupTable(headers: string[]): boolean {
  if (headers.length < 2) return false;
  const h0 = headers[0]!.replace(/\s+/g, "");
  const h1 = headers[1]!.replace(/\s+/g, "");
  return /^(项|配置|键|key|字段|名称)$/i.test(h0) && /^(值|内容|value|设定)$/i.test(h1);
}

function parseKvSetupTable(table: MdTable, unsupported: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of table.rows) {
    const key = (row[0] ?? "").trim();
    const val = (row[1] ?? "").trim();
    if (!key) continue;
    let hit = false;
    if (/棋盘/.test(key)) {
      const cols = val.match(/(\d+)\s*列/);
      const rows = val.match(/(\d+)\s*行/);
      if (cols) out.boardCols = Number(cols[1]!);
      if (rows) out.boardRows = Number(rows[1]!);
      hit = Boolean(cols || rows);
    }
    if (!hit) for (const [re, field, parse] of KV_KEY_ALIASES) {
      if (!re.test(key)) continue;
      const n = parse(val);
      if (n === undefined) {
        unsupported.push(`规则书设置表「${key}」=「${val}」无法解析为 ${field}。`);
      } else {
        out[field] = n;
      }
      hit = true;
      break;
    }
    if (!hit && /秒/.test(val) && /备战|限时/.test(key)) {
      const n = parseIntCell(val);
      if (n !== undefined && n >= 5 && n <= 180) {
        out.prepShopSeconds = n;
        out.prepPlaceSeconds = n;
        hit = true;
      }
    }
    if (!hit) unsupported.push(`规则书设置表未映射键「${key}」——已忽略。`);
  }
  return out;
}


function classifyTable(headers: string[]): "unit" | "trait" | "unknown" | "kv" {
  if (isKvSetupTable(headers)) return "kv";

  const { map: u } = mapHeaders(headers, UNIT_ALIASES);
  const { map: t } = mapHeaders(headers, TRAIT_ALIASES);
  const unitScore = Number(u.name !== undefined) + Number(u.cost !== undefined) + Number(u.atk !== undefined) + Number(u.hp !== undefined);
  const traitScore =
    Number(t.name !== undefined || t.id !== undefined) +
    Number(t.tiers !== undefined) +
    Number(t.effectKind !== undefined || t.values !== undefined);
  // Unit tables usually have cost+atk+hp; trait tables have tiers
  if (unitScore >= 3 && u.name !== undefined) return "unit";
  if (traitScore >= 2 && t.tiers !== undefined) return "trait";
  if (unitScore >= 2 && u.name !== undefined && u.traits !== undefined) return "unit";
  if (t.name !== undefined && t.tiers !== undefined) return "trait";
  return "unknown";
}

function parseTraitTable(table: MdTable, unsupported: string[]): TraitDef[] {
  const { map, unknown } = mapHeaders(table.headers, TRAIT_ALIASES);
  for (const u of unknown) unsupported.push(`规则书羁绊表未识别列「${u}」——已忽略该列。`);
  if (map.name === undefined && map.id === undefined) {
    unsupported.push("规则书羁绊表缺少名称/id 列。");
    return [];
  }
  const taken = new Set<string>();
  const traits: TraitDef[] = [];
  for (const row of table.rows) {
    const label = cell(row, map.name) || cell(row, map.id);
    if (!label || /^-+$/.test(label)) continue;
    const idRaw = cell(row, map.id);
    const id = slugFrom(idRaw || label, taken, "t");
    const tiers = parseNumList(cell(row, map.tiers)).map((n) => Math.round(n)).filter((n) => n >= 1 && n <= 12);
    if (tiers.length < 1 || tiers.length > 4 || tiers.some((n, i) => i > 0 && n <= tiers[i - 1]!)) {
      unsupported.push(`规则书羁绊「${label}」档位无法解析（需要 1–4 个递增整数）：「${cell(row, map.tiers)}」`);
      continue;
    }
    const effectRaw = cell(row, map.effectKind);
    const values = parseNumList(cell(row, map.values));
    const parsedFx = parseEffectKind(effectRaw);
    let effect: TraitDef["effect"] | undefined;
    if (parsedFx) {
      const vals = values.length === tiers.length ? values : values.length ? Array.from({ length: tiers.length }, (_, k) => values[Math.min(k, values.length - 1)] ?? 0) : Array(tiers.length).fill(0);
      effect = { kind: parsedFx.kind, label: parsedFx.label.slice(0, 24), values: vals };
    } else if (effectRaw) {
      unsupported.push(`规则书羁绊「${label}」效果种类未识别：「${effectRaw}」——已写入羁绊但无战斗效果。`);
    }
    const atkBonus = parseIntCell(cell(row, map.atkBonus)) ?? 0;
    const hpBonus = parseIntCell(cell(row, map.hpBonus)) ?? 0;
    const glyphRaw = cell(row, map.glyph);
    const glyph = (glyphRaw || label).slice(0, 1);
    traits.push({
      id,
      label: label.slice(0, 24),
      glyph,
      tiers,
      atkBonus: Math.max(0, Math.min(CONTENT_LIMITS.bonus.max, atkBonus)),
      hpBonus: Math.max(0, Math.min(CONTENT_LIMITS.bonus.max, hpBonus)),
      ...(effect ? { effect } : {}),
    });
    if (traits.length >= CONTENT_LIMITS.traits.max) break;
  }
  return traits;
}

function resolveTraitIds(
  traitText: string,
  traits: TraitDef[],
  unsupported: string[],
  unitName: string,
): string[] {
  if (!traitText) return [];
  const parts = traitText.split(/[/／、,，和\s]+/).map((s) => s.trim()).filter(Boolean);
  const ids: string[] = [];
  for (const part of parts) {
    const byLabel = traits.find((t) => t.label === part || t.id === part);
    if (byLabel) {
      if (!ids.includes(byLabel.id)) ids.push(byLabel.id);
      continue;
    }
    // fuzzy contains
    const fuzzy = traits.find((t) => part.includes(t.label) || t.label.includes(part));
    if (fuzzy) {
      if (!ids.includes(fuzzy.id)) ids.push(fuzzy.id);
      continue;
    }
    unsupported.push(`规则书单位「${unitName}」羁绊「${part}」未在羁绊表中找到——已跳过该羁绊引用。`);
  }
  return ids.slice(0, 3);
}

function parseUnitTable(table: MdTable, traits: TraitDef[], unsupported: string[]): UnitDef[] {
  const { map, unknown } = mapHeaders(table.headers, UNIT_ALIASES);
  for (const u of unknown) unsupported.push(`规则书单位表未识别列「${u}」——已忽略该列。`);
  if (map.name === undefined) {
    unsupported.push("规则书单位表缺少名称列。");
    return [];
  }
  const taken = new Set<string>();
  const units: UnitDef[] = [];
  for (const row of table.rows) {
    const name = cell(row, map.name);
    if (!name || /^-+$/.test(name)) continue;
    const idRaw = cell(row, map.id);
    const id = slugFrom(idRaw || name, taken, "u");
    const cost = parseIntCell(cell(row, map.cost)) ?? 2;
    const atk = parseIntCell(cell(row, map.atk)) ?? 40 + cost * 10;
    const hp = parseIntCell(cell(row, map.hp)) ?? 450 + cost * 100;
    if (cost < CONTENT_LIMITS.cost.min || cost > CONTENT_LIMITS.cost.max) {
      unsupported.push(`规则书单位「${name}」费用 ${cost} 越界（${CONTENT_LIMITS.cost.min}–${CONTENT_LIMITS.cost.max}）——整行跳过。`);
      continue;
    }
    if (atk < CONTENT_LIMITS.atk.min || atk > CONTENT_LIMITS.atk.max || hp < CONTENT_LIMITS.hp.min || hp > CONTENT_LIMITS.hp.max) {
      unsupported.push(`规则书单位「${name}」攻/血越界——整行跳过。`);
      continue;
    }
    const traitIds = resolveTraitIds(cell(row, map.traits), traits, unsupported, name);
    const shapeText = cell(row, map.shape) || name;
    const shape =
      (UNIT_SHAPE_PRESETS as readonly string[]).includes(shapeText)
        ? (shapeText as UnitShapePreset)
        : SHAPE_WORDS.find(([re]) => re.test(shapeText))?.[1];
    const procedural = shape ?? (UNIT_SHAPE_PRESETS[(cost * 3) % UNIT_SHAPE_PRESETS.length] as UnitShapePreset);
    units.push({
      id,
      name: name.slice(0, 16),
      cost,
      atk,
      hp,
      traits: traitIds,
      shape: procedural,
      proceduralPreset: procedural,
    });
    if (units.length >= CONTENT_LIMITS.units.max) break;
  }
  return units;
}

/** Parse unit + trait markdown tables from a rules book / long idea string. */
export function parseRulesBookContentTables(idea: string): RulesBookTableParse {
  const tables = extractMarkdownTables(idea);
  if (!tables.length) {
    return { unsupported: [], found: false, ideaWithoutTables: idea };
  }
  const unsupported: string[] = [];
  let traits: TraitDef[] | undefined;
  let units: UnitDef[] | undefined;
  let tuning: Record<string, number> = {};

  // Traits first so unit trait labels can resolve.
  for (const table of tables) {
    const kind = classifyTable(table.headers);
    if (kind === "trait") {
      const parsed = parseTraitTable(table, unsupported);
      if (parsed.length) traits = parsed;
    } else if (kind === "kv") {
      tuning = { ...tuning, ...parseKvSetupTable(table, unsupported) };
    } else if (kind === "unknown") {
      unsupported.push(`规则书表格表头无法归类为单位表或羁绊表：「${table.headers.join(" | ")}」——整表未导入。`);
    }
  }
  const traitList = traits ?? [];
  for (const table of tables) {
    if (classifyTable(table.headers) === "unit") {
      const parsed = parseUnitTable(table, traitList, unsupported);
      if (parsed.length) units = parsed;
    }
  }

  // Strip tables from idea (reverse order so offsets stay valid).
  let ideaWithoutTables = idea;
  for (const table of [...tables].sort((a, b) => b.start - a.start)) {
    ideaWithoutTables = ideaWithoutTables.slice(0, table.start) + ideaWithoutTables.slice(table.end);
  }

  const found = Boolean((units && units.length >= CONTENT_LIMITS.units.min) || (traits && traits.length >= 1) || Object.keys(tuning).length > 0);
  if (!found) {
    return { unsupported, found: false, ideaWithoutTables };
  }
  // Tuning-only (setup table without unit/trait tables) still counts as found for merge.


  // If units present but no trait table, keep empty traits array only when units need none —
  // otherwise caller should merge with pack traits. We only put traits in patch when parsed.
  if (units && units.length >= CONTENT_LIMITS.units.min && (!traits || !traits.length)) {
    // Drop trait refs that can't resolve against empty — already empty ids from resolveTraitIds.
    unsupported.push("规则书含单位表但无可用羁绊表；单位羁绊引用可能为空。请同时提供羁绊表，或依赖后续 NL/默认 pack 羁绊。");
  }

  const patch: AutoBattlerContentPatch = {
    ...(units && units.length >= CONTENT_LIMITS.units.min ? { units } : {}),
    ...(traits && traits.length >= 1 ? { traits } : {}),
  };
  if (!patch.units && !patch.traits) {
    return { unsupported, found: false, ideaWithoutTables };
  }
  return { patch, ...(Object.keys(tuning).length ? { tuning } : {}), unsupported, found: true, ideaWithoutTables };
}


/** Pull shell title / seat labels from rules-book H1 or 「产品称呼」lines (T005). */
export function inferBrandingFromRulesBook(
  idea: string,
  fallback: AutoBattlerBranding,
): AutoBattlerBranding {
  const h1Raw = idea.match(/^#\s+([^\n]+)/m)?.[1]?.trim();
  const h1Title = h1Raw?.split(/\s*[—–\-]\s*/)[0]?.replace(/[《》【】]/g, "").trim();
  // Allow markdown emphasis between 称呼 and colon: **产品称呼**：灰烬…
  const product = idea.match(/产品称呼[*_]*[：:]\s*([^\n；;。]+)/)?.[1]?.trim();
  const productTitle = product?.split(/[；;]/)[0]?.replace(/[*_]/g, "").trim();
  // Prefer explicit 产品称呼 over H1.
  const title =
    productTitle && productTitle.length >= 2 && productTitle.length <= 24
      ? productTitle
      : h1Title && h1Title.length >= 2 && h1Title.length <= 24
        ? h1Title
        : undefined;
  const own = idea.match(/我方席[「"『]?([^」"』\n；;]{1,16})/)?.[1]?.trim();
  const enemy = idea.match(/对手席[「"『]?([^」"』\n；;]{1,16})/)?.[1]?.trim();
  if (!title && !own && !enemy) return fallback;
  return {
    title: title || fallback.title,
    ownSeat: own || fallback.ownSeat,
    enemySeat: enemy || fallback.enemySeat,
  };
}
