import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T075 gallery lot stage-readable", () => {
  it("proceduralLotCanvas uses full-bleed color masses", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T075");
    expect(src).toMatch(/full-bleed color masses|stage-readable/);
    expect(src).toMatch(/fillRect\(0, 0, W \* 0\.55/);
  });

  it("gallery/seat lots are enlarged for stage-far read", () => {
    const src = readFileSync("src/render3d/mappers/tabletop-kernels.ts", "utf8");
    expect(src).toMatch(/size: 1\.75/);
    expect(src).toMatch(/size: 1\.65/);
  });
});
