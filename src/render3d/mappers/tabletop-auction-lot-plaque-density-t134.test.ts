import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { auctionBiddingLayout } from "./tabletop-kernels";

describe("T134 auction lot / plaque density", () => {
  it("raises shared gallery dressing without sample hacks", () => {
    const src = readFileSync("src/render3d/mappers/tabletop-kernels.ts", "utf8");
    expect(src).toContain("T134");
    expect(src).toContain("T089");
    expect(src).toMatch(/for \(let i = 0; i < 18;/);
    expect(src).toMatch(/for \(let i = 0; i < 7;/);
    expect(src).toMatch(/size: 1\.28/);
    expect(src).toMatch(/piece\.size = 1\.48/);
  });

  it("layout yields denser stands/crates/displays vs T089 floors", () => {
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
    const crates = layout.pieces.filter((p) => p.id.startsWith("gallery:crate:"));
    const displays = layout.pieces.filter((p) => /^gallery:display:\d+$/.test(p.id));
    expect(stands.length).toBeGreaterThanOrEqual(8);
    expect(crates.length).toBeGreaterThanOrEqual(8);
    expect(displays.length).toBeGreaterThanOrEqual(7);
  });
});
