import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T178 H01 chrome/HUD lighter", () => {
  it("narrows translucent rails/dock further; keeps 88vh stage", () => {
    const tw = readFileSync("src/creator/tidewell-game-screen.css", "utf8");
    expect(tw).toContain("T178");
    expect(tw).toMatch(/--tw-side:\s*40px/);
    expect(tw).toMatch(/--tw-dock:\s*14px/);
    expect(tw).toMatch(/minmax\(88vh/);
    const hit = readFileSync("src/render3d/hit-targets.ts", "utf8");
    expect(hit).toContain("T178");
    expect(hit).toMatch(/opacity:\s*0\.18/);
    expect(hit).toMatch(/emissiveIntensity:\s*0\.12/);
  });
});
