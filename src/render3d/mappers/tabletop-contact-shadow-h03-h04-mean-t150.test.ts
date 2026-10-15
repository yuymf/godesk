import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T150 contact shadow H03/H04 mean", () => {
  it("enlarges halo and card/tile footprints without cutting T106/T145 clamps", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T150");
    expect(src).toContain("T145");
    const start = src.indexOf("function softContactShadow");
    const end = src.indexOf("function porcelainPlate", start);
    const block = src.slice(start, end > 0 ? end : start + 3200);
    expect(block).toMatch(/Math\.min\(1\.02/);
    expect(block).toMatch(/Math\.max\(0\.68/);
    expect(block).toMatch(/Math\.min\(0\.(72|76)/);
    expect(block).toMatch(/Math\.max\(0\.(44|48)/);
    expect(block).toMatch(/2\.(35|60)/);
    expect(block).toMatch(/outer veil/);
    expect(src).toMatch(/softContactShadow\(0\.(56|68),\s*0\.(72|88)/);
    expect(src).toMatch(/softContactShadow\(0\.(46|58),\s*0\.(46|58)/);
  });
});
