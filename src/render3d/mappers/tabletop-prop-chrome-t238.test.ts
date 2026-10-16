import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T238 terrain props denser + chrome cornerCalm yield", () => {
  it("raises shared prop mesh/soft-edge and chrome yield without suite fork", () => {
    const props = readFileSync("src/render3d/terrain-props.ts", "utf8");
    expect(props).toContain("T238");
    expect(props).toMatch(/denser crown clumps|denser cauliflower/);
    const mat = readFileSync("src/render3d/materials.ts", "utf8");
    expect(mat).toContain("T238");
    expect(mat).toMatch(/SOFT_EDGE_STRENGTH = 0\.54/);
    const css = readFileSync("src/creator/tidewell-game-screen.css", "utf8");
    expect(css).toContain("T238");
    expect(props).not.toMatch(/suite === ["']H0/);
  });
});
