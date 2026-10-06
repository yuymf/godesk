/**
 * Topology stubs for genre adapters (PR4).
 *
 * Public play-kernel never interprets hex/grid itself. PR5 (Othello) fills
 * grid directional flips; PR6 (Tidewell) fills hex tile/vertex/edge. Stubs only.
 */

/** Rectangular grid coordinates — Othello/Reversi will use these in PR5. */
export type GridCoord = { row: number; col: number };

export type GridTopologyStub = {
  kind: "grid";
  rows: number;
  cols: number;
  /** Eight-direction step vectors; concrete flip rules stay in the genre adapter. */
  directions: readonly GridCoord[];
};

/** Hex axial coordinates — Tidewell will use these in PR6. Not required by public kernel. */
export type HexCoord = { q: number; r: number };

export type HexTopologyStub = {
  kind: "hex";
  /** Axial hex cells; vertices/edges are adapter-private. */
  cells: readonly HexCoord[];
};

export type GraphTopologyStub = {
  kind: "graph";
  nodeIds: readonly string[];
  edges: readonly { from: string; to: string }[];
};

export type TopologyStub =
  | { kind: "none" }
  | GridTopologyStub
  | HexTopologyStub
  | GraphTopologyStub;

/** Standard eight-direction offsets for future disc-flipping adapters. */
export const GRID_EIGHT_DIRECTIONS: readonly GridCoord[] = [
  { row: -1, col: -1 },
  { row: -1, col: 0 },
  { row: -1, col: 1 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
  { row: 1, col: -1 },
  { row: 1, col: 0 },
  { row: 1, col: 1 },
];

export function createGridTopologyStub(rows: number, cols: number): GridTopologyStub {
  return {
    kind: "grid",
    rows,
    cols,
    directions: GRID_EIGHT_DIRECTIONS,
  };
}

/** All axial cells inside a hexagon of the given radius (Tidewell board = 2). */
function hexesInRadius(radius: number): HexCoord[] {
  const cells: HexCoord[] = [];
  for (let q = -radius; q <= radius; q += 1) {
    for (let r = -radius; r <= radius; r += 1) {
      if (Math.abs(q + r) <= radius) cells.push({ q, r });
    }
  }
  return cells;
}

function flatCornerPixel(
  q: number,
  r: number,
  corner: number,
  size = 100,
): { x: number; y: number } {
  const cx = size * (1.5 * q);
  const cy = size * ((Math.sqrt(3) / 2) * q + Math.sqrt(3) * r);
  const angle = (Math.PI / 180) * (60 * corner);
  return {
    x: Math.round(cx + size * Math.cos(angle)),
    y: Math.round(cy + size * Math.sin(angle)),
  };
}

function hexVertexId(q: number, r: number, corner: number): string {
  const { x, y } = flatCornerPixel(q, r, corner);
  return `${x}:${y}`;
}

export type HexBoardGraph = {
  kind: "hex";
  cells: readonly HexCoord[];
  /** Stable vertex ids (pixel-snapped corner keys). */
  vertexIds: readonly string[];
  /** Edge ids as "vA|vB" with vA < vB lexicographically. */
  edgeIds: readonly string[];
  /** vertex → neighboring vertices via an edge. */
  vertexNeighbors: Readonly<Record<string, readonly string[]>>;
  /** vertex → hex cells that touch it. */
  vertexHexes: Readonly<Record<string, readonly HexCoord[]>>;
  /** edge → its two vertex ids. */
  edgeVertices: Readonly<Record<string, readonly [string, string]>>;
  /** hex key "q,r" → its six vertex ids in corner order. */
  hexVertices: Readonly<Record<string, readonly string[]>>;
};

function hexKey(cell: HexCoord): string {
  return `${cell.q},${cell.r}`;
}

function edgeId(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Build tile/vertex/edge incidence for a radius-N hex disc.
 * Public kernel never reads this — adapters own the graph.
 */
export function createHexBoardGraph(radius = 2): HexBoardGraph {
  const cells = hexesInRadius(radius);
  const vertexSet = new Set<string>();
  const edgeSet = new Set<string>();
  const vertexHexMap = new Map<string, HexCoord[]>();
  const hexVertices: Record<string, string[]> = {};
  const edgeVertices: Record<string, [string, string]> = {};
  const neighborMap = new Map<string, Set<string>>();

  const touch = (vertex: string, cell: HexCoord) => {
    const list = vertexHexMap.get(vertex) ?? [];
    if (!list.some((entry) => entry.q === cell.q && entry.r === cell.r)) {
      list.push(cell);
      vertexHexMap.set(vertex, list);
    }
  };

  for (const cell of cells) {
    const corners: string[] = [];
    for (let corner = 0; corner < 6; corner += 1) {
      const id = hexVertexId(cell.q, cell.r, corner);
      vertexSet.add(id);
      corners.push(id);
      touch(id, cell);
    }
    hexVertices[hexKey(cell)] = corners;
    for (let corner = 0; corner < 6; corner += 1) {
      const a = corners[corner];
      const b = corners[(corner + 1) % 6];
      const id = edgeId(a, b);
      edgeSet.add(id);
      edgeVertices[id] = a < b ? [a, b] : [b, a];
      if (!neighborMap.has(a)) neighborMap.set(a, new Set());
      if (!neighborMap.has(b)) neighborMap.set(b, new Set());
      neighborMap.get(a)!.add(b);
      neighborMap.get(b)!.add(a);
    }
  }

  const vertexIds = [...vertexSet].sort();
  const edgeIds = [...edgeSet].sort();
  const vertexNeighbors: Record<string, string[]> = {};
  for (const id of vertexIds) {
    vertexNeighbors[id] = [...(neighborMap.get(id) ?? [])].sort();
  }
  const vertexHexes: Record<string, HexCoord[]> = {};
  for (const id of vertexIds) {
    vertexHexes[id] = (vertexHexMap.get(id) ?? []).map((cell) => ({
      q: cell.q,
      r: cell.r,
    }));
  }

  return {
    kind: "hex",
    cells,
    vertexIds,
    edgeIds,
    vertexNeighbors,
    vertexHexes,
    edgeVertices,
    hexVertices,
  };
}

export function createHexTopologyStub(radius = 2): HexTopologyStub {
  return {
    kind: "hex",
    cells: hexesInRadius(radius),
  };
}

/** Undirected city/route graph — network-route-v1 (PR11) fills this stub. */
export function createGraphTopologyStub(
  nodeIds: readonly string[],
  edges: readonly { from: string; to: string }[],
): GraphTopologyStub {
  return {
    kind: "graph",
    nodeIds: [...nodeIds],
    edges: edges.map((edge) => ({ from: edge.from, to: edge.to })),
  };
}
