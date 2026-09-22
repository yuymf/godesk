import {
  acceptIntent,
  executableRuntime,
  initialSessionState,
  scopeSessionState,
} from "./runtime";
import type {
  ApplyProjectChangesInput,
  ApplyProjectChangesResult,
  Changeset,
  CompileBuildInput,
  CompileBuildResult,
  CreatorJob,
  DesignHypothesis,
  DuplicateRuleSystemResult,
  RestoreBuildResult,
  GameProject,
  GameReplay,
  SharedSessionSnapshot,
  ProjectChangeOperation,
  SourceLibraryEntry,
  PresentationFloorReadiness,
  ValidationFinding,
  VisualTreatment,
  RuleSystem,
} from "../src/creator/project-contract";
import {
  publicSeats,
  type StoredSessionSeat,
} from "./seat-capability";
import type {
  StoredPlayableBuild,
  StoredPlaytest,
  StoredPlaytestLink,
  StoredSharedSession,
} from "./public-urls";

export {
  publicBuild,
  publicJob,
  publicMutation,
  publicPlaytest,
  publicPlaytestLink,
  publicSession,
  signedShareToken,
} from "./public-urls";
export type {
  StoredPlayableBuild,
  StoredPlaytest,
  StoredPlaytestLink,
  StoredSharedSession,
} from "./public-urls";

export const PROJECT_PREFIX = "/projects/";
export const GENERATION_PLAN_PREFIX = "generation-plan:";
export const PLAYTEST_LINK_PREFIX = "playtest-link:";
export interface ProjectRecord {
  project: GameProject;
  ruleSystem: RuleSystem;
  ruleSystems: RuleSystem[];
  sources: SourceLibraryEntry[];
  changesets: Changeset[];
  builds: StoredPlayableBuild[];
  playtests: StoredPlaytest[];
  sessions: StoredSharedSession[];
  jobs: CreatorJob[];
  hypotheses: DesignHypothesis[];
  findings: ValidationFinding[];
}

export interface SessionSocketAttachment {
  sessionId: string;
  seat?: number;
  seatTokenHash?: string;
}
export type StoredReplay = GameReplay;
export type StoredCompileBuildResult = Omit<
  CompileBuildResult,
  "build" | "studioUrl"
> & {
  build: StoredPlayableBuild;
  studioPath: string;
};
export type StoredApplyProjectChangesResult = Omit<
  ApplyProjectChangesResult,
  "studioUrl"
> & { studioPath: string };
export type StoredDuplicateRuleSystemResult = Omit<
  DuplicateRuleSystemResult,
  "studioUrl"
> & { studioPath: string };
export type StoredRestoreBuildResult = Omit<
  RestoreBuildResult,
  "studioUrl"
> & { studioPath: string };

export function generationPlanKey(projectId: string) {
  return `${GENERATION_PLAN_PREFIX}${projectId}`;
}

export function playtestLinkKey(projectId: string) {
  return `${PLAYTEST_LINK_PREFIX}${projectId}`;
}

export function json(value: unknown, status = 200) {
  return Response.json(value, { status });
}

export function error(message: string, status: number) {
  return json({ error: message }, status);
}

export function paginated<T>(
  values: T[],
  url: URL,
  key: string,
) {
  const cursor = Math.max(
    0,
    Number.parseInt(url.searchParams.get("cursor") ?? "0", 10) || 0,
  );
  const limit = Math.min(
    100,
    Math.max(
      1,
      Number.parseInt(url.searchParams.get("limit") ?? "50", 10) || 50,
    ),
  );
  const items = values.slice(cursor, cursor + limit);
  const nextCursor =
    cursor + items.length < values.length ? cursor + items.length : null;
  return {
    [key]: items,
    page: { cursor, limit, nextCursor, total: values.length },
  };
}

export function initialRuleSystem(id: string): RuleSystem {
  return {
    id,
    version: 1,
    name: "未命名初始版本",
    pitch: "",
    participants: { min: 2, max: 2, default: 2, roles: [] },
    durationMinutes: 45,
    rules: [],
    constraints: [],
    entities: [],
    setup: [],
    actions: [],
    playSurface: { kind: "screen", layout: "", regions: [] },
    stages: [],
    outcomes: [],
    presentation: { theme: "unassigned" },
    runtimeSupport: { status: "draft", unsupported: [] },
  };
}

export function normalizedRuleSystem(ruleSystem: RuleSystem): RuleSystem {
  if (
    !ruleSystem.participants ||
    !Array.isArray(ruleSystem.constraints) ||
    !Array.isArray(ruleSystem.entities) ||
    !ruleSystem.playSurface ||
    !Array.isArray(ruleSystem.stages) ||
    !Array.isArray(ruleSystem.outcomes)
  ) {
    throw new Error("unsupported_rule_system_shape");
  }
  return structuredClone(ruleSystem);
}

export { sameRuleSystemContent } from "../src/creator/rule-system-compare";

export function normalizedBuild(build: StoredPlayableBuild): StoredPlayableBuild {
  if (!build.presentationFloor || !build.playabilityFloor) {
    throw new Error("unsupported_build_shape");
  }
  return {
    ...build,
    ruleSystem: normalizedRuleSystem(build.ruleSystem),
    presentationFloor: build.presentationFloor,
    playabilityFloor: build.playabilityFloor,
  };
}

export function normalizedProjectRecord(record: ProjectRecord) {
  if (!record || !("project" in record)) {
    throw new Error("unsupported_project_shape");
  }
  if (
    !Array.isArray(record.ruleSystems) ||
    !Array.isArray(record.sources) ||
    !Array.isArray(record.changesets) ||
    !Array.isArray(record.builds) ||
    !Array.isArray(record.playtests) ||
    !Array.isArray(record.sessions) ||
    !Array.isArray(record.jobs) ||
    !Array.isArray(record.hypotheses) ||
    !Array.isArray(record.findings)
  ) {
    throw new Error("unsupported_project_shape");
  }
  if (record.findings.some((finding) => typeof finding.nextChange !== "string")) {
    throw new Error("unsupported_project_shape");
  }
  if (record.sessions.some((session) =>
    !("experiment" in session) ||
    !Array.isArray(session.feedback) ||
    session.feedback.some((entry) =>
      !entry.moment ||
      !Number.isInteger(entry.moment.actionSequence) ||
      entry.moment.actionSequence < 1 ||
      typeof entry.moment.actionId !== "string" ||
      !entry.moment.actionId
    )
  )) {
    throw new Error("unsupported_project_shape");
  }
  const ruleSystems = record.ruleSystems.map(normalizedRuleSystem);
  const ruleSystem =
    ruleSystems.find(
      (candidate) => candidate.id === record.project.activeRuleSystemId,
    );
  if (!ruleSystem) throw new Error("unsupported_project_shape");
  return {
    ...record,
    ruleSystem,
    ruleSystems,
    project: {
      ...record.project,
      capabilities: {
        ...record.project.capabilities,
        compilation: "available" as const,
      },
    },
    builds: record.builds.map(normalizedBuild),
    playtests: record.playtests,
    sessions: record.sessions,
    jobs: record.jobs,
    hypotheses: record.hypotheses,
    findings: record.findings,
  };
}

export function validChangeRequest(value: unknown): value is ApplyProjectChangesInput {
  if (!value || typeof value !== "object") return false;
  const input = value as Partial<ApplyProjectChangesInput>;
  return (
    Number.isInteger(input.expectedVersion) &&
    typeof input.idempotencyKey === "string" &&
    input.idempotencyKey.length > 0 &&
    Array.isArray(input.operations) &&
    input.operations.length > 0 &&
    input.operations.length <= 20 &&
    input.operations.every(
      (operation) =>
        operation !== null &&
        typeof operation === "object" &&
        typeof (operation as { op?: unknown }).op === "string",
    )
  );
}

export function validBoundImage(value: unknown) {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as { sourceId?: unknown }).sourceId === "string" &&
      typeof (value as { url?: unknown }).url === "string" &&
      typeof (value as { alt?: unknown }).alt === "string",
  );
}

