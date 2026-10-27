/**
 * Theme Packs — switchable Room HUD chrome as an engine primitive.
 *
 * Packs are DATA + CSS variable ids only. Room mounts `data-ui-theme="<id>"`
 * on `.room-view`; density-shell CSS consumes `--surface-*` / `--hud-*` tokens.
 * No suite / Tide / 汐屿 / H0x forks. Missing config → harbor-wood (default).
 */

export const UI_THEME_IDS = [
  "harbor-wood",
  "atelier-paper",
  "casino-felt",
  "midnight-ink",
] as const;

export type UiThemeId = (typeof UI_THEME_IDS)[number];

type UiThemePack = {
  id: UiThemeId;
  /** Short English label for tooling / NL (not player-facing chrome). */
  label: string;
  /** One-line design intent. */
  intent: string;
};

export const UI_THEME_PACKS: Record<UiThemeId, UiThemePack> = {
  "harbor-wood": {
    id: "harbor-wood",
    label: "Harbor wood",
    intent: "Settlecoast-grade wood / parchment density (default).",
  },
  "atelier-paper": {
    id: "atelier-paper",
    label: "Atelier paper",
    intent: "Bright studio paper density — keeps P2 structure, not P1 thin bars.",
  },
  "casino-felt": {
    id: "casino-felt",
    label: "Casino felt",
    intent: "Green felt table + brass accents.",
  },
  "midnight-ink": {
    id: "midnight-ink",
    label: "Midnight ink",
    intent: "Deep ink / glass night chrome.",
  },
};

export const DEFAULT_UI_THEME_ID: UiThemeId = "harbor-wood";

/** True when value is a registered theme pack id. */
export function isUiThemeId(value: unknown): value is UiThemeId {
  return typeof value === "string" && Object.hasOwn(UI_THEME_PACKS, value);
}

/**
 * Resolve a config / attribute value to a registered theme id.
 * Missing, empty, or unknown → harbor-wood.
 */
export function resolveUiThemeId(value: unknown): UiThemeId {
  if (isUiThemeId(value)) return value;
  return DEFAULT_UI_THEME_ID;
}

export function getUiThemePack(value: unknown): UiThemePack {
  return UI_THEME_PACKS[resolveUiThemeId(value)];
}

/**
 * Read uiTheme from RuleSystem-like presentation config.
 * Prefers presentation.uiTheme, then presentation.render.uiTheme.
 */
export function readUiThemeFromPresentation(presentation: unknown): UiThemeId {
  if (!presentation || typeof presentation !== "object") {
    return DEFAULT_UI_THEME_ID;
  }
  const p = presentation as {
    uiTheme?: unknown;
    render?: { uiTheme?: unknown };
  };
  if (isUiThemeId(p.uiTheme)) return p.uiTheme;
  if (isUiThemeId(p.render?.uiTheme)) return p.render.uiTheme;
  return DEFAULT_UI_THEME_ID;
}
