/**
 * Topology stubs for genre adapters (PR4).
 *
 * Public play-kernel never interprets hex/grid itself. PR5 (Othello) fills
 * grid directional flips; PR6 (Catan) fills hex tile/vertex/edge. Stubs only.
 */

export type TopologyKind = "none" | "grid" | "hex" | "graph";

/** Rectangular grid coordinates — Othello/Reversi will use these in PR5. */
export type GridCoord = { row: number; col: number };

export type GridTopologyStub = {
  kind: "grid";
  rows: number;
  cols: number;
  /** Eight-direction step vectors; concrete flip rules stay in the genre adapter. */
  directions: readonly GridCoord[];
};

/** Hex axial coordinates — Catan will use these in PR6. Not required by public kernel. */
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
