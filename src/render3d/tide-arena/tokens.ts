/**
 * Tide Arena / 潮阵 — low-poly unit tokens. Each unit type is ONE merged,
 * vertex-coloured geometry (base disc in its cost-tier colour + a unique
 * silhouette), so a whole army renders as one InstancedMesh per type.
 */
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  IcosahedronGeometry,
  Matrix4,
  OctahedronGeometry,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { ENEMY_RING, OWN_RING, TIER_COLORS, UNIT_COLORS } from "./palette";

export { ENEMY_RING, OWN_RING, TIER_COLORS, UNIT_COLORS };
export const TOKEN_HEIGHT = 1.05;

type Part = {
  geo: BufferGeometry;
  color: string;
  at?: [number, number, number];
  rot?: [number, number, number];
  scale?: [number, number, number];
};

function bake({ geo, color, at = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1] }: Part): BufferGeometry {
  const matrix = new Matrix4().compose(
    new Vector3(...at),
    new Quaternion().setFromEuler(new Euler(...rot)),
    new Vector3(...scale),
  );
  const g = (geo.index ? geo.toNonIndexed() : geo).applyMatrix4(matrix);
  g.deleteAttribute("uv");
  const c = new Color(color);
  const colors = new Float32Array(g.getAttribute("position").count * 3);
  for (let i = 0; i < colors.length; i += 3) {
    colors[i] = c.r;
    colors[i + 1] = c.g;
    colors[i + 2] = c.b;
  }
  g.setAttribute("color", new BufferAttribute(colors, 3));
  return g;
}

function base(cost: number): Part[] {
  return [{ geo: new CylinderGeometry(0.42, 0.46, 0.12, 20), color: TIER_COLORS[cost] ?? TIER_COLORS[1]!, at: [0, 0.06, 0] }];
}

