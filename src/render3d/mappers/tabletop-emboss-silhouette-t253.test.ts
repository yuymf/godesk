import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { LABEL_LIFT } from "../number-labels";

describe("T253 · chip emboss + sheep silhouette", () => {
  it("sinks numeral stamp and preserves sheep darks", () => {
    expect(LABEL_LIFT).toBeLessThanOrEqual(0.0002);
    const labels = readFileSync("src/render3d/number-labels.ts", "utf8");
    expect(labels).toContain("T253");
    expect(labels).toMatch(/pressed stamp|recess shadow/);
    const props = readFileSync("src/render3d/terrain-props.ts", "utf8");
    expect(props).toContain("liftGlbSheepSilhouette");
    expect(props).toContain("T253");
    const plaque = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(plaque).toContain("T253");
  });
});
