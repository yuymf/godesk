import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T266 · shore seam + CJK canvas clarity", () => {
  it("widens wet-sand shore contact in water shader and island apron", () => {
    const water = readFileSync("src/render3d/water/material.ts", "utf8");
    expect(water).toContain("T266");
    expect(water).toContain("wetSandMask");
    expect(water).toMatch(/0\.11|0\.085/);
    const island = readFileSync("src/render3d/island.ts", "utf8");
    expect(island).toContain("T266");
    expect(island).toContain('tier === "medium"');
    expect(island).toContain("island:wet-sand-apron");
  });

  it("upsizes shared CJK canvas faces and anisotropy", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T266 CJK");
    expect(src).toMatch(/anisotropy = 16/);
    expect(src).toContain("640, H = 400");
    expect(src).toContain("pxPerChar = 96");
  });
});
