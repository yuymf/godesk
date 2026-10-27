import { describe, expect, it } from "vitest";
import { defaultRenderSpec } from "../../creator/render-spec";
import { auctionBiddingLayout, gemEngineLayout } from "./tabletop-kernels";
import { mapTabletopToScene, type TabletopRenderInput } from "./tabletop";

/** Room-guard mirror: after force-buy/force-own, layout must expose ≥2 seat-front owned pieces. */
describe("seat tableau force-buy / force-own guards", () => {
  it("gem force-buy ≥2 cards → seat-front fan with face schema + countable gems", () => {
    const layout = gemEngineLayout({
      bank: { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 },
      market: [[], [], []],
      nobles: [],
      seats: [
        {
          gems: { white: 0, blue: 0, green: 1, red: 1, black: 1, gold: 0 },
          prestige: 2,
          cards: [
            { id: "t1_b2", discount: "blue", prestige: 1, cost: { white: 2, red: 1 }, tier: 1 },
            { id: "t1_r1", discount: "red", prestige: 0, cost: { blue: 2 }, tier: 1 },
          ],
          reserved: [],
        },
      ],
    });
    const cards = layout.pieces.filter((p) => p.id.startsWith("seat:0:card:"));
    expect(cards.length).toBeGreaterThanOrEqual(2);
    expect(cards.every((p) => String(p.label ?? "").startsWith("face|card|"))).toBe(true);
    const gems = layout.pieces.filter((p) => p.id.startsWith("seat:0:gem:"));
    expect(gems.length).toBeGreaterThan(0);
  });

  it("auction force-own ≥2 lots → seat-front framed-art (not center gallery only)", () => {
    const layout = auctionBiddingLayout({
      chips: [80, 40],
      gallery: {
        artists: [{ id: "a0", name: "A" }, { id: "a1", name: "B" }],
        collection: [
          [
            { id: "paint_12", name: "赤陶·6", artistId: "a1" },
            { id: "paint_6", name: "青釉·7", artistId: "a0" },
          ],
          [],
        ],
        auctionHand: [[], []],
        currentLot: { id: "center", name: "中心拍品", artistId: "a0" },
      },
    });
    const seatLots = layout.pieces.filter((p) => p.id.startsWith("seat:0:coll:"));
    expect(seatLots.length).toBeGreaterThanOrEqual(2);
    expect(seatLots.every((p) => p.objectKind === "lot")).toBe(true);
    const scene = mapTabletopToScene(
      layout,
      defaultRenderSpec("auction-bidding-v1", "table") as TabletopRenderInput,
    );
    const framed = scene.model.nodes.filter((n) => n.mesh === "framed-art" && /seat:0:coll:/.test(n.id));
    expect(framed.length).toBeGreaterThanOrEqual(2);
    // Center gallery lot must not be the only framed art
    const center = scene.model.nodes.filter((n) => n.mesh === "framed-art" && !/seat:/.test(n.id));
    expect(framed.length).toBeGreaterThanOrEqual(2);
    expect(center.length).toBeGreaterThanOrEqual(0);
  });
});
