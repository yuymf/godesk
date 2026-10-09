import { describe, expect, it } from "vitest";
import { defaultRenderSpec } from "../creator/render-spec";
import { TIER_CAPS } from "./tiers";
import { HEX_LAYOUT_RADIUS } from "./island";
import { SEAM_HALF_WIDTH, SOFT_EDGE_STRENGTH, TERRAIN_SATURATION } from "./materials";
import {
  HEX_ISLAND_LIGHTING,
  PROP_MATERIALS,
  TILE_BASE_SCALE,
  TILE_FACE_RADIUS,
  SCENE_TOKENS,
  SEAT_COLORS,
  TERRAIN_MATERIALS,
  islandBounds,
  pbrResolutionFor,
  seatMaterial,
  shadowFrustumForBounds,
  shadowRadiusFor,
  sunDirection,
  type MaterialToken,
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
    // R18: oil brush layer on every terrain tile; cliff / pieces untouched (coast camera guard).
    for (const terrain of ["wood", "brick", "sheep", "wheat", "ore", "desert"]) {
      expect(TERRAIN_MATERIALS[terrain]!.brush ?? 0).toBeGreaterThan(0.4);
    }
    expect((PROP_MATERIALS.cliff as MaterialToken).brush).toBeUndefined();
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

describe("R19 hex island brightness", () => {
  it("hex rig is brighter than the tabletop default (sun, hemisphere, exposure)", () => {
    expect(HEX_ISLAND_LIGHTING.sun.intensity).toBeGreaterThan(SCENE_TOKENS.lighting.sun.intensity);
    expect(HEX_ISLAND_LIGHTING.hemisphere.intensity).toBeGreaterThan(SCENE_TOKENS.lighting.hemisphere.intensity);
    expect(HEX_ISLAND_LIGHTING.exposure).toBeGreaterThan(SCENE_TOKENS.lighting.exposure);
    expect(HEX_ISLAND_LIGHTING.exposure).toBeLessThan(1.4); // coast camera must not blow out
  });

  it("AI-textured terrains let the texture hue lead (pbrTint) on lighter, less saturated bases", () => {
    for (const key of ["wood", "brick", "sheep", "wheat", "ore", "desert"]) {
      const t = TERRAIN_MATERIALS[key]!;
      expect(t.pbrTint, key).toBeGreaterThanOrEqual(0.5);
    }
    const sat = (hex: string) => {
      const n = Number.parseInt(hex.slice(1), 16);
      const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      return (Math.max(...c) - Math.min(...c)) / Math.max(...c);
    };
    expect(sat(TERRAIN_MATERIALS.sheep!.base)).toBeLessThan(sat("#8fbf6a"));
    expect(sat(TERRAIN_MATERIALS.wood!.base)).toBeLessThan(sat("#2f6b3a"));
  });

  it("oil-dab layer is stronger than R18 (0.6) so it stays visible over the AI albedo at b3", () => {
    for (const key of ["wood", "brick", "sheep", "wheat", "ore", "desert"]) {
      expect(TERRAIN_MATERIALS[key]!.brush, key).toBeGreaterThan(0.6);
    }
  });
});

describe("R22 resource colour + seams", () => {
  const rgb = (hex: string) => {
    const n = Number.parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
  };

  it("soft hex-edge band ≤ 25% and terrain saturation no longer pulled toward grey", () => {
    expect(SOFT_EDGE_STRENGTH).toBeGreaterThan(0);
    expect(SOFT_EDGE_STRENGTH).toBeLessThanOrEqual(0.25);
    expect(TERRAIN_SATURATION).toBeGreaterThanOrEqual(1);
    expect(TERRAIN_SATURATION).toBeLessThanOrEqual(1.2);
  });

  it("tile top faces touch (no open slot → no dark 1px side line); sides taper inside the coast wall", () => {
    expect(TILE_FACE_RADIUS).toBeCloseTo(HEX_LAYOUT_RADIUS, 6);
    expect(TILE_BASE_SCALE).toBeLessThan(1);
    // at the coast-wall top (y 0.24 of 0.28) the tile side stays ≥ 0.008 inside the wall plane
    const atWallTop = TILE_FACE_RADIUS * (TILE_BASE_SCALE + (1 - TILE_BASE_SCALE) * (0.24 / 0.28));
    expect(HEX_LAYOUT_RADIUS - atWallTop).toBeGreaterThan(0.008);
    expect(SEAM_HALF_WIDTH).toBeGreaterThan(0);
    // R23: hairline ≤ 0.0025 (was 0.006) so camera a loses the chessboard look
    expect(SEAM_HALF_WIDTH).toBeLessThanOrEqual(0.002);
  });

  it("hex key light is no longer orange (G/R ≥ 0.9, B/R ≥ 0.75) so wheat / desert / ore keep their hue", () => {
    const [r, g, b] = rgb(HEX_ISLAND_LIGHTING.sun.color);
    expect(g / r).toBeGreaterThanOrEqual(0.9);
    expect(b / r).toBeGreaterThanOrEqual(0.75);
  });

  it("wheat tint leans golden-yellow (G close to R), desert tint paler than R21", () => {
    const [wr, wg] = rgb(TERRAIN_MATERIALS.wheat!.base);
    expect(wg / wr).toBeGreaterThan(0.93);
    const lum = (hex: string) => { const [r, g, b] = rgb(hex); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    expect(lum(TERRAIN_MATERIALS.desert!.base)).toBeGreaterThan(lum("#d2c29e"));
  });

  it("R23 ore tint is cooler + brighter light-grey rock than R21/R22 warm grey", () => {
    const [r, g, b] = rgb(TERRAIN_MATERIALS.ore!.base);
    // cooler: blue channel ≥ red (cold grey, not warm brown)
    expect(b).toBeGreaterThanOrEqual(r);
    expect(g).toBeGreaterThanOrEqual(r);
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    // brighter than R22 #a4abb3
    const r22 = rgb("#a4abb3");
    const lum22 = 0.2126 * r22[0] + 0.7152 * r22[1] + 0.0722 * r22[2];
    expect(lum).toBeGreaterThan(lum22);
  });
});
