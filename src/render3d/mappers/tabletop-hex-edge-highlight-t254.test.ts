import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { HEX_EDGE_HIGHLIGHT, SOFT_EDGE_STRENGTH } from "../materials";

describe("T254 · hex cut-edge highlight", () => {
  it("keeps kraft lip and adds thin highlight band", () => {
    expect(HEX_EDGE_HIGHLIGHT).toBeGreaterThanOrEqual(0.75);
    expect(SOFT_EDGE_STRENGTH).toBeGreaterThanOrEqual(0.8);
    const mat = readFileSync("src/render3d/materials.ts", "utf8");
    expect(mat).toContain("gdHi");
    expect(mat).toContain("T254");
  });
});
