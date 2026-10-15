import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T083 felt H02 vs_regress debt", () => {
  it("feltPileMaterial uses coarser world weave + stronger normal", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T083");
    expect(src).toMatch(/repeat\.set\(3\.2,\s*3\.2\)/);
    expect(src).toMatch(/normalScale:\s*new Vector2\(1\.25,\s*1\.25\)/);
    expect(src).toMatch(/period = 14/);
    expect(src).toContain("macro");
  });

  it("cloth GLSL keeps mid-frequency weave for wide cameras", () => {
    const src = readFileSync("src/render3d/materials.ts", "utf8");
    expect(src).toContain("T083");
    expect(src).toMatch(/w\.xz \* 28\.0/);
  });
});
