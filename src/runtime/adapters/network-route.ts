/**
 * Thin line / route-network adapter on the public play-kernel (PR11 + T006).
 *
 * Classic scope: claim unclaimed undirected edges on a fixed city graph; first
 * player whose claimed edges form a path between two fixed terminal hubs wins.
 *
 * Freight subset (T006): optional content enables Ticket-to-Ride-style cargo
 * contracts on the same claim graph — accept contracts, claim edges (tolls),
 * deliver when your claims connect contract endpoints, win on reputation.
 * Per-step ship sailing / speed / armor / pirate events remain unsupported
 * (honest notes) — those would distort claim semantics into a movement sim.
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
  SEAT_CAPACITY,
  clampSeatCount,
  makeSeatArray,
  winnerByHighestScore,
} from "../seat-capacity";
import {
  createGraphTopologyStub,
  type GraphTopologyStub,
} from "../topology-stub";
import {
  applyDrawTickets,
  applyDrawTrains,
  applyTicketsClaim,
  buildTicketsState,
  cloneTicketsState,
  computeFinalScores,
  defaultTicketsContent,
  type NetworkRouteTicketsContent,
  type NetworkRouteTicketsState,
  type TrainColor,
  TRAIN_COLORS,
} from "./network-route-tickets";

export {
  defaultTicketsContent,
  ideaRequestsTicketsRoute,
  ticketsUnsupportedNotes,
  defaultDestinationTickets,
  defaultTicketsEdgeMeta,
  DEFAULT_LENGTH_SCORES,
  TICKETS_ROUTE_CUES,
  TRAIN_COLORS,
  type NetworkRouteTicketsContent,
  type NetworkRouteTicketsState,
  type DestinationTicketDef,
  type TrainColor,
  type RouteEdgeColor,
  type TrainCardColor,
} from "./network-route-tickets";

export const NETWORK_ROUTE_KERNEL_TYPE = "network-route-v1" as const;

const NETWORK_ROUTE_PHASES = [
  { id: "play", name: "Play" },
  { id: "ended", name: "Ended" },
] as const;

/** Fixed terminal hubs — first claimed path between these wins (classic mode). */
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

/** Cargo contract template (content). */
export type FreightContractDef = {
  id: string;
  name: string;
  from: string;
  to: string;
  reward: number;
  reputation: number;
  kind?: string;
};

/** Ship type (content). cargo = max concurrent accepted contracts. */
export type ShipDef = {
  id: string;
  name: string;
  cargo: number;
  speed: number;
  armor: number;
};

export type NetworkRouteContent = {
  contracts: FreightContractDef[];
  ships: ShipDef[];
  winReputation: number;
  startingFunds: number;
  startingReputation?: number;
  /** edgeId → toll cost when claiming */
  edgeTolls?: Record<string, number>;
};

export type FreightContractInstance = FreightContractDef & {
  instanceId: string;
};

export type NetworkRouteFreightState = {
  funds: number[];
  reputation: number[];
  /** Ship def ids owned per seat (starts with one). */
  shipIds: string[][];
  hand: FreightContractInstance[][];
  market: FreightContractInstance[];
  deck: FreightContractInstance[];
  winReputation: number;
  shipsCatalog: ShipDef[];
  edgeTolls: Record<string, number>;
  lastDelivery: {
    playerId: PlayerId;
    contractId: string;
    name: string;
    reward: number;
    reputation: number;
  } | null;
};

type NetworkRouteConfig = {
  playerCount: number;
  terminalFrom: string;
  terminalTo: string;
  freight: boolean;
  tickets: boolean;
  content: NetworkRouteContent | null;
  ticketsContent: NetworkRouteTicketsContent | null;
};

export type NetworkRouteGenre = {
  cities: NetworkCity[];
  edges: NetworkEdgeDef[];
  /** edgeId → owning playerId, or null if unclaimed. */
  claims: Record<string, PlayerId | null>;
  terminalFrom: string;
  terminalTo: string;
  lastClaim: { edgeId: string; playerId: PlayerId } | null;
  routeCounts: number[];
  freight: NetworkRouteFreightState | null;
  tickets: NetworkRouteTicketsState | null;
};

