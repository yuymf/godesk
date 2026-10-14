import { describe, expect, it } from "vitest";
import { defaultRenderSpec } from "../../creator/render-spec";
import { mapTabletopToScene, type TabletopRenderInput } from "./tabletop";
import { gemEngineLayout } from "./tabletop-kernels";

describe("T044 product green felt cloth", () => {
  it("desk kernels bind saturated green cloth board with high roughness", () => {
    for (const kernel of ["gem-engine-v1", "pattern-draft-v1", "auction-bidding-v1"] as const) {
      const spec = defaultRenderSpec(kernel, "table")!;
      const board = spec.materials.board;
      expect(board.pattern).toBe("cloth");
      expect(board.roughness).toBeGreaterThanOrEqual(0.95);
      const hex = board.base.replace("#", "");
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      expect(g).toBeGreaterThan(r);
      expect(g).toBeGreaterThan(b);
      expect(g).toBeGreaterThan(60);
    }
  });

  it("maps gem layout to felt-inset using board cloth material", () => {
    const layout = gemEngineLayout({
      bank: { white: 1, blue: 0, green: 0, red: 0, black: 0, gold: 0 },
      market: [[], [], []],
      nobles: [],
      seats: [{ prestige: 0, gems: { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 } }],
    });
    const scene = mapTabletopToScene(layout, defaultRenderSpec("gem-engine-v1", "table") as TabletopRenderInput);
    const felt = scene.model.nodes.find((n) => n.mesh === "felt-inset");
    expect(felt).toBeTruthy();
    expect(String(felt?.material ?? "")).toMatch(/board/);
  });
});
