import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T067 hex Room tabletop-first", () => {
  it("boardTargetsOpen defaults closed (island not buried by placement modal)", () => {
    const src = readFileSync("src/creator/HexSettlementBoard.tsx", "utf8");
    expect(src).toContain("T067");
    expect(src).toMatch(/useState\(false\)/);
    expect(src).not.toMatch(/setBoardTargetsOpen\(mq\.matches\)/);
    expect(src).not.toMatch(
      /boardTargetsOpen[^=]*= useState\(\(\) => \{\s*if \(typeof window === "undefined"\) return true/,
    );
  });

  it("open board-targets is side drawer, not centered fullscreen overlay", () => {
    const css = readFileSync("src/creator/tidewell-game-screen.css", "utf8");
    expect(css).toContain("T067");
    const openBlock = css.slice(
      css.indexOf(".hex-settlement-board-targets[open]"),
      css.indexOf(".hex-settlement-board-targets[open]") + 500,
    );
    expect(openBlock).not.toMatch(/left:\s*50%/);
    expect(openBlock).not.toMatch(/transform:\s*translate\(-50%/);
    expect(openBlock).toMatch(/max-height:\s*min\(42vh/);
  });
});
