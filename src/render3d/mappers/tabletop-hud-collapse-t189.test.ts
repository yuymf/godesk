import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T189 tabletop-first HUD collapse + legal-ring", () => {
  it("narrows seated rails/dock further without suite fork", () => {
    const tw = readFileSync("src/creator/tidewell-game-screen.css", "utf8");
    expect(tw).toContain("T189");
    expect(tw).toMatch(/--tw-side:\s*22px/);
    expect(tw).toMatch(/--tw-dock:\s*8px/);
    expect(tw).toMatch(/minmax\(91vh/);
  });

  it("softens shared legal-ring opacity/emissive", () => {
    const hit = readFileSync("src/render3d/hit-targets.ts", "utf8");
    expect(hit).toContain("T189");
    expect(hit).toMatch(/opacity:\s*0\.045/);
    expect(hit).toMatch(/emissiveIntensity:\s*0\.025/);
  });
});
