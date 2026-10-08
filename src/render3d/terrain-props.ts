/**
 * G3D-PROPS：按地形实例化的低多边形小道具（自制程序化几何，LicenseRef-GoDesk-Original）。
 *
 * round-3d：森林 = 三树种（高瘦冷杉 / 圆冠 / 矮灌）+ 树冠团；牧场羊有可读头腿；麦田有垄沟与穗高。
 * R11：再抬 high/medium 林/羊/麦密度，收紧间距，拉近左屏绘本读感。
 * R15：林/羊/麦/山/砖剪影层次 — 减玩具低模塑料，默认机位一眼可读（非仅 shader）。
 * R16：prop 溶入 hex 面色块 — 色相/明度贴 tile albedo、林冠羽化笔触片、减「浮在格子上的 3D 玩具」。
 * R17：羊→牧场色斑溶合 + hex 面油彩连片；林冠远景几何伞继续压、近景 brushCard 不回退。
 * R18：画面色块完全溶进地表 — 羊/牧场色斑压暗贴地 + 底部 alpha 溶入 hex 底色（真地表透出）；
 *      林冠由车削几何伞改为手绘团簇（jag 块面 + 逐面明度笔触），近景 brushCard 羽化保留。
 * R20：a 机位先读 hex 色面 — 林/矿 prop 降高、缩体积、减密度（稀疏贴地）；low 档（手机省电）
 *      林地仍有矮树（只建 2 个 InstancedMesh），不再读成褐色地面；羊 3–5 只一簇、簇间留空。
 * - 每种道具 **一个 InstancedMesh**（≤1 draw call / 类型，阴影 pass 另计），共享一份顶点色材质，
 *   instanceColor 做色调变化。**low 档只有林地矮树**（其余地形零道具）。
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
import { installPattern } from "./materials";
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

/** 地形 → 道具（先放大件）。Tidewell 地形键见 runtime/adapters/hex-island。 */
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
    // R20: sparse, low, ground-hugging forest / ore so the hex colour face reads first at camera a.
    // R21: low dense conifer clusters — more, smaller trees (none taller than R20), dark-green field first.
    // R22: translucent canopy cards removed (they read as a light-green haze in close view b3).
    wood: { pineTall: 22, pineRound: 10, pineSmall: 24, blobshadow: 44 },
    // R20: 8 sheep in 2 clumps (3–5 each) — see SHEEP_CLUMPS.
    sheep: { trough: 1, sheep: 8, blobshadow: 1 },
    ore: { boulder: 4, pebble: 8, blobshadow: 4 },
    brick: { clay: 8, bricks: 4 },
    // R23: continuous golden ground field — no readable wheatrow props (texture + undulating colour noise carries the wave).
    wheat: {},
    desert: { dune: 5, pebble: 9 },
  },
  medium: {
    wood: { pineTall: 14, pineRound: 7, pineSmall: 16, blobshadow: 30 },
    sheep: { trough: 1, sheep: 6, blobshadow: 1 },
    ore: { boulder: 3, pebble: 5, blobshadow: 3 },
    brick: { clay: 5, bricks: 3 },
    wheat: {},
    desert: { dune: 3, pebble: 5 },
  },
  // R20: phone power-save keeps a few short trees on forest hexes (2 instanced meshes, no shadows)
  // so wood never reads as bare brown ground; every other terrain stays prop-free.
  low: {
    wood: { pineRound: 5, pineSmall: 12 },
  },
};

/** R20 羊群：每格分几簇、每簇几只（3–5，簇间留空）；按格子种子在候选里选一种。 */
export const SHEEP_CLUMPS: Record<number, ReadonlyArray<readonly number[]>> = {
  8: [[5, 3], [4, 4], [3, 5]],
  6: [[3, 3]],
  5: [[5]],
  4: [[4]],
  3: [[3]],
};
/** 簇内羊间距 / 簇半径 / 簇心最小间距（簇间留空）。 */
// R21: clumps spread a little (0.18/0.24/0.8 → 0.2/0.27/0.86) so a 5-clump reads as 5 sheep, not one wool cloud.
export const SHEEP_CLUMP_SPACING = 0.2;
export const SHEEP_CLUMP_RADIUS = 0.27;
export const SHEEP_CLUMP_GAP = 0.86;

/** R22 麦浪：垄线正弦弯曲幅度 / 波数，垄高最小拉伸（最大 1.0）。 */
export const WHEAT_WAVE_AMP = 0.055;
export const WHEAT_WAVE_K = 4.2;
export const WHEAT_STRETCH_MIN = 0.62;

