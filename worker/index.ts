import { DurableObject } from "cloudflare:workers";
import {
  anonymousCreator,
  authorizeRequest,
  finishWebLogin,
  protectedResourceMetadata,
  requiredScopes,
  startWebLogin,
  withCookies,
} from "./auth";
import { logicalPathname, mountHref } from "../src/public-mount";
import { godeskMcpHandler } from "./mcp";
import {
  acceptIntent,
  executableRuntime,
  initialSessionState,
  runBotSimulation,
} from "./runtime";
import type {
  ApplyProjectChangesInput,
  ApplyProjectChangesResult,
  Changeset,
  CompileBuildInput,
  CompileBuildResult,
  CreatorJob,
  CreatorJobKind,
  CreateProjectResult,
  DesignHypothesis,
  DuplicateRuleSystemResult,
  RestoreBuildResult,
  GenerationPlan,
  RuleSystem,
  GameProject,
  GameReplay,
  SharedSession,
  SharedSessionSnapshot,
  SharedSessionSnapshotEvent,
  SessionFeedback,
  PlaytestRun,
  PlayableBuild,
  PlaytestLink,
  ProjectChangeOperation,
  SourceLibraryEntry,
  SubmitJobInput,
  PresentationFloorReadiness,
  RuntimeConfigureOperation,
  ValidationFinding,
  VisualTreatment,
} from "../src/creator/project-contract";
import {
  instantiateDefaultExample,
  isDefaultExampleId,
} from "./default-examples";
import {
  inferredNumber,
  inferredDrawAndScoreRule,
  inferredPushYourLuckRule,
  inferredRollAndMoveRule,
  inferredSharedGoalTarget,
  inferredTakeAwayRule,
  isSharedGoalDescription,
  isTurnTakingDescription,
  createGenerationPlan,
  materializeRuleSystem,
} from "./rulebook-generation";
import { createActionDescriptionIterationPlan } from "./rule-system-iteration";
import {
  capabilityMatches,
  publicShareUrl,
  resourceKindFromPath,
  shareSecret,
  shareTokenFromUrl,
  signShareToken,
  verifyShareToken,
  type ShareCapability,
} from "./share-capability";
import {
  hashSeatToken,
  issueSeatToken,
  otherSeatForHash,
  publicSeats,
  seatForToken,
  type StoredSessionSeat,
} from "./seat-capability";

const PROJECT_PREFIX = "/projects/";
const GENERATION_PLAN_PREFIX = "generation-plan:";
const PLAYTEST_LINK_PREFIX = "playtest-link:";
const READ_ONLY_MCP_TOOLS = new Set([
  "list_projects",
  "read_project",
  "get_studio_url",
  "track_job",
  "read_build",
  "read_shared_session",
  "read_replay",
]);

async function mcpScopes(request: Request) {
  if (request.method !== "POST") return ["godesk:read"];
  const payload = await request.clone().json<
    | { method?: string; params?: { name?: string } }
    | Array<{ method?: string; params?: { name?: string } }>
  >().catch(() => undefined);
  const messages = Array.isArray(payload) ? payload : payload ? [payload] : [];
  const mutates = messages.some(
    (message) =>
      message.method === "tools/call" &&
      !READ_ONLY_MCP_TOOLS.has(String(message.params?.name)),
  );
  return mutates ? ["godesk:read", "godesk:write"] : ["godesk:read"];
}

