import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T249 · prop bright un-burnt (keep GLB mesh)", () => {
  it("lifts GLB albedo and uses bright matte prop materials", () => {
    const src = readFileSync("src/render3d/terrain-props.ts", "utf8");
    expect(src).toContain("liftGlbAlbedo");
    expect(src).toContain("T249");
    expect(src).toMatch(/pineTall: new Color\(0\.72/);
    expect(src).toMatch(/installPattern\(material, "grass", 0\.12\)/);
    expect(src).toMatch(/envMapIntensity: 0/);
    expect(src).toMatch(/opacity: 0\.82/);
  });
});
