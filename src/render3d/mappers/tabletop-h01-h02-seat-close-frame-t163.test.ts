import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T163 H01/H02 seat-close product-frame residual", () => {
  it("adds dual-lip dark undercut + bright crown + inner gold fillet", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T163");
    expect(src).toMatch(/dual-lip product-frame|#3a2414|#ffe6b0|#f0d4a0|#d4a84a/);
    expect(src).toMatch(/felt-wood-lip[\s\S]*#f3d59a/);
    const rim = src.slice(src.indexOf('mesh === "felt-wood-rim"'), src.indexOf('mesh === "felt-wood-lip"'));
    expect(rim).toMatch(/undercut|crown lip|inner gold fillet/);
    const pieces = readFileSync("src/render3d/assets/pieces.ts", "utf8");
    expect(pieces).toMatch(/MEEPLE_RIM_HEX|#e8c878/);
    expect(pieces).toMatch(/MEEPLE_RIM_UNDERCUT|#3a2414/);
    const tokens = readFileSync("src/render3d/tokens.ts", "utf8");
    expect(tokens).toMatch(/T163[\s\S]*intensity: 0\.(58|92)|1\.15|exposure: 1\.32|#ffe6b0|#f0d4a0/);
  });
});
