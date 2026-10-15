import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T165 stagewide seat-close consistency", () => {
  it("shares high-key frame lip language and stage bezel gold across chrome", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T165");
    expect(src).toMatch(/shared rim language|#f3d59a|#ffe6b0/);
    const css = readFileSync("src/creator/tidewell-game-screen.css", "utf8");
    expect(css).toMatch(/T165/);
  });
});