/** Generic logistics cues (not starport-specific). */
export const LOGISTICS_FREIGHT_CUES =
  /货运合约|派车运货|船型|信誉\s*\d+|物流竞速|物流路线|星港节点|freight\s*contract|cargo\s*contract|reputation\s*(?:to\s*)?(?:win|10)|convoy|运货/i;

export function ideaRequestsFreightLogistics(idea: string): boolean {
  return LOGISTICS_FREIGHT_CUES.test(idea);
}

export function defaultFreightShips(): ShipDef[] {
  return [
    { id: "barge", name: "驳船", cargo: 1, speed: 1, armor: 1 },
    { id: "cutter", name: "快艇", cargo: 1, speed: 2, armor: 1 },
    { id: "armed", name: "武装商船", cargo: 2, speed: 1, armor: 2 },
    { id: "ore_barge", name: "巨型矿驳", cargo: 3, speed: 1, armor: 2 },
  ];
}

/** Build a small contract deck over the fixed graph (generic, not themed). */
export function defaultFreightContracts(
  cities: readonly NetworkCity[] = DEFAULT_NETWORK_CITIES,
): FreightContractDef[] {
  const ids = cities.map((c) => c.id);
  const pairs: Array<[string, string, number, number, string]> = [
    ["A", "F", 8, 2, "普通货"],
    ["A", "D", 5, 1, "普通货"],
    ["A", "E", 5, 1, "普通货"],
    ["B", "F", 6, 1, "普通货"],
    ["C", "F", 6, 1, "普通货"],
    ["B", "E", 4, 1, "易碎"],
    ["C", "D", 4, 1, "易碎"],
    ["A", "C", 3, 1, "普通货"],
    ["B", "D", 3, 1, "普通货"],
    ["D", "E", 7, 2, "违禁"],
    ["B", "C", 3, 1, "普通货"],
    ["E", "F", 4, 1, "易碎"],
  ];
  const nameOf = (id: string) => cities.find((c) => c.id === id)?.name ?? id;
  return pairs
    .filter(([a, b]) => ids.includes(a) && ids.includes(b))
    .map(([from, to, reward, reputation, kind], i) => ({
      id: `contract_${from}_${to}_${i}`,
      name: `${kind}·${nameOf(from)}→${nameOf(to)}`,
      from,
      to,
      reward,
      reputation,
      kind,
    }));
}

export function defaultFreightContent(overrides?: Partial<NetworkRouteContent>): NetworkRouteContent {
  return {
    contracts: overrides?.contracts ?? defaultFreightContracts(),
    ships: overrides?.ships ?? defaultFreightShips(),
    winReputation: overrides?.winReputation ?? 10,
    startingFunds: overrides?.startingFunds ?? 20,
    startingReputation: overrides?.startingReputation ?? 0,
    edgeTolls: overrides?.edgeTolls ?? {
      "B|E": 2,
      "C|D": 2,
      "B|C": 1,
    },
  };
}

/** Parse winReputation / startingFunds from NL when present. */
export function parseFreightTuningFromIdea(idea: string): Partial<NetworkRouteContent> {
  const out: Partial<NetworkRouteContent> = {};
  // Prefer win-condition phrasing; fall back to the largest 信誉 N in the text
  // (opening "信誉 0" must not override "先达到信誉 10").
  const repNums = [...idea.matchAll(/信誉\s*(\d+)/g)].map((m) => Number(m[1]));
  const winExplicit = idea.match(/(?:先达到|目标)\s*信誉\s*(\d+)/);
  if (winExplicit) out.winReputation = Math.max(1, Number(winExplicit[1]));
  else if (repNums.length) {
    const positive = repNums.filter((n) => n > 0);
    out.winReputation = Math.max(1, ...(positive.length ? positive : repNums));
  }
  const startFunds = idea.match(/(?:资金|金币)\s*(\d+)/);
  // Prefer opening funds (often "资金 20"); take first mention as starting stash.
  if (startFunds) out.startingFunds = Math.max(0, Number(startFunds[1]));
  return out;
}

