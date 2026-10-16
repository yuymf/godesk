import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T109 route rail albedo contrast", () => {
  it("ballast/sleeper/steel declare T109 contrast lift without dropping T094 maps", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T109");
    expect(src).toContain("makeRailMaps");
    expect(src).toContain("T094");
    expect(src).toMatch(/railBallastMaterial[\s\S]{0,400}#9aa3b0/);
    expect(src).toMatch(/STEEL: MaterialToken = \{ base: "#c2c8ce"/);
    expect(src).toMatch(/SLEEPER: MaterialToken = \{ base: "#4a2e18"/);
  });

  it("T078 cold bed + softContactShadow still present", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T078");
    expect(src).toMatch(/softContactShadow/);
  });
});
