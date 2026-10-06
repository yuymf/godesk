/**
 * G3D-ART-2 · 点数筹码数字贴花（numeral decals）。
 *
 * 之前筹码只是一个没有数字的圆柱（6/8 只靠整块红色区分），从默认机位读不出点数。
 * 这里把所有筹码的数字合成一个网格（每个筹码一个朝上的四边形，UV 指向数字图集里的格子），
 * 整层只占 1 个 draw call，不进 #138 的 InstancedMesh 池，也不改筹码本身的几何 / 材质。
 *
 * 图集：4×4 格 Canvas（2–12 共 11 格），每格 = 数字 + 概率点；6 / 8 用赤陶色，其余用墨色。
 */
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Mesh,
  MeshStandardMaterial,
  SRGBColorSpace,
  Vector3,
  type Camera,
  type Texture,
} from "three";
import type { SceneNode } from "./scene-model";

/** 筹码圆柱：半径 0.22、高 0.06，节点 position 为圆柱中心。 */
export const NUMBER_TOKEN_RADIUS = 0.22;
export const NUMBER_TOKEN_HALF_HEIGHT = 0.03;
/** 贴花离筹码顶面的高度（避免 z-fighting；配合 polygonOffset）。 */
export const LABEL_LIFT = 0.004;
/** 贴花边长 = 筹码半径 × 1.6 × 节点缩放：略小于筹码直径，留出 N1 筹码面的赤陶边。 */
export const LABEL_SIZE_PER_RADIUS = 1.6;
export { NUMBER_TOKEN_SCALE } from "./tokens";

export const LABEL_INK = "#2f2a24";
/** 6 / 8 高亮：赤陶色（比风格色 #B8643C 深一档，保证在奶油色筹码面上对比度 ≥ 4.5）。 */
export const LABEL_HOT = "#a3442a";

const GRID = 4;
const NUMBERS = [2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 7] as const;

export function isHotNumber(n: number): boolean {
  return n === 6 || n === 8;
}

/** 概率点数：2/12 → 1 … 6/8 → 5。 */
export function pipCount(n: number): number {
  return 6 - Math.abs(7 - n);
}

/** 数字在图集中的格子（列、行），行 0 在图集顶部。 */
export function atlasCell(n: number): { col: number; row: number } {
  const index = NUMBERS.indexOf(n as (typeof NUMBERS)[number]);
  if (index < 0) throw new Error(`number token out of range: ${n}`);
  return { col: index % GRID, row: Math.floor(index / GRID) };
}

