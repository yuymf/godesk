import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T126 side-rail overlay legibility", () => {
  it("densifies seated overlay rail background/contrast", () => {
    const css = readFileSync("src/creator/tidewell-game-screen.css", "utf8");
    expect(css).toContain("T126");
    expect(css).toMatch(/overlay rail legibility/);
    const start = css.indexOf("T126 · overlay rail legibility");
    const block = css.slice(start, start + 900);
    expect(block).toMatch(/box-shadow/);
    expect(block).toMatch(/rgba\(243,\s*231,\s*201/);
  });

  it("keeps T100/T103/T122 canvasShare + compact rail", () => {
    const css = readFileSync("src/creator/tidewell-game-screen.css", "utf8");
    expect(css).toContain("T100");
    expect(css).toMatch(/--tw-side:\s*168px/);
    expect(css).toContain("T103");
    expect(css).toMatch(/tidewell-player-avatar[\s\S]*36px/);
    expect(css).toContain("T122");
    expect(css).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  });
});
