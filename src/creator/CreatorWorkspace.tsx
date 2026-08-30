import { useEffect, useRef, useState } from "react";
import {
  applyProjectChanges,
  claimSessionSeat,
  createSharedSession,
  createProject,
  duplicateRuleSystem,
  getBuild,
  getBuilds,
  getChangesets,
  getGenerationPlan,
  getPlaytestLink,
  getRuleSystem,
  getRuleSystems,
  getJobs,
  getPlaytests,
  getProject,
  getProjectActivity,
  getReplay,
  getSharedSessions,
  publicSharedSession,
  sharedSessionSocketUrl,
  getSources,
  getValidation,
  listProjects,
  ProjectApiError,
  retryJob,
  restoreBuild,
  submitJob,
  submitSessionFeedback,
  submitSessionIntent,
  waitForJob,
} from "./project-api";
import type {
  Changeset,
  DesignHypothesis,
  GenerationPlan,
  RuleSystem,
  CreatorJob,
  GameProject,
  GameReplay,
  SharedSession,
  SharedSessionSnapshot,
  SessionFeedback,
  PlaytestRun,
  PlayableBuild,
  PlaytestLink,
  PlaySurfaceKind,
  SourceLibraryEntry,
  ValidationFinding,
} from "./project-contract";
import { DEFAULT_EXAMPLES, type DefaultExampleId } from "./default-examples";
import {
  extractRulebookText,
  harvestRulebookPageImages,
  prepareImageAsset,
  validateRulebookFile,
  validateImageAssets,
} from "../platform/ingestion";
import {
  canPlaceHarborWorker,
  createHarborVoyageState,
  harborInstruction,
  harborTargetCost,
  HARBOR_TARGET_GROUPS,
  type HarborCargoId,
  type HarborTargetId,
  type HarborVoyageState,
} from "../runtime/harbor-voyage";
import {
  CARD_SYMBOLS,
  displayActionDescription,
  displayUnsupported,
  drawAndScoreKernel,
  isHarborVoyage,
  localizedRoomError,
  pushYourLuckKernel,
  readRoomLocale,
  rollAndMoveKernel,
  ROOM_COPY,
  roomActionTitle,
  roomSurfaceCopy,
  scoreRaceKernel,
  sharedGoalKernel,
  takeAwayKernel,
  turnTakingKernel,
  type RoomLocale,
} from "./room-presentation";

export { roomActionTitle, roomSurfaceCopy } from "./room-presentation";

const GENERATION_STAGES = [
  {
    id: "ingest",
    name: "导入来源",
    detail: "读取规则文档、粘贴文本或整理图片素材",
  },
  {
    id: "generate",
    name: "解析规则",
    detail: "生成可编辑 Rule System，并识别可执行能力边界",
  },
  {
    id: "review",
    name: "审阅生成计划",
    detail: "确认玩法摘要、行动与可执行边界",
  },
  {
    id: "compile",
    name: "搭建可玩版本",
    detail: "编译 immutable Playable Build",
  },
  {
    id: "ready",
    name: "就绪",
    detail: "打开 Web Studio 校对，或直接创建共享会话",
  },
] as const;

type GenerationStageId = (typeof GENERATION_STAGES)[number]["id"];

type ValidationEvidenceType =
  | "automated-playtest"
  | "participant-feedback"
  | "human-session";

const CREATOR_JOB_LABELS: Record<CreatorJob["kind"], string> = {
  "generate-rule-system": "解析规则",
  "iterate-rule-system": "应用自然语言迭代",
  "compile-build": "编译可玩版本",
  "bot-playtest": "自动试玩",
  "render-preview": "生成预览",
  "export-build": "导出 Build",
};

const CREATOR_JOB_STATUS_LABELS: Record<CreatorJob["status"], string> = {
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
  return build.ruleSystem.runtimeSupport.status === "executable" &&
    build.presentationFloor.status === "passed";
}

function playtestOutcome(playtest: PlaytestRun) {
  if (playtest.terminalStatus === "turn-limit") return "达到安全回合上限";
  return playtest.metrics.winnerSeat === null
    ? "无唯一胜者"
    : `Seat ${playtest.metrics.winnerSeat + 1} 获胜`;
}

