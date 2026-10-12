/**
 * Tide Arena / 潮阵 — room HUD for auto-battler-v1 (shop / bench / board / combat log).
 */
import type { SessionState } from "./project-contract";
import { UNIT_CATALOG, unitDef } from "../runtime/adapters/auto-battler";

type TideArenaState = NonNullable<SessionState["autoBattler"]>;
type Piece = NonNullable<TideArenaState["seats"][0]["bench"][number]>;

function pieceLabel(piece: Piece): string {
  return unitDef(piece.unitId)?.name ?? piece.unitId;
}

export function TideArenaBoard({
  arena,
  activeSeat,
  enabled,
  busy = false,
  readOnly = false,
  status,
  viewerSeat,
  onAct,
}: {
  arena: TideArenaState;
  activeSeat: number;
  enabled: boolean;
  busy?: boolean;
  readOnly?: boolean;
  status: "active" | "complete";
  viewerSeat: number | null;
  onAct?: (actionId: string, payload?: Record<string, unknown>) => void;
}) {
  const seatIdx = viewerSeat ?? activeSeat;
  const me = arena.seats[seatIdx === 0 || seatIdx === 1 ? seatIdx : 0]!;
  const them = arena.seats[seatIdx === 0 ? 1 : 0]!;
  const canAct =
    enabled &&
    !busy &&
    !readOnly &&
    status === "active" &&
    viewerSeat === activeSeat &&
    !me.ready;

  const phaseLabel =
    arena.phase === "shop"
      ? "商店"
      : arena.phase === "place"
        ? "布阵"
        : "终局";

  return (
    <section aria-label="潮阵对局" className="tide-arena-board">
      <header className="tide-arena-heading">
        <div>
          <span className="tide-arena-kicker">Tide Arena · 潮阵</span>
          <h2>
            第 {arena.round} 回合 · {phaseLabel}
            {me.ready ? " · 已准备" : ""}
          </h2>
        </div>
        <div className="tide-arena-hp-row" aria-label="双方生命与金币">
          <p>
            我方 HP <b>{me.hp}</b> · 金 <b>{me.gold}</b>
          </p>
          <p>
            对方 HP <b>{them.hp}</b> · 金 <b>{them.gold}</b>
          </p>
        </div>
      </header>

      <section aria-live="polite" className="tide-arena-status">
        <strong>
          {status === "complete"
            ? `终局 · 胜者座位 ${viewerSeat !== null && status ? "见顶栏" : ""}`
            : `轮到座位 ${activeSeat} · ${phaseLabel}`}
        </strong>
        {arena.lastCombat ? (
          <p>
            上次战斗：
            {arena.lastCombat.winnerSeat === null
              ? "平局"
              : `座位 ${arena.lastCombat.winnerSeat} 胜`}
            ，伤害 {arena.lastCombat.damage}
          </p>
        ) : null}
        {me.synergies.length > 0 ? (
          <p aria-label="我方羁绊">
            羁绊：
            {me.synergies
              .map((syn) => `${syn.label}×${syn.count}`)
              .join(" · ")}
          </p>
        ) : (
          <p>羁绊：暂无（上场同特质 ≥2 激活）</p>
        )}
      </section>

      {arena.phase === "shop" ? (
        <section aria-label="商店" className="tide-arena-shop">
          <h3>商店</h3>
          <div className="tide-arena-shop-row">
            {me.shop.map((unitId, shopIndex) => {
              if (!unitId) {
                return (
                  <div key={shopIndex} className="tide-arena-card is-empty">
                    已购
                  </div>
                );
              }
              const def = unitDef(unitId);
              return (
                <button
                  key={shopIndex}
                  type="button"
                  className="tide-arena-card"
                  disabled={!canAct || !def || me.gold < (def?.cost ?? 99)}
                  onClick={() => onAct?.("buy", { shopIndex })}
                >
                  <strong>{def?.name ?? unitId}</strong>
                  <span>
                    {def?.cost}金 · {def?.atk}/{def?.hp}
                  </span>
                  <span>{def?.traits.join("·")}</span>
                </button>
              );
            })}
          </div>
          <div className="tide-arena-shop-actions">
            <button
              type="button"
              disabled={!canAct || me.gold < 1}
              onClick={() => onAct?.("refresh")}
            >
              刷新（1金）
            </button>
            <button
              type="button"
              disabled={!canAct}
              onClick={() => onAct?.("ready_shop")}
            >
              准备完毕
            </button>
          </div>
        </section>
      ) : null}

      <section aria-label="备战席" className="tide-arena-bench">
        <h3>备战席</h3>
        <div className="tide-arena-slot-row">
          {me.bench.map((piece, benchIndex) => (
            <div key={benchIndex} className="tide-arena-slot">
              {piece ? (
                <>
                  <strong>{pieceLabel(piece)}</strong>
                  <span>
                    {piece.atk}/{piece.hp}
                  </span>
                  {arena.phase === "shop" ? (
                    <button
                      type="button"
                      disabled={!canAct}
                      onClick={() => onAct?.("sell", { benchIndex })}
                    >
                      出售
                    </button>
                  ) : null}
                  {arena.phase === "place" ? (
                    <div className="tide-arena-place-targets">
                      {me.board.map((cell, boardIndex) =>
                        cell ? null : (
                          <button
                            key={boardIndex}
                            type="button"
                            disabled={!canAct}
                            onClick={() =>
                              onAct?.("place", { benchIndex, boardIndex })
                            }
                          >
                            →{boardIndex}
                          </button>
                        ),
                      )}
                    </div>
                  ) : null}
                </>
              ) : (
                <span className="tide-arena-empty">空</span>
              )}
            </div>
          ))}
        </div>
      </section>

      <section aria-label="己方半场" className="tide-arena-board-grid">
        <h3>己方半场（8 格）</h3>
        <div className="tide-arena-grid">
          {me.board.map((piece, boardIndex) => (
            <div key={boardIndex} className="tide-arena-cell">
              {piece ? (
                <>
                  <strong>{pieceLabel(piece)}</strong>
                  <span>
                    {piece.atk}/{piece.hp}
                  </span>
                  {arena.phase === "place" ? (
                    <button
                      type="button"
                      disabled={!canAct}
                      onClick={() => onAct?.("recall", { boardIndex })}
                    >
                      撤回
                    </button>
                  ) : null}
                </>
              ) : (
                <span>{boardIndex}</span>
              )}
            </div>
          ))}
        </div>
        {arena.phase === "place" ? (
          <button
            type="button"
            className="tide-arena-lock"
            disabled={!canAct}
            onClick={() => onAct?.("ready_place")}
          >
            锁定阵容
          </button>
        ) : null}
      </section>

      {arena.combatLog.length > 0 ? (
        <section aria-label="战斗日志" className="tide-arena-combat-log">
          <h3>战斗日志</h3>
          <ol>
            {arena.combatLog.slice(-12).map((entry, index) => (
              <li key={index}>{JSON.stringify(entry)}</li>
            ))}
          </ol>
        </section>
      ) : null}

      <details className="tide-arena-roster">
        <summary>单位图鉴（{UNIT_CATALOG.length}）</summary>
        <ul>
          {UNIT_CATALOG.map((unit) => (
            <li key={unit.id}>
              {unit.name} · {unit.cost}金 · {unit.atk}/{unit.hp} ·{" "}
              {unit.traits.join("·")}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
