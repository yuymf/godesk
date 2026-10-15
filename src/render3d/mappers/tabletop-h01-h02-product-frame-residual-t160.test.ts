import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T160 H01/H02 product-frame residual", () => {
  it("brightens shared wood-rim lip and strengthens route footprint", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T160");
    expect(src).toMatch(/#e0c090|#f0d8a8|brighter product-frame lip/);
    expect(src).toMatch(/usable \* 1\.(15|28)|T160 route/);
    const css = readFileSync("src/creator/tidewell-game-screen.css", "utf8");
    expect(css).toContain("T160");
  });
});
