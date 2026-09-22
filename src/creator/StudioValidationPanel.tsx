import type { FormEvent, Dispatch, SetStateAction } from "react";
import type {
  DesignHypothesis,
  PlayableBuild,
  PlaytestRun,
  RuleSystem,
  SessionFeedback,
  SharedSession,
  ValidationFinding,
} from "./project-contract";
import type {
  SeatedParticipantDraft,
  ValidationEvidenceType,
} from "./studio-utils";

export type FeedbackInboxEntry = {
  session: SharedSession;
  feedback: SessionFeedback;
};

export type StudioValidationPanelProps = {
  showValidationOpen: boolean;
  setValidationOpen: (open: boolean) => void;
  unreviewedFeedbackCount: number;
  feedbackInbox: FeedbackInboxEntry[];
  feedbackFindings: Map<string, ValidationFinding>;
  builds: PlayableBuild[];
  busy: boolean;
  prepareParticipantFeedbackFinding: (
    session: SharedSession,
    feedback: SessionFeedback,
  ) => void;
  advancedValidationOpen: boolean;
  setAdvancedValidationOpen: (open: boolean) => void;
  addDesignHypothesis: (event: FormEvent) => void;
  hypothesisQuestion: string;
  setHypothesisQuestion: (value: string) => void;
  hypothesisSignal: string;
  setHypothesisSignal: (value: string) => void;
  recordValidationFinding: (event: FormEvent) => void;
  findingHypothesisId: string;
  setFindingHypothesisId: (value: string) => void;
  hypotheses: DesignHypothesis[];
  findingBuildId: string;
  setFindingBuildId: (value: string) => void;
  findingEvidenceType: ValidationEvidenceType;
  setFindingEvidenceType: (value: ValidationEvidenceType) => void;
  findingEvidenceId: string;
  setFindingEvidenceId: (value: string) => void;
  playtests: PlaytestRun[];
  sessions: SharedSession[];
  findingSeatedParticipants: SeatedParticipantDraft[];
  setFindingSeatedParticipants: Dispatch<
    SetStateAction<SeatedParticipantDraft[]>
  >;
  ruleSystem: RuleSystem;
  findingCreatorAttested: boolean;
  setFindingCreatorAttested: (value: boolean) => void;
  findingVerdict: ValidationFinding["verdict"];
  setFindingVerdict: (value: ValidationFinding["verdict"]) => void;
  findingNotes: string;
  setFindingNotes: (value: string) => void;
  findingNextChange: string;
  setFindingNextChange: (value: string) => void;
  findings: ValidationFinding[];
  copyFindingContinuation: (finding: ValidationFinding) => void;
  copiedFindingId: string;
};

export function StudioValidationPanel({
  showValidationOpen,
  setValidationOpen,
  unreviewedFeedbackCount,
  feedbackInbox,
  feedbackFindings,
  builds,
  busy,
  prepareParticipantFeedbackFinding,
  advancedValidationOpen,
  setAdvancedValidationOpen,
  addDesignHypothesis,
  hypothesisQuestion,
  setHypothesisQuestion,
  hypothesisSignal,
  setHypothesisSignal,
  recordValidationFinding,
  findingHypothesisId,
  setFindingHypothesisId,
  hypotheses,
  findingBuildId,
  setFindingBuildId,
  findingEvidenceType,
  setFindingEvidenceType,
  findingEvidenceId,
  setFindingEvidenceId,
  playtests,
  sessions,
  findingSeatedParticipants,
  setFindingSeatedParticipants,
  ruleSystem,
  findingCreatorAttested,
  setFindingCreatorAttested,
  findingVerdict,
  setFindingVerdict,
  findingNotes,
  setFindingNotes,
  findingNextChange,
  setFindingNextChange,
  findings,
  copyFindingContinuation,
  copiedFindingId,
}: StudioValidationPanelProps) {
  return (
    <details
      className="validation-workflow"
      id="validation"
      open={showValidationOpen}
      onToggle={(event) => setValidationOpen(event.currentTarget.open)}
    >
      <summary className="studio-section-heading">
        <div>
          <h2>朋友怎么说</h2>
        </div>
        <span className="validation-count">
          {unreviewedFeedbackCount ? `${unreviewedFeedbackCount} 条待看` : "可选"}
        </span>
      </summary>
      <p className="workflow-hint">
        朋友玩过之后，评论会出现在这里。这是改下一版的参考，不是这局游戏成不成功的证明。
      </p>
      <section className="feedback-inbox" aria-labelledby="feedback-inbox-title">
        <header>
          <div>
            <h3 id="feedback-inbox-title">朋友刚说的</h3>
          </div>
          <strong>{unreviewedFeedbackCount} 条还没看</strong>
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
                      ? `想听：${session.experiment.question}`
                      : "普通一局，没有指定问题"}
                  </small>
                  <div className="feedback-inbox-actions">
                    <a href={session.replayUrl}>看回放</a>
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
            <strong>还没有朋友留言。</strong>
            <p>发布邀请链接后，朋友完成一次行动就能打分和评论。</p>
            <a href="#play">去发布邀请链接</a>
          </div>
        )}
      </section>
      <details
        className="studio-optional advanced-validation"
        open={advancedValidationOpen}
        onToggle={(event) =>
          setAdvancedValidationOpen(event.currentTarget.open)
        }
      >
        <summary>高级：记下问题和结论</summary>
      <div className="validation-columns">
        <form onSubmit={addDesignHypothesis}>
          <strong>1. 写下你想听的问题</strong>
          <label htmlFor="hypothesis-question">
            <span>想听朋友说的问题</span>
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
          <strong>2. 记下这局的结论</strong>
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
            <span>对应的可玩版本</span>
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
                  ? "有反馈的那一局"
                  : "真人一起打的那一局"}
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
              {findingSeatedParticipants.length > 0 ? (
                findingSeatedParticipants.map((participant, index) => (
                  <label htmlFor={`finding-participant-${participant.seat}`} key={participant.seat}>
                    <span>座位 {participant.seat} 的姓名</span>
                    <input
                      id={`finding-participant-${participant.seat}`}
                      onChange={(event) => {
                        const name = event.currentTarget.value;
                        setFindingSeatedParticipants((current) =>
                          current.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, name } : entry,
                          ),
                        );
                      }}
                      placeholder="真实参与者姓名"
                      value={participant.name}
                    />
                  </label>
                ))
              ) : (
                <small>所选 Shared Session 还没有已认领的席位。</small>
              )}
              <small>为每个已认领席位填写姓名；自动客户端或机器人结果不得作为 Human Evidence。</small>
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
                (findingSeatedParticipants.length === 0 ||
                  findingSeatedParticipants.some((entry) => !entry.name.trim()) ||
                  !findingCreatorAttested))
            }
            type="submit"
          >
            保存结论
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
      </details>
    </details>
  );
}
