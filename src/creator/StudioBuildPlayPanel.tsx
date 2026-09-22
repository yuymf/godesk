import type { FormEvent, Dispatch, SetStateAction } from "react";
import type {
  DesignHypothesis,
  GenerationPlan,
  PlayableBuild,
  PlaytestLink,
  PlaytestRun,
  RuleSystem,
  SharedSession,
  ValidationFinding,
} from "./project-contract";
import {
  buildCanOpenSharedSession,
  playtestOutcome,
  sameRuleSystemContent,
  signedDelta,
} from "./studio-utils";
import type { StudioHobbyistFocus } from "./studio-panel-types";

export type StudioPlayTarget = {
  build?: PlayableBuild;
  session?: SharedSession;
};

export type StudioBuildComparison = {
  baselineBuild: PlayableBuild;
  baselinePlaytest: PlaytestRun;
  candidateBuild: PlayableBuild;
  candidatePlaytest: PlaytestRun;
};

export type StudioBuildPlayPanelProps = {
  hobbyistFocus: StudioHobbyistFocus;
  canPlayLatest: boolean;
  busy: boolean;
  ruleSystemDirty: boolean;
  sourceDraft: string;
  generationPlan: GenerationPlan | null;
  buildPlayable: () => void;
  iterateFromPrompt: (event: FormEvent) => void;
  iterationPrompt: string;
  setIterationPrompt: (value: string) => void;
  findings: ValidationFinding[];
  iterationFindingId: string;
  setIterationFindingId: (value: string) => void;
  builds: PlayableBuild[];
  studioPlayTarget: StudioPlayTarget;
  startRoom: (build: PlayableBuild, destination?: "room" | "studio") => void;
  playtestLink: PlaytestLink | null;
  copyPlaytestLink: () => void;
  playtestLinkCopied: boolean;
  publishPlaytest: (build: PlayableBuild) => void;
  humanFinding: ValidationFinding | undefined;
  canAttestHuman: boolean;
  friendSession: SharedSession | undefined;
  attestHumanSession: () => void;
  humanNames: Record<number, string>;
  setHumanNames: Dispatch<SetStateAction<Record<number, string>>>;
  humanAttested: boolean;
  setHumanAttested: (value: boolean) => void;
  buildComparison: StudioBuildComparison | undefined;
  buildComparisonFinding: ValidationFinding | undefined;
  hypotheses: DesignHypothesis[];
  sessionHypothesisId: string;
  setSessionHypothesisId: (value: string) => void;
  ruleSystem: RuleSystem;
  restoreBuildVersion: (build: PlayableBuild) => void;
  exportBuild: (build: PlayableBuild) => void;
  startBotPlaytest: (build: PlayableBuild) => void;
};

