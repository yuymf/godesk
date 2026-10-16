import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T199 legal-ring further collapse", () => {
  it("softens ring opacity/emissive below T195", () => {
    const hit = readFileSync("src/render3d/hit-targets.ts", "utf8");
    expect(hit).toContain("T199");
    expect(hit).toMatch(/opacity:\s*0\.045/);
    expect(hit).toMatch(/emissiveIntensity:\s*0\.025/);
  });
});
