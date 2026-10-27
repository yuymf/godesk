import { describe, expect, it } from "vitest";
import { defaultRenderSpec } from "../../creator/render-spec";
import { mapTabletopToScene, type TabletopRenderInput } from "./tabletop";
import { auctionBiddingLayout } from "./tabletop-kernels";

describe("seat cash off desk debug billboards", () => {
  it("auction chip stacks have no numeric desk labels; scene has no pure-number billboards", () => {
    const layout = auctionBiddingLayout({
      chips: [100, 90, 80, 70],
      currentBid: 12,
      highBidder: 1,
      phase: "bidding",
      gallery: {
        currentLot: { id: "l1", name: "晨光", artistId: "a0", reserve: 5 },
        currentMode: "open",
        round: 1,
        roundsToEnd: 4,
        artists: [{ id: "a0", name: "青釉" }],
        marketPrices: { a0: 10 },
        auctionHand: [[], [], [], []],
        collection: [[], [], [], []],
        auctioneer: 0,
      },
    });
    const chips = layout.pieces.filter((p) => p.id.includes(":chip:"));
    expect(chips.length).toBeGreaterThan(0);
    expect(chips.every((p) => !p.label || !/^\$?\d+$/.test(String(p.label)))).toBe(true);
    expect(layout.pieces.some((p) => p.label && /^S\d+:\$/.test(p.label))).toBe(false);
    const scene = mapTabletopToScene(layout, defaultRenderSpec("auction-bidding-v1", "table") as TabletopRenderInput);
    const billboards = scene.model.nodes.filter((n) => n.kind === "label" && /^\$?\d+$/.test(String(n.tag ?? "")));
    expect(billboards).toEqual([]);
  });
});
