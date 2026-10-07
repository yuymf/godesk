/**
 * G3D-ISLAND：岛屿高台 / 岩壁 / 岸石 / 木码头 + 港口牌 / 帆船（自制程序化几何与 canvas 贴图，
 * LicenseRef-GoDesk-Original）。取代 #138 的灰色平石板（cliff 节点）、灰盒港口（port）与船（ship）。
 *
 * draw call（不含阴影 pass）：岩壁 1 + 岸石 1 + 码头 1 + 港口牌 1 + 帆船 1 = 5，与档位无关
 * （low 档岸石减半、帆船保留但不投影）。
 */
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DynamicDrawUsage,
  Group,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Mesh,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  RepeatWrapping,
  SRGBColorSpace,
  BoxGeometry,
  Vector3,
  type Camera,
  type Texture,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { SceneVec3 } from "./scene-model";
import type { RenderTierId } from "./tiers";

/** 布局里六角外接半径（mapper HEX_PIXEL_SIZE 100 × WORLD_SCALE 0.01）。 */
export const HEX_LAYOUT_RADIUS = 1.0;
export const TILE_TOP_Y = 0.28;
export const WATER_Y = -0.08;
/** 岩壁顶面低于地块顶 4cm：地块间的缝里露出岩石，外圈形成岛的岩壁。 */
export const SKIRT_TOP_Y = 0.24;
/** R12：更深岸崖，穿过水面，嵌进桌面读感（非托盘窗框）。 */
export const SKIRT_BOTTOM_Y = -0.84;

export type IslandTile = { q: number; r: number; terrain: string; center: SceneVec3 };
export type IslandPort = { kind: string; vertices: SceneVec3[] };
export type Dock = { kind: string; base: SceneVec3; dir: [number, number]; tip: SceneVec3 };

// ── 工具 ───────────────────────────────────────────────────────────────────

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

function paint(geom: BufferGeometry, hex: string, jitter = 0): BufferGeometry {
  const g = geom.index ? geom.toNonIndexed() : geom;
  const n = g.getAttribute("position").count;
  const colors = new Float32Array(n * 3);
  const c = new Color(hex);
  for (let i = 0; i < n; i += 3) {
    const k = 1 + (jitter ? (((i * 7919) % 97) / 97 - 0.5) * jitter : 0);
    for (let v = 0; v < 3 && i + v < n; v += 1) {
      colors[(i + v) * 3] = Math.min(1, c.r * k);
      colors[(i + v) * 3 + 1] = Math.min(1, c.g * k);
      colors[(i + v) * 3 + 2] = Math.min(1, c.b * k);
    }
  }
  g.setAttribute("color", new BufferAttribute(colors, 3));
  if (g.getAttribute("uv")) g.deleteAttribute("uv");
  g.computeVertexNormals();
  return g;
}

function place(geom: BufferGeometry, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, rotY = 0, rotX = 0): BufferGeometry {
  const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), rotY);
  if (rotX) q.multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), rotX));
  geom.applyMatrix4(new Matrix4().compose(new Vector3(x, y, z), q, new Vector3(sx, sy, sz)));
  return geom;
}

function merged(parts: BufferGeometry[]): BufferGeometry {
  const out = mergeGeometries(parts, false);
  if (!out) throw new Error("island: merge failed");
  for (const p of parts) p.dispose();
  out.computeBoundingSphere();
  return out;
}

const key = (q: number, r: number) => `${q},${r}`;
const AXIAL_DIRS: ReadonlyArray<[number, number]> = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

/** 外圈格子：六个邻居不全在棋盘上。 */
export function outerTiles(tiles: readonly IslandTile[]): IslandTile[] {
  const have = new Set(tiles.map((t) => key(t.q, t.r)));
  return tiles.filter((t) => AXIAL_DIRS.some(([dq, dr]) => !have.has(key(t.q + dq, t.r + dr))));
}