/** Unique silhouette per unit (SPEC table): shapes differ, not just colours. */
function silhouette(unitId: string): Part[] {
  const col = UNIT_COLORS[unitId] ?? "#cccccc";
  switch (unitId) {
    case "crab": // flattened shell + two raised claws + eye stalks
      return [
        { geo: new SphereGeometry(0.3, 8, 5), color: col, at: [0, 0.3, 0], scale: [1.35, 0.55, 1.05] },
        { geo: new SphereGeometry(0.12, 6, 4), color: col, at: [-0.36, 0.42, 0.18], scale: [1, 0.8, 1.3] },
        { geo: new SphereGeometry(0.12, 6, 4), color: col, at: [0.36, 0.42, 0.18], scale: [1, 0.8, 1.3] },
        { geo: new SphereGeometry(0.05, 5, 3), color: "#2A211A", at: [-0.09, 0.47, 0.22] },
        { geo: new SphereGeometry(0.05, 5, 3), color: "#2A211A", at: [0.09, 0.47, 0.22] },
      ];
    case "blade": // pentagonal cone + floating crystal + slanted blade
      return [
        { geo: new ConeGeometry(0.22, 0.62, 5), color: col, at: [0, 0.43, 0] },
        { geo: new OctahedronGeometry(0.13), color: "#E6F4F2", at: [0, 0.86, 0] },
        { geo: new BoxGeometry(0.06, 0.62, 0.03), color: "#DDE8EA", at: [0.27, 0.56, 0], rot: [0, 0, -0.42] },
      ];
    case "archer": // tilted dart body + wide fins + bow arc
      return [
        { geo: new ConeGeometry(0.17, 0.72, 6), color: col, at: [0, 0.48, 0], rot: [Math.PI / 2.4, 0, 0] },
        { geo: new BoxGeometry(0.72, 0.03, 0.2), color: "#CFEAF7", at: [0, 0.48, 0] },
        { geo: new TorusGeometry(0.2, 0.022, 4, 10, Math.PI), color: "#7A5234", at: [0, 0.62, 0.2] },
      ];
    case "witch": // hex robe + head + three coral antlers
      return [
        { geo: new ConeGeometry(0.26, 0.68, 6), color: col, at: [0, 0.46, 0] },
        { geo: new SphereGeometry(0.1, 6, 4), color: "#F7D8DF", at: [0, 0.84, 0] },
        ...[0, 1, 2].map((i): Part => ({
          geo: new CylinderGeometry(0.025, 0.04, 0.3, 5),
          color: "#F2B8C6",
          at: [Math.cos(i * 2.1) * 0.12, 0.98, Math.sin(i * 2.1) * 0.12],
          rot: [Math.sin(i * 2.1) * 0.5, 0, -Math.cos(i * 2.1) * 0.5],
        })),
      ];
    case "whale": // rounded hull + tower shield in front + tail fin
      return [
        { geo: new SphereGeometry(0.31, 8, 6), color: col, at: [0, 0.4, -0.04], scale: [1, 1, 1.3] },
        { geo: new BoxGeometry(0.5, 0.55, 0.08), color: "#C9B48A", at: [0, 0.42, 0.36] },
        { geo: new ConeGeometry(0.12, 0.24, 4), color: col, at: [0, 0.46, -0.46], rot: [-Math.PI / 2, 0, 0] },
      ];
    case "conch": // spiral shell horn + small guard
      return [
        { geo: new SphereGeometry(0.28, 8, 6), color: col, at: [0, 0.36, 0], scale: [1.1, 0.9, 1.2] },
        { geo: new ConeGeometry(0.12, 0.4, 6), color: col, at: [0.22, 0.55, 0], rot: [0, 0, -0.9] },
        { geo: new BoxGeometry(0.18, 0.35, 0.06), color: "#C9B48A", at: [-0.22, 0.4, 0.1] },
      ];
    case "rider": // wave crest mount + rider fin
      return [
        { geo: new ConeGeometry(0.2, 0.5, 4), color: col, at: [0, 0.4, 0], rot: [Math.PI / 2, 0, 0] },
        { geo: new BoxGeometry(0.12, 0.4, 0.12), color: "#E8F4F0", at: [0, 0.62, 0] },
        { geo: new ConeGeometry(0.08, 0.28, 4), color: "#CFEAF7", at: [0.2, 0.5, -0.1], rot: [0, 0, 0.6] },
      ];
    case "anemone": // stalk + petal crown
      return [
        { geo: new CylinderGeometry(0.08, 0.14, 0.45, 6), color: col, at: [0, 0.35, 0] },
        { geo: new SphereGeometry(0.22, 7, 5), color: "#F2B8C6", at: [0, 0.68, 0] },
        ...[0, 1, 2, 3].map((i): Part => ({
          geo: new ConeGeometry(0.05, 0.22, 4),
          color: col,
          at: [Math.cos(i * 1.57) * 0.18, 0.78, Math.sin(i * 1.57) * 0.18],
          rot: [0.4, 0, 0],
        })),
      ];
    case "priest": // tall robe + tide staff
      return [
        { geo: new ConeGeometry(0.24, 0.72, 6), color: col, at: [0, 0.48, 0] },
        { geo: new SphereGeometry(0.09, 6, 4), color: "#F7E8D0", at: [0, 0.9, 0] },
        { geo: new CylinderGeometry(0.03, 0.03, 0.7, 5), color: "#D9A43A", at: [0.28, 0.5, 0] },
      ];
    case "turtle": // dome shell + head
      return [
        { geo: new SphereGeometry(0.32, 8, 5), color: col, at: [0, 0.34, 0], scale: [1.2, 0.7, 1.1] },
        { geo: new SphereGeometry(0.1, 6, 4), color: "#C9B48A", at: [0, 0.4, 0.34] },
        { geo: new BoxGeometry(0.5, 0.08, 0.5), color: "#5A7A4A", at: [0, 0.42, 0] },
      ];
    case "lantern": // post + glowing lantern
      return [
        { geo: new CylinderGeometry(0.05, 0.07, 0.55, 5), color: "#7A5234", at: [0, 0.4, 0] },
        { geo: new BoxGeometry(0.28, 0.28, 0.28), color: col, at: [0, 0.78, 0] },
        { geo: new SphereGeometry(0.1, 6, 4), color: "#F7D57A", at: [0, 0.78, 0] },
      ];
    case "spirit": // floating icosahedron + tilted gold halo + thin stem
    default:
      return [
        { geo: new CylinderGeometry(0.03, 0.05, 0.36, 5), color: "#BFEDE6", at: [0, 0.3, 0] },
        { geo: new IcosahedronGeometry(0.24, 0), color: col, at: [0, 0.66, 0] },
        { geo: new TorusGeometry(0.32, 0.025, 5, 24), color: "#D9A43A", at: [0, 0.66, 0], rot: [1.2, 0, 0] },
      ];
  }
}

const cache = new Map<string, BufferGeometry>();

export function unitGeometry(unitId: string, cost: number): BufferGeometry {
  const key = `${unitId}:${cost}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const merged = mergeGeometries([...base(cost), ...silhouette(unitId)].map(bake), false);
  if (!merged) throw new Error(`tide_arena_token_merge_failed:${unitId}`);
  merged.computeVertexNormals();
  merged.computeBoundingSphere();
  cache.set(key, merged);
  return merged;
}

/** Side ring around the base: own = teal, enemy = coral (instance colour). */
export function ringGeometry(): BufferGeometry {
  return new TorusGeometry(0.44, 0.035, 6, 32).rotateX(Math.PI / 2).translate(0, 0.12, 0);
}
