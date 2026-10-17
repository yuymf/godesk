import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("UI-room-hud · settlecoast-grade Room density", () => {
  it("RoomView mounts left seat rail + bottom hand bar + right turn panel", () => {
    const src = readFileSync("src/creator/RoomView.tsx", "utf8");
    expect(src).toContain("UI-room-hud");
    expect(src).toContain("room-density-hud");
    expect(src).toContain('data-ui-room-hud="1"');
    expect(src).toContain('data-ui-seat-rail="1"');
    expect(src).toContain('data-ui-hand-bar="1"');
    expect(src).toContain('data-ui-turn-panel="1"');
    expect(src).toContain("room-hud-seat-card");
    expect(src).toContain("room-hud-hand-slot");
    expect(src).toContain("room-hud-action-group");
    expect(src).toContain("room-hud-chronicle");
    expect(src).toContain("room-hud-primary-cta");
    // Keep P0 shell markers for cascade / a11y continuity
    expect(src).toContain("room-playable-shell");
    expect(src).toContain("room-playable-shell-who");
    expect(src).toContain("room-playable-shell-primary");
    // Neutral naming — no suite / Tide Arena forks in this shell
    expect(src).not.toMatch(/suite === ["']H0/);
    expect(src).not.toContain("Tide Arena");
  });

  it("surface.css ships wood/paper/float hierarchy and kills thin black bars", () => {
    const css = readFileSync("src/creator/surface.css", "utf8");
    expect(css).toContain("UI-room-hud");
    expect(css).toMatch(/\.room-density-hud[\s\S]*?display:\s*grid/);
    expect(css).toMatch(/\.room-hud-seat-rail/);
    expect(css).toMatch(/\.room-hud-hand-bar/);
    expect(css).toMatch(/\.room-hud-turn-panel/);
    expect(css).toMatch(/\.room-hud-action-btn\.is-disabled|\.room-hud-action-btn:disabled/);
    expect(css).toMatch(/surface-wood|surface-parchment|surface-float/);
    expect(css).toContain("Kill thin black engineering bars");
    expect(css).not.toMatch(/suite === ["']H0/);
  });

  it("design-tokens.css exposes paper/float/wood HUD tokens", () => {
    const tokens = readFileSync("src/creator/design-tokens.css", "utf8");
    expect(tokens).toContain("UI-room-hud");
    expect(tokens).toContain("--surface-wood:");
    expect(tokens).toContain("--surface-float:");
    expect(tokens).toContain("--surface-parchment:");
    expect(tokens).toContain("--hud-seat-rail-w:");
    expect(tokens).toContain("--hud-hand-h:");
  });

  it("action drawer + share-seat keep legal/disabled + pointer-events floors", () => {
    const css = readFileSync("src/creator/surface.css", "utf8");
    expect(css).toContain("UI-action-drawer");
    expect(css).toMatch(/button\.is-legal/);
    expect(css).toContain("UI-share-seat");
    expect(css).toMatch(/data-ui-share-ready[\s\S]*?pointer-events:\s*auto/);
    const drawer = readFileSync("src/creator/room-action-drawer-ui-p0.test.ts", "utf8");
    expect(drawer).toContain("UI-action-drawer");
    const share = readFileSync("src/creator/room-share-seat-ui-p1.test.ts", "utf8");
    expect(share).toContain("UI-share-seat");
  });
});