/** 外圈海岸边：返回每条无邻居边的两个端点（世界坐标，布局半径）。 */
export function coastEdges(tiles: readonly IslandTile[]): Array<[SceneVec3, SceneVec3, SceneVec3]> {
  const have = new Map(tiles.map((t) => [key(t.q, t.r), t]));
  const out: Array<[SceneVec3, SceneVec3, SceneVec3]> = [];
  for (const t of tiles) {
    for (let i = 0; i < 6; i += 1) {
      const a0 = (Math.PI / 3) * i;
      const a1 = (Math.PI / 3) * (i + 1);
      const mid = (a0 + a1) / 2;
      // 该边外侧的邻居中心 = 中心 + √3·R·(cos mid, sin mid)
      const nx = t.center[0] + Math.sqrt(3) * HEX_LAYOUT_RADIUS * Math.cos(mid);
      const nz = t.center[2] + Math.sqrt(3) * HEX_LAYOUT_RADIUS * Math.sin(mid);
      const neighbour = [...have.values()].some((o) => Math.hypot(o.center[0] - nx, o.center[2] - nz) < 0.2);
      if (neighbour) continue;
      out.push([
        [t.center[0] + HEX_LAYOUT_RADIUS * Math.cos(a0), 0, t.center[2] + HEX_LAYOUT_RADIUS * Math.sin(a0)],
        [t.center[0] + HEX_LAYOUT_RADIUS * Math.cos(a1), 0, t.center[2] + HEX_LAYOUT_RADIUS * Math.sin(a1)],
        t.center,
      ]);
    }
  }
  return out;
}

/** 港口 → 码头：两个港口顶点相邻时取边中点，否则取第一个顶点；方向为离岛心向外。 */
export function docksFor(ports: readonly IslandPort[], length = 0.62): Dock[] {
  return ports.flatMap((port) => {
    const [a, b] = port.vertices;
    if (!a) return [];
    const adjacent = b && Math.hypot(a[0] - b[0], a[2] - b[2]) < HEX_LAYOUT_RADIUS * 1.15;
    const bx = adjacent ? (a[0] + b![0]) / 2 : a[0];
    const bz = adjacent ? (a[2] + b![2]) / 2 : a[2];
    const len = Math.hypot(bx, bz) || 1;
    const dir: [number, number] = [bx / len, bz / len];
    return [{
      kind: port.kind,
      base: [bx, 0.1, bz] as SceneVec3,
      dir,
      tip: [bx + dir[0] * length, 0.1, bz + dir[1] * length] as SceneVec3,
    }];
  });
}

// ── 贴图 ───────────────────────────────────────────────────────────────────

/** 程序化岩壁贴图：深灰褐底 + 水平岩层 + 裂隙 + 苔斑（u 绕一圈，v 自上而下）。 */
function rockTexture(): Texture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const x = c.getContext("2d");
  if (!x) return null;
  const rand = mulberry32(1337);
  // R12：略冷深底；底部再压暗模拟湿崖脚。
  x.fillStyle = "#4a4540";
  x.fillRect(0, 0, 512, 256);
  const wet = x.createLinearGradient(0, 160, 0, 256);
  wet.addColorStop(0, "rgba(28, 32, 36, 0)");
  wet.addColorStop(1, "rgba(18, 24, 30, 0.55)");
  x.fillStyle = wet;
  x.fillRect(0, 160, 512, 96);
  for (let i = 0; i < 26; i += 1) {
    const y = rand() * 256;
    const h = 4 + rand() * 18;
    const shade = 60 + Math.floor(rand() * 50);
    x.fillStyle = `rgba(${shade + 18},${shade + 10},${shade},${0.35 + rand() * 0.35})`;
    x.beginPath();
    x.moveTo(0, y);
    for (let u = 0; u <= 512; u += 32) x.lineTo(u, y + Math.sin(u * 0.03 + i) * 4 + (rand() - 0.5) * 5);
    x.lineTo(512, y + h);
    for (let u = 512; u >= 0; u -= 32) x.lineTo(u, y + h + Math.sin(u * 0.025 + i) * 3);
    x.closePath();
    x.fill();
  }
  for (let i = 0; i < 1800; i += 1) {
    const v = Math.floor(rand() * 80);
    x.fillStyle = `rgba(${v},${v - 4 < 0 ? 0 : v - 4},${v - 8 < 0 ? 0 : v - 8},0.35)`;
    x.fillRect(rand() * 512, rand() * 256, 1 + rand() * 3, 1 + rand() * 3);
  }
  x.strokeStyle = "rgba(25,22,20,0.55)";
  for (let i = 0; i < 40; i += 1) {
    x.lineWidth = 0.8 + rand() * 1.6;
    x.beginPath();
    let px = rand() * 512;
    let py = rand() * 256;
    x.moveTo(px, py);
    for (let k = 0; k < 5; k += 1) {
      px += (rand() - 0.5) * 30;
      py += rand() * 22;
      x.lineTo(px, py);
    }
    x.stroke();
  }
  // 顶部苔斑（接地块边缘）。
  for (let i = 0; i < 260; i += 1) {
    x.fillStyle = `rgba(${70 + rand() * 30},${95 + rand() * 30},${55 + rand() * 20},${0.35 + rand() * 0.4})`;
    x.beginPath();
    x.arc(rand() * 512, rand() * 22, 2 + rand() * 6, 0, Math.PI * 2);
    x.fill();
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.repeat.set(3, 1);
  tex.anisotropy = 4;
  return tex;
}

