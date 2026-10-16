import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T062 network Room tabletop-first", () => {
  it("NetworkRouteBoard prefers TabletopStage + desk drawer (not SVG-as-board)", () => {
    const src = readFileSync("src/creator/NetworkRouteBoard.tsx", "utf8");
    expect(src).toContain("TabletopStage");
    expect(src).toContain("desk-action-drawer");
    expect(src).toContain("room-view-tabletop-immersive");
    // Primary return must not be the old SVG board root
    expect(src).not.toMatch(/return \(\s*<div[^>]*className="network-route-board"[^>]*>\s*<section[^>]*network-route-hud/);
  });

  it("RoomView treats networkRoute as deskTabletop immersive", () => {
    const src = readFileSync("src/creator/RoomView.tsx", "utf8");
    expect(src).toMatch(/deskTabletop = Boolean\([^)]*networkRoute/);
  });
});
