import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T218 shared contact-shadow product falloff", () => {
  it("smooths multi-ring falloff without vignette bait or suite fork", () => {
    const obj = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(obj).toContain("T218");
    // UI-surface-contrast · core-only product falloff (wide mid/outer rings retired)
    expect(obj).toMatch(/mk\(0\.92/);
    expect(obj).toMatch(/mk\(1\.12/);
    expect(obj).toMatch(/mk\(1\.28/);
    expect(obj).toMatch(/W \* 0\.(58|72)/); // vignette calm kept / tightened
    expect(obj).not.toMatch(/suite === ["']H0/);
    const spec = readFileSync("src/creator/render-spec.ts", "utf8");
    expect(spec).toContain("T218");
    expect(spec).not.toMatch(/suite === ["']H0/);
  });
});
