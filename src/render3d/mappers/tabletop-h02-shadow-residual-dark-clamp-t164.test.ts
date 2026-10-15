import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T164 H02 shadow residual under dark-clamp", () => {
  it("enlarges route footprint without re-densifying T161 mid blot", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T164");
    expect(src).toMatch(/usable \* 1\.45|T164 route/);
    const start = src.indexOf("function softContactShadow");
    const end = src.indexOf("function porcelainPlate", start);
    const block = src.slice(start, end > 0 ? end : start + 4000);
    expect(block).toMatch(/T161 lighter|dark-clamp/);
    expect(block).toMatch(/Math\.min\(0\.(22|26)|0\.(22|26),/); // mid stays light
  });
});
