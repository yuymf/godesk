import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T159 seat-close product-frame polish", () => {
  it("adds shared wood-rim bevel lip and framed-art lip; stage bezel hairline clearer", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T159");
    expect(src).toMatch(/product-frame bevel lip|product-frame seat-close/);
    expect(src).toMatch(/#d4b896|#c4a06a|#e0c090|#e8d0a8|#f0d8a8|#ffe6b0|#f3d59a|#c9a06e|#faf0d0|#ffe8b8/);
    const css = readFileSync("src/creator/tidewell-game-screen.css", "utf8");
    expect(css).toContain("T159");
    expect(css).toMatch(/rgba\(232, 196, 96, 0\.82\)|rgba\(245, 220, 130|rgba\(255, 228, 140|rgba\(255, 220, 130|rgba\(255, 230, 150|rgba\(255, 236, 150/);
  });
});
