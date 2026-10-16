import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T103 tidewell seated side-rail compact", () => {
  it("seated player cards use compact avatar grid", () => {
    const css = readFileSync("src/creator/tidewell-game-screen.css", "utf8");
    expect(css).toContain("T103");
    expect(css).toMatch(/room-view-tidewell-immersive\.room-view-seated[\s\S]*tidewell-player-card[\s\S]*40px/);
    expect(css).toMatch(/tidewell-player-avatar[\s\S]*36px/);
    expect(css).toMatch(/hex-island-hud-awards[\s\S]*display:\s*none/);
  });

  it("T100 canvasShare reclaim side width still present", () => {
    const css = readFileSync("src/creator/tidewell-game-screen.css", "utf8");
    expect(css).toContain("T100");
    expect(css).toMatch(/--tw-side:\s*168px/);
  });
});
