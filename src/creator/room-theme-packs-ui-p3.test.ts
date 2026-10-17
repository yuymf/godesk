import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  DEFAULT_UI_THEME_ID,
  UI_THEME_IDS,
  UI_THEME_PACKS,
  getUiThemePack,
  isUiThemeId,
  readUiThemeFromPresentation,
  resolveUiThemeId,
} from "./ui-theme-packs";

describe("UI-theme-packs · P3 switchable Room chrome", () => {
  it("registry exports four packs with harbor-wood default", () => {
    expect(UI_THEME_IDS).toEqual([
      "harbor-wood",
      "atelier-paper",
      "casino-felt",
      "midnight-ink",
    ]);
    for (const id of UI_THEME_IDS) {
      expect(UI_THEME_PACKS[id]?.id).toBe(id);
      expect(UI_THEME_PACKS[id]?.label.length).toBeGreaterThan(0);
      expect(UI_THEME_PACKS[id]?.intent.length).toBeGreaterThan(0);
    }
    expect(DEFAULT_UI_THEME_ID).toBe("harbor-wood");
    expect(resolveUiThemeId(undefined)).toBe("harbor-wood");
    expect(resolveUiThemeId(null)).toBe("harbor-wood");
    expect(resolveUiThemeId("")).toBe("harbor-wood");
    expect(resolveUiThemeId("not-a-pack")).toBe("harbor-wood");
    expect(resolveUiThemeId("casino-felt")).toBe("casino-felt");
    expect(isUiThemeId("midnight-ink")).toBe(true);
    expect(isUiThemeId("tidewell")).toBe(false);
    expect(getUiThemePack("atelier-paper").id).toBe("atelier-paper");
  });

  it("readUiThemeFromPresentation prefers presentation.uiTheme then render.uiTheme", () => {
    expect(readUiThemeFromPresentation(undefined)).toBe("harbor-wood");
    expect(readUiThemeFromPresentation({})).toBe("harbor-wood");
    expect(readUiThemeFromPresentation({ uiTheme: "casino-felt" })).toBe("casino-felt");
    expect(
      readUiThemeFromPresentation({
        uiTheme: "bogus",
        render: { uiTheme: "midnight-ink" },
      }),
    ).toBe("midnight-ink");
    expect(
      readUiThemeFromPresentation({
        uiTheme: "atelier-paper",
        render: { uiTheme: "casino-felt" },
      }),
    ).toBe("atelier-paper");
  });

  it("RoomView mounts data-ui-theme from config helper", () => {
    const src = readFileSync("src/creator/RoomView.tsx", "utf8");
    expect(src).toContain("UI-theme-packs");
    expect(src).toContain("readUiThemeFromPresentation");
    expect(src).toContain("data-ui-theme={uiThemeId}");
    expect(src).toContain("room-density-hud");
    // Neutral naming — no suite / Tide Arena forks in theme wiring
    expect(src).not.toMatch(/suite === ["']H0/);
    expect(src).not.toContain("Tide Arena");
  });

  it("CSS ships four [data-ui-theme] token packs and density consumes tokens", () => {
    const packs = readFileSync("src/creator/ui-theme-packs.css", "utf8");
    expect(packs).toContain("UI-theme-packs");
    for (const id of UI_THEME_IDS) {
      expect(packs).toContain(`[data-ui-theme="${id}"]`);
    }
    expect(packs).toContain("--surface-wood:");
    expect(packs).toContain("--hud-shell-bg:");
    expect(packs).toContain("--hud-ink-on-paper:");

    const css = readFileSync("src/creator/surface.css", "utf8");
    expect(css).toContain("UI-theme-packs");
    expect(css).toMatch(/background:\s*var\(--hud-shell-bg\)/);
    expect(css).toMatch(/background:\s*var\(--hud-rail-bg\)/);
    expect(css).toMatch(/background:\s*var\(--hud-hand-bg\)/);
    expect(css).toMatch(/color:\s*var\(--hud-ink-on-paper\)/);
    // Generic board opt-out — no sample-named hide of room-density-hud
    expect(css).toMatch(/\[data-board-owns-hud=["']1["']\]/);
    expect(css).toMatch(
      /\.room-view:has\(\[data-board-owns-hud=["']1["']\]\)\s*>\s*\.room-playable-shell\.room-density-hud/,
    );
    expect(css).not.toMatch(
      /\.tidewell-game-body[\s\S]{0,120}room-density-hud[\s\S]{0,80}display:\s*none/,
    );
    expect(css).not.toMatch(
      /room-density-hud[\s\S]{0,120}\.tidewell-game-body[\s\S]{0,80}display:\s*none/,
    );
    expect(css).not.toContain("Board-owned tidewell density");
  });

  it("design-tokens + render-spec expose uiTheme config surface", () => {
    const tokens = readFileSync("src/creator/design-tokens.css", "utf8");
    expect(tokens).toContain("UI-theme-packs");
    expect(tokens).toContain("--hud-shell-bg:");
    expect(tokens).toContain("--hud-ink-on-paper:");

    const render = readFileSync("src/creator/render-spec.ts", "utf8");
    expect(render).toContain("UI_THEME_IDS");
    expect(render).toContain("uiTheme:");
    expect(render).toContain("if (patch.uiTheme)");

    const contract = readFileSync("src/creator/project-contract.ts", "utf8");
    expect(contract).toContain("uiTheme?: UiThemeId");

    const main = readFileSync("src/main.tsx", "utf8");
    expect(main).toContain("ui-theme-packs.css");
  });

  it("HexSettlementBoard + TabletopGameScreen keep data-board-owns-hud opt-out", () => {
    const hex = readFileSync("src/creator/HexSettlementBoard.tsx", "utf8");
    const tabletop = readFileSync("src/creator/TabletopGameScreen.tsx", "utf8");
    expect(hex).toContain('data-board-owns-hud="1"');
    expect(tabletop).toContain('data-board-owns-hud="1"');
  });
});
