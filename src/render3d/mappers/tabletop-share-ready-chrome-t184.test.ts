import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T184 shareReady product chrome further collapse", () => {
  it("narrows rails/dock and demotes invite/header further", () => {
    const tw = readFileSync("src/creator/tidewell-game-screen.css", "utf8");
    expect(tw).toContain("T184");
    expect(tw).toMatch(/--tw-side:\s*28px/);
    expect(tw).toMatch(/--tw-dock:\s*10px/);
    expect(tw).toMatch(/minmax\(90vh/);
    const surf = readFileSync("src/creator/surface.css", "utf8");
    expect(surf).toContain("T184");
    expect(surf).toMatch(/max-height:\s*0\.4rem/);
  });
});
