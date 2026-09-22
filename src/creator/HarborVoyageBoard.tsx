import { useState } from "react";
import {
  canPlaceHarborWorker,
  harborInstruction,
  harborTargetCost,
  HARBOR_TARGET_GROUPS,
  type HarborCargoId,
  type HarborTargetId,
  type HarborVoyageState,
} from "../runtime/harbor-voyage";

const resultCopy = {
  port: "抵达港口",
  shipyard: "进入干坞",
  pirates: "遭私掠截获",
};

export function HarborVoyageBoard({
  voyage,
  busy,
  onAct,
  readOnly = false,
}: {
  voyage: HarborVoyageState;
  busy?: boolean;
  onAct?: (actionId: string) => void;
  readOnly?: boolean;
}) {
  const [selectedPilot, setSelectedPilot] = useState<HarborCargoId>("cedar");
  const active = voyage.players.find((player) => player.seat === voyage.activeSeat);
  const hasPilot = voyage.placements.some(
    (placement) =>
      placement.seat === 0 &&
      (placement.targetId === "pilot-small" ||
        placement.targetId === "pilot-large"),
  );
  const interactive = !readOnly && Boolean(onAct) && voyage.phase !== "resolved";

  return (
    <div className="harbor-voyage-board">
      <p className="harbor-instruction">{harborInstruction(voyage)}</p>
      <div className="sea-chart">
        <div className="chart-labels">
          <span>起航</span>
          <span>私掠线 · 13</span>
          <span>港口 · 14+</span>
        </div>
        {voyage.punts.map((punt) => (
          <article className="punt-lane" key={punt.cargoId}>
            <div className="punt-title">
              <span style={{ background: punt.color }} />
              <div>
                <b>{punt.name}</b>
                <small>
                  d{punt.die} · 货值 {punt.value}
                </small>
              </div>
              <strong>{punt.position}</strong>
            </div>
            <div className="track" aria-label={`${punt.name}船当前位置 ${punt.position}`}>
              {Array.from({ length: 15 }, (_, index) => (
                <span
                  className={
                    index === 13 ? "pirate-line" : index === 14 ? "port-line" : ""
                  }
                  key={index}
                >
                  <i>{index}</i>
                </span>
              ))}
              <div
                className="punt-token"
                style={{
                  background: punt.color,
                  left: `${(Math.min(punt.position, 14) / 14) * 100}%`,
                }}
              >
                <span>船</span>
              </div>
            </div>
            <div className="punt-footer">
              <span>
                船上伙计：
                {
                  voyage.placements.filter(
                    (placement) => placement.targetId === punt.cargoId,
                  ).length
                }
                /3
              </span>
              {voyage.lastRoll[punt.cargoId] != null && (
                <b>本轮 +{voyage.lastRoll[punt.cargoId]}</b>
              )}
              {punt.result && <em>{resultCopy[punt.result]}</em>}
            </div>
          </article>
        ))}
        <div className="movement-console">
          <div>
            <span>航次节奏</span>
            <b>
              {voyage.phase === "placement"
                ? `放置 ${voyage.placementRound}/4 · 座位 ${voyage.activeSeat}`
                : voyage.phase === "movement"
                  ? `航行 ${voyage.movementRound + 1}/3`
                  : voyage.phase === "pilot"
                    ? "领航"
                    : "已结算"}
            </b>
          </div>
          {interactive && voyage.phase === "movement" && (
            <button
              className="roll-button"
              disabled={busy}
              onClick={() => onAct?.("roll")}
              type="button"
            >
              <span>掷骰并航行</span>
              <small>琥珀 d4 · 钴蓝 d3 · 雪松 d2</small>
            </button>
          )}
          {interactive && voyage.phase === "pilot" && (
            <div className="pilot-console">
              <select
                aria-label="领航员选择船"
                onChange={(event) =>
                  setSelectedPilot(event.target.value as HarborCargoId)
                }
                value={selectedPilot}
              >
                {voyage.punts.map((punt) => (
                  <option key={punt.cargoId} value={punt.cargoId}>
                    {punt.name}
                  </option>
                ))}
              </select>
              <button
                disabled={busy || !hasPilot}
                onClick={() => onAct?.(`pilot:${selectedPilot}:-1`)}
                type="button"
              >
                向后
              </button>
              <button
                disabled={busy || !hasPilot}
                onClick={() => onAct?.(`pilot:${selectedPilot}:1`)}
                type="button"
              >
                向前
              </button>
              {!hasPilot && (
                <button
                  disabled={busy}
                  onClick={() => onAct?.("pilot:skip")}
                  type="button"
                >
                  跳过领航
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <section className="action-board" aria-label="派遣伙计">
        <div className="action-board-heading">
          <div>
            <h2>派遣伙计</h2>
          </div>
          <span>
            {active
              ? `${active.name} · ${active.workers} 名 · ${active.cash} 信用`
              : "—"}
          </span>
        </div>
        <div className="target-groups">
          {HARBOR_TARGET_GROUPS.map((group) => (
            <section key={group.title}>
              <header>
                <b>{group.title}</b>
              </header>
              <div>
                {group.targets.map((target) => {
                  const placements = voyage.placements.filter(
                    (placement) => placement.targetId === target.id,
                  );
                  const enabled =
                    interactive &&
                    voyage.phase === "placement" &&
                    canPlaceHarborWorker(
                      voyage,
                      voyage.activeSeat,
                      target.id as HarborTargetId,
                    );
                  return (
                    <button
                      className={enabled ? "target-space available" : "target-space"}
                      disabled={!enabled || busy}
                      key={target.id}
                      onClick={() => onAct?.(`place:${target.id}`)}
                      type="button"
                    >
                      <span className="space-topline">
                        <b>{target.name}</b>
                        <em>
                          {harborTargetCost(voyage, target.id as HarborTargetId)}{" "}
                          信用
                        </em>
                      </span>
                      <small>{target.payout}</small>
                      <span className="worker-slots">
                        {Array.from({ length: target.capacity }, (_, index) => {
                          const owner = placements[index]
                            ? voyage.players.find(
                                (player) =>
                                  player.seat === placements[index].seat,
                              )
                            : undefined;
                          return (
                            <i
                              key={index}
                              style={{ background: owner?.color }}
                              title={owner?.name}
                            >
                              {owner ? "●" : "○"}
                            </i>
                          );
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

      <aside className="player-ledger">
        {voyage.players.map((player) => (
          <article
            className={
              voyage.activeSeat === player.seat && voyage.phase === "placement"
                ? "active"
                : ""
            }
            key={player.seat}
          >
            <span className="player-seal" style={{ background: player.color }} />
            <div>
              <b>{player.name}</b>
              <small>Seat {player.seat}</small>
            </div>
            <strong>
              {player.cash}
              <small>信用</small>
            </strong>
            <em>{player.workers} 名伙计</em>
          </article>
        ))}
      </aside>

      <section className="game-log">
        <span>桌面记录</span>
        <ol>
          {voyage.log
            .slice()
            .reverse()
            .slice(0, 12)
            .map((entry, index) => (
              <li key={`${entry}-${index}`}>
                <span>{String(voyage.log.length - index).padStart(2, "0")}</span>
                {entry}
              </li>
            ))}
        </ol>
      </section>
    </div>
  );
}
