/**
 * G3D-14 · 四个空间 Kernel 公开状态 → 通用桌面布局（TabletopLayout）。
 * 区域排成桌面格位，对象绑定为基础网格；合法动作挂到格位 / 连线 / 提示环上，
 * 由同一拾取管线发出（与 DOM 动作按钮发同样的 actionId / payload）。
 */
import type { TabletopAction, TabletopCell, TabletopHint, TabletopLayout, TabletopLink, TabletopPiece } from "./tabletop";

/** 桌面目标尺寸（世界单位）：配合 RenderSpec 默认机位（fov 35°、距离 16）。 */
const BOARD_SPAN = 8;

export type DiscFlippingTabletopInput = {
  rows: number;
  cols: number;
  board: ReadonlyArray<ReadonlyArray<number | null>>;
  lastMove?: { row: number; col: number } | null;
};

export function discFlippingLayout(
  state: DiscFlippingTabletopInput,
  legal: ReadonlyArray<{ type: string; payload?: Record<string, unknown> | null }>,
): TabletopLayout {
  const cell = BOARD_SPAN / Math.max(state.rows, state.cols);
  const width = cell * (state.cols + 0.5);
  const depth = cell * (state.rows + 0.5);
  const x0 = -(cell * state.cols) / 2;
  const z0 = -(cell * state.rows) / 2;
  const center = (row: number, col: number) => ({ x: x0 + (col + 0.5) * cell, z: z0 + (row + 0.5) * cell });
  const pieces: TabletopPiece[] = [];
  state.board.forEach((cells, row) => cells.forEach((owner, col) => {
    if (owner === null || owner === undefined) return;
    const { x, z } = center(row, col);
    pieces.push({ id: `${row},${col}`, objectKind: "disc", x, z, size: cell, seat: owner });
  }));
  const actions: Record<string, TabletopAction> = {};
  const hints: TabletopHint[] = [];
  for (const action of legal) {
    if (action.type !== "place") continue;
    const row = action.payload?.row;
    const col = action.payload?.col;
    if (!Number.isInteger(row) || !Number.isInteger(col)) continue;
    const key = `${row as number},${col as number}`;
    const placed: TabletopAction = { type: "place", payload: { row, col } };
    actions[key] = placed;
    const { x, z } = center(row as number, col as number);
    hints.push({ id: key, x, z, radius: cell * 0.32, action: placed });
  }
  return {
    kernelType: "disc-flipping-v1",
    board: { objectKind: "cell", width, depth, grid: { rows: state.rows, cols: state.cols, actions } },
    cells: [],
    pieces,
    links: [],
    hints,
  };
}

export type NetworkRouteTabletopInput = {
  cities: ReadonlyArray<{ id: string; name: string; x: number; y: number }>;
  edges: ReadonlyArray<{ id: string; from: string; to: string }>;
  claims: Readonly<Record<string, number | null>>;
  terminalFrom: string;
  terminalTo: string;
};

export function networkRouteLayout(
  state: NetworkRouteTabletopInput,
  legalEdgeIds: ReadonlySet<string>,
): TabletopLayout {
  const xs = state.cities.map((city) => city.x);
  const ys = state.cities.map((city) => city.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);
  const scale = Math.min(BOARD_SPAN / spanX, (BOARD_SPAN * 0.75) / spanY);
  const position = new Map(state.cities.map((city) => [
    city.id,
    [(city.x - (minX + maxX) / 2) * scale, (city.y - (minY + maxY) / 2) * scale] as const,
  ]));
  const pieces: TabletopPiece[] = state.cities.map((city) => {
    const [x, z] = position.get(city.id)!;
    const terminal = city.id === state.terminalFrom || city.id === state.terminalTo;
    return { id: city.id, objectKind: "station", x, z, size: terminal ? 0.62 : 0.42 };
  });
  const links: TabletopLink[] = [];
  const hints: TabletopHint[] = [];
  for (const edge of state.edges) {
    const from = position.get(edge.from);
    const to = position.get(edge.to);
    if (!from || !to) continue;
    const owner = state.claims[edge.id];
    const claimed = owner !== null && owner !== undefined;
    const action: TabletopAction | undefined = legalEdgeIds.has(edge.id)
      ? { type: "claim", payload: { edgeId: edge.id } }
      : undefined;
    links.push({
      id: edge.id,
      objectKind: claimed ? "claim" : "route",
      from,
      to,
      width: claimed ? 0.26 : 0.12,
      seat: claimed ? owner : null,
      ...(action ? { action } : {}),
    });
    if (action) {
      hints.push({ id: edge.id, x: (from[0] + to[0]) / 2, z: (from[1] + to[1]) / 2, radius: 0.24, action });
    }
  }
  return {
    kernelType: "network-route-v1",
    board: { objectKind: "map", materialKey: "map", width: spanX * scale + 1.6, depth: spanY * scale + 1.6 },
    cells: [],
    pieces,
    links,
    hints,
  };
}

