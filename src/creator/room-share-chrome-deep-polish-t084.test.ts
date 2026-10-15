import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ROOM_COPY } from "./room-presentation";

describe("T084 share chrome deep polish", () => {
  it("tabletop RoomView folds action-log into a collapsed drawer", () => {
    const src = readFileSync("src/creator/RoomView.tsx", "utf8");
    expect(src).toContain("room-action-log-drawer");
    expect(src).toContain("room-action-log-summary");
    expect(src).toContain("feedbackAsDrawer");
    expect(src).toContain("shareChromeCompact");
  });

  it("CSS keeps desk-action-drawer and action-log compact when closed", () => {
    const css = readFileSync("src/creator/surface.css", "utf8");
    expect(css).toContain("T084");
    expect(css).toContain("room-action-log-drawer");
    expect(css).toMatch(/desk-action-drawer:not\(\[open\]\)/);
  });

  it("shareLinkReady copy stays production-friendly", () => {
    expect(ROOM_COPY.zh.shareLinkReady).toMatch(/复制链接/);
    expect(ROOM_COPY.en.shareLinkReady).toMatch(/Copy link/i);
  });

  it("boards keep production action dock summaries (T071)", () => {
    for (const path of [
      "src/creator/GemEngineBoard.tsx",
      "src/creator/NetworkRouteBoard.tsx",
      "src/creator/PatternDraftBoard.tsx",
      "src/creator/AuctionBiddingBoard.tsx",
    ]) {
      const src = readFileSync(path, "utf8");
      expect(src).toContain("desk-action-drawer-summary");
      expect(src).not.toContain("主交互在 3D");
    }
  });
});
