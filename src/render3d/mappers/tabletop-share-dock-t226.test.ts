import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T226 share dock yield + contact/felt product", () => {
  it("demotes dock/action labels and tightens shared contact shadow", () => {
    const tw = readFileSync("src/creator/tidewell-game-screen.css", "utf8");
    expect(tw).toContain("T226");
    expect(tw).toMatch(/--tw-side:\s*16px/);
    expect(tw).toMatch(/--tw-dock:\s*3px/);
    const surface = readFileSync("src/creator/surface.css", "utf8");
    expect(surface).toContain("T226");
    const tt = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(tt).toContain("T226");
    expect(tt).toMatch(/mk\(1\.24/);
    const spec = readFileSync("src/creator/render-spec.ts", "utf8");
    expect(spec).toMatch(/#10ff78/);
  });
});
