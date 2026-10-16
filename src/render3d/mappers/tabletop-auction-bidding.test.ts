import { describe, expect, it } from "vitest";
import { defaultRenderSpec } from "../../creator/render-spec";
import { mapTabletopToScene, type TabletopRenderInput } from "./tabletop";
import { auctionBiddingLayout } from "./tabletop-kernels";
import { layoutForStage } from "../../creator/tabletop-stage-layout";

const renderFor = () => defaultRenderSpec("auction-bidding-v1", "table") as TabletopRenderInput;

function sampleAuction() {
  return {
    chips: [100, 90, 80, 70, 60],
    scores: [0, 0, 0, 0, 0],
    currentBid: 5,
    highBidder: 1,
    phase: "bidding",
    lotId: "paint_1",
    gallery: {
      currentLot: { id: "paint_1", name: "青釉·1", artistId: "a0", reserve: 5 },
      companionLot: null,
      currentMode: "open",
      round: 1,
      roundsToEnd: 4,
      auctioneer: 0,
      artists: [
        { id: "a0", name: "青釉" },
        { id: "a1", name: "赤陶" },
      ],
      marketPrices: { a0: 10, a1: 0 },
      auctionHand: [[{ id: "h0", name: "手1", artistId: "a0" }], [], [], [], []],
      collection: [[], [{ id: "c1", name: "藏1", artistId: "a1" }], [], [], []],
    },
  };
}

describe("T028 auction-bidding tabletop layout", () => {
  it("emits lot / seats / artists for gallery subset", () => {
    const layout = auctionBiddingLayout(sampleAuction());
    expect(layout.kernelType).toBe("auction-bidding-v1");
    expect(layout.pieces.some((p) => p.id.startsWith("lot:"))).toBe(true);
    expect(layout.pieces.some((p) => p.id.startsWith("seat:0:"))).toBe(true);
    expect(layout.pieces.some((p) => p.id.startsWith("seat:4:"))).toBe(true);
    expect(layout.pieces.some((p) => p.id.startsWith("artist:"))).toBe(true);
    expect(layout.hints.some((h) => h.action.type === "bid")).toBe(true);
  });

  it("maps through shared TabletopStage pipeline", () => {
    const layout = layoutForStage({
      kernel: "auction-bidding-v1",
      state: sampleAuction(),
      legal: undefined,
      onAct: undefined,
    });
    const scene = mapTabletopToScene(layout, renderFor());
    expect(scene.model.nodes.some((n) => n.kind === "piece")).toBe(true);
  });
});
