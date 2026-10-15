import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T142 contact shadow H02 pixel residual", () => {
  it("enlarges shared footprint / route shadow without cutting T139 floors", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T142");
    const start = src.indexOf("function softContactShadow");
    const end = src.indexOf("function porcelainPlate", start);
    const block = src.slice(start, end > 0 ? end : start + 2800);
    expect(block).toMatch(/Math\.min\(1\.02/);
    expect(block).toMatch(/Math\.max\(0\.68/);
    expect(block).toMatch(/1\.(48|55)/);
    expect(src).toMatch(/usable \* 0\.(55|68|75|85)/);
  });
});
