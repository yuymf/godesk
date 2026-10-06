/**
 * G3D-08 · water mesh + controller (lazy-loaded from SceneHost).
 */
import {
  DataTexture,
  Mesh,
  NearestFilter,
  Path,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
  type BufferGeometry,
  RGBAFormat,
  UnsignedByteType,
  type Object3D,
  type Scene,
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
/**
 * G3D-ISLAND：远海环外半径。主水面只有 ±9（海岸距离场覆盖范围），斜视 / 海岸机位会看到边缘；
 * 外圈用同一材质的平面方环补到 ±60（距离场在外圈被 clamp 成深水色），1 个额外 draw call。
 */
export const WATER_FAR_HALF_EXTENT = 60;

function farSeaRing(): BufferGeometry {
  const outer = new Shape();
  const o = WATER_FAR_HALF_EXTENT;
  outer.moveTo(-o, -o);
  outer.lineTo(o, -o);
  outer.lineTo(o, o);
  outer.lineTo(-o, o);
  outer.closePath();
  const hole = new Path();
  const h = WATER_HALF_EXTENT;
  hole.moveTo(-h, -h);
  hole.lineTo(-h, h);
  hole.lineTo(h, h);
  hole.lineTo(h, -h);
  hole.closePath();
  outer.holes.push(hole);
  const geom = new ShapeGeometry(outer, 1);
  geom.rotateX(-Math.PI / 2);
  // UV 与主水面（PlaneGeometry 2h×2h 旋到 XZ）同一映射：法线贴图切线空间与平铺频率一致，接缝不露。
  const pos = geom.getAttribute("position");
  const uv = geom.getAttribute("uv");
  for (let i = 0; i < pos.count; i += 1) {
    uv.setXY(i, pos.getX(i) / (2 * h) + 0.5, 0.5 - pos.getZ(i) / (2 * h));
  }
  uv.needsUpdate = true;
  return geom;
}

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
  signal?: AbortSignal;
}): Promise<WaterController> {
  const signal = options.signal;
  if (signal?.aborted) throw new DOMException("water mount aborted", "AbortError");

  let features = waterFeaturesFor(options.tier);
  const spec: TideWaterSpec = { ...DEFAULT_SPEC, ...options.spec };
  const { material, uniforms, setOwnedTexture, releaseOwned, disposeOwnedTextures } =
    createTideWaterMaterial(spec, features);
  const geom = new PlaneGeometry(
    WATER_HALF_EXTENT * 2,
    WATER_HALF_EXTENT * 2,
    features.segments,
    features.segments,
  );
  geom.rotateX(-Math.PI / 2);
  const mesh = new Mesh(geom, material);
  mesh.position.set(0, -0.08, 0);
  const farGeom = farSeaRing();
  const far = new Mesh(farGeom, material);
  far.name = "water-far";
  far.receiveShadow = false;
  far.userData.kind = "water";
  far.userData.nodeId = "water-far";
  mesh.add(far);
  // round-2d2：水面不接收阴影 —— 阴影相机只罩住岛，罩外是亮的，会在海面上留一道直线接缝。
  mesh.receiveShadow = false;
  mesh.castShadow = false;
  mesh.userData.kind = "water";
  mesh.userData.nodeId = "water";

  uniforms.uTideHalf.value = WATER_HALF_EXTENT;

  let sea: SeaTextures | null = null;
  let lastDistanceMs = 0;
  let waveHeightBase = features.waveCount === 0 ? 0 : spec.waveHeight;
  let disposed = false;
  let committed = false;
  const t0 = performance.now();

  const teardown = () => {
    if (disposed) return;
    disposed = true;
    if (committed) options.parent.remove(mesh);
    if (sea) {
      releaseOwned(sea.normal);
      releaseOwned(sea.foam);
      uniforms.uTideNormal.value = null;
      uniforms.uTideFoamMap.value = null;
      sea.dispose();
      sea = null;
    }
    disposeOwnedTextures();
    geom.dispose();
    farGeom.dispose();
    material.dispose();
  };

  const onAbort = () => teardown();
  signal?.addEventListener("abort", onAbort, { once: true });

  const rebuildDistance = (model: SceneModel | null) => {
    if (disposed) return;
    const field = buildCoastDistanceField(
      coastsFromModel(model),
      features.mapSize,
      WATER_HALF_EXTENT,
    );
    lastDistanceMs = field.elapsedMs;
    setOwnedTexture("uTideDist", makeDistTexture(field.data, field.size));
    console.info(
      `[godesk.water] distance-field ${field.size}² in ${field.elapsedMs.toFixed(1)}ms tier=${options.tier}`,
    );
  };

  try {
    rebuildDistance(options.model);
    if (signal?.aborted) throw new DOMException("water mount aborted", "AbortError");

    try {
      sea = await loadSeaTextures(options.renderer, signal);
      if (disposed || signal?.aborted) {
        sea.dispose();
        sea = null;
        throw new DOMException("water mount aborted", "AbortError");
      }
      setOwnedTexture("uTideNormal", sea.normal);
      setOwnedTexture("uTideFoamMap", sea.foam);
      releaseOwned(sea.normal);
      releaseOwned(sea.foam);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      console.warn("[godesk.water] sea KTX2 load failed; foam/normal fallback", error);
    }

    if (disposed || signal?.aborted) {
      throw new DOMException("water mount aborted", "AbortError");
    }

    options.parent.add(mesh);
    committed = true;
    signal?.removeEventListener("abort", onAbort);
  } catch (error) {
    signal?.removeEventListener("abort", onAbort);
    teardown();
    throw error;
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
      signal?.removeEventListener("abort", onAbort);
      teardown();
    },
  };
}
