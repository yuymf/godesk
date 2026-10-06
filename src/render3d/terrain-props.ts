/**
 * G3D-PROPS：按地形实例化的低多边形小道具（自制程序化几何，LicenseRef-GoDesk-Original）。
 *
 * 对标 settlecoast 地形近景：森林 = 密集双三色松林（high 16 / medium 9 棵）；牧场 = 羊群 7/4 + 水槽；
 * 山地 = 灰岩巨石 4/3 + 碎石；丘陵 = 陶土堆 + 砖垛；麦田 = 成行麦束 9/5；沙漠 = 沙丘 + 卵石。
 * - 每种道具 **一个 InstancedMesh**（≤1 draw call / 类型，阴影 pass 另计），共享一份顶点色材质，
 *   instanceColor 做色调变化。**low 档零道具**（不建任何网格）。
 * - 摆放：按格子 (q,r) 播种的确定性拒绝采样，只落在六角内缩区域里，避开中心数字筹码 / 强盗、
 *   角上的渔村与边上的栈道。
 */
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  MeshStandardMaterial,
  OctahedronGeometry,
  Quaternion,
  SphereGeometry,
  Vector2,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { RenderTierId } from "./tiers";
import { NUMBER_TOKEN_SCALE } from "./tokens";

export type PropKind = "pine" | "sheep" | "trough" | "boulder" | "clay" | "bricks" | "sheaf" | "dune" | "pebble";
export const PROP_KINDS: readonly PropKind[] = ["pine", "sheep", "trough", "boulder", "clay", "bricks", "sheaf", "dune", "pebble"];

/** 地形 → 道具（先放大件）。Tidewell 地形键见 runtime/adapters/hex-settlement。 */
export const TERRAIN_PROPS: Record<string, readonly PropKind[]> = {
  wood: ["pine"],
  sheep: ["trough", "sheep"],
  ore: ["boulder", "pebble"],
  brick: ["clay", "bricks"],
  wheat: ["sheaf"],
  desert: ["dune", "pebble"],
};

type Counts = Partial<Record<PropKind, number>>;
/** 每格数量：terrain → kind → count。low 档全 0。 */
export const PROP_COUNTS: Record<RenderTierId, Record<string, Counts>> = {
  high: {
    wood: { pine: 24 },
    sheep: { trough: 1, sheep: 9 },
    ore: { boulder: 5, pebble: 7 },
    brick: { clay: 4, bricks: 3 },
    wheat: { sheaf: 16 },
    desert: { dune: 3, pebble: 6 },
  },
  medium: {
    wood: { pine: 14 },
    sheep: { trough: 1, sheep: 5 },
    ore: { boulder: 3, pebble: 4 },
    brick: { clay: 3, bricks: 2 },
    wheat: { sheaf: 10 },
    desert: { dune: 2, pebble: 3 },
  },
  low: {},
};

/** 道具间最小间距（相邻两件取均值）。 */
const SPACING: Record<PropKind, number> = {
  pine: 0.1, sheep: 0.15, trough: 0.22, boulder: 0.2, clay: 0.22, bricks: 0.17, sheaf: 0.12, dune: 0.28, pebble: 0.08,
};
const CASTS: Record<PropKind, boolean> = {
  pine: true, sheep: true, trough: true, boulder: true, clay: false, bricks: true, sheaf: true, dune: false, pebble: false,
};

/** 地块顶面高度（SceneHost sharedTileGeom 拉伸深度）。 */
export const TILE_TOP = 0.28;
/** 中心禁区：数字筹码（0.22 × 1.8）+ 余量；沙漠为强盗。 */
export const PROP_CENTER_CLEAR = 0.22 * NUMBER_TOKEN_SCALE + 0.07;
/** 六角内缩（边心距度量）：地块边心距 0.91·√3/2 ≈ 0.79，再让出栈道。 */
export const PROP_HEX_INSET = 0.73;
/** 角上渔村禁区（布局顶点半径 1.0）。 */
export const PROP_CORNER_CLEAR = 0.24;

