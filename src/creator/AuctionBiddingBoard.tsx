import { useState } from "react";
import type { SessionState } from "./project-contract";

export type AuctionBiddingBoardState = NonNullable<SessionState["auctionBidding"]>;

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
    <section aria-label="拍卖竞价桌" className="auction-board" style={{ padding: "1.5rem", borderRadius: 20, background: "#172b35", color: "#f9f2df" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "start" }}>
        <div><span>公开竞价 · 单件拍品</span><h2 style={{ margin: "0.3rem 0" }}>{auction.lotId === "amber" ? "琥珀" : "青玉"}拍品 · 价值 {auction.lotValue}</h2></div>
        <svg width="76" height="76" viewBox="0 0 76 76" role="img" aria-label="拍卖槌"><rect width="76" height="76" rx="16" fill="#be9b61"/><path d="m16 20 10-10 25 25-10 10zm28 20 5-5 18 18-5 5zM12 60h51" fill="none" stroke="#172b35" strokeWidth="6" strokeLinecap="round"/></svg>
      </header>
      <section aria-label="拍卖状态" aria-live="polite" style={{ margin: "1rem 0", padding: "1rem", background: "#263e48", borderRadius: 12 }}>
        <strong>{status === "complete" ? auction.awardedTo === null ? "流拍 · 双方放弃" : `成交 · 座位 ${auction.awardedTo} 获得拍品` : `轮到座位 ${activeSeat} 出价或放弃`}</strong>
        <p>当前出价：{auction.currentBid} 筹码 · 最高出价者：{auction.highBidder === null ? "暂无" : `座位 ${auction.highBidder}`}</p>
        <p>下次出价至少 {minimum} 筹码</p>
      </section>
      <div role="region" aria-label="座位筹码与得分" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
        {([0, 1] as const).map((seat) => <div key={seat} style={{ padding: 16, border: seat === activeSeat && status === "active" ? "2px solid #e7ba69" : "1px solid #688089", borderRadius: 12 }}>
          <strong>座位 {seat}</strong><p>筹码 {auction.chips[seat]}</p><p>得分 {auction.scores[seat]}</p>
        </div>)}
      </div>
      {!readOnly && status === "active" && <div style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap", marginTop: 18 }}>
        <label>出价金额<br /><input aria-label="出价金额" type="number" min={minimum} max={auction.chips[activeSeat]} step="1" value={amount} onChange={(event) => setAmount(Number(event.target.value))} style={{ width: 100, padding: 8 }} /></label>
        <button type="button" disabled={!canBid} onClick={() => onAct?.("bid", { amount })}>出价</button>
        <button type="button" disabled={!canPass} onClick={() => onAct?.("pass")}>放弃</button>
      </div>}
    </section>
  );
}
