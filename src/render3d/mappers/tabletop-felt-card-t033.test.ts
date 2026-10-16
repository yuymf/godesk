import { describe, expect, it } from "vitest";
import { defaultRenderSpec } from "../../creator/render-spec";
import { gemEngineLayout } from "./tabletop-kernels";
import { mapTabletopToScene, type TabletopRenderInput } from "./tabletop";

describe("T033 felt inset + card/camera baseline", () => {
  it("desk render ships closer camera framing the card zone", () => {
    const render = defaultRenderSpec("gem-engine-v1", "table")!;
    expect(render.camera.distance).toBeLessThanOrEqual(13);
    expect(render.camera.fovDeg).toBeLessThanOrEqual(30);
    expect(render.materials.board?.pattern).toBe("cloth");
    expect(render.materials.table?.pattern).toBe("grain");
    expect(render.materials.resource?.clearcoat ?? 0).toBeGreaterThan(0.5);
    expect(render.bindings.some((b) => b.objectKind === "resource" && b.mesh === "gem-chip")).toBe(true);
  });

  it("mapTabletopToScene emits wood rim + felt board for cloth desks", () => {
    const render = defaultRenderSpec("gem-engine-v1", "table") as TabletopRenderInput;
    const layout = gemEngineLayout({
      bank: { white: 2, blue: 0, green: 0, red: 0, black: 0, gold: 0 },
      market: [[{ id: "c", discount: "white", prestige: 1 }], [], []],
      nobles: [],
      seats: [{ gems: { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 }, prestige: 0, cards: [], reserved: [] }],
    });
    const scene = mapTabletopToScene(layout, render);
    expect(scene.model.nodes.some((n) => n.id === "board-rim")).toBe(true);
    expect(scene.model.nodes.some((n) => n.id === "board")).toBe(true);
    const card = scene.model.nodes.find((n) => n.kind === "piece" && n.mesh === "card");
    expect(card?.tag).toBeTruthy();
  });
});
