import { describe, expect, it } from "vitest";
import { defaultRenderSpec } from "./render-spec";

describe("T061 tabletop material/lighting contrast", () => {
  it("desk kernels: hotter key light, sharper shadows, glossier piece/card/resource", () => {
    for (const k of ["gem-engine-v1", "pattern-draft-v1", "auction-bidding-v1"] as const) {
      const r = defaultRenderSpec(k, "table");
      expect(r.lighting.sun.intensity).toBeGreaterThanOrEqual(3.0);
      expect(r.lighting.shadow.softness).toBeLessThanOrEqual(0.8);
      expect(r.materials.piece!.roughness).toBeLessThanOrEqual(0.4);
      expect((r.materials.piece!.clearcoat ?? 0)).toBeGreaterThanOrEqual(0.4);
      expect(r.materials.card!.roughness).toBeLessThanOrEqual(0.5);
      expect(r.materials.resource!.metalness).toBeGreaterThanOrEqual(0.2);
      // Ban theme texture specials on core kit
      expect(r.materials.piece!.texture).toBeUndefined();
      expect(r.materials.card!.texture).toBeUndefined();
    }
  });

  it("hex-settlement lighting contrast + piece clearcoat", () => {
    const r = defaultRenderSpec("hex-settlement-v1", "table");
    expect(r.lighting.sun.intensity).toBeGreaterThanOrEqual(3.2);
    expect(r.lighting.shadow.softness).toBeLessThanOrEqual(0.8);
    expect(r.materials.piece!.roughness).toBeLessThanOrEqual(0.5);
  });
});