type RegionLike = { id: string; capacity: number };
type PlacementLike = { id: string; seat: number; regionId: string };

/** 通用：区域排成格位（列数 ≈ √n），每格按容量排工人位。 */
function regionGrid(
  regions: ReadonlyArray<RegionLike>,
  placements: ReadonlyArray<PlacementLike>,
  legalRegionIds: ReadonlySet<string>,
  actionFor: (regionId: string) => string,
  options: { cellObjectKind: string; originZ?: number; columns?: number; span?: number },
): { cells: TabletopCell[]; pieces: TabletopPiece[]; hints: TabletopHint[]; depth: number } {
  const columns = options.columns ?? Math.max(1, Math.ceil(Math.sqrt(regions.length)));
  const rows = Math.max(1, Math.ceil(regions.length / columns));
  const span = options.span ?? BOARD_SPAN;
  const width = span / columns;
  const depth = Math.min(width * 0.78, 2.4);
  const originZ = options.originZ ?? -(rows * depth) / 2;
  const cells: TabletopCell[] = [];
  const pieces: TabletopPiece[] = [];
  const hints: TabletopHint[] = [];
  regions.forEach((region, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = -span / 2 + (col + 0.5) * width;
    const z = originZ + (row + 0.5) * depth;
    const action: TabletopAction | undefined = legalRegionIds.has(region.id) ? { type: actionFor(region.id) } : undefined;
    cells.push({ id: region.id, objectKind: options.cellObjectKind, x, z, width: width * 0.9, depth: depth * 0.86, ...(action ? { action } : {}) });
    const occupants = placements.filter((placement) => placement.regionId === region.id);
    const slots = Math.max(region.capacity, occupants.length, 1);
    const step = Math.min((width * 0.8) / slots, 0.7);
    occupants.forEach((placement, slot) => {
      pieces.push({
        id: placement.id,
        objectKind: "worker",
        x: x - (step * (slots - 1)) / 2 + slot * step,
        z: z + depth * 0.12,
        size: Math.min(step * 0.9, 0.62),
        seat: placement.seat,
      });
    });
    if (action) hints.push({ id: region.id, x, z: z - depth * 0.22, radius: Math.min(width, depth) * 0.16, action });
  });
  return { cells, pieces, hints, depth: rows * depth };
}

export type WorkerPlacementTabletopInput = {
  regions: ReadonlyArray<RegionLike & { name: string }>;
  placements: ReadonlyArray<PlacementLike>;
  players: ReadonlyArray<{ seat: number; buildings: number }>;
};

export function workerPlacementLayout(
  state: WorkerPlacementTabletopInput,
  legalRegionIds: ReadonlySet<string>,
): TabletopLayout {
  const grid = regionGrid(state.regions, state.placements, legalRegionIds, (id) => `place:${id}`, {
    cellObjectKind: "region",
  });
  // 建筑：每位玩家的已建建筑沿底板前沿排开。
  const pieces = [...grid.pieces];
  const front = grid.depth / 2 + 0.5;
  state.players.forEach((player, index) => {
    const baseX = -BOARD_SPAN / 2 + (index + 0.5) * (BOARD_SPAN / Math.max(state.players.length, 1));
    for (let built = 0; built < Math.min(player.buildings, 6); built += 1) {
      pieces.push({
        id: `building:${player.seat}:${built}`,
        objectKind: "building",
        x: baseX - 0.75 + built * 0.3,
        z: front,
        size: 0.42,
        seat: player.seat,
      });
    }
  });
  return {
    kernelType: "worker-placement-v1",
    // 底板用木桌材质做边框，区域格位（board 材质）才能和底板区分开。
    board: { objectKind: "region", materialKey: "table", width: BOARD_SPAN + 0.8, depth: grid.depth + 1.8 },
    cells: grid.cells,
    pieces,
    links: [],
    hints: grid.hints,
  };
}

