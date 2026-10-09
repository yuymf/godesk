/**
 * G3D-13 · Lazy GLB templates for Tidewell pieces / decor / props.
 * Replaces G3D-03 procedural placeholders once loaded.
 */
import {
  Box3,
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  Mesh,
  Object3D,
  Vector3,
  type Material,
} from "three";

/** Fit geometry so its longest axis equals `maxExtent` (world units). Mutates in place. */
function normalizeExtent(geom: BufferGeometry, maxExtent: number): BufferGeometry {
  geom.computeBoundingBox();
  const box = geom.boundingBox ?? new Box3();
  const size = new Vector3();
  box.getSize(size);
  const longest = Math.max(size.x, size.y, size.z, 1e-6);
  const s = maxExtent / longest;
  geom.scale(s, s, s);
  geom.computeBoundingBox();
  const mid = new Vector3();
  geom.boundingBox!.getCenter(mid);
  geom.translate(-mid.x, -geom.boundingBox!.min.y, -mid.z);
  return geom;
}

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import type { SceneNode } from "./scene-model";

const MODEL_URLS = import.meta.glob("../../assets/models/{pieces,decor,props}.glb", {
  eager: false,
  query: "?url",
  import: "default",
}) as Record<string, () => Promise<string>>;

/**
 * G3D-JUDGE round-3/4 knife ②: settlement / city / road / robber are hand-built
 * miniature meshes in `assets/pieces.ts` (merged → InstancedMesh pools); dice/tray
 * stay thin felt pad in `assets/dice-geometry.ts`. GLB bundle still supplies
 * decor / sheep / docks / ships only — not piece buildings.
 */
export type TidewellGeometries = {
  sheep: BufferGeometry;
  dock: BufferGeometry;
  shipA: BufferGeometry;
  shipB: BufferGeometry;
  decorByTerrain: Record<string, BufferGeometry>;
  ready: boolean;
};

function stubPillar(): BufferGeometry {
  return new CylinderGeometry(0.14, 0.18, 0.35, 8);
}

function makeFallback(): TidewellGeometries {
  return {
    sheep: stubPillar(),
    dock: new BoxGeometry(0.4, 0.12, 0.4),
    shipA: new BoxGeometry(0.5, 0.18, 0.22),
    shipB: new BoxGeometry(0.5, 0.18, 0.22),
    decorByTerrain: {
      wood: stubPillar(),
      brick: stubPillar(),
      sheep: stubPillar(),
      wheat: stubPillar(),
      ore: stubPillar(),
      desert: stubPillar(),
    },
    ready: false,
  };
}

let FALLBACK: TidewellGeometries = makeFallback();

let cache: TidewellGeometries | null = null;
let loadPromise: Promise<TidewellGeometries> | null = null;

function findUrl(fragment: string): (() => Promise<string>) | undefined {
  const key = Object.keys(MODEL_URLS).find((k) => k.includes(fragment));
  return key ? MODEL_URLS[key] : undefined;
}

function extractNamedGeometries(root: Object3D): Map<string, BufferGeometry> {
  const out = new Map<string, BufferGeometry>();
  root.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const names = new Set<string>();
    if (child.name?.trim()) names.add(child.name.trim());
    if (mesh.name?.trim()) names.add(mesh.name.trim());
    let cursor: Object3D | null = child.parent;
    while (cursor) {
      if (cursor.name?.trim()) names.add(cursor.name.trim());
      cursor = cursor.parent;
    }
    for (const name of names) {
      if (!out.has(name)) out.set(name, mesh.geometry.clone());
    }
  });
  return out;
}

async function loadOne(fragment: string, gltf: GLTFLoader): Promise<Map<string, BufferGeometry>> {
  const loader = findUrl(fragment);
  if (!loader) return new Map();
  const url = await loader();
  const parsed = await gltf.loadAsync(url);
  return extractNamedGeometries(parsed.scene);
}

const DECOR_PICK: Record<string, string[]> = {
  wood: ["tree_pineTallA", "tree_pineRoundA", "tree_pineSmallA", "log"],
  brick: ["rock_largeA", "rock_tallA", "stone_smallA"],
  sheep: ["plant_bush", "plant_bushSmall", "sheep"],
  wheat: ["crops_wheatStageB"],
  ore: ["rock_tallA", "rock_smallA", "stone_smallB"],
  desert: ["campfire_bricks", "stone_smallA"],
};

