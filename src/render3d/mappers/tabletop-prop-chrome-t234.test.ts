import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T234→T238 prop/chrome lineage", () => {
  it("retains soft-edge + chrome yield markers", () => {
    const mat = readFileSync("src/render3d/materials.ts", "utf8");
    expect(mat).toMatch(/SOFT_EDGE_STRENGTH = 0\.54/);
    const css = readFileSync("src/creator/tidewell-game-screen.css", "utf8");
    expect(css).toMatch(/T238|T234/);
  });
});