export const SIGN_KINDS = ["any3", "wood", "brick", "sheep", "wheat", "ore"] as const;
const SIGN_COLS = 3;
const SIGN_ROWS = 2;
const SIGN_LABEL: Record<string, { ratio: string; word: string; color: string }> = {
  any3: { ratio: "3:1", word: "任意", color: "#3d5a6c" },
  wood: { ratio: "2:1", word: "木", color: "#2f6b3a" },
  brick: { ratio: "2:1", word: "砖", color: "#a3442a" },
  sheep: { ratio: "2:1", word: "羊", color: "#6f8f3a" },
  wheat: { ratio: "2:1", word: "麦", color: "#b8862a" },
  ore: { ratio: "2:1", word: "矿", color: "#5d6470" },
};

export function signCell(kind: string): [number, number] {
  const i = Math.max(0, SIGN_KINDS.indexOf(kind as (typeof SIGN_KINDS)[number]));
  return [(i % SIGN_COLS) / SIGN_COLS, 1 - (Math.floor(i / SIGN_COLS) + 1) / SIGN_ROWS];
}

/** 港口牌图集：羊皮纸圆牌 + 木框，「2:1 / 3:1」+ 资源字。 */
function signAtlas(): Texture | null {
  if (typeof document === "undefined") return null;
  const cell = 256;
  const c = document.createElement("canvas");
  c.width = cell * SIGN_COLS;
  c.height = cell * SIGN_ROWS;
  const x = c.getContext("2d");
  if (!x) return null;
  SIGN_KINDS.forEach((kind, i) => {
    const cx = (i % SIGN_COLS) * cell + cell / 2;
    const cy = Math.floor(i / SIGN_COLS) * cell + cell / 2;
    const r = cell * 0.46;
    x.fillStyle = "#6b4a2f";
    x.beginPath();
    x.arc(cx, cy, r, 0, Math.PI * 2);
    x.fill();
    const g = x.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r * 0.86);
    g.addColorStop(0, "#fbf1d8");
    g.addColorStop(1, "#e7d3a8");
    x.fillStyle = g;
    x.beginPath();
    x.arc(cx, cy, r * 0.86, 0, Math.PI * 2);
    x.fill();
    const label = SIGN_LABEL[kind]!;
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillStyle = "#2f2a24";
    x.font = `900 ${Math.round(cell * 0.27)}px "Helvetica Neue", Helvetica, Arial, "Noto Sans", sans-serif`;
    x.fillText(label.ratio, cx, cy - cell * 0.12);
    // 第二行（资源）放大到与比例同级，远看可读。
    x.fillStyle = label.color;
    x.font = `900 ${Math.round(cell * (label.word.length > 1 ? 0.25 : 0.3))}px "PingFang SC", "Noto Sans CJK SC", "Noto Sans CJK JP", sans-serif`;
    x.fillText(label.word, cx, cy + cell * 0.16);
  });
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// ── 几何 ───────────────────────────────────────────────────────────────────

