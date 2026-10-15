import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T205 shareReady product chrome further collapse", () => {
  it("further demotes top bar / dock / rails without suite fork", () => {
    const tw = readFileSync("src/creator/tidewell-game-screen.css", "utf8");
    expect(tw).toContain("T205");
    expect(tw).toMatch(/--tw-side:\s*18px/);
    expect(tw).toMatch(/--tw-dock:\s*5px/);
    expect(tw).toMatch(/minmax\(92vh/);
    const surf = readFileSync("src/creator/surface.css", "utf8");
    expect(surf).toContain("T205");
    expect(surf).toMatch(/max-height:\s*0\.85rem/);
    expect(surf).toMatch(/max-height:\s*0\.28rem/);
    expect(surf).toMatch(/desk-action-drawer:not\(\[open\]\)[\s\S]*?max-height:\s*1\.15rem/);
    expect(tw).not.toMatch(/suite === ["']H0/);
    expect(surf).not.toMatch(/suite === ["']H0/);
  });
});
