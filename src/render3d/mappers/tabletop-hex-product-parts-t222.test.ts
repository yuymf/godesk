import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T222/T241 hex product parts", () => {
  it("thickens number chip, harbor plaque without suite fork", () => {
    const labels = readFileSync("src/render3d/number-labels.ts", "utf8");
    expect(labels).toMatch(/NUMBER_TOKEN_RADIUS = 0\.258/);
    expect(labels).toMatch(/NUMBER_TOKEN_HALF_HEIGHT = 0\.072/);
    expect(labels).toContain("T241");
    const tokens = readFileSync("src/render3d/tokens.ts", "utf8");
    expect(tokens).toMatch(/NUMBER_TOKEN_SCALE = 1\.98/);
    const island = readFileSync("src/render3d/island.ts", "utf8");
    expect(island).toMatch(/SIGN_RADIUS = 0\.382/);
    expect(island).toMatch(/T241/);
    expect(tokens).not.toMatch(/suite === ["']H0/);
  });
});
