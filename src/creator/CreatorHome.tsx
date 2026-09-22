import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  beginWebLogin,
  createProject,
  createSharedSession,
  getBuilds,
  isUnauthorized,
  listProjects,
  shouldOfferWebLogin,
  submitJob,
  waitForJob,
} from "./project-api";
import type { GameProject } from "./project-contract";
import {
  clearComposerDraft,
  readComposerDraft,
  writeComposerDraft,
} from "./composer-draft";
import { DEFAULT_EXAMPLES, type DefaultExampleId } from "./default-examples";
import { HOBBYIST_STARTERS } from "./hobbyist-starters";
import { logicalPathname } from "../public-mount";
import {
  extractRulebookText,
  harvestRulebookPageImages,
  prepareImageAsset,
  validateImageAssets,
  validateRulebookFile,
} from "../platform/ingestion";
import { Brand } from "./CreatorBrand";
import { generationSourceFields, hobbyistProjectName, href } from "./studio-utils";

export function CreatorHome() {
  const restoredDraft = readComposerDraft();
  const [name, setName] = useState(restoredDraft?.name ?? "我的游戏");
  const [description, setDescription] = useState(restoredDraft?.description ?? "");
  const [rulesText, setRulesText] = useState(restoredDraft?.rulesText ?? "");
  const [rulebook, setRulebook] = useState<File>();
  const [visualAssets, setVisualAssets] = useState<File[]>([]);
  const [visualAssetUse, setVisualAssetUse] = useState<"visual-reference" | "project-asset">(
    "visual-reference",
  );
  const [projects, setProjects] = useState<GameProject[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [stageLabel, setStageLabel] = useState("");
  const [completedStages, setCompletedStages] = useState(0);
  const [exampleBusy, setExampleBusy] = useState<DefaultExampleId | null>(null);
  const resumeAfterLogin = useRef(restoredDraft?.resume ?? null);
  const resumeExampleId = useRef(restoredDraft?.exampleId);

  useEffect(() => {
    listProjects().then(setProjects).catch((reason: Error) => {
      if (isUnauthorized(reason)) return;
      if (/<!doctype|unexpected token/i.test(reason.message)) return;
      setError(reason.message);
    });
  }, []);

  useEffect(() => {
    writeComposerDraft({
      name,
      description,
      rulesText,
      resume: readComposerDraft()?.resume ?? null,
      exampleId: readComposerDraft()?.exampleId,
    });
  }, [name, description, rulesText]);

  useEffect(() => {
    const resume = resumeAfterLogin.current;
    resumeAfterLogin.current = null;
    if (!shouldOfferWebLogin() || !resume) return;
    writeComposerDraft({
      name: restoredDraft?.name ?? "我的游戏",
      description: restoredDraft?.description ?? "",
      rulesText: restoredDraft?.rulesText ?? "",
      resume: null,
    });
    if (resume === "generate") {
      void submit({ preventDefault() {} } as React.FormEvent);
      return;
    }
    if (resume === "example" && resumeExampleId.current) {
      void copyExample(resumeExampleId.current);
    }
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
    setCompletedStages(1);
    setStageLabel("正在创建这局游戏");
    const projectName = hobbyistProjectName(name, description);
    const created = await createProject(projectName);
    setStageLabel("正在把想法变成可玩版本");
    const generationSourceName = sourceContent.trim()
      ? sourceName
      : `${projectName} visual material`;
    const idea = description.trim() || (visualAssets.length
      ? `根据上传的 ${visualAssets.length} 份视觉素材，创建一个可玩的规则游戏。`
      : sourceContent);
    const queuedGeneration = await submitJob(created.project.id, {
      kind: "generate-rule-system",
      expectedVersion: created.project.version,
      idea,
      name: projectName,
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
    setStageLabel("打开这局游戏");
    setProjects(await listProjects());
    window.location.assign(created.studioUrl);
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
      if (isUnauthorized(reason) && shouldOfferWebLogin()) {
        writeComposerDraft({
          name,
          description,
          rulesText,
          resume: "generate",
        });
        beginWebLogin("/");
        return;
      }
      setError(reason instanceof Error ? reason.message : "生成项目失败。");
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
    setCompletedStages(1);
    try {
      setStageLabel("正在开局");
      const created = await createProject(example.title, exampleId);
      setCompletedStages(2);
      setStageLabel("正在生成可玩版本");
      const queuedBuild = await submitJob(created.project.id, {
        kind: "compile-build",
        expectedVersion: created.project.version,
        idempotencyKey: crypto.randomUUID(),
      });
      const built = await waitForJob(queuedBuild.id);
      if (built.status === "failed") throw new Error(built.error ?? "编译失败。");
      setCompletedStages(4);
      const builds = await getBuilds(created.project.id);
      const build = builds[0];
      if (!build) throw new Error("编译成功但未找到 Build。");
      setCompletedStages(5);
      setProjects(await listProjects());
      await createAndOpenSession(build.id);
    } catch (reason) {
      if (isUnauthorized(reason) && shouldOfferWebLogin()) {
        writeComposerDraft({
          name,
          description,
          rulesText,
          resume: "example",
          exampleId,
        });
        beginWebLogin("/");
        return;
      }
      setError(reason instanceof Error ? reason.message : "复制案例失败。");
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
  const selectedStarterId = HOBBYIST_STARTERS.find((starter) => starter.text === description)?.id;

  return (
    <main className="studio-home" id="main">
      <aside className="studio-sidebar">
        <Brand />
        <a
          className="studio-new"
          href={href("/")}
          onClick={(event) => {
            clearComposerDraft();
            if (logicalPathname(window.location.pathname) !== "/") return;
            event.preventDefault();
            setName("我的游戏");
            setDescription("");
            setRulesText("");
            setRulebook(undefined);
            setVisualAssets([]);
            setError("");
          }}
        >
          ＋ 新游戏
        </a>
        <nav aria-label="最近项目">
          <span>我的游戏</span>
          {projects.slice(0, 8).map((project) => (
            <a href={href(`/studio/${project.id}`)} key={project.id}>
              <i aria-hidden="true">◇</i>
              <span><strong>{project.name}</strong><small>v{project.version}</small></span>
            </a>
          ))}
          {!projects.length && <small>生成后，游戏会出现在这里。</small>}
        </nav>
        <a className="studio-install" href="/chatgpt-plugin">在 Codex 中使用</a>
      </aside>

      <section className="studio-stage">
        <header className="studio-topbar">
          <span>桌游 · 剧本杀 · 棋牌</span>
          <div><span className="studio-status-dot" /> 创作台</div>
        </header>
        <div className="studio-welcome">
          <div className="studio-orbit" aria-hidden="true"><span>GD</span></div>
          <h1>今天要做一款什么游戏？</h1>
          <span>
            写下一局桌游、剧本杀或棋牌的想法，也可以附上剧本或规则。
            生成别人能立刻打开、立刻玩、还能联机的游戏。写完就能自己试，再分享联机。
          </span>
        </div>

        <form
          aria-busy={busy}
          autoComplete="off"
          className={`studio-composer${description.trim() ? " is-filled" : ""}${hasGenerationInput ? " is-ready" : ""}`}
          onSubmit={submit}
        >
            <label className="studio-idea-field">
              <span className="sr-only">描述你的游戏想法</span>
              <textarea
                maxLength={2_000}
                onChange={(event) => setDescription(event.currentTarget.value)}
                placeholder="例如：三个人在别墅里互相怀疑谁是凶手，每人有一条私密线索，先集齐证据的人揭晓真相。"
                rows={4}
                value={description}
              />
            </label>

            <div className="studio-starter-row" aria-label="常用开局">
              {HOBBYIST_STARTERS.map((starter) => (
                <button
                  aria-pressed={selectedStarterId === starter.id}
                  className={selectedStarterId === starter.id ? "is-selected" : undefined}
                  disabled={busy}
                  key={starter.id}
                  onClick={() => {
                    setDescription(starter.text);
                    if (name === "我的游戏") setName(starter.label);
                  }}
                  type="button"
                >
                  {starter.label}
                </button>
              ))}
            </div>

            <div className="studio-attach-row">
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
                  <strong>{rulebook ? rulebook.name : "附上剧本或规则"}</strong>
                  <small>{rulebook ? `${(rulebook.size / 1024).toFixed(1)} KB · 点击替换` : "PDF / TXT / MD · 可选"}</small>
                </span>
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
                  <strong>{visualAssets.length ? `${visualAssets.length} 张图片` : "添加图片"}</strong>
                  <small id="asset-upload-help">卡牌、地图或参考图 · 可选</small>
                </span>
              </label>
            </div>

            {visualAssets.length > 0 && (
              <div className="studio-fields image-use-field">
                <label>
                  <span>这些图片怎么用</span>
                  <select
                    onChange={(event) => setVisualAssetUse(
                      event.currentTarget.value as "visual-reference" | "project-asset",
                    )}
                    value={visualAssetUse}
                  >
                    <option value="visual-reference">只参考风格，不直接放进游戏</option>
                    <option value="project-asset">原样放进卡牌或桌面</option>
                  </select>
                </label>
              </div>
            )}

            <details className="studio-paste">
              <summary>没有文件？粘贴规则全文，或给这局起个名字</summary>
              <label className="studio-inline-name">
                <span>游戏名称</span>
                <input maxLength={80} onChange={(event) => setName(event.currentTarget.value)} value={name} />
              </label>
              <textarea
                disabled={Boolean(rulebook)}
                onChange={(event) => setRulesText(event.currentTarget.value)}
                placeholder="在这里粘贴规则全文……"
                rows={6}
                value={rulesText}
              />
            </details>

            <footer className="studio-submit-row">
              <span id="studio-submit-help">一个想法就够。生成后就能自己试，再把链接发给朋友。</span>
              <button
                aria-describedby="studio-submit-help"
                disabled={busy || !hasGenerationInput}
                type="submit"
              >
                {busy ? <><i className="studio-spinner" /> {stageLabel || "正在生成…"}</> : <>生成可玩版本</>}
              </button>
            </footer>
        </form>

        {showPipeline && (
          <p className="studio-progress" role="status">
            {stageLabel || "正在把想法变成可玩版本…"}
          </p>
        )}

        {error && <p className="studio-error" role="alert">{error}</p>}

        {!showPipeline && (
          <section className="default-examples studio-examples" aria-label="先玩一局现成的">
            <h2>想先摸清手感？直接开一局现成的</h2>
            <div className="example-grid">
              {DEFAULT_EXAMPLES.map((example, index) => (
                <article key={example.id} style={{ "--i": index } as CSSProperties}>
                  <h3>{example.title}</h3>
                  <p>{example.summary}</p>
                  <dl>
                    <div><dt>人数</dt><dd>{example.players}</dd></div>
                    <div><dt>时长</dt><dd>{example.duration}</dd></div>
                  </dl>
                  <button
                    disabled={Boolean(exampleBusy) || busy}
                    onClick={() => copyExample(example.id)}
                    type="button"
                  >
                    {exampleBusy === example.id ? "正在开局…" : "先玩这一局"}
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
