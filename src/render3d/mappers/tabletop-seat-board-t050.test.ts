import { describe, expect, it } from "vitest";
import { defaultRenderSpec } from "../../creator/render-spec";
import { patternDraftLayout } from "./tabletop-kernels";
import { mapTabletopToScene, type TabletopRenderInput } from "./tabletop";

describe("T050 pattern seat board — lines + 5×5 wall slots", () => {
  it("emits pattern line slots and 5×5 wall grid; forbids blank wall:board slab", () => {
    const layout = patternDraftLayout({
      factories: [["blue", "red", "white", "yellow"]],
      center: [],
      seats: [
        {
          lines: [
            { color: "blue", tiles: ["blue"], capacity: 1 },
            { color: null, tiles: [], capacity: 2 },
            { color: "red", tiles: ["red", "red"], capacity: 3 },
            { color: null, tiles: [], capacity: 4 },
            { color: null, tiles: [], capacity: 5 },
          ],
          wall: [
            ["blue", null, null, null, null],
            [null, "red", null, null, null],
            [null, null, null, null, null],
            [null, null, null, null, null],
            [null, null, null, null, null],
          ],
          floor: [],
          score: 0,
        },
      ],
    });
    expect(layout.pieces.some((p) => p.id === "seat:0:wall:board")).toBe(false);
    expect(layout.pieces.some((p) => p.objectKind === "region" && p.id.includes(":wall:"))).toBe(false);

    const lineTroughs = layout.pieces.filter((p) => /^seat:0:line:\d+:trough$/.test(p.id));
    const lineTiles = layout.pieces.filter((p) => p.id.startsWith("seat:0:line:") && p.objectKind === "tile");
    // T058: 5 trough beds + filled glazed tiles only (no round empty pits)
    expect(lineTroughs).toHaveLength(5);
    expect(lineTiles).toHaveLength(3);
    expect(layout.pieces.some((p) => p.id.startsWith("seat:0:line:") && p.objectKind === "slot")).toBe(false);
    expect(layout.pieces.some((p) => p.id === "seat:0:floor:trough")).toBe(true);

    const wall = layout.pieces.filter((p) => /^seat:0:wall:\d+:\d+$/.test(p.id));
    expect(wall).toHaveLength(25);
    expect(wall.filter((p) => p.objectKind === "tile")).toHaveLength(2);
    expect(wall.filter((p) => p.objectKind === "wall-slot" || p.objectKind === "slot")).toHaveLength(23);
    expect(wall.filter((p) => p.objectKind === "tile").every((p) => p.tint && p.tint !== "#292524")).toBe(true);

    const scene = mapTabletopToScene(layout, defaultRenderSpec("pattern-draft-v1", "table") as TabletopRenderInput);
    const wallNodes = scene.model.nodes.filter((n) => /seat:0:wall:\d+:\d+/.test(n.id));
    expect(wallNodes.length).toBeGreaterThanOrEqual(25);
    // slots bind to disc, tiles to glazed-tile
    expect(wallNodes.some((n) => n.mesh === "glazed-tile")).toBe(true);
    expect(wallNodes.some((n) => n.mesh === "tile-square" || n.mesh === "disc")).toBe(true);
  });

  it("empty seat still shows readable 5×5 + pattern lines (not a blank marble slab)", () => {
    const layout = patternDraftLayout({
      factories: [],
      center: [],
      seats: [{ lines: [], wall: [], floor: [], score: 0 }],
    });
    expect(layout.pieces.some((p) => p.id.includes("wall:board"))).toBe(false);
    expect(layout.pieces.filter((p) => /^seat:0:wall:\d+:\d+$/.test(p.id))).toHaveLength(25);
    expect(layout.pieces.filter((p) => /^seat:0:line:\d+:trough$/.test(p.id)).length).toBe(5);
    expect(layout.pieces.some((p) => p.id === "seat:0:floor:trough")).toBe(true);
  });
});
