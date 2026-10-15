import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { LABEL_SIZE_PER_RADIUS, LABEL_INK } from "./number-labels";

describe("T112 hex harbor/number stage-wide", () => {
  it("number label size and ink raised without dropping T099 floor", () => {
    expect(LABEL_SIZE_PER_RADIUS).toBeGreaterThanOrEqual(2.3);
    expect(LABEL_INK.toLowerCase()).toBe("#120e0c");
    const src = readFileSync("src/render3d/number-labels.ts", "utf8");
    expect(src).toContain("T112");
    expect(src).toContain("T099");
    expect(src).toContain("T101");
  });

  it("harbor atlas font/stroke raised (T101 kept)", () => {
    const src = readFileSync("src/render3d/island.ts", "utf8");
    expect(src).toContain("T112");
    expect(src).toContain("T101");
    expect(src).toMatch(/cell \* 0\.072/);
    expect(src).toMatch(/cell \* 0\.38/);
  });
});
