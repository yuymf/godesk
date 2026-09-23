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
import { inferSourceGenre } from "../src/runtime/genre";
import { defaultHiddenRoles } from "../src/runtime/hidden-role";
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
import { createActionDescriptionIterationPlan } from "./rule-system-iteration";
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

export interface CreatorJobHost {
  ctx: DurableObjectState;
  saveJob(job: CreatorJob, input?: SubmitJobInput): Promise<void>;
  schedulePendingJobRecovery(): Promise<void>;
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
  await host.ctx.storage.setAlarm(Date.now() + 30_000);

  try {
    let operation: Response;
    let generationRuntimeConfigured = false;
    let proposedRuntime: RuntimeConfigureOperation | null = null;
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
      const hiddenRoleRuntimeConfigured = sourceGenre === "hidden-role";
      const handPlayRuntimeConfigured = sourceGenre === "hand-play";
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
      const scoreRaceRuntimeConfigured =
        sourceGenre === "generic" &&
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
        !conversationRelayRuntimeConfigured &&
        !takeAwayRuntimeConfigured &&
        !rollAndMoveRuntimeConfigured &&
        !drawAndScoreRuntimeConfigured &&
        !pushYourLuckRuntimeConfigured &&
        turnTaking &&
        sourceRuntimeActions.length === 0 &&
        generatedRuleSystem.actions.length > 0 &&
        generatedRuleSystem.actions.length <= 12;
      generationRuntimeConfigured =
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
      const pushMaxActions = Math.min(10_000, Math.max(
        200,
        (pushYourLuckRule?.victoryTarget ?? 0) * generatedRuleSystem.participants.default * 5,
      ));
      const runtimeOperation = hiddenRoleRuntimeConfigured
        ? {
            op: "configure_hidden_role" as const,
            config: {
              playerCount: generatedRuleSystem.participants.default,
              roles: defaultHiddenRoles(generatedRuleSystem.participants.default),
              unsupported: [
                "hidden-role-v1 executes secret role assignment, one public speech per seat, one accusation per seat, and majority reveal; narrative quality is judged by people.",
              ],
            },
          }
        : handPlayRuntimeConfigured
        ? {
            op: "configure_hand_play" as const,
            config: {
              playerCount: generatedRuleSystem.participants.default,
              cardValues: [1, 2, 3, 4, 5],
              copiesPerValue: 4,
              handSize: 3,
              victoryTarget: Number.isInteger(victoryTarget) && victoryTarget > 0
                ? victoryTarget
                : 12,
              actions: [{ id: "play" as const, label: /[\u4e00-\u9fff]/.test(authoredMaterial) ? "打出一张手牌" : "Play a card" }],
              unsupported: [
                "hand-play-v1 executes a shuffled deck, hidden hands, play-to-score, and first-to-target or highest score when hands empty.",
              ],
            },
          }
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
      proposedRuntime = runtimeOperation;
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
            fields: generatedRuleSystem,
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
      const plan = createActionDescriptionIterationPlan({
        ruleSystem: record.ruleSystem,
        prompt: input.prompt,
        sourceId: `source_${job.id}`,
      });
      operation = await host.applyProjectChanges(job.projectId, {
        expectedVersion: input.expectedVersion,
        idempotencyKey: `job:${input.idempotencyKey}`,
        operations: plan.operations,
      });
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
      await host.ctx.storage.put(
        generationPlanKey(job.projectId),
        generationPlan,
      );
      operationBody.generationPlan = generationPlan;
      operationBody.generationMode = "deterministic-rule-system-materialization";
      operationBody.warnings = [generationRuntimeConfigured
        ? proposedRuntime?.op === "configure_hidden_role"
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
  await host.saveJob(job);
  await host.schedulePendingJobRecovery();
}