/**
 * 连续岩壁：沿外圈海岸边逐边挤出，上沿贴格子边、下沿外扩入水；位移只由世界坐标决定
 * （方向取离岛心的径向），相邻边共享的角点完全重合 → 没有接缝。另加每格一块六边形顶盖
 * （y = SKIRT_TOP_Y，半径 1.0）填满格子之间的缝。u 沿岛周角度连续，v 自上而下。
 */
export function coastWallGeometry(tiles: readonly IslandTile[]): BufferGeometry {
  const ROWS = 5;
  const SEGS = 3;
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const vert = (x: number, z: number, t: number): [number, number, number, number, number] => {
    const y = SKIRT_TOP_Y + (SKIRT_BOTTOM_Y - SKIRT_TOP_Y) * t;
    const rl = Math.hypot(x, z) || 1;
    const nx = x / rl;
    const nz = z / rl;
    const noise = t === 0 ? 0 : (Math.sin(x * 7.1 + y * 9.3) * 0.034 + Math.sin(z * 8.7 - y * 13.1) * 0.026 + Math.sin((x + z) * 15.3 + y * 21) * 0.014);
    // R12：水线外扩更大，崖脚坐进浪花带，少「竖直托盘壁」。
    const out = 0.02 + t * t * 0.22 + t * t * t * 0.08 + noise;
    const wx = x + nx * out;
    const wz = z + nz * out;
    const u = (Math.atan2(z, x) / (Math.PI * 2) + 0.5) * 26;
    return [wx, y, wz, u, t];
  };
  for (const [a, b] of coastEdges(tiles)) {
    for (let sgi = 0; sgi < SEGS; sgi += 1) {
      const s0 = sgi / SEGS;
      const s1 = (sgi + 1) / SEGS;
      const ax = a[0] + (b[0] - a[0]) * s0, az = a[2] + (b[2] - a[2]) * s0;
      const bx = a[0] + (b[0] - a[0]) * s1, bz = a[2] + (b[2] - a[2]) * s1;
      for (let k = 0; k < ROWS; k += 1) {
        const t0 = k / ROWS;
        const t1 = (k + 1) / ROWS;
        const p00 = vert(ax, az, t0), p10 = vert(bx, bz, t0), p01 = vert(ax, az, t1), p11 = vert(bx, bz, t1);
        let u0 = p00[3], u1 = p10[3];
        if (Math.abs(u1 - u0) > 13) { if (u1 < u0) u1 += 26; else u0 += 26; }
        const quad: Array<[typeof p00, number]> = [[p00, u0], [p01, u0], [p10, u1], [p10, u1], [p01, u0], [p11, u1]];
        for (const [pt, u] of quad) {
          positions.push(pt[0], pt[1], pt[2]);
          uvs.push(u, 1 - pt[4]);
          colors.push(1, 1, 1);
        }
      }
    }
  }
  // 顶盖：每格一块平顶六边形（角朝 0° / 60° …），法线朝上。
  for (const t of tiles) {
    for (let i = 0; i < 6; i += 1) {
      const a0 = (Math.PI / 3) * i;
      const a1 = (Math.PI / 3) * (i + 1);
      const c = [t.center[0], SKIRT_TOP_Y - 0.005, t.center[2]];
      const pa = [c[0]! + Math.cos(a0) * HEX_LAYOUT_RADIUS, c[1]!, c[2]! + Math.sin(a0) * HEX_LAYOUT_RADIUS];
      const pb = [c[0]! + Math.cos(a1) * HEX_LAYOUT_RADIUS, c[1]!, c[2]! + Math.sin(a1) * HEX_LAYOUT_RADIUS];
      positions.push(...c as number[], ...pb as number[], ...pa as number[]);
      uvs.push(0.5, 0.05, 0.5, 0.05, 0.5, 0.05);
      // 顶盖压暗：格子之间只露一道深色细缝（参照的地块接缝）。
      for (let k = 0; k < 3; k += 1) colors.push(0.3, 0.26, 0.22);
    }
  }
  const geom = new BufferGeometry();
  geom.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geom.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));
  geom.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
  geom.computeVertexNormals();
  geom.computeBoundingSphere();
  return geom;
}

