import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T180 shareReady / tabletop-first chrome", () => {
  it("collapses rails/dock and demotes shareReady strip", () => {
    const tw = readFileSync("src/creator/tidewell-game-screen.css", "utf8");
    expect(tw).toContain("T180");
    expect(tw).toMatch(/--tw-side:\s*28px/);
    expect(tw).toMatch(/--tw-dock:\s*10px/);
    expect(tw).toMatch(/shareReady strip/);
    expect(tw).toMatch(/minmax\(88vh/);
    const surf = readFileSync("src/creator/surface.css", "utf8");
    expect(surf).toContain("T180");
    expect(surf).toMatch(/max-height:\s*0\.4rem/);
  });
});
