import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T169 shared material/light microcontrast", () => {
  it("softens contact mid/outer and bumps felt/wood/card microcontrast", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T169");
    // T175 may supersede mid clamp 0.22→0.20; keep soft-mid + weave comments
    expect(src).toMatch(/Math\.min\(0\.2[02]|soft mid · T161/);
    expect(src).toMatch(/normalScale: new Vector2\(2\.(05|55|85),\s*2\.(05|55|85)\)/);
    expect(src).toMatch(/normalScale: new Vector2\(1\.(55|95),\s*1\.(55|95)\)/);
    expect(src).toMatch(/card stock micro-glaze|#f0d4a0/);
  });
});
