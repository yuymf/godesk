import { useEffect, useMemo, useReducer, useState } from "react";
import {
  authoringExerciseReducer,
  canCompileExercise,
  createAuthoringExerciseState,
  createDivergenceState,
  divergenceImpact,
  divergenceReducer,
  isComponentReviewComplete,
  isDivergenceBlocking,
  isSourceReviewComplete,
  type AuthoringExerciseAction,
  type AuthoringExerciseState,
  type DivergenceAction,
  type DivergenceState,
  type Interpretation,
} from "./authoring";
import {
  componentGroups,
  goods,
  phaseGraph,
  projectSummary,
  ruleFacts,
  sourcePages,
  type ReviewStatus,
} from "./project";
import { PlayableManila } from "./PlayableManila";

type Variant = "A" | "B" | "C";
type View = "author" | "play";

const variants: { id: Variant; name: string; note: string }[] = [
  { id: "A", name: "工作台", note: "来源、提取、预览并列" },
  { id: "B", name: "证据图", note: "沿引用链发现断点" },
  { id: "C", name: "向导", note: "逐关人工确认" },
];

const steps = [
  { name: "01 导入", detail: "规则书与照片" },
  { name: "02 提取", detail: "组件与规则候选" },
  { name: "03 复核", detail: "页码、冲突与置信度" },
  { name: "04 成品", detail: "生成可玩的桌" },
  { name: "05 验证", detail: "完成一整航次" },
];

const guidedSteps = [
  {
    title: "登记来源与使用边界",
    goal: "得到一组可追溯、可用于内部验证的来源材料。",
    why: "没有来源记录，后面的规则候选无法回链，成品也不能说明依据。",
    inputs: "8 页英文规则书、7 张实物照片、1 份损坏的镜像文件。",
    action: "检查文件是否可读，并确认哪些材料可用于内部验证、哪些必须拒绝。",
    consequence: "接受的材料进入提取队列；拒绝项保留记录但不会生成候选。",
    done: "每份材料都有来源、哈希、检查结果和使用边界。",
    nextLabel: "登记来源并开始提取",
  },
  {
    title: "核对组件候选",
    goal: "得到一份可以继续编译的组件清单。",
    why: "数量或类型错误会直接生成错误的棋盘、股份、伙计和货物骰。",
    inputs: "规则书 p.1–2、整桌照片、AI 提取的 7 组组件候选。",
    action: "对照来源核对关键数量，找出缺失、重复或互相矛盾的组件。",
    consequence: "确认项进入项目；有分歧的项进入人工处理队列。",
    done: "3 艘平底船、4 种货物、20 股和 20 名伙计都有来源与状态。",
    nextLabel: "完成组件核对",
  },
  {
    title: "处理规则分歧",
    goal: "决定领航员与海盗组合规则应如何进入项目。",
    why: "这个时序会改变玩家能否登船、劫掠和移动平底船，不能由 AI 猜。",
    inputs: "规则书 p.3、p.5、p.6，以及置信度 61% 的规则候选。",
    action: "打开三处来源，比较解释，明确接受、修改、拒绝或暂缓。",
    consequence: "你的决定会改变运行时阶段顺序；暂缓会阻止编译。",
    done: "候选拥有明确的人类决定，或者项目保持阻塞并说明原因。",
    nextLabel: "进入分歧处理",
  },
  {
    title: "编译可玩项目",
    goal: "把已接受的来源事实编译成可操作的单航次游戏。",
    why: "只有实际生成状态、行动和结算，才能暴露项目模型缺了什么。",
    inputs: "已接受的组件、规则事实、阶段顺序与未解决阻塞项。",
    action: "检查编译摘要，确认成品包含真人操作、自动对手、结算和重开。",
    consequence: "通过后生成一个内部试玩版本；阻塞项继续显示在覆盖报告中。",
    done: "可玩版本已生成，且没有把未解决规则或许可问题伪装成通过。",
    nextLabel: "查看试玩任务",
  },
  {
    title: "完成一整航次",
    goal: "用真人操作完成一次从放置到结算的可玩验证。",
    why: "组件清单、静态预览和自动遍历都不能证明用户真的能玩。",
    inputs: "三人单航次版本、两名自动对手、规则来源链接与覆盖报告。",
    action: "打开成品，完成 4 次放置、3 次移动、特殊行动与结算。",
    consequence: "系统记录覆盖到的规则、仍缺失的规则和本航次结果。",
    done: "出现航次结算与领先者，并且可以查看记录和重新开始。",
    nextLabel: "打开可玩成品",
  },
] as const;

function readQuery() {
  const query = new URLSearchParams(window.location.search);
  const rawVariant = query.get("variant");
  return {
    variant: rawVariant === "A" || rawVariant === "B" ? rawVariant : "C",
    view: query.get("view") === "play" || query.get("view") === "dry-run" ? "play" : "author",
    showDevVariants: query.get("devVariants") === "1",
  } as { variant: Variant; view: View; showDevVariants: boolean };
}

function setQuery(next: { variant?: Variant; view?: View }) {
  const query = new URLSearchParams(window.location.search);
  if (next.variant) query.set("variant", next.variant);
  if (next.view) query.set("view", next.view);
  window.history.replaceState({}, "", `${window.location.pathname}?${query.toString()}`);
}

