import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T196 shared dressing / light micro-lift", () => {
  it("lifts felt weave + tray + terrain sat without vignette bait", () => {
    const obj = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(obj).toContain("T196");
    expect(obj).toMatch(/Vector2\((5\.(35|70)|6\.05|6\.45|6\.85),\s*(5\.(35|70)|6\.05|6\.45|6\.85)\)/); // T201/T206/T214 weave
    expect(obj).toMatch(/W \* 0\.58/); // T193 vignette still calm
    const mats = readFileSync("src/render3d/materials.ts", "utf8");
    expect(mats).toMatch(/TERRAIN_SATURATION = (1\.(48|58|72|95)|2\.(05|12|18|28|32|55|62|70))/);
    expect(obj).not.toMatch(/suite === ["']H0/);
  });
});
