import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T100 hex canvas share vh reclaim", () => {
  it("seated immersive narrows --tw-side and --tw-dock", () => {
    const css = readFileSync("src/creator/tidewell-game-screen.css", "utf8");
    expect(css).toContain("T100");
    expect(css).toMatch(/room-view-tidewell-immersive\.room-view-seated[\s\S]{0,200}--tw-side:\s*168px/);
    expect(css).toMatch(/--tw-dock:\s*100px/);
  });

  it("T097 chrome collapse still present", () => {
    const css = readFileSync("src/creator/tidewell-game-screen.css", "utf8");
    expect(css).toContain("T097");
    expect(css).toContain("is-chrome-collapse");
  });
});
