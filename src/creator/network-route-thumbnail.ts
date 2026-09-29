/**
 * Deterministic SVG data-URL thumbnails for network-route lobby cards.
 */

import {
  DEFAULT_NETWORK_CITIES,
  DEFAULT_NETWORK_EDGES,
  NETWORK_ROUTE_TERMINALS,
  createDefaultClaims,
  type NetworkCity,
  type NetworkEdgeDef,
} from "../runtime/adapters/network-route";

export type NetworkRouteSessionSlice = {
  cities: NetworkCity[];
  edges: NetworkEdgeDef[];
  claims: Record<string, number | null>;
  terminalFrom: string;
  terminalTo: string;
  lastClaim: { edgeId: string; playerId: number } | null;
  routeCounts: [number, number];
};

export function createInitialNetworkRouteSessionSlice(): NetworkRouteSessionSlice {
  const cities = DEFAULT_NETWORK_CITIES.map((city) => ({ ...city }));
  const edges = DEFAULT_NETWORK_EDGES.map((edge) => ({ ...edge }));
  return {
    cities,
    edges,
    claims: createDefaultClaims(edges),
    terminalFrom: NETWORK_ROUTE_TERMINALS[0],
    terminalTo: NETWORK_ROUTE_TERMINALS[1],
    lastClaim: null,
    routeCounts: [0, 0],
  };
}

export function networkRouteStartingBoardThumbnailDataUrl(): string {
  const cities = DEFAULT_NETWORK_CITIES;
  const edges = DEFAULT_NETWORK_EDGES;
  const size = 128;
  const pad = 10;
  const maxX = Math.max(...cities.map((c) => c.x));
  const maxY = Math.max(...cities.map((c) => c.y));
  const scale = (size - pad * 2) / Math.max(maxX, maxY);
  const map = (x: number, y: number) => ({
    x: pad + x * scale,
    y: pad + y * scale,
  });
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img">`,
    `<rect width="${size}" height="${size}" rx="12" fill="#e2e8f0"/>`,
  ];
  for (const edge of edges) {
    const from = cities.find((c) => c.id === edge.from)!;
    const to = cities.find((c) => c.id === edge.to)!;
    const a = map(from.x, from.y);
    const b = map(to.x, to.y);
    parts.push(
      `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="#64748b" stroke-width="2" stroke-linecap="round"/>`,
    );
  }
  for (const city of cities) {
    const p = map(city.x, city.y);
    const terminal =
      city.id === NETWORK_ROUTE_TERMINALS[0] ||
      city.id === NETWORK_ROUTE_TERMINALS[1];
    parts.push(
      `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${terminal ? 5 : 3.5}" fill="${terminal ? "#0f172a" : "#334155"}" stroke="${terminal ? "#f59e0b" : "#94a3b8"}" stroke-width="1.2"/>`,
    );
  }
  parts.push("</svg>");
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(parts.join(""))}`;
}
