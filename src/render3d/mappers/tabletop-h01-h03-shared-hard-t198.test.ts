import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T198 H01+H03 shared hard residual", () => {
  it("lifts shared hex sat + desk felt without suite fork or vignette bait", () => {
    const mats = readFileSync("src/render3d/materials.ts", "utf8");
    expect(mats).toMatch(/TERRAIN_SATURATION = 1\.(48|58|72|95)|2\.05/);
    const tokens = readFileSync("src/render3d/tokens.ts", "utf8");
    expect(tokens).toContain("T198");
    expect(tokens).toMatch(/intensity: (4\.(55|95)|5\.55)/);
    const spec = readFileSync("src/creator/render-spec.ts", "utf8");
    expect(spec).toContain("T198");
    expect(spec).toMatch(/#(03c24e|02c852|01cc56|00d45a|00dc5e|00e868)/); // T198→T214 desk felt
    const obj = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(obj).toMatch(/W \* 0\.42/); // T193 vignette calm kept
    expect(spec).not.toMatch(/suite === ["']H0/);
  });
});
