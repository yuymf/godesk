/**
 * Thin line / route-network adapter on the public play-kernel (PR11).
 *
 * Scope: claim unclaimed undirected edges on a fixed city graph; first player
 * whose claimed edges form a path between two fixed terminal hubs wins.
 * Not Ticket to Ride (no tickets deck, multi-color routes, or scoring table).
 *
 * Win condition (deterministic): terminals `A` (north) ↔ `F` (south).
 */

import {
  applyAction,
  createInitialState,
  createSeededRng,
  type LegalAction,
  type PlayAction,
  type PlayKernelAdapter,
  type PlayKernelConfig,
  type PlayPhaseId,
  type PlayState,
  type PlayerId,
} from "../play-kernel";
import {
  createGraphTopologyStub,
  type GraphTopologyStub,
} from "../topology-stub";

export const NETWORK_ROUTE_KERNEL_TYPE = "network-route-v1" as const;

export const NETWORK_ROUTE_PHASES = [
  { id: "play", name: "Play" },
  { id: "ended", name: "Ended" },
] as const;

/** Fixed terminal hubs — first claimed path between these wins. */
export const NETWORK_ROUTE_TERMINALS = ["A", "F"] as const;

export type NetworkCity = {
  id: string;
  name: string;
  /** SVG layout (deterministic thumbnail / board). */
  x: number;
  y: number;
};

export type NetworkEdgeDef = {
  id: string;
  from: string;
  to: string;
};

/**
 * Fixed 6-city / 10-edge beginner graph.
 * Cities A–F; terminals A (north) and F (south).
 */
export const DEFAULT_NETWORK_CITIES: readonly NetworkCity[] = [
  { id: "A", name: "北港", x: 200, y: 36 },
  { id: "B", name: "西岭", x: 72, y: 120 },
  { id: "C", name: "东湾", x: 328, y: 120 },
  { id: "D", name: "河谷", x: 72, y: 240 },
  { id: "E", name: "矿山", x: 328, y: 240 },
  { id: "F", name: "南站", x: 200, y: 324 },
];

export const DEFAULT_NETWORK_EDGES: readonly NetworkEdgeDef[] = [
  { id: "A|B", from: "A", to: "B" },
  { id: "A|C", from: "A", to: "C" },
  { id: "B|C", from: "B", to: "C" },
  { id: "B|D", from: "B", to: "D" },
  { id: "B|E", from: "B", to: "E" },
  { id: "C|D", from: "C", to: "D" },
  { id: "C|E", from: "C", to: "E" },
  { id: "D|E", from: "D", to: "E" },
  { id: "D|F", from: "D", to: "F" },
  { id: "E|F", from: "E", to: "F" },
];

export type NetworkRouteConfig = {
  playerCount: number;
  terminalFrom: string;
  terminalTo: string;
};

export type NetworkRouteGenre = {
  cities: NetworkCity[];
  edges: NetworkEdgeDef[];
  /** edgeId → owning playerId, or null if unclaimed. */
  claims: Record<string, PlayerId | null>;
  terminalFrom: string;
  terminalTo: string;
  lastClaim: { edgeId: string; playerId: PlayerId } | null;
  routeCounts: [number, number];
};

export function edgeIdFor(from: string, to: string): string {
  return from < to ? `${from}|${to}` : `${to}|${from}`;
}

export function parseNetworkRouteConfig(
  raw: Record<string, unknown>,
): NetworkRouteConfig | null {
  const playerCount = raw.playerCount ?? 2;
  const terminalFrom =
    typeof raw.terminalFrom === "string"
      ? raw.terminalFrom
      : NETWORK_ROUTE_TERMINALS[0];
  const terminalTo =
    typeof raw.terminalTo === "string"
      ? raw.terminalTo
      : NETWORK_ROUTE_TERMINALS[1];
  if (
    !Number.isInteger(playerCount) ||
    (playerCount as number) !== 2 ||
    !terminalFrom ||
    !terminalTo ||
    terminalFrom === terminalTo
  ) {
    return null;
  }
  return {
    playerCount: playerCount as number,
    terminalFrom,
    terminalTo,
  };
}

export function createNetworkRouteKernelConfig(input?: {
  playerCount?: number;
  terminalFrom?: string;
  terminalTo?: string;
}): PlayKernelConfig {
  return {
    kernelType: NETWORK_ROUTE_KERNEL_TYPE,
    playerCount: input?.playerCount ?? 2,
    phases: NETWORK_ROUTE_PHASES.map((phase) => ({ ...phase })),
    adapter: {
      playerCount: input?.playerCount ?? 2,
      terminalFrom: input?.terminalFrom ?? NETWORK_ROUTE_TERMINALS[0],
      terminalTo: input?.terminalTo ?? NETWORK_ROUTE_TERMINALS[1],
    },
  };
}

