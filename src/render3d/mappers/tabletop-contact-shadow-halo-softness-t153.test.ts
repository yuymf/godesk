import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T153 contact shadow halo softness", () => {
  it("uses gentler stepped falloff while keeping T106 boost clamp and core", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T153");
    expect(src).toContain("T150");
    const start = src.indexOf("function softContactShadow");
    const end = src.indexOf("function porcelainPlate", start);
    const block = src.slice(start, end > 0 ? end : start + 3500);
    expect(block).toMatch(/Math\.min\(1\.02/);
    expect(block).toMatch(/Math\.max\(0\.68/);
    expect(block).toMatch(/softer stepped falloff|gentler opacity falloff/);
    expect(block).toMatch(/2\.(35|40|50|55)/);
    expect(block).toMatch(/4\.(00|10|20|35|60)|3\.(55|70)/);
    expect(src).toMatch(/T153 card soft footprint|T154 card residual/);
    expect(block).toContain("contact-shadow");
  });
});
