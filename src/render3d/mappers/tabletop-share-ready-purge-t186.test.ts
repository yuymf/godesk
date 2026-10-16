import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T186 shareReady invite/link purge", () => {
  it("omits shareLinkReady input when share chrome compact (RoomView)", () => {
    const src = readFileSync("src/creator/RoomView.tsx", "utf8");
    expect(src).toContain("T186");
    expect(src).toMatch(/!shareChromeCompact \?[\s\S]*invitation-link-row/);
    // compact path must not bind shareLinkReady into the invite input
    expect(src).not.toMatch(/shareChromeCompact \? copy\.shareLinkReady/);
  });

  it("CSS hides invitation-link-row under chrome-collapse", () => {
    const surf = readFileSync("src/creator/surface.css", "utf8");
    expect(surf).toContain("T186");
    expect(surf).toMatch(/is-chrome-collapse \.invitation-link-row/);
    const tw = readFileSync("src/creator/tidewell-game-screen.css", "utf8");
    expect(tw).toContain("T186");
  });
});
