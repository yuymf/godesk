import { useMemo, useState } from "react";
import {
  canPlaceWorker,
  createPlayableState,
  placeWorker,
  playBots,
  randomRoll,
  rollPunts,
  targetCost,
  targetGroups,
  usePilot,
  type LoadedGoodId,
  type ManilaTargetId,
} from "./playable";

const resultCopy = {
  port: "抵达马尼拉",
  shipyard: "进入船厂",
  pirates: "遭海盗劫掠",
};

export type PlayableCoverage = {
  compileReady: boolean;
  sourceSummary: string;
  componentSummary: string;
  decisionSummary: string;
  assetSummary: string;
};

export function PlayableManila({
  onExit,
  coverage,
}: {
  onExit: () => void;
  coverage: PlayableCoverage;
}) {
  const [state, setState] = useState(createPlayableState);
  const [selectedPilot, setSelectedPilot] = useState<LoadedGoodId>("ginseng");
  const human = state.players.find((player) => player.id === "you")!;
  const winner = state.players.find((player) => player.id === state.winnerId);
  const hasPilot = state.placements.some(
    (placement) =>
      placement.playerId === "you" &&
      (placement.targetId === "pilot-small" || placement.targetId === "pilot-large"),
  );
  const instruction = useMemo(() => {
    if (state.phase === "placement")
      return `放置第 ${state.placementRound}/4 名伙计：选择一个仍有空位、付得起的位置。`;
    if (state.phase === "movement")
      return `第 ${state.movementRound + 1}/3 次航行：掷三枚对应货物的骰子。`;
    if (state.phase === "pilot")
      return hasPilot ? "领航员行动：选择一艘船并向前或向后调整。" : "你没有领航员，继续进入最后一次移动。";
    return `${winner?.name ?? "商会"}暂时领先。查看结算后可重新开一局。`;
  }, [hasPilot, state, winner]);

  const place = (targetId: ManilaTargetId) => {
    setState((current) => playBots(placeWorker(current, "you", targetId)));
  };

  const roll = () => {
    setState((current) => rollPunts(current, randomRoll(current)));
  };

  const pilot = (direction: -1 | 1) => {
    setState((current) => usePilot(current, selectedPilot, direction));
  };

  return (
    <main id="main" className="playable-table">
      <header className="playable-heading">
        <div>
          <span className="kicker">GENERATED PLAYABLE · VOYAGE 01</span>
          <h1>马尼拉 · 三人单航次试玩桌</h1>
          <p>{instruction}</p>
        </div>
        <div className="playable-heading-actions">
          <button onClick={onExit} type="button">返回生成结果</button>
          <button onClick={() => setState(createPlayableState())} type="button">重新开局</button>
        </div>
      </header>

      <section className="playable-grid">
        <div className="game-board">
          <div className="sea-chart">
            <div className="chart-labels"><span>起航</span><span>海盗线 · 13</span><span>马尼拉 · 14+</span></div>
            {state.punts.map((punt) => (
              <article className="punt-lane" key={punt.goodId}>
                <div className="punt-title">
                  <span style={{ background: punt.color }} />
                  <div><b>{punt.name}</b><small>d{punt.die} · 货值 {punt.value}</small></div>
                  <strong>{punt.position}</strong>
                </div>
                <div className="track" aria-label={`${punt.name}船当前位置 ${punt.position}`}>
                  {Array.from({ length: 15 }, (_, index) => (
                    <span className={index === 13 ? "pirate-line" : index === 14 ? "port-line" : ""} key={index}>
                      <i>{index}</i>
                    </span>
                  ))}
                  <div
                    className="punt-token"
                    style={{
                      background: punt.color,
                      left: `${Math.min(punt.position, 14) / 14 * 100}%`,
                    }}
                  >
                    <span>船</span>
                  </div>
                </div>
                <div className="punt-footer">
                  <span>
                    船上伙计：
                    {state.placements.filter((placement) => placement.targetId === punt.goodId).length}/3
                  </span>
                  {state.lastRoll[punt.goodId] && <b>本轮 +{state.lastRoll[punt.goodId]}</b>}
                  {punt.result && <em>{resultCopy[punt.result]}</em>}
                </div>
              </article>
            ))}
            <div className="movement-console">
              <div>
                <span>航次节奏</span>
                <b>
                  {state.phase === "placement"
                    ? `放置 ${state.placementRound}/4`
                    : state.phase === "movement"
                      ? `移动 ${state.movementRound + 1}/3`
                      : state.phase === "pilot"
                        ? "领航员"
                        : "已结算"}
                </b>
              </div>
              {state.phase === "movement" && (
                <button className="roll-button" onClick={roll} type="button">
                  <span>掷骰并移动</span>
                  <small>肉豆蔻 d4 · 丝绸 d3 · 人参 d2</small>
                </button>
              )}
              {state.phase === "pilot" && (
                <div className="pilot-console">
                  <select
                    aria-label="领航员选择船"
                    onChange={(event) => setSelectedPilot(event.target.value as LoadedGoodId)}
                    value={selectedPilot}
                  >
                    {state.punts.map((punt) => <option key={punt.goodId} value={punt.goodId}>{punt.name}</option>)}
                  </select>
                  <button disabled={!hasPilot} onClick={() => pilot(-1)} type="button">向后</button>
                  <button disabled={!hasPilot} onClick={() => pilot(1)} type="button">向前</button>
                  {!hasPilot && <button onClick={() => pilot(1)} type="button">跳过领航</button>}
                </div>
              )}
              {state.phase === "resolved" && (
                <button className="roll-button" onClick={() => setState(createPlayableState())} type="button">
                  <span>再开一航次</span>
                  <small>清空桌面并重置资金</small>
                </button>
              )}
            </div>
          </div>

          <section className="action-board" aria-labelledby="action-board-title">
            <div className="action-board-heading">
              <div>
                <span className="kicker">WORKER PLACEMENT</span>
                <h2 id="action-board-title">派遣伙计</h2>
              </div>
              <span>你还有 {human.workers} 名 · {human.cash} 比索</span>
            </div>
            <div className="target-groups">
              {targetGroups.map((group) => (
                <section key={group.title}>
                  <header><b>{group.title}</b><small>规则书 p.{group.page}</small></header>
                  <div>
                    {group.targets.map((target) => {
                      const placements = state.placements.filter((placement) => placement.targetId === target.id);
                      const enabled = canPlaceWorker(state, "you", target.id);
                      return (
                        <button
                          className={enabled ? "target-space available" : "target-space"}
                          disabled={!enabled}
                          key={target.id}
                          onClick={() => place(target.id)}
                          type="button"
                        >
                          <span className="space-topline"><b>{target.name}</b><em>{targetCost(state, target.id)} 比索</em></span>
                          <small>{target.payout}</small>
                          <span className="worker-slots">
                            {Array.from({ length: target.capacity }, (_, index) => {
                              const owner = placements[index]
                                ? state.players.find((player) => player.id === placements[index].playerId)
                                : undefined;
                              return <i key={index} style={{ background: owner?.color }} title={owner?.name}>{owner ? "●" : "○"}</i>;
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
        </div>

        <aside className="game-rail">
          <section className="player-ledger">
            <div className="rail-title"><span className="kicker">PLAYERS</span><h2>商会账本</h2></div>
            {state.players.map((player) => (
              <article className={state.activePlayer === player.id && state.phase === "placement" ? "active" : ""} key={player.id}>
                <span className="player-seal" style={{ background: player.color }} />
                <div><b>{player.name}</b><small>{player.id === "you" ? "真人玩家" : "自动对手"}</small></div>
                <strong>{player.cash}<small>比索</small></strong>
                <em>{player.workers} 名伙计</em>
              </article>
            ))}
          </section>

          <section className="game-log">
            <div className="rail-title"><span className="kicker">ACTION LOG</span><h2>桌面记录</h2></div>
            <ol>
              {state.log.slice().reverse().slice(0, 9).map((entry, index) => (
                <li key={`${entry}-${index}`}><span>{String(state.log.length - index).padStart(2, "0")}</span>{entry}</li>
              ))}
            </ol>
          </section>

          <section className="playable-coverage" aria-labelledby="playable-coverage-title">
            <div className="rail-title">
              <span className="kicker">VALIDATION REPORT</span>
              <h2 id="playable-coverage-title">生成前验证报告</h2>
            </div>
            <ul>
              <li className={coverage.compileReady ? "covered" : "blocked"}>
                <b>内部编译</b>
                <span>{coverage.compileReady ? "已通过必需决定" : "开发预览：仍有必需决定未完成"}</span>
              </li>
              <li className="covered"><b>来源</b><span>{coverage.sourceSummary}</span></li>
              <li className="covered"><b>组件</b><span>{coverage.componentSummary}</span></li>
              <li className={coverage.compileReady ? "covered" : "blocked"}><b>规则决定</b><span>{coverage.decisionSummary}</span></li>
              <li className="warning"><b>缺图处理</b><span>{coverage.assetSummary}</span></li>
              <li className="warning"><b>运行时未支持</b><span>完整贷款、保险破产兜底、盲客与多航次终局</span></li>
              <li className="blocked"><b>发布许可</b><span>只允许内部验证，不可发布或再分发</span></li>
            </ul>
          </section>

          <section className="playable-boundary">
            <b>本次可玩覆盖</b>
            <p>港务长预设、三人 4 次放置、3 次移动、港口/船厂、海盗、领航员、保险与航次结算。</p>
            <a href="?variant=A">查看规则来源链 →</a>
          </section>
        </aside>
      </section>
    </main>
  );
}
