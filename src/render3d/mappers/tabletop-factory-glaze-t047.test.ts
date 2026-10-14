import { describe, expect, it } from "vitest";
import { defaultRenderSpec } from "../../creator/render-spec";
import { patternDraftLayout } from "./tabletop-kernels";
import { mapTabletopToScene, BOARD_THICKNESS } from "./tabletop";
import type { TabletopRenderInput } from "./tabletop";

describe("T047 factory glazed tiles Room-countable above playTop", () => {
  it("maps glazed factory tiles above playTop (not buried under felt)", () => {
    const layout = patternDraftLayout({
      factories: [
        ["blue", "yellow", "red", "black"],
        ["white", "blue", "blue", "red"],
        [],
      ],
      center: ["yellow"],
      markerInCenter: true,
      seats: [
        {
          lines: [{ color: "blue", tiles: ["blue"], capacity: 1 }],
          wall: [["blue", null], [null, null]],
          floor: [],
          score: 0,
        },
      ],
    });
    const pads = layout.pieces.filter((p) => p.id.endsWith(":pad"));
    expect(pads).toHaveLength(2); // empty factory skipped (T036)
    const tiles = layout.pieces.filter((p) => p.id.includes(":tile:") && p.objectKind === "tile");
    expect(tiles.length).toBeGreaterThanOrEqual(8);
    // 2×2 countable grid per non-empty factory
    const f0 = tiles.filter((p) => p.id.startsWith("factory:0:tile:"));
    expect(f0).toHaveLength(4);
    expect(new Set(f0.map((p) => `${p.x.toFixed(2)},${p.z.toFixed(2)}`)).size).toBe(4);
    // color-distinct tints
    expect(new Set(f0.map((p) => p.tint)).size).toBe(4);

    const render = defaultRenderSpec("pattern-draft-v1", "table") as TabletopRenderInput;
    const scene = mapTabletopToScene(layout, render);
    const playTop = BOARD_THICKNESS + 0.16; // feltInset kernels
    const tileNodes = scene.model.nodes.filter(
      (n) => n.kind === "piece" && typeof n.id === "string" && n.id.includes("factory:") && n.id.includes(":tile:"),
    );
    expect(tileNodes.length).toBeGreaterThanOrEqual(8);
    for (const n of tileNodes) {
      const y = n.position?.[1] ?? 0;
      expect(y).toBeGreaterThan(playTop + 0.05);
    }
    // mesh binding: glazed-tile (not beige cube)
    expect(tileNodes.every((n) => n.mesh === "glazed-tile")).toBe(true);
  });

  it("empty factory pad is a fail — no olive disc without tiles", () => {
    const layout = patternDraftLayout({
      factories: [[], []],
      center: [],
      seats: [{ lines: [], wall: [], floor: [], score: 0 }],
    });
    expect(layout.pieces.filter((p) => p.id.endsWith(":pad"))).toHaveLength(0);
    expect(layout.pieces.filter((p) => p.objectKind === "tile")).toHaveLength(0);
  });
});