function signedDelta(value: number) {
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
  return `/studio/${encodeURIComponent(projectId)}${query ? `?${query}` : ""}#validation`;
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

function readValidationRouteContext() {
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

type RuleSystemStructureDraft = Pick<
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

function sameRuleSystemContent(left: RuleSystem, right: RuleSystem) {
  const comparable = (candidate: RuleSystem) => ({
    ...structuredClone(candidate),
    id: "",
    version: 0,
    restoredFromBuildId: undefined,
  });
  return JSON.stringify(comparable(left)) === JSON.stringify(comparable(right));
}

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

function serializeRuleSystemStructure(ruleSystem: RuleSystem) {
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

function Brand() {
  return (
    <a className="creator-brand" href="/">
      <span aria-hidden="true">GD</span>
      <span>
        <strong>GoDesk</strong>
        <small>Creator Workbench</small>
      </span>
    </a>
  );
}

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

function CreatorHome() {
  const [name, setName] = useState("我的游戏");
  const [description, setDescription] = useState("");
  const [rulesText, setRulesText] = useState("");
  const [rulebook, setRulebook] = useState<File>();
  const [visualAssets, setVisualAssets] = useState<File[]>([]);
  const [visualAssetUse, setVisualAssetUse] = useState<"visual-reference" | "project-asset">(
    "visual-reference",
  );
  const [projects, setProjects] = useState<GameProject[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [stageLabel, setStageLabel] = useState("");
  const [activeStage, setActiveStage] = useState<GenerationStageId | null>(null);
  const [completedStages, setCompletedStages] = useState(0);
  const [exampleBusy, setExampleBusy] = useState<DefaultExampleId | null>(null);

  useEffect(() => {
    listProjects().then(setProjects).catch((reason: Error) => {
      setError(reason.message);
    });
  }, []);

  async function createAndOpenSession(buildId: string) {
    setStageLabel("创建共享会话");
    const session = await createSharedSession(buildId, {
      seed: 42,
      idempotencyKey: crypto.randomUUID(),
    });
    window.location.assign(session.sessionUrl);
  }

  async function runPipeline(
    sourceContent: string,
    sourceName: string,
    sourceKind: "rulebook" | "brief",
    visualInputs: Array<{
      name: string;
      content: string;
      pageNumber: number;
      imageUse: "visual-reference" | "project-asset";
    }> = [],
  ) {
    setActiveStage("ingest");
    setCompletedStages(0);
    setCompletedStages(1);

    setActiveStage("generate");
    setStageLabel("创建 Game Project");
    const created = await createProject(name.trim());
    setStageLabel("解析规则并生成 Rule System");
    const generationSourceName = sourceContent.trim()
      ? sourceName
      : `${name.trim()} visual material`;
    const idea = description.trim() || (visualAssets.length
      ? `根据上传的 ${visualAssets.length} 份视觉素材，创建一个可编辑的规则游戏提案。`
      : sourceContent);
    const queuedGeneration = await submitJob(created.project.id, {
      kind: "generate-rule-system",
      expectedVersion: created.project.version,
      idea,
      name: name.trim(),
      ...generationSourceFields(
        sourceContent,
        generationSourceName,
        sourceKind,
        visualInputs.length > 0,
      ),
      visualInputs,
      idempotencyKey: crypto.randomUUID(),
    });
    const generated = await waitForJob(queuedGeneration.id);
    if (generated.status === "failed") {
      throw new Error(generated.error ?? "规则生成失败。");
    }
    setCompletedStages(2);
    setActiveStage("review");
    setStageLabel("打开生成计划");
    setProjects(await listProjects());
    window.location.assign(`${created.studioUrl}?plan=pending`);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const sourceContent = rulebook
        ? await extractRulebookText(rulebook)
        : rulesText.trim();
      if (!sourceContent && !description.trim() && !visualAssets.length) {
        throw new Error("请描述你的游戏想法，提供规则来源，或添加图片素材。");
      }
      const rulebookImages = rulebook
        ? (await harvestRulebookPageImages(rulebook).catch(() => [])).map((image) => ({
            ...image,
            imageUse: "project-asset" as const,
          }))
        : [];
      const uploadedImages = await Promise.all(
        visualAssets.map((file, index) => prepareImageAsset(file, index + 1)),
      ).then((images) => images.map((image) => ({ ...image, imageUse: visualAssetUse })));
      if (uploadedImages.length + rulebookImages.length > 8) {
        throw new Error("本次生成最多保留 8 张图片素材，请减少图片或规则书页面素材。");
      }
      await runPipeline(
        sourceContent,
        rulebook?.name || (rulesText.trim() ? `${name.trim()} rules.txt` : `${name.trim()} idea.txt`),
        rulebook ? "rulebook" : "brief",
        [...uploadedImages, ...rulebookImages],
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "生成项目失败。");
      setActiveStage(null);
      setCompletedStages(0);
    } finally {
      setBusy(false);
      setStageLabel("");
    }
  }

  async function copyExample(exampleId: DefaultExampleId) {
    const example = DEFAULT_EXAMPLES.find((item) => item.id === exampleId);
    if (!example) return;
    setExampleBusy(exampleId);
    setError("");
    setBusy(true);
    setActiveStage("generate");
    setCompletedStages(1);
    try {
      setStageLabel("复制案例项目");
      const created = await createProject(example.title, exampleId);
      setCompletedStages(2);
      setActiveStage("compile");
      setStageLabel("编译 Playable Build");
      const queuedBuild = await submitJob(created.project.id, {
        kind: "compile-build",
        expectedVersion: created.project.version,
        idempotencyKey: crypto.randomUUID(),
      });
      const built = await waitForJob(queuedBuild.id);
      if (built.status === "failed") throw new Error(built.error ?? "编译失败。");
      setCompletedStages(4);
      setActiveStage("ready");
      const builds = await getBuilds(created.project.id);
      const build = builds[0];
      if (!build) throw new Error("编译成功但未找到 Build。");
      setCompletedStages(5);
      setProjects(await listProjects());
      await createAndOpenSession(build.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "复制案例失败。");
      setActiveStage(null);
      setCompletedStages(0);
    } finally {
      setExampleBusy(null);
      setBusy(false);
      setStageLabel("");
    }
  }

  function selectRulebook(file?: File) {
    if (!file) return;
    const validationError = validateRulebookFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setRulebook(file);
    setError("");
    if (name === "我的游戏") {
      setName(file.name.replace(/\.(pdf|txt|md|markdown)$/i, ""));
    }
  }

  function selectVisualAssets(files?: FileList | File[]) {
    const next = Array.from(files ?? []);
    if (!next.length) return;
    const validationErrors = validateImageAssets(next);
    if (validationErrors.length) {
      setError(validationErrors.join(" "));
      return;
    }
    setVisualAssets(next);
    setError("");
  }

  const showPipeline = busy || completedStages > 0;
  const hasGenerationInput = Boolean(
    description.trim() || rulebook || rulesText.trim() || visualAssets.length,
  );

  return (
    <main className="studio-home" id="main">
      <aside className="studio-sidebar">
        <Brand />
        <a className="studio-new" href="/">＋ 新游戏</a>
        <nav aria-label="最近项目">
          <span>项目</span>
          {projects.slice(0, 8).map((project) => (
            <a href={`/studio/${project.id}`} key={project.id}>
              <i aria-hidden="true">◇</i>
              <span><strong>{project.name}</strong><small>v{project.version}</small></span>
            </a>
          ))}
          {!projects.length && <small>生成后，项目会出现在这里。</small>}
        </nav>
        <a className="studio-install" href="/chatgpt-plugin">在 Codex 中使用</a>
      </aside>

      <section className="studio-stage">
        <header className="studio-topbar">
          <span>Game studio</span>
          <div><span className="studio-status-dot" /> Local workspace</div>
        </header>
        <div className="studio-welcome">
          <div className="studio-orbit" aria-hidden="true"><span>GD</span></div>
          <p>GoDesk Creator</p>
          <h1>今天要做一款什么游戏？</h1>
          <span>上传剧本或规则，生成别人能立刻打开、立刻玩、还能联机的游戏。</span>
        </div>

        <section className="default-examples studio-examples" aria-label="从案例开始">
          <div className="section-heading">
            <div>
              <span>Default examples</span>
              <h2>从案例开始</h2>
            </div>
            <p>一点即可生成可玩对局。把邀请链接发给别人，对方立刻能玩。</p>
          </div>
          <div className="example-grid">
            {DEFAULT_EXAMPLES.map((example) => (
              <article key={example.id}>
                <span className="example-kicker">{example.kicker}</span>
                <h3>{example.title}</h3>
                <p>{example.summary}</p>
                <dl>
                  <div><dt>人数</dt><dd>{example.players}</dd></div>
                  <div><dt>时长</dt><dd>{example.duration}</dd></div>
                  <div><dt>状态</dt><dd>{example.status}</dd></div>
                </dl>
                <small>{example.rights}</small>
                <button
                  disabled={Boolean(exampleBusy) || busy}
                  onClick={() => copyExample(example.id)}
                  type="button"
                >
                  {exampleBusy === example.id ? "正在创建…" : "复制并创建共享会话"}
                </button>
              </article>
            ))}
          </div>
        </section>

        <form aria-busy={busy} className="studio-composer" onSubmit={submit}>
            <div className="studio-fields">
              <label>
                <span>项目名称</span>
                <input maxLength={80} onChange={(event) => setName(event.currentTarget.value)} value={name} />
              </label>
              <label>
                <span>描述你的游戏想法</span>
                <textarea
                  maxLength={2_000}
                  onChange={(event) => setDescription(event.currentTarget.value)}
                  placeholder="例如：三个人轮流把两个无关概念连成新点子，每轮必须沿用上一位提出的限制。"
                  rows={3}
                  value={description}
                />
              </label>
            </div>

            <label
              className={`studio-dropzone ${rulebook ? "has-file" : ""}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                selectRulebook(event.dataTransfer.files[0]);
              }}
            >
              <input
                accept=".pdf,.txt,.md,.markdown,application/pdf,text/plain,text/markdown"
                onChange={(event) => selectRulebook(event.currentTarget.files?.[0])}
                type="file"
              />
              <span className="studio-file-icon" aria-hidden="true">↥</span>
              <span>
                <strong>{rulebook ? rulebook.name : "附上 PDF 或文本规则（可选）"}</strong>
                <small>{rulebook ? `${(rulebook.size / 1024).toFixed(1)} KB · 点击替换` : "或点击选择文件 · PDF / TXT / MD · 最大 25 MB"}</small>
              </span>
              {rulebook && <b aria-label="文件已就绪">Ready</b>}
            </label>

            <label
              className={`studio-dropzone ${visualAssets.length ? "has-file" : ""}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                selectVisualAssets(event.dataTransfer.files);
              }}
            >
              <input
                accept="image/jpeg,image/png,image/webp,image/gif"
                aria-describedby="asset-upload-help"
                multiple
                onChange={(event) => selectVisualAssets(event.currentTarget.files ?? undefined)}
                type="file"
              />
              <span className="studio-file-icon" aria-hidden="true">▧</span>
              <span>
                <strong>{visualAssets.length ? `${visualAssets.length} 份图片素材已就绪` : "添加图片素材（可选）"}</strong>
                <small id="asset-upload-help">JPG / PNG / WebP / GIF · 单文件 25 MB · 最多 8 张</small>
              </span>
              {visualAssets.length > 0 && <b aria-label="图片素材已就绪">Ready</b>}
            </label>

            {visualAssets.length > 0 && (
              <div className="studio-fields image-use-field">
                <label>
                  <span>上传图片怎么使用</span>
                  <select
                    onChange={(event) => setVisualAssetUse(
                      event.currentTarget.value as "visual-reference" | "project-asset",
                    )}
                    value={visualAssetUse}
                  >
                    <option value="visual-reference">参考图 — 只指导生成风格</option>
                    <option value="project-asset">项目素材 — 原样放进游戏</option>
                  </select>
                  <small>
                    参考图不会直接出现在游戏里；项目素材可以绑定到卡牌、区域或整体展示。
                  </small>
                </label>
              </div>
            )}

            <details className="studio-paste">
              <summary>没有文件？直接粘贴规则文本</summary>
              <textarea
                disabled={Boolean(rulebook)}
                onChange={(event) => setRulesText(event.currentTarget.value)}
                placeholder="在这里粘贴规则全文……"
                rows={6}
                value={rulesText}
              />
            </details>

            <footer className="studio-submit-row">
              <span id="studio-submit-help">有来源时会进入 Source Library；只有一个想法或一组素材也能开始。</span>
              <button
                aria-describedby="studio-submit-help"
                disabled={busy || !name.trim() || !hasGenerationInput}
                type="submit"
              >
                {busy ? <><i className="studio-spinner" /> {stageLabel || "处理中…"}</> : <>生成 Rule System <b aria-hidden="true">→</b></>}
              </button>
            </footer>
        </form>

        {showPipeline && (
          <ol className="generation-list" aria-label="生成阶段">
            {GENERATION_STAGES.map((stage, index) => {
              const complete = index < completedStages;
              const active = activeStage === stage.id && !complete;
              return (
                <li className={complete ? "complete" : active ? "active" : ""} key={stage.id}>
                  <span className="generation-status" aria-hidden="true">
                    {complete ? "✓" : active ? "…" : String(index + 1)}
                  </span>
                  <div>
                    <strong>{stage.name}</strong>
                    <small>{stage.detail}</small>
                  </div>
                  <b>{complete ? "完成" : active ? "处理中" : "等待"}</b>
                </li>
              );
            })}
          </ol>
        )}

        {error && <p className="studio-error" role="alert">{error}</p>}

        {!showPipeline && (
          <div className="studio-capabilities" aria-label="生成步骤">
            <span><b>01</b> 导入来源</span>
            <span><b>02</b> 解析规则</span>
            <span><b>03</b> 审阅生成计划</span>
            <span><b>04</b> 配置并编译</span>
            <span><b>05</b> 分享联机</span>
          </div>
        )}
      </section>
    </main>
  );
}

function ProjectStudio({ projectId }: { projectId: string }) {
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
  const [findingParticipants, setFindingParticipants] = useState("");
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
    setSessionHypothesisId((current) =>
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
      let playtestJob: CreatorJob | undefined;
      let room: SharedSession | undefined;
      if (build.ruleSystem.runtimeSupport.status === "executable") {
        playtestJob = await completeBotPlaytest(build.id);
      }
      if (buildCanOpenSharedSession(build)) {
        room = await createSharedSession(build.id, {
          seed: 42,
          idempotencyKey: crypto.randomUUID(),
          ...(sessionHypothesisId ? { hypothesisId: sessionHypothesisId } : {}),
        });
      }
      await loadProject();
      setIterationPrompt("");
      setIterationFindingId("");
      setNotice(
        `${iteration?.summary ?? "聚焦改动已应用"} · Build ${build.id} · ${
          playtestJob
            ? `自动试玩 ${playtestJob.id}${room ? ` · Studio 试玩 ${room.id}` : ""}`
            : `编译任务 ${buildJob.id} 已完成`
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
        const playtestJob = await completeBotPlaytest(build.id);
        const room = await createSharedSession(build.id, {
          seed: 42,
          idempotencyKey: crypto.randomUUID(),
          ...(sessionHypothesisId
            ? { hypothesisId: sessionHypothesisId }
            : {}),
        });
        setSessions((current) => [room, ...current]);
        await loadProject();
        setNotice(
          `计划已确认 · Build ${build.id} · 自动试玩 ${playtestJob.id} · Studio 试玩 ${room.id}`,
        );
        return;
      }
      await loadProject();
      setNotice(
        `计划已确认并完成 Build ${build.id}（任务 ${buildJob.id}）。当前规则或视觉门槛不支持 Shared Session，请查看 unsupported behavior。`,
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
            : "确认、构建或自动试玩失败。",
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

  async function submitBuildHandoff(
    build: PlayableBuild,
    kind: "render-preview" | "export-build",
  ) {
    if (!project) return;
    setBusy(true);
    setFormError("");
    try {
      const submitted = await submitJob(project.id, {
        kind,
        buildId: build.id,
        idempotencyKey: crypto.randomUUID(),
      });
      const job = await trackJob(submitted);
      if (job.status === "failed") throw new Error(job.error ?? "任务失败。");
      await loadProject();
      const url =
        kind === "render-preview"
          ? job.result?.previewUrl
          : job.result?.artifactUrl;
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
      setFormError(reason instanceof Error ? reason.message : "创建 Shared Session 失败。");
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
      setSessionHypothesisId(result.hypotheses.at(-1)?.id ?? "");
      setHypothesisQuestion("");
      setHypothesisSignal("");
      setNotice("设计假设已记录。下一步请选择试玩证据并写下结论。");
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
      const participantNames = findingParticipants
        .split(/[，,\n]/)
        .map((name) => name.trim())
        .filter(Boolean);
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
                  participantNames,
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
      setFindingParticipants("");
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
    setFindingParticipants("");
    setFindingCreatorAttested(false);
    setFindingVerdict("inconclusive");
    setFindingNotes(participantFeedbackFindingNotes(feedback, actionLabel));
    setFindingNextChange("");
    setNotice(
      session.experiment
        ? `已带入 ${session.id} 的 ${session.feedback.length} 条反馈；请判断结论并写下一版聚焦改动。`
        : `已带入探索性 Room ${session.id}；请先选择或新建设计假设，再判断结论。`,
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
        <h1>{projectMissing ? "这个项目已不存在。" : "这个项目打不开。"}</h1>
        <p role="alert">
          {projectMissing
            ? "这个链接指向的 Game Project 已不在当前工作区，可能来自一次隔离测试。请从项目列表打开有效项目。"
            : loadError}
        </p>
        <a href="/">返回项目列表</a>
      </main>
    );
  }

  if (!project || !ruleSystem) {
    return (
      <main className="studio-status" id="main" aria-busy="true">
        <span className="loading-mark" aria-hidden="true">GD</span>
        <h1>正在打开 Game Project…</h1>
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

  return (
    <main className="creator-studio" id="main">
      <aside className="studio-rail" aria-label="项目导航">
        <Brand />
        <nav>
          <span>工作区</span>
          <a aria-current="page" href="#overview">游戏概览</a>
          <a href="#plan">生成计划</a>
          <a href="#builds">构建与试玩</a>
          <a href="#validation">验证想法</a>
          <a href="#rule-systems">版本与来源</a>
          <a href="#activity">项目记录</a>
        </nav>
        <a className="back-projects" href="/">← 返回所有项目</a>
      </aside>

      <section className="studio-canvas">
        <header className="studio-header">
          <div>
            <span>Game Project</span>
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
              <span>GoDesk Agent</span>
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
            <section className={`generation-plan-panel ${generationPlan.status}`} id="plan">
              <header className="studio-section-heading">
                <div>
                  <span className="panel-label">Generation Plan · {generationPlan.status === "pending" ? "待确认" : "已确认"}</span>
                  <h2>先看懂，再让它变成可玩版本</h2>
                </div>
                <code title={generationPlan.id}>{generationPlan.id}</code>
              </header>
              <p className="generation-plan-summary">{generationPlan.summary}</p>
              <dl className="generation-plan-facts">
                <div><dt>玩家</dt><dd>{generationPlan.participants.min}–{generationPlan.participants.max} 人</dd></div>
                <div><dt>时长</dt><dd>{generationPlan.durationMinutes} 分钟</dd></div>
                <div><dt>界面</dt><dd>{generationPlan.playSurface.kind} · {generationPlan.playSurface.layout || "未命名布局"}</dd></div>
                <div><dt>来源</dt><dd>{generationPlan.sourceIds.length} 个可追溯条目</dd></div>
              </dl>
              <div className="generation-plan-columns">
                <section>
                  <strong>玩法循环</strong>
                  {generationPlan.loop.length ? (
                    <ol>{generationPlan.loop.map((item) => <li key={item}>{item}</li>)}</ol>
                  ) : <p>尚未识别到明确流程。</p>}
                </section>
                <section>
                  <strong>可用行动</strong>
                  {generationPlan.actions.length ? (
                    <ul>{generationPlan.actions.map((action) => <li key={`${action.label}-${action.description}`}><b>{action.label}</b><span>{action.description}</span></li>)}</ul>
                  ) : <p>尚未识别到明确行动。</p>}
                </section>
                <section>
                  <strong>预期结果</strong>
                  {generationPlan.outcomes.length ? (
                    <ul>{generationPlan.outcomes.map((outcome) => <li key={outcome}>{outcome}</li>)}</ul>
                  ) : <p>尚未识别到明确结果。</p>}
                </section>
                <section>
                  <strong>假设与边界</strong>
                  <ul>
                    {[...generationPlan.assumptions, ...generationPlan.unsupported.map((item) => `未支持：${item}`)].map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </section>
              </div>
              {generationPlan.status === "pending" ? (
                <div className="generation-plan-actions">
                  <p>确认后立即创建 immutable Build；之后仍可编辑完整 Rule System 并继续生成新版本。</p>
                  <button
                    disabled={busy || ruleSystemDirty || Boolean(sourceDraft.trim())}
                    onClick={approveGenerationPlan}
                    type="button"
                  >
                    {busy ? "正在确认并构建…" : "确认计划并构建版本"}
                  </button>
                  <small>可执行版本会继续完成固定 seed 自动试玩，并在本页打开权威 Shared Session。</small>
                </div>
              ) : (
                <p className="generation-plan-approved" role="status">计划已确认 · 可以继续编辑、编译与分享。</p>
              )}
            </section>
          )}
          <section className="ruleSystem-panel" id="overview">
            <header className="studio-section-heading">
              <div>
                <span className="panel-label">当前游戏版本 · d{ruleSystem.version}</span>
                <h2>游戏概览</h2>
              </div>
              <code title={project.activeRuleSystemId}>
                {project.activeRuleSystemId}
              </code>
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
                <summary>编辑完整 Rule System <small>JSON</small></summary>
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

          <section className="build-workflow" id="builds">
            <header className="studio-section-heading">
              <div>
                <span className="panel-label">构建与试玩</span>
                <h2>制作可玩版本</h2>
              </div>
              <button
                disabled={
                  busy ||
                  ruleSystemDirty ||
                  Boolean(sourceDraft.trim()) ||
                  generationPlan?.status === "pending"
                }
                onClick={buildPlayable}
                type="button"
              >
                {busy ? "正在处理…" : "编译新版本"}
              </button>
            </header>
            {(ruleSystemDirty || sourceDraft.trim()) && (
              <p className="workflow-hint">请先保存上方更改，再编译新的可玩版本。</p>
            )}
            {generationPlan?.status === "pending" && (
              <p className="workflow-hint">请先在“生成计划”中确认这次自然语言/规则来源的解释，再创建 Build。</p>
            )}
            <div className="workflow-steps">
              <article>
                <span>1</span>
                <div>
                  <small>运行规则</small>
                  <strong>
                    {ruleSystem.runtimeSupport.status === "executable"
                      ? "已配置"
                      : "需要配置"}
                  </strong>
                  <p>
                    {ruleSystem.runtimeSupport.status === "executable"
                      ? ruleSystem.runtimeSupport.kernel.type
                      : "通过 Codex 按来源中的明确规则配置 Executable Kernel。"}
                  </p>
                </div>
              </article>
              <article>
                <span>2</span>
                <div>
                  <small>可玩版本</small>
                  <strong>{builds.length ? `已有 ${builds.length} 个版本` : "尚未构建"}</strong>
                  <p>每次编译都会保留为不可变版本。</p>
                </div>
              </article>
              <article>
                <span>3</span>
                <div>
                  <small>测试结果</small>
                  <strong>{playtests.length ? `${playtests.length} 次自动试玩` : "等待试玩"}</strong>
                  <p>{sessions.length ? `${sessions.length} 个 Shared Session` : "构建后可创建 Shared Session。"}</p>
                </div>
              </article>
            </div>

            <section className="iteration-panel" id="iteration" aria-labelledby="iteration-title">
              <header>
                <div>
                  <span className="panel-label">Studio Follow-up</span>
                  <h3 id="iteration-title">直接写下一版聚焦改动</h3>
                  <p>
                    写一个明确的行动说明改写；GoDesk 会保存原提示、生成下一版、编译并用 seed 42 自动试玩。
                  </p>
                </div>
                <span className="iteration-contract">当前支持：行动说明</span>
              </header>
              <form onSubmit={iterateFromPrompt}>
                <label className="ruleSystem-field" htmlFor="iteration-prompt">
                  <span>下一版改动</span>
                  <textarea
                    id="iteration-prompt"
                    maxLength={2000}
                    onChange={(event) => setIterationPrompt(event.currentTarget.value)}
                    placeholder="例如：把行动 2 的说明改成“先说明新增约束，再说明获得 2 分”。"
                    rows={3}
                    value={iterationPrompt}
                  />
                  <small>一次只提交一个改动。无法安全识别的规则数值、行动增删或胜利条件不会写入项目。</small>
                </label>
                <label className="ruleSystem-field" htmlFor="iteration-finding">
                  <span>关联验证 Finding <small>可选</small></span>
                  <select
                    id="iteration-finding"
                    onChange={(event) => setIterationFindingId(event.currentTarget.value)}
                    value={iterationFindingId}
                  >
                    <option value="">不绑定 Finding</option>
                    {[...findings].reverse().map((finding) => (
                      <option key={finding.id} value={finding.id}>
                        {finding.id} · {finding.nextChange.slice(0, 72)}
                      </option>
                    ))}
                  </select>
                  <small>绑定后，新 Build 和 changeset 会保留这条 Finding 的 lineage。</small>
                </label>
                <div className="iteration-actions">
                  <button
                    disabled={
                      busy ||
                      generationPlan?.status === "pending" ||
                      builds.length === 0 ||
                      !iterationPrompt.trim()
                    }
                    type="submit"
                  >
                    {busy ? "正在生成、编译并自测…" : "应用改动并自动试玩"}
                  </button>
                  {builds.length === 0 && generationPlan?.status !== "pending" && (
                    <small>先完成一个 Build，才能对比下一版。</small>
                  )}
                  {generationPlan?.status === "pending" && (
                    <small>先确认 Generation Plan，避免在计划尚未通过时创建版本。</small>
                  )}
                </div>
              </form>
            </section>

            {studioPlayTarget.build && buildCanOpenSharedSession(studioPlayTarget.build) && (
              <section className="studio-play" aria-labelledby="studio-play-title">
                <header>
                  <div>
                    <span className="panel-label">Live Shared Session</span>
                    <h3 id="studio-play-title">在 Studio 里立即试玩</h3>
                    <p>
                      Rule System v{studioPlayTarget.build.ruleSystemVersion} · 所有行动都会进入权威 Session State 与 Replay。
                    </p>
                  </div>
                  <div>
                    <button
                      disabled={busy}
                      onClick={() => startRoom(studioPlayTarget.build!, "studio")}
                      type="button"
                    >
                      {studioPlayTarget.session ? "新开一局" : "开始 Studio 试玩"}
                    </button>
                    {studioPlayTarget.session && (
                      <a href={studioPlayTarget.session.sessionUrl}>独立打开</a>
                    )}
                  </div>
                </header>
                <div className="playtest-publish">
                  <div>
                    <span className="panel-label">Stable Playtest Link</span>
                    <strong>
                      {playtestLink
                        ? playtestLink.buildId === studioPlayTarget.build.id
                          ? "固定入口正在提供当前 Build"
                          : "固定入口仍保留在旧 Build"
                        : "尚未发布固定试玩入口"}
                    </strong>
                    <small>
                      发布会新建一局并切换固定链接；旧 Room、Replay 与已经打开的试玩不变。
                    </small>
                  </div>
                  {playtestLink && (
                    <label>
                      <span>好友试玩链接</span>
                      <input aria-label="固定好友试玩链接" readOnly value={playtestLink.url} />
                    </label>
                  )}
                  <div>
                    {playtestLink && (
                      <button disabled={busy} onClick={() => void copyPlaytestLink()} type="button">
                        {playtestLinkCopied ? "已复制" : "复制固定链接"}
                      </button>
                    )}
                    <button
                      disabled={busy}
                      onClick={() => void publishPlaytest(studioPlayTarget.build!)}
                      type="button"
                    >
                      {playtestLink ? "用当前 Build 更新入口" : "发布固定试玩入口"}
                    </button>
                  </div>
                </div>
                {studioPlayTarget.session ? (
                  <iframe
                    allow="clipboard-write"
                    key={studioPlayTarget.session.id}
                    src={studioPlayTarget.session.sessionUrl}
                    title={`${studioPlayTarget.build.ruleSystem.name} Studio 试玩`}
                  />
                ) : (
                  <div className="studio-play-empty">
                    <strong>这个 Build 还没有 Shared Session。</strong>
                    <p>新开一局后直接在这里认领席位、行动和提交反馈；好友仍可使用独立邀请链接。</p>
                  </div>
                )}
              </section>
            )}

            {buildComparison && (
              <section className="build-comparison" aria-labelledby="build-comparison-title">
                <header>
                  <div>
                    <span className="panel-label">固定 seed 自动试玩</span>
                    <h3 id="build-comparison-title">最新两个版本对比</h3>
                  </div>
                  <code>seed {buildComparison.candidatePlaytest.seed}</code>
                </header>
                <div className="build-comparison-versions">
                  {([
                    ["旧版", buildComparison.baselineBuild, buildComparison.baselinePlaytest],
                    ["新版", buildComparison.candidateBuild, buildComparison.candidatePlaytest],
                  ] as const).map(([label, build, playtest]) => (
                    <article key={build.id}>
                      <span>{label}</span>
                      <strong>Rule System v{build.ruleSystemVersion}</strong>
                      <small>{build.ruleSystem.runtimeSupport.status === "executable"
                        ? build.ruleSystem.runtimeSupport.kernel.type
                        : "draft"}</small>
                      <dl>
                        <div><dt>回合</dt><dd>{playtest.metrics.turns}</dd></div>
                        <div><dt>结果</dt><dd>{playtestOutcome(playtest)}</dd></div>
                        <div><dt>终局分数</dt><dd>{playtest.metrics.finalScores.join(" / ")}</dd></div>
                      </dl>
                      <a href={playtest.replayUrl}>打开 Replay</a>
                    </article>
                  ))}
                </div>
                {buildComparisonFinding && (
                  <aside className="build-comparison-lineage" aria-label="迭代依据">
                    <span>迭代依据</span>
                    <a href={`#finding-${buildComparisonFinding.id}`}>
                      {buildComparisonFinding.id}
                    </a>
                    <strong>{buildComparisonFinding.nextChange}</strong>
                  </aside>
                )}
                <footer>
                  <strong>
                    回合数变化：{signedDelta(
                      buildComparison.candidatePlaytest.metrics.turns
                        - buildComparison.baselinePlaytest.metrics.turns,
                    )}
                  </strong>
                  <small>这是同 seed bot simulation 对比，不是真人验证，也不自动证明新版更好。</small>
                </footer>
              </section>
            )}

            {builds.length > 0 ? (
              <>
              <label className="session-hypothesis-selector">
                <span>这次 Shared Session 要验证什么？</span>
                <select
                  disabled={busy}
                  onChange={(event) =>
                    setSessionHypothesisId(event.currentTarget.value)}
                  value={sessionHypothesisId}
                >
                  <option value="">探索性试玩，不绑定验证问题</option>
                  {hypotheses.map((hypothesis) => (
                    <option key={hypothesis.id} value={hypothesis.id}>
                      {hypothesis.question}
                    </option>
                  ))}
                </select>
                <small>绑定后，好友会在 Room 中看到这个问题，反馈也只能用于这条 Design Hypothesis。</small>
              </label>
              <details className="build-history">
                <summary>查看可玩版本与操作 <span>{builds.length}</span></summary>
                <ul>
                  {builds.map((build) => (
                    <li key={build.id}>
                      <a href={build.playableUrl}>
                        <span>{build.ruleSystem.name}</span>
                        <small>Rule System v{build.ruleSystemVersion}</small>
                      </a>
                      {build.warnings.length > 0 && (
                        <small>{build.warnings.length} warnings</small>
                      )}
                      <div className="build-actions">
                        <button
                          disabled={
                            busy ||
                            ruleSystemDirty ||
                            Boolean(sourceDraft.trim()) ||
                            generationPlan?.status === "pending" ||
                            sameRuleSystemContent(ruleSystem, build.ruleSystem)
                          }
                          onClick={() => restoreBuildVersion(build)}
                          type="button"
                        >
                          恢复为新编辑版本
                        </button>
                        <button
                          disabled={busy}
                          onClick={() =>
                            submitBuildHandoff(build, "render-preview")}
                          type="button"
                        >
                            打开预览
                        </button>
                        <button
                          disabled={busy}
                          onClick={() =>
                            submitBuildHandoff(build, "export-build")}
                          type="button"
                        >
                            导出项目
                        </button>
                      </div>
                      {build.ruleSystem.runtimeSupport.status ===
                        "executable" && (
                        <div className="build-actions">
                          <button
                            disabled={busy}
                            onClick={() => startBotPlaytest(build)}
                            type="button"
                          >
                            自动试玩
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => startRoom(build)}
                            type="button"
                          >
                            创建 Shared Session
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
              </>
            ) : (
              <p className="workflow-empty">编译后，可在这里预览、导出或开始试玩。</p>
            )}
          </section>

          <section className="validation-workflow" id="validation">
            <header className="studio-section-heading">
              <div>
                <span className="panel-label">从试玩中学习</span>
                <h2>验证创作想法</h2>
              </div>
              <span className="validation-count">
                {hypotheses.length} 个假设 · {findings.length} 条结论
              </span>
            </header>
            <p className="workflow-hint">
              先写下想验证的问题和成功信号，再把结论绑定到具体 Build 与试玩记录。参与者反馈可作为独立观察输入，但不会自动变成真人证据。
            </p>
            <section className="feedback-inbox" aria-labelledby="feedback-inbox-title">
              <header>
                <div>
                  <span className="panel-label">Feedback Inbox</span>
                  <h3 id="feedback-inbox-title">试玩反馈收件箱</h3>
                </div>
                <strong>{unreviewedFeedbackCount} 条待归纳</strong>
              </header>
              {feedbackInbox.length ? (
                <ul>
                  {feedbackInbox.map(({ session, feedback }) => {
                    const recordedFinding = feedbackFindings.get(feedback.id);
                    const build = builds.find((candidate) => candidate.id === session.buildId);
                    const actionLabel = build?.ruleSystem.actions.find(
                      (action) => action.id === feedback.moment.actionId,
                    )?.label ?? feedback.moment.actionId;
                    return (
                      <li key={feedback.id}>
                        <div className="feedback-inbox-rating" aria-label={`${feedback.rating} / 5`}>
                          {"★".repeat(feedback.rating)}{"☆".repeat(5 - feedback.rating)}
                        </div>
                        <blockquote>{feedback.comment}</blockquote>
                        <p>
                          座位 {feedback.seat} · 行动 #{feedback.moment.actionSequence} {actionLabel}
                        </p>
                        <small>
                          {session.experiment
                            ? `验证：${session.experiment.question}`
                            : "探索性试玩 · 尚未绑定 Design Hypothesis"}
                        </small>
                        <div className="feedback-inbox-actions">
                          <a href={session.replayUrl}>检查 Replay</a>
                          {recordedFinding ? (
                            <a href={`#finding-${recordedFinding.id}`}>查看已记录结论</a>
                          ) : (
                            <button
                              disabled={busy}
                              onClick={() => prepareParticipantFeedbackFinding(session, feedback)}
                              type="button"
                            >
                              用这局反馈记录结论
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="feedback-inbox-empty">
                  <strong>还没有参与者反馈。</strong>
                  <p>发布 Playtest Link 后，参与者完成一次行动即可提交评分和评论。</p>
                  <a href="#builds">去发布试玩链接</a>
                </div>
              )}
            </section>
            <div className="validation-columns">
              <form onSubmit={addDesignHypothesis}>
                <strong>1. 提出设计假设</strong>
                <label htmlFor="hypothesis-question">
                  <span>想验证的问题</span>
                  <textarea
                    id="hypothesis-question"
                    maxLength={500}
                    onChange={(event) => setHypothesisQuestion(event.currentTarget.value)}
                    placeholder="例如：加入时间压力是否会让选择更有张力？"
                    rows={3}
                    value={hypothesisQuestion}
                  />
                </label>
                <label htmlFor="hypothesis-signal">
                  <span>什么现象算成功？</span>
                  <textarea
                    id="hypothesis-signal"
                    maxLength={500}
                    onChange={(event) => setHypothesisSignal(event.currentTarget.value)}
                    placeholder="例如：两位参与者都能在 30 秒内做出不同选择。"
                    rows={3}
                    value={hypothesisSignal}
                  />
                </label>
                <button
                  disabled={busy || !hypothesisQuestion.trim() || !hypothesisSignal.trim()}
                  type="submit"
                >
                  记录设计假设
                </button>
              </form>

              <form id="validation-finding" onSubmit={recordValidationFinding}>
                <strong>2. 记录验证结论</strong>
                <label htmlFor="finding-hypothesis">
                  <span>设计假设</span>
                  <select
                    id="finding-hypothesis"
                    onChange={(event) => setFindingHypothesisId(event.currentTarget.value)}
                    value={findingHypothesisId}
                  >
                    <option value="">选择一个假设</option>
                    {hypotheses.map((hypothesis) => (
                      <option key={hypothesis.id} value={hypothesis.id}>
                        {hypothesis.question}
                      </option>
                    ))}
                  </select>
                </label>
                <label htmlFor="finding-build">
                  <span>验证的 Build</span>
                  <select
                    id="finding-build"
                    onChange={(event) => setFindingBuildId(event.currentTarget.value)}
                    value={findingBuildId}
                  >
                    <option value="">选择一个可玩版本</option>
                    {builds.map((build) => (
                      <option key={build.id} value={build.id}>
                        {build.ruleSystem.name} · d{build.ruleSystemVersion}
                      </option>
                    ))}
                  </select>
                </label>
                <label htmlFor="finding-evidence-type">
                  <span>证据类型</span>
                  <select
                    id="finding-evidence-type"
                    onChange={(event) => {
                      setFindingEvidenceType(event.currentTarget.value as typeof findingEvidenceType);
                      setFindingEvidenceId("");
                    }}
                    value={findingEvidenceType}
                  >
                    <option value="automated-playtest">自动试玩</option>
                    <option value="participant-feedback">参与者反馈</option>
                    <option value="human-session">真人共同试玩</option>
                  </select>
                </label>
                <label htmlFor="finding-evidence">
                  <span>
                    {findingEvidenceType === "automated-playtest"
                      ? "自动试玩记录"
                      : findingEvidenceType === "participant-feedback"
                        ? "有反馈的 Shared Session"
                        : "真人 Shared Session"}
                  </span>
                  <select
                    id="finding-evidence"
                    onChange={(event) => setFindingEvidenceId(event.currentTarget.value)}
                    value={findingEvidenceId}
                  >
                    <option value="">选择证据</option>
                    {findingEvidenceType === "automated-playtest"
                      ? playtests.map((evidence) => (
                        <option key={evidence.id} value={evidence.id}>
                          {evidence.id}
                        </option>
                      ))
                      : sessions
                        .filter((session) =>
                          findingEvidenceType !== "participant-feedback" || session.feedback.length > 0,
                        )
                        .map((evidence) => (
                          <option key={evidence.id} value={evidence.id}>
                            {evidence.id}
                            {findingEvidenceType === "participant-feedback"
                              ? ` · ${evidence.feedback.length} 条反馈`
                              : ""}
                          </option>
                        ))}
                  </select>
                </label>
                {findingEvidenceType === "participant-feedback" && (
                  <small>
                    GoDesk 会把当前 Room 中的评分与评论保存为不可变反馈快照；这不是真人参与声明。
                  </small>
                )}
                {findingEvidenceType === "human-session" && (
                  <>
                    <label htmlFor="finding-participants">
                      <span>参与者姓名</span>
                      <input
                        id="finding-participants"
                        onChange={(event) => setFindingParticipants(event.currentTarget.value)}
                        placeholder="Creator, Friend"
                        value={findingParticipants}
                      />
                      <small>至少两位真实参与者，用逗号分隔；Shared Session 也必须已有两个席位和一次有效行动。</small>
                    </label>
                    <label htmlFor="finding-human-attestation">
                      <span>真人证据声明</span>
                      <input
                        checked={findingCreatorAttested}
                        id="finding-human-attestation"
                        onChange={(event) => setFindingCreatorAttested(event.currentTarget.checked)}
                        type="checkbox"
                      />
                      <small>我确认以上姓名对应真实参与者；自动客户端或机器人结果不得勾选。</small>
                    </label>
                  </>
                )}
                <label htmlFor="finding-verdict">
                  <span>结论</span>
                  <select
                    id="finding-verdict"
                    onChange={(event) => setFindingVerdict(event.currentTarget.value as ValidationFinding["verdict"])}
                    value={findingVerdict}
                  >
                    <option value="supported">得到支持</option>
                    <option value="refuted">未得到支持</option>
                    <option value="inconclusive">证据不足</option>
                  </select>
                </label>
                <label htmlFor="finding-notes">
                  <span>观察记录</span>
                  <textarea
                    id="finding-notes"
                    maxLength={2000}
                    onChange={(event) => setFindingNotes(event.currentTarget.value)}
                    placeholder="记录发生了什么，以及下一版准备改什么。"
                    rows={3}
                    value={findingNotes}
                  />
                </label>
                <label htmlFor="finding-next-change">
                  <span>下一版聚焦改动</span>
                  <textarea
                    id="finding-next-change"
                    maxLength={1000}
                    onChange={(event) => setFindingNextChange(event.currentTarget.value)}
                    placeholder="例如：把调查线索从 +2 调到 +3，再用相同 seed 重测。"
                    rows={2}
                    value={findingNextChange}
                  />
                  <small>写成一次可执行的后续迭代；Codex 会以此为输入回到同一项目。</small>
                </label>
                <button
                  disabled={
                    busy ||
                    !findingHypothesisId ||
                    !findingBuildId ||
                    !findingEvidenceId ||
                    !findingNextChange.trim() ||
                    (findingEvidenceType === "human-session" &&
                      (findingParticipants.split(/[，,\n]/).filter((name) => name.trim()).length < 2 ||
                        !findingCreatorAttested))
                  }
                  type="submit"
                >
                  保存验证结论
                </button>
              </form>
            </div>
            {findings.length > 0 && (
              <ul className="validation-findings">
                {[...findings].reverse().map((finding) => {
                  const hypothesis = hypotheses.find((candidate) => candidate.id === finding.hypothesisId);
                  return (
                    <li id={`finding-${finding.id}`} key={finding.id}>
                      <span>{finding.verdict === "supported" ? "得到支持" : finding.verdict === "refuted" ? "未得到支持" : "证据不足"}</span>
                      <strong>{hypothesis?.question ?? finding.hypothesisId}</strong>
                      <p>{finding.notes || "未填写观察记录。"}</p>
                      <p className="finding-next-change">下一版：{finding.nextChange}</p>
                      <small>
                        {finding.evidence.type === "human-session"
                          ? "真人共同试玩（创作者声明）"
                          : finding.evidence.type === "participant-feedback"
                            ? "参与者反馈（非真人验收）"
                            : "自动试玩"}
                        {" · "}{finding.buildId}
                      </small>
                      <div className="finding-handoff">
                        <code>{finding.id}</code>
                        <button
                          disabled={busy}
                          onClick={() => void copyFindingContinuation(finding)}
                          type="button"
                        >
                          {copiedFindingId === finding.id ? "已复制" : "复制给 Codex"}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          </div>

          <aside className="project-facts" aria-label="项目详情">
            <section className="project-snapshot">
              <span className="panel-label">项目摘要</span>
              <dl>
                <div><dt>规则</dt><dd>{ruleSystem.rules.length}</dd></div>
                <div><dt>约束</dt><dd>{ruleSystem.constraints.length}</dd></div>
                <div><dt>实体</dt><dd>{ruleSystem.entities.length}</dd></div>
                <div><dt>行动</dt><dd>{ruleSystem.actions.length}</dd></div>
                <div><dt>阶段</dt><dd>{ruleSystem.stages.length}</dd></div>
              </dl>
              <p>{ruleSystem.pitch || "还没有填写一句话玩法。"}</p>
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

const resultCopy = {
  port: "抵达港口",
  shipyard: "进入干坞",
  pirates: "遭私掠截获",
};

function HarborVoyageBoard({
  voyage,
  busy,
  onAct,
  readOnly = false,
}: {
  voyage: HarborVoyageState;
  busy?: boolean;
  onAct?: (actionId: string) => void;
  readOnly?: boolean;
}) {
  const [selectedPilot, setSelectedPilot] = useState<HarborCargoId>("cedar");
  const active = voyage.players.find((player) => player.seat === voyage.activeSeat);
  const hasPilot = voyage.placements.some(
    (placement) =>
      placement.seat === 0 &&
      (placement.targetId === "pilot-small" ||
        placement.targetId === "pilot-large"),
  );
  const interactive = !readOnly && Boolean(onAct) && voyage.phase !== "resolved";

  return (
    <div className="harbor-voyage-board">
      <p className="harbor-instruction">{harborInstruction(voyage)}</p>
      <div className="sea-chart">
        <div className="chart-labels">
          <span>起航</span>
          <span>私掠线 · 13</span>
          <span>港口 · 14+</span>
        </div>
        {voyage.punts.map((punt) => (
          <article className="punt-lane" key={punt.cargoId}>
            <div className="punt-title">
              <span style={{ background: punt.color }} />
              <div>
                <b>{punt.name}</b>
                <small>
                  d{punt.die} · 货值 {punt.value}
                </small>
              </div>
              <strong>{punt.position}</strong>
            </div>
            <div className="track" aria-label={`${punt.name}船当前位置 ${punt.position}`}>
              {Array.from({ length: 15 }, (_, index) => (
                <span
                  className={
                    index === 13 ? "pirate-line" : index === 14 ? "port-line" : ""
                  }
                  key={index}
                >
                  <i>{index}</i>
                </span>
              ))}
              <div
                className="punt-token"
                style={{
                  background: punt.color,
                  left: `${(Math.min(punt.position, 14) / 14) * 100}%`,
                }}
              >
                <span>船</span>
              </div>
            </div>
            <div className="punt-footer">
              <span>
                船上伙计：
                {
                  voyage.placements.filter(
                    (placement) => placement.targetId === punt.cargoId,
                  ).length
                }
                /3
              </span>
              {voyage.lastRoll[punt.cargoId] != null && (
                <b>本轮 +{voyage.lastRoll[punt.cargoId]}</b>
              )}
              {punt.result && <em>{resultCopy[punt.result]}</em>}
            </div>
          </article>
        ))}
        <div className="movement-console">
          <div>
            <span>航次节奏</span>
            <b>
              {voyage.phase === "placement"
                ? `放置 ${voyage.placementRound}/4 · Seat ${voyage.activeSeat}`
                : voyage.phase === "movement"
                  ? `航行 ${voyage.movementRound + 1}/3`
                  : voyage.phase === "pilot"
                    ? "领航"
                    : "已结算"}
            </b>
          </div>
          {interactive && voyage.phase === "movement" && (
            <button
              className="roll-button"
              disabled={busy}
              onClick={() => onAct?.("roll")}
              type="button"
            >
              <span>掷骰并航行</span>
              <small>琥珀 d4 · 钴蓝 d3 · 雪松 d2</small>
            </button>
          )}
          {interactive && voyage.phase === "pilot" && (
            <div className="pilot-console">
              <select
                aria-label="领航员选择船"
                onChange={(event) =>
                  setSelectedPilot(event.target.value as HarborCargoId)
                }
                value={selectedPilot}
              >
                {voyage.punts.map((punt) => (
                  <option key={punt.cargoId} value={punt.cargoId}>
                    {punt.name}
                  </option>
                ))}
              </select>
              <button
                disabled={busy || !hasPilot}
                onClick={() => onAct?.(`pilot:${selectedPilot}:-1`)}
                type="button"
              >
                向后
              </button>
              <button
                disabled={busy || !hasPilot}
                onClick={() => onAct?.(`pilot:${selectedPilot}:1`)}
                type="button"
              >
                向前
              </button>
              {!hasPilot && (
                <button
                  disabled={busy}
                  onClick={() => onAct?.("pilot:skip")}
                  type="button"
                >
                  跳过领航
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <section className="action-board" aria-label="派遣伙计">
        <div className="action-board-heading">
          <div>
            <span className="kicker">WORKER PLACEMENT</span>
            <h2>派遣伙计</h2>
          </div>
          <span>
            {active
              ? `${active.name} · ${active.workers} 名 · ${active.cash} 信用`
              : "—"}
          </span>
        </div>
        <div className="target-groups">
          {HARBOR_TARGET_GROUPS.map((group) => (
            <section key={group.title}>
              <header>
                <b>{group.title}</b>
              </header>
              <div>
                {group.targets.map((target) => {
                  const placements = voyage.placements.filter(
                    (placement) => placement.targetId === target.id,
                  );
                  const enabled =
                    interactive &&
                    voyage.phase === "placement" &&
                    canPlaceHarborWorker(
                      voyage,
                      voyage.activeSeat,
                      target.id as HarborTargetId,
                    );
                  return (
                    <button
                      className={enabled ? "target-space available" : "target-space"}
                      disabled={!enabled || busy}
                      key={target.id}
                      onClick={() => onAct?.(`place:${target.id}`)}
                      type="button"
                    >
                      <span className="space-topline">
                        <b>{target.name}</b>
                        <em>
                          {harborTargetCost(voyage, target.id as HarborTargetId)}{" "}
                          信用
                        </em>
                      </span>
                      <small>{target.payout}</small>
                      <span className="worker-slots">
                        {Array.from({ length: target.capacity }, (_, index) => {
                          const owner = placements[index]
                            ? voyage.players.find(
                                (player) =>
                                  player.seat === placements[index].seat,
                              )
                            : undefined;
                          return (
                            <i
                              key={index}
                              style={{ background: owner?.color }}
                              title={owner?.name}
                            >
                              {owner ? "●" : "○"}
                            </i>
                          );
                        })}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </section>

      <aside className="player-ledger">
        {voyage.players.map((player) => (
          <article
            className={
              voyage.activeSeat === player.seat && voyage.phase === "placement"
                ? "active"
                : ""
            }
            key={player.seat}
          >
            <span className="player-seal" style={{ background: player.color }} />
            <div>
              <b>{player.name}</b>
              <small>Seat {player.seat}</small>
            </div>
            <strong>
              {player.cash}
              <small>信用</small>
            </strong>
            <em>{player.workers} 名伙计</em>
          </article>
        ))}
      </aside>

      <section className="game-log">
        <span>桌面记录</span>
        <ol>
          {voyage.log
            .slice()
            .reverse()
            .slice(0, 12)
            .map((entry, index) => (
              <li key={`${entry}-${index}`}>
                <span>{String(voyage.log.length - index).padStart(2, "0")}</span>
                {entry}
              </li>
            ))}
        </ol>
      </section>
    </div>
  );
}

function PlayablePreview({ buildId }: { buildId: string }) {
  const [build, setBuild] = useState<PlayableBuild>();
  const [error, setError] = useState("");
  const shareCreator = new URLSearchParams(window.location.search).get("creator") ?? undefined;

  useEffect(() => {
    getBuild(buildId, shareCreator).then(setBuild).catch((reason: Error) => {
      setError(reason.message);
    });
  }, [buildId, shareCreator]);

  if (error) {
    return (
      <main className="studio-status" id="main">
        <h1>这个 Build 打不开。</h1>
        <p role="alert">{error}</p>
      </main>
    );
  }
  if (!build) {
    return (
      <main className="studio-status" id="main" aria-busy="true">
        <h1>正在加载 Playable Build…</h1>
      </main>
    );
  }

  const race = scoreRaceKernel(build.ruleSystem);
  const sharedGoal = sharedGoalKernel(build.ruleSystem);
  const takeAway = takeAwayKernel(build.ruleSystem);
  const rollAndMove = rollAndMoveKernel(build.ruleSystem);
  const drawAndScore = drawAndScoreKernel(build.ruleSystem);
  const pushYourLuck = pushYourLuckKernel(build.ruleSystem);
  const turnTaking = turnTakingKernel(build.ruleSystem);
  const harbor = isHarborVoyage(build.ruleSystem);
  const runtimeValues = new Map(
    race?.actions.map((action) => [action.id, action.points]) ??
      sharedGoal?.actions.map((action) => [action.id, action.progress]) ??
      takeAway?.actions.map((action) => [action.id, action.take]) ??
      [],
  );
  const runtimeTarget = race?.victoryTarget ?? sharedGoal?.goalTarget ?? takeAway?.initialPool ?? rollAndMove?.targetPosition ?? drawAndScore?.victoryTarget ?? pushYourLuck?.victoryTarget;

  return (
    <main className="playable-preview" id="main">
      <header>
        <span>Playable Build · immutable visual preview</span>
        <a href={`/studio/${build.projectId}`}>返回 Web Studio</a>
      </header>
      <section className="preview-hero">
        <div className="preview-title">
          <span>Rule System v{build.ruleSystemVersion}</span>
          <h1>{build.ruleSystem.name}</h1>
          <p>{build.ruleSystem.pitch || "这个版本还没有一句话玩法。"}</p>
        </div>
        <dl>
          <div>
            <dt>Players</dt>
            <dd>
              {build.ruleSystem.participants.min ===
              build.ruleSystem.participants.max
                ? build.ruleSystem.participants.default
                : `${build.ruleSystem.participants.min}–${build.ruleSystem.participants.max}`}
            </dd>
          </div>
          <div>
            <dt>Minutes</dt>
            <dd>{build.ruleSystem.durationMinutes}</dd>
          </div>
          <div>
            <dt>Kernel</dt>
            <dd>
              {build.ruleSystem.runtimeSupport.status === "executable"
                ? build.ruleSystem.runtimeSupport.kernel.type
                : "draft"}
            </dd>
          </div>
        </dl>
      </section>
      {harbor ? (
        <section className="preview-board" aria-label="航次桌面预览">
          <HarborVoyageBoard
            readOnly
            voyage={createHarborVoyageState(
              build.ruleSystem.participants.default,
            )}
          />
        </section>
      ) : (
        <>
          <section className="preview-board" aria-label="结构化桌面预览">
            <div className="preview-section-heading">
              <span>Visual mechanism preview</span>
              <strong>{build.ruleSystem.playSurface.layout || "未配置桌面布局"}</strong>
            </div>
            {build.ruleSystem.presentation.image && (
              <img
                alt={build.ruleSystem.presentation.image.alt}
                className="preview-rulebook-art"
                src={build.ruleSystem.presentation.image.url}
              />
            )}
            <div className="preview-board-canvas">
              {build.ruleSystem.playSurface.regions.length > 0 ? (
                build.ruleSystem.playSurface.regions.map((zone) => (
                  <article className="preview-zone" key={zone.id}>
                    {zone.image && <img alt={zone.image.alt} src={zone.image.url} />}
                    <span>Zone</span>
                    <h2>{zone.name}</h2>
                    <p>{zone.description}</p>
                  </article>
                ))
              ) : (
                <p className="preview-empty">这个 Rule System 还没有可展示的游戏区域。</p>
              )}
              <div
                className="preview-score-track"
                aria-label={takeAway ? "共享拿取池" : rollAndMove ? "位置轨道" : drawAndScore ? "抽牌牌库与分数" : pushYourLuck ? "未存分与总分" : turnTaking ? "回合轨道" : sharedGoal ? "共享目标进度" : "分数轨道"}
              >
                <span>{takeAway ? "Shared pool" : rollAndMove ? "Race track" : drawAndScore ? "Draw deck" : pushYourLuck ? "Risk and bank" : turnTaking ? "Turn order" : sharedGoal ? "Shared goal" : "Score track"}</span>
                <div>
                  <b>{takeAway?.initialPool ?? (drawAndScore ? drawAndScore.cardValues.length * drawAndScore.copiesPerValue : 0)}</b>
                  <i aria-hidden="true" />
                  <b>{takeAway ? 0 : turnTaking?.maxTurns ?? runtimeTarget ?? "—"}</b>
                </div>
                <small>
                  {race
                    ? `先达到 ${race.victoryTarget} 分 · 最多 ${race.maxTurns} 回合`
                    : sharedGoal
                      ? `共同达到 ${sharedGoal.goalTarget} 点 · 最多 ${sharedGoal.maxTurns} 回合`
                      : takeAway
                        ? `从 ${takeAway.initialPool} 个物件开始 · 拿走最后一个者获胜`
                      : rollAndMove
                        ? `D${rollAndMove.dieSides} · 先到 ${rollAndMove.targetPosition} 格 · 安全上限 ${rollAndMove.maxTurns} 回合`
                      : drawAndScore
                        ? `${drawAndScore.cardValues.join("/")} 各 ${drawAndScore.copiesPerValue} 张 · 先到 ${drawAndScore.victoryTarget} 分`
                      : pushYourLuck
                        ? `D${pushYourLuck.dieSides} · ${pushYourLuck.bustFace} 爆掉 · 收手存分 · 先到 ${pushYourLuck.victoryTarget} 分`
                      : turnTaking
                        ? `最多 ${turnTaking.maxTurns} 回合；不自动判定胜负`
                    : "尚未配置确定性运行时"}
                </small>
              </div>
            </div>
          </section>
          <section className="preview-actions" aria-label="可用行动预览">
            <div className="preview-section-heading">
              <span>Action cards</span>
              <strong>{build.ruleSystem.actions.length} actions</strong>
            </div>
            <div className="preview-action-grid">
              {build.ruleSystem.actions.length > 0 ? (
                build.ruleSystem.actions.map((action) => (
                  <article key={action.id}>
                    <span>{action.id}</span>
                    <h2>{action.label}</h2>
                    <p>{action.description}</p>
                    <strong>
                      {runtimeValues.has(action.id)
                        ? `${takeAway ? "−" : "+"}${runtimeValues.get(action.id)} ${takeAway ? "objects" : sharedGoal ? "progress" : "points"}`
                        : rollAndMove
                          ? `掷 D${rollAndMove.dieSides}`
                        : drawAndScore
                          ? "从牌库顶抽牌计分"
                        : pushYourLuck
                          ? action.label
                        : turnTaking
                          ? "轮流行动"
                        : "未映射到运行时"}
                    </strong>
                  </article>
                ))
              ) : (
                <p className="preview-empty">这个 Rule System 还没有可用行动。</p>
              )}
            </div>
          </section>
        </>
      )}
      <aside>
        <h2>Build truth</h2>
        <code>{build.id}</code>
        {build.warnings.length > 0 && (
          <>
            <h3>Warnings</h3>
            <ul>
              {build.warnings.map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          </>
        )}
        {build.unsupportedBehavior.length > 0 && (
          <>
            <h3>Unsupported behavior</h3>
            <ul>
              {build.unsupportedBehavior.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </>
        )}
        <p>
          上方是根据 immutable Rule System 生成的结构化视觉预览；它不是截图渲染，
          不代表缺失规则已经实现，也不等于真人试玩通过。
        </p>
      </aside>
    </main>
  );
}

function RoomView({ sessionId }: { sessionId: string }) {
  const [room, setRoom] = useState<SharedSession>();
  const [build, setBuild] = useState<PlayableBuild>();
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [feedbackRating, setFeedbackRating] = useState<0 | 1 | 2 | 3 | 4 | 5>(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [seat, setSeat] = useState<number | null>(null);
  const [locale, setLocale] = useState<RoomLocale>(readRoomLocale);
  const shareCreator = new URLSearchParams(window.location.search).get("creator") ?? undefined;
  const [clientId] = useState(() => {
    const key = "godesk-room-client-id";
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.localStorage.setItem(key, created);
    return created;
  });
  const copy = ROOM_COPY[locale];

  useEffect(() => {
    window.localStorage.setItem("godesk-room-locale", locale);
  }, [locale]);

  useEffect(() => {
    let stopped = false;
    let socket: WebSocket | undefined;
    let reconnectTimer: number | undefined;
    const connectionError = locale === "zh"
      ? "实时连接中断，正在重连。"
      : "Live connection interrupted. Reconnecting.";

    const connect = () => {
      socket = new WebSocket(sharedSessionSocketUrl(sessionId, shareCreator));
      socket.addEventListener("open", () => {
        setError((current) => current === connectionError ? "" : current);
        socket?.send('{"type":"session.sync"}');
      });
      socket.addEventListener("message", (event) => {
        try {
          const message = JSON.parse(String(event.data)) as {
            type?: unknown;
            session?: SharedSessionSnapshot;
          };
          if (
            message.type !== "session.snapshot" ||
            message.session?.id !== sessionId
          ) return;
          const nextRoom = publicSharedSession(
            message.session,
            window.location.origin,
            shareCreator,
          );
          setRoom(nextRoom);
          setSeat(
            nextRoom.seats.find((entry) => entry.clientId === clientId)?.seat ??
              null,
          );
        } catch {
          setError(locale === "zh" ? "实时状态格式无效。" : "Invalid live state.");
        }
      });
      socket.addEventListener("close", () => {
        if (stopped) return;
        setError(connectionError);
        reconnectTimer = window.setTimeout(connect, 1_000);
      });
    };

    connect();
    return () => {
      stopped = true;
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      socket?.close(1000, "room_view_closed");
    };
  }, [clientId, locale, sessionId, shareCreator]);

  useEffect(() => {
    if (!room?.buildId) return;
    getBuild(room.buildId, shareCreator)
      .then(setBuild)
      .catch((reason: Error) => setError(reason.message));
  }, [room?.buildId, shareCreator]);

  async function claimSeat(nextSeat: number) {
    if (!room) return;
    setBusy(true);
    setError("");
    try {
      setRoom(await claimSessionSeat(room.id, { seat: nextSeat, clientId }, shareCreator));
      setSeat(nextSeat);
      setFeedback(`${copy.yourSeat}: ${locale === "zh" ? "座位" : "Seat"} ${nextSeat}`);
    } catch (reason) {
      setError(localizedRoomError(reason, locale, "seat"));
    } finally {
      setBusy(false);
    }
  }

  async function copyInvitation() {
    try {
      await navigator.clipboard.writeText(room?.sessionUrl ?? "");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    } catch {
      setError(copy.copyFailed);
    }
  }

  async function act(
    actionId: string,
    actionIndex = -1,
    payload?: Record<string, unknown>,
  ) {
    if (!room || seat === null) {
      setError(copy.claimSeat);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const nextRoom = await submitSessionIntent(
        room.id,
        {
          intentId: crypto.randomUUID(),
          seat,
          clientId,
          actionId,
          payload,
        },
        shareCreator,
      );
      setRoom(nextRoom);
      if (actionIndex >= 0 && build) {
        const action = scoreRaceKernel(build.ruleSystem)?.actions[actionIndex] ??
          sharedGoalKernel(build.ruleSystem)?.actions[actionIndex] ??
          takeAwayKernel(build.ruleSystem)?.actions[actionIndex] ??
          rollAndMoveKernel(build.ruleSystem)?.actions[actionIndex] ??
          drawAndScoreKernel(build.ruleSystem)?.actions[actionIndex] ??
          pushYourLuckKernel(build.ruleSystem)?.actions[actionIndex] ??
          turnTakingKernel(build.ruleSystem)?.actions[actionIndex];
        const actionValue = action
          ? "points" in action
            ? action.points
            : "progress" in action
              ? action.progress
              : "take" in action
                ? action.take
                : null
          : null;
        const sharedGoal = sharedGoalKernel(build.ruleSystem);
        const takeAway = takeAwayKernel(build.ruleSystem);
        const rollAndMove = rollAndMoveKernel(build.ruleSystem);
        const drawAndScore = drawAndScoreKernel(build.ruleSystem);
        const pushYourLuck = pushYourLuckKernel(build.ruleSystem);
        const turnTaking = turnTakingKernel(build.ruleSystem);
        const scoreLabel = takeAway
          ? copy.take
          : rollAndMove
          ? copy.move
          : drawAndScore
          ? copy.draw
          : pushYourLuck
          ? copy.unbanked
          : turnTaking
          ? copy.turnAction
          : sharedGoal
            ? copy.progress
            : build.ruleSystem.playSurface.kind === "conversation"
              ? locale === "zh" ? "创意分" : "idea points"
              : copy.points;
        const roll = nextRoom.state.rollAndMove?.lastRoll;
        const draw = nextRoom.state.drawAndScore?.lastDraw;
        const pushState = nextRoom.state.pushYourLuck;
        const pushAction = pushYourLuck?.actions[actionIndex];
        setFeedback(
          `${copy.actionSubmitted}: ${roomActionTitle(locale, actionIndex)}${rollAndMove && roll !== null && roll !== undefined ? ` · 🎲 ${roll} · +${roll} ${copy.move}` : drawAndScore && draw !== null && draw !== undefined ? ` · 🎴 ${draw} · +${draw} ${copy.points}` : pushYourLuck && pushAction?.id === "roll" && pushState ? ` · 🎲 ${pushState.lastRoll}${pushState.lastRoll === pushYourLuck.bustFace ? ` · ${copy.bust}` : ` · ${copy.unbanked} ${pushState.turnScore}`}` : pushYourLuck && pushAction?.id === "bank" ? ` · +${nextRoom.acceptedActions.at(-1)?.points ?? 0} ${copy.points}` : actionValue !== null ? ` · ${takeAway ? "−" : "+"}${actionValue} ${scoreLabel}` : ""}`,
        );
      }
    } catch (reason) {
      setError(localizedRoomError(reason, locale, "action"));
    } finally {
      setBusy(false);
    }
  }

  async function submitFeedback() {
    if (!room || seat === null || feedbackRating === 0 || feedbackComment.trim().length < 2) {
      setError(copy.feedbackRequired);
      return;
    }
    setBusy(true);
    setError("");
    try {
      setRoom(await submitSessionFeedback(
        room.id,
        {
          seat,
          clientId,
          rating: feedbackRating,
          comment: feedbackComment.trim(),
        },
        shareCreator,
      ));
      setFeedback(copy.feedbackSubmitted);
      setFeedbackRating(0);
      setFeedbackComment("");
    } catch (reason) {
      setError(localizedRoomError(reason, locale, "feedback"));
    } finally {
      setBusy(false);
    }
  }

  if (error && !room) {
    return (
      <main className="studio-status" id="main">
        <h1>{locale === "zh" ? "这个 Shared Session 打不开。" : "This Shared Session cannot be opened."}</h1>
        <p role="alert">{error}</p>
      </main>
    );
  }
  if (!room || !build) {
    return (
      <main className="studio-status" id="main" aria-busy="true">
        <h1>{locale === "zh" ? "正在重连 Shared Session…" : "Reconnecting to the Shared Session…"}</h1>
      </main>
    );
  }

  const race = scoreRaceKernel(build.ruleSystem);
  const sharedGoal = sharedGoalKernel(build.ruleSystem);
  const takeAway = takeAwayKernel(build.ruleSystem);
  const rollAndMove = rollAndMoveKernel(build.ruleSystem);
  const drawAndScore = drawAndScoreKernel(build.ruleSystem);
  const pushYourLuck = pushYourLuckKernel(build.ruleSystem);
  const turnTaking = turnTakingKernel(build.ruleSystem);
  const voyage = room.state.voyage;
  const harbor = isHarborVoyage(build.ruleSystem) && voyage;
  const gameName = build.ruleSystem.name;
  const activeSeat = room.state.activeSeat;
  const isMyTurn = room.state.status === "active" && seat === activeSeat;
  const latestOwnAction = seat === null
    ? undefined
    : [...room.acceptedActions].reverse().find((action) => action.seat === seat);
  const runtimeActions: Array<{ id: string; label: string; value: number | null }> = race?.actions.map((action) => ({
    id: action.id,
    label: action.label,
    value: action.points,
  })) ?? sharedGoal?.actions.map((action) => ({
    id: action.id,
    label: action.label,
    value: action.progress,
  })) ?? takeAway?.actions.map((action) => ({
    id: action.id,
    label: action.label,
    value: action.take,
  })) ?? rollAndMove?.actions.map((action) => ({
    id: action.id,
    label: action.label,
    value: null,
  })) ?? drawAndScore?.actions.map((action) => ({
    id: action.id,
    label: action.label,
    value: null,
  })) ?? pushYourLuck?.actions.map((action) => ({
    id: action.id,
    label: action.label,
    value: null,
  })) ?? turnTaking?.actions.map((action) => ({
    id: action.id,
    label: action.label,
    value: null,
  })) ?? [];
  const runtimeTarget = race?.victoryTarget ?? sharedGoal?.goalTarget ?? takeAway?.initialPool ?? rollAndMove?.targetPosition ?? drawAndScore?.victoryTarget ?? pushYourLuck?.victoryTarget ?? turnTaking?.maxTurns ?? 12;
  const trackLength = Math.min(20, Math.max(8, runtimeTarget));
  const surface = roomSurfaceCopy(build.ruleSystem.playSurface.kind, locale);
  const isConversation = build.ruleSystem.playSurface.kind === "conversation";
  const scoreLabel = takeAway
    ? copy.take
    : rollAndMove
    ? copy.move
    : drawAndScore
    ? copy.draw
    : pushYourLuck
    ? copy.unbanked
    : turnTaking
    ? copy.turnAction
    : sharedGoal
      ? copy.progress
      : isConversation
        ? locale === "zh" ? "创意分" : "idea points"
        : copy.points;

  return (
    <main className={`room-view ${harbor ? "room-view-voyage" : ""} ${sharedGoal ? "room-view-shared-goal" : ""} ${takeAway ? "room-view-take-away" : ""} ${rollAndMove ? "room-view-roll-and-move" : ""} ${drawAndScore ? "room-view-draw-and-score" : ""} ${pushYourLuck ? "room-view-push-your-luck" : ""} ${turnTaking ? "room-view-turn-taking" : ""}`} data-locale={locale} id="main">
      <header className="room-shell-header">
        <div className="room-title-block">
          <span className="room-brand-mark" aria-hidden="true">GD</span>
          <div>
            <span className="room-kicker">{copy.room}</span>
            <h1>{gameName}</h1>
          </div>
        </div>
        <div className="room-header-actions">
          <div aria-label={copy.language} className="room-locale-switch" role="group">
            <button
              aria-pressed={locale === "zh"}
              className={locale === "zh" ? "is-selected" : ""}
              onClick={() => setLocale("zh")}
              type="button"
            >
              中文
            </button>
            <button
              aria-pressed={locale === "en"}
              className={locale === "en" ? "is-selected" : ""}
              onClick={() => setLocale("en")}
              type="button"
            >
              EN
            </button>
          </div>
          <a
            href={validationStudioHref(room.projectId, {
              buildId: room.buildId,
              evidenceType: room.feedback.length
                ? "participant-feedback"
                : "human-session",
              evidenceId: room.id,
              hypothesisId: room.experiment?.hypothesisId,
            })}
          >
            {copy.studio}
          </a>
          <a href={room.replayUrl}>{copy.replay}</a>
        </div>
      </header>

      <section aria-label={copy.invitation} className="room-invitation room-invitation-rich">
        <div className="invitation-heading">
          <span className="room-kicker">{copy.invitation}</span>
          <strong>{copy.invitationHint}</strong>
        </div>
        <div className="invitation-link-row">
          <label>
            <span>{copy.inviteLink}</span>
            <input aria-label={copy.inviteLink} readOnly value={room.sessionUrl} />
          </label>
          <button onClick={() => void copyInvitation()} type="button">
            {copied ? copy.copiedInvite : copy.copyInvite}
          </button>
        </div>
        <label className="seat-picker">
          <span>{copy.yourSeat}</span>
          <select
            disabled={busy}
            onChange={(event) => {
              const selected = Number(event.target.value);
              if (Number.isInteger(selected)) void claimSeat(selected);
            }}
            value={seat ?? ""}
          >
            <option value="">{copy.chooseSeat}</option>
            {room.state.scores.map((_score, availableSeat) => {
              const occupant = room.seats.find((entry) => entry.seat === availableSeat);
              const isCurrentClient = occupant?.clientId === clientId;
              return (
                <option
                  disabled={Boolean(occupant && !isCurrentClient)}
                  key={availableSeat}
                  value={availableSeat}
                >
                  {locale === "zh" ? "座位" : "Seat"} {availableSeat}{occupant && !isCurrentClient ? ` · ${copy.occupied}` : ""}
                </option>
              );
            })}
          </select>
        </label>
      </section>

      {room.experiment && (
        <section
          aria-labelledby="experiment-brief-title"
          className="room-experiment-brief"
        >
          <span className="room-kicker">{copy.experimentTitle}</span>
          <h2 id="experiment-brief-title">{room.experiment.question}</h2>
          <p>
            <strong>{copy.experimentSignal}</strong>
            {room.experiment.successSignal}
          </p>
        </section>
      )}

      {harbor ? (
        <HarborVoyageBoard
          busy={busy}
          onAct={act}
          voyage={voyage as HarborVoyageState}
        />
      ) : (
        <section className="room-main">
          <section aria-live="polite" className="room-command-bar">
            <div>
              <span className="room-command-label">{copy.turn} {room.state.turn}</span>
              <strong>
                {room.state.status === "complete"
                  ? turnTaking
                    ? `${copy.gameOver} · ${copy.turnLimitReached}`
                    : sharedGoal
                      ? `${copy.gameOver} · ${copy.goalReached}`
                      : rollAndMove && room.state.winnerSeat === null
                        ? `${copy.gameOver} · ${copy.turnLimitReached}`
                      : drawAndScore && room.state.winnerSeat === null
                        ? `${copy.gameOver} · ${copy.deckExhausted} · ${copy.tiedGame}`
                      : pushYourLuck && room.state.winnerSeat === null
                        ? `${copy.gameOver} · ${copy.turnLimitReached}`
                      : `${copy.gameOver} · ${copy.winner} ${locale === "zh" ? "座位" : "Seat"} ${room.state.winnerSeat}`
                  : isMyTurn
                    ? copy.yourTurn
                    : `${copy.waitingFor} ${activeSeat}`}
              </strong>
              <p>{room.state.status === "complete" ? copy.gameOver : isMyTurn ? copy.actionHint : copy.waitForOther}</p>
            </div>
            <div className={`turn-callout ${isMyTurn ? "is-your-turn" : ""}`}>
              <span aria-hidden="true" />
              <b>{room.state.status === "complete" ? copy.gameOver : isMyTurn ? copy.currentTurn : copy.waitForOther}</b>
            </div>
          </section>

          <section
            aria-label={surface.label}
            className={`room-game-table ${isConversation ? "is-conversation" : ""}`}
          >
            <header className="table-section-header">
              <div>
                <span className="room-kicker">{surface.label}</span>
                <h2>{surface.title}</h2>
              </div>
              <span className="visual-floor-badge">✦ {surface.visual}</span>
            </header>

            <div className="surface-action-grid">
              {runtimeActions.slice(0, 4).map((action, index) => {
                const detail = build.ruleSystem.actions.find((item) => item.id === action.id);
                return (
                  <article className={`surface-action-card surface-action-card-${index + 1}`} key={action.id}>
                    <span className="surface-action-symbol" aria-hidden="true">{CARD_SYMBOLS[index]}</span>
                    <span className="surface-action-index">{roomActionTitle(locale, index)}</span>
                    <strong>{action.label}</strong>
                    <b>{rollAndMove ? `${copy.roll} D${rollAndMove.dieSides}` : drawAndScore ? copy.draw : pushYourLuck ? action.label : action.value === null ? scoreLabel : `${takeAway ? "−" : "+"}${action.value} ${scoreLabel}`}</b>
                    <small>{displayActionDescription(detail?.description ?? action.label, locale)}</small>
                  </article>
                );
              })}
            </div>

            <section aria-label={copy.playerArea} className="player-mat-grid">
              {sharedGoal ? (
                <article className="player-mat shared-goal-mat">
                  <header>
                    <span className="player-token" aria-hidden="true">✦</span>
                    <div>
                      <strong>{copy.progress}</strong>
                      <small>{copy.goalReached}</small>
                    </div>
                    <b>
                      {room.state.sharedGoal?.progress ?? 0}
                      <small> / {sharedGoal.goalTarget}</small>
                    </b>
                  </header>
                  <div
                    aria-label={`${copy.progress}: ${room.state.sharedGoal?.progress ?? 0}`}
                    className="score-track"
                  >
                    {Array.from({ length: trackLength }, (_, index) => (
                      <span
                        className={index < (room.state.sharedGoal?.progress ?? 0) ? "filled" : ""}
                        key={index}
                      />
                    ))}
                  </div>
                </article>
              ) : takeAway ? (
                <article className="player-mat take-away-mat">
                  <header>
                    <span className="player-token" aria-hidden="true">●</span>
                    <div>
                      <strong>{copy.remaining}</strong>
                      <small>
                        {room.state.status === "complete"
                          ? `${copy.winner} ${locale === "zh" ? "座位" : "Seat"} ${room.state.winnerSeat}`
                          : `${copy.currentTurn}: ${locale === "zh" ? "座位" : "Seat"} ${activeSeat}`}
                      </small>
                    </div>
                    <b>
                      {room.state.takeAway?.remaining ?? takeAway.initialPool}
                      <small> / {takeAway.initialPool}</small>
                    </b>
                  </header>
                  <div aria-label={`${copy.remaining}: ${room.state.takeAway?.remaining ?? takeAway.initialPool}`} className="score-track">
                    {Array.from({ length: trackLength }, (_, index) => (
                      <span className={index < (room.state.takeAway?.remaining ?? takeAway.initialPool) ? "filled" : ""} key={index} />
                    ))}
                  </div>
                </article>
              ) : rollAndMove ? (
                room.state.rollAndMove?.positions.map((position, seatIndex) => {
                  const isYou = seat === seatIndex;
                  const isActive = room.state.status === "active" && activeSeat === seatIndex;
                  return (
                    <article className={`player-mat ${isActive ? "is-active" : ""} ${isYou ? "is-you" : ""}`} key={seatIndex}>
                      <header>
                        <span className="player-token" aria-hidden="true">{seatIndex + 1}</span>
                        <div>
                          <strong>{isYou ? copy.you : `${locale === "zh" ? "座位" : "Seat"} ${seatIndex}`}</strong>
                          <small>{isActive ? copy.currentTurn : copy.position}</small>
                        </div>
                        <b>{position}<small> / {rollAndMove.targetPosition}</small></b>
                      </header>
                      <div aria-label={`${copy.position}: ${position}`} className="score-track">
                        {Array.from({ length: trackLength }, (_, index) => (
                          <span className={index < position ? "filled" : ""} key={index} />
                        ))}
                      </div>
                    </article>
                  );
                }) ?? null
              ) : drawAndScore ? (
                <>
                  <article className="player-mat shared-goal-mat">
                    <header>
                      <span className="player-token" aria-hidden="true">🎴</span>
                      <div>
                        <strong>{copy.deckRemaining}</strong>
                        <small>{copy.lastDraw}: {room.state.drawAndScore?.lastDraw ?? "—"}</small>
                      </div>
                      <b>{room.state.drawAndScore?.remainingCards ?? 0}<small> / {room.state.drawAndScore?.totalCards ?? 0}</small></b>
                    </header>
                  </article>
                  {room.state.scores.map((score, seatIndex) => {
                    const isYou = seat === seatIndex;
                    const isActive = room.state.status === "active" && activeSeat === seatIndex;
                    return (
                      <article className={`player-mat ${isActive ? "is-active" : ""} ${isYou ? "is-you" : ""}`} key={seatIndex}>
                        <header>
                          <span className="player-token" aria-hidden="true">{seatIndex + 1}</span>
                          <div>
                            <strong>{isYou ? copy.you : `${locale === "zh" ? "座位" : "Seat"} ${seatIndex}`}</strong>
                            <small>{isActive ? copy.currentTurn : copy.points}</small>
                          </div>
                          <b>{score}<small> / {drawAndScore.victoryTarget}</small></b>
                        </header>
                        <div aria-label={`${copy.points}: ${score}`} className="score-track">
                          {Array.from({ length: trackLength }, (_, index) => (
                            <span className={index < score ? "filled" : ""} key={index} />
                          ))}
                        </div>
                      </article>
                    );
                  })}
                </>
              ) : pushYourLuck ? (
                <>
                  <article className="player-mat shared-goal-mat">
                    <header>
                      <span className="player-token" aria-hidden="true">🎲</span>
                      <div>
                        <strong>{copy.unbanked}</strong>
                        <small>{room.state.pushYourLuck?.lastRoll === pushYourLuck.bustFace ? copy.bust : `${copy.roll}: ${room.state.pushYourLuck?.lastRoll ?? "—"}`}</small>
                      </div>
                      <b>{room.state.pushYourLuck?.turnScore ?? 0}</b>
                    </header>
                  </article>
                  {room.state.scores.map((score, seatIndex) => {
                    const isYou = seat === seatIndex;
                    const isActive = room.state.status === "active" && activeSeat === seatIndex;
                    return (
                      <article className={`player-mat ${isActive ? "is-active" : ""} ${isYou ? "is-you" : ""}`} key={seatIndex}>
                        <header>
                          <span className="player-token" aria-hidden="true">{seatIndex + 1}</span>
                          <div>
                            <strong>{isYou ? copy.you : `${locale === "zh" ? "座位" : "Seat"} ${seatIndex}`}</strong>
                            <small>{isActive ? copy.currentTurn : copy.points}</small>
                          </div>
                          <b>{score}<small> / {pushYourLuck.victoryTarget}</small></b>
                        </header>
                        <div aria-label={`${copy.points}: ${score}`} className="score-track">
                          {Array.from({ length: trackLength }, (_, index) => (
                            <span className={index < score ? "filled" : ""} key={index} />
                          ))}
                        </div>
                      </article>
                    );
                  })}
                </>
              ) : turnTaking ? (
                <article className="player-mat turn-taking-mat">
                  <header>
                    <span className="player-token" aria-hidden="true">↻</span>
                    <div>
                      <strong>{copy.turn}</strong>
                      <small>
                        {room.state.status === "complete"
                          ? copy.turnLimitReached
                          : isMyTurn
                            ? copy.yourTurn
                            : `${copy.currentTurn}: ${locale === "zh" ? "座位" : "Seat"} ${activeSeat}`}
                      </small>
                    </div>
                    <b>
                      {room.state.turn}
                      <small> / {turnTaking.maxTurns}</small>
                    </b>
                  </header>
                  <div aria-label={`${copy.turn}: ${room.state.turn}`} className="score-track">
                    {Array.from({ length: trackLength }, (_, index) => (
                      <span className={index < room.state.turn ? "filled" : ""} key={index} />
                    ))}
                  </div>
                </article>
              ) : room.state.scores.map((score, seatIndex) => {
                const isYou = seat === seatIndex;
                const isActive = room.state.status === "active" && activeSeat === seatIndex;
                return (
                  <article className={`player-mat ${isActive ? "is-active" : ""} ${isYou ? "is-you" : ""}`} key={seatIndex}>
                    <header>
                      <span className="player-token" aria-hidden="true">{seatIndex + 1}</span>
                      <div>
                        <strong>{isYou ? copy.you : `${locale === "zh" ? "座位" : "Seat"} ${seatIndex}`}</strong>
                        <small>{isActive ? copy.currentTurn : copy.playerArea}</small>
                      </div>
                      <b>{score}<small> / {race?.victoryTarget ?? "—"}</small></b>
                    </header>
                    <div aria-label={`${scoreLabel}: ${score}`} className="score-track">
                      {Array.from({ length: trackLength }, (_, index) => (
                        <span className={index < score ? "filled" : ""} key={index} />
                      ))}
                    </div>
                  </article>
                );
              })}
            </section>

            <details className="source-zone-details">
              <summary>{copy.sourceText}</summary>
              <div>
                {build.ruleSystem.playSurface.regions.map((zone) => (
                  <span key={zone.id}>{zone.name}</span>
                ))}
              </div>
            </details>
          </section>

          <section aria-label={copy.actionPanel} className="room-action-panel">
            <header>
              <div>
                <span className="room-kicker">{copy.actionPanel}</span>
                <h2>{copy.actionTitle}</h2>
              </div>
              <p>{copy.actionHint}</p>
            </header>
            {seat === null && <div className="action-reminder">⌁ {copy.claimSeat}</div>}
            {seat !== null && !isMyTurn && room.state.status === "active" && (
              <div className="action-reminder is-muted">◷ {copy.waitForOther}</div>
            )}
            {feedback && <div aria-live="polite" className="action-feedback">✓ {feedback}</div>}
            {runtimeActions.length > 0 ? (
              <div className="room-action-cards">
                {runtimeActions.map((action, index) => {
                  const detail = build.ruleSystem.actions.find((item) => item.id === action.id);
                  const enabled = !busy && isMyTurn && (
                    (!takeAway || action.value === null || action.value <= (room.state.takeAway?.remaining ?? 0)) &&
                    (!pushYourLuck || action.id !== "bank" || (room.state.pushYourLuck?.turnScore ?? 0) > 0)
                  );
                  return (
                    <button
                      aria-label={`${roomActionTitle(locale, index)} ${rollAndMove ? `${copy.roll} D${rollAndMove.dieSides}` : drawAndScore ? copy.draw : pushYourLuck ? action.label : action.value === null ? scoreLabel : `${takeAway ? "−" : "+"}${action.value} ${scoreLabel}`}`}
                      className={enabled ? "is-available" : ""}
                      disabled={!enabled}
                      key={action.id}
                      onClick={() => void act(action.id, index)}
                      type="button"
                    >
                      <span className="action-card-index">{String(index + 1).padStart(2, "0")}</span>
                      <b>{roomActionTitle(locale, index)}</b>
                      <strong>
                        {rollAndMove ? `${copy.roll} D${rollAndMove.dieSides}` : drawAndScore ? copy.draw : pushYourLuck ? action.label : action.value === null ? scoreLabel : <>{`${takeAway ? "−" : "+"}${action.value}`} <small>{scoreLabel}</small></>}
                      </strong>
                      <span>{displayActionDescription(detail?.description ?? action.label, locale)}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="action-reminder is-muted">{copy.noActions}</div>
            )}
            {error && <p className="creator-error" role="alert">{error}</p>}
          </section>
        </section>
      )}

      <section aria-label={copy.feedbackTitle} className="room-feedback-panel">
        <header>
          <div>
            <span className="room-kicker">{copy.feedbackTitle}</span>
            <h2>{copy.feedbackTitle}</h2>
          </div>
          <p>{room.experiment ? copy.experimentFeedbackHint : copy.feedbackHint}</p>
        </header>
        {seat === null ? (
          <div className="action-reminder">⌁ {copy.claimSeat}</div>
        ) : !latestOwnAction ? (
          <div className="action-reminder">⌁ {copy.feedbackActionRequired}</div>
        ) : (
          <form
            className="room-feedback-form"
            onSubmit={(event) => {
              event.preventDefault();
              void submitFeedback();
            }}
          >
            <fieldset>
              <legend>{copy.feedbackRating}</legend>
              <div aria-label={copy.feedbackRating} className="feedback-rating" role="group">
                {([1, 2, 3, 4, 5] as const).map((rating) => (
                  <button
                    aria-pressed={feedbackRating === rating}
                    className={feedbackRating >= rating ? "is-selected" : ""}
                    disabled={busy}
                    key={rating}
                    onClick={() => setFeedbackRating(rating)}
                    type="button"
                  >
                    <span aria-hidden="true">★</span>
                    <span className="sr-only">{rating} / 5</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <label>
              <span>{room.experiment ? copy.experimentFeedbackComment : copy.feedbackComment}</span>
              <textarea
                maxLength={1000}
                onChange={(event) => setFeedbackComment(event.currentTarget.value)}
                placeholder={copy.feedbackPlaceholder}
                rows={3}
                value={feedbackComment}
              />
            </label>
            <button
              className="feedback-submit"
              disabled={busy || feedbackRating === 0 || feedbackComment.trim().length < 2}
              type="submit"
            >
              {copy.feedbackSubmit}
            </button>
            {room.feedback.filter((entry) => entry.seat === seat).map((entry) => (
              <p className="feedback-saved" key={entry.id}>
                {copy.feedbackSubmitted} · {locale === "zh" ? "行动" : "Action"} #{entry.moment.actionSequence} · {build.ruleSystem.actions
                  .find((action) => action.id === entry.moment.actionId)?.label ?? entry.moment.actionId} · {"★".repeat(entry.rating)} · {entry.comment}
              </p>
            ))}
          </form>
        )}
      </section>

      {error && harbor && <p className="creator-error" role="alert">{error}</p>}

      <aside className="action-log">
        <span>{copy.log}</span>
        <code>{room.id}</code>
        {room.acceptedActions.length ? (
          <ol>
            {room.acceptedActions.map((action) => (
              <li key={action.sequence}>
                #{action.sequence} · {locale === "zh" ? "座位" : "Seat"} {action.seat} · {(() => {
                  const actionIndex = runtimeActions.findIndex((candidate) => candidate.id === action.actionId);
                  return actionIndex >= 0 ? roomActionTitle(locale, actionIndex) : action.actionId;
                })()}
                {action.state.pushYourLuck ? action.actionId === "roll" ? ` · 🎲 ${action.points}${action.points === action.state.pushYourLuck.bustFace ? ` · ${copy.bust}` : ` · ${copy.unbanked} ${action.state.pushYourLuck.turnScore}`}` : ` · +${action.points} ${copy.points}` : action.points ? action.state.rollAndMove ? ` · 🎲 ${action.points} · +${action.points} ${copy.move}` : action.state.drawAndScore ? ` · 🎴 ${action.points} · +${action.points} ${copy.points}` : ` · ${action.state.takeAway ? "−" : "+"}${action.points} ${scoreLabel}` : ""}
              </li>
            ))}
          </ol>
        ) : (
          <p>{copy.noLog}</p>
        )}
        {build.ruleSystem.runtimeSupport.status === "executable" &&
          build.ruleSystem.runtimeSupport.unsupported.length > 0 && (
            <div className="room-unsupported">
              <strong>{copy.unsupported}</strong>
              <ul>
                {build.ruleSystem.runtimeSupport.unsupported.map((item) => (
                  <li key={item}>{displayUnsupported(item, locale)}</li>
                ))}
              </ul>
            </div>
          )}
      </aside>
    </main>
  );
}

function ReplayView({ replayId }: { replayId: string }) {
  const [replay, setReplay] = useState<GameReplay>();
  const [error, setError] = useState("");
  const shareCreator = new URLSearchParams(window.location.search).get("creator") ?? undefined;

  useEffect(() => {
    getReplay(replayId, shareCreator).then(setReplay).catch((reason: Error) => {
      setError(reason.message);
    });
  }, [replayId, shareCreator]);

  if (error) {
    return (
      <main className="studio-status" id="main">
        <h1>这个回放打不开。</h1>
        <p role="alert">{error}</p>
      </main>
    );
  }
  if (!replay) {
    return (
      <main className="studio-status" id="main" aria-busy="true">
        <h1>正在读取不可变 Action Log…</h1>
      </main>
    );
  }

  return (
    <main className="replay-view" id="main">
      <header>
        <span>Read-only Replay · cannot mutate a Shared Session</span>
        <a href={validationStudioHref(replay.projectId, { buildId: replay.buildId })}>
          返回 Web Studio
        </a>
      </header>
      <section>
        <span>{replay.evidenceType}</span>
        <h1>Seed {replay.seed}</h1>
        <p>
          {replay.acceptedActions.length} accepted actions · final turn{" "}
          {replay.finalState.turn}
        </p>
        {replay.finalState.voyage ? (
          <HarborVoyageBoard readOnly voyage={replay.finalState.voyage as HarborVoyageState} />
        ) : (
          <div className="replay-state-columns">
            <ReplayStateCard label="Initial state" state={replay.initialState} />
            <ReplayStateCard label="Final state" state={replay.finalState} />
          </div>
        )}
      </section>
      <aside className="action-log">
        <h2>Accepted actions</h2>
        <ol>
          {replay.acceptedActions.map((action) => (
            <li key={action.sequence}>
              #{action.sequence} · seat {action.seat} · {action.actionId}
              {action.state.pushYourLuck ? action.actionId === "roll" ? ` · 🎲 ${action.points} · unbanked ${action.state.pushYourLuck.turnScore}` : ` · bank +${action.points}` : action.points ? action.state.rollAndMove ? ` · 🎲 ${action.points} · +${action.points} move` : action.state.drawAndScore ? ` · 🎴 ${action.points} · +${action.points}` : ` · ${action.state.takeAway ? "−" : "+"}${action.points}` : ""}
            </li>
          ))}
        </ol>
        {replay.evidenceType === "automated-bot-simulation" && (
          <p>这是自动 bot simulation evidence，不是真人试玩记录。</p>
        )}
      </aside>
    </main>
  );
}

function ReplayStateCard({
  label,
  state,
}: {
  label: string;
  state: GameReplay["initialState"];
}) {
  return (
    <article className="replay-state-card">
      <h2>{label}</h2>
      <dl>
        <div><dt>Turn</dt><dd>{state.turn}</dd></div>
        <div><dt>Active seat</dt><dd>{state.activeSeat}</dd></div>
        <div><dt>Status</dt><dd>{state.status}</dd></div>
      </dl>
      <div className="score-grid">
        {state.sharedGoal ? (
          <article className="shared-goal-replay-card">
            <span>Shared goal</span>
            <strong>{state.sharedGoal.progress} / {state.sharedGoal.target}</strong>
          </article>
        ) : state.takeAway ? (
          <article className="shared-goal-replay-card">
            <span>Shared pool remaining</span>
            <strong>{state.takeAway.remaining} / {state.takeAway.initialPool}</strong>
          </article>
        ) : state.rollAndMove ? (
          <>
            {state.rollAndMove.lastRoll !== null && (
              <article>
                <span>Last roll</span>
                <strong>🎲 {state.rollAndMove.lastRoll}</strong>
              </article>
            )}
            {state.rollAndMove.positions.map((position, seat) => (
              <article key={seat}>
                <span>Seat {seat} position</span>
                <strong>{position} / {state.rollAndMove?.targetPosition}</strong>
              </article>
            ))}
          </>
        ) : state.drawAndScore ? (
          <>
            <article className="shared-goal-replay-card">
              <span>Deck remaining</span>
              <strong>{state.drawAndScore.remainingCards} / {state.drawAndScore.totalCards}</strong>
            </article>
            {state.drawAndScore.lastDraw !== null && (
              <article>
                <span>Last draw</span>
                <strong>🎴 {state.drawAndScore.lastDraw}</strong>
              </article>
            )}
            {state.scores.map((score, seat) => (
              <article key={seat}>
                <span>Seat {seat}</span>
                <strong>{score}</strong>
              </article>
            ))}
          </>
        ) : state.pushYourLuck ? (
          <>
            <article className="shared-goal-replay-card">
              <span>Unbanked turn score</span>
              <strong>{state.pushYourLuck.turnScore}</strong>
            </article>
            {state.pushYourLuck.lastRoll !== null && (
              <article>
                <span>Last roll</span>
                <strong>🎲 {state.pushYourLuck.lastRoll}</strong>
              </article>
            )}
            {state.scores.map((score, seat) => (
              <article key={seat}>
                <span>Seat {seat}</span>
                <strong>{score}</strong>
              </article>
            ))}
          </>
        ) : state.turnTaking ? (
          <article className="shared-goal-replay-card">
            <span>Turn limit</span>
            <strong>{state.turn} / {state.turnTaking.maxTurns}</strong>
          </article>
        ) : state.scores.map((score, seat) => (
            <article key={seat}>
              <span>Seat {seat}</span>
              <strong>{score}</strong>
            </article>
          ))}
      </div>
    </article>
  );
}

export function CreatorWorkspace() {
  const studioMatch = window.location.pathname.match(/^\/studio\/([^/]+)$/);
  if (studioMatch) {
    return <ProjectStudio projectId={decodeURIComponent(studioMatch[1])} />;
  }
  const playMatch = window.location.pathname.match(/^\/play\/([^/]+)$/);
  if (playMatch) {
    return <PlayablePreview buildId={decodeURIComponent(playMatch[1])} />;
  }
  const roomMatch = window.location.pathname.match(/^\/room\/([^/]+)$/);
  if (roomMatch) {
    return <RoomView sessionId={decodeURIComponent(roomMatch[1])} />;
  }
  const replayMatch = window.location.pathname.match(/^\/replay\/([^/]+)$/);
  if (replayMatch) {
    return <ReplayView replayId={decodeURIComponent(replayMatch[1])} />;
  }
  return <CreatorHome />;
}