/**
 * Load Tidewell GLB templates once. Safe to call repeatedly.
 */
export async function ensureTidewellGeometries(): Promise<TidewellGeometries> {
  if (cache?.ready) return cache;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const gltf = new GLTFLoader();
    gltf.setMeshoptDecoder(MeshoptDecoder);
    try {
      const [pieces, decor, props] = await Promise.all([
        loadOne("pieces.glb", gltf),
        loadOne("decor.glb", gltf),
        loadOne("props.glb", gltf),
      ]);
      const pick = (map: Map<string, BufferGeometry>, ...names: string[]) => {
        for (const n of names) {
          const g = map.get(n);
          if (g) return g;
        }
        return null;
      };
      const decorByTerrain: Record<string, BufferGeometry> = { ...FALLBACK.decorByTerrain };
      for (const [terrain, names] of Object.entries(DECOR_PICK)) {
        const g = pick(decor, ...names) ?? pick(pieces, ...names);
        if (g) decorByTerrain[terrain] = g;
      }
      const sheep = pick(pieces, "sheep") ?? FALLBACK.sheep;
      const dock = pick(props, "dock") ?? FALLBACK.dock;
      const shipA = pick(props, "boat-a", "boat_a") ?? FALLBACK.shipA;
      const shipB = pick(props, "boat-b", "boat_b") ?? FALLBACK.shipB;
      // G3D-13 proportions vs TILE_RADIUS≈0.95 (≈hex edge): settlement footprint ~0.25 edge, dock <0.6 edge.
      if (dock !== FALLBACK.dock) normalizeExtent(dock, 0.52);
      if (shipA !== FALLBACK.shipA) normalizeExtent(shipA, 0.4);
      if (shipB !== FALLBACK.shipB) normalizeExtent(shipB, 0.4);
      for (const [key, geom] of Object.entries(decorByTerrain)) {
        if (geom !== FALLBACK.decorByTerrain[key]) normalizeExtent(geom, 0.4);
      }
      cache = {
        sheep: sheep !== FALLBACK.sheep ? normalizeExtent(sheep, 0.35) : sheep,
        dock,
        shipA,
        shipB,
        decorByTerrain,
        ready: true,
      };
      return cache;
    } catch (err) {
      loadPromise = null;
      console.warn("[g3d-13] GLB template load failed; keeping procedural fallbacks", err);
      cache = { ...FALLBACK, ready: false };
      return cache;
    }
  })();
  return loadPromise;
}


/** Release GLB / fallback geometries so remount leak checks see 0 residual. */
export function disposeTidewellGeometryCache(): void {
  const bags: TidewellGeometries[] = [];
  if (cache) bags.push(cache);
  bags.push(FALLBACK);
  const seen = new Set<BufferGeometry>();
  for (const bag of bags) {
    for (const key of ["sheep", "dock", "shipA", "shipB"] as const) {
      const geom = bag[key];
      if (geom && !seen.has(geom)) {
        seen.add(geom);
        geom.dispose();
      }
    }
    for (const geom of Object.values(bag.decorByTerrain)) {
      if (geom && !seen.has(geom)) {
        seen.add(geom);
        geom.dispose();
      }
    }
  }
  cache = null;
  loadPromise = null;
  FALLBACK = makeFallback();
}

export function getTidewellGeometriesSync(): TidewellGeometries {
  return cache ?? FALLBACK;
}

export function geometryForNode(node: SceneNode, geoms: TidewellGeometries): BufferGeometry {
  switch (node.kind) {
    case "port":
      return geoms.dock;
    case "ship":
      return node.tag === "ship-b" ? geoms.shipB : geoms.shipA;
    case "decor": {
      const tag = node.tag ?? "desert";
      return geoms.decorByTerrain[tag] ?? geoms.decorByTerrain.desert ?? FALLBACK.decorByTerrain.desert!;
    }
    default:
      return FALLBACK.dock;
  }
}

/** Mark materials on cloned GLB meshes as shared so disposeObject skips them. */
export function applySharedMaterial(root: Object3D, material: Material): void {
  root.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    mesh.material = material;
  });
}
