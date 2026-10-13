/**
 * Generic natural-language → kernel configuration iteration.
 *
 * A kernel opts in through KERNEL_TUNING_REGISTRY by declaring:
 *   - numeric tuning knobs (phrases + bounds), and
 *   - clause parsers that edit its content data layer (units / traits / star rules…).
 * A prompt is split into clauses; every clause must be claimed by a knob or parser.
 * Claimed clauses become one configure_* op; unclaimed clauses are reported back as
 * unsupported (and recorded in runtimeSupport.unsupported) instead of silently dropped.
 * Nothing here is specific to one game's content.
 */
import type { ProjectChangeOperation, RuleSystem } from "../src/creator/project-contract";
import { AUTO_BATTLER_TUNING_LIMITS } from "../src/runtime/adapters/auto-battler";
import {
  DEFAULT_AUTO_BATTLER_CONTENT,
  resolveAutoBattlerContent,
  UNIT_SHAPE_PRESETS,
  CONTENT_LIMITS,
  type AutoBattlerContent,
  type AutoBattlerContentPatch,
  type TraitDef,
  type UnitDef,
  type UnitShapePreset,
} from "../src/runtime/adapters/auto-battler-content";
import { parseRuleNumber, RULE_NUMBER_TOKEN } from "./rule-numbers";

type Kernel = Extract<RuleSystem["runtimeSupport"], { status: "executable" }>["kernel"];

interface TuningKnob {
  key: string;
  label: string;
  unit: string;
  subject: RegExp;
  exclude?: RegExp;
  min: number;
  max: number;
}

export interface KernelChange { key: string; label: string; value: string | number }

/** Mutable draft a parser edits: numeric tuning + content (resolved, full). */
interface Draft<TContent> {
  tuning: Record<string, number>;
  content: TContent;
  contentTouched: Set<string>;
  changes: KernelChange[];
  /** Clauses claimed without a change: the request already matches the current config. */
  notes: string[];
}

/** Returns how many clauses starting at `i` it consumed (0 = not mine). */
type ClauseParser<TContent> = (clauses: string[], i: number, draft: Draft<TContent>) => number;

interface KernelTuningSpec<TContent = unknown> {
  knobs: TuningKnob[];
  parsers: ClauseParser<TContent>[];
  current(kernel: Kernel): { tuning: Record<string, number>; content: TContent };
  /** Patch persisted on the kernel for the touched content fields. */
  contentPatch(draft: Draft<TContent>, previous: unknown): Record<string, unknown> | undefined;
  operation(tuning: Record<string, number>, content: Record<string, unknown> | undefined, unsupported: string[]): ProjectChangeOperation;
}

export class KernelTuningRangeError extends Error {
  constructor(detail: string) {
    super(`iteration_unsupported: ${detail}`);
  }
}

const NUM = RULE_NUMBER_TOKEN;
const num = (s: string | undefined) => parseRuleNumber(s);
const prepAny = /(备战|准备|每回合|每轮|回合|计时|倒计时|限时|prep)/i;
const lim = AUTO_BATTLER_TUNING_LIMITS;

// ---------------------------------------------------------------- auto-battler content parsers

const SHAPE_WORDS: Array<[RegExp, UnitShapePreset]> = [
  [/蟹|钳/, "crab"], [/螺|号角/, "conch"], [/刀|刃|剑/, "blade"], [/弓|箭|射手|飞鱼/, "archer"],
  [/骑|坐骑|浪/, "rider"], [/葵|花|触手/, "anemone"], [/巫|女巫|法师/, "witch"], [/祭司|法杖|牧师/, "priest"],
  [/龟|壳/, "turtle"], [/鲸|盾|坦克/, "whale"], [/灯|提灯/, "lantern"], [/灵|精灵|幽灵|鳗|电/, "spirit"],
];

function findTrait(content: AutoBattlerContent, text: string): TraitDef | undefined {
  return [...content.traits]
    .sort((a, b) => b.label.length - a.label.length)
    .find((t) => text.includes(t.label) || new RegExp(`\\b${t.id}\\b`, "i").test(text));
}

function slugId(name: string, taken: Set<string>) {
  let id = `u${taken.size + 1}`;
  let n = taken.size + 1;
  while (taken.has(id)) id = `u${++n}`;
  void name;
  return id;
}

const ADD_UNIT = /(?:加|添加|新增|增加)(?:一个|一名|1个|个)?(?:新)?(?:的)?(?:单位|棋子|角色|英雄)/;
const UNIT_ATTR = /费用|花费|价格|攻击|攻|生命|血量|血|hp|羁绊|特质|种族|外形|造型|长得像|叫|名字/i;
const COMMAND_START = /^(?:把|将|开启|打开|关闭|关掉|允许|禁用|备战|初始|每回合|再)/;