// ── 程序化几何（顶点色、平面着色） ───────────────────────────────────────────

function paint(geom: BufferGeometry, hex: string, jitter = 0): BufferGeometry {
  const g = geom.index ? geom.toNonIndexed() : geom;
  const count = g.getAttribute("position").count;
  const colors = new Float32Array(count * 3);
  const base = new Color(hex);
  for (let i = 0; i < count; i += 3) {
    const k = 1 + (jitter ? (((i * 7919) % 97) / 97 - 0.5) * jitter : 0);
    for (let v = 0; v < 3 && i + v < count; v += 1) {
      colors[(i + v) * 3] = Math.min(1, base.r * k);
      colors[(i + v) * 3 + 1] = Math.min(1, base.g * k);
      colors[(i + v) * 3 + 2] = Math.min(1, base.b * k);
    }
  }
  g.setAttribute("color", new BufferAttribute(colors, 3));
  if (g.getAttribute("uv")) g.deleteAttribute("uv");
  g.computeVertexNormals();
  return g;
}

function at(geom: BufferGeometry, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, rotY = 0): BufferGeometry {
  geom.applyMatrix4(new Matrix4().compose(
    new Vector3(x, y, z),
    new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), rotY),
    new Vector3(sx, sy, sz),
  ));
  return geom;
}

function merged(parts: BufferGeometry[]): BufferGeometry {
  const out = mergeGeometries(parts, false);
  if (!out) throw new Error("terrain-props: merge failed");
  for (const p of parts) p.dispose();
  out.computeBoundingSphere();
  return out;
}

function jag(geom: BufferGeometry, amount: number, seed: number): BufferGeometry {
  const pos = geom.getAttribute("position") as BufferAttribute;
  const v = new Vector3();
  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i);
    const n = Math.sin(v.x * 37 + seed) * Math.cos(v.z * 29 - seed) * Math.sin(v.y * 23 + seed * 0.5);
    v.multiplyScalar(1 + n * amount);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  return geom;
}

/** 松树：树干 + 三层错位圆锥，高约 0.4（色调由 instanceColor 再分深 / 中 / 浅三档）。 */
function pineGeometry(): BufferGeometry {
  return merged([
    paint(at(new CylinderGeometry(0.018, 0.026, 0.08, 6), 0, 0.04, 0), "#5e4128"),
    paint(at(new ConeGeometry(0.12, 0.16, 7), 0, 0.15, 0), "#2d5a37", 0.2),
    paint(at(new ConeGeometry(0.095, 0.15, 7), 0, 0.24, 0, 1, 1, 1, 0.4), "#386a42", 0.2),
    paint(at(new ConeGeometry(0.065, 0.13, 7), 0, 0.33, 0, 1, 1, 1, 0.9), "#467c4e", 0.2),
  ]);
}

/** 羊：蓬松身体 + 黑脸 + 耳 + 四腿，高约 0.13，朝 +X。 */
function sheepGeometry(): BufferGeometry {
  const leg = (x: number, z: number) => paint(at(new BoxGeometry(0.02, 0.055, 0.02), x, 0.028, z), "#2f2a26");
  return merged([
    paint(jag(new IcosahedronGeometry(0.066, 1), 0.08, 3), "#f3efe7", 0.1).applyMatrix4(new Matrix4().compose(new Vector3(0, 0.09, 0), new Quaternion(), new Vector3(1.4, 0.9, 1.0))),
    paint(at(new IcosahedronGeometry(0.034, 0), 0.098, 0.11, 0, 1.2, 0.95, 0.85), "#2f2a26"),
    paint(at(new BoxGeometry(0.016, 0.012, 0.06), 0.088, 0.135, 0), "#2f2a26"),
    leg(0.048, 0.032), leg(0.048, -0.032), leg(-0.048, 0.032), leg(-0.048, -0.032),
  ]);
}

