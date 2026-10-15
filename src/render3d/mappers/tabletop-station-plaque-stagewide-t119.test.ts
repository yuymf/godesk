import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T119 station plaque stage-wide residual", () => {
  it("enlarges world plaque without whitewashing T051 length / T115 face", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T119");
    expect(src).toContain("T115");
    expect(src).toContain("paintSharedOpaquePlaqueFace");
    expect(src).toMatch(/stationName\.length \* 52/);
    expect(src).toMatch(/Math\.min\(1\.45,\s*0\.52 \+ stationName\.length \* 0\.16\)/);
    expect(src).toMatch(/PlaneGeometry\(pw,\s*0\.46\)/);
  });
});
