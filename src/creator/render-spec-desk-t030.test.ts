import { describe, expect, it } from "vitest";
import { defaultRenderSpec } from "./render-spec";

describe("T030 desk-kernel render baseline", () => {
  for (const kernel of ["gem-engine-v1", "pattern-draft-v1", "auction-bidding-v1"] as const) {
    it(`${kernel} ships felt board + card/disc bindings + closer camera`, () => {
      const render = defaultRenderSpec(kernel, "table")!;
      expect(render.materials.board?.pattern).toBe("cloth");
      expect(render.materials.table?.pattern).toBe("grain");
      expect(render.materials.piece?.clearcoat ?? 0).toBeGreaterThan(0.2);
      expect(render.materials.card).toBeTruthy();
      const kinds = new Set(render.bindings.map((b) => b.objectKind));
      expect(kinds.has("card")).toBe(true);
      expect(kinds.has("disc")).toBe(true);
      expect(kinds.has("resource")).toBe(true);
      expect(kinds.has("building")).toBe(true);
      expect(render.camera.distance).toBeLessThanOrEqual(14);
    });
  }
});
