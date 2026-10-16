import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T168 ≥9 canvasShare / chrome collapse", () => {
  it("narrows overlay rails, shortens dock, raises tabletop stage vh", () => {
    const tw = readFileSync("src/creator/tidewell-game-screen.css", "utf8");
    expect(tw).toContain("T168");
    // T171 · further collapse (was 128/72); share floor still ≥0.88 for H02–H05
    expect(tw).toMatch(/--tw-side:\s*22px/);
    expect(tw).toMatch(/--tw-dock:\s*8px/);
    expect(tw).toMatch(/rgba\(243, 231, 201, 0\.(12|18|28|42|48|72)\)/);
    const surf = readFileSync("src/creator/surface.css", "utf8");
    expect(surf).toContain("T168");
    expect(surf).toMatch(/88vh|clamp\(560px,\s*88vh/);
    expect(surf).toMatch(/auction-board[\s\S]*88vh/);
    expect(surf).toMatch(/is-chrome-collapse/);
    const pieces = readFileSync("src/render3d/assets/pieces.ts", "utf8");
    // T171 · seat tray scale (was 1.72 meeple pedestal)
    expect(pieces).toMatch(/MEEPLE_HEX_SCALE = 1\.74/);
    expect(pieces).toMatch(/#f6dcb0/);
  });
});
