import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T135 shared contact shadow residual", () => {
  it("raises auto opacity floors without cutting T106 boost clamps", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T135");
    expect(src).toContain("T106");
    const start = src.indexOf("function softContactShadow");
    const end = src.indexOf("function porcelainPlate", start);
    const block = src.slice(start, end > 0 ? end : start + 1800);
    expect(block).toMatch(/Math\.min\(1\.02/);
    expect(block).toMatch(/Math\.max\(0\.68/);
    expect(block).toMatch(/Math\.min\(0\.(50|54|58|60|62)/);
    expect(block).toMatch(/Math\.max\(0\.(28|30|32|34)/);
    expect(block).toContain('mesh.name = "contact-shadow"');
  });
});
