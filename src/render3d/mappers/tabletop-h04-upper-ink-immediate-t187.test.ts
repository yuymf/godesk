import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { defaultRenderSpec } from "../../creator/render-spec";

describe("T187 H04 upper-ink vs immediate tip (shared desk light)", () => {
  it("brightens shared desk sky/fill without suite fork", () => {
    const src = readFileSync("src/creator/render-spec.ts", "utf8");
    expect(src).toContain("T187");
    expect(src).not.toMatch(/suite === ["']H04["']/);
    const light = defaultRenderSpec("pattern-draft-v1", "table")!.lighting;
    expect(light.hemisphere.sky.toLowerCase()).toMatch(/^#fff/);
    expect(light.hemisphere.intensity).toBeGreaterThanOrEqual(1.08);
    expect(light.fill?.intensity).toBeGreaterThanOrEqual(0.92);
    expect(light.exposure).toBeGreaterThanOrEqual(1.40);
  });
});
