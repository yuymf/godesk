import { DurableObject } from "cloudflare:workers";
import {
  acceptIntent,
  executableRuntime,
  initialSessionState,
  runBotSimulation,
} from "./runtime";
import { playabilityFloor } from "../src/runtime/playability-floor";
import { buildMeetsShareGate, shareGateRefusal } from "../src/runtime/share-gate";
import type {
  ApplyProjectChangesInput,
  Changeset,
  CompileBuildInput,
  CreatorJob,
  CreatorJobKind,
  DesignHypothesis,
  GameProject,
  GameReplay,
  GenerationPlan,
  RuleSystem,
  SessionFeedback,
  SharedSessionSnapshotEvent,
  SubmitJobInput,
} from "../src/creator/project-contract";
import { isDefaultExampleId } from "../src/creator/default-examples";
import { instantiateDefaultExample } from "./default-examples";
import { createGenerationPlan } from "./rulebook-generation";
import { runCreatorJob } from "./job-runner";
import {
  hashSeatToken,
  issueSeatToken,
  otherSeatForHash,
  publicSeats,
  seatForToken,
  type StoredSessionSeat,
} from "./seat-capability";
import {
  PROJECT_PREFIX,
  generationPlanKey,
  playtestLinkKey,
  json,
  error,
  paginated,
  initialRuleSystem,
  sameRuleSystemContent,
  normalizedProjectRecord,
  normalizedBuild,
  validChangeRequest,
  applyOperation,
  proposedAffectedEntities,
  buildId,
  referencedSourceIds,
  buildWarnings,
  presentationFloor,
  visibleSession,
  reconstructSession,
  reconstructReplay,
  type ProjectRecord,
  type StoredPlayableBuild,
  type StoredPlaytest,
  type StoredSharedSession,
  type StoredPlaytestLink,
  type SessionSocketAttachment,
  type StoredReplay,
  type StoredCompileBuildResult,
  type StoredApplyProjectChangesResult,
  type StoredDuplicateRuleSystemResult,
  type StoredRestoreBuildResult,
} from "./project-operations";

export class CreatorProjects extends DurableObject<Env> {
  private broadcastSession(session: StoredSharedSession) {
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = socket.deserializeAttachment() as
        | SessionSocketAttachment
        | null;
      if (
        attachment?.sessionId === session.id &&
        socket.readyState === WebSocket.OPEN
      ) {
        try {
          const message = JSON.stringify({
            type: "session.snapshot",
            session: visibleSession(session, attachment.seat ?? null),
          } satisfies SharedSessionSnapshotEvent);
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
    return runCreatorJob({
      ctx: this.ctx,
      saveJob: (job, input) => this.saveJob(job, input),
      schedulePendingJobRecovery: () => this.schedulePendingJobRecovery(),
      applyProjectChanges: (projectId, input) =>
        this.applyProjectChanges(projectId, input),
      compileProjectBuild: (projectId, input) =>
        this.compileProjectBuild(projectId, input),
      createBuildPlaytest: (buildId, input) =>
        this.createBuildPlaytest(buildId, input),
    }, jobId, submittedInput);
  }

  async applyProjectChanges(
    projectId: string,
    input: ApplyProjectChangesInput,
  ) {

      const projectKey = `${PROJECT_PREFIX}${projectId}`;
      const idempotencyKey = `idempotency:${projectId}:${input.idempotencyKey}`;
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
              operation.op === "configure_harbor_voyage" ||
              operation.op === "configure_hidden_role" ||
              operation.op === "configure_hand_play" ||
              operation.op === "configure_conversation_relay",
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
              if (!session || !build || !buildMeetsShareGate(build)) {
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

  async compileProjectBuild(
    projectId: string,
    input: CompileBuildInput,
  ) {
      const projectKey = `${PROJECT_PREFIX}${projectId}`;
      const idempotencyKey =
        `idempotency:${projectId}:${input.idempotencyKey}`;
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
          playabilityFloor: playabilityFloor(record.ruleSystem),
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

  async createBuildPlaytest(
    buildId: string,
    input: { seed: number; idempotencyKey: string },
  ) {
      const idempotencyKey =
        `playtest:${buildId}:${input.idempotencyKey}`;
      const outcome = await this.ctx.storage.transaction(async (transaction) => {
        const existing = await transaction.get<StoredPlaytest>(idempotencyKey);
        if (existing) return { status: 201, value: existing };
        const storedBuild = await transaction.get<StoredPlayableBuild>(
          `build:${buildId}`,
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
      return this.applyProjectChanges(changeMatch[1], input);

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
        "export-build",
      ].includes(String(input.kind));
      const validBuildInput =
        input.kind === "bot-playtest" ||
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
      return this.compileProjectBuild(compileMatch[1], input as CompileBuildInput);
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
      return this.createBuildPlaytest(playtestCreateMatch[1], {
        seed: Number(input.seed),
        idempotencyKey: input.idempotencyKey,
      });
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
        const refusal = shareGateRefusal(build);
        if (refusal) {
          return {
            status: 422,
            value: refusal,
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
          return { status: 200, value: { session: visibleSession(room, seat), seatToken: existingToken } };
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
        return { status: 200, value: { session: visibleSession(updatedRoom, seat), seatToken } };
      });
      if (outcome.status === 200 && "session" in outcome.value && outcome.value.session) {
        const stored = await this.ctx.storage.get<StoredSharedSession>(
          `session:${outcome.value.session.id}`,
        );
        if (stored) this.broadcastSession(stored);
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
        return { status: 200, value: visibleSession(updatedRoom, Number(input.seat)) };
      });
      if (outcome.status === 200 && "id" in outcome.value) {
        const stored = await this.ctx.storage.get<StoredSharedSession>(
          `session:${outcome.value.id}`,
        );
        if (stored) this.broadcastSession(stored);
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
      return json(visibleSession(reconstructSession(room, build)));
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
    let parsed: { type?: unknown; seat?: unknown; seatToken?: unknown };
    try {
      parsed = JSON.parse(String(message)) as {
        type?: unknown;
        seat?: unknown;
        seatToken?: unknown;
      };
    } catch {
      socket.close(1008, "unsupported_session_event");
      return;
    }
    if (parsed.type !== "session.sync") {
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
    let viewerSeat = attachment.seat ?? null;
    if (Number.isInteger(parsed.seat) && typeof parsed.seatToken === "string") {
      const hash = await hashSeatToken(parsed.seatToken);
      const claimed = room.seats.find(
        (entry) => entry.seat === parsed.seat && entry.seatTokenHash === hash,
      );
      if (claimed) {
        viewerSeat = claimed.seat;
        socket.serializeAttachment({
          sessionId: attachment.sessionId,
          seat: claimed.seat,
          seatTokenHash: hash,
        } satisfies SessionSocketAttachment);
      }
    }
    socket.send(JSON.stringify({
      type: "session.snapshot",
      session: visibleSession(reconstructSession(room, build), viewerSeat),
    } satisfies SharedSessionSnapshotEvent));
  }

  webSocketClose(socket: WebSocket, code: number, reason: string) {
    socket.close(code, reason);
  }
}
