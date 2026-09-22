import { mountHref } from "../public-mount";
import type {
  CreatorJob,
  GenerationPlan,
  PlayableBuild,
  PlaytestRun,
  RuleSystem,
  SessionFeedback,
  SharedSession,
  ValidationFinding,
} from "./project-contract";
import { buildMeetsShareGate } from "../runtime/share-gate";

export function href(path: string) {
  return mountHref(path, window.location.pathname);
}

export type ValidationEvidenceType =
  | "automated-playtest"
  | "participant-feedback"
  | "human-session";

export type SeatedParticipantDraft = { seat: number; name: string };

export type StoredSeatClaim = { seat: number; seatToken: string };

export function readShareToken() {
  return new URLSearchParams(window.location.search).get("share") ?? undefined;
}

function seatClaimStorageKey(sessionId: string) {
  return `godesk-seat:${sessionId}`;
}

export function readStoredSeatClaim(sessionId: string): StoredSeatClaim | undefined {
  try {
    const raw = window.sessionStorage.getItem(seatClaimStorageKey(sessionId));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<StoredSeatClaim>;
    if (typeof parsed.seatToken !== "string" || !parsed.seatToken) return undefined;
    if (!Number.isInteger(parsed.seat)) return undefined;
    return { seat: parsed.seat as number, seatToken: parsed.seatToken };
  } catch {
    return undefined;
  }
}

export function writeStoredSeatClaim(sessionId: string, claim: StoredSeatClaim) {
  window.sessionStorage.setItem(seatClaimStorageKey(sessionId), JSON.stringify(claim));
}

export function seatedParticipantsFromSession(session?: SharedSession): SeatedParticipantDraft[] {
  return (session?.seats ?? []).map((entry) => ({
    seat: entry.seat,
    name: entry.displayName ?? "",
  }));
}

export const CREATOR_JOB_LABELS: Record<CreatorJob["kind"], string> = {
  "generate-rule-system": "解析规则",
  "iterate-rule-system": "应用自然语言迭代",
  "compile-build": "编译可玩版本",
  "bot-playtest": "自动试玩",
  "export-build": "导出 Build",
};

export const CREATOR_JOB_STATUS_LABELS: Record<CreatorJob["status"], string> = {
  queued: "排队中",
  running: "运行中",
  succeeded: "已完成",
  failed: "失败",
};

export function upsertCreatorJob(
  jobs: CreatorJob[],
  nextJob: CreatorJob,
) {
  return [nextJob, ...jobs.filter((job) => job.id !== nextJob.id)];
}

export function latestActiveCreatorJob(jobs: CreatorJob[]) {
  return [...jobs]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .find((job) => job.status === "queued" || job.status === "running");
}

export function visibleCreatorJob(jobs: CreatorJob[]) {
  return latestActiveCreatorJob(jobs) ?? [...jobs]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
}

export function projectActivityRequiresFullRefresh(
  currentVersion: number | undefined,
  nextVersion: number,
  currentJobs: CreatorJob[],
  nextJobs: CreatorJob[],
) {
  const jobActivity = (jobs: CreatorJob[]) => jobs
    .map((job) => `${job.id}:${job.status}:${job.updatedAt}`)
    .join("|");
  return currentVersion !== nextVersion ||
    jobActivity(currentJobs) !== jobActivity(nextJobs);
}

export function latestBuildPlaytestComparison(
  builds: PlayableBuild[],
  playtests: PlaytestRun[],
) {
  const [candidateBuild, baselineBuild] = [...builds]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  if (!candidateBuild || !baselineBuild) return undefined;

  const candidatePlaytests = playtests
    .filter((playtest) => playtest.buildId === candidateBuild.id)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const baselinePlaytests = playtests
    .filter((playtest) => playtest.buildId === baselineBuild.id)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  for (const candidatePlaytest of candidatePlaytests) {
    const baselinePlaytest = baselinePlaytests.find(
      (playtest) => playtest.seed === candidatePlaytest.seed,
    );
    if (baselinePlaytest) {
      return {
        baselineBuild,
        baselinePlaytest,
        candidateBuild,
        candidatePlaytest,
      };
    }
  }
  return undefined;
}

export function latestStudioPlayTarget(
  builds: PlayableBuild[],
  sessions: SharedSession[],
) {
  const build = [...builds]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  const session = build
    ? sessions
        .filter((candidate) => candidate.buildId === build.id)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]
    : undefined;
  return { build, session };
}

export function buildCanOpenSharedSession(build: PlayableBuild) {
  return buildMeetsShareGate(build);
}

export function playtestOutcome(playtest: PlaytestRun) {
  if (playtest.terminalStatus === "turn-limit") return "达到安全回合上限";
  return playtest.metrics.winnerSeat === null
    ? "无唯一胜者"
    : `Seat ${playtest.metrics.winnerSeat + 1} 获胜`;
}

export function signedDelta(value: number) {
  return value === 0 ? "无变化" : `${value > 0 ? "+" : ""}${value}`;
}

