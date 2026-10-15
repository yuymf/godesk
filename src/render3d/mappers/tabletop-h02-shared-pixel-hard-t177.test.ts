import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T177 H02 soft residual → shared hard pixel", () => {
  it("bumps shared network-route lighting/materials (kernel family, not suite fork)", () => {
    const spec = readFileSync("src/creator/render-spec.ts", "utf8");
    expect(spec).toContain("T177");
    expect(spec).toMatch(/network-route-v1[\s\S]*exposure:\s*1\.34/);
    expect(spec).toMatch(/#0ca84c/);
    expect(spec).not.toMatch(/H02-only|suite === ["']H02["']/);
  });

  it("enlarges shared route contact + station pedestal + felt weave", () => {
    const objs = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(objs).toContain("T177");
    expect(objs).toMatch(/usable \* 1\.55/);
    expect(objs).toMatch(/CylinderGeometry\(0\.64, 0\.68/);
    expect(objs).toMatch(/Vector2\(3\.35,\s*3\.35\)/);
  });
});
