import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T206 shared desk/network material + light", () => {
  it("lifts network map cloth + desk/pattern felt without suite fork or vignette bait", () => {
    const spec = readFileSync("src/creator/render-spec.ts", "utf8");
    expect(spec).toContain("T206");
    expect(spec).toMatch(/exposure: 1\.(74|78|86|96)/); // network T206/T214
    expect(spec).toMatch(/#(03d870|02dc74|00e07c|00e888)/);
    expect(spec).toMatch(/#(04cc58|03d05c|02d864)/); // pattern felt
    expect(spec).toMatch(/exposure: 1\.(70|78|84|90)/); // desk shared T206/T214
    expect(spec).toMatch(/#(02c852|01cc56|00d45a)/); // desk board felt
    const obj = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(obj).toMatch(/Vector2\((5\.70|6\.05),\s*(5\.70|6\.05)\)/);
    expect(obj).toMatch(/Vector2\((2\.80|3\.05),\s*(2\.80|3\.05)\)/);
    expect(obj).toMatch(/W \* 0\.42/); // keep T202 vignette calm — no bait
    expect(spec).not.toMatch(/suite === ["']H0/);
  });
});
