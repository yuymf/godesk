import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("lineage soft-edge / prop product (→T250)", () => {
  it("keeps kraft paperboard soft-edge marker", () => {
    const mat = readFileSync("src/render3d/materials.ts", "utf8");
    expect(mat).toMatch(/SOFT_EDGE_STRENGTH = 0\.82/);
    expect(mat).toContain("T250");
  });
});
