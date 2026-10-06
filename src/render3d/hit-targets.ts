import {
  BoxGeometry,
  CylinderGeometry,
  DynamicDrawUsage,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  TorusGeometry,
} from "three";
import type { PickableLegalAction } from "./pick";

const WORLD_SCALE = 0.01;
const _dummy = new Object3D();

let RING_GEOM_SETTLE = new TorusGeometry(0.2, 0.035, 8, 24);
RING_GEOM_SETTLE.rotateX(Math.PI / 2);
let RING_GEOM_CITY = new TorusGeometry(0.26, 0.035, 8, 24);
RING_GEOM_CITY.rotateX(Math.PI / 2);
let ROAD_HIT_GEOM = new BoxGeometry(0.55, 0.08, 0.18);
let ROBBER_HIT_GEOM = new CylinderGeometry(0.85, 0.85, 0.08, 6);

let RING_MAT = new MeshStandardMaterial({
  color: 0xffe066,
  emissive: 0xffc107,
  emissiveIntensity: 0.85,
  transparent: true,
  opacity: 0.95,
  roughness: 0.4,
});
RING_MAT.userData.gdShared = true;
let ROAD_HIT_MAT = new MeshStandardMaterial({
  color: 0xffe066,
  emissive: 0xffc107,
  emissiveIntensity: 0.7,
  transparent: true,
  opacity: 0.85,
});
ROAD_HIT_MAT.userData.gdShared = true;
let ROBBER_HIT_MAT = new MeshStandardMaterial({
  color: 0xff6b6b,
  emissive: 0xc0392b,
  emissiveIntensity: 0.55,
  transparent: true,
  opacity: 0.45,
});
ROBBER_HIT_MAT.userData.gdShared = true;

