import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T269 · harbor dock-lock + chrome wood hierarchy", () => {
  it("grounds harbor signs to dock plaque (no camera billboard sticker)", () => {
    const island = readFileSync("src/render3d/island.ts", "utf8");
    expect(island).toContain("T269");
    expect(island).toMatch(/dock-axis plaque|dock-lock|dock-locked/);
    expect(island).toMatch(/Math\.atan2\(d\.dir\[0\],\s*d\.dir\[1\]\)/);
    expect(island).toMatch(/SIGN_RADIUS = 0\.62/);
    expect(island).toMatch(/dummy\.position\.set\(px,\s*0\.46,\s*pz\)/);
  });

  it("demotes crown flat plastic to tip-hue wood albedo (no normalMap)", () => {
    const objs = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    const rim = objs.slice(objs.indexOf('mesh === "felt-wood-rim"'), objs.indexOf('mesh === "felt-wood-lip"'));
    expect(rim).toContain("T269");
    expect(rim).toMatch(/woodRimMaterial\(node, ctx\)\.clone\(\)/);
    expect(rim).toMatch(/normalMap = null/);
    expect(rim).toMatch(/#faf0d0/);
    expect(rim).toMatch(/0\.36/);
    const spec = readFileSync("src/creator/render-spec.ts", "utf8");
    expect(spec).toMatch(/T269/);
  });
});
