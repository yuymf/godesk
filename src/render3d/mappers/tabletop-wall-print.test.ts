import { describe, expect, it } from "vitest";
import { defaultRenderSpec } from "../../creator/render-spec";
import { patternDraftLayout, wallPrintColorAt } from "./tabletop-kernels";
import { mapTabletopToScene, type TabletopRenderInput } from "./tabletop";

describe("pattern wall print + glazed readable", () => {
  it("wallPrintColorAt rotates distinct hues", () => {
    const hues = new Set<string>();
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) hues.add(wallPrintColorAt(r, c));
    expect(hues.size).toBe(5);
    expect(wallPrintColorAt(0, 0)).toBe("blue");
  });

  it("empty wall slots are square hue prints — not pure-black disc pits", () => {
    const layout = patternDraftLayout({
      factories: [],
      center: [],
      seats: [
        {
          lines: [],
          wall: Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => null)),
          floor: [],
          score: 0,
        },
      ],
    });
    const empties = layout.pieces.filter((p) => /^seat:0:wall:\d+:\d+$/.test(p.id));
    expect(empties).toHaveLength(25);
    expect(empties.every((p) => p.objectKind === "wall-slot")).toBe(true);
    expect(empties.every((p) => p.tint && p.tint !== "#292524" && p.tint !== "#000000")).toBe(true);
    const tints = new Set(empties.map((p) => p.tint));
    expect(tints.size).toBeGreaterThanOrEqual(5);

    const scene = mapTabletopToScene(
      layout,
      defaultRenderSpec("pattern-draft-v1", "table") as TabletopRenderInput,
    );
    const nodes = scene.model.nodes.filter((n) => /seat:0:wall:\d+:\d+/.test(n.id));
    expect(nodes.every((n) => n.mesh === "tile-square")).toBe(true);
    expect(nodes.some((n) => n.mesh === "disc")).toBe(false);
  });

  it("glazed-on-wall tiles stay countable and distinct from empty print", () => {
    const layout = patternDraftLayout({
      factories: [],
      center: [],
      seats: [
        {
          lines: [],
          wall: [
            ["blue", null, null, null, null],
            [null, "yellow", null, null, null],
            [null, null, "red", null, null],
            [null, null, null, null, null],
            [null, null, null, null, null],
          ],
          floor: [],
          score: 0,
        },
      ],
    });
    const glazed = layout.pieces.filter((p) => /^seat:0:wall:\d+:\d+$/.test(p.id) && p.objectKind === "tile");
    const prints = layout.pieces.filter((p) => /^seat:0:wall:\d+:\d+$/.test(p.id) && p.objectKind === "wall-slot");
    expect(glazed).toHaveLength(3);
    expect(prints).toHaveLength(22);
    expect(glazed.map((p) => p.tint)).toEqual(["#3b82f6", "#eab308", "#ef4444"]);
    expect(glazed.every((p) => !prints.some((e) => e.tint === p.tint))).toBe(true);

    const scene = mapTabletopToScene(
      layout,
      defaultRenderSpec("pattern-draft-v1", "table") as TabletopRenderInput,
    );
    expect(scene.model.nodes.filter((n) => n.mesh === "glazed-tile" && /seat:0:wall:/.test(n.id)).length).toBe(3);
    expect(scene.model.nodes.filter((n) => n.mesh === "tile-square" && /seat:0:wall:/.test(n.id)).length).toBe(22);
  });
});
