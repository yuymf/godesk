import { describe, expect, it } from "vitest";
import { defaultRenderSpec } from "../../creator/render-spec";
import { auctionBiddingLayout, seatTableauOrigin } from "./tabletop-kernels";
import { mapTabletopToScene, type TabletopRenderInput } from "./tabletop";

describe("auction seat framed-art Room-visible", () => {
  it("seatTableauOrigin keeps all seats on the felt (±3.35)", () => {
    for (const n of [2, 3, 4, 5]) {
      for (let i = 0; i < n; i++) {
        const { x0 } = seatTableauOrigin(i, n, { span: 2.2, zMeeple: 2.5, depth: 0.7 });
        expect(Math.abs(x0)).toBeLessThanOrEqual(3.35 + 1e-6);
      }
    }
    const a = seatTableauOrigin(0, 5);
    const b = seatTableauOrigin(4, 5);
    expect(b.x0).toBeGreaterThan(a.x0);
  });

  it("seat:N:coll:* → framed-art nodes with readable size (not white placard scale)", () => {
    const layout = auctionBiddingLayout({
      chips: [80, 40, 40, 40, 40],
      gallery: {
        artists: [{ id: "a0", name: "A" }],
        collection: [
          [
            { id: "paint_12", name: "赤陶·6", artistId: "a1" },
            { id: "paint_6", name: "青釉·7", artistId: "a0" },
          ],
          [],
          [],
          [],
          [],
        ],
        auctionHand: [[{ id: "h1", name: "手1" }], [], [], [], []],
      },
    });
    const coll = layout.pieces.filter((p) => p.id.startsWith("seat:0:coll:"));
    expect(coll.length).toBe(2);
    expect(coll.every((p) => p.objectKind === "lot")).toBe(true);
    expect(coll.every((p) => (p.size ?? 0) >= 1.1)).toBe(true);
    expect(coll.every((p) => Math.abs(p.x) <= 4.0)).toBe(true);
    const marker = layout.pieces.find((p) => p.id === "seat:0:marker")!;
    // Owned sits just inward of meeple (camera-visible seat-front), not deep center gallery.
    expect(coll.every((p) => p.z < marker.z && p.z > marker.z - 1.2)).toBe(true);

    const scene = mapTabletopToScene(
      layout,
      defaultRenderSpec("auction-bidding-v1", "table") as TabletopRenderInput,
    );
    const framed = scene.model.nodes.filter((n) => n.mesh === "framed-art" && /seat:0:coll:/.test(n.id));
    expect(framed.length).toBeGreaterThanOrEqual(2);
    expect(framed.every((n) => Math.min(...(n.scale ?? [0])) >= 1.2)).toBe(true);
    // Center gallery lots (if any) must not be the only framed-art evidence
    const center = scene.model.nodes.filter((n) => n.mesh === "framed-art" && !/seat:/.test(n.id));
    expect(framed.length).toBeGreaterThanOrEqual(2);
    expect(center.every((n) => !/seat:0:coll:/.test(n.id))).toBe(true);
  });
});
