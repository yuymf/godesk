import { describe, expect, it } from "vitest";
import {
  DEFAULT_UI_THEME_ID,
  UI_THEME_IDS,
  UI_THEME_PACKS,
  getUiThemePack,
  isUiThemeId,
  readUiThemeFromPresentation,
  resolveUiThemeId,
} from "./ui-theme-packs";

describe("ui-theme-packs switchable Room chrome", () => {
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
});
