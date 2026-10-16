import type { SessionState } from "./project-contract";
import type { RenderSpec } from "./render-spec";
import { TabletopStage } from "./TabletopStage";
import {
  createGemEngineKernelConfig,
  gemEngineAdapter,
  parseGemEngineConfig,
  type GemEngineGenre,
} from "../runtime/adapters/gem-engine";
import type { PlayState } from "../runtime/play-kernel";

type GemEngineBoardState = NonNullable<SessionState["gemEngine"]>;

function playStateFromGemSession(
  gem: GemEngineBoardState,
  activeSeat: number,
  status: "active" | "complete",
): PlayState<GemEngineGenre> {
  const genre = gem as unknown as GemEngineGenre;
  return {
    seed: 0,
    sequence: 0,
    phase: status === "complete" ? "ended" : "main",
    activePlayerId: activeSeat,
    playerCount: genre.seats.length,
    status,
    winnerId: null,
    events: [],
    genre,
  };
}

export function listGemEngineLegalActionsForSession(input: {
  gem: GemEngineBoardState;
  activeSeat: number;
  status: "active" | "complete";
  playerId: number;
}) {
  const config = createGemEngineKernelConfig({ playerCount: Math.max(2, input.gem.seats.length) });
  const parsed = parseGemEngineConfig(config.adapter);
  if (!parsed) return [];
  const state = playStateFromGemSession(input.gem, input.activeSeat, input.status);
  return gemEngineAdapter.listLegalActions(state, input.playerId, parsed);
}

const COLOR_LABEL: Record<string, string> = {
  white: "白", blue: "蓝", green: "绿", red: "红", black: "黑", gold: "金",
};

