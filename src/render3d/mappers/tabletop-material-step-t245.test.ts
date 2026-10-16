import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  PATTERN_STRENGTH_WITH_PBR,
  PBR_TINT_TO_WHITE,
  SOFT_EDGE_STRENGTH,
  ENV_REFLECTION_MAX_ROUGHNESS,
} from "../materials";

describe("T245 MaterialLibrary / shader product step", () => {
  it("raises PBR relief + wood/felt shader identity without suite fork", () => {
    expect(PATTERN_STRENGTH_WITH_PBR).toBeGreaterThanOrEqual(0.7);
    expect(PBR_TINT_TO_WHITE).toBeLessThanOrEqual(0.15);
    expect(SOFT_EDGE_STRENGTH).toBeGreaterThanOrEqual(0.8);
    expect(ENV_REFLECTION_MAX_ROUGHNESS).toBeGreaterThanOrEqual(0.62);
    const src = readFileSync("src/render3d/materials.ts", "utf8");
    expect(src).toContain("lathe-turned wood");
    expect(src).toContain("pressed felt / paperboard");
    expect(src).toContain("kraft paperboard");
    expect(src).toContain("T245");
    expect(src).not.toMatch(/suite === ["']H0/);
  });
});