export function freightUnsupportedNotes(): string[] {
  return [
    "network-route-v1 freight subset: claim-graph cargo contracts, ship cargo slots, funds/reputation; per-step sailing / ship speed & armor combat / pirate·storm events unsupported.",
  ];
}

function shuffleWithSeed<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  const rng = createSeededRng(seed);
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = rng.at(i + 1) % (i + 1);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

function instantiateDeck(contracts: FreightContractDef[], seed: number): FreightContractInstance[] {
  return shuffleWithSeed(contracts, seed).map((c, i) => ({
    ...c,
    instanceId: `${c.id}#${i}`,
  }));
}

function cargoCapacity(shipIds: string[], catalog: ShipDef[]): number {
  let cap = 0;
  for (const id of shipIds) {
    const ship = catalog.find((s) => s.id === id);
    cap += ship?.cargo ?? 1;
  }
  return Math.max(1, cap);
}

function refillMarket(freight: NetworkRouteFreightState): void {
  while (freight.market.length < 3 && freight.deck.length > 0) {
    freight.market.push(freight.deck.shift()!);
  }
}

function tryDeliveries(
  claims: Record<string, PlayerId | null>,
  edges: readonly NetworkEdgeDef[],
  freight: NetworkRouteFreightState,
  playerId: PlayerId,
): NetworkRouteFreightState {
  const next: NetworkRouteFreightState = {
    ...freight,
    funds: [...freight.funds],
    reputation: [...freight.reputation],
    shipIds: freight.shipIds.map((s) => s.slice()),
    hand: freight.hand.map((h) => h.slice()),
    market: freight.market.map((c) => ({ ...c })),
    deck: freight.deck.map((c) => ({ ...c })),
    shipsCatalog: freight.shipsCatalog.map((s) => ({ ...s })),
    edgeTolls: { ...freight.edgeTolls },
    lastDelivery: freight.lastDelivery,
  };
  const hand = next.hand[playerId]!;
  const kept: FreightContractInstance[] = [];
  for (const contract of hand) {
    const done = playerConnectsTerminals(
      claims,
      edges,
      playerId,
      contract.from,
      contract.to,
    );
    if (!done) {
      kept.push(contract);
      continue;
    }
    next.funds[playerId] = next.funds[playerId]! + contract.reward;
    next.reputation[playerId] =
      next.reputation[playerId]! + contract.reputation;
    next.lastDelivery = {
      playerId,
      contractId: contract.id,
      name: contract.name,
      reward: contract.reward,
      reputation: contract.reputation,
    };
  }
  next.hand[playerId] = kept;
  return next;
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
  const cap = SEAT_CAPACITY["network-route-v1"];
  if (
    !Number.isInteger(playerCount) ||
    (playerCount as number) < cap.min ||
    (playerCount as number) > cap.max ||
    !terminalFrom ||
    !terminalTo ||
    terminalFrom === terminalTo
  ) {
    return null;
  }
  const contentRaw = raw.content;
  let content: NetworkRouteContent | null = null;
  if (contentRaw && typeof contentRaw === "object") {
    const c = contentRaw as Record<string, unknown>;
    const contracts = Array.isArray(c.contracts) ? c.contracts : null;
    const ships = Array.isArray(c.ships) ? c.ships : null;
    if (contracts && ships && contracts.length > 0 && ships.length > 0) {
      content = {
        contracts: contracts as FreightContractDef[],
        ships: ships as ShipDef[],
        winReputation:
          typeof c.winReputation === "number" ? c.winReputation : 10,
        startingFunds:
          typeof c.startingFunds === "number" ? c.startingFunds : 20,
        startingReputation:
          typeof c.startingReputation === "number" ? c.startingReputation : 0,
        edgeTolls:
          c.edgeTolls && typeof c.edgeTolls === "object"
            ? (c.edgeTolls as Record<string, number>)
            : {},
      };
    }
  }
  const freight =
    raw.freight === true ||
    (content !== null && content.contracts.length > 0);
  let ticketsContent: NetworkRouteTicketsContent | null = null;
  const tcRaw = raw.ticketsContent;
  if (tcRaw && typeof tcRaw === "object") {
    ticketsContent = defaultTicketsContent(tcRaw as Partial<NetworkRouteTicketsContent>);
  }
  const tickets =
    !freight &&
    (raw.tickets === true || ticketsContent !== null);
  if (tickets && !ticketsContent) {
    ticketsContent = defaultTicketsContent();
  }
  return {
    playerCount: clampSeatCount(playerCount as number, cap),
    terminalFrom,
    terminalTo,
    freight,
    tickets,
    content,
    ticketsContent,
  };
}