export function StudioBuildPlayPanel({
  hobbyistFocus,
  canPlayLatest,
  busy,
  ruleSystemDirty,
  sourceDraft,
  generationPlan,
  buildPlayable,
  iterateFromPrompt,
  iterationPrompt,
  setIterationPrompt,
  findings,
  iterationFindingId,
  setIterationFindingId,
  builds,
  studioPlayTarget,
  startRoom,
  playtestLink,
  copyPlaytestLink,
  playtestLinkCopied,
  publishPlaytest,
  humanFinding,
  canAttestHuman,
  friendSession,
  attestHumanSession,
  humanNames,
  setHumanNames,
  humanAttested,
  setHumanAttested,
  buildComparison,
  buildComparisonFinding,
  hypotheses,
  sessionHypothesisId,
  setSessionHypothesisId,
  ruleSystem,
  restoreBuildVersion,
  exportBuild,
  startBotPlaytest,
}: StudioBuildPlayPanelProps) {
  return (
    <section className={`build-workflow ${hobbyistFocus === "play" ? "studio-secondary-panel" : ""}`} id="builds">
      <header className="studio-section-heading">
        <div>
          <h2>{canPlayLatest ? "再出一版" : "做成可玩版本"}</h2>
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
          {busy ? "正在处理…" : "生成新版本"}
        </button>
      </header>
      {(ruleSystemDirty || sourceDraft.trim()) && (
        <p className="workflow-hint">请先保存上方更改，再生成新的可玩版本。</p>
      )}
      {generationPlan?.status === "pending" && (
        <p className="workflow-hint">请先确认这一局怎么玩，再生成可玩版本。</p>
      )}

      <section className="iteration-panel" id="iteration" aria-labelledby="iteration-title">
        <header>
          <div>
            <h3 id="iteration-title">下一版想改什么？</h3>
            <p>像聊天一样写一句改动。出下一版之后就能马上开玩。</p>
          </div>
        </header>
        <form onSubmit={iterateFromPrompt}>
          <label className="ruleSystem-field" htmlFor="iteration-prompt">
            <span>下一版改动</span>
            <textarea
              id="iteration-prompt"
              maxLength={2000}
              onChange={(event) => setIterationPrompt(event.currentTarget.value)}
              placeholder="例如：把行动 2 改成先说明新约束，再加 2 分。"
              rows={3}
              value={iterationPrompt}
            />
            <small>一次只改一件事。说不清楚的数值或胜负条件不会被写入。</small>
          </label>
          {findings.length > 0 && (
          <label className="ruleSystem-field" htmlFor="iteration-finding">
            <span>关联一条试玩结论 <small>可选</small></span>
            <select
              id="iteration-finding"
              onChange={(event) => setIterationFindingId(event.currentTarget.value)}
              value={iterationFindingId}
            >
              <option value="">不绑定</option>
              {[...findings].reverse().map((finding) => (
                <option key={finding.id} value={finding.id}>
                  {finding.nextChange.slice(0, 72)}
                </option>
              ))}
            </select>
          </label>
          )}
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
              {busy ? "正在改下一版…" : "改下一版并试玩"}
            </button>
            {builds.length === 0 && generationPlan?.status !== "pending" && (
              <small>先做成可玩版本，才能改下一版。</small>
            )}
            {generationPlan?.status === "pending" && (
              <small>先确认这一局怎么玩。</small>
            )}
          </div>
        </form>
      </section>

      {studioPlayTarget.build && !buildCanOpenSharedSession(studioPlayTarget.build) && (
        <section className="studio-play-gap" id="play-gap">
          <h3>这一版还不能分享</h3>
          <p>
            {studioPlayTarget.build.playabilityFloor.status === "failed"
              ? studioPlayTarget.build.playabilityFloor.reason
              : studioPlayTarget.build.presentationFloor.status === "failed"
                ? studioPlayTarget.build.presentationFloor.reason
                : "还没有可执行内核，不能把未完成的规则当作可玩成品分享。"}
          </p>
          <p>这一版已经留下。把核心玩法补齐之后，再发给朋友。</p>
        </section>
      )}

      {studioPlayTarget.build && buildCanOpenSharedSession(studioPlayTarget.build) && (
        <section className="studio-play" id="play" aria-labelledby="studio-play-title">
          <header>
            <div>
              <h3 id="studio-play-title">现在就开玩</h3>
              <p>自己先试一局。朋友只能走已发布的邀请链接，不会自动进入你刚开的这一局。</p>
            </div>
            <div>
              <button
                disabled={busy}
                onClick={() => startRoom(studioPlayTarget.build!, "studio")}
                type="button"
              >
                {studioPlayTarget.session ? "新开一局" : "开始试玩"}
              </button>
              {studioPlayTarget.session && (
                <a href={studioPlayTarget.session.sessionUrl}>独立打开这一局</a>
              )}
            </div>
          </header>
          <div className="playtest-publish">
            <div>
              <strong>
                {playtestLink
                  ? playtestLink.buildId === studioPlayTarget.build.id
                    ? "朋友入口指向这一版"
                    : "朋友入口还停在旧版"
                  : "还没有发给朋友的固定链接"}
              </strong>
              <small>
                发布后朋友永远打开同一条链接。旧对局不会被改掉。
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
                  {playtestLinkCopied ? "已复制" : "复制邀请链接"}
                </button>
              )}
              <button
                disabled={busy}
                onClick={() => void publishPlaytest(studioPlayTarget.build!)}
                type="button"
              >
                {playtestLink ? "改成这一版给朋友" : "发布邀请链接"}
              </button>
            </div>
          </div>
          {studioPlayTarget.session ? (
            <iframe
              allow="clipboard-write"
              key={studioPlayTarget.session.id}
              src={studioPlayTarget.session.sessionUrl}
              title={`${studioPlayTarget.build.ruleSystem.name} 试玩`}
            />
          ) : (
            <div className="studio-play-empty">
              <strong>这一版还没有开局。</strong>
              <p>点「开始试玩」后即可在这里落座和行动。朋友只能使用已发布的邀请链接。</p>
            </div>
          )}
          {(humanFinding || canAttestHuman) && friendSession && (
            <details className="studio-optional" id="human-attest">
              <summary>高级：记下这是真人局</summary>
              {humanFinding && (
                <p className="human-attest-done" role="status">
                  已记下：这是真人一起打的一局。
                  <code className="human-attest-id">{humanFinding.id}</code>
                  <code className="human-attest-session">{friendSession.id}</code>
                  <code className="human-attest-replay">{friendSession.replayId}</code>
                  <code className="human-attest-hypothesis">{humanFinding.hypothesisId}</code>
                </p>
              )}
              {canAttestHuman && (
                <form
                  className="human-attest"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void attestHumanSession();
                  }}
                >
                  <strong>这局是朋友一起打的？</strong>
                  <p>固定邀请链接上已经有两位玩家各走了一步。写下称呼并确认后记下。</p>
                  {friendSession.seats.map((seat) => (
                    <label key={seat.seat}>
                      <span>座位 {seat.seat} 的称呼</span>
                      <input
                        aria-label={`座位 ${seat.seat} 的称呼`}
                        onChange={(event) => {
                          const name = event.currentTarget.value;
                          setHumanNames((current) => ({ ...current, [seat.seat]: name }));
                        }}
                        placeholder={`玩家 ${seat.seat}`}
                        value={humanNames[seat.seat] ?? ""}
                      />
                    </label>
                  ))}
                  <label className="human-attest-check">
                    <input
                      aria-label="我确认这两位是真人"
                      checked={humanAttested}
                      onChange={(event) => setHumanAttested(event.currentTarget.checked)}
                      type="checkbox"
                    />
                    <span>我确认这两位是真人，不是脚本或机器人。</span>
                  </label>
                  <button disabled={busy || !humanAttested} type="submit">
                    记下这是真人局
                  </button>
                </form>
              )}
            </details>
          )}
        </section>
      )}

      {buildComparison && (
        <details className="studio-optional build-comparison" aria-labelledby="build-comparison-title">
          <summary>
            <span>高级：同种子自动试玩对比</span>
            <code>seed {buildComparison.candidatePlaytest.seed}</code>
          </summary>
          <header>
            <div>
              <h3 id="build-comparison-title">最新两个版本对比</h3>
            </div>
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
                <a href={playtest.replayUrl}>打开回放</a>
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
            <small>这是同种子自动试玩对比，不是朋友真的觉得更好。</small>
          </footer>
        </details>
      )}

      {builds.length > 0 ? (
        <>
        {hypotheses.length > 0 && (
        <details className="studio-optional">
          <summary>高级：开局时绑定一个问题</summary>
          <label className="session-hypothesis-selector">
            <span>这局想特别听朋友说什么？</span>
            <select
              disabled={busy}
              onChange={(event) =>
                setSessionHypothesisId(event.currentTarget.value)}
              value={sessionHypothesisId}
            >
              <option value="">先玩着看，不绑定问题</option>
              {hypotheses.map((hypothesis) => (
                <option key={hypothesis.id} value={hypothesis.id}>
                  {hypothesis.question}
                </option>
              ))}
            </select>
          </label>
        </details>
        )}
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
                    onClick={() => window.location.assign(build.playableUrl)}
                    type="button"
                  >
                      打开预览
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => exportBuild(build)}
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
                      disabled={busy || !buildCanOpenSharedSession(build)}
                      onClick={() => startRoom(build)}
                      type="button"
                    >
                      单独开一局
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
  );
}
