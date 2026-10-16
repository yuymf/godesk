import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
describe("T238→T242 prop/chrome lineage", () => {
  it("retains soft-edge + chrome yield", () => {
    expect(readFileSync("src/render3d/materials.ts","utf8")).toMatch(/SOFT_EDGE_STRENGTH = 0\.62/);
    expect(readFileSync("src/creator/tidewell-game-screen.css","utf8")).toMatch(/T242/);
  });
});