export function validationStudioHref(
  projectId: string,
  context: {
    buildId?: string;
    evidenceType?: ValidationEvidenceType;
    evidenceId?: string;
    hypothesisId?: string;
  } = {},
) {
  const params = new URLSearchParams();
  if (context.buildId) params.set("build", context.buildId);
  if (context.evidenceType) params.set("evidenceType", context.evidenceType);
  if (context.evidenceId) params.set("evidence", context.evidenceId);
  if (context.hypothesisId) params.set("hypothesis", context.hypothesisId);
  const query = params.toString();
  return `/studio/${encodeURIComponent(projectId)}${query ? `?${query}` : ""}`;
}

export function findingContinuationPrompt(
  projectId: string,
  finding: Pick<ValidationFinding, "id" | "nextChange">,
) {
  return `继续 GoDesk 项目 ${projectId}：应用 Validation Finding ${finding.id} 的下一版改动“${finding.nextChange}”，在同一项目编译新 Build，并用相同 seed 自动试玩比较。`;
}

export function participantFeedbackInbox(sessions: SharedSession[]) {
  return sessions
    .flatMap((session) => session.feedback.map((feedback) => ({
      session,
      feedback,
    })))
    .sort((left, right) =>
      right.feedback.updatedAt.localeCompare(left.feedback.updatedAt)
    );
}

export function participantFeedbackFindingNotes(
  feedback: SessionFeedback,
  actionLabel = feedback.moment.actionId,
) {
  return `座位 ${feedback.seat} · 行动 #${feedback.moment.actionSequence} ${actionLabel} · ${feedback.rating}/5\n${feedback.comment}`;
}

export function readValidationRouteContext() {
  const params = new URLSearchParams(window.location.search);
  const evidenceType = params.get("evidenceType");
  const routeEvidenceType: ValidationEvidenceType =
    evidenceType === "human-session" || evidenceType === "participant-feedback"
      ? evidenceType
      : "automated-playtest";
  return {
    buildId: params.get("build") ?? "",
    evidenceType: routeEvidenceType,
    evidenceId: params.get("evidence") ?? "",
    hypothesisId: params.get("hypothesis") ?? "",
  };
}

export function draftExpectedVersion(
  baseVersion: number | null,
  visibleVersion: number,
) {
  return baseVersion ?? visibleVersion;
}

export function shouldStartRuleSystemDraft(
  currentSourceDraft: string,
  nextSourceDraft: string,
) {
  return Boolean(nextSourceDraft.trim() && !currentSourceDraft.trim());
}

export function generationSourceFields(
  sourceContent: string,
  sourceName: string,
  sourceKind: "rulebook" | "brief",
  includeWhenEmpty = false,
) {
  if (!sourceContent.trim() && !includeWhenEmpty) return {};
  return {
    ...(sourceContent.trim() ? { sourceContent } : {}),
    sourceName,
    sourceKind,
  };
}

export type RuleSystemStructureDraft = Pick<
  RuleSystem,
  | "rules"
  | "constraints"
  | "entities"
  | "setup"
  | "actions"
  | "playSurface"
  | "stages"
  | "outcomes"
  | "presentation"
> & { roles: RuleSystem["participants"]["roles"] };

export { sameRuleSystemContent } from "./rule-system-compare";

function ruleSystemStructure(ruleSystem: RuleSystem): RuleSystemStructureDraft {
  return {
    roles: ruleSystem.participants.roles,
    rules: ruleSystem.rules,
    constraints: ruleSystem.constraints,
    entities: ruleSystem.entities,
    setup: ruleSystem.setup,
    actions: ruleSystem.actions,
    playSurface: ruleSystem.playSurface,
    stages: ruleSystem.stages,
    outcomes: ruleSystem.outcomes,
    presentation: ruleSystem.presentation,
  };
}

export function serializeRuleSystemStructure(ruleSystem: RuleSystem) {
  return JSON.stringify(ruleSystemStructure(ruleSystem), null, 2);
}

export function parseRuleSystemStructure(value: string): RuleSystemStructureDraft {
  const parsed = JSON.parse(value) as Partial<RuleSystemStructureDraft>;
  if (
    !parsed ||
    !Array.isArray(parsed.roles) ||
    !Array.isArray(parsed.rules) ||
    !Array.isArray(parsed.constraints) ||
    !Array.isArray(parsed.entities) ||
    !Array.isArray(parsed.setup) ||
    !Array.isArray(parsed.actions) ||
    !parsed.playSurface ||
    !Array.isArray(parsed.stages) ||
    !Array.isArray(parsed.outcomes) ||
    !parsed.presentation
  ) {
    throw new Error("Rule System 结构 JSON 缺少必填字段。");
  }
  return parsed as RuleSystemStructureDraft;
}

export function hobbyistProjectName(name: string, description: string) {
  const trimmed = name.trim();
  if (trimmed && trimmed !== "我的游戏") return trimmed;
  const idea = description.replace(/\s+/g, " ").trim();
  if (!idea) return trimmed || "我的游戏";
  return idea.slice(0, 16);
}

export function studioHobbyistFocus(
  generationPlanStatus: GenerationPlan["status"] | undefined,
  canPlay: boolean,
) {
  if (generationPlanStatus === "pending") return "plan" as const;
  if (canPlay) return "play" as const;
  return "setup" as const;
}
