import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { LABEL_SIZE_PER_RADIUS, NUMBER_TOKEN_SCALE } from "./number-labels";
import { NUMBER_TOKEN_SCALE as SCALE } from "./tokens";

describe("T099 hex number token legibility", () => {
  it("label size and token scale bumped for stage-wide", () => {
    expect(LABEL_SIZE_PER_RADIUS).toBeGreaterThanOrEqual(2.1);
    expect(SCALE).toBeGreaterThanOrEqual(1.55);
  });

  it("atlas draw uses stroke + larger pips (T099)", () => {
    const src = readFileSync("src/render3d/number-labels.ts", "utf8");
    expect(src).toContain("T099");
    expect(src).toContain("strokeText");
    expect(src).toMatch(/cell \* 0\.0(48|55)/);
  });
});
