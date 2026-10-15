import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T120 felt weave stage-wide residual", () => {
  it("raises far-distance weave without dropping T082/T083/T114", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T120");
    expect(src).toContain("T114");
    expect(src).toContain("T082");
    expect(src).toContain("T083");
    expect(src).toMatch(/period = 20/);
    expect(src).toMatch(/repeat\.set\(2\.1,\s*2\.1\)/);
    expect(src).toMatch(/normalScale: new Vector2\(1\.70,\s*1\.70\)/);
    expect(src).toMatch(/\* 148/);
  });
});
