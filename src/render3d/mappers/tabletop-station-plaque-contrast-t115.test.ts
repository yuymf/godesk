import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T115 station label plaque contrast", () => {
  it("station plaques route through shared opaque plaque face", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("paintSharedOpaquePlaqueFace");
    expect(src).toContain("T115");
    // T051 length/truncation not whitewashed
    expect(src).toMatch(/stationName\.length \* 52/);
    expect(src).toMatch(/stationName\.slice\(0,\s*8\)|title:\s*stationName/);
    expect(src).toMatch(/Math\.min\(1\.15,\s*0\.42 \+ stationName\.length \* 0\.14\)/);
  });

  it("shared plaque face uses ink halo + dark wood frame", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    const start = src.indexOf("function paintSharedOpaquePlaqueFace");
    const end = src.indexOf("function plaqueWithFace", start);
    const block = src.slice(start, end > 0 ? end : start + 1200);
    expect(block).toContain("strokeText");
    expect(block).toContain("#0f172a");
    expect(block).toContain("#3f2a14");
  });
});
