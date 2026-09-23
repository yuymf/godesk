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
import {
  HARBOR_DOCK_GROUP_KIND,
  HARBOR_LANDMARK_TEST_IDS,
} from "./harbor-presentation-bar";

const resultCopy = {
  port: "抵达港口",
  shipyard: "进入干坞",
  pirates: "遭私掠截获",
};

const PHASE_LABEL: Record<HarborVoyageState["phase"], string> = {
  placement: "放置阶段",
  movement: "航行阶段",
  pilot: "领航阶段",
  resolved: "已结算",
};

function phaseDetail(voyage: HarborVoyageState): string {
  if (voyage.phase === "placement") {
    return `第 ${voyage.placementRound}/4 轮 · 座位 ${voyage.activeSeat}`;
  }
  if (voyage.phase === "movement") {
    return `第 ${voyage.movementRound + 1}/3 轮掷骰`;
  }
  if (voyage.phase === "pilot") {
    return "末次移动前调整";
  }
  return voyage.winnerSeat == null
    ? "本航次结束"
    : `座位 ${voyage.winnerSeat} 领先`;
}

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
    <div
      className="harbor-voyage-board"
      data-testid={HARBOR_LANDMARK_TEST_IDS.board}
      data-harbor-phase={voyage.phase}
    >
      <header
        className="harbor-phase-chrome"
        data-testid={HARBOR_LANDMARK_TEST_IDS.phaseChrome}
        aria-label="航次阶段"
      >
        <div className="harbor-phase-badge">
          <span className="harbor-phase-kicker">航次节奏</span>
          <b data-testid={HARBOR_LANDMARK_TEST_IDS.phaseLabel}>{PHASE_LABEL[voyage.phase]}</b>
        </div>
        <p className="harbor-phase-detail" data-testid={HARBOR_LANDMARK_TEST_IDS.phaseDetail}>
          {phaseDetail(voyage)}
        </p>
        <p className="harbor-instruction">{harborInstruction(voyage)}</p>
      </header>

      <div
        className="sea-chart"
        data-testid={HARBOR_LANDMARK_TEST_IDS.cargoTracks}
        aria-label="货船航迹"
      >
        <div className="chart-labels" aria-hidden="true">
          <span>起航</span>
          <span className="chart-mark chart-mark-pirate">私掠线 · 13</span>
          <span className="chart-mark chart-mark-port">港口 · 14+</span>
        </div>
        {voyage.punts.map((punt) => {
          const aboard = voyage.placements.filter(
            (placement) => placement.targetId === punt.cargoId,
          ).length;
          return (
            <article
              className="punt-lane"
              data-cargo={punt.cargoId}
              data-testid={HARBOR_LANDMARK_TEST_IDS.cargoTrack(punt.cargoId)}
              key={punt.cargoId}
              aria-label={`${punt.name}航迹`}
            >
              <div className="punt-title">
                <span
                  className="cargo-swatch"
                  style={{ background: punt.color }}
                  aria-hidden="true"
                />
                <div className="cargo-identity">
                  <b className="cargo-name">{punt.name}</b>
                  <small className="cargo-meta">
                    <span className="cargo-die">d{punt.die}</span>
                    <span className="cargo-value">货值 {punt.value}</span>
                  </small>
                </div>
                <strong
                  className="cargo-position"
                  aria-label={`${punt.name}位置 ${punt.position}`}
                >
                  {punt.position}
                </strong>
              </div>
              <div
                className="track"
                aria-label={`${punt.name}船当前位置 ${punt.position}`}
              >
                {Array.from({ length: 15 }, (_, index) => (
                  <span
                    className={
                      index === 13
                        ? "pirate-line"
                        : index === 14
                          ? "port-line"
                          : ""
                    }
                    key={index}
                  >
                    <i>{index}</i>
                  </span>
                ))}
                <div
                  className="punt-token"
                  data-testid={HARBOR_LANDMARK_TEST_IDS.shipToken(punt.cargoId)}
                  style={{
                    background: punt.color,
                    left: `${(Math.min(punt.position, 14) / 14) * 100}%`,
                  }}
                  title={punt.name}
                >
                  <span aria-hidden="true">船</span>
                </div>
              </div>
              <div className="punt-footer">
                <span className="cargo-aboard">
                  船上伙计：
                  <b>
                    {aboard}/3
                  </b>
                </span>
                {voyage.lastRoll[punt.cargoId] != null && (
                  <b className="cargo-roll">本轮 +{voyage.lastRoll[punt.cargoId]}</b>
                )}
                {punt.result && (
                  <em className={`cargo-result is-${punt.result}`}>
                    {resultCopy[punt.result]}
                  </em>
                )}
              </div>
            </article>
          );
        })}
        <div
          className="movement-console"
          data-testid={HARBOR_LANDMARK_TEST_IDS.movementConsole}
        >
          <div className="movement-console-status">
            <span>操作台</span>
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

      <section
        className="action-board"
        aria-label="派遣伙计"
        data-testid={HARBOR_LANDMARK_TEST_IDS.dockBoard}
      >
        <div className="action-board-heading">
          <div>
            <h2>派遣伙计</h2>
            <small>码头与船位 · 选中席位后点击空位</small>
          </div>
          <span className="action-board-active">
            {active
              ? `${active.name} · ${active.workers} 名 · ${active.cash} 信用`
              : "—"}
          </span>
        </div>
        <div className="target-groups">
          {HARBOR_TARGET_GROUPS.map((group) => {
            const kind =
              HARBOR_DOCK_GROUP_KIND[
                group.title as keyof typeof HARBOR_DOCK_GROUP_KIND
              ] ?? "special";
            const groupTestId =
              HARBOR_LANDMARK_TEST_IDS.dockGroup[
                group.title as keyof typeof HARBOR_LANDMARK_TEST_IDS.dockGroup
              ] ?? `harbor-dock-group-${group.title}`;
            return (
              <section
                className={`dock-group dock-group-${kind}`}
                data-testid={groupTestId}
                key={group.title}
                aria-label={group.title}
              >
                <header>
                  <b>{group.title}</b>
                  <span className="dock-group-hint">
                    {kind === "cargo"
                      ? "登船分货"
                      : kind === "port"
                        ? "进港奖励"
                        : kind === "yard"
                          ? "进坞奖励"
                          : "私掠 · 领航 · 保险"}
                  </span>
                </header>
                <div className="dock-group-targets">
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
                        className={
                          enabled
                            ? `target-space target-kind-${kind} available`
                            : `target-space target-kind-${kind}`
                        }
                        data-target-id={target.id}
                        disabled={!enabled || busy}
                        key={target.id}
                        onClick={() => onAct?.(`place:${target.id}`)}
                        type="button"
                      >
                        <span className="space-topline">
                          <b>{target.name}</b>
                          <em className="space-cost">
                            {harborTargetCost(
                              voyage,
                              target.id as HarborTargetId,
                            )}{" "}
                            信用
                          </em>
                        </span>
                        <small className="space-payout">{target.payout}</small>
                        <span
                          className="worker-slots"
                          aria-label={`${target.name}伙计位 ${placements.length}/${target.capacity}`}
                        >
                          {Array.from(
                            { length: target.capacity },
                            (_, index) => {
                              const owner = placements[index]
                                ? voyage.players.find(
                                    (player) =>
                                      player.seat === placements[index].seat,
                                  )
                                : undefined;
                              return (
                                <i
                                  className={
                                    owner ? "worker-chip is-filled" : "worker-chip"
                                  }
                                  key={index}
                                  style={
                                    owner
                                      ? { background: owner.color }
                                      : undefined
                                  }
                                  title={owner?.name}
                                >
                                  {owner ? "●" : "○"}
                                </i>
                              );
                            },
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      <aside
        className="player-ledger"
        data-testid={HARBOR_LANDMARK_TEST_IDS.playerLedger}
        aria-label="席位台账"
      >
        {voyage.players.map((player) => (
          <article
            className={
              voyage.activeSeat === player.seat && voyage.phase === "placement"
                ? "active"
                : ""
            }
            key={player.seat}
          >
            <span
              className="player-seal"
              style={{ background: player.color }}
              aria-hidden="true"
            />
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

      <section className="game-log" aria-label="桌面记录">
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
