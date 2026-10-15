import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T225 shared number/harbor/shore embodiment", () => {
  it("moves chips/docks/shore from flat UI toward physical parts", () => {
    const labels = readFileSync("src/render3d/number-labels.ts", "utf8");
    expect(labels).toContain("T225");
    expect(labels).toMatch(/HALF_HEIGHT = 0\.055/);
    const island = readFileSync("src/render3d/island.ts", "utf8");
    expect(island).toContain("carved wood plaque");
    expect(island).toContain("T225 plank thickness");
    const mats = readFileSync("src/render3d/materials.ts", "utf8");
    expect(mats).toMatch(/TERRAIN_SATURATION = 2\.12/);
  });
});
