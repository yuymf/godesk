import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T106 contact shadow radius reopen", () => {
  it("softContactShadow declares T106 tighter footprint scale", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T106");
    const start = src.indexOf("function softContactShadow");
    const end = src.indexOf("function porcelainPlate", start);
    const block = src.slice(start, end > 0 ? end : start + 1500);
    expect(block).toMatch(/Math\.min\(1\.02/);
    expect(block).toMatch(/Math\.max\(0\.68/);
    expect(block).toMatch(/contact-shadow/);
    expect(block).toContain("castShadow = false");
  });

  it("card/tile/plate still emit contact shadows (T079/T081 not whitewashed)", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toMatch(/mesh === "card"[\s\S]*softContactShadow\(0\.(32|36|42|48),\s*0\.(44|50|56|62)/);
    expect(src).toMatch(/mesh === "glazed-tile"[\s\S]{0,240}softContactShadow\(0\.(28|32|38)/);
    const pStart = src.indexOf("function porcelainPlate");
    const pEnd = src.indexOf("function feltWoodRim", pStart);
    expect(src.slice(pStart, pEnd)).toMatch(/softContactShadow\(0\.32/);
  });
});
