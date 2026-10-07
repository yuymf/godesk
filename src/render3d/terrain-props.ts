/**
 * G3D-PROPS：按地形实例化的低多边形小道具（自制程序化几何，LicenseRef-GoDesk-Original）。
 *
 * round-3d：森林 = 三树种（高瘦冷杉 / 圆冠 / 矮灌）+ 树冠团；牧场羊有可读头腿；麦田有垄沟与穗高。
 * R11：再抬 high/medium 林/羊/麦密度，收紧间距，拉近左屏绘本读感。
 * - 每种道具 **一个 InstancedMesh**（≤1 draw call / 类型，阴影 pass 另计），共享一份顶点色材质，
 *   instanceColor 做色调变化。**low 档零道具**（不建任何网格）。
 * - 摆放：按格子 (q,r) 播种的确定性拒绝采样，只落在六角内缩区域里，避开中心数字筹码 / 强盗、
 *   角上的渔村与边上的栈道。
 */
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
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

export type PropKind =
  | "pineTall" | "pineRound" | "pineSmall" | "canopy"
  | "sheep" | "trough" | "boulder" | "clay" | "bricks" | "sheaf" | "wheatrow" | "dune" | "pebble" | "blobshadow";
export const PROP_KINDS: readonly PropKind[] = [
  "pineTall", "pineRound", "pineSmall", "canopy",
  "sheep", "trough", "boulder", "clay", "bricks", "sheaf", "wheatrow", "dune", "pebble", "blobshadow",
];
function isPine(kind: PropKind): boolean {
  return kind === "pineTall" || kind === "pineRound" || kind === "pineSmall";
}

/** 地形 → 道具（先放大件）。Tidewell 地形键见 runtime/adapters/hex-settlement。 */
export const TERRAIN_PROPS: Record<string, readonly PropKind[]> = {
  wood: ["pineTall", "pineRound", "pineSmall", "canopy"],
  sheep: ["trough", "sheep"],
  ore: ["boulder", "pebble"],
  brick: ["clay", "bricks"],
  wheat: ["wheatrow", "sheaf"],
  desert: ["dune", "pebble"],
};

type Counts = Partial<Record<PropKind, number>>;
/** 每格数量：terrain → kind → count。low 档全 0。 */
export const PROP_COUNTS: Record<RenderTierId, Record<string, Counts>> = {
  high: {
    // R11: denser forest / flock / wheat rows toward left-screen painterly read.
    wood: { pineTall: 24, pineRound: 26, pineSmall: 18, canopy: 18, blobshadow: 68 },
    sheep: { trough: 1, sheep: 22, blobshadow: 23 },
    ore: { boulder: 9, pebble: 13, blobshadow: 9 },
    brick: { clay: 8, bricks: 4 },
    wheat: { wheatrow: 38, sheaf: 5 },
    desert: { dune: 5, pebble: 9 },
  },
  medium: {
    wood: { pineTall: 14, pineRound: 16, pineSmall: 10, canopy: 8, blobshadow: 40 },
    sheep: { trough: 1, sheep: 12, blobshadow: 13 },
    ore: { boulder: 5, pebble: 7, blobshadow: 5 },
    brick: { clay: 5, bricks: 3 },
    wheat: { wheatrow: 24, sheaf: 3 },
    desert: { dune: 3, pebble: 5 },
  },
  low: {},
};