export function validVisualTreatments(value: unknown) {
  return (
    Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= 8 &&
    value.every(
      (visual) =>
        visual &&
        typeof visual === "object" &&
        ["extracted", "generated", "kit", "uploaded"].includes(
          (visual as { provenance?: unknown }).provenance as string,
        ) &&
        typeof (visual as { label?: unknown }).label === "string" &&
        Boolean((visual as { label: string }).label.trim()) &&
        (visual as { label: string }).label.length <= 160,
    )
  );
}

export function runtimeActionShapeChanged(
  previous: RuleSystem["actions"],
  next: RuleSystem["actions"],
) {
  return (
    previous.length !== next.length ||
    previous.some(
      (action, index) =>
        action.id !== next[index]?.id || action.label !== next[index]?.label,
    )
  );
}

export type RuntimeConfiguration =
  | Extract<ProjectChangeOperation, { op: "configure_score_race" }> & {
      op: "configure_score_race";
    }
  | Extract<ProjectChangeOperation, { op: "configure_shared_goal" }> & {
      op: "configure_shared_goal";
    }
  | Extract<ProjectChangeOperation, { op: "configure_turn_taking" }> & {
      op: "configure_turn_taking";
    }
  | Extract<ProjectChangeOperation, { op: "configure_take_away" }> & {
      op: "configure_take_away";
    }
  | Extract<ProjectChangeOperation, { op: "configure_roll_and_move" }> & {
      op: "configure_roll_and_move";
    }
  | Extract<ProjectChangeOperation, { op: "configure_draw_and_score" }> & {
      op: "configure_draw_and_score";
    }
  | Extract<ProjectChangeOperation, { op: "configure_push_your_luck" }> & {
      op: "configure_push_your_luck";
    }
  | Extract<ProjectChangeOperation, { op: "configure_harbor_voyage" }> & {
      op: "configure_harbor_voyage";
    }
  | Extract<ProjectChangeOperation, { op: "configure_hidden_role" }> & {
      op: "configure_hidden_role";
    }
  | Extract<ProjectChangeOperation, { op: "configure_hand_play" }> & {
      op: "configure_hand_play";
    }
  | Extract<ProjectChangeOperation, { op: "configure_conversation_relay" }> & {
      op: "configure_conversation_relay";
    };

export function configureDedicatedKernel(
  record: ProjectRecord,
  op: string,
  kernel: Extract<
    Extract<RuleSystem["runtimeSupport"], { status: "executable" }>["kernel"],
    { type: "harbor-voyage-v1" | "hidden-role-v1" | "hand-play-v1" | "conversation-relay-v1" }
  >,
  unsupported: string[],
  config: unknown,
  affectedEntities: string[],
) {
  const runtimeSource: SourceLibraryEntry = {
    id: `source_${crypto.randomUUID()}`,
    kind: "brief",
    name: `${record.ruleSystem.name} · ${kernel.type} 配置`,
    content: JSON.stringify(config),
    readiness: "ready",
    provenance: {
      origin: "system-generated",
      locator: `${op} operation`,
      confidence: 1,
    },
    createdAt: new Date().toISOString(),
  };
  record.sources.push(runtimeSource);
  record.ruleSystem = {
    ...record.ruleSystem,
    runtimeSupport: {
      status: "executable",
      unsupported,
      kernel,
    },
  };
  affectedEntities.push(`source:${runtimeSource.id}`);
  affectedEntities.push(`runtime:${record.ruleSystem.id}`);
}