export function createNetworkRouteKernelConfig(input?: {
  playerCount?: number;
  terminalFrom?: string;
  terminalTo?: string;
  freight?: boolean;
  tickets?: boolean;
  content?: NetworkRouteContent | null;
  ticketsContent?: NetworkRouteTicketsContent | null;
}): PlayKernelConfig {
  const content = input?.content ?? null;
  const freight =
    input?.freight === true ||
    (content !== null && content.contracts.length > 0);
  const ticketsContent =
    !freight && (input?.ticketsContent || input?.tickets)
      ? input?.ticketsContent ?? defaultTicketsContent()
      : null;
  const tickets = !freight && (input?.tickets === true || ticketsContent !== null);
  const playerCount = clampSeatCount(
    input?.playerCount ?? 2,
    SEAT_CAPACITY["network-route-v1"],
  );
  return {
    kernelType: NETWORK_ROUTE_KERNEL_TYPE,
    playerCount,
    phases: NETWORK_ROUTE_PHASES.map((phase) => ({ ...phase })),
    adapter: {
      playerCount,
      terminalFrom: input?.terminalFrom ?? NETWORK_ROUTE_TERMINALS[0],
      terminalTo: input?.terminalTo ?? NETWORK_ROUTE_TERMINALS[1],
      freight,
      tickets,
      ...(content ? { content } : {}),
      ...(ticketsContent ? { ticketsContent } : {}),
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
  playerCount = 2,
): number[] {
  const counts = Array.from({ length: playerCount }, () => 0);
  for (const owner of Object.values(claims)) {
    if (typeof owner === "number" && owner >= 0 && owner < playerCount) {
      counts[owner]! += 1;
    }
  }
  return counts;
}

function payloadEdgeId(action: PlayAction): string | null {
  const edgeId = action.payload?.edgeId;
  return typeof edgeId === "string" && edgeId.length > 0 ? edgeId : null;
}

function payloadContractInstanceId(action: PlayAction): string | null {
  const id = action.payload?.instanceId ?? action.payload?.contractInstanceId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function buildFreightState(
  content: NetworkRouteContent,
  seed: number,
  playerCount = 2,
): NetworkRouteFreightState {
  const n = clampSeatCount(playerCount, SEAT_CAPACITY["network-route-v1"]);
  const deck = instantiateDeck(content.contracts, seed ^ 0x9e3779b9);
  const starter = content.ships[0]?.id ?? "barge";
  const startRep = content.startingReputation ?? 0;
  const freight: NetworkRouteFreightState = {
    funds: Array.from({ length: n }, () => content.startingFunds),
    reputation: Array.from({ length: n }, () => startRep),
    shipIds: Array.from({ length: n }, () => [starter]),
    hand: Array.from({ length: n }, () => []),
    market: [],
    deck,
    winReputation: content.winReputation,
    shipsCatalog: content.ships.map((s) => ({ ...s })),
    edgeTolls: { ...(content.edgeTolls ?? {}) },
    lastDelivery: null,
  };
  refillMarket(freight);
  return freight;
}

export const networkRouteAdapter: PlayKernelAdapter<
  NetworkRouteGenre,
  NetworkRouteConfig
> = {
  kernelType: NETWORK_ROUTE_KERNEL_TYPE,

  parseConfig: parseNetworkRouteConfig,

  createGenreState(config, seed, playerCount) {
    const seats = clampSeatCount(
      playerCount,
      SEAT_CAPACITY["network-route-v1"],
    );
    const cities = DEFAULT_NETWORK_CITIES.map((city) => ({ ...city }));
    const edges = DEFAULT_NETWORK_EDGES.map((edge) => ({ ...edge }));
    const freight =
      config.freight && config.content
        ? buildFreightState(config.content, seed, seats)
        : null;
    const tickets =
      !freight && config.tickets && config.ticketsContent
        ? buildTicketsState(config.ticketsContent, seed, seats)
        : null;
    return {
      cities,
      edges,
      claims: createDefaultClaims(edges),
      terminalFrom: config.terminalFrom,
      terminalTo: config.terminalTo,
      lastClaim: null,
      routeCounts: Array.from({ length: seats }, () => 0),
      freight,
      tickets,
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
    const freight = state.genre.freight;
    const tickets = state.genre.tickets;
    const funds = freight ? freight.funds[playerId]! : Infinity;

    if (tickets) {
      legal.push({
        type: "draw_trains",
        label: "Draw train cards",
        payload: {},
      });
      if (tickets.ticketDeck.length > 0) {
        legal.push({
          type: "draw_tickets",
          label: "Draw destination tickets",
          payload: {},
        });
      }
      for (const edge of state.genre.edges) {
        if (state.genre.claims[edge.id] !== null) continue;
        const meta = tickets.edgeMeta[edge.id];
        if (!meta) continue;
        if (tickets.trainsLeft[playerId]! < meta.length) continue;
        const colors: TrainColor[] =
          meta.color === "gray"
            ? [...TRAIN_COLORS]
            : [meta.color as TrainColor];
        for (const payColor of colors) {
          const colored = tickets.trainHand[playerId][payColor] ?? 0;
          const wild = tickets.trainHand[playerId].wild ?? 0;
          if (colored + wild < meta.length) continue;
          if (meta.color !== "gray" && meta.color !== payColor) continue;
          legal.push({
            type: "claim",
            label: `Claim ${edge.from}–${edge.to} (${meta.color}×${meta.length}/${payColor})`,
            payload: { edgeId: edge.id, payColor },
          });
        }
      }
      return legal;
    }

    for (const edge of state.genre.edges) {
      if (state.genre.claims[edge.id] !== null) continue;
      const toll = freight?.edgeTolls[edge.id] ?? 0;
      if (toll > funds) continue;
      legal.push({
        type: "claim",
        label: toll > 0 ? `Claim ${edge.from}–${edge.to} (−${toll})` : `Claim ${edge.from}–${edge.to}`,
        payload: { edgeId: edge.id },
      });
    }

    if (freight) {
      const cap = cargoCapacity(freight.shipIds[playerId]!, freight.shipsCatalog);
      const used = freight.hand[playerId]!.length;
      if (used < cap) {
        for (const contract of freight.market) {
          legal.push({
            type: "accept_contract",
            label: `Accept ${contract.name}`,
            payload: { instanceId: contract.instanceId },
          });
        }
      }
    }
    return legal;
  },

  reduce(state, action) {
    if (state.status !== "active" || action.playerId !== state.activePlayerId) {
      return null;
    }

    const finishTicketsTurn = (
      genreBase: NetworkRouteGenre,
      ticketsNext: NetworkRouteTicketsState,
      actor: PlayerId,
      claimedEdgeId: string | null,
    ) => {
      let tickets = ticketsNext;
      let finalTurnsLeft = tickets.finalTurnsLeft;
      if (
        claimedEdgeId &&
        tickets.trainsLeft[actor]! <= 2 &&
        finalTurnsLeft === null
      ) {
        finalTurnsLeft = state.playerCount; // actor already spent this turn; count remaining incl. wrap
        tickets = { ...tickets, finalTurnsLeft };
      } else if (finalTurnsLeft !== null) {
        finalTurnsLeft = finalTurnsLeft - 1;
        tickets = { ...tickets, finalTurnsLeft };
      }
      const genre: NetworkRouteGenre = {
        ...genreBase,
        tickets,
        freight: null,
      };
      const shouldEnd =
        finalTurnsLeft !== null && finalTurnsLeft <= 0
          ? true
          : Object.values(genre.claims).every((o) => o !== null);
      if (shouldEnd) {
        const scores = computeFinalScores(
          tickets,
          genre.claims,
          genre.edges,
          playerConnectsTerminals,
        );
        tickets = { ...tickets, finalScore: scores, finalTurnsLeft: 0 };
        const winnerId = winnerByHighestScore(scores) as PlayerId | null;
        return {
          genre: { ...genre, tickets },
          phase: "ended" as PlayPhaseId,
          activePlayerId: actor,
          status: "complete" as const,
          winnerId,
          endReason: "tickets_scored",
        };
      }
      const nextPlayer = ((actor + 1) % state.playerCount) as PlayerId;
      return {
        genre,
        phase: "play" as PlayPhaseId,
        activePlayerId: nextPlayer,
        status: "active" as const,
        winnerId: null,
      };
    };

    if (state.genre.tickets) {
      if (action.type === "draw_trains") {
        const nextTickets = applyDrawTrains(
          state.genre.tickets,
          action.playerId,
          state.sequence + 1,
        );
        if (!nextTickets) return null;
        const genre: NetworkRouteGenre = {
          cities: state.genre.cities.map((c) => ({ ...c })),
          edges: state.genre.edges.map((e) => ({ ...e })),
          claims: { ...state.genre.claims },
          terminalFrom: state.genre.terminalFrom,
          terminalTo: state.genre.terminalTo,
          lastClaim: state.genre.lastClaim
            ? { ...state.genre.lastClaim }
            : null,
          routeCounts: [...state.genre.routeCounts],
          freight: null,
          tickets: nextTickets,
        };
        return finishTicketsTurn(genre, nextTickets, action.playerId, null);
      }
      if (action.type === "draw_tickets") {
        const nextTickets = applyDrawTickets(
          state.genre.tickets,
          action.playerId,
        );
        if (!nextTickets) return null;
        const genre: NetworkRouteGenre = {
          cities: state.genre.cities.map((c) => ({ ...c })),
          edges: state.genre.edges.map((e) => ({ ...e })),
          claims: { ...state.genre.claims },
          terminalFrom: state.genre.terminalFrom,
          terminalTo: state.genre.terminalTo,
          lastClaim: state.genre.lastClaim
            ? { ...state.genre.lastClaim }
            : null,
          routeCounts: [...state.genre.routeCounts],
          freight: null,
          tickets: nextTickets,
        };
        return finishTicketsTurn(genre, nextTickets, action.playerId, null);
      }
      if (action.type === "claim") {
        const edgeId = payloadEdgeId(action);
        const payColor = action.payload?.payColor;
        if (!edgeId || typeof payColor !== "string") return null;
        if (!(edgeId in state.genre.claims)) return null;
        if (state.genre.claims[edgeId] !== null) return null;
        const nextTickets = applyTicketsClaim(
          state.genre.tickets,
          action.playerId,
          edgeId,
          payColor as TrainColor,
        );
        if (!nextTickets) return null;
        const claims = { ...state.genre.claims, [edgeId]: action.playerId };
        const routeCounts = countClaims(claims, state.playerCount);
        const genre: NetworkRouteGenre = {
          cities: state.genre.cities.map((c) => ({ ...c })),
          edges: state.genre.edges.map((e) => ({ ...e })),
          claims,
          terminalFrom: state.genre.terminalFrom,
          terminalTo: state.genre.terminalTo,
          lastClaim: { edgeId, playerId: action.playerId },
          routeCounts,
          freight: null,
          tickets: nextTickets,
        };
        return finishTicketsTurn(genre, nextTickets, action.playerId, edgeId);
      }
      return null;
    }

    if (action.type === "accept_contract") {
      const freight = state.genre.freight;
      if (!freight) return null;
      const instanceId = payloadContractInstanceId(action);
      if (!instanceId) return null;
      const idx = freight.market.findIndex((c) => c.instanceId === instanceId);
      if (idx < 0) return null;
      const cap = cargoCapacity(
        freight.shipIds[action.playerId]!,
        freight.shipsCatalog,
      );
      if (freight.hand[action.playerId]!.length >= cap) return null;

      const nextFreight: NetworkRouteFreightState = {
        ...freight,
        funds: [...freight.funds],
        reputation: [...freight.reputation],
        shipIds: freight.shipIds.map((s) => s.slice()),
        hand: freight.hand.map((h) => h.slice()),
        market: freight.market.map((c) => ({ ...c })),
        deck: freight.deck.map((c) => ({ ...c })),
        shipsCatalog: freight.shipsCatalog.map((s) => ({ ...s })),
        edgeTolls: { ...freight.edgeTolls },
        lastDelivery: null,
      };
      const [taken] = nextFreight.market.splice(idx, 1);
      nextFreight.hand[action.playerId]!.push(taken!);
      refillMarket(nextFreight);

      const genre: NetworkRouteGenre = {
        cities: state.genre.cities.map((city) => ({ ...city })),
        edges: state.genre.edges.map((edge) => ({ ...edge })),
        claims: { ...state.genre.claims },
        terminalFrom: state.genre.terminalFrom,
        terminalTo: state.genre.terminalTo,
        lastClaim: state.genre.lastClaim
          ? { ...state.genre.lastClaim }
          : null,
        routeCounts: [...state.genre.routeCounts],
        freight: nextFreight,
        tickets: null,
      };
      const nextPlayer = ((action.playerId + 1) % state.playerCount) as PlayerId;
      return {
        genre,
        phase: "play" as PlayPhaseId,
        activePlayerId: nextPlayer,
        status: "active" as const,
        winnerId: null,
      };
    }

    if (action.type !== "claim") return null;
    const edgeId = payloadEdgeId(action);
    if (!edgeId) return null;
    if (!(edgeId in state.genre.claims)) return null;
    if (state.genre.claims[edgeId] !== null) return null;

    let freight = state.genre.freight;
    if (freight) {
      const toll = freight.edgeTolls[edgeId] ?? 0;
      if (freight.funds[action.playerId]! < toll) return null;
      freight = {
        ...freight,
        funds: [...freight.funds],
        reputation: [...freight.reputation],
        shipIds: freight.shipIds.map((s) => s.slice()),
        hand: freight.hand.map((h) => h.slice()),
        market: freight.market.map((c) => ({ ...c })),
        deck: freight.deck.map((c) => ({ ...c })),
        shipsCatalog: freight.shipsCatalog.map((s) => ({ ...s })),
        edgeTolls: { ...freight.edgeTolls },
        lastDelivery: null,
      };
      freight.funds[action.playerId] =
        freight.funds[action.playerId]! - toll;
    }

    const claims = { ...state.genre.claims, [edgeId]: action.playerId };
    const routeCounts = countClaims(claims, state.playerCount);

    if (freight) {
      freight = tryDeliveries(
        claims,
        state.genre.edges,
        freight,
        action.playerId,
      );
    }

    const genre: NetworkRouteGenre = {
      cities: state.genre.cities.map((city) => ({ ...city })),
      edges: state.genre.edges.map((edge) => ({ ...edge })),
      claims,
      terminalFrom: state.genre.terminalFrom,
      terminalTo: state.genre.terminalTo,
      lastClaim: { edgeId, playerId: action.playerId },
      routeCounts,
      freight,
      tickets: null,
    };

    // Freight mode: reputation win.
    if (
      freight &&
      freight.reputation[action.playerId]! >= freight.winReputation
    ) {
      return {
        genre,
        phase: "ended" as PlayPhaseId,
        activePlayerId: action.playerId,
        status: "complete" as const,
        winnerId: action.playerId,
        endReason: "reputation_reached",
      };
    }

    // Classic (and freight fallback): terminals connected.
    if (!freight) {
      const connected = playerConnectsTerminals(
        claims,
        state.genre.edges,
        action.playerId,
        state.genre.terminalFrom,
        state.genre.terminalTo,
      );
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
    }

    const remaining = Object.values(claims).some((owner) => owner === null);
    if (!remaining) {
      // Board full: freight → highest reputation; classic → draw.
      if (freight) {
        const [r0, r1] = freight.reputation;
        const winnerId =
          r0 === r1 ? null : ((r0 > r1 ? 0 : 1) as PlayerId | null);
        return {
          genre,
          phase: "ended" as PlayPhaseId,
          activePlayerId: action.playerId,
          status: "complete" as const,
          winnerId,
          endReason: "board_full_reputation",
        };
      }
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
    routeCounts: number[];
    freight: NetworkRouteFreightState | null;
    tickets: NetworkRouteTicketsState | null;
  };
} {
  const freight = state.genre.freight;
  const tickets = state.genre.tickets;
  const scores = tickets
    ? tickets.finalScore
      ? [...tickets.finalScore]
      : [...tickets.routeScore]
    : freight
      ? [...freight.reputation]
      : [...state.genre.routeCounts];
  return {
    turn: state.sequence,
    activeSeat: state.activePlayerId,
    scores,
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
      routeCounts: [...state.genre.routeCounts],
      freight: freight
        ? {
            ...freight,
            funds: [...freight.funds],
            reputation: [...freight.reputation],
            shipIds: [
              freight.shipIds[0].slice(),
              freight.shipIds[1].slice(),
            ] as [string[], string[]],
            hand: [
              freight.hand[0].map((c) => ({ ...c })),
              freight.hand[1].map((c) => ({ ...c })),
            ],
            market: freight.market.map((c) => ({ ...c })),
            deck: freight.deck.map((c) => ({ ...c })),
            shipsCatalog: freight.shipsCatalog.map((s) => ({ ...s })),
            edgeTolls: { ...freight.edgeTolls },
            lastDelivery: freight.lastDelivery
              ? { ...freight.lastDelivery }
              : null,
          }
        : null,
      tickets: tickets ? cloneTicketsState(tickets) : null,
    },
  };
}

export function bindNetworkRouteFromRuntimeKernel(input: {
  playerCount?: number;
  terminalFrom?: string;
  terminalTo?: string;
  freight?: boolean;
  tickets?: boolean;
  content?: NetworkRouteContent | null;
  ticketsContent?: NetworkRouteTicketsContent | null;
}): PlayKernelConfig {
  const playerCount = clampSeatCount(
    input.playerCount ?? 2,
    SEAT_CAPACITY["network-route-v1"],
  );
  return createNetworkRouteKernelConfig({
    playerCount,
    terminalFrom: input.terminalFrom ?? NETWORK_ROUTE_TERMINALS[0],
    terminalTo: input.terminalTo ?? NETWORK_ROUTE_TERMINALS[1],
    freight: input.freight,
    tickets: input.tickets,
    content: input.content ?? null,
    ticketsContent: input.ticketsContent ?? null,
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
  const tickets = state.genre.tickets;
  if (tickets) {
    const claims = legal.filter((a) => a.type === "claim");
    if (claims.length) {
      const choice = claims[random % claims.length]!;
      return {
        type: choice.type,
        playerId: state.activePlayerId,
        ...(choice.payload ? { payload: { ...choice.payload } } : {}),
      };
    }
    const draws = legal.filter((a) => a.type === "draw_trains");
    if (draws.length) {
      return { type: "draw_trains", playerId: state.activePlayerId, payload: {} };
    }
  }
  // Prefer accept when hand empty and market available.
  const accepts = legal.filter((a) => a.type === "accept_contract");
  const freight = state.genre.freight;
  if (
    accepts.length &&
    freight &&
    freight.hand[state.activePlayerId]!.length === 0
  ) {
    const choice = accepts[random % accepts.length]!;
    return {
      type: choice.type,
      playerId: state.activePlayerId,
      ...(choice.payload ? { payload: { ...choice.payload } } : {}),
    };
  }
  const choice = legal[random % legal.length]!;
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
  const maxPlies = DEFAULT_NETWORK_EDGES.length * 8 + 120;
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
