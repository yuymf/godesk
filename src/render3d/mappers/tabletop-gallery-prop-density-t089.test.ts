import { describe, expect, it } from "vitest";
import { auctionBiddingLayout } from "./tabletop-kernels";

describe("T089 gallery lot prop density", () => {
  it("dresses auction desk with shared stands/pedestals/crates", () => {
    const layout = auctionBiddingLayout({
      chips: [40, 40],
      currentBid: 5,
      highBidder: 0,
      phase: "open",
      gallery: {
        currentLot: { id: "L1", name: "港湾", artistId: "a1", reserve: 3 },
        artists: [{ id: "a1", name: "甲" }, { id: "a2", name: "乙" }],
        marketPrices: { a1: 2, a2: 1 },
        auctionHand: [[{ id: "p1", name: "手1" }], []],
        collection: [[{ id: "c1", name: "藏1" }], []],
        round: 1,
      },
    });
    const stands = layout.pieces.filter((p) => p.id.startsWith("gallery:stand:"));
    const pedestals = layout.pieces.filter((p) => p.id.startsWith("gallery:pedestal:"));
    const crates = layout.pieces.filter((p) => p.id.startsWith("gallery:crate:"));
    const plinths = layout.pieces.filter((p) => p.id.endsWith(":plinth"));
    // T134 may raise counts; keep T089 floors
    expect(stands.length).toBeGreaterThanOrEqual(4);
    expect(pedestals.length).toBeGreaterThanOrEqual(4);
    expect(crates.length).toBeGreaterThanOrEqual(4);
    expect(plinths.length).toBeGreaterThanOrEqual(1);
  });

  it("enlarges offer-phase hand lots for stage-wide", () => {
    const layout = auctionBiddingLayout({
      chips: [30, 30],
      phase: "offer",
      gallery: {
        auctioneer: 0,
        currentMode: "open",
        auctionHand: [
          [
            { id: "h1", name: "晨光", artistId: "a1" },
            { id: "h2", name: "暮色", artistId: "a2" },
          ],
          [],
        ],
        artists: [{ id: "a1", name: "甲" }],
      },
    });
    const hands = layout.pieces.filter((p) => p.id.startsWith("lot:hand:"));
    expect(hands.length).toBeGreaterThanOrEqual(2);
    expect(hands.every((p) => (p.size ?? 0) >= 1.35)).toBe(true);
  });
});
