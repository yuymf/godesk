import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T102 deskWood MaterialLibrary cache", () => {
  it("MaterialLibrary exposes ensure() for factory-built materials", () => {
    const src = readFileSync("src/render3d/materials.ts", "utf8");
    expect(src).toContain("T102");
    expect(src).toMatch(/ensure\(key:\s*string/);
  });

  it("deskWoodMaterial caches via library.ensure", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T102");
    expect(src).toMatch(/deskWoodMaterial[\s\S]{0,500}library\.ensure/);
    expect(src).toContain("desk-wood:");
  });

  it("T092 woodRimMaterial still present for rim/lip", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("woodRimMaterial");
    expect(src).toMatch(/felt-wood-rim[\s\S]*woodRimMaterial/);
  });
});
