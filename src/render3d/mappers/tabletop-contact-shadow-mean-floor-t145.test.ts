import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T145 contact shadow mean floor", () => {
  it("adds soft halo and raises opacity without cutting T106 boost clamp", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T145");
    expect(src).toContain("T142");
    const start = src.indexOf("function softContactShadow");
    const end = src.indexOf("function porcelainPlate", start);
    const block = src.slice(start, end > 0 ? end : start + 2800);
    expect(block).toMatch(/Math\.min\(1\.02/);
    expect(block).toMatch(/Math\.max\(0\.68/);
    expect(block).toMatch(/Math\.min\(0\.7[06]/);
    expect(block).toMatch(/Math\.max\(0\.(38|42)/);
    expect(block).toMatch(/soft halo/);
    expect(block).toMatch(/2\.15/);
    expect(block).toContain('mesh.name = name');
  });
});
