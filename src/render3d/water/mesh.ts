/**
 * G3D-08 · water mesh + controller (lazy-loaded from SceneHost).
 */
import {
  DataTexture,
  Mesh,
  NearestFilter,
  PlaneGeometry,
  RGBAFormat,
  UnsignedByteType,
  type Object3D,
  type Scene,
  type Texture,
  type WebGLRenderer,
} from "three";
import { prefersReducedMotion } from "../motion";
import type { SceneModel } from "../scene-model";
import type { RenderTierId } from "../tiers";
import { TILE_RADIUS } from "../tokens";
import { buildCoastDistanceField, type CoastSample } from "./distance-field";
import {
  createTideWaterMaterial,
  setTideTime,
  setTideWaveHeight,
  type TideWaterSpec,
} from "./material";
import { loadSeaTextures, type SeaTextures } from "./sea-textures";
import { waterFeaturesFor } from "./tiers";

export const WATER_HALF_EXTENT = 9;

const DEFAULT_SPEC: TideWaterSpec = {
  shallow: "#5fb3b3",
  deep: "#1f4e6b",
  waveHeight: 0.06,
  waveSpeed: 0.6,
  foam: 0.55,
};

function coastsFromModel(model: SceneModel | null): CoastSample[] {
  if (!model) return [{ x: 0, z: 0, radius: TILE_RADIUS }];
  const tiles = model.nodes.filter((n) => n.kind === "tile");
  if (tiles.length === 0) return [{ x: 0, z: 0, radius: TILE_RADIUS }];
  return tiles.map((n) => ({ x: n.position[0], z: n.position[2], radius: TILE_RADIUS }));
}

function makeDistTexture(data: Float32Array, size: number): DataTexture {
  // RGBA8 is widely supported (incl. SwiftShader); R channel = normalized distance.
  const bytes = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i += 1) {
    const v = Math.max(0, Math.min(255, Math.round(data[i]! * 255)));
    const o = i * 4;
    bytes[o] = v;
    bytes[o + 1] = v;
    bytes[o + 2] = v;
    bytes[o + 3] = 255;
  }
  const tex = new DataTexture(bytes, size, size, RGBAFormat, UnsignedByteType);
  tex.minFilter = NearestFilter;
  tex.magFilter = NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

export type WaterController = {
  mesh: Mesh;
  lastDistanceMs: number;
  update(nowMs: number): void;
  setTier(tier: RenderTierId): void;
  rebuildDistance(model: SceneModel | null): void;
  dispose(): void;
};

export async function createWaterController(options: {
  renderer: WebGLRenderer;
  parent: Object3D | Scene;
  model: SceneModel | null;
  tier: RenderTierId;
  spec?: Partial<TideWaterSpec>;
}): Promise<WaterController> {
  let features = waterFeaturesFor(options.tier);
  const spec: TideWaterSpec = { ...DEFAULT_SPEC, ...options.spec };
  const { material, uniforms } = createTideWaterMaterial(spec, features);
  const geom = new PlaneGeometry(
    WATER_HALF_EXTENT * 2,
    WATER_HALF_EXTENT * 2,
    features.segments,
    features.segments,
  );
  geom.rotateX(-Math.PI / 2);
  const mesh = new Mesh(geom, material);
  mesh.position.set(0, -0.08, 0);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.userData.kind = "water";
  mesh.userData.nodeId = "water";
  options.parent.add(mesh);

  uniforms.uTideHalf.value = WATER_HALF_EXTENT;

  let distTex: Texture | null = null;
  let sea: SeaTextures | null = null;
  let lastDistanceMs = 0;
  let waveHeightBase = features.waveCount === 0 ? 0 : spec.waveHeight;
  let disposed = false;
  const t0 = performance.now();

  const rebuildDistance = (model: SceneModel | null) => {
    const field = buildCoastDistanceField(
      coastsFromModel(model),
      features.mapSize,
      WATER_HALF_EXTENT,
    );
    lastDistanceMs = field.elapsedMs;
    const next = makeDistTexture(field.data, field.size);
    distTex?.dispose();
    distTex = next;
    uniforms.uTideDist.value = next;
    console.info(
      `[godesk.water] distance-field ${field.size}² in ${field.elapsedMs.toFixed(1)}ms tier=${options.tier}`,
    );
  };
  rebuildDistance(options.model);

  try {
    sea = await loadSeaTextures(options.renderer);
    if (disposed) {
      sea.dispose();
      sea = null;
    } else {
      uniforms.uTideNormal.value = sea.normal;
      uniforms.uTideFoamMap.value = sea.foam;
    }
  } catch (error) {
    console.warn("[godesk.water] sea KTX2 load failed; foam/normal fallback", error);
  }

  return {
    mesh,
    get lastDistanceMs() {
      return lastDistanceMs;
    },
    update(nowMs: number) {
      if (disposed) return;
      const reduced = prefersReducedMotion();
      setTideWaveHeight(uniforms, reduced ? 0 : waveHeightBase);
      // Static (or near-static foam scroll) when reduced-motion is on.
      setTideTime(uniforms, reduced ? 0 : (nowMs - t0) / 1000);
    },
    setTier(tier: RenderTierId) {
      features = waterFeaturesFor(tier);
      uniforms.uTideWaves.value = features.waveCount;
      uniforms.uTideUseN.value = features.normals ? 1 : 0;
      uniforms.uTideFoam.value = features.foam ? spec.foam : 0;
      waveHeightBase = features.waveCount === 0 ? 0 : spec.waveHeight;
      material.customProgramCacheKey = () =>
        `tide-w${features.waveCount}-n${features.normals ? 1 : 0}-f${features.foam ? 1 : 0}`;
      material.needsUpdate = true;
    },
    rebuildDistance,
    dispose() {
      disposed = true;
      options.parent.remove(mesh);
      geom.dispose();
      material.dispose();
      distTex?.dispose();
      sea?.dispose();
    },
  };
}
