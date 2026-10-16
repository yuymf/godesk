import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T132 shared felt / plaque residual", () => {
  it("nudges felt weave + plaque stage-wide without sample hacks", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T132");
    expect(src).toContain("T120");
    expect(src).toContain("T119");
    expect(src).toMatch(/\* 160/);
    expect(src).toMatch(/normalScale: new Vector2\(1\.78,\s*1\.78\)/);
    expect(src).toMatch(/repeat\.set\(2\.0,\s*2\.0\)/);
    expect(src).toMatch(/PlaneGeometry\(pw,\s*0\.50\)/);
    expect(src).toMatch(/const H = 96/);
    expect(src).toContain("paintSharedOpaquePlaqueFace");
  });
});