export function configureRuntimeKernel(
  record: ProjectRecord,
  configuration: RuntimeConfiguration,
  affectedEntities: string[],
) {
  if (configuration.op === "configure_hidden_role") {
    configureDedicatedKernel(
      record,
      configuration.op,
      {
        type: "hidden-role-v1",
        playerCount: configuration.config.playerCount,
        roles: configuration.config.roles,
      },
      configuration.config.unsupported?.map((item) => item.trim()) ?? [],
      configuration.config,
      affectedEntities,
    );
    return;
  }
  if (configuration.op === "configure_hand_play") {
    configureDedicatedKernel(
      record,
      configuration.op,
      {
        type: "hand-play-v1",
        playerCount: configuration.config.playerCount,
        cardValues: configuration.config.cardValues,
        copiesPerValue: configuration.config.copiesPerValue,
        handSize: configuration.config.handSize,
        victoryTarget: configuration.config.victoryTarget,
        actions: configuration.config.actions,
      },
      configuration.config.unsupported?.map((item) => item.trim()) ?? [],
      configuration.config,
      affectedEntities,
    );
    return;
  }
  if (configuration.op === "configure_conversation_relay") {
    configureDedicatedKernel(
      record,
      configuration.op,
      {
        type: "conversation-relay-v1",
        victoryTarget: configuration.config.victoryTarget,
        maxTurns: configuration.config.maxTurns,
        actions: configuration.config.actions,
      },
      configuration.config.unsupported?.map((item) => item.trim()) ?? [],
      configuration.config,
      affectedEntities,
    );
    return;
  }
  if (configuration.op === "configure_harbor_voyage") {
    configureDedicatedKernel(
      record,
      configuration.op,
      {
        type: "harbor-voyage-v1",
        playerCount: configuration.config.playerCount,
      },
      configuration.config.unsupported?.map((item) => item.trim()) ?? [],
      configuration.config,
      affectedEntities,
    );
    return;
  }
  const config = configuration.config;
  const normalizedActions = configuration.config.actions.map((action) => ({
    id: action.id,
    label: action.label,
    value: "points" in action
      ? action.points
      : "progress" in action
        ? action.progress
        : "take" in action
          ? action.take
          : undefined,
  }));
  const kernelType = configuration.op === "configure_score_race"
    ? "score-race-v1"
    : configuration.op === "configure_shared_goal"
      ? "shared-goal-v1"
      : configuration.op === "configure_take_away"
        ? "take-away-v1"
        : configuration.op === "configure_roll_and_move"
          ? "roll-and-move-v1"
        : configuration.op === "configure_draw_and_score"
          ? "draw-and-score-v1"
        : configuration.op === "configure_push_your_luck"
          ? "push-your-luck-v1"
          : "turn-taking-v1";
  const unsupported = configuration.config.unsupported?.map((item) => item.trim()) ?? [];
  const runtimeSource: SourceLibraryEntry = {
    id: `source_${crypto.randomUUID()}`,
    kind: "brief",
    name: `${record.ruleSystem.name} · ${kernelType} 配置`,
    content: JSON.stringify(config),
    readiness: "ready",
    provenance: {
      origin: "system-generated",
      locator: `${configuration.op} operation`,
      confidence: 1,
    },
    createdAt: new Date().toISOString(),
  };
  record.sources.push(runtimeSource);
  const existingRules = record.ruleSystem.rules.filter(
    (rule) => !rule.id.startsWith("runtime-"),
  );
  const existingEntities = record.ruleSystem.entities.filter(
    (entity) => !entity.id.startsWith("runtime-"),
  );
  const previousRuntimeActionIds = new Set(
    record.ruleSystem.runtimeSupport.status === "executable" &&
      "actions" in record.ruleSystem.runtimeSupport.kernel
      ? record.ruleSystem.runtimeSupport.kernel.actions.map(
          (action) => action.id,
        )
      : [],
  );
  const existingActions = record.ruleSystem.actions.filter(
    (action) =>
      action.provenance === "source-anchored" ||
      !previousRuntimeActionIds.has(action.id),
  );
  const generatedRuntimeActions = normalizedActions
    .filter((action) => !existingActions.some((existing) => existing.id === action.id))
    .map((action) => {
      const value = action.value;
      return {
        id: action.id,
        label: action.label.trim().slice(0, 80),
        description: configuration.op === "configure_score_race"
          ? `获得 ${value} 分。`
          : configuration.op === "configure_shared_goal"
            ? `推进共享目标 ${value} 点。`
            : configuration.op === "configure_take_away"
              ? `从共享池拿走 ${value} 个物件。`
              : configuration.op === "configure_roll_and_move"
                ? "掷骰并按点数前进。"
              : configuration.op === "configure_draw_and_score"
                ? "从洗牌后的牌库顶抽一张牌，并将牌面点数加入自己的总分。"
              : configuration.op === "configure_push_your_luck"
                ? action.id === "roll"
                  ? "继续掷骰；爆点清空本回合未存分，否则累加结果。"
                  : "把本回合未存分加入总分并结束回合。"
                : "执行一个轮流行动。",
        sourceId: runtimeSource.id,
        provenance: "system-generated" as const,
        confidence: 1,
      };
    });
  const maxTurns = "maxTurns" in configuration.config
    ? configuration.config.maxTurns
    : null;
  const target = configuration.op === "configure_score_race"
    ? configuration.config.victoryTarget
    : configuration.op === "configure_shared_goal"
      ? configuration.config.goalTarget
      : configuration.op === "configure_roll_and_move"
        ? configuration.config.targetPosition
      : configuration.op === "configure_draw_and_score"
        ? configuration.config.victoryTarget
      : configuration.op === "configure_push_your_luck"
        ? configuration.config.victoryTarget
      : null;
  const runtimeRules = configuration.op === "configure_score_race"
    ? [
        {
          id: "runtime-turn-order",
          text: "玩家按座位顺序轮流选择一个可用行动并获得对应分数。",
          sourceId: runtimeSource.id,
          provenance: "system-generated" as const,
          confidence: 1,
        },
        {
          id: "runtime-victory",
          text: `率先达到 ${target} 分者获胜；若 ${maxTurns} 回合仍无人达到，则最高分获胜。`,
          sourceId: runtimeSource.id,
          provenance: "system-generated" as const,
          confidence: 1,
        },
      ]
    : configuration.op === "configure_shared_goal"
      ? [
        {
          id: "runtime-turn-order",
          text: "玩家按座位顺序轮流选择一个可用行动，共同推进共享目标。",
          sourceId: runtimeSource.id,
          provenance: "system-generated" as const,
          confidence: 1,
        },
        {
          id: "runtime-victory",
          text: `共享进度达到 ${target} 点即完成目标；若 ${maxTurns} 回合仍未达到，则会话以回合上限结束。`,
          sourceId: runtimeSource.id,
          provenance: "system-generated" as const,
          confidence: 1,
        },
      ]
      : configuration.op === "configure_take_away"
        ? [
          {
            id: "runtime-turn-order",
            text: "玩家按座位顺序轮流从共享池拿走一个可用数量。",
            sourceId: runtimeSource.id,
            provenance: "system-generated" as const,
            confidence: 1,
          },
          {
            id: "runtime-victory",
            text: `共享池初始有 ${configuration.config.initialPool} 个物件；拿走最后一个物件的玩家获胜。`,
            sourceId: runtimeSource.id,
            provenance: "system-generated" as const,
            confidence: 1,
          },
        ]
        : configuration.op === "configure_roll_and_move"
          ? [
            {
              id: "runtime-turn-order",
              text: `玩家按座位顺序轮流掷一颗 ${configuration.config.dieSides} 面骰子，并按结果前进相应格数。`,
              sourceId: runtimeSource.id,
              provenance: "system-generated" as const,
              confidence: 1,
            },
            {
              id: "runtime-victory",
              text: `率先到达 ${configuration.config.targetPosition} 格的玩家获胜；若 ${maxTurns} 回合仍无人到达，则会话以回合上限结束且不补造胜者。`,
              sourceId: runtimeSource.id,
              provenance: "system-generated" as const,
              confidence: 1,
            },
          ]
        : configuration.op === "configure_draw_and_score"
          ? [
            {
              id: "runtime-turn-order",
              text: "玩家按座位顺序轮流从洗牌后的牌库顶抽一张牌，并将牌面点数加入自己的总分。",
              sourceId: runtimeSource.id,
              provenance: "system-generated" as const,
              confidence: 1,
            },
            {
              id: "runtime-victory",
              text: `率先达到 ${configuration.config.victoryTarget} 分者获胜；牌库耗尽仍无人达到时，唯一最高分者获胜，平分则不补造胜者。`,
              sourceId: runtimeSource.id,
              provenance: "system-generated" as const,
              confidence: 1,
            },
          ]
        : configuration.op === "configure_push_your_luck"
          ? [
            {
              id: "runtime-turn-order",
              text: `当前玩家可反复掷一颗 ${configuration.config.dieSides} 面骰子；掷出 ${configuration.config.bustFace} 会清空本回合未存分并换人，其他结果累加到本回合未存分。`,
              sourceId: runtimeSource.id,
              provenance: "system-generated" as const,
              confidence: 1,
            },
            {
              id: "runtime-victory",
              text: `玩家可收手把本回合未存分加入总分并换人；率先存到 ${configuration.config.victoryTarget} 分者获胜。${configuration.config.maxActions} 次行动安全上限只结束会话，不补造胜者。`,
              sourceId: runtimeSource.id,
              provenance: "system-generated" as const,
              confidence: 1,
            },
          ]
        : [
        {
          id: "runtime-turn-order",
          text: "玩家按座位顺序轮流选择一个可用行动。",
          sourceId: runtimeSource.id,
          provenance: "system-generated" as const,
          confidence: 1,
        },
        {
          id: "runtime-end",
          text: `最多进行 ${maxTurns} 回合；此 Kernel 不自动判定胜负或补全其他规则。`,
          sourceId: runtimeSource.id,
          provenance: "system-generated" as const,
          confidence: 1,
        },
      ];
  const runtimeEntity = configuration.op === "configure_score_race"
    ? {
        id: "runtime-score-track",
        name: "分数与参与者状态",
        kind: "concept" as const,
        quantity: record.ruleSystem.participants.default,
      }
    : configuration.op === "configure_shared_goal"
      ? {
        id: "runtime-shared-goal",
        name: "共享目标与参与者状态",
        kind: "concept" as const,
        quantity: 1,
      }
      : configuration.op === "configure_take_away"
        ? {
          id: "runtime-shared-pool",
          name: "共享拿取池",
          kind: "resource" as const,
          quantity: configuration.config.initialPool,
        }
        : configuration.op === "configure_roll_and_move"
          ? {
            id: "runtime-roll-and-move",
            name: "骰子与位置轨道",
            kind: "concept" as const,
            quantity: 1,
          }
        : configuration.op === "configure_draw_and_score"
          ? {
            id: "runtime-draw-deck",
            name: "有限抽牌牌库",
            kind: "resource" as const,
            quantity: configuration.config.cardValues.length * configuration.config.copiesPerValue,
          }
        : configuration.op === "configure_push_your_luck"
          ? {
            id: "runtime-push-your-luck",
            name: "骰子、未存分与总分",
            kind: "concept" as const,
            quantity: 1,
          }
        : {
          id: "runtime-turn-order",
          name: "回合与参与者状态",
          kind: "concept" as const,
          quantity: 1,
        };
  const playSurface = configuration.op === "configure_score_race"
    ? {
        kind: "screen" as const,
        layout: "shared-score-track",
        regions: [{
          id: "score-track",
          name: "分数轨道",
          description: "记录所有座位当前得分。",
        }],
      }
    : configuration.op === "configure_shared_goal"
      ? {
        kind: "screen" as const,
        layout: "shared-goal-track",
        regions: [{
          id: "goal-track",
          name: "共享目标进度",
          description: "记录所有参与者共同推进的目标进度。",
        }],
      }
      : configuration.op === "configure_take_away"
        ? {
          kind: "table" as const,
          layout: "shared-take-away-pool",
          regions: [{
            id: "shared-pool",
            name: "共享拿取池",
            description: "记录仍可拿取的共享物件数量。",
          }],
        }
        : configuration.op === "configure_roll_and_move"
          ? {
            kind: "table" as const,
            layout: "roll-and-move-track",
            regions: [{
              id: "position-track",
              name: "位置轨道",
              description: "记录每位玩家的当前位置与终点。",
            }],
          }
        : configuration.op === "configure_draw_and_score"
          ? {
            kind: "cards" as const,
            layout: "draw-and-score-table",
            regions: [{
              id: "draw-deck",
              name: "抽牌牌库与分数",
              description: "显示剩余牌数、最近一次抽牌和所有座位当前得分，不公开未来牌序。",
            }],
          }
        : configuration.op === "configure_push_your_luck"
          ? {
            kind: "table" as const,
            layout: "push-your-luck-table",
            regions: [{
              id: "risk-and-score",
              name: "未存分与总分",
              description: "显示当前骰点、本回合未存分、各座位总分和继续或收手决策。",
            }],
          }
        : {
          kind: "screen" as const,
          layout: "turn-order-track",
          regions: [{
            id: "turn-order",
            name: "回合顺序",
            description: "记录当前行动席位与剩余回合。",
          }],
        };
  const scoreActions = normalizedActions.map((action) => ({
    id: action.id,
    label: action.label.trim().slice(0, 80),
    points: action.value ?? 0,
  }));
  const sharedActions = normalizedActions.map((action) => ({
      id: action.id,
      label: action.label.trim().slice(0, 80),
      progress: action.value ?? 0,
    }));
  const turnActions = normalizedActions.map((action) => ({
    id: action.id,
    label: action.label.trim().slice(0, 80),
  }));
  const takeActions = normalizedActions.map((action) => ({
    id: action.id,
    label: action.label.trim().slice(0, 80),
    take: action.value ?? 0,
  }));
  record.ruleSystem = {
    ...record.ruleSystem,
    rules: [...existingRules, ...runtimeRules],
    entities: [
      ...existingEntities,
      {
        ...runtimeEntity,
        sourceId: runtimeSource.id,
        provenance: "system-generated" as const,
        confidence: 1,
      },
    ],
    setup: record.ruleSystem.setup.length
      ? record.ruleSystem.setup
      : configuration.op === "configure_score_race"
        ? ["将共享分数状态置于所有参与者可见的位置。", "每位参与者选择一个座位。"]
        : configuration.op === "configure_shared_goal"
          ? ["将共享目标进度置于所有参与者可见的位置。", "每位参与者选择一个座位。"]
          : configuration.op === "configure_take_away"
            ? [`在共享区域放置 ${configuration.config.initialPool} 个物件。`, "每位参与者选择一个座位。"]
            : configuration.op === "configure_roll_and_move"
              ? [`准备一颗 ${configuration.config.dieSides} 面骰子与 ${configuration.config.targetPosition} 格位置轨道。`, "所有参与者从第 0 格开始并选择一个座位。"]
            : configuration.op === "configure_draw_and_score"
              ? [`将点数为 ${configuration.config.cardValues.join("、")} 的牌各准备 ${configuration.config.copiesPerValue} 张并洗牌。`, "将牌库背面朝上放在共享区域，每位参与者选择一个座位。"]
            : configuration.op === "configure_push_your_luck"
              ? [`准备一颗 ${configuration.config.dieSides} 面骰子与总分记录。`, "所有参与者总分与本回合未存分从 0 开始。"]
            : ["将当前回合与行动席位置于所有参与者可见的位置。", "每位参与者选择一个座位。"],
    actions: [...existingActions, ...generatedRuntimeActions],
    playSurface: record.ruleSystem.playSurface.layout
      ? record.ruleSystem.playSurface
      : playSurface,
    stages: record.ruleSystem.stages.length
      ? record.ruleSystem.stages
      : [{
          id: "runtime-turns",
          name: configuration.op === "configure_score_race"
            ? "轮流计分"
            : configuration.op === "configure_shared_goal"
              ? "共同推进"
              : configuration.op === "configure_take_away"
                ? "轮流拿取"
                : configuration.op === "configure_roll_and_move"
                  ? "掷骰竞速"
                : configuration.op === "configure_draw_and_score"
                  ? "轮流抽牌计分"
                : configuration.op === "configure_push_your_luck"
                  ? "冒险押注"
                : "轮流行动",
        }],
    runtimeSupport: configuration.op === "configure_score_race"
      ? {
          status: "executable" as const,
          unsupported,
          kernel: {
            type: "score-race-v1" as const,
            victoryTarget: configuration.config.victoryTarget,
            maxTurns: configuration.config.maxTurns,
            actions: scoreActions,
          },
        }
      : configuration.op === "configure_shared_goal"
        ? {
          status: "executable" as const,
          unsupported,
          kernel: {
            type: "shared-goal-v1" as const,
            goalTarget: configuration.config.goalTarget,
            maxTurns: configuration.config.maxTurns,
            actions: sharedActions,
          },
        }
        : configuration.op === "configure_take_away"
          ? {
            status: "executable" as const,
            unsupported,
            kernel: {
              type: "take-away-v1" as const,
              initialPool: configuration.config.initialPool,
              actions: takeActions,
            },
          }
          : configuration.op === "configure_roll_and_move"
            ? {
              status: "executable" as const,
              unsupported,
              kernel: {
                type: "roll-and-move-v1" as const,
                dieSides: configuration.config.dieSides,
                targetPosition: configuration.config.targetPosition,
                maxTurns: configuration.config.maxTurns,
                actions: turnActions,
              },
            }
          : configuration.op === "configure_draw_and_score"
            ? {
              status: "executable" as const,
              unsupported,
              kernel: {
                type: "draw-and-score-v1" as const,
                cardValues: configuration.config.cardValues,
                copiesPerValue: configuration.config.copiesPerValue,
                victoryTarget: configuration.config.victoryTarget,
                actions: turnActions,
              },
            }
          : configuration.op === "configure_push_your_luck"
            ? {
              status: "executable" as const,
              unsupported,
              kernel: {
                type: "push-your-luck-v1" as const,
                dieSides: configuration.config.dieSides,
                bustFace: configuration.config.bustFace,
                victoryTarget: configuration.config.victoryTarget,
                maxActions: configuration.config.maxActions,
                actions: configuration.config.actions,
              },
            }
          : {
            status: "executable" as const,
            unsupported,
            kernel: {
              type: "turn-taking-v1" as const,
              maxTurns: configuration.config.maxTurns,
              actions: turnActions,
            },
          },
  };
  affectedEntities.push(`source:${runtimeSource.id}`);
  affectedEntities.push(`runtime:${record.ruleSystem.id}`);
}

