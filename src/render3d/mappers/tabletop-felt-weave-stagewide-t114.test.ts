import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T114 felt weave stage-wide microdetail", () => {
  it("feltPileMaterial declares T114 weave raise without dropping T082/T083", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T114");
    expect(src).toContain("T082");
    expect(src).toContain("T083");
    expect(src).toMatch(/period = 16/);
    expect(src).toMatch(/repeat\.set\(2\.6,\s*2\.6\)/);
    expect(src).toMatch(/normalScale: new Vector2\(1\.45,\s*1\.45\)/);
  });
});
