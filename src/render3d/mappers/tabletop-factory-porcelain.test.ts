import { describe, expect, it } from "vitest";
import { patternDraftLayout } from "./tabletop-kernels";
import { mapTabletopToScene } from "./tabletop";
import { defaultRenderSpec } from "../../creator/render-spec";
import type { TabletopRenderInput } from "./tabletop";

describe("pattern factory porcelain", () => {
  it("factory pads + center dish use porcelain-plate mesh", () => {
    const layout = patternDraftLayout({
      factories: [
        ["blue", "yellow", "red", "black"],
        ["white", "blue"],
      ],
      center: ["red", "yellow"],
      markerInCenter: false,
      seats: [
        {
          lines: [{ color: "blue", tiles: ["blue"], capacity: 1 }],
          wall: [["blue", null], [null, null]],
          floor: [],
          score: 0,
        },
      ],
    });
    expect(layout.pieces.some((p) => p.id.startsWith("factory:") && p.id.endsWith(":pad") && p.objectKind === "plate")).toBe(true);
    expect(layout.pieces.some((p) => p.id === "center:dish" && p.objectKind === "plate")).toBe(true);
    const render = defaultRenderSpec("pattern-draft-v1", "table") as TabletopRenderInput;
    const scene = mapTabletopToScene(layout, render);
    const plates = scene.model.nodes.filter((n) => n.mesh === "porcelain-plate");
    expect(plates.length).toBeGreaterThanOrEqual(2);
  });
});
