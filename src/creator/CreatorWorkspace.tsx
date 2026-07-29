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
import { DEFAULT_EXAMPLES } from "./default-examples";
import type { DefaultExampleId } from "./default-examples";

export function draftExpectedVersion(
  baseVersion: number | null,
  visibleVersion: number,
) {
  return baseVersion ?? visibleVersion;
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
  const [name, setName] = useState("我的第一个 GoDesk 游戏");
  const [projects, setProjects] = useState<GameProject[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [creatingExample, setCreatingExample] =
    useState<DefaultExampleId | null>(null);

  useEffect(() => {
    listProjects().then(setProjects).catch((reason: Error) => {
      setError(reason.message);
    });
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await createProject(name);
      window.location.assign(result.editorUrl);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "创建项目失败。");
      setBusy(false);
    }
  }

  async function createFromExample(exampleId: DefaultExampleId, title: string) {
    setCreatingExample(exampleId);
    setError("");
    try {
      const result = await createProject(title, exampleId);
      window.location.assign(result.editorUrl);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "创建案例失败。");
      setCreatingExample(null);
    }
  }

  return (
    <main className="creator-home" id="main">
      <section className="creator-intro">
        <span className="creator-eyebrow">Codex 控制面 · GoDesk 工作面</span>
        <h1>说出玩法，打开项目，边做边玩。</h1>
        <p>
          GoDesk 把规则、组件和试玩放进同一个可编辑项目。Codex 可以替你动手，
          你也可以随时进入 Editor 自己调整。
        </p>
      </section>

      <section className="project-create" aria-labelledby="new-project-title">
        <div>
          <span>New project</span>
          <h2 id="new-project-title">创建 Game Project</h2>
          <p>项目会保存在 GoDesk 服务端，而不是只留在当前浏览器。</p>
        </div>
        <form onSubmit={submit}>
          <label htmlFor="project-name">项目名称</label>
          <div className="project-name-row">
            <input
              autoComplete="off"
              id="project-name"
              maxLength={80}
              onChange={(event) => setName(event.currentTarget.value)}
              value={name}
            />
            <button disabled={busy || !name.trim()} type="submit">
              {busy ? "正在创建…" : "创建并打开 Editor"}
            </button>
          </div>
          {error && <p className="creator-error" role="alert">{error}</p>}
        </form>
      </section>

      <section className="default-examples" aria-labelledby="examples-title">
        <div className="section-heading">
          <div>
            <span>Default examples</span>
            <h2 id="examples-title">从案例开始</h2>
          </div>
          <p>复制为你的独立项目，再用 Codex 或 Editor 继续修改。</p>
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
                disabled={creatingExample !== null}
                onClick={() => createFromExample(example.id, example.title)}
                type="button"
              >
                {creatingExample === example.id
                  ? "正在复制…"
                  : "复制为我的项目并打开"}
              </button>
            </article>
          ))}
        </div>
        {error && <p className="creator-error" role="alert">{error}</p>}
      </section>

      <section className="recent-projects" aria-labelledby="recent-title">
        <div className="section-heading">
          <h2 id="recent-title">最近项目</h2>
          <span>{projects.length} 个</span>
        </div>
        {projects.length ? (
          <ul>
            {projects.map((project) => (
              <li key={project.id}>
                <a href={`/editor/${project.id}`}>
                  <span>
                    <strong>{project.name}</strong>
                    <small>{project.id}</small>
                  </span>
                  <span>
                    v{project.version}
                    <b aria-hidden="true">→</b>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-projects">
            还没有项目。先建一张桌，别让这个页面继续装深沉。
          </p>
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
          <a aria-current="page" href="#overview">Overview</a>
          <span>Sources</span>
          <span>Game Definition</span>
          <span>Builds</span>
          <span>Playtests</span>
          <span>Rooms</span>
        </nav>
        <a className="back-projects" href="/">所有项目</a>
      </aside>

      <section className="editor-canvas">
        <header className="editor-header">
          <div>
          <span>Game Project</span>
          <h1>{project.name}</h1>
          </div>
          <div className="project-version">
            <span>Authoritative version</span>
            <strong>v{project.version}</strong>
          </div>
        </header>

        <div className="editor-grid" id="overview">
          <section className="definition-panel" id="definition">
            <span className="panel-label">Active Game Definition</span>
            <h2>{definition.name}</h2>
            <code>{project.activeDefinitionId}</code>
            <form className="definition-form" onSubmit={saveDefinition}>
              <label htmlFor="definition-name">版本名称</label>
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

              <label htmlFor="definition-pitch">一句话玩法</label>
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
                placeholder="合作、竞价、背叛……这张桌到底让人干什么？"
                rows={4}
                value={definition.pitch}
              />

              <div className="definition-numbers">
                <label htmlFor="player-count">
                  玩家数
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
                  时长（分钟）
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

              <label htmlFor="source-brief">添加 Source Library brief</label>
              <textarea
                id="source-brief"
                onChange={(event) => setSourceDraft(event.currentTarget.value)}
                placeholder="可选：粘贴本次修改依据，保存后会带 provenance 进入 Source Library。"
                rows={4}
                value={sourceDraft}
              />

              <div className="definition-actions">
                <button disabled={busy || !definition.name.trim()} type="submit">
                  {busy ? "正在保存…" : `保存为 v${project.version + 1}`}
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
                  刷新项目
                </button>
              </div>
              {notice && <p className="creator-notice" role="status">{notice}</p>}
              {formError && (
                <p className="creator-error" role="alert">{formError}</p>
              )}
            </form>
          </section>

          <aside className="project-facts">
            <span className="panel-label">Project truth</span>
            <CapabilityList project={project} />
            <section className="evidence-summary" id="definitions">
              <span>Game Definitions</span>
              <button
                disabled={busy || definitionDirty || Boolean(sourceDraft.trim())}
                onClick={duplicateActiveDefinition}
                type="button"
              >
                复制当前 Definition 为变体
              </button>
              <ul>
                {definitions.map((candidate) => (
                  <li key={candidate.id}>
                    <strong>
                      {candidate.name} · d{candidate.version}
                    </strong>
                    {candidate.id === project.activeDefinitionId ? (
                      <small>当前编辑版本</small>
                    ) : (
                      <button
                        disabled={
                          busy || definitionDirty || Boolean(sourceDraft.trim())
                        }
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
                <small>先保存或清空草稿，再切换或复制 Definition。</small>
              )}
            </section>
            <section className="source-summary" id="sources">
              <span>Source Library</span>
              <strong>{sources.length} entries</strong>
              {sources.length > 0 && (
                <ul>
                  {sources.map((source) => (
                    <li key={source.id}>
                      <span>{source.name}</span>
                      <small>{source.provenance.origin}</small>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="evidence-summary" id="structure">
              <span>Definition structure · live readback</span>
              <ul>
                <li><strong>{definition.rules.length}</strong><small>rules</small></li>
                <li><strong>{definition.components.length}</strong><small>components</small></li>
                <li><strong>{definition.setup.length}</strong><small>setup steps</small></li>
                <li><strong>{definition.actions.length}</strong><small>actions</small></li>
                <li><strong>{definition.board.zones.length}</strong><small>board zones</small></li>
                <li><strong>{definition.phases.length}</strong><small>phases</small></li>
                <li><strong>{definition.scenarios.length}</strong><small>scenarios</small></li>
              </ul>
              <small>
                主题：{definition.presentation.theme || "未设置"} ·
                页面每 2 秒读取权威版本；有未保存草稿时只更新其他面板。
              </small>
            </section>
            <section className="runtime-summary" id="runtime">
              <span>Deterministic runtime</span>
              <strong>
                {definition.runtimeSupport.status === "executable"
                  ? definition.runtimeSupport.kernel.type
                  : "Not configured"}
              </strong>
              {definition.runtimeSupport.status === "draft" && (
                <>
                  <p>
                    启用最小 score-race 原型内核后，Build 才能运行 bot
                    试玩和权威房间；它不是完整桌游规则。
                  </p>
                  <button
                    disabled={
                      busy || definitionDirty || Boolean(sourceDraft.trim())
                    }
                    onClick={configureRuntime}
                    type="button"
                  >
                    启用确定性原型内核
                  </button>
                </>
              )}
            </section>
            <section className="build-summary" id="builds">
              <span>Playable Builds</span>
              <button
                disabled={busy || definitionDirty || Boolean(sourceDraft.trim())}
                onClick={buildPlayable}
                type="button"
              >
                {busy ? "正在处理…" : "编译当前版本"}
              </button>
              {builds.length > 0 ? (
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
                          生成预览任务
                        </button>
                        <button
                          disabled={busy}
                          onClick={() =>
                            submitBuildHandoff(build, "export-build")}
                          type="button"
                        >
                          导出 .godesk.json
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
                            跑 seed 42 自动试玩
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => startRoom(build)}
                            type="button"
                          >
                            创建权威房间
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>还没有 Build。</p>
              )}
            </section>
            <section className="evidence-summary" id="jobs">
              <span>Durable jobs</span>
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
                          使用持久输入重试
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>还没有持久任务。</p>
              )}
            </section>
            <section className="evidence-summary" id="changesets">
              <span>Persistent changesets</span>
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
                <p>还没有 changeset。</p>
              )}
            </section>
            <section className="evidence-summary" id="playtests">
              <span>Playtest evidence</span>
              {playtests.length ? (
                <ul>
                  {playtests.map((playtest) => (
                    <li key={playtest.id}>
                      <a href={playtest.replayUrl}>
                        seed {playtest.seed} · {playtest.metrics.turns} turns
                      </a>
                      <small>automated bot simulation · 非真人验收</small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>还没有自动试玩记录。</p>
              )}
            </section>
            <section className="evidence-summary" id="rooms">
              <span>Authoritative rooms</span>
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
                <p>还没有房间。</p>
              )}
            </section>
            <footer>
              <span>Project ID</span>
              <code>{project.id}</code>
            </footer>
          </aside>
        </div>
      </section>
    </main>
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

  return (
    <main className="playable-preview" id="main">
      <header>
        <span>Compiled preview · immutable</span>
        <a href={`/editor/${build.projectId}`}>返回 Editor</a>
      </header>
      <section>
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
            <dt>Sources</dt>
            <dd>{build.sourceIds.length}</dd>
          </div>
        </dl>
      </section>
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
        <p>
          这是已编译的可视化预览，不代表缺失规则已经实现，也不等于真人试玩通过。
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
  const runtime =
    build.definition.runtimeSupport.status === "executable"
      ? build.definition.runtimeSupport.kernel
      : null;

  return (
    <main className="room-view" id="main">
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
      <section className="room-table">
        <div className="room-status">
          <span>Turn {room.state.turn}</span>
          <strong>
            {room.state.status === "complete"
              ? `Seat ${room.state.winnerSeat} wins`
              : `Seat ${room.state.activeSeat} to act`}
          </strong>
        </div>
        <div className="score-grid">
          {room.state.scores.map((score, seat) => (
            <article
              className={seat === room.state.activeSeat ? "is-active" : ""}
              key={seat}
            >
              <span>Seat {seat}</span>
              <strong>{score}</strong>
            </article>
          ))}
        </div>
        {runtime && room.state.status === "active" && (
          <div className="room-actions">
            {runtime.actions.map((action) => (
              <button
                disabled={busy}
                key={action.id}
                onClick={() => act(action.id)}
                type="button"
              >
                {action.label} <small>+{action.points}</small>
              </button>
            ))}
          </div>
        )}
        {error && <p className="creator-error" role="alert">{error}</p>}
      </section>
      <aside className="action-log">
        <span>Accepted Action Log</span>
        <code>{room.id}</code>
        {room.acceptedActions.length ? (
          <ol>
            {room.acceptedActions.map((action) => (
              <li key={action.sequence}>
                #{action.sequence} · seat {action.seat} · {action.actionId} · +
                {action.points}
              </li>
            ))}
          </ol>
        ) : (
          <p>尚无已接受行动。非法 intent 不会进入这里。</p>
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
        <div className="score-grid">
          {replay.finalState.scores.map((score, seat) => (
            <article key={seat}>
              <span>Seat {seat}</span>
              <strong>{score}</strong>
            </article>
          ))}
        </div>
      </section>
      <aside className="action-log">
        <h2>Accepted actions</h2>
        <ol>
          {replay.acceptedActions.map((action) => (
            <li key={action.sequence}>
              #{action.sequence} · seat {action.seat} · {action.actionId} · +
              {action.points}
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
