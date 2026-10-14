import { describe, expect, it } from "vitest";
import { defaultRenderSpec } from "../../creator/render-spec";
import { patternDraftLayout } from "./tabletop-kernels";
import { mapTabletopToScene, type TabletopRenderInput } from "./tabletop";

describe("T059 pattern force-draft → glazed line bricks + floor", () => {
  it("filled pattern lines emit glazed tiles above troughs; floor discs distinct from wall print", () => {
    const layout = patternDraftLayout({
      factories: [],
      center: [],
      seats: [
        {
          lines: [
            { color: "blue", tiles: ["blue"], capacity: 1 },
            { color: "red", tiles: ["red", "red"], capacity: 2 },
            { color: null, tiles: [], capacity: 3 },
            { color: null, tiles: [], capacity: 4 },
            { color: null, tiles: [], capacity: 5 },
          ],
          wall: Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => null)),
          floor: ["yellow", "black"],
          score: 0,
        },
      ],
    });
    const troughs = layout.pieces.filter((p) => p.objectKind === "line-trough");
    expect(troughs.length).toBeGreaterThanOrEqual(6);
    const lineTiles = layout.pieces.filter(
      (p) => p.objectKind === "tile" && /^seat:0:line:/.test(p.id),
    );
    expect(lineTiles.length).toBe(3); // 1 + 2
    expect(lineTiles.every((t) => (t.size ?? 0) >= 0.2)).toBe(true);
    const floorTiles = layout.pieces.filter(
      (p) => p.objectKind === "disc" && /^seat:0:floor:\d/.test(p.id),
    );
    expect(floorTiles.length).toBeGreaterThanOrEqual(2);

    const scene = mapTabletopToScene(
      layout,
      defaultRenderSpec("pattern-draft-v1", "table") as TabletopRenderInput,
    );
    expect(scene.model.nodes.some((n) => n.mesh === "glazed-tile")).toBe(true);
    expect(scene.model.nodes.filter((n) => n.mesh === "line-trough").length).toBeGreaterThanOrEqual(6);
    // Wall empties remain square prints (T054), not counted as line bricks
    expect(scene.model.nodes.filter((n) => n.mesh === "tile-square" && /wall:/.test(n.id)).length).toBe(25);
  });
});
