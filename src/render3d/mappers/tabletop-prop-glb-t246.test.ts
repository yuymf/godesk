import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T246 GLB terrain props + hex dressing fidelity", () => {
  it("wires Tidewell GLB trees/sheep/rocks into shared terrain-props without suite fork", () => {
    const props = readFileSync("src/render3d/terrain-props.ts", "utf8");
    expect(props).toContain("T246");
    expect(props).toContain("getTidewellGeometriesSync");
    expect(props).toContain("glbOr");
    const templates = readFileSync("src/render3d/model-templates.ts", "utf8");
    expect(templates).toMatch(/normalizeExtent\(sheep, 0\.42\)/);
    expect(templates).toMatch(/extent = key === "wood" \? 0\.58/);
    const dressing = readFileSync("src/render3d/hex-dressing.ts", "utf8");
    expect(dressing).toContain("T246");
    expect(props).not.toMatch(/suite === ["']H0/);
  });
});
