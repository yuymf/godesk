import { describe, expect, it } from "vitest";
import { defaultRenderSpec } from "../../creator/render-spec";
import { patternDraftLayout } from "./tabletop-kernels";
import { mapTabletopToScene, type TabletopRenderInput } from "./tabletop";

describe("pattern line trough + floor row", () => {
  it("empty lines are trough strips — not round wall-slot/disc pits", () => {
    const layout = patternDraftLayout({
      factories: [],
      center: [],
      seats: [
        {
          lines: [
            { color: null, tiles: [], capacity: 1 },
            { color: null, tiles: [], capacity: 2 },
            { color: "red", tiles: ["red", "red"], capacity: 3 },
            { color: null, tiles: [], capacity: 4 },
            { color: null, tiles: [], capacity: 5 },
          ],
          wall: Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => null)),
          floor: ["blue", "yellow"],
          score: 0,
        },
      ],
    });
    const troughs = layout.pieces.filter((p) => p.objectKind === "line-trough");
    expect(troughs.length).toBeGreaterThanOrEqual(6); // 5 lines + floor
    expect(layout.pieces.some((p) => p.id === "seat:0:floor:trough")).toBe(true);
    expect(layout.pieces.filter((p) => p.id.startsWith("seat:0:line:") && p.objectKind === "slot")).toHaveLength(0);
    expect(layout.pieces.filter((p) => p.id.startsWith("seat:0:line:") && p.objectKind === "tile")).toHaveLength(2);

    const scene = mapTabletopToScene(
      layout,
      defaultRenderSpec("pattern-draft-v1", "table") as TabletopRenderInput,
    );
    expect(scene.model.nodes.some((n) => n.mesh === "line-trough")).toBe(true);
    // Wall empties remain square prints (T054), distinct from line troughs
    expect(scene.model.nodes.filter((n) => n.mesh === "tile-square" && /wall:/.test(n.id)).length).toBe(25);
  });
});
