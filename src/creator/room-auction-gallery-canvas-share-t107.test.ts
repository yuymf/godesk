import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T107 auction gallery canvas share", () => {
  it("immersive auction-board full-bleeds like network", () => {
    const css = readFileSync("src/creator/surface.css", "utf8");
    expect(css).toContain("T107");
    expect(css).toMatch(/auction-board\.room-view-tabletop-immersive[\s\S]{0,200}width:\s*100%/);
  });

  it("does not remove shareReady / chrome-collapse hooks", () => {
    const css = readFileSync("src/creator/surface.css", "utf8");
    expect(css).toMatch(/is-share-ready|is-chrome-collapse|room-share-chrome/);
    const tw = readFileSync("src/creator/tidewell-game-screen.css", "utf8");
    expect(tw).toMatch(/is-chrome-collapse/);
  });
});
