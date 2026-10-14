import { useState } from "react";
import type { SessionState } from "./project-contract";

type AuctionBiddingBoardState = NonNullable<SessionState["auctionBidding"]>;

export function AuctionBiddingBoard({ auction, activeSeat, enabled, busy = false, readOnly = false,
  status, viewerSeat, onAct }: {
  auction: AuctionBiddingBoardState;
  activeSeat: number;
  enabled: boolean;
  busy?: boolean;
  readOnly?: boolean;
  status: "active" | "complete";
  viewerSeat: number | null;
  onAct?: (actionId: string, payload?: Record<string, unknown>) => void;
}) {
  const [amount, setAmount] = useState(1);
  const harbor = auction.harbor ?? null;
  const phase = auction.phase ?? "bidding";
  const currentName = harbor?.currentLot?.name
    ?? (auction.lotId === "amber" ? "琥珀" : auction.lotId === "jade" ? "青玉" : String(auction.lotId));
  const minimum = auction.currentBid + 1;
  const canAct = enabled && !busy && !readOnly && status === "active" && viewerSeat === activeSeat;
  const canBid = canAct && phase === "bidding" && Number.isSafeInteger(amount) &&
    amount >= minimum && amount <= auction.chips[activeSeat];
  const canPass = canAct && phase === "bidding";
  const myHand = viewerSeat !== null && harbor ? harbor.hand[viewerSeat] ?? [] : [];

  return (
    <section aria-label="拍卖竞价桌" className="auction-board">
      <header className="auction-heading auction-lot-card">
        <div>
          <span className="auction-kicker">
            {harbor
              ? (harbor.bidVisibility === "sealed" ? "密封竞价 · 多拍品" : "公开竞价 · 多拍品")
              : "公开竞价 · 单件拍品"}
          </span>
          <h2>
            {harbor?.currentLot
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
            ? auction.awardedTo === null && !harbor
              ? "流拍 · 双方放弃"
              : harbor
                ? `终局 · 资金最高者获胜`
                : `成交 · 座位 ${auction.awardedTo} 获得拍品`
            : phase === "market"
              ? `黑市阶段 · 座位 ${activeSeat} 可出售手牌或跳过`
              : phase === "sealed"
                ? `密封出价 · 座位 ${activeSeat}`
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
          {harbor?.lastSold ? (
            <p>最近黑市：座位 {harbor.lastSold.seat} 出售 {harbor.lastSold.name} +{harbor.lastSold.payout}</p>
          ) : null}
        </div>
      </section>
      {harbor ? (
        <div className="auction-harbor" aria-label="harbor">
          <p>资金决胜 · 拍得后可在黑市按倍率变现</p>
        </div>
      ) : null}
      <div role="region" aria-label="座位筹码与得分" className="auction-seats">
        {([0, 1] as const).map((seat) => <div key={seat} className={`auction-seat${seat === activeSeat && status === "active" ? " is-active" : ""}`}>
          <strong>座位 {seat}</strong>
          <span>筹码 <b>{auction.chips[seat]}</b></span>
          <span>{harbor ? "拍得" : "得分"} <b>{auction.scores[seat]}</b></span>
        </div>)}
      </div>
      {!readOnly && status === "active" && phase === "bidding" ? (
        <div className="auction-actions" aria-label="竞价操作">
          <label>出价金额<input aria-label="出价金额" type="number" min={minimum} max={auction.chips[activeSeat]} step="1" value={amount} disabled={!canPass} onChange={(event) => setAmount(Number(event.target.value))} /></label>
          <button className="auction-bid" type="button" disabled={!canBid} onClick={() => onAct?.("bid", { amount })}>出价</button>
          <button className="auction-pass" type="button" disabled={!canPass} onClick={() => onAct?.("pass")}>放弃</button>
        </div>
      ) : null}
      {!readOnly && status === "active" && phase === "sealed" && canAct ? (
        <div className="auction-actions" aria-label="密封出价">
          <button type="button" onClick={() => onAct?.("sealed_bid", { amount: Math.max(minimum, harbor?.currentLot?.reserve ?? 1) })}>
            密封出价（底价）
          </button>
          <button type="button" onClick={() => onAct?.("sealed_pass")}>密封放弃</button>
        </div>
      ) : null}
      {!readOnly && status === "active" && phase === "market" && canAct ? (
        <div className="auction-actions" aria-label="黑市操作">
          {myHand.map((lot) => (
            <button
              key={lot.instanceId}
              type="button"
              onClick={() => onAct?.("sell", { instanceId: lot.instanceId })}
            >
              出售 {lot.name}（×{lot.marketMult}）
            </button>
          ))}
          <button type="button" onClick={() => onAct?.("pass_market")}>跳过黑市</button>
        </div>
      ) : null}
      {readOnly && harbor?.currentLot ? (
        <p className="auction-readonly-lot">当前拍品：{harbor.currentLot.name}</p>
      ) : null}
    </section>
  );
}
