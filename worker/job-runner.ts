import { inferRequestedMechanics } from "../src/creator/kernel-capabilities";
import { GENERATOR_VERSION, RULES_VERSION, gameSpecCapabilityGap, refreshGameSpec, ruleSystemSpecIssues } from "../src/creator/game-spec";
import type {
  ApplyProjectChangesInput,
  CompileBuildInput,
  CreatorJob,
  GenerationPlan,
  RuleSystem,
  RuntimeConfigureOperation,
  SourceLibraryEntry,
  SubmitJobInput,
} from "../src/creator/project-contract";
import {
  hasWeakGenreScoreRaceLeak,
  inferSourceGenre,
} from "../src/runtime/genre";
import { playabilityFloor } from "../src/runtime/playability-floor";
import { presentationFloor } from "../src/runtime/presentation-floor";
import {
  generationRefuseReason,
  type GenerationRefuseKind,
} from "../src/runtime/generation-refuse";
import {
  deriveHiddenRoles,
  isMultiActHiddenRoleCorpus,
} from "../src/runtime/hidden-role";
import {
  deriveHandPlayDeck,
  isNonScoreHandLoopCorpus,
} from "../src/runtime/hand-play";
import { isPatternDraftCorpus } from "../src/runtime/pattern-draft";
import {
  deriveVictoryBuildings,
  deriveWorkerPlacementRegions,
  deriveWorkersPerSeat,
  isEconomyPlacementCorpus,
  isHarborLikeCorpus,
} from "../src/runtime/worker-placement";
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
import { createKernelTuningIterationPlan, parseKernelEdits } from "./kernel-tuning-iteration";
import { fulfillAssetAttachIntents } from "./auto-battler-assets";
import { resolveAutoBattlerContent, DEFAULT_AUTO_BATTLER_CONTENT } from "../src/runtime/adapters/auto-battler-content";
import { packToContentPatch, resolveAutoBattlerPack } from "../src/runtime/adapters/auto-battler-packs";
import { parseRulesBookContentTables, inferBrandingFromRulesBook } from "./rulesbook-content-tables";

const AUTO_BATTLER_BASE_UNSUPPORTED =
  "auto-battler-v1: 2-seat shop→place→combat→HP. Configurable: units/traits(add/del)/stars, boardCols/Rows 4–8×1–3, timers, HP/gold, themes, modelRef, VFX presets. Not: >2 seats, sealed shop.";

/** Request-like clause (numbers or edit verbs) that the kernel could not map — listed honestly. */
const REQUEST_LIKE = /[0-9一二三四五六七八九十]|改成|改为|加一个|新增|开启|关闭|设为/;

/** Fold any configurable edits in the idea into the proposed configure_auto_battler op (sync; assets fulfilled separately). */
function autoBattlerProposedRuntime(idea: string) {
  const pack = resolveAutoBattlerPack(idea);
  const packContent = packToContentPatch(pack);
  // Long-form rules book: markdown unit/trait tables override pack roster when present.
  const tables = parseRulesBookContentTables(idea);
  let contentBase = packContent;
  if (tables.found && tables.patch) {
    const merged = {
      ...packContent,
      ...(tables.patch.traits ? { traits: tables.patch.traits } : {}),
      ...(tables.patch.units ? { units: tables.patch.units } : {}),
    };
    // If units+traits both from tables, stars still from pack/default patch shape.
    if (resolveAutoBattlerContent(merged)) contentBase = merged;
  }
  const branding = inferBrandingFromRulesBook(idea, pack.branding);
  const seedKernel = {
    type: "auto-battler-v1" as const,
    playerCount: 2 as const,
    content: contentBase,
    theme: pack.theme,
    branding,
  };
  // Clause parsers see the idea without table rows (avoids flooding unsupported).
  const parsed = parseKernelEdits(seedKernel as never, tables.ideaWithoutTables);
  const recognized = Boolean(parsed?.changes.length) || tables.found;
  const leftovers = recognized ? (parsed?.unsupportedClauses ?? []).filter((c) => REQUEST_LIKE.test(c)) : [];
  // Tables override pack; NL contentPatch overlays on top when present.
  const content =
    recognized && parsed?.contentPatch
      ? { ...contentBase, ...parsed.contentPatch }
      : contentBase;
  const theme = recognized && parsed?.theme ? parsed.theme : pack.theme;
  return {
    configure: {
      op: "configure_auto_battler" as const,
      config: {
        playerCount: 2,
        unsupported: [
          AUTO_BATTLER_BASE_UNSUPPORTED,
          ...tables.unsupported,
          ...leftovers.map((c) => `未执行的创作者要求：「${c}」——当前内核没有对应的可配置项。`),
        ],
        content,
        theme,
        branding,
        ...((() => {
          const tuning = { ...(tables.tuning ?? {}), ...(parsed?.tuning ?? {}) };
          return Object.keys(tuning).length ? { tuning } : {};
        })()),
      },
    },
    assetIntents: parsed?.assetIntents,
  };
}

/* applyAssetIntentsToConfigure defined after CreatorJobHost */

import { createActionDescriptionIterationPlan, IterationPlanError } from "./rule-system-iteration";
import {
  PROJECT_PREFIX,
  generationPlanKey,
  json,
  error,
  normalizedProjectRecord,
  normalizedBuild,
  type ProjectRecord,
  type StoredPlayableBuild,
} from "./project-operations";
import {
  defaultFreightContent,
  defaultTicketsContent,
  freightUnsupportedNotes,
  ideaRequestsFreightLogistics,
  ideaRequestsTicketsRoute,
  parseFreightTuningFromIdea,
  ticketsUnsupportedNotes,
} from "../src/runtime/adapters/network-route";
import {
  defaultHarborContent,
  defaultGalleryContent,
  galleryAuctionUnsupportedNotes,
  harborAuctionUnsupportedNotes,
  ideaRequestsGalleryAuction,
  ideaRequestsHarborAuction,
  parseGalleryTuningFromIdea,
  parseGallerySeatsFromIdea,
  parseHarborTuningFromIdea,
} from "../src/runtime/adapters/auction-bidding";
import {
  defaultGemEngineContent,
  gemEngineUnsupportedNotes,
} from "../src/runtime/adapters/gem-engine";
import {
  defaultPatternDraftContent,
  patternDraftUnsupportedNotes,
} from "../src/runtime/adapters/pattern-draft";

