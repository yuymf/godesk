import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T230 share tray/dock yield + felt/light", () => {
  it("demotes seat tray/build/dice chrome and lifts shared felt/light", () => {
    const tw = readFileSync("src/creator/tidewell-game-screen.css", "utf8");
    expect(tw).toContain("T230");
    expect(tw).toMatch(/--tw-side:\s*16px/);
    expect(tw).toMatch(/--tw-dock:\s*3px/);
    const surface = readFileSync("src/creator/surface.css", "utf8");
    expect(surface).toContain("T230");
    const spec = readFileSync("src/creator/render-spec.ts", "utf8");
    expect(spec).toMatch(/#28ff90/);
    expect(spec).toContain("T230");
    const tt = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(tt).toContain("T230");
  });
});
