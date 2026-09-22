import { useEffect, useRef, useState } from "react";
import {
  applyProjectChanges,
  createSharedSession,
  duplicateRuleSystem,
  getBuilds,
  getChangesets,
  getGenerationPlan,
  getJobs,
  getPlaytestLink,
  getPlaytests,
  getProject,
  getProjectActivity,
  getRuleSystem,
  getRuleSystems,
  getSharedSessions,
  getSources,
  getValidation,
  ProjectApiError,
  restoreBuild,
  retryJob,
  submitJob,
  waitForJob,
} from "./project-api";
import type {
  Changeset,
  CreatorJob,
  DesignHypothesis,
  GameProject,
  GenerationPlan,
  PlayableBuild,
  PlaytestLink,
  PlaytestRun,
  RuleSystem,
  SessionFeedback,
  SharedSession,
  SourceLibraryEntry,
  ValidationFinding,
} from "./project-contract";
import { Brand } from "./CreatorBrand";
import { StudioBuildPlayPanel } from "./StudioBuildPlayPanel";
import { StudioGenerationPlanPanel } from "./StudioGenerationPlanPanel";
import { StudioValidationPanel } from "./StudioValidationPanel";
import {
  buildCanOpenSharedSession,
  CREATOR_JOB_LABELS,
  CREATOR_JOB_STATUS_LABELS,
  draftExpectedVersion,
  findingContinuationPrompt,
  href,
  latestBuildPlaytestComparison,
  latestStudioPlayTarget,
  parseRuleSystemStructure,
  participantFeedbackFindingNotes,
  participantFeedbackInbox,
  playtestOutcome,
  projectActivityRequiresFullRefresh,
  readValidationRouteContext,
  sameRuleSystemContent,
  seatedParticipantsFromSession,
  serializeRuleSystemStructure,
  shouldStartRuleSystemDraft,
  signedDelta,
  studioHobbyistFocus,
  type SeatedParticipantDraft,
  type ValidationEvidenceType,
  upsertCreatorJob,
  validationStudioHref,
  visibleCreatorJob,
} from "./studio-utils";

function CapabilityList({ project }: { project: GameProject }) {
  return (
    <dl className="capability-list">
      <div>
        <dt>Project state</dt>
        <dd>Cloudflare Durable Object</dd>
      </div>
      <div>
        <dt>Authentication</dt>
        <dd>
          {project.capabilities.authentication === "oauth"
            ? "OAuth creator · tenant isolated"
            : "Local development identity · 非线上 OAuth 证据"}
        </dd>
      </div>
      <div>
        <dt>Compilation</dt>
        <dd>
          {project.capabilities.compilation === "available"
            ? "Deterministic build available"
            : "Not available"}
        </dd>
      </div>
    </dl>
  );
}