/** 水槽：木槽 + 水面 + 两个支脚。 */
function troughGeometry(): BufferGeometry {
  return merged([
    paint(at(new BoxGeometry(0.2, 0.045, 0.08), 0, 0.045, 0), "#7d5734", 0.15),
    paint(at(new BoxGeometry(0.18, 0.006, 0.06), 0, 0.069, 0), "#5f93a8"),
    paint(at(new BoxGeometry(0.03, 0.03, 0.1), -0.075, 0.015, 0), "#5e4128"),
    paint(at(new BoxGeometry(0.03, 0.03, 0.1), 0.075, 0.015, 0), "#5e4128"),
  ]);
}

/** 山地巨石：两块凹凸十二面体，冷灰，无雪。 */
function boulderGeometry(): BufferGeometry {
  return merged([
    paint(jag(at(new DodecahedronGeometry(0.1, 1), 0, 0.07, 0, 1.2, 0.85, 1), 0.12, 1), "#8b8e93", 0.3),
    paint(jag(at(new DodecahedronGeometry(0.06, 0), 0.1, 0.04, 0.05, 1, 0.8, 1.1, 0.7), 0.1, 2), "#6f7379", 0.3),
  ]);
}

/** 丘陵陶土堆：两个半球 + 顶部浅色，平铺于地。 */
function clayGeometry(): BufferGeometry {
  const mound = (r: number) => new SphereGeometry(r, 9, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  return merged([
    paint(jag(at(mound(0.11), 0, 0, 0, 1, 0.7, 1), 0.08, 4), "#b4613d", 0.22),
    paint(jag(at(mound(0.07), 0.1, 0, 0.07, 1, 0.8, 1), 0.08, 5), "#c97a52", 0.22),
  ]);
}

/** 砖垛：两层错缝 6 块砖。 */
function bricksGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const b = (x: number, y: number, z: number, rot: number, shade: string) =>
    parts.push(paint(at(new BoxGeometry(0.07, 0.03, 0.035), x, y, z, 1, 1, 1, rot), shade, 0.1));
  b(-0.04, 0.015, -0.02, 0, "#a84a2b"); b(0.035, 0.015, -0.02, 0, "#b9573a"); b(-0.04, 0.015, 0.02, 0, "#b9573a");
  b(0.035, 0.015, 0.02, 0, "#a84a2b"); b(0, 0.045, 0, Math.PI / 2, "#c4643f"); b(-0.04, 0.045, 0, Math.PI / 2, "#a84a2b");
  return merged(parts);
}

/** 麦束：车削束腰 + 捆绳，高约 0.2。 */
function sheafGeometry(): BufferGeometry {
  const profile = [[0, 0], [0.045, 0], [0.038, 0.04], [0.027, 0.085], [0.031, 0.11], [0.055, 0.165], [0.045, 0.2], [0, 0.21]]
    .map(([x, y]) => new Vector2(x!, y!));
  return merged([
    paint(new LatheGeometry(profile, 8), "#dcb65c", 0.28),
    paint(at(new CylinderGeometry(0.031, 0.031, 0.016, 8), 0, 0.095, 0), "#8a6a32"),
  ]);
}

