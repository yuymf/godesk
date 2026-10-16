import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { LABEL_SIZE_PER_RADIUS, LABEL_INK, GLYPH_STRETCH_Y } from "./number-labels";
import { NUMBER_TOKEN_SCALE } from "./tokens";

describe("T118 hex harbor/number stage-wide follow-up", () => {
  it("raises number glyph/size without dropping T099/T101/T112 floors", () => {
    expect(LABEL_SIZE_PER_RADIUS).toBeGreaterThanOrEqual(2.5);
    expect(LABEL_INK.toLowerCase()).toMatch(/^#(120e0c|0c0806|0a0604)$/);
    expect(GLYPH_STRETCH_Y).toBeGreaterThanOrEqual(1.62);
    expect(NUMBER_TOKEN_SCALE).toBeGreaterThanOrEqual(1.55);
    const src = readFileSync("src/render3d/number-labels.ts", "utf8");
    expect(src).toContain("T118");
    expect(src).toContain("T112");
  });

  it("harbor atlas + SIGN_RADIUS raised (T101/T112 kept)", () => {
    const src = readFileSync("src/render3d/island.ts", "utf8");
    expect(src).toContain("T118");
    expect(src).toMatch(/cell \* 0\.(098|112)/);
    expect(src).toMatch(/cell \* 0\.(48|54)/);
    expect(src).toMatch(/SIGN_RADIUS = 0\.(28|32|335|355|368|382)/);
  });
});