export type HarborVoyageTabletopInput = {
  punts: ReadonlyArray<{ cargoId: string; position: number; color?: string }>;
  placements: ReadonlyArray<{ id: string; seat: number; targetId: string }>;
  targets: ReadonlyArray<{ id: string; capacity: number }>;
};

/** 航道：0–13 格 + 港口；每种货一条航道，货船按位置前进。 */
export const HARBOR_TRACK_CELLS = 14;

export function harborVoyageLayout(
  state: HarborVoyageTabletopInput,
  legalTargetIds: ReadonlySet<string>,
): TabletopLayout {
  const laneDepth = 0.9;
  const trackDepth = laneDepth * state.punts.length;
  const cargoIds = new Set(state.punts.map((punt) => punt.cargoId));
  const shore = state.targets.filter((target) => !cargoIds.has(target.id));
  const shoreColumns = Math.min(5, Math.max(1, shore.length));
  const shoreRows = Math.max(1, Math.ceil(shore.length / shoreColumns));
  const shoreDepth = shoreRows * Math.min((BOARD_SPAN / shoreColumns) * 0.78, 2.4);
  const gap = 0.35;
  const trackTop = -(trackDepth + gap + shoreDepth) / 2;
  const step = BOARD_SPAN / (HARBOR_TRACK_CELLS + 1);
  const cells: TabletopCell[] = [];
  const pieces: TabletopPiece[] = [];
  const hints: TabletopHint[] = [];
  state.punts.forEach((punt, lane) => {
    const z = trackTop + (lane + 0.5) * laneDepth;
    cells.push({ id: `lane:${punt.cargoId}`, objectKind: "berth", x: 0, z, width: BOARD_SPAN, depth: laneDepth * 0.82 });
    const position = Math.min(Math.max(punt.position, 0), HARBOR_TRACK_CELLS);
    const x = -BOARD_SPAN / 2 + (position + 0.5) * step;
    const action: TabletopAction | undefined = legalTargetIds.has(punt.cargoId)
      ? { type: `place:${punt.cargoId}` }
      : undefined;
    pieces.push({ id: `ship:${punt.cargoId}`, objectKind: "ship", x, z, size: 0.9, ...(action ? { action } : {}) });
    pieces.push({
      id: `cargo:${punt.cargoId}`,
      objectKind: "cargo",
      x: x - 0.18,
      z,
      y: 0.24 + 0.1 + 0.2,
      size: 0.36,
      ...(punt.color ? { tint: punt.color } : {}),
    });
    state.placements.filter((placement) => placement.targetId === punt.cargoId).forEach((placement, slot) => {
      pieces.push({
        id: placement.id,
        objectKind: "worker",
        x: x + 0.06 + slot * 0.2,
        z,
        y: 0.24 + 0.1 + 0.2,
        size: 0.38,
        seat: placement.seat,
      });
    });
    if (action) hints.push({ id: punt.cargoId, x: x + 0.75, z, radius: 0.22, action });
  });
  const grid = regionGrid(
    shore.map((target) => ({ id: target.id, capacity: target.capacity })),
    state.placements.filter((placement) => !cargoIds.has(placement.targetId)).map((placement) => ({
      id: placement.id,
      seat: placement.seat,
      regionId: placement.targetId,
    })),
    legalTargetIds,
    (id) => `place:${id}`,
    { cellObjectKind: "berth", originZ: trackTop + trackDepth + gap, columns: shoreColumns },
  );
  return {
    kernelType: "harbor-voyage-v1",
    board: { objectKind: "berth", materialKey: "table", width: BOARD_SPAN + 0.8, depth: trackDepth + gap + shoreDepth + 0.8 },
    cells: [...cells, ...grid.cells],
    pieces: [...pieces, ...grid.pieces],
    links: [],
    hints: [...hints, ...grid.hints],
  };
}
