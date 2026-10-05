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
  const minimum = auction.currentBid + 1;
  const canBid = enabled && !busy && !readOnly && status === "active" &&
    viewerSeat === activeSeat && Number.isSafeInteger(amount) &&
    amount >= minimum && amount <= auction.chips[activeSeat];
  const canPass = enabled && !busy && !readOnly && status === "active" && viewerSeat === activeSeat;
  return (
    <section aria-label="拍卖竞价桌" className="auction-board">
      <header className="auction-heading auction-lot-card">
        <div><span className="auction-kicker">公开竞价 · 单件拍品</span><h2>{auction.lotId === "amber" ? "琥珀" : "青玉"}拍品 · 价值 {auction.lotValue}</h2></div>
        <svg className="auction-mark" width="76" height="76" viewBox="0 0 76 76" role="img" aria-label="拍卖槌"><rect width="76" height="76" rx="16"/><path d="m16 20 10-10 25 25-10 10zm28 20 5-5 18 18-5 5zM12 60h51" fill="none" strokeWidth="6" strokeLinecap="round"/></svg>
      </header>
      <section aria-label="拍卖状态" aria-live="polite" className={`auction-status${status === "complete" ? " is-complete" : " is-live"}`}>
        <strong>{status === "complete" ? auction.awardedTo === null ? "流拍 · 双方放弃" : `成交 · 座位 ${auction.awardedTo} 获得拍品` : `轮到座位 ${activeSeat} 出价或放弃`}</strong>
        <div className="auction-status-facts"><p>当前出价：{auction.currentBid} 筹码 · 最高出价者：{auction.highBidder === null ? "暂无" : `座位 ${auction.highBidder}`}</p>
        <p>下次出价至少 {minimum} 筹码</p></div>
      </section>
      <div role="region" aria-label="座位筹码与得分" className="auction-seats">
        {([0, 1] as const).map((seat) => <div key={seat} className={`auction-seat${seat === activeSeat && status === "active" ? " is-active" : ""}`}>
          <strong>座位 {seat}</strong><span>筹码 <b>{auction.chips[seat]}</b></span><span>得分 <b>{auction.scores[seat]}</b></span>
        </div>)}
      </div>
      {!readOnly && status === "active" && <div className="auction-actions" aria-label="竞价操作">
        <label>出价金额<input aria-label="出价金额" type="number" min={minimum} max={auction.chips[activeSeat]} step="1" value={amount} disabled={!canPass} onChange={(event) => setAmount(Number(event.target.value))} /></label>
        <button className="auction-bid" type="button" disabled={!canBid} onClick={() => onAct?.("bid", { amount })}>出价</button>
        <button className="auction-pass" type="button" disabled={!canPass} onClick={() => onAct?.("pass")}>放弃</button>
      </div>}
    </section>
  );
}
