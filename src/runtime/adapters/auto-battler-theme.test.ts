import { describe, expect, it } from "vitest";
import {
  THEME_PRESETS,
  THEME_PRESENTATION_FLOOR,
  estimatedBoardWidthFrac,
  resolveAutoBattlerTheme,
  themePresentationHints,
} from "./auto-battler-theme";

describe("theme presentation floor", () => {
  it("ships all presets inside board-width 55–60% and above unit/contrast floors", () => {
    for (const spec of Object.values(THEME_PRESETS)) {
      const frac = estimatedBoardWidthFrac(spec.camera.distance);
      expect(frac).toBeGreaterThanOrEqual(THEME_PRESENTATION_FLOOR.boardWidthFrac.min);
      expect(frac).toBeLessThanOrEqual(THEME_PRESENTATION_FLOOR.boardWidthFrac.max);
      expect(themePresentationHints(spec).ok).toBe(true);
    }
  });

  it("flags intentional below-floor camera / scale / contrast", () => {
    const bad = resolveAutoBattlerTheme({
      preset: "night",
      overrides: {
        camera: { distance: 1.25 },
        unitScale: 0.9,
        ui: { accent: "#1C2238", surface: "#1C2238" },
      },
    })!;
    const hints = themePresentationHints(bad);
    expect(hints.ok).toBe(false);
    expect(hints.notes.some((n) => /机位过远/.test(n))).toBe(true);
    expect(hints.notes.some((n) => /单位尺度过小/.test(n))).toBe(true);
    expect(hints.notes.some((n) => /卡面对比不足/.test(n))).toBe(true);
  });
});