function validUnsupported(unsupported: unknown) {
  return unsupported === undefined || (
    Array.isArray(unsupported) &&
    unsupported.length <= 50 &&
    !unsupported.some((item) =>
      typeof item !== "string" || !item.trim() || item.length > 500
    )
  );
}

function validActionId(id: unknown): id is string {
  return typeof id === "string" && /^[a-z0-9-]{1,40}$/.test(id);
}

function validActionLabel(label: unknown, maxLength = Infinity) {
  return typeof label === "string" && Boolean(label.trim()) && label.length <= maxLength;
}

function uniqueBy<T>(items: T[], key: (item: T) => string | number) {
  return new Set(items.map(key)).size === items.length;
}

const RUNTIME_HANDLERS: {
  [K in RuntimeConfiguration["op"]]: {
    validate: (config: Extract<RuntimeConfiguration, { op: K }>["config"]) => boolean;
  };
} = {
  configure_score_race: {
    validate: (config) =>
      Boolean(config) &&
      typeof config === "object" &&
      Number.isInteger(config.victoryTarget) &&
      config.victoryTarget >= 1 &&
      config.victoryTarget <= 1_000 &&
      Number.isInteger(config.maxTurns) &&
      config.maxTurns >= 1 &&
      config.maxTurns <= 1_000 &&
      Array.isArray(config.actions) &&
      config.actions.length >= 1 &&
      config.actions.length <= 12 &&
      !config.actions.some((action) =>
        !action ||
        !validActionId(action.id) ||
        !validActionLabel(action.label) ||
        !Number.isInteger(action.points) ||
        action.points < 1 ||
        action.points > 100
      ) &&
      validUnsupported(config.unsupported) &&
      uniqueBy(config.actions, (action) => action.id),
  },
  configure_shared_goal: {
    validate: (config) =>
      Boolean(config) &&
      typeof config === "object" &&
      Number.isInteger(config.goalTarget) &&
      config.goalTarget >= 1 &&
      config.goalTarget <= 1_000 &&
      Number.isInteger(config.maxTurns) &&
      config.maxTurns >= 1 &&
      config.maxTurns <= 1_000 &&
      Array.isArray(config.actions) &&
      config.actions.length >= 1 &&
      config.actions.length <= 12 &&
      !config.actions.some((action) =>
        !action ||
        !validActionId(action.id) ||
        !validActionLabel(action.label) ||
        !Number.isInteger(action.progress) ||
        action.progress < 1 ||
        action.progress > 100
      ) &&
      validUnsupported(config.unsupported) &&
      uniqueBy(config.actions, (action) => action.id),
  },
  configure_turn_taking: {
    validate: (config) =>
      Boolean(config) &&
      typeof config === "object" &&
      Number.isInteger(config.maxTurns) &&
      config.maxTurns >= 1 &&
      config.maxTurns <= 1_000 &&
      Array.isArray(config.actions) &&
      config.actions.length >= 1 &&
      config.actions.length <= 12 &&
      !config.actions.some((action) =>
        !action ||
        !validActionId(action.id) ||
        !validActionLabel(action.label)
      ) &&
      validUnsupported(config.unsupported) &&
      uniqueBy(config.actions, (action) => action.id),
  },
  configure_take_away: {
    validate: (config) =>
      Boolean(config) &&
      typeof config === "object" &&
      Number.isInteger(config.initialPool) &&
      config.initialPool >= 2 &&
      config.initialPool <= 1_000 &&
      Array.isArray(config.actions) &&
      config.actions.length >= 1 &&
      config.actions.length <= 12 &&
      !config.actions.some((action) =>
        !action ||
        !validActionId(action.id) ||
        !validActionLabel(action.label) ||
        !Number.isInteger(action.take) ||
        action.take < 1 ||
        action.take > 100 ||
        action.take > config.initialPool
      ) &&
      validUnsupported(config.unsupported) &&
      uniqueBy(config.actions, (action) => action.id) &&
      uniqueBy(config.actions, (action) => action.take),
  },
  configure_roll_and_move: {
    validate: (config) =>
      Boolean(config) &&
      typeof config === "object" &&
      Number.isInteger(config.dieSides) &&
      config.dieSides >= 2 &&
      config.dieSides <= 100 &&
      Number.isInteger(config.targetPosition) &&
      config.targetPosition >= 2 &&
      config.targetPosition <= 1_000 &&
      Number.isInteger(config.maxTurns) &&
      config.maxTurns >= 1 &&
      config.maxTurns <= 1_000 &&
      Array.isArray(config.actions) &&
      config.actions.length === 1 &&
      !config.actions.some((action) =>
        !action ||
        !validActionId(action.id) ||
        !validActionLabel(action.label, 80)
      ) &&
      validUnsupported(config.unsupported),
  },
  configure_draw_and_score: {
    validate: (config) =>
      Boolean(config) &&
      typeof config === "object" &&
      Array.isArray(config.cardValues) &&
      config.cardValues.length >= 1 &&
      config.cardValues.length <= 100 &&
      !config.cardValues.some((value) => !Number.isInteger(value) || value < 1 || value > 100) &&
      new Set(config.cardValues).size === config.cardValues.length &&
      Number.isInteger(config.copiesPerValue) &&
      config.copiesPerValue >= 1 &&
      config.copiesPerValue <= 100 &&
      config.cardValues.length * config.copiesPerValue <= 1_000 &&
      Number.isInteger(config.victoryTarget) &&
      config.victoryTarget >= 1 &&
      config.victoryTarget <= 1_000 &&
      Array.isArray(config.actions) &&
      config.actions.length === 1 &&
      !config.actions.some((action) =>
        !action ||
        !validActionId(action.id) ||
        !validActionLabel(action.label, 80)
      ) &&
      validUnsupported(config.unsupported),
  },
  configure_push_your_luck: {
    validate: (config) =>
      Boolean(config) &&
      typeof config === "object" &&
      Number.isInteger(config.dieSides) &&
      config.dieSides >= 2 &&
      config.dieSides <= 100 &&
      Number.isInteger(config.bustFace) &&
      config.bustFace >= 1 &&
      config.bustFace <= config.dieSides &&
      Number.isInteger(config.victoryTarget) &&
      config.victoryTarget >= 1 &&
      config.victoryTarget <= 1_000 &&
      Number.isInteger(config.maxActions) &&
      config.maxActions >= 1 &&
      config.maxActions <= 10_000 &&
      Array.isArray(config.actions) &&
      config.actions.length === 2 &&
      !config.actions.some((action) =>
        !action ||
        !["roll", "bank"].includes(action.id) ||
        !validActionLabel(action.label, 80)
      ) &&
      new Set(config.actions.map((action) => action.id)).size === 2 &&
      validUnsupported(config.unsupported),
  },
  configure_harbor_voyage: {
    validate: (config) =>
      Boolean(config) &&
      typeof config === "object" &&
      Number.isInteger(config.playerCount) &&
      config.playerCount >= 2 &&
      config.playerCount <= 3 &&
      validUnsupported(config.unsupported),
  },
  configure_hidden_role: {
    validate: (config) =>
      Boolean(config) &&
      typeof config === "object" &&
      Number.isInteger(config.playerCount) &&
      config.playerCount >= 2 &&
      config.playerCount <= 6 &&
      Array.isArray(config.roles) &&
      config.roles.length === config.playerCount &&
      config.roles.filter((role) => role.alignment === "culprit").length === 1 &&
      !config.roles.some((role) =>
        !role ||
        !validActionId(role.id) ||
        typeof role.name !== "string" ||
        !role.name.trim() ||
        (role.alignment !== "culprit" && role.alignment !== "town")
      ),
  },
  configure_hand_play: {
    validate: (config) =>
      Boolean(config) &&
      typeof config === "object" &&
      Number.isInteger(config.playerCount) &&
      config.playerCount >= 2 &&
      config.playerCount <= 6 &&
      Array.isArray(config.cardValues) &&
      config.cardValues.length >= 1 &&
      Number.isInteger(config.copiesPerValue) &&
      Number.isInteger(config.handSize) &&
      Number.isInteger(config.victoryTarget) &&
      Array.isArray(config.actions) &&
      config.actions.length === 1 &&
      config.actions[0]?.id === "play",
  },
  configure_conversation_relay: {
    validate: (config) =>
      Boolean(config) &&
      typeof config === "object" &&
      Number.isInteger(config.victoryTarget) &&
      Number.isInteger(config.maxTurns) &&
      Array.isArray(config.actions) &&
      config.actions.length >= 1 &&
      !config.actions.some((action) =>
        !action ||
        typeof action.id !== "string" ||
        !Number.isInteger(action.points)
      ),
  },
};