/** 沙丘：拉长的半球，比沙地略深。 */
function duneGeometry(): BufferGeometry {
  return paint(jag(at(new SphereGeometry(0.12, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0, 0, 1.7, 0.42, 1), 0.05, 6), "#d2b47e", 0.12);
}

/** 卵石 / 碎石：三颗压扁小石（中性浅灰，instanceColor 按地形染色）。 */
function pebbleGeometry(): BufferGeometry {
  return merged([
    paint(at(new IcosahedronGeometry(0.04, 0), 0, 0.018, 0, 1.3, 0.55, 1), "#d4d0c8", 0.25),
    paint(at(new IcosahedronGeometry(0.028, 0), 0.06, 0.013, 0.03, 1.2, 0.6, 1), "#bdb8ae", 0.25),
    paint(at(new OctahedronGeometry(0.022, 0), -0.045, 0.01, 0.045, 1.1, 0.6, 1.2), "#e2ddd2", 0.25),
  ]);
}

const BUILDERS: Record<PropKind, () => BufferGeometry> = {
  pine: pineGeometry, sheep: sheepGeometry, trough: troughGeometry, boulder: boulderGeometry, clay: clayGeometry,
  bricks: bricksGeometry, sheaf: sheafGeometry, dune: duneGeometry, pebble: pebbleGeometry,
};

export function buildPropGeometry(kind: PropKind): BufferGeometry {
  return BUILDERS[kind]();
}

// ── 确定性摆放 ─────────────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 平顶六边形的边心距度量（边法向 30°/90°/150°）。 */
export function hexMetric(dx: number, dz: number): number {
  const c = Math.sqrt(3) / 2;
  return Math.max(Math.abs(dz), Math.abs(c * dx + 0.5 * dz), Math.abs(c * dx - 0.5 * dz));
}

/** 局部偏移是否在可摆放区域内（相对格子中心）。 */
export function inPropRegion(dx: number, dz: number): boolean {
  if (Math.hypot(dx, dz) < PROP_CENTER_CLEAR) return false;
  if (hexMetric(dx, dz) > PROP_HEX_INSET) return false;
  for (let i = 0; i < 6; i += 1) {
    const a = (Math.PI / 3) * i;
    if (Math.hypot(dx - Math.cos(a), dz - Math.sin(a)) < PROP_CORNER_CLEAR) return false;
  }
  return true;
}

export type PropTile = { q: number; r: number; terrain: string; center: readonly [number, number, number] };
export type PropPlacement = { kind: PropKind; terrain: string; x: number; y: number; z: number; yaw: number; scale: number; tone: number };

/** 一格的全部道具（纯函数）。麦束按行排；其余拒绝采样。 */
export function placeTileProps(tile: PropTile, counts: Counts): PropPlacement[] {
  const kinds = TERRAIN_PROPS[tile.terrain] ?? [];
  const rand = mulberry32(((tile.q + 64) * 73856093) ^ ((tile.r + 64) * 19349663) ^ 0x9e3779b9);
  const out: PropPlacement[] = [];
  const taken: Array<{ x: number; z: number; s: number }> = [];
  const free = (x: number, z: number, s: number) => taken.every((t) => Math.hypot(t.x - x, t.z - z) >= (t.s + s) / 2);
  for (const kind of kinds) {
    const want = counts[kind] ?? 0;
    if (want <= 0) continue;
    const s = SPACING[kind];
    let candidates: Array<[number, number]> = [];
    if (kind === "sheaf") {
      // 成行：行距 0.17、列距 0.14，整片随格子转 0° / 60° / 120°。
      const rot = Math.floor(rand() * 3) * (Math.PI / 3);
      const cr = Math.cos(rot);
      const sr = Math.sin(rot);
      for (let row = -4; row <= 4; row += 1) {
        for (let col = -5; col <= 5; col += 1) {
          const lx = col * 0.14 + (row % 2 ? 0.07 : 0);
          const lz = row * 0.17;
          candidates.push([lx * cr - lz * sr, lx * sr + lz * cr]);
        }
      }
      candidates = candidates.filter(([x, z]) => inPropRegion(x, z));
      for (let i = candidates.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rand() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j]!, candidates[i]!];
      }
    }
    let placed = 0;
    for (let attempt = 0; placed < want && attempt < 1200; attempt += 1) {
      let dx: number;
      let dz: number;
      if (kind === "sheaf") {
        const c = candidates[attempt];
        if (!c) break;
        [dx, dz] = c;
      } else {
        dx = (rand() * 2 - 1) * 0.8;
        dz = (rand() * 2 - 1) * 0.8;
      }
      if (!inPropRegion(dx, dz) || !free(dx, dz, s)) continue;
      taken.push({ x: dx, z: dz, s });
      out.push({
        kind,
        terrain: tile.terrain,
        x: tile.center[0] + dx,
        y: TILE_TOP,
        z: tile.center[2] + dz,
        yaw: kind === "sheaf" ? rand() * 0.6 : rand() * Math.PI * 2,
        scale: kind === "pine" ? 0.9 + rand() * 0.55 : 0.95 + rand() * 0.3,
        tone: rand(),
      });
      placed += 1;
    }
  }
  return out;
}

