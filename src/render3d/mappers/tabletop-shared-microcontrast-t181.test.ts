import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T181 shared desktop microcontrast / props", () => {
  it("bumps shared base+hex+desk lighting/materials", () => {
    const spec = readFileSync("src/creator/render-spec.ts", "utf8");
    expect(spec).toContain("T181");
    expect(spec).toMatch(/exposure:\s*1\.26/);
    expect(spec).toMatch(/#268a48/);
    expect(spec).toMatch(/#0c9e42/);
    expect(spec).not.toMatch(/suite === ["']H0/);
  });

  it("raises shared felt/wood weave and contact veil", () => {
    const objs = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(objs).toContain("T181");
    expect(objs).toMatch(/Vector2\(3\.35,\s*3\.35\)/);
    expect(objs).toMatch(/Vector2\(2\.25,\s*2\.25\)/);
  });
});