function isRuntimeConfiguration(
  operation: ProjectChangeOperation,
): operation is RuntimeConfiguration {
  return operation.op in RUNTIME_HANDLERS;
}

function validateRuntimeConfiguration(operation: RuntimeConfiguration) {
  const handler = RUNTIME_HANDLERS[operation.op] as {
    validate: (config: RuntimeConfiguration["config"]) => boolean;
  };
  return handler.validate(operation.config);
}

export function applyOperation(
  record: ProjectRecord,
  operation: ProjectChangeOperation,
  affectedEntities: string[],
) {
  if (!operation || typeof operation !== "object") {
    throw new Error("unsupported_operation");
  }
  if (operation.op === "add_source") {
    const source = operation.source;
    const basedOnSourceIds = source?.provenance?.basedOnSourceIds;
    if (
      !source ||
      !["brief", "rulebook", "image"].includes(source.kind) ||
      (source.kind === "image" &&
        !["visual-reference", "project-asset"].includes(String(source.imageUse))) ||
      (source.kind !== "image" && source.imageUse !== undefined) ||
      typeof source.name !== "string" ||
      !source.name.trim() ||
      typeof source.content !== "string" ||
      !source.provenance ||
      ![
        "creator-authored",
        "creator-upload",
        "internal-fixture",
        "system-generated",
        "ai-proposed",
        "generative-api",
      ].includes(
        source.provenance.origin,
      ) ||
      typeof source.provenance.locator !== "string" ||
      (basedOnSourceIds !== undefined &&
        (!Array.isArray(basedOnSourceIds) ||
          basedOnSourceIds.length < 1 ||
          basedOnSourceIds.length > 9 ||
          new Set(basedOnSourceIds).size !== basedOnSourceIds.length ||
          basedOnSourceIds.some(
            (sourceId) =>
              typeof sourceId !== "string" ||
              !/^source_[a-zA-Z0-9_-]+$/.test(sourceId),
          ))) ||
      (source.provenance.origin === "generative-api" &&
        (source.kind !== "image" ||
          source.imageUse !== "project-asset" ||
          !basedOnSourceIds))
    ) {
      throw new Error("invalid_source");
    }
    if (
      basedOnSourceIds?.some(
        (sourceId) => !record.sources.some((candidate) => candidate.id === sourceId),
      )
    ) {
      throw new Error("source_dependency_not_found");
    }
    const entryBase = {
      id: typeof source.id === "string" && /^source_[a-zA-Z0-9_-]+$/.test(source.id)
        ? source.id
        : `source_${crypto.randomUUID()}`,
      name: source.name.trim().slice(0, 120),
      content: source.content.slice(0, 100_000),
      readiness: "ready" as const,
      provenance: {
        origin: source.provenance.origin,
        locator: source.provenance.locator.slice(0, 500),
        ...(basedOnSourceIds
          ? { basedOnSourceIds: [...basedOnSourceIds] }
          : {}),
      },
      createdAt: new Date().toISOString(),
    };
    const entry: SourceLibraryEntry = source.kind === "image"
      ? { ...entryBase, kind: "image", imageUse: source.imageUse! }
      : { ...entryBase, kind: source.kind };
    record.sources.push(entry);
    affectedEntities.push(`source:${entry.id}`);
    return;
  }

  if (operation.op === "update_rule_system") {
    const fields = operation.fields;
    if (
      !fields ||
      typeof fields !== "object" ||
      fields.name !== undefined &&
      (typeof fields.name !== "string" || !fields.name.trim())
    ) {
      throw new Error("invalid_rule_system");
    }
    if (
      fields.pitch !== undefined &&
      typeof fields.pitch !== "string"
    ) {
      throw new Error("invalid_rule_system");
    }
    if (
      fields.participants !== undefined &&
      (!fields.participants ||
        !Number.isInteger(fields.participants.min) ||
        !Number.isInteger(fields.participants.max) ||
        !Number.isInteger(fields.participants.default) ||
        fields.participants.min < 1 ||
        fields.participants.max > 20 ||
        fields.participants.min > fields.participants.default ||
        fields.participants.default > fields.participants.max ||
        !Array.isArray(fields.participants.roles) ||
        fields.participants.roles.length > 20 ||
        fields.participants.roles.some(
          (role) =>
            !role ||
            typeof role.id !== "string" ||
            !role.id ||
            typeof role.name !== "string" ||
            typeof role.description !== "string",
        ))
    ) {
      throw new Error("invalid_rule_system");
    }
    if (
      fields.durationMinutes !== undefined &&
      (!Number.isInteger(fields.durationMinutes) ||
        fields.durationMinutes < 5 ||
        fields.durationMinutes > 720)
    ) {
      throw new Error("invalid_rule_system");
    }
    const validAnchor = (
      item: {
        sourceId: string | null;
        provenance: string;
        confidence: number;
      },
    ) =>
      (item.sourceId === null || typeof item.sourceId === "string") &&
      ["source-anchored", "system-generated", "ai-proposed"].includes(
        item.provenance,
      ) &&
      typeof item.confidence === "number" &&
      item.confidence >= 0 &&
      item.confidence <= 1;
    if (
      fields.rules !== undefined &&
      (!Array.isArray(fields.rules) ||
        fields.rules.length > 500 ||
        fields.rules.some(
          (rule) =>
            !rule ||
            typeof rule.id !== "string" ||
            !rule.id ||
            typeof rule.text !== "string" ||
            !validAnchor(rule),
        ))
    ) {
      throw new Error("invalid_rule_system");
    }
    if (
      fields.constraints !== undefined &&
      (!Array.isArray(fields.constraints) ||
        fields.constraints.length > 500 ||
        fields.constraints.some(
          (constraint) =>
            !constraint ||
            typeof constraint.id !== "string" ||
            !constraint.id ||
            typeof constraint.text !== "string" ||
            !validAnchor(constraint),
        ))
    ) {
      throw new Error("invalid_rule_system");
    }
    if (
      fields.entities !== undefined &&
      (!Array.isArray(fields.entities) ||
        fields.entities.length > 500 ||
        fields.entities.some(
          (entity) =>
            !entity ||
            typeof entity.id !== "string" ||
            !entity.id ||
            typeof entity.name !== "string" ||
            !["resource", "card", "character", "token", "location", "concept", "object"].includes(entity.kind) ||
            (entity.quantity !== undefined &&
              (!Number.isInteger(entity.quantity) || entity.quantity < 1)) ||
            (entity.image !== undefined && !validBoundImage(entity.image)) ||
            !validAnchor(entity),
        ))
    ) {
      throw new Error("invalid_rule_system");
    }
    if (
      fields.setup !== undefined &&
      (!Array.isArray(fields.setup) ||
        fields.setup.length > 200 ||
        fields.setup.some((step) => typeof step !== "string"))
    ) {
      throw new Error("invalid_rule_system");
    }
    if (
      fields.actions !== undefined &&
      (!Array.isArray(fields.actions) ||
        fields.actions.length > 500 ||
        fields.actions.some(
          (action) =>
            !action ||
            typeof action.id !== "string" ||
            !action.id ||
            typeof action.label !== "string" ||
            typeof action.description !== "string" ||
            !validAnchor(action),
        ))
    ) {
      throw new Error("invalid_rule_system");
    }
    if (
      fields.playSurface !== undefined &&
      (!fields.playSurface ||
        !["table", "cards", "conversation", "screen", "scene", "hybrid"].includes(fields.playSurface.kind) ||
        typeof fields.playSurface.layout !== "string" ||
        !Array.isArray(fields.playSurface.regions) ||
        fields.playSurface.regions.length > 500 ||
        fields.playSurface.regions.some(
          (zone) =>
            !zone ||
            typeof zone.id !== "string" ||
            !zone.id ||
            typeof zone.name !== "string" ||
            typeof zone.description !== "string" ||
            (zone.image !== undefined && !validBoundImage(zone.image)),
        ))
    ) {
      throw new Error("invalid_rule_system");
    }
    const validNamedList = (items: Array<{ id: string; name: string }>) =>
      items.length <= 500 &&
      items.every(
        (item) =>
          item &&
          typeof item.id === "string" &&
          Boolean(item.id) &&
          typeof item.name === "string",
      );
    if (
      (fields.stages !== undefined &&
        (!Array.isArray(fields.stages) || !validNamedList(fields.stages))) ||
      (fields.outcomes !== undefined &&
        (!Array.isArray(fields.outcomes) ||
          !validNamedList(fields.outcomes))) ||
      (fields.presentation !== undefined &&
        (!fields.presentation ||
          typeof fields.presentation.theme !== "string" ||
          (fields.presentation.image !== undefined &&
            !validBoundImage(fields.presentation.image)) ||
          (fields.presentation.visuals !== undefined &&
            !validVisualTreatments(fields.presentation.visuals))))
    ) {
      throw new Error("invalid_rule_system");
    }
    const boundImageSourceIds = [
      ...(fields.entities ?? []).flatMap((entity) =>
        entity.image ? [entity.image.sourceId] : []
      ),
      ...(fields.playSurface?.regions ?? []).flatMap((region) =>
        region.image ? [region.image.sourceId] : []
      ),
      ...(fields.presentation?.image
        ? [fields.presentation.image.sourceId]
        : []),
    ];
    for (const sourceId of boundImageSourceIds) {
      const source = record.sources.find((candidate) => candidate.id === sourceId);
      if (!source || source.kind !== "image") {
        throw new Error("bound_image_source_not_found");
      }
      if (source.imageUse !== "project-asset") {
        throw new Error("visual_reference_not_bindable");
      }
    }
    const runtimeSensitiveEdit =
      fields.participants !== undefined ||
      fields.rules !== undefined ||
      fields.constraints !== undefined ||
      (fields.actions !== undefined &&
        runtimeActionShapeChanged(record.ruleSystem.actions, fields.actions));
    const runtimeReconfigurationMessage =
      "改了人数、规则或行动后，需要再确认一次玩法才能继续开玩。";
    record.ruleSystem = {
      ...record.ruleSystem,
      ...(fields.name === undefined
        ? {}
        : { name: fields.name.trim().slice(0, 120) }),
      ...(fields.pitch === undefined
        ? {}
        : { pitch: fields.pitch.trim().slice(0, 2_000) }),
      ...(fields.participants === undefined
        ? {}
        : { participants: structuredClone(fields.participants) }),
      ...(fields.durationMinutes === undefined
        ? {}
        : { durationMinutes: fields.durationMinutes }),
      ...(fields.rules === undefined
        ? {}
        : { rules: structuredClone(fields.rules) }),
      ...(fields.constraints === undefined
        ? {}
        : { constraints: structuredClone(fields.constraints) }),
      ...(fields.entities === undefined
        ? {}
        : { entities: structuredClone(fields.entities) }),
      ...(fields.setup === undefined
        ? {}
        : { setup: structuredClone(fields.setup) }),
      ...(fields.actions === undefined
        ? {}
        : { actions: structuredClone(fields.actions) }),
      ...(fields.playSurface === undefined
        ? {}
        : { playSurface: structuredClone(fields.playSurface) }),
      ...(fields.stages === undefined
        ? {}
        : { stages: structuredClone(fields.stages) }),
      ...(fields.outcomes === undefined
        ? {}
        : { outcomes: structuredClone(fields.outcomes) }),
      ...(fields.presentation === undefined
        ? {}
        : { presentation: structuredClone(fields.presentation) }),
      ...(runtimeSensitiveEdit
        ? {
            runtimeSupport: {
              status: "draft" as const,
              unsupported: [
                ...new Set([
                  ...record.ruleSystem.runtimeSupport.unsupported,
                  runtimeReconfigurationMessage,
                ]),
              ],
            },
          }
        : {}),
    };
    affectedEntities.push(`rule-system:${record.ruleSystem.id}`);
    return;
  }

  if (isRuntimeConfiguration(operation)) {
    if (!validateRuntimeConfiguration(operation)) {
      throw new Error("invalid_runtime");
    }
    configureRuntimeKernel(record, operation, affectedEntities);
    return;
  }

  if (operation.op === "activate_rule_system") {
    if (typeof operation.ruleSystemId !== "string") {
      throw new Error("invalid_rule_system");
    }
    const ruleSystem = record.ruleSystems.find(
      (candidate) => candidate.id === operation.ruleSystemId,
    );
    if (!ruleSystem) throw new Error("invalid_rule_system");
    record.ruleSystem = structuredClone(ruleSystem);
    record.project = {
      ...record.project,
      activeRuleSystemId: ruleSystem.id,
    };
    affectedEntities.push(`active-rule-system:${ruleSystem.id}`);
    return;
  }

  if (operation.op === "add_design_hypothesis") {
    const hypothesis = operation.hypothesis;
    if (
      !hypothesis ||
      typeof hypothesis.question !== "string" ||
      !hypothesis.question.trim() ||
      hypothesis.question.length > 500 ||
      typeof hypothesis.successSignal !== "string" ||
      !hypothesis.successSignal.trim() ||
      hypothesis.successSignal.length > 500
    ) {
      throw new Error("invalid_design_hypothesis");
    }
    const entry: DesignHypothesis = {
      id: `hypothesis_${crypto.randomUUID()}`,
      question: hypothesis.question.trim(),
      successSignal: hypothesis.successSignal.trim(),
      createdAt: new Date().toISOString(),
    };
    record.hypotheses.push(entry);
    affectedEntities.push(`hypothesis:${entry.id}`);
    return;
  }

  if (operation.op === "record_validation_finding") {
    const finding = operation.finding;
    const hypothesis = record.hypotheses.find(
      (candidate) => candidate.id === finding?.hypothesisId,
    );
    const build = record.builds.find(
      (candidate) => candidate.id === finding?.buildId,
    );
    if (
      !finding ||
      !hypothesis ||
      !build ||
      !["supported", "refuted", "inconclusive"].includes(finding.verdict) ||
      typeof finding.notes !== "string" ||
      finding.notes.length > 2_000 ||
      typeof finding.nextChange !== "string" ||
      !finding.nextChange.trim() ||
      finding.nextChange.length > 1_000
    ) {
      throw new Error("invalid_validation_finding");
    }
    const evidence = finding.evidence;
    if (evidence.type === "automated-playtest") {
      const playtest = record.playtests.find(
        (candidate) => candidate.id === evidence.playtestId,
      );
      if (!playtest || playtest.buildId !== build.id) {
        throw new Error("invalid_automated_evidence");
      }
    } else if (evidence.type === "participant-feedback") {
      const room = record.sessions.find(
        (candidate) => candidate.id === evidence.sessionId,
      );
      const feedback = evidence.feedback;
      if (
        !room ||
        room.buildId !== build.id ||
        (room.experiment !== null &&
          room.experiment.hypothesisId !== hypothesis.id) ||
        !Array.isArray(feedback) ||
        feedback.length < 1 ||
        feedback.length > 8 ||
        new Set(feedback.map((entry) => entry?.id)).size !== feedback.length ||
        new Set(feedback.map((entry) => entry?.seat)).size !== feedback.length ||
        feedback.some((entry) => {
          if (
            !entry ||
            typeof entry.id !== "string" ||
            !Number.isInteger(entry.seat) ||
            !Number.isInteger(entry.rating) ||
            entry.rating < 1 ||
            entry.rating > 5 ||
            typeof entry.comment !== "string" ||
            entry.comment.trim() !== entry.comment ||
            entry.comment.length < 2 ||
            entry.comment.length > 1_000 ||
            !entry.moment ||
            !Number.isInteger(entry.moment.actionSequence) ||
            entry.moment.actionSequence < 1 ||
            typeof entry.moment.actionId !== "string" ||
            !entry.moment.actionId
          ) {
            return true;
          }
          const stored = room.feedback.find((candidate) => candidate.id === entry.id);
          return !stored ||
            stored.seat !== entry.seat ||
            stored.rating !== entry.rating ||
            stored.comment !== entry.comment ||
            stored.moment.actionSequence !== entry.moment.actionSequence ||
            stored.moment.actionId !== entry.moment.actionId;
        })
      ) {
        throw new Error("invalid_participant_feedback");
      }
    } else if (evidence.type === "human-session") {
      const room = record.sessions.find(
        (candidate) => candidate.id === evidence.sessionId,
      );
      const seated = evidence.seatedParticipants;
      const names = Array.isArray(seated)
        ? seated.map((entry) => entry?.name?.trim()).filter(Boolean)
        : [];
      const evidenceSeats = Array.isArray(seated)
        ? seated.map((entry) => entry?.seat)
        : [];
      const claimedSeats = [...new Set((room?.seats ?? []).map((entry) => entry.seat))]
        .sort((left, right) => left - right);
      const namedSeats = [...evidenceSeats]
        .filter((seat): seat is number => Number.isInteger(seat))
        .sort((left, right) => left - right);
      if (
        !room ||
        room.buildId !== build.id ||
        (room.experiment !== null &&
          room.experiment.hypothesisId !== hypothesis.id) ||
        room.seats.length < 2 ||
        room.acceptedActions.length < 1 ||
        !Array.isArray(seated) ||
        seated.length !== room.seats.length ||
        names.length !== seated.length ||
        new Set(names).size !== names.length ||
        names.some((name) => name.length > 80) ||
        new Set(namedSeats).size !== namedSeats.length ||
        claimedSeats.join(",") !== namedSeats.join(",") ||
        seated.some((entry) => {
          if (
            !entry ||
            !Number.isInteger(entry.seat) ||
            typeof entry.name !== "string" ||
            !entry.name.trim()
          ) {
            return true;
          }
          const stored = room.seats.find((candidate) => candidate.seat === entry.seat);
          return Boolean(stored?.displayName && stored.displayName !== entry.name.trim());
        }) ||
        evidence.creatorAttested !== true
      ) {
        throw new Error("invalid_human_evidence");
      }
    } else {
      throw new Error("invalid_validation_evidence");
    }
    const entry: ValidationFinding = {
      id: `finding_${crypto.randomUUID()}`,
      hypothesisId: hypothesis.id,
      buildId: build.id,
      evidence: structuredClone(evidence),
      verdict: finding.verdict,
      notes: finding.notes.trim(),
      nextChange: finding.nextChange.trim(),
      createdAt: new Date().toISOString(),
    };
    record.findings.push(entry);
    affectedEntities.push(`finding:${entry.id}`);
    return;
  }

  throw new Error("unsupported_operation");
}

