import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T221 share-frame chrome demotion", () => {
  it("collapses seated topbar/dock/legal rings without suite fork or vignette bait", () => {
    const tw = readFileSync("src/creator/tidewell-game-screen.css", "utf8");
    expect(tw).toContain("T221");
    expect(tw).toMatch(/minmax\(93vh/);
    expect(tw).toMatch(/--tw-side:\s*16px/);
    expect(tw).toMatch(/--tw-dock:\s*3px/);
    expect(tw).toMatch(/tidewell-topbar/);
    expect(tw).toMatch(/color:\s*transparent/);
    const surface = readFileSync("src/creator/surface.css", "utf8");
    expect(surface).toContain("T221");
    expect(surface).toMatch(/desk-action-drawer:not\(\[open\]\)/);
    expect(surface).toMatch(/max-height:\s*0\.55rem/);
    expect(surface).toMatch(/background:\s*#ffffff/);
    expect(surface).toMatch(/creator-error/);
    expect(surface).toMatch(/seat-chip\.is-yours/);
    expect(surface).toContain("T221b");
    expect(surface).toContain("T221c");
    const hits = readFileSync("src/render3d/hit-targets.ts", "utf8");
    expect(hits).toContain("T221");
    expect(hits).toMatch(/opacity:\s*0\.022/);
    expect(hits).not.toMatch(/suite === ["']H0/);
  });
});
