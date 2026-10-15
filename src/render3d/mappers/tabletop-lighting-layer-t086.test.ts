import { describe, expect, it } from "vitest";
import { defaultRenderSpec } from "../../creator/render-spec";
import { SCENE_TOKENS, HEX_ISLAND_LIGHTING } from "../tokens";

describe("T086 tabletop lighting layer rig", () => {
  it("SCENE_TOKENS and HEX_ISLAND_LIGHTING expose fill + rim", () => {
    expect(SCENE_TOKENS.lighting.fill?.intensity).toBeGreaterThan(0);
    expect(SCENE_TOKENS.lighting.rim?.intensity).toBeGreaterThan(0);
    expect(HEX_ISLAND_LIGHTING.fill?.intensity).toBeGreaterThan(0);
    expect(HEX_ISLAND_LIGHTING.rim?.intensity).toBeGreaterThan(0);
  });

  it("desk kernels ship fill/rim in defaultRenderSpec", () => {
    for (const k of ["gem-engine-v1", "pattern-draft-v1", "auction-bidding-v1", "network-route-v1"]) {
      const lighting = defaultRenderSpec(k, "table")!.lighting;
      expect(lighting.fill?.intensity).toBeGreaterThan(0);
      expect(lighting.rim?.intensity).toBeGreaterThan(0);
    }
  });
});