export function proposedAffectedEntities(
  ruleSystemId: string,
  operations: ProjectChangeOperation[],
) {
  return operations.map((operation) => {
    if (operation.op === "add_source") return "source:new";
    if (
      operation.op === "configure_score_race" ||
      operation.op === "configure_shared_goal" ||
      operation.op === "configure_turn_taking" ||
      operation.op === "configure_take_away" ||
      operation.op === "configure_roll_and_move" ||
      operation.op === "configure_draw_and_score" ||
      operation.op === "configure_push_your_luck" ||
      operation.op === "configure_harbor_voyage"
    ) {
      return `runtime:${ruleSystemId}`;
    }
    if (operation.op === "activate_rule_system") {
      return `active-rule-system:${operation.ruleSystemId}`;
    }
    if (operation.op === "approve_generation_plan") {
      return `generation-plan:${operation.planId}`;
    }
    if (operation.op === "add_design_hypothesis") return "hypothesis:new";
    if (operation.op === "record_validation_finding") return "finding:new";
    if (operation.op === "publish_shared_session") return "playtest-link:new";
    return `rule-system:${ruleSystemId}`;
  });
}

export async function buildId(
  projectId: string,
  ruleSystemVersion: number,
  ruleSystem: RuleSystem,
  sourceIds: string[],
) {
  const input = JSON.stringify({
    projectId,
    ruleSystemVersion,
    ruleSystem,
    sourceIds,
  });
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `build_${hex.slice(0, 24)}`;
}

