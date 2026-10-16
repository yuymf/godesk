import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { LABEL_LIFT } from "../number-labels";
import { TERRAIN_MATERIALS } from "../tokens";

describe("T257 · oil-paint continuity + wide emboss", () => {
  it("restores terrain albedo maps and deepens stamp recess", () => {
    expect(LABEL_LIFT).toBeLessThanOrEqual(0.00015);
    for (const key of ["wood", "brick", "sheep", "wheat", "ore", "desert"] as const) {
      expect(TERRAIN_MATERIALS[key]!.pbrBaseColor).not.toBe(false);
      expect(TERRAIN_MATERIALS[key]!.pbrTint!).toBeGreaterThanOrEqual(0.40);
    }
    const labels = readFileSync("src/render3d/number-labels.ts", "utf8");
    expect(labels).toContain("T257");
    expect(labels).toMatch(/fontPx \* 0\.1[2-9]|fontPx \* 0\.1[6-9]/);
  });
});
