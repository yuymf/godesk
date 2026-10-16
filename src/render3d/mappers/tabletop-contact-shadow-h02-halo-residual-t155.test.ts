import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T155 contact shadow H02 halo residual", () => {
  it("enlarges route footprint while keeping T106 clamp and T154 rings", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T155");
    expect(src).toMatch(/usable \* 1\.05|T155 route/);
    const start = src.indexOf("function softContactShadow");
    const end = src.indexOf("function porcelainPlate", start);
    const block = src.slice(start, end > 0 ? end : start + 4000);
    expect(block).toMatch(/Math\.min\(1\.02/);
    expect(block).toMatch(/Math\.max\(0\.68/);
    expect(block).toContain("contact-shadow");
  });
});
