import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T174 H01 chrome lighter / legal-ring", () => {
  it("narrows translucent rails/dock without dropping 88vh stage", () => {
    const tw = readFileSync("src/creator/tidewell-game-screen.css", "utf8");
    expect(tw).toContain("T174");
    expect(tw).toMatch(/--tw-side:\s*56px/);
    expect(tw).toMatch(/--tw-dock:\s*22px/);
    expect(tw).toMatch(/minmax\(88vh/);
    const hit = readFileSync("src/render3d/hit-targets.ts", "utf8");
    expect(hit).toContain("T174");
    expect(hit).toMatch(/opacity:\s*0\.18/);
    expect(hit).toMatch(/emissiveIntensity:\s*0\.12/);
  });
});
