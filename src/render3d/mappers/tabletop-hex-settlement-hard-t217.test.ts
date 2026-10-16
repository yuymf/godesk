import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T217 H01 hex/settlement shared hard residual", () => {
  it("lifts shared hex terrain sat + lighting + settlement scale without suite fork", () => {
    const mats = readFileSync("src/render3d/materials.ts", "utf8");
    expect(mats).toMatch(/TERRAIN_SATURATION = (1.95|2.05|2.12|2.18|2.28)/);
    const tokens = readFileSync("src/render3d/tokens.ts", "utf8");
    expect(tokens).toContain("T217");
    expect(tokens).toMatch(/intensity: 5\.90/);
    expect(tokens).toMatch(/exposure: 1\.95/);
    const pieces = readFileSync("src/render3d/assets/pieces.ts", "utf8");
    expect(pieces).toMatch(/SETTLEMENT_SCALE = 2.(18|32|38)/);
    expect(pieces).toMatch(/CITY_SCALE = 2.(58|72|80)/);
    const spec = readFileSync("src/creator/render-spec.ts", "utf8");
    expect(spec).toContain("T217");
    expect(spec).toMatch(/exposure: 1\.88/);
    expect(spec).toMatch(/binding\("settlement", "house", "piece", 1\.18\)/);
    expect(spec).not.toMatch(/suite === ["']H0/);
  });
});
