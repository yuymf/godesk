import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T124 auction canvas share residual", () => {
  it("raises auction seated stage height toward suite 78vh", () => {
    const css = readFileSync("src/creator/surface.css", "utf8");
    expect(css).toContain("T124");
    expect(css).toMatch(
      /auction-board\.room-view-tabletop-immersive[\s\S]{0,280}g3d-stage[\s\S]{0,120}78vh/,
    );
  });

  it("does not whitewash T107 full-bleed width", () => {
    const css = readFileSync("src/creator/surface.css", "utf8");
    expect(css).toContain("T107");
    expect(css).toMatch(/auction-board\.room-view-tabletop-immersive[\s\S]{0,200}width:\s*100%/);
  });
});
