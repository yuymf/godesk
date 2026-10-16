import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T270 · tall chip softContact grounded path", () => {
  it("adds grounded short-contact ring API and wires resource at playTop", () => {
    const objs = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    const start = objs.indexOf("function softContactShadow");
    const end = objs.indexOf("\nfunction ", start + 10);
    const fn = objs.slice(start, end);
    expect(fn).toContain("grounded");
    expect(fn).toContain("T270");
    expect(fn).toMatch(/clear short-contact|hard core hug|short near ring/);
    const gemStart = objs.indexOf('mesh === "gem-chip"');
    const gem = objs.slice(gemStart, gemStart + 900);
    expect(gem).toContain("gem-chip");
    expect(gem).toContain("T270");
    expect(gem).not.toMatch(/softContactShadow\(/); // foot via mapper playTop only
    const mapper = readFileSync("src/render3d/mappers/tabletop.ts", "utf8");
    expect(mapper).toMatch(/objectKind === "resource"/);
    expect(mapper).toMatch(/grounded-contact/);
    expect(mapper).toMatch(/playTop \+ 0\.003/);
  });
});
