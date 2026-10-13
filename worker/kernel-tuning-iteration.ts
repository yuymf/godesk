/**
 * Generic natural-language → kernel tuning iteration.
 *
 * Studio's 「下一版想改什么？」 box used to accept only action-description rewrites, so a
 * creator saying 「备战限时30秒」 or 「初始血量改成30」 got iteration_unsupported even when the
 * active kernel already exposes that rule as a number. This module maps such prompts onto
 * the kernel's declared, bounded tuning knobs and emits the kernel's own configure_* op.
 *
 * It is a registry keyed by kernel type: a kernel opts in by listing knobs (key, phrases,
 * bounds) and how to rebuild its configure op. Nothing here is game-content specific.
 */
import type { ProjectChangeOperation, RuleSystem } from "../src/creator/project-contract";
import { AUTO_BATTLER_TUNING_LIMITS } from "../src/runtime/adapters/auto-battler";
import { parseRuleNumber, RULE_NUMBER_TOKEN } from "./rule-numbers";

type Kernel = Extract<RuleSystem["runtimeSupport"], { status: "executable" }>["kernel"];

interface TuningKnob {
  key: string;
  label: string;
  unit: string;
  /** Phrase that must appear before the number (same clause). */
  subject: RegExp;
  /** Optional phrase that excludes this knob (e.g. a more specific sibling matched). */
  exclude?: RegExp;
  min: number;
  max: number;
}

interface KernelTuningSpec {
  knobs: TuningKnob[];
  current(kernel: Kernel): Record<string, number>;
  operation(kernel: Kernel, tuning: Record<string, number>, unsupported: string[]): ProjectChangeOperation;
}

const prepAny = /(备战|准备|每回合|每轮|回合|计时|倒计时|限时|prep)/i;
const lim = AUTO_BATTLER_TUNING_LIMITS;

export const KERNEL_TUNING_REGISTRY: Partial<Record<Kernel["type"], KernelTuningSpec>> = {
  "auto-battler-v1": {
    knobs: [
      { key: "prepShopSeconds", label: "商店备战时长", unit: "秒", subject: /(商店|购买|买棋|shop)/i, ...lim.prepShopSeconds },
      { key: "prepPlaceSeconds", label: "布阵时长", unit: "秒", subject: /(布阵|上阵|摆放|place)/i, ...lim.prepPlaceSeconds },
      // Bare 「备战/每回合…N秒」 applies to both prep phases.
      { key: "prepShopSeconds", label: "商店备战时长", unit: "秒", subject: prepAny, exclude: /(商店|购买|买棋|布阵|上阵|摆放|shop|place)/i, ...lim.prepShopSeconds },
      { key: "prepPlaceSeconds", label: "布阵时长", unit: "秒", subject: prepAny, exclude: /(商店|购买|买棋|布阵|上阵|摆放|shop|place)/i, ...lim.prepPlaceSeconds },
      { key: "startHp", label: "初始生命", unit: "", subject: /(血量|生命|血|hp)/i, ...lim.startHp },
      { key: "startGold", label: "初始金币", unit: "", subject: /(金币|金钱|gold)/i, ...lim.startGold },
    ],
    current: (kernel) => ({ ...((kernel as { tuning?: Record<string, number> }).tuning ?? {}) }),
    operation: (kernel, tuning, unsupported) => ({
      op: "configure_auto_battler",
      config: {
        playerCount: 2,
        ...(unsupported.length ? { unsupported } : {}),
        tuning,
      },
    }),
  },
};

export interface KernelTuningIterationPlan {
  prompt: string;
  summary: string;
  actionId: string;
  actionLabel: string;
  sourceId: string;
  changes: Array<{ key: string; label: string; value: number }>;
  operations: ProjectChangeOperation[];
}

export class KernelTuningRangeError extends Error {
  constructor(detail: string) {
    super(`iteration_unsupported: ${detail}`);
  }
}

const clauseSplit = /[，,。；;！!\n]/;

/** Returns undefined when the prompt names no tunable number of the active kernel. */
export function createKernelTuningIterationPlan(input: {
  ruleSystem: RuleSystem;
  prompt: string;
  sourceId: string;
}): KernelTuningIterationPlan | undefined {
  const support = input.ruleSystem.runtimeSupport;
  if (!support || support.status !== "executable") return undefined;
  const kernel = support.kernel;
  const spec = KERNEL_TUNING_REGISTRY[kernel.type];
  if (!spec) return undefined;
  const prompt = input.prompt.trim();
  const numberRe = new RegExp(`(${RULE_NUMBER_TOKEN})\\s*(秒|s\\b|点|金|滴)?`, "i");
  const changes: KernelTuningIterationPlan["changes"] = [];
  for (const clause of prompt.split(clauseSplit)) {
    const match = clause.match(numberRe);
    if (!match || match.index === undefined) continue;
    const before = clause.slice(0, match.index);
    const value = parseRuleNumber(match[1]);
    if (!Number.isInteger(value)) continue;
    for (const knob of spec.knobs) {
      if (!knob.subject.test(before)) continue;
      if (knob.exclude?.test(before)) continue;
      // Seconds knobs need a seconds-ish clause; HP/gold knobs must not grab seconds.
      const isSeconds = knob.unit === "秒";
      if (isSeconds !== /秒|s\b|second/i.test(match[2] ?? clause.slice(match.index))) continue;
      if (value < knob.min || value > knob.max) {
        throw new KernelTuningRangeError(`${knob.label}只能在 ${knob.min}–${knob.max}${knob.unit} 之间；你写的是 ${value}${knob.unit}。`);
      }
      if (!changes.some((c) => c.key === knob.key)) changes.push({ key: knob.key, label: knob.label, value });
    }
  }
  if (!changes.length) return undefined;
  const tuning = { ...spec.current(kernel) };
  for (const change of changes) tuning[change.key] = change.value;
  const unsupported = [...(support.unsupported ?? [])];
  const summary = `调整内核参数：${changes.map((c) => `${c.label} → ${c.value}${changesUnit(spec, c.key)}`).join("，")}。`;
  return {
    prompt,
    summary,
    actionId: "kernel-tuning",
    actionLabel: "内核参数",
    sourceId: input.sourceId,
    changes,
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
      spec.operation(kernel, tuning, unsupported),
    ],
  };
}

function changesUnit(spec: KernelTuningSpec, key: string) {
  return spec.knobs.find((k) => k.key === key)?.unit ?? "";
}
