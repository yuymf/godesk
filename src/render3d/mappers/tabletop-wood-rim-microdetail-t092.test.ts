import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T092 wood rim microdetail", () => {
  it("woodRimMaterial builds grain albedo + normal + roughness maps", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T092");
    expect(src).toContain("woodRimMaterial");
    expect(src).toContain("normalMap");
    expect(src).toContain("roughnessMap");
    expect(src).toMatch(/installPattern\(mat, "grain"/);
    expect(src).toMatch(/normalScale/);
    // applied to both rim meshes
    expect(src).toMatch(/felt-wood-rim[\s\S]*woodRimMaterial/);
    expect(src).toMatch(/felt-wood-lip[\s\S]*woodRimMaterial/);
  });

  it("shared grain pattern GLSL keeps ring/pore microdetail (materials.ts)", () => {
    const src = readFileSync("src/render3d/materials.ts", "utf8");
    expect(src).toContain("T092");
    expect(src).toContain("pore");
    expect(src).toMatch(/ring/);
  });

  it("T074 purge strings stay absent; cast/receive shadow preserved on rim", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).not.toMatch(/gold:0/);
    expect(src).not.toMatch(/主交互在 3D/);
    // rim rails still cast + receive
    const rimBlock = src.slice(src.indexOf('mesh === "felt-wood-rim"'), src.indexOf('mesh === "felt-wood-lip"'));
    expect(rimBlock).toContain("castShadow = true");
    expect(rimBlock).toContain("receiveShadow = true");
  });

  it("T086 lighting fill/rim still present (no lighting regress)", () => {
    const src = readFileSync("src/render3d/lighting.ts", "utf8");
    expect(src).toMatch(/gd:fill|fill/);
    expect(src).toMatch(/gd:rim|rim/);
  });
});
