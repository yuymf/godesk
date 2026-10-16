import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T262 · coast stand-off + sheep silhouette mesh", () => {
  it("thickens waterline cardboard mesh, sheep LOD, and desk track/tile/card body", () => {
    const island = readFileSync("src/render3d/island.ts", "utf8");
    expect(island).toContain("T262");
    expect(island).toMatch(/blockDepth = 0\.12/);
    expect(island).toMatch(/SKIRT_BOTTOM_Y = -1\.45/);
    expect(island).toContain("wetFootDark: true");
    expect(island).toMatch(/midBandDark: 1/);
    expect(island).toContain("top-lip overhang");
    const props = readFileSync("src/render3d/terrain-props.ts", "utf8");
    expect(props).toContain("T262");
    expect(props).toContain("ear fins");
    expect(props).toMatch(/sheep" \? 1\.85/);
    const objs = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(objs).toContain("T262 · raised steel rail");
    expect(objs).toContain("thicker ceramic body");
    expect(objs).toContain("thicker card stock body");
    expect(objs).toContain("taller cut gem");
    expect(objs).toContain("wider track gauge");
    expect(objs).toContain("larger ceramic footprint");
    expect(objs).toContain("larger card footprint");
    expect(objs).toContain("larger gallery frame");
    expect(objs).toContain("wider pattern trough");
  });
});
