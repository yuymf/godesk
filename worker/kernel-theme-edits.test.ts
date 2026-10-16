import { describe, expect, it } from "vitest";
import { parseKernelEdits } from "./kernel-tuning-iteration";
import { resolveAutoBattlerTheme, THEME_PRESETS, themePresentationHints } from "../src/runtime/adapters/auto-battler-theme";

const kernel = { type: "auto-battler-v1", playerCount: 2 } as never;
const parse = (prompt: string) => parseKernelEdits(kernel, prompt)!;

describe("kernel theme edits (NL → theme config)", () => {
  it("maps style words to presets on cold-start prompts", () => {
    const ember = parse("做一款两人自走棋，商店买棋上阵自动打架，火山熔岩风格");
    expect(ember.theme).toEqual({ preset: "ember" });
    expect(ember.operation).toMatchObject({ op: "configure_auto_battler", config: { theme: { preset: "ember" } } });

    const frost = parse("冰雪极地风格的自走棋");
    expect(frost.theme?.preset).toBe("frost");

    const night = parse("换星夜霓虹主题");
    expect(night.theme?.preset).toBe("night");

    const tide = parse("改回海岸木桌默认风格");
    expect(tide.theme?.preset).toBe("tide");
  });

  it("applies camera / scale / light tweaks as overrides", () => {
    const r = parse("机位拉近一点，棋子再大一些，灯光亮一点");
    expect(r.theme?.overrides?.camera?.distance).toBeLessThan(THEME_PRESETS.tide!.camera.distance);
    expect(r.theme?.overrides?.unitScale).toBeGreaterThan(THEME_PRESETS.tide!.unitScale);
    expect(r.theme?.overrides?.light?.sunIntensity).toBeGreaterThan(THEME_PRESETS.tide!.light.sunIntensity);
    const resolved = resolveAutoBattlerTheme(r.theme)!;
    expect(themePresentationHints(resolved).ok).toBe(true);
  });

  it("ships presets above the presentation floor", () => {
    for (const spec of Object.values(THEME_PRESETS)) {
      expect(themePresentationHints(spec).ok).toBe(true);
    }
  });

  it("intentional below-floor prompts annotate draft notes and fail hints", () => {
    const r = parse("机位过远，单位变得很小，卡面对比很弱");
    expect(r.theme?.overrides?.camera?.distance).toBeGreaterThan(1.15);
    expect(r.theme?.overrides?.unitScale).toBeLessThan(1.05);
    expect(r.theme?.overrides?.ui?.accent).toBeTruthy();
    const resolved = resolveAutoBattlerTheme(r.theme)!;
    const hints = themePresentationHints(resolved);
    expect(hints.ok).toBe(false);
    expect(r.notes.some((n) => n.includes("呈现底线未达标"))).toBe(true);
    const op = r.operation as { op: string; config: { unsupported?: string[] } };
    expect(op.config.unsupported?.some((u) => u.includes("呈现底线未达标"))).toBe(true);
  });
});
