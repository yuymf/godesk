import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T210 shared house/meeple/route mesh + material", () => {
  it("lifts shared piece meshes without suite fork or vignette bait", () => {
    const obj = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(obj).toContain("T210");
    expect(obj).toMatch(/bevelEnabled:\s*true/); // house bevel
    expect(obj).toMatch(/depth:\s*0\.26/); // meeple // meeple thicker
    expect(obj).toMatch(/CylinderGeometry\(0\.30,\s*0\.33/); // meeple rim
    expect(obj).toMatch(/railY = claimed \? 0\.(11|125)/); // taller rails
    expect(obj).toMatch(/depth: 0\.12/); // glazed tile thicker
    expect(obj).toMatch(/W \* 0\.42/); // keep vignette calm
    const spec = readFileSync("src/creator/render-spec.ts", "utf8");
    expect(spec).toContain("T210");
    expect(spec).toMatch(/#(fff8ec|fff6e6|f7fbff)/);
    expect(spec).not.toMatch(/suite === ["']H0/);
    expect(obj).not.toMatch(/suite === ["']H0/);
  });
});
