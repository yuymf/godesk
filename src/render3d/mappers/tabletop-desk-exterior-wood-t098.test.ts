import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T098 desk exterior wood grain", () => {
  it("materialFor routes table kind through deskWoodMaterial", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T098");
    expect(src).toContain("deskWoodMaterial");
    expect(src).toMatch(/kind === "table"[\s\S]{0,120}deskWoodMaterial/);
  });

  it("desk wood reuses T092 woodRimMaterial maps", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("woodRimMaterial");
    expect(src).toMatch(/deskWoodMaterial[\s\S]{0,400}woodRimMaterial/);
  });

  it("T086 lighting fill/rim still present", () => {
    const src = readFileSync("src/render3d/lighting.ts", "utf8");
    expect(src).toMatch(/gd:fill|fill/);
    expect(src).toMatch(/gd:rim/);
  });
});