function SourceAnchor({
  label,
  onOpen,
}: {
  label: string;
  onOpen?: () => void;
}) {
  return (
    <button className="source-anchor" type="button" onClick={onOpen}>
      <span aria-hidden="true">↗</span> {label}
    </button>
  );
}

function StatusPill({ status }: { status: ReviewStatus }) {
  const copy = {
    confirmed: "已确认",
    "needs-review": "待复核",
    blocked: "阻塞",
  };
  return <span className={`status-pill ${status}`}>{copy[status]}</span>;
}

function Header({
  view,
  setView,
  playableEnabled,
  blockingCount,
}: {
  view: View;
  setView: (view: View) => void;
  playableEnabled: boolean;
  blockingCount: number;
}) {
  return (
    <header className="forge-header">
      <a className="forge-brand" href="#main">
        <span>GD</span>
        <span>
          <strong>GODESK FORGE</strong>
          <small>AI 原生桌游创作验证台</small>
        </span>
      </a>
      <nav aria-label="当前项目流程">
        {steps.map((step, index) => (
          <div className={index < 3 ? "done" : index === 3 ? "active" : ""} key={step.name}>
            <b>{step.name}</b>
            <small>{step.detail}</small>
          </div>
        ))}
      </nav>
      <div className="header-actions">
        <span className="internal-label">INTERNAL ONLY</span>
        <button
          className={view === "play" ? "top-button active" : "top-button"}
          disabled={view === "author" && !playableEnabled}
          onClick={() => setView(view === "author" ? "play" : "author")}
          type="button"
        >
          {view === "author"
            ? playableEnabled
              ? "打开可玩成品"
              : `先完成 ${blockingCount} 组必需判断`
            : "返回创作台"}
        </button>
      </div>
    </header>
  );
}

function SourceRail({
  selectedPage,
  setSelectedPage,
}: {
  selectedPage: number;
  setSelectedPage: (page: number) => void;
}) {
  return (
    <aside className="source-rail" aria-label="来源材料">
      <div className="rail-heading">
        <div>
          <span className="kicker">SOURCE SET 01</span>
          <h2>规则书与实物</h2>
        </div>
        <span className="source-count">15</span>
      </div>
      <p className="fixture-warning">仅用于本次内部流程验证，不具备发布授权。</p>
      <div className="source-list">
        {sourcePages.map((source) => (
          <button
            className={selectedPage === source.page ? "source-thumb active" : "source-thumb"}
            key={source.page}
            onClick={() => setSelectedPage(source.page)}
            type="button"
          >
            <img src={source.src} alt={`规则书第 ${source.page} 页缩略图`} />
            <span>
              <b>Rulebook · {String(source.page).padStart(2, "0")}</b>
              <small>{source.page === 5 ? "海盗 / 领航员" : source.page === 2 ? "港务长 / 开局" : "已完成 OCR 与视觉检查"}</small>
            </span>
            <i>{source.page === 5 ? "!" : "✓"}</i>
          </button>
        ))}
      </div>
      <div className="photo-pair">
        <button type="button" onClick={() => setSelectedPage(2)}>
          <img src="/manila/photos/play-1.jpg" alt="马尼拉整桌参考照片" />
          <span>整桌参考</span>
        </button>
        <button type="button" onClick={() => setSelectedPage(5)}>
          <img src="/manila/photos/play-2.jpg" alt="马尼拉平底船与海盗参考照片" />
          <span>部件近照</span>
        </button>
      </div>
    </aside>
  );
}

function PaperViewer({ page }: { page: number }) {
  return (
    <section className="paper-viewer" aria-label={`规则书第 ${page} 页`}>
      <div className="viewer-toolbar">
        <span>manila-rulebook-en.pdf</span>
        <b>{page} / 8</b>
      </div>
      <div className="paper-frame">
        <img src={`/manila/rules/page-${page}.png`} alt={`Manila 英文规则书第 ${page} 页`} />
      </div>
      <footer>
        <span>SHA-256 · 9a6a02…e26f4b</span>
        <span>视觉检查 ✓</span>
      </footer>
    </section>
  );
}

