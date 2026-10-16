import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ROOM_COPY } from "./room-presentation";

describe("T080 room share chrome production", () => {
  it("RoomView keeps playtest feedback in a collapsed drawer for tabletop kernels", () => {
    const src = readFileSync("src/creator/RoomView.tsx", "utf8");
    expect(src).toContain("feedbackAsDrawer");
    expect(src).toContain("shareChromeCompact");
    expect(src).toContain('className="room-feedback-drawer"');
    expect(src).toMatch(/feedbackAsDrawer \? \(/);
    // Open always-on panel must not be the sole path for desk kernels
    expect(src).toContain("T080");
  });

  it("collapsed share chrome purges invite/link strip (T186); copy stays production-friendly", () => {
    const src = readFileSync("src/creator/RoomView.tsx", "utf8");
    // T186 · seated shareReady no longer mounts shareLinkReady / is-share-ready input
    expect(src).toContain("room-share-chrome");
    expect(src).toContain("T186");
    expect(src).not.toMatch(/shareChromeCompact \? copy\.shareLinkReady/);
    expect(ROOM_COPY.zh.shareLinkReady).toMatch(/复制链接/);
    expect(ROOM_COPY.en.shareLinkReady).toMatch(/Copy link/i);
  });

  it("TabletopGameScreen / HexSettlementBoard still open the shared feedback drawer", () => {
    for (const path of [
      "src/creator/TabletopGameScreen.tsx",
      "src/creator/HexSettlementBoard.tsx",
    ]) {
      const src = readFileSync(path, "utf8");
      expect(src).toContain('getElementById("room-feedback-drawer")');
    }
  });
});
