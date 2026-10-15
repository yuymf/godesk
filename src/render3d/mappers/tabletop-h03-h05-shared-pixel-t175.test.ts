import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T175 H03–H05 shared pixel hard gate", () => {
  it("bumps shared desk-kernel lighting/materials (no suite fork)", () => {
    const spec = readFileSync("src/creator/render-spec.ts", "utf8");
    expect(spec).toContain("T175");
    expect(spec).toMatch(/gem-engine-v1[\s\S]*pattern-draft-v1[\s\S]*auction-bidding-v1/);
    expect(spec).toMatch(/exposure:\s*1\.32/);
    expect(spec).toMatch(/#0f9540/);
    // must stay one shared block, not H03-only
    expect(spec).not.toMatch(/if \(kernelType === "gem-engine-v1"\) \{[\s\S]*T175/);
  });

  it("raises shared felt/wood microcontrast and contact veil", () => {
    const objs = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(objs).toContain("T175");
    expect(objs).toMatch(/Vector2\(2\.85,\s*2\.85\)/);
    expect(objs).toMatch(/Math\.min\(0\.20,\s*opacity \* 0\.30\)/);
  });
});
