/**
 * step3 · 通用桌面的正交机位（汐屿同款取景，任何空间 Kernel 可用）。
 *
 * 汐屿 / settlecoast 的观感来自：OrthographicCamera、φ≈54° 斜视、方位 ≈12°、
 * 内容占 HUD 内可用区域的 fill≈0.945。这里把同样的取景做成纯函数：
 * 输入要入镜的点（底板八角），输出相机位置 / 目标 / 正交视锥。
 */
import type { SceneVec3 } from "./scene-model";

export type HudInsetsPx = { top: number; bottom: number; left: number; right: number };

export type TabletopOrthoInput = {
  points: readonly SceneVec3[];
  polarDeg: number;
  azimuthDeg: number;
  canvasWidth: number;
  canvasHeight: number;
  insets: HudInsetsPx;
  fill: number;
  /** 轨道半径（正交下只影响裁剪面，不影响大小）。 */
  distance?: number;
  /** 近景：在 `focus` 周围按 zoom 放大（1 = 整盘）。 */
  zoom?: number;
  focus?: SceneVec3;
};

export type TabletopOrthoFrame = {
  position: SceneVec3;
  target: SceneVec3;
  left: number;
  right: number;
  top: number;
  bottom: number;
  /** 世界单位 / 像素（zoom=1 时）。 */
  worldPerPx: number;
};

const DEG = Math.PI / 180;

export function orthoBasis(polarDeg: number, azimuthDeg: number) {
  const p = polarDeg * DEG;
  const a = azimuthDeg * DEG;
  const d: SceneVec3 = [Math.sin(p) * Math.sin(a), Math.cos(p), Math.sin(p) * Math.cos(a)];
  const r: SceneVec3 = [Math.cos(a), 0, -Math.sin(a)];
  // u = d × r（相机上方向，与 r、d 正交）
  const u: SceneVec3 = [d[1] * r[2] - d[2] * r[1], d[2] * r[0] - d[0] * r[2], d[0] * r[1] - d[1] * r[0]];
  return { d, r, u };
}

const dot = (a: SceneVec3, b: SceneVec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** 盒子（中心 + 尺寸）→ 八个角点。 */
export function boxCorners(center: SceneVec3, size: SceneVec3): SceneVec3[] {
  const out: SceneVec3[] = [];
  for (const sx of [-0.5, 0.5]) for (const sy of [-0.5, 0.5]) for (const sz of [-0.5, 0.5]) {
    out.push([center[0] + sx * size[0], center[1] + sy * size[1], center[2] + sz * size[2]]);
  }
  return out;
}

export function tabletopOrthoFrame(input: TabletopOrthoInput): TabletopOrthoFrame {
  const { r, u, d } = orthoBasis(input.polarDeg, input.azimuthDeg);
  const points = input.points.length ? input.points : [[0, 0, 0] as SceneVec3];
  let minR = Infinity, maxR = -Infinity, minU = Infinity, maxU = -Infinity;
  for (const p of points) {
    const pr = dot(p, r);
    const pu = dot(p, u);
    minR = Math.min(minR, pr); maxR = Math.max(maxR, pr);
    minU = Math.min(minU, pu); maxU = Math.max(maxU, pu);
  }
  const W = Math.max(1, input.canvasWidth);
  const H = Math.max(1, input.canvasHeight);
  const usableW = Math.max(1, W - input.insets.left - input.insets.right);
  const usableH = Math.max(1, H - input.insets.top - input.insets.bottom);
  const fill = Math.min(Math.max(input.fill, 0.3), 1);
  const spanR = Math.max(maxR - minR, 1e-3);
  const spanU = Math.max(maxU - minU, 1e-3);
  const worldPerPx = Math.max(spanR / (fill * usableW), spanU / (fill * usableH));
  const zoom = Math.max(1, input.zoom ?? 1);
  const wpp = worldPerPx / zoom;
  // 内容中心（视平面坐标）→ 让它落在可用区域中心（画布中心按 insets 偏移）。
  let cR = (minR + maxR) / 2;
  let cU = (minU + maxU) / 2;
  if (input.focus && zoom > 1) {
    cR = dot(input.focus, r);
    cU = dot(input.focus, u);
  }
  const ox = (input.insets.left - input.insets.right) / 2; // 可用区中心相对画布中心（px，向右为正）
  const oy = (input.insets.top - input.insets.bottom) / 2; // （px，向下为正）
  const camR = cR - ox * wpp;
  const camU = cU + oy * wpp;
  // 目标点：视平面坐标 (camR, camU)，沿视线方向落到 y≈0 平面附近。
  const base: SceneVec3 = [r[0] * camR + u[0] * camU, r[1] * camR + u[1] * camU, r[2] * camR + u[2] * camU];
  const t = Math.abs(d[1]) > 1e-6 ? -base[1] / d[1] : 0;
  const target: SceneVec3 = [base[0] + d[0] * t, base[1] + d[1] * t, base[2] + d[2] * t];
  const distance = input.distance ?? 22;
  const position: SceneVec3 = [target[0] + d[0] * distance, target[1] + d[1] * distance, target[2] + d[2] * distance];
  const halfW = (W * worldPerPx) / 2;
  const halfH = (H * worldPerPx) / 2;
  return { position, target, left: -halfW, right: halfW, top: halfH, bottom: -halfH, worldPerPx };
}

/** 正交桌面画布内的 HUD 留白（木框舞台本身已是内嵌框，只留细边；比例同汐屿 playHudInsets 的量级）。 */
export function tabletopHudInsets(canvasWidth: number, canvasHeight: number): HudInsetsPx {
  const side = Math.min(24, Math.max(10, Math.floor(canvasWidth * 0.02)));
  return {
    top: Math.min(48, Math.max(12, Math.floor(canvasHeight * 0.05))),
    bottom: Math.min(40, Math.max(10, Math.floor(canvasHeight * 0.04))),
    left: side,
    right: side,
  };
}

/** 近景焦点：棋子最密的一簇（半径 r 内数量最多，平局取离中心近的）。 */
export function densestCluster(points: readonly SceneVec3[], radius = 1.6): SceneVec3 | null {
  let best: { n: number; c: SceneVec3; d: number } | null = null;
  for (const p of points) {
    const near = points.filter((q) => Math.hypot(q[0] - p[0], q[2] - p[2]) <= radius);
    const c: SceneVec3 = [near.reduce((s, q) => s + q[0], 0) / near.length, 0, near.reduce((s, q) => s + q[2], 0) / near.length];
    const d = Math.hypot(c[0], c[2]);
    if (!best || near.length > best.n || (near.length === best.n && d < best.d)) best = { n: near.length, c, d };
  }
  return best?.c ?? null;
}