interface ProjectRecord {
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

type StoredPlayableBuild = Omit<PlayableBuild, "playableUrl">;
type StoredPlaytest = Omit<PlaytestRun, "replayUrl">;
type StoredSharedSession = Omit<SharedSession, "sessionUrl" | "replayUrl" | "seats"> & {
  seats: StoredSessionSeat[];
};
type StoredPlaytestLink = Omit<PlaytestLink, "url">;
interface SessionSocketAttachment {
  sessionId: string;
}
type StoredReplay = GameReplay;
type StoredCompileBuildResult = Omit<
  CompileBuildResult,
  "build" | "studioUrl"
> & {
  build: StoredPlayableBuild;
  studioPath: string;
};
type StoredApplyProjectChangesResult = Omit<
  ApplyProjectChangesResult,
  "studioUrl"
> & { studioPath: string };
type StoredDuplicateRuleSystemResult = Omit<
  DuplicateRuleSystemResult,
  "studioUrl"
> & { studioPath: string };
type StoredRestoreBuildResult = Omit<
  RestoreBuildResult,
  "studioUrl"
> & { studioPath: string };

function generationPlanKey(projectId: string) {
  return `${GENERATION_PLAN_PREFIX}${projectId}`;
}

function playtestLinkKey(projectId: string) {
  return `${PLAYTEST_LINK_PREFIX}${projectId}`;
}

function json(value: unknown, status = 200) {
  return Response.json(value, { status });
}

function error(message: string, status: number) {
  return json({ error: message }, status);
}

function paginated<T>(
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

function initialRuleSystem(id: string): RuleSystem {
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

function normalizedRuleSystem(ruleSystem: RuleSystem): RuleSystem {
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

function sameRuleSystemContent(left: RuleSystem, right: RuleSystem) {
  const comparable = (ruleSystem: RuleSystem) => ({
    ...structuredClone(ruleSystem),
    id: "",
    version: 0,
    restoredFromBuildId: undefined,
  });
  return JSON.stringify(comparable(left)) === JSON.stringify(comparable(right));
}

function normalizedBuild(build: StoredPlayableBuild): StoredPlayableBuild {
  if (!build.presentationFloor) {
    throw new Error("unsupported_build_shape");
  }
  return {
    ...build,
    ruleSystem: normalizedRuleSystem(build.ruleSystem),
    presentationFloor: build.presentationFloor,
  };
}

function normalizedProjectRecord(record: ProjectRecord) {
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

function validChangeRequest(value: unknown): value is ApplyProjectChangesInput {
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

function validBoundImage(value: unknown) {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as { sourceId?: unknown }).sourceId === "string" &&
      typeof (value as { url?: unknown }).url === "string" &&
      typeof (value as { alt?: unknown }).alt === "string",
  );
}

function validVisualTreatments(value: unknown) {
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

function runtimeActionShapeChanged(
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

type RuntimeConfiguration =
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
    };

function configureRuntimeKernel(
  record: ProjectRecord,
  configuration: RuntimeConfiguration,
  affectedEntities: string[],
) {
  if (configuration.op === "configure_harbor_voyage") {
    const unsupported = configuration.config.unsupported?.map((item) => item.trim()) ?? [];
    const runtimeSource: SourceLibraryEntry = {
      id: `source_${crypto.randomUUID()}`,
      kind: "brief",
      name: `${record.ruleSystem.name} · harbor-voyage-v1 配置`,
      content: JSON.stringify(configuration.config),
      readiness: "ready",
      provenance: {
        origin: "system-generated",
        locator: `${configuration.op} operation`,
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
        kernel: {
          type: "harbor-voyage-v1",
          playerCount: configuration.config.playerCount,
        },
      },
    };
    affectedEntities.push(`source:${runtimeSource.id}`);
    affectedEntities.push(`runtime:${record.ruleSystem.id}`);
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

function applyOperation(
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

  if (operation.op === "configure_score_race") {
    const { config } = operation;
    if (
      !config ||
      typeof config !== "object" ||
      !Number.isInteger(config.victoryTarget) ||
      config.victoryTarget < 1 ||
      config.victoryTarget > 1_000 ||
      !Number.isInteger(config.maxTurns) ||
      config.maxTurns < 1 ||
      config.maxTurns > 1_000 ||
      !Array.isArray(config.actions) ||
      config.actions.length < 1 ||
      config.actions.length > 12 ||
      config.actions.some(
        (action) =>
          !action ||
          typeof action.id !== "string" ||
          !/^[a-z0-9-]{1,40}$/.test(action.id) ||
          typeof action.label !== "string" ||
          !action.label.trim() ||
          !Number.isInteger(action.points) ||
          action.points < 1 ||
          action.points > 100,
      ) ||
      (config.unsupported !== undefined &&
        (!Array.isArray(config.unsupported) ||
          config.unsupported.length > 50 ||
          config.unsupported.some((item) =>
            typeof item !== "string" || !item.trim() || item.length > 500
          )))
    ) {
      throw new Error("invalid_runtime");
    }
    if (new Set(config.actions.map((action) => action.id)).size !== config.actions.length) {
      throw new Error("invalid_runtime");
    }
    configureRuntimeKernel(record, operation, affectedEntities);
    return;
  }

  if (operation.op === "configure_shared_goal") {
    const { config } = operation;
    if (
      !config ||
      typeof config !== "object" ||
      !Number.isInteger(config.goalTarget) ||
      config.goalTarget < 1 ||
      config.goalTarget > 1_000 ||
      !Number.isInteger(config.maxTurns) ||
      config.maxTurns < 1 ||
      config.maxTurns > 1_000 ||
      !Array.isArray(config.actions) ||
      config.actions.length < 1 ||
      config.actions.length > 12 ||
      config.actions.some(
        (action) =>
          !action ||
          typeof action.id !== "string" ||
          !/^[a-z0-9-]{1,40}$/.test(action.id) ||
          typeof action.label !== "string" ||
          !action.label.trim() ||
          !Number.isInteger(action.progress) ||
          action.progress < 1 ||
          action.progress > 100,
      ) ||
      (config.unsupported !== undefined &&
        (!Array.isArray(config.unsupported) ||
          config.unsupported.length > 50 ||
          config.unsupported.some((item) =>
            typeof item !== "string" || !item.trim() || item.length > 500
          )))
    ) {
      throw new Error("invalid_runtime");
    }
    if (new Set(config.actions.map((action) => action.id)).size !== config.actions.length) {
      throw new Error("invalid_runtime");
    }
    configureRuntimeKernel(record, operation, affectedEntities);
    return;
  }

  if (operation.op === "configure_turn_taking") {
    const { config } = operation;
    if (
      !config ||
      typeof config !== "object" ||
      !Number.isInteger(config.maxTurns) ||
      config.maxTurns < 1 ||
      config.maxTurns > 1_000 ||
      !Array.isArray(config.actions) ||
      config.actions.length < 1 ||
      config.actions.length > 12 ||
      config.actions.some(
        (action) =>
          !action ||
          typeof action.id !== "string" ||
          !/^[a-z0-9-]{1,40}$/.test(action.id) ||
          typeof action.label !== "string" ||
          !action.label.trim(),
      ) ||
      (config.unsupported !== undefined &&
        (!Array.isArray(config.unsupported) ||
          config.unsupported.length > 50 ||
          config.unsupported.some((item) =>
            typeof item !== "string" || !item.trim() || item.length > 500
          )))
    ) {
      throw new Error("invalid_runtime");
    }
    if (new Set(config.actions.map((action) => action.id)).size !== config.actions.length) {
      throw new Error("invalid_runtime");
    }
    configureRuntimeKernel(record, operation, affectedEntities);
    return;
  }

  if (operation.op === "configure_take_away") {
    const { config } = operation;
    if (
      !config ||
      typeof config !== "object" ||
      !Number.isInteger(config.initialPool) ||
      config.initialPool < 2 ||
      config.initialPool > 1_000 ||
      !Array.isArray(config.actions) ||
      config.actions.length < 1 ||
      config.actions.length > 12 ||
      config.actions.some(
        (action) =>
          !action ||
          typeof action.id !== "string" ||
          !/^[a-z0-9-]{1,40}$/.test(action.id) ||
          typeof action.label !== "string" ||
          !action.label.trim() ||
          !Number.isInteger(action.take) ||
          action.take < 1 ||
          action.take > 100 ||
          action.take > config.initialPool,
      ) ||
      (config.unsupported !== undefined &&
        (!Array.isArray(config.unsupported) ||
          config.unsupported.length > 50 ||
          config.unsupported.some((item) =>
            typeof item !== "string" || !item.trim() || item.length > 500
          )))
    ) {
      throw new Error("invalid_runtime");
    }
    if (
      new Set(config.actions.map((action) => action.id)).size !== config.actions.length ||
      new Set(config.actions.map((action) => action.take)).size !== config.actions.length
    ) {
      throw new Error("invalid_runtime");
    }
    configureRuntimeKernel(record, operation, affectedEntities);
    return;
  }

  if (operation.op === "configure_roll_and_move") {
    const { config } = operation;
    if (
      !config ||
      typeof config !== "object" ||
      !Number.isInteger(config.dieSides) ||
      config.dieSides < 2 ||
      config.dieSides > 100 ||
      !Number.isInteger(config.targetPosition) ||
      config.targetPosition < 2 ||
      config.targetPosition > 1_000 ||
      !Number.isInteger(config.maxTurns) ||
      config.maxTurns < 1 ||
      config.maxTurns > 1_000 ||
      !Array.isArray(config.actions) ||
      config.actions.length !== 1 ||
      config.actions.some(
        (action) =>
          !action ||
          typeof action.id !== "string" ||
          !/^[a-z0-9-]{1,40}$/.test(action.id) ||
          typeof action.label !== "string" ||
          !action.label.trim() ||
          action.label.length > 80,
      ) ||
      (config.unsupported !== undefined &&
        (!Array.isArray(config.unsupported) ||
          config.unsupported.length > 50 ||
          config.unsupported.some((item) =>
            typeof item !== "string" || !item.trim() || item.length > 500
          )))
    ) {
      throw new Error("invalid_runtime");
    }
    configureRuntimeKernel(record, operation, affectedEntities);
    return;
  }

  if (operation.op === "configure_draw_and_score") {
    const { config } = operation;
    if (
      !config ||
      typeof config !== "object" ||
      !Array.isArray(config.cardValues) ||
      config.cardValues.length < 1 ||
      config.cardValues.length > 100 ||
      config.cardValues.some((value) => !Number.isInteger(value) || value < 1 || value > 100) ||
      new Set(config.cardValues).size !== config.cardValues.length ||
      !Number.isInteger(config.copiesPerValue) ||
      config.copiesPerValue < 1 ||
      config.copiesPerValue > 100 ||
      config.cardValues.length * config.copiesPerValue > 1_000 ||
      !Number.isInteger(config.victoryTarget) ||
      config.victoryTarget < 1 ||
      config.victoryTarget > 1_000 ||
      !Array.isArray(config.actions) ||
      config.actions.length !== 1 ||
      config.actions.some((action) =>
        !action ||
        typeof action.id !== "string" ||
        !/^[a-z0-9-]{1,40}$/.test(action.id) ||
        typeof action.label !== "string" ||
        !action.label.trim() ||
        action.label.length > 80
      ) ||
      (config.unsupported !== undefined &&
        (!Array.isArray(config.unsupported) ||
          config.unsupported.length > 50 ||
          config.unsupported.some((item) =>
            typeof item !== "string" || !item.trim() || item.length > 500
          )))
    ) throw new Error("invalid_runtime");
    configureRuntimeKernel(record, operation, affectedEntities);
    return;
  }

  if (operation.op === "configure_push_your_luck") {
    const { config } = operation;
    if (
      !config ||
      typeof config !== "object" ||
      !Number.isInteger(config.dieSides) ||
      config.dieSides < 2 ||
      config.dieSides > 100 ||
      !Number.isInteger(config.bustFace) ||
      config.bustFace < 1 ||
      config.bustFace > config.dieSides ||
      !Number.isInteger(config.victoryTarget) ||
      config.victoryTarget < 1 ||
      config.victoryTarget > 1_000 ||
      !Number.isInteger(config.maxActions) ||
      config.maxActions < 1 ||
      config.maxActions > 10_000 ||
      !Array.isArray(config.actions) ||
      config.actions.length !== 2 ||
      config.actions.some((action) =>
        !action ||
        !["roll", "bank"].includes(action.id) ||
        typeof action.label !== "string" ||
        !action.label.trim() ||
        action.label.length > 80
      ) ||
      new Set(config.actions.map((action) => action.id)).size !== 2 ||
      (config.unsupported !== undefined &&
        (!Array.isArray(config.unsupported) ||
          config.unsupported.length > 50 ||
          config.unsupported.some((item) =>
            typeof item !== "string" || !item.trim() || item.length > 500
          )))
    ) throw new Error("invalid_runtime");
    configureRuntimeKernel(record, operation, affectedEntities);
    return;
  }

  if (operation.op === "configure_harbor_voyage") {
    const { config } = operation;
    if (
      !config ||
      typeof config !== "object" ||
      !Number.isInteger(config.playerCount) ||
      config.playerCount < 2 ||
      config.playerCount > 3 ||
      (config.unsupported !== undefined &&
        (!Array.isArray(config.unsupported) ||
          config.unsupported.length > 50 ||
          config.unsupported.some((item) =>
            typeof item !== "string" || !item.trim() || item.length > 500
          )))
    ) throw new Error("invalid_runtime");
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

function proposedAffectedEntities(
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

async function buildId(
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

function referencedSourceIds(
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

function buildWarnings(record: ProjectRecord) {
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

function hasBoundImage(ruleSystem: RuleSystem) {
  return Boolean(
    ruleSystem.presentation.image?.url ||
    ruleSystem.entities.some((entity) => entity.image?.url) ||
    ruleSystem.playSurface.regions.some((region) => region.image?.url),
  );
}

function presentationFloor(ruleSystem: RuleSystem): PresentationFloorReadiness {
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

function visibleSession(session: StoredSharedSession): SharedSessionSnapshot {
  return {
    ...session,
    seats: publicSeats(session.seats),
  };
}

async function signedShareToken(
  secret: string,
  creatorId: string,
  capability: Omit<ShareCapability, "v" | "c">,
) {
  return signShareToken({ v: 1, c: creatorId, ...capability }, secret);
}

async function publicBuild(
  build: StoredPlayableBuild,
  origin: string,
  creatorId?: string,
  secret?: string,
  mount = "/",
): Promise<PlayableBuild> {
  const normalized = normalizedBuild(build);
  const token = creatorId && secret
    ? await signedShareToken(secret, creatorId, { build: normalized.id })
    : null;
  return {
    ...normalized,
    playableUrl: token
      ? publicShareUrl(`/play/${normalized.id}`, origin, token, mount)
      : new URL(mountHref(`/play/${normalized.id}`, mount), origin).toString(),
  };
}

async function publicPlaytest(
  playtest: StoredPlaytest,
  origin: string,
  creatorId?: string,
  secret?: string,
  mount = "/",
): Promise<PlaytestRun> {
  const token = creatorId && secret
    ? await signedShareToken(secret, creatorId, { replay: playtest.replayId })
    : null;
  return {
    ...playtest,
    replayUrl: token
      ? publicShareUrl(`/replay/${playtest.replayId}`, origin, token, mount)
      : new URL(mountHref(`/replay/${playtest.replayId}`, mount), origin).toString(),
  };
}

async function publicSession(
  session: StoredSharedSession,
  origin: string,
  creatorId: string,
  secret: string,
  mount = "/",
): Promise<SharedSession> {
  const token = await signedShareToken(secret, creatorId, {
    room: session.id,
    build: session.buildId,
    replay: session.replayId,
  });
  return {
    ...session,
    seats: publicSeats(session.seats),
    sessionUrl: publicShareUrl(`/room/${session.id}`, origin, token, mount),
    replayUrl: publicShareUrl(`/replay/${session.replayId}`, origin, token, mount),
  };
}

async function publicPlaytestLink(
  link: StoredPlaytestLink,
  origin: string,
  creatorId: string,
  secret: string,
  mount = "/",
): Promise<PlaytestLink> {
  const token = await signedShareToken(secret, creatorId, {
    project: link.projectId,
    room: link.sessionId,
    build: link.buildId,
    replay: link.replayId,
  });
  return {
    ...link,
    url: publicShareUrl(`/try/${link.projectId}`, origin, token, mount),
  };
}

function publicMutation<
  T extends { studioPath: string },
>(value: T, origin: string, mount = "/"): Omit<T, "studioPath"> & { studioUrl: string } {
  const { studioPath, ...rest } = value;
  return {
    ...rest,
    studioUrl: new URL(mountHref(studioPath, mount), origin).toString(),
  };
}

function reconstructActions(
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

function reconstructSession(
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

function reconstructReplay(
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

async function publicJob(
  job: CreatorJob,
  origin: string,
  creatorId?: string,
  secret?: string,
  mount = "/",
): Promise<CreatorJob> {
  if (!job.result) return job;
  if (job.kind === "compile-build" && job.result.build) {
    const build = await publicBuild(
      job.result.build as unknown as StoredPlayableBuild,
      origin,
      creatorId,
      secret,
      mount,
    );
    return {
      ...job,
      result: {
        ...job.result,
        build,
        warnings: build.warnings,
        studioUrl: new URL(
          `/studio/${job.projectId}`,
          origin,
        ).toString(),
      },
    };
  }
  if (
    job.kind === "generate-rule-system" &&
    typeof job.result.studioPath === "string"
  ) {
    const { studioPath, ...result } = job.result;
    return {
      ...job,
      result: {
        ...result,
        studioUrl: new URL(studioPath, origin).toString(),
      },
    };
  }
  if (job.kind === "bot-playtest") {
    const token = creatorId && secret
      ? await signedShareToken(secret, creatorId, {
          replay: String(job.result.replayId),
        })
      : null;
    return {
      ...job,
      result: {
        ...job.result,
        replayUrl: token
          ? publicShareUrl(`/replay/${String(job.result.replayId)}`, origin, token, mount)
          : new URL(mountHref(`/replay/${String(job.result.replayId)}`, mount), origin).toString(),
      },
    };
  }
  if (job.kind === "render-preview") {
    return {
      ...job,
      result: {
        ...job.result,
        previewUrl: new URL(
          `/play/${String(job.result.buildId)}`,
          origin,
        ).toString(),
      },
    };
  }
  return {
    ...job,
    result: {
      ...job.result,
      artifactUrl: new URL(`/api/jobs/${job.id}/artifact`, origin).toString(),
    },
  };
}

export class CreatorProjects extends DurableObject<Env> {
  private broadcastSession(session: StoredSharedSession) {
    const message = JSON.stringify({
      type: "session.snapshot",
      session: visibleSession(session),
    } satisfies SharedSessionSnapshotEvent);
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = socket.deserializeAttachment() as
        | SessionSocketAttachment
        | null;
      if (
        attachment?.sessionId === session.id &&
        socket.readyState === WebSocket.OPEN
      ) {
        try {
          socket.send(message);
        } catch {
          try {
            socket.close(1011, "session_broadcast_failed");
          } catch {
            // The durable mutation already succeeded; the browser reconnects.
          }
        }
      }
    }
  }

  private async saveJob(job: CreatorJob, input?: SubmitJobInput) {
    const projectKey = `${PROJECT_PREFIX}${job.projectId}`;
    const stored =
      await this.ctx.storage.get<ProjectRecord>(projectKey);
    const values: Record<string, unknown> = {
      [`job:${job.id}`]: job,
      [`job-idempotency:${job.projectId}:${job.idempotencyKey}`]: job,
    };
    if (input) values[`job-input:${job.id}`] = input;
    if (stored) {
      const record = normalizedProjectRecord(stored);
      record.jobs = [
        job,
        ...record.jobs.filter((candidate) => candidate.id !== job.id),
      ];
      values[projectKey] = record;
    }
    await this.ctx.storage.put(values);
  }

  private async schedulePendingJobRecovery() {
    const jobs = await this.ctx.storage.list<CreatorJob>({ prefix: "job:" });
    const pending = [...jobs.values()].some(
      (job) => job.status === "queued" || job.status === "running",
    );
    if (pending) {
      await this.ctx.storage.setAlarm(Date.now() + 30_000);
    } else {
      await this.ctx.storage.deleteAlarm();
    }
  }

  private async runJob(jobId: string, submittedInput?: SubmitJobInput) {
    let job = await this.ctx.storage.get<CreatorJob>(`job:${jobId}`);
    if (!job || job.status === "succeeded" || job.status === "failed") return;
    if (
      job.status === "running" &&
      Date.now() - Date.parse(job.updatedAt) < 25_000
    ) {
      return;
    }
    const input =
      submittedInput ??
      await this.ctx.storage.get<SubmitJobInput>(`job-input:${jobId}`);
    if (!input) {
      job = {
        ...job,
        status: "failed",
        error: "job_input_missing",
        updatedAt: new Date().toISOString(),
      };
      await this.saveJob(job);
      await this.schedulePendingJobRecovery();
      return;
    }
    job = { ...job, status: "running", updatedAt: new Date().toISOString() };
    await this.saveJob(job);
    await this.ctx.storage.setAlarm(Date.now() + 30_000);

    try {
      let operation: Response;
      let generationRuntimeConfigured = false;
      let proposedRuntime: RuntimeConfigureOperation | null = null;
      if (input.kind === "generate-rule-system") {
        const pendingPlan = await this.ctx.storage.get<GenerationPlan>(
          generationPlanKey(job.projectId),
        );
        if (pendingPlan?.status === "pending") {
          throw new Error("generation_plan_pending");
        }
        const sourceId = `source_${job.id}`;
        const sourceContent = input.sourceContent?.trim() || "";
        const idea = input.idea?.trim() || sourceContent;
        const authoredMaterial = sourceContent || idea;
        const visualInputs = input.visualInputs ?? [];
        const imageSources = visualInputs.map((image, index) => ({
          id: `${sourceId}_image_${index + 1}`,
          name: image.name.trim(),
          content: image.content,
          imageUse: image.imageUse,
          locator: `${input.sourceName?.trim() || "visual material"} ${sourceContent ? "page" : "item"} ${image.pageNumber}`,
        }));
        const firstProjectAsset = imageSources.find(
          (image) => image.imageUse === "project-asset",
        );
        const materialized = materializeRuleSystem({
          name: input.name?.trim() || "生成的游戏版本",
          description: idea,
          sourceText: authoredMaterial,
          sourceId,
          image: firstProjectAsset
            ? {
                sourceId: firstProjectAsset.id,
                url: firstProjectAsset.content,
                alt: firstProjectAsset.name,
              }
            : undefined,
          playerCount: input.participants?.default,
          durationMinutes: input.durationMinutes,
        });
        const generated = input.participants
          ? { ...materialized, participants: structuredClone(input.participants) }
          : materialized;
        const generatedRuleSystem = generated;
        const sourceRuntimeActions = generatedRuleSystem.actions
          .flatMap((action) => {
            const value = inferredNumber(
              action.description,
              [/([0-9一二两三四五六七八九十]+)\s*(?:points?|分|点|进度)/i],
              Number.NaN,
            );
            return Number.isInteger(value) && value > 0
              ? [{ id: action.id, label: action.label, value }]
              : [];
        });
        const sharedGoal = isSharedGoalDescription(authoredMaterial);
        const turnTaking = isTurnTakingDescription(authoredMaterial);
        const takeAwayRule = inferredTakeAwayRule(authoredMaterial);
        const rollAndMoveRule = inferredRollAndMoveRule(authoredMaterial);
        const drawAndScoreRule = inferredDrawAndScoreRule(authoredMaterial);
        const pushYourLuckRule = inferredPushYourLuckRule(authoredMaterial);
        const victoryTarget = inferredNumber(
          authoredMaterial,
          [
            /(?:first|率先|先).{0,40}?([0-9一二两三四五六七八九十]+)\s*(?:points?|分)/i,
            /(?:reach|score|earn|win with|victory target|winning score).{0,40}?([0-9一二两三四五六七八九十]+)\s*(?:points?|分)/i,
            /(?:达到|获得|胜利目标|目标).{0,20}?([0-9一二两三四五六七八九十]+)\s*(?:points?|分)/i,
          ],
          Number.NaN,
        );
        const goalTarget = inferredSharedGoalTarget(authoredMaterial);
        const inferredTurnLimit = inferredNumber(
          authoredMaterial,
          [/([0-9一二两三四五六七八九十]+)\s*(?:turns?|rounds?|回合|轮)/i],
          Number.NaN,
        );
        const maxTurns = Number.isInteger(inferredTurnLimit) && inferredTurnLimit > 0
          ? inferredTurnLimit
          : Math.max(12, generatedRuleSystem.participants.default * 6);
        const rollMaxTurns = Number.isInteger(inferredTurnLimit) && inferredTurnLimit > 0
          ? inferredTurnLimit
          : Math.min(
            1_000,
            Math.max(
              50,
              (rollAndMoveRule?.targetPosition ?? 0) *
                generatedRuleSystem.participants.default * 2,
            ),
          );
        const scoreRaceRuntimeConfigured =
          !sharedGoal &&
          sourceRuntimeActions.length > 0 &&
          sourceRuntimeActions.length === generatedRuleSystem.actions.length &&
          generatedRuleSystem.actions.length <= 12 &&
          Number.isInteger(victoryTarget) &&
          victoryTarget > 0;
        const sharedGoalRuntimeConfigured =
          sharedGoal &&
          sourceRuntimeActions.length > 0 &&
          sourceRuntimeActions.length === generatedRuleSystem.actions.length &&
          generatedRuleSystem.actions.length <= 12 &&
          Number.isInteger(goalTarget) &&
          goalTarget > 0;
        const takeAwayRuntimeConfigured =
          takeAwayRule !== null &&
          generatedRuleSystem.actions.length === takeAwayRule.takes.length &&
          generatedRuleSystem.actions.length <= 12;
        const rollAndMoveRuntimeConfigured =
          rollAndMoveRule !== null &&
          generatedRuleSystem.actions.length === 1;
        const drawAndScoreRuntimeConfigured =
          drawAndScoreRule !== null &&
          generatedRuleSystem.actions.length === 1;
        const pushYourLuckRuntimeConfigured =
          pushYourLuckRule !== null &&
          generatedRuleSystem.actions.length === 2 &&
          generatedRuleSystem.actions.some((action) => action.id === "roll") &&
          generatedRuleSystem.actions.some((action) => action.id === "bank");
        const turnTakingRuntimeConfigured =
          !sharedGoal &&
          !scoreRaceRuntimeConfigured &&
          !takeAwayRuntimeConfigured &&
          !rollAndMoveRuntimeConfigured &&
          !drawAndScoreRuntimeConfigured &&
          !pushYourLuckRuntimeConfigured &&
          turnTaking &&
          sourceRuntimeActions.length === 0 &&
          generatedRuleSystem.actions.length > 0 &&
          generatedRuleSystem.actions.length <= 12;
        generationRuntimeConfigured =
          scoreRaceRuntimeConfigured ||
          sharedGoalRuntimeConfigured ||
          takeAwayRuntimeConfigured ||
          rollAndMoveRuntimeConfigured ||
          drawAndScoreRuntimeConfigured ||
          pushYourLuckRuntimeConfigured ||
          turnTakingRuntimeConfigured;
        const pushMaxActions = Math.min(10_000, Math.max(
          200,
          (pushYourLuckRule?.victoryTarget ?? 0) * generatedRuleSystem.participants.default * 5,
        ));
        const runtimeOperation = pushYourLuckRuntimeConfigured
          ? {
              op: "configure_push_your_luck" as const,
              config: {
                dieSides: pushYourLuckRule!.dieSides,
                bustFace: pushYourLuckRule!.bustFace,
                victoryTarget: pushYourLuckRule!.victoryTarget,
                maxActions: pushMaxActions,
                actions: generatedRuleSystem.actions.map((action) => ({
                  id: action.id as "roll" | "bank",
                  label: action.label,
                })),
                unsupported: [
                  "push-your-luck-v1 executes only repeated seeded rolls, one bust face, unbanked turn score, voluntary banking, round-robin turns, and first-to-target victory; other source behavior remains unsupported.",
                  `The source did not specify an action limit; push-your-luck-v1 uses a visible ${pushMaxActions}-action safety limit without inventing a winner.`,
                ],
              },
            }
          : drawAndScoreRuntimeConfigured
          ? {
              op: "configure_draw_and_score" as const,
              config: {
                cardValues: drawAndScoreRule!.cardValues,
                copiesPerValue: drawAndScoreRule!.copiesPerValue,
                victoryTarget: drawAndScoreRule!.victoryTarget,
                actions: generatedRuleSystem.actions.map((action) => ({
                  id: action.id,
                  label: action.label,
                })),
                unsupported: [
                  "draw-and-score-v1 executes only deterministic shuffle, top-card draw without replacement, score by card value, first-to-target victory, and highest-score deck exhaustion; other source behavior remains unsupported.",
                ],
              },
            }
          : rollAndMoveRuntimeConfigured
          ? {
              op: "configure_roll_and_move" as const,
              config: {
                dieSides: rollAndMoveRule!.dieSides,
                targetPosition: rollAndMoveRule!.targetPosition,
                maxTurns: rollMaxTurns,
                actions: generatedRuleSystem.actions.map((action) => ({
                  id: action.id,
                  label: action.label,
                })),
                unsupported: [
                  "roll-and-move-v1 executes only the explicit die, movement by roll, round-robin turns, and first-to-target victory condition; other source behavior remains unsupported.",
                  ...(Number.isInteger(inferredTurnLimit) && inferredTurnLimit > 0
                    ? []
                    : [`The source did not specify a turn limit; roll-and-move-v1 uses a visible ${rollMaxTurns}-turn safety limit without inventing a winner.`]),
                ],
              },
            }
          : takeAwayRuntimeConfigured
          ? {
              op: "configure_take_away" as const,
              config: {
                initialPool: takeAwayRule!.initialPool,
                actions: generatedRuleSystem.actions.map((action, index) => ({
                  id: action.id,
                  label: action.label,
                  take: takeAwayRule!.takes[index],
                })),
                unsupported: [
                  "take-away-v1 executes only the explicit shared pool, legal take amounts, turn order, and last-taken-wins condition; other source behavior remains unsupported.",
                ],
              },
            }
          : sharedGoalRuntimeConfigured
          ? {
              op: "configure_shared_goal" as const,
              config: {
                goalTarget,
                maxTurns,
                actions: sourceRuntimeActions.map((action) => ({
                  id: action.id,
                  label: action.label,
                  progress: action.value,
                })),
                unsupported: [
                  "shared-goal-v1 only executes the source's explicit shared progress actions and goal target; other rule behavior remains unsupported.",
                ],
              },
            }
          : scoreRaceRuntimeConfigured
            ? {
                op: "configure_score_race" as const,
                config: {
                  victoryTarget,
                  maxTurns,
                  actions: sourceRuntimeActions.map((action) => ({
                    id: action.id,
                    label: action.label,
                    points: action.value,
                  })),
                  unsupported: [
                    "score-race-v1 only executes the source's explicit point actions and victory target; other rule behavior remains unsupported.",
                  ],
                },
              }
            : turnTakingRuntimeConfigured
              ? {
                  op: "configure_turn_taking" as const,
                  config: {
                    maxTurns,
                    actions: generatedRuleSystem.actions.map((action) => ({
                      id: action.id,
                      label: action.label,
                    })),
                    unsupported: [
                      "turn-taking-v1 only executes explicit turn-taking actions until the turn limit; it does not infer winners, scores, resources, or other rule resolution.",
                      ...(Number.isInteger(inferredTurnLimit) && inferredTurnLimit > 0
                        ? []
                        : [`The source did not specify a turn limit; turn-taking-v1 uses a conservative ${maxTurns}-turn prototype limit.`]),
                    ],
                  },
                }
              : null;
        proposedRuntime = runtimeOperation;
        operation = await this.fetch(
          new Request(
            `https://projects.internal/projects/${job.projectId}/changes`,
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                expectedVersion: input.expectedVersion,
                idempotencyKey: `job:${input.idempotencyKey}`,
                operations: [
                  {
                    op: "add_source",
                    source: {
                      id: sourceId,
                      kind: input.sourceKind || "brief",
                      name: input.sourceName?.trim() || `${input.name?.trim() || "生成任务"} brief`,
                      content: authoredMaterial,
                      provenance: {
                        origin: input.sourceKind === "rulebook" ? "creator-upload" : "creator-authored",
                        locator: `generation job ${job.id}`,
                      },
                    },
                  },
                  ...imageSources.map((image) => ({
                    op: "add_source" as const,
                    source: {
                      id: image.id,
                      kind: "image" as const,
                      imageUse: image.imageUse,
                      name: image.name,
                      content: image.content,
                      provenance: {
                        origin: "creator-upload" as const,
                        locator: image.locator,
                      },
                    },
                  })),
                  {
                    op: "update_rule_system",
                    fields: generatedRuleSystem,
                  },
                ],
              }),
            },
          ),
        );
      } else if (input.kind === "iterate-rule-system") {
        const stored = await this.ctx.storage.get<ProjectRecord>(
          `${PROJECT_PREFIX}${job.projectId}`,
        );
        if (!stored) throw new Error("project_not_found");
        const record = normalizedProjectRecord(stored);
        const generationPlan = await this.ctx.storage.get<GenerationPlan>(
          generationPlanKey(job.projectId),
        );
        if (generationPlan?.status === "pending") {
          throw new Error("generation_plan_pending");
        }
        if (
          input.basedOnFindingId &&
          !record.findings.some((finding) => finding.id === input.basedOnFindingId)
        ) {
          throw new Error("finding_not_found");
        }
        const plan = createActionDescriptionIterationPlan({
          ruleSystem: record.ruleSystem,
          prompt: input.prompt,
          sourceId: `source_${job.id}`,
        });
        operation = await this.fetch(
          new Request(
            `https://projects.internal/projects/${job.projectId}/changes`,
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                expectedVersion: input.expectedVersion,
                idempotencyKey: `job:${input.idempotencyKey}`,
                operations: plan.operations,
              }),
            },
          ),
        );
        if (operation.ok) {
          const operationBody = await operation.clone().json<Record<string, unknown>>();
          operationBody.iteration = {
            prompt: plan.prompt,
            summary: plan.summary,
            actionId: plan.actionId,
            actionLabel: plan.actionLabel,
            sourceId: plan.sourceId,
            ...(input.basedOnFindingId
              ? { basedOnFindingId: input.basedOnFindingId }
              : {}),
          };
          operation = new Response(JSON.stringify(operationBody), {
            status: operation.status,
            headers: { "content-type": "application/json" },
          });
        }
      } else if (input.kind === "compile-build") {
        operation = await this.fetch(
          new Request(
            `https://projects.internal/projects/${job.projectId}/builds`,
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                expectedVersion: input.expectedVersion,
                basedOnFindingId: input.basedOnFindingId,
                idempotencyKey: `job:${input.idempotencyKey}`,
              }),
            },
          ),
        );
      } else if (input.kind === "bot-playtest") {
        operation = await this.fetch(
          new Request(
            `https://projects.internal/builds/${input.buildId}/playtests`,
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                seed: input.seed,
                idempotencyKey: `job:${input.idempotencyKey}`,
              }),
            },
          ),
        );
      } else {
        const storedBuild = await this.ctx.storage.get<StoredPlayableBuild>(
          `build:${input.buildId}`,
        );
        const build = storedBuild ? normalizedBuild(storedBuild) : undefined;
        operation =
          build && build.projectId === job.projectId
            ? json({ buildId: build.id })
            : error("build_not_found", 404);
      }
      const operationBody = await operation.json<Record<string, unknown>>();
      if (operation.ok && input.kind === "generate-rule-system") {
        const generatedRuleSystem = operationBody.ruleSystem as RuleSystem | undefined;
        const generatedSources = operationBody.sources as SourceLibraryEntry[] | undefined;
        if (!generatedRuleSystem || !Array.isArray(generatedSources)) {
          throw new Error("generation_plan_materialization_missing");
        }
        const generationPlan = createGenerationPlan({
          id: `generation_plan_${job.id}`,
          projectId: job.projectId,
          generationJobId: job.id,
          ruleSystem: generatedRuleSystem,
          sourceIds: generatedSources.map((source) => source.id),
          proposedRuntime: proposedRuntime ?? undefined,
          createdAt: new Date().toISOString(),
        });
        await this.ctx.storage.put(
          generationPlanKey(job.projectId),
          generationPlan,
        );
        operationBody.generationPlan = generationPlan;
        operationBody.generationMode = "deterministic-rule-system-materialization";
        operationBody.warnings = [generationRuntimeConfigured
          ? proposedRuntime?.op === "configure_roll_and_move"
            ? "规则结构来自确定性文本抽取；骰子面数、按点数前进与先到终点获胜将在批准 Generation Plan 后配置为可复现的 roll-and-move-v1。"
            : proposedRuntime?.op === "configure_push_your_luck"
            ? "规则结构来自确定性文本抽取；继续掷、爆掉、未存分、收手存分与目标胜利将在批准 Generation Plan 后配置为 push-your-luck-v1。"
            : proposedRuntime?.op === "configure_draw_and_score"
            ? "规则结构来自确定性文本抽取；有限牌库、确定性洗牌、抽牌计分与牌库耗尽结算将在批准 Generation Plan 后配置为 draw-and-score-v1。"
            : proposedRuntime?.op === "configure_take_away"
            ? "规则结构来自确定性文本抽取；共享池、合法拿取数量与拿完获胜条件将在批准 Generation Plan 后配置为 take-away-v1。"
            : proposedRuntime?.op === "configure_shared_goal"
            ? "规则结构来自确定性文本抽取；仅来源中明确写出的共享推进行动与目标将在批准 Generation Plan 后配置为 shared-goal-v1。"
            : proposedRuntime?.op === "configure_score_race"
              ? "规则结构来自确定性文本抽取；仅来源中明确写出的计分行动与胜利目标将在批准 Generation Plan 后配置为 score-race-v1。"
              : "规则结构来自确定性文本抽取；来源明确写出的轮流行动将在批准 Generation Plan 后配置为 turn-taking-v1，回合上限来自来源或可见的保守原型默认值。"
          : generatedRuleSystem.actions.length > 12
            ? "来源识别出超过 Kernel 上限的行动；为避免静默丢弃规则，Rule System 保持 draft，等待创作者明确缩减或配置 Executable Kernel。"
            : "规则结构来自确定性文本抽取；来源不足以证明可执行语义，Rule System 保持 draft，等待显式配置 Executable Kernel。"];
      }
      job = operation.ok
        ? {
            ...job,
            status: "succeeded",
            result: operationBody,
            updatedAt: new Date().toISOString(),
          }
        : {
            ...job,
            status: "failed",
            error: String(operationBody.error ?? `http_${operation.status}`),
            updatedAt: new Date().toISOString(),
          };
    } catch (reason) {
      job = {
        ...job,
        status: "failed",
        error: reason instanceof Error ? reason.message : "job_failed",
        updatedAt: new Date().toISOString(),
      };
    }
    await this.saveJob(job);
    await this.schedulePendingJobRecovery();
  }

  async alarm() {
    const jobs = await this.ctx.storage.list<CreatorJob>({ prefix: "job:" });
    for (const job of [...jobs.values()].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt)
    )) {
      if (job.status === "queued" || job.status === "running") {
        await this.runJob(job.id);
      }
    }
    await this.schedulePendingJobRecovery();
  }

  async fetch(request: Request) {
    const url = new URL(request.url);

    const roomEventsMatch = url.pathname.match(/^\/sessions\/([^/]+)\/events$/);
    if (request.method === "GET" && roomEventsMatch) {
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
        return error("Shared Session 实时连接需要 WebSocket upgrade。", 426);
      }
      const room = await this.ctx.storage.get<StoredSharedSession>(
        `session:${roomEventsMatch[1]}`,
      );
      if (!room) return error("没有找到这个 Shared Session。", 404);
      const storedBuild = await this.ctx.storage.get<StoredPlayableBuild>(
        `build:${room.buildId}`,
      );
      const build = storedBuild ? normalizedBuild(storedBuild) : undefined;
      if (!build) return error("Shared Session 引用的 Build 不存在。", 500);

      const [client, server] = Object.values(new WebSocketPair());
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({
        sessionId: room.id,
      } satisfies SessionSocketAttachment);
      return new Response(null, { status: 101, webSocket: client });
    }

    if (request.method === "POST" && url.pathname === "/projects") {
      const input = await request.json<{
        name?: unknown;
        authentication?: unknown;
        templateId?: unknown;
      }>();
      if (typeof input.name !== "string" || !input.name.trim()) {
        return error("项目名称不能为空。", 400);
      }
      if (input.templateId !== undefined && !isDefaultExampleId(input.templateId)) {
        return error("没有这个默认案例。", 400);
      }

      const now = new Date().toISOString();
      const projectId = `project_${crypto.randomUUID()}`;
      const ruleSystemId = `rule_system_${crypto.randomUUID()}`;
      const project: GameProject = {
        id: projectId,
        name: input.name.trim().slice(0, 80),
        version: 1,
        activeRuleSystemId: ruleSystemId,
        createdAt: now,
        updatedAt: now,
        capabilities: {
          authentication:
            input.authentication === "oauth"
              ? "oauth"
              : "local-development-only",
          compilation: "available",
          persistence: "durable-object",
        },
      };
      const example = input.templateId
        ? instantiateDefaultExample(input.templateId, ruleSystemId, now)
        : undefined;
      const ruleSystem = example?.ruleSystem ?? initialRuleSystem(ruleSystemId);
      const record: ProjectRecord = {
        project,
        ruleSystem,
        ruleSystems: [ruleSystem],
        sources: example?.sources ?? [],
        changesets: [],
        builds: [],
        playtests: [],
        sessions: [],
        jobs: [],
        hypotheses: [],
        findings: [],
      };
      await this.ctx.storage.put(`${PROJECT_PREFIX}${project.id}`, record);
      return json(project, 201);
    }

    const duplicateMatch = url.pathname.match(/^\/projects\/([^/]+)\/duplicate$/);
    if (request.method === "POST" && duplicateMatch) {
      const input = await request.json<{
        expectedVersion?: unknown;
        idempotencyKey?: unknown;
        name?: unknown;
      }>().catch(() => ({
        expectedVersion: undefined,
        idempotencyKey: undefined,
        name: undefined,
      }));
      if (
        !Number.isInteger(input.expectedVersion) ||
        typeof input.idempotencyKey !== "string" ||
        !input.idempotencyKey ||
        typeof input.name !== "string" ||
        !input.name.trim()
      ) {
        return error("复制请求无效。", 400);
      }
      const sourceKey = `${PROJECT_PREFIX}${duplicateMatch[1]}`;
      const idempotencyKey =
        `idempotency:${duplicateMatch[1]}:${input.idempotencyKey}`;
      const outcome = await this.ctx.storage.transaction(async (transaction) => {
        const existing = await transaction.get<GameProject>(idempotencyKey);
        if (existing) return { status: 201, value: existing };
        const stored =
          await transaction.get<ProjectRecord>(sourceKey);
        if (!stored) {
          return { status: 404, value: { error: "project_not_found" } };
        }
        const source = normalizedProjectRecord(stored);
        if (source.project.version !== input.expectedVersion) {
          return {
            status: 409,
            value: {
              error: "version_conflict",
              currentVersion: source.project.version,
              affectedEntities: [`project:${source.project.id}`],
              currentState: {
                project: source.project,
                ruleSystem: source.ruleSystem,
              },
            },
          };
        }
        const now = new Date().toISOString();
        const projectId = `project_${crypto.randomUUID()}`;
        const ruleSystemId = `rule_system_${crypto.randomUUID()}`;
        const project: GameProject = {
          ...source.project,
          id: projectId,
          name: String(input.name).trim().slice(0, 80),
          version: 1,
          activeRuleSystemId: ruleSystemId,
          createdAt: now,
          updatedAt: now,
        };
        const record: ProjectRecord = {
          project,
          ruleSystem: {
            ...structuredClone(source.ruleSystem),
            id: ruleSystemId,
          },
          ruleSystems: [{
            ...structuredClone(source.ruleSystem),
            id: ruleSystemId,
          }],
          sources: structuredClone(source.sources),
          changesets: [],
          builds: [],
          playtests: [],
          sessions: [],
          jobs: [],
          hypotheses: structuredClone(source.hypotheses),
          findings: [],
        };
        await transaction.put({
          [`${PROJECT_PREFIX}${projectId}`]: record,
          [idempotencyKey]: project,
        });
        return { status: 201, value: project };
      });
      return json(outcome.value, outcome.status);
    }

    const duplicateRuleSystemMatch = url.pathname.match(
      /^\/projects\/([^/]+)\/rule-systems\/([^/]+)\/duplicate$/,
    );
    if (request.method === "POST" && duplicateRuleSystemMatch) {
      const input = await request.json<{
        expectedVersion?: unknown;
        idempotencyKey?: unknown;
        name?: unknown;
      }>().catch((): {
        expectedVersion?: unknown;
        idempotencyKey?: unknown;
        name?: unknown;
      } => ({}));
      if (
        !Number.isInteger(input.expectedVersion) ||
        typeof input.idempotencyKey !== "string" ||
        !input.idempotencyKey ||
        typeof input.name !== "string" ||
        !input.name.trim()
      ) {
        return error("Rule System 复制请求无效。", 400);
      }
      const projectId = duplicateRuleSystemMatch[1];
      const ruleSystemId = duplicateRuleSystemMatch[2];
      const ruleSystemName = input.name.trim().slice(0, 120);
      const projectKey = `${PROJECT_PREFIX}${projectId}`;
      const idempotencyKey =
        `rule-system-duplicate:${projectId}:${input.idempotencyKey}`;
      const outcome = await this.ctx.storage.transaction(async (transaction) => {
        const existing =
          await transaction.get<StoredDuplicateRuleSystemResult>(idempotencyKey);
        if (existing) return { status: 201, value: existing };
        const stored =
          await transaction.get<ProjectRecord>(projectKey);
        if (!stored) {
          return { status: 404, value: { error: "project_not_found" } };
        }
        const record = normalizedProjectRecord(stored);
        const generationPlan = await transaction.get<GenerationPlan>(
          generationPlanKey(projectId),
        );
        if (generationPlan?.status === "pending") {
          return {
            status: 409,
            value: {
              error: "generation_plan_pending",
              generationPlan,
            },
          };
        }
        const source = record.ruleSystems.find(
          (ruleSystem) => ruleSystem.id === ruleSystemId,
        );
        if (!source) {
          return { status: 404, value: { error: "rule_system_not_found" } };
        }
        if (record.project.version !== input.expectedVersion) {
          return {
            status: 409,
            value: {
              error: "version_conflict",
              currentVersion: record.project.version,
              affectedEntities: [`rule-system:${ruleSystemId}`],
              currentState: {
                project: record.project,
                ruleSystem: record.ruleSystem,
                ruleSystems: record.ruleSystems,
              },
            },
          };
        }
        const now = new Date().toISOString();
        const ruleSystem: RuleSystem = {
          ...structuredClone(source),
          id: `rule_system_${crypto.randomUUID()}`,
          version: 1,
          name: ruleSystemName,
        };
        const previousVersion = record.project.version;
        record.project = {
          ...record.project,
          activeRuleSystemId: ruleSystem.id,
          version: previousVersion + 1,
          updatedAt: now,
        };
        record.ruleSystem = ruleSystem;
        record.ruleSystems = [...record.ruleSystems, ruleSystem];
        const changeset: Changeset = {
          id: `changeset_${crypto.randomUUID()}`,
          previousVersion,
          newVersion: record.project.version,
          affectedEntities: [
            `rule-system:${ruleSystem.id}`,
            `active-rule-system:${ruleSystem.id}`,
          ],
          createdAt: now,
        };
        record.changesets.push(changeset);
        const result: StoredDuplicateRuleSystemResult = {
          project: record.project,
          ruleSystem,
          ruleSystems: record.ruleSystems,
          changeset,
          warnings: buildWarnings(record),
          studioPath: `/studio/${record.project.id}`,
        };
        await transaction.put({
          [projectKey]: record,
          [idempotencyKey]: result,
        });
        return { status: 201, value: result };
      });
      return json(outcome.value, outcome.status);
    }

    const restoreBuildMatch = url.pathname.match(
      /^\/projects\/([^/]+)\/builds\/([^/]+)\/restore$/,
    );
    if (request.method === "POST" && restoreBuildMatch) {
      const input = await request.json<{
        expectedVersion?: unknown;
        idempotencyKey?: unknown;
      }>().catch((): {
        expectedVersion?: unknown;
        idempotencyKey?: unknown;
      } => ({}));
      if (
        !Number.isInteger(input.expectedVersion) ||
        typeof input.idempotencyKey !== "string" ||
        !input.idempotencyKey
      ) {
        return error("Build 恢复请求无效。", 400);
      }
      const projectId = restoreBuildMatch[1];
      const sourceBuildId = restoreBuildMatch[2];
      const projectKey = `${PROJECT_PREFIX}${projectId}`;
      const idempotencyKey =
        `build-restore:${projectId}:${input.idempotencyKey}`;
      const outcome = await this.ctx.storage.transaction(async (transaction) => {
        const existing =
          await transaction.get<StoredRestoreBuildResult>(idempotencyKey);
        if (existing) return { status: 201, value: existing };
        const stored = await transaction.get<ProjectRecord>(projectKey);
        if (!stored) {
          return { status: 404, value: { error: "project_not_found" } };
        }
        const record = normalizedProjectRecord(stored);
        const generationPlan = await transaction.get<GenerationPlan>(
          generationPlanKey(projectId),
        );
        if (generationPlan?.status === "pending") {
          return {
            status: 409,
            value: { error: "generation_plan_pending", generationPlan },
          };
        }
        const sourceBuild = record.builds.find(
          (build) => build.id === sourceBuildId,
        );
        if (!sourceBuild) {
          return { status: 404, value: { error: "build_not_found" } };
        }
        if (record.project.version !== input.expectedVersion) {
          return {
            status: 409,
            value: {
              error: "version_conflict",
              currentVersion: record.project.version,
              affectedEntities: [`build:${sourceBuildId}`],
              currentState: {
                project: record.project,
                ruleSystem: record.ruleSystem,
                ruleSystems: record.ruleSystems,
              },
            },
          };
        }
        if (sameRuleSystemContent(record.ruleSystem, sourceBuild.ruleSystem)) {
          return {
            status: 409,
            value: { error: "build_already_active", buildId: sourceBuildId },
          };
        }
        const now = new Date().toISOString();
        const ruleSystem: RuleSystem = {
          ...structuredClone(sourceBuild.ruleSystem),
          id: `rule_system_${crypto.randomUUID()}`,
          version: 1,
          restoredFromBuildId: sourceBuildId,
        };
        const previousVersion = record.project.version;
        record.project = {
          ...record.project,
          activeRuleSystemId: ruleSystem.id,
          version: previousVersion + 1,
          updatedAt: now,
        };
        record.ruleSystem = ruleSystem;
        record.ruleSystems = [...record.ruleSystems, ruleSystem];
        const changeset: Changeset = {
          id: `changeset_${crypto.randomUUID()}`,
          previousVersion,
          newVersion: record.project.version,
          affectedEntities: [
            `build:${sourceBuildId}`,
            `rule-system:${ruleSystem.id}`,
            `active-rule-system:${ruleSystem.id}`,
          ],
          restoredFromBuildId: sourceBuildId,
          createdAt: now,
        };
        record.changesets.push(changeset);
        const result: StoredRestoreBuildResult = {
          project: record.project,
          ruleSystem,
          ruleSystems: record.ruleSystems,
          changeset,
          sourceBuildId,
          warnings: buildWarnings(record),
          studioPath: `/studio/${record.project.id}`,
        };
        await transaction.put({
          [projectKey]: record,
          [idempotencyKey]: result,
        });
        return { status: 201, value: result };
      });
      return json(outcome.value, outcome.status);
    }

    const deleteMatch = url.pathname.match(/^\/projects\/([^/]+)$/);
    if (request.method === "DELETE" && deleteMatch) {
      const input = await request.json<{
        expectedVersion?: unknown;
        confirmationProjectId?: unknown;
        idempotencyKey?: unknown;
      }>().catch(() => ({
        expectedVersion: undefined,
        confirmationProjectId: undefined,
        idempotencyKey: undefined,
      }));
      if (
        !Number.isInteger(input.expectedVersion) ||
        input.confirmationProjectId !== deleteMatch[1] ||
        typeof input.idempotencyKey !== "string" ||
        !input.idempotencyKey
      ) {
        return error("删除请求需要精确项目 ID、版本和幂等键。", 400);
      }
      const projectKey = `${PROJECT_PREFIX}${deleteMatch[1]}`;
      const deletionKey = `deletion:${deleteMatch[1]}:${input.idempotencyKey}`;
      const outcome = await this.ctx.storage.transaction(async (transaction) => {
        const deleted = await transaction.get<{ deletedProjectId: string }>(
          deletionKey,
        );
        if (deleted) return { status: 200, value: deleted };
        const stored =
          await transaction.get<ProjectRecord>(projectKey);
        if (!stored) {
          return { status: 404, value: { error: "project_not_found" } };
        }
        const record = normalizedProjectRecord(stored);
        if (record.project.version !== input.expectedVersion) {
          return {
            status: 409,
            value: {
              error: "version_conflict",
              currentVersion: record.project.version,
              affectedEntities: [`project:${record.project.id}`],
              currentState: {
                project: record.project,
                ruleSystem: record.ruleSystem,
              },
            },
          };
        }
        const idempotencyLists = await Promise.all([
          transaction.list({ prefix: `idempotency:${record.project.id}:` }),
          transaction.list({
            prefix: `rule-system-duplicate:${record.project.id}:`,
          }),
          transaction.list({
            prefix: `build-restore:${record.project.id}:`,
          }),
          ...record.builds.flatMap((build) => [
            transaction.list({ prefix: `playtest:${build.id}:` }),
            transaction.list({ prefix: `session:${build.id}:` }),
          ]),
        ]);
        await transaction.delete([
          projectKey,
          generationPlanKey(record.project.id),
          ...record.builds.map((build) => `build:${build.id}`),
          ...record.playtests.flatMap((playtest) => [
            `playtest:${playtest.id}`,
            `replay:${playtest.replayId}`,
          ]),
          ...record.sessions.flatMap((session) => [
            `session:${session.id}`,
            `replay:${session.replayId}`,
          ]),
          ...record.jobs.flatMap((job) => [
            `job:${job.id}`,
            `job-input:${job.id}`,
            `job-idempotency:${job.projectId}:${job.idempotencyKey}`,
          ]),
          ...idempotencyLists.flatMap((entries) => [...entries.keys()]),
        ]);
        const value = { deletedProjectId: record.project.id };
        await transaction.put(deletionKey, value);
        return { status: 200, value };
      });
      return json(outcome.value, outcome.status);
    }

    const changeMatch = url.pathname.match(/^\/projects\/([^/]+)\/changes$/);
    if (request.method === "POST" && changeMatch) {
      const input = await request.json().catch(() => undefined);
      if (!validChangeRequest(input)) {
        return error("变更请求无效。", 400);
      }

      const projectKey = `${PROJECT_PREFIX}${changeMatch[1]}`;
      const idempotencyKey = `idempotency:${changeMatch[1]}:${input.idempotencyKey}`;
      try {
        const outcome = await this.ctx.storage.transaction(async (transaction) => {
          const existingResult =
            await transaction.get<StoredApplyProjectChangesResult>(
              idempotencyKey,
            );
          if (existingResult) {
            return { status: 200, value: existingResult };
          }

          const stored =
            await transaction.get<ProjectRecord>(projectKey);
          if (!stored) {
            return { status: 404, value: { error: "project_not_found" } };
          }
          const record = normalizedProjectRecord(stored);
          if (record.project.version !== input.expectedVersion) {
            return {
              status: 409,
              value: {
                error: "version_conflict",
                currentVersion: record.project.version,
                affectedEntities: proposedAffectedEntities(
                  record.ruleSystem.id,
                  input.operations,
                ),
                currentState: {
                  project: record.project,
                  ruleSystem: record.ruleSystem,
                  sources: record.sources,
                  hypotheses: record.hypotheses,
                  findings: record.findings,
                },
              },
            };
          }

          let generationPlan = await transaction.get<GenerationPlan>(
            generationPlanKey(record.project.id),
          ) ?? null;
          const pendingGenerationPlan = generationPlan?.status === "pending";
          const approvesGenerationPlan = input.operations.some(
            (operation) => operation.op === "approve_generation_plan",
          );
          const changesGenerationCandidate = input.operations.some(
            (operation) =>
              operation.op === "update_rule_system" ||
              operation.op === "configure_score_race" ||
              operation.op === "configure_shared_goal" ||
              operation.op === "configure_turn_taking" ||
              operation.op === "configure_take_away" ||
              operation.op === "configure_roll_and_move" ||
              operation.op === "configure_draw_and_score" ||
              operation.op === "configure_push_your_luck" ||
              operation.op === "configure_harbor_voyage",
          );
          const affectedEntities: string[] = [];
          const now = new Date().toISOString();
          let publishedPlaytestLink: StoredPlaytestLink | undefined;
          for (const operation of input.operations) {
            if (pendingGenerationPlan && operation.op === "activate_rule_system") {
              throw new Error("generation_plan_pending");
            }
            if (operation.op === "approve_generation_plan") {
              if (
                !generationPlan ||
                generationPlan.id !== operation.planId ||
                generationPlan.status !== "pending" ||
                generationPlan.ruleSystemId !== record.ruleSystem.id
              ) {
                throw new Error("invalid_generation_plan");
              }
              generationPlan = {
                ...generationPlan,
                status: "approved",
                approvedAt: now,
              };
              if (
                generationPlan.proposedRuntime &&
                record.ruleSystem.runtimeSupport.status === "draft"
              ) {
                applyOperation(record, generationPlan.proposedRuntime, affectedEntities);
              }
              affectedEntities.push(`generation-plan:${generationPlan.id}`);
            } else if (operation.op === "publish_shared_session") {
              const session = record.sessions.find(
                (candidate) => candidate.id === operation.sessionId,
              );
              const build = session
                ? record.builds.find((candidate) => candidate.id === session.buildId)
                : undefined;
              if (
                !session ||
                !build ||
                build.presentationFloor.status !== "passed" ||
                build.ruleSystem.runtimeSupport.status !== "executable"
              ) {
                throw new Error("invalid_playtest_link");
              }
              publishedPlaytestLink = {
                projectId: record.project.id,
                sessionId: session.id,
                buildId: build.id,
                replayId: session.replayId,
                updatedAt: now,
              };
              affectedEntities.push(`playtest-link:${record.project.id}`);
            } else {
              applyOperation(record, operation, affectedEntities);
            }
          }
          if (
            pendingGenerationPlan &&
            record.ruleSystem.id !== generationPlan?.ruleSystemId
          ) {
            throw new Error("invalid_generation_plan");
          }
          if (changesGenerationCandidate) {
            record.ruleSystem = {
              ...record.ruleSystem,
              version: record.ruleSystem.version + 1,
            };
          }
          if (pendingGenerationPlan && generationPlan && changesGenerationCandidate) {
            const refreshedPlan = createGenerationPlan({
              id: generationPlan.id,
              projectId: generationPlan.projectId,
              generationJobId: generationPlan.generationJobId,
              ruleSystem: record.ruleSystem,
              sourceIds: [
                ...new Set([
                  ...generationPlan.sourceIds,
                  ...referencedSourceIds(record.ruleSystem, record.sources),
                ]),
              ],
              proposedRuntime: generationPlan.proposedRuntime,
              createdAt: generationPlan.createdAt,
            });
            generationPlan = {
              ...refreshedPlan,
              status: generationPlan.status,
              ...(generationPlan.approvedAt
                ? { approvedAt: generationPlan.approvedAt }
                : {}),
            };
          }
          if (approvesGenerationPlan && generationPlan) {
            generationPlan = {
              ...generationPlan,
              ruleSystemVersion: record.ruleSystem.version,
            };
          }
          record.ruleSystems = record.ruleSystems.map((ruleSystem) =>
            ruleSystem.id === record.ruleSystem.id
              ? record.ruleSystem
              : ruleSystem
          );
          const previousVersion = record.project.version;
          record.project = {
            ...record.project,
            version: previousVersion + 1,
            updatedAt: now,
          };
          const changeset: Changeset = {
            id: `changeset_${crypto.randomUUID()}`,
            previousVersion,
            newVersion: record.project.version,
            affectedEntities,
            createdAt: now,
          };
          record.changesets.push(changeset);
          const result: StoredApplyProjectChangesResult = {
            project: record.project,
            ruleSystem: record.ruleSystem,
            generationPlan,
            sources: record.sources,
            hypotheses: record.hypotheses,
            findings: record.findings,
            changeset,
            warnings: buildWarnings(record),
            studioPath: `/studio/${record.project.id}`,
          };
          await transaction.put({
            [projectKey]: record,
            [idempotencyKey]: result,
            ...(publishedPlaytestLink ? {
              [playtestLinkKey(record.project.id)]: publishedPlaytestLink,
            } : {}),
            ...(generationPlan ? {
              [generationPlanKey(record.project.id)]: generationPlan,
            } : {}),
          });
          return { status: 200, value: result };
        });
        return json(outcome.value, outcome.status);
      } catch (reason) {
        if (
          reason instanceof Error &&
          [
            "source_dependency_not_found",
            "bound_image_source_not_found",
            "visual_reference_not_bindable",
            "generation_plan_pending",
          ].includes(reason.message)
        ) {
          return error(reason.message, 409);
        }
        if (
          reason instanceof Error &&
          [
            "invalid_source",
            "invalid_rule_system",
            "invalid_runtime",
            "invalid_design_hypothesis",
            "invalid_validation_finding",
            "invalid_automated_evidence",
            "invalid_participant_feedback",
            "invalid_human_evidence",
            "invalid_validation_evidence",
            "invalid_generation_plan",
            "invalid_playtest_link",
            "unsupported_operation",
          ].includes(reason.message)
        ) {
          return error("变更内容无效。", 400);
        }
        throw reason;
      }
    }

    const submitJobMatch = url.pathname.match(/^\/projects\/([^/]+)\/jobs$/);
    if (request.method === "POST" && submitJobMatch) {
      const input: {
        kind?: unknown;
        expectedVersion?: unknown;
        basedOnFindingId?: unknown;
        buildId?: unknown;
        seed?: unknown;
        idea?: unknown;
        name?: unknown;
        participants?: unknown;
        durationMinutes?: unknown;
        sourceName?: unknown;
        sourceKind?: unknown;
        sourceContent?: unknown;
        visualInputs?: unknown;
        prompt?: unknown;
        idempotencyKey?: unknown;
      } = await request.json().catch(() => ({})) as {
        kind?: unknown;
        expectedVersion?: unknown;
        basedOnFindingId?: unknown;
        buildId?: unknown;
        seed?: unknown;
        idea?: unknown;
        name?: unknown;
        participants?: unknown;
        durationMinutes?: unknown;
        sourceName?: unknown;
        sourceKind?: unknown;
        sourceContent?: unknown;
        visualInputs?: unknown;
        prompt?: unknown;
        idempotencyKey?: unknown;
      };
      const projectId = submitJobMatch[1];
      const validKind = [
        "generate-rule-system",
        "iterate-rule-system",
        "compile-build",
        "bot-playtest",
        "render-preview",
        "export-build",
      ].includes(String(input.kind));
      const validBuildInput =
        input.kind === "bot-playtest" ||
        input.kind === "render-preview" ||
        input.kind === "export-build";
      if (
        !validKind ||
        typeof input.idempotencyKey !== "string" ||
        !input.idempotencyKey ||
        ((input.kind === "compile-build" ||
          input.kind === "generate-rule-system" ||
          input.kind === "iterate-rule-system") &&
          !Number.isInteger(input.expectedVersion)) ||
        (input.kind === "iterate-rule-system" &&
          (typeof input.prompt !== "string" ||
            !input.prompt.trim() ||
            input.prompt.length > 2_000)) ||
        (input.kind === "iterate-rule-system" &&
          input.basedOnFindingId !== undefined &&
          (typeof input.basedOnFindingId !== "string" ||
            !input.basedOnFindingId.trim())) ||
        (input.kind === "compile-build" &&
          input.basedOnFindingId !== undefined &&
          (typeof input.basedOnFindingId !== "string" ||
            !input.basedOnFindingId.trim())) ||
        (input.kind === "generate-rule-system" &&
          ((input.idea !== undefined &&
            (typeof input.idea !== "string" ||
              !input.idea.trim() ||
              input.idea.length > 100_000)) ||
            (input.sourceContent === undefined && input.idea === undefined) ||
            (input.name !== undefined &&
              (typeof input.name !== "string" || !input.name.trim())) ||
            (input.participants !== undefined &&
              (!input.participants ||
                typeof input.participants !== "object" ||
                !Number.isInteger((input.participants as { min?: unknown }).min) ||
                !Number.isInteger((input.participants as { max?: unknown }).max) ||
                !Number.isInteger((input.participants as { default?: unknown }).default) ||
                Number((input.participants as { min: number }).min) < 1 ||
                Number((input.participants as { max: number }).max) > 20 ||
                Number((input.participants as { min: number }).min) >
                  Number((input.participants as { default: number }).default) ||
                Number((input.participants as { default: number }).default) >
                  Number((input.participants as { max: number }).max) ||
                !Array.isArray((input.participants as { roles?: unknown }).roles))) ||
            (input.durationMinutes !== undefined &&
              (!Number.isInteger(input.durationMinutes) ||
                Number(input.durationMinutes) < 5 ||
                Number(input.durationMinutes) > 720)) ||
            (input.sourceName !== undefined && typeof input.sourceName !== "string") ||
            (input.sourceKind !== undefined && !["brief", "rulebook"].includes(String(input.sourceKind))) ||
            (input.sourceContent !== undefined &&
              (typeof input.sourceContent !== "string" ||
                !input.sourceContent.trim() ||
                input.sourceContent.length > 100_000)))) ||
        (input.visualInputs !== undefined &&
          (!Array.isArray(input.visualInputs) ||
            input.visualInputs.length > 8 ||
            input.visualInputs.some(
              (image) =>
                !image ||
                typeof image !== "object" ||
                typeof (image as { name?: unknown }).name !== "string" ||
                !(image as { name: string }).name.trim() ||
                typeof (image as { content?: unknown }).content !== "string" ||
                !/^data:image\/(?:png|jpe?g|webp);base64,/.test(
                  (image as { content: string }).content,
                ) ||
                (image as { content: string }).content.length > 100_000 ||
                !Number.isInteger((image as { pageNumber?: unknown }).pageNumber) ||
                Number((image as { pageNumber: number }).pageNumber) < 1 ||
                !["visual-reference", "project-asset"].includes(
                  String((image as { imageUse?: unknown }).imageUse),
                ),
            ))) ||
        (validBuildInput &&
          (typeof input.buildId !== "string" || !input.buildId)) ||
        (input.kind === "bot-playtest" && !Number.isInteger(input.seed))
      ) {
        return error("任务请求无效。", 400);
      }

      const projectKey = `${PROJECT_PREFIX}${projectId}`;
      const jobIdempotencyKey =
        `job-idempotency:${projectId}:${input.idempotencyKey}`;
      const acceptedInput = input as SubmitJobInput;
      const claim = await this.ctx.storage.transaction(async (transaction) => {
        const existing = await transaction.get<CreatorJob>(jobIdempotencyKey);
        if (existing) return { created: false as const, job: existing };
        const stored =
          await transaction.get<ProjectRecord>(projectKey);
        if (!stored) return { created: false as const, missing: true as const };
        const now = new Date().toISOString();
        const job: CreatorJob = {
          id: `job_${crypto.randomUUID()}`,
          projectId,
          kind: input.kind as CreatorJobKind,
          status: "queued",
          idempotencyKey: input.idempotencyKey as string,
          createdAt: now,
          updatedAt: now,
        };
        const record = normalizedProjectRecord(stored);
        record.jobs = [job, ...record.jobs.filter((candidate) => candidate.id !== job.id)];
        await transaction.put({
          [projectKey]: record,
          [`job:${job.id}`]: job,
          [jobIdempotencyKey]: job,
          [`job-input:${job.id}`]: acceptedInput,
        });
        return { created: true as const, job };
      });
      if ("missing" in claim) return error("没有找到这个 Game Project。", 404);
      if (!claim.created) {
        if (claim.job.status === "queued" || claim.job.status === "running") {
          await this.ctx.storage.setAlarm(Date.now() + 30_000);
          this.ctx.waitUntil(this.runJob(claim.job.id));
        }
        return json(claim.job, 202);
      }
      const job = claim.job;
      await this.ctx.storage.setAlarm(Date.now() + 30_000);
      this.ctx.waitUntil(this.runJob(job.id, acceptedInput));
      return json(job, 202);
    }

    const jobMatch = url.pathname.match(/^\/jobs\/([^/]+)$/);
    if (request.method === "GET" && jobMatch) {
      const job = await this.ctx.storage.get<CreatorJob>(`job:${jobMatch[1]}`);
      return job ? json(job) : error("没有找到这个任务。", 404);
    }

    const retryJobMatch = url.pathname.match(/^\/jobs\/([^/]+)\/retry$/);
    if (request.method === "POST" && retryJobMatch) {
      let job = await this.ctx.storage.get<CreatorJob>(
        `job:${retryJobMatch[1]}`,
      );
      if (!job) return error("没有找到这个任务。", 404);
      if (job.status === "succeeded") return json(job, 202);
      const input = await this.ctx.storage.get<SubmitJobInput>(
        `job-input:${job.id}`,
      );
      if (!input) return error("任务输入已丢失，不能安全重试。", 409);
      job = {
        ...job,
        status: "queued",
        result: undefined,
        error: undefined,
        updatedAt: new Date().toISOString(),
      };
      await this.saveJob(job, input);
      await this.ctx.storage.setAlarm(Date.now() + 30_000);
      this.ctx.waitUntil(this.runJob(job.id, input));
      return json(job, 202);
    }

    const jobArtifactMatch = url.pathname.match(/^\/jobs\/([^/]+)\/artifact$/);
    if (request.method === "GET" && jobArtifactMatch) {
      const job = await this.ctx.storage.get<CreatorJob>(
        `job:${jobArtifactMatch[1]}`,
      );
      if (
        !job ||
        job.kind !== "export-build" ||
        job.status !== "succeeded" ||
        typeof job.result?.buildId !== "string"
      ) {
        return error("导出物尚不可用。", 404);
      }
      const storedBuild = await this.ctx.storage.get<StoredPlayableBuild>(
        `build:${job.result.buildId}`,
      );
      const build = storedBuild ? normalizedBuild(storedBuild) : undefined;
      if (!build) return error("build_not_found", 404);
      return new Response(JSON.stringify(build, null, 2), {
        headers: {
          "content-disposition": `attachment; filename="${build.id}.godesk.json"`,
          "content-type": "application/json; charset=utf-8",
        },
      });
    }

    const compileMatch = url.pathname.match(/^\/projects\/([^/]+)\/builds$/);
    if (request.method === "POST" && compileMatch) {
      const input = await request.json().catch(() => undefined) as
        | Partial<CompileBuildInput>
        | undefined;
      if (
        !input ||
        !Number.isInteger(input.expectedVersion) ||
        typeof input.idempotencyKey !== "string" ||
        !input.idempotencyKey ||
        (input.basedOnFindingId !== undefined &&
          (typeof input.basedOnFindingId !== "string" ||
            !input.basedOnFindingId.trim()))
      ) {
        return error("编译请求无效。", 400);
      }

      const projectKey = `${PROJECT_PREFIX}${compileMatch[1]}`;
      const idempotencyKey =
        `idempotency:${compileMatch[1]}:${input.idempotencyKey}`;
      const outcome = await this.ctx.storage.transaction(async (transaction) => {
        const existingResult =
          await transaction.get<StoredCompileBuildResult>(idempotencyKey);
        if (existingResult) return { status: 201, value: existingResult };

        const stored =
          await transaction.get<ProjectRecord>(projectKey);
        if (!stored) {
          return { status: 404, value: { error: "project_not_found" } };
        }
        const record = normalizedProjectRecord(stored);
        if (record.project.version !== input.expectedVersion) {
          return {
            status: 409,
            value: {
              error: "version_conflict",
              currentVersion: record.project.version,
              affectedEntities: [`build:${record.ruleSystem.id}`],
              currentState: {
                project: record.project,
                ruleSystem: record.ruleSystem,
              },
            },
          };
        }
        const generationPlan = await transaction.get<GenerationPlan>(
          generationPlanKey(record.project.id),
        );
        if (generationPlan?.status === "pending") {
          return {
            status: 409,
            value: {
              error: "generation_plan_pending",
              generationPlan,
              currentState: {
                project: record.project,
                ruleSystem: record.ruleSystem,
              },
            },
          };
        }

        const basedOnFinding = input.basedOnFindingId
          ? record.findings.find((finding) => finding.id === input.basedOnFindingId)
          : undefined;
        const motivatingBuild = basedOnFinding
          ? record.builds.find((build) => build.id === basedOnFinding.buildId)
          : undefined;
        if (input.basedOnFindingId && (!basedOnFinding || !motivatingBuild)) {
          return {
            status: 409,
            value: {
              error: "finding_not_found",
              basedOnFindingId: input.basedOnFindingId,
            },
          };
        }
        if (
          motivatingBuild &&
          record.ruleSystem.version <= motivatingBuild.ruleSystemVersion
        ) {
          return {
            status: 409,
            value: {
              error: "finding_revision_missing",
              basedOnFindingId: basedOnFinding?.id,
              motivatingBuildId: motivatingBuild.id,
              currentRuleSystemVersion: record.ruleSystem.version,
            },
          };
        }

        const sourceIds = referencedSourceIds(record.ruleSystem, record.sources);
        const id = await buildId(
          record.project.id,
          record.ruleSystem.version,
          record.ruleSystem,
          sourceIds,
        );
        const existingBuild = record.builds.find(
          (candidate) => candidate.id === id,
        );
        if (existingBuild) {
          if (
            input.basedOnFindingId &&
            existingBuild.basedOnFindingId !== input.basedOnFindingId
          ) {
            return {
              status: 409,
              value: {
                error: "build_lineage_conflict",
                buildId: existingBuild.id,
                basedOnFindingId: input.basedOnFindingId,
              },
            };
          }
          const existingChangeset =
            [...record.changesets].reverse().find((changeset) =>
              changeset.affectedEntities.includes(`build:${id}`)
            ) ?? {
              id: `changeset_existing_${id}`,
              previousVersion: record.project.version,
              newVersion: record.project.version,
              affectedEntities: [`build:${id}`],
              createdAt: existingBuild.createdAt,
            };
          const result: StoredCompileBuildResult = {
            project: record.project,
            build: existingBuild,
            changeset: existingChangeset,
            warnings: existingBuild.warnings,
            studioPath: `/studio/${record.project.id}`,
          };
          await transaction.put(idempotencyKey, result);
          return { status: 200, value: result };
        }
        const now = new Date().toISOString();
        const build: StoredPlayableBuild = {
          id,
          projectId: record.project.id,
          ruleSystemId: record.ruleSystem.id,
          ruleSystemVersion: record.ruleSystem.version,
          ...(input.basedOnFindingId
            ? { basedOnFindingId: input.basedOnFindingId }
            : {}),
          ruleSystem: structuredClone(record.ruleSystem),
          sourceIds,
          warnings: buildWarnings(record),
          unsupportedBehavior: [
            ...record.ruleSystem.runtimeSupport.unsupported,
            ...(record.ruleSystem.runtimeSupport.status === "executable"
              ? []
              : ["rule-execution"]),
          ],
          presentationFloor: presentationFloor(record.ruleSystem),
          createdAt: now,
        };
        const previousVersion = record.project.version;
        record.project = {
          ...record.project,
          version: previousVersion + 1,
          updatedAt: now,
        };
        const changeset: Changeset = {
          id: `changeset_${crypto.randomUUID()}`,
          previousVersion,
          newVersion: record.project.version,
          affectedEntities: [`build:${build.id}`],
          ...(input.basedOnFindingId
            ? { basedOnFindingId: input.basedOnFindingId }
            : {}),
          createdAt: now,
        };
        record.changesets.push(changeset);
        if (!record.builds.some((candidate) => candidate.id === build.id)) {
          record.builds.push(build);
        }
        const result: StoredCompileBuildResult = {
          project: record.project,
          build,
          changeset,
          warnings: build.warnings,
          studioPath: `/studio/${record.project.id}`,
        };
        await transaction.put({
          [projectKey]: record,
          [`build:${build.id}`]: build,
          [idempotencyKey]: result,
        });
        return { status: 201, value: result };
      });
      return json(outcome.value, outcome.status);
    }

    const buildMatch = url.pathname.match(/^\/builds\/([^/]+)$/);
    if (request.method === "GET" && buildMatch) {
      const storedBuild = await this.ctx.storage.get<StoredPlayableBuild>(
        `build:${buildMatch[1]}`,
      );
      if (!storedBuild) return error("没有找到这个 Playable Build。", 404);
      try {
        return json(normalizedBuild(storedBuild));
      } catch (reason) {
        if (
          reason instanceof Error &&
          ["unsupported_rule_system_shape", "unsupported_build_shape"].includes(
            reason.message,
          )
        ) {
          return error("这个 Build 使用已删除的旧规则格式，请从当前 Rule System 重新编译。", 410);
        }
        throw reason;
      }
    }

    const playtestCreateMatch = url.pathname.match(
      /^\/builds\/([^/]+)\/playtests$/,
    );
    if (request.method === "POST" && playtestCreateMatch) {
      const input = await request.json<{
        seed?: unknown;
        idempotencyKey?: unknown;
      }>().catch(() => ({ seed: undefined, idempotencyKey: undefined }));
      if (
        !Number.isInteger(input.seed) ||
        typeof input.idempotencyKey !== "string" ||
        !input.idempotencyKey
      ) {
        return error("试玩请求需要整数 seed 和幂等键。", 400);
      }
      const idempotencyKey =
        `playtest:${playtestCreateMatch[1]}:${input.idempotencyKey}`;
      const outcome = await this.ctx.storage.transaction(async (transaction) => {
        const existing = await transaction.get<StoredPlaytest>(idempotencyKey);
        if (existing) return { status: 201, value: existing };
        const storedBuild = await transaction.get<StoredPlayableBuild>(
          `build:${playtestCreateMatch[1]}`,
        );
        const build = storedBuild ? normalizedBuild(storedBuild) : undefined;
        if (!build) {
          return { status: 404, value: { error: "build_not_found" } };
        }
        if (!executableRuntime(build.ruleSystem)) {
          return {
            status: 422,
            value: { error: "runtime_not_executable" },
          };
        }
        const simulation = runBotSimulation(
          build.ruleSystem,
          Number(input.seed),
        );
        const now = new Date().toISOString();
        const replayId = `replay_${crypto.randomUUID()}`;
        const playtest: StoredPlaytest = {
          id: `playtest_${crypto.randomUUID()}`,
          projectId: build.projectId,
          buildId: build.id,
          seed: Number(input.seed),
          evidenceType: "automated-bot-simulation",
          terminalStatus: simulation.terminalStatus,
          metrics: {
            turns: simulation.finalState.turn,
            winnerSeat: simulation.finalState.winnerSeat,
            finalScores: simulation.finalState.scores,
            ...(simulation.finalState.sharedGoal
              ? { sharedGoal: simulation.finalState.sharedGoal }
              : {}),
            ...(simulation.finalState.turnTaking
              ? {
                  turnTaking: {
                    turns: simulation.finalState.turn,
                    maxTurns: simulation.finalState.turnTaking.maxTurns,
                  },
                }
              : {}),
            ...(simulation.finalState.takeAway
              ? { takeAway: simulation.finalState.takeAway }
              : {}),
            ...(simulation.finalState.rollAndMove
              ? { rollAndMove: simulation.finalState.rollAndMove }
              : {}),
            ...(simulation.finalState.drawAndScore
              ? { drawAndScore: simulation.finalState.drawAndScore }
              : {}),
            ...(simulation.finalState.pushYourLuck
              ? { pushYourLuck: simulation.finalState.pushYourLuck }
              : {}),
          },
          replayId,
          createdAt: now,
        };
        const replay: StoredReplay = {
          id: replayId,
          projectId: build.projectId,
          buildId: build.id,
          seed: Number(input.seed),
          evidenceType: "automated-bot-simulation",
          initialState: simulation.initialState,
          acceptedActions: simulation.acceptedActions,
          finalState: simulation.finalState,
          createdAt: now,
        };
        const projectKey = `${PROJECT_PREFIX}${build.projectId}`;
        const storedProject =
          await transaction.get<ProjectRecord>(projectKey);
        if (!storedProject) {
          return { status: 404, value: { error: "project_not_found" } };
        }
        const record = normalizedProjectRecord(storedProject);
        record.playtests.push(playtest);
        await transaction.put({
          [projectKey]: record,
          [`playtest:${playtest.id}`]: playtest,
          [`replay:${replay.id}`]: replay,
          [idempotencyKey]: playtest,
        });
        return { status: 201, value: playtest };
      });
      return json(outcome.value, outcome.status);
    }

    const roomCreateMatch = url.pathname.match(/^\/builds\/([^/]+)\/sessions$/);
    if (request.method === "POST" && roomCreateMatch) {
      const input = await request.json<{
        seed?: unknown;
        idempotencyKey?: unknown;
        hypothesisId?: unknown;
      }>().catch(() => ({
        seed: undefined,
        idempotencyKey: undefined,
        hypothesisId: undefined,
      }));
      if (
        !Number.isInteger(input.seed) ||
        typeof input.idempotencyKey !== "string" ||
        !input.idempotencyKey ||
        (input.hypothesisId !== undefined &&
          (typeof input.hypothesisId !== "string" || !input.hypothesisId))
      ) {
        return error("Shared Session 请求需要整数 seed 和幂等键。", 400);
      }
      const idempotencyKey =
        `session:${roomCreateMatch[1]}:${input.idempotencyKey}`;
      const outcome = await this.ctx.storage.transaction(async (transaction) => {
        const existing = await transaction.get<StoredSharedSession>(idempotencyKey);
        if (existing) return { status: 201, value: existing };
        const storedBuild = await transaction.get<StoredPlayableBuild>(
          `build:${roomCreateMatch[1]}`,
        );
        const build = storedBuild ? normalizedBuild(storedBuild) : undefined;
        if (!build) {
          return { status: 404, value: { error: "build_not_found" } };
        }
        if (build.presentationFloor.status !== "passed") {
          return {
            status: 422,
            value: {
              error: "visual_floor_unmet",
              presentationFloor: build.presentationFloor,
            },
          };
        }
        if (!executableRuntime(build.ruleSystem)) {
          return {
            status: 422,
            value: { error: "runtime_not_executable" },
          };
        }
        const projectKey = `${PROJECT_PREFIX}${build.projectId}`;
        const storedProject = await transaction.get<ProjectRecord>(projectKey);
        if (!storedProject) {
          return { status: 404, value: { error: "project_not_found" } };
        }
        const record = normalizedProjectRecord(storedProject);
        const hypothesis = input.hypothesisId
          ? record.hypotheses.find(
            (candidate) => candidate.id === input.hypothesisId,
          )
          : undefined;
        if (input.hypothesisId && !hypothesis) {
          return { status: 404, value: { error: "hypothesis_not_found" } };
        }
        const now = new Date().toISOString();
        const replayId = `replay_${crypto.randomUUID()}`;
        const state = initialSessionState(
          build.ruleSystem,
          Number(input.seed),
        );
        const room: StoredSharedSession = {
          id: `room_${crypto.randomUUID()}`,
          projectId: build.projectId,
          buildId: build.id,
          seed: Number(input.seed),
          state,
          seats: [],
          acceptedActions: [],
          feedback: [],
          experiment: hypothesis
            ? {
                hypothesisId: hypothesis.id,
                question: hypothesis.question,
                successSignal: hypothesis.successSignal,
              }
            : null,
          replayId,
          createdAt: now,
        };
        const replay: StoredReplay = {
          id: replayId,
          projectId: build.projectId,
          buildId: build.id,
          seed: Number(input.seed),
          evidenceType: "session-action-log",
          initialState: state,
          acceptedActions: [],
          finalState: state,
          createdAt: now,
        };
        record.sessions.push(room);
        await transaction.put({
          [projectKey]: record,
          [`session:${room.id}`]: room,
          [`replay:${replay.id}`]: replay,
          [idempotencyKey]: room,
        });
        return { status: 201, value: room };
      });
      return json(outcome.value, outcome.status);
    }

    const roomSeatMatch = url.pathname.match(/^\/sessions\/([^/]+)\/seats$/);
    if (request.method === "POST" && roomSeatMatch) {
      const input = await request.json<{
        seat?: unknown;
        seatToken?: unknown;
        displayName?: unknown;
      }>().catch(() => ({
        seat: undefined,
        seatToken: undefined,
        displayName: undefined,
      }));
      const displayName = typeof input.displayName === "string"
        ? input.displayName.trim()
        : "";
      if (
        !Number.isInteger(input.seat) ||
        (input.seatToken !== undefined &&
          (typeof input.seatToken !== "string" || !input.seatToken || input.seatToken.length > 200)) ||
        displayName.length > 80
      ) {
        return error("入座请求无效。", 400);
      }
      const seat = input.seat as number;
      const existingToken = typeof input.seatToken === "string" && input.seatToken
        ? input.seatToken
        : "";
      const existingHash = existingToken ? await hashSeatToken(existingToken) : "";
      const roomKey = `session:${roomSeatMatch[1]}`;
      const outcome = await this.ctx.storage.transaction(async (transaction) => {
        const storedRoom = await transaction.get<StoredSharedSession>(roomKey);
        if (!storedRoom) {
          return { status: 404, value: { error: "room_not_found" } };
        }
        const room = storedRoom;
        if (seat < 0 || seat >= room.state.scores.length) {
          return { status: 409, value: { error: "seat_unavailable" } };
        }
        const claimed = room.seats.find((entry) => entry.seat === seat);
        if (claimed) {
          if (!existingHash || claimed.seatTokenHash !== existingHash) {
            return { status: 409, value: { error: "seat_claimed" } };
          }
          return { status: 200, value: { session: room, seatToken: existingToken } };
        }
        if (existingHash) {
          const other = otherSeatForHash(room.seats, seat, existingHash);
          if (other) {
            return {
              status: 409,
              value: {
                error: "client_already_seated",
                seat: other.seat,
              },
            };
          }
        }
        const seatToken = issueSeatToken();
        const nextSeat: StoredSessionSeat = {
          seat,
          seatTokenHash: await hashSeatToken(seatToken),
          ...(displayName ? { displayName } : {}),
        };
        const updatedRoom = { ...room, seats: [...room.seats, nextSeat] };
        const projectKey = `${PROJECT_PREFIX}${room.projectId}`;
        const storedProject =
          await transaction.get<ProjectRecord>(projectKey);
        if (!storedProject) {
          return { status: 404, value: { error: "project_not_found" } };
        }
        const record = normalizedProjectRecord(storedProject);
        record.sessions = record.sessions.map((candidate) =>
          candidate.id === updatedRoom.id ? updatedRoom : candidate,
        );
        await transaction.put({
          [roomKey]: updatedRoom,
          [projectKey]: record,
        });
        return { status: 200, value: { session: updatedRoom, seatToken } };
      });
      if (outcome.status === 200 && "session" in outcome.value && outcome.value.session) {
        this.broadcastSession(outcome.value.session);
      }
      return json(outcome.value, outcome.status);
    }

    const roomIntentMatch = url.pathname.match(/^\/sessions\/([^/]+)\/intents$/);
    if (request.method === "POST" && roomIntentMatch) {
      const input = await request.json<{
        intentId?: unknown;
        seat?: unknown;
        seatToken?: unknown;
        actionId?: unknown;
        payload?: unknown;
      }>().catch(() => ({
        intentId: undefined,
        seat: undefined,
        seatToken: undefined,
        actionId: undefined,
        payload: undefined,
      }));
      if (
        typeof input.intentId !== "string" ||
        !input.intentId ||
        !Number.isInteger(input.seat) ||
        (input.seatToken !== undefined &&
          (typeof input.seatToken !== "string" || !input.seatToken || input.seatToken.length > 200)) ||
        typeof input.actionId !== "string" ||
        !input.actionId ||
        (input.payload !== undefined &&
          (!input.payload || typeof input.payload !== "object" || Array.isArray(input.payload)))
      ) {
        return error("行动意图无效。", 400);
      }
      const roomKey = `session:${roomIntentMatch[1]}`;
      const outcome = await this.ctx.storage.transaction(async (transaction) => {
        const storedRoom = await transaction.get<StoredSharedSession>(roomKey);
        if (!storedRoom) {
          return { status: 404, value: { error: "room_not_found" } };
        }
        const storedBuild = await transaction.get<StoredPlayableBuild>(
          `build:${storedRoom.buildId}`,
        );
        const build = storedBuild ? normalizedBuild(storedBuild) : undefined;
        const runtime = build && executableRuntime(build.ruleSystem);
        if (!build || !runtime) {
          return {
            status: 422,
            value: { error: "runtime_not_executable" },
          };
        }
        const room = reconstructSession(storedRoom, build);
        const seatToken = typeof input.seatToken === "string" ? input.seatToken : "";
        const claimedSeat = seatToken
          ? await seatForToken(room.seats, Number(input.seat), seatToken)
          : undefined;
        const publicShareIntent =
          request.headers.get("x-godesk-public-share") === "1";
        const controlPlaneHeadless =
          !publicShareIntent && !seatToken && room.seats.length === 0;
        if (!controlPlaneHeadless && !claimedSeat) {
          return {
            status: 409,
            value: { error: "seat_not_claimed", state: room.state },
          };
        }
        if (
          room.acceptedActions.some(
            (action) => action.intentId === input.intentId,
          )
        ) {
          return { status: 200, value: room };
        }
        const accepted = acceptIntent(
          room.state,
          runtime,
          {
            intentId: String(input.intentId),
            seat: Number(input.seat),
            actionId: String(input.actionId),
            payload: input.payload as Record<string, unknown> | undefined,
          },
          room.acceptedActions.length + 1,
          room.seed,
        );
        if (!accepted) {
          return {
            status: 409,
            value: { error: "intent_rejected", state: room.state },
          };
        }
        const updatedRoom: StoredSharedSession = {
          ...room,
          state: accepted.state,
          acceptedActions: [...room.acceptedActions, accepted],
        };
        const replay = await transaction.get<StoredReplay>(
          `replay:${room.replayId}`,
        );
        if (!replay) {
          return { status: 500, value: { error: "replay_not_found" } };
        }
        const updatedReplay: StoredReplay = {
          ...replay,
          acceptedActions: updatedRoom.acceptedActions,
          finalState: updatedRoom.state,
        };
        const projectKey = `${PROJECT_PREFIX}${room.projectId}`;
        const storedProject =
          await transaction.get<ProjectRecord>(projectKey);
        if (!storedProject) {
          return { status: 404, value: { error: "project_not_found" } };
        }
        const record = normalizedProjectRecord(storedProject);
        record.sessions = record.sessions.map((candidate) =>
          candidate.id === updatedRoom.id ? updatedRoom : candidate,
        );
        await transaction.put({
          [roomKey]: updatedRoom,
          [`replay:${room.replayId}`]: updatedReplay,
          [projectKey]: record,
        });
        return { status: 200, value: updatedRoom };
      });
      if (outcome.status === 200 && "id" in outcome.value) {
        this.broadcastSession(outcome.value);
      }
      return json(outcome.value, outcome.status);
    }

    const roomFeedbackMatch = url.pathname.match(/^\/sessions\/([^/]+)\/feedback$/);
    if (request.method === "POST" && roomFeedbackMatch) {
      const input = await request.json<{
        seat?: unknown;
        seatToken?: unknown;
        rating?: unknown;
        comment?: unknown;
      }>().catch(() => ({
        seat: undefined,
        seatToken: undefined,
        rating: undefined,
        comment: undefined,
      }));
      const comment = typeof input.comment === "string"
        ? input.comment.trim()
        : "";
      if (
        !Number.isInteger(input.seat) ||
        typeof input.seatToken !== "string" ||
        !input.seatToken ||
        input.seatToken.length > 200 ||
        !Number.isInteger(input.rating) ||
        Number(input.rating) < 1 ||
        Number(input.rating) > 5 ||
        comment.length < 2 ||
        comment.length > 1_000
      ) {
        return error("试玩反馈需要已入座席位、1 到 5 分评分和 2 到 1000 字评论。", 400);
      }
      const seat = Number(input.seat);
      const seatToken = input.seatToken;
      const rating = Number(input.rating) as SessionFeedback["rating"];
      const roomKey = `session:${roomFeedbackMatch[1]}`;
      const outcome = await this.ctx.storage.transaction(async (transaction) => {
        const storedRoom = await transaction.get<StoredSharedSession>(roomKey);
        if (!storedRoom) {
          return { status: 404, value: { error: "room_not_found" } };
        }
        const claimedSeat = await seatForToken(storedRoom.seats, seat, seatToken);
        if (!claimedSeat) {
          return {
            status: 409,
            value: { error: "seat_not_claimed" },
          };
        }
        const acceptedAction = [...storedRoom.acceptedActions]
          .reverse()
          .find((candidate) => candidate.seat === seat);
        if (!acceptedAction) {
          return {
            status: 409,
            value: { error: "feedback_requires_action" },
          };
        }
        const moment = {
          actionSequence: acceptedAction.sequence,
          actionId: acceptedAction.actionId,
        };
        const now = new Date().toISOString();
        const existing = storedRoom.feedback.find((entry) => entry.seat === seat);
        const entry: SessionFeedback = existing
          ? {
              ...existing,
              rating,
              comment,
              moment,
              updatedAt: now,
            }
          : {
              id: `feedback_${crypto.randomUUID()}`,
              seat,
              rating,
              comment,
              moment,
              createdAt: now,
              updatedAt: now,
            };
        const updatedRoom: StoredSharedSession = {
          ...storedRoom,
          feedback: existing
            ? storedRoom.feedback.map((candidate) =>
                candidate.id === existing.id ? entry : candidate,
              )
            : [...storedRoom.feedback, entry],
        };
        const projectKey = `${PROJECT_PREFIX}${storedRoom.projectId}`;
        const storedProject =
          await transaction.get<ProjectRecord>(projectKey);
        if (!storedProject) {
          return { status: 404, value: { error: "project_not_found" } };
        }
        const record = normalizedProjectRecord(storedProject);
        record.sessions = record.sessions.map((candidate) =>
          candidate.id === updatedRoom.id ? updatedRoom : candidate,
        );
        await transaction.put({
          [roomKey]: updatedRoom,
          [projectKey]: record,
        });
        return { status: 200, value: updatedRoom };
      });
      if (outcome.status === 200 && "id" in outcome.value) {
        this.broadcastSession(outcome.value);
      }
      return json(outcome.value, outcome.status);
    }

    const playtestMatch = url.pathname.match(/^\/playtests\/([^/]+)$/);
    if (request.method === "GET" && playtestMatch) {
      const playtest = await this.ctx.storage.get<StoredPlaytest>(
        `playtest:${playtestMatch[1]}`,
      );
      return playtest ? json(playtest) : error("没有找到这个试玩。", 404);
    }

    const roomMatch = url.pathname.match(/^\/sessions\/([^/]+)$/);
    if (request.method === "GET" && roomMatch) {
      const room = await this.ctx.storage.get<StoredSharedSession>(
        `session:${roomMatch[1]}`,
      );
      if (!room) return error("没有找到这个 Shared Session。", 404);
      const storedBuild = await this.ctx.storage.get<StoredPlayableBuild>(
        `build:${room.buildId}`,
      );
      const build = storedBuild ? normalizedBuild(storedBuild) : undefined;
      if (!build) return error("Shared Session 引用的 Build 不存在。", 500);
      return json(reconstructSession(room, build));
    }

    const replayMatch = url.pathname.match(/^\/replays\/([^/]+)$/);
    if (request.method === "GET" && replayMatch) {
      const replay = await this.ctx.storage.get<StoredReplay>(
        `replay:${replayMatch[1]}`,
      );
      if (!replay) return error("没有找到这个回放。", 404);
      const storedBuild = await this.ctx.storage.get<StoredPlayableBuild>(
        `build:${replay.buildId}`,
      );
      const build = storedBuild ? normalizedBuild(storedBuild) : undefined;
      if (!build) return error("回放引用的 Build 不存在。", 500);
      return json(reconstructReplay(replay, build));
    }

    if (request.method === "GET" && url.pathname.startsWith(PROJECT_PREFIX)) {
      const stored = await this.ctx.storage.get<ProjectRecord>(
        url.pathname,
      );
      if (!stored) return error("没有找到这个 Game Project。", 404);
      let record: ReturnType<typeof normalizedProjectRecord>;
      try {
        record = normalizedProjectRecord(stored);
      } catch (reason) {
        if (
          reason instanceof Error &&
          ["unsupported_project_shape", "unsupported_rule_system_shape", "unsupported_build_shape"].includes(reason.message)
        ) {
          return error("这个 Game Project 使用已删除的旧规则格式，请创建新项目。", 410);
        }
        throw reason;
      }
      if (!url.searchParams.has("view")) return json(record.project);
      const view = url.searchParams.get("view");
      if (view === "rule-system") return json(record.ruleSystem);
      if (view === "activity") {
        const sessions = record.sessions.slice(-50).map((room) => {
          const build = record.builds.find(
            (candidate) => candidate.id === room.buildId,
          );
          return build ? reconstructSession(room, build) : room;
        });
        return json({
          project: record.project,
          jobs: record.jobs.slice(0, 50),
          sessions,
        });
      }
      if (view === "generation-plan") {
        return json({
          generationPlan:
            await this.ctx.storage.get<GenerationPlan>(
              generationPlanKey(record.project.id),
            ) ?? null,
        });
      }
      if (view === "playtest-link") {
        return json({
          playtestLink:
            await this.ctx.storage.get<StoredPlaytestLink>(
              playtestLinkKey(record.project.id),
            ) ?? null,
        });
      }
      if (view === "rules") {
        return json(paginated(record.ruleSystem.rules, url, "rules"));
      }
      if (view === "constraints") {
        return json(
          paginated(record.ruleSystem.constraints, url, "constraints"),
        );
      }
      if (view === "entities") {
        return json(
          paginated(record.ruleSystem.entities, url, "entities"),
        );
      }
      if (view === "surface") return json(record.ruleSystem.playSurface);
      if (view === "outcomes") {
        return json(
          paginated(record.ruleSystem.outcomes, url, "outcomes"),
        );
      }
      if (view === "validation") {
        return json({
          hypotheses: record.hypotheses,
          findings: record.findings,
        });
      }
      if (view === "entity") {
        const entityType = url.searchParams.get("entityType");
        const entityId = url.searchParams.get("entityId");
        if (!entityType || !entityId) {
          return error("entity 视图需要 entityType 和 entityId。", 400);
        }
        const collections: Record<string, Array<{ id: string }>> = {
          source: record.sources,
          rule: record.ruleSystem.rules,
          constraint: record.ruleSystem.constraints,
          entity: record.ruleSystem.entities,
          outcome: record.ruleSystem.outcomes,
          build: record.builds,
          playtest: record.playtests,
          session: record.sessions,
          job: record.jobs,
          hypothesis: record.hypotheses,
          finding: record.findings,
        };
        const entity = collections[entityType]?.find(
          (candidate) => candidate.id === entityId,
        );
        return entity ? json(entity) : error("没有找到这个项目实体。", 404);
      }
      if (view === "rule-systems") {
        return json(paginated(record.ruleSystems, url, "ruleSystems"));
      }
      if (view === "sources") {
        return json(paginated(record.sources, url, "sources"));
      }
      if (view === "changesets") {
        return json(paginated(record.changesets, url, "changesets"));
      }
      if (view === "builds") {
        return json(paginated(record.builds, url, "builds"));
      }
      if (view === "playtests") {
        return json(paginated(record.playtests, url, "playtests"));
      }
      if (view === "sessions") {
        const sessions = record.sessions.map((room) => {
          const build = record.builds.find(
            (candidate) => candidate.id === room.buildId,
          );
          return build ? reconstructSession(room, build) : room;
        });
        return json(paginated(sessions, url, "sessions"));
      }
      if (view === "jobs") {
        return json(paginated(record.jobs, url, "jobs"));
      }
      return error("没有这个项目视图。", 400);
    }

    if (request.method === "GET" && url.pathname === "/projects") {
      const entries = await this.ctx.storage.list<ProjectRecord>({
        prefix: PROJECT_PREFIX,
      });
      const projects: GameProject[] = [];
      for (const entry of entries.values()) {
        try {
          projects.push(normalizedProjectRecord(entry).project);
        } catch (reason) {
          if (
            reason instanceof Error &&
            [
              "unsupported_project_shape",
              "unsupported_rule_system_shape",
              "unsupported_build_shape",
            ].includes(reason.message)
          ) {
            continue;
          }
          throw reason;
        }
      }
      return json({
        projects: projects.sort((left, right) =>
          right.updatedAt.localeCompare(left.updatedAt)
        ),
      });
    }

    return error("没有这个项目操作。", 404);
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) {
    if (message !== '{"type":"session.sync"}') {
      socket.close(1008, "unsupported_session_event");
      return;
    }
    const attachment = socket.deserializeAttachment() as
      | SessionSocketAttachment
      | null;
    if (!attachment?.sessionId) {
      socket.close(1008, "session_attachment_missing");
      return;
    }
    const room = await this.ctx.storage.get<StoredSharedSession>(
      `session:${attachment.sessionId}`,
    );
    if (!room) {
      socket.close(1008, "session_not_found");
      return;
    }
    const storedBuild = await this.ctx.storage.get<StoredPlayableBuild>(
      `build:${room.buildId}`,
    );
    const build = storedBuild ? normalizedBuild(storedBuild) : undefined;
    if (!build) {
      socket.close(1011, "session_build_not_found");
      return;
    }
    socket.send(JSON.stringify({
      type: "session.snapshot",
      session: visibleSession(reconstructSession(room, build)),
    } satisfies SharedSessionSnapshotEvent));
  }

  webSocketClose(socket: WebSocket, code: number, reason: string) {
    socket.close(code, reason);
  }
}

async function projectApi(
  request: Request,
  env: Env,
  creatorId: string,
  authentication: "local-development-only" | "oauth",
) {
  const url = new URL(request.url);
  const mount = request.headers.get("x-godesk-mount") ?? url.pathname;
  const stub = env.CREATOR_PROJECTS.getByName(creatorId);
  const secret = shareSecret(env);
  const shareToken = shareTokenFromUrl(url);
  const forwardRoomRequest = (target: string) =>
    shareToken
      ? publicShareForwardRequest(target, request)
      : new Request(target, request);

  if (request.method === "POST" && url.pathname === "/api/projects") {
    const input = await request
      .json<{ name?: unknown; templateId?: unknown }>()
      .catch(() => ({
        name: undefined,
        templateId: undefined,
      }));
    const response = await stub.fetch(
      new Request("https://projects.internal/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: input.name,
          templateId: input.templateId,
          authentication,
        }),
      }),
    );
    if (!response.ok) return response;
    const project = await response.json<GameProject>();
    const result: CreateProjectResult = {
      project,
      studioUrl: new URL(mountHref(`/studio/${project.id}`, mount), url.origin).toString(),
      warnings: input.templateId
        ? []
        : ["新项目尚未包含来源、结构化规则或 Game Entity。"],
    };
    return json(result, 201);
  }

  if (request.method === "GET" && url.pathname === "/api/projects") {
    return stub.fetch("https://projects.internal/projects");
  }

  const duplicateMatch = url.pathname.match(
    /^\/api\/projects\/([^/]+)\/duplicate$/,
  );
  if (request.method === "POST" && duplicateMatch) {
    const response = await stub.fetch(
      new Request(
        `https://projects.internal${PROJECT_PREFIX}${duplicateMatch[1]}/duplicate`,
        request,
      ),
    );
    if (!response.ok) return response;
    const project = await response.json<GameProject>();
    return json(
      {
        project,
        studioUrl: new URL(mountHref(`/studio/${project.id}`, mount), url.origin).toString(),
        warnings: [],
      } satisfies CreateProjectResult,
      response.status,
    );
  }

  const duplicateRuleSystemMatch = url.pathname.match(
    /^\/api\/projects\/([^/]+)\/rule-systems\/([^/]+)\/duplicate$/,
  );
  if (request.method === "POST" && duplicateRuleSystemMatch) {
    const response = await stub.fetch(
      new Request(
        `https://projects.internal/projects/${duplicateRuleSystemMatch[1]}/rule-systems/${duplicateRuleSystemMatch[2]}/duplicate`,
        request,
      ),
    );
    if (!response.ok) return response;
    return json(
      publicMutation(
        await response.json<StoredDuplicateRuleSystemResult>(),
        url.origin,
        mount,
      ),
      response.status,
    );
  }

  const restoreBuildMatch = url.pathname.match(
    /^\/api\/projects\/([^/]+)\/builds\/([^/]+)\/restore$/,
  );
  if (request.method === "POST" && restoreBuildMatch) {
    const response = await stub.fetch(
      new Request(
        `https://projects.internal/projects/${restoreBuildMatch[1]}/builds/${restoreBuildMatch[2]}/restore`,
        request,
      ),
    );
    if (!response.ok) return response;
    return json(
      publicMutation(
        await response.json<StoredRestoreBuildResult>(),
        url.origin,
        mount,
      ),
      response.status,
    );
  }

  const deleteMatch = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
  if (request.method === "DELETE" && deleteMatch) {
    return stub.fetch(
      new Request(
        `https://projects.internal${PROJECT_PREFIX}${deleteMatch[1]}`,
        request,
      ),
    );
  }

  if (request.method === "GET" && url.pathname.startsWith("/api/projects/")) {
    const id = url.pathname.slice("/api/projects/".length);
    const internalUrl = new URL(
      `https://projects.internal${PROJECT_PREFIX}${id}`,
    );
    internalUrl.search = url.search;
    const response = await stub.fetch(internalUrl);
    if (!response.ok) return response;
    const view = url.searchParams.get("view");
    if (view === "builds") {
      const body = await response.json<{
        builds: StoredPlayableBuild[];
        page: unknown;
      }>();
      return json({
        ...body,
        builds: await Promise.all(
          body.builds.map((build) => publicBuild(build, url.origin, creatorId, secret, mount)),
        ),
      });
    }
    if (view === "playtests") {
      const body = await response.json<{ playtests: StoredPlaytest[] }>();
      return json({
        ...body,
        playtests: await Promise.all(
          body.playtests.map((playtest) =>
            publicPlaytest(playtest, url.origin, creatorId, secret, mount),
          ),
        ),
      });
    }
    if (view === "sessions") {
      const body = await response.json<{ sessions: StoredSharedSession[] }>();
      return json({
        ...body,
        sessions: await Promise.all(
          body.sessions.map((room) => publicSession(room, url.origin, creatorId, secret, mount)),
        ),
      });
    }
    if (view === "playtest-link") {
      const body = await response.json<{
        playtestLink: StoredPlaytestLink | null;
      }>();
      return json({
        playtestLink: body.playtestLink
          ? await publicPlaytestLink(body.playtestLink, url.origin, creatorId, secret, mount)
          : null,
      });
    }
    if (view === "jobs") {
      const body = await response.json<{ jobs: CreatorJob[] }>();
      return json({
        ...body,
        jobs: await Promise.all(
          body.jobs.map((job) => publicJob(job, url.origin, creatorId, secret, mount)),
        ),
      });
    }
    if (view === "activity") {
      const body = await response.json<{
        project: GameProject;
        jobs: CreatorJob[];
        sessions: StoredSharedSession[];
      }>();
      return json({
        project: body.project,
        jobs: await Promise.all(
          body.jobs.map((job) => publicJob(job, url.origin, creatorId, secret, mount)),
        ),
        sessions: await Promise.all(
          body.sessions.map((room) =>
            publicSession(room, url.origin, creatorId, secret, mount)
          ),
        ),
      });
    }
    return response;
  }

  const changeMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/changes$/);
  if (request.method === "POST" && changeMatch) {
    const response = await stub.fetch(
      new Request(
        `https://projects.internal${PROJECT_PREFIX}${changeMatch[1]}/changes`,
        request,
      ),
    );
    if (!response.ok) return response;
    return json(
      publicMutation(
        await response.json<StoredApplyProjectChangesResult>(),
        url.origin,
        mount,
      ),
      response.status,
    );
  }

  const submitJobMatch = url.pathname.match(
    /^\/api\/projects\/([^/]+)\/jobs$/,
  );
  if (request.method === "POST" && submitJobMatch) {
    const response = await stub.fetch(
      new Request(
        `https://projects.internal/projects/${submitJobMatch[1]}/jobs`,
        request,
      ),
    );
    if (!response.ok) return response;
    return json(
      await publicJob(await response.json<CreatorJob>(), url.origin, creatorId, secret, mount),
      response.status,
    );
  }

  const jobArtifactMatch = url.pathname.match(
    /^\/api\/jobs\/([^/]+)\/artifact$/,
  );
  if (request.method === "GET" && jobArtifactMatch) {
    return stub.fetch(
      `https://projects.internal/jobs/${jobArtifactMatch[1]}/artifact`,
    );
  }

  const jobMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)$/);
  if (request.method === "GET" && jobMatch) {
    const response = await stub.fetch(
      `https://projects.internal/jobs/${jobMatch[1]}`,
    );
    if (!response.ok) return response;
    return json(await publicJob(await response.json<CreatorJob>(), url.origin, creatorId, secret, mount));
  }

  const retryJobMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)\/retry$/);
  if (request.method === "POST" && retryJobMatch) {
    const response = await stub.fetch(
      new Request(
        `https://projects.internal/jobs/${retryJobMatch[1]}/retry`,
        request,
      ),
    );
    if (!response.ok) return response;
    return json(
      await publicJob(await response.json<CreatorJob>(), url.origin, creatorId, secret, mount),
      response.status,
    );
  }

  const compileMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/builds$/);
  if (request.method === "POST" && compileMatch) {
    const response = await stub.fetch(
      new Request(
        `https://projects.internal${PROJECT_PREFIX}${compileMatch[1]}/builds`,
        request,
      ),
    );
    if (!response.ok) return response;
    const result = await response.json<StoredCompileBuildResult>();
    return json(
      publicMutation({
        ...result,
        build: await publicBuild(result.build, url.origin, creatorId, secret, mount),
      }, url.origin, mount),
      response.status,
    );
  }

  const buildMatch = url.pathname.match(/^\/api\/builds\/([^/]+)$/);
  if (request.method === "GET" && buildMatch) {
    const response = await stub.fetch(
      `https://projects.internal/builds/${buildMatch[1]}`,
    );
    if (!response.ok) return response;
    const build = await response.json<StoredPlayableBuild>();
    return json(await publicBuild(build, url.origin, creatorId, secret, mount));
  }

  const playtestCreateMatch = url.pathname.match(
    /^\/api\/builds\/([^/]+)\/playtests$/,
  );
  if (request.method === "POST" && playtestCreateMatch) {
    const response = await stub.fetch(
      new Request(
        `https://projects.internal/builds/${playtestCreateMatch[1]}/playtests`,
        request,
      ),
    );
    if (!response.ok) return response;
    const playtest = await response.json<StoredPlaytest>();
    return json(await publicPlaytest(playtest, url.origin, creatorId, secret, mount), response.status);
  }

  const roomCreateMatch = url.pathname.match(
    /^\/api\/builds\/([^/]+)\/sessions$/,
  );
  if (request.method === "POST" && roomCreateMatch) {
    const response = await stub.fetch(
      new Request(
        `https://projects.internal/builds/${roomCreateMatch[1]}/sessions`,
        request,
      ),
    );
    if (!response.ok) return response;
    const room = await response.json<StoredSharedSession>();
    return json(await publicSession(room, url.origin, creatorId, secret, mount), response.status);
  }

  const roomEventsMatch = url.pathname.match(
    /^\/api\/sessions\/([^/]+)\/events$/,
  );
  if (request.method === "GET" && roomEventsMatch) {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return error("Shared Session 实时连接需要 WebSocket upgrade。", 426);
    }
    return stub.fetch(new Request(
      `https://projects.internal/sessions/${roomEventsMatch[1]}/events`,
      request,
    ));
  }

    const roomSeatMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/seats$/);
  if (request.method === "POST" && roomSeatMatch) {
    const response = await stub.fetch(
      forwardRoomRequest(
        `https://projects.internal/sessions/${roomSeatMatch[1]}/seats`,
      ),
    );
    if (!response.ok) return response;
    const claimed = await response.json<{
      session: StoredSharedSession;
      seatToken: string;
    }>();
    return json(
      {
        session: await publicSession(claimed.session, url.origin, creatorId, secret, mount),
        seatToken: claimed.seatToken,
      },
      response.status,
    );
  }

  const roomIntentMatch = url.pathname.match(
    /^\/api\/sessions\/([^/]+)\/intents$/,
    );
  if (request.method === "POST" && roomIntentMatch) {
    const response = await stub.fetch(
      forwardRoomRequest(
        `https://projects.internal/sessions/${roomIntentMatch[1]}/intents`,
      ),
    );
    if (!response.ok) return response;
    const room = await response.json<StoredSharedSession>();
    return json(
      await publicSession(room, url.origin, creatorId, secret, mount),
      response.status,
    );
  }

  const roomFeedbackMatch = url.pathname.match(
    /^\/api\/sessions\/([^/]+)\/feedback$/,
  );
  if (request.method === "POST" && roomFeedbackMatch) {
    const response = await stub.fetch(
      forwardRoomRequest(
        `https://projects.internal/sessions/${roomFeedbackMatch[1]}/feedback`,
      ),
    );
    if (!response.ok) return response;
    const room = await response.json<StoredSharedSession>();
    return json(
      await publicSession(room, url.origin, creatorId, secret, mount),
      response.status,
    );
  }

  const playtestMatch = url.pathname.match(/^\/api\/playtests\/([^/]+)$/);
  if (request.method === "GET" && playtestMatch) {
    const response = await stub.fetch(
      `https://projects.internal/playtests/${playtestMatch[1]}`,
    );
    if (!response.ok) return response;
    return json(
      await publicPlaytest(await response.json<StoredPlaytest>(), url.origin, creatorId, secret, mount),
    );
  }

  const roomMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)$/);
  if (request.method === "GET" && roomMatch) {
    const response = await stub.fetch(
      `https://projects.internal/sessions/${roomMatch[1]}`,
    );
    if (!response.ok) return response;
    return json(
      await publicSession(await response.json<StoredSharedSession>(), url.origin, creatorId, secret, mount),
    );
  }

  const replayMatch = url.pathname.match(/^\/api\/replays\/([^/]+)$/);
  if (request.method === "GET" && replayMatch) {
    return stub.fetch(
      `https://projects.internal/replays/${replayMatch[1]}`,
    );
  }

  return error("没有这个 API。", 404);
}

