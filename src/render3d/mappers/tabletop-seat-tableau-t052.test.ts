import { describe, expect, it } from "vitest";
import { defaultRenderSpec } from "../../creator/render-spec";
import {
  auctionBiddingLayout,
  gemEngineLayout,
  patternDraftLayout,
  seatTableauOrigin,
} from "./tabletop-kernels";
import { mapTabletopToScene, type TabletopRenderInput } from "./tabletop";

describe("T052 shared seat tableau — owned pieces on desk", () => {
  it("seatTableauOrigin places owned zone toward board center", () => {
    const a = seatTableauOrigin(0, 2);
    const b = seatTableauOrigin(1, 2);
    expect(a.zOwned).toBeLessThan(a.zMeeple);
    expect(b.x0).toBeGreaterThan(a.x0);
  });

  it("gem purchased cards fan in seat-front with face schema", () => {
    const layout = gemEngineLayout({
      bank: { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 },
      market: [[], [], []],
      nobles: [],
      seats: [
        {
          gems: { white: 2, blue: 0, green: 0, red: 0, black: 0, gold: 0 },
          prestige: 3,
          cards: [
            { id: "c1", discount: "blue", prestige: 1, cost: { white: 2 }, tier: 1 },
            { id: "c2", discount: "red", prestige: 0, cost: { blue: 1 }, tier: 1 },
          ],
          reserved: [],
        },
      ],
    });
    const cards = layout.pieces.filter((p) => p.id.startsWith("seat:0:card:"));
    expect(cards.length).toBe(2);
    expect(cards.every((p) => p.objectKind === "card")).toBe(true);
    expect(cards.every((p) => String(p.label ?? "").startsWith("face|card|"))).toBe(true);
    const marker = layout.pieces.find((p) => p.id === "seat:0:marker")!;
    expect(cards.every((p) => p.z < marker.z)).toBe(true); // in front toward center
    const gems = layout.pieces.filter((p) => p.id.startsWith("seat:0:gem:"));
    expect(gems.length).toBeGreaterThan(0);
  });

  it("auction owned lots map to seat-front framed-art thumbnails", () => {
    const layout = auctionBiddingLayout({
      chips: [80, 40],
      highBidder: 0,
      gallery: {
        artists: [{ id: "a1", name: "A" }],
        collection: [[{ id: "p1", name: "海港", artistId: "a1" }, { id: "p2", name: "雾桥" }], []],
        auctionHand: [[{ id: "h1", name: "手1" }], []],
      },
    });
    const lots = layout.pieces.filter((p) => p.id.startsWith("seat:0:coll:"));
    expect(lots.length).toBe(2);
    expect(lots.every((p) => p.objectKind === "lot")).toBe(true);
    expect(lots.every((p) => String(p.label ?? "").startsWith("face|lot|"))).toBe(true);
    const scene = mapTabletopToScene(layout, defaultRenderSpec("auction-bidding-v1", "table") as TabletopRenderInput);
    expect(scene.model.nodes.filter((n) => n.mesh === "framed-art" && /seat:0:coll:/.test(n.id)).length).toBeGreaterThanOrEqual(2);
  });

  it("pattern seat wall remains the T050 tableau (owned wall tiles)", () => {
    const layout = patternDraftLayout({
      factories: [],
      center: [],
      seats: [
        {
          lines: [{ color: "blue", tiles: ["blue"], capacity: 1 }],
          wall: [["blue", null, null, null, null], [null, null, null, null, null], [null, null, null, null, null], [null, null, null, null, null], [null, null, null, null, null]],
          floor: [],
          score: 0,
        },
      ],
    });
    expect(layout.pieces.filter((p) => /^seat:0:wall:\d+:\d+$/.test(p.id))).toHaveLength(25);
    expect(layout.pieces.some((p) => p.id === "seat:0:wall:0:0" && p.objectKind === "tile")).toBe(true);
  });
});
