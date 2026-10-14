import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T070 hex placement sidebar dock", () => {
  it("boardTargets still default-collapsed", () => {
    const src = readFileSync("src/creator/HexSettlementBoard.tsx", "utf8");
    expect(src).toMatch(/useState\(false\)/);
    expect(src).not.toMatch(/setBoardTargetsOpen\(mq\.matches\)/);
  });

  it("open panel is thin edge dock (≤26vh / ≤24vw), not half-screen", () => {
    const css = readFileSync("src/creator/tidewell-game-screen.css", "utf8");
    expect(css).toContain("T070");
    const idx = css.indexOf(".hex-settlement-board-targets[open]");
    const openBlock = css.slice(idx, idx + 550);
    expect(openBlock).not.toMatch(/left:\s*50%/);
    expect(openBlock).not.toMatch(/transform:\s*translate\(-50%/);
    expect(openBlock).toMatch(/max-height:\s*min\(26vh/);
    expect(openBlock).toMatch(/max-width:\s*min\(260px,\s*24vw\)/);
    // ban large half-screen sizes from T067
    expect(openBlock).not.toMatch(/max-height:\s*min\(42vh/);
    expect(openBlock).not.toMatch(/width:\s*min\(360px/);
  });
});
