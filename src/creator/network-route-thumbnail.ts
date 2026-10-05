/**
 * Deterministic SVG data-URL thumbnails for network-route lobby cards.
 * Map felt + sample claimed routes + amber terminals — polish bar matches #79/#80/#85.
 */

import {
  DEFAULT_NETWORK_CITIES,
  DEFAULT_NETWORK_EDGES,
  NETWORK_ROUTE_TERMINALS,
  createDefaultClaims,
  type NetworkCity,
  type NetworkEdgeDef,
} from "../runtime/adapters/network-route";

type NetworkRouteSessionSlice = {
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

/** Illustrative mid-game claims for lobby readability only (not live session). */
const THUMB_SAMPLE_CLAIMS: Record<string, 0 | 1> = {
  "A|B": 0,
  "B|D": 0,
  "A|C": 1,
};

const SEAT_COLOR = ["#2563eb", "#ea580c"] as const;

export function networkRouteStartingBoardThumbnailDataUrl(): string {
  const cities = DEFAULT_NETWORK_CITIES;
  const edges = DEFAULT_NETWORK_EDGES;
  const size = 128;
  const pad = 12;
  const maxX = Math.max(...cities.map((c) => c.x));
  const maxY = Math.max(...cities.map((c) => c.y));
  const scale = (size - pad * 2) / Math.max(maxX, maxY);
  const map = (x: number, y: number) => ({
    x: pad + x * scale,
    y: pad + y * scale,
  });
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img">`,
    `<defs>`,
    `<linearGradient id="nrFelt" x1="0" y1="0" x2="0" y2="1">`,
    `<stop offset="0%" stop-color="#1e3a5f"/>`,
    `<stop offset="100%" stop-color="#0f172a"/>`,
    `</linearGradient>`,
    `<radialGradient id="nrVignette" cx="50%" cy="45%" r="65%">`,
    `<stop offset="0%" stop-color="#334155" stop-opacity="0.35"/>`,
    `<stop offset="100%" stop-color="#020617" stop-opacity="0.55"/>`,
    `</radialGradient>`,
    `</defs>`,
    `<rect width="${size}" height="${size}" rx="12" fill="url(#nrFelt)"/>`,
    `<rect width="${size}" height="${size}" rx="12" fill="url(#nrVignette)"/>`,
  ];
  for (const edge of edges) {
    const from = cities.find((c) => c.id === edge.from)!;
    const to = cities.find((c) => c.id === edge.to)!;
    const a = map(from.x, from.y);
    const b = map(to.x, to.y);
    const owner = THUMB_SAMPLE_CLAIMS[edge.id];
    const stroke =
      owner === 0 || owner === 1 ? SEAT_COLOR[owner] : "#64748b";
    const width = owner === 0 || owner === 1 ? 3.2 : 1.6;
    const opacity = owner === 0 || owner === 1 ? 1 : 0.55;
    parts.push(
      `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" opacity="${opacity}"/>`,
    );
  }
  for (const city of cities) {
    const p = map(city.x, city.y);
    const terminal =
      city.id === NETWORK_ROUTE_TERMINALS[0] ||
      city.id === NETWORK_ROUTE_TERMINALS[1];
    if (terminal) {
      parts.push(
        `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="7.5" fill="none" stroke="#fbbf24" stroke-width="1.4" opacity="0.7"/>`,
      );
    }
    parts.push(
      `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${terminal ? 5.2 : 3.4}" fill="${terminal ? "#0f172a" : "#1e293b"}" stroke="${terminal ? "#fbbf24" : "#94a3b8"}" stroke-width="${terminal ? 1.6 : 1}"/>`,
    );
  }
  parts.push("</svg>");
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(parts.join(""))}`;
}
