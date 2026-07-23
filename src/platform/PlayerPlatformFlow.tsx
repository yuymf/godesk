import { useEffect, useMemo, useState } from "react";
import { PlayableManila } from "../manila/PlayableManila";
import {
  ingestGameSourceBundle,
  type GenerationRun,
  type IngestionProgress,
} from "./ingestion";
import {
  deleteGenerationRun,
  getLatestGenerationRun,
  saveGenerationRun,
} from "./generation-run-store";

type Screen =
  | "upload"
  | "ingesting"
  | "ingested"
  | "generating"
  | "ready"
  | "play";

const generationStages = [
  {
    name: "理解规则",
    detail: "读取 8 页规则，整理开局、回合、行动、结算与结束条件",
  },
  {
    name: "整理游戏素材",
    detail: "识别棋盘、平底船、货物、股份与玩家棋子",
  },
  {
    name: "补全缺失图片",
    detail: "示例素材齐全，本次不需要生成新图片",
  },
  {
    name: "搭建可玩版本",
    detail: "生成三人单航次桌面、合法行动和结算流程",
  },
] as const;

function FileInput({
  accept,
  description,
  label,
  multiple,
  onFiles,
  value,
}: {
  accept: string;
  description: string;
  label: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  value: File[];
}) {
  return (
    <label className={value.length ? "source-drop has-file" : "source-drop"}>
      <input
        accept={accept}
        multiple={multiple}
        onChange={(event) => onFiles(Array.from(event.currentTarget.files ?? []))}
        type="file"
      />
      <span className="source-drop-icon" aria-hidden="true">
        {value.length ? "✓" : "+"}
      </span>
      <span>
        <strong>{label}</strong>
        <small>
          {value.length
            ? value.map((file) => file.name).join("、")
            : description}
        </small>
      </span>
    </label>
  );
}

function AppHeader({ onHome }: { onHome: () => void }) {
  return (
    <header className="player-header">
      <button className="player-brand" onClick={onHome} type="button">
        <span>GD</span>
        <span>
          <strong>GODESK</strong>
          <small>给规则，就开玩</small>
        </span>
      </button>
      <span className="prototype-badge">本地功能原型</span>
    </header>
  );
}

