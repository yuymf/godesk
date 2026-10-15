import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ROOM_COPY } from "./room-presentation";

describe("T091 hex share chrome parity", () => {
  it("shareChromeCompact covers hexSettlement when seated", () => {
    const src = readFileSync("src/creator/RoomView.tsx", "utf8");
    expect(src).toContain("T091");
    expect(src).toMatch(/tabletopImmersive \|\| hexSettlement/);
    expect(src).toMatch(/!immersive \|\| shareChromeCompact/);
  });

  it("hex action-log uses collapsed drawer like tabletop", () => {
    const src = readFileSync("src/creator/RoomView.tsx", "utf8");
    expect(src).toMatch(/tabletopImmersive \|\| hexSettlement \? \(/);
    expect(src).toContain("room-action-log-drawer");
  });

  it("CSS declares hex seated shareReady strip", () => {
    const css = readFileSync("src/creator/surface.css", "utf8");
    expect(css).toContain("T091");
    expect(css).toContain("room-view-hex-island.room-view-seated");
    expect(css).toContain("is-share-ready");
  });

  it("tidewell immersive hide is pierced for seated share chrome", () => {
    const css = readFileSync("src/creator/tidewell-game-screen.css", "utf8");
    expect(css).toContain("T091");
    expect(css).toMatch(/room-invitation\.room-share-chrome/);
    expect(css).toMatch(/display:\s*grid\s*!important/);
  });

  it("shareLinkReady copy has no localhost", () => {
    expect(ROOM_COPY.zh.shareLinkReady.toLowerCase()).not.toContain("localhost");
    expect(ROOM_COPY.en.shareLinkReady.toLowerCase()).not.toContain("localhost");
  });
});
