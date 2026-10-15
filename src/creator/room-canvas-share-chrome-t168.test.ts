import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T168 ≥9 canvasShare / chrome collapse", () => {
  it("narrows overlay rails, shortens dock, raises tabletop stage vh", () => {
    const tw = readFileSync("src/creator/tidewell-game-screen.css", "utf8");
    expect(tw).toContain("T168");
    expect(tw).toMatch(/--tw-side:\s*128px/);
    expect(tw).toMatch(/--tw-dock:\s*72px/);
    expect(tw).toMatch(/rgba\(243, 231, 201, 0\.72\)/);
    const surf = readFileSync("src/creator/surface.css", "utf8");
    expect(surf).toContain("T168");
    expect(surf).toMatch(/88vh|clamp\(560px,\s*88vh/);
    expect(surf).toMatch(/auction-board[\s\S]*88vh/);
    expect(surf).toMatch(/is-chrome-collapse/);
    const pieces = readFileSync("src/render3d/assets/pieces.ts", "utf8");
    expect(pieces).toMatch(/MEEPLE_HEX_SCALE = 1\.72/);
    expect(pieces).toMatch(/#d4a87a/);
  });
});
