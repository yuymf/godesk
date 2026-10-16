import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T094 route rail microdetail", () => {
  it("rail path materials build ballast/sleeper/steel maps", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T094");
    expect(src).toContain("railSleeperMaterial");
    expect(src).toContain("railBallastMaterial");
    expect(src).toContain("railSteelMaterial");
    expect(src).toContain("makeRailMaps");
    expect(src).toMatch(/normalMap/);
    expect(src).toMatch(/roughnessMap/);
  });

  it("railTrack still embeds T079 contact shadow and T078 cold bed", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    const start = src.indexOf("function railTrack");
    const end = src.indexOf("function signalPost", start);
    const block = src.slice(start, end);
    expect(block).toContain("softContactShadow");
    expect(block).toContain("railBallastMaterial");
    expect(block).toContain("T078");
    expect(block).toContain("castShadow = true");
  });

  it("T074 purge strings stay absent", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).not.toMatch(/gold:0/);
    expect(src).not.toMatch(/主交互在 3D/);
  });
});
