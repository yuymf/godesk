import { describe, expect, it } from "vitest";
import { defaultRenderSpec } from "../../creator/render-spec";
import { gemEngineLayout, patternDraftLayout } from "./tabletop-kernels";
import { mapTabletopToScene, type TabletopRenderInput } from "./tabletop";

describe("T038 lighting + contact shadows", () => {
  it("desk lighting: soft shadows + felt board eats light (high roughness)", () => {
    const render = defaultRenderSpec("gem-engine-v1", "table")!;
    expect(render.lighting.shadow.enabled).toBe(true);
    expect(render.lighting.shadow.softness).toBeGreaterThanOrEqual(0.95);
    expect(render.materials.board?.pattern).toBe("cloth");
    expect(render.materials.board?.roughness ?? 0).toBeGreaterThanOrEqual(0.92);
    // glossy pieces stay env-eligible
    expect(render.materials.resource?.roughness ?? 1).toBeLessThanOrEqual(0.6);
  });

  it("scene emits contact-shadow under discs; cards/plaques/tiles get group shadows via mesh kinds", () => {
    const layout = gemEngineLayout({
      bank: { white: 3, blue: 0, green: 0, red: 0, black: 0, gold: 0 },
      market: [[{ id: "c", discount: "blue", prestige: 1, cost: { white: 1 } }], [], []],
      nobles: [{ id: "n1", name: "白蓝勋爵", prestige: 3, requirements: { white: 3, blue: 3 } }],
      seats: [{ gems: { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 }, prestige: 0 }],
    });
    const scene = mapTabletopToScene(layout, defaultRenderSpec("gem-engine-v1", "table") as TabletopRenderInput);
    expect(scene.model.nodes.some((n) => n.mesh === "card")).toBe(true);
    expect(scene.model.nodes.some((n) => n.mesh === "plaque")).toBe(true);
    expect(scene.model.nodes.some((n) => n.mesh === "gem-chip")).toBe(true);

    const pattern = patternDraftLayout({
      factories: [["blue", "red", "white", "yellow"]],
      center: [],
      seats: [{ lines: [], wall: [], floor: [], score: 0 }],
    });
    const pScene = mapTabletopToScene(pattern, defaultRenderSpec("pattern-draft-v1", "table") as TabletopRenderInput);
    expect(pScene.model.nodes.some((n) => n.mesh === "glazed-tile")).toBe(true);
    expect(pScene.model.nodes.some((n) => n.mesh === "contact-shadow")).toBe(true);
    // no F0 parchment boards
    expect(pScene.model.nodes.some((n) => n.kind === "label" && /^F\d+$/i.test(String(n.tag ?? "")))).toBe(false);
  });
});
