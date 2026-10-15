import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T166 H01 wide + H03 seat-close/wide consistency", () => {
  it("strengthens shared desk rim light, hex exposure, and dual-lip outer rail", () => {
    const tokens = readFileSync("src/render3d/tokens.ts", "utf8");
    expect(tokens).toContain("T166");
    expect(tokens).toMatch(/intensity: 0\.78|#ffe6b0/);
    expect(tokens).toMatch(/exposure: 1\.32|intensity: 1\.15/);
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T166");
    expect(src).toMatch(/outer crown rail|taller crown/);
    const pieces = readFileSync("src/render3d/assets/pieces.ts", "utf8");
    expect(pieces).toMatch(/MEEPLE_HEX_SCALE = (2\.15|1\.72)/);
  });
});
