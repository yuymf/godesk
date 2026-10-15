import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T139 contact shadow pixel residual", () => {
  it("enlarges footprint scale without cutting T106/T135/T138 opacity floors", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T139");
    expect(src).toContain("T138");
    expect(src).toContain("T106");
    const start = src.indexOf("function softContactShadow");
    const end = src.indexOf("function porcelainPlate", start);
    const block = src.slice(start, end > 0 ? end : start + 2200);
    expect(block).toMatch(/Math\.min\(1\.02/);
    expect(block).toMatch(/Math\.max\(0\.68/);
    expect(block).toMatch(/Math\.min\(0\.(54|58|60|62)/);
    expect(block).toMatch(/Math\.max\(0\.(30|32|34)/);
    expect(block).toMatch(/boost \* 1\.(22|36|48)/);
    expect(block).toMatch(/#(010000|000000)/);
  });
});
