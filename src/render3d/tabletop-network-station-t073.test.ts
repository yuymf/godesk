import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T073 network station platform mesh", () => {
  it("station builds elongated platform + curb (not pad-only)", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T073");
    expect(src).toMatch(/elongated platform|platform\/plinth/);
    expect(src).toMatch(/boxAt\(0\.95, 0\.06, 1\.15/);
    expect(src).toContain("group.add(platform, curb, plinth");
    // bogies / cars still present
    expect(src).toContain("T068");
    expect(src).toContain("tt-car-chassis");
  });
});