/** 浏览器里画数字图集；node 测试环境传入 stub。 */
export function drawNumberAtlas(size = 512): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d canvas unavailable");
  const cell = size / GRID;
  ctx.clearRect(0, 0, size, size);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const n of NUMBERS) {
    const { col, row } = atlasCell(n);
    const cx = col * cell + cell / 2;
    const cy = row * cell + cell / 2;
    const color = isHotNumber(n) ? LABEL_HOT : LABEL_INK;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = cell * 0.035;
    ctx.lineJoin = "round";
    ctx.font = `700 ${Math.round(cell * (n >= 10 ? 0.54 : 0.64))}px Georgia, "Times New Roman", serif`;
    ctx.fillText(String(n), cx, cy - cell * 0.08);
    ctx.strokeText(String(n), cx, cy - cell * 0.08);
    const pips = pipCount(n);
    const r = cell * 0.042;
    const gap = r * 2.5;
    for (let i = 0; i < pips; i += 1) {
      ctx.beginPath();
      ctx.arc(cx + (i - (pips - 1) / 2) * gap, cy + cell * 0.3, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export type NumberLabel = { id: string; number: number; hot: boolean; center: Vector3; size: number };

/** SceneModel → 每个带数字筹码的贴花中心（世界坐标，筹码顶面上方 LABEL_LIFT）。 */
export function labelsFromNodes(nodes: readonly SceneNode[]): NumberLabel[] {
  const out: NumberLabel[] = [];
  for (const node of nodes) {
    if (node.kind !== "number-token" || typeof node.number !== "number") continue;
    const [x, y, z] = node.position;
    out.push({
      id: node.id,
      number: node.number,
      hot: isHotNumber(node.number),
      center: new Vector3(x, y + NUMBER_TOKEN_HALF_HEIGHT * (node.scale?.[1] ?? 1) + LABEL_LIFT, z),
      size: NUMBER_TOKEN_RADIUS * LABEL_SIZE_PER_RADIUS * (node.scale?.[0] ?? 1),
    });
  }
  return out;
}

/** 合成所有贴花的几何：每个 4 顶点 / 2 三角形，法线 +Y，文字“上方”朝 -Z（默认机位在 +Z 侧时正读）。 */
export function buildLabelGeometry(labels: readonly NumberLabel[]): BufferGeometry {
  const pos = new Float32Array(labels.length * 12);
  const uv = new Float32Array(labels.length * 8);
  const nrm = new Float32Array(labels.length * 12);
  const idx = new Uint16Array(labels.length * 6);
  labels.forEach((label, i) => {
    const h = label.size / 2;
    const { x, y, z } = label.center;
    const { col, row } = atlasCell(label.number);
    const u0 = col / GRID;
    const u1 = (col + 1) / GRID;
    const v1 = 1 - row / GRID; // flipY：行 0 在纹理顶部
    const v0 = 1 - (row + 1) / GRID;
    // 顶点顺序：左上(-x,-z) 右上(+x,-z) 右下(+x,+z) 左下(-x,+z)
    pos.set([x - h, y, z - h, x + h, y, z - h, x + h, y, z + h, x - h, y, z + h], i * 12);
    uv.set([u0, v1, u1, v1, u1, v0, u0, v0], i * 8);
    nrm.set([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], i * 12);
    const b = i * 4;
    // 逆时针（从 +Y 看）→ 正面朝上
    idx.set([b, b + 3, b + 2, b, b + 2, b + 1], i * 6);
  });
  const geom = new BufferGeometry();
  geom.setAttribute("position", new BufferAttribute(pos, 3));
  geom.setAttribute("uv", new BufferAttribute(uv, 2));
  geom.setAttribute("normal", new BufferAttribute(nrm, 3));
  geom.setIndex(new BufferAttribute(idx, 1));
  geom.computeBoundingSphere();
  return geom;
}

export type ScreenLabel = { id: string; number: number; hot: boolean; box: [number, number, number, number]; inView: boolean; facing: boolean };

/** 贴花在屏幕上的包围盒（CSS 像素，左上原点）+ 是否在视锥内 / 是否朝向相机。e2e 用来做像素探针。 */
export function projectLabels(labels: readonly NumberLabel[], camera: Camera, width: number, height: number): ScreenLabel[] {
  const camPos = new Vector3();
  camera.getWorldPosition(camPos);
  return labels.map((label) => {
    const h = label.size / 2;
    const xs: number[] = [];
    const ys: number[] = [];
    let inView = true;
    for (const [dx, dz] of [[-h, -h], [h, -h], [h, h], [-h, h], [0, 0]] as const) {
      const p = new Vector3(label.center.x + dx, label.center.y, label.center.z + dz).project(camera);
      if (p.x < -1 || p.x > 1 || p.y < -1 || p.y > 1 || p.z < -1 || p.z > 1) inView = false;
      xs.push(((p.x + 1) / 2) * width);
      ys.push(((1 - p.y) / 2) * height);
    }
    const facing = camPos.y - label.center.y > 0; // 法线 +Y
    return {
      id: label.id,
      number: label.number,
      hot: label.hot,
      box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
      inView,
      facing,
    };
  });
}

export type NumberLabelLayer = {
  mesh: Mesh;
  /** 当前贴花（与最近一次 sync 的 SceneModel 一致）。 */
  labels(): readonly NumberLabel[];
  sync(nodes: readonly SceneNode[]): void;
  dispose(): void;
};

export function createNumberLabelLayer(options: { atlas?: () => Texture } = {}): NumberLabelLayer {
  const texture = (options.atlas ?? drawNumberAtlas)();
  const material = new MeshStandardMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.35,
    depthWrite: false,
    roughness: 0.85,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  material.userData.gdShared = true;
  const mesh = new Mesh(new BufferGeometry(), material);
  mesh.name = "number-labels";
  mesh.renderOrder = 2;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.userData.kind = "number-labels";
  let current: NumberLabel[] = [];
  let key = "";
  return {
    mesh,
    labels: () => current,
    sync(nodes) {
      const next = labelsFromNodes(nodes);
      const nextKey = next.map((l) => `${l.id}:${l.number}:${l.center.toArray().join(",")}`).join("|");
      if (nextKey === key) return;
      key = nextKey;
      current = next;
      mesh.geometry.dispose();
      mesh.geometry = buildLabelGeometry(next);
      mesh.visible = next.length > 0;
    },
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
      texture.dispose();
      mesh.removeFromParent();
    },
  };
}
