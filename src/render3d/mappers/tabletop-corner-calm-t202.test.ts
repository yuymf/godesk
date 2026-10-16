import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T202 corner / wood-ring calm", () => {
  it("softens shared vignette + mid/outer contact without darkening center bait", () => {
    const obj = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(obj).toContain("T202");
    expect(obj).toMatch(/W \* 0\.(58|72)/);
    expect(obj).toMatch(/rgba\(12,8,4,0\.04\)/);
    expect(obj).not.toMatch(/suite === ["']H0/);
  });
});
