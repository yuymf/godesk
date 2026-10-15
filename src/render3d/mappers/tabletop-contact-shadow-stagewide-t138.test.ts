import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T138 contact shadow stage-wide contrast", () => {
  it("darkens / raises opacity without cutting T106/T135 clamps", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T138");
    expect(src).toContain("T135");
    expect(src).toContain("T106");
    const start = src.indexOf("function softContactShadow");
    const end = src.indexOf("function porcelainPlate", start);
    const block = src.slice(start, end > 0 ? end : start + 2000);
    expect(block).toMatch(/Math\.min\(1\.02/);
    expect(block).toMatch(/Math\.max\(0\.68/);
    expect(block).toMatch(/Math\.min\(0\.(54|58|60|62)/);
    expect(block).toMatch(/Math\.max\(0\.(30|32|34)/);
    expect(block).toMatch(/#(020101|010000|000000)/);
  });
});
