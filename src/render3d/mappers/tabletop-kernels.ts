/**
 * G3D-14 · 空间 Kernel 公开状态 → 通用桌面布局（TabletopLayout）。
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
    return { id: city.id, objectKind: "station", x, z, size: terminal ? 0.62 : 0.42, label: city.name, ...(terminal ? { emphasis: true } : {}) };
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


/** Gem-token bank / market / nobles / seat tableau (T026). Generic; not IP-specific. */
export type GemEngineTabletopInput = {
  bank: Readonly<Record<string, number>>;
  market: ReadonlyArray<ReadonlyArray<{ id?: string; discount?: string; prestige?: number }>>;
  nobles: ReadonlyArray<{ id?: string; name?: string }>;
  seats: ReadonlyArray<{
    gems: Readonly<Record<string, number>>;
    prestige: number;
    cards?: ReadonlyArray<{ id?: string; discount?: string }>;
    reserved?: ReadonlyArray<{ id?: string }>;
  }>;
};

const GEM_TINT: Record<string, string> = {
  white: "#f4efe6",
  blue: "#3b82f6",
  green: "#22c55e",
  red: "#ef4444",
  black: "#1f2937",
  gold: "#eab308",
};

const GEM_BANK_ORDER = ["white", "blue", "green", "red", "black", "gold"] as const;

export function gemEngineLayout(state: GemEngineTabletopInput): TabletopLayout {
  const pieces: TabletopPiece[] = [];
  const hints: TabletopHint[] = [];
  const bankY = -3.2;
  GEM_BANK_ORDER.forEach((color, i) => {
    const count = Math.max(0, Math.floor(Number(state.bank[color] ?? 0)));
    const x = -3.5 + i * 1.4;
    const stack = Math.min(count, 5);
    for (let s = 0; s < stack; s++) {
      pieces.push({
        id: `bank:${color}:${s}`,
        objectKind: "resource",
        x,
        z: bankY,
        y: 0.06 + s * 0.08,
        size: 0.55,
        tint: GEM_TINT[color],
        label: s === stack - 1 ? `${color}:${count}` : undefined,
      });
    }
    if (count === 0) {
      pieces.push({
        id: `bank:${color}:empty`,
        objectKind: "resource",
        x,
        z: bankY,
        size: 0.35,
        tint: "#9ca3af",
        label: color,
      });
    }
  });

  state.market.forEach((tierCards, tier) => {
    const z = -1.6 + tier * 1.15;
    tierCards.forEach((card, index) => {
      const x = -2.4 + index * 1.6;
      const discount = String(card.discount ?? "");
      const prestige = Number(card.prestige ?? 0);
      pieces.push({
        id: `market:t${tier + 1}:${index}`,
        objectKind: "card",
        x,
        z,
        size: 0.85,
        tint: GEM_TINT[discount] ?? "#d6d3d1",
        label: `T${tier + 1}+${prestige}`,
        action: { type: "buy", payload: { tier: tier + 1, index } },
      });
      hints.push({
        id: `buy:t${tier + 1}:${index}`,
        x,
        z,
        radius: 0.35,
        action: { type: "buy", payload: { tier: tier + 1, index } },
      });
      hints.push({
        id: `reserve:t${tier + 1}:${index}`,
        x: x + 0.45,
        z: z + 0.35,
        radius: 0.22,
        action: { type: "reserve", payload: { tier: tier + 1, index } },
      });
    });
  });

  state.nobles.forEach((noble, i) => {
    const x = -2.5 + i * 1.5;
    pieces.push({
      id: `noble:${noble.id ?? i}`,
      objectKind: "token",
      x,
      z: -4.4,
      size: 0.7,
      tint: "#a78bfa",
      label: String(noble.name ?? `N${i}`),
      emphasis: true,
    });
  });

  const seatCount = state.seats.length;
  state.seats.forEach((seat, seatId) => {
    const x0 = -3.6 + (seatId - (seatCount - 1) / 2) * Math.min(2.4, 8 / Math.max(seatCount, 1));
    const z0 = 2.6;
    pieces.push({
      id: `seat:${seatId}:marker`,
      objectKind: "building",
      x: x0,
      z: z0 + 0.9,
      size: 0.45,
      seat: seatId,
      label: `S${seatId}:${seat.prestige}`,
    });
    let gemSlot = 0;
    for (const color of GEM_BANK_ORDER) {
      const n = Math.max(0, Math.floor(Number(seat.gems[color] ?? 0)));
      const show = Math.min(n, 3);
      for (let s = 0; s < show; s++) {
        pieces.push({
          id: `seat:${seatId}:gem:${color}:${s}`,
          objectKind: "disc",
          x: x0 - 0.7 + (gemSlot % 4) * 0.35,
          z: z0 - Math.floor(gemSlot / 4) * 0.35,
          y: 0.05 + s * 0.06,
          size: 0.28,
          seat: seatId,
          tint: GEM_TINT[color],
        });
      }
      if (show > 0) gemSlot += 1;
    }
    (seat.cards ?? []).slice(0, 6).forEach((card, ci) => {
      pieces.push({
        id: `seat:${seatId}:card:${ci}`,
        objectKind: "card",
        x: x0 + 0.9,
        z: z0 - 0.2 - ci * 0.12,
        y: 0.04 + ci * 0.02,
        size: 0.4,
        seat: seatId,
        tint: GEM_TINT[String(card.discount ?? "")] ?? "#e7e5e4",
      });
    });
  });

  return {
    kernelType: "gem-engine-v1",
    board: { objectKind: "region", materialKey: "table", width: BOARD_SPAN + 1.2, depth: BOARD_SPAN + 0.6 },
    cells: [],
    pieces,
    links: [],
    hints,
  };
}


