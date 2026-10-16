import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T229 shared terrain prop + hex cardboard productization", () => {
  it("raises prop mesh density and cardboard bevel without suite fork", () => {
    const tokens = readFileSync("src/render3d/tokens.ts", "utf8");
    expect(tokens).toMatch(/TILE_BASE_SCALE = 0\.82/);
    expect(tokens).toContain("T229");
    const mats = readFileSync("src/render3d/materials.ts", "utf8");
    expect(mats).toMatch(/SOFT_EDGE_STRENGTH = 0\.42/);
    expect(mats).toMatch(/TERRAIN_SATURATION = 2\.28/);
    const props = readFileSync("src/render3d/terrain-props.ts", "utf8");
    expect(props).toContain("T229");
    expect(props).toMatch(/denser crown clumps/);
    expect(props).toMatch(/product rock/);
    expect(props).not.toMatch(/suite === ["']H0/);
  });
});
