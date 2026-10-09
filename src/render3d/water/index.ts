export { buildCoastDistanceField, buildLandMask, computeCoastDistance } from "./distance-field";
export type { CoastSample, DistanceFieldResult } from "./distance-field";
export { prefetchSeaTextures } from "./sea-textures";
export { createWaterController, WATER_HALF_EXTENT, WATER_SEA_HALF_EXTENT, WATER_FAR_HALF_EXTENT } from "./mesh";
export type { WaterController } from "./mesh";
export { waterFeaturesFor } from "./tiers";
export type { WaterTierFeatures } from "./tiers";