/** Factory draft / pattern lines / wall / floor (T027). Generic; not IP-specific. */
export type PatternDraftTabletopInput = {
  factories: ReadonlyArray<ReadonlyArray<string>>;
  center: ReadonlyArray<string>;
  markerInCenter?: boolean;
  round?: number;
  seats: ReadonlyArray<{
    lines: ReadonlyArray<{ color: string | null; tiles: ReadonlyArray<string>; capacity: number }>;
    wall: ReadonlyArray<ReadonlyArray<string | null>>;
    floor: ReadonlyArray<string>;
    hasMarker?: boolean;
    score: number;
  }>;
};

const PATTERN_TINT: Record<string, string> = {
  blue: "#3b82f6",
  yellow: "#eab308",
  red: "#ef4444",
  black: "#1f2937",
  white: "#f4efe6",
};

export function patternDraftLayout(state: PatternDraftTabletopInput): TabletopLayout {
  const pieces: TabletopPiece[] = [];
  const hints: TabletopHint[] = [];
  const factoryCount = state.factories.length;
  const factoryRadius = 2.8;
  state.factories.forEach((tiles, fi) => {
    const angle = (Math.PI * 2 * fi) / Math.max(factoryCount, 1) - Math.PI / 2;
    const fx = Math.cos(angle) * factoryRadius;
    const fz = Math.sin(angle) * factoryRadius * 0.75 - 1.2;
    pieces.push({
      id: `factory:${fi}:disc`,
      objectKind: "region",
      x: fx,
      z: fz,
      size: 1.1,
      tint: "#d6d3d1",
      label: `F${fi}`,
    });
    tiles.forEach((color, ti) => {
      const a = (Math.PI * 2 * ti) / Math.max(tiles.length, 1);
      const x = fx + Math.cos(a) * 0.32;
      const z = fz + Math.sin(a) * 0.32;
      pieces.push({
        id: `factory:${fi}:tile:${ti}`,
        objectKind: "disc",
        x,
        z,
        y: 0.08,
        size: 0.28,
        tint: PATTERN_TINT[color] ?? "#a8a29e",
      });
    });
    for (const color of new Set(tiles)) {
      hints.push({
        id: `draft:factory:${fi}:${color}`,
        x: fx,
        z: fz,
        radius: 0.4,
        action: { type: "draft", payload: { source: "factory", factoryId: fi, color, line: 0 } },
      });
    }
  });

  // Center pile
  state.center.forEach((color, i) => {
    const col = i % 5;
    const row = Math.floor(i / 5);
    pieces.push({
      id: `center:${i}`,
      objectKind: "disc",
      x: -0.6 + col * 0.3,
      z: -0.3 + row * 0.3,
      y: 0.08,
      size: 0.26,
      tint: PATTERN_TINT[color] ?? "#a8a29e",
    });
  });
  if (state.markerInCenter) {
    pieces.push({
      id: "center:marker",
      objectKind: "token",
      x: 0.9,
      z: -0.1,
      size: 0.35,
      tint: "#f97316",
      label: "1st",
      emphasis: true,
    });
  }
  for (const color of new Set(state.center)) {
    hints.push({
      id: `draft:center:${color}`,
      x: 0,
      z: -0.2,
      radius: 0.45,
      action: { type: "draft", payload: { source: "center", color, line: 0 } },
    });
  }

  const seatCount = state.seats.length;
  state.seats.forEach((seat, seatId) => {
    const x0 = -3.8 + (seatId - (seatCount - 1) / 2) * Math.min(2.6, 9 / Math.max(seatCount, 1));
    const z0 = 2.4;
    pieces.push({
      id: `seat:${seatId}:marker`,
      objectKind: "building",
      x: x0,
      z: z0 + 1.15,
      size: 0.4,
      seat: seatId,
      label: `S${seatId}:${seat.score}`,
      ...(seat.hasMarker ? { emphasis: true } : {}),
    });
    // Pattern lines (capacity 1..5)
    seat.lines.forEach((line, li) => {
      const lz = z0 - li * 0.28;
      for (let c = 0; c < line.capacity; c++) {
        const filled = c < line.tiles.length;
        pieces.push({
          id: `seat:${seatId}:line:${li}:${c}`,
          objectKind: filled ? "disc" : "cell",
          x: x0 - 0.9 + c * 0.22,
          z: lz,
          y: filled ? 0.06 : 0.02,
          size: filled ? 0.2 : 0.18,
          seat: seatId,
          tint: filled
            ? PATTERN_TINT[line.tiles[c]!] ?? "#a8a29e"
            : "#e7e5e4",
        });
      }
    });
    // Wall 5x5 (compact)
    const wall = seat.wall;
    for (let r = 0; r < wall.length; r++) {
      const row = wall[r] ?? [];
      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        pieces.push({
          id: `seat:${seatId}:wall:${r}:${c}`,
          objectKind: cell ? "disc" : "cell",
          x: x0 + 0.55 + c * 0.18,
          z: z0 - r * 0.18,
          y: cell ? 0.05 : 0.01,
          size: 0.16,
          seat: seatId,
          tint: cell ? PATTERN_TINT[cell] ?? "#a8a29e" : "#f5f5f4",
        });
      }
    }
    // Floor penalties
    seat.floor.forEach((color, fi) => {
      pieces.push({
        id: `seat:${seatId}:floor:${fi}`,
        objectKind: "disc",
        x: x0 - 0.9 + fi * 0.2,
        z: z0 + 0.7,
        y: 0.05,
        size: 0.18,
        seat: seatId,
        tint: PATTERN_TINT[color] ?? "#a8a29e",
      });
    });
  });

  return {
    kernelType: "pattern-draft-v1",
    board: { objectKind: "region", materialKey: "table", width: BOARD_SPAN + 1.6, depth: BOARD_SPAN + 0.8 },
    cells: [],
    pieces,
    links: [],
    hints,
  };
}


