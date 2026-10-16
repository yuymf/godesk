import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { NUMBER_TOKEN_HALF_HEIGHT } from "../number-labels";
import { TILE_BASE_SCALE } from "../tokens";
import { SOFT_EDGE_STRENGTH } from "../materials";

describe("T250 · chip lip / hex side / GLB ground contact", () => {
  it("thickens wood-chip half-height and paperboard side", () => {
    expect(NUMBER_TOKEN_HALF_HEIGHT).toBeGreaterThanOrEqual(0.09);
    expect(TILE_BASE_SCALE).toBeLessThanOrEqual(0.78);
    expect(SOFT_EDGE_STRENGTH).toBeGreaterThanOrEqual(0.8);
    const host = readFileSync("src/render3d/SceneHost.tsx", "utf8");
    expect(host).toMatch(/depth: 0\.138/);
    expect(host).toMatch(/depth: 0\.34/);
    const props = readFileSync("src/render3d/terrain-props.ts", "utf8");
    expect(props).toContain("T250");
    expect(props).toMatch(/opacity: 0\.30/);
  });
});
