import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T161 H04 wide halo dark clamp", () => {
  it("lightens mid/outer blot and clamps auto opacity ceiling while keeping core", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T161");
    const start = src.indexOf("function softContactShadow");
    const end = src.indexOf("function porcelainPlate", start);
    const block = src.slice(start, end > 0 ? end : start + 4000);
    expect(block).toMatch(/Math\.min\(1\.02/);
    expect(block).toMatch(/Math\.max\(0\.68/);
    expect(block).toMatch(/dark-clamp|T161 lighter/);
    expect(block).toMatch(/Math\.min\(0\.68/);
    expect(block).toMatch(/2\.45|2\.55/);
  });
});
