import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T169 shared material/light microcontrast", () => {
  it("softens contact mid/outer and bumps felt/wood/card microcontrast", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T169");
    expect(src).toMatch(/Math\.min\(0\.22|soft mid · T161\/T169/);
    expect(src).toMatch(/normalScale: new Vector2\(2\.05,\s*2\.05\)/);
    expect(src).toMatch(/normalScale: new Vector2\(1\.55,\s*1\.55\)/);
    expect(src).toMatch(/card stock micro-glaze|#f0d4a0/);
  });
});
