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

export type TidewellGeometries = {
  settlement: BufferGeometry;
  city: BufferGeometry;
  robber: BufferGeometry;
  road: BufferGeometry;
  sheep: BufferGeometry;
  dock: BufferGeometry;
  shipA: BufferGeometry;
  shipB: BufferGeometry;
  die: BufferGeometry;
  diceTray: BufferGeometry;
  decorByTerrain: Record<string, BufferGeometry>;
  ready: boolean;
};

function stubPillar(): BufferGeometry {
  return new CylinderGeometry(0.14, 0.18, 0.35, 8);
}

const FALLBACK: TidewellGeometries = {
  settlement: new BoxGeometry(0.28, 0.28, 0.28),
  city: new BoxGeometry(0.36, 0.48, 0.36),
  robber: new CylinderGeometry(0.12, 0.18, 0.7, 12),
  road: new BoxGeometry(1, 1, 1),
  sheep: stubPillar(),
  dock: new BoxGeometry(0.4, 0.12, 0.4),
  shipA: new BoxGeometry(0.5, 0.18, 0.22),
  shipB: new BoxGeometry(0.5, 0.18, 0.22),
  die: new BoxGeometry(0.22, 0.22, 0.22),
  diceTray: new BoxGeometry(0.7, 0.1, 0.5),
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
      const settle = pick(pieces, "settlement") ?? FALLBACK.settlement;
      const city = pick(pieces, "city") ?? FALLBACK.city;
      const robber = pick(pieces, "fog_lamp", "fog-lamp") ?? FALLBACK.robber;
      const road = pick(pieces, "road") ?? FALLBACK.road;
      const sheep = pick(pieces, "sheep") ?? FALLBACK.sheep;
      const dock = pick(props, "dock") ?? FALLBACK.dock;
      const shipA = pick(props, "boat-a", "boat_a") ?? FALLBACK.shipA;
      const shipB = pick(props, "boat-b", "boat_b") ?? FALLBACK.shipB;
      const die = pick(props, "dice", "die") ?? FALLBACK.die;
      const diceTray = pick(props, "dice_tray", "dice-tray") ?? FALLBACK.diceTray;
      // G3D-13 proportions vs TILE_RADIUS≈0.95: settlement ~0.25 hex, dock <0.6 edge.
      if (settle !== FALLBACK.settlement) normalizeExtent(settle, 0.48);
      if (city !== FALLBACK.city) normalizeExtent(city, 0.58);
      if (robber !== FALLBACK.robber) normalizeExtent(robber, 0.7);
      if (dock !== FALLBACK.dock) normalizeExtent(dock, 0.52);
      if (shipA !== FALLBACK.shipA) normalizeExtent(shipA, 0.4);
      if (shipB !== FALLBACK.shipB) normalizeExtent(shipB, 0.4);
      if (road !== FALLBACK.road) normalizeExtent(road, 0.55);
      if (die !== FALLBACK.die) normalizeExtent(die, 0.22);
      if (diceTray !== FALLBACK.diceTray) normalizeExtent(diceTray, 0.7);
      for (const [key, geom] of Object.entries(decorByTerrain)) {
        if (geom !== FALLBACK.decorByTerrain[key]) normalizeExtent(geom, 0.4);
      }
      cache = {
        settlement: settle,
        city,
        robber,
        road,
        sheep: sheep !== FALLBACK.sheep ? normalizeExtent(sheep, 0.35) : sheep,
        dock,
        shipA,
        shipB,
        die,
        diceTray,
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

export function getTidewellGeometriesSync(): TidewellGeometries {
  return cache ?? FALLBACK;
}

export function geometryForNode(node: SceneNode, geoms: TidewellGeometries): BufferGeometry {
  switch (node.kind) {
    case "settlement":
      return geoms.settlement;
    case "city":
      return geoms.city;
    case "robber":
      return geoms.robber;
    case "road":
      return geoms.road;
    case "port":
      return geoms.dock;
    case "ship":
      return node.tag === "ship-b" ? geoms.shipB : geoms.shipA;
    case "die":
      return geoms.die;
    case "dice-tray":
      return geoms.diceTray;
    case "decor": {
      const tag = node.tag ?? "desert";
      return geoms.decorByTerrain[tag] ?? geoms.decorByTerrain.desert ?? FALLBACK.decorByTerrain.desert!;
    }
    default:
      return FALLBACK.settlement;
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
