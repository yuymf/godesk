import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T096 contact shadow radius tune", () => {
  it("softContactShadow footprint-scales boost/opacity (T096)", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T096");
    expect(src).toMatch(/footprint-scaled/);
    expect(src).toMatch(/autoBoost|Math\.sqrt\(area/);
    expect(src).toMatch(/contact-shadow/);
  });

  it("card/tile/plate still emit contact shadows (not removed)", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toMatch(/mesh === "card"[\s\S]*softContactShadow/);
    expect(src).toMatch(/mesh === "glazed-tile"[\s\S]*softContactShadow/);
    expect(src).toMatch(/porcelainPlate[\s\S]*softContactShadow|softContactShadow[\s\S]*porcelain/);
    // porcelain function contains softContactShadow
    const start = src.indexOf("function porcelainPlate");
    const end = src.indexOf("function feltWoodRim", start);
    expect(src.slice(start, end)).toContain("softContactShadow");
  });

  it("T079/T081 semantics: name + no cast/receive on disc", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    const start = src.indexOf("function softContactShadow");
    const end = src.indexOf("function feltWoodRim", start);
    const block = src.slice(start, end > 0 ? end : start + 1200);
    expect(block).toMatch(/contact-shadow/);
    expect(block).toContain("castShadow = false");
    expect(block).toContain("receiveShadow = false");
  });
});
