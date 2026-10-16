import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("UI-room-shell · playable chrome always visible", () => {
  it("RoomView mounts generic whose-turn / phase / primary placeholder", () => {
    const src = readFileSync("src/creator/RoomView.tsx", "utf8");
    expect(src).toContain("room-playable-shell");
    expect(src).toContain("data-ui-room-shell");
    expect(src).toContain("room-playable-shell-primary");
    expect(src).toContain("room-playable-shell-who");
  });

  it("surface.css restores desk-stage-hud + playable shell without suite fork", () => {
    const css = readFileSync("src/creator/surface.css", "utf8");
    expect(css).toContain("UI-room-shell");
    expect(css).toMatch(/\.room-playable-shell[\s\S]*?display:\s*flex/);
    expect(css).toMatch(/desk-stage-hud[\s\S]*?min-height:\s*2\.35rem/);
    expect(css).toMatch(/tabletop-stage::before[\s\S]*?display:\s*none/);
    expect(css).not.toMatch(/suite === ["']H0/);
  });

  it("tidewell dock/topbar/turn column are readable again", () => {
    const tw = readFileSync("src/creator/tidewell-game-screen.css", "utf8");
    expect(tw).toContain("UI-room-shell");
    expect(tw).toMatch(/--tw-dock:\s*148px/);
    expect(tw).toMatch(/tidewell-turn-column[\s\S]*?opacity:\s*1/);
  });
});
