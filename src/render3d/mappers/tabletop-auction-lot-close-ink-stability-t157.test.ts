import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { auctionBiddingLayout } from "./tabletop-kernels";

describe("T157 auction lot close ink stability", () => {
  it("keeps absolute-ink stability floor and light lot shadow under co-shipped residuals", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T157");
    expect(src).toMatch(/absolute-ink stability|ink-stable lot shadow/);
    expect(src).toMatch(/rgba\(255,252,245,0\.88\)/);
    expect(src).toMatch(/opacity: 0\.12/);
    expect(src).toMatch(/#b08858|#a07848/);
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
    expect(layout.pieces.filter((p) => p.id.startsWith("gallery:stand:")).length).toBeGreaterThanOrEqual(8);
  });
});
