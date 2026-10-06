/**
 * G3D-JUDGE：评审截图用的调试机位（仅在 URL 带 `?judge=1` 时由 SceneHost 挂到
 * `globalThis.__g3dJudge`；生产页面不暴露、不改默认机位）。纯函数：SceneModel → 机位。
 */
import type { SceneNode, SceneVec3 } from "./scene-model";

export type JudgePreset = "a-default" | "a3-topdown" | "b-terrain" | "c-coast" | "f-dice" | "g-midgame";
export const JUDGE_PRESETS: readonly JudgePreset[] = ["a-default", "a3-topdown", "b-terrain", "c-coast", "f-dice", "g-midgame"];

export type JudgeCamera = { position: SceneVec3; target: SceneVec3; fov?: number };

/** 近景要同时拍到的地形（森林 / 牧场 / 山地 / 麦田）。 */
const CLOSEUP_TERRAINS = ["wood", "sheep", "ore", "wheat"] as const;

function dist2(a: SceneVec3, b: SceneVec3): number {
  return (a[0] - b[0]) ** 2 + (a[2] - b[2]) ** 2;
}

/** 球坐标机位：polar 从竖直向下量（0 = 正俯视），azimuth 绕 Y（0 = 从 +Z 看）。 */
export function orbit(target: SceneVec3, distance: number, polarDeg: number, azimuthDeg: number): SceneVec3 {
  const p = (polarDeg * Math.PI) / 180;
  const a = (azimuthDeg * Math.PI) / 180;
  return [
    target[0] + distance * Math.sin(p) * Math.sin(a),
    target[1] + distance * Math.cos(p),
    target[2] + distance * Math.sin(p) * Math.cos(a),
  ];
}

/** 选一块周围（含自身）覆盖最多近景地形的格子，平局取离岛心近的。 */
export function pickTerrainCluster(nodes: readonly SceneNode[]): SceneVec3 | null {
  const tiles = nodes.filter((n) => n.kind === "tile");
  if (tiles.length === 0) return null;
  const neighbourR2 = (1.9 * 1.05) ** 2;
  let best: { score: number; center: SceneVec3; d: number } | null = null;
  for (const tile of tiles) {
    const around = tiles.filter((t) => dist2(t.position, tile.position) <= neighbourR2);
    const kinds = new Set(around.map((t) => t.tag).filter((tag) => (CLOSEUP_TERRAINS as readonly string[]).includes(tag ?? "")));
    const cx = around.reduce((s, t) => s + t.position[0], 0) / around.length;
    const cz = around.reduce((s, t) => s + t.position[2], 0) / around.length;
    const center: SceneVec3 = [cx, 0.3, cz];
    const d = Math.hypot(tile.position[0], tile.position[2]);
    if (!best || kinds.size > best.score || (kinds.size === best.score && d < best.d)) best = { score: kinds.size, center, d };
  }
  return best?.center ?? null;
}

/** 选离相机默认方位（+Z 一侧）最近的港口：拍海岸、水面、崖壁与港口。 */
export function pickCoast(nodes: readonly SceneNode[]): { port: SceneVec3; outward: [number, number] } | null {
  const ports = nodes.filter((n) => n.kind === "port");
  if (ports.length === 0) return null;
  const port = ports.reduce((a, b) => (b.position[2] - Math.abs(b.position[0]) * 0.3 > a.position[2] - Math.abs(a.position[0]) * 0.3 ? b : a));
  const len = Math.hypot(port.position[0], port.position[2]) || 1;
  return { port: port.position, outward: [port.position[0] / len, port.position[2] / len] };
}

/** 让约 12 × 11 的整岛（含码头）落进 45° 竖直视场。 */
export function wholeIslandDistance(aspect: number): number {
  const halfV = Math.tan((45 / 2) * (Math.PI / 180));
  const byHeight = 11 / (2 * halfV);
  const byWidth = 12.5 / (2 * halfV * Math.max(aspect, 0.1));
  return Math.max(byHeight, byWidth) * 1.06;
}

/** 预设 → 机位；`a-default` 返回 null（保持 SceneHost 自适应的默认机位）。 */
export function judgeCamera(preset: JudgePreset, nodes: readonly SceneNode[], aspect: number): JudgeCamera | null {
  const narrow = aspect < 0.8;
  switch (preset) {
    case "a-default":
      return null;
    case "a3-topdown":
      // 对齐参照 a3：近乎正俯视整岛，四周留海。
      return { target: [0, 0, 0], position: orbit([0, 0, 0], wholeIslandDistance(aspect) * 0.9, 3, 0) };
    case "b-terrain": {
      // 对齐参照 b（约 225% 缩放）：俯仰约 58°（polar 32°），正面看 3–4 块地形。
      const center = pickTerrainCluster(nodes) ?? [0, 0.3, 0];
      return { target: center, position: orbit(center, narrow ? 7.2 : 4.6, 32, 0) };
    }
    case "c-coast":
      // 对齐参照 c（99% 缩放）：俯仰约 58° 看整座岛和四周海面、崖壁、码头。
      return { target: [0, 0, 0.3], position: orbit([0, 0, 0.3], wholeIslandDistance(aspect) * 0.86, 32, 0) };
    case "f-dice": {
      const die = nodes.find((n) => n.id === "die:0");
      const tray = nodes.find((n) => n.kind === "dice-tray");
      const center: SceneVec3 = die ? [die.position[0] + 0.2, die.position[1], die.position[2]] : tray?.position ?? [4.2, 0.2, 3.2];
      return { target: center, position: orbit(center, narrow ? 3.2 : 2.4, 48, -25) };
    }
    case "g-midgame":
      return { target: [0, 0, 0.4], position: orbit([0, 0, 0.4], narrow ? 13.5 : 10.5, 46, 22) };
  }
}
