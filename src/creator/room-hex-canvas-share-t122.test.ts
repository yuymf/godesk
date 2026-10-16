import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T122 hex canvas share reclaim", () => {
  it("seated immersive overlays rails so stage full-bleeds", () => {
    const css = readFileSync("src/creator/tidewell-game-screen.css", "utf8");
    expect(css).toContain("T122");
    expect(css).toMatch(
      /room-view-tidewell-immersive\.room-view-seated[\s\S]{0,400}tidewell-game-body[\s\S]{0,120}grid-template-columns:\s*minmax\(0,\s*1fr\)/,
    );
    expect(css).toMatch(
      /room-view-tidewell-immersive\.room-view-seated[\s\S]{0,200}tidewell-players[\s\S]{0,120}position:\s*absolute/,
    );
  });

  it("does not whitewash T100 side width or T103 compact cards", () => {
    const css = readFileSync("src/creator/tidewell-game-screen.css", "utf8");
    expect(css).toContain("T100");
    expect(css).toMatch(/--tw-side:\s*168px/);
    expect(css).toContain("T103");
    expect(css).toMatch(/tidewell-player-card[\s\S]*40px/);
    expect(css).toMatch(/tidewell-player-avatar[\s\S]*36px/);
  });
});
