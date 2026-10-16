import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T040 seated immersive shell markers", () => {
  it("RoomView applies immersive strip class when seated tabletop", () => {
    const src = readFileSync("src/creator/RoomView.tsx", "utf8");
    expect(src).toContain("is-immersive-strip");
    expect(src).toContain("tabletopImmersive && seat !== null");
  });

  it("desk boards expose stage HUD outside the action drawer", () => {
    for (const file of [
      "src/creator/GemEngineBoard.tsx",
      "src/creator/PatternDraftBoard.tsx",
      "src/creator/AuctionBiddingBoard.tsx",
    ]) {
      const src = readFileSync(file, "utf8");
      expect(src).toContain("desk-stage-hud");
      const hudAt = src.indexOf("desk-stage-hud");
      const drawerAt = src.indexOf("desk-action-drawer");
      expect(hudAt).toBeGreaterThan(-1);
      expect(drawerAt).toBeGreaterThan(hudAt);
    }
  });
});
