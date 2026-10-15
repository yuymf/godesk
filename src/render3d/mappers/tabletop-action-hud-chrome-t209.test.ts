import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T209 bottom action HUD / play chrome further collapse", () => {
  it("further demotes desk-action drawer + stage HUD without suite fork", () => {
    const surf = readFileSync("src/creator/surface.css", "utf8");
    expect(surf).toContain("T209");
    expect(surf).toMatch(/desk-action-drawer:not\(\[open\]\)[\s\S]*?max-height:\s*0\.55rem/);
    expect(surf).toMatch(/desk-stage-hud[\s\S]*?opacity:\s*0\.28/);
    const tw = readFileSync("src/creator/tidewell-game-screen.css", "utf8");
    expect(tw).toContain("T209");
    expect(tw).toMatch(/--tw-dock:\s*3px/);
    expect(tw).toMatch(/minmax\(93vh/);
    expect(surf).not.toMatch(/suite === ["']H0/);
  });
});
