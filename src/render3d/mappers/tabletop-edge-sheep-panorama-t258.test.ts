import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { HEX_EDGE_HIGHLIGHT } from "../materials";

describe("T258 · panorama edge + far sheep", () => {
  it("keeps wide highlight band and deeper sheep silhouette", () => {
    expect(HEX_EDGE_HIGHLIGHT).toBeGreaterThanOrEqual(0.9);
    const mats = readFileSync("src/render3d/materials.ts", "utf8");
    expect(mats).toContain("gdHi");
    expect(mats).toMatch(/TILE_FACE_APOTHEM - 0\.2[4-9]|TILE_FACE_APOTHEM - 0\.3/);
    const props = readFileSync("src/render3d/terrain-props.ts", "utf8");
    expect(props).toContain("T258");
    expect(props).toMatch(/sheep" \? 1\.0[0-9]/);
  });
});
