import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T193 shared vignette / softContact calm", () => {
  it("softens table vignette center blot and mid/outer contact veil", () => {
    const obj = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(obj).toContain("T193");
    expect(obj).toMatch(/W \* 0\.34/);
    expect(obj).toMatch(/rgba\(12,8,4,0\.22\)/);
    expect(obj).toMatch(/Math\.min\(0\.16,\s*opacity \* 0\.24\)/);
  });
});
