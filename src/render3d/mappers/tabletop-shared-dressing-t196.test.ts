import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T196 shared dressing / light micro-lift", () => {
  it("lifts felt weave + tray + terrain sat without vignette bait", () => {
    const obj = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(obj).toContain("T196");
    expect(obj).toMatch(/Vector2\(4\.95,\s*4\.95\)/);
    expect(obj).toMatch(/W \* 0\.34/); // T193 vignette still calm
    const mats = readFileSync("src/render3d/materials.ts", "utf8");
    expect(mats).toMatch(/TERRAIN_SATURATION = 1\.48/);
    expect(obj).not.toMatch(/suite === ["']H0/);
  });
});
