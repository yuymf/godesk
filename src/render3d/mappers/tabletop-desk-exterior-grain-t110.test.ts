import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T110 desk exterior grain continuity", () => {
  it("deskWoodMaterial aligns default base with T092 rim and keeps shared maps", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T110");
    expect(src).toContain("T098");
    expect(src).toContain("T092");
    const start = src.indexOf("function deskWoodMaterial");
    const end = src.indexOf("function feltPileMaterial", start);
    const block = src.slice(start, end > 0 ? end : start + 1200);
    expect(block).toContain("#a87338");
    expect(block).toMatch(/repeat\.set\(3\.2,\s*3\.2\)/);
    expect(block).toContain("woodRimMaterial");
  });

  it("render-spec desk kernels use rim-aligned table base", () => {
    const src = readFileSync("src/creator/render-spec.ts", "utf8");
    expect(src).toMatch(/table: material\("#a87338", "grain", 0\.74/);
    expect(src).not.toMatch(/table: material\("#7a4e28"/);
  });

  it("woodRimMaterial still builds grain maps (T092 not cut)", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("function woodRimMaterial");
    expect(src).toMatch(/normalScale: new Vector2\(1\.35,\s*1\.35\)/);
  });
});
