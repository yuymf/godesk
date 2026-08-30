import type {
  ProjectChangeOperation,
  RuleSystem,
} from "../src/creator/project-contract";

export interface ActionDescriptionIterationPlan {
  prompt: string;
  summary: string;
  actionId: string;
  actionLabel: string;
  sourceId: string;
  operations: ProjectChangeOperation[];
}

export class IterationPlanError extends Error {
  constructor(
    readonly code: "iteration_unsupported" | "iteration_action_not_found",
    detail: string,
  ) {
    super(`${code}: ${detail}`);
  }
}

const quotedValue = `[“「『"](.+?)[”」』"]`;
const actionNumber = "[0-9一二两三四五六七八九十]+";

const chineseDigits: Record<string, number> = {
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
};

function parseActionNumber(value: string) {
  const numeric = Number(value);
  if (Number.isInteger(numeric)) return numeric;
  if (value.length === 1) return chineseDigits[value] ?? Number.NaN;
  if (value.startsWith("十")) {
    const ones = chineseDigits[value.slice(1)];
    return Number.isInteger(ones) ? 10 + ones : Number.NaN;
  }
  if (value.endsWith("十")) {
    const tens = chineseDigits[value.slice(0, -1)];
    return Number.isInteger(tens) ? tens * 10 : Number.NaN;
  }
  return Number.NaN;
}

function normalizeLabel(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function findAction(
  ruleSystem: RuleSystem,
  target: { ordinal?: number; label?: string },
) {
  if (target.ordinal !== undefined) {
    const action = ruleSystem.actions[target.ordinal - 1];
    if (action) return action;
    throw new IterationPlanError(
      "iteration_action_not_found",
      `找不到第 ${target.ordinal} 个行动；当前只有 ${ruleSystem.actions.length} 个行动。`,
    );
  }
  const normalizedTarget = normalizeLabel(target.label ?? "");
  const action = ruleSystem.actions.find(
    (candidate) => normalizeLabel(candidate.label) === normalizedTarget,
  );
  if (action) return action;
  throw new IterationPlanError(
    "iteration_action_not_found",
    `找不到行动「${target.label ?? ""}」；请使用当前行动名称或序号。`,
  );
}

function parseDescriptionRequest(prompt: string) {
  const chineseOrdinal = prompt.match(
    new RegExp(
      `(?:把|将)\\s*(?:(?:行动\\s*)?(?:第\\s*)?(${actionNumber})(?:\\s*个)?(?:\\s*行动)?|${quotedValue})\\s*(?:的)?\\s*(?:说明|描述|文案|文字)\\s*(?:改成|改为|换成|写成|更新为)\\s*${quotedValue}`,
    ),
  );
  if (chineseOrdinal) {
    const firstTarget = chineseOrdinal[1] || chineseOrdinal[2];
    const nextDescription = chineseOrdinal[3];
    const ordinal = chineseOrdinal[1]
      ? parseActionNumber(chineseOrdinal[1])
      : undefined;
    if (!nextDescription?.trim()) return undefined;
    return {
      target: ordinal !== undefined && Number.isInteger(ordinal)
        ? { ordinal }
        : { label: firstTarget },
      description: nextDescription.trim(),
    };
  }

  const english = prompt.match(
    /(?:change|rewrite|update)\s+(?:the\s+)?action\s+(?:(?:#)?(\d+)|[“「『"](.+?)[”」』"]|'(.+?)')\s+(?:description|copy|text)\s+(?:to|as)\s+(?:[“「『"](.+?)[”」』"]|'(.+?)')/i,
  );
  if (english) {
    const ordinal = english[1] ? Number(english[1]) : undefined;
    const label = english[2] || english[3];
    const description = english[4] || english[5];
    if (!description?.trim()) return undefined;
    return {
      target: ordinal !== undefined ? { ordinal } : { label },
      description: description.trim(),
    };
  }

  return undefined;
}

export function createActionDescriptionIterationPlan(input: {
  ruleSystem: RuleSystem;
  prompt: string;
  sourceId: string;
}): ActionDescriptionIterationPlan {
  const prompt = input.prompt.trim();
  const parsed = parseDescriptionRequest(prompt);
  if (!parsed) {
    throw new IterationPlanError(
      "iteration_unsupported",
      "Studio 目前只支持一次聚焦的行动说明改写，例如：把行动 2 的说明改成“先说明新增约束，再说明获得 2 分”。规则数值、行动增删和胜利条件请回到 Rule System 编辑器或交给 Codex。",
    );
  }
  if (parsed.description.length > 1_000) {
    throw new IterationPlanError(
      "iteration_unsupported",
      "行动说明最多 1000 个字符；请把改动拆成一次聚焦迭代。",
    );
  }

  const action = findAction(input.ruleSystem, parsed.target);
  const actions = input.ruleSystem.actions.map((candidate) =>
    candidate.id === action.id
      ? {
          ...candidate,
          description: parsed.description,
          sourceId: input.sourceId,
          provenance: "ai-proposed" as const,
          confidence: 1,
        }
      : candidate,
  );
  return {
    prompt,
    summary: `将行动「${action.label}」的说明改为「${parsed.description}」。`,
    actionId: action.id,
    actionLabel: action.label,
    sourceId: input.sourceId,
    operations: [
      {
        op: "add_source",
        source: {
          id: input.sourceId,
          kind: "brief",
          name: `${input.ruleSystem.name} · Studio 迭代提示`,
          content: prompt,
          provenance: {
            origin: "creator-authored",
            locator: "GoDesk Web Studio natural-language iteration",
          },
        },
      },
      {
        op: "update_rule_system",
        fields: { actions },
      },
    ],
  };
}
