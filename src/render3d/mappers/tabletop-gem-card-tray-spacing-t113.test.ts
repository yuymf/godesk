import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T113 gem card tray spacing", () => {
  it("market columns use wider shared spacing", () => {
    const src = readFileSync("src/render3d/mappers/tabletop-kernels.ts", "utf8");
    expect(src).toContain("T113");
    expect(src).toMatch(/index \* 2\.08/);
    expect(src).toMatch(/tier \* 1\.32/);
    expect(src).toMatch(/size: 1\.28/);
  });

  it("does not hardcode gem/splendor sample names", () => {
    const src = readFileSync("src/render3d/mappers/tabletop-kernels.ts", "utf8");
    const blockStart = src.indexOf("T113 · shared card-column");
    const block = src.slice(blockStart, blockStart + 500);
    expect(block.toLowerCase()).not.toMatch(/splendor|宝石引擎特判/);
  });
});