/** Gallery / classic auction table (T028). Generic; harbor remains a side-branch. */
export type AuctionBiddingTabletopInput = {
  chips: ReadonlyArray<number>;
  scores?: ReadonlyArray<number>;
  currentBid?: number;
  highBidder?: number | null;
  phase?: string;
  lotId?: string;
  gallery?: {
    currentLot?: { id?: string; name?: string; artistId?: string; reserve?: number } | null;
    companionLot?: { id?: string; name?: string; artistId?: string; reserve?: number } | null;
    currentMode?: string;
    round?: number;
    roundsToEnd?: number;
    auctionHand?: ReadonlyArray<ReadonlyArray<{ id?: string; name?: string; artistId?: string }>>;
    collection?: ReadonlyArray<ReadonlyArray<{ id?: string; name?: string; artistId?: string }>>;
    artists?: ReadonlyArray<{ id?: string; name?: string }>;
    marketPrices?: Readonly<Record<string, number>>;
    auctioneer?: number;
  } | null;
  harbor?: {
    currentLot?: { id?: string; name?: string; reserve?: number } | null;
  } | null;
};

const ARTIST_TINT = ["#38bdf8", "#f472b6", "#a3e635", "#fbbf24", "#c084fc", "#fb7185"];

export function auctionBiddingLayout(state: AuctionBiddingTabletopInput): TabletopLayout {
  const pieces: TabletopPiece[] = [];
  const hints: TabletopHint[] = [];
  const gallery = state.gallery ?? null;
  const lot = gallery?.currentLot ?? state.harbor?.currentLot ?? null;
  const companion = gallery?.companionLot ?? null;

  if (lot) {
    pieces.push({
      id: `lot:${lot.id ?? "main"}`,
      objectKind: "card",
      x: companion ? -0.7 : 0,
      z: -0.4,
      size: 1.2,
      tint: "#fef3c7",
      label: String(lot.name ?? state.lotId ?? "lot"),
      emphasis: true,
      action: { type: "bid", payload: { amount: Math.max(1, (state.currentBid ?? 0) + 1) } },
    });
    hints.push({
      id: "bid:lot",
      x: companion ? -0.7 : 0,
      z: -0.4,
      radius: 0.5,
      action: { type: "bid", payload: { amount: Math.max(1, (state.currentBid ?? 0) + 1) } },
    });
    hints.push({
      id: "pass:lot",
      x: companion ? -0.7 : 0,
      z: 0.5,
      radius: 0.35,
      action: { type: "pass", payload: {} },
    });
  }
  if (companion) {
    pieces.push({
      id: `lot:${companion.id ?? "companion"}`,
      objectKind: "card",
      x: 0.7,
      z: -0.4,
      size: 1.05,
      tint: "#ede9fe",
      label: String(companion.name ?? "pair"),
    });
  }

  // Mode / round marker
  pieces.push({
    id: "auction:mode",
    objectKind: "token",
    x: 0,
    z: -2.2,
    size: 0.55,
    tint: "#94a3b8",
    label: `${gallery?.currentMode ?? state.phase ?? "bid"} r${gallery?.round ?? 1}`,
  });

  // Artist market price chips
  (gallery?.artists ?? []).forEach((artist, i) => {
    const price = gallery?.marketPrices?.[artist.id ?? ""] ?? 0;
    pieces.push({
      id: `artist:${artist.id ?? i}`,
      objectKind: "disc",
      x: -3.2 + i * 1.5,
      z: -3.2,
      size: 0.45,
      tint: ARTIST_TINT[i % ARTIST_TINT.length],
      label: `${artist.name ?? artist.id}:${price}`,
    });
  });

  const seatCount = state.chips.length;
  state.chips.forEach((chips, seatId) => {
    const x0 = -3.6 + (seatId - (seatCount - 1) / 2) * Math.min(2.2, 9 / Math.max(seatCount, 1));
    const z0 = 2.5;
    const high = state.highBidder === seatId;
    pieces.push({
      id: `seat:${seatId}:marker`,
      objectKind: "building",
      x: x0,
      z: z0 + 0.95,
      size: high ? 0.5 : 0.4,
      seat: seatId,
      label: `S${seatId}:$${chips}`,
      ...(high ? { emphasis: true } : {}),
      ...(gallery?.auctioneer === seatId ? { tint: "#f59e0b" } : {}),
    });
    // Chip stack
    const stack = Math.min(Math.max(1, Math.floor(chips / 20)), 5);
    for (let s = 0; s < stack; s++) {
      pieces.push({
        id: `seat:${seatId}:chip:${s}`,
        objectKind: "disc",
        x: x0 - 0.55,
        z: z0,
        y: 0.05 + s * 0.06,
        size: 0.28,
        seat: seatId,
        tint: "#eab308",
      });
    }
    const collection = gallery?.collection?.[seatId] ?? [];
    collection.slice(0, 5).forEach((painting, pi) => {
      pieces.push({
        id: `seat:${seatId}:coll:${pi}`,
        objectKind: "card",
        x: x0 + 0.55,
        z: z0 - pi * 0.12,
        y: 0.04 + pi * 0.02,
        size: 0.35,
        seat: seatId,
        tint: "#fdba74",
        label: pi === 0 ? String(painting.name ?? "art") : undefined,
      });
    });
    const hand = gallery?.auctionHand?.[seatId] ?? [];
    hand.slice(0, 4).forEach((painting, hi) => {
      pieces.push({
        id: `seat:${seatId}:hand:${hi}`,
        objectKind: "card",
        x: x0 - 0.4 + hi * 0.25,
        z: z0 + 0.45,
        size: 0.32,
        seat: seatId,
        tint: "#bfdbfe",
      });
    });
  });

  return {
    kernelType: "auction-bidding-v1",
    board: { objectKind: "region", materialKey: "table", width: BOARD_SPAN + 1.4, depth: BOARD_SPAN + 0.6 },
    cells: [],
    pieces,
    links: [],
    hints,
  };
}
