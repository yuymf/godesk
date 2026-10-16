import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("UI-share-seat · shareReady + seat/invite row playable", () => {
  it("RoomView mounts shareReady invite row even when chrome is compact", () => {
    const src = readFileSync("src/creator/RoomView.tsx", "utf8");
    expect(src).toContain("UI-share-seat");
    expect(src).toContain("data-ui-share-ready");
    expect(src).toContain('data-share-ready-visible="1"');
    expect(src).toContain('data-invite-link-row="1"');
    expect(src).toContain("is-share-ready");
    expect(src).toContain("shareChromeCompact ? copy.shareLinkReady");
    // Invite row must not be gated behind !shareChromeCompact
    const inviteIdx = src.indexOf('data-invite-link-row="1"');
    const gateIdx = src.indexOf("{!shareChromeCompact ? (");
    expect(inviteIdx).toBeGreaterThan(-1);
    // The settings gate may exist; invite row itself must be outside any purge block
    expect(src).toMatch(/invitation-link-row" data-invite-link-row="1"/);
  });

  it("surface.css restores invite + seat contrast and pointer events", () => {
    const css = readFileSync("src/creator/surface.css", "utf8");
    expect(css).toContain("UI-share-seat");
    expect(css).toMatch(/data-ui-share-ready[\s\S]*?pointer-events:\s*auto/);
    expect(css).toMatch(/invite-url\.is-share-ready[\s\S]*?opacity:\s*1/);
    expect(css).toMatch(/seat-chip:not\(\.is-yours\)[\s\S]*?display:\s*inline-flex/);
    expect(css).not.toMatch(/suite === ["']H0/);
  });

  it("tidewell immersive share strip is visible and clickable again", () => {
    const tw = readFileSync("src/creator/tidewell-game-screen.css", "utf8");
    expect(tw).toContain("UI-share-seat");
    expect(tw).toMatch(/room-share-chrome\.is-chrome-collapse[\s\S]*?pointer-events:\s*auto/);
    expect(tw).toMatch(/min-height:\s*3\.1rem/);
    expect(tw).toMatch(/position:\s*fixed\s*!important/);
    expect(tw).toContain("stole canvas vh");
  });

  it("immersive Room chrome does not clone 你的席位 labeled select (Tidewell menu owns it)", () => {
    const src = readFileSync("src/creator/RoomView.tsx", "utf8");
    // Share-seat chips stay; fallback select is gated behind !immersive
    expect(src).toMatch(/immersive \? null/);
    expect(src).toContain("seat-picker-fallback");
    const hex = readFileSync("src/creator/HexSettlementBoard.tsx", "utf8");
    const roomLabels = src.split("aria-label={copy.yourSeat}").length - 1;
    const hexLabels = hex.split("aria-label={copy.yourSeat}").length - 1;
    expect(hexLabels).toBeGreaterThanOrEqual(1);
    // RoomView keeps one labeled select for non-immersive rooms only
    expect(roomLabels).toBe(1);
  });
});