export function layoutProps(tiles: readonly PropTile[], tier: RenderTierId): Map<PropKind, PropPlacement[]> {
  const byKind = new Map<PropKind, PropPlacement[]>();
  for (const tile of tiles) {
    const counts = PROP_COUNTS[tier][tile.terrain];
    if (!counts) continue;
    for (const p of placeTileProps(tile, counts)) {
      const arr = byKind.get(p.kind) ?? [];
      arr.push(p);
      byKind.set(p.kind, arr);
    }
  }
  return byKind;
}

const PINE_TONES = [new Color(0.8, 0.88, 0.82), new Color(1, 1, 1), new Color(1.12, 1.1, 0.92)];
const PEBBLE_TINT: Record<string, Color> = { desert: new Color("#e6d2a6"), ore: new Color("#9a9ea4") };

function toneFor(p: PropPlacement, out: Color): Color {
  if (p.kind === "pine") return out.copy(PINE_TONES[Math.floor(p.tone * PINE_TONES.length) % PINE_TONES.length]!);
  if (p.kind === "pebble") return out.copy(PEBBLE_TINT[p.terrain] ?? PEBBLE_TINT.desert!);
  const k = 0.92 + p.tone * 0.16;
  return out.setRGB(k, k, k);
}

// ── 场景图层 ───────────────────────────────────────────────────────────────

export type TerrainPropLayer = {
  group: Group;
  /** 地块 / 档位不变时不重建。返回本图层网格数（= draw call 数，不含阴影）。 */
  sync(tiles: readonly PropTile[], tier: RenderTierId, castShadow: boolean): number;
  stats(): { tier: RenderTierId | null; meshes: number; instances: Record<string, number> };
  dispose(): void;
};

export function createTerrainPropLayer(): TerrainPropLayer {
  const group = new Group();
  group.name = "terrain-props";
  const material = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0 });
  const geometries = new Map<PropKind, BufferGeometry>();
  let key = "";
  let tier: RenderTierId | null = null;
  const matrix = new Matrix4();
  const quat = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const pos = new Vector3();
  const scl = new Vector3();
  const tint = new Color();

  function clear() {
    for (const child of [...group.children]) {
      group.remove(child);
      (child as InstancedMesh).dispose?.();
    }
  }

  return {
    group,
    sync(tiles, nextTier, castShadow) {
      const nextKey = `${nextTier}|${castShadow}|${tiles.map((t) => `${t.q},${t.r}:${t.terrain}`).join(";")}`;
      if (nextKey === key) return group.children.length;
      key = nextKey;
      tier = nextTier;
      clear();
      for (const [kind, list] of layoutProps(tiles, nextTier)) {
        let geom = geometries.get(kind);
        if (!geom) {
          geom = buildPropGeometry(kind);
          geometries.set(kind, geom);
        }
        const mesh = new InstancedMesh(geom, material, list.length);
        mesh.name = `prop:${kind}`;
        mesh.castShadow = castShadow && CASTS[kind];
        mesh.receiveShadow = true;
        list.forEach((p, i) => {
          quat.setFromAxisAngle(up, p.yaw);
          matrix.compose(pos.set(p.x, p.y, p.z), quat, scl.setScalar(p.scale));
          mesh.setMatrixAt(i, matrix);
          mesh.setColorAt(i, toneFor(p, tint));
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.computeBoundingSphere();
        mesh.userData.gdShared = true;
        group.add(mesh);
      }
      return group.children.length;
    },
    stats() {
      const instances: Record<string, number> = {};
      for (const child of group.children) instances[child.name] = (child as InstancedMesh).count;
      return { tier, meshes: group.children.length, instances };
    },
    dispose() {
      clear();
      for (const g of geometries.values()) g.dispose();
      geometries.clear();
      material.dispose();
      key = "";
    },
  };
}
