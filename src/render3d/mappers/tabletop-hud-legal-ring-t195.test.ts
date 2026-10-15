import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T195 HUD + legal-ring further collapse", () => {
  it("narrows seated chrome and softens legal-ring vs T189", () => {
    const tw = readFileSync("src/creator/tidewell-game-screen.css", "utf8");
    expect(tw).toContain("T195");
    expect(tw).toMatch(/--tw-side:\s*22px/);
    expect(tw).toMatch(/--tw-dock:\s*8px/);
    const hit = readFileSync("src/render3d/hit-targets.ts", "utf8");
    expect(hit).toContain("T195");
    expect(hit).toMatch(/opacity:\s*0\.07/);
    expect(hit).toMatch(/emissiveIntensity:\s*0\.04/);
  });
});
