/**
 * GoDesk ②：项目导入的 CC0 GLB（assets/imported/）懒加载摆放。
 * 独立 chunk（`imported-props-*`），不计入 render3d 核心预算。
 *
 * 规则：
 * - 尺寸：按岛上棋子比例归一 —— 高度≈一座村庄（settlement ≈0.24），最长边 ≤ PROP_MAX_EXTENT。
 * - 位置：优先贴港口 / 码头（port 节点外侧），否则沿海岸外环找空位；
 *   任何六角格（外接半径 1.0）+ 道具半径 + 余量 内都不放，彼此、与港口 / 船也不重叠。
 */
import { Box3, Group, Vector3, type Object3D } from "three";
import type { SceneNode } from "./scene-model";

export type ImportedSceneModel = { id: string; url: string; title?: string };
export type XZ = { x: number; z: number };

/** 平顶六角外接半径（世界单位，与 hex-dressing.tileCenter 一致）。 */
export const HEX_CIRCUMRADIUS = 1.0;
/** 目标高度 ≈ 一座村庄棋子（墙 0.135 + 屋脊 0.105）。 */
export const PROP_TARGET_HEIGHT = 0.26;
/** 扁平道具的最长边上限，防止“高度对了但占半个格子”。 */
export const PROP_MAX_EXTENT = 0.34;
const CLEARANCE = 0.12;

/** 返回统一缩放系数：高度 → PROP_TARGET_HEIGHT，且最长水平边 ≤ PROP_MAX_EXTENT。 */
export function normalizePropScale(size: { x: number; y: number; z: number }): number {
  const h = Math.max(size.y, 1e-3);
  const w = Math.max(size.x, size.z, 1e-3);
  return Math.min(PROP_TARGET_HEIGHT / h, PROP_MAX_EXTENT / w);
}

/** 距最近六角格中心的距离 − 外接半径；> 0 即在格子外。 */
export function tileGap(point: XZ, tiles: readonly XZ[]): number {
  let best = Infinity;
  for (const t of tiles) best = Math.min(best, Math.hypot(point.x - t.x, point.z - t.z));
  return best - HEX_CIRCUMRADIUS;
}

/**
 * 为 count 个道具挑选岛外空位（半径 propRadius）。
 * 先试每个港口外侧左右两个泊位，再按 10° 步长扫海岸外环。
 */

/** Infer prop role from asset title / id (plugin pull prompts + provider names). */
export function roleFromModel(model: ImportedSceneModel): "tree" | "station" | "rail" | "prop" {
  const t = `${model.title ?? ""} ${model.id}`.toLowerCase();
  if (/tree|pine|fir|oak|foliage|palm|bush|stump|trunk|fern|plant|树|松|杉|桩|蕨/.test(t)) return "tree";
  if (/cabin|house|station|cottage|building|hut|shed|home|cabinet|车站|站房|木屋|小屋|柜/.test(t)) return "station";
  if (/rail|track|train|sleeper|铁轨|轨道|铁路/.test(t)) return "rail";
  return "prop";
}

/** Tabletop land footprint when no hex tiles (shore / board). */
export function tabletopLandFromNodes(nodes: readonly SceneNode[]): { cx: number; cz: number; halfW: number; halfD: number; natural: boolean; seed: number } | null {
  const land = nodes.find((n) => n.id === "shore") ?? nodes.find((n) => n.id === "board");
  if (!land?.scale) return null;
  return {
    cx: land.position[0],
    cz: land.position[2],
    halfW: land.scale[0] / 2,
    halfD: land.scale[2] / 2,
    natural: (land.tag ?? "").includes(":natural") || land.mesh === "shore-natural",
    seed: Number((land.tag ?? "7").split(":")[0]) || 7,
  };
}

