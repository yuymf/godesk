import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("UI-action-drawer · legal actions in 2D shell", () => {
  it("desk boards open a marked action drawer by default", () => {
    for (const file of [
      "src/creator/GemEngineBoard.tsx",
      "src/creator/PatternDraftBoard.tsx",
      "src/creator/AuctionBiddingBoard.tsx",
      "src/creator/NetworkRouteBoard.tsx",
    ]) {
      const src = readFileSync(file, "utf8");
      expect(src, file).toContain('data-ui-action-drawer="1"');
      expect(src, file).toMatch(/desk-action-drawer"[^>]*\bopen\b|\bopen\b[^>]*desk-action-drawer/);
    }
  });

  it("legal vs disabled states are distinct in drawer CSS", () => {
    const css = readFileSync("src/creator/surface.css", "utf8");
    expect(css).toContain("UI-action-drawer");
    expect(css).toMatch(/button\.is-legal/);
    expect(css).toMatch(/button\.is-disabled|button:disabled/);
    expect(css).toMatch(/desk-action-drawer[\s\S]*?pointer-events:\s*auto/);
    expect(css).not.toMatch(/suite === ["']H0/);
  });

  it("hex primary/board actions carry is-legal when actionable", () => {
    const src = readFileSync("src/creator/HexSettlementBoard.tsx", "utf8");
    expect(src).toMatch(/hex-island-action[\s\S]*?is-legal/);
  });
});
