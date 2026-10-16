import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T172 H02 board interior density", () => {
  it("brightens shared map cloth and enlarges station pedestal", () => {
    const spec = readFileSync("src/creator/render-spec.ts", "utf8");
    expect(spec).toContain("T172");
    expect(spec).toMatch(/#2a8f52/);
    const objs = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(objs).toContain("T172");
    expect(objs).toMatch(/CylinderGeometry\(0\.58, 0\.62/);
  });

  it("adds shared interior dressing pads on network map", () => {
    const kernels = readFileSync("src/render3d/mappers/tabletop-kernels.ts", "utf8");
    expect(kernels).toContain("T172");
    expect(kernels).toMatch(/board-interior density/);
    expect(kernels).toMatch(/spanX \* scale \+ 2\.2/);
  });
});
