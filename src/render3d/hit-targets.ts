import {
  BoxGeometry,
  CylinderGeometry,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  TorusGeometry,
} from "three";
import type { PickableLegalAction } from "./pick";

const WORLD_SCALE = 0.01;

/** Shared highlight materials/geoms — one draw call family instead of per-action alloc. */
const RING_GEOM_CITY = new TorusGeometry(0.26, 0.035, 8, 24);
RING_GEOM_CITY.rotateX(Math.PI / 2);
const RING_GEOM_SETTLE = new TorusGeometry(0.2, 0.035, 8, 24);
RING_GEOM_SETTLE.rotateX(Math.PI / 2);
const ROAD_HIT_GEOM = new BoxGeometry(0.55, 0.08, 0.18);
const ROBBER_HIT_GEOM = new CylinderGeometry(0.85, 0.85, 0.08, 6);

const RING_MAT = new MeshStandardMaterial({
  color: 0xffe066,
  emissive: 0xffc107,
  emissiveIntensity: 0.85,
  transparent: true,
  opacity: 0.95,
  roughness: 0.4,
});
RING_MAT.userData.gdShared = true;
const ROAD_HIT_MAT = new MeshStandardMaterial({
  color: 0xffe066,
  emissive: 0xffc107,
  emissiveIntensity: 0.7,
  transparent: true,
  opacity: 0.85,
});
ROAD_HIT_MAT.userData.gdShared = true;
const ROBBER_HIT_MAT = new MeshStandardMaterial({
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

function ringMesh(
  id: string,
  kind: string,
  position: [number, number, number],
  geom: TorusGeometry,
): Mesh {
  const mesh = new Mesh(geom, RING_MAT);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.userData.nodeId = id;
  mesh.userData.kind = kind;
  mesh.userData.hitOverlay = true;
  mesh.userData.gdShared = true;
  return mesh;
}

/**
 * Build highlight/hit meshes for legal place_* and move_robber actions.
 */
export function buildLegalHitOverlays(
  legalActions: readonly PickableLegalAction[],
): Object3D[] {
  const out: Object3D[] = [];
  for (const action of legalActions) {
    if (action.type === "place_settlement") {
      const vertexId = String(action.payload?.vertexId ?? "");
      const point = parseVertex(vertexId);
      if (!point) continue;
      out.push(
        ringMesh(
          `hit:place_settlement:${vertexId}`,
          "hit",
          toWorld(point.x, point.y, 0.55),
          RING_GEOM_SETTLE,
        ),
      );
    } else if (action.type === "place_city") {
      const vertexId = String(action.payload?.vertexId ?? "");
      const point = parseVertex(vertexId);
      if (!point) continue;
      out.push(
        ringMesh(
          `hit:place_city:${vertexId}`,
          "hit",
          toWorld(point.x, point.y, 0.65),
          RING_GEOM_CITY,
        ),
      );
    } else if (action.type === "place_road") {
      const edgeId = String(action.payload?.edgeId ?? "");
      const ends = edgeEndpoints(edgeId);
      if (!ends) continue;
      const [a, b] = ends;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      const mesh = new Mesh(ROAD_HIT_GEOM, ROAD_HIT_MAT);
      const pos = toWorld(mid.x, mid.y, 0.28);
      mesh.position.set(pos[0], pos[1], pos[2]);
      mesh.rotation.y = -angle;
      mesh.userData.nodeId = `hit:place_road:${edgeId}`;
      mesh.userData.kind = "hit";
      mesh.userData.hitOverlay = true;
      mesh.userData.gdShared = true;
      out.push(mesh);
    } else if (action.type === "move_robber") {
      const hex = String(action.payload?.hex ?? "");
      const [qs, rs] = hex.split(",");
      const q = Number(qs);
      const r = Number(rs);
      if (!Number.isFinite(q) || !Number.isFinite(r)) continue;
      const center = hexCenter(q, r);
      const mesh = new Mesh(ROBBER_HIT_GEOM, ROBBER_HIT_MAT);
      const pos = toWorld(center.x, center.y, 0.32);
      mesh.position.set(pos[0], pos[1], pos[2]);
      mesh.userData.nodeId = `hit:move_robber:${hex}`;
      mesh.userData.kind = "hit";
      mesh.userData.hitOverlay = true;
      mesh.userData.gdShared = true;
      out.push(mesh);
    }
  }
  return out;
}

export function disposeHitOverlay(object: Object3D): void {
  object.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    // Shared templates live for the session.
    if (mesh.userData.gdShared) return;
    mesh.geometry?.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) {
      for (const entry of material) entry.dispose();
    } else {
      material?.dispose();
    }
  });
}
