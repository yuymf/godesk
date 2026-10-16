import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T214 shared desk product light / felt / wood rim", () => {
  it("lifts shared felt weave + wood grain + desk light without vignette bait", () => {
    const obj = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(obj).toContain("T214");
    expect(obj).toMatch(/Vector2\((6\.05|6\.45|6\.85),\s*(6\.05|6\.45|6\.85)\)/);
    expect(obj).toMatch(/Vector2\((3\.05|3\.35|3\.65),\s*(3\.05|3\.35|3\.65)\)/);
    expect(obj).toMatch(/W \* 0\.58/);
    const spec = readFileSync("src/creator/render-spec.ts", "utf8");
    expect(spec).toContain("T214");
    expect(spec).toMatch(/exposure: (1\.(78|84|86|90|96)|1\.99|2\.(02|08))/);
    expect(spec).toMatch(/#(01cc56|00d45a|00dc5e|00e868)/);
    expect(spec).not.toMatch(/suite === ["']H0/);
  });
});
