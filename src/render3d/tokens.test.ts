import { describe, expect, it } from "vitest";
import { defaultRenderSpec } from "../creator/render-spec";
import { TIER_CAPS } from "./tiers";
import {
  PROP_MATERIALS,
  SCENE_TOKENS,
  SEAT_COLORS,
  TERRAIN_MATERIALS,
  islandBounds,
  pbrResolutionFor,
  seatMaterial,
  shadowFrustumForBounds,
  shadowRadiusFor,
  sunDirection,
} from "./tokens";

describe("G3D-07 3D tokens (SPEC §3.7)", () => {
  it("matches the §3.7 tabletop-day table", () => {
    expect(SCENE_TOKENS.toneMapping).toBe("agx");
    expect(SCENE_TOKENS.lighting).toEqual({
      sun: { azimuthDeg: 128, elevationDeg: 46, intensity: 3.05, color: "#ffc890" },
      hemisphere: { sky: "#f2e6d2", ground: "#c9a878", intensity: 1.05 },
      shadow: { enabled: true, softness: 0.92 },
      exposure: 1.12,
    });
    expect(SCENE_TOKENS.shadow).toMatchObject({ radius: 4, bias: -0.0004, normalBias: 0.02, boundsPadding: 1.5 });
    expect(SCENE_TOKENS.environment.intensity).toBe(0.2);
    expect(SCENE_TOKENS.tile).toEqual({ roughness: 0.98, metalness: 0 });
    expect(SCENE_TOKENS.piece).toEqual({ roughness: 0.82, metalness: 0, clearcoat: 0 });
    expect(SEAT_COLORS).toEqual(["#c0392b", "#2980b9", "#27ae60", "#f39c12"]);
  });

  it("stays in sync with the creator RenderSpec lighting default", () => {
    for (const kernel of ["hex-settlement-v1", "disc-flipping-v1", null]) {
      expect(defaultRenderSpec(kernel, "table")?.lighting).toEqual(SCENE_TOKENS.lighting);
    }
  });

  it("gives every terrain a pattern and a G3D-22 PBR set, tiles use matte roughness ≥ 0.9", () => {
    for (const terrain of ["wood", "brick", "sheep", "wheat", "ore", "desert"]) {
      const token = TERRAIN_MATERIALS[terrain]!;
      expect(token.pattern).not.toBe("none");
      expect(token.pbrSet).toMatch(/^t0[1-6]-/);
      expect(token.roughness).toBeGreaterThanOrEqual(0.9);
      expect(token.metalness).toBe(0);
    }
    expect(PROP_MATERIALS.cliff.pbrSet).toBe("t07-cliff");
  });

  it("seat pieces keep their seat colour: clearcoat 0.12, normal + ORM only", () => {
    const token = seatMaterial(1);
    expect(token).toMatchObject({ base: "#2980b9", roughness: 0.82, clearcoat: 0, pbrSet: "t09-paintwood", pbrBaseColor: true });
    expect(seatMaterial(9).base).toBe("#ffffff");
  });

  it("converts compass azimuth / elevation to a unit sun direction", () => {
    const [x, y, z] = sunDirection(135, 52);
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 6);
    expect(x).toBeGreaterThan(0); // east
    expect(z).toBeGreaterThan(0); // south (camera side)
    expect(y).toBeCloseTo(Math.sin((52 * Math.PI) / 180), 6);
    const [nx, , nz] = sunDirection(0, 45);
    expect(nx).toBeCloseTo(0, 6);
    expect(nz).toBeLessThan(0); // north = -Z
  });

  it("fits the shadow camera to island radius + 1.5 and keeps the sphere inside near/far", () => {
    const frustum = shadowFrustumForBounds(4.4, SCENE_TOKENS.lighting.sun);
    expect(frustum.half).toBeCloseTo(5.9, 6);
    const distance = Math.hypot(...frustum.lightOffset);
    expect(frustum.near).toBeLessThan(distance - frustum.half);
    expect(frustum.far).toBeGreaterThan(distance + frustum.half);
    expect(frustum.near).toBeGreaterThan(0);
  });

  it("uses radius 4 on high / medium and the tier light-shadow radius 1 on low", () => {
    expect(shadowRadiusFor("high", TIER_CAPS.high.shadowRadius, 0.5)).toBe(4);
    expect(shadowRadiusFor("medium", TIER_CAPS.medium.shadowRadius, 0.5)).toBe(4);
    expect(shadowRadiusFor("low", TIER_CAPS.low.shadowRadius, 0.5)).toBe(1);
    expect(shadowRadiusFor("high", 2, 0)).toBe(1);
    expect(shadowRadiusFor("high", 2, 1)).toBe(7);
    expect(TIER_CAPS.low.shadowMapSize).toBe(512);
  });

  it("maps tiers to PBR texture resolution (low 256, else 512)", () => {
    expect(pbrResolutionFor("high")).toBe(512);
    expect(pbrResolutionFor("medium")).toBe(512);
    expect(pbrResolutionFor("low")).toBe(256);
  });

  it("computes island bounds from tile nodes only", () => {
    const tiles = [
      { kind: "tile", position: [0, 0, 0] as const },
      { kind: "tile", position: [3, 0, 0] as const },
      { kind: "tile", position: [-3, 0, 0] as const },
      { kind: "cliff", position: [40, 0, 0] as const },
    ];
    const bounds = islandBounds(tiles);
    expect(bounds.center).toEqual([0, 0, 0]);
    expect(bounds.radius).toBeCloseTo(3.95, 6);
    expect(islandBounds([]).radius).toBe(4);
  });
});
