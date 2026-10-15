import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T097 immersive chrome collapse", () => {
  it("RoomView marks seated share chrome with is-chrome-collapse", () => {
    const src = readFileSync("src/creator/RoomView.tsx", "utf8");
    expect(src).toContain("T097");
    expect(src).toContain("is-chrome-collapse");
    expect(src).toContain("shareChromeCompact");
    expect(src).toMatch(/invite-url is-share-ready|is-share-ready/);
  });

  it("CSS collapses non-current seat chips and bumps stage vh", () => {
    const css = readFileSync("src/creator/surface.css", "utf8");
    expect(css).toContain("T097");
    expect(css).toMatch(/seat-chip:not\(\.is-yours\)/);
    expect(css).toMatch(/78vh/);
    const tw = readFileSync("src/creator/tidewell-game-screen.css", "utf8");
    expect(tw).toContain("T097");
    expect(tw).toMatch(/is-chrome-collapse/);
  });

  it("T091 shareReady pierce still present", () => {
    const tw = readFileSync("src/creator/tidewell-game-screen.css", "utf8");
    expect(tw).toMatch(/room-invitation\.room-share-chrome/);
    const src = readFileSync("src/creator/RoomView.tsx", "utf8");
    expect(src).toMatch(/!immersive \|\| shareChromeCompact/);
  });
});
