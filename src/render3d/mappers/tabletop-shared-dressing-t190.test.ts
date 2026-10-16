import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T190 shared desk dressing / contact microcontrast", () => {
  it("lifts felt weave + contact + tray without suite fork", () => {
    const obj = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(obj).toContain("T190");
    expect(obj).toMatch(/Vector2\(4\.95,\s*4\.95\)/);
    expect(obj).toMatch(/mk\(1\.72/);
    const pieces = readFileSync("src/render3d/assets/pieces.ts", "utf8");
    expect(pieces).toMatch(/MEEPLE_HEX_SCALE = 1\.74/);
    expect(pieces).toMatch(/#f6dcb0/);
    expect(obj).not.toMatch(/suite === ["']H0/);
  });
});
