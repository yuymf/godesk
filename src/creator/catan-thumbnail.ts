/**
 * Deterministic SVG data-URL thumbnails for hex-settlement (Catan) lobby cards.
 * No binary assets — pure SVG encoded as a data URL.
 */

import {
  catanAdapter,
  catanBoardGraph,
  catanToSessionFields,
  createBeginnerTiles,
  createCatanKernelConfig,
  type CatanTile,
  type Terrain,
} from "../runtime/adapters/catan";
import { createInitialState } from "../runtime/play-kernel";

type CatanSessionSlice = ReturnType<typeof catanToSessionFields>["catan"];

const TERRAIN_FILL: Record<Terrain, string> = {
  wood: "#2f7d4a",
  brick: "#b85a3a",
  sheep: "#7fbf5a",
  wheat: "#d4b13a",
  ore: "#6b7380",
  desert: "#c9b896",
};

/** Starting beginner-island session slice for preview / lobby. */
export function createInitialCatanSessionSlice(
  playerCount = 2,
): CatanSessionSlice {
  const config = createCatanKernelConfig({ playerCount });
  const state = createInitialState(catanAdapter, config, 0);
  return catanToSessionFields(state).catan;
}

function hexCenter(q: number, r: number, size: number): { x: number; y: number } {
  return {
    x: size * (1.5 * q),
    y: size * ((Math.sqrt(3) / 2) * q + Math.sqrt(3) * r),
  };
}

function parseVertex(id: string): { x: number; y: number } | null {
  const [xs, ys] = id.split(":");
  const x = Number(xs);
  const y = Number(ys);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

/**
 * Compact SVG of the radius-2 beginner hex island.
 * Deterministic — safe as a lobby card thumbnail.
 */
export function catanStartingBoardThumbnailDataUrl(): string {
  return catanBoardThumbnailDataUrl(createBeginnerTiles());
}

export function catanBoardThumbnailDataUrl(tiles: CatanTile[]): string {
  const graph = catanBoardGraph();
  const size = 100;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const id of graph.vertexIds) {
    const point = parseVertex(id);
    if (!point) continue;
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  const pad = 40;
  const vbX = minX - pad;
  const vbY = minY - pad;
  const vbW = maxX - minX + pad * 2;
  const vbH = maxY - minY + pad * 2;
  const out = 128;
  const desert = tiles.find((tile) => tile.terrain === "desert");
  const robberHex = desert ? `${desert.q},${desert.r}` : "0,0";

  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${out}" height="${out}" viewBox="${vbX} ${vbY} ${vbW} ${vbH}" role="img">`,
    `<rect x="${vbX}" y="${vbY}" width="${vbW}" height="${vbH}" rx="36" fill="#1a4a6e"/>`,
  ];

  for (const tile of tiles) {
    const key = `${tile.q},${tile.r}`;
    const verts = graph.hexVertices[key] ?? [];
    const points = verts
      .map((id) => {
        const point = parseVertex(id);
        return point ? `${point.x},${point.y}` : "";
      })
      .filter(Boolean)
      .join(" ");
    const fill = TERRAIN_FILL[tile.terrain] ?? "#888";
    parts.push(
      `<polygon points="${points}" fill="${fill}" stroke="#0d2a3d" stroke-width="6"/>`,
    );
    const center = hexCenter(tile.q, tile.r, size);
    if (tile.number !== null) {
      parts.push(
        `<circle cx="${center.x}" cy="${center.y}" r="22" fill="#f5f0e4" stroke="#333" stroke-width="3"/>`,
        `<text x="${center.x}" y="${center.y + 8}" text-anchor="middle" font-size="28" font-family="system-ui,sans-serif" font-weight="700" fill="${tile.number === 6 || tile.number === 8 ? "#b33" : "#222"}">${tile.number}</text>`,
      );
    }
    if (key === robberHex) {
      parts.push(
        `<circle cx="${center.x}" cy="${center.y + (tile.number !== null ? 0 : 0)}" r="14" fill="#1a1a1a"/>`,
      );
    }
  }

  parts.push("</svg>");
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(parts.join(""))}`;
}

/** Re-export terrain palette for the live board (keeps thumbnail + HUD in sync). */
export const CATAN_TERRAIN_FILL = TERRAIN_FILL;
