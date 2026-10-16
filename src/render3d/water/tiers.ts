import type { RenderTierId } from "../tiers";

export type WaterTierFeatures = {
  waveCount: 0 | 1 | 2;
  foam: boolean;
  /** Shoreline white fringe strength (hugs wet-foot / rocks). high strong; medium faint; low off. */
  shoreFoam: number;
  /** Near-shore swell / soft-ridge rhythm (distance-field gated). high strong; medium faint; low off. */
  shoreWave: number;
  normals: boolean;
  mapSize: 128 | 192 | 256;
  segments: number;
};

export function waterFeaturesFor(tier: RenderTierId): WaterTierFeatures {
  if (tier === "high") return { waveCount: 2, foam: true, shoreFoam: 1.0, shoreWave: 1.0, normals: true, mapSize: 192, segments: 64 };
  if (tier === "medium") return { waveCount: 1, foam: true, shoreFoam: 0.62, shoreWave: 0.48, normals: false, mapSize: 192, segments: 48 }; // T266 seam
  return { waveCount: 0, foam: true, shoreFoam: 0.28, shoreWave: 0.18, normals: false, mapSize: 128, segments: 24 }; // T266 wet-sand visible low
}
