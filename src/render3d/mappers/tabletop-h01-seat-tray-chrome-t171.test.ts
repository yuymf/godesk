import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T171 H01 tabletop-first / seat tray / legal-ring", () => {
  it("collapses chrome toward share ≥0.88 and softens legal rings", () => {
    const tw = readFileSync("src/creator/tidewell-game-screen.css", "utf8");
    expect(tw).toContain("T171");
    expect(tw).toMatch(/--tw-side:\s*56px/);
    expect(tw).toMatch(/--tw-dock:\s*22px/);
    expect(tw).toMatch(/minmax\(88vh/);
    expect(tw).toContain("tidewell-dock");
    const hit = readFileSync("src/render3d/hit-targets.ts", "utf8");
    expect(hit).toContain("T171");
    expect(hit).toMatch(/opacity:\s*0\.18/);
    expect(hit).toMatch(/emissiveIntensity:\s*0\.12/);
    expect(hit).toMatch(/TorusGeometry\(0\.2,\s*0\.012/);
  });

  it("rewrites hex seat marker as wood tray + chip (not color-swatch meeple)", () => {
    const pieces = readFileSync("src/render3d/assets/pieces.ts", "utf8");
    expect(pieces).toContain("T171");
    expect(pieces).toMatch(/seat tray/);
    expect(pieces).toMatch(/MEEPLE_HEX_SCALE = 1\.35/);
    expect(pieces).not.toMatch(/quadraticCurveTo\(0\.28, 0\.48/);
  });
});
