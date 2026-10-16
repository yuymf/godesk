import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T128 auction chrome microdensity", () => {
  it("zeroes immersive auction side pad while keeping T107/T124 height", () => {
    const css = readFileSync("src/creator/surface.css", "utf8");
    expect(css).toContain("T128");
    expect(css).toMatch(/auction-board\.room-view-tabletop-immersive[\s\S]{0,220}padding-left:\s*0/);
    expect(css).toMatch(/auction-board\.room-view-tabletop-immersive[\s\S]{0,280}padding-right:\s*0/);
    expect(css).toContain("T124");
    expect(css).toMatch(/78vh/);
    expect(css).toContain("T107");
    expect(css).toMatch(/auction-board\.room-view-tabletop-immersive[\s\S]{0,200}width:\s*100%/);
  });
});
