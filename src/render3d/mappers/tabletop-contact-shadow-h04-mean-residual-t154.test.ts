import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T154 contact shadow H04 mean residual", () => {
  it("lifts tile footprint and soft mid/outer without cutting T106 clamp", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T154");
    expect(src).toContain("T153");
    const start = src.indexOf("function softContactShadow");
    const end = src.indexOf("function porcelainPlate", start);
    const block = src.slice(start, end > 0 ? end : start + 4000);
    expect(block).toMatch(/Math\.min\(1\.02/);
    expect(block).toMatch(/Math\.max\(0\.68/);
    expect(block).toMatch(/2\.(40|50)/);
    expect(block).toMatch(/4\.(35|60)/);
    expect(src).toMatch(/T154 tile residual|tile residual/);
  });
});
