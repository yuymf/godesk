import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T183 H01 soft residual → shared hard pixel", () => {
  it("lifts shared TERRAIN_MATERIALS / saturation (MaterialLibrary, not suite fork)", () => {
    const tokens = readFileSync("src/render3d/tokens.ts", "utf8");
    expect(tokens).toContain("T183");
    expect(tokens).toMatch(/#18a438/);
    expect(tokens).toMatch(/#f8f048/);
    const mats = readFileSync("src/render3d/materials.ts", "utf8");
    expect(mats).toMatch(/TERRAIN_SATURATION = (1\.(48|58|72|95)|2\.(05|12|18|28|32|55|62|70))/);
    expect(tokens).not.toMatch(/suite === ["']H01["']/);
  });

  it("bumps shared seat tray, water, and felt weave", () => {
    const pieces = readFileSync("src/render3d/assets/pieces.ts", "utf8");
    expect(pieces).toMatch(/MEEPLE_HEX_SCALE = 1\.74/);
    const water = readFileSync("src/render3d/water/mesh.ts", "utf8");
    expect(water).toMatch(/#08e8d8/);
    const objs = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(objs).toMatch(/Vector2\(4\.95,\s*4\.95\)/);
  });
});
