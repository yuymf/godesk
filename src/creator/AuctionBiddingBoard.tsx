import { useState } from "react";
import type { SessionState } from "./project-contract";
import type { RenderSpec } from "./render-spec";
import { TabletopStage } from "./TabletopStage";

type AuctionBiddingBoardState = NonNullable<SessionState["auctionBidding"]>;

export function AuctionBiddingBoard({ auction, activeSeat, enabled, busy = false, readOnly = false,
  status, viewerSeat, onAct, render, importedModels }: {
  auction: AuctionBiddingBoardState;
  activeSeat: number;
  enabled: boolean;
  busy?: boolean;
  readOnly?: boolean;
  status: "active" | "complete";
  viewerSeat: number | null;
  onAct?: (actionId: string, payload?: Record<string, unknown>) => void;
  /** ADR 0014 / T028: optional RenderSpec for shared TabletopStage. */
  render?: RenderSpec;
  importedModels?: ReadonlyArray<{ id: string; url: string; title?: string }>;
}) {
  const [amount, setAmount] = useState(1);
  const harbor = auction.harbor ?? null;
  const gallery = auction.gallery ?? null;
  const phase = auction.phase ?? "bidding";
  const currentName = gallery?.currentLot?.name
    ?? harbor?.currentLot?.name
    ?? (auction.lotId === "amber" ? "琥珀" : auction.lotId === "jade" ? "青玉" : String(auction.lotId));
  const minimum = auction.currentBid + 1;
  const canAct = enabled && !busy && !readOnly && status === "active" && viewerSeat === activeSeat;
  const canBid = canAct && phase === "bidding" && Number.isSafeInteger(amount) &&
    amount >= minimum && amount <= auction.chips[activeSeat];
  const canPass = canAct && phase === "bidding";
  const myHarborHand = viewerSeat !== null && harbor ? harbor.hand[viewerSeat] ?? [] : [];
  const myOfferHand = viewerSeat !== null && gallery ? gallery.auctionHand[viewerSeat] ?? [] : [];
  const myCollection = viewerSeat !== null && gallery ? gallery.collection[viewerSeat] ?? [] : [];

  const modeLabel = gallery
    ? gallery.currentMode === "sealed"
      ? "一次暗标"
      : gallery.currentMode === "fixed"
        ? "定价购买"
        : gallery.currentMode === "double"
          ? "双画固定"
          : "公开加价"
    : null;
  const seatCount = auction.chips.length;

  const stageOnAct = canAct
    ? (actionId: string, payload?: Record<string, unknown>) => {
        onAct?.(actionId, payload);
      }
    : undefined;

  return (
    <section aria-label="拍卖竞价桌" className="auction-board room-view-tabletop-immersive">
      <TabletopStage
        kernel="auction-bidding-v1"
        state={auction}
        render={render}
        importedModels={importedModels}
        onAct={stageOnAct}
      />
      <details className="desk-chrome desk-action-drawer">
        <summary className="desk-action-drawer-summary">桌面行动（主交互在 3D；点此展开按钮）</summary>
        <div className="desk-action-drawer-body">
      <header className="auction-heading auction-lot-card">
        <div>
          <span className="auction-kicker">
            {gallery
              ? `画廊竞拍 · ${modeLabel ?? "选拍"} · 第 ${gallery.round}/${gallery.roundsToEnd} 轮`
              : harbor
                ? (harbor.bidVisibility === "sealed" ? "密封竞价 · 多拍品" : "公开竞价 · 多拍品")
                : "公开竞价 · 单件拍品"}
          </span>
          <h2>
            {gallery?.currentLot
              ? `${currentName}${gallery.companionLot ? `+${gallery.companionLot.name}` : ""} · 底价/定价 ${gallery.fixedPrice || gallery.currentLot.reserve}`
              : gallery && phase === "offer"
                ? "拍卖官打出画作并选择拍卖方式"
                : gallery && phase === "market"
                  ? "行情卖出"
                  : harbor?.currentLot
                    ? `${currentName} · 底价 ${harbor.currentLot.reserve} · 黑市×${harbor.currentLot.marketMult}`
                    : phase === "market"
                      ? "黑市转售"
                      : `${currentName}拍品 · 价值 ${auction.lotValue}`}
          </h2>
        </div>
        <svg className="auction-mark" width="76" height="76" viewBox="0 0 76 76" role="img" aria-label="拍卖槌"><rect width="76" height="76" rx="16"/><path d="m16 20 10-10 25 25-10 10zm28 20 5-5 18 18-5 5zM12 60h51" fill="none" strokeWidth="6" strokeLinecap="round"/></svg>
      </header>
      <section aria-label="拍卖状态" aria-live="polite" className={`auction-status${status === "complete" ? " is-complete" : " is-live"}`}>
        <strong>
          {status === "complete"
            ? auction.awardedTo === null && !harbor && !gallery
              ? "流拍 · 双方放弃"
              : harbor || gallery
                ? `终局 · 资金最高者获胜`
                : `成交 · 座位 ${auction.awardedTo} 获得拍品`
            : phase === "market"
              ? gallery
                ? `行情阶段 · 座位 ${activeSeat} 可按画家行情卖出或跳过`
                : `黑市阶段 · 座位 ${activeSeat} 可出售手牌或跳过`
              : phase === "sealed"
                ? `密封出价 · 座位 ${activeSeat}`
                : phase === "fixed"
                  ? `${gallery?.currentMode === "double" ? "双画固定" : "定价购买"} · 座位 ${activeSeat} · 标价 ${gallery?.fixedPrice ?? auction.currentBid}`
                  : phase === "offer"
                    ? `拍卖官座位 ${gallery?.auctioneer ?? activeSeat} 出牌选模式`
                    : `轮到座位 ${activeSeat} 出价或放弃`}
        </strong>
        <div className="auction-status-facts">
          {phase === "bidding" || phase === "sealed" ? (
            <>
              <p>当前出价：{auction.currentBid} 筹码 · 最高出价者：{auction.highBidder === null ? "暂无" : `座位 ${auction.highBidder}`}</p>
              {phase === "bidding" ? <p>下次出价至少 {minimum} 筹码</p> : null}
            </>
          ) : null}
          {harbor ? (
            <p aria-label="harbor-deck">
              牌库剩余 {harbor.deck.length} · 弃牌 {harbor.discard.length} · 手牌 0={harbor.hand[0].length} / 1={harbor.hand[1].length}
            </p>
          ) : null}
          {gallery ? (
            <p aria-label="gallery-market">
              席位 {seatCount}
              {" · "}手牌 {gallery.auctionHand.map((h, i) => `${i}=${h.length}`).join(" / ")}
              {" · "}藏品 {gallery.collection.map((c, i) => `${i}=${c.length}`).join(" / ")}
              {" · "}牌库 {gallery.deck.length}
            </p>
          ) : null}
          {harbor?.lastSold ? (
            <p>最近黑市：座位 {harbor.lastSold.seat} 出售 {harbor.lastSold.name} +{harbor.lastSold.payout}</p>
          ) : null}
          {gallery?.lastSold ? (
            <p>最近行情：座位 {gallery.lastSold.seat} 出售 {gallery.lastSold.name} +{gallery.lastSold.payout}</p>
          ) : null}
        </div>
      </section>
      {gallery ? (
        <div className="auction-gallery" aria-label="gallery-prices">
          <p>画家行情（累计）</p>
          <ul>
            {gallery.artists.map((a) => (
              <li key={a.id}>
                {a.name}：{gallery.marketPrices[a.id] ?? 0}
                {" · 本轮售出 "}{gallery.roundSales[a.id] ?? 0}/{gallery.salesToEndRound}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {harbor ? (
        <div className="auction-harbor" aria-label="harbor">
          <p>资金决胜 · 拍得后可在黑市按倍率变现</p>
        </div>
      ) : null}
      <div role="region" aria-label="座位筹码与得分" className="auction-seats">
        {Array.from({ length: seatCount }, (_, seat) => (
          <div key={seat} className={`auction-seat${seat === activeSeat && status === "active" ? " is-active" : ""}`}>
            <strong>座位 {seat}</strong>
            <span>筹码 <b>{auction.chips[seat]}</b></span>
            <span>{harbor || gallery ? "拍得" : "得分"} <b>{auction.scores[seat]}</b></span>
          </div>
        ))}
      </div>
      {!readOnly && status === "active" && phase === "offer" && canAct && gallery ? (
        <div className="auction-actions" aria-label="出牌选模式">
          {myOfferHand.flatMap((p) =>
            gallery.modes.filter((m) => m !== "double").map((mode) => (
              <button
                key={`${p.instanceId}-${mode}`}
                type="button"
                onClick={() => onAct?.("play_painting", { instanceId: p.instanceId, mode })}
              >
                {p.name} · {mode === "open" ? "公开加价" : mode === "sealed" ? "一次暗标" : "定价购买"}
              </button>
            )),
          )}
          {gallery.modes.includes("double")
            ? myOfferHand.flatMap((a, i) =>
                myOfferHand.slice(i + 1).flatMap((b) =>
                  a.artistId === b.artistId
                    ? [
                        <button
                          key={`dbl-${a.instanceId}-${b.instanceId}`}
                          type="button"
                          onClick={() =>
                            onAct?.("play_painting", {
                              instanceId: a.instanceId,
                              secondInstanceId: b.instanceId,
                              mode: "double",
                            })
                          }
                        >
                          双画 {a.name}+{b.name}
                        </button>,
                      ]
                    : [],
                ),
              )
            : null}
        </div>
      ) : null}
      {!readOnly && status === "active" && phase === "bidding" ? (
        <div className="auction-actions" aria-label="竞价操作">
          <label>出价金额<input aria-label="出价金额" type="number" min={minimum} max={auction.chips[activeSeat]} step="1" value={amount} disabled={!canPass} onChange={(event) => setAmount(Number(event.target.value))} /></label>
          <button className="auction-bid" type="button" disabled={!canBid} onClick={() => onAct?.("bid", { amount })}>出价</button>
          <button className="auction-pass" type="button" disabled={!canPass} onClick={() => onAct?.("pass")}>放弃</button>
        </div>
      ) : null}
      {!readOnly && status === "active" && phase === "sealed" && canAct ? (
        <div className="auction-actions" aria-label="密封出价">
          <button type="button" onClick={() => onAct?.("sealed_bid", { amount: Math.max(minimum, gallery?.currentLot?.reserve ?? harbor?.currentLot?.reserve ?? 1) })}>
            密封出价（底价）
          </button>
          <button type="button" onClick={() => onAct?.("sealed_pass")}>密封放弃</button>
        </div>
      ) : null}
      {!readOnly && status === "active" && phase === "fixed" && canAct ? (
        <div className="auction-actions" aria-label="定价购买">
          <button type="button" onClick={() => onAct?.("buy_fixed")}>定价购入</button>
          <button type="button" onClick={() => onAct?.("pass_fixed")}>不买</button>
          <button type="button" onClick={() => onAct?.("buy_own")}>自购</button>
          <button type="button" onClick={() => onAct?.("decline_own")}>流拍</button>
        </div>
      ) : null}
      {!readOnly && status === "active" && phase === "market" && canAct ? (
        <div className="auction-actions" aria-label={gallery ? "行情操作" : "黑市操作"}>
          {gallery
            ? myCollection.map((lot) => {
                const price = gallery.marketPrices[lot.artistId] ?? 0;
                if (price <= 0) return null;
                return (
                  <button
                    key={lot.instanceId}
                    type="button"
                    onClick={() => onAct?.("sell", { instanceId: lot.instanceId })}
                  >
                    出售 {lot.name}（+{price}）
                  </button>
                );
              })
            : myHarborHand.map((lot) => (
              <button
                key={lot.instanceId}
                type="button"
                onClick={() => onAct?.("sell", { instanceId: lot.instanceId })}
              >
                出售 {lot.name}（×{lot.marketMult}）
              </button>
            ))}
          <button type="button" onClick={() => onAct?.("pass_market")}>{gallery ? "跳过行情" : "跳过黑市"}</button>
        </div>
      ) : null}
      {readOnly && (harbor?.currentLot || gallery?.currentLot) ? (
        <p className="auction-readonly-lot">当前拍品：{currentName}</p>
      ) : null}
    
        </div>
      </details>
    </section>
  );
}
