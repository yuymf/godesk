import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T116 meeple base disc tune", () => {
  it("dims cream rim albedo without removing T090/T106", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T116");
    expect(src).toContain("T090");
    expect(src).toMatch(/cream rim/);
    expect(src).toContain("#a89478");
    // T106 meeple footprint kept
    expect(src).toMatch(/softContactShadow\(0\.(26|30|34),\s*0\.(22|26|30)\)/);
  });
});