function UploadScreen({
  assets,
  latestRun,
  onDeleteRun,
  onOpenRun,
  rulebook,
  setAssets,
  setRulebook,
  startIngestion,
  startExample,
}: {
  assets: File[];
  latestRun?: GenerationRun;
  onDeleteRun: (id: string) => void;
  onOpenRun: () => void;
  rulebook: File[];
  setAssets: (files: File[]) => void;
  setRulebook: (files: File[]) => void;
  startIngestion: () => void;
  startExample: () => void;
}) {
  const hasCustomFiles = rulebook.length > 0 || assets.length > 0;
  const canIngest = rulebook.length === 1 && assets.length > 0;

  return (
    <main className="player-main" id="main">
      <section className="player-hero">
        <span className="player-kicker">AI 原生在线桌游平台</span>
        <h1>
          把规则和素材丢进来，
          <br />
          直接得到一张能玩的桌。
        </h1>
        <p>
          不用写代码，也不用审核一堆 AI 结果。Godesk 会理解规则、整理或生成图片、
          搭好游戏，再让你邀请朋友一起玩。
        </p>
      </section>

      <section className="upload-workspace" aria-labelledby="upload-title">
        <div className="upload-heading">
          <div>
            <span className="step-number">01</span>
            <h2 id="upload-title">添加你的游戏</h2>
          </div>
          <p>支持你自己写的规则书和自己做的素材包。</p>
        </div>

        <div className="source-inputs">
          <FileInput
            accept="application/pdf,.pdf"
            description="PDF，最多 25 MB；包含玩法、流程和胜负条件"
            label="规则书 PDF"
            onFiles={setRulebook}
            value={rulebook}
          />
          <FileInput
            accept="application/pdf,image/jpeg,image/png,image/webp,image/gif,.pdf"
            description="PDF/JPG/PNG/WebP/GIF；最多 40 个，共 100 MB"
            label="素材图鉴包"
            multiple
            onFiles={setAssets}
            value={assets}
          />
        </div>

        {hasCustomFiles ? (
          <p className="capability-note" role="status">
            {canIngest
              ? "文件只在当前浏览器中读取和保存。导入会提取 PDF 文字、页面预览、图片尺寸、哈希和来源位置。"
              : "还差一类文件：需要 1 份规则书和至少 1 份素材。"}
          </p>
        ) : (
          <p className="privacy-note">
            当前原型不会上传文件；本机记录会保留到你主动删除浏览器数据。
          </p>
        )}

        <button
          className="player-primary"
          disabled={!canIngest}
          onClick={startIngestion}
          type="button"
        >
          {canIngest
            ? `导入 ${1 + assets.length} 份真实文件`
            : "添加规则书和素材后开始导入"}
          <span aria-hidden="true">→</span>
        </button>
        <button className="example-link" onClick={startExample} type="button">
          还没有文件？先用 Manila 示例体验完整现有流程
        </button>
      </section>

      {latestRun && (
        <section className="saved-run" aria-labelledby="saved-run-title">
          <div>
            <span>本机记录</span>
            <h2 id="saved-run-title">
              {latestRun.status === "ready-for-compilation"
                ? "上次文件已经导入"
                : "上次导入没有完成"}
            </h2>
            <p>
              {latestRun.status === "ready-for-compilation"
                ? `${latestRun.sources.length} 份来源文件，保存在这个浏览器里。`
                : latestRun.error}
            </p>
          </div>
          <div className="saved-run-actions">
            <button className="open-run-button" onClick={onOpenRun} type="button">
              查看导入结果
            </button>
            <button onClick={() => onDeleteRun(latestRun.id)} type="button">
              删除本机导入记录
            </button>
          </div>
        </section>
      )}

      <section className="automatic-promise" aria-label="自动生成内容">
        <span>系统自动完成</span>
        <ul>
          <li>理解规则</li>
          <li>整理素材</li>
          <li>生成缺图</li>
          <li>搭建游戏</li>
          <li>准备联机</li>
        </ul>
      </section>
    </main>
  );
}

function IngestingScreen({
  progress,
}: {
  progress?: IngestionProgress;
}) {
  return (
    <main className="generation-main" id="main">
      <div className="generation-intro">
        <span className="player-kicker">正在本机导入来源文件</span>
        <h1>正在读取真实内容，不只是记下文件名。</h1>
        <p>
          PDF 会逐页提取文字和预览；图片会验证能否解码。文件不会离开这个浏览器。
        </p>
      </div>
      <div className="real-ingestion-progress" role="status" aria-live="polite">
        <span aria-hidden="true">…</span>
        <div>
          <strong>{progress?.currentFile ?? "准备本地存储"}</strong>
          <small>
            {progress
              ? `已完成 ${progress.completedFiles} / ${progress.totalFiles} 份文件`
              : "正在创建私有生成任务"}
          </small>
        </div>
      </div>
    </main>
  );
}

