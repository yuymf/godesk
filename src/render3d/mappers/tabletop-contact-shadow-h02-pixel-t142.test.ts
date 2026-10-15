import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T142 contact shadow H02 pixel residual", () => {
  it("enlarges shared footprint / route shadow without cutting T139 floors", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T142");
    expect(src).toContain("T139");
    const start = src.indexOf("function softContactShadow");
    const end = src.indexOf("function porcelainPlate", start);
    const block = src.slice(start, end > 0 ? end : start + 2200);
    expect(block).toMatch(/Math\.min\(1\.02/);
    expect(block).toMatch(/Math\.max\(0\.68/);
    expect(block).toMatch(/Math\.min\(0\.6[02]/);
    expect(block).toMatch(/Math\.max\(0\.34/);
    expect(block).toMatch(/boost \* 1\.(36|48)/);
    expect(src).toMatch(/usable \* 0\.(55|68)/);
  });
});
