import type { SessionState } from "./project-contract";

type GemEngineBoardState = NonNullable<SessionState["gemEngine"]>;

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
}: {
  gem: GemEngineBoardState;
  activeSeat: number;
  enabled: boolean;
  busy?: boolean;
  readOnly?: boolean;
  status: "active" | "complete";
  viewerSeat: number | null;
  onAct?: (actionId: string, payload?: Record<string, unknown>) => void;
}) {
  const canAct =
    enabled && !busy && !readOnly && status === "active" && viewerSeat === activeSeat;
  const own = viewerSeat !== null ? gem.seats[viewerSeat] : null;
  const pendingDiscard =
    (gem as { pendingDiscardSeat?: number | null }).pendingDiscardSeat === viewerSeat;
  const bankLine = Object.entries(gem.bank)
    .map(([c, n]) => `${COLOR_LABEL[c] ?? c}${n}`)
    .join(" · ");
  const reserved = (own as { reserved?: Array<{ id?: string; discount?: string; prestige?: number }> } | null)?.reserved ?? [];

  return (
    <section aria-label="宝石引擎桌" className="gem-engine-board">
      <header>
        <span className="auction-kicker">宝石引擎 · 声望竞速</span>
        <h2>
          {status === "complete"
            ? `终局 · 座位 ${gem.seats[0].prestige >= gem.seats[1].prestige ? 0 : 1} 领先`
            : pendingDiscard
              ? `座位 ${activeSeat} · 弃回溢出代币（上限 10）`
              : `轮到座位 ${activeSeat}`}
        </h2>
        <p aria-label="gem-bank">供应堆：{bankLine}</p>
      </header>
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
                  disabled={!canAct || pendingDiscard}
                  onClick={() => onAct?.("buy", { tier: tier + 1, index })}
                >
                  买 {COLOR_LABEL[c.discount ?? ""] ?? c.discount}+{c.prestige ?? 0}
                </button>
                <button
                  type="button"
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
        {([0, 1] as const).map((seat) => (
          <div key={seat}>
            座位 {seat} · 声望 {gem.seats[seat].prestige} · 折扣{" "}
            {Object.entries(gem.seats[seat].discounts)
              .filter(([, n]) => n > 0)
              .map(([c, n]) => `${COLOR_LABEL[c]}${n}`)
              .join(" ") || "无"}
            {" · "}保留 {(gem.seats[seat] as { reserved?: unknown[] }).reserved?.length ?? 0}
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
              <button type="button" onClick={() => onAct?.("take_diverse", { colors: ["white", "blue", "green"] })}>
                拿白蓝绿
              </button>
              <button type="button" onClick={() => onAct?.("take_diverse", { colors: ["red", "black", "white"] })}>
                拿红黑白
              </button>
              <button type="button" onClick={() => onAct?.("take_pair", { color: "blue" })}>
                拿两蓝
              </button>
              <button type="button" onClick={() => onAct?.("reserve", { tier: 1, fromDeck: true })}>
                保留 T1 牌库顶
              </button>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