export function ProjectStudio({ projectId }: { projectId: string }) {
  const validationRouteContext = readValidationRouteContext();
  const [project, setProject] = useState<GameProject>();
  const [ruleSystem, setRuleSystem] = useState<RuleSystem>();
  const [generationPlan, setGenerationPlan] = useState<GenerationPlan | null>(null);
  const [playtestLink, setPlaytestLink] = useState<PlaytestLink | null>(null);
  const [ruleSystems, setRuleSystems] = useState<RuleSystem[]>([]);
  const [changesets, setChangesets] = useState<Changeset[]>([]);
  const [sources, setSources] = useState<SourceLibraryEntry[]>([]);
  const [builds, setBuilds] = useState<PlayableBuild[]>([]);
  const [playtests, setPlaytests] = useState<PlaytestRun[]>([]);
  const [sessions, setSessions] = useState<SharedSession[]>([]);
  const [jobs, setJobs] = useState<CreatorJob[]>([]);
  const [hypotheses, setHypotheses] = useState<DesignHypothesis[]>([]);
  const [findings, setFindings] = useState<ValidationFinding[]>([]);
  const [hypothesisQuestion, setHypothesisQuestion] = useState("");
  const [hypothesisSignal, setHypothesisSignal] = useState("");
  const [sessionHypothesisId, setSessionHypothesisId] = useState("");
  const [findingHypothesisId, setFindingHypothesisId] = useState(
    validationRouteContext.hypothesisId,
  );
  const [findingBuildId, setFindingBuildId] = useState(validationRouteContext.buildId);
  const [findingEvidenceType, setFindingEvidenceType] = useState<ValidationEvidenceType>(
    validationRouteContext.evidenceType,
  );
  const [findingEvidenceId, setFindingEvidenceId] = useState(validationRouteContext.evidenceId);
  const [findingSeatedParticipants, setFindingSeatedParticipants] = useState<
    SeatedParticipantDraft[]
  >([]);
  const [findingCreatorAttested, setFindingCreatorAttested] = useState(false);
  const [findingVerdict, setFindingVerdict] = useState<
    ValidationFinding["verdict"]
  >("inconclusive");
  const [findingNotes, setFindingNotes] = useState("");
  const [findingNextChange, setFindingNextChange] = useState("");
  const [copiedFindingId, setCopiedFindingId] = useState("");
  const [iterationPrompt, setIterationPrompt] = useState("");
  const [iterationFindingId, setIterationFindingId] = useState("");
  const [playtestLinkCopied, setPlaytestLinkCopied] = useState(false);
  const [humanNames, setHumanNames] = useState<Record<number, string>>({});
  const [humanAttested, setHumanAttested] = useState(false);
  const [advancedValidationOpen, setAdvancedValidationOpen] = useState(
    Boolean(validationRouteContext.buildId),
  );
  const [validationOpen, setValidationOpen] = useState(
    Boolean(validationRouteContext.buildId),
  );
  const [sourceDraft, setSourceDraft] = useState("");
  const [structureDraft, setStructureDraft] = useState("");
  const [ruleSystemDirty, setRuleSystemDirty] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [loadErrorStatus, setLoadErrorStatus] = useState<number>();
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState(
    validationRouteContext.buildId
      ? validationRouteContext.hypothesisId
        ? "已带入这次试玩的 Build、验证问题与反馈。"
        : "已带入这次试玩的 Build；选择一个设计假设后即可记录验证结论。"
      : "",
  );
  const [busy, setBusy] = useState(false);
  const ruleSystemDirtyRef = useRef(false);
  const participantsDirtyRef = useRef(false);
  const draftBaseVersionRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  const refreshInFlightRef = useRef(false);
  const projectVersionRef = useRef<number | undefined>(undefined);
  const jobsRef = useRef<CreatorJob[]>([]);

  function trackJob(job: CreatorJob) {
    setJobs((current) => upsertCreatorJob(current, job));
    return waitForJob(job.id, (update) => {
      setJobs((current) => upsertCreatorJob(current, update));
    });
  }

  async function loadProject() {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    try {
    const nextProject = await getProject(projectId);
    const [
      nextRuleSystem,
      nextGenerationPlan,
      nextPlaytestLink,
      nextRuleSystems,
      nextSources,
      nextChangesets,
      nextBuilds,
      nextPlaytests,
      nextSessions,
      nextJobs,
      nextValidation,
    ] = await Promise.all([
      getRuleSystem(projectId),
      getGenerationPlan(projectId),
      getPlaytestLink(projectId),
      getRuleSystems(projectId),
      getSources(projectId),
      getChangesets(projectId),
      getBuilds(projectId),
      getPlaytests(projectId),
      getSharedSessions(projectId),
      getJobs(projectId),
      getValidation(projectId),
    ]);
    setProject(nextProject);
    setLoadError("");
    setLoadErrorStatus(undefined);
    projectVersionRef.current = nextProject.version;
    setGenerationPlan(nextGenerationPlan.generationPlan);
    setPlaytestLink(nextPlaytestLink.playtestLink);
    if (!ruleSystemDirtyRef.current) {
      setRuleSystem(nextRuleSystem);
      setStructureDraft(serializeRuleSystemStructure(nextRuleSystem));
      participantsDirtyRef.current = false;
    }
    setRuleSystems(nextRuleSystems);
    setSources(nextSources);
    setChangesets(nextChangesets);
    setBuilds(nextBuilds);
    setPlaytests(nextPlaytests);
    setSessions(nextSessions);
    setJobs(nextJobs);
    jobsRef.current = nextJobs;
    setHypotheses(nextValidation.hypotheses);
    setFindings(nextValidation.findings);
    setFindingHypothesisId((current) =>
      current || nextValidation.hypotheses.at(-1)?.id || ""
    );
    } finally {
      refreshInFlightRef.current = false;
    }
  }

  async function refreshProjectActivity() {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    let requiresFullRefresh = false;
    try {
      const {
        project: nextProject,
        jobs: nextJobs,
        sessions: nextSessions,
      } = await getProjectActivity(projectId);
      requiresFullRefresh = projectActivityRequiresFullRefresh(
        projectVersionRef.current,
        nextProject.version,
        jobsRef.current,
        nextJobs,
      );
      setProject(nextProject);
      setJobs(nextJobs);
      setSessions((current) => [
        ...nextSessions,
        ...current.filter(
          (session) => !nextSessions.some((next) => next.id === session.id),
        ),
      ]);
      projectVersionRef.current = nextProject.version;
      jobsRef.current = nextJobs;
    } finally {
      refreshInFlightRef.current = false;
    }
    if (requiresFullRefresh) await loadProject();
  }

  function beginRuleSystemDraft() {
    if (!ruleSystemDirtyRef.current) {
      draftBaseVersionRef.current = project?.version ?? null;
      ruleSystemDirtyRef.current = true;
      setRuleSystemDirty(true);
    }
  }

  async function compileBuild(expectedVersion: number, basedOnFindingId?: string) {
    if (!project) throw new Error("项目尚未载入。");
    const submitted = await submitJob(project.id, {
      kind: "compile-build",
      expectedVersion,
      ...(basedOnFindingId ? { basedOnFindingId } : {}),
      idempotencyKey: crypto.randomUUID(),
    });
    const job = await trackJob(submitted);
    if (job.status === "failed") throw new Error(job.error ?? "编译失败。");
    const build = job.result?.build as PlayableBuild | undefined;
    if (!build) throw new Error("编译完成但没有返回 Playable Build。");
    return { build, job };
  }

  async function completeBotPlaytest(buildId: string) {
    if (!project) throw new Error("项目尚未载入。");
    const submitted = await submitJob(project.id, {
      kind: "bot-playtest",
      buildId,
      seed: 42,
      idempotencyKey: crypto.randomUUID(),
    });
    const job = await trackJob(submitted);
    if (job.status === "failed") {
      throw new Error(job.error ?? "自动试玩失败。");
    }
    return job;
  }

  async function iterateFromPrompt(event: React.FormEvent) {
    event.preventDefault();
    if (!project || !ruleSystem || !iterationPrompt.trim()) return;
    const prompt = iterationPrompt.trim();
    const basedOnFindingId = iterationFindingId || undefined;
    let iterationApplied = false;
    setBusy(true);
    setFormError("");
    setNotice("");
    try {
      const submitted = await submitJob(project.id, {
        kind: "iterate-rule-system",
        expectedVersion: project.version,
        prompt,
        ...(basedOnFindingId ? { basedOnFindingId } : {}),
        idempotencyKey: crypto.randomUUID(),
      });
      const iterationJob = await trackJob(submitted);
      if (iterationJob.status === "failed") {
        const error = iterationJob.error ?? "自然语言迭代失败。";
        throw new Error(
          error.replace(/^iteration_(?:unsupported|action_not_found):\s*/, ""),
        );
      }
      iterationApplied = true;
      const iteration = iterationJob.result?.iteration as
        | { summary?: string }
        | undefined;
      const nextProject = iterationJob.result?.project as
        | GameProject
        | undefined;
      if (!nextProject) throw new Error("迭代完成但没有返回新版本。");
      const { build, job: buildJob } = await compileBuild(
        nextProject.version,
        basedOnFindingId,
      );
      let room: SharedSession | undefined;
      if (buildCanOpenSharedSession(build)) {
        room = await createSharedSession(build.id, {
          seed: 42,
          idempotencyKey: crypto.randomUUID(),
        });
      }
      await loadProject();
      setIterationPrompt("");
      setIterationFindingId("");
      setNotice(
        `${iteration?.summary ?? "改动已写进这一版"} · ${
          room ? "现在就能开玩。" : `可玩版本已生成（${buildJob.id}）。`
        }`,
      );
    } catch (reason) {
      if (iterationApplied) await loadProject();
      if (reason instanceof ProjectApiError && reason.status === 409) {
        setFormError("项目状态已变化：已刷新权威版本，请基于当前版本重新发送这次迭代。");
      } else {
        setFormError(reason instanceof Error ? reason.message : "自然语言迭代失败。");
      }
    } finally {
      setBusy(false);
    }
  }

  async function buildPlayable() {
    if (!project) return;
    setBusy(true);
    setFormError("");
    setNotice("");
    try {
      const { job } = await compileBuild(project.version);
      await loadProject();
      setNotice(`编译任务 ${job.id} 已完成并持久化。`);
    } catch (reason) {
      if (reason instanceof ProjectApiError && reason.status === 409) {
        await loadProject();
        setFormError("版本冲突：项目已刷新，请基于最新版本重新编译。");
      } else {
        setFormError(reason instanceof Error ? reason.message : "编译失败。");
      }
    } finally {
      setBusy(false);
    }
  }

  async function approveGenerationPlan() {
    if (!project || !generationPlan || generationPlan.status !== "pending") return;
    setBusy(true);
    setFormError("");
    setNotice("");
    try {
      const result = await applyProjectChanges(project.id, {
        expectedVersion: project.version,
        idempotencyKey: crypto.randomUUID(),
        operations: [{
          op: "approve_generation_plan",
          planId: generationPlan.id,
        }],
      });
      setProject(result.project);
      setGenerationPlan(result.generationPlan);
      setSources(result.sources);
      setHypotheses(result.hypotheses);
      setFindings(result.findings);
      setChangesets((current) => [...current, result.changeset]);
      const { build, job: buildJob } = await compileBuild(result.project.version);
      if (buildCanOpenSharedSession(build)) {
        const room = await createSharedSession(build.id, {
          seed: 42,
          idempotencyKey: crypto.randomUUID(),
        });
        setSessions((current) => [room, ...current]);
        await loadProject();
        setNotice("玩法已确认，可玩版本已生成。现在就能开玩。");
        return;
      }
      await loadProject();
      setNotice(
        `玩法已确认并生成了这一版（${buildJob.id}）。核心玩法还没齐，先别发给朋友。`,
      );
    } catch (reason) {
      if (reason instanceof ProjectApiError && reason.status === 409) {
        await loadProject();
        setFormError("计划或项目版本已变化：已刷新权威状态，请重新审阅后再确认。");
      } else {
        await loadProject();
        setFormError(
          reason instanceof Error
            ? reason.message
            : "确认玩法或生成可玩版本失败。",
        );
      }
    } finally {
      setBusy(false);
    }
  }


  async function duplicateActiveRuleSystem() {
    if (!project || !ruleSystem || ruleSystemDirty || sourceDraft.trim()) return;
    setBusy(true);
    setFormError("");
    try {
      const result = await duplicateRuleSystem(project.id, ruleSystem.id, {
        expectedVersion: project.version,
        idempotencyKey: crypto.randomUUID(),
        name: `${ruleSystem.name} 变体`,
      });
      setProject(result.project);
      setRuleSystem(result.ruleSystem);
      setRuleSystems(result.ruleSystems);
      setChangesets((current) => [...current, result.changeset]);
      setNotice(`已创建并切换到 ${result.ruleSystem.name}。`);
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "复制版本失败。");
    } finally {
      setBusy(false);
    }
  }

  async function activateRuleSystem(ruleSystemId: string) {
    if (!project || ruleSystemDirty || sourceDraft.trim()) return;
    setBusy(true);
    setFormError("");
    try {
      const result = await applyProjectChanges(project.id, {
        expectedVersion: project.version,
        idempotencyKey: crypto.randomUUID(),
        operations: [{ op: "activate_rule_system", ruleSystemId }],
      });
      setProject(result.project);
      setRuleSystem(result.ruleSystem);
      setRuleSystems((current) =>
        current.map((candidate) =>
          candidate.id === result.ruleSystem.id
            ? result.ruleSystem
            : candidate
        )
      );
      setChangesets((current) => [...current, result.changeset]);
      setNotice(`已切换到 ${result.ruleSystem.name}。`);
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "切换版本失败。");
    } finally {
      setBusy(false);
    }
  }

  async function restoreBuildVersion(build: PlayableBuild) {
    if (!project || !ruleSystem || ruleSystemDirty || sourceDraft.trim()) return;
    setBusy(true);
    setFormError("");
    try {
      const result = await restoreBuild(project.id, build.id, {
        expectedVersion: project.version,
        idempotencyKey: crypto.randomUUID(),
      });
      setProject(result.project);
      setRuleSystem(result.ruleSystem);
      setRuleSystems(result.ruleSystems);
      setChangesets((current) => [...current, result.changeset]);
      setNotice(
        `已从 Build ${build.id} 恢复出新的可编辑 Rule System；原 Build 与证据未改动。`,
      );
    } catch (reason) {
      if (reason instanceof ProjectApiError && reason.status === 409) {
        await loadProject();
      }
      setFormError(reason instanceof Error ? reason.message : "恢复 Build 失败。");
    } finally {
      setBusy(false);
    }
  }

  async function startBotPlaytest(build: PlayableBuild) {
    setBusy(true);
    setFormError("");
    try {
      const job = await completeBotPlaytest(build.id);
      await loadProject();
      setNotice(`自动试玩任务 ${job.id} 已完成 · 仅为 bot simulation evidence`);
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "自动试玩失败。");
    } finally {
      setBusy(false);
    }
  }

  async function retryFailedJob(job: CreatorJob) {
    setBusy(true);
    setFormError("");
    try {
      const queued = await retryJob(job.id);
      const finished = await trackJob(queued);
      if (finished.status === "failed") {
        throw new Error(finished.error ?? "任务重试失败。");
      }
      await loadProject();
      setNotice(`任务 ${finished.id} 已恢复并完成。`);
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "任务重试失败。");
    } finally {
      setBusy(false);
    }
  }

  async function exportBuild(build: PlayableBuild) {
    if (!project) return;
    setBusy(true);
    setFormError("");
    try {
      const submitted = await submitJob(project.id, {
        kind: "export-build",
        buildId: build.id,
        idempotencyKey: crypto.randomUUID(),
      });
      const job = await trackJob(submitted);
      if (job.status === "failed") throw new Error(job.error ?? "任务失败。");
      await loadProject();
      const url = job.result?.artifactUrl;
      if (typeof url === "string") window.location.assign(url);
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "任务失败。");
      setBusy(false);
    }
  }

  async function startRoom(
    build: PlayableBuild,
    destination: "room" | "studio" = "room",
  ) {
    setBusy(true);
    setFormError("");
    try {
      const room = await createSharedSession(build.id, {
        seed: 42,
        idempotencyKey: crypto.randomUUID(),
        ...(sessionHypothesisId
          ? { hypothesisId: sessionHypothesisId }
          : {}),
      });
      setSessions((current) => [room, ...current]);
      if (destination === "room") {
        window.location.assign(room.sessionUrl);
      } else {
        setNotice(`Studio 试玩已创建 · ${room.id}`);
      }
    } catch (reason) {
      if (reason instanceof ProjectApiError && reason.status === 422) {
        const details = reason.details as {
          playabilityFloor?: { reason?: string };
          presentationFloor?: { reason?: string };
        };
        setFormError(
          details.playabilityFloor?.reason
            ?? details.presentationFloor?.reason
            ?? reason.message,
        );
      } else {
        setFormError(reason instanceof Error ? reason.message : "没能开出这一局。");
      }
    } finally {
      setBusy(false);
    }
  }

  async function publishPlaytest(build: PlayableBuild) {
    if (!project) return;
    setBusy(true);
    setFormError("");
    try {
      const room = await createSharedSession(build.id, {
        seed: 42,
        idempotencyKey: crypto.randomUUID(),
        ...(sessionHypothesisId
          ? { hypothesisId: sessionHypothesisId }
          : {}),
      });
      const result = await applyProjectChanges(project.id, {
        expectedVersion: project.version,
        idempotencyKey: crypto.randomUUID(),
        operations: [{
          op: "publish_shared_session",
          sessionId: room.id,
        }],
      });
      const nextLink = await getPlaytestLink(project.id);
      setProject(result.project);
      projectVersionRef.current = result.project.version;
      setSessions((current) => [room, ...current]);
      setChangesets((current) => [...current, result.changeset]);
      setPlaytestLink(nextLink.playtestLink);
      setNotice(
        `固定试玩入口已更新 · ${room.id} · 新访问者将进入 Build ${build.id}`,
      );
    } catch (reason) {
      if (reason instanceof ProjectApiError && reason.status === 409) {
        await loadProject();
      }
      setFormError(
        reason instanceof Error ? reason.message : "固定试玩入口发布失败。",
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyPlaytestLink() {
    if (!playtestLink) return;
    setFormError("");
    try {
      await navigator.clipboard.writeText(playtestLink.url);
      setPlaytestLinkCopied(true);
      window.setTimeout(() => setPlaytestLinkCopied(false), 1_500);
    } catch {
      setFormError("复制失败，请手动选择固定试玩链接。");
    }
  }

  async function attestHumanSession() {
    if (!project || !playtestLink) return;
    const room = sessions.find((session) => session.id === playtestLink.sessionId);
    if (!room || room.seats.length < 2 || room.acceptedActions.length < 1) {
      setFormError("固定邀请这一局还没有两位玩家各走一步。");
      return;
    }
    if (!humanAttested) {
      setFormError("请先确认这两位是真人。");
      return;
    }
    const seatedParticipants = room.seats.map((seat) => ({
      seat: seat.seat,
      name: (humanNames[seat.seat] ?? "").trim() || `玩家 ${seat.seat}`,
    }));
    if (new Set(seatedParticipants.map((entry) => entry.name)).size !== seatedParticipants.length) {
      setFormError("每位玩家的称呼不能重复。");
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      let recordedHypothesisId = hypotheses[0]?.id ?? "";
      let expectedVersion = project.version;
      if (!recordedHypothesisId) {
        const created = await applyProjectChanges(project.id, {
          expectedVersion,
          idempotencyKey: crypto.randomUUID(),
          operations: [{
            op: "add_design_hypothesis",
            hypothesis: {
              question: "朋友打开邀请链接后能不能立刻一起玩？",
              successSignal: "至少两个人各完成一次行动。",
            },
          }],
        });
        setProject(created.project);
        setHypotheses(created.hypotheses);
        setFindings(created.findings);
        setChangesets((current) => [...current, created.changeset]);
        recordedHypothesisId = created.hypotheses.at(-1)?.id ?? "";
        expectedVersion = created.project.version;
      }
      if (!recordedHypothesisId) throw new Error("没法记下这局要看的问题。");
      const result = await applyProjectChanges(project.id, {
        expectedVersion,
        idempotencyKey: crypto.randomUUID(),
        operations: [{
          op: "record_validation_finding",
          finding: {
            hypothesisId: recordedHypothesisId,
            buildId: room.buildId,
            evidence: {
              type: "human-session",
              sessionId: room.id,
              seatedParticipants,
              creatorAttested: true,
            },
            verdict: "supported",
            notes: "两人从固定邀请链接加入，并各走了至少一步。",
            nextChange: "保持这一版，再约朋友打一局。",
          },
        }],
      });
      setProject(result.project);
      setHypotheses(result.hypotheses);
      setFindings(result.findings);
      setChangesets((current) => [...current, result.changeset]);
      setHumanAttested(false);
      setNotice("已记下：这是真人一起打的一局。");
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "没能记下这是真人局。");
    } finally {
      setBusy(false);
    }
  }

  async function addDesignHypothesis(event: React.FormEvent) {
    event.preventDefault();
    if (!project) return;
    setBusy(true);
    setFormError("");
    try {
      const result = await applyProjectChanges(project.id, {
        expectedVersion: project.version,
        idempotencyKey: crypto.randomUUID(),
        operations: [{
          op: "add_design_hypothesis",
          hypothesis: {
            question: hypothesisQuestion,
            successSignal: hypothesisSignal,
          },
        }],
      });
      setProject(result.project);
      setHypotheses(result.hypotheses);
      setFindings(result.findings);
      setChangesets((current) => [...current, result.changeset]);
      setFindingHypothesisId(result.hypotheses.at(-1)?.id ?? "");
      setHypothesisQuestion("");
      setHypothesisSignal("");
      setNotice("问题已记下。打开高级后，可以选一局反馈并写下结论。");
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "设计假设保存失败。");
    } finally {
      setBusy(false);
    }
  }

  async function recordValidationFinding(event: React.FormEvent) {
    event.preventDefault();
    if (!project) return;
    if (findingEvidenceType === "human-session" && !findingCreatorAttested) {
      setFormError("请先确认真人证据声明。");
      return;
    }
    const feedbackSession = findingEvidenceType === "participant-feedback"
      ? sessions.find((session) => session.id === findingEvidenceId)
      : undefined;
    if (findingEvidenceType === "participant-feedback" && !feedbackSession?.feedback.length) {
      setFormError("所选 Shared Session 还没有可引用的参与者反馈。");
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      const seatedParticipants = findingSeatedParticipants.map((entry) => ({
        seat: entry.seat,
        name: entry.name.trim(),
      }));
      const result = await applyProjectChanges(project.id, {
        expectedVersion: project.version,
        idempotencyKey: crypto.randomUUID(),
        operations: [{
          op: "record_validation_finding",
          finding: {
            hypothesisId: findingHypothesisId,
            buildId: findingBuildId,
            evidence: findingEvidenceType === "automated-playtest"
              ? { type: "automated-playtest", playtestId: findingEvidenceId }
              : findingEvidenceType === "participant-feedback"
                ? {
                    type: "participant-feedback",
                    sessionId: findingEvidenceId,
                    feedback: feedbackSession?.feedback.map((entry) => ({
                      id: entry.id,
                      seat: entry.seat,
                      rating: entry.rating,
                      comment: entry.comment,
                      moment: entry.moment,
                    })) ?? [],
                  }
                : {
                  type: "human-session",
                  sessionId: findingEvidenceId,
                  seatedParticipants,
                  creatorAttested: true,
                },
            verdict: findingVerdict,
            notes: findingNotes,
            nextChange: findingNextChange,
          },
        }],
      });
      setProject(result.project);
      setHypotheses(result.hypotheses);
      setFindings(result.findings);
      setChangesets((current) => [...current, result.changeset]);
      setFindingEvidenceId("");
      setFindingSeatedParticipants([]);
      setFindingCreatorAttested(false);
      setFindingNotes("");
      setFindingNextChange("");
      setNotice("验证结论已保存，并保留了证据类型与来源。");
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "验证结论保存失败。");
    } finally {
      setBusy(false);
    }
  }

  async function copyFindingContinuation(finding: ValidationFinding) {
    setFormError("");
    try {
      await navigator.clipboard.writeText(
        findingContinuationPrompt(projectId, finding),
      );
      setCopiedFindingId(finding.id);
      window.setTimeout(() => setCopiedFindingId(""), 1_500);
    } catch {
      setFormError("复制失败，请手动选择 Finding ID 与下一版改动。");
    }
  }

  function prepareParticipantFeedbackFinding(
    session: SharedSession,
    feedback: SessionFeedback,
  ) {
    const build = builds.find((candidate) => candidate.id === session.buildId);
    const actionLabel = build?.ruleSystem.actions.find(
      (action) => action.id === feedback.moment.actionId,
    )?.label;
    setFindingHypothesisId(session.experiment?.hypothesisId ?? "");
    setFindingBuildId(session.buildId);
    setFindingEvidenceType("participant-feedback");
    setFindingEvidenceId(session.id);
    setFindingSeatedParticipants([]);
    setFindingCreatorAttested(false);
    setFindingVerdict("inconclusive");
    setFindingNotes(participantFeedbackFindingNotes(feedback, actionLabel));
    setFindingNextChange("");
    setAdvancedValidationOpen(true);
    setNotice(
      session.experiment
        ? `已带入这局的 ${session.feedback.length} 条反馈。在高级里写下你的结论就行。`
        : "已带入这局反馈。先在高级里选一个问题，再写下结论。",
    );
    window.location.hash = "validation-finding";
  }

  useEffect(() => {
    let cancelled = false;
    let timeout: number | undefined;
    const refresh = async () => {
      if (cancelled) return;
      if (!busyRef.current) {
        await refreshProjectActivity().catch(() => {
          // A transient background refresh must not replace visible project state.
        });
      }
      if (!cancelled) timeout = window.setTimeout(refresh, 5_000);
    };
    loadProject()
      .then(() => {
        if (!cancelled) timeout = window.setTimeout(refresh, 5_000);
      })
      .catch((reason: unknown) => {
        setLoadError(reason instanceof Error ? reason.message : "GoDesk 服务暂时不可用。");
        setLoadErrorStatus(reason instanceof ProjectApiError ? reason.status : undefined);
      });
    return () => {
      cancelled = true;
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [projectId]);

  const findingSessionSeatKey = (() => {
    if (findingEvidenceType !== "human-session" || !findingEvidenceId) return "";
    const session = sessions.find((candidate) => candidate.id === findingEvidenceId);
    return session
      ? `${session.id}:${session.seats.map((entry) => entry.seat).join(",")}`
      : "";
  })();

  useEffect(() => {
    if (findingEvidenceType !== "human-session" || !findingEvidenceId) {
      setFindingSeatedParticipants([]);
      return;
    }
    const session = sessions.find((candidate) => candidate.id === findingEvidenceId);
    setFindingSeatedParticipants(seatedParticipantsFromSession(session));
  }, [findingEvidenceType, findingEvidenceId, findingSessionSeatKey]);

  useEffect(() => {
    ruleSystemDirtyRef.current = ruleSystemDirty;
  }, [ruleSystemDirty]);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  async function saveRuleSystem(event: React.FormEvent) {
    event.preventDefault();
    if (!project || !ruleSystem) return;
    setBusy(true);
    setFormError("");
    setNotice("");
    try {
      const structure = parseRuleSystemStructure(structureDraft);
      const participants = {
        ...ruleSystem.participants,
        roles: structure.roles,
      };
      const result = await applyProjectChanges(project.id, {
        expectedVersion: draftExpectedVersion(
          draftBaseVersionRef.current,
          project.version,
        ),
        idempotencyKey: crypto.randomUUID(),
        operations: [
          ...(sourceDraft.trim()
            ? [{
                op: "add_source" as const,
                source: {
                  kind: "brief" as const,
                  name: `${ruleSystem.name} brief`,
                  content: sourceDraft,
                  provenance: {
                    origin: "creator-authored" as const,
                    locator: "GoDesk Web Studio",
                  },
                },
              }]
            : []),
          {
            op: "update_rule_system",
            fields: {
              name: ruleSystem.name,
              pitch: ruleSystem.pitch,
              durationMinutes: ruleSystem.durationMinutes,
              entities: structure.entities,
              setup: structure.setup,
              playSurface: structure.playSurface,
              stages: structure.stages,
              outcomes: structure.outcomes,
              presentation: structure.presentation,
              ...(!participantsDirtyRef.current &&
                  JSON.stringify(structure.roles) === JSON.stringify(ruleSystem.participants.roles)
                ? {}
                : { participants }),
              ...(JSON.stringify(structure.rules) === JSON.stringify(ruleSystem.rules)
                ? {}
                : { rules: structure.rules }),
              ...(JSON.stringify(structure.constraints) === JSON.stringify(ruleSystem.constraints)
                ? {}
                : { constraints: structure.constraints }),
              ...(JSON.stringify(structure.actions) === JSON.stringify(ruleSystem.actions)
                ? {}
                : { actions: structure.actions }),
            },
          },
        ],
      });
      setProject(result.project);
      setRuleSystem(result.ruleSystem);
      setStructureDraft(serializeRuleSystemStructure(result.ruleSystem));
      draftBaseVersionRef.current = null;
      ruleSystemDirtyRef.current = false;
      participantsDirtyRef.current = false;
      setRuleSystemDirty(false);
      setSources(result.sources);
      setRuleSystems((current) =>
        current.map((candidate) =>
          candidate.id === result.ruleSystem.id
            ? result.ruleSystem
            : candidate
        )
      );
      setChangesets((current) => [...current, result.changeset]);
      setSourceDraft("");
      setNotice(
        `已保存 ${result.changeset.id} · v${result.changeset.previousVersion} → v${result.changeset.newVersion}`,
      );
    } catch (reason) {
      if (reason instanceof ProjectApiError && reason.status === 409) {
        await loadProject();
        setFormError(
          "版本冲突：已刷新权威版本，你的未保存草稿仍保留且没有覆盖服务端。",
        );
      } else {
        setFormError(reason instanceof Error ? reason.message : "保存失败。");
      }
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    const projectMissing = loadErrorStatus === 404;
    return (
      <main className="studio-status" id="main">
        <span aria-hidden="true">!</span>
        <h1>{projectMissing ? "这局游戏已不存在。" : "这局游戏打不开。"}</h1>
        <p role="alert">
          {projectMissing
            ? "这个链接指向的游戏已不在当前工作区，可能来自一次隔离测试。请从游戏列表打开有效项目。"
            : loadError}
        </p>
        <a href={href("/")}>返回游戏列表</a>
      </main>
    );
  }

  if (!project || !ruleSystem) {
    return (
      <main className="studio-status" id="main" aria-busy="true">
        <span className="loading-mark" aria-hidden="true">GD</span>
        <h1>正在打开这局游戏…</h1>
      </main>
    );
  }

  const visibleJob = visibleCreatorJob(jobs);
  const buildComparison = latestBuildPlaytestComparison(builds, playtests);
  const studioPlayTarget = latestStudioPlayTarget(builds, sessions);
  const buildComparisonFinding = buildComparison?.candidateBuild.basedOnFindingId
    ? findings.find(
        (finding) => finding.id === buildComparison.candidateBuild.basedOnFindingId,
      )
    : undefined;
  const feedbackInbox = participantFeedbackInbox(sessions);
  const feedbackFindings = new Map<string, ValidationFinding>();
  for (const finding of findings) {
    if (finding.evidence.type === "participant-feedback") {
      for (const feedback of finding.evidence.feedback) {
        feedbackFindings.set(feedback.id, finding);
      }
    }
  }
  const unreviewedFeedbackCount = feedbackInbox.filter(
    ({ feedback }) => !feedbackFindings.has(feedback.id),
  ).length;
  const canPlayLatest = Boolean(
    studioPlayTarget.build && buildCanOpenSharedSession(studioPlayTarget.build),
  );
  const hobbyistFocus = studioHobbyistFocus(generationPlan?.status, canPlayLatest);
  const showValidationOpen =
    validationOpen ||
    unreviewedFeedbackCount > 0;
  const friendSession = playtestLink
    ? sessions.find((session) => session.id === playtestLink.sessionId)
    : undefined;
  const humanFinding = friendSession
    ? findings.find((finding) =>
        finding.evidence.type === "human-session" &&
        finding.evidence.sessionId === friendSession.id,
      )
    : undefined;
  const canAttestHuman = Boolean(
    friendSession &&
    friendSession.seats.length >= 2 &&
    friendSession.acceptedActions.length >= 1 &&
    !humanFinding,
  );

  return (
    <main className={`creator-studio studio-focus-${hobbyistFocus}`} id="main">
      <aside className="studio-rail" aria-label="游戏导航">
        <Brand />
        <nav>
          <span>这局游戏</span>
          {canPlayLatest && <a href="#play">开玩</a>}
          {generationPlan && <a href="#plan">{generationPlan.status === "pending" ? "确认玩法" : "玩法摘要"}</a>}
          <a href="#iteration">改下一版</a>
          <a href="#validation">朋友反馈{unreviewedFeedbackCount ? ` · ${unreviewedFeedbackCount}` : ""}</a>
        </nav>
        <a className="back-projects" href={href("/")}>← 返回所有游戏</a>
      </aside>

      <section className="studio-canvas">
        <header className="studio-header">
          <div>
            <span>这款游戏</span>
            <h1>{project.name}</h1>
          </div>
          <div className="project-version">
            <span>
              <i className={visibleJob?.status ?? ""} aria-hidden="true" />
              {visibleJob
                ? `${CREATOR_JOB_LABELS[visibleJob.kind]} · ${CREATOR_JOB_STATUS_LABELS[visibleJob.status]}`
                : "已同步"}
            </span>
            <strong>v{project.version}</strong>
          </div>
        </header>

        {visibleJob && (
          <section
            aria-atomic="true"
            aria-live="polite"
            className={`studio-agent-activity ${visibleJob.status}`}
            role="status"
          >
            <div>
              <span>正在处理</span>
              <strong>
                {CREATOR_JOB_LABELS[visibleJob.kind]} · {CREATOR_JOB_STATUS_LABELS[visibleJob.status]}
              </strong>
            </div>
            <code title={visibleJob.id}>{visibleJob.id}</code>
          </section>
        )}

        <div className="studio-grid">
          <div className="studio-primary">
          {generationPlan && (
            <StudioGenerationPlanPanel
              approveGenerationPlan={approveGenerationPlan}
              busy={busy}
              generationPlan={generationPlan}
              hobbyistFocus={hobbyistFocus}
              ruleSystemDirty={ruleSystemDirty}
              sourceDraft={sourceDraft}
            />
          )}
          <section className={`ruleSystem-panel ${hobbyistFocus === "setup" ? "" : "studio-secondary-panel"}`} id="overview">
            <header className="studio-section-heading">
              <div>
                <h2>{hobbyistFocus === "setup" ? "先把这局说清楚" : "改游戏设定"}</h2>
              </div>
            </header>
            <form className="ruleSystem-form" onSubmit={saveRuleSystem}>
              <label className="ruleSystem-field" htmlFor="ruleSystem-name">
                <span>游戏名称</span>
                <input
                  id="ruleSystem-name"
                  maxLength={120}
                  onChange={(event) =>
                    {
                      beginRuleSystemDraft();
                      setRuleSystem({
                        ...ruleSystem,
                        name: event.currentTarget.value,
                      });
                    }
                  }
                  value={ruleSystem.name}
                />
              </label>

              <label className="ruleSystem-field" htmlFor="ruleSystem-pitch">
                <span>一句话玩法</span>
                <textarea
                  id="ruleSystem-pitch"
                  maxLength={2000}
                  onChange={(event) =>
                    {
                      beginRuleSystemDraft();
                      setRuleSystem({
                        ...ruleSystem,
                        pitch: event.currentTarget.value,
                      });
                    }
                  }
                  placeholder="例如：玩家通过竞价与押船，在有限回合内赚取最多收益。"
                  rows={4}
                  value={ruleSystem.pitch}
                />
              </label>

              <div className="ruleSystem-numbers">
                <label htmlFor="player-count">
                  <span>玩家数</span>
                  <input
                    id="player-count"
                    max={20}
                    min={1}
                    onChange={(event) =>
                      {
                        beginRuleSystemDraft();
                        participantsDirtyRef.current = true;
                        setRuleSystem({
                          ...ruleSystem,
                          participants: {
                            min: event.currentTarget.valueAsNumber,
                            max: event.currentTarget.valueAsNumber,
                            default: event.currentTarget.valueAsNumber,
                            roles: [],
                          },
                        });
                      }
                    }
                    type="number"
                    value={ruleSystem.participants.default}
                  />
                </label>
                <label htmlFor="duration-minutes">
                  <span>时长（分钟）</span>
                  <input
                    id="duration-minutes"
                    max={720}
                    min={5}
                    onChange={(event) =>
                      {
                        beginRuleSystemDraft();
                        setRuleSystem({
                          ...ruleSystem,
                          durationMinutes: event.currentTarget.valueAsNumber,
                        });
                      }
                    }
                    type="number"
                    value={ruleSystem.durationMinutes}
                  />
                </label>
              </div>

              <details className="studio-optional">
                <summary>高级：完整规则 JSON</summary>
                <label className="ruleSystem-field" htmlFor="ruleSystem-structure">
                  <span>角色、规则、约束、实体、行动、Play Surface、阶段、结果与呈现</span>
                  <textarea
                    id="ruleSystem-structure"
                    onChange={(event) => {
                      beginRuleSystemDraft();
                      setStructureDraft(event.currentTarget.value);
                    }}
                    rows={24}
                    spellCheck={false}
                    value={structureDraft}
                  />
                  <small>保存时会先解析 JSON，再由服务端执行完整领域校验。</small>
                </label>
              </details>

              <details className="studio-optional">
                <summary>添加规则或素材修改依据 <small>可选</small></summary>
                <label className="ruleSystem-field" htmlFor="source-brief">
                  <span>来源说明或素材描述</span>
                  <textarea
                    id="source-brief"
                    onChange={(event) => {
                      if (shouldStartRuleSystemDraft(sourceDraft, event.currentTarget.value)) {
                        beginRuleSystemDraft();
                      }
                      setSourceDraft(event.currentTarget.value);
                    }}
                    placeholder="例如：卡面使用雾绿色港口剪影、粗颗粒纸张质感；或粘贴本次规则修改依据。保存后会进入来源库。"
                    rows={4}
                    value={sourceDraft}
                  />
                </label>
              </details>

              <div className="ruleSystem-actions">
                <button
                  disabled={
                    busy ||
                    !ruleSystem.name.trim() ||
                    (!ruleSystemDirty && !sourceDraft.trim())
                  }
                  type="submit"
                >
                  {busy ? "正在保存…" : ruleSystemDirty || sourceDraft.trim()
                    ? `保存更改 · v${project.version + 1}`
                    : "已保存"}
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    setNotice("");
                    loadProject().catch((reason: Error) =>
                      setFormError(reason.message),
                    );
                  }}
                  type="button"
                >
                  重新载入
                </button>
              </div>
              {notice && <p className="creator-notice" role="status">{notice}</p>}
              {formError && (
                <p className="creator-error" role="alert">{formError}</p>
              )}
            </form>
          </section>

          <StudioBuildPlayPanel
            attestHumanSession={attestHumanSession}
            buildComparison={buildComparison}
            buildComparisonFinding={buildComparisonFinding}
            buildPlayable={buildPlayable}
            builds={builds}
            busy={busy}
            canAttestHuman={canAttestHuman}
            canPlayLatest={canPlayLatest}
            copyPlaytestLink={copyPlaytestLink}
            exportBuild={exportBuild}
            findings={findings}
            friendSession={friendSession}
            generationPlan={generationPlan}
            hobbyistFocus={hobbyistFocus}
            humanAttested={humanAttested}
            humanFinding={humanFinding}
            humanNames={humanNames}
            hypotheses={hypotheses}
            iterateFromPrompt={iterateFromPrompt}
            iterationFindingId={iterationFindingId}
            iterationPrompt={iterationPrompt}
            playtestLink={playtestLink}
            playtestLinkCopied={playtestLinkCopied}
            publishPlaytest={publishPlaytest}
            restoreBuildVersion={restoreBuildVersion}
            ruleSystem={ruleSystem}
            ruleSystemDirty={ruleSystemDirty}
            sessionHypothesisId={sessionHypothesisId}
            setHumanAttested={setHumanAttested}
            setHumanNames={setHumanNames}
            setIterationFindingId={setIterationFindingId}
            setIterationPrompt={setIterationPrompt}
            setSessionHypothesisId={setSessionHypothesisId}
            sourceDraft={sourceDraft}
            startBotPlaytest={startBotPlaytest}
            startRoom={startRoom}
            studioPlayTarget={studioPlayTarget}
          />

          <StudioValidationPanel
            addDesignHypothesis={addDesignHypothesis}
            advancedValidationOpen={advancedValidationOpen}
            builds={builds}
            busy={busy}
            copiedFindingId={copiedFindingId}
            copyFindingContinuation={copyFindingContinuation}
            feedbackFindings={feedbackFindings}
            feedbackInbox={feedbackInbox}
            findingBuildId={findingBuildId}
            findingCreatorAttested={findingCreatorAttested}
            findingEvidenceId={findingEvidenceId}
            findingEvidenceType={findingEvidenceType}
            findingHypothesisId={findingHypothesisId}
            findingNextChange={findingNextChange}
            findingNotes={findingNotes}
            findingSeatedParticipants={findingSeatedParticipants}
            findingVerdict={findingVerdict}
            findings={findings}
            hypotheses={hypotheses}
            hypothesisQuestion={hypothesisQuestion}
            hypothesisSignal={hypothesisSignal}
            playtests={playtests}
            prepareParticipantFeedbackFinding={prepareParticipantFeedbackFinding}
            recordValidationFinding={recordValidationFinding}
            ruleSystem={ruleSystem}
            sessions={sessions}
            setAdvancedValidationOpen={setAdvancedValidationOpen}
            setFindingBuildId={setFindingBuildId}
            setFindingCreatorAttested={setFindingCreatorAttested}
            setFindingEvidenceId={setFindingEvidenceId}
            setFindingEvidenceType={setFindingEvidenceType}
            setFindingHypothesisId={setFindingHypothesisId}
            setFindingNextChange={setFindingNextChange}
            setFindingNotes={setFindingNotes}
            setFindingSeatedParticipants={setFindingSeatedParticipants}
            setFindingVerdict={setFindingVerdict}
            setHypothesisQuestion={setHypothesisQuestion}
            setHypothesisSignal={setHypothesisSignal}
            setValidationOpen={setValidationOpen}
            showValidationOpen={showValidationOpen}
            unreviewedFeedbackCount={unreviewedFeedbackCount}
          />
          </div>

          <aside className="project-facts" aria-label="这局游戏">
            <section className="project-snapshot">
              <h2>{project.name}</h2>
              <p>{ruleSystem.pitch || "还没有一句话玩法。确认玩法或开玩后，这里会更清楚。"}</p>
              <p className="studio-next-hint">
                {hobbyistFocus === "plan"
                  ? "下一步：确认这一局怎么玩。"
                  : hobbyistFocus === "play"
                    ? "下一步：自己试一局，再把邀请链接发给朋友。"
                    : "下一步：把游戏设定说清楚，再做成可玩版本。"}
              </p>
            </section>

            <details className="project-disclosure" id="rule-systems">
              <summary>
                <span>版本与来源</span>
                <small>{ruleSystems.length} 个分支 · {sources.length} 个来源</small>
              </summary>
              <section className="evidence-summary">
                <header>
                  <strong>规则分支</strong>
                  <button
                    disabled={busy || ruleSystemDirty || Boolean(sourceDraft.trim()) || generationPlan?.status === "pending"}
                    onClick={duplicateActiveRuleSystem}
                    type="button"
                  >
                    复制当前版本
                  </button>
                </header>
                <ul>
                  {ruleSystems.map((candidate) => (
                    <li key={candidate.id}>
                      <strong>{candidate.name} · d{candidate.version}</strong>
                      {candidate.restoredFromBuildId && (
                        <small>恢复自 Build {candidate.restoredFromBuildId}</small>
                      )}
                      {candidate.id === project.activeRuleSystemId ? (
                        <small>当前版本</small>
                      ) : (
                        <button
                          disabled={busy || ruleSystemDirty || Boolean(sourceDraft.trim()) || generationPlan?.status === "pending"}
                          onClick={() => activateRuleSystem(candidate.id)}
                          type="button"
                        >
                          切换
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                {(ruleSystemDirty || sourceDraft.trim()) && (
                  <small>保存或清空草稿后，才可切换版本。</small>
                )}
              </section>
              <section className="source-summary">
                <strong>来源库</strong>
                {sources.length > 0 ? (
                  <ul>
                    {sources.map((source) => {
                      const basedOnSources = (source.provenance.basedOnSourceIds ?? [])
                        .map((sourceId) => sources.find((candidate) => candidate.id === sourceId))
                        .filter((candidate): candidate is SourceLibraryEntry => Boolean(candidate));
                      return (
                        <li className="source-entry" key={source.id}>
                          {source.kind === "image" && source.content.startsWith("data:image/") && (
                            <img alt={source.name} src={source.content} />
                          )}
                          <span>{source.name}</span>
                          <small>{source.provenance.origin}</small>
                          {source.kind === "image" && (
                            <small>
                              {source.imageUse === "visual-reference" ? "参考图 · 不直接绑定" : "项目素材 · 可直接绑定"}
                            </small>
                          )}
                          {basedOnSources.length > 0 && (
                            <small>
                              生成依据：{basedOnSources.map((dependency) =>
                                `${dependency.name} · ${dependency.id}`
                              ).join("；")}
                            </small>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : <p>暂无来源。</p>}
              </section>
            </details>

            <details className="project-disclosure">
              <summary>
                <span>游戏结构</span>
                <small>{ruleSystem.playSurface.kind} · {ruleSystem.playSurface.regions.length} 个区域</small>
              </summary>
              <section className="structure-summary">
                <dl>
                  <div><dt>规则</dt><dd>{ruleSystem.rules.length}</dd></div>
                  <div><dt>约束</dt><dd>{ruleSystem.constraints.length}</dd></div>
                  <div><dt>实体</dt><dd>{ruleSystem.entities.length}</dd></div>
                  <div><dt>准备步骤</dt><dd>{ruleSystem.setup.length}</dd></div>
                  <div><dt>行动</dt><dd>{ruleSystem.actions.length}</dd></div>
                  <div><dt>游戏区域</dt><dd>{ruleSystem.playSurface.regions.length}</dd></div>
                  <div><dt>阶段</dt><dd>{ruleSystem.stages.length}</dd></div>
                  <div><dt>结果</dt><dd>{ruleSystem.outcomes.length}</dd></div>
                </dl>
                <p>主题：{ruleSystem.presentation.theme || "未设置"}</p>
              </section>
            </details>

            <details className="project-disclosure" id="activity">
              <summary>
                <span>项目记录</span>
                <small>{jobs.length} 个任务 · {changesets.length} 次更改</small>
              </summary>
              <section className="evidence-summary">
                <strong>后台任务</strong>
                {jobs.length ? (
                <ul>
                  {jobs.map((job) => (
                    <li key={job.id}>
                      <strong>{job.kind}</strong>
                      <small>{job.status} · {job.id}</small>
                      {job.status === "failed" && (
                        <button
                          disabled={busy}
                          onClick={() => retryFailedJob(job)}
                          type="button"
                        >
                          重试
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                  <p>暂无后台任务。</p>
              )}
              </section>
              <section className="evidence-summary">
                <strong>版本更改</strong>
              {changesets.length ? (
                <ul>
                  {[...changesets].reverse().slice(0, 8).map((changeset) => (
                    <li key={changeset.id}>
                      <strong>
                        v{changeset.previousVersion} → v{changeset.newVersion}
                      </strong>
                      <small>
                        {changeset.affectedEntities.join(", ")}
                      </small>
                    </li>
                  ))}
                </ul>
              ) : (
                  <p>暂无版本更改。</p>
              )}
              </section>
              <section className="evidence-summary">
                <strong>自动试玩</strong>
              {playtests.length ? (
                <ul>
                  {playtests.map((playtest) => (
                    <li key={playtest.id}>
                      <a href={playtest.replayUrl}>
                        seed {playtest.seed} · {playtest.metrics.turns} turns
                      </a>
                      <a
                        href={validationStudioHref(project.id, {
                          buildId: playtest.buildId,
                          evidenceType: "automated-playtest",
                          evidenceId: playtest.id,
                        })}
                      >
                        带入验证
                      </a>
                      <small>自动模拟 · 非真人验收</small>
                    </li>
                  ))}
                </ul>
              ) : (
                  <p>暂无自动试玩记录。</p>
              )}
              </section>
              <section className="evidence-summary">
                <strong>Shared Sessions</strong>
              {sessions.length ? (
                <ul>
                  {sessions.map((room) => (
                    <li key={room.id}>
                      <a href={room.sessionUrl}>
                        {room.id} · turn {room.state.turn}
                      </a>
                      <a
                        href={validationStudioHref(project.id, {
                          buildId: room.buildId,
                          evidenceType: room.feedback.length
                            ? "participant-feedback"
                            : "human-session",
                          evidenceId: room.id,
                        })}
                      >
                        带入验证
                      </a>
                      <small>
                        {room.feedback.length
                          ? `${room.feedback.length} 条试玩反馈`
                          : "暂无试玩反馈"}
                      </small>
                      {room.feedback.map((entry) => (
                        <small key={entry.id}>
                          座位 {entry.seat} · 行动 #{entry.moment.actionSequence} · {builds
                            .find((candidate) => candidate.id === room.buildId)
                            ?.ruleSystem.actions.find((action) => action.id === entry.moment.actionId)
                            ?.label ?? entry.moment.actionId} · {"★".repeat(entry.rating)} · {entry.comment}
                        </small>
                      ))}
                    </li>
                  ))}
                </ul>
              ) : (
                  <p>暂无 Shared Session。</p>
              )}
              </section>
            </details>

            <details className="project-disclosure">
              <summary>
                <span>系统信息</span>
                <small>自动同步 · 项目 v{project.version}</small>
              </summary>
              <CapabilityList project={project} />
              <footer>
                <span>Project ID</span>
                <code>{project.id}</code>
              </footer>
            </details>
          </aside>
        </div>
      </section>
    </main>
  );
}
