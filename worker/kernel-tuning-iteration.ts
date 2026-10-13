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
    stars.star2 = true; draft.changes.push({ key: "stars.star2", label: "★2 合成", value: "开启" }); hit = true;
  }
  if (!hit) return 0;
  draft.content = { ...draft.content, stars };
  draft.contentTouched.add("stars");
  return 1;
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
    parsers: [addUnitParser, traitTierParser, starParser],
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
  const draft: Draft<AutoBattlerContent> = { tuning: { ...base.tuning }, content: base.content, contentTouched: new Set(), changes: [] };
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
  if (!draft.changes.length) return { changes: [], unsupportedClauses, tuning: draft.tuning };
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
    `调整内核配置：${parsed.changes.map((c) => `${c.label} → ${c.value}`).join("，")}。` +
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
