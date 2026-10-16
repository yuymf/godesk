import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T218 shared contact-shadow product falloff", () => {
  it("smooths multi-ring falloff without vignette bait or suite fork", () => {
    const obj = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(obj).toContain("T218");
    expect(obj).toMatch(/mk\(1\.42/);
    expect(obj).toMatch(/mk\(1\.78/);
    expect(obj).toMatch(/mk\(2\.80/);
    expect(obj).toMatch(/mk\(4\.60/);
    expect(obj).toMatch(/W \* 0\.42/); // vignette calm kept
    expect(obj).not.toMatch(/suite === ["']H0/);
    const spec = readFileSync("src/creator/render-spec.ts", "utf8");
    expect(spec).toContain("T218");
    expect(spec).not.toMatch(/suite === ["']H0/);
  });
});