interface CreatorJobHost {
  ctx: DurableObjectState;
  /** Worker env (ASSET_SERVER_URL); optional in unit tests → asset search falls back to procedural. */
  env?: Env;
  /** Same-project HTTP helper used by CC0 pull / imported-assets list. */
  projectRequest?: (path: string, init?: RequestInit) => Promise<Response>;
  saveJob(job: CreatorJob, input?: SubmitJobInput): Promise<void>;
  schedulePendingJobRecovery(): Promise<void>;
  /** Optional: alarm-merging job grace (keeps Room AI turns on time). */
  requestJobRecoveryAlarm?(): Promise<void>;
  applyProjectChanges(
    projectId: string,
    input: ApplyProjectChangesInput,
  ): Promise<Response>;
  compileProjectBuild(
    projectId: string,
    input: CompileBuildInput,
  ): Promise<Response>;
  createBuildPlaytest(
    buildId: string,
    input: { seed: number; idempotencyKey: string },
  ): Promise<Response>;
  createBuildSession(
    buildId: string,
    input: {
      seed: number;
      idempotencyKey: string;
      hypothesisId?: string;
      aiSeats?: unknown;
      aiThinkMs?: unknown;
    },
  ): Promise<Response>;
}

async function applyAssetIntentsToConfigure(
  host: CreatorJobHost,
  projectId: string,
  configure: { op: "configure_auto_battler"; config: Record<string, unknown> },
  intents: NonNullable<ReturnType<typeof parseKernelEdits>>["assetIntents"],
  idempotencyKey: string,
  baseContent?: unknown,
) {
  if (!intents?.length) return { configure, lines: [] as string[] };
  const content = resolveAutoBattlerContent(
    (configure.config.content as unknown) ?? baseContent,
  ) ?? DEFAULT_AUTO_BATTLER_CONTENT;
  let contentPatch: Record<string, unknown> = {};
  let lines: string[] = [];
  if (host.env && host.projectRequest) {
    const fulfilled = await fulfillAssetAttachIntents({
      env: host.env,
      projectRequest: host.projectRequest,
      projectId,
      content,
      intents,
      idempotencyKey,
    });
    contentPatch = fulfilled.contentPatch as Record<string, unknown>;
    lines = fulfilled.report.lines;
  } else {
    // Unit tests / no sidecar: honest procedural fallback for every intent.
    const units = content.units.map((u) => ({ ...u, traits: [...u.traits] }));
    lines = intents.map((intent) => {
      if (intent.kind === "procedural") {
        return intent.allFallbacks
          ? "资产：无素材时用程序化风格化棋子（本环境未接资产服务，保持 proceduralPreset）。"
          : `资产：单位 ${intent.unitHint} → 程序化风格化棋子（本环境未接资产服务）。`;
      }
      return `资产：请求挂模型（${intent.kind}:${intent.unitHint}）但本环境未接资产服务 → 程序化风格化棋子兜底。`;
    });
    contentPatch = { units };
  }
  const unsupported = [
    ...((configure.config.unsupported as string[] | undefined) ?? []),
    ...lines,
  ];
  return {
    configure: {
      ...configure,
      config: {
        ...configure.config,
        content: {
          ...((configure.config.content as object) ?? {}),
          ...contentPatch,
        },
        unsupported,
      },
    },
    lines,
  };
}


/** Deterministic positive seed from a job idempotency key (Shared Session auto-handoff). */
function deterministicJobSeed(idempotencyKey: string): number {
  let hash = 0;
  for (let i = 0; i < idempotencyKey.length; i += 1) {
    hash = (Math.imul(hash, 31) + idempotencyKey.charCodeAt(i)) | 0;
  }
  const seed = Math.abs(hash);
  return seed === 0 ? 1 : seed;
}

/** MCP/Connect-facing generate result: drop bulky ruleSystem/sources/project blobs. */
function slimGenerateJobResult(
  body: Record<string, unknown>,
  projectId: string,
): Record<string, unknown> {
  const slim: Record<string, unknown> = {
    generationMode: body.generationMode,
    warnings: Array.isArray(body.warnings) ? body.warnings : [],
    studioPath: typeof body.studioPath === "string"
      ? body.studioPath
      : `/studio/${projectId}`,
  };
  if (body.artifactState) slim.artifactState = body.artifactState;
  if (body.build && typeof body.build === "object") {
    slim.build = body.build;
  }
  if (body.session && typeof body.session === "object") {
    slim.session = body.session;
  }
  return slim;
}

