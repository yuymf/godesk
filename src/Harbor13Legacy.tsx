import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HarborScene } from "./components/HarborScene";
import {
  TARGETS,
  applyAction,
  canPlace,
  chooseBotTarget,
  replayActions,
  targetCost,
  winner,
  type GameAction,
  type PlayerId,
  type ShipId,
  type TargetId,
} from "./domain/game";
import { answerRuleQuestion, type RuleAnswer } from "./domain/rules";

const STORAGE_KEY = "harbor-13.accepted-actions.v1";

function isGameAction(value: unknown): value is GameAction {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<GameAction>;
  return (
    typeof item.id === "string" &&
    (item.type === "place" || item.type === "roll") &&
    typeof item.playerId === "string"
  );
}

function loadActions(): GameAction[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    return Array.isArray(value) ? value.filter(isGameAction) : [];
  } catch {
    return [];
  }
}

function phaseCopy(phase: string) {
  if (phase === "placement") return "派遣伙计";
  if (phase === "sailing") return "三轮航行";
  return "航次结算";
}

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function Harbor13Legacy() {
  const [actions, setActions] = useState<GameAction[]>(loadActions);
  const [replayIndex, setReplayIndex] = useState<number | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<RuleAnswer>(() =>
    answerRuleQuestion("怎么获胜"),
  );
  const liveState = useMemo(() => replayActions(actions), [actions]);
  const state = useMemo(
    () =>
      replayIndex === null
        ? liveState
        : replayActions(actions.slice(0, replayIndex)),
    [actions, liveState, replayIndex],
  );
  const actionCountRef = useRef(actions.length);
  actionCountRef.current = actions.length;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
  }, [actions]);

  const commit = useCallback((action: GameAction) => {
    setActions((currentActions) => {
      const currentState = replayActions(currentActions);
      const nextState = applyAction(currentState, action);
      return nextState === currentState ? currentActions : [...currentActions, action];
    });
  }, []);

  useEffect(() => {
    if (
      replayIndex !== null ||
      liveState.phase !== "placement" ||
      liveState.activePlayer === "you"
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      const playerId = liveState.activePlayer;
      commit({
        id: id("bot-place"),
        type: "place",
        playerId,
        targetId: chooseBotTarget(liveState, playerId),
      });
    }, 420);
    return () => window.clearTimeout(timer);
  }, [commit, liveState, replayIndex]);

  const place = (targetId: TargetId) => {
    if (replayIndex !== null) return;
    commit({ id: id("place"), type: "place", playerId: "you", targetId });
  };

  const roll = () => {
    if (replayIndex !== null) return;
    commit({
      id: id("roll"),
      type: "roll",
      playerId: "you",
      values: [0, 0, 0].map(() => Math.floor(Math.random() * 6) + 1) as [
        number,
        number,
        number,
      ],
    });
  };

  const ask = (event: FormEvent) => {
    event.preventDefault();
    if (!question.trim()) return;
    setAnswer(answerRuleQuestion(question));
    setQuestion("");
  };

  const currentPlayer = state.players.find(
    (player) => player.id === state.activePlayer,
  );
  const voyageWinner = winner(liveState);
  const isLive = replayIndex === null;
  const waitingForBot =
    liveState.phase === "placement" && liveState.activePlayer !== "you";

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Harbor 13 首页">
          <span className="brand-mark">H13</span>
          <span>
            <strong>Harbor 13</strong>
            <small>桌游机制测试台</small>
          </span>
        </a>
        <div className="voyage-status" aria-live="polite">
          <span className="eyebrow">航次 01</span>
          <strong>{phaseCopy(liveState.phase)}</strong>
          <span className={`status-dot ${waitingForBot ? "thinking" : ""}`} />
        </div>
        <div className="top-actions">
          <button
            className="button ghost"
            type="button"
            disabled={actions.length === 0 || replayIndex !== null}
            onClick={() => setActions((current) => current.slice(0, -1))}
          >
            撤销一步
          </button>
          <button
            className="button ghost"
            type="button"
            onClick={() => {
              setActions([]);
              setReplayIndex(null);
            }}
          >
            重置航次
          </button>
        </div>
      </header>

      <main id="top" className="workspace">
        <section className="table-column" aria-label="航行桌面">
          <div className="table-heading">
            <div>
              <span className="eyebrow">原型房间 · 本地三席</span>
              <h1>今晚，谁能穿过第 13 格？</h1>
            </div>
            <p>
              {isLive
                ? waitingForBot
                  ? `${currentPlayer?.name ?? "对手"}正在选择位置…`
                  : liveState.phase === "placement"
                    ? "点船身或右侧位置，派出一名伙计。"
                    : liveState.phase === "sailing"
                      ? `准备第 ${liveState.sailingRound + 1} 轮航行。`
                      : `${voyageWinner?.name ?? "商会"}暂时领先。`
                : `正在回放第 ${replayIndex} / ${actions.length} 个事件`}
            </p>
          </div>

          <div className={`scene-card ${isLive ? "" : "is-replay"}`}>
            <div className="scene-legend" aria-hidden="true">
              <span>起航</span>
              <span>13 · 海盗线</span>
              <span>港口</span>
            </div>
            <HarborScene
              state={state}
              onSelectShip={(shipId: ShipId) => place(shipId)}
            />
            {!isLive && <div className="replay-flag">回放预览 · 不影响当前对局</div>}
          </div>

          <div className="ship-strip" aria-label="货船状态">
            {state.ships.map((ship) => {
              const result = state.results?.[ship.id];
              return (
                <article key={ship.id} className="ship-stat">
                  <span className="cargo-swatch" style={{ background: ship.color }} />
                  <div>
                    <strong>{ship.name}</strong>
                    <small>货值 {ship.reward}</small>
                  </div>
                  <b>{ship.position}</b>
                  <span className="unit">格</span>
                  {result && (
                    <em>
                      {result === "harbor"
                        ? "进港"
                        : result === "pirates"
                          ? "遭劫"
                          : "船厂"}
                    </em>
                  )}
                </article>
              );
            })}
          </div>

          <section className="timeline" aria-labelledby="timeline-title">
            <div className="section-title-row">
              <div>
                <span className="eyebrow">Event log</span>
                <h2 id="timeline-title">对局记录与回放</h2>
              </div>
              <button
                className={`button small ${isLive ? "ghost" : "active"}`}
                type="button"
                disabled={actions.length === 0}
                onClick={() => setReplayIndex(isLive ? actions.length : null)}
              >
                {isLive ? "进入回放" : "返回现场"}
              </button>
            </div>
            {!isLive && (
              <label className="replay-control">
                <span>事件 {replayIndex}</span>
                <input
                  aria-label="回放事件位置"
                  type="range"
                  min="0"
                  max={actions.length}
                  value={replayIndex}
                  onInput={(event) =>
                    setReplayIndex(Number(event.currentTarget.value))
                  }
                />
                <span>{actions.length}</span>
              </label>
            )}
            <ol className="log-list">
              {state.log
                .slice()
                .reverse()
                .slice(0, 5)
                .map((entry) => (
                  <li key={entry.id} className={entry.tone}>
                    <span />
                    {entry.message}
                  </li>
                ))}
            </ol>
          </section>
        </section>

        <aside className="control-rail" aria-label="对局控制台">
          <section className="panel players-panel">
            <div className="section-title-row compact">
              <div>
                <span className="eyebrow">Seats</span>
                <h2>商会席位</h2>
              </div>
              <span className="room-pill">3 / 3</span>
            </div>
            <ul className="player-list">
              {state.players.map((player) => (
                <li
                  key={player.id}
                  className={state.activePlayer === player.id && state.phase === "placement" ? "active" : ""}
                >
                  <span className="avatar" style={{ background: player.color }}>
                    {player.name.slice(0, 1)}
                  </span>
                  <div>
                    <strong>{player.name}</strong>
                    <small>{player.workers} 名伙计待命</small>
                  </div>
                  <b>{player.cash}</b>
                  <span className="coin">银币</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel action-panel">
            <div className="section-title-row compact">
              <div>
                <span className="eyebrow">Your move</span>
                <h2>本轮行动</h2>
              </div>
              {liveState.phase === "placement" && (
                <span className="turn-chip">
                  {waitingForBot ? "等待对手" : "轮到你"}
                </span>
              )}
            </div>

            {liveState.phase === "placement" ? (
              <>
                <p className="action-hint">费用会随位置拥挤而上涨。船身也可以直接点击。</p>
                <div className="target-grid">
                  {(Object.keys(TARGETS) as TargetId[]).map((targetId) => {
                    const occupied = liveState.placements.filter(
                      (item) => item.targetId === targetId,
                    ).length;
                    const target = TARGETS[targetId];
                    return (
                      <button
                        key={targetId}
                        data-target-id={targetId}
                        type="button"
                        disabled={
                          !isLive || !canPlace(liveState, "you", targetId)
                        }
                        onClick={() => place(targetId)}
                      >
                        <span>
                          <strong>{target.name}</strong>
                          <small>{target.note}</small>
                        </span>
                        <b>{targetCost(liveState, targetId)}</b>
                        <em>
                          {occupied}/{target.capacity}
                        </em>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : liveState.phase === "sailing" ? (
              <div className="roll-card">
                <div className="dice-row" aria-hidden="true">
                  {liveState.ships.map((ship) => (
                    <span key={ship.id} style={{ borderColor: ship.color }}>
                      {ship.position}
                    </span>
                  ))}
                </div>
                <p>一次掷出三颗骰子。结果写入日志后不可偷偷重掷。</p>
                <button
                  data-testid="roll-dice"
                  className="button primary wide"
                  type="button"
                  disabled={!isLive}
                  onClick={roll}
                >
                  掷骰 · 第 {liveState.sailingRound + 1} / 3 轮
                </button>
              </div>
            ) : (
              <div className="result-card">
                <span className="result-kicker">本航次领先</span>
                <strong>{voyageWinner?.name}</strong>
                <b>{voyageWinner?.cash} 银币</b>
                <button
                  className="button primary wide"
                  type="button"
                  onClick={() => {
                    setActions([]);
                    setReplayIndex(null);
                  }}
                >
                  开始新航次
                </button>
              </div>
            )}
          </section>

          <section className="panel rules-panel">
            <div className="assistant-title">
              <span className="assistant-orb">?</span>
              <div>
                <span className="eyebrow">Grounded helper</span>
                <h2>规则助手</h2>
              </div>
            </div>
            <div className={`answer ${answer.certain ? "" : "uncertain"}`} aria-live="polite">
              <p>{answer.answer}</p>
              {answer.citation ? (
                <small>来源：{answer.citation}</small>
              ) : (
                <small>未找到来源 · 已明确标记不确定</small>
              )}
            </div>
            <form onSubmit={ask}>
              <label htmlFor="rule-question">问一个规则问题</label>
              <div className="question-box">
                <input
                  id="rule-question"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="例如：海盗什么时候得分？"
                />
                <button
                  data-testid="rule-submit"
                  type="submit"
                  aria-label="发送规则问题"
                >
                  ↗
                </button>
              </div>
            </form>
          </section>

          <p className="prototype-note">
            内部机制验证 · 不含商业游戏素材或原文规则
          </p>
        </aside>
      </main>
    </div>
  );
}
