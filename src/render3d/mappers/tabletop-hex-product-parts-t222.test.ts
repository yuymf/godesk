import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T222/T225 hex product parts", () => {
  it("thickens number chip, harbor plaque, water microcontrast without suite fork", () => {
    const labels = readFileSync("src/render3d/number-labels.ts", "utf8");
    expect(labels).toMatch(/NUMBER_TOKEN_RADIUS = 0\.25/);
    expect(labels).toMatch(/NUMBER_TOKEN_HALF_HEIGHT = 0\.055/);
    expect(labels).toContain("T225");
    const tokens = readFileSync("src/render3d/tokens.ts", "utf8");
    expect(tokens).toMatch(/NUMBER_TOKEN_SCALE = 1\.98/);
    expect(tokens).toContain("wood-chip");
    const island = readFileSync("src/render3d/island.ts", "utf8");
    expect(island).toMatch(/SIGN_RADIUS = 0\.335/);
    expect(island).toContain("T225");
    expect(island).toMatch(/wetFootDark: tier === "high" \|\| tier === "medium"/);
    const spec = readFileSync("src/creator/render-spec.ts", "utf8");
    expect(spec).toMatch(/#2af0dc/);
    expect(spec).toMatch(/#0c6878/);
    expect(spec).not.toMatch(/suite === ["']H0/);
    const hex = readFileSync("src/render3d/mappers/hex-settlement.ts", "utf8");
    expect(hex).toMatch(/1\.42/);
  });
});
