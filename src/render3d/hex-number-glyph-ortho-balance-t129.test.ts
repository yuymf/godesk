import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { GLYPH_STRETCH_Y, LABEL_SIZE_PER_RADIUS } from "./number-labels";

describe("T129 hex number glyph ortho balance", () => {
  it("keeps T118 floors while balancing stretch and UV aspect", () => {
    expect(GLYPH_STRETCH_Y).toBeGreaterThanOrEqual(1.62);
    expect(GLYPH_STRETCH_Y).toBeLessThan(1.78);
    expect(GLYPH_STRETCH_Y).toBeGreaterThan(1.62);
    expect(LABEL_SIZE_PER_RADIUS).toBeGreaterThanOrEqual(2.5);
    const src = readFileSync("src/render3d/number-labels.ts", "utf8");
    expect(src).toContain("T129");
    expect(src).toMatch(/hz = h \* 0\.92|hz = \(label\.size \/ 2\) \* 0\.92/);
  });

  it("does not cut T125 framing markers", () => {
    const hx = readFileSync("src/render3d/mappers/hex-settlement.ts", "utf8");
    expect(hx).toContain("T125");
    const rig = readFileSync("src/render3d/camera-rig.ts", "utf8");
    expect(rig).toMatch(/kind === "meeple"/);
  });
});