export function GemEngineBoard({
  gem,
  activeSeat,
  enabled,
  busy = false,
  readOnly = false,
  status,
  viewerSeat,
  onAct,
  render,
  importedModels,
}: {
  gem: GemEngineBoardState;
  activeSeat: number;
  enabled: boolean;
  busy?: boolean;
  readOnly?: boolean;
  status: "active" | "complete";
  viewerSeat: number | null;
  onAct?: (actionId: string, payload?: Record<string, unknown>) => void;
  /** ADR 0014 / T026: optional RenderSpec for shared TabletopStage. */
  render?: RenderSpec;
  importedModels?: ReadonlyArray<{ id: string; url: string; title?: string }>;
}) {
  const canAct =
    enabled && !busy && !readOnly && status === "active" && viewerSeat === activeSeat;
  const own = viewerSeat !== null ? gem.seats[viewerSeat] : null;
  const pendingDiscard =
    (gem as { pendingDiscardSeat?: number | null }).pendingDiscardSeat === viewerSeat;
  // T071 · short supply chip (no color-by-color debug dump)
  const bankLine = `库存 ${Object.values(gem.bank).reduce((a, n) => a + Number(n || 0), 0)}`;
  const reserved = (own as { reserved?: Array<{ id?: string; discount?: string; prestige?: number }> } | null)?.reserved ?? [];
  const seats = gem.seats as Array<{
    prestige: number;
    discounts: Record<string, number>;
    reserved?: unknown[];
  }>;
  const leader = seats.reduce(
    (best, seat, index) => (seat.prestige > (seats[best]?.prestige ?? -1) ? index : best),
    0,
  );

  const stageOnAct =
    canAct && !pendingDiscard
      ? (actionId: string, payload?: Record<string, unknown>) => {
          onAct?.(actionId, payload);
        }
      : undefined;
  const legalActions =
    canAct && !pendingDiscard
      ? listGemEngineLegalActionsForSession({
          gem,
          activeSeat,
          status,
          playerId: viewerSeat ?? activeSeat,
        })
      : [];

  return (
    <section aria-label="宝石引擎桌" className="gem-engine-board room-view-tabletop-immersive">
      <TabletopStage
        kernel="gem-engine-v1"
        state={gem}
        legal={legalActions}
        render={render}
        importedModels={importedModels}
        onAct={stageOnAct}
      />
      <div className="desk-stage-hud" aria-live="polite">
        <span className="desk-stage-hud-kicker">宝石引擎</span>
        <strong className="desk-stage-hud-turn">
          {status === "complete"
            ? `终局 · 座位 ${leader} 领先`
            : pendingDiscard
              ? `座位 ${activeSeat} · 弃回溢出`
              : `轮到座位 ${activeSeat}`}
        </strong>
        <span className="desk-stage-hud-supply" aria-label="gem-bank">{bankLine}</span>
      </div>
      {/* T071 */}
      <details className="desk-chrome desk-action-drawer" open data-ui-action-drawer="1">
        <summary className="desk-action-drawer-summary">行动</summary>
        <div className="desk-action-drawer-body">
        {!canAct ? <p className="desk-action-empty" data-empty="1">暂无合法行动 · 等待回合</p> : null}
      <div role="region" aria-label="贵族" className="gem-nobles">
        {gem.nobles.map((n, i) => (
          <span key={i}>{String((n as { name?: string }).name ?? "贵族")}</span>
        ))}
      </div>
      {([0, 1, 2] as const).map((tier) => (
        <div key={tier} role="region" aria-label={`发展牌 T${tier + 1}`}>
          <strong>T{tier + 1}</strong>
          {(gem.market[tier] ?? []).map((card, index) => {
            const c = card as {
              discount?: string;
              prestige?: number;
              id?: string;
            };
            return (
              <span key={String(c.id ?? index)} className="gem-market-card">
                <button
                  type="button"
                  className={!canAct || pendingDiscard ? "is-disabled" : "is-legal"}
                  disabled={!canAct || pendingDiscard}
                  onClick={() => onAct?.("buy", { tier: tier + 1, index })}
                >
                  买 {COLOR_LABEL[c.discount ?? ""] ?? c.discount}+{c.prestige ?? 0}
                </button>
                <button
                  type="button"
                  className={!canAct || pendingDiscard ? "is-disabled" : "is-legal"}
                  disabled={!canAct || pendingDiscard}
                  onClick={() => onAct?.("reserve", { tier: tier + 1, index })}
                >
                  保留
                </button>
              </span>
            );
          })}
        </div>
      ))}
      <div role="region" aria-label="席位声望">
        {seats.map((seat, seatId) => (
          <div key={seatId}>
            座位 {seatId} · 声望 {seat.prestige} · 折扣{" "}
            {Object.entries(seat.discounts ?? {})
              .filter(([, n]) => (n as number) > 0)
              .map(([c, n]) => `${COLOR_LABEL[c] ?? c}${n}`)
              .join(" ") || "无"}
            {" · "}保留 {(seat as { reserved?: unknown[] }).reserved?.length ?? 0}
          </div>
        ))}
      </div>
      {own ? (
        <p aria-label="own-gems">
          我的代币：
          {Object.entries(own.gems)
            .filter(([, n]) => n > 0)
            .map(([c, n]) => `${COLOR_LABEL[c]}${n}`)
            .join(" · ") || "无"}
        </p>
      ) : null}
      {reserved.length > 0 ? (
        <div role="region" aria-label="保留手牌">
          <strong>保留</strong>
          {reserved.map((card, index) => (
            <button
              key={String(card.id ?? index)}
              type="button"
              className={!canAct || pendingDiscard ? "is-disabled" : "is-legal"}
              disabled={!canAct || pendingDiscard}
              onClick={() => onAct?.("buy_reserved", { index })}
            >
              买保留 {COLOR_LABEL[card.discount ?? ""] ?? card.discount}+{card.prestige ?? 0}
            </button>
          ))}
        </div>
      ) : null}
      {!readOnly && status === "active" && canAct ? (
        <div className="gem-actions" aria-label="宝石行动">
          {pendingDiscard ? (
            <>
              {(["white", "blue", "green", "red", "black", "gold"] as const).map((color) =>
                ((own?.gems as Record<string, number> | undefined)?.[color] ?? 0) > 0 ? (
                  <button
                    key={color}
                    type="button"
                    onClick={() => onAct?.("discard_gems", { color, count: 1 })}
                  >
                    弃回{COLOR_LABEL[color]}
                  </button>
                ) : null,
              )}
            </>
          ) : (
            <>
              <button type="button" className="is-legal" onClick={() => onAct?.("take_diverse", { colors: ["white", "blue", "green"] })}>
                拿白蓝绿
              </button>
              <button type="button" className="is-legal" onClick={() => onAct?.("take_diverse", { colors: ["red", "black", "white"] })}>
                拿红黑白
              </button>
              <button type="button" className="is-legal" onClick={() => onAct?.("take_pair", { color: "blue" })}>
                拿两蓝
              </button>
              <button type="button" className="is-legal" onClick={() => onAct?.("reserve", { tier: 1, fromDeck: true })}>
                保留 T1 牌库顶
              </button>
            </>
          )}
        </div>
      ) : null}
    
        </div>
      </details>
    </section>
  );
}
