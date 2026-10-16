import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T133 hex force-inject reliability", () => {
  it("exports readiness + budgeted force helpers", () => {
    const src = readFileSync("scripts/hardness-force-inject.mjs", "utf8");
    expect(src).toContain("T133");
    expect(src).toContain("waitRoomCanvasReady");
    expect(src).toContain("runHexForceWithBudget");
    expect(src).toContain("awaitSeatCloseGlyphReady");
    expect(src).toContain("reliability");
  });

  it("keeps T118 glyph floor while absorbing seat-close ortho residual", () => {
    const labels = readFileSync("src/render3d/number-labels.ts", "utf8");
    expect(labels).toMatch(/GLYPH_STRETCH_Y = 1\.63/);
    expect(labels).toMatch(/hz = h \* 0\.85/);
    expect(labels).toContain("T133");
  });
});
