import { describe, expect, it } from "vitest";
import { defaultRenderSpec } from "../../creator/render-spec";
import { gemEngineLayout } from "./tabletop-kernels";
import { mapTabletopToScene, type TabletopRenderInput } from "./tabletop";

describe("felt table product frame", () => {
  it("desk scenes emit wood rim, felt inset, stitch, and vignette", () => {
    const layout = gemEngineLayout({
      bank: { white: 1, blue: 0, green: 0, red: 0, black: 0, gold: 0 },
      market: [[], [], []],
      nobles: [],
      seats: [{ gems: { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 }, prestige: 0 }],
    });
    const scene = mapTabletopToScene(layout, defaultRenderSpec("gem-engine-v1", "table") as TabletopRenderInput);
    const meshes = scene.model.nodes.map((n) => n.mesh);
    expect(meshes).toContain("felt-wood-rim");
    expect(meshes).toContain("felt-wood-lip");
    expect(meshes).toContain("felt-inset");
    expect(meshes).toContain("felt-stitch");
    expect(meshes).toContain("table-vignette");
    // contact shadows: gem-chip/card groups embed discs; disc/token nodes emit contact-shadow mesh.
    expect(scene.model.nodes.some((n) => n.mesh === "gem-chip" || n.mesh === "card" || n.mesh === "contact-shadow")).toBe(true);
  });
});
