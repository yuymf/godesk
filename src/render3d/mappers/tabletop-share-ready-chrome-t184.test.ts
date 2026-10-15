import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T184 shareReady product chrome further collapse", () => {
  it("narrows rails/dock and demotes invite/header further", () => {
    const tw = readFileSync("src/creator/tidewell-game-screen.css", "utf8");
    expect(tw).toContain("T184");
    // T205 further collapses side/dock; keep T184 intent via ≤22/≤8 floor
    expect(tw).toMatch(/--tw-side:\s*(22|18)px/);
    expect(tw).toMatch(/--tw-dock:\s*(8|5)px/);
    expect(tw).toMatch(/minmax\(9[12]vh/);
    const surf = readFileSync("src/creator/surface.css", "utf8");
    expect(surf).toContain("T184");
    expect(surf).toMatch(/max-height:\s*0\.(4|28)rem/);
  });
});