function parseVertex(id: string): { x: number; y: number } | null {
  const [xs, ys] = id.split(":");
  const x = Number(xs);
  const y = Number(ys);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function edgeEndpoints(
  edgeId: string,
): [{ x: number; y: number }, { x: number; y: number }] | null {
  const [a, b] = edgeId.split("|");
  const pa = parseVertex(a);
  const pb = parseVertex(b);
  if (!pa || !pb) return null;
  return [pa, pb];
}

function hexCenter(q: number, r: number): { x: number; y: number } {
  const HEX_PIXEL_SIZE = 100;
  return {
    x: HEX_PIXEL_SIZE * (1.5 * q),
    y: HEX_PIXEL_SIZE * ((Math.sqrt(3) / 2) * q + Math.sqrt(3) * r),
  };
}

function toWorld(x: number, y: number, z = 0): [number, number, number] {
  return [x * WORLD_SCALE, z, y * WORLD_SCALE];
}

type InstanceSpec = {
  id: string;
  position: [number, number, number];
  rotationY?: number;
};

function packInstances(
  specs: InstanceSpec[],
  geometry: TorusGeometry | BoxGeometry | CylinderGeometry,
  material: MeshStandardMaterial,
  kind: string,
): Object3D | null {
  if (specs.length === 0) return null;
  const mesh = new InstancedMesh(geometry, material, specs.length);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.userData.gdShared = true;
  mesh.userData.hitOverlay = true;
  mesh.userData.kind = kind;
  // Map instance index → nodeId for picking (raycaster hits InstancedMesh with instanceId).
  const ids: string[] = [];
  specs.forEach((spec, index) => {
    _dummy.position.set(spec.position[0], spec.position[1], spec.position[2]);
    _dummy.rotation.set(0, spec.rotationY ?? 0, 0);
    _dummy.scale.set(1, 1, 1);
    _dummy.updateMatrix();
    mesh.setMatrixAt(index, _dummy.matrix);
    ids.push(spec.id);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.count = specs.length;
  mesh.userData.hitInstanceIds = ids;
  // Also expose first id for non-instance fallbacks
  mesh.userData.nodeId = ids[0];
  return mesh;
}

/**
 * Build highlight/hit meshes for legal place_* and move_robber actions.
 * G3D-13: InstancedMesh per action family so setup (dozens of settlements) stays in draw budget.
 */

function rebuildHitMaterials(): void {
  RING_MAT = new MeshStandardMaterial({
    color: 0xffe066,
    emissive: 0xffc107,
    emissiveIntensity: 0.85,
    transparent: true,
    opacity: 0.95,
    roughness: 0.4,
  });
  RING_MAT.userData.gdShared = true;
  ROAD_HIT_MAT = new MeshStandardMaterial({
    color: 0xffe066,
    emissive: 0xffc107,
    emissiveIntensity: 0.7,
    transparent: true,
    opacity: 0.85,
  });
  ROAD_HIT_MAT.userData.gdShared = true;
  ROBBER_HIT_MAT = new MeshStandardMaterial({
    color: 0xff6b6b,
    emissive: 0xc0392b,
    emissiveIntensity: 0.55,
    transparent: true,
    opacity: 0.45,
  });
  ROBBER_HIT_MAT.userData.gdShared = true;
}

/** Drop shared hit geoms/mats after host teardown (perf residual gate). */
export function disposeSharedHitResources(): void {
  RING_GEOM_SETTLE.dispose();
  RING_GEOM_CITY.dispose();
  ROAD_HIT_GEOM.dispose();
  ROBBER_HIT_GEOM.dispose();
  RING_MAT.dispose();
  ROAD_HIT_MAT.dispose();
  ROBBER_HIT_MAT.dispose();
  RING_GEOM_SETTLE = new TorusGeometry(0.2, 0.035, 8, 24);
  RING_GEOM_SETTLE.rotateX(Math.PI / 2);
  RING_GEOM_CITY = new TorusGeometry(0.26, 0.035, 8, 24);
  RING_GEOM_CITY.rotateX(Math.PI / 2);
  ROAD_HIT_GEOM = new BoxGeometry(0.55, 0.08, 0.18);
  ROBBER_HIT_GEOM = new CylinderGeometry(0.85, 0.85, 0.08, 6);
  rebuildHitMaterials();
}

export function buildLegalHitOverlays(
  legalActions: readonly PickableLegalAction[],
): Object3D[] {
  const settle: InstanceSpec[] = [];
  const city: InstanceSpec[] = [];
  const road: InstanceSpec[] = [];
  const robber: InstanceSpec[] = [];

  for (const action of legalActions) {
    if (action.type === "place_settlement") {
      const vertexId = String(action.payload?.vertexId ?? "");
      const point = parseVertex(vertexId);
      if (!point) continue;
      settle.push({
        id: `hit:place_settlement:${vertexId}`,
        position: toWorld(point.x, point.y, 0.55),
      });
    } else if (action.type === "place_city") {
      const vertexId = String(action.payload?.vertexId ?? "");
      const point = parseVertex(vertexId);
      if (!point) continue;
      city.push({
        id: `hit:place_city:${vertexId}`,
        position: toWorld(point.x, point.y, 0.65),
      });
    } else if (action.type === "place_road") {
      const edgeId = String(action.payload?.edgeId ?? "");
      const ends = edgeEndpoints(edgeId);
      if (!ends) continue;
      const [a, b] = ends;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      road.push({
        id: `hit:place_road:${edgeId}`,
        position: toWorld(mid.x, mid.y, 0.28),
        rotationY: -angle,
      });
    } else if (action.type === "move_robber") {
      const hex = String(action.payload?.hex ?? "");
      const [qs, rs] = hex.split(",");
      const q = Number(qs);
      const r = Number(rs);
      if (!Number.isFinite(q) || !Number.isFinite(r)) continue;
      const center = hexCenter(q, r);
      robber.push({
        id: `hit:move_robber:${hex}`,
        position: toWorld(center.x, center.y, 0.32),
      });
    }
  }

  const out: Object3D[] = [];
  const a = packInstances(settle, RING_GEOM_SETTLE, RING_MAT, "hit");
  const b = packInstances(city, RING_GEOM_CITY, RING_MAT, "hit");
  const c = packInstances(road, ROAD_HIT_GEOM, ROAD_HIT_MAT, "hit");
  const d = packInstances(robber, ROBBER_HIT_GEOM, ROBBER_HIT_MAT, "hit");
  for (const mesh of [a, b, c, d]) if (mesh) out.push(mesh);
  return out;
}

export function disposeHitOverlay(object: Object3D): void {
  object.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    if (mesh.userData.gdShared) {
      // Shared templates disposed via disposeSharedHitResources after host teardown.
      if ((mesh as InstancedMesh).isInstancedMesh) {
        mesh.geometry = null as unknown as typeof mesh.geometry;
        mesh.material = null as unknown as typeof mesh.material;
        (mesh as InstancedMesh).dispose();
      }
      return;
    }
    mesh.geometry?.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) {
      for (const entry of material) entry.dispose();
    } else {
      material?.dispose();
    }
  });
}
