import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("lineage soft-edge / prop product (T229→T245)", () => {
  it("keeps kraft paperboard soft-edge marker", () => {
    const mat = readFileSync("src/render3d/materials.ts", "utf8");
    expect(mat).toMatch(/SOFT_EDGE_STRENGTH = 0\.78/);
    expect(mat).toContain("T245");
  });
});