/** 道具间最小间距（相邻两件取均值）。 */
const SPACING: Record<PropKind, number> = {
  // R11: ~12% tighter pack so higher counts still land inside the hex.
  pineTall: 0.095, pineRound: 0.105, pineSmall: 0.08, canopy: 0.14, sheep: SHEEP_CLUMP_SPACING, trough: 0.2, boulder: 0.16, clay: 0.18, bricks: 0.15, sheaf: 0.105, wheatrow: 0.088, dune: 0.26, pebble: 0.065, blobshadow: 0.07,
};
const CASTS: Record<PropKind, boolean> = {
  pineTall: true, pineRound: true, pineSmall: true, canopy: false, sheep: false, trough: true, boulder: true, clay: false, bricks: true, sheaf: true, wheatrow: true, dune: false, pebble: false, blobshadow: false,
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

/** R16 笔触片：先躺平到 XZ，再微倾 + 平移，叠成羽化林冠（非光滑几何伞）。 */
function brushCard(x: number, y: number, z: number, rx: number, rz: number, yaw: number, bottom: string, top: string, tilt = 0.12): BufferGeometry {
  const disc = new CircleGeometry(1, 10);
  disc.rotateX(-Math.PI / 2);
  disc.rotateX(tilt); // slight tip toward camera/light for brush read
  const g = at(disc, x, y, z, rx, 1, rz, yaw);
  return grad(g, bottom, top, y - 0.03, y + 0.04, 0.18);
}

/** R18 手绘叶团：单位球先 jag 出不规则块面再缩放；逐面明度抖动 = 笔触 dab（非光滑几何伞）。 */
function clump(x: number, y: number, z: number, r: number, sy: number, bottom: string, top: string, seed: number, jagAmt = 0.2): BufferGeometry {
  const g = jag(new IcosahedronGeometry(1, 1), jagAmt, seed);
  at(g, x, y, z, r, r * sy, r, seed * 0.7);
  return grad(g, bottom, top, y - r * sy, y + r * sy, 0.4);
}

/** R18 径向溶边圆片：中心色 → 外缘色，外缘 alpha → 0（RGBA 顶点色；需 vertexAlphas 材质）。 */
function radialDisc(r: number, center: string, rim: string, sx: number, sz: number, y: number, alphaCenter: number): BufferGeometry {
  const g = new CircleGeometry(r, 18).toNonIndexed();
  g.rotateX(-Math.PI / 2);
  at(g, 0, y, 0, sx, 1, sz);
  const pos = g.getAttribute("position");
  const colors = new Float32Array(pos.count * 4);
  const a = new Color(center);
  const b = new Color(rim);
  const c = new Color();
  for (let i = 0; i < pos.count; i += 1) {
    const d = Math.min(1, Math.hypot(pos.getX(i) / sx, pos.getZ(i) / sz) / r);
    c.copy(a).lerp(b, d);
    colors[i * 4] = c.r;
    colors[i * 4 + 1] = c.g;
    colors[i * 4 + 2] = c.b;
    colors[i * 4 + 3] = alphaCenter * (1 - d * d);
  }
  g.setAttribute("color", new BufferAttribute(colors, 4));
  if (g.getAttribute("uv")) g.deleteAttribute("uv");
  return g;
}

/** RGB 顶点色 → RGBA（alpha = 1），使整只羊可与径向溶边片合并。 */
function rgba(g: BufferGeometry): BufferGeometry {
  const col = g.getAttribute("color");
  if (!col || col.itemSize === 4) return g;
  const out = new Float32Array(col.count * 4);
  for (let i = 0; i < col.count; i += 1) {
    out[i * 4] = col.getX(i);
    out[i * 4 + 1] = col.getY(i);
    out[i * 4 + 2] = col.getZ(i);
    out[i * 4 + 3] = 1;
  }
  g.setAttribute("color", new BufferAttribute(out, 4));
  return g;
}

/** 高瘦冷杉：尖顶长锥 + 分层叶团/枝杈侧翼，偏冷深绿，高约 0.62。 */
function pineTallGeometry(): BufferGeometry {
  // R18: tiered hand-painted clumps (no smooth lathe umbrella); dark cool base → lit top.
  const tiers: Array<[number, number]> = [[0.16, 0.1], [0.26, 0.086], [0.355, 0.07], [0.44, 0.054], [0.515, 0.038]];
  const crown: BufferGeometry[] = [];
  tiers.forEach(([y, r], ti) => {
    const a0 = ti * 1.9;
    const n = ti < 3 ? 3 : 2;
    for (let k = 0; k < n; k += 1) {
      const a = a0 + k * ((Math.PI * 2) / n);
      const dy = ((ti * 7 + k * 5) % 5 - 2) * 0.006;
      crown.push(clump(Math.cos(a) * r * 0.5, y + dy, Math.sin(a) * r * 0.5, r * 0.66, 0.72, ti % 2 ? "#183e2a" : "#1d4834", ti % 2 ? "#3f7c4c" : "#4c8a54", 11 + ti * 3 + k, 0.3));
    }
  });
  crown.push(clump(0, 0.575, 0, 0.026, 1.5, "#2a5a3a", "#4a8a56", 41, 0.12));
  return merged([
    grad(at(new CylinderGeometry(0.014, 0.022, 0.09, 5, 1, true), 0, 0.045, 0), "#3a2a1a", "#5a4028", 0, 0.09),
    ...crown,
    // R16 soft brush cards near crown — feathered silhouette vs hard umbrella
    brushCard(0.02, 0.5, 0.01, 0.07, 0.05, 0.4, "#2a5a36", "#4a8050"),
    brushCard(-0.03, 0.42, -0.02, 0.06, 0.045, -0.6, "#265232", "#46784c"),
    grad(at(new CylinderGeometry(0.008, 0.01, 0.07, 4, 1, true), 0.04, 0.28, 0, 1, 1, 1, 0.9), "#3a2a1a", "#4a3824", 0.24, 0.32),
    grad(at(new CylinderGeometry(0.007, 0.009, 0.055, 4, 1, true), -0.035, 0.4, 0.015, 1, 1, 1, -0.7), "#3a2a1a", "#4a3824", 0.37, 0.43),
  ]);
}

/** 圆冠阔叶：胖裙 + 多团叶云，偏暖黄绿，高约 0.42。 */
function pineRoundGeometry(): BufferGeometry {
  // R18: cauliflower crown of painted clumps (warm yellow-green tops, cool undersides).
  const ring: BufferGeometry[] = [];
  for (let k = 0; k < 5; k += 1) {
    const a = k * ((Math.PI * 2) / 5) + 0.3;
    const rr = 0.088 + (k % 2) * 0.012;
    ring.push(clump(Math.cos(a) * 0.09, 0.17 + (k % 3) * 0.035, Math.sin(a) * 0.09, rr, 0.8, "#24502c", k % 2 ? "#5e9a54" : "#6aa65a", 5 + k * 7));
  }
  return merged([
    grad(at(new CylinderGeometry(0.02, 0.03, 0.08, 5, 1, true), 0, 0.04, 0), "#4a3220", "#6b4a2c", 0, 0.08),
    clump(0, 0.24, 0, 0.12, 0.82, "#24542c", "#5a9650", 3),
    ...ring,
    clump(0.012, 0.335, -0.01, 0.075, 0.9, "#2c5c32", "#74ae60", 29),
    brushCard(0.04, 0.28, 0.02, 0.09, 0.07, 0.5, "#2f6b3a", "#5a9a58"),
    brushCard(-0.05, 0.22, -0.03, 0.08, 0.06, -0.8, "#2a6034", "#568a50"),
  ]);
}

/** 矮灌：短胖两层 + 侧叶团，偏橄榄绿，高约 0.3。 */
function pineSmallGeometry(): BufferGeometry {
  return merged([
    grad(at(new CylinderGeometry(0.016, 0.022, 0.05, 5, 1, true), 0, 0.025, 0), "#3e2c1c", "#5c4028", 0, 0.05),
    // R18: olive shrub = 4 painted clumps (no lathe cone)
    clump(0, 0.115, 0, 0.088, 0.78, "#284626", "#5a7c40", 13),
    clump(0.065, 0.085, 0.03, 0.06, 0.75, "#264424", "#567838", 17),
    clump(-0.055, 0.095, -0.04, 0.062, 0.75, "#2a4a28", "#5e8044", 19),
    clump(0.005, 0.19, 0.005, 0.056, 0.9, "#2c4e2a", "#668a48", 23),
    brushCard(0.01, 0.18, 0.0, 0.07, 0.055, 0.3, "#2f6b3a", "#5a8048"),
  ]);
}

/** R18 树冠云：去掉残余几何伞体量，只留嵌进树冠的碎笔触片（远景不再读成伞盖）；近景 brushCard 羽化保持（不回退 R16）。 */
function canopyGeometry(): BufferGeometry {
  return merged([
    // R18: residual umbrella volume removed — only broken feathered brush cards nested in the crowns.
    brushCard(0.06, 0.012, -0.06, 0.08, 0.06, 2.1, "#2a5c34", "#4c8c54"),
    brushCard(-0.07, 0.004, 0.05, 0.085, 0.065, -2.3, "#285a32", "#48884e"),
    brushCard(0.0, 0.01, 0.0, 0.19, 0.145, 0.15, "#2f6b3a", "#4a8a52"),
    brushCard(0.1, 0.015, 0.05, 0.125, 0.1, 0.9, "#2a6034", "#46884e"),
    brushCard(-0.09, 0.008, -0.04, 0.135, 0.1, -0.7, "#286032", "#42804a"),
    brushCard(0.04, -0.005, -0.08, 0.105, 0.085, 1.4, "#2c6436", "#4a8550"),
    brushCard(-0.05, 0.02, 0.07, 0.115, 0.09, -1.1, "#2a5e32", "#46864c"),
    brushCard(0.08, -0.01, -0.02, 0.095, 0.075, 0.35, "#315f38", "#4a7e4c"),
    brushCard(-0.02, 0.005, 0.03, 0.1, 0.08, 0.55, "#2c6436", "#468850"),
  ]);
}

/** 接触阴影：贴地半透明深色扁圆，给道具脚下一点落地感（便宜，+1 draw call）。 */
function blobShadowGeometry(): BufferGeometry {
  return grad(at(new CircleGeometry(0.1, 12), 0, 0.002, 0, 1, 1, 1).rotateX(-Math.PI / 2), "#1a1814", "#1a1814", 0, 1);
}

/** R19 羊：白色羊毛小羊群（settlecoast 基准的读感：白绒身体 + 深色头腿，低头吃草），
 *  脚下只留牧场底色的软溶片（alpha→0，无硬边圆盘、无深色接触阴影）。 */
function sheepGeometry(): BufferGeometry {
  const leg = (x: number, z: number) =>
    grad(at(new CylinderGeometry(0.0115, 0.0095, 0.07, 6, 1, true), x, 0.035, z), "#2a231e", "#3f352d", 0, 0.07);
  const puff = (x: number, y: number, z: number, r: number) =>
    grad(at(new SphereGeometry(r, 8, 6), x, y, z), "#d9d3c4", "#fffdf6", y - r, y + r, 0.06);
  const parts: BufferGeometry[] = [
    // fleece body: soft cream underside → white top (volume from colour, not a dark blotch)
    grad(at(new SphereGeometry(0.074, 12, 8), 0, 0.128, 0, 1.45, 0.92, 1.05), "#cfc8b8", "#fbf8f0", 0.06, 0.2, 0.05),
    puff(0.05, 0.168, 0.03, 0.04), puff(-0.01, 0.178, -0.028, 0.042), puff(-0.06, 0.162, 0.03, 0.038),
    puff(0.035, 0.16, -0.045, 0.036), puff(-0.055, 0.15, -0.045, 0.035), puff(0.075, 0.138, 0.0, 0.034),
    puff(-0.095, 0.14, 0.0, 0.033), puff(0.0, 0.15, 0.06, 0.036), puff(0.0, 0.112, -0.062, 0.034),
    // tail tuft
    puff(-0.115, 0.15, 0, 0.022),
    // head lowered to graze: dark face + ears + cream wool cap
    grad(at(new SphereGeometry(0.03, 9, 6), 0.128, 0.082, 0, 1.45, 0.95, 0.85), "#2c241f", "#463a31", 0.05, 0.11),
    grad(at(new SphereGeometry(0.012, 6, 4), 0.112, 0.106, 0.034, 0.7, 0.55, 1.35), "#2c241f", "#463a31", 0.09, 0.12),
    grad(at(new SphereGeometry(0.012, 6, 4), 0.112, 0.106, -0.034, 0.7, 0.55, 1.35), "#2c241f", "#463a31", 0.09, 0.12),
    puff(0.1, 0.122, 0, 0.026),
    leg(0.052, 0.034), leg(0.052, -0.034), leg(-0.052, 0.034), leg(-0.052, -0.034),
  ].map(rgba);
  // ground-colour soft dissolve under the hooves: pasture tone, alpha → 0 at rim (no hard disc)
  parts.push(radialDisc(0.13, "#6f9a44", "#7ea84e", 1.35, 1.0, 0.004, 0.42));
  return merged(parts);
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

/** R20 山地：低矮贴地的岩块群（≈R19 一半高、体量 ~0.7×），岩色贴 ore tile，根脚溶入灰石面。 */
function boulderGeometry(): BufferGeometry {
  return merged([
    paint(jag(at(new DodecahedronGeometry(0.085, 1), 0, 0.035, 0, 1.4, 0.62, 1.15), 0.14, 1), "#a7adb4", 0.26),
    paint(jag(at(new DodecahedronGeometry(0.06, 1), 0.075, 0.06, -0.035, 1.1, 0.78, 0.95, 0.5), 0.12, 3), "#6a7078", 0.24),
    paint(jag(at(new DodecahedronGeometry(0.045, 0), -0.06, 0.075, 0.04, 1.0, 0.8, 0.9, -0.4), 0.1, 5), "#848b93", 0.22),
    paint(jag(at(new DodecahedronGeometry(0.04, 0), -0.09, 0.02, 0.07, 1.2, 0.6, 1.0, 1.1), 0.1, 2), "#62676e", 0.24),
    // ground-bleed skirt
    grad(at(new CircleGeometry(0.12, 10), 0, 0.003, 0, 1.2, 1, 1.1).rotateX(-Math.PI / 2), "#9ca2a9", "#b0b6bc", 0, 0.01, 0.1),
  ]);
}

/** R15/R16 陶土丘：剪影保持；赭色贴 brick tile #b85a3a，根脚溶入陶土面。 */
function clayGeometry(): BufferGeometry {
  const mound = (r: number) => new SphereGeometry(r, 9, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  return merged([
    paint(jag(at(mound(0.13), 0, 0, 0, 1.15, 0.85, 1.1), 0.1, 4), "#a85234", 0.22),
    paint(jag(at(mound(0.09), 0.08, 0.02, 0.06, 1.05, 0.9, 1), 0.09, 5), "#b85a3a", 0.2),
    paint(jag(at(mound(0.065), -0.07, 0.04, -0.05, 1, 0.95, 1.05), 0.08, 6), "#c46a48", 0.18),
    paint(jag(at(mound(0.045), 0.02, 0.09, 0.02, 1, 0.7, 1), 0.06, 8), "#d08058", 0.16),
    grad(at(new CircleGeometry(0.15, 10), 0, 0.003, 0, 1.15, 1, 1.1).rotateX(-Math.PI / 2), "#a85032", "#b85a3a", 0, 0.01, 0.1),
  ]);
}

/** R15/R16 砖垛：剪影保持；砖色贴 brick tile #b85a3a，软化高对比玩具方块感。 */
function bricksGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const b = (x: number, y: number, z: number, rot: number, shade: string, sx = 1, sy = 1, sz = 1) =>
    parts.push(paint(at(new BoxGeometry(0.065, 0.028, 0.032), x, y, z, sx, sy, sz, rot), shade, 0.14));
  b(-0.05, 0.014, -0.025, 0.05, "#a04a30"); b(0.02, 0.014, -0.028, -0.08, "#b85a3a");
  b(-0.045, 0.014, 0.022, 0.1, "#c06442"); b(0.03, 0.014, 0.02, -0.05, "#b05638");
  b(-0.025, 0.042, -0.01, Math.PI / 2 + 0.1, "#c46a48"); b(0.035, 0.042, 0.01, Math.PI / 2 - 0.05, "#b85a3a");
  b(-0.01, 0.042, 0.03, 0.2, "#bc6040", 0.9, 1, 0.95);
  b(0.0, 0.07, 0.0, 0.15, "#c87050"); b(-0.035, 0.07, -0.015, Math.PI / 2, "#a85032", 0.85, 1, 0.9);
  parts.push(grad(at(new CircleGeometry(0.1, 10), 0, 0.003, 0, 1.1, 1, 1).rotateX(-Math.PI / 2), "#a85032", "#b85a3a", 0, 0.01, 0.1));
  return merged(parts);
}

/** 麦束：车削束腰 + 捆绳，高约 0.2。 */
function sheafGeometry(): BufferGeometry {
  const profile = [[0, 0], [0.045, 0], [0.038, 0.04], [0.027, 0.085], [0.031, 0.11], [0.055, 0.165], [0.045, 0.2], [0, 0.21]]
    .map(([x, y]) => new Vector2(x!, y!));
  return merged([
    paint(new LatheGeometry(profile, 8), "#e2c448", 0.28),
    paint(at(new CylinderGeometry(0.031, 0.031, 0.016, 8), 0, 0.095, 0), "#8a6a32"),
  ]);
}

/** R15/R16 麦垄：剪影保持；穗色贴 wheat tile #d4b84a，垄底溶入金麦面。 */
function wheatRowGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [
    // base band closer to tile albedo (less dark toy soil strip)
    // R22: bright golden (was #c0a440 / #d8bc50 ochre that read orange-brown under the warm key light)
    grad(at(new BoxGeometry(0.32, 0.024, 0.12), 0, 0.012, 0), "#d2b83c", "#e8cc4e", 0, 0.024),
    grad(at(new BoxGeometry(0.3, 0.012, 0.03), 0, 0.01, 0), "#b89e30", "#ccb23a", 0, 0.012),
    grad(at(new CircleGeometry(0.16, 10), 0, 0.003, 0, 1.15, 1, 0.85).rotateX(-Math.PI / 2), "#d6bc40", "#e6ca4c", 0, 0.01, 0.08),
  ];
  const sides = [-0.04, 0, 0.04] as const;
  for (let i = 0; i < 9; i += 1) {
    const x = -0.14 + i * 0.035;
    // R22: each row bends gently (z sway along the row) so a field of rows reads as a wave, not ruled lines.
    const sway = 0.014 * Math.sin(i * 0.8 + 0.6);
    for (let si = 0; si < sides.length; si += 1) {
      const z = sides[si]! + sway;
      // R21: low stubble (0.055–0.103, was 0.12–0.208) — rows sit in the golden field, not a hedge.
      const stalkH = 0.055 + ((i * 17 + si * 7 + 3) % 5) * 0.012;
      const b = 0.024;
      parts.push(grad(
        at(new CylinderGeometry(0.006, 0.009, stalkH, 4, 1, true), x, b + stalkH / 2, z),
        "#bc9020", "#d8b030", b, b + stalkH,
      ));
      const headR = 0.016 + ((i * 11 + si) % 3) * 0.004;
      parts.push(grad(
        at(new SphereGeometry(headR, 5, 4), x, b + stalkH + headR * 0.7, z, 0.75, 1.3, 0.75),
        "#dcac28", "#ecc23c", b + stalkH - 0.016, b + stalkH + headR * 1.1,
      ));
    }
  }
  return merged(parts);
}

/** 沙丘：拉长的半球，比沙地略深。 */
function duneGeometry(): BufferGeometry {
  // R22: paler sand dune (was #d2b47e, read as brown blobs on the paler desert).
  return paint(jag(at(new SphereGeometry(0.12, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0, 0, 1.7, 0.42, 1), 0.05, 6), "#e2cfa2", 0.12);
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
  const clusterCentres: Array<[number, number]> = [];
  for (const kind of kinds) {
    const want = counts[kind] ?? 0;
    if (want <= 0) continue;
    const s = SPACING[kind];
    let candidates: Array<[number, number]> = [];
    let rowYaw = 0;
    const wheatWave = new Map<string, { theta: number; h: number }>();
    if (kind === "wheatrow") {
      // R11 麦垄：更密候选网格，整片随格子转 0° / 60° / 120°；两端都要在可摆放区内。
      rowYaw = Math.floor(rand() * 3) * (Math.PI / 3);
      const cr = Math.cos(rowYaw);
      const sr = Math.sin(rowYaw);
      const rot = (lx: number, lz: number): [number, number] => [lx * cr - lz * sr, lx * sr + lz * cr];
      // R22 麦浪：每条垄沿一条正弦波弯曲（走向起伏），垄高按另一条斜向波起伏（高低），浪峰略亮。
      const wavePhase = rand() * Math.PI * 2;
      const heightPhase = rand() * Math.PI * 2;
      for (let row = -9; row <= 9; row += 1) {
        for (let col = -5; col <= 5; col += 1) {
          const lx0 = col * 0.22 + (row % 2 ? 0.11 : 0);
          const lz0 = row * 0.085;
          const lz = lz0 + WHEAT_WAVE_AMP * Math.sin(lx0 * WHEAT_WAVE_K + wavePhase + row * 0.35);
          const theta = Math.atan(WHEAT_WAVE_AMP * WHEAT_WAVE_K * Math.cos(lx0 * WHEAT_WAVE_K + wavePhase + row * 0.35));
          const c = rot(lx0, lz);
          const ex = Math.cos(theta) * 0.1;
          const ez = Math.sin(theta) * 0.1;
          const e1 = rot(lx0 - ex, lz - ez);
          const e2 = rot(lx0 + ex, lz + ez);
          if (!(inPropRegion(...c) && inPropRegion(...e1) && inPropRegion(...e2))) continue;
          candidates.push(c);
          const h = 0.5 + 0.5 * Math.sin(lx0 * 2.4 + lz0 * 6.2 + heightPhase);
          wheatWave.set(`${c[0]},${c[1]}`, { theta, h });
        }
      }
      for (let i = candidates.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rand() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j]!, candidates[i]!];
      }
    }
    if (kind === "sheep") {
      placeSheepClumps(tile, want, rand, taken, free, out);
      continue;
    }
    // R21: wood trees grow in a few dense conifer clusters (70% of candidates near a cluster centre).
    if (tile.terrain === "wood" && clusterCentres.length === 0) {
      for (let k = 0; k < 400 && clusterCentres.length < 5; k += 1) {
        const cx = (rand() * 2 - 1) * 0.62;
        const cz = (rand() * 2 - 1) * 0.62;
        if (inPropRegion(cx, cz) && clusterCentres.every(([x, z]) => Math.hypot(x - cx, z - cz) > 0.42)) clusterCentres.push([cx, cz]);
      }
    }
    let placed = 0;
    for (let attempt = 0; placed < want && attempt < 1600; attempt += 1) {
      let dx: number;
      let dz: number;
      if (kind === "wheatrow") {
        const c = candidates[attempt];
        if (!c) break;
        [dx, dz] = c;
      } else if (isPine(kind) && clusterCentres.length > 0 && rand() < 0.7) {
        const [cx, cz] = clusterCentres[Math.floor(rand() * clusterCentres.length)]!;
        const a = rand() * Math.PI * 2;
        const r = Math.sqrt(rand()) * 0.3;
        dx = cx + Math.cos(a) * r;
        dz = cz + Math.sin(a) * r;
      } else {
        dx = (rand() * 2 - 1) * 0.8;
        dz = (rand() * 2 - 1) * 0.8;
      }
      if (!inPropRegion(dx, dz) || !free(dx, dz, s)) continue;
      taken.push({ x: dx, z: dz, s });
      const wave = kind === "wheatrow" ? wheatWave.get(`${dx},${dz}`) : undefined;
      if (wave) {
        // R22 麦浪：走向跟随波的切线，垄高 / 明度跟随高低波；scale ≤ 1.0、stretch ≤ 1.0 → 仍是矮麦（<0.18）。
        out.push({
          kind,
          terrain: tile.terrain,
          x: tile.center[0] + dx,
          y: TILE_TOP - 0.012,
          z: tile.center[2] + dz,
          yaw: -(rowYaw + wave.theta) + (rand() - 0.5) * 0.08,
          scale: 0.9 + rand() * 0.1,
          stretch: WHEAT_STRETCH_MIN + (1 - WHEAT_STRETCH_MIN) * wave.h,
          tone: 0.2 + 0.8 * wave.h,
          hue: rand(),
        });
        placed += 1;
        continue;
      }
      out.push({
        kind,
        terrain: tile.terrain,
        x: tile.center[0] + dx,
        // R16: slight sink into hex face so props read rooted / painted-in (not floating toys).
        y: kind === "canopy" ? TILE_TOP + 0.11 + rand() * 0.04
          : isPine(kind) || kind === "boulder" || kind === "clay" || kind === "bricks" || kind === "wheatrow" || kind === "sheaf"
            ? TILE_TOP - 0.012
            : TILE_TOP,
        z: tile.center[2] + dz,
        yaw: kind === "wheatrow" ? -rowYaw + (rand() - 0.5) * 0.06 : rand() * Math.PI * 2,
        // R20: smaller / lower trees + boulders (ground-hugging, hex face reads first).
        scale: isPine(kind)
          ? (kind === "pineTall" ? 0.52 + rand() * 0.18 : kind === "pineRound" ? 0.54 + rand() * 0.16 : 0.58 + rand() * 0.2)
          : kind === "canopy" ? 0.62 + rand() * 0.18
          : kind === "boulder" ? 0.8 + rand() * 0.25
          : kind === "clay" || kind === "bricks" ? 1.0 + rand() * 0.28
          : 0.95 + rand() * 0.3,
        stretch: isPine(kind)
          ? (kind === "pineTall" ? 0.82 + rand() * 0.14 : kind === "pineRound" ? 0.78 + rand() * 0.14 : 0.8 + rand() * 0.14)
          : kind === "canopy" ? 0.6 + rand() * 0.2
          : kind === "wheatrow" ? 0.92 + rand() * 0.1
          : kind === "boulder" ? 0.85 + rand() * 0.2
          : kind === "clay" ? 1.05 + rand() * 0.2
          : 0.92 + rand() * 0.16,
        tone: rand(),
        hue: rand(),
      });
      placed += 1;
    }
  }
  // 接触阴影：在会投影的道具脚下各放一枚（同一次摆放，确定性）。
  if ((counts.blobshadow ?? 0) > 0) {
    // R18: no dark contact disc under sheep (it outlined them as props stuck on the ground).
    const bases = out.filter((p) => isPine(p.kind) || p.kind === "boulder" || p.kind === "trough");
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

/**
 * R20 羊群成簇：先选簇心（彼此 ≥ SHEEP_CLUMP_GAP，簇间留空），每簇 3–5 只挤在 SHEEP_CLUMP_RADIUS 内，
 * 同簇朝向相近（一起低头吃草）。确定性；放不下时退回整格拒绝采样，保证数量不变。
 */
function placeSheepClumps(
  tile: PropTile,
  want: number,
  rand: () => number,
  taken: Array<{ x: number; z: number; s: number }>,
  free: (x: number, z: number, s: number) => boolean,
  out: PropPlacement[],
): void {
  const options = SHEEP_CLUMPS[want] ?? [[want]];
  const sizes = options[Math.floor(rand() * options.length)]!;
  const s = SHEEP_CLUMP_SPACING;
  const centers: Array<[number, number]> = [];
  const push = (dx: number, dz: number, yaw: number) => {
    taken.push({ x: dx, z: dz, s });
    out.push({
      kind: "sheep", terrain: tile.terrain, x: tile.center[0] + dx, y: TILE_TOP, z: tile.center[2] + dz,
      yaw, scale: 0.94 + rand() * 0.14, stretch: 0.92 + rand() * 0.16, tone: rand(), hue: rand(),
    });
  };
  let placed = 0;
  for (const size of sizes) {
    // try several clump centres; a clump that cannot reach its size is rolled back (no stragglers)
    for (let tryCenter = 0; tryCenter < 12; tryCenter += 1) {
      let center: [number, number] | null = null;
      for (let attempt = 0; attempt < 400 && !center; attempt += 1) {
        const cx = (rand() * 2 - 1) * 0.62;
        const cz = (rand() * 2 - 1) * 0.62;
        if (!inPropRegion(cx, cz) || hexMetric(cx, cz) > PROP_HEX_INSET - 0.12) continue;
        if (centers.some(([x, z]) => Math.hypot(x - cx, z - cz) < SHEEP_CLUMP_GAP)) continue;
        if (!free(cx, cz, s)) continue;
        center = [cx, cz];
      }
      if (!center) break;
      const takenMark = taken.length;
      const outMark = out.length;
      const herdYaw = rand() * Math.PI * 2;
      const members: Array<[number, number]> = [];
      for (let attempt = 0; members.length < size && attempt < 800; attempt += 1) {
        // grow the clump: each new sheep sits next to an existing member (s … 1.3 s away), inside the clump radius
        const [mx, mz] = members.length ? members[Math.floor(rand() * members.length)]! : center;
        const a = rand() * Math.PI * 2;
        const r = members.length ? s * (1 + rand() * 0.3) : 0;
        const dx = mx + Math.cos(a) * r;
        const dz = mz + Math.sin(a) * r;
        if (Math.hypot(dx - center[0], dz - center[1]) > SHEEP_CLUMP_RADIUS) continue;
        if (!inPropRegion(dx, dz) || !free(dx, dz, s)) continue;
        members.push([dx, dz]);
        push(dx, dz, herdYaw + (rand() - 0.5) * 1.1);
      }
      if (members.length === size) {
        centers.push(center);
        placed += size;
        break;
      }
      taken.length = takenMark;
      out.length = outMark;
    }
  }
  // fallback: keep the count even on cramped hexes
  for (let attempt = 0; placed < want && attempt < 1200; attempt += 1) {
    const dx = (rand() * 2 - 1) * 0.8;
    const dz = (rand() * 2 - 1) * 0.8;
    if (!inPropRegion(dx, dz) || !free(dx, dz, s)) continue;
    push(dx, dz, rand() * Math.PI * 2);
    placed += 1;
  }
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

/** 树种底调：贴近 wood tile；再叠 instance 抖动。 */
const PINE_SPECIES_TONE: Record<"pineTall" | "pineRound" | "pineSmall", Color> = {
  // R21: ~35% darker / cooler so the dense low stand reads as a dark-green field at camera a.
  pineTall: new Color(0.5, 0.64, 0.53),
  pineRound: new Color(0.58, 0.68, 0.53),
  pineSmall: new Color(0.54, 0.65, 0.5),
};
const PEBBLE_TINT: Record<string, Color> = { desert: new Color("#e6d2a6"), ore: new Color("#d8dee4") };
/** R17: instance multiply biased toward TERRAIN_MATERIALS.base — sheep/meadow continuous dissolve. */
const TERRAIN_ALBEDO: Record<string, Color> = {
  wood: new Color("#2f6b3a"),
  sheep: new Color("#8fbf6a"),
  ore: new Color("#c2ced6"),
  brick: new Color("#b85a3a"),
  wheat: new Color("#e4c440"),
  desert: new Color("#ddd2b2"),
};

function toneFor(p: PropPlacement, out: Color): Color {
  if (isPine(p.kind) || p.kind === "canopy") {
    out.copy(PINE_SPECIES_TONE[(p.kind === "canopy" ? "pineRound" : p.kind) as "pineTall" | "pineRound" | "pineSmall"]);
    const k = 0.9 + p.tone * 0.2;
    out.multiplyScalar(k);
  } else if (p.kind === "pebble") out.copy(PEBBLE_TINT[p.terrain] ?? PEBBLE_TINT.desert!);
  else if (p.kind === "wheatrow") {
    // R22 麦浪：tone 跟随高低波（浪峰亮、浪谷略深的琥珀金），远景读成起伏的麦浪而非一排排。
    const k = 0.8 + p.tone * 0.3;
    out.setRGB(k, k * 0.95, k * 0.76);
  }
  else {
    const k = 0.94 + p.tone * 0.12;
    out.setRGB(k, k, k);
  }
  // Pull toward tile albedo (painterly dissolve, not grey plastic multiply).
  const albedo = TERRAIN_ALBEDO[p.terrain];
  // R19: sheep stay white (no meadow blend) — the flock must read as sheep, not shrubs.
  if (albedo && p.kind !== "blobshadow" && p.kind !== "trough" && p.kind !== "sheep") {
    // R17: sheep strongly → meadow tile; pines/canopy keep dissolve; hex-face continuous with props
    // R21: pines 0.34 → 0.42 toward the dark wood albedo (dark-green field at camera a)
    const blend = isPine(p.kind) || p.kind === "canopy" ? 0.42
      : p.kind === "wheatrow" || p.kind === "sheaf" ? 0.32
      : p.kind === "boulder" || p.kind === "clay" || p.kind === "bricks" ? 0.36
      : 0.16;
    out.r = out.r * (1 - blend) + albedo.r * blend;
    out.g = out.g * (1 - blend) + albedo.g * blend;
    out.b = out.b * (1 - blend) + albedo.b * blend;
  }
  const j = p.hue - 0.5;
  const amp = isPine(p.kind) ? 0.1 : p.kind === "sheep" ? 0.02 : 0.05;
  out.r = Math.max(0, out.r * (1 + j * amp));
  out.g = Math.max(0, out.g * (1 - Math.abs(j) * amp * 0.5));
  out.b = Math.max(0, out.b * (1 - j * amp));
  return out;
}

// ── 场景图层 ───────────────────────────────────────────────────────────────

/** R19 羊溶地：明亮牧场贴地色（≈ 渲染后 meadow hex 底色）。 */
export const SHEEP_GROUND_TINT = "#7aa24c";
/** R19 羊溶地带：只在蹄部 / 溶片（TILE_TOP+0.002 … +0.03）向地色过渡；羊毛本体保持白。 */
export const SHEEP_DISSOLVE_BAND: readonly [number, number] = [TILE_TOP + 0.002, TILE_TOP + 0.03];

/**
 * R19 羊专用材质：羊毛只叠很轻的世界坐标 grass pattern（白羊可读），蹄部溶带向牧场底色过渡、
 * 溶片 pattern 与 hex 面同强（与地面笔触场连续）。vertexAlphas（RGBA 顶点色）给溶片 alpha→0。
 */
export function createSheepDissolveMaterial(): MeshStandardMaterial {
  const m = new MeshStandardMaterial({
    vertexColors: true, flatShading: false, roughness: 1, metalness: 0, envMapIntensity: 0, transparent: true,
  });
  m.polygonOffset = true;
  m.polygonOffsetFactor = -1;
  m.polygonOffsetUnits = -2;
  const pattern = installPattern(m, "grass");
  pattern.value = 0.8;
  const base = m.onBeforeCompile;
  const ground = { value: new Color(SHEEP_GROUND_TINT) };
  const [y0, y1] = SHEEP_DISSOLVE_BAND;
  m.onBeforeCompile = (shader, renderer) => {
    base.call(m, shader, renderer);
    shader.uniforms.uGdGround = ground;
    shader.fragmentShader = shader.fragmentShader
      .replace("uniform float uGdPattern;", "uniform float uGdPattern;\nuniform vec3 uGdGround;")
      .replace(
        "diffuseColor.rgb *= mix(1.0, 0.52 + 0.96 * gdP, uGdPattern);",
        [
          `float gdLow = 1.0 - smoothstep(${y0.toFixed(4)}, ${y1.toFixed(4)}, vGdWorld.y);`,
          // fleece: faint paint texture only; hoof band / ground disc: full hex-face pattern
          "diffuseColor.rgb *= mix(1.0, 0.52 + 0.96 * gdP, uGdPattern * mix(0.2, 1.0, gdLow));",
          "diffuseColor.rgb = mix(diffuseColor.rgb, uGdGround * (0.52 + 0.96 * gdP), gdLow * 0.85);",
          "diffuseColor.a *= 1.0 - gdLow * 0.35;",
        ].join("\n"),
      );
  };
  m.customProgramCacheKey = () => "gd-sheep-dissolve-r19";
  m.userData.gdSheepGround = ground;
  return m;
}

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
  // R16: fully matte + canopy feather — dissolve into hex brush, kill plastic toy specular.
  const material = new MeshStandardMaterial({
    vertexColors: true, flatShading: true, roughness: 1, metalness: 0, envMapIntensity: 0,
  });
  const smoothMaterial = new MeshStandardMaterial({
    vertexColors: true, flatShading: false, roughness: 1, metalness: 0, envMapIntensity: 0,
  });
  const canopyMaterial = new MeshStandardMaterial({
    vertexColors: true, flatShading: false, roughness: 1, metalness: 0, envMapIntensity: 0,
    transparent: true, opacity: 0.4,
  });
  canopyMaterial.depthWrite = false;
  const sheepMaterial = createSheepDissolveMaterial();
  const shadowMaterial = new MeshStandardMaterial({
    color: "#1a1814", flatShading: true, roughness: 1, metalness: 0, envMapIntensity: 0,
    transparent: true, opacity: 0.22,
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
        const mat = kind === "canopy" ? canopyMaterial : kind === "sheep" ? sheepMaterial : kind === "blobshadow" ? shadowMaterial : SMOOTH[kind] ? smoothMaterial : material;
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
      sheepMaterial.dispose();
      shadowMaterial.dispose();
      key = "";
    },
  };
}