export function placeImportedProps(
  input: { tiles: readonly XZ[]; ports?: readonly XZ[]; obstacles?: readonly XZ[] },
  count: number,
  propRadius = PROP_MAX_EXTENT / 2,
): XZ[] {
  const tiles = input.tiles;
  const ports = input.ports ?? [];
  const blockers: XZ[] = [...ports, ...(input.obstacles ?? [])];
  const out: XZ[] = [];
  const minTileGap = propRadius + CLEARANCE;
  const free = (p: XZ) =>
    tileGap(p, tiles) >= minTileGap &&
    blockers.every((b) => Math.hypot(p.x - b.x, p.z - b.z) >= propRadius + 0.2) &&
    out.every((o) => Math.hypot(p.x - o.x, p.z - o.z) >= propRadius * 2 + 0.08);

  const candidates: XZ[] = [];
  for (const port of ports) {
    const len = Math.hypot(port.x, port.z) || 1;
    const ux = port.x / len;
    const uz = port.z / len;
    for (const push of [0.15, 0.3, 0.5]) {
      for (const side of [0.45, -0.45, 0]) {
        candidates.push({ x: port.x + ux * push - uz * side, z: port.z + uz * push + ux * side });
      }
    }
  }
  const reach = tiles.reduce((m, t) => Math.max(m, Math.hypot(t.x, t.z)), 0) + HEX_CIRCUMRADIUS;
  for (const extra of [minTileGap, minTileGap + 0.3, minTileGap + 0.7, minTileGap + 1.2]) {
    for (let deg = 30; deg < 390; deg += 10) {
      const a = (deg * Math.PI) / 180;
      candidates.push({ x: Math.cos(a) * (reach + extra - HEX_CIRCUMRADIUS * 0.5), z: Math.sin(a) * (reach + extra - HEX_CIRCUMRADIUS * 0.5) });
    }
  }
  for (const c of candidates) {
    if (out.length >= count) break;
    if (free(c)) out.push(c);
  }
  // 极端兜底：远离岛屿的外环（必然不压格子）。
  while (out.length < count) {
    const a = out.length * 0.7;
    out.push({ x: Math.cos(a) * (reach + 1.5 + out.length * 0.1), z: Math.sin(a) * (reach + 1.5) });
  }
  return out;
}

/** 从映射后的场景节点抽取格子 / 港口 / 船的平面坐标。 */
export function layoutFromNodes(nodes: readonly SceneNode[]) {
  const xz = (n: SceneNode): XZ => ({ x: n.position[0], z: n.position[2] });
  return {
    tiles: nodes.filter((n) => n.kind === "tile").map(xz),
    ports: nodes.filter((n) => n.kind === "port").map(xz),
    obstacles: nodes.filter((n) => n.kind === "ship").map(xz),
  };
}