function publicShareForwardRequest(target: string, request: Request) {
  const forwarded = new Request(target, request);
  forwarded.headers.set("x-godesk-public-share", "1");
  return forwarded;
}

function isPublicSharePage(url: URL) {
  return /^\/(?:play|room|replay|try)\/[^/]+$/.test(url.pathname);
}

function isPublicShareApi(request: Request) {
  const url = new URL(request.url);
  if (request.method === "GET") {
    return /^\/api\/(?:builds|sessions|replays)\/[^/]+$/.test(url.pathname) ||
      /^\/api\/sessions\/[^/]+\/events$/.test(url.pathname);
  }
  return /^\/api\/sessions\/[^/]+\/(?:seats|intents|feedback)$/.test(url.pathname) &&
    request.method === "POST";
}

export default {
  async fetch(request, env, ctx) {
    const incoming = new URL(request.url);
    const mount = incoming.pathname;
    const logical = logicalPathname(incoming.pathname);
    const url = new URL(incoming);
    if (logical !== "/chatgpt-plugin") url.pathname = logical;
    const routed = new Request(url, request);
    routed.headers.set("x-godesk-mount", mount);
    const shareToken = shareTokenFromUrl(url);
    const shareCapability = shareToken
      ? await verifyShareToken(shareToken, shareSecret(env))
      : null;
    const shareResource = resourceKindFromPath(url.pathname);
    const validShare = Boolean(
      shareCapability &&
      shareResource &&
      capabilityMatches(shareCapability, shareResource.kind, shareResource.resourceId),
    );
    const playtestLinkMatch = url.pathname.match(/^\/try\/([^/]+)$/);
    if (routed.method === "GET" && validShare && shareCapability && playtestLinkMatch) {
      const stub = env.CREATOR_PROJECTS.getByName(shareCapability.c);
      const response = await stub.fetch(
        `https://projects.internal/projects/${playtestLinkMatch[1]}?view=playtest-link`,
      );
      if (!response.ok) return response;
      const { playtestLink } = await response.json<{
        playtestLink: StoredPlaytestLink | null;
      }>();
      if (!playtestLink) return error("playtest_link_not_published", 404);
      return Response.redirect(
        publicShareUrl(`/room/${playtestLink.sessionId}`, url.origin, shareToken!, mount),
        302,
      );
    }
    if (
      validShare &&
      shareCapability &&
      (isPublicSharePage(url) || isPublicShareApi(routed))
    ) {
      if (isPublicShareApi(routed)) {
        return projectApi(routed, env, shareCapability.c, "oauth");
      }
      return env.ASSETS.fetch(request);
    }
    if (
      url.pathname === "/.well-known/oauth-protected-resource" ||
      url.pathname === "/.well-known/oauth-protected-resource/mcp"
    ) {
      return protectedResourceMetadata(request, env);
    }
    if (url.pathname === "/login") {
      return startWebLogin(routed, env);
    }
    if (url.pathname === "/oauth/callback") {
      return finishWebLogin(routed, env);
    }
    if (url.pathname === "/mcp") {
      const identity = await authorizeRequest(
        routed,
        env,
        await mcpScopes(routed),
      );
      if (identity instanceof Response) return identity;
      return godeskMcpHandler(
        routed,
        env,
        identity.creatorId,
        identity.mode === "oauth" ? "oauth" : "local-development-only",
      )(
        routed,
        env,
        ctx,
      );
    }
    if (url.pathname.startsWith("/api/")) {
      const identity = await authorizeRequest(
        routed,
        env,
        requiredScopes(routed),
      );
      const allowAnonymous = logical.startsWith("/api/") && mount.startsWith("/chatgpt-plugin/");
      let creator = identity;
      const cookies: string[] = [];
      if (creator instanceof Response && allowAnonymous) {
        const issued = anonymousCreator(routed);
        creator = issued.identity;
        if (issued.cookie) cookies.push(issued.cookie);
      }
      if (creator instanceof Response) return creator;
      return withCookies(
        await projectApi(
          routed,
          env,
          creator.creatorId,
          creator.mode === "oauth" ? "oauth" : "local-development-only",
        ),
        cookies,
      );
    }
    if (/^\/(studio|play|room|replay)\//.test(url.pathname)) {
      const identity = await authorizeRequest(routed, env, ["godesk:read"]);
      if (identity instanceof Response && !mount.startsWith("/chatgpt-plugin/")) {
        const login = new URL("/login", url.origin);
        login.searchParams.set("returnTo", `${incoming.pathname}${incoming.search}`);
        return Response.redirect(login, 302);
      }
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
