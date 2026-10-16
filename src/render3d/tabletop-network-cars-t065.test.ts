import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T065 network train-car mesh polish", () => {
  it("rail-track claimed cars build chassis + windowed body + coupler (not sugar-cube only)", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T065");
    expect(src).toContain("tt-car-chassis");
    expect(src).toContain("tt-car-glass");
    expect(src).toMatch(/window panes|winW/);
    expect(src).toMatch(/coupler knuckle|coupler/);
    // ban solid sugar-cube-only body loop from T062
    expect(src).not.toMatch(
      /boxAt\(carStep \* 0\.82, 0\.22, gauge \* 1\.15/,
    );
  });
});