function shoreStoneGeometry(): BufferGeometry {
  return paint(new IcosahedronGeometry(0.1, 0), "#4b4a45", 0.3);
}

/** 码头：木栈板 + 横梁 + 4 根桩 + 牌柱（沿 +Z 伸出，原点在岸边）。 */
function dockGeometry(length = 0.62): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const planks = 6;
  for (let i = 0; i < planks; i += 1) {
    const z = 0.04 + (i + 0.5) * (length / planks);
    parts.push(paint(place(new BoxGeometry(0.26, 0.025, length / planks - 0.012), 0, 0, z), i % 2 ? "#8a6340" : "#9a7048", 0.15));
  }
  parts.push(paint(place(new BoxGeometry(0.03, 0.03, length), -0.12, -0.022, length / 2 + 0.04), "#5e4128"));
  parts.push(paint(place(new BoxGeometry(0.03, 0.03, length), 0.12, -0.022, length / 2 + 0.04), "#5e4128"));
  for (const [px, pz] of [[-0.13, 0.22], [0.13, 0.22], [-0.13, length], [0.13, length]] as const) {
    parts.push(paint(place(new CylinderGeometry(0.022, 0.026, 0.34, 6), px, -0.15, pz), "#4f3824"));
  }
  // 牌柱（牌面本身是单独的广告牌 InstancedMesh）。
  parts.push(paint(place(new CylinderGeometry(0.016, 0.018, 0.36, 6), 0.1, 0.17, length - 0.02), "#4f3824"));
  return merged(parts);
}

/** 小帆船：船体 + 甲板 + 桅杆 + 三角帆 + 小旗（船头朝 +Z）。 */
function boatGeometry(): BufferGeometry {
  const hull = new CylinderGeometry(0.11, 0.06, 0.09, 8, 1, false);
  hull.scale(1, 1, 2.6);
  const sail = new BufferGeometry();
  sail.setAttribute("position", new BufferAttribute(new Float32Array([
    0, 0.08, -0.12, 0, 0.5, -0.02, 0, 0.08, 0.16,
    0, 0.08, 0.16, 0, 0.5, -0.02, 0, 0.08, -0.12,
  ]), 3));
  const jib = new BufferGeometry();
  jib.setAttribute("position", new BufferAttribute(new Float32Array([
    0, 0.1, 0.2, 0, 0.42, 0.01, 0, 0.1, 0.34,
    0, 0.1, 0.34, 0, 0.42, 0.01, 0, 0.1, 0.2,
  ]), 3));
  return merged([
    paint(place(hull, 0, 0.0, 0), "#7a4e2c", 0.12),
    paint(place(new BoxGeometry(0.16, 0.012, 0.44), 0, 0.048, 0), "#b48a5a"),
    paint(place(new CylinderGeometry(0.008, 0.01, 0.5, 5), 0, 0.29, 0.01), "#4a3420"),
    paint(sail, "#f1e8d4"),
    paint(jib, "#e6dcc4"),
    paint(place(new BoxGeometry(0.004, 0.035, 0.06), 0, 0.54, -0.02), "#a3442a"),
  ]);
}

// ── 图层 ───────────────────────────────────────────────────────────────────

/** 帆船停泊点：岛外一圈，避开右前方骰盘（≈(4.2, 3.2)）。 */
/** 港口牌半径 / 帆船缩放（round-2d2：放大，远景可读）。 */
export const SIGN_RADIUS = 0.21;
export const BOAT_SCALE = 1.7;

export const BOAT_SPOTS: ReadonlyArray<{ x: number; z: number; yaw: number; phase: number }> = [
  { x: -6.1, z: 2.4, yaw: 0.9, phase: 0 },
  { x: 6.4, z: -1.6, yaw: -2.2, phase: 1.7 },
  { x: -1.4, z: -6.3, yaw: 2.6, phase: 3.1 },
  { x: 1.6, z: 6.4, yaw: -0.6, phase: 4.4 },
];

