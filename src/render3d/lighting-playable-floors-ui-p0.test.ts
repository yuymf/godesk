import { describe, expect, it } from "vitest";
import { AgXToneMapping } from "three";
import {
  clampPlayableLighting,
  configureRenderer,
  PLAYABLE_LIGHT_FLOORS,
} from "./lighting";
import { SCENE_TOKENS } from "./tokens";
import { clampPlayableAlbedo, PLAYABLE_ALBEDO_MAX } from "./materials";
import { Color } from "three";
import { readFileSync } from "node:fs";

describe("UI-light-floors · playable lighting / albedo / vignette", () => {
  it("clamps exposure and key intensities without suite forks", () => {
    const hot = {
      ...SCENE_TOKENS.lighting,
      exposure: 2.0,
      sun: { ...SCENE_TOKENS.lighting.sun, intensity: 5.98 },
      hemisphere: { ...SCENE_TOKENS.lighting.hemisphere, intensity: 2.98 },
      fill: { azimuthDeg: 290, elevationDeg: 64, intensity: 4.0, color: "#ffffff" },
      rim: { azimuthDeg: 34, elevationDeg: 36, intensity: 2.55, color: "#fffcf0" },
    };
    const playable = clampPlayableLighting(hot);
    expect(playable.exposure).toBeLessThanOrEqual(PLAYABLE_LIGHT_FLOORS.exposureMax);
    expect(playable.sun.intensity).toBeLessThanOrEqual(PLAYABLE_LIGHT_FLOORS.sunIntensityMax);
    expect(playable.hemisphere.intensity).toBeLessThanOrEqual(PLAYABLE_LIGHT_FLOORS.hemiIntensityMax);
    expect(playable.fill!.intensity).toBeLessThanOrEqual(PLAYABLE_LIGHT_FLOORS.fillIntensityMax);
    expect(playable.rim!.intensity).toBeLessThanOrEqual(PLAYABLE_LIGHT_FLOORS.rimIntensityMax);

    const renderer = {
      toneMapping: 0,
      toneMappingExposure: 0,
      outputColorSpace: "",
      shadowMap: { enabled: false, type: -1 },
    };
    configureRenderer(renderer as never, hot);
    expect(renderer.toneMapping).toBe(AgXToneMapping);
    expect(renderer.toneMappingExposure).toBeLessThanOrEqual(PLAYABLE_LIGHT_FLOORS.exposureMax);
  });

  it("caps wash-white albedo channels", () => {
    const c = clampPlayableAlbedo(new Color("#ffffff"));
    expect(Math.max(c.r, c.g, c.b)).toBeLessThanOrEqual(PLAYABLE_ALBEDO_MAX + 1e-6);
  });

  it("softens shared vignette + contact without H0x suite fork", () => {
    const obj = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(obj).toContain("UI-light-floors");
    expect(obj).toMatch(/rgba\(12,8,4,0\.04\)/);
    expect(obj).toMatch(/W \* 0\.58/);
    expect(obj).not.toMatch(/suite === ["']H0/);
  });
});
