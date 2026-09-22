import { useEffect, useState } from "react";
import { getBuild, getReplay } from "./project-api";
import type { GameReplay, PlayableBuild } from "./project-contract";
import type { HarborVoyageState } from "../runtime/harbor-voyage";
import { HarborVoyageBoard } from "./HarborVoyageBoard";
import { readShareToken, validationStudioHref } from "./studio-utils";

export function ReplayView({ replayId }: { replayId: string }) {
  const [replay, setReplay] = useState<GameReplay>();
  const [build, setBuild] = useState<PlayableBuild>();
  const [error, setError] = useState("");
  const shareToken = readShareToken();

  useEffect(() => {
    getReplay(replayId, shareToken)
      .then(async (record) => {
        try {
          setBuild(await getBuild(record.buildId, shareToken));
        } catch {
          setBuild(undefined);
        }
        setReplay(record);
      })
      .catch((reason: Error) => {
        setError(reason.message);
      });
  }, [replayId, shareToken]);

  if (error) {
    return (
      <main className="studio-status" id="main">
        <h1>这一局回放打不开。</h1>
        <p role="alert">{error}</p>
      </main>
    );
  }
  if (!replay) {
    return (
      <main className="studio-status" id="main" aria-busy="true">
        <h1>正在打开这一局回放…</h1>
      </main>
    );
  }

  const actionLabel = (actionId: string) =>
    build?.ruleSystem.actions.find((action) => action.id === actionId)?.label ?? actionId;

  return (
    <main className="replay-view" id="main">
      <header className="room-shell-header">
        <div className="room-title-block">
          <span className="room-brand-mark" aria-hidden="true">GD</span>
          <div>
            <span className="room-kicker">只读 · 不能改这一局</span>
            <h1>{build?.ruleSystem.name ?? "回放"}</h1>
          </div>
        </div>
        <div className="room-header-actions">
          <a href={validationStudioHref(replay.projectId, { buildId: replay.buildId })}>
            回工作室
          </a>
        </div>
      </header>
      <section>
        <span className="room-kicker">
          {replay.evidenceType === "automated-bot-simulation" ? "自动试玩" : "朋友刚打完的这一局"}
        </span>
        <h2>这一局怎么打完的</h2>
        <p>
          {replay.acceptedActions.length} 次行动 · 打到第 {replay.finalState.turn} 回合
        </p>
        {replay.finalState.voyage ? (
          <HarborVoyageBoard readOnly voyage={replay.finalState.voyage as HarborVoyageState} />
        ) : (
          <div className="replay-state-columns">
            <ReplayStateCard label="开局" state={replay.initialState} />
            <ReplayStateCard label="终局" state={replay.finalState} />
          </div>
        )}
      </section>
      <aside className="action-log">
        <span>行动记录</span>
        <ol>
          {replay.acceptedActions.map((action) => (
            <li key={action.sequence}>
              #{action.sequence} · 座位 {action.seat} · {actionLabel(action.actionId)}
              {typeof action.payload?.text === "string" ? ` · ${action.payload.text}` : ""}
              {action.state.conversation
                ? ""
                : action.state.pushYourLuck
                  ? action.actionId === "roll"
                    ? ` · 🎲 ${action.points} · 未存 ${action.state.pushYourLuck.turnScore}`
                    : ` · 收手 +${action.points}`
                  : action.points
                    ? action.state.rollAndMove
                      ? ` · 🎲 ${action.points} · +${action.points} 格`
                      : action.state.drawAndScore
                        ? ` · 🎴 ${action.points} · +${action.points}`
                        : ` · ${action.state.takeAway ? "−" : "+"}${action.points}`
                    : ""}
            </li>
          ))}
        </ol>
        {replay.evidenceType === "automated-bot-simulation" && (
          <p>这是自动试玩，不是真人局。</p>
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
        <div><dt>回合</dt><dd>{state.turn}</dd></div>
        <div><dt>轮到</dt><dd>座位 {state.activeSeat}</dd></div>
        <div><dt>状态</dt><dd>{state.status === "complete" ? "已结束" : "进行中"}</dd></div>
      </dl>
      <div className="score-grid">
        {state.conversation ? (
          <article className="conversation-replay-card">
            <span>发言记录</span>
            {state.conversation.transcript.length === 0 ? (
              <strong>尚无发言</strong>
            ) : (
              <ol className="speech-transcript">
                {state.conversation.transcript.map((entry, index) => (
                  <li key={`${entry.seat}-${index}`}>
                    座位 {entry.seat} · {entry.text}
                  </li>
                ))}
              </ol>
            )}
            <details className="conversation-score-secondary">
              <summary>内核计分（次要）</summary>
              <ul>
                {state.scores.map((score, seat) => (
                  <li key={seat}>座位 {seat} · {score}</li>
                ))}
              </ul>
            </details>
          </article>
        ) : state.sharedGoal ? (
          <article className="shared-goal-replay-card">
            <span>共同目标</span>
            <strong>{state.sharedGoal.progress} / {state.sharedGoal.target}</strong>
          </article>
        ) : state.takeAway ? (
          <article className="shared-goal-replay-card">
            <span>桌上还剩</span>
            <strong>{state.takeAway.remaining} / {state.takeAway.initialPool}</strong>
          </article>
        ) : state.rollAndMove ? (
          <>
            {state.rollAndMove.lastRoll !== null && (
              <article>
                <span>上次掷骰</span>
                <strong>🎲 {state.rollAndMove.lastRoll}</strong>
              </article>
            )}
            {state.rollAndMove.positions.map((position, seat) => (
              <article key={seat}>
                <span>座位 {seat} 位置</span>
                <strong>{position} / {state.rollAndMove?.targetPosition}</strong>
              </article>
            ))}
          </>
        ) : state.drawAndScore ? (
          <>
            <article className="shared-goal-replay-card">
              <span>牌库剩余</span>
              <strong>{state.drawAndScore.remainingCards} / {state.drawAndScore.totalCards}</strong>
            </article>
            {state.drawAndScore.lastDraw !== null && (
              <article>
                <span>刚抽到</span>
                <strong>🎴 {state.drawAndScore.lastDraw}</strong>
              </article>
            )}
            {state.scores.map((score, seat) => (
              <article key={seat}>
                <span>座位 {seat}</span>
                <strong>{score}</strong>
              </article>
            ))}
          </>
        ) : state.pushYourLuck ? (
          <>
            <article className="shared-goal-replay-card">
              <span>本回合未存分</span>
              <strong>{state.pushYourLuck.turnScore}</strong>
            </article>
            {state.pushYourLuck.lastRoll !== null && (
              <article>
                <span>上次掷骰</span>
                <strong>🎲 {state.pushYourLuck.lastRoll}</strong>
              </article>
            )}
            {state.scores.map((score, seat) => (
              <article key={seat}>
                <span>座位 {seat}</span>
                <strong>{score}</strong>
              </article>
            ))}
          </>
        ) : state.turnTaking ? (
          <article className="shared-goal-replay-card">
            <span>回合上限</span>
            <strong>{state.turn} / {state.turnTaking.maxTurns}</strong>
          </article>
        ) : state.scores.map((score, seat) => (
            <article key={seat}>
              <span>座位 {seat}</span>
              <strong>{score}</strong>
            </article>
          ))}
      </div>
    </article>
  );
}
