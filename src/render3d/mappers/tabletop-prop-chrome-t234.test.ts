import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T234 terrain prop lift + chrome yield", () => {
  it("densifies shared props and demotes dock chrome without suite fork", () => {
    const props = readFileSync("src/render3d/terrain-props.ts", "utf8");
    expect(props).toContain("T234");
    expect(props).toMatch(/denser crown clumps/);
    const mats = readFileSync("src/render3d/materials.ts", "utf8");
    expect(mats).toMatch(/SOFT_EDGE_STRENGTH = 0\.46/);
    expect(mats).toMatch(/TERRAIN_SATURATION = 2\.32/);
    const tw = readFileSync("src/creator/tidewell-game-screen.css", "utf8");
    expect(tw).toContain("T234");
    expect(tw).toMatch(/--tw-side:\s*16px/);
    const surface = readFileSync("src/creator/surface.css", "utf8");
    expect(surface).toContain("T234");
    expect(props).not.toMatch(/suite === ["']H0/);
  });
});
