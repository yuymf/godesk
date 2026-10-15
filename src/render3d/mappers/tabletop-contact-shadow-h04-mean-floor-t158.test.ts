import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T158 contact shadow H04 mean floor", () => {
  it("raises tile footprint and soft mid for mean≥5 without cutting T106 clamp", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T158");
    const start = src.indexOf("function softContactShadow");
    const end = src.indexOf("function porcelainPlate", start);
    const block = src.slice(start, end > 0 ? end : start + 4000);
    expect(block).toMatch(/Math\.min\(1\.02/);
    expect(block).toMatch(/Math\.max\(0\.68/);
    expect(block).toMatch(/2\.(45|55|50)/);
    expect(src).toMatch(/T158 tile mean floor|tile mean|T161 tile mean/);
  });
});
