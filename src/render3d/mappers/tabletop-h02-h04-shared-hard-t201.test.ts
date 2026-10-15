import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T201 H02+H04 shared hard residual", () => {
  it("lifts shared network + desk/pattern dressing without suite fork or vignette bait", () => {
    const spec = readFileSync("src/creator/render-spec.ts", "utf8");
    expect(spec).toContain("T201");
    expect(spec).toMatch(/exposure: 1\.66/); // network
    expect(spec).toMatch(/#04d068/);
    expect(spec).toMatch(/#05c454/); // pattern felt
    expect(spec).toMatch(/exposure: 1\.62/); // desk shared
    const obj = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(obj).toMatch(/Vector2\(5\.35,\s*5\.35\)/);
    expect(obj).toMatch(/W \* 0\.42/); // T202 vignette calm — no bait
    expect(spec).not.toMatch(/suite === ["']H0/);
  });
});