function ReviewQueue({ openPage }: { openPage: (page: number) => void }) {
  return (
    <section className="review-panel">
      <div className="panel-heading">
        <div>
          <span className="kicker">EXTRACTION REVIEW</span>
          <h1>规则不是答案，是待签字的候选</h1>
        </div>
        <span className="progress-ring">{projectSummary.confirmedFacts}/9</span>
      </div>
      <p className="lead">
        AI 已把 8 页规则拆成可执行对象。你只需盯住黄色复核项和红色阻塞项。
      </p>
      <div className="fact-list">
        {ruleFacts.map((fact) => (
          <article className={`fact-card ${fact.status}`} key={fact.id}>
            <div className="fact-topline">
              <StatusPill status={fact.status} />
              <span>{Math.round(fact.confidence * 100)}% confidence</span>
            </div>
            <h3>{fact.title}</h3>
            <p>{fact.detail}</p>
            <div className="fact-actions">
              <SourceAnchor
                label={fact.anchor.label}
                onOpen={fact.anchor.page ? () => openPage(fact.anchor.page!) : undefined}
              />
              {fact.status === "needs-review" && <button type="button">打开冲突检查</button>}
              {fact.status === "blocked" && <button type="button">保留为内部夹具</button>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function TablePreview({ openPage }: { openPage: (page: number) => void }) {
  return (
    <section className="table-preview">
      <div className="preview-hero">
        <img src="/manila/photos/play-1.jpg" alt="用于桌面校准的马尼拉实物摆台照片" />
        <div className="photo-stamp">REFERENCE · NOT GENERATED</div>
        <div className="preview-copy">
          <span className="kicker">LIVE PROJECT</span>
          <h2>{projectSummary.title}</h2>
          <p>3 人验证配置 · 4 次放置 · 3 次移动</p>
        </div>
      </div>
      <div className="object-sheet">
        <div className="sheet-heading">
          <h3>生成对象清单</h3>
          <span>{componentGroups.length} 组 · 全部有来源</span>
        </div>
        {componentGroups.map((group) => (
          <article key={group.name}>
            <b>{group.count}×</b>
            <div>
              <strong>{group.name}</strong>
              <small>{group.note}</small>
            </div>
            <SourceAnchor
              label={group.anchor.label}
              onOpen={
                "page" in group.anchor
                  ? () => openPage("page" in group.anchor ? group.anchor.page : 1)
                  : undefined
              }
            />
          </article>
        ))}
      </div>
      <div className="goods-row" aria-label="四种货物">
        {goods.map((good) => (
          <div key={good.id}>
            <span style={{ background: good.color }}>{good.die}</span>
            <b>{good.name}</b>
            <small>{good.en}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function Workbench({ page, openPage }: { page: number; openPage: (page: number) => void }) {
  return (
    <main id="main" className="workbench-layout">
      <SourceRail selectedPage={page} setSelectedPage={openPage} />
      <PaperViewer page={page} />
      <ReviewQueue openPage={openPage} />
      <TablePreview openPage={openPage} />
    </main>
  );
}

function EvidenceMap({ openPage }: { openPage: (page: number) => void }) {
  return (
    <main id="main" className="map-layout">
      <header className="map-intro">
        <span className="kicker">PROVENANCE GRAPH · MANILA 0.3</span>
        <h1>任何一个“可玩对象”，都能沿线回到原始证据</h1>
        <p>这张图用来找断链：来源 → 规则事实 → 运行时对象 → 验证证据。</p>
      </header>
      <section className="evidence-map" aria-label="来源证据图">
        <div className="map-column sources">
          <h2>01 来源</h2>
          <button onClick={() => openPage(2)} type="button"><b>PDF · p.2</b><small>港务长与起航</small></button>
          <button onClick={() => openPage(3)} type="button"><b>PDF · p.3</b><small>放置与移动节奏</small></button>
          <button onClick={() => openPage(5)} type="button"><b>PDF · p.5</b><small>海盗与领航员</small></button>
          <button type="button"><b>PHOTO · play-1</b><small>桌面与组件校准</small></button>
        </div>
        <div className="map-column facts">
          <h2>02 规则事实</h2>
          {ruleFacts.slice(1, 6).map((fact) => (
            <article className={fact.status} key={fact.id}>
              <StatusPill status={fact.status} />
              <b>{fact.title}</b>
              <small>{fact.anchor.label}</small>
            </article>
          ))}
        </div>
        <div className="map-column runtime">
          <h2>03 运行时对象</h2>
          <article><span>STATE</span><b>HarborMasterAuction</b><small>赢家 / 出价 / 可买股份</small></article>
          <article><span>CONSTRAINT</span><b>StartPosition = 9</b><small>每船 ≤ 5</small></article>
          <article><span>SEQUENCE</span><b>VoyagePhase[11]</b><small>4 放置 / 3 移动</small></article>
          <article><span>TRIGGER</span><b>PirateAt13</b><small>第二轮登船 / 第三轮劫掠</small></article>
        </div>
        <div className="map-column evidence">
          <h2>04 验证证据</h2>
          <article className="ok"><b>结构测试 · 4/4</b><small>组件、节奏、回链、许可边界</small></article>
          <article className="warning"><b>组合规则 · 待跑</b><small>领航 + 多船到 13</small></article>
          <article className="blocked"><b>发布许可 · 阻塞</b><small>不影响内部流程验证</small></article>
        </div>
        <svg aria-hidden="true" className="map-lines" viewBox="0 0 1200 540" preserveAspectRatio="none">
          <path d="M220 105 C300 105 285 150 370 150 S520 190 610 190" />
          <path d="M220 205 C320 205 290 270 380 270 S510 310 610 310" />
          <path d="M220 305 C320 305 310 390 390 390 S540 430 610 430" />
          <path className="alert" d="M810 430 C910 430 900 350 1010 350" />
        </svg>
      </section>
      <div className="map-legend"><span><i />已验证路径</span><span><i />待人工确认</span><span><i />阻塞但不伪装通过</span></div>
    </main>
  );
}

function SourceReviewPanel({
  state,
  dispatch,
  openPage,
}: {
  state: AuthoringExerciseState;
  dispatch: (action: AuthoringExerciseAction) => void;
  openPage: (page: number) => void;
}) {
  const complete = isSourceReviewComplete(state);
  return (
    <section className="seeded-review source-review" aria-labelledby="source-review-title">
      <header>
        <div>
          <span className="kicker">SEEDED SOURCE CHECK · 2 REQUIRED DECISIONS</span>
          <h3 id="source-review-title">先判断哪些来源能进入项目</h3>
        </div>
        <button
          disabled={state.history.length === 0}
          onClick={() => dispatch({ type: "undo" })}
          type="button"
        >
          撤销上一个项目决定
        </button>
      </header>
      <div className="seeded-grid">
        <article className={state.rulebookAccepted ? "accepted" : "pending"}>
          <StatusPill status={state.rulebookAccepted ? "confirmed" : "needs-review"} />
          <h4>英文规则书 · 8 页</h4>
          <p>文件可读，已完成页面渲染与哈希登记。它可以作为内部规则来源。</p>
          <small>SHA-256 · 9a6a02…e26f4b</small>
          <div>
            <button onClick={() => openPage(1)} type="button">打开规则书 p.1</button>
            <button
              disabled={state.rulebookAccepted}
              onClick={() => dispatch({ type: "accept-rulebook" })}
              type="button"
            >
              {state.rulebookAccepted ? "已保留为内部来源" : "保留为内部来源"}
            </button>
          </div>
        </article>
        <article className={state.corruptMirrorRejected ? "rejected" : "pending"}>
          <StatusPill status={state.corruptMirrorRejected ? "blocked" : "needs-review"} />
          <h4>规则书镜像 · 损坏文件</h4>
          <p>下载结果无法作为 PDF 打开。拒绝它不会删除记录，系统会保留来源与哈希。</p>
          <small>SHA-256 · ab787c…117f1</small>
          <div>
            <button
              disabled={state.corruptMirrorRejected}
              onClick={() => dispatch({ type: "reject-corrupt-mirror" })}
              type="button"
            >
              {state.corruptMirrorRejected ? "已拒绝并保留记录" : "拒绝损坏来源"}
            </button>
          </div>
        </article>
        <article className="license-blocker">
          <StatusPill status="blocked" />
          <h4>素材发布授权</h4>
          <p>本次只获准做内部验证。这个阻塞不妨碍内部编译，但不能被改成“已发布授权”。</p>
          <small>固定边界 · 不提供通过按钮</small>
        </article>
      </div>
      <div className={`seeded-result ${complete ? "ready" : "blocked"}`}>
        <b>{complete ? "来源检查完成" : "还需要完成来源判断"}</b>
        <span>
          {complete
            ? "可读规则书进入提取队列；损坏镜像只保留审计记录。"
            : `待完成：${state.rulebookAccepted ? "" : "保留可读规则书 "}${state.corruptMirrorRejected ? "" : "拒绝损坏镜像"}`}
        </span>
      </div>
    </section>
  );
}

function ComponentReviewPanel({
  state,
  dispatch,
  openPage,
}: {
  state: AuthoringExerciseState;
  dispatch: (action: AuthoringExerciseAction) => void;
  openPage: (page: number) => void;
}) {
  const [assetName, setAssetName] = useState("");
  const complete = isComponentReviewComplete(state);
  return (
    <section className="seeded-review component-review" aria-labelledby="component-review-title">
      <header>
        <div>
          <span className="kicker">SEEDED COMPONENT CHECK · 3 REQUIRED DECISIONS</span>
          <h3 id="component-review-title">确认高置信候选，处理数量分歧与缺图</h3>
        </div>
        <button
          disabled={state.history.length === 0}
          onClick={() => dispatch({ type: "undo" })}
          type="button"
        >
          撤销上一个项目决定
        </button>
      </header>
      <div className="component-task-list">
        <article>
          <div>
            <StatusPill status={state.puntCandidateAccepted ? "confirmed" : "needs-review"} />
            <span>99% confidence · 规则书 p.1–2</span>
          </div>
          <h4>高置信候选：3 艘平底船</h4>
          <p>规则书清单与开局段落一致，都要求三艘不同货物的平底船。</p>
          <button
            disabled={state.puntCandidateAccepted}
            onClick={() => dispatch({ type: "accept-punt-candidate" })}
            type="button"
          >
            {state.puntCandidateAccepted ? "已接受 3 艘平底船" : "接受组件候选"}
          </button>
        </article>
        <article>
          <div>
            <StatusPill status={state.componentCountDecision === "rulebook-20" ? "confirmed" : "needs-review"} />
            <span>视觉提取与文字来源不一致</span>
          </div>
          <h4>组件分歧：伙计数量是 16 还是 20？</h4>
          <p>照片裁切中只识别到 16 枚，规则书 p.1 明确列出 20 枚。选择没有文字锚点的 16 会保持阻塞。</p>
          <div className="component-choice-row">
            <button
              className={state.componentCountDecision === "rulebook-20" ? "selected" : ""}
              onClick={() => dispatch({ type: "choose-component-count", decision: "rulebook-20" })}
              type="button"
            >
              采用规则书：20 枚
            </button>
            <button
              className={state.componentCountDecision === "photo-16" ? "selected risky" : "risky"}
              onClick={() => dispatch({ type: "choose-component-count", decision: "photo-16" })}
              type="button"
            >
              采用照片识别：16 枚
            </button>
            <button onClick={() => openPage(1)} type="button">打开规则书 p.1</button>
          </div>
        </article>
        <article>
          <div>
            <StatusPill status={state.missingAssetDecision === "pending" ? "blocked" : "confirmed"} />
            <span>缺少组件资产 · 港口/船厂高清裁切</span>
          </div>
          <h4>决定缺图如何进入内部版本</h4>
          <p>可以附加替代素材，也可以明确使用内部占位图；两种选择都不会解除发布许可阻塞。</p>
          <div className="asset-resolution">
            <button
              className={state.missingAssetDecision === "internal-placeholder" ? "selected" : ""}
              onClick={() => dispatch({ type: "use-internal-placeholder" })}
              type="button"
            >
              使用内部占位并保留阻塞
            </button>
            <label>
              <span>替代素材名称</span>
              <input
                onChange={(event) => setAssetName(event.target.value)}
                placeholder="例如：port-reference.png"
                value={assetName}
              />
            </label>
            <button
              disabled={!assetName.trim()}
              onClick={() => dispatch({ type: "attach-asset", asset: assetName })}
              type="button"
            >
              附加替代素材
            </button>
          </div>
          {state.attachedAsset && <small>已附加：{state.attachedAsset}</small>}
        </article>
      </div>
      <div className={`seeded-result ${complete ? "ready" : "blocked"}`}>
        <b>{complete ? "组件核对完成" : "组件项目仍不完整"}</b>
        <span>
          {complete
            ? "组件候选、来源优先的数量决定和缺图处理都已写入项目。"
            : "必须接受高置信候选、采用有文字锚点的 20 枚伙计，并处理缺图。"}
        </span>
      </div>
    </section>
  );
}

function DivergenceDecisionPanel({
  state,
  dispatch,
  page,
  openPage,
}: {
  state: DivergenceState;
  dispatch: (action: DivergenceAction) => void;
  page: number;
  openPage: (page: number) => void;
}) {
  const [editText, setEditText] = useState(state.candidateText);
  const [replacementSource, setReplacementSource] = useState("");
  const [showImpact, setShowImpact] = useState(false);
  const choose = (interpretation: Interpretation) =>
    dispatch({ type: "choose-interpretation", interpretation });
  return (
    <section className="divergence-card" aria-labelledby="divergence-title">
      <div className="divergence-heading">
        <div>
          <StatusPill status={isDivergenceBlocking(state) ? "needs-review" : "confirmed"} />
          <span>AI 置信度 61% · 因来源措辞冲突而标记</span>
        </div>
        <button
          disabled={state.history.length === 0}
          onClick={() => dispatch({ type: "undo" })}
          type="button"
        >
          撤销上一步决定
        </button>
      </div>
      <h3 id="divergence-title">领航员把船移到 13 时，海盗是否立刻攻击？</h3>
      <p className="divergence-reason">
        p.5 的概括写着“停在 13 的船会被攻击”，p.6 又明确说明领航员移动到
        13 时海盗不会行动。AI 候选只保留了前一句，需要你决定运行时采用哪条。
      </p>
      <div className="source-tabs" aria-label="分歧来源">
        {[3, 5, 6].map((item) => (
          <button
            className={page === item ? "active" : ""}
            key={item}
            onClick={() => openPage(item)}
            type="button"
          >
            打开规则书 p.{item}
          </button>
        ))}
        {state.replacementSource && <span>补充来源：{state.replacementSource}</span>}
      </div>
      <div className="interpretation-grid">
        <button
          className={state.decision.status === "accepted" && state.decision.interpretation === "A" ? "selected" : ""}
          onClick={() => choose("A")}
          type="button"
        >
          <b>采用解释 A · 来源优先</b>
          <span>领航员移动到 13 不触发海盗；只在骰子移动轮结束后检查。</span>
          <small>依据：规则书 p.5–6</small>
        </button>
        <button
          className={state.decision.status === "accepted" && state.decision.interpretation === "B" ? "selected risky" : "risky"}
          onClick={() => choose("B")}
          type="button"
        >
          <b>采用解释 B · AI 候选</b>
          <span>船以任何方式到达 13 都立刻触发海盗，包括领航员移动。</span>
          <small>风险：与 p.6 的例外说明冲突</small>
        </button>
      </div>
      <div className="decision-tools">
        <button onClick={() => dispatch({ type: "accept-candidate" })} type="button">
          接受当前 AI 候选
        </button>
        <button onClick={() => dispatch({ type: "reject" })} type="button">
          拒绝候选并保留阻塞
        </button>
        <button onClick={() => dispatch({ type: "mark-unresolved" })} type="button">
          标记未解决并阻止编译
        </button>
        <button onClick={() => setShowImpact((value) => !value)} type="button">
          {showImpact ? "收起运行时预览" : "预览运行时变化"}
        </button>
      </div>
      <div className="edit-decision">
        <label>
          <span>编辑规则后接受</span>
          <textarea
            onChange={(event) => setEditText(event.target.value)}
            rows={3}
            value={editText}
          />
        </label>
        <button
          disabled={!editText.trim()}
          onClick={() => dispatch({ type: "edit-and-accept", text: editText })}
          type="button"
        >
          保存编辑并接受
        </button>
      </div>
      <div className="replace-source">
        <label>
          <span>补充或替换来源</span>
          <input
            onChange={(event) => setReplacementSource(event.target.value)}
            placeholder="例如：designer-clarification.md"
            value={replacementSource}
          />
        </label>
        <button
          disabled={!replacementSource.trim()}
          onClick={() => dispatch({ type: "replace-source", source: replacementSource })}
          type="button"
        >
          附加这个来源
        </button>
      </div>
      <div className={`decision-result ${isDivergenceBlocking(state) ? "blocked" : "accepted"}`} aria-live="polite">
        <b>{isDivergenceBlocking(state) ? "项目仍被阻塞" : "已形成可编译的人类决定"}</b>
        <p>{state.decision.summary}</p>
        {showImpact && <p><strong>运行时预览：</strong>{divergenceImpact(state)}</p>}
      </div>
    </section>
  );
}

function GuidedImport({
  page,
  openPage,
  onDryRun,
  divergence,
  dispatchDivergence,
  exercise,
  dispatchExercise,
}: {
  page: number;
  openPage: (page: number) => void;
  onDryRun: () => void;
  divergence: DivergenceState;
  dispatchDivergence: (action: DivergenceAction) => void;
  exercise: AuthoringExerciseState;
  dispatchExercise: (action: AuthoringExerciseAction) => void;
}) {
  const [step, setStep] = useState(0);
  const current = guidedSteps[step];
  const divergenceBlocking = isDivergenceBlocking(divergence);
  const sourceReady = isSourceReviewComplete(exercise);
  const componentReady = isComponentReviewComplete(exercise);
  const compileReady = canCompileExercise(exercise, divergence);
  const stepEnabled = (index: number) => {
    if (index === 0) return true;
    if (index === 1) return sourceReady;
    if (index === 2) return sourceReady && componentReady;
    return compileReady;
  };
  return (
    <main id="main" className="guide-layout">
      <aside>
        <span className="kicker">CURRENT PROJECT · MANILA 0.4</span>
        <h1>把来源变成<br />可追溯的可玩版本</h1>
        <div className="guide-objective">
          <b>最终产物</b>
          <p>一个能完成单航次、每条规则都能回到来源、未解决问题不会被跳过的内部试玩版本。</p>
        </div>
        <ol>
          {steps.map((item, index) => (
            <li className={index < step ? "done" : index === step ? "active" : ""} key={item.name}>
              <button
                aria-current={index === step ? "step" : undefined}
                disabled={!stepEnabled(index)}
                onClick={() => setStep(index)}
                type="button"
              >
                <span>{index < step ? "✓" : index + 1}</span>
                <div><b>{item.name.slice(3)}</b><small>{item.detail}</small></div>
              </button>
            </li>
          ))}
        </ol>
      </aside>
      <section aria-live="polite" className="guide-main">
        <div className="guide-question">
          <div className="guide-progress-line">
            <span>当前步骤 {step + 1} / 5</span>
            <span>
              待处理 {[!sourceReady, !componentReady, divergenceBlocking].filter(Boolean).length} · 发布阻塞 1
            </span>
          </div>
          <h2>{current.title}</h2>
          <p>{current.goal}</p>
          <dl className="step-contract">
            <div>
              <dt>为什么现在做</dt>
              <dd>{current.why}</dd>
            </div>
            <div>
              <dt>本步输入</dt>
              <dd>{current.inputs}</dd>
            </div>
            <div className="required">
              <dt>你要做什么</dt>
              <dd>{current.action}</dd>
            </div>
            <div>
              <dt>这会改变什么</dt>
              <dd>{current.consequence}</dd>
            </div>
            <div className="done">
              <dt>什么时候算完成</dt>
              <dd>{current.done}</dd>
            </div>
          </dl>
        </div>
        <div className="guide-proof">
          {step === 0 ? (
            <SourceReviewPanel
              dispatch={dispatchExercise}
              openPage={openPage}
              state={exercise}
            />
          ) : step === 1 ? (
            <ComponentReviewPanel
              dispatch={dispatchExercise}
              openPage={openPage}
              state={exercise}
            />
          ) : step === 2 ? (
            <>
              <PaperViewer page={page} />
              <DivergenceDecisionPanel
                dispatch={dispatchDivergence}
                openPage={openPage}
                page={page}
                state={divergence}
              />
            </>
          ) : step >= 3 ? (
            <section className="playable-artifact">
              <div className="artifact-board">
                <div className="artifact-badge">PLAYABLE BUILD · READY</div>
                {goods.slice(0, 3).map((good, index) => (
                  <div className="artifact-lane" key={good.id}>
                    <span style={{ background: good.color }}>{good.name}</span>
                    <div>{Array.from({ length: 14 }, (_, item) => <i className={item === 12 ? "danger" : ""} key={item} />)}</div>
                    <b style={{ left: `${[28, 21, 14][index]}%`, background: good.color }}>船</b>
                  </div>
                ))}
                <div className="artifact-zones">
                  <span>平底船</span><span>港口</span><span>船厂</span><span>海盗</span><span>领航员</span><span>保险</span>
                </div>
              </div>
              <div className="artifact-copy">
                <span className="kicker">GENERATED OUTPUT</span>
                <h3>三人单航次试玩桌</h3>
                <p>这不是组件清单。它包含真人决策、两个自动对手、4 轮伙计放置、3 次掷骰移动、特殊行动、分钱与胜负结算。</p>
                <p className="compiled-decision"><b>已编译的人类决定：</b>{divergence.decision.summary}</p>
                <ul>
                  <li><b>12</b><span>次伙计放置</span></li>
                  <li><b>3</b><span>次真实掷骰</span></li>
                  <li><b>1</b><span>完整航次闭环</span></li>
                </ul>
                <button className="primary-action artifact-play" onClick={onDryRun} type="button">现在开桌试玩 →</button>
              </div>
              <section className="coverage-report" aria-labelledby="coverage-report-title">
                <header>
                  <div>
                    <span className="kicker">VALIDATION COVERAGE</span>
                    <h4 id="coverage-report-title">编译覆盖与剩余缺口</h4>
                  </div>
                  <span>内部试玩可用 · 发布仍阻塞</span>
                </header>
                <div>
                  <article className="covered"><b>来源质量</b><span>可读规则书已接受；损坏镜像已拒绝</span></article>
                  <article className="covered"><b>高置信候选</b><span>3 艘平底船已接受</span></article>
                  <article className="covered"><b>组件分歧</b><span>采用规则书锚点：20 枚伙计</span></article>
                  <article className="covered"><b>低置信规则</b><span>{divergence.decision.summary}</span></article>
                  <article className="warning"><b>缺少资产</b><span>{exercise.attachedAsset ? `使用替代素材 ${exercise.attachedAsset}` : "使用内部占位图"}</span></article>
                  <article className="warning"><b>运行时未支持</b><span>完整贷款、保险破产兜底、盲客与多航次终局</span></article>
                  <article className="blocked"><b>发布许可</b><span>内部验证许可不会自动变成商业发布授权</span></article>
                </div>
              </section>
            </section>
          ) : (
            <TablePreview openPage={openPage} />
          )}
        </div>
        <footer>
          <button disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))} type="button">上一步</button>
          {step === 0 ? (
            <button
              className="primary-action"
              disabled={!sourceReady}
              onClick={() => setStep(1)}
              type="button"
            >
              {sourceReady ? "完成来源检查，进入组件核对" : "先完成 2 个来源判断"}
            </button>
          ) : step === 1 ? (
            <button
              className="primary-action"
              disabled={!componentReady}
              onClick={() => setStep(2)}
              type="button"
            >
              {componentReady ? "完成组件核对，进入规则分歧" : "先完成 3 个组件判断"}
            </button>
          ) : step === 4 ? (
            <button className="primary-action" onClick={onDryRun} type="button">打开可玩成品</button>
          ) : step === 2 ? (
            <button
              className="primary-action"
              disabled={divergenceBlocking}
              onClick={() => setStep(3)}
              type="button"
            >
              {divergenceBlocking ? "先处理分歧才能编译" : "应用人类决定并生成项目"}
            </button>
          ) : (
            <button className="primary-action" onClick={() => setStep((value) => Math.min(4, value + 1))} type="button">{current.nextLabel}</button>
          )}
        </footer>
      </section>
    </main>
  );
}

function DryRun({ onBack, openPage }: { onBack: () => void; openPage: (page: number) => void }) {
  const [phase, setPhase] = useState(0);
  const [selectedGoods, setSelectedGoods] = useState<string[]>(["nutmeg", "silk", "ginseng"]);
  const [positions, setPositions] = useState<Record<string, number>>({
    nutmeg: 3,
    silk: 3,
    ginseng: 3,
    jade: 3,
  });
  const active = phaseGraph[phase];
  const loadedGoods = goods.filter((good) => selectedGoods.includes(good.id));
  const positionTotal = loadedGoods.reduce((sum, good) => sum + positions[good.id], 0);
  const setupValid =
    loadedGoods.length === 3 &&
    positionTotal === 9 &&
    loadedGoods.every((good) => positions[good.id] <= 5);
  const toggleGood = (goodId: string) => {
    setSelectedGoods((current) =>
      current.includes(goodId)
        ? current.filter((id) => id !== goodId)
        : current.length < 3
          ? [...current, goodId]
          : current,
    );
  };
  return (
    <main id="main" className="dry-run">
      <header>
        <div>
          <span className="kicker">VALIDATION RUN · VOYAGE 01</span>
          <h1>不是“像马尼拉”，而是逐条跑《马尼拉》</h1>
          <p>本台只验证已提取规则和对象编排；没有覆盖的规则会明确留空。</p>
        </div>
        <button onClick={onBack} type="button">退出验证</button>
      </header>
      <section className="run-grid">
        <div className="run-board">
          <img src="/manila/photos/play-1.jpg" alt="马尼拉实物摆台照片，用作验证参照" />
          <div className="board-overlay">
            <span>实物校准层</span>
            <b>当前：{active.label}</b>
          </div>
          <div className="start-controls">
            <div><b>装船与起航位置</b><span className={setupValid ? "valid" : "invalid"}>已选 {loadedGoods.length}/3 · 合计 {positionTotal}/9</span></div>
            <div className="cargo-picker" aria-label="选择三种装船货物">
              {goods.map((good) => (
                <button
                  aria-pressed={selectedGoods.includes(good.id)}
                  key={good.id}
                  onClick={() => toggleGood(good.id)}
                  style={{ borderColor: selectedGoods.includes(good.id) ? good.color : undefined }}
                  type="button"
                >
                  <span style={{ background: good.color }} />
                  {good.name}
                </button>
              ))}
            </div>
            {loadedGoods.map((good) => (
              <label key={good.id}>
                <span style={{ background: good.color }} />
                {good.name}
                <input
                  aria-label={`${good.name}起航位置`}
                  max="5"
                  min="0"
                  onChange={(event) =>
                    setPositions((current) => ({
                      ...current,
                      [good.id]: Number(event.target.value),
                    }))
                  }
                  type="number"
                  value={positions[good.id]}
                />
              </label>
            ))}
            <SourceAnchor label="起点约束 · p.2" onOpen={() => openPage(2)} />
          </div>
        </div>
        <aside className="run-inspector">
          <div className="run-status">
            <span>{phase + 1} / {phaseGraph.length}</span>
            <h2>{active.label}</h2>
            <SourceAnchor label={`规则书 ${active.anchor}`} onOpen={() => openPage(Number(active.anchor.match(/\d+/)?.[0] ?? 2))} />
          </div>
          <ol className="phase-list">
            {phaseGraph.map((item, index) => (
              <li className={index < phase ? "done" : index === phase ? "active" : ""} key={item.id}>
                <button onClick={() => setPhase(index)} type="button">
                  <span>{index < phase ? "✓" : String(index + 1).padStart(2, "0")}</span>
                  <div><b>{item.label}</b><small>{item.anchor}</small></div>
                </button>
              </li>
            ))}
          </ol>
          <div className="run-note">
            <b>本阶段判定</b>
            <p>{phase === 0 ? "记录竞标赢家与金额；胜者成为港务长。" : phase === 1 ? "选择 3 种货物；起点总和 9，单船不超过 5。" : phase === 6 ? "只对第二次移动后恰停 13 的船开放海盗登船。" : phase === 8 ? "先执行大小领航员，再进行第三次移动。" : "按阶段图记录操作与结果，保留规则页回链。"}</p>
          </div>
          <button className="primary-action" disabled={phase === 1 && !setupValid} onClick={() => setPhase((value) => Math.min(phaseGraph.length - 1, value + 1))} type="button">
            {phase === phaseGraph.length - 1 ? "本航次阶段已跑完" : "确认本阶段并继续"}
          </button>
        </aside>
      </section>
      <section className="coverage-strip">
        <div><b>已结构化</b><strong>8</strong><span>条核心事实</span></div>
        <div><b>已验证</b><strong>{phase}</strong><span>个阶段</span></div>
        <div className="warning"><b>待人工</b><strong>1</strong><span>组合边界</span></div>
        <div className="blocked"><b>明确未做</b><strong>4</strong><span>贷款、保险全结算、盲客、完整胜负</span></div>
      </section>
    </main>
  );
}

function VariantSwitcher({ variant, onChange }: { variant: Variant; onChange: (variant: Variant) => void }) {
  return (
    <div className="variant-switcher" aria-label="原型设计切换">
      <span>DEV PROTOTYPES</span>
      {variants.map((item) => (
        <button className={variant === item.id ? "active" : ""} key={item.id} onClick={() => onChange(item.id)} type="button" title={item.note}>
          <b>{item.id}</b> {item.name}
        </button>
      ))}
      <small>← → 切换</small>
    </div>
  );
}

export function CreationPrototype() {
  const initial = useMemo(readQuery, []);
  const [variant, setVariantState] = useState<Variant>(initial.variant);
  const [view, setViewState] = useState<View>(initial.view);
  const [page, setPage] = useState(5);
  const [divergence, dispatchDivergence] = useReducer(
    divergenceReducer,
    undefined,
    createDivergenceState,
  );
  const [exercise, dispatchExercise] = useReducer(
    authoringExerciseReducer,
    undefined,
    createAuthoringExerciseState,
  );
  const setVariant = (next: Variant) => {
    setVariantState(next);
    setQuery({ variant: next });
  };
  const setView = (next: View) => {
    setViewState(next);
    setQuery({ view: next });
  };
  useEffect(() => {
    if (!initial.showDevVariants) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const index = variants.findIndex((item) => item.id === variant);
      const delta = event.key === "ArrowRight" ? 1 : -1;
      setVariant(variants[(index + delta + variants.length) % variants.length].id);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [initial.showDevVariants, variant]);

  const openPage = (next: number) => {
    setPage(next);
    if (variant === "B") setVariant("A");
  };

  return (
    <div className={`creation-app variant-${variant.toLowerCase()}`}>
      <Header
        blockingCount={[
          !isSourceReviewComplete(exercise),
          !isComponentReviewComplete(exercise),
          isDivergenceBlocking(divergence),
        ].filter(Boolean).length}
        playableEnabled={canCompileExercise(exercise, divergence)}
        setView={setView}
        view={view}
      />
      {view === "play" ? (
        <PlayableManila
          coverage={{
            assetSummary:
              exercise.missingAssetDecision === "attached"
                ? `已附加 ${exercise.attachedAsset}`
                : exercise.missingAssetDecision === "internal-placeholder"
                  ? "使用内部占位图，发布阻塞保留"
                  : "缺少港口/船厂高清裁切",
            compileReady: canCompileExercise(exercise, divergence),
            componentSummary: isComponentReviewComplete(exercise)
              ? "3 艘平底船、20 枚伙计与缺图处理已确认"
              : "组件核对尚未完成",
            decisionSummary: divergence.decision.summary,
            sourceSummary: isSourceReviewComplete(exercise)
              ? "可读规则书已接受；损坏镜像已拒绝"
              : "来源质量检查尚未完成",
          }}
          onExit={() => setView("author")}
        />
      ) : variant === "A" ? (
        <Workbench page={page} openPage={openPage} />
      ) : variant === "B" ? (
        <EvidenceMap openPage={openPage} />
      ) : (
        <GuidedImport
          dispatchExercise={dispatchExercise}
          dispatchDivergence={dispatchDivergence}
          divergence={divergence}
          exercise={exercise}
          onDryRun={() => setView("play")}
          openPage={openPage}
          page={page}
        />
      )}
      {import.meta.env.DEV && initial.showDevVariants && <VariantSwitcher variant={variant} onChange={setVariant} />}
    </div>
  );
}