export function createDefaultClaims(
  edges: readonly NetworkEdgeDef[] = DEFAULT_NETWORK_EDGES,
): Record<string, PlayerId | null> {
  const claims: Record<string, PlayerId | null> = {};
  for (const edge of edges) claims[edge.id] = null;
  return claims;
}

/** BFS connectivity over edges owned by `playerId`. */
export function playerConnectsTerminals(
  claims: Record<string, PlayerId | null>,
  edges: readonly NetworkEdgeDef[],
  playerId: PlayerId,
  terminalFrom: string,
  terminalTo: string,
): boolean {
  const adj = new Map<string, string[]>();
  for (const edge of edges) {
    if (claims[edge.id] !== playerId) continue;
    if (!adj.has(edge.from)) adj.set(edge.from, []);
    if (!adj.has(edge.to)) adj.set(edge.to, []);
    adj.get(edge.from)!.push(edge.to);
    adj.get(edge.to)!.push(edge.from);
  }
  if (!adj.has(terminalFrom)) return false;
  const seen = new Set<string>([terminalFrom]);
  const queue = [terminalFrom];
  while (queue.length) {
    const node = queue.shift()!;
    if (node === terminalTo) return true;
    for (const next of adj.get(node) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return false;
}

export function countClaims(
  claims: Record<string, PlayerId | null>,
): [number, number] {
  let a = 0;
  let b = 0;
  for (const owner of Object.values(claims)) {
    if (owner === 0) a += 1;
    else if (owner === 1) b += 1;
  }
  return [a, b];
}

function payloadEdgeId(action: PlayAction): string | null {
  const edgeId = action.payload?.edgeId;
  return typeof edgeId === "string" && edgeId.length > 0 ? edgeId : null;
}

export const networkRouteAdapter: PlayKernelAdapter<
  NetworkRouteGenre,
  NetworkRouteConfig
> = {
  kernelType: NETWORK_ROUTE_KERNEL_TYPE,

  parseConfig: parseNetworkRouteConfig,

  createGenreState(config) {
    const cities = DEFAULT_NETWORK_CITIES.map((city) => ({ ...city }));
    const edges = DEFAULT_NETWORK_EDGES.map((edge) => ({ ...edge }));
    return {
      cities,
      edges,
      claims: createDefaultClaims(edges),
      terminalFrom: config.terminalFrom,
      terminalTo: config.terminalTo,
      lastClaim: null,
      routeCounts: [0, 0],
    };
  },

  initialPhase(): PlayPhaseId {
    return "play";
  },

  listLegalActions(state, playerId) {
    if (state.status !== "active" || playerId !== state.activePlayerId) {
      return [];
    }
    const legal: LegalAction[] = [];
    for (const edge of state.genre.edges) {
      if (state.genre.claims[edge.id] !== null) continue;
      legal.push({
        type: "claim",
        label: `Claim ${edge.from}–${edge.to}`,
        payload: { edgeId: edge.id },
      });
    }
    return legal;
  },

  reduce(state, action) {
    if (state.status !== "active" || action.playerId !== state.activePlayerId) {
      return null;
    }
    if (action.type !== "claim") return null;
    const edgeId = payloadEdgeId(action);
    if (!edgeId) return null;
    if (!(edgeId in state.genre.claims)) return null;
    if (state.genre.claims[edgeId] !== null) return null;

    const claims = { ...state.genre.claims, [edgeId]: action.playerId };
    const routeCounts = countClaims(claims);
    const connected = playerConnectsTerminals(
      claims,
      state.genre.edges,
      action.playerId,
      state.genre.terminalFrom,
      state.genre.terminalTo,
    );
    const genre: NetworkRouteGenre = {
      cities: state.genre.cities.map((city) => ({ ...city })),
      edges: state.genre.edges.map((edge) => ({ ...edge })),
      claims,
      terminalFrom: state.genre.terminalFrom,
      terminalTo: state.genre.terminalTo,
      lastClaim: { edgeId, playerId: action.playerId },
      routeCounts,
    };

    if (connected) {
      return {
        genre,
        phase: "ended" as PlayPhaseId,
        activePlayerId: action.playerId,
        status: "complete" as const,
        winnerId: action.playerId,
        endReason: "terminals_connected",
      };
    }

    // No unclaimed edges left → draw (or rare stalemate).
    const remaining = Object.values(claims).some((owner) => owner === null);
    if (!remaining) {
      return {
        genre,
        phase: "ended" as PlayPhaseId,
        activePlayerId: action.playerId,
        status: "complete" as const,
        winnerId: null,
        endReason: "board_full",
      };
    }

    const nextPlayer = ((action.playerId + 1) % state.playerCount) as PlayerId;
    return {
      genre,
      phase: "play" as PlayPhaseId,
      activePlayerId: nextPlayer,
      status: "active" as const,
      winnerId: null,
    };
  },
};

export function networkRouteGraphTopology(): GraphTopologyStub {
  return createGraphTopologyStub(
    DEFAULT_NETWORK_CITIES.map((city) => city.id),
    DEFAULT_NETWORK_EDGES.map((edge) => ({ from: edge.from, to: edge.to })),
  );
}

export function networkRouteToSessionFields(
  state: PlayState<NetworkRouteGenre>,
): {
  turn: number;
  activeSeat: number;
  scores: number[];
  status: "active" | "complete";
  winnerSeat: number | null;
  networkRoute: {
    cities: NetworkCity[];
    edges: NetworkEdgeDef[];
    claims: Record<string, number | null>;
    terminalFrom: string;
    terminalTo: string;
    lastClaim: { edgeId: string; playerId: number } | null;
    routeCounts: [number, number];
  };
} {
  return {
    turn: state.sequence,
    activeSeat: state.activePlayerId,
    scores: [...state.genre.routeCounts],
    status: state.status,
    winnerSeat: state.winnerId,
    networkRoute: {
      cities: state.genre.cities.map((city) => ({ ...city })),
      edges: state.genre.edges.map((edge) => ({ ...edge })),
      claims: { ...state.genre.claims },
      terminalFrom: state.genre.terminalFrom,
      terminalTo: state.genre.terminalTo,
      lastClaim: state.genre.lastClaim
        ? { ...state.genre.lastClaim }
        : null,
      routeCounts: [...state.genre.routeCounts] as [number, number],
    },
  };
}

export function bindNetworkRouteFromRuntimeKernel(input: {
  playerCount?: number;
  terminalFrom?: string;
  terminalTo?: string;
}): PlayKernelConfig {
  const playerCount = input.playerCount ?? 2;
  if (playerCount !== 2) {
    throw new Error("network_route_requires_two_players");
  }
  return createNetworkRouteKernelConfig({
    playerCount,
    terminalFrom: input.terminalFrom ?? NETWORK_ROUTE_TERMINALS[0],
    terminalTo: input.terminalTo ?? NETWORK_ROUTE_TERMINALS[1],
  });
}

export function playActionFromNetworkRouteIntent(
  seat: number,
  actionId: string,
  payload?: Record<string, unknown>,
): PlayAction {
  return {
    type: actionId,
    playerId: seat,
    ...(payload ? { payload } : {}),
  };
}

export function pickNetworkRouteBotAction(
  state: PlayState<NetworkRouteGenre>,
  config: PlayKernelConfig,
  seed: number,
  sequence: number,
): PlayAction | null {
  const parsed = parseNetworkRouteConfig(config.adapter);
  if (!parsed) return null;
  const legal = networkRouteAdapter.listLegalActions(
    state,
    state.activePlayerId,
    parsed,
  );
  if (!legal.length) return null;
  const rng = createSeededRng(seed);
  const random = rng.at(Math.max(sequence, 1));
  const choice = legal[random % legal.length];
  return {
    type: choice.type,
    playerId: state.activePlayerId,
    ...(choice.payload ? { payload: { ...choice.payload } } : {}),
  };
}

export function autoPlayNetworkRouteGame(
  seed: number,
  config: PlayKernelConfig = createNetworkRouteKernelConfig(),
): {
  state: PlayState<NetworkRouteGenre>;
  actions: PlayAction[];
} {
  let state = createInitialState(networkRouteAdapter, config, seed);
  const actions: PlayAction[] = [];
  const maxPlies = DEFAULT_NETWORK_EDGES.length + 2;
  let guard = 0;
  while (state.status === "active" && guard < maxPlies) {
    guard += 1;
    const bot = pickNetworkRouteBotAction(
      state,
      config,
      seed,
      state.sequence + 1,
    );
    if (!bot) break;
    const result = applyAction(networkRouteAdapter, state, bot, config);
    if (!result.ok) {
      throw new Error(`network_route_auto_play_illegal:${result.reason}`);
    }
    actions.push(bot);
    state = result.state;
  }
  return { state, actions };
}
