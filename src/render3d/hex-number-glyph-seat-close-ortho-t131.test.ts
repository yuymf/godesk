import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { GLYPH_STRETCH_Y, LABEL_LIFT, LABEL_SIZE_PER_RADIUS } from "./number-labels";

describe("T131 hex number glyph seat-close ortho", () => {
  it("further flattens UV / stretch / lift without cutting T118 floor", () => {
    expect(GLYPH_STRETCH_Y).toBeGreaterThanOrEqual(1.62);
    expect(GLYPH_STRETCH_Y).toBeLessThanOrEqual(1.68);
    expect(LABEL_SIZE_PER_RADIUS).toBeGreaterThanOrEqual(2.5);
    expect(LABEL_LIFT).toBeLessThanOrEqual(0.002);
    const src = readFileSync("src/render3d/number-labels.ts", "utf8");
    expect(src).toContain("T131");
    expect(src).toMatch(/hz = h \* 0\.88/);
    expect(src).toMatch(/hz = \(label\.size \/ 2\) \* 0\.88/);
  });

  it("keeps T125 framing and T129 markers", () => {
    const src = readFileSync("src/render3d/number-labels.ts", "utf8");
    expect(src).toContain("T129");
    const hx = readFileSync("src/render3d/mappers/hex-settlement.ts", "utf8");
    expect(hx).toContain("T125");
  });
});
