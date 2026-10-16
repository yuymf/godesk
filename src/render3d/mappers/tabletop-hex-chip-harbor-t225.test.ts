import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T225 shared number/harbor/shore embodiment", () => {
  it("moves chips/docks/shore from flat UI toward physical parts", () => {
    const labels = readFileSync("src/render3d/number-labels.ts", "utf8");
    expect(labels).toMatch(/T225|T237/);
    expect(labels).toMatch(/HALF_HEIGHT = 0\.062/);
    const island = readFileSync("src/render3d/island.ts", "utf8");
    expect(island).toMatch(/carved wood plaque/);
    expect(island).toMatch(/T225\/T237 · thicker product planks|T225 plank/);
    const mats = readFileSync("src/render3d/materials.ts", "utf8");
    expect(mats).toMatch(/TERRAIN_SATURATION = 2\.48/);
  });
});
