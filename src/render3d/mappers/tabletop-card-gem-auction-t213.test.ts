import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T213 shared card/gem/auction parts hard residual", () => {
  it("lifts shared card stock, gem chip, framed lot without suite fork or vignette bait", () => {
    const obj = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(obj).toContain("T213");
    expect(obj).toMatch(/depth: 0\.062/); // card stock
    expect(obj).toMatch(/CylinderGeometry\(0\.40,\s*0\.48,\s*0\.26,\s*10\)/);
    expect(obj).toMatch(/clearcoat: 0\.95/);
    expect(obj).toMatch(/BoxGeometry\(1\.02,\s*0\.11,\s*1\.28\)/); // framed art
    expect(obj).toMatch(/W \* 0\.58/); // vignette calm
    const spec = readFileSync("src/creator/render-spec.ts", "utf8");
    expect(spec).toContain("T213");
    expect(spec).toMatch(/#fff8ee/);
    expect(spec).toMatch(/#ffd898/);
    expect(spec).toMatch(/binding\("card", "card", "card", 1\.12\)/);
    expect(spec).not.toMatch(/suite === ["']H0/);
  });
});
