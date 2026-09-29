/**
 * Deterministic SVG data-URL thumbnails for disc-flipping (Othello) lobby cards.
 * No binary assets — pure SVG encoded as a data URL.
 */

import {
  countDiscs,
  createStandardOthelloBoard,
  type OthelloCell,
} from "../runtime/adapters/othello";

export type OthelloSessionSlice = {
  rows: number;
  cols: number;
  board: OthelloCell[][];
  consecutivePasses: number;
  discCounts: [number, number];
  lastMove: { row: number; col: number; flipped: number } | null;
  lastAction: "place" | "pass" | null;
};

/** Starting 8×8 (or custom even) Othello session slice for preview / lobby. */
export function createInitialOthelloSessionSlice(
  rows = 8,
  cols = 8,
): OthelloSessionSlice {
  const board = createStandardOthelloBoard(rows, cols);
  return {
    rows,
    cols,
    board,
    consecutivePasses: 0,
    discCounts: countDiscs(board),
    lastMove: null,
    lastAction: null,
  };
}

/**
 * Compact green-board SVG of the standard opening position.
 * Deterministic for given rows/cols — safe as a lobby card thumbnail.
 */
export function othelloStartingBoardThumbnailDataUrl(
  rows = 8,
  cols = 8,
): string {
  const board = createStandardOthelloBoard(rows, cols);
  return othelloBoardThumbnailDataUrl(board, rows, cols);
}

export function othelloBoardThumbnailDataUrl(
  board: OthelloCell[][],
  rows: number,
  cols: number,
): string {
  const size = 128;
  const pad = 6;
  const inner = size - pad * 2;
  const cell = inner / Math.max(rows, cols);
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img">`,
    `<rect width="${size}" height="${size}" rx="12" fill="#0f6b4c"/>`,
    `<rect x="${pad}" y="${pad}" width="${inner}" height="${inner}" rx="4" fill="#12805c"/>`,
  ];

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = pad + c * cell;
      const y = pad + r * cell;
      parts.push(
        `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}" fill="none" stroke="#0a4d37" stroke-width="0.6"/>`,
      );
      const owner = board[r]?.[c];
      if (owner === 0 || owner === 1) {
        const cx = x + cell / 2;
        const cy = y + cell / 2;
        const radius = cell * 0.32;
        parts.push(
          `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${radius.toFixed(2)}" fill="${owner === 0 ? "#111" : "#f5f5f5"}" stroke="${owner === 0 ? "#333" : "#ccc"}" stroke-width="0.5"/>`,
        );
      }
    }
  }
  parts.push("</svg>");
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(parts.join(""))}`;
}
