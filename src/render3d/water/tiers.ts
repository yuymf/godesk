import type { RenderTierId } from "../tiers";

export type WaterTierFeatures = {
  waveCount: 0 | 1 | 2;
  foam: boolean;
  normals: boolean;
  mapSize: 128 | 192 | 256;
  segments: number;
};

export function waterFeaturesFor(tier: RenderTierId): WaterTierFeatures {
  if (tier === "high") return { waveCount: 2, foam: true, normals: true, mapSize: 192, segments: 64 };
  if (tier === "medium") return { waveCount: 1, foam: true, normals: false, mapSize: 192, segments: 48 };
  return { waveCount: 0, foam: true, normals: false, mapSize: 128, segments: 24 };
}
