import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T130 auction stage edge bleed", () => {
  it("zeros immersive auction side borders while keeping T107/T124/T128", () => {
    const css = readFileSync("src/creator/surface.css", "utf8");
    expect(css).toContain("T130");
    expect(css).toMatch(
      /auction-board\.room-view-tabletop-immersive[\s\S]{0,360}border-left:\s*0/,
    );
    expect(css).toMatch(
      /auction-board\.room-view-tabletop-immersive[\s\S]{0,400}border-right:\s*0/,
    );
    expect(css).toContain("T128");
    expect(css).toContain("T124");
    expect(css).toMatch(/78vh/);
    expect(css).toContain("T107");
    expect(css).toMatch(/auction-board\.room-view-tabletop-immersive[\s\S]{0,200}width:\s*100%/);
    expect(css).toMatch(
      /auction-board\.room-view-tabletop-immersive[\s\S]{0,280}padding-left:\s*0/,
    );
  });
});
