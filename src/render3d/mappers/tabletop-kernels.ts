/**
 * G3D-14 · 空间 Kernel 公开状态 → 通用桌面布局（TabletopLayout）。
 * 区域排成桌面格位，对象绑定为基础网格；合法动作挂到格位 / 连线 / 提示环上，
 * 由同一拾取管线发出（与 DOM 动作按钮发同样的 actionId / payload）。
 */
import type { TabletopAction, TabletopCell, TabletopHint, TabletopLayout, TabletopLink, TabletopPiece } from "./tabletop";
import { encodeCardFace, encodeLotArt, encodePlaqueFace } from "./tabletop-face-schema";

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
  /** Optional seat scores / route counts for shared meeple markers (T042). */
  routeCounts?: ReadonlyArray<number>;
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
    // T051: readable station plaque tag (hub:Name / Name) — not faint debug mush.
    const label = terminal ? `hub:${city.name}` : city.name;
    return { id: city.id, objectKind: "station", x, z, size: terminal ? 0.62 : 0.42, label };
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
      width: claimed ? 0.38 : 0.12, // T062 · thicker claimed car corridor
      seat: claimed ? owner : null,
      ...(action ? { action } : {}),
    });
    if (action) {
      hints.push({ id: edge.id, x: (from[0] + to[0]) / 2, z: (from[1] + to[1]) / 2, radius: 0.24, action });
    }
  }
  // T042: shared seat meeples (per-seat color) along the near edge.
  const counts = state.routeCounts ?? [];
  const seatN = Math.max(counts.length, 2);
  for (let seatId = 0; seatId < seatN; seatId += 1) {
    const x0 = -2.4 + (seatId - (seatN - 1) / 2) * 2.2;
    pieces.push({
      id: `seat:${seatId}:marker`,
      objectKind: "worker",
      x: x0,
      z: (spanY * scale) / 2 + 0.55,
      size: 0.5,
      rotationY: Math.PI,
      seat: seatId,
    });
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
      y: 0.30,  // T047: offset above playTop (was absolute boardTop+deck)
      size: 0.36,
      ...(punt.color ? { tint: punt.color } : {}),
    });
    state.placements.filter((placement) => placement.targetId === punt.cargoId).forEach((placement, slot) => {
      pieces.push({
        id: placement.id,
        objectKind: "worker",
        x: x + 0.06 + slot * 0.2,
        z,
        y: 0.30,  // T047: offset above playTop (was absolute boardTop+deck)
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
  market: ReadonlyArray<ReadonlyArray<{ id?: string; discount?: string; prestige?: number; cost?: Readonly<Record<string, number>>; tier?: number }>>;
  nobles: ReadonlyArray<{ id?: string; name?: string; prestige?: number; requirements?: Readonly<Record<string, number>> }>;
  seats: ReadonlyArray<{
    gems: Readonly<Record<string, number>>;
    prestige: number;
    cards?: ReadonlyArray<{ id?: string; discount?: string; prestige?: number; cost?: Readonly<Record<string, number>>; tier?: number }>;
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

export type DeskLegalAction = { type: string; payload?: Record<string, unknown> | null };

function legalMatch(legal: ReadonlyArray<DeskLegalAction> | undefined, type: string, payload: Record<string, unknown>): boolean {
  if (legal === undefined) return true; // legacy / preview: keep affordances
  return legal.some((a) => {
    if (a.type !== type) return false;
    const p = a.payload ?? {};
    return Object.keys(payload).every((k) => p[k] === payload[k]);
  });
}

function firstLegal(legal: ReadonlyArray<DeskLegalAction> | undefined, type: string, pred: (p: Record<string, unknown>) => boolean): DeskLegalAction | undefined {
  if (!legal) return undefined;
  return legal.find((a) => a.type === type && pred((a.payload ?? {}) as Record<string, unknown>));
}

export function gemEngineLayout(state: GemEngineTabletopInput, legal?: ReadonlyArray<DeskLegalAction>): TabletopLayout {
  const pieces: TabletopPiece[] = [];
  const hints: TabletopHint[] = [];
  const bankY = -3.2;
  // T036: bank = vertical same-color stacks + readable count tip; forbid single disc for whole pile.
  GEM_BANK_ORDER.forEach((color, i) => {
    const count = Math.max(0, Math.floor(Number(state.bank[color] ?? 0)));
    const x = -3.5 + i * 1.4;
    const takePair = legalMatch(legal, "take_pair", { color });
    if (count === 0) {
      // Empty slot marker only — not a fake coin pile.
      pieces.push({
        id: `bank:${color}:slot`,
        objectKind: "cell",
        x,
        z: bankY,
        y: 0.01,
        size: 0.4,
        tint: "#d6d3d1",
        // T074 · no `${color}:0` parchment nameplate on empty bank
      });
    } else {
      const stack = Math.min(count, 6);
      for (let s = 0; s < stack; s++) {
        const top = s === stack - 1;
        pieces.push({
          id: `bank:${color}:${s}`,
          objectKind: "resource",
          x,
          z: bankY,
          y: 0.08 + s * 0.14,
          size: 0.58,
          tint: GEM_TINT[color],
          ...(top && takePair ? { action: { type: "take_pair", payload: { color } }, emphasis: true } : {}),
        });
      }
    }
    if (takePair) {
      hints.push({
        id: `take_pair:${color}`,
        x,
        z: bankY,
        radius: 0.32,
        action: { type: "take_pair", payload: { color } },
      });
    }
  });

  state.market.forEach((tierCards, tier) => {
    const z = -1.6 + tier * 1.15;
    tierCards.forEach((card, index) => {
      const x = -2.4 + index * 1.6;
      const discount = String(card.discount ?? "");
      const prestige = Number(card.prestige ?? 0);
      const buyPayload = { tier: tier + 1, index };
      const reservePayload = { tier: tier + 1, index };
      const canBuy = legalMatch(legal, "buy", buyPayload);
      const canReserve = legalMatch(legal, "reserve", reservePayload);
      pieces.push({
        id: `market:t${tier + 1}:${index}`,
        objectKind: "card",
        x,
        z,
        // T072 · larger market cards so stage-wide reads motif color masses
        size: 1.2,
        tint: GEM_TINT[discount] ?? "#d6d3d1",
        label: encodeCardFace({
          tier: tier + 1,
          prestige,
          reward: discount || undefined,
          cost: card.cost,
        }),
        ...(canBuy ? { action: { type: "buy", payload: buyPayload }, emphasis: true } : {}),
      });
      if (canBuy) {
        hints.push({
          id: `buy:t${tier + 1}:${index}`,
          x,
          z,
          radius: 0.35,
          action: { type: "buy", payload: buyPayload },
        });
      }
      if (canReserve) {
        hints.push({
          id: `reserve:t${tier + 1}:${index}`,
          x: x + 0.45,
          z: z + 0.35,
          radius: 0.22,
          action: { type: "reserve", payload: reservePayload },
        });
      }
    });
  });

  state.nobles.forEach((noble, i) => {
    const x = -2.5 + i * 1.5;
    const title = String(noble.name ?? "").trim() || "贵族";
    pieces.push({
      id: `noble:${noble.id ?? i}`,
      objectKind: "plaque",
      x,
      z: -4.4,
      size: 0.85,
      tint: "#a78bfa",
      label: encodePlaqueFace({
        title,
        prestige: noble.prestige ?? 3,
        requirements: noble.requirements,
      }),
      emphasis: true,
    });
  });

  const seatCount = state.seats.length;
  state.seats.forEach((seat, seatId) => {
    const { x0, zMeeple, zOwned } = seatTableauOrigin(seatId, seatCount, { span: 2.4, zMeeple: 2.6, depth: 0.75 });
    pieces.push({
      id: `seat:${seatId}:marker`,
      objectKind: "worker",
      x: x0,
      z: zMeeple + 0.55,
      size: 0.55,
      rotationY: Math.PI,
      seat: seatId,
    });
    // T036/T052: gem supply stacks in seat-front tableau (not hidden behind meeple).
    let gemSlot = 0;
    for (const color of GEM_BANK_ORDER) {
      const n = Math.max(0, Math.floor(Number(seat.gems[color] ?? 0)));
      if (n <= 0) continue;
      const show = Math.min(n, 5);
      const gx = x0 - 0.85 + (gemSlot % 4) * 0.32;
      const gz = zOwned + 0.35 - Math.floor(gemSlot / 4) * 0.32;
      for (let s = 0; s < show; s++) {
        pieces.push({
          id: `seat:${seatId}:gem:${color}:${s}`,
          objectKind: "resource",
          x: gx,
          z: gz,
          y: 0.05 + s * 0.07,
          size: 0.3,
          seat: seatId,
          tint: GEM_TINT[color],
        });
      }
      gemSlot += 1;
    }
    // T052 · purchased development cards fan in seat-front owned zone (shared tableau).
    (seat.cards ?? []).slice(0, 6).forEach((card, ci) => {
      const reward = String(card.discount ?? "");
      pieces.push({
        id: `seat:${seatId}:card:${ci}`,
        objectKind: "card",
        x: x0 - 0.35 + ci * 0.28,
        z: zOwned - 0.15,
        y: 0.05 + ci * 0.015,
        size: 0.48,
        seat: seatId,
        rotationY: (ci - 2.5) * 0.06,
        tint: GEM_TINT[reward] ?? "#e7e5e4",
        label: encodeCardFace({
          tier: card.tier,
          prestige: card.prestige,
          reward: reward || undefined,
          cost: card.cost,
        }),
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


/** T052/T056 · shared seat-front tableau origin (toward board center from meeple).
 * Seats are centered on the felt and clamped so extreme seats stay on-board
 * (BOARD_SPAN/2 ≈ 4). Pre-T056 left-anchored formula pushed 5-seat auctions to x≈-7. */
export function seatTableauOrigin(
  seatId: number,
  seatCount: number,
  opts?: { span?: number; zMeeple?: number; depth?: number },
): { x0: number; zMeeple: number; zOwned: number } {
  const zMeeple = opts?.zMeeple ?? 2.55;
  const depth = opts?.depth ?? 0.7;
  const half = Math.min(3.35, BOARD_SPAN * 0.42);
  const preferred = opts?.span ?? 2.4;
  const span =
    seatCount <= 1
      ? 0
      : Math.min(preferred, (2 * half) / Math.max(seatCount - 1, 1));
  const x0 = (seatId - (seatCount - 1) / 2) * span;
  return { x0, zMeeple, zOwned: zMeeple - depth };
}

const PATTERN_TINT: Record<string, string> = {
  blue: "#3b82f6",
  yellow: "#eab308",
  red: "#ef4444",
  black: "#1f2937",
  white: "#f4efe6",
};

/** T054 · muted wall-print hues for empty slots (readable grid; not pure-black pits). */
const WALL_PRINT_TINT: Record<string, string> = {
  blue: "#93c5fd",
  yellow: "#fde68a",
  red: "#fca5a5",
  black: "#a8a29e",
  white: "#f5f5f4",
};

const WALL_PRINT_COLORS = ["blue", "yellow", "red", "black", "white"] as const;

/** Generic rotating wall print at row/col (matches pattern-draft wallColorAt). */
export function wallPrintColorAt(row: number, col: number): string {
  return WALL_PRINT_COLORS[(row + col) % WALL_PRINT_COLORS.length]!;
}

export function patternDraftLayout(state: PatternDraftTabletopInput, legal?: ReadonlyArray<DeskLegalAction>): TabletopLayout {
  const pieces: TabletopPiece[] = [];
  const hints: TabletopHint[] = [];
  const factoryCount = state.factories.length;
  const factoryRadius = 2.8;
  // T036: pads only when inventory > 0; N glazed-tile children in color-visible stacks.
  state.factories.forEach((tiles, fi) => {
    if (tiles.length === 0) return; // forbid empty pads pretending to be factories
    const angle = (Math.PI * 2 * fi) / Math.max(factoryCount, 1) - Math.PI / 2;
    const fx = Math.cos(angle) * factoryRadius;
    const fz = Math.sin(angle) * factoryRadius * 0.75 - 1.2;
    pieces.push({
      id: `factory:${fi}:pad`,
      // T076 · porcelain plate under glazed tiles
      objectKind: "plate",
      x: fx,
      z: fz,
      size: 1.15,
      tint: "#f3efe6",
    });
    // T036: N glazed-tile children in a 2×2 pad grid (color-visible, countable at a glance).
    const GRID: ReadonlyArray<readonly [number, number]> = [
      [-0.3, -0.3], [0.3, -0.3],
      [-0.3, 0.3], [0.3, 0.3],
    ];
    tiles.forEach((color, ti) => {
      const [ox, oz] = GRID[ti % 4] ?? [0, 0];
      const layer = Math.floor(ti / 4);
      const pick = firstLegal(legal, "draft", (p) => p.source === "factory" && p.factoryId === fi && p.color === color)
        ?? (legal === undefined ? { type: "draft", payload: { source: "factory", factoryId: fi, color, line: 0 } } : undefined);
      pieces.push({
        id: `factory:${fi}:tile:${ti}`,
        objectKind: "tile",
        x: fx + ox,
        z: fz + oz,
        y: 0.14 + layer * 0.12,  // T047: on-pad stack above playTop
        size: 0.50,
        tint: PATTERN_TINT[color] ?? "#64748b",
        ...(pick ? { action: { type: pick.type, payload: { ...(pick.payload ?? {}) } }, emphasis: true } : {}),
      });
    });
    const colorOrder = [...new Set(tiles)];
        for (const color of colorOrder) {
      const pick = firstLegal(legal, "draft", (p) => p.source === "factory" && p.factoryId === fi && p.color === color);
      if (legal !== undefined && !pick) continue;
      const action = pick
        ? { type: pick.type, payload: { ...(pick.payload ?? {}) } }
        : { type: "draft", payload: { source: "factory", factoryId: fi, color, line: 0 } };
      hints.push({
        id: `draft:factory:${fi}:${color}`,
        x: fx,
        z: fz,
        radius: 0.4,
        action,
      });
    }
  });

  // T076 · central discard porcelain dish
  pieces.push({
    id: "center:dish",
    objectKind: "plate",
    x: 0,
    z: -0.15,
    y: 0.02,
    size: 1.35,
    tint: "#f5f0e6",
  });

  // Center pile
  state.center.forEach((color, i) => {
    const col = i % 5;
    const row = Math.floor(i / 5);
    const pick = firstLegal(legal, "draft", (p) => p.source === "center" && p.color === color)
      ?? (legal === undefined ? { type: "draft", payload: { source: "center", color, line: 0 } } : undefined);
    pieces.push({
      id: `center:${i}`,
      objectKind: "tile",
      x: -0.6 + col * 0.3,
      z: -0.3 + row * 0.3,
      y: 0.16,
      size: 0.36,
      tint: PATTERN_TINT[color] ?? "#64748b",
      ...(pick ? { action: { type: pick.type, payload: { ...(pick.payload ?? {}) } }, emphasis: true } : {}),
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
      // T074 · no Eng "1st" desk nameplate
      emphasis: true,
    });
  }
  for (const color of new Set(state.center)) {
    const pick = firstLegal(legal, "draft", (p) => p.source === "center" && p.color === color);
    if (legal !== undefined && !pick) continue;
    const action = pick
      ? { type: pick.type, payload: { ...(pick.payload ?? {}) } }
      : { type: "draft", payload: { source: "center", color, line: 0 } };
    hints.push({
      id: `draft:center:${color}`,
      x: 0,
      z: -0.2,
      radius: 0.45,
      action,
    });
  }

  const seatCount = state.seats.length;
  const WALL_N = 5;
  state.seats.forEach((seat, seatId) => {
    const x0 = -3.8 + (seatId - (seatCount - 1) / 2) * Math.min(2.6, 9 / Math.max(seatCount, 1));
    const z0 = 2.4;
    pieces.push({
      id: `seat:${seatId}:marker`,
      objectKind: "worker",
      x: x0,
      z: z0 + 1.15,
      size: 0.5,
      rotationY: Math.PI,
      seat: seatId,
      ...(seat.hasMarker ? { emphasis: true } : {}),
    });
    // T050 · pattern lines (capacity 1..5): empty = recessed slot, filled = glazed tile.
    // Forbid blank solid boards posing as the personal board.
    const lines = seat.lines.length > 0
      ? seat.lines
      : Array.from({ length: WALL_N }, (_, li) => ({
        color: null as string | null,
        tiles: [] as string[],
        capacity: li + 1,
      }));
    // T058 · pattern lines as readable trough strips (not round disc pits); distinct from T054 wall-slot squares.
    lines.forEach((line, li) => {
      const lz = z0 - li * 0.28;
      const cap = Math.max(line.capacity, li + 1, 1);
      // Recessed trough bed under the whole line capacity
      pieces.push({
        id: `seat:${seatId}:line:${li}:trough`,
        objectKind: "line-trough",
        x: x0 - 1.05 + ((cap - 1) * 0.24) / 2,
        z: lz,
        y: 0.012,
        size: Math.max(0.28, cap * 0.24 + 0.06),
        seat: seatId,
        materialKey: "line-trough",
        tint: "#44403c",
      });
      for (let c = 0; c < cap; c++) {
        const filled = c < line.tiles.length;
        if (!filled) continue; // empty = trough bed only (no round pits)
        pieces.push({
          id: `seat:${seatId}:line:${li}:${c}`,
          objectKind: "tile",
          x: x0 - 1.05 + c * 0.24,
          z: lz,
          y: 0.08,
          size: 0.22,
          seat: seatId,
          tint: PATTERN_TINT[line.tiles[c]!] ?? "#a8a29e",
        });
      }
    });
    // T058 · floor row: elongated trough under floor penalty discs
    pieces.push({
      id: `seat:${seatId}:floor:trough`,
      objectKind: "line-trough",
      x: x0 - 0.55,
      z: z0 + 0.7,
      y: 0.01,
      size: 1.4,
      seat: seatId,
      materialKey: "line-trough",
      tint: "#57534e",
    });
    // T050/T054 · 5×5 wall grid: empty = hue print squares (not black disc pits);
    // glazed-on-wall tiles stay color-countable and distinct from empty print.
    // No solid marble `wall:board` region slab (that read as blank seat boards).
    const wall = seat.wall;
    for (let r = 0; r < WALL_N; r++) {
      const row = wall[r] ?? [];
      for (let c = 0; c < WALL_N; c++) {
        const cell = row[c] ?? null;
        const filled = Boolean(cell);
        const print = wallPrintColorAt(r, c);
        pieces.push({
          id: `seat:${seatId}:wall:${r}:${c}`,
          objectKind: filled ? "tile" : "wall-slot",
          x: x0 + 0.45 + c * 0.2,
          z: z0 - r * 0.2,
          y: filled ? 0.07 : 0.02,
          size: filled ? 0.18 : 0.17,
          seat: seatId,
          ...(filled
            ? { tint: PATTERN_TINT[cell!] ?? "#a8a29e" }
            : { tint: WALL_PRINT_TINT[print] ?? "#d6d3d1", materialKey: "wall-print" }),
        });
      }
    }
    // Floor penalties
    seat.floor.forEach((color, fi) => {
      pieces.push({
        id: `seat:${seatId}:floor:${fi}`,
        objectKind: "disc",
        x: x0 - 1.05 + fi * 0.2,
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
    activeFloorLots?: ReadonlyArray<{ lotId?: string; name?: string; artistId?: string; reserve?: number; highBid?: number }>;
    currentMode?: string;
    round?: number;
    roundsToEnd?: number;
    auctionHand?: ReadonlyArray<ReadonlyArray<{ id?: string; name?: string; artistId?: string; instanceId?: string; reserve?: number }>>;
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
      objectKind: "lot",
      x: companion ? -0.7 : 0,
      z: -0.35,
      size: 1.75,
      label: encodeLotArt({
        title: String(lot.name ?? "拍品"),
        reserve: lot.reserve,
        artistId: (lot as { artistId?: string }).artistId,
        bid: state.currentBid,
      }),
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
      objectKind: "lot",
      x: 0.75,
      z: -0.35,
      size: 1.1,
      label: encodeLotArt({
        title: String(companion.name ?? "配对"),
        artistId: (companion as { artistId?: string }).artistId,
      }),
    });
  }

  // T043: phase/mode lives in desk-stage HUD — forbid persistent desktop "open r1" tokens.

  // Live multi-lot floor → framed art boards (gallery T024 path; currentLot may be null).
  const floorLots = gallery?.activeFloorLots ?? [];
  if (floorLots.length > 0) {
    floorLots.slice(0, 3).forEach((fl, i) => {
      const x = floorLots.length === 1 ? 0 : -1.1 + i * 1.2;
      pieces.push({
        id: `lot:floor:${fl.lotId ?? i}`,
        objectKind: "lot",
        x,
        z: -0.35,
        size: floorLots.length === 1 ? 1.65 : 1.35,
        label: encodeLotArt({
          title: String(fl.name ?? "拍品"),
          reserve: fl.reserve,
          artistId: fl.artistId,
          bid: fl.highBid ?? state.currentBid,
        }),
        emphasis: true,
        action: {
          type: "floor_raise",
          payload: {
            lotId: fl.lotId,
            amount: Math.max(1, (fl.highBid ?? fl.reserve ?? state.currentBid ?? 0) + 1),
          },
        },
      });
    });
  } else if (!lot && gallery && (state.phase === "offer" || !state.phase)) {
    // Offer phase: show auctioneer hand as framed mini boards (procedural art; playable).
    const auctioneer = gallery.auctioneer ?? 0;
    const hand = gallery.auctionHand?.[auctioneer] ?? [];
    hand.slice(0, 4).forEach((painting, i) => {
      const x = -1.8 + i * 1.2;
      pieces.push({
        id: `lot:hand:${painting.instanceId ?? painting.id ?? i}`,
        objectKind: "lot",
        x,
        z: -0.2,
        size: 0.95,
        label: encodeLotArt({
          title: String(painting.name ?? "手牌"),
          reserve: painting.reserve,
          artistId: painting.artistId,
        }),
        action: {
          type: "play_painting",
          payload: { instanceId: painting.instanceId ?? painting.id, mode: gallery.currentMode ?? "open" },
        },
      });
    });
  }


  // Artist market track: framed mini boards with readable price (not raw name:price discs).
  (gallery?.artists ?? []).forEach((artist, i) => {
    const price = gallery?.marketPrices?.[artist.id ?? ""] ?? 0;
    const n = (gallery?.artists ?? []).length || 1;
    pieces.push({
      id: `artist:${artist.id ?? i}`,
      objectKind: "plaque",
      x: -3.4 + i * Math.min(1.7, 8 / n),
      z: -3.15,
      size: 0.72,
      tint: ARTIST_TINT[i % ARTIST_TINT.length],
      label: encodePlaqueFace({
        title: String(artist.name ?? artist.id ?? `A${i}`),
        prestige: price,
      }),
    });
  });

  // Current bid chip near lot (readable) — not a phase debug string.
  if (lot && (state.currentBid ?? 0) > 0) {
    pieces.push({
      id: "auction:bid",
      objectKind: "resource",
      x: companion ? -0.7 : 0,
      z: 0.55,
      size: 0.38,
      tint: "#eab308",
      emphasis: true,
    });
  }

  const seatCount = state.chips.length;
  state.chips.forEach((chips, seatId) => {
    const { x0, zMeeple, zOwned } = seatTableauOrigin(seatId, seatCount, { span: 2.2, zMeeple: 2.5, depth: 0.7 });
    const high = state.highBidder === seatId;
    pieces.push({
      id: `seat:${seatId}:marker`,
      objectKind: "worker",
      x: x0,
      z: zMeeple + 0.55,
      size: high ? 0.6 : 0.5,
      rotationY: Math.PI,
      seat: seatId,
      ...(high ? { emphasis: true } : {}),
      ...(gallery?.auctioneer === seatId ? { tint: "#f59e0b" } : {}),
    });
    // T036: chip towers beside tableau
    const stack = Math.max(1, Math.min(Math.max(1, Math.floor(chips / 20) || (chips > 0 ? 1 : 0)), 6));
    if (chips > 0) {
      for (let s = 0; s < stack; s++) {
        pieces.push({
          id: `seat:${seatId}:chip:${s}`,
          objectKind: "resource",
          x: x0 - 0.95,
          z: zOwned + 0.2,
          y: 0.05 + s * 0.07,
          size: 0.3,
          seat: seatId,
          tint: "#eab308",
        });
      }
    }
    // T052/T056 · owned lots as readable seat-front framed-art (frame+canvas), not meeple/white-placard stand-ins.
    // Place just inward of meeple (camera-visible) with gallery-class scale — not tiny 0.42 thumbs lost at glancing angle.
    const collection = gallery?.collection?.[seatId] ?? [];
    collection.slice(0, 5).forEach((painting, pi) => {
      const n = Math.min(collection.length, 5);
      const step = Math.min(0.9, 2.4 / Math.max(n, 1));
      pieces.push({
        id: `seat:${seatId}:coll:${pi}`,
        objectKind: "lot",
        x: x0 - ((n - 1) * step) / 2 + pi * step,
        z: zMeeple - 0.2,
        y: 0.14,
        size: 1.65,
        seat: seatId,
        emphasis: true,
        label: encodeLotArt({ title: String(painting.name ?? "藏品"), artistId: painting.artistId }),
      });
    });
    // Hand cards sit inward of owned framed-art so seat-front collection stays visible (T056).
    const hand = gallery?.auctionHand?.[seatId] ?? [];
    hand.slice(0, 4).forEach((painting, hi) => {
      pieces.push({
        id: `seat:${seatId}:hand:${hi}`,
        objectKind: "card",
        x: x0 - 0.35 + hi * 0.28,
        z: zOwned - 0.45,
        y: 0.05,
        size: 0.32,
        seat: seatId,
        tint: "#bfdbfe",
        label: encodeCardFace({ title: String(painting.name ?? "手牌") }),
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