const addUnitParser: ClauseParser<AutoBattlerContent> = (clauses, i, draft) => {
  const head = clauses[i]!;
  if (!ADD_UNIT.test(head)) return 0;
  let used = 1;
  while (i + used < clauses.length && UNIT_ATTR.test(clauses[i + used]!) && !COMMAND_START.test(clauses[i + used]!.trim())) used += 1;
  const text = clauses.slice(i, i + used).join("，");
  const content = draft.content;
  const name =
    text.match(/[“「『"]([^”」』"]{1,16})[”」』"]/)?.[1] ??
    text.match(/(?:叫|名为|名字是|名叫)\s*([\u4e00-\u9fa5A-Za-z]{1,8})/)?.[1];
  if (!name) throw new KernelTuningRangeError("新单位需要一个名字，例如：加一个新单位「雷鳗」，费用3，攻击80，生命600。");
  const cost = num(text.match(new RegExp(`(?:费用|花费|价格)\\s*(?:是|为|改成)?\\s*(${NUM})`))?.[1]);
  const atk = num(text.match(new RegExp(`攻击(?:力)?\\s*(?:是|为)?\\s*(${NUM})`))?.[1]);
  const hp = num(text.match(new RegExp(`(?:生命|血量|hp)(?:值)?\\s*(?:是|为)?\\s*(${NUM})`, "i"))?.[1]);
  const traitText = text.match(/(?:羁绊|特质|种族)\s*(?:是|为)?\s*([^，,。；;]+)/)?.[1] ?? "";
  const traits = content.traits.filter((t) => traitText.includes(t.label)).map((t) => t.id).slice(0, 3);
  const shapeText = text.match(/(?:外形|造型|长得像|外观)\s*(?:是|像|为)?\s*([^，,。；;]+)/)?.[1] ?? name;
  const shape = SHAPE_WORDS.find(([re]) => re.test(shapeText))?.[1];
  const unitCost = Number.isInteger(cost) ? cost : 2;
  const unit: UnitDef = {
    id: slugId(name, new Set(content.units.map((u) => u.id))),
    name,
    cost: unitCost,
    atk: Number.isInteger(atk) ? atk : 40 + unitCost * 10,
    hp: Number.isInteger(hp) ? hp : 450 + unitCost * 100,
    traits,
    shape: shape ?? (UNIT_SHAPE_PRESETS[(unitCost * 3) % UNIT_SHAPE_PRESETS.length] as UnitShapePreset),
  };
  draft.content = { ...content, units: [...content.units, unit] };
  draft.contentTouched.add("units");
  draft.changes.push({ key: "units", label: "新增单位", value: `${unit.name}（${unit.cost}费 攻${unit.atk} 血${unit.hp}${traits.length ? ` ${traits.map((id) => content.traits.find((t) => t.id === id)!.label).join("/")}` : ""}，外形 ${unit.shape}）` });
  return used;
};

function resample(values: readonly number[], length: number): number[] {
  return Array.from({ length }, (_, k) => values[Math.min(k, values.length - 1)] ?? 0);
}

const traitTierParser: ClauseParser<AutoBattlerContent> = (clauses, i, draft) => {
  const clause = clauses[i]!;
  const m = clause.match(new RegExp(`(?:档位|阈值|门槛|激活人数|人数档)\\s*(?:改成|改为|设为|调成|变成|调整为)\\s*(${NUM}(?:\\s*[/／、和]\\s*${NUM})*)`));
  if (!m) return 0;
  const trait = findTrait(draft.content, clause.slice(0, m.index));
  if (!trait) throw new KernelTuningRangeError(`没找到要改档位的羁绊；当前羁绊：${draft.content.traits.map((t) => t.label).join("、")}。`);
  const tiers = m[1]!.split(/[/／、和]/).map((x) => num(x.trim()));
  if (!tiers.every((n, k) => Number.isInteger(n) && n >= 1 && n <= 12 && (k === 0 || n > tiers[k - 1]!)) || tiers.length > 4) {
    throw new KernelTuningRangeError("羁绊档位需要 1–4 个递增的整数（1–12），例如 2/4/6。");
  }
  const next: TraitDef = {
    ...trait,
    tiers,
    ...(trait.effect ? { effect: { ...trait.effect, values: resample(trait.effect.values, tiers.length) } } : {}),
  };
  draft.content = { ...draft.content, traits: draft.content.traits.map((t) => (t.id === trait.id ? next : t)) };
  draft.contentTouched.add("traits");
  draft.changes.push({ key: `trait:${trait.id}`, label: `${trait.label}档位`, value: tiers.join("/") });
  return 1;
};

const STAR3 = /(★3|★★★|三星|3星)/;
const STAR2 = /(★2|★★|二星|两星|2星)/;
const starParser: ClauseParser<AutoBattlerContent> = (clauses, i, draft) => {
  const clause = clauses[i]!;
  const stars = { ...draft.content.stars };
  let hit = false;
  const mult = clause.match(new RegExp(`(★3|★★★|三星|3星|★2|★★|二星|两星|2星)\\s*(?:的)?\\s*倍率\\s*(?:改成|改为|设为|调成|是)?\\s*([0-9]+(?:\\.[0-9]+)?)`));
  if (mult) {
    const value = Number(mult[2]);
    if (!(value >= 1 && value <= 10)) throw new KernelTuningRangeError("升星倍率只能在 1–10 之间。");
    if (STAR3.test(mult[1]!)) { stars.mult3 = value; draft.changes.push({ key: "stars.mult3", label: "★3 倍率", value }); }
    else { stars.mult2 = value; draft.changes.push({ key: "stars.mult2", label: "★2 倍率", value }); }
    hit = true;
  }
  if (/(开启|打开|允许|加入|启用|开放|增加|支持|开)\s*(?:合成)?\s*(★3|★★★|三星|3星)/.test(clause) || /(?:三|3)个\s*(?:★2|二星|2星).{0,6}(?:合成|升)/.test(clause)) {
    stars.star3 = true; stars.star2 = true;
    if (!draft.changes.some((c) => c.key === "stars.star3")) draft.changes.push({ key: "stars.star3", label: "★3 合成", value: "开启" });
    hit = true;
  } else if (/(关闭|关掉|禁用|取消|去掉)\s*(★3|★★★|三星|3星)/.test(clause)) {
    stars.star3 = false; draft.changes.push({ key: "stars.star3", label: "★3 合成", value: "关闭" }); hit = true;
  } else if (/(关闭|关掉|禁用|取消|去掉)\s*(?:合成|升星|★2|★★|二星|两星|2星)/.test(clause)) {
    stars.star2 = false; stars.star3 = false; draft.changes.push({ key: "stars.star2", label: "升星合成", value: "关闭" }); hit = true;
  } else if (!mult && STAR2.test(clause) && /(开启|打开|允许|启用|合成)/.test(clause)) {
    if (stars.star2) draft.notes.push(`已支持：三个相同棋子自动合成 ★2（当前已开启，倍率 ×${stars.mult2}）`);
    else { stars.star2 = true; draft.changes.push({ key: "stars.star2", label: "★2 合成", value: "开启" }); }
    hit = true;
  }
  if (!hit) return 0;
  // Trailing qualitative clause about the merged unit ("属性变强" / "再强一点").
  const next = clauses[i + 1]?.trim();
  if (next && STAR_STRONGER.test(next) && !new RegExp(NUM).test(next)) {
    const which = STAR3.test(clause) && stars.star3 ? "mult3" : "mult2";
    const label = which === "mult3" ? "★3" : "★2";
    const sample = sampleUnit(draft.content);
    if (/(更|再|还要|加强|提高|提升)/.test(next)) {
      const before = stars[which];
      const after = Math.min(10, Math.round(before * (1 + magnitude(next)) * 10) / 10);
      stars[which] = after;
      draft.changes.push({ key: `stars.${which}`, label: `${label} 倍率（由「${next}」换算 +${Math.round(magnitude(next) * 100)}%）`, value: `×${before}→×${after}${sample ? `（例：${sample.name} 攻 ${Math.round(sample.atk * after)}、血 ${Math.round(sample.hp * after)}）` : ""}` });
    } else {
      draft.notes.push(`已支持：「${next}」= ${label} 属性 ×${stars[which]}${sample ? `（例：${sample.name} 攻 ${sample.atk}→${Math.round(sample.atk * stars[which])}，血 ${sample.hp}→${Math.round(sample.hp * stars[which])}）` : ""}`);
    }
    draft.content = { ...draft.content, stars };
    draft.contentTouched.add("stars");
    return 2;
  }
  draft.content = { ...draft.content, stars };
  draft.contentTouched.add("stars");
  return 1;
};


const STAR_STRONGER = /^(?:属性|数值|能力|强度)?\s*(?:会|要|就)?\s*(?:变强|更强|变得更强|提升|提高|增强|加强|翻倍|再强)/;

/** Qualitative degree → fraction: 稍微/一点 10%, 很多/大幅 40%, default 20%. */
function magnitude(text: string) {
  if (/(稍微|略|一点点|小幅|微)/.test(text)) return 0.1;
  if (/(很多|大幅|非常|特别|超级|翻倍|多很多)/.test(text)) return 0.4;
  return 0.2;
}

function sampleUnit(content: AutoBattlerContent) {
  return [...content.units].sort((a, b) => b.cost - a.cost)[0];
}

/** Longest existing unit names mentioned in text (non-overlapping). */
function mentionedUnits(content: AutoBattlerContent, text: string): UnitDef[] {
  const found: UnitDef[] = [];
  let rest = text;
  for (const u of [...content.units].sort((a, b) => b.name.length - a.name.length)) {
    if (rest.includes(u.name)) { found.push(u); rest = rest.split(u.name).join("\u0000"); }
  }
  return found.sort((a, b) => text.indexOf(a.name) - text.indexOf(b.name));
}

function describeUnit(u: UnitDef, content: AutoBattlerContent) {
  const traits = u.traits.map((id) => content.traits.find((t) => t.id === id)?.label ?? id).join("/");
  return `${u.name}（${u.cost}费 攻${u.atk} 血${u.hp}${traits ? ` ${traits}` : ""}${u.shape ? ` 外形${u.shape}` : ""}）`;
}

const DELETE_VERB = /(删除|删掉|去掉|移除|拿掉|删了|砍掉)/;
const deleteUnitParser: ClauseParser<AutoBattlerContent> = (clauses, i, draft) => {
  const clause = clauses[i]!;
  const verb = clause.match(DELETE_VERB);
  if (!verb || verb.index === undefined) return 0;
  const targets = mentionedUnits(draft.content, clause);
  if (!targets.length) {
    if (!/(单位|棋子|角色)/.test(clause)) return 0;
    throw new KernelTuningRangeError(`没找到要删除的单位；当前单位：${draft.content.units.map((u) => u.name).join("、")}。`);
  }
  const ids = new Set(targets.map((u) => u.id));
  const units = draft.content.units.filter((u) => !ids.has(u.id));
  if (units.length < CONTENT_LIMITS.units.min) {
    throw new KernelTuningRangeError(`至少要保留 ${CONTENT_LIMITS.units.min} 个单位。`);
  }
  draft.content = { ...draft.content, units };
  draft.contentTouched.add("units");
  draft.changes.push({ key: "units.delete", label: "删除单位", value: `${targets.map((u) => u.name).join("、")}（剩 ${units.length} 种）` });
  return 1;
};

const EDIT_ATTR = new RegExp(`(?:改名|名字|叫|费用|花费|价格|攻击|生命|血量|hp|羁绊|特质|种族|外形|造型|外观)`, "i");
function relativeOrAbsolute(text: string, field: RegExp, current: number): number | undefined {
  const abs = text.match(new RegExp(`${field.source}(?:力|值)?\\s*(?:改成|改为|设为|调成|变成|调到|=|是|为)\\s*(${NUM})`, "i"));
  if (abs) return num(abs[1]);
  const pct = text.match(new RegExp(`${field.source}(?:力|值)?\\s*(?:提高|增加|加|提升|\\+|降低|减少|减|下调|-)\\s*(${NUM})\\s*%`, "i"));
  if (pct) {
    const sign = /(降低|减少|减|下调|-)/.test(pct[0]) ? -1 : 1;
    return Math.round(current * (1 + (sign * num(pct[1])) / 100));
  }
  const delta = text.match(new RegExp(`${field.source}(?:力|值)?\\s*(提高|增加|加|提升|\\+|降低|减少|减|下调|-)\\s*(${NUM})`, "i"));
  if (delta) return current + (/(降低|减少|减|下调|-)/.test(delta[1]!) ? -1 : 1) * num(delta[2]);
  return undefined;
}

const editUnitParser: ClauseParser<AutoBattlerContent> = (clauses, i, draft) => {
  const head = clauses[i]!;
  const targets = mentionedUnits(draft.content, head);
  if (targets.length !== 1 || !EDIT_ATTR.test(head) || DELETE_VERB.test(head)) return 0;
  const target = targets[0]!;
  let used = 1;
  while (
    i + used < clauses.length &&
    EDIT_ATTR.test(clauses[i + used]!) &&
    !mentionedUnits(draft.content, clauses[i + used]!).length &&
    !COMMAND_START.test(clauses[i + used]!.trim()) &&
    !ADD_UNIT.test(clauses[i + used]!)
  ) used += 1;
  const text = clauses.slice(i, i + used).join("，");
  const content = draft.content;
  const next: UnitDef = { ...target, traits: [...target.traits] };
  const parts: string[] = [];
  const rename =
    text.match(/(?:改名(?:为|成|叫)?|名字改(?:为|成)|改叫|名字叫)\s*[“「『"]?([\u4e00-\u9fa5A-Za-z0-9]{1,8})/)?.[1];
  if (rename) {
    if (content.units.some((u) => u.name === rename && u.id !== target.id)) throw new KernelTuningRangeError(`已经有叫「${rename}」的单位了。`);
    next.name = rename; parts.push(`改名 ${target.name}→${rename}`);
  }
  const cost = relativeOrAbsolute(text, /(?:费用|花费|价格)/, target.cost);
  if (cost !== undefined) { next.cost = cost; parts.push(`费用 ${target.cost}→${cost}`); }
  const atk = relativeOrAbsolute(text, /攻击/, target.atk);
  if (atk !== undefined) { next.atk = atk; parts.push(`攻击 ${target.atk}→${atk}`); }
  const hp = relativeOrAbsolute(text, /(?:生命|血量|hp)/, target.hp);
  if (hp !== undefined) { next.hp = hp; parts.push(`生命 ${target.hp}→${hp}`); }
  const traitText = text.match(/(?:羁绊|特质|种族)\s*(?:改成|改为|换成|设为|变成|是)\s*([^，,。；;]+)/)?.[1];
  if (traitText !== undefined) {
    const traits = content.traits.filter((t) => traitText.includes(t.label)).map((t) => t.id).slice(0, 3);
    if (!traits.length && !/(无|没有|去掉)/.test(traitText)) throw new KernelTuningRangeError(`没找到羁绊「${traitText}」；当前羁绊：${content.traits.map((t) => t.label).join("、")}。`);
    next.traits = traits; parts.push(`羁绊 → ${traits.map((id) => content.traits.find((t) => t.id === id)!.label).join("/") || "无"}`);
  }
  const shapeText = text.match(/(?:外形|造型|外观)\s*(?:改成|改为|换成|变成|像|是)\s*([^，,。；;]+)/)?.[1];
  if (shapeText !== undefined) {
    const shape = UNIT_SHAPE_PRESETS.find((p) => shapeText.includes(p)) ?? SHAPE_WORDS.find(([re]) => re.test(shapeText))?.[1];
    if (!shape) throw new KernelTuningRangeError(`外形只能选预设：${UNIT_SHAPE_PRESETS.join(" / ")}（或说「像螃蟹/鲸/弓手…」）。`);
    next.shape = shape; parts.push(`外形 → ${shape}`);
  }
  if (!parts.length) return 0;
  const L = CONTENT_LIMITS;
  if (!(Number.isInteger(next.cost) && next.cost >= L.cost.min && next.cost <= L.cost.max)) throw new KernelTuningRangeError(`费用只能是 ${L.cost.min}–${L.cost.max}。`);
  if (!(Number.isInteger(next.atk) && next.atk >= L.atk.min && next.atk <= L.atk.max)) throw new KernelTuningRangeError(`攻击只能是 ${L.atk.min}–${L.atk.max}。`);
  if (!(Number.isInteger(next.hp) && next.hp >= L.hp.min && next.hp <= L.hp.max)) throw new KernelTuningRangeError(`生命只能是 ${L.hp.min}–${L.hp.max}。`);
  draft.content = { ...content, units: content.units.map((u) => (u.id === target.id ? next : u)) };
  draft.contentTouched.add("units");
  draft.changes.push({ key: `unit:${target.id}`, label: `修改单位 ${target.name}`, value: `${parts.join("，")}（现为 ${describeUnit(next, content)}）` });
  return used;
};

/** Requests that already match the current content: claimed with an "已支持" note. */
const defaultsParser: ClauseParser<AutoBattlerContent> = (clauses, i, draft) => {
  const clause = clauses[i]!;
  const content = draft.content;
  if (/超时.{0,4}(?:自动)?(?:开打|开战|开始战斗|进入战斗|开始)/.test(clause) && !/[0-9]/.test(clause)) {
    draft.notes.push("已支持：备战截止时间到了服务端定时器会自动开打（没人操作也会推进）");
    return 1;
  }
  const pool = clause.match(new RegExp(`(?:棋子池|单位池|卡池|棋子|单位).{0,6}?(${NUM})\\s*(?:种|个|款)`));
  if (pool && /(池|种|扩|做|有|增加到|达到)/.test(clause) && !ADD_UNIT.test(clause)) {
    const n = num(pool[1]);
    if (n === content.units.length) {
      draft.notes.push(`已支持：当前单位池就是 ${n} 种（${content.units.map((u) => `${u.name}${u.cost}费`).join("、")}）`);
      return 1;
    }
    throw new KernelTuningRangeError(`单位池数量由单位列表决定，当前 ${content.units.length} 种；要改成 ${n} 种请逐个说「加一个新单位「名字」，费用…」或「删掉某某」。`);
  }
  const traitCount = clause.match(new RegExp(`(${NUM})\\s*(?:组|个|种|套)\\s*羁绊`));
  if (traitCount) {
    const n = num(traitCount[1]);
    let used = 1;
    const wantsHeal = (text: string) => /(治疗|回血|奶|恢复)/.test(text);
    let healAsked = wantsHeal(clause);
    if (!healAsked && clauses[i + 1] && wantsHeal(clauses[i + 1]!) && !/[0-9]/.test(clauses[i + 1]!)) { healAsked = true; used = 2; }
    const healer = content.traits.find((t) => t.effect?.kind === "heal_first_strike");
    if (n === content.traits.length && (!healAsked || healer)) {
      draft.notes.push(`已支持：当前已有 ${n} 组羁绊（${content.traits.map((t) => `${t.label} ${t.tiers.join("/")}${t.effect ? ` ${t.effect.label}` : ""}`).join("；")}）${healAsked && healer ? `，其中「${healer.label}」带治疗效果（${healer.effect!.label}：${healer.effect!.values.map((v) => `${Math.round(v * 100)}%`).join("/")}）` : ""}`);
      return used;
    }
    throw new KernelTuningRangeError(`当前 ${content.traits.length} 组羁绊${healer ? `（含治疗：${healer.label}）` : "（无治疗效果）"}；增删羁绊组或新效果种类暂不支持，只能改已有羁绊的档位。`);
  }
  return 0;
};

/** Qualitative balance requests → concrete numbers (reported in the change list). */
const vagueParser: ClauseParser<AutoBattlerContent> = (clauses, i, draft) => {
  const clause = clauses[i]!;
  if (new RegExp(NUM).test(clause.replace(/[一二两三]星/g, ""))) return 0;
  const m = magnitude(clause);
  const pctLabel = `${Math.round(m * 100)}%`;
  const content = draft.content;
  const ratio = (u: UnitDef) => u.hp / u.atk;
  const sorted = [...content.units].sort((a, b) => ratio(b) - ratio(a));
  const quarter = Math.max(1, Math.round(content.units.length / 4));
  const scaleUnits = (group: UnitDef[], field: "hp" | "atk", sign: 1 | -1, label: string) => {
    const ids = new Set(group.map((u) => u.id));
    const cap = field === "hp" ? CONTENT_LIMITS.hp.max : CONTENT_LIMITS.atk.max;
    const detail: string[] = [];
    draft.content = {
      ...draft.content,
      units: draft.content.units.map((u) => {
        if (!ids.has(u.id)) return u;
        const value = Math.max(1, Math.min(cap, Math.round(u[field] * (1 + sign * m))));
        detail.push(`${u.name} ${u[field]}→${value}`);
        return { ...u, [field]: value };
      }),
    };
    draft.contentTouched.add("units");
    draft.changes.push({ key: `vague:${label}`, label: `${label}${field === "hp" ? "生命" : "攻击"} ${sign > 0 ? "+" : "-"}${pctLabel}（由「${clause}」换算）`, value: detail.join("，") });
  };
  if (/(坦克|前排|肉盾|硬壳|tank)/i.test(clause) && /(肉|硬|耐打|抗揍|血厚|厚)/.test(clause)) {
    scaleUnits(sorted.slice(0, quarter), "hp", /(脆|薄|软)/.test(clause) ? -1 : 1, "坦克（血/攻比最高的 1/4 单位）");
    return 1;
  }
  if (/(输出|射手|刺客|后排|dps|脆皮)/i.test(clause) && /(痛|伤害|输出高|更强|猛)/.test(clause)) {
    scaleUnits([...sorted].reverse().slice(0, quarter), "atk", 1, "输出（攻/血比最高的 1/4 单位）");
    return 1;
  }
  if (/(所有|全部|全体)(单位|棋子)/.test(clause) && /(更强|变强|加强)/.test(clause)) {
    scaleUnits([...content.units], "atk", 1, "全体单位");
    scaleUnits([...content.units], "hp", 1, "全体单位");
    return 1;
  }
  const pace = clause.match(/节奏\s*(?:再|更)?\s*(快|慢)|(快|慢)节奏/);
  if (pace) {
    const faster = (pace[1] ?? pace[2]) === "快";
    const factor = faster ? 1 - Math.max(m, 0.2) - (m >= 0.4 ? 0 : 0.13) : 1 + Math.max(m, 0.2) * 2.5;
    const defaults: Record<string, number> = { prepShopSeconds: 45, prepPlaceSeconds: 30 };
    const out: string[] = [];
    for (const key of ["prepShopSeconds", "prepPlaceSeconds"] as const) {
      const before = draft.tuning[key] ?? defaults[key]!;
      const after = Math.max(lim[key].min, Math.min(lim[key].max, Math.round((before * factor) / 5) * 5));
      draft.tuning[key] = after;
      out.push(`${key === "prepShopSeconds" ? "商店" : "布阵"} ${before}→${after}秒`);
    }
    if (faster && /前期|开局|早期/.test(clause)) {
      const before = draft.tuning.startGold ?? 10;
      const after = Math.min(lim.startGold.max, Math.round(before * 1.3));
      draft.tuning.startGold = after;
      out.push(`初始金币 ${before}→${after}（开局多买 1–2 个棋子）`);
    }
    draft.changes.push({ key: "vague:pace", label: `节奏${faster ? "加快" : "放慢"}（由「${clause}」换算）`, value: out.join("，") });
    return 1;
  }
  if (/(金币|钱)/.test(clause) && /(多|宽裕)/.test(clause)) {
    const before = draft.tuning.startGold ?? 10;
    const after = Math.min(lim.startGold.max, Math.round(before * (1 + Math.max(m, 0.3))));
    draft.tuning.startGold = after;
    draft.changes.push({ key: "vague:gold", label: `初始金币（由「${clause}」换算）`, value: `${before}→${after}` });
    return 1;
  }
  return 0;
};

export const KERNEL_TUNING_REGISTRY: Partial<Record<Kernel["type"], KernelTuningSpec<AutoBattlerContent>>> = {
  "auto-battler-v1": {
    knobs: [
      { key: "prepShopSeconds", label: "商店备战时长", unit: "秒", subject: /(商店|购买|买棋|shop)/i, ...lim.prepShopSeconds },
      { key: "prepPlaceSeconds", label: "布阵时长", unit: "秒", subject: /(布阵|上阵|摆放|place)/i, ...lim.prepPlaceSeconds },
      { key: "prepShopSeconds", label: "商店备战时长", unit: "秒", subject: prepAny, exclude: /(商店|购买|买棋|布阵|上阵|摆放|shop|place)/i, ...lim.prepShopSeconds },
      { key: "prepPlaceSeconds", label: "布阵时长", unit: "秒", subject: prepAny, exclude: /(商店|购买|买棋|布阵|上阵|摆放|shop|place)/i, ...lim.prepPlaceSeconds },
      { key: "startHp", label: "初始生命", unit: "", subject: /(血量|生命|血|hp)/i, ...lim.startHp },
      { key: "startGold", label: "初始金币", unit: "", subject: /(金币|金钱|gold)/i, ...lim.startGold },
    ],
    parsers: [addUnitParser, deleteUnitParser, traitTierParser, starParser, editUnitParser, defaultsParser, vagueParser],
    current: (kernel) => {
      const k = kernel as { tuning?: Record<string, number>; content?: AutoBattlerContentPatch };
      return {
        tuning: { ...(k.tuning ?? {}) },
        content: resolveAutoBattlerContent(k.content) ?? DEFAULT_AUTO_BATTLER_CONTENT,
      };
    },
    contentPatch: (draft, previous) => {
      const prev = (previous ?? {}) as Record<string, unknown>;
      const patch: Record<string, unknown> = { ...prev };
      if (draft.contentTouched.has("units")) patch.units = draft.content.units.map((u) => ({ ...u, traits: [...u.traits] }));
      if (draft.contentTouched.has("traits")) {
        patch.traits = draft.content.traits.map((t) => ({ ...t, tiers: [...t.tiers], ...(t.effect ? { effect: { ...t.effect, values: [...t.effect.values] } } : {}) }));
      }
      if (draft.contentTouched.has("stars")) patch.stars = { ...draft.content.stars };
      return Object.keys(patch).length ? patch : undefined;
    },
    operation: (tuning, content, unsupported) => ({
      op: "configure_auto_battler",
      config: {
        playerCount: 2,
        ...(unsupported.length ? { unsupported } : {}),
        ...(Object.keys(tuning).length ? { tuning } : {}),
        ...(content ? { content: content as AutoBattlerContentPatch } : {}),
      },
    }),
  },
};

const clauseSplit = /[，,。；;！!\n]|并且|同时|另外|然后|以及/;
/** Clauses that carry no instruction (politeness / filler) never count as unsupported. */
const filler = /^(?:请|帮我|麻烦|谢谢|好的|嗯|吧|呢|一下)*$/;

export interface KernelEditResult {
  changes: KernelChange[];
  notes: string[];
  unsupportedClauses: string[];
  tuning: Record<string, number>;
  contentPatch?: Record<string, unknown>;
  operation?: ProjectChangeOperation;
}

/** Parse every clause of `prompt` against the kernel's registry entry. */
export function parseKernelEdits(
  kernel: Kernel,
  prompt: string,
  baseUnsupported: string[] = [],
): KernelEditResult | undefined {
  const spec = KERNEL_TUNING_REGISTRY[kernel.type];
  if (!spec) return undefined;
  const clauses = prompt.split(clauseSplit).map((c) => c.trim()).filter((c) => c && !filler.test(c));
  const base = spec.current(kernel);
  const draft: Draft<AutoBattlerContent> = { tuning: { ...base.tuning }, content: base.content, contentTouched: new Set(), changes: [], notes: [] };
  const numberRe = new RegExp(`(${NUM})\\s*(秒|s\\b|点|金|滴)?`, "i");
  const unsupportedClauses: string[] = [];
  for (let i = 0; i < clauses.length; ) {
    let used = 0;
    for (const parser of spec.parsers) {
      used = parser(clauses, i, draft);
      if (used) break;
    }
    if (!used) {
      const clause = clauses[i]!;
      const match = clause.match(numberRe);
      if (match && match.index !== undefined) {
        const before = clause.slice(0, match.index);
        const value = parseRuleNumber(match[1]);
        for (const knob of spec.knobs) {
          if (!Number.isInteger(value) || !knob.subject.test(before) || knob.exclude?.test(before)) continue;
          const isSeconds = knob.unit === "秒";
          if (isSeconds !== /秒|s\b|second/i.test(match[2] ?? clause.slice(match.index))) continue;
          if (value < knob.min || value > knob.max) {
            throw new KernelTuningRangeError(`${knob.label}只能在 ${knob.min}–${knob.max}${knob.unit} 之间；你写的是 ${value}${knob.unit}。`);
          }
          draft.tuning[knob.key] = value;
          if (!draft.changes.some((c) => c.key === knob.key)) draft.changes.push({ key: knob.key, label: knob.label, value: `${value}${knob.unit}` });
          used = 1;
        }
      }
    }
    if (!used) {
      unsupportedClauses.push(clauses[i]!);
      used = 1;
    }
    i += used;
  }
  if (!draft.changes.length && !draft.notes.length) return { changes: [], notes: [], unsupportedClauses, tuning: draft.tuning };
  const prevContent = (kernel as { content?: unknown }).content;
  const contentPatch = spec.contentPatch(draft, prevContent);
  if (contentPatch && resolveAutoBattlerContent(contentPatch) === null) {
    throw new KernelTuningRangeError("改动后的单位/羁绊数据不合法（例如超过 24 个单位或数值越界）。");
  }
  const unsupported = [
    ...baseUnsupported,
    ...unsupportedClauses.map((c) => `未执行的创作者要求：「${c}」——当前内核没有对应的可配置项。`),
  ];
  return {
    changes: draft.changes,
    notes: draft.notes,
    unsupportedClauses,
    tuning: draft.tuning,
    ...(contentPatch ? { contentPatch } : {}),
    operation: spec.operation(draft.tuning, contentPatch, unsupported),
  };
}

export interface KernelTuningIterationPlan {
  prompt: string;
  summary: string;
  actionId: string;
  actionLabel: string;
  sourceId: string;
  changes: KernelChange[];
  unsupportedClauses: string[];
  operations: ProjectChangeOperation[];
}

/** Returns undefined when the prompt names nothing the active kernel can configure. */
export function createKernelTuningIterationPlan(input: {
  ruleSystem: RuleSystem;
  prompt: string;
  sourceId: string;
}): KernelTuningIterationPlan | undefined {
  const support = input.ruleSystem.runtimeSupport;
  if (!support || support.status !== "executable") return undefined;
  const prompt = input.prompt.trim();
  const parsed = parseKernelEdits(support.kernel, prompt, [...(support.unsupported ?? [])]);
  if (!parsed || !parsed.operation) return undefined;
  const summary =
    (parsed.changes.length ? `调整内核配置：${parsed.changes.map((c) => `${c.label} → ${c.value}`).join("，")}。` : "无需改动。") +
    (parsed.notes.length ? ` ${parsed.notes.join("；")}。` : "") +
    (parsed.unsupportedClauses.length ? ` 未执行（已记入不支持清单）：${parsed.unsupportedClauses.map((c) => `「${c}」`).join("、")}。` : "");
  return {
    prompt,
    summary,
    actionId: "kernel-config",
    actionLabel: "内核配置",
    sourceId: input.sourceId,
    changes: parsed.changes,
    unsupportedClauses: parsed.unsupportedClauses,
    operations: [
      {
        op: "add_source",
        source: {
          id: input.sourceId,
          kind: "brief",
          name: `${input.ruleSystem.name} · Studio 迭代提示`,
          content: prompt,
          provenance: { origin: "creator-authored", locator: "GoDesk Web Studio natural-language iteration" },
        },
      },
      parsed.operation,
    ],
  };
}
