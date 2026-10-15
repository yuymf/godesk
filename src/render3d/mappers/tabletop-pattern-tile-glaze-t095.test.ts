import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T095 pattern tile glaze microdetail", () => {
  it("glazedTileWithFace builds glaze albedo + roughness maps", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T095");
    expect(src).toContain("tileGlazeMaps");
    expect(src).toMatch(/glazedTileWithFace[\s\S]*roughnessMap/);
    expect(src).toMatch(/MeshPhysicalMaterial/);
  });

  it("porcelainPlate T076 path still present (not whitewashed)", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T076");
    expect(src).toContain("porcelainPlate");
    expect(src).toContain("tt-porcelain-glaze");
  });

  it("glazed-tile still adds contact shadow (T081)", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toMatch(/mesh === "glazed-tile"[\s\S]{0,250}softContactShadow/);
  });
});
