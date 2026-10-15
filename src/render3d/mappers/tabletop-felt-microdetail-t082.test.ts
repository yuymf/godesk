import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T082 tabletop felt microdetail", () => {
  it("feltPileMaterial builds weave albedo + normal + roughness maps", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T082");
    expect(src).toContain("normalMap");
    expect(src).toContain("roughnessMap");
    expect(src).toContain("installPattern");
    expect(src).toMatch(/normalScale/);
  });

  it("shared cloth pattern GLSL keeps denser weave (materials.ts)", () => {
    const src = readFileSync("src/render3d/materials.ts", "utf8");
    expect(src).toContain("T082");
    expect(src).toMatch(/w\.xz \* (48|28)\.0/); // T082 denser; T083 mid-freq for wide
    expect(src).toContain("pile");
  });

  it("T074 purge strings stay absent from felt path", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).not.toMatch(/gold:0/);
    expect(src).not.toMatch(/主交互在 3D/);
  });
});
