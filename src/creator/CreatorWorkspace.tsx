import { useEffect, useRef, useState } from "react";
import {
  applyProjectChanges,
  createRoom,
  createProject,
  duplicateDefinition,
  getBuild,
  getBuilds,
  getChangesets,
  getDefinition,
  getDefinitions,
  getJobs,
  getPlaytests,
  getProject,
  getReplay,
  getRoom,
  getRooms,
  getSources,
  listProjects,
  ProjectApiError,
  retryJob,
  submitJob,
  submitRoomIntent,
  waitForJob,
} from "./project-api";
import type {
  Changeset,
  GameDefinition,
  CreatorJob,
  GameProject,
  GameReplay,
  GameRoom,
  PlaytestRun,
  PlayableBuild,
  SourceLibraryEntry,
} from "./project-contract";
import { DEFAULT_EXAMPLES, type DefaultExampleId } from "./default-examples";
import {
  extractRulebookText,
  validateRulebookFile,
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

const GENERATION_STAGES = [
  {
    id: "ingest",
    name: "导入来源",
    detail: "读取规则文档或粘贴文本，保留文件名与字数",
  },
  {
    id: "generate",
    name: "解析规则",
    detail: "生成可编辑 Game Definition，并挂上可运行内核",
  },
  {
    id: "compile",
    name: "搭建可玩版本",
    detail: "编译 immutable Playable Build",
  },
  {
    id: "ready",
    name: "就绪",
    detail: "打开 Editor 校对，或直接进入权威房间试玩",
  },
] as const;

type GenerationStageId = (typeof GENERATION_STAGES)[number]["id"];

type ReadySummary = {
  projectId: string;
  editorUrl: string;
  buildId: string;
  name: string;
  sourceLabel: string;
  textCharacters: number;
  rules: number;
  components: number;
  actions: number;
  zones: number;
  phases: number;
  kernelType: string;
  unsupported: string[];
};

export function draftExpectedVersion(
  baseVersion: number | null,
  visibleVersion: number,
) {
  return baseVersion ?? visibleVersion;
}

export function shouldStartDefinitionDraft(
  currentSourceDraft: string,
  nextSourceDraft: string,
) {
  return Boolean(nextSourceDraft.trim() && !currentSourceDraft.trim());
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
  const [name, setName] = useState("我的桌游");
  const [description, setDescription] = useState("");
  const [rulesText, setRulesText] = useState("");
  const [rulebook, setRulebook] = useState<File>();
  const [projects, setProjects] = useState<GameProject[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [stageLabel, setStageLabel] = useState("");
  const [activeStage, setActiveStage] = useState<GenerationStageId | null>(null);
  const [completedStages, setCompletedStages] = useState(0);
  const [ready, setReady] = useState<ReadySummary>();
  const [exampleBusy, setExampleBusy] = useState<DefaultExampleId | null>(null);

  useEffect(() => {
    listProjects().then(setProjects).catch((reason: Error) => {
      setError(reason.message);
    });
  }, []);

  async function runPipeline(sourceContent: string, sourceName: string) {
    setActiveStage("ingest");
    setCompletedStages(0);
    const textCharacters = sourceContent.length;
    setCompletedStages(1);

    setActiveStage("generate");
    setStageLabel("创建 Game Project");
    const created = await createProject(name.trim());
    setStageLabel("解析规则并生成 Game Definition");
    const queuedGeneration = await submitJob(created.project.id, {
      kind: "generate-definition",
      expectedVersion: created.project.version,
      brief: description.trim(),
      description: description.trim(),
      name: name.trim(),
      sourceName,
      sourceKind: "rulebook",
      sourceContent,
      idempotencyKey: crypto.randomUUID(),
    });
    const generated = await waitForJob(queuedGeneration.id);
    if (generated.status === "failed") {
      throw new Error(generated.error ?? "规则生成失败。");
    }
    setCompletedStages(2);

    setActiveStage("compile");
    setStageLabel("编译 Playable Build");
    const currentProject = await getProject(created.project.id);
    const queuedBuild = await submitJob(created.project.id, {
      kind: "compile-build",
      expectedVersion: currentProject.version,
      idempotencyKey: crypto.randomUUID(),
    });
    const built = await waitForJob(queuedBuild.id);
    if (built.status === "failed") throw new Error(built.error ?? "编译失败。");
    setCompletedStages(3);

    setActiveStage("ready");
    const definition = await getDefinition(created.project.id);
    const builds = await getBuilds(created.project.id);
    const build = builds[0];
    if (!build) throw new Error("编译成功但未找到 Build。");
    const kernelType =
      definition.runtimeSupport.status === "executable"
        ? definition.runtimeSupport.kernel.type
        : "draft";
    const unsupported =
      definition.runtimeSupport.status === "executable" ||
      definition.runtimeSupport.status === "draft"
        ? definition.runtimeSupport.unsupported
        : [];
    setReady({
      projectId: created.project.id,
      editorUrl: created.editorUrl,
      buildId: build.id,
      name: definition.name,
      sourceLabel: sourceName,
      textCharacters,
      rules: definition.rules.length,
      components: definition.components.length,
      actions: definition.actions.length,
      zones: definition.board.zones.length,
      phases: definition.phases.length,
      kernelType,
      unsupported,
    });
    setCompletedStages(4);
    setProjects(await listProjects());
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setReady(undefined);
    try {
      const sourceContent = rulebook
        ? await extractRulebookText(rulebook)
        : rulesText.trim();
      if (!sourceContent) throw new Error("请上传规则文档，或粘贴规则文本。");
      await runPipeline(
        sourceContent,
        rulebook?.name || `${name.trim()} rules.txt`,
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
    setReady(undefined);
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
      setCompletedStages(3);
      setActiveStage("ready");
      const definition = await getDefinition(created.project.id);
      const builds = await getBuilds(created.project.id);
      const build = builds[0];
      if (!build) throw new Error("编译成功但未找到 Build。");
      setReady({
        projectId: created.project.id,
        editorUrl: created.editorUrl,
        buildId: build.id,
        name: definition.name,
        sourceLabel: `${example.title} 默认案例`,
        textCharacters: 0,
        rules: definition.rules.length,
        components: definition.components.length,
        actions: definition.actions.length,
        zones: definition.board.zones.length,
        phases: definition.phases.length,
        kernelType:
          definition.runtimeSupport.status === "executable"
            ? definition.runtimeSupport.kernel.type
            : "draft",
        unsupported:
          definition.runtimeSupport.status === "executable" ||
          definition.runtimeSupport.status === "draft"
            ? definition.runtimeSupport.unsupported
            : [],
      });
      setCompletedStages(4);
      setProjects(await listProjects());
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

  async function openReadyRoom() {
    if (!ready) return;
    setBusy(true);
    setError("");
    try {
      const room = await createRoom(ready.buildId, {
        seed: 42,
        idempotencyKey: crypto.randomUUID(),
      });
      window.location.assign(room.roomUrl);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "创建房间失败。");
      setBusy(false);
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
    if (name === "我的桌游") {
      setName(file.name.replace(/\.(pdf|txt|md|markdown)$/i, ""));
    }
  }

  const showPipeline = busy || ready || completedStages > 0;

  return (
    <main className="studio-home" id="main">
      <aside className="studio-sidebar">
        <Brand />
        <a className="studio-new" href="/">＋ 新游戏</a>
        <nav aria-label="最近项目">
          <span>项目</span>
          {projects.slice(0, 8).map((project) => (
            <a href={`/editor/${project.id}`} key={project.id}>
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
          <span>上传成熟规则，描述你想保留的体验。GoDesk 会生成可编辑、可编译、可试玩的版本。</span>
        </div>

        <section className="default-examples studio-examples" aria-label="从案例开始">
          <div className="section-heading">
            <div>
              <span>Default examples</span>
              <h2>从案例开始</h2>
            </div>
            <p>公开安全的机制切片，一点即可编译并开玩。</p>
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
                  {exampleBusy === example.id ? "正在复制…" : "复制为我的项目并打开"}
                </button>
              </article>
            ))}
          </div>
        </section>

        {!ready && (
          <form className="studio-composer" onSubmit={submit}>
            <div className="studio-fields">
              <label>
                <span>项目名称</span>
                <input maxLength={80} onChange={(event) => setName(event.currentTarget.value)} value={name} />
              </label>
              <label>
                <span>你希望玩家获得什么体验？ <small>可选</small></span>
                <textarea
                  maxLength={2_000}
                  onChange={(event) => setDescription(event.currentTarget.value)}
                  placeholder="例如：保留竞价、押船和海盗截船的张力，先生成 3 人、45 分钟的可玩版本。"
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
                <strong>{rulebook ? rulebook.name : "拖入 PDF 或文本规则"}</strong>
                <small>{rulebook ? `${(rulebook.size / 1024).toFixed(1)} KB · 点击替换` : "或点击选择文件 · PDF / TXT / MD · 最大 25 MB"}</small>
              </span>
              {rulebook && <b aria-label="文件已就绪">Ready</b>}
            </label>

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
              <span>来源会进入 Source Library，并保留上传文件名。</span>
              <button disabled={busy || !name.trim() || (!rulebook && !rulesText.trim())} type="submit">
                {busy ? <><i className="studio-spinner" /> {stageLabel || "处理中…"}</> : <>生成可玩版本 <b aria-hidden="true">→</b></>}
              </button>
            </footer>
          </form>
        )}

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

        {ready && (
          <section className="studio-ready" aria-label="生成结果">
            <span className="ready-check" aria-hidden="true">✓</span>
            <span className="player-kicker">可玩版本已就绪</span>
            <h2>{ready.name}</h2>
            <p>
              来源 {ready.sourceLabel}
              {ready.textCharacters > 0 ? ` · ${ready.textCharacters.toLocaleString()} 字符` : ""}
              {" · "}内核 {ready.kernelType}
            </p>
            <dl className="ready-stats">
              <div><dt>规则</dt><dd>{ready.rules}</dd></div>
              <div><dt>组件</dt><dd>{ready.components}</dd></div>
              <div><dt>行动</dt><dd>{ready.actions}</dd></div>
              <div><dt>区域</dt><dd>{ready.zones}</dd></div>
              <div><dt>阶段</dt><dd>{ready.phases}</dd></div>
            </dl>
            {ready.unsupported.length > 0 && (
              <aside className="ready-unsupported">
                <strong>尚未覆盖</strong>
                <ul>
                  {ready.unsupported.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </aside>
            )}
            <div className="ready-actions">
              <button className="player-primary" disabled={busy} onClick={openReadyRoom} type="button">
                创建权威房间并开玩
              </button>
              <a href={`/play/${ready.buildId}`}>查看 Build 预览</a>
              <a href={ready.editorUrl}>打开编辑器</a>
            </div>
          </section>
        )}

        {error && <p className="studio-error" role="alert">{error}</p>}

        {!showPipeline && (
          <div className="studio-capabilities" aria-label="生成步骤">
            <span><b>01</b> 导入来源</span>
            <span><b>02</b> 解析规则</span>
            <span><b>03</b> 编译 Build</span>
            <span><b>04</b> 打开试玩</span>
          </div>
        )}
      </section>
    </main>
  );
}

function ProjectEditor({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<GameProject>();
  const [definition, setDefinition] = useState<GameDefinition>();
  const [definitions, setDefinitions] = useState<GameDefinition[]>([]);
  const [changesets, setChangesets] = useState<Changeset[]>([]);
  const [sources, setSources] = useState<SourceLibraryEntry[]>([]);
  const [builds, setBuilds] = useState<PlayableBuild[]>([]);
  const [playtests, setPlaytests] = useState<PlaytestRun[]>([]);
  const [rooms, setRooms] = useState<GameRoom[]>([]);
  const [jobs, setJobs] = useState<CreatorJob[]>([]);
  const [sourceDraft, setSourceDraft] = useState("");
  const [definitionDirty, setDefinitionDirty] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const definitionDirtyRef = useRef(false);
  const draftBaseVersionRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  const refreshInFlightRef = useRef(false);

  async function loadProject() {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    try {
    const [
      nextProject,
      nextDefinition,
      nextDefinitions,
      nextSources,
      nextChangesets,
      nextBuilds,
      nextPlaytests,
      nextRooms,
      nextJobs,
    ] = await Promise.all([
      getProject(projectId),
      getDefinition(projectId),
      getDefinitions(projectId),
      getSources(projectId),
      getChangesets(projectId),
      getBuilds(projectId),
      getPlaytests(projectId),
      getRooms(projectId),
      getJobs(projectId),
    ]);
    setProject(nextProject);
    if (!definitionDirtyRef.current) setDefinition(nextDefinition);
    setDefinitions(nextDefinitions);
    setSources(nextSources);
    setChangesets(nextChangesets);
    setBuilds(nextBuilds);
    setPlaytests(nextPlaytests);
    setRooms(nextRooms);
    setJobs(nextJobs);
    } finally {
      refreshInFlightRef.current = false;
    }
  }

  function beginDefinitionDraft() {
    if (!definitionDirtyRef.current) {
      draftBaseVersionRef.current = project?.version ?? null;
      definitionDirtyRef.current = true;
      setDefinitionDirty(true);
    }
  }

  async function buildPlayable() {
    if (!project) return;
    setBusy(true);
    setFormError("");
    setNotice("");
    try {
      const submitted = await submitJob(project.id, {
        kind: "compile-build",
        expectedVersion: project.version,
        idempotencyKey: crypto.randomUUID(),
      });
      setJobs((current) => [submitted, ...current]);
      const job = await waitForJob(submitted.id);
      if (job.status === "failed") throw new Error(job.error ?? "编译失败。");
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

  async function configureRuntime() {
    if (!project) return;
    setBusy(true);
    setFormError("");
    setNotice("");
    try {
      const result = await applyProjectChanges(project.id, {
        expectedVersion: project.version,
        idempotencyKey: crypto.randomUUID(),
        operations: [
          {
            op: "configure_score_race",
            config: {
              victoryTarget: 8,
              maxTurns: Math.max(12, (definition?.playerCount ?? 2) * 6),
              actions: [
                { id: "steady", label: "稳步推进", points: 1 },
                { id: "bold", label: "冒险推进", points: 2 },
              ],
            },
          },
        ],
      });
      setProject(result.project);
      if (!definitionDirty) setDefinition(result.definition);
      setDefinitions((current) =>
        current.map((candidate) =>
          candidate.id === result.definition.id
            ? result.definition
            : candidate
        )
      );
      setChangesets((current) => [...current, result.changeset]);
      setNotice(
        `已启用 score-race-v1 确定性原型内核 · v${result.project.version}`,
      );
    } catch (reason) {
      if (reason instanceof ProjectApiError && reason.status === 409) {
        await loadProject();
        setFormError("版本冲突：项目已刷新，请重新启用运行时。");
      } else {
        setFormError(
          reason instanceof Error ? reason.message : "运行时配置失败。",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function duplicateActiveDefinition() {
    if (!project || !definition || definitionDirty || sourceDraft.trim()) return;
    setBusy(true);
    setFormError("");
    try {
      const result = await duplicateDefinition(project.id, definition.id, {
        expectedVersion: project.version,
        idempotencyKey: crypto.randomUUID(),
        name: `${definition.name} 变体`,
      });
      setProject(result.project);
      setDefinition(result.definition);
      setDefinitions(result.definitions);
      setChangesets((current) => [...current, result.changeset]);
      setNotice(`已创建并切换到 ${result.definition.name}。`);
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "复制版本失败。");
    } finally {
      setBusy(false);
    }
  }

  async function activateDefinition(definitionId: string) {
    if (!project || definitionDirty || sourceDraft.trim()) return;
    setBusy(true);
    setFormError("");
    try {
      const result = await applyProjectChanges(project.id, {
        expectedVersion: project.version,
        idempotencyKey: crypto.randomUUID(),
        operations: [{ op: "activate_definition", definitionId }],
      });
      setProject(result.project);
      setDefinition(result.definition);
      setDefinitions((current) =>
        current.map((candidate) =>
          candidate.id === result.definition.id
            ? result.definition
            : candidate
        )
      );
      setChangesets((current) => [...current, result.changeset]);
      setNotice(`已切换到 ${result.definition.name}。`);
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "切换版本失败。");
    } finally {
      setBusy(false);
    }
  }

  async function startBotPlaytest(build: PlayableBuild) {
    setBusy(true);
    setFormError("");
    try {
      if (!project) return;
      const submitted = await submitJob(project.id, {
        kind: "bot-playtest",
        buildId: build.id,
        seed: 42,
        idempotencyKey: crypto.randomUUID(),
      });
      setJobs((current) => [submitted, ...current]);
      const job = await waitForJob(submitted.id);
      if (job.status === "failed") throw new Error(job.error ?? "自动试玩失败。");
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
      setJobs((current) =>
        current.map((candidate) => candidate.id === queued.id ? queued : candidate)
      );
      const finished = await waitForJob(queued.id);
      setJobs((current) =>
        current.map((candidate) =>
          candidate.id === finished.id ? finished : candidate
        )
      );
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
      setJobs((current) => [submitted, ...current]);
      const job = await waitForJob(submitted.id);
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

  async function startRoom(build: PlayableBuild) {
    setBusy(true);
    setFormError("");
    try {
      const room = await createRoom(build.id, {
        seed: 42,
        idempotencyKey: crypto.randomUUID(),
      });
      setRooms((current) => [room, ...current]);
      window.location.assign(room.roomUrl);
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "创建房间失败。");
      setBusy(false);
    }
  }

  useEffect(() => {
    loadProject().catch((reason: Error) => setLoadError(reason.message));
    const interval = window.setInterval(() => {
      if (!busyRef.current) {
        loadProject().catch(() => {
          // A transient background refresh must not replace visible project state.
        });
      }
    }, 2_000);
    return () => window.clearInterval(interval);
  }, [projectId]);

  useEffect(() => {
    definitionDirtyRef.current = definitionDirty;
  }, [definitionDirty]);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  async function saveDefinition(event: React.FormEvent) {
    event.preventDefault();
    if (!project || !definition) return;
    setBusy(true);
    setFormError("");
    setNotice("");
    try {
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
                  name: `${definition.name} brief`,
                  content: sourceDraft,
                  provenance: {
                    origin: "creator-authored" as const,
                    locator: "GoDesk Creator Editor",
                  },
                },
              }]
            : []),
          {
            op: "update_definition",
            fields: {
              name: definition.name,
              pitch: definition.pitch,
              playerCount: definition.playerCount,
              durationMinutes: definition.durationMinutes,
            },
          },
        ],
      });
      setProject(result.project);
      setDefinition(result.definition);
      draftBaseVersionRef.current = null;
      definitionDirtyRef.current = false;
      setDefinitionDirty(false);
      setSources(result.sources);
      setDefinitions((current) =>
        current.map((candidate) =>
          candidate.id === result.definition.id
            ? result.definition
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
    return (
      <main className="editor-status" id="main">
        <span aria-hidden="true">!</span>
        <h1>这个项目打不开。</h1>
        <p role="alert">{loadError}</p>
        <a href="/">返回项目列表</a>
      </main>
    );
  }

  if (!project || !definition) {
    return (
      <main className="editor-status" id="main" aria-busy="true">
        <span className="loading-mark" aria-hidden="true">GD</span>
        <h1>正在打开 Game Project…</h1>
      </main>
    );
  }

  return (
    <main className="creator-editor" id="main">
      <aside className="editor-rail" aria-label="项目导航">
        <Brand />
        <nav>
          <span>工作区</span>
          <a aria-current="page" href="#overview">游戏概览</a>
          <a href="#builds">构建与试玩</a>
          <a href="#definitions">版本与来源</a>
          <a href="#activity">项目记录</a>
        </nav>
        <a className="back-projects" href="/">← 返回所有项目</a>
      </aside>

      <section className="editor-canvas">
        <header className="editor-header">
          <div>
            <span>Game Project</span>
            <h1>{project.name}</h1>
          </div>
          <div className="project-version">
            <span><i aria-hidden="true" /> 已同步</span>
            <strong>v{project.version}</strong>
          </div>
        </header>

        <div className="editor-grid">
          <div className="editor-primary">
          <section className="definition-panel" id="overview">
            <header className="editor-section-heading">
              <div>
                <span className="panel-label">当前游戏版本 · d{definition.version}</span>
                <h2>游戏概览</h2>
              </div>
              <code title={project.activeDefinitionId}>
                {project.activeDefinitionId}
              </code>
            </header>
            <form className="definition-form" onSubmit={saveDefinition}>
              <label className="definition-field" htmlFor="definition-name">
                <span>游戏名称</span>
                <input
                  id="definition-name"
                  maxLength={120}
                  onChange={(event) =>
                    {
                      beginDefinitionDraft();
                      setDefinition({
                        ...definition,
                        name: event.currentTarget.value,
                      });
                    }
                  }
                  value={definition.name}
                />
              </label>

              <label className="definition-field" htmlFor="definition-pitch">
                <span>一句话玩法</span>
                <textarea
                  id="definition-pitch"
                  maxLength={2000}
                  onChange={(event) =>
                    {
                      beginDefinitionDraft();
                      setDefinition({
                        ...definition,
                        pitch: event.currentTarget.value,
                      });
                    }
                  }
                  placeholder="例如：玩家通过竞价与押船，在有限回合内赚取最多收益。"
                  rows={4}
                  value={definition.pitch}
                />
              </label>

              <div className="definition-numbers">
                <label htmlFor="player-count">
                  <span>玩家数</span>
                  <input
                    id="player-count"
                    max={20}
                    min={1}
                    onChange={(event) =>
                      {
                        beginDefinitionDraft();
                        setDefinition({
                          ...definition,
                          playerCount: event.currentTarget.valueAsNumber,
                        });
                      }
                    }
                    type="number"
                    value={definition.playerCount}
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
                        beginDefinitionDraft();
                        setDefinition({
                          ...definition,
                          durationMinutes: event.currentTarget.valueAsNumber,
                        });
                      }
                    }
                    type="number"
                    value={definition.durationMinutes}
                  />
                </label>
              </div>

              <details className="editor-optional">
                <summary>添加本次修改依据 <small>可选</small></summary>
                <label className="definition-field" htmlFor="source-brief">
                  <span>来源说明</span>
                  <textarea
                    id="source-brief"
                    onChange={(event) => {
                      if (shouldStartDefinitionDraft(sourceDraft, event.currentTarget.value)) {
                        beginDefinitionDraft();
                      }
                      setSourceDraft(event.currentTarget.value);
                    }}
                    placeholder="粘贴规则摘录或修改说明，保存后会进入来源库。"
                    rows={4}
                    value={sourceDraft}
                  />
                </label>
              </details>

              <div className="definition-actions">
                <button
                  disabled={
                    busy ||
                    !definition.name.trim() ||
                    (!definitionDirty && !sourceDraft.trim())
                  }
                  type="submit"
                >
                  {busy ? "正在保存…" : definitionDirty || sourceDraft.trim()
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
            <header className="editor-section-heading">
              <div>
                <span className="panel-label">构建与试玩</span>
                <h2>制作可玩版本</h2>
              </div>
              <button
                disabled={busy || definitionDirty || Boolean(sourceDraft.trim())}
                onClick={buildPlayable}
                type="button"
              >
                {busy ? "正在处理…" : "编译新版本"}
              </button>
            </header>
            {(definitionDirty || sourceDraft.trim()) && (
              <p className="workflow-hint">请先保存上方更改，再编译新的可玩版本。</p>
            )}
            <div className="workflow-steps">
              <article>
                <span>1</span>
                <div>
                  <small>运行规则</small>
                  <strong>
                    {definition.runtimeSupport.status === "executable"
                      ? "已配置"
                      : "需要配置"}
                  </strong>
                  <p>
                    {definition.runtimeSupport.status === "executable"
                      ? definition.runtimeSupport.kernel.type
                      : "添加一个可运行的确定性原型。"}
                  </p>
                </div>
                {definition.runtimeSupport.status === "draft" && (
                  <button
                    disabled={busy || definitionDirty || Boolean(sourceDraft.trim())}
                    onClick={configureRuntime}
                    type="button"
                  >
                    配置运行规则
                  </button>
                )}
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
                  <p>{rooms.length ? `${rooms.length} 个权威房间` : "构建后可创建房间。"}</p>
                </div>
              </article>
            </div>

            {builds.length > 0 ? (
              <details className="build-history">
                <summary>查看可玩版本与操作 <span>{builds.length}</span></summary>
                <ul>
                  {builds.map((build) => (
                    <li key={build.id}>
                      <a href={build.playableUrl}>
                        <span>{build.definition.name}</span>
                        <small>Definition v{build.definitionVersion}</small>
                      </a>
                      {build.warnings.length > 0 && (
                        <small>{build.warnings.length} warnings</small>
                      )}
                      <div className="build-actions">
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
                      {build.definition.runtimeSupport.status ===
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
                            创建房间
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            ) : (
              <p className="workflow-empty">编译后，可在这里预览、导出或开始试玩。</p>
            )}
          </section>
          </div>

          <aside className="project-facts" aria-label="项目详情">
            <section className="project-snapshot">
              <span className="panel-label">项目摘要</span>
              <dl>
                <div><dt>规则</dt><dd>{definition.rules.length}</dd></div>
                <div><dt>组件</dt><dd>{definition.components.length}</dd></div>
                <div><dt>行动</dt><dd>{definition.actions.length}</dd></div>
                <div><dt>阶段</dt><dd>{definition.phases.length}</dd></div>
              </dl>
              <p>{definition.pitch || "还没有填写一句话玩法。"}</p>
            </section>

            <details className="project-disclosure" id="definitions">
              <summary>
                <span>版本与来源</span>
                <small>{definitions.length} 个版本 · {sources.length} 个来源</small>
              </summary>
              <section className="evidence-summary">
                <header>
                  <strong>游戏版本</strong>
                  <button
                    disabled={busy || definitionDirty || Boolean(sourceDraft.trim())}
                    onClick={duplicateActiveDefinition}
                    type="button"
                  >
                    复制当前版本
                  </button>
                </header>
                <ul>
                  {definitions.map((candidate) => (
                    <li key={candidate.id}>
                      <strong>{candidate.name} · d{candidate.version}</strong>
                      {candidate.id === project.activeDefinitionId ? (
                        <small>当前版本</small>
                      ) : (
                        <button
                          disabled={busy || definitionDirty || Boolean(sourceDraft.trim())}
                          onClick={() => activateDefinition(candidate.id)}
                          type="button"
                        >
                          切换
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                {(definitionDirty || sourceDraft.trim()) && (
                  <small>保存或清空草稿后，才可切换版本。</small>
                )}
              </section>
              <section className="source-summary">
                <strong>来源库</strong>
                {sources.length > 0 ? (
                  <ul>
                    {sources.map((source) => (
                      <li key={source.id}>
                        <span>{source.name}</span>
                        <small>{source.provenance.origin}</small>
                      </li>
                    ))}
                  </ul>
                ) : <p>暂无来源。</p>}
              </section>
            </details>

            <details className="project-disclosure">
              <summary>
                <span>游戏结构</span>
                <small>{definition.board.zones.length} 个桌面区域</small>
              </summary>
              <section className="structure-summary">
                <dl>
                  <div><dt>规则</dt><dd>{definition.rules.length}</dd></div>
                  <div><dt>组件</dt><dd>{definition.components.length}</dd></div>
                  <div><dt>准备步骤</dt><dd>{definition.setup.length}</dd></div>
                  <div><dt>行动</dt><dd>{definition.actions.length}</dd></div>
                  <div><dt>桌面区域</dt><dd>{definition.board.zones.length}</dd></div>
                  <div><dt>阶段</dt><dd>{definition.phases.length}</dd></div>
                  <div><dt>场景</dt><dd>{definition.scenarios.length}</dd></div>
                </dl>
                <p>主题：{definition.presentation.theme || "未设置"}</p>
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
                      <small>自动模拟 · 非真人验收</small>
                    </li>
                  ))}
                </ul>
              ) : (
                  <p>暂无自动试玩记录。</p>
              )}
              </section>
              <section className="evidence-summary">
                <strong>试玩房间</strong>
              {rooms.length ? (
                <ul>
                  {rooms.map((room) => (
                    <li key={room.id}>
                      <a href={room.roomUrl}>
                        {room.id} · turn {room.state.turn}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                  <p>暂无房间。</p>
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

function scoreRaceKernel(
  definition: GameDefinition,
): Extract<
  Extract<GameDefinition["runtimeSupport"], { status: "executable" }>["kernel"],
  { type: "score-race-v1" }
> | null {
  return definition.runtimeSupport.status === "executable" &&
    definition.runtimeSupport.kernel.type === "score-race-v1"
    ? definition.runtimeSupport.kernel
    : null;
}

function isHarborVoyage(
  definition: GameDefinition,
): boolean {
  return (
    definition.runtimeSupport.status === "executable" &&
    definition.runtimeSupport.kernel.type === "harbor-voyage-v1"
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

  useEffect(() => {
    getBuild(buildId).then(setBuild).catch((reason: Error) => {
      setError(reason.message);
    });
  }, [buildId]);

  if (error) {
    return (
      <main className="editor-status" id="main">
        <h1>这个 Build 打不开。</h1>
        <p role="alert">{error}</p>
      </main>
    );
  }
  if (!build) {
    return (
      <main className="editor-status" id="main" aria-busy="true">
        <h1>正在加载 Playable Build…</h1>
      </main>
    );
  }

  const race = scoreRaceKernel(build.definition);
  const harbor = isHarborVoyage(build.definition);
  const runtimePoints = new Map(
    race?.actions.map((action) => [action.id, action.points]) ?? [],
  );

  return (
    <main className="playable-preview" id="main">
      <header>
        <span>Playable Build · immutable visual preview</span>
        <a href={`/editor/${build.projectId}`}>返回 Editor</a>
      </header>
      <section className="preview-hero">
        <div className="preview-title">
          <span>Definition v{build.definitionVersion}</span>
          <h1>{build.definition.name}</h1>
          <p>{build.definition.pitch || "这个版本还没有一句话玩法。"}</p>
        </div>
        <dl>
          <div>
            <dt>Players</dt>
            <dd>{build.definition.playerCount}</dd>
          </div>
          <div>
            <dt>Minutes</dt>
            <dd>{build.definition.durationMinutes}</dd>
          </div>
          <div>
            <dt>Kernel</dt>
            <dd>
              {build.definition.runtimeSupport.status === "executable"
                ? build.definition.runtimeSupport.kernel.type
                : "draft"}
            </dd>
          </div>
        </dl>
      </section>
      {harbor ? (
        <section className="preview-board" aria-label="航次桌面预览">
          <HarborVoyageBoard
            readOnly
            voyage={createHarborVoyageState(build.definition.playerCount)}
          />
        </section>
      ) : (
        <>
          <section className="preview-board" aria-label="结构化桌面预览">
            <div className="preview-section-heading">
              <span>Visual mechanism preview</span>
              <strong>{build.definition.board.layout || "未配置桌面布局"}</strong>
            </div>
            <div className="preview-board-canvas">
              {build.definition.board.zones.length > 0 ? (
                build.definition.board.zones.map((zone) => (
                  <article className="preview-zone" key={zone.id}>
                    <span>Zone</span>
                    <h2>{zone.name}</h2>
                    <p>{zone.description}</p>
                  </article>
                ))
              ) : (
                <p className="preview-empty">这个 Definition 还没有桌面区域。</p>
              )}
              <div className="preview-score-track" aria-label="分数轨道">
                <span>Score track</span>
                <div>
                  <b>0</b>
                  <i aria-hidden="true" />
                  <b>{race?.victoryTarget ?? "—"}</b>
                </div>
                <small>
                  {race
                    ? `先达到 ${race.victoryTarget} 分 · 最多 ${race.maxTurns} 回合`
                    : "尚未配置确定性运行时"}
                </small>
              </div>
            </div>
          </section>
          <section className="preview-actions" aria-label="可用行动预览">
            <div className="preview-section-heading">
              <span>Action cards</span>
              <strong>{build.definition.actions.length} actions</strong>
            </div>
            <div className="preview-action-grid">
              {build.definition.actions.length > 0 ? (
                build.definition.actions.map((action) => (
                  <article key={action.id}>
                    <span>{action.id}</span>
                    <h2>{action.label}</h2>
                    <p>{action.description}</p>
                    <strong>
                      {runtimePoints.has(action.id)
                        ? `+${runtimePoints.get(action.id)} points`
                        : "未映射到运行时"}
                    </strong>
                  </article>
                ))
              ) : (
                <p className="preview-empty">这个 Definition 还没有可用行动。</p>
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
          上方是根据 immutable Definition 生成的结构化视觉预览；它不是截图渲染，
          不代表缺失规则已经实现，也不等于真人试玩通过。
        </p>
      </aside>
    </main>
  );
}

function RoomView({ roomId }: { roomId: string }) {
  const [room, setRoom] = useState<GameRoom>();
  const [build, setBuild] = useState<PlayableBuild>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getRoom(roomId)
      .then(async (nextRoom) => {
        setRoom(nextRoom);
        setBuild(await getBuild(nextRoom.buildId));
      })
      .catch((reason: Error) => setError(reason.message));
  }, [roomId]);

  async function act(actionId: string) {
    if (!room) return;
    setBusy(true);
    setError("");
    try {
      setRoom(
        await submitRoomIntent(room.id, {
          intentId: crypto.randomUUID(),
          seat: room.state.activeSeat,
          actionId,
        }),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "行动被拒绝。");
    } finally {
      setBusy(false);
    }
  }

  if (error && !room) {
    return (
      <main className="editor-status" id="main">
        <h1>这个房间打不开。</h1>
        <p role="alert">{error}</p>
      </main>
    );
  }
  if (!room || !build) {
    return (
      <main className="editor-status" id="main" aria-busy="true">
        <h1>正在重连权威房间…</h1>
      </main>
    );
  }

  const race = scoreRaceKernel(build.definition);
  const voyage = room.state.voyage;
  const harbor = isHarborVoyage(build.definition) && voyage;

  return (
    <main className={`room-view ${harbor ? "room-view-voyage" : ""}`} id="main">
      <header>
        <div>
          <span>Authoritative room · reconnectable</span>
          <h1>{build.definition.name}</h1>
        </div>
        <div>
          <a href={`/editor/${room.projectId}`}>Editor</a>
          <a href={room.replayUrl}>只读回放</a>
        </div>
      </header>

      {harbor ? (
        <HarborVoyageBoard
          busy={busy}
          onAct={act}
          voyage={voyage as HarborVoyageState}
        />
      ) : (
        <section className="room-table room-table-rich">
          <div className="room-status">
            <span>Turn {room.state.turn}</span>
            <strong>
              {room.state.status === "complete"
                ? `Seat ${room.state.winnerSeat} wins`
                : `Seat ${room.state.activeSeat} to act`}
            </strong>
            <p>
              {build.definition.phases
                .map((phase) => phase.name)
                .join(" → ") || "轮流选择行动并累计分数"}
            </p>
          </div>

          {build.definition.board.zones.length > 0 && (
            <div className="room-zones" aria-label="桌面区域">
              {build.definition.board.zones.map((zone) => (
                <article key={zone.id}>
                  <span>Zone</span>
                  <b>{zone.name}</b>
                  <small>{zone.description}</small>
                </article>
              ))}
            </div>
          )}

          <div className="score-grid">
            {room.state.scores.map((score, seat) => (
              <article
                className={seat === room.state.activeSeat ? "is-active" : ""}
                key={seat}
              >
                <span>Seat {seat}</span>
                <strong>{score}</strong>
                {race && (
                  <small>
                    / {race.victoryTarget}
                  </small>
                )}
              </article>
            ))}
          </div>

          {race && room.state.status === "active" && (
            <div className="room-actions room-action-cards">
              {race.actions.map((action) => {
                const detail = build.definition.actions.find(
                  (item) => item.id === action.id,
                );
                return (
                  <button
                    disabled={busy}
                    key={action.id}
                    onClick={() => act(action.id)}
                    type="button"
                  >
                    <b>{action.label}</b>
                    <small>+{action.points}</small>
                    {detail?.description && <span>{detail.description}</span>}
                  </button>
                );
              })}
            </div>
          )}
          {error && <p className="creator-error" role="alert">{error}</p>}
        </section>
      )}

      {error && harbor && <p className="creator-error" role="alert">{error}</p>}

      <aside className="action-log">
        <span>Accepted Action Log</span>
        <code>{room.id}</code>
        {room.acceptedActions.length ? (
          <ol>
            {room.acceptedActions.map((action) => (
              <li key={action.sequence}>
                #{action.sequence} · seat {action.seat} · {action.actionId}
                {action.points ? ` · +${action.points}` : ""}
              </li>
            ))}
          </ol>
        ) : (
          <p>尚无已接受行动。非法 intent 不会进入这里。</p>
        )}
        {build.definition.runtimeSupport.status === "executable" &&
          build.definition.runtimeSupport.unsupported.length > 0 && (
            <div className="room-unsupported">
              <strong>未覆盖</strong>
              <ul>
                {build.definition.runtimeSupport.unsupported.map((item) => (
                  <li key={item}>{item}</li>
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

  useEffect(() => {
    getReplay(replayId).then(setReplay).catch((reason: Error) => {
      setError(reason.message);
    });
  }, [replayId]);

  if (error) {
    return (
      <main className="editor-status" id="main">
        <h1>这个回放打不开。</h1>
        <p role="alert">{error}</p>
      </main>
    );
  }
  if (!replay) {
    return (
      <main className="editor-status" id="main" aria-busy="true">
        <h1>正在读取不可变 Action Log…</h1>
      </main>
    );
  }

  return (
    <main className="replay-view" id="main">
      <header>
        <span>Read-only replay · cannot mutate live room</span>
        <a href={`/editor/${replay.projectId}`}>返回 Editor</a>
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
              {action.points ? ` · +${action.points}` : ""}
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
        {state.scores.map((score, seat) => (
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
  const editorMatch = window.location.pathname.match(/^\/editor\/([^/]+)$/);
  if (editorMatch) {
    return <ProjectEditor projectId={decodeURIComponent(editorMatch[1])} />;
  }
  const playMatch = window.location.pathname.match(/^\/play\/([^/]+)$/);
  if (playMatch) {
    return <PlayablePreview buildId={decodeURIComponent(playMatch[1])} />;
  }
  const roomMatch = window.location.pathname.match(/^\/room\/([^/]+)$/);
  if (roomMatch) {
    return <RoomView roomId={decodeURIComponent(roomMatch[1])} />;
  }
  const replayMatch = window.location.pathname.match(/^\/replay\/([^/]+)$/);
  if (replayMatch) {
    return <ReplayView replayId={decodeURIComponent(replayMatch[1])} />;
  }
  return <CreatorHome />;
}
