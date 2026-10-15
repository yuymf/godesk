import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T222 shared hex/desktop product parts", () => {
  it("lifts number/harbor/water/settlement without suite fork", () => {
    const tokens = readFileSync("src/render3d/tokens.ts", "utf8");
    expect(tokens).toMatch(/NUMBER_TOKEN_SCALE = 1\.92/);
    const island = readFileSync("src/render3d/island.ts", "utf8");
    expect(island).toContain("T222");
    expect(island).toMatch(/SIGN_RADIUS = 0\.32/);
    const labels = readFileSync("src/render3d/number-labels.ts", "utf8");
    expect(labels).toMatch(/NUMBER_TOKEN_RADIUS = 0\.245/);
    expect(labels).toMatch(/LABEL_SIZE_PER_RADIUS = 2\.88/);
    const pieces = readFileSync("src/render3d/assets/pieces.ts", "utf8");
    expect(pieces).toMatch(/SETTLEMENT_SCALE = 2\.32/);
    const mats = readFileSync("src/render3d/materials.ts", "utf8");
    expect(mats).toMatch(/TERRAIN_SATURATION = 2\.05/);
    const spec = readFileSync("src/creator/render-spec.ts", "utf8");
    expect(spec).toMatch(/#24e8d6/);
    expect(spec).not.toMatch(/suite === ["']H0/);
  });
});
