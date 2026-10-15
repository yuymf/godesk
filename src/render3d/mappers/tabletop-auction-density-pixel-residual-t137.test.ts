import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { auctionBiddingLayout } from "./tabletop-kernels";

describe("T137 auction density pixel residual", () => {
  it("raises lot face ink/rim without cutting T134 density floors", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T137");
    expect(src).toContain("T075");
    expect(src).toMatch(/strokeRect\((6|4|3|2),\s*\1/);
    expect(src).toMatch(/bold (26|28|30|32)px/);
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
    expect(layout.pieces.filter((p) => p.id.startsWith("gallery:crate:")).length).toBeGreaterThanOrEqual(8);
    expect(layout.pieces.filter((p) => /^gallery:display:\d+$/.test(p.id)).length).toBeGreaterThanOrEqual(7);
  });
});