export type IslandLayer = {
  group: Group;
  sync(tiles: readonly IslandTile[], ports: readonly IslandPort[], tier: RenderTierId, castShadow: boolean): void;
  /** 每帧：帆船起伏 + 港口牌朝向相机。frozen = 减少动态效果 / 评审截图。 */
  update(nowMs: number, camera: Camera, frozen: boolean): void;
  docks(): Dock[];
  stats(): { meshes: number; instances: Record<string, number> };
  dispose(): void;
};

export function createIslandLayer(): IslandLayer {
  const group = new Group();
  group.name = "island";
  const vertexMat = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 });
  const rockMap = rockTexture();
  const rockMat = new MeshStandardMaterial({ color: "#ffffff", map: rockMap, vertexColors: true, roughness: 0.95, metalness: 0 });
  if (!rockMap) rockMat.color.set("#5a5149");
  const signMap = signAtlas();
  const signMat = new MeshStandardMaterial({ map: signMap, transparent: true, alphaTest: 0.4, roughness: 0.8 });
  signMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec2 aCell;")
      .replace(
        "#include <uv_vertex>",
        `#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv = vMapUv * vec2(${(1 / SIGN_COLS).toFixed(6)}, ${(1 / SIGN_ROWS).toFixed(6)}) + aCell;\n#endif`,
      );
  };
  const stoneGeom = shoreStoneGeometry();
  const dockGeom = dockGeometry();
  const boatGeom = boatGeometry();
  const signGeom = new CircleGeometry(SIGN_RADIUS, 28);
  const m = new Matrix4();
  const q = new Quaternion();
  const p = new Vector3();
  const s = new Vector3();
  const up = new Vector3(0, 1, 0);
  let layoutKey = "";
  let wallGeom: BufferGeometry | null = null;
  let dockList: Dock[] = [];
  let boats: InstancedMesh | null = null;
  let signs: InstancedMesh | null = null;
  const dummy = new Object3D();

  function clear() {
    for (const child of [...group.children]) {
      group.remove(child);
      (child as InstancedMesh).dispose?.();
    }
    // 港口牌几何每次 sync 克隆（带 aCell 实例属性），这里释放。
    if (signs) signs.geometry.dispose();
    boats = null;
    signs = null;
  }

  function add(mesh: InstancedMesh, name: string, cast: boolean, receive = true) {
    mesh.name = name;
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.userData.gdShared = true;
    group.add(mesh);
  }

  return {
    group,
    sync(tiles, ports, tier, castShadow) {
      const nextKey = `${tier}|${castShadow}|${tiles.map((t) => key(t.q, t.r)).join(";")}|${ports.map((pt) => pt.kind + pt.vertices.map((v) => v.join(",")).join("/")).join(";")}`;
      if (nextKey === layoutKey) return;
      layoutKey = nextKey;
      clear();
      if (tiles.length === 0) return;
      const rand = mulberry32(4242);

      // 连续岩壁 + 顶盖（1 个 draw call，几何随地块集合重建）。
      wallGeom?.dispose();
      wallGeom = coastWallGeometry(tiles);
      const wall = new Mesh(wallGeom, rockMat);
      wall.name = "island:cliff";
      wall.castShadow = castShadow;
      wall.receiveShadow = true;
      wall.userData.gdShared = true;
      group.add(wall);

      // 岸石：每条外圈海岸边 3–5 颗圆石，落在水线。
      const edges = coastEdges(tiles);
      const perEdge = tier === "low" ? 2 : 4;
      const stones = new InstancedMesh(stoneGeom, vertexMat, Math.max(1, edges.length * perEdge));
      let n = 0;
      for (const [a, b, c] of edges) {
        for (let k = 0; k < perEdge; k += 1) {
          const t = (k + 0.25 + rand() * 0.5) / perEdge;
          const ex = a[0] + (b[0] - a[0]) * t;
          const ez = a[2] + (b[2] - a[2]) * t;
          const ox = ex - c[0];
          const oz = ez - c[2];
          const ol = Math.hypot(ox, oz) || 1;
          // R12：岸石略大、更外推入浪花带，强化物理岸崖脚。
          const out = 0.14 + rand() * 0.1;
          const size = 0.85 + rand() * 0.95;
          q.setFromAxisAngle(up, rand() * Math.PI * 2);
          m.compose(p.set(ex + (ox / ol) * out, WATER_Y + 0.015, ez + (oz / ol) * out), q, s.set(size * 1.3, size * 0.78, size));
          stones.setMatrixAt(n++, m);
        }
      }
      stones.count = n;
      add(stones, "island:shore-stones", false);

      // 码头 + 港口牌。
      dockList = docksFor(ports);
      if (dockList.length > 0) {
        const docks = new InstancedMesh(dockGeom, vertexMat, dockList.length);
        const sg = signGeom.clone();
        const cells = new Float32Array(dockList.length * 2);
        dockList.forEach((d, i) => {
          q.setFromAxisAngle(up, Math.atan2(d.dir[0], d.dir[1]));
          m.compose(p.set(d.base[0], d.base[1], d.base[2]), q, s.set(1, 1, 1));
          docks.setMatrixAt(i, m);
          const [u, v] = signCell(d.kind);
          cells[i * 2] = u;
          cells[i * 2 + 1] = v;
        });
        add(docks, "island:docks", castShadow);
        sg.setAttribute("aCell", new InstancedBufferAttribute(cells, 2));
        signs = new InstancedMesh(sg, signMat, dockList.length);
        signs.instanceMatrix.setUsage(DynamicDrawUsage);
        add(signs, "island:harbor-signs", false, false);
      }

      boats = new InstancedMesh(boatGeom, vertexMat, BOAT_SPOTS.length);
      boats.instanceMatrix.setUsage(DynamicDrawUsage);
      add(boats, "island:boats", false); // 起伏的船不进静态阴影图
      this.update(0, null as unknown as Camera, true);
    },
    update(nowMs, camera, frozen) {
      const t = frozen ? 0 : nowMs / 1000;
      if (boats) {
        BOAT_SPOTS.forEach((b, i) => {
          dummy.position.set(b.x, WATER_Y + 0.02 + Math.sin(t * 1.3 + b.phase) * 0.018, b.z);
          dummy.rotation.set(Math.sin(t * 0.9 + b.phase) * 0.05, b.yaw, Math.sin(t * 1.1 + b.phase * 1.3) * 0.06);
          dummy.scale.setScalar(BOAT_SCALE);
          dummy.updateMatrix();
          boats!.setMatrixAt(i, dummy.matrix);
        });
        boats.instanceMatrix.needsUpdate = true;
      }
      if (signs && dockList.length > 0) {
        dockList.forEach((d, i) => {
          // 牌面：立在牌柱顶上，绕 Y 朝向相机（柱面广告牌），略后仰。
          // 码头局部 +X（偏航 atan2(dx,dz) 后）= 世界 (dz, −dx)：牌柱在局部 (0.1, ·, len − 0.02)。
          const px = d.tip[0] + d.dir[1] * 0.1 - d.dir[0] * 0.02;
          const pz = d.tip[2] - d.dir[0] * 0.1 - d.dir[1] * 0.02;
          const yaw = camera ? Math.atan2(camera.position.x - px, camera.position.z - pz) : Math.atan2(d.dir[0], d.dir[1]);
          dummy.position.set(px, 0.56, pz);
          dummy.scale.setScalar(1);
          dummy.rotation.set(-0.35, yaw, 0, "YXZ");
          dummy.updateMatrix();
          signs!.setMatrixAt(i, dummy.matrix);
        });
        signs.instanceMatrix.needsUpdate = true;
      }
    },
    docks: () => dockList,
    stats() {
      const instances: Record<string, number> = {};
      for (const child of group.children) instances[child.name] = (child as InstancedMesh).count;
      return { meshes: group.children.length, instances };
    },
    dispose() {
      clear();
      for (const g of [stoneGeom, dockGeom, boatGeom, signGeom]) g.dispose();
      wallGeom?.dispose();
      wallGeom = null;
      for (const mat of [vertexMat, rockMat, signMat]) mat.dispose();
      rockMap?.dispose();
      signMap?.dispose();
      layoutKey = "";
    },
  };
}

/** SceneHost 用：把被本图层取代的 #138 节点（灰石板 / 灰盒港口 / 船 / 地块中心装饰）滤掉。 */
export { REPLACED_NODE_KINDS } from "./dressing-kinds";