export function referencedSourceIds(
  ruleSystem: RuleSystem,
  sources: SourceLibraryEntry[],
) {
  const sourceIds = new Set(
    [
      ...ruleSystem.rules.map((entry) => entry.sourceId),
      ...ruleSystem.entities.flatMap((entry) => [
        entry.sourceId,
        entry.image?.sourceId,
      ]),
      ...ruleSystem.actions.map((entry) => entry.sourceId),
      ...ruleSystem.playSurface.regions.map((zone) => zone.image?.sourceId),
      ruleSystem.presentation.image?.sourceId,
    ].filter((sourceId): sourceId is string => Boolean(sourceId)),
  );
  const sourcesById = new Map(sources.map((source) => [source.id, source]));
  const pending = [...sourceIds];
  for (const sourceId of pending) {
    const basedOnSourceIds = sourcesById.get(sourceId)?.provenance.basedOnSourceIds ?? [];
    for (const basedOnSourceId of basedOnSourceIds) {
      if (!sourceIds.has(basedOnSourceId)) {
        sourceIds.add(basedOnSourceId);
        pending.push(basedOnSourceId);
      }
    }
  }
  return [...sourceIds].sort();
}

export function buildWarnings(record: ProjectRecord) {
  const referencedIds = referencedSourceIds(record.ruleSystem, record.sources);
  const availableIds = new Set(record.sources.map((source) => source.id));
  return [
    ...(record.ruleSystem.rules.length
      ? []
      : ["Rule System 还没有结构化规则。"]),
    ...(record.ruleSystem.entities.length
      ? []
      : ["Rule System 还没有 Game Entity。"]),
    ...(referencedIds.length
      ? []
      : ["规则与 Game Entity 尚未锚定 Source Library，当前规则事实无法追溯。"]),
    ...(referencedIds.some((sourceId) => !availableIds.has(sourceId))
      ? ["Rule System 引用了不存在的 Source Library 条目。"]
      : []),
  ];
}

