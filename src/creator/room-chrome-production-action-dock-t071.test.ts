import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const boards = [
  "src/creator/NetworkRouteBoard.tsx",
  "src/creator/GemEngineBoard.tsx",
  "src/creator/AuctionBiddingBoard.tsx",
  "src/creator/PatternDraftBoard.tsx",
];

describe("T071 room chrome production action dock", () => {
  it("replaces developer-tone drawer summary across tabletop boards", () => {
    for (const path of boards) {
      const src = readFileSync(path, "utf8");
      expect(src).not.toContain("桌面行动（主交互在 3D；点此展开按钮）");
      expect(src).toContain("desk-action-drawer-summary");
      expect(src).toMatch(/行动/);
    }
  });

  it("network HUD drops seat-id field dump from turn line", () => {
    const src = readFileSync("src/creator/NetworkRouteBoard.tsx", "utf8");
    expect(src).not.toMatch(/\{copy\.seat\} \{activeSeat\} · \{statusLine\}/);
    expect(src).not.toMatch(/0=\{count0\} · 1=\{count1\} · \{lastLine\}/);
  });

  it("auction HUD drops chips debug dump", () => {
    const src = readFileSync("src/creator/AuctionBiddingBoard.tsx", "utf8");
    expect(src).not.toMatch(/筹码 \$\{auction\.chips\.map/);
  });
});