export async function runCreatorJob(
  host: CreatorJobHost,
  jobId: string,
  submittedInput?: SubmitJobInput,
) {
  let job = await host.ctx.storage.get<CreatorJob>(`job:${jobId}`);
  if (!job || job.status === "succeeded" || job.status === "failed") return;
  if (
    job.status === "running" &&
    Date.now() - Date.parse(job.updatedAt) < 25_000
  ) {
    return;
  }
  const input =
    submittedInput ??
    await host.ctx.storage.get<SubmitJobInput>(`job-input:${jobId}`);
  if (!input) {
    job = {
      ...job,
      status: "failed",
      error: "job_input_missing",
      updatedAt: new Date().toISOString(),
    };
    await host.saveJob(job);
    await host.schedulePendingJobRecovery();
    return;
  }
  job = { ...job, status: "running", updatedAt: new Date().toISOString() };
  await host.saveJob(job);
  if (host.requestJobRecoveryAlarm) await host.requestJobRecoveryAlarm();
  else await host.ctx.storage.setAlarm(Date.now() + 30_000);

  try {
    let operation: Response;
    let generationRuntimeConfigured = false;
    let proposedRuntime: RuntimeConfigureOperation | null = null;
    let autoBattlerAssetIntents: NonNullable<ReturnType<typeof parseKernelEdits>>["assetIntents"];
    let nonScoreHandLoopRefused = false;
    let weakGenreScoreRaceRefused = false;
    let multiActHiddenRoleRefused = false;
    let patternDraftRefused = false;
    if (input.kind === "generate-rule-system") {
      const pendingPlan = await host.ctx.storage.get<GenerationPlan>(
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
      const sourceGenre = inferSourceGenre(
        `${input.name?.trim() || ""}\n${authoredMaterial}`,
      );
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
      multiActHiddenRoleRefused =
        sourceGenre === "hidden-role" &&
        isMultiActHiddenRoleCorpus(authoredMaterial);
      const hiddenRoleRuntimeConfigured =
        sourceGenre === "hidden-role" && !multiActHiddenRoleRefused;
      // PR5/PR6/PR11/PR12 thin bind: Othello → disc-flipping-v1; hex-island → hex-settlement-v1;
      // line network → network-route-v1; card/area-control → hand-play-v1.
      // Never silently substitute across genres.
      const requestedMechanics = inferRequestedMechanics(
        `${input.name ?? ""}\n${idea}\n${authoredMaterial}`,
      );
      nonScoreHandLoopRefused =
        sourceGenre === "hand-play" &&
        drawAndScoreRule === null &&
        isNonScoreHandLoopCorpus(authoredMaterial);
      // Finite shuffled draw-and-score wins over hand-play genre cues (W4-05).
      // PR12: also bind when requestedMechanics declares hand-play (card/area-control).
      const autoBattlerRuntimeConfigured =
        requestedMechanics.includes("auto-battler") &&
        !requestedMechanics.some((mechanic) =>
          ["hex-settlement", "disc-flipping", "route-network", "gem-engine"].includes(mechanic),
        );
      // T008: hand-play must not steal route-network / hex subjects (even when corpus says 手牌).
      const handPlayRuntimeConfigured =
        (sourceGenre === "hand-play" ||
          requestedMechanics.includes("hand-play")) &&
        drawAndScoreRule === null &&
        !nonScoreHandLoopRefused &&
        !autoBattlerRuntimeConfigured &&
        !requestedMechanics.includes("route-network") &&
        !requestedMechanics.includes("hex-settlement") &&
        !requestedMechanics.includes("disc-flipping") &&
        !requestedMechanics.includes("auction-bidding") &&
        !requestedMechanics.includes("gem-engine");
      const harborLikePlacement =
        sourceGenre === "placement" && isHarborLikeCorpus(authoredMaterial);
      const workerPlacementRuntimeConfigured =
        sourceGenre === "placement" && !harborLikePlacement;
      const harborVoyageRuntimeConfigured = harborLikePlacement;
      // Conversation needs text-bearing speech acts, not a point harvest (W3-02 / W3-05).
      const conversationRelayRuntimeConfigured =
        sourceGenre === "conversation" &&
        generatedRuleSystem.actions.length > 0 &&
        generatedRuleSystem.actions.length <= 12;
      const hexSettlementRuntimeConfigured =
        requestedMechanics.includes("hex-settlement");
      const discFlippingRuntimeConfigured =
        requestedMechanics.includes("disc-flipping") &&
        !requestedMechanics.includes("hex-settlement");
      const networkRouteRuntimeConfigured =
        requestedMechanics.includes("route-network") &&
        !requestedMechanics.includes("hex-settlement") &&
        !requestedMechanics.includes("disc-flipping");
      const auctionBiddingRuntimeConfigured =
        requestedMechanics.includes("auction-bidding") &&
        !autoBattlerRuntimeConfigured &&
        !requestedMechanics.some((mechanic) => ["hex-settlement", "disc-flipping", "route-network", "hand-play", "gem-engine"].includes(mechanic));
      const gemEngineRuntimeConfigured =
        requestedMechanics.includes("gem-engine") &&
        !autoBattlerRuntimeConfigured &&
        !hexSettlementRuntimeConfigured &&
        !discFlippingRuntimeConfigured &&
        !networkRouteRuntimeConfigured &&
        !auctionBiddingRuntimeConfigured;
      const patternDraftRuntimeConfigured =
        requestedMechanics.includes("pattern-draft") &&
        !autoBattlerRuntimeConfigured &&
        !hexSettlementRuntimeConfigured &&
        !discFlippingRuntimeConfigured &&
        !networkRouteRuntimeConfigured &&
        !auctionBiddingRuntimeConfigured &&
        !gemEngineRuntimeConfigured;
      weakGenreScoreRaceRefused =
        sourceGenre === "generic" &&
        drawAndScoreRule === null &&
        pushYourLuckRule === null &&
        takeAwayRule === null &&
        rollAndMoveRule === null &&
        hasWeakGenreScoreRaceLeak(authoredMaterial) &&
        !sharedGoal &&
        sourceRuntimeActions.length > 0 &&
        sourceRuntimeActions.length === generatedRuleSystem.actions.length &&
        generatedRuleSystem.actions.length <= 12 &&
        Number.isInteger(victoryTarget) &&
        victoryTarget > 0;
      const scoreRaceRuntimeConfigured =
        sourceGenre === "generic" &&
        !weakGenreScoreRaceRefused &&
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
      // T009/T013: factory/pattern-wall corpus — bind pattern-draft-v1 when inferred; else refuse turn-taking.
      patternDraftRefused =
        isPatternDraftCorpus(authoredMaterial) &&
        !patternDraftRuntimeConfigured &&
        !requestedMechanics.includes("pattern-draft") &&
        !requestedMechanics.includes("route-network") &&
        !requestedMechanics.includes("hex-settlement") &&
        !requestedMechanics.includes("disc-flipping") &&
        !requestedMechanics.includes("auction-bidding") &&
        !requestedMechanics.includes("auto-battler") &&
        !requestedMechanics.includes("gem-engine") &&
        !requestedMechanics.includes("hand-play") &&
        !handPlayRuntimeConfigured &&
        !hexSettlementRuntimeConfigured &&
        !networkRouteRuntimeConfigured &&
        !auctionBiddingRuntimeConfigured &&
        !gemEngineRuntimeConfigured &&
        !autoBattlerRuntimeConfigured;
      const turnTakingRuntimeConfigured =
        !sharedGoal &&
        !scoreRaceRuntimeConfigured &&
        !conversationRelayRuntimeConfigured &&
        !takeAwayRuntimeConfigured &&
        !rollAndMoveRuntimeConfigured &&
        !drawAndScoreRuntimeConfigured &&
        !pushYourLuckRuntimeConfigured &&
        !patternDraftRefused &&
        turnTaking &&
        sourceRuntimeActions.length === 0 &&
        generatedRuleSystem.actions.length > 0 &&
        generatedRuleSystem.actions.length <= 12;
      generationRuntimeConfigured =
        hexSettlementRuntimeConfigured ||
        discFlippingRuntimeConfigured ||
        networkRouteRuntimeConfigured ||
        autoBattlerRuntimeConfigured ||
        auctionBiddingRuntimeConfigured ||
        gemEngineRuntimeConfigured ||
        patternDraftRuntimeConfigured ||
        hiddenRoleRuntimeConfigured ||
        handPlayRuntimeConfigured ||
        harborVoyageRuntimeConfigured ||
        workerPlacementRuntimeConfigured ||
        conversationRelayRuntimeConfigured ||
        scoreRaceRuntimeConfigured ||
        sharedGoalRuntimeConfigured ||
        takeAwayRuntimeConfigured ||
        rollAndMoveRuntimeConfigured ||
        drawAndScoreRuntimeConfigured ||
        pushYourLuckRuntimeConfigured ||
        turnTakingRuntimeConfigured;
      // Non-score hand loop: refuse all kernels (no turn-taking fallthrough warning either).
      if (nonScoreHandLoopRefused) {
        generationRuntimeConfigured = false;
      }
      // W4-05: weak genre cues must not silently configure score-race.
      if (weakGenreScoreRaceRefused) {
        generationRuntimeConfigured = false;
      }
      // W4-06: multi-act / clue-board scripts must not wear one-shot speak→accuse.
      if (multiActHiddenRoleRefused) {
        generationRuntimeConfigured = false;
      }
      // T009: factory / pattern-wall draft — keep draft, no turn-taking executable.
      if (patternDraftRefused) {
        generationRuntimeConfigured = false;
      }
      const pushMaxActions = Math.min(10_000, Math.max(
        200,
        (pushYourLuckRule?.victoryTarget ?? 0) * generatedRuleSystem.participants.default * 5,
      ));
      // Refuse configure for non-score hand loops (no silent play-to-score / turn-taking fallthrough).
      const runtimeOperation = nonScoreHandLoopRefused || weakGenreScoreRaceRefused || multiActHiddenRoleRefused || patternDraftRefused
        ? null
        : hexSettlementRuntimeConfigured
        ? {
            op: "configure_hex_settlement" as const,
            config: {
              playerCount: 2,
              victoryPointsToWin: 10,
              unsupported: [
                "hex-settlement-v1 executes beginner-board hex-island basics (placement, production, robber/discard, build+connectivity, bank/port + negotiated domestic trade propose/accept, development cards, VP win) on the public play-kernel; board HUD + lobby thumbnail landed in PR7/PR8 — 3–4 seat domestic auction / complex multi-party brokerage remain out of scope.",
              ],
            },
          }
        : discFlippingRuntimeConfigured
        ? {
            op: "configure_disc_flipping" as const,
            config: {
              playerCount: 2,
              rows: 8,
              cols: 8,
              unsupported: [
                "disc-flipping-v1 executes 8×8 (or configured) grid placement, eight-direction continuous flips, forced pass, and terminal disc-count scoring on the public play-kernel; board HUD + lobby thumbnail landed in PR7/PR8.",
              ],
            },
          }
        : networkRouteRuntimeConfigured
        ? (() => {
            const freight = ideaRequestsFreightLogistics(idea);
            const tickets = !freight && ideaRequestsTicketsRoute(idea);
            const tuning = freight ? parseFreightTuningFromIdea(idea) : {};
            const content = freight ? defaultFreightContent(tuning) : undefined;
            const ticketsContent = tickets ? defaultTicketsContent() : undefined;
            const unsupported = freight
              ? [
                  "network-route-v1 freight subset: claim-graph cargo contracts + ship cargo slots + funds/reputation win; per-step sailing / pirate·storm events unsupported.",
                  ...freightUnsupportedNotes(),
                ]
              : tickets
                ? [...ticketsUnsupportedNotes()]
                : [
                    "network-route-v1 executes a fixed city graph with alternate-turn route claims and first-to-connect terminal hubs on the public play-kernel; a minimal original route game (no tickets deck / multi-color routes / scoring table).",
                  ];
            return {
              op: "configure_network_route" as const,
              config: {
                playerCount: 2,
                ...(freight ? { freight: true as const } : {}),
                ...(tickets ? { tickets: true as const } : {}),
                ...(content ? { content } : {}),
                ...(ticketsContent ? { ticketsContent } : {}),
                unsupported,
              },
            };
          })()
        : autoBattlerRuntimeConfigured
        ? (() => { const ab = autoBattlerProposedRuntime(idea); autoBattlerAssetIntents = ab.assetIntents; return ab.configure; })()
        : auctionBiddingRuntimeConfigured
        ? (() => {
            const gallery = ideaRequestsGalleryAuction(idea);
            const harbor = !gallery && ideaRequestsHarborAuction(idea);
            if (gallery) {
              const tuning = parseGalleryTuningFromIdea(idea);
              const seats =
                tuning.playerCount ??
                parseGallerySeatsFromIdea(idea) ??
                Math.max(
                  2,
                  Math.min(5, generatedRuleSystem.participants.default || 3),
                );
              const playerCount = Math.max(2, Math.min(5, seats));
              const galleryContent = defaultGalleryContent({
                ...tuning,
                playerCount,
              });
              return {
                op: "configure_auction_bidding" as const,
                config: {
                  playerCount,
                  gallery: true as const,
                  galleryContent,
                  unsupported: [
                    "auction-bidding-v1 gallery subset: 2–5 seats, open/sealed/fixed/double-fixed + market sell + round-start refill; 仅部分能力.",
                    ...galleryAuctionUnsupportedNotes(),
                  ],
                },
              };
            }
            const tuning = harbor ? parseHarborTuningFromIdea(idea) : {};
            const content = harbor ? defaultHarborContent(tuning) : undefined;
            const unsupported = harbor
              ? [
                  "auction-bidding-v1 harbor subset: multi-lot queue + open/sealed resolve + black-market resale; 3–4 seats / live simultaneous sealed / negotiated trades unsupported.",
                  ...harborAuctionUnsupportedNotes(),
                ]
              : [
                  "auction-bidding-v1 plays one open lot with alternate raise/pass, 20 chips per seat, and award or unsold resolution; multi-lot economies and sealed bids are unsupported.",
                ];
            return {
              op: "configure_auction_bidding" as const,
              config: {
                playerCount: 2,
                ...(harbor ? { harbor: true as const } : {}),
                ...(content ? { content } : {}),
                unsupported,
              },
            };
          })()
        : gemEngineRuntimeConfigured
        ? {
            op: "configure_gem_engine" as const,
            config: {
              playerCount: 2,
              content: defaultGemEngineContent(),
              unsupported: [
                "gem-engine-v1 executes a 2-seat gem-token / development-card / noble prestige loop on the public play-kernel.",
                ...gemEngineUnsupportedNotes(),
              ],
            },
          }
        : patternDraftRuntimeConfigured
        ? {
            op: "configure_pattern_draft" as const,
            config: {
              playerCount: 2,
              content: defaultPatternDraftContent(),
              unsupported: [
                "pattern-draft-v1 executes a 2-seat factory draft / pattern-line / wall-tile / floor-penalty loop on the public play-kernel.",
                ...patternDraftUnsupportedNotes(),
              ],
            },
          }
        : hiddenRoleRuntimeConfigured
        ? {
            op: "configure_hidden_role" as const,
            config: {
              playerCount: generatedRuleSystem.participants.default,
              roles: deriveHiddenRoles(
                authoredMaterial,
                generatedRuleSystem.participants.default,
              ),
              unsupported: [
                "hidden-role-v1 executes source-derived secret roles (defaults 凶手/侦探/平民), one public speech per seat, one accusation per seat, and majority reveal; multi-act scripts, clue boards, and LLM-judged narrative wins remain unsupported.",
              ],
            },
          }
        : handPlayRuntimeConfigured
        ? (() => {
            const deck = deriveHandPlayDeck(authoredMaterial);
            return {
              op: "configure_hand_play" as const,
              config: {
                playerCount: generatedRuleSystem.participants.default,
                cardValues: deck.cardValues,
                copiesPerValue: deck.copiesPerValue,
                handSize: deck.handSize,
                victoryTarget: deck.victoryTarget,
                actions: [{ id: "play" as const, label: /[\u4e00-\u9fff]/.test(authoredMaterial) ? "打出一张手牌" : "Play a card" }],
                unsupported: [
                  "hand-play-v1 executes a source-derived shuffled deck, hidden hands, play-to-score, and first-to-target or highest score when hands empty; trick-taking, shedding, suits, and card effects remain unsupported.",
                ],
              },
            };
          })()
        : conversationRelayRuntimeConfigured
        ? {
            op: "configure_conversation_relay" as const,
            config: {
              maxTurns,
              actions: generatedRuleSystem.actions.map((action) => ({
                id: action.id,
                label: action.label,
              })),
              unsupported: [
                "conversation-relay-v1 records required speech into the transcript and ends on the turn budget; prose quality is judged by people (no kernel score race).",
              ],
            },
          }
        : harborVoyageRuntimeConfigured
        ? {
            op: "configure_harbor_voyage" as const,
            config: {
              playerCount: Math.max(
                2,
                Math.min(3, generatedRuleSystem.participants.default),
              ),
              unsupported: [
                "harbor-voyage-v1 executes a fixed 2–3 player harbor table placement, movement, pilot, and settlement loop; source-specific boards, resources, buildings, and victory conditions remain unsupported.",
                ...(generatedRuleSystem.participants.default > 3
                  ? [
                      `The source asked for ${generatedRuleSystem.participants.default} players; harbor-voyage-v1 clamps to 3 without inventing a larger table.`,
                    ]
                  : generatedRuleSystem.participants.default < 2
                    ? [
                        `The source asked for ${generatedRuleSystem.participants.default} players; harbor-voyage-v1 requires at least 2.`,
                      ]
                    : []),
              ],
            },
          }
        : workerPlacementRuntimeConfigured
        ? (() => {
            const playerCount = Math.max(
              2,
              Math.min(6, generatedRuleSystem.participants.default),
            );
            const economy = isEconomyPlacementCorpus(authoredMaterial);
            const regions = deriveWorkerPlacementRegions(authoredMaterial);
            const workersPerSeat = deriveWorkersPerSeat(
              authoredMaterial,
              playerCount,
            );
            const victoryBuildings = economy
              ? deriveVictoryBuildings(authoredMaterial)
              : null;
            const earlyTarget =
              !economy &&
              Number.isInteger(victoryTarget) &&
              victoryTarget > 0
                ? victoryTarget
                : null;
            return {
              op: "configure_worker_placement" as const,
              config: {
                playerCount,
                workersPerSeat,
                startingCoins: 0,
                regions,
                victoryTarget: earlyTarget,
                victoryBuildings,
                unsupported: [
                  economy
                    ? "worker-placement-v1 economy subset executes region wood yields, one wood→building convert, and victory by buildings built; multi-resource graphs and building trees remain unsupported."
                    : "worker-placement-v1 executes source-derived named regions with capacity, worker placement, occupation, and resolve scoring on that board; multi-resource conversion, building trees, dice movement, and other advanced placement engines remain unsupported.",
                  "Generic placement briefs are not mapped onto harbor cargo IDs (amber/cobalt/cedar or 琥珀货/东栈桥).",
                  ...(generatedRuleSystem.participants.default > 6
                    ? [
                        `The source asked for ${generatedRuleSystem.participants.default} players; worker-placement-v1 clamps to 6.`,
                      ]
                    : generatedRuleSystem.participants.default < 2
                      ? [
                          `The source asked for ${generatedRuleSystem.participants.default} players; worker-placement-v1 requires at least 2.`,
                        ]
                      : []),
                ],
              },
            };
          })()
        : pushYourLuckRuntimeConfigured
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
      const capabilityGap = gameSpecCapabilityGap(`${input.name ?? ""}\n${idea}\n${authoredMaterial}`);
      proposedRuntime = capabilityGap ? null : runtimeOperation;
      if (proposedRuntime?.op === "configure_auto_battler" && autoBattlerAssetIntents?.length) {
        const applied = await applyAssetIntentsToConfigure(
          host, job.projectId, proposedRuntime as { op: "configure_auto_battler"; config: Record<string, unknown> },
          autoBattlerAssetIntents, `job:${input.idempotencyKey}:gen-assets`,
          (proposedRuntime as { config?: { content?: unknown } }).config?.content,
        );
        proposedRuntime = applied.configure as typeof proposedRuntime;
      }
      if (capabilityGap) generationRuntimeConfigured = false;
      operation = await host.applyProjectChanges(job.projectId, {
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
            fields: {
              ...generatedRuleSystem,
              generation: {
                generatorVersion: GENERATOR_VERSION,
                rulesVersion: RULES_VERSION,
                requestedMechanics: inferRequestedMechanics(`${input.name ?? ""}\n${idea}\n${authoredMaterial}`),
                sourcePrompt: idea,
                seed: deterministicJobSeed(input.idempotencyKey),
                assumptions: [
                  "规则来自当前来源的确定性抽取，尚未获得完整规则实现保证。",
                  "配置内核后，初始状态、可见性、阶段推进和终局由该版本内核负责。",
                  ...(capabilityGap ? [capabilityGap] : []),
                  ...(proposedRuntime ? [`提议的内核及参数：${JSON.stringify(proposedRuntime)}`] : []),
                ],
              },
            },
          },
        ],
      });
    } else if (input.kind === "iterate-rule-system") {
      const stored = await host.ctx.storage.get<ProjectRecord>(
        `${PROJECT_PREFIX}${job.projectId}`,
      );
      if (!stored) throw new Error("project_not_found");
      const record = normalizedProjectRecord(stored);
      const generationPlan = await host.ctx.storage.get<GenerationPlan>(
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
      const iterationInput = {
        ruleSystem: record.ruleSystem,
        prompt: input.prompt,
        sourceId: `source_${job.id}`,
      };
      // Generic: numeric knobs the active kernel declares (timers, start HP/gold…) first,
      // then the original single-action description rewrite.
      let plan: ReturnType<typeof createActionDescriptionIterationPlan> | NonNullable<ReturnType<typeof createKernelTuningIterationPlan>> | undefined;
      try {
        plan =
          createKernelTuningIterationPlan(iterationInput) ??
          createActionDescriptionIterationPlan(iterationInput);
      } catch (reason) {
        // Guidance is a successful, no-change answer ("already available elsewhere").
        if (reason instanceof IterationPlanError && reason.code === "iteration_guidance") {
          plan = undefined;
          operation = json({ guidance: reason.message.replace(/^iteration_guidance:\s*/, ""), prompt: input.prompt });
        } else {
          throw reason;
        }
      }
      const tuningPlan = plan && "assetIntents" in plan
        ? (plan as NonNullable<ReturnType<typeof createKernelTuningIterationPlan>>)
        : undefined;
      let expectedVersion = input.expectedVersion;
      if (tuningPlan?.assetIntents?.length) {
        const ops = [...tuningPlan.operations];
        const cfgIdx = ops.findIndex((op) => op.op === "configure_auto_battler");
        if (cfgIdx >= 0) {
          const support = record.ruleSystem.runtimeSupport;
          const baseContent = support.status === "executable" && support.kernel.type === "auto-battler-v1"
            ? (support.kernel as { content?: unknown }).content
            : undefined;
          const applied = await applyAssetIntentsToConfigure(
            host,
            job.projectId,
            ops[cfgIdx] as { op: "configure_auto_battler"; config: Record<string, unknown> },
            tuningPlan.assetIntents,
            `job:${input.idempotencyKey}:iter-assets`,
            baseContent,
          );
          ops[cfgIdx] = applied.configure as (typeof ops)[number];
          plan = {
            ...tuningPlan,
            operations: ops,
            summary: `${tuningPlan.summary}${applied.lines.length ? ` ${applied.lines.join(" ")}` : ""}`,
          };
          // CC0 import bumps project.version — refresh before configure apply.
          if (host.projectRequest) {
            const fresh = await host.projectRequest(`/projects/${job.projectId}`);
            if (fresh.ok) {
              const body = await fresh.json() as { version?: number; project?: { version?: number } };
              const v = body.project?.version ?? body.version;
              if (typeof v === "number" && v >= expectedVersion) expectedVersion = v;
            }
          }
        }
      }
      operation = !plan ? operation! : await host.applyProjectChanges(job.projectId, {
        expectedVersion,
        idempotencyKey: `job:${input.idempotencyKey}`,
        operations: plan.operations,
      });
      if (plan && operation.ok) {
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
      operation = await host.compileProjectBuild(job.projectId, {
        expectedVersion: input.expectedVersion,
        basedOnFindingId: input.basedOnFindingId,
        idempotencyKey: `job:${input.idempotencyKey}`,
      });
    } else if (input.kind === "bot-playtest") {
      operation = await host.createBuildPlaytest(input.buildId, {
        seed: input.seed,
        idempotencyKey: `job:${input.idempotencyKey}`,
      });
    } else {
      const storedBuild = await host.ctx.storage.get<StoredPlayableBuild>(
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
      let autoCompileWarning: string | undefined;
      const generatedRuleSystem = operationBody.ruleSystem as RuleSystem | undefined;
      const generatedSources = operationBody.sources as SourceLibraryEntry[] | undefined;
      if (!generatedRuleSystem || !Array.isArray(generatedSources)) {
        throw new Error("generation_plan_materialization_missing");
      }
      const generationRefuse: GenerationRefuseKind | undefined = nonScoreHandLoopRefused
        ? "non-score-hand"
        : multiActHiddenRoleRefused
          ? "multi-act-hidden-role"
          : weakGenreScoreRaceRefused
            ? "weak-genre-score-race"
            : patternDraftRefused
              ? "pattern-draft"
              : undefined;
      const generationPlan = createGenerationPlan({
        id: `generation_plan_${job.id}`,
        projectId: job.projectId,
        generationJobId: job.id,
        ruleSystem: generatedRuleSystem,
        sourceIds: generatedSources.map((source) => source.id),
        proposedRuntime: proposedRuntime ?? undefined,
        ...(generationRefuse ? { generationRefuse } : {}),
        createdAt: new Date().toISOString(),
      });
      await host.ctx.storage.put(
        generationPlanKey(job.projectId),
        generationPlan,
      );
      operationBody.generationPlan = generationPlan;
      // A complete conversation proposal can pass the same share gates before
      // anyone needs to review a draft in Studio. Apply it through the normal
      // approval mutation so the persisted Rule System and plan stay in sync.
      if (
        !generationRefuse &&
        proposedRuntime?.op === "configure_conversation_relay" &&
        generatedRuleSystem.runtimeSupport.status === "draft"
      ) {
        const candidate: RuleSystem = {
          ...generatedRuleSystem,
          runtimeSupport: {
            status: "executable",
            unsupported: proposedRuntime.config.unsupported ?? [],
            kernel: {
              type: "conversation-relay-v1",
              maxTurns: proposedRuntime.config.maxTurns,
              actions: proposedRuntime.config.actions.map(({ id, label }) => ({ id, label })),
            },
          },
        };
        refreshGameSpec(candidate);
        if (
          playabilityFloor(candidate).status === "passed" &&
          presentationFloor(candidate).status === "passed"
        ) {
          const project = operationBody.project as { version: number };
          const approval = await host.applyProjectChanges(job.projectId, {
            expectedVersion: project.version,
            idempotencyKey: `job:${input.idempotencyKey}:approve-plan`,
            operations: [{ op: "approve_generation_plan", planId: generationPlan.id }],
          });
          if (approval.ok) {
            const approved = await approval.json<Record<string, unknown>>();
            operationBody.project = approved.project;
            operationBody.ruleSystem = approved.ruleSystem;
            operationBody.sources = approved.sources;
            operationBody.generationPlan = approved.generationPlan;
            const approvedProject = approved.project as { version: number };
            try {
              const compileResponse = await host.compileProjectBuild(job.projectId, {
                expectedVersion: approvedProject.version,
                idempotencyKey: `job:${input.idempotencyKey}:compile`,
              });
              if (compileResponse.ok) {
                const compiled = await compileResponse.json<Record<string, unknown>>();
                if (compiled.build !== undefined) {
                  // Keep generate job results small for MCP track_job: attach a
                  // slim build summary only (full StoredPlayableBuild + cloned
                  // ruleSystem can stall ChatGPT Connect transfer/UI).
                  const fullBuild = compiled.build as {
                    id: string;
                    projectId: string;
                    presentationFloor: unknown;
                    playabilityFloor: unknown;
                    createdAt: string;
                  };
                  operationBody.build = {
                    id: fullBuild.id,
                    projectId: fullBuild.projectId,
                    presentationFloor: fullBuild.presentationFloor,
                    playabilityFloor: fullBuild.playabilityFloor,
                    createdAt: fullBuild.createdAt,
                  };
                  // Same path as POST /builds/:id/sessions and create_shared_session:
                  // mint a real Shared Session so Connect gets sessionUrl with share=
                  // without a fragile second round-trip.
                  try {
                    const sessionResponse = await host.createBuildSession(fullBuild.id, {
                      seed: deterministicJobSeed(input.idempotencyKey),
                      idempotencyKey: `job:${input.idempotencyKey}:session`,
                    });
                    if (sessionResponse.ok) {
                      const room = await sessionResponse.json<{
                        id: string;
                        projectId: string;
                        buildId: string;
                        seed: number;
                        replayId: string;
                        createdAt: string;
                      }>();
                      operationBody.session = {
                        id: room.id,
                        projectId: room.projectId,
                        buildId: room.buildId,
                        seed: room.seed,
                        replayId: room.replayId,
                        createdAt: room.createdAt,
                        seats: [],
                      };
                    } else {
                      const sessionBody = await sessionResponse
                        .json<Record<string, unknown>>()
                        .catch(() => ({}) as Record<string, unknown>);
                      autoCompileWarning = String(
                        sessionBody.error ?? `session_http_${sessionResponse.status}`,
                      );
                    }
                  } catch (sessionReason) {
                    autoCompileWarning = sessionReason instanceof Error
                      ? sessionReason.message
                      : "session_create_failed";
                  }
                }
                if (compiled.project !== undefined) {
                  operationBody.project = compiled.project;
                }
                if (compiled.changeset !== undefined) {
                  operationBody.changeset = compiled.changeset;
                }
                if (typeof compiled.studioPath === "string") {
                  operationBody.studioPath = compiled.studioPath;
                }
              } else {
                const compileBody = await compileResponse
                  .json<Record<string, unknown>>()
                  .catch(() => ({}) as Record<string, unknown>);
                autoCompileWarning = String(
                  compileBody.error ?? `http_${compileResponse.status}`,
                );
              }
            } catch (compileReason) {
              autoCompileWarning = compileReason instanceof Error
                ? compileReason.message
                : "compile_failed";
            }
          }
        }
      }
      operationBody.generationMode = "deterministic-rule-system-materialization";
      operationBody.warnings = [operationBody.generationPlan !== generationPlan
        ? operationBody.session
          ? "Generation Plan 已自动批准；Build 与 Shared Session 已就绪。请粘贴 result.session.sessionUrl（含 share=）并停止；勿编造邀请文案，勿在终端成功后继续 poll。"
          : operationBody.build
          ? autoCompileWarning
            ? `Generation Plan 已自动批准；Build 已就绪且通过分享门槛。自动创建 Shared Session 失败（${autoCompileWarning}）；可用 result.build.id 调用 create_shared_session。`
            : "Generation Plan 已自动批准；Build 已就绪且通过分享门槛。下一步用该 buildId 调用 create_shared_session。"
          : autoCompileWarning
            ? `Generation Plan 已自动批准；conversation-relay-v1 可执行且通过分享门槛。自动编译 Build 失败（${autoCompileWarning}）；可稍后单独 submit_job compile-build。`
            : "Generation Plan 已自动批准；conversation-relay-v1 可执行且通过分享门槛。"
        : generationRuntimeConfigured
        ? proposedRuntime?.op === "configure_hex_settlement"
          ? "规则结构来自体裁识别；六角盘面、资源产出、道路连通建造、交易与发展牌将在批准 Generation Plan 后配置为 hex-settlement-v1（公共 play-kernel 适配器）。"
          : proposedRuntime?.op === "configure_disc_flipping"
          ? "规则结构来自体裁识别；方格翻子、八方向翻转、强制跳过与终盘计分将在批准 Generation Plan 后配置为 disc-flipping-v1（公共 play-kernel 适配器）。"
          : proposedRuntime?.op === "configure_network_route"
          ? "规则结构来自体裁识别；城市图铺线、交替占领路线与连通枢纽获胜将在批准 Generation Plan 后配置为 network-route-v1（公共 play-kernel 适配器；最小原创铺线规则）。"
          : proposedRuntime?.op === "configure_auto_battler"
          ? "规则结构来自体裁识别；两人商店买棋、备战上阵与自动战斗将在批准 Generation Plan 后配置为 auto-battler-v1。"
          : proposedRuntime?.op === "configure_auction_bidding"
          ? "规则结构来自体裁识别；两人公开轮流出价或放弃，最高有效出价获得拍品，将在批准 Generation Plan 后配置为 auction-bidding-v1。"
          : proposedRuntime?.op === "configure_gem_engine"
          ? "规则结构来自体裁识别；宝石代币、发展牌永久折扣与贵族声望将在批准 Generation Plan 后配置为 gem-engine-v1。"
          : proposedRuntime?.op === "configure_pattern_draft"
          ? "规则结构来自体裁识别；工厂拿色、准备行与纹样墙计分将在批准 Generation Plan 后配置为 pattern-draft-v1。"
          : proposedRuntime?.op === "configure_hidden_role"
          ? "规则结构来自体裁识别；秘密身份、公开发言与指控将在批准 Generation Plan 后配置为 hidden-role-v1。"
          : proposedRuntime?.op === "configure_hand_play"
          ? "规则结构来自体裁识别；牌库、隐藏手牌与出牌计分将在批准 Generation Plan 后配置为 hand-play-v1。"
          : proposedRuntime?.op === "configure_conversation_relay"
          ? "规则结构来自体裁识别；发言必须写入记录，回合预算内完成接力，将在批准 Generation Plan 后配置为 conversation-relay-v1（不计分赛）。"
          : proposedRuntime?.op === "configure_harbor_voyage"
          ? "规则结构来自体裁识别；港口主题放置环将在批准 Generation Plan 后配置为 harbor-voyage-v1；来源专属棋盘与资源结算仍保持未支持说明。"
          : proposedRuntime?.op === "configure_worker_placement"
          ? "规则结构来自体裁识别；来源具名区域的工人放置环将在批准 Generation Plan 后配置为 worker-placement-v1；不会静默换成港口货船 ID。"
        : proposedRuntime?.op === "configure_roll_and_move"
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
        : nonScoreHandLoopRefused
          ? generationRefuseReason("non-score-hand")
          : multiActHiddenRoleRefused
          ? generationRefuseReason("multi-act-hidden-role")
          : weakGenreScoreRaceRefused
          ? generationRefuseReason("weak-genre-score-race")
          : patternDraftRefused
          ? generationRefuseReason("pattern-draft")
          : generatedRuleSystem.actions.length > 12
          ? "来源识别出超过 Kernel 上限的行动；为避免静默丢弃规则，Rule System 保持 draft，等待创作者明确缩减或配置 Executable Kernel。"
          : "规则结构来自确定性文本抽取；来源不足以证明可执行语义，Rule System 保持 draft，等待显式配置 Executable Kernel。"];
    }
    if (operation.ok && input.kind === "generate-rule-system") {
      const rule = operationBody.ruleSystem as RuleSystem;
      const issues = ruleSystemSpecIssues(rule);
      const gap = gameSpecCapabilityGap(rule.generation?.sourcePrompt ?? "");
      operationBody.artifactState = {
        status: operationBody.build ? "built" : gap ? "capability-gap"
          : proposedRuntime && rule.runtimeSupport.status === "draft" ? "awaiting-approval"
          : issues.length ? "validation-failed" : "build-failed",
        ruleSystemId: rule.id, ruleSystemVersion: rule.version, issues,
      };
    }
    // Auto-compile / Shared Session handoff path must stay MCP-slim (Connect
    // stalls when track_job still ships full ruleSystem/project blobs). Pending
    // generation without a build keeps the richer Studio-oriented result.
    const succeededResult = operation.ok
      ? input.kind === "generate-rule-system" &&
          (operationBody.build !== undefined || operationBody.session !== undefined)
        ? slimGenerateJobResult(operationBody, job.projectId)
        : operationBody
      : undefined;
    job = operation.ok
      ? {
          ...job,
          status: "succeeded",
          result: succeededResult,
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
  await host.saveJob(job);
  await host.schedulePendingJobRecovery();
}