function IngestedScreen({
  onBack,
  onDelete,
  run,
}: {
  onBack: () => void;
  onDelete: () => void;
  run: GenerationRun;
}) {
  const pages = run.sources.flatMap((source) =>
    source.artifacts.filter((artifact) => artifact.kind === "pdf-page"),
  );
  const images = run.sources.flatMap((source) =>
    source.artifacts.filter((artifact) => artifact.kind === "image"),
  );
  const textCharacters = pages.reduce((sum, page) => sum + page.text.length, 0);

  if (run.status === "failed") {
    return (
      <main className="ingestion-result" id="main">
        <section className="ingestion-failure" role="alert">
          <span aria-hidden="true">!</span>
          <div>
            <span className="player-kicker">导入已停止</span>
            <h1>有文件无法安全读取。</h1>
            <p>{run.error}</p>
            <p>
              没有把损坏文件当成成功继续。请替换这份文件后重新导入。
            </p>
          </div>
        </section>
        <div className="result-actions">
          <button className="player-primary" onClick={onBack} type="button">
            返回并替换文件
            <span aria-hidden="true">←</span>
          </button>
          <button className="delete-run-button" onClick={onDelete} type="button">
            删除这次失败记录
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="ingestion-result" id="main">
      <section className="ingestion-success">
        <span className="ready-check" aria-hidden="true">✓</span>
        <span className="player-kicker">真实来源已导入</span>
        <h1>文件已经变成可追溯的本机生成任务。</h1>
        <p>
          已处理 {run.sources.length} 份文件、{pages.length} 个 PDF 页面、
          {images.length} 张独立图片和 {textCharacters.toLocaleString()} 个文字字符。
        </p>
      </section>

      <section className="ingestion-summary" aria-label="导入结果">
        <div>
          <strong>隐私</strong>
          <span>仅保存在这个浏览器</span>
        </div>
        <div>
          <strong>完整性</strong>
          <span>每份文件都有 SHA-256</span>
        </div>
        <div>
          <strong>来源位置</strong>
          <span>PDF 产物保留文件名和页码</span>
        </div>
        <div>
          <strong>下一阶段</strong>
          <span>规则理解与游戏编译尚未接入</span>
        </div>
      </section>

      <details className="source-details">
        <summary>查看已导入文件与来源信息</summary>
        <ul>
          {run.sources.map((source) => (
            <li key={source.id}>
              <div>
                <strong>{source.name}</strong>
                <span>
                  {source.role === "rulebook" ? "规则书" : "素材"} ·{" "}
                  {source.artifacts.length} 个产物
                </span>
              </div>
              <code title={source.sha256}>SHA-256 {source.sha256.slice(0, 16)}…</code>
            </li>
          ))}
        </ul>
      </details>

      <p className="next-capability">
        文件导入已完成。Issue 03 才会把这些来源编译成游戏规则；当前不会播放假的生成动画。
      </p>
      <div className="result-actions">
        <button className="player-primary" disabled type="button">
          理解规则并搭建游戏 · 下一阶段
        </button>
        <button className="delete-run-button" onClick={onDelete} type="button">
          删除本机导入记录
        </button>
        <button className="restart-link" onClick={onBack} type="button">
          返回添加其他文件
        </button>
      </div>
    </main>
  );
}

function GeneratingScreen({
  completedStages,
}: {
  completedStages: number;
}) {
  return (
    <main className="generation-main" id="main">
      <div className="generation-intro">
        <span className="player-kicker">MANILA 示例 · 自动生成中</span>
        <h1>你先喝口水，剩下的交给我们。</h1>
        <p>这是内置来源 fixture 的流程演示，不代表真实 PDF 处理已经接入。</p>
      </div>

      <ol className="generation-list">
        {generationStages.map((stage, index) => {
          const complete = index < completedStages;
          const active = index === completedStages;
          return (
            <li className={complete ? "complete" : active ? "active" : ""} key={stage.name}>
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

      <aside className="clarification-status">
        <span aria-hidden="true">✓</span>
        <div>
          <strong>这次不需要你澄清</strong>
          <small>只有规则存在会改变玩法的关键歧义时，系统才会集中问一次。</small>
        </div>
      </aside>
    </main>
  );
}

function ReadyScreen({
  onPlay,
  onRestart,
}: {
  onPlay: () => void;
  onRestart: () => void;
}) {
  return (
    <main className="ready-main" id="main">
      <section className="ready-copy">
        <span className="ready-check" aria-hidden="true">✓</span>
        <span className="player-kicker">示例游戏已生成</span>
        <h1>《马尼拉》试玩桌已经摆好了。</h1>
        <p>
          当前可以体验三人单航次：你控制一个席位，另外两个席位由本地机器人推进。
        </p>
        <div className="ready-actions">
          <button className="player-primary" onClick={onPlay} type="button">
            进入游戏
            <span aria-hidden="true">→</span>
          </button>
          <button className="player-secondary" disabled type="button">
            创建联机房间 · 尚未接入
          </button>
        </div>
        <button className="restart-link" onClick={onRestart} type="button">
          换一份规则和素材
        </button>
      </section>

      <section className="game-preview" aria-label="生成结果">
        <img src="/manila/photos/play-1.jpg" alt="马尼拉桌游参考桌面" />
        <div className="preview-caption">
          <div>
            <span>3 人</span>
            <span>单航次</span>
            <span>本地试玩</span>
          </div>
          <h2>马尼拉</h2>
          <p>竞价、装船、航行、领航员、海盗与结算的当前部分实现。</p>
        </div>
      </section>

      <aside className="honest-boundary">
        <strong>这个切片现在真实做到哪</strong>
        <ul>
          <li className="done">玩家入口与自动生成体验壳</li>
          <li className="done">已有 Manila 单航次可玩输出</li>
          <li>真实 PDF 理解与图片生成待接入</li>
          <li>完整规则与好友联机待接入</li>
        </ul>
      </aside>
    </main>
  );
}

export function PlayerPlatformFlow() {
  const [screen, setScreen] = useState<Screen>("upload");
  const [rulebook, setRulebook] = useState<File[]>([]);
  const [assets, setAssets] = useState<File[]>([]);
  const [completedStages, setCompletedStages] = useState(0);
  const [ingestionProgress, setIngestionProgress] =
    useState<IngestionProgress>();
  const [generationRun, setGenerationRun] = useState<GenerationRun>();

  useEffect(() => {
    void getLatestGenerationRun()
      .then(setGenerationRun)
      .catch(() => {
        // The upload path still works when browser storage is unavailable; a
        // completed run will report the persistence failure instead.
      });
  }, []);

  useEffect(() => {
    if (screen !== "generating") return;
    if (completedStages >= generationStages.length) {
      const readyTimer = window.setTimeout(() => setScreen("ready"), 350);
      return () => window.clearTimeout(readyTimer);
    }
    const timer = window.setTimeout(
      () => setCompletedStages((current) => current + 1),
      650,
    );
    return () => window.clearTimeout(timer);
  }, [completedStages, screen]);

  const coverage = useMemo(
    () => ({
      compileReady: true,
      sourceSummary: "内置 8 页规则书与 7 张参考图已关联",
      componentSummary: "当前单航次所需桌面对象已生成",
      decisionSummary: "示例规则无需玩家澄清",
      assetSummary: "示例沿用来源图片；图片生成服务尚未接入",
    }),
    [],
  );

  const goHome = () => {
    setScreen("upload");
    setCompletedStages(0);
  };

  const removeRun = async (id: string) => {
    const confirmed = window.confirm(
      "永久删除这次导入的原始文件、页面预览、文字和来源记录？此操作无法撤销。",
    );
    if (!confirmed) return;
    await deleteGenerationRun(id);
    setGenerationRun(undefined);
    setScreen("upload");
  };

  const startIngestion = async () => {
    if (!rulebook[0] || assets.length === 0) return;
    setIngestionProgress(undefined);
    setScreen("ingesting");
    const run = await ingestGameSourceBundle(
      { rulebook: rulebook[0], assets },
      setIngestionProgress,
    );
    try {
      await saveGenerationRun(run);
    } catch (error) {
      run.status = "failed";
      run.error =
        `文件已读取，但无法持久保存在此浏览器：${
          error instanceof Error ? error.message : String(error)
        }`;
    }
    setGenerationRun(run);
    setScreen("ingested");
  };

  if (screen === "play") {
    return <PlayableManila coverage={coverage} onExit={() => setScreen("ready")} />;
  }

  return (
    <div className="player-platform">
      <AppHeader onHome={goHome} />
      {screen === "upload" && (
        <UploadScreen
          assets={assets}
          latestRun={generationRun}
          onDeleteRun={(id) => void removeRun(id)}
          onOpenRun={() => setScreen("ingested")}
          rulebook={rulebook}
          setAssets={setAssets}
          setRulebook={setRulebook}
          startIngestion={() => void startIngestion()}
          startExample={() => {
            setCompletedStages(0);
            setScreen("generating");
          }}
        />
      )}
      {screen === "ingesting" && (
        <IngestingScreen progress={ingestionProgress} />
      )}
      {screen === "ingested" && generationRun && (
        <IngestedScreen
          onBack={goHome}
          onDelete={() => void removeRun(generationRun.id)}
          run={generationRun}
        />
      )}
      {screen === "generating" && <GeneratingScreen completedStages={completedStages} />}
      {screen === "ready" && (
        <ReadyScreen
          onPlay={() => setScreen("play")}
          onRestart={goHome}
        />
      )}
    </div>
  );
}
