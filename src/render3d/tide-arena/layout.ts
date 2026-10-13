/**
 * Tide Arena / 潮阵 — pure board layout (no three.js). World units; y up.
 * 7×4 arena (rows 0–1 enemy half, 2–3 own half), 5-slot bench at the near edge.
 * The viewer always sees their own half near the camera.
 */
import { arenaCell, BENCH_SLOTS, BOARD_COLS, BOARD_ROWS } from "../../runtime/adapters/auto-battler";

export const CELL = 1.15;
export const ARENA_COLS = BOARD_COLS;
export const ARENA_ROWS = BOARD_ROWS * 2;
export const BOARD_Z = -0.6;
export const TILE_TOP = 0.5;
export const FRAME_W = ARENA_COLS * CELL + 0.6;
export const FRAME_D = ARENA_ROWS * CELL + 0.6;
export const BENCH_Z = BOARD_Z + FRAME_D / 2 + (CELL + 0.4) / 2;
export const BENCH_TOP = 0.32;

export type SlotRef = { kind: "cell"; boardIndex: number } | { kind: "bench"; benchIndex: number };

export function arenaWorld(col: number, row: number): { x: number; z: number } {
  return {
    x: (col - (ARENA_COLS - 1) / 2) * CELL,
    z: BOARD_Z + (row - (ARENA_ROWS - 1) / 2) * CELL,
  };
}

/** World position of a board index on the viewer's own (near) or the opponent's (far) half. */
export function boardWorld(own: boolean, boardIndex: number) {
  const cell = arenaCell(own ? 0 : 1, boardIndex);
  return { ...arenaWorld(cell.col, cell.row), y: TILE_TOP };
}

export function benchWorld(benchIndex: number) {
  return { x: (benchIndex - (BENCH_SLOTS - 1) / 2) * CELL, z: BENCH_Z, y: BENCH_TOP };
}

/** Ground-plane hit → own slot (cells of the own half or bench slots); null elsewhere. */
export function slotAt(x: number, z: number): SlotRef | null {
  const half = CELL / 2;
  for (let i = 0; i < BENCH_SLOTS; i += 1) {
    const p = benchWorld(i);
    if (Math.abs(x - p.x) <= half && Math.abs(z - p.z) <= half) return { kind: "bench", benchIndex: i };
  }
  for (let i = 0; i < BOARD_COLS * BOARD_ROWS; i += 1) {
    const p = boardWorld(true, i);
    if (Math.abs(x - p.x) <= half && Math.abs(z - p.z) <= half) return { kind: "cell", boardIndex: i };
  }
  return null;
}

export function sameSlot(a: SlotRef | null, b: SlotRef | null): boolean {
  if (!a || !b || a.kind !== b.kind) return false;
  return a.kind === "cell" ? a.boardIndex === (b as typeof a).boardIndex : a.benchIndex === (b as typeof a).benchIndex;
}

/** Map a drag (source → drop) onto the kernel action it represents; null = snap back. */
export function dragAction(
  from: SlotRef,
  to: SlotRef | "sell" | null,
  occupied: (slot: SlotRef) => boolean,
): { type: string; payload: Record<string, unknown> } | null {
  if (to === "sell") {
    return { type: "sell", payload: from.kind === "cell" ? { boardIndex: from.boardIndex } : { benchIndex: from.benchIndex } };
  }
  if (!to || sameSlot(from, to) || occupied(to)) return null;
  if (from.kind === "bench" && to.kind === "cell") return { type: "place", payload: { benchIndex: from.benchIndex, boardIndex: to.boardIndex } };
  if (from.kind === "cell" && to.kind === "cell") return { type: "move", payload: { from: from.boardIndex, to: to.boardIndex } };
  if (from.kind === "cell" && to.kind === "bench") return { type: "recall", payload: { boardIndex: from.boardIndex } };
  return null; // bench → bench reorder is not a kernel action
}

/** Legal drop slots for a drag source (empty own cells; empty bench slots when lifting from the board). */
export function legalDrops(from: SlotRef, occupied: (slot: SlotRef) => boolean): SlotRef[] {
  const drops: SlotRef[] = [];
  for (let i = 0; i < BOARD_COLS * BOARD_ROWS; i += 1) {
    const slot: SlotRef = { kind: "cell", boardIndex: i };
    if (!occupied(slot)) drops.push(slot);
  }
  if (from.kind === "cell") {
    for (let i = 0; i < BENCH_SLOTS; i += 1) {
      const slot: SlotRef = { kind: "bench", benchIndex: i };
      if (!occupied(slot)) drops.push(slot);
    }
  }
  return drops;
}
