import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { LABEL_INK, LABEL_SIZE_PER_RADIUS } from "./number-labels";

describe("T101 harbor + number wide contrast", () => {
  it("harbor sign atlas uses thicker stroke + larger fonts (T101)", () => {
    const src = readFileSync("src/render3d/island.ts", "utf8");
    expect(src).toContain("T101");
    expect(src).toMatch(/cell \* 0\.055/);
    expect(src).toMatch(/cell \* 0\.32/);
  });

  it("number labels keep T099 size and gain darker ink (T101)", () => {
    expect(LABEL_SIZE_PER_RADIUS).toBeGreaterThanOrEqual(2.1);
    expect(LABEL_INK.toLowerCase()).toBe("#1a1612");
    const src = readFileSync("src/render3d/number-labels.ts", "utf8");
    expect(src).toContain("T101");
    expect(src).toContain("strokeText");
  });
});
