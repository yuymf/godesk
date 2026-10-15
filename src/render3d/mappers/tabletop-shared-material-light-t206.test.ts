import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T206 shared desk/network material + light", () => {
  it("lifts network map cloth + desk/pattern felt without suite fork or vignette bait", () => {
    const spec = readFileSync("src/creator/render-spec.ts", "utf8");
    expect(spec).toContain("T206");
    expect(spec).toMatch(/exposure: 1\.74/); // network
    expect(spec).toMatch(/#03d870/);
    expect(spec).toMatch(/#04cc58/); // pattern felt
    expect(spec).toMatch(/exposure: 1\.70/); // desk shared
    expect(spec).toMatch(/#02c852/); // desk board felt
    const obj = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(obj).toMatch(/Vector2\(5\.70,\s*5\.70\)/);
    expect(obj).toMatch(/Vector2\(2\.80,\s*2\.80\)/);
    expect(obj).toMatch(/W \* 0\.42/); // keep T202 vignette calm — no bait
    expect(spec).not.toMatch(/suite === ["']H0/);
  });
});
