import { describe, expect, it } from "vitest";
import { defaultRenderSpec } from "../../creator/render-spec";
import { encodeLotArt, parseFaceSchema } from "./tabletop-face-schema";
import { mapTabletopToScene, type TabletopRenderInput } from "./tabletop";
import { auctionBiddingLayout } from "./tabletop-kernels";

function sampleAuction() {
  return {
    chips: [100, 90, 80, 70],
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
      auctionHand: [[], [], [], []],
      collection: [[], [], [], []],
    },
  };
}

describe("gallery lot art board", () => {
  it("emits framed-art lot + plaque market track; no open-r1 mode token", () => {
    const layout = auctionBiddingLayout(sampleAuction());
    const lot = layout.pieces.find((p) => p.id.startsWith("lot:"));
    expect(lot?.objectKind).toBe("lot");
    expect(String(lot?.label ?? "")).toMatch(/^face\|lot\|/);
    expect(layout.pieces.some((p) => p.id === "auction:mode")).toBe(false);
    expect(layout.pieces.some((p) => /open\s*r\d/i.test(String(p.label ?? "")))).toBe(false);
    const artists = layout.pieces.filter((p) => p.id.startsWith("artist:"));
    expect(artists.length).toBe(2);
    expect(artists.every((p) => p.objectKind === "plaque")).toBe(true);
    const scene = mapTabletopToScene(layout, defaultRenderSpec("auction-bidding-v1", "table") as TabletopRenderInput);
    const lotNode = scene.model.nodes.find((n) => n.id.includes("lot:paint_1") || n.id.includes("lot:"));
    expect(lotNode?.mesh).toBe("framed-art");
    expect(scene.model.nodes.some((n) => /open\s*r\d/i.test(String(n.tag ?? "")))).toBe(false);
  });

  it("offer phase shows auctioneer hand as framed-art lots (no mode token)", () => {
    const layout = auctionBiddingLayout({
      chips: [100, 100, 100, 100, 100],
      currentBid: 0,
      phase: "offer",
      gallery: {
        currentLot: null,
        currentMode: "open",
        round: 1,
        roundsToEnd: 4,
        auctioneer: 0,
        artists: [{ id: "a0", name: "青釉" }, { id: "a1", name: "赤陶" }],
        marketPrices: { a0: 0, a1: 0 },
        auctionHand: [
          [
            { id: "p1", name: "青釉·1", artistId: "a0", instanceId: "p1#0", reserve: 5 },
            { id: "p2", name: "赤陶·2", artistId: "a1", instanceId: "p2#1", reserve: 4 },
          ],
          [],
          [],
          [],
          [],
        ],
        collection: [[], [], [], [], []],
        activeFloorLots: [],
      },
    });
    expect(layout.pieces.some((p) => p.id === "auction:mode")).toBe(false);
    const hands = layout.pieces.filter((p) => p.id.startsWith("lot:hand:"));
    expect(hands.length).toBe(2);
    expect(hands.every((p) => p.objectKind === "lot")).toBe(true);
    const scene = mapTabletopToScene(layout, defaultRenderSpec("auction-bidding-v1", "table") as TabletopRenderInput);
    expect(scene.model.nodes.filter((n) => n.mesh === "framed-art").length).toBeGreaterThanOrEqual(2);
  });

  it("encodeLotArt round-trips title/reserve/bid/artist", () => {
    const raw = encodeLotArt({ title: "晨光", reserve: 3, bid: 7, artistId: "a2" });
    const parsed = parseFaceSchema(raw);
    expect(parsed?.kind).toBe("lot");
    if (parsed?.kind === "lot") {
      expect(parsed.title).toBe("晨光");
      expect(parsed.prestige).toBe(3);
      expect(parsed.bid).toBe(7);
      expect(parsed.artistId).toBe("a2");
    }
  });

  it("offer phase shows auctioneer hand as framed-art lots (no mode token)", () => {
    const layout = auctionBiddingLayout({
      chips: [100, 100, 100, 100, 100],
      currentBid: 0,
      phase: "offer",
      gallery: {
        currentLot: null,
        currentMode: "open",
        round: 1,
        roundsToEnd: 4,
        auctioneer: 0,
        artists: [{ id: "a0", name: "青釉" }, { id: "a1", name: "赤陶" }],
        marketPrices: { a0: 0, a1: 0 },
        auctionHand: [
          [
            { id: "p1", name: "青釉·1", artistId: "a0", instanceId: "p1#0", reserve: 5 },
            { id: "p2", name: "赤陶·2", artistId: "a1", instanceId: "p2#1", reserve: 4 },
          ],
          [],
          [],
          [],
          [],
        ],
        collection: [[], [], [], [], []],
        activeFloorLots: [],
      },
    });
    expect(layout.pieces.some((p) => p.id === "auction:mode")).toBe(false);
    const hands = layout.pieces.filter((p) => p.id.startsWith("lot:hand:"));
    expect(hands.length).toBe(2);
    expect(hands.every((p) => p.objectKind === "lot")).toBe(true);
    const scene = mapTabletopToScene(layout, defaultRenderSpec("auction-bidding-v1", "table") as TabletopRenderInput);
    expect(scene.model.nodes.filter((n) => n.mesh === "framed-art").length).toBeGreaterThanOrEqual(2);
  });

});