export function hasBoundImage(ruleSystem: RuleSystem) {
  return Boolean(
    ruleSystem.presentation.image?.url ||
    ruleSystem.entities.some((entity) => entity.image?.url) ||
    ruleSystem.playSurface.regions.some((region) => region.image?.url),
  );
}

export function presentationFloor(ruleSystem: RuleSystem): PresentationFloorReadiness {
  const visuals: VisualTreatment[] = ruleSystem.presentation.visuals?.length
    ? ruleSystem.presentation.visuals
    : [];
  const visual = visuals[0];
  if (!visual) {
    return {
      status: "failed",
      reason: "没有可分享的呈现：请绑定提取/上传图像、生成排版界面，或应用主题 kit。",
      visuals,
    };
  }
  if (visual.provenance === "kit") {
    if (!ruleSystem.presentation.theme.trim()) {
      return {
        status: "failed",
        reason: "主题 kit 缺少 theme，不能作为 Presentation Floor。",
        visuals,
      };
    }
    return {
      status: "passed",
      reason: `${visual.label} 已满足 Presentation Floor。`,
      visuals,
    };
  }
  if (!hasBoundImage(ruleSystem)) {
    return {
      status: "failed",
      reason: "generated、extracted 或 uploaded 呈现必须绑定真实图像，不能只写 provenance。",
      visuals,
    };
  }
  return {
    status: "passed",
    reason: `${visual.label} 已满足 Presentation Floor。`,
    visuals,
  };
}

export function visibleSession(
  session: StoredSharedSession,
  viewerSeat: number | null = null,
): SharedSessionSnapshot {
  const scoped = {
    ...session,
    state: scopeSessionState(session.state, viewerSeat),
    acceptedActions: session.acceptedActions.map((action) => ({
      ...action,
      state: scopeSessionState(action.state, viewerSeat),
    })),
  };
  return {
    ...scoped,
    seats: publicSeats(session.seats),
  };
}

export function reconstructActions(
  build: StoredPlayableBuild,
  acceptedActions: GameReplay["acceptedActions"],
  seed = 42,
) {
  const runtime = executableRuntime(build.ruleSystem);
  if (!runtime) throw new Error("runtime_not_executable");
  let state = initialSessionState(build.ruleSystem, seed);
  const reconstructed = acceptedActions.map((logged, index) => {
    const accepted = acceptIntent(
      state,
      runtime,
      {
        intentId: logged.intentId,
        seat: logged.seat,
        actionId: logged.actionId,
        payload: logged.payload,
      },
      index + 1,
      seed,
    );
    if (!accepted) throw new Error("action_log_invalid");
    state = accepted.state;
    return accepted;
  });
  return { state, acceptedActions: reconstructed };
}

export function reconstructSession(
  session: StoredSharedSession,
  build: StoredPlayableBuild,
): StoredSharedSession {
  const reconstructed = reconstructActions(
    build,
    session.acceptedActions,
    session.seed,
  );
  return {
    ...session,
    state: reconstructed.state,
    acceptedActions: reconstructed.acceptedActions,
  };
}

export function reconstructReplay(
  replay: StoredReplay,
  build: StoredPlayableBuild,
): StoredReplay {
  const reconstructed = reconstructActions(
    build,
    replay.acceptedActions,
    replay.seed,
  );
  return {
    ...replay,
    initialState: initialSessionState(build.ruleSystem, replay.seed),
    acceptedActions: reconstructed.acceptedActions,
    finalState: reconstructed.state,
  };
}