/** 道具间最小间距（相邻两件取均值）。 */
const SPACING: Record<PropKind, number> = {
  // R11: ~12% tighter pack so higher counts still land inside the hex.
  pineTall: 0.095, pineRound: 0.11, pineSmall: 0.078, canopy: 0.105, sheep: 0.14, trough: 0.2, boulder: 0.16, clay: 0.18, bricks: 0.15, sheaf: 0.105, wheatrow: 0.088, dune: 0.26, pebble: 0.065, blobshadow: 0.07,
};
const CASTS: Record<PropKind, boolean> = {
  pineTall: true, pineRound: true, pineSmall: true, canopy: false, sheep: true, trough: true, boulder: true, clay: false, bricks: true, sheaf: true, wheatrow: true, dune: false, pebble: false, blobshadow: false,
};
/** 圆润有机体用平滑着色，岩石 / 砖保持平面着色。 */
const SMOOTH: Record<PropKind, boolean> = {
  pineTall: true, pineRound: true, pineSmall: true, canopy: true, sheep: true, trough: false, boulder: false, clay: true, bricks: false, sheaf: true, wheatrow: true, dune: true, pebble: false, blobshadow: true,
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

/** 按高度渐变的顶点色（保留原平滑法线；painterly 体积感）。 */
function grad(geom: BufferGeometry, bottom: string, top: string, y0: number, y1: number, jitter = 0): BufferGeometry {
  const g = geom.index ? geom.toNonIndexed() : geom;
  const pos = g.getAttribute("position");
  const colors = new Float32Array(pos.count * 3);
  const a = new Color(bottom);
  const b = new Color(top);
  const c = new Color();
  for (let i = 0; i < pos.count; i += 1) {
    const t = Math.min(1, Math.max(0, (pos.getY(i) - y0) / Math.max(y1 - y0, 1e-6)));
    const k = 1 + (jitter ? ((((i / 3) | 0) * 7919) % 97 / 97 - 0.5) * jitter : 0);
    c.copy(a).lerp(b, t * t * (3 - 2 * t));
    colors[i * 3] = Math.min(1, c.r * k);
    colors[i * 3 + 1] = Math.min(1, c.g * k);
    colors[i * 3 + 2] = Math.min(1, c.b * k);
  }
  g.setAttribute("color", new BufferAttribute(colors, 3));
  if (g.getAttribute("uv")) g.deleteAttribute("uv");
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

/** 高瘦冷杉：尖顶长锥，偏冷深绿，高约 0.58。 */
function pineTallGeometry(): BufferGeometry {
  const profile = [
    [0, 0.06], [0.09, 0.08], [0.078, 0.14], [0.055, 0.2], [0.07, 0.24], [0.048, 0.3],
    [0.035, 0.36], [0.045, 0.4], [0.028, 0.46], [0.016, 0.52], [0.006, 0.56], [0, 0.585],
  ].map(([x, y]) => new Vector2(x!, y!));
  return merged([
    grad(at(new CylinderGeometry(0.014, 0.022, 0.09, 5, 1, true), 0, 0.045, 0), "#3a2a1a", "#5a4028", 0, 0.09),
    grad(new LatheGeometry(profile, 8), "#163828", "#3d7a52", 0.06, 0.58, 0.1),
  ]);
}

/** 圆冠阔叶松：胖裙摆 + 钝顶，偏暖黄绿，高约 0.4。 */
function pineRoundGeometry(): BufferGeometry {
  const profile = [
    [0, 0.04], [0.15, 0.06], [0.155, 0.1], [0.12, 0.14], [0.145, 0.17], [0.11, 0.21],
    [0.095, 0.25], [0.11, 0.28], [0.07, 0.32], [0.04, 0.36], [0.015, 0.385], [0, 0.4],
  ].map(([x, y]) => new Vector2(x!, y!));
  return merged([
    grad(at(new CylinderGeometry(0.02, 0.03, 0.06, 5, 1, true), 0, 0.03, 0), "#4a3220", "#6b4a2c", 0, 0.06),
    grad(new LatheGeometry(profile, 8), "#2a5a28", "#7ab05a", 0.04, 0.4, 0.1),
  ]);
}

/** 矮灌丛松：短胖两层冠，偏橄榄绿，高约 0.28。 */
function pineSmallGeometry(): BufferGeometry {
  const profile = [
    [0, 0.03], [0.11, 0.045], [0.1, 0.08], [0.07, 0.11], [0.095, 0.135], [0.065, 0.17],
    [0.04, 0.21], [0.022, 0.245], [0.008, 0.268], [0, 0.28],
  ].map(([x, y]) => new Vector2(x!, y!));
  return merged([
    grad(at(new CylinderGeometry(0.016, 0.022, 0.05, 5, 1, true), 0, 0.025, 0), "#3e2c1c", "#5c4028", 0, 0.05),
    grad(new LatheGeometry(profile, 7), "#2a4820", "#6a8a3a", 0.03, 0.28, 0.1),
  ]);
}

/** 树冠云：压扁的半透明绿团，铺在松树上方，远看连成一片树冠（仅 high 档）。 */
function canopyGeometry(): BufferGeometry {
  return grad(at(new SphereGeometry(0.16, 10, 6), 0, 0, 0, 1.55, 0.42, 1.35), "#2f6b3a", "#6aa45a", -0.05, 0.08, 0.12);
}

/** 接触阴影：贴地半透明深色扁圆，给道具脚下一点落地感（便宜，+1 draw call）。 */
function blobShadowGeometry(): BufferGeometry {
  return grad(at(new CircleGeometry(0.1, 12), 0, 0.002, 0, 1, 1, 1).rotateX(-Math.PI / 2), "#1a1814", "#1a1814", 0, 1);
}

/** 羊：圆润羊毛身体 + 明显深色头/耳/四腿（远景可读），朝 +X，高约 0.2。 */
function sheepGeometry(): BufferGeometry {
  const leg = (x: number, z: number) =>
    grad(at(new CylinderGeometry(0.016, 0.014, 0.095, 5, 1, true), x, 0.047, z), "#1e1a18", "#3a332e", 0, 0.095);
  const wool = (x: number, y: number, z: number, r: number) =>
    grad(at(new SphereGeometry(r, 7, 4), x, y, z), "#ece6dc", "#ffffff", y - r, y + r);
  return merged([
    grad(at(new SphereGeometry(0.09, 10, 6), 0, 0.13, 0, 1.35, 0.95, 1.05), "#e3ddd2", "#ffffff", 0.05, 0.22),
    wool(-0.035, 0.185, 0.03, 0.048), wool(0.04, 0.19, -0.025, 0.045), wool(-0.065, 0.165, -0.035, 0.042),
    // 头：更大更深，鼻口朝 +X
    grad(at(new SphereGeometry(0.048, 7, 5), 0.14, 0.155, 0, 1.35, 1.0, 0.9), "#2a221c", "#4a3a32", 0.11, 0.2),
    // 双耳
    grad(at(new SphereGeometry(0.018, 5, 3), 0.12, 0.195, 0.045, 0.7, 1.2, 0.55), "#2a221c", "#3a3028", 0.18, 0.22),
    grad(at(new SphereGeometry(0.018, 5, 3), 0.12, 0.195, -0.045, 0.7, 1.2, 0.55), "#2a221c", "#3a3028", 0.18, 0.22),
    // 鼻梁横条增强剪影
    grad(at(new BoxGeometry(0.022, 0.016, 0.08), 0.155, 0.15, 0), "#1a1614", "#2e2824", 0, 1),
    leg(0.06, 0.04), leg(0.06, -0.04), leg(-0.06, 0.04), leg(-0.06, -0.04),
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

/** 麦垄：深色垄沟底 + 双排竖立麦穗（有高度，非平黄面），长约 0.28，沿 X。 */
function wheatRowGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [
    // 垄底土埂
    grad(at(new BoxGeometry(0.3, 0.035, 0.1), 0, 0.017, 0), "#6a4a14", "#8f6a1c", 0, 0.035),
    // 中间浅沟（加深垄感）
    grad(at(new BoxGeometry(0.28, 0.012, 0.028), 0, 0.01, 0), "#5a3e10", "#6a4a14", 0, 0.012),
  ];
  for (let i = 0; i < 8; i += 1) {
    const x = -0.13 + i * 0.037;
    for (const side of [-1, 1] as const) {
      const z = side * 0.028;
      const stalkH = 0.11 + ((i * 17 + side + 3) % 5) * 0.018;
      // 竖茎
      parts.push(grad(
        at(new CylinderGeometry(0.008, 0.011, stalkH, 4, 1, true), x, 0.035 + stalkH / 2, z),
        "#8a6a1a", "#c9a030", 0.035, 0.035 + stalkH,
      ));
      // 穗头
      const headR = 0.022 + ((i * 11) % 3) * 0.004;
      parts.push(grad(
        at(new SphereGeometry(headR, 5, 4), x, 0.035 + stalkH + headR * 0.6, z, 0.85, 1.35, 0.85),
        "#c9a030", "#f5d060", 0.035 + stalkH - 0.02, 0.035 + stalkH + headR,
      ));
    }
  }
  return merged(parts);
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
  pineTall: pineTallGeometry, pineRound: pineRoundGeometry, pineSmall: pineSmallGeometry,
  canopy: canopyGeometry, sheep: sheepGeometry, trough: troughGeometry, boulder: boulderGeometry, clay: clayGeometry,
  bricks: bricksGeometry, sheaf: sheafGeometry, wheatrow: wheatRowGeometry, dune: duneGeometry, pebble: pebbleGeometry, blobshadow: blobShadowGeometry,
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
export type PropPlacement = {
  kind: PropKind; terrain: string; x: number; y: number; z: number; yaw: number; scale: number;
  /** 纵向挤压 / 拉伸系数（squash-and-stretch）。 */
  stretch: number; tone: number; hue: number;
};

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
    let rowYaw = 0;
    if (kind === "wheatrow") {
      // R11 麦垄：更密候选网格，整片随格子转 0° / 60° / 120°；两端都要在可摆放区内。
      rowYaw = Math.floor(rand() * 3) * (Math.PI / 3);
      const cr = Math.cos(rowYaw);
      const sr = Math.sin(rowYaw);
      const rot = (lx: number, lz: number): [number, number] => [lx * cr - lz * sr, lx * sr + lz * cr];
      for (let row = -9; row <= 9; row += 1) {
        for (let col = -5; col <= 5; col += 1) {
          const lx = col * 0.22 + (row % 2 ? 0.11 : 0);
          const lz = row * 0.085;
          const c = rot(lx, lz);
          const e1 = rot(lx - 0.1, lz);
          const e2 = rot(lx + 0.1, lz);
          if (inPropRegion(...c) && inPropRegion(...e1) && inPropRegion(...e2)) candidates.push(c);
        }
      }
      for (let i = candidates.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rand() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j]!, candidates[i]!];
      }
    }
    let placed = 0;
    for (let attempt = 0; placed < want && attempt < 1200; attempt += 1) {
      let dx: number;
      let dz: number;
      if (kind === "wheatrow") {
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
        y: kind === "canopy" ? TILE_TOP + 0.34 + rand() * 0.1 : TILE_TOP,
        z: tile.center[2] + dz,
        yaw: kind === "wheatrow" ? -rowYaw + (rand() - 0.5) * 0.06 : rand() * Math.PI * 2,
        scale: isPine(kind)
          ? (kind === "pineTall" ? 0.95 + rand() * 0.45 : kind === "pineRound" ? 0.9 + rand() * 0.4 : 0.85 + rand() * 0.35)
          : kind === "canopy" ? 1.15 + rand() * 0.55
          : kind === "sheep" ? 1.05 + rand() * 0.25
          : 0.95 + rand() * 0.3,
        stretch: isPine(kind)
          ? (kind === "pineTall" ? 1.05 + rand() * 0.25 : kind === "pineRound" ? 0.85 + rand() * 0.25 : 0.9 + rand() * 0.2)
          : kind === "canopy" ? 0.7 + rand() * 0.35
          : kind === "wheatrow" ? 1
          : 0.92 + rand() * 0.16,
        tone: rand(),
        hue: rand(),
      });
      placed += 1;
    }
  }
  // 接触阴影：在会投影的道具脚下各放一枚（同一次摆放，确定性）。
  if ((counts.blobshadow ?? 0) > 0) {
    const bases = out.filter((p) => isPine(p.kind) || p.kind === "sheep" || p.kind === "boulder" || p.kind === "trough");
    const want = Math.min(counts.blobshadow ?? 0, bases.length);
    for (let i = 0; i < want; i += 1) {
      const b = bases[i]!;
      out.push({
        kind: "blobshadow",
        terrain: tile.terrain,
        x: b.x,
        y: TILE_TOP + 0.004,
        z: b.z,
        yaw: b.yaw,
        scale: (isPine(b.kind) ? 1.1 : b.kind === "sheep" ? 0.85 : 1.0) * b.scale,
        stretch: 1,
        tone: 0.5,
        hue: 0.5,
      });
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

/** 树种底调：冷绿 / 暖黄绿 / 橄榄，再叠 instance 抖动。 */
const PINE_SPECIES_TONE: Record<"pineTall" | "pineRound" | "pineSmall", Color> = {
  pineTall: new Color(0.72, 0.9, 0.82),
  pineRound: new Color(1.05, 1.08, 0.78),
  pineSmall: new Color(0.88, 0.95, 0.7),
};
const PEBBLE_TINT: Record<string, Color> = { desert: new Color("#e6d2a6"), ore: new Color("#9a9ea4") };

function toneFor(p: PropPlacement, out: Color): Color {
  if (isPine(p.kind)) {
    out.copy(PINE_SPECIES_TONE[p.kind as "pineTall" | "pineRound" | "pineSmall"]);
    const k = 0.88 + p.tone * 0.28;
    out.multiplyScalar(k);
  } else if (p.kind === "pebble") out.copy(PEBBLE_TINT[p.terrain] ?? PEBBLE_TINT.desert!);
  else {
    const k = 0.92 + p.tone * 0.16;
    out.setRGB(k, k, k);
  }
  // 每实例色相 / 明度抖动（松树种间抖动更大）。
  const j = p.hue - 0.5;
  const amp = isPine(p.kind) ? 0.14 : 0.06;
  out.r = Math.max(0, out.r * (1 + j * amp));
  out.g = Math.max(0, out.g * (1 - Math.abs(j) * amp * 0.5));
  out.b = Math.max(0, out.b * (1 - j * amp));
  return out;
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
  const material = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 });
  const smoothMaterial = new MeshStandardMaterial({ vertexColors: true, flatShading: false, roughness: 0.96, metalness: 0 });
  const canopyMaterial = new MeshStandardMaterial({
    vertexColors: true, flatShading: false, roughness: 1, metalness: 0,
    transparent: true, opacity: 0.55,
  });
  canopyMaterial.depthWrite = false;
  const shadowMaterial = new MeshStandardMaterial({
    color: "#1a1814", flatShading: true, roughness: 1, metalness: 0,
    transparent: true, opacity: 0.28,
  });
  shadowMaterial.depthWrite = false;
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
        const mat = kind === "canopy" ? canopyMaterial : kind === "blobshadow" ? shadowMaterial : SMOOTH[kind] ? smoothMaterial : material;
        const mesh = new InstancedMesh(geom, mat, list.length);
        mesh.name = `prop:${kind}`;
        mesh.castShadow = castShadow && CASTS[kind];
        mesh.receiveShadow = true;
        list.forEach((p, i) => {
          quat.setFromAxisAngle(up, p.yaw);
          matrix.compose(pos.set(p.x, p.y, p.z), quat, scl.set(p.scale, p.scale * p.stretch, p.scale));
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
      smoothMaterial.dispose();
      canopyMaterial.dispose();
      shadowMaterial.dispose();
      key = "";
    },
  };
}
