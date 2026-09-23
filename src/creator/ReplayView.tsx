import { useEffect, useState } from "react";
import { getBuild, getReplay } from "./project-api";
import type { GameReplay, PlayableBuild } from "./project-contract";
import type { HarborVoyageState } from "../runtime/harbor-voyage";
import type { WorkerPlacementState } from "../runtime/worker-placement";
import { HarborVoyageBoard } from "./HarborVoyageBoard";
import { WorkerPlacementBoard } from "./WorkerPlacementBoard";
import { readShareToken, validationStudioHref } from "./studio-utils";
import {
  replayOmitsPrimaryScoreGrid,
  replayPrimarySurface,
  type ReplayPrimarySurface,
} from "./replay-presentation";

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
        ) : replay.finalState.workerPlacement ? (
          <WorkerPlacementBoard
            readOnly
            board={replay.finalState.workerPlacement as WorkerPlacementState}
          />
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
                : action.state.hiddenRole
                  ? ""
                  : action.state.handPlay && action.points
                    ? ` · 打出 ${action.points}`
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

function phaseLabel(phase: "discuss" | "accuse" | "resolved") {
  if (phase === "discuss") return "公开发言";
  if (phase === "accuse") return "指控";
  return "已揭晓";
}

function ReplayGenreSurface({ surface }: { surface: ReplayPrimarySurface }) {
  switch (surface.kind) {
    case "hand-play":
      return (
        <article className="hand-play-replay-card" aria-label="手牌与出牌区">
          <span>手牌对局</span>
          <p>牌库剩余 {surface.deckRemaining} 张</p>
          <div className="play-area" aria-label="出牌区">
            {surface.playArea.length === 0 ? (
              <strong>尚无出牌</strong>
            ) : (
              surface.playArea.map((card, index) => (
                <span key={`${card.seat}-${index}`}>
                  座位 {card.seat} 打出 {card.card}
                </span>
              ))
            )}
          </div>
          {surface.lastPlay && (
            <p>
              最近打出：座位 {surface.lastPlay.seat} · {surface.lastPlay.card}
            </p>
          )}
          <div className="replay-hands" aria-label="各座位手牌">
            {surface.hands.map((hand) => (
              <div key={hand.seat} className="own-hand">
                <span>座位 {hand.seat} 手牌</span>
                {hand.cards.length === 0 ? (
                  <strong>空</strong>
                ) : (
                  hand.cards.map((card, index) => (
                    <span key={`${card}-${index}`}>手牌 {card}</span>
                  ))
                )}
              </div>
            ))}
          </div>
        </article>
      );
    case "hidden-role":
      return (
        <article className="hidden-role-replay-card" aria-label="身份与发言">
          <span>身份对局</span>
          <p className="hidden-role-phase">阶段：{phaseLabel(surface.phase)}</p>
          <ol className="speech-transcript">
            {surface.transcript.length === 0 ? (
              <li>尚无发言</li>
            ) : (
              surface.transcript.map((entry, index) => (
                <li key={`${entry.seat}-${index}`}>
                  座位 {entry.seat}：{entry.text}
                </li>
              ))
            )}
          </ol>
          {surface.accusations.length > 0 && (
            <ul className="accusation-log">
              {surface.accusations.map((entry) => (
                <li key={`${entry.seat}-${entry.targetSeat}`}>
                  座位 {entry.seat} 指控座位 {entry.targetSeat}
                </li>
              ))}
            </ul>
          )}
          {surface.roles && (
            <ul className="hidden-role-replay-roles" aria-label="揭晓身份">
              {surface.roles.map((role) => (
                <li key={role.seat}>
                  座位 {role.seat}：{role.name}
                  {role.alignment === "culprit" ? "（凶手阵营）" : "（侦探阵营）"}
                </li>
              ))}
            </ul>
          )}
          {surface.resolution && (
            <p>
              被揭晓的是座位 {surface.resolution.condemnedSeat}。
              {surface.resolution.winnerAlignment === "town"
                ? "侦探与平民获胜。"
                : "凶手获胜。"}
            </p>
          )}
        </article>
      );
    case "conversation":
      return (
        <article className="conversation-replay-card">
          <span>发言记录</span>
          {surface.transcript.length === 0 ? (
            <strong>尚无发言</strong>
          ) : (
            <ol className="speech-transcript">
              {surface.transcript.map((entry, index) => (
                <li key={`${entry.seat}-${index}`}>
                  座位 {entry.seat} · {entry.text}
                </li>
              ))}
            </ol>
          )}
        </article>
      );
    case "shared-goal":
      return (
        <article className="shared-goal-replay-card">
          <span>共同目标</span>
          <strong>
            {surface.progress} / {surface.target}
          </strong>
        </article>
      );
    case "take-away":
      return (
        <article className="shared-goal-replay-card">
          <span>桌上还剩</span>
          <strong>
            {surface.remaining} / {surface.initialPool}
          </strong>
        </article>
      );
    case "roll-and-move":
      return (
        <>
          {surface.lastRoll !== null && (
            <article>
              <span>上次掷骰</span>
              <strong>🎲 {surface.lastRoll}</strong>
            </article>
          )}
          {surface.positions.map((position, seat) => (
            <article key={seat}>
              <span>座位 {seat} 位置</span>
              <strong>
                {position} / {surface.targetPosition}
              </strong>
            </article>
          ))}
        </>
      );
    case "draw-and-score":
      return (
        <>
          <article className="shared-goal-replay-card">
            <span>牌库剩余</span>
            <strong>
              {surface.remainingCards} / {surface.totalCards}
            </strong>
          </article>
          {surface.lastDraw !== null && (
            <article>
              <span>刚抽到</span>
              <strong>🎴 {surface.lastDraw}</strong>
            </article>
          )}
          {surface.scores.map((score, seat) => (
            <article key={seat}>
              <span>座位 {seat}</span>
              <strong>{score}</strong>
            </article>
          ))}
        </>
      );
    case "push-your-luck":
      return (
        <>
          <article className="shared-goal-replay-card">
            <span>本回合未存分</span>
            <strong>{surface.turnScore}</strong>
          </article>
          {surface.lastRoll !== null && (
            <article>
              <span>上次掷骰</span>
              <strong>🎲 {surface.lastRoll}</strong>
            </article>
          )}
          {surface.scores.map((score, seat) => (
            <article key={seat}>
              <span>座位 {seat}</span>
              <strong>{score}</strong>
            </article>
          ))}
        </>
      );
    case "turn-taking":
      return (
        <article className="shared-goal-replay-card">
          <span>回合上限</span>
          <strong>
            {surface.turn} / {surface.maxTurns}
          </strong>
        </article>
      );
    case "score-grid":
      return (
        <>
          {surface.scores.map((score, seat) => (
            <article key={seat}>
              <span>座位 {seat}</span>
              <strong>{score}</strong>
            </article>
          ))}
        </>
      );
  }
}

function ReplayStateCard({
  label,
  state,
}: {
  label: string;
  state: GameReplay["initialState"];
}) {
  const surface = replayPrimarySurface(state);
  const omitScores = replayOmitsPrimaryScoreGrid(state);
  const showSecondaryScores =
    omitScores &&
    (surface.kind === "hand-play" || surface.kind === "hidden-role") &&
    state.scores.some((score) => score !== 0);

  return (
    <article className="replay-state-card">
      <h2>{label}</h2>
      <dl>
        <div><dt>回合</dt><dd>{state.turn}</dd></div>
        <div><dt>轮到</dt><dd>座位 {state.activeSeat}</dd></div>
        <div><dt>状态</dt><dd>{state.status === "complete" ? "已结束" : "进行中"}</dd></div>
      </dl>
      <div className={omitScores && (surface.kind === "hand-play" || surface.kind === "hidden-role" || surface.kind === "conversation") ? "replay-genre-grid" : "score-grid"}>
        <ReplayGenreSurface surface={surface} />
      </div>
      {showSecondaryScores && (
        <div className="replay-score-secondary" aria-label="分数（次要）">
          <span>分数（次要）</span>
          <ul>
            {state.scores.map((score, seat) => (
              <li key={seat}>
                座位 {seat}：{score}
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
