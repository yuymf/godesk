import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T192 H01+H02 shared hard residual", () => {
  it("lifts shared hex terrain sat + network map without suite fork", () => {
    const mats = readFileSync("src/render3d/materials.ts", "utf8");
    expect(mats).toMatch(/TERRAIN_SATURATION = 1\.48/);
    const tokens = readFileSync("src/render3d/tokens.ts", "utf8");
    expect(tokens).toContain("T192");
    expect(tokens).toMatch(/intensity: 4\.55/);
    const spec = readFileSync("src/creator/render-spec.ts", "utf8");
    expect(spec).toContain("T192");
    expect(spec).toMatch(/#(04d068|03d870)/); // T192→T206 network map
    expect(spec).not.toMatch(/suite === ["']H0/);
  });
});
