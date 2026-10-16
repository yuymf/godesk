import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { clampPlayableLighting, PLAYABLE_LIGHT_FLOORS } from "./lighting";
import { clampPlayableAlbedo, PLAYABLE_ALBEDO_MAX } from "./materials";
import { SCENE_TOKENS } from "./tokens";
import { Color } from "three";

describe("UI-surface-contrast · softContact / vignette / chrome floors", () => {
  it("tightens playable exposure + albedo ceilings without suite forks", () => {
    expect(PLAYABLE_LIGHT_FLOORS.exposureMax).toBeLessThanOrEqual(1.22);
    expect(PLAYABLE_ALBEDO_MAX).toBeLessThanOrEqual(0.86);
    const hot = {
      ...SCENE_TOKENS.lighting,
      exposure: 1.9,
      sun: { ...SCENE_TOKENS.lighting.sun, intensity: 5.5 },
      hemisphere: { ...SCENE_TOKENS.lighting.hemisphere, intensity: 2.5 },
    };
    const playable = clampPlayableLighting(hot);
    expect(playable.exposure).toBeLessThanOrEqual(PLAYABLE_LIGHT_FLOORS.exposureMax);
    const c = clampPlayableAlbedo(new Color("#ffffff"));
    expect(Math.max(c.r, c.g, c.b)).toBeLessThanOrEqual(PLAYABLE_ALBEDO_MAX + 1e-6);
  });

  it("keeps softContact core-only — no wide mid/outer rings that pool into center blot", () => {
    const obj = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(obj).toContain("UI-surface-contrast");
    const start = obj.indexOf("function softContactShadow");
    const body = obj.slice(start, start + 4200);
    // No wide outer rings that stacked into H04-class radial blot
    expect(body).not.toMatch(/mk\(2\.10/);
    expect(body).not.toMatch(/mk\(1\.55/);
    expect(body).toMatch(/mk\(0\.92/);
    expect(body).toMatch(/mk\(1\.28,\s*Math\.min\(0\.018/);
    // Tile foot tightened (generic, not H04 fork)
    expect(obj).toMatch(/softContactShadow\(0\.48,\s*0\.48,\s*\{\s*opacity:\s*0\.16/);
    expect(obj).toMatch(/opacity: 0\.28, boost: 0\.82/);
    const map = readFileSync("src/render3d/mappers/tabletop.ts", "utf8");
    expect(map).toMatch(/size \* 0\.82/);
    expect(map).not.toMatch(/suite === ["']H0/);
    expect(obj).not.toMatch(/suite === ["']H0/);
  });

  it("clears table vignette center through W*0.72", () => {
    const obj = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(obj).toMatch(/W \* 0\.72/);
    expect(obj).toMatch(/rgba\(12,8,4,0\.02\)/);
  });

  it("surface.css declares chrome-on-3D contrast tokens", () => {
    const css = readFileSync("src/creator/surface.css", "utf8");
    expect(css).toContain("UI-surface-contrast");
    expect(css).toContain("--ui-chrome-on-3d-bg");
    expect(css).toContain("--ui-chrome-on-light-fg");
    expect(css).not.toMatch(/suite === ["']H0/);
  });
});