/** 加载并摆放导入模型；返回 dispose。`onLoaded(n)` 每成功一个回调一次。 */
export function mountImportedProps(opts: {
  root: Object3D;
  models: readonly ImportedSceneModel[];
  nodes: readonly SceneNode[];
  /** 每成功一个回调一次：已载数量 + 全部已摆道具离最近六角格的最小间隙 / 最大高度（世界单位）。 */
  onLoaded: (count: number, info: { minTileGap: number; maxHeight: number }) => void;
  /** Hide procedural nodes replaced by imported GLBs (stations / trees). */
  hideNode?: (id: string) => void;
  /** Live scene nodes (tabletop board/shore/stations); preferred over the hex snapshot when non-empty. */
  getNodes?: () => readonly SceneNode[];
}): () => void {
  let cancelled = false;
  const group = new Group();
  group.name = "imported-models";
  opts.root.add(group);
  void (async () => {
    const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
    const loader = new GLTFLoader();
    const live = opts.getNodes?.() ?? [];
    const nodes = live.length ? live : opts.nodes;
    const layout = layoutFromNodes(nodes);
    const land = tabletopLandFromNodes(nodes);
    const hexMode = layout.tiles.length > 0;
    if (!layout.tiles.length) layout.tiles = [{ x: 0, z: 0 }];
    const stationSpots = nodes.filter((n) => n.mesh === "station").map((n) => ({ x: n.position[0], z: n.position[2], id: n.id }));
    const treeSpots = nodes.filter((n) => n.mesh === "tree").map((n) => ({ x: n.position[0], z: n.position[2], id: n.id }));
    const linkMids = nodes.filter((n) => n.kind === "link").map((n) => ({ x: n.position[0], z: n.position[2], id: n.id }));
    const shoreSpots = placeImportedProps(layout, Math.max(opts.models.length, 4));
    const usedStation = new Set<string>();
    const usedTree = new Set<string>();
    const usedLink = new Set<string>();
    const hideIds: string[] = [];
    let loaded = 0;
    let minTileGap = Infinity;
    let maxHeight = 0;
    for (const [index, model] of opts.models.entries()) {
      try {
        const gltf = await loader.loadAsync(model.url);
        if (cancelled) return;
        const object = gltf.scene;
        const box = new Box3().setFromObject(object);
        const size = box.getSize(new Vector3());
        const role = roleFromModel(model);
        // Tabletop replacements: stations / trees can be slightly larger than hex settlement props.
        const scale = !hexMode && (role === "station" || role === "tree")
          ? Math.min((role === "station" ? 0.55 : 0.42) / Math.max(size.y, 1e-3), (role === "station" ? 0.7 : 0.45) / Math.max(size.x, size.z, 1e-3))
          : normalizePropScale(size);
        object.scale.setScalar(scale);
        const center = box.getCenter(new Vector3());
        let spot: XZ = shoreSpots[index] ?? shoreSpots[shoreSpots.length - 1]!;
        let yLift = 0.02;
        if (!hexMode) {
          if (role === "station") {
            const next = stationSpots.find((p) => !usedStation.has(p.id));
            if (next) { usedStation.add(next.id); hideIds.push(next.id); spot = next; yLift = 0.04; }
          } else if (role === "tree") {
            const next = treeSpots.find((p) => !usedTree.has(p.id));
            if (next) { usedTree.add(next.id); hideIds.push(next.id); spot = next; }
            else if (land) {
              const t = (index * 2.4 + land.seed) % (Math.PI * 2);
              const ux = Math.cos(t); const uz = Math.sin(t);
              const squircle = Math.pow(Math.abs(ux) ** 4 + Math.abs(uz) ** 4, -0.25);
              spot = { x: land.cx + ux * land.halfW * squircle * 0.78, z: land.cz + uz * land.halfD * squircle * 0.78 };
            }
          } else if (role === "rail") {
            const next = linkMids.find((p) => !usedLink.has(p.id));
            if (next) { usedLink.add(next.id); spot = next; yLift = 0.03; }
          } else if (land) {
            const t = (index * 1.7 + 0.4) % (Math.PI * 2);
            const ux = Math.cos(t); const uz = Math.sin(t);
            const squircle = Math.pow(Math.abs(ux) ** 4 + Math.abs(uz) ** 4, -0.25);
            const rim = 1.02 + (index % 3) * 0.04;
            spot = { x: land.cx + ux * land.halfW * squircle * rim, z: land.cz + uz * land.halfD * squircle * rim };
          }
        }
        object.position.set(spot.x - center.x * scale, -box.min.y * scale + yLift, spot.z - center.z * scale);
        object.name = `imported:${model.id}`;
        object.userData.importedSpot = spot;
        object.userData.importedRole = role;
        object.traverse((child) => {
          child.castShadow = true;
          child.receiveShadow = true;
        });
        group.add(object);
        loaded += 1;
        const placeClone = (at: XZ, lift: number) => {
          const clone = object.clone(true);
          clone.position.set(at.x - center.x * scale, -box.min.y * scale + lift, at.z - center.z * scale);
          clone.name = `${object.name}:c${group.children.length}`;
          group.add(clone);
        };
        if (!hexMode && role === "tree") {
          for (const next of treeSpots) {
            if (usedTree.has(next.id)) continue;
            usedTree.add(next.id); hideIds.push(next.id); placeClone(next, 0.02);
          }
        }
        if (!hexMode && role === "station") {
          for (const next of stationSpots) {
            if (usedStation.has(next.id)) continue;
            usedStation.add(next.id); hideIds.push(next.id); placeClone(next, 0.04);
          }
        }
        const placed = new Box3().setFromObject(object);
        const half = Math.hypot(placed.max.x - placed.min.x, placed.max.z - placed.min.z) / 2;
        minTileGap = Math.min(minTileGap, tileGap(spot, layout.tiles) - half);
        maxHeight = Math.max(maxHeight, placed.max.y - placed.min.y);
        for (const id of hideIds) opts.hideNode?.(id);
        opts.onLoaded(loaded, { minTileGap, maxHeight });
      } catch (reason) {
        console.warn("[godesk] imported GLB failed", model.url, reason);
      }
    }
  })();
  return () => {
    cancelled = true;
    group.removeFromParent();
    group.traverse((child) => {
      (child as { geometry?: { dispose?: () => void } }).geometry?.dispose?.();
    });
  };
}
