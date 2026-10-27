/**
 * hex-island / hex-settlement adapter on the public play-kernel (PR6).
 *
 * Genre/topology/resources/dice/roads live under `genre` only — the public
 * envelope still has no hex/resources/dice required fields. AI and humans
 * share `listLegalActions` → `applyAction`.
 *
 * Basic Settlers subset: fixed beginner board, initial placement, production,
 * robber+discard, build with connectivity/cost, bank/port trade, negotiated
 * player trade (propose → accept/reject, multi-resource), domestic sealed
 * resource auction with multi-party brokerage cut (T023), development cards,
 * VP win at 10. See PR body for deferred.
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
  resolveSealedBids,
  splitBrokerageAward,
  splitNegotiatedBrokerage,
} from "../brokerage";
import {
  createLiveFloorLot,
  passOnLiveLot,
  raiseOnLiveLot,
  setLiveLotBrokerTerms,
  suggestRaiseAmounts,
  type LiveFloorLot,
} from "../auction-floor";
import {
  createHexBoardGraph,
  type HexBoardGraph,
} from "../topology-stub";

export const HEX_SETTLEMENT_KERNEL_TYPE = "hex-settlement-v1" as const;

const HEX_ISLAND_PHASES = [
  { id: "setup", name: "Initial placement" },
  { id: "roll", name: "Roll dice" },
  { id: "discard", name: "Discard on 7" },
  { id: "robber", name: "Move robber" },
  { id: "main", name: "Build / trade" },
  { id: "trade_response", name: "Respond to trade" },
  { id: "domestic_auction", name: "Domestic resource auction" },
  { id: "domestic_live_floor", name: "Domestic live multi-lot floor" },
  { id: "ended", name: "Ended" },
] as const;

export type Resource = "wood" | "brick" | "sheep" | "wheat" | "ore";
export type Terrain = Resource | "desert";
export type DevCardKind = "knight" | "victory" | "road_building";

const RESOURCES: readonly Resource[] = [
  "wood",
  "brick",
  "sheep",
  "wheat",
  "ore",
];

export type ResourceBank = Record<Resource, number>;

type HexIslandConfig = {
  playerCount: number;
  victoryPointsToWin: number;
};

export type HexIslandPlayer = {
  resources: ResourceBank;
  settlements: string[];
  cities: string[];
  roads: string[];
  devCards: DevCardKind[];
  /** Knights played (for largest army). */
  knightsPlayed: number;
  /** Victory-point cards held (secret until win check). */
  vpCards: number;
  /** Dev cards bought this turn — cannot play until next turn. */
  newDevCards: DevCardKind[];
};

export type HexIslandTile = {
  q: number;
  r: number;
  terrain: Terrain;
  number: number | null;
};

type PortKind = "any3" | Resource;

export type HexIslandPort = {
  /** Coastal vertices that grant this port. */
  vertices: string[];
  kind: PortKind;
};

/** Negotiated domestic trade awaiting counterparty response (T014). */
type PendingTrade = {
  from: PlayerId;
  to: PlayerId;
  /** Resources the proposer gives. */
  give: ResourceBank;
  /** Resources the proposer receives. */
  take: ResourceBank;
};

/** Domestic sealed resource auction (T023). */
type PendingAuction = {
  seller: PlayerId;
  /** Lot the seller posts (removed from seller on resolve). */
  lot: ResourceBank;
  reserve: number;
  /** null=pending, number=bid total, -1=pass. Seller slot stays -1. */
  sealedBids: Array<number | null>;
  brokerCutBps: number;
  lastBroker: { seat: number; cut: number } | null;
};

/** Live-floor lot payload: escrowed resource bag (T025). */
type DomesticFloorPayload = {
  lot: ResourceBank;
};

const HEX_MAX_LIVE_LOTS = 2;

export type HexIslandGenre = {
  playerCount: number;
  victoryPointsToWin: number;
  tiles: HexIslandTile[];
  /** Robber occupies this hex key "q,r". */
  robberHex: string;
  ports: HexIslandPort[];
  players: HexIslandPlayer[];
  /** Setup: 0 .. 4*playerCount - 1 (settle/road interleaved). */
  setupStep: number;
  /** Vertex of settlement just placed (road must touch it). */
  pendingRoadVertex: string | null;
  lastDice: [number, number] | null;
  /** Players who still must discard after a 7, in order. */
  discardQueue: PlayerId[];
  /** Cards the active discarder still owes. */
  discardRemaining: number;
  /** Dev card deck (top = end). */
  devDeck: DevCardKind[];
  longestRoadOwner: PlayerId | null;
  largestArmyOwner: PlayerId | null;
  /** Road-building helper: remaining free roads from played card. */
  freeRoadsRemaining: number;
  lastAction: string | null;
  /** Seat whose turn it is (roller); survives discard rotations. */
  turnPlayer: PlayerId;
  /** Open domestic trade offer; phase trade_response while set. */
  pendingTrade: PendingTrade | null;
  /** Open domestic sealed auction; phase domestic_auction while set. */
  pendingAuction: PendingAuction | null;
  /** T025 live multi-lot floor (shared auction-floor). */
  activeFloorLots: Array<LiveFloorLot<DomesticFloorPayload>>;
  lastFloorBroker: { seat: number; cut: number } | null;
};

const EMPTY_BANK = (): ResourceBank => ({
  wood: 0,
  brick: 0,
  sheep: 0,
  wheat: 0,
  ore: 0,
});

function cloneBank(bank: ResourceBank): ResourceBank {
  return { ...bank };
}

function totalResources(bank: ResourceBank): number {
  return RESOURCES.reduce((sum, key) => sum + bank[key], 0);
}

function pay(bank: ResourceBank, cost: Partial<ResourceBank>): ResourceBank | null {
  const next = cloneBank(bank);
  for (const key of RESOURCES) {
    const amount = cost[key] ?? 0;
    if (next[key] < amount) return null;
    next[key] -= amount;
  }
  return next;
}

function canPay(bank: ResourceBank, cost: Partial<ResourceBank>): boolean {
  return pay(bank, cost) !== null;
}

/** Pay `amount` total resources from bank (stable resource order). */
function extractResources(
  bank: ResourceBank,
  amount: number,
): { bank: ResourceBank; paid: ResourceBank } | null {
  if (amount < 0 || totalResources(bank) < amount) return null;
  const next = cloneBank(bank);
  const paid = EMPTY_BANK();
  let remain = amount;
  for (const key of RESOURCES) {
    if (remain <= 0) break;
    const take = Math.min(next[key], remain);
    next[key] -= take;
    paid[key] += take;
    remain -= take;
  }
  if (remain > 0) return null;
  return { bank: next, paid };
}

function addBanks(a: ResourceBank, b: ResourceBank): ResourceBank {
  const out = cloneBank(a);
  for (const key of RESOURCES) out[key] += b[key];
  return out;
}



function addResources(bank: ResourceBank, gain: Partial<ResourceBank>): ResourceBank {
  const next = cloneBank(bank);
  for (const key of RESOURCES) {
    next[key] += gain[key] ?? 0;
  }
  return next;
}

function hexKey(q: number, r: number): string {
  return `${q},${r}`;
}

/** Classic beginner board terrain (radius-2 spiral order matching hexesInRadius sort). */
const BEGINNER_TERRAIN: Terrain[] = [
  // Generated to match sorted axial order of radius-2; values follow a fixed
  // playable beginner layout (not the physical booklet spiral, but legal).
  "ore",
  "sheep",
  "wood",
  "wheat",
  "brick",
  "sheep",
  "brick",
  "wheat",
  "wood",
  "desert",
  "wood",
  "ore",
  "sheep",
  "wheat",
  "brick",
  "ore",
  "wood",
  "sheep",
  "wheat",
];

const BEGINNER_NUMBERS: Array<number | null> = [
  10, 2, 9, 12, 6, 4, 10, 9, 11, null, 3, 8, 8, 3, 4, 5, 5, 6, 11,
];

let CACHED_GRAPH: HexBoardGraph | null = null;

export function hexIslandBoardGraph(): HexBoardGraph {
  if (!CACHED_GRAPH) CACHED_GRAPH = createHexBoardGraph(2);
  return CACHED_GRAPH;
}

export function createBeginnerTiles(): HexIslandTile[] {
  const graph = hexIslandBoardGraph();
  return graph.cells.map((cell, index) => ({
    q: cell.q,
    r: cell.r,
    terrain: BEGINNER_TERRAIN[index] ?? "desert",
    number: BEGINNER_NUMBERS[index] ?? null,
  }));
}

function desertHexKey(tiles: HexIslandTile[]): string {
  const desert = tiles.find((tile) => tile.terrain === "desert");
  return desert ? hexKey(desert.q, desert.r) : "0,0";
}

/** Coastal vertices sorted; assign ports in stable rings for bank/port trade. */
function createBeginnerPorts(graph: HexBoardGraph): HexIslandPort[] {
  const coastal = graph.vertexIds.filter(
    (vertex) => (graph.vertexHexes[vertex] ?? []).length <= 2,
  );
  const kinds: PortKind[] = [
    "any3",
    "wood",
    "any3",
    "brick",
    "any3",
    "sheep",
    "any3",
    "wheat",
    "ore",
  ];
  const ports: HexIslandPort[] = [];
  for (let index = 0; index < kinds.length; index += 1) {
    const a = coastal[(index * 2) % coastal.length];
    const b = coastal[(index * 2 + 1) % coastal.length];
    ports.push({ vertices: [a, b], kind: kinds[index] });
  }
  return ports;
}

function emptyPlayer(): HexIslandPlayer {
  return {
    resources: EMPTY_BANK(),
    settlements: [],
    cities: [],
    roads: [],
    devCards: [],
    knightsPlayed: 0,
    vpCards: 0,
    newDevCards: [],
  };
}

function shuffleDevDeck(seed: number): DevCardKind[] {
  const deck: DevCardKind[] = [
    ...Array.from({ length: 14 }, () => "knight" as const),
    ...Array.from({ length: 5 }, () => "victory" as const),
    ...Array.from({ length: 2 }, () => "road_building" as const),
  ];
  const rng = createSeededRng(seed ^ 0xc00700);
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = rng.next() % (i + 1);
    const tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }
  return deck;
}

export function parseHexIslandConfig(
  raw: Record<string, unknown>,
): HexIslandConfig | null {
  const playerCount = raw.playerCount ?? 2;
  const victoryPointsToWin = raw.victoryPointsToWin ?? 10;
  if (
    !Number.isInteger(playerCount) ||
    (playerCount as number) < 2 ||
    (playerCount as number) > 4
  ) {
    return null;
  }
  if (
    !Number.isInteger(victoryPointsToWin) ||
    (victoryPointsToWin as number) < 5 ||
    (victoryPointsToWin as number) > 15
  ) {
    return null;
  }
  return {
    playerCount: playerCount as number,
    victoryPointsToWin: victoryPointsToWin as number,
  };
}

export function createHexIslandKernelConfig(input?: {
  playerCount?: number;
  victoryPointsToWin?: number;
}): PlayKernelConfig {
  return {
    kernelType: HEX_SETTLEMENT_KERNEL_TYPE,
    playerCount: input?.playerCount ?? 2,
    phases: HEX_ISLAND_PHASES.map((phase) => ({ ...phase })),
    adapter: {
      playerCount: input?.playerCount ?? 2,
      victoryPointsToWin: input?.victoryPointsToWin ?? 10,
    },
  };
}

export function publicVictoryPoints(
  genre: HexIslandGenre,
  playerId: PlayerId,
): number {
  const player = genre.players[playerId];
  let points = player.settlements.length + player.cities.length * 2 + player.vpCards;
  if (genre.longestRoadOwner === playerId) points += 2;
  if (genre.largestArmyOwner === playerId) points += 2;
  return points;
}

function occupiedVertices(genre: HexIslandGenre): Set<string> {
  const set = new Set<string>();
  for (const player of genre.players) {
    for (const vertex of player.settlements) set.add(vertex);
    for (const vertex of player.cities) set.add(vertex);
  }
  return set;
}

function isTooClose(graph: HexBoardGraph, vertex: string, occupied: Set<string>): boolean {
  if (occupied.has(vertex)) return true;
  for (const neighbor of graph.vertexNeighbors[vertex] ?? []) {
    if (occupied.has(neighbor)) return true;
  }
  return false;
}

function playerNetworkVertices(player: HexIslandPlayer, graph: HexBoardGraph): Set<string> {
  const set = new Set<string>();
  for (const vertex of player.settlements) set.add(vertex);
  for (const vertex of player.cities) set.add(vertex);
  for (const road of player.roads) {
    const ends = graph.edgeVertices[road];
    if (ends) {
      set.add(ends[0]);
      set.add(ends[1]);
    }
  }
  return set;
}

function legalSetupSettlements(genre: HexIslandGenre, graph: HexBoardGraph): string[] {
  const occupied = occupiedVertices(genre);
  return graph.vertexIds.filter((vertex) => !isTooClose(graph, vertex, occupied));
}

function legalSetupRoads(
  genre: HexIslandGenre,
  playerId: PlayerId,
  graph: HexBoardGraph,
): string[] {
  const pending = genre.pendingRoadVertex;
  if (!pending) return [];
  const owned = new Set(genre.players.flatMap((player) => player.roads));
  return (graph.vertexNeighbors[pending] ?? [])
    .map((neighbor) => {
      const id =
        pending < neighbor ? `${pending}|${neighbor}` : `${neighbor}|${pending}`;
      return id;
    })
    .filter((id) => graph.edgeVertices[id] && !owned.has(id));
}

function legalMainRoads(
  genre: HexIslandGenre,
  playerId: PlayerId,
  graph: HexBoardGraph,
): string[] {
  const player = genre.players[playerId];
  const network = playerNetworkVertices(player, graph);
  const owned = new Set(genre.players.flatMap((entry) => entry.roads));
  const results: string[] = [];
  for (const edge of graph.edgeIds) {
    if (owned.has(edge)) continue;
    const [a, b] = graph.edgeVertices[edge];
    if (network.has(a) || network.has(b)) results.push(edge);
  }
  return results;
}

function legalMainSettlements(
  genre: HexIslandGenre,
  playerId: PlayerId,
  graph: HexBoardGraph,
): string[] {
  const player = genre.players[playerId];
  const occupied = occupiedVertices(genre);
  const network = playerNetworkVertices(player, graph);
  return graph.vertexIds.filter(
    (vertex) => network.has(vertex) && !isTooClose(graph, vertex, occupied),
  );
}

function roadPathLength(player: HexIslandPlayer, graph: HexBoardGraph): number {
  if (!player.roads.length) return 0;
  const adj = new Map<string, Array<{ to: string; edge: string }>>();
  for (const road of player.roads) {
    const ends = graph.edgeVertices[road];
    if (!ends) continue;
    const [a, b] = ends;
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a)!.push({ to: b, edge: road });
    adj.get(b)!.push({ to: a, edge: road });
  }
  let best = 0;
  const walk = (node: string, used: Set<string>, len: number) => {
    best = Math.max(best, len);
    for (const step of adj.get(node) ?? []) {
      if (used.has(step.edge)) continue;
      used.add(step.edge);
      walk(step.to, used, len + 1);
      used.delete(step.edge);
    }
  };
  for (const start of adj.keys()) walk(start, new Set(), 0);
  return best;
}

function updateAwards(genre: HexIslandGenre, graph: HexBoardGraph): void {
  let longestOwner: PlayerId | null = null;
  let longestLen = 4; // need ≥5 roads worth of path
  for (let seat = 0; seat < genre.playerCount; seat += 1) {
    const len = roadPathLength(genre.players[seat], graph);
    if (len > longestLen || (len === longestLen && len >= 5 && longestOwner === null)) {
      if (len >= 5) {
        longestLen = len;
        longestOwner = seat;
      }
    }
  }
  // Keep previous owner if still tied at max
  if (genre.longestRoadOwner !== null) {
    const current = roadPathLength(genre.players[genre.longestRoadOwner], graph);
    if (current >= 5 && current >= longestLen) longestOwner = genre.longestRoadOwner;
  }
  genre.longestRoadOwner = longestOwner;

  let armyOwner: PlayerId | null = null;
  let armySize = 2; // need ≥3
  for (let seat = 0; seat < genre.playerCount; seat += 1) {
    const size = genre.players[seat].knightsPlayed;
    if (size > armySize) {
      armySize = size;
      armyOwner = seat;
    }
  }
  if (genre.largestArmyOwner !== null) {
    const current = genre.players[genre.largestArmyOwner].knightsPlayed;
    if (current >= 3 && current >= armySize) armyOwner = genre.largestArmyOwner;
  }
  genre.largestArmyOwner = armyOwner;
}

function clonePlayers(players: HexIslandPlayer[]): HexIslandPlayer[] {
  return players.map((player) => ({
    resources: cloneBank(player.resources),
    settlements: [...player.settlements],
    cities: [...player.cities],
    roads: [...player.roads],
    devCards: [...player.devCards],
    knightsPlayed: player.knightsPlayed,
    vpCards: player.vpCards,
    newDevCards: [...player.newDevCards],
  }));
}

function cloneGenre(genre: HexIslandGenre): HexIslandGenre {
  return {
    ...genre,
    tiles: genre.tiles.map((tile) => ({ ...tile })),
    ports: genre.ports.map((port) => ({
      ...port,
      vertices: [...port.vertices],
    })),
    players: clonePlayers(genre.players),
    discardQueue: [...genre.discardQueue],
    devDeck: [...genre.devDeck],
    pendingTrade: genre.pendingTrade
      ? {
          from: genre.pendingTrade.from,
          to: genre.pendingTrade.to,
          give: cloneBank(genre.pendingTrade.give),
          take: cloneBank(genre.pendingTrade.take),
        }
      : null,
    pendingAuction: genre.pendingAuction
      ? {
          seller: genre.pendingAuction.seller,
          lot: cloneBank(genre.pendingAuction.lot),
          reserve: genre.pendingAuction.reserve,
          sealedBids: [...genre.pendingAuction.sealedBids],
          brokerCutBps: genre.pendingAuction.brokerCutBps,
          lastBroker: genre.pendingAuction.lastBroker
            ? { ...genre.pendingAuction.lastBroker }
            : null,
        }
      : null,
    activeFloorLots: (genre.activeFloorLots ?? []).map((lot) => ({
      ...lot,
      passedSinceRaise: [...lot.passedSinceRaise],
      payload: { lot: cloneBank(lot.payload.lot) },
    })),
    lastFloorBroker: genre.lastFloorBroker
      ? { ...genre.lastFloorBroker }
      : null,
  };
}

function setupActiveSeat(genre: HexIslandGenre): PlayerId {
  const n = genre.playerCount;
  const pair = Math.floor(genre.setupStep / 2);
  // Round 1 pairs 0..n-1, round 2 pairs n..2n-1 reversed
  if (pair < n) return pair as PlayerId;
  return (2 * n - 1 - pair) as PlayerId;
}

function collectStartingResources(
  genre: HexIslandGenre,
  playerId: PlayerId,
  vertex: string,
  graph: HexBoardGraph,
): void {
  const player = genre.players[playerId];
  for (const cell of graph.vertexHexes[vertex] ?? []) {
    const tile = genre.tiles.find((entry) => entry.q === cell.q && entry.r === cell.r);
    if (!tile || tile.terrain === "desert") continue;
    player.resources[tile.terrain] += 1;
  }
}

function produceResources(genre: HexIslandGenre, roll: number, graph: HexBoardGraph): void {
  for (const tile of genre.tiles) {
    if (tile.number !== roll) continue;
    if (hexKey(tile.q, tile.r) === genre.robberHex) continue;
    if (tile.terrain === "desert") continue;
    const vertices = graph.hexVertices[hexKey(tile.q, tile.r)] ?? [];
    for (let seat = 0; seat < genre.playerCount; seat += 1) {
      const player = genre.players[seat];
      for (const vertex of vertices) {
        if (player.cities.includes(vertex)) player.resources[tile.terrain] += 2;
        else if (player.settlements.includes(vertex)) player.resources[tile.terrain] += 1;
      }
    }
  }
}

function portRatio(genre: HexIslandGenre, playerId: PlayerId, resource: Resource): number {
  const player = genre.players[playerId];
  const owned = new Set([...player.settlements, ...player.cities]);
  let best = 4;
  for (const port of genre.ports) {
    if (!port.vertices.some((vertex) => owned.has(vertex))) continue;
    if (port.kind === "any3") best = Math.min(best, 3);
    else if (port.kind === resource) best = Math.min(best, 2);
  }
  return best;
}

function maybeEnd(
  genre: HexIslandGenre,
  playerId: PlayerId,
  activePlayerId: PlayerId,
  phase: PlayPhaseId,
): {
  genre: HexIslandGenre;
  phase: PlayPhaseId;
  activePlayerId: PlayerId;
  status: "active" | "complete";
  winnerId: PlayerId | null;
  endReason?: string;
} | null {
  if (publicVictoryPoints(genre, playerId) >= genre.victoryPointsToWin) {
    return {
      genre,
      phase: "ended",
      activePlayerId: playerId,
      status: "complete",
      winnerId: playerId,
      endReason: "victory_points",
    };
  }
  return null;
}

function payloadString(action: PlayAction, key: string): string | null {
  const value = action.payload?.[key];
  return typeof value === "string" ? value : null;
}

function payloadNumber(action: PlayAction, key: string): number | null {
  const value = action.payload?.[key];
  return Number.isInteger(value) ? (value as number) : null;
}

function parseResourceBag(
  payload: Record<string, unknown> | undefined,
  key: string,
): ResourceBank | null {
  const raw = payload?.[key];
  if (!raw || typeof raw !== "object") return null;
  const bag = EMPTY_BANK();
  let any = false;
  for (const resource of RESOURCES) {
    const amount = (raw as Record<string, unknown>)[resource];
    if (amount === undefined) continue;
    if (!Number.isInteger(amount) || (amount as number) < 0) return null;
    bag[resource] = amount as number;
    if ((amount as number) > 0) any = true;
  }
  return any ? bag : null;
}

function canAffordBag(player: HexIslandPlayer, bag: ResourceBank): boolean {
  return RESOURCES.every((resource) => player.resources[resource] >= bag[resource]);
}

function transferBag(
  from: HexIslandPlayer,
  to: HexIslandPlayer,
  bag: ResourceBank,
): void {
  for (const resource of RESOURCES) {
    from.resources[resource] -= bag[resource];
    to.resources[resource] += bag[resource];
  }
}

function formatBag(bag: ResourceBank): string {
  return (
    RESOURCES.filter((resource) => bag[resource] > 0)
      .map((resource) => `${bag[resource]}${resource}`)
      .join("+") || "∅"
  );
}

function previewAfterTrade(
  bank: ResourceBank,
  give: ResourceBank,
  take: ResourceBank,
): ResourceBank {
  const next = cloneBank(bank);
  for (const resource of RESOURCES) {
    next[resource] = next[resource] - give[resource] + take[resource];
  }
  return next;
}

function tradeHelpsBuild(before: ResourceBank, after: ResourceBank): boolean {
  const costs: Array<Partial<ResourceBank>> = [
    { wood: 1, brick: 1 },
    { wood: 1, brick: 1, sheep: 1, wheat: 1 },
    { wheat: 2, ore: 3 },
    { sheep: 1, wheat: 1, ore: 1 },
  ];
  return costs.some(
    (cost) => !canPay(before, cost) && Boolean(canPay(after, cost)),
  );
}

function playableDevCount(player: HexIslandPlayer, kind: DevCardKind): number {
  const held = player.devCards.filter((card) => card === kind).length;
  const fresh = player.newDevCards.filter((card) => card === kind).length;
  return Math.max(0, held - fresh);
}


function awardDomesticFloorLot(
  genre: HexIslandGenre,
  floorLot: LiveFloorLot<DomesticFloorPayload>,
  winner: PlayerId,
  price: number,
): boolean {
  const winnerPlayer = genre.players[winner]!;
  const seller = genre.players[floorLot.seller]!;
  const extracted = extractResources(winnerPlayer.resources, price);
  if (!extracted) return false;
  winnerPlayer.resources = extracted.bank;
  let paid = extracted.paid;
  genre.lastFloorBroker = null;
  const split = splitNegotiatedBrokerage({
    price,
    seller: floorLot.seller,
    winner,
    brokerSeat: floorLot.brokerSeat,
    cutBps: floorLot.brokerCutBps,
  });
  if (split.brokerSeat !== null && split.toBroker > 0) {
    const brokerPay = extractResources(paid, split.toBroker);
    if (brokerPay) {
      paid = brokerPay.bank;
      genre.players[split.brokerSeat]!.resources = addBanks(
        genre.players[split.brokerSeat]!.resources,
        brokerPay.paid,
      );
      genre.lastFloorBroker = { seat: split.brokerSeat, cut: split.toBroker };
    }
  }
  seller.resources = addBanks(seller.resources, paid);
  winnerPlayer.resources = addBanks(winnerPlayer.resources, floorLot.payload.lot);
  genre.activeFloorLots = genre.activeFloorLots.filter(
    (l) => l.lotId !== floorLot.lotId,
  );
  return true;
}

function unsoldDomesticFloorLot(
  genre: HexIslandGenre,
  floorLot: LiveFloorLot<DomesticFloorPayload>,
): void {
  const seller = genre.players[floorLot.seller]!;
  seller.resources = addBanks(seller.resources, floorLot.payload.lot);
  genre.activeFloorLots = genre.activeFloorLots.filter(
    (l) => l.lotId !== floorLot.lotId,
  );
}

function pushDomesticLiveLot(
  genre: HexIslandGenre,
  seller: PlayerId,
  lot: ResourceBank,
  reserve: number,
  brokerSeat: number | null,
  cutBps: number,
): LiveFloorLot<DomesticFloorPayload> {
  const lotId = `dom_${seller}_${Object.entries(lot)
    .filter(([, q]) => q > 0)
    .map(([r, q]) => `${r}${q}`)
    .join("_")}_${genre.activeFloorLots.length}`;
  const floorLot = createLiveFloorLot({
    lotId,
    seller,
    reserve,
    playerCount: genre.playerCount,
    payload: { lot },
    brokerSeat,
    brokerCutBps: cutBps,
  });
  genre.activeFloorLots.push(floorLot);
  return floorLot;
}

export const hexIslandAdapter: PlayKernelAdapter<HexIslandGenre, HexIslandConfig> = {
  kernelType: HEX_SETTLEMENT_KERNEL_TYPE,

  parseConfig: parseHexIslandConfig,

  allowsOffTurnAction(state, action) {
    if (state.phase === "domestic_live_floor") {
      return (
        action.type === "floor_raise" ||
        action.type === "floor_pass" ||
        action.type === "set_broker_terms" ||
        action.type === "start_domestic_auction"
      );
    }
    const auction = state.genre.pendingAuction;
    if (!auction || state.phase !== "domestic_auction") return false;
    if (action.type !== "auction_bid" && action.type !== "auction_pass") {
      return false;
    }
    if (action.playerId === auction.seller) return false;
    return auction.sealedBids[action.playerId] === null;
  },

  createGenreState(config, seed, playerCount) {
    const graph = hexIslandBoardGraph();
    const tiles = createBeginnerTiles();
    return {
      playerCount,
      victoryPointsToWin: config.victoryPointsToWin,
      tiles,
      robberHex: desertHexKey(tiles),
      ports: createBeginnerPorts(graph),
      players: Array.from({ length: playerCount }, () => emptyPlayer()),
      setupStep: 0,
      pendingRoadVertex: null,
      lastDice: null,
      discardQueue: [],
      discardRemaining: 0,
      devDeck: shuffleDevDeck(seed),
      longestRoadOwner: null,
      largestArmyOwner: null,
      freeRoadsRemaining: 0,
      lastAction: null,
      turnPlayer: 0,
      pendingTrade: null,
      pendingAuction: null,
      activeFloorLots: [],
      lastFloorBroker: null,
    };
  },

  initialPhase() {
    return "setup";
  },

  listLegalActions(state, playerId) {
    if (state.status !== "active") return [];
    const genre = state.genre;
    // Harden older session snapshots missing T023/T025 floor fields.
    if (!genre.activeFloorLots) genre.activeFloorLots = [];
    if (genre.pendingAuction === undefined) genre.pendingAuction = null;
    if (genre.lastFloorBroker === undefined) genre.lastFloorBroker = null;
    if (genre.pendingTrade === undefined) genre.pendingTrade = null;
    const auction = genre.pendingAuction;
    const offTurnAuction =
      Boolean(auction) &&
      state.phase === "domestic_auction" &&
      playerId !== auction!.seller &&
      auction!.sealedBids[playerId] === null;
    const offTurnLive = state.phase === "domestic_live_floor";
    if (playerId !== state.activePlayerId && !offTurnAuction && !offTurnLive) {
      return [];
    }
    const graph = hexIslandBoardGraph();
    const phase = state.phase;
    const actions: LegalAction[] = [];

    if (phase === "setup") {
      if (genre.pendingRoadVertex) {
        for (const edge of legalSetupRoads(genre, playerId, graph)) {
          actions.push({
            type: "place_road",
            label: `Setup road ${edge}`,
            payload: { edgeId: edge },
          });
        }
        return actions;
      }
      for (const vertex of legalSetupSettlements(genre, graph)) {
        actions.push({
          type: "place_settlement",
          label: `Setup settlement ${vertex}`,
          payload: { vertexId: vertex },
        });
      }
      return actions;
    }

    if (phase === "roll") {
      actions.push({ type: "roll_dice", label: "Roll dice" });
      // Knights may be played before rolling.
      const player = genre.players[playerId];
      if (playableDevCount(player, "knight") > 0) {
        actions.push({ type: "play_knight", label: "Play knight" });
      }
      return actions;
    }

    if (phase === "discard") {
      const player = genre.players[playerId];
      for (const resource of RESOURCES) {
        if (player.resources[resource] > 0) {
          actions.push({
            type: "discard",
            label: `Discard ${resource}`,
            payload: { resource },
          });
        }
      }
      return actions;
    }

    if (phase === "robber") {
      for (const tile of genre.tiles) {
        const key = hexKey(tile.q, tile.r);
        if (key === genre.robberHex) continue;
        actions.push({
          type: "move_robber",
          label: `Robber ${key}`,
          payload: { hex: key },
        });
      }
      return actions;
    }

    if (phase === "domestic_live_floor") {
      for (const lot of genre.activeFloorLots) {
        if (playerId !== lot.seller) {
          const funds = totalResources(genre.players[playerId]!.resources);
          for (const amount of suggestRaiseAmounts(lot, funds)) {
            actions.push({
              type: "floor_raise",
              label: `Floor raise ${lot.lotId} → ${amount}`,
              payload: { lotId: lot.lotId, amount },
            });
          }
        }
        if (!lot.passedSinceRaise[playerId]) {
          actions.push({
            type: "floor_pass",
            label: `Floor pass ${lot.lotId}`,
            payload: { lotId: lot.lotId },
          });
        }
        if (
          playerId === lot.seller &&
          lot.highBidder === null &&
          genre.playerCount >= 3
        ) {
          for (let s = 0; s < genre.playerCount; s += 1) {
            if (s === lot.seller) continue;
            for (const bps of [1000, 1500, 2000]) {
              actions.push({
                type: "set_broker_terms",
                label: `Broker seat ${s} @ ${bps / 100}%`,
                payload: { lotId: lot.lotId, brokerSeat: s, cutBps: bps },
              });
            }
          }
        }
      }
      // Seller may add another live lot under cap (no sealed pending).
      if (
        !genre.pendingAuction &&
        genre.activeFloorLots.length < HEX_MAX_LIVE_LOTS &&
        genre.activeFloorLots.some((l) => l.seller === playerId)
      ) {
        const player = genre.players[playerId]!;
        for (const resource of RESOURCES) {
          if (player.resources[resource] < 1) continue;
          actions.push({
            type: "start_domestic_auction",
            label: `Live auction +1 ${resource}`,
            payload: { resource, qty: 1, reserve: 1, mode: "live" },
          });
        }
      }
      return actions;
    }

    if (phase === "domestic_auction") {
      const pending = genre.pendingAuction;
      if (!pending) return [];
      if (playerId === pending.seller) return [];
      if (pending.sealedBids[playerId] !== null) return [];
      const bank = genre.players[playerId]!.resources;
      const maxBid = totalResources(bank);
      const amounts = [
        pending.reserve,
        Math.min(maxBid, pending.reserve + 1),
        Math.min(maxBid, pending.reserve + 2),
        maxBid,
      ].filter(
        (a, i, arr) =>
          a >= pending.reserve && a <= maxBid && arr.indexOf(a) === i,
      );
      for (const amount of amounts) {
        actions.push({
          type: "auction_bid",
          label: `Auction bid ${amount}`,
          payload: { amount },
        });
      }
      actions.push({ type: "auction_pass", label: "Auction pass" });
      return actions;
    }

    if (phase === "trade_response") {
      const pending = genre.pendingTrade;
      if (!pending || playerId !== pending.to) return [];
      actions.push({
        type: "accept_trade",
        label: `Accept ${formatBag(pending.give)}→${formatBag(pending.take)}`,
      });
      actions.push({ type: "reject_trade", label: "Reject trade" });
      return actions;
    }

    if (phase !== "main") return [];

    const player = genre.players[playerId];

    if (genre.freeRoadsRemaining > 0) {
      for (const edge of legalMainRoads(genre, playerId, graph)) {
        actions.push({
          type: "place_road",
          label: `Free road ${edge}`,
          payload: { edgeId: edge, free: true },
        });
      }
      return actions;
    }

    // Build
    if (canPay(player.resources, { wood: 1, brick: 1 })) {
      for (const edge of legalMainRoads(genre, playerId, graph)) {
        actions.push({
          type: "place_road",
          label: `Build road ${edge}`,
          payload: { edgeId: edge },
        });
      }
    }
    if (canPay(player.resources, { wood: 1, brick: 1, sheep: 1, wheat: 1 })) {
      for (const vertex of legalMainSettlements(genre, playerId, graph)) {
        actions.push({
          type: "place_settlement",
          label: `Build settlement ${vertex}`,
          payload: { vertexId: vertex },
        });
      }
    }
    if (canPay(player.resources, { wheat: 2, ore: 3 })) {
      for (const vertex of player.settlements) {
        actions.push({
          type: "place_city",
          label: `Upgrade city ${vertex}`,
          payload: { vertexId: vertex },
        });
      }
    }

    // Bank / port trades — prefer swaps that unlock a build/dev cost.
    {
      let bankBudget = 8;
      for (const give of RESOURCES) {
        if (bankBudget <= 0) break;
        const ratio = portRatio(genre, playerId, give);
        if (player.resources[give] < ratio) continue;
        for (const take of RESOURCES) {
          if (bankBudget <= 0) break;
          if (take === give) continue;
          const afterGive = pay(player.resources, { [give]: ratio });
          if (!afterGive) continue;
          const preview = addResources(afterGive, { [take]: 1 });
          const helps =
            canPay(preview, { wood: 1, brick: 1 }) ||
            canPay(preview, { wood: 1, brick: 1, sheep: 1, wheat: 1 }) ||
            canPay(preview, { wheat: 2, ore: 3 }) ||
            canPay(preview, { sheep: 1, wheat: 1, ore: 1 });
          if (!helps && bankBudget < 4) continue;
          actions.push({
            type: "bank_trade",
            label: `Trade ${ratio} ${give} → ${take}`,
            payload: { give, take, ratio },
          });
          bankBudget -= 1;
        }
      }
    }

    // Negotiated domestic trade (T014): propose multi-resource bundles that
    // unlock a build/dev cost the proposer cannot currently afford.
    const needsBuild =
      !canPay(player.resources, { wood: 1, brick: 1 }) ||
      !canPay(player.resources, { wood: 1, brick: 1, sheep: 1, wheat: 1 }) ||
      !canPay(player.resources, { wheat: 2, ore: 3 }) ||
      !canPay(player.resources, { sheep: 1, wheat: 1, ore: 1 });
    if (needsBuild) {
      let tradeBudget = 8;
      const pushPropose = (
        seat: number,
        give: ResourceBank,
        take: ResourceBank,
      ) => {
        if (tradeBudget <= 0) return;
        if (totalResources(give) < 1 || totalResources(take) < 1) return;
        if (totalResources(give) > 4 || totalResources(take) > 4) return;
        const opponent = genre.players[seat];
        if (!canAffordBag(player, give) || !canAffordBag(opponent, take)) return;
        const preview = previewAfterTrade(player.resources, give, take);
        if (!tradeHelpsBuild(player.resources, preview)) return;
        actions.push({
          type: "propose_trade",
          label: `Offer P${seat}: ${formatBag(give)}→${formatBag(take)}`,
          payload: { withSeat: seat, give: { ...give }, take: { ...take } },
        });
        tradeBudget -= 1;
      };
      for (let seat = 0; seat < genre.playerCount && tradeBudget > 0; seat += 1) {
        if (seat === playerId) continue;
        const opponent = genre.players[seat];
        for (const giveRes of RESOURCES) {
          if (player.resources[giveRes] < 1) continue;
          for (const takeRes of RESOURCES) {
            if (takeRes === giveRes || opponent.resources[takeRes] < 1) continue;
            const g = EMPTY_BANK();
            const tk = EMPTY_BANK();
            g[giveRes] = 1;
            tk[takeRes] = 1;
            pushPropose(seat, g, tk);
          }
        }
        for (let i = 0; i < RESOURCES.length && tradeBudget > 0; i += 1) {
          for (let j = i + 1; j < RESOURCES.length && tradeBudget > 0; j += 1) {
            const a = RESOURCES[i]!;
            const b = RESOURCES[j]!;
            if (player.resources[a] < 1 || player.resources[b] < 1) continue;
            for (const takeRes of RESOURCES) {
              if (opponent.resources[takeRes] < 1) continue;
              if (takeRes === a || takeRes === b) continue;
              const g = EMPTY_BANK();
              const tk = EMPTY_BANK();
              g[a] = 1;
              g[b] = 1;
              tk[takeRes] = 1;
              pushPropose(seat, g, tk);
            }
          }
        }
        for (const giveRes of RESOURCES) {
          if (player.resources[giveRes] < 1) continue;
          for (let i = 0; i < RESOURCES.length && tradeBudget > 0; i += 1) {
            for (let j = i + 1; j < RESOURCES.length && tradeBudget > 0; j += 1) {
              const a = RESOURCES[i]!;
              const b = RESOURCES[j]!;
              if (opponent.resources[a] < 1 || opponent.resources[b] < 1) continue;
              if (giveRes === a || giveRes === b) continue;
              const g = EMPTY_BANK();
              const tk = EMPTY_BANK();
              g[giveRes] = 1;
              tk[a] = 1;
              tk[b] = 1;
              pushPropose(seat, g, tk);
            }
          }
        }
      }
    }

    // Dev cards
    if (
      canPay(player.resources, { sheep: 1, wheat: 1, ore: 1 }) &&
      genre.devDeck.length > 0
    ) {
      actions.push({ type: "buy_dev", label: "Buy development card" });
    }
    if (playableDevCount(player, "knight") > 0) {
      actions.push({ type: "play_knight", label: "Play knight" });
    }
    if (playableDevCount(player, "road_building") > 0) {
      actions.push({ type: "play_road_building", label: "Play road building" });
    }

    // Domestic auction (T023 sealed / T025 live multi-lot).
    if (
      !genre.pendingTrade &&
      !genre.pendingAuction &&
      (genre.activeFloorLots?.length ?? 0) === 0
    ) {
      for (const resource of RESOURCES) {
        if (player.resources[resource] < 1) continue;
        actions.push({
          type: "start_domestic_auction",
          label: `Sealed auction 1 ${resource}`,
          payload: { resource, qty: 1, reserve: 1, mode: "sealed" },
        });
        actions.push({
          type: "start_domestic_auction",
          label: `Live auction 1 ${resource}`,
          payload: { resource, qty: 1, reserve: 1, mode: "live" },
        });
      }
    }

    actions.push({ type: "end_turn", label: "End turn" });
    return actions;
  },

  reduce(state, action) {
    if (state.status !== "active") return null;
    if (!state.genre.activeFloorLots) state.genre.activeFloorLots = [];
    if (state.genre.pendingAuction === undefined) state.genre.pendingAuction = null;
    if (state.genre.lastFloorBroker === undefined) state.genre.lastFloorBroker = null;
    if (state.genre.pendingTrade === undefined) state.genre.pendingTrade = null;
    const auction0 = state.genre.pendingAuction;
    const offTurnAuction =
      Boolean(auction0) &&
      state.phase === "domestic_auction" &&
      (action.type === "auction_bid" || action.type === "auction_pass") &&
      action.playerId !== auction0!.seller &&
      auction0!.sealedBids[action.playerId] === null;
    const offTurnLive =
      state.phase === "domestic_live_floor" &&
      (action.type === "floor_raise" ||
        action.type === "floor_pass" ||
        action.type === "set_broker_terms" ||
        action.type === "start_domestic_auction");
    if (
      action.playerId !== state.activePlayerId &&
      !offTurnAuction &&
      !offTurnLive
    ) {
      return null;
    }
    const graph = hexIslandBoardGraph();
    const genre = cloneGenre(state.genre);
    const playerId = action.playerId;
    const player = genre.players[playerId];
    const phase = state.phase;

    const finish = (
      nextPhase: PlayPhaseId,
      nextActive: PlayerId,
      extras?: { passed?: boolean; endReason?: string },
    ) => {
      updateAwards(genre, graph);
      const ended = maybeEnd(genre, playerId, nextActive, nextPhase);
      if (ended) {
        genre.lastAction = action.type;
        return { ...ended, genre, passed: extras?.passed };
      }
      genre.lastAction = action.type;
      return {
        genre,
        phase: nextPhase,
        activePlayerId: nextActive,
        status: "active" as const,
        winnerId: null,
        passed: extras?.passed,
        endReason: extras?.endReason,
      };
    };

    // ---- SETUP ----
    if (phase === "setup") {
      if (action.type === "place_settlement") {
        if (genre.pendingRoadVertex) return null;
        const vertexId = payloadString(action, "vertexId");
        if (!vertexId) return null;
        if (!legalSetupSettlements(genre, graph).includes(vertexId)) return null;
        player.settlements.push(vertexId);
        // Second-round settlement collects resources.
        const pair = Math.floor(genre.setupStep / 2);
        if (pair >= genre.playerCount) {
          collectStartingResources(genre, playerId, vertexId, graph);
        }
        genre.pendingRoadVertex = vertexId;
        genre.setupStep += 1;
        return finish("setup", playerId);
      }
      if (action.type === "place_road") {
        if (!genre.pendingRoadVertex) return null;
        const edgeId = payloadString(action, "edgeId");
        if (!edgeId) return null;
        if (!legalSetupRoads(genre, playerId, graph).includes(edgeId)) return null;
        player.roads.push(edgeId);
        genre.pendingRoadVertex = null;
        genre.setupStep += 1;
        const totalSteps = genre.playerCount * 4;
        if (genre.setupStep >= totalSteps) {
          return finish("roll", 0);
        }
        return finish("setup", setupActiveSeat(genre));
      }
      return null;
    }

    // ---- ROLL ----
    if (phase === "roll") {
      if (action.type === "play_knight") {
        return applyKnight(genre, playerId, finish);
      }
      if (action.type !== "roll_dice") return null;
      genre.turnPlayer = playerId;
      const rng = createSeededRng(state.seed);
      const a = (rng.at(state.sequence * 2 + 1) % 6) + 1;
      const b = (rng.at(state.sequence * 2 + 2) % 6) + 1;
      genre.lastDice = [a, b];
      const total = a + b;
      if (total === 7) {
        const queue: PlayerId[] = [];
        for (let seat = 0; seat < genre.playerCount; seat += 1) {
          const idx = ((playerId + seat) % genre.playerCount) as PlayerId;
          if (totalResources(genre.players[idx].resources) > 7) {
            queue.push(idx);
          }
        }
        if (queue.length) {
          genre.discardQueue = queue;
          genre.discardRemaining = Math.floor(
            totalResources(genre.players[queue[0]].resources) / 2,
          );
          return finish("discard", queue[0]);
        }
        return finish("robber", playerId);
      }
      produceResources(genre, total, graph);
      return finish("main", playerId);
    }

    // ---- DISCARD ----
    if (phase === "discard") {
      if (action.type !== "discard") return null;
      const resource = payloadString(action, "resource") as Resource | null;
      if (!resource || !RESOURCES.includes(resource)) return null;
      if (player.resources[resource] < 1) return null;
      player.resources[resource] -= 1;
      genre.discardRemaining -= 1;
      if (genre.discardRemaining > 0) {
        return finish("discard", playerId);
      }
      genre.discardQueue.shift();
      if (genre.discardQueue.length) {
        const next = genre.discardQueue[0];
        genre.discardRemaining = Math.floor(
          totalResources(genre.players[next].resources) / 2,
        );
        return finish("discard", next);
      }
      return finish("robber", genre.turnPlayer);
    }

    // ---- DOMESTIC LIVE FLOOR (T025) ----
    if (phase === "domestic_live_floor") {
      const n = genre.playerCount;
      if (action.type === "start_domestic_auction") {
        if (genre.pendingAuction) return null;
        if (genre.activeFloorLots.length >= HEX_MAX_LIVE_LOTS) return null;
        if (!genre.activeFloorLots.some((l) => l.seller === playerId)) return null;
        const resource = action.payload?.resource as Resource | undefined;
        const qty = Number(action.payload?.qty ?? 1);
        const reserve = Number(action.payload?.reserve ?? 1);
        if (!resource || !RESOURCES.includes(resource)) return null;
        if (!Number.isInteger(qty) || qty < 1 || qty > 3) return null;
        if (!Number.isInteger(reserve) || reserve < 1) return null;
        if (player.resources[resource] < qty) return null;
        player.resources[resource] -= qty;
        const lot = EMPTY_BANK();
        lot[resource] = qty;
        const brokerSeat =
          typeof action.payload?.brokerSeat === "number"
            ? (action.payload.brokerSeat as number)
            : n >= 3
              ? (((playerId + 1) % n) as number)
              : null;
        const cutBps =
          typeof action.payload?.cutBps === "number"
            ? (action.payload.cutBps as number)
            : n >= 3
              ? 1500
              : 0;
        pushDomesticLiveLot(
          genre,
          playerId,
          lot,
          reserve,
          brokerSeat === playerId ? null : brokerSeat,
          cutBps,
        );
        genre.lastAction = "start_domestic_auction";
        return {
          genre,
          phase: "domestic_live_floor" as PlayPhaseId,
          activePlayerId: state.activePlayerId,
          status: "active" as const,
          winnerId: null,
        };
      }
      if (action.type === "set_broker_terms") {
        const lotId = action.payload?.lotId;
        if (typeof lotId !== "string") return null;
        const floorLot = genre.activeFloorLots.find((l) => l.lotId === lotId);
        if (!floorLot || action.playerId !== floorLot.seller) return null;
        const brokerSeatRaw = action.payload?.brokerSeat;
        const brokerSeat =
          brokerSeatRaw === null || brokerSeatRaw === undefined
            ? null
            : (brokerSeatRaw as number);
        const cutBps = action.payload?.cutBps;
        if (!Number.isSafeInteger(cutBps)) return null;
        if (
          !setLiveLotBrokerTerms(
            floorLot,
            typeof brokerSeat === "number" ? brokerSeat : null,
            cutBps as number,
            n,
          )
        ) {
          return null;
        }
        genre.lastAction = "set_broker_terms";
        return {
          genre,
          phase: "domestic_live_floor" as PlayPhaseId,
          activePlayerId: state.activePlayerId,
          status: "active" as const,
          winnerId: null,
        };
      }
      if (action.type === "floor_raise") {
        const lotId = action.payload?.lotId;
        const amount = action.payload?.amount;
        if (typeof lotId !== "string" || !Number.isSafeInteger(amount)) {
          return null;
        }
        const floorLot = genre.activeFloorLots.find((l) => l.lotId === lotId);
        if (!floorLot) return null;
        const funds = totalResources(player.resources);
        if (!raiseOnLiveLot(floorLot, playerId, amount as number, funds)) {
          return null;
        }
        genre.lastAction = "floor_raise";
        const next = ((playerId + 1) % n) as PlayerId;
        return {
          genre,
          phase: "domestic_live_floor" as PlayPhaseId,
          activePlayerId: next,
          status: "active" as const,
          winnerId: null,
        };
      }
      if (action.type === "floor_pass") {
        const lotId = action.payload?.lotId;
        if (typeof lotId !== "string") return null;
        const floorLot = genre.activeFloorLots.find((l) => l.lotId === lotId);
        if (!floorLot) return null;
        const settle = passOnLiveLot(floorLot, playerId, n);
        if (settle === "award") {
          if (
            !awardDomesticFloorLot(
              genre,
              floorLot,
              floorLot.highBidder as PlayerId,
              floorLot.currentBid,
            )
          ) {
            // Winner cannot pay (edge) — return lot to seller.
            unsoldDomesticFloorLot(genre, floorLot);
            genre.lastAction = "auction_unsold";
            if (genre.activeFloorLots.length > 0) {
              return {
                genre,
                phase: "domestic_live_floor" as PlayPhaseId,
                activePlayerId: genre.turnPlayer,
                status: "active" as const,
                winnerId: null,
                passed: true,
              };
            }
            return finish("main", genre.turnPlayer, { passed: true });
          }
          genre.lastAction = "auction_awarded";
          if (genre.activeFloorLots.length > 0) {
            return {
              genre,
              phase: "domestic_live_floor" as PlayPhaseId,
              activePlayerId: genre.turnPlayer,
              status: "active" as const,
              winnerId: null,
              passed: true,
            };
          }
          return finish("main", genre.turnPlayer, { passed: true });
        }
        if (settle === "unsold") {
          unsoldDomesticFloorLot(genre, floorLot);
          genre.lastAction = "auction_unsold";
          if (genre.activeFloorLots.length > 0) {
            return {
              genre,
              phase: "domestic_live_floor" as PlayPhaseId,
              activePlayerId: genre.turnPlayer,
              status: "active" as const,
              winnerId: null,
              passed: true,
            };
          }
          return finish("main", genre.turnPlayer, { passed: true });
        }
        genre.lastAction = "floor_pass";
        const next = ((playerId + 1) % n) as PlayerId;
        return {
          genre,
          phase: "domestic_live_floor" as PlayPhaseId,
          activePlayerId: next,
          status: "active" as const,
          winnerId: null,
          passed: true,
        };
      }
      return null;
    }

    // ---- DOMESTIC AUCTION (T023) ----
    if (phase === "domestic_auction") {
      const pending = genre.pendingAuction;
      if (!pending) return null;
      if (playerId === pending.seller) return null;
      if (pending.sealedBids[playerId] !== null) return null;
      if (action.type === "auction_pass") {
        pending.sealedBids[playerId] = -1;
      } else if (action.type === "auction_bid") {
        const amount = Number(action.payload?.amount);
        if (
          !Number.isInteger(amount) ||
          amount < pending.reserve ||
          totalResources(player.resources) < amount
        ) {
          return null;
        }
        pending.sealedBids[playerId] = amount;
      } else {
        return null;
      }

      if (pending.sealedBids.some((b, seat) => seat !== pending.seller && b === null)) {
        let next = ((playerId + 1) % genre.playerCount) as PlayerId;
        for (let step = 0; step < genre.playerCount; step += 1) {
          const s = ((playerId + 1 + step) % genre.playerCount) as PlayerId;
          if (s === pending.seller) continue;
          if (pending.sealedBids[s] === null) {
            next = s;
            break;
          }
        }
        genre.lastAction = action.type;
        return {
          genre,
          phase: "domestic_auction" as PlayPhaseId,
          activePlayerId: next,
          status: "active" as const,
          winnerId: null,
        };
      }

      const seatOrder = Array.from({ length: genre.playerCount }, (_, i) => i);
      const resolved = resolveSealedBids(pending.sealedBids, seatOrder);
      if (!resolved) {
        // All passed — return escrowed lot to seller.
        const sellerPlayer = genre.players[pending.seller]!;
        sellerPlayer.resources = addBanks(sellerPlayer.resources, pending.lot);
        genre.pendingAuction = null;
        genre.lastAction = "auction_unsold";
        return finish("main", pending.seller);
      }

      const winner = genre.players[resolved.winner]!;
      const seller = genre.players[pending.seller]!;
      const extracted = extractResources(winner.resources, resolved.amount);
      if (!extracted) return null;
      winner.resources = extracted.bank;

      const split = splitBrokerageAward({
        price: resolved.amount,
        seller: pending.seller,
        winner: resolved.winner,
        second: resolved.second,
        enabled: genre.playerCount >= 3,
        cutBps: pending.brokerCutBps,
        playerCount: genre.playerCount,
      });

      // Seller receives lot proceeds (resources); broker gets cut from paid pile.
      let paid = extracted.paid;
      if (split.brokerSeat !== null && split.toBroker > 0) {
        const brokerPay = extractResources(paid, split.toBroker);
        if (brokerPay) {
          paid = brokerPay.bank;
          genre.players[split.brokerSeat]!.resources = addBanks(
            genre.players[split.brokerSeat]!.resources,
            brokerPay.paid,
          );
          pending.lastBroker = { seat: split.brokerSeat, cut: split.toBroker };
        }
      }
      seller.resources = addBanks(seller.resources, paid);
      // Lot was escrowed at start — deliver to winner.
      winner.resources = addBanks(winner.resources, pending.lot);

      genre.pendingAuction = null;
      genre.lastAction = "auction_awarded";
      return finish("main", pending.seller);
    }

    // ---- TRADE RESPONSE ----
    if (phase === "trade_response") {
      const pending = genre.pendingTrade;
      if (!pending || playerId !== pending.to) return null;
      if (action.type === "reject_trade") {
        genre.pendingTrade = null;
        return finish("main", pending.from);
      }
      if (action.type === "accept_trade") {
        const fromPlayer = genre.players[pending.from];
        const toPlayer = genre.players[pending.to];
        if (
          !canAffordBag(fromPlayer, pending.give) ||
          !canAffordBag(toPlayer, pending.take)
        ) {
          return null;
        }
        transferBag(fromPlayer, toPlayer, pending.give);
        transferBag(toPlayer, fromPlayer, pending.take);
        genre.pendingTrade = null;
        return finish("main", pending.from);
      }
      return null;
    }

    if (phase === "robber") {
      if (action.type === "play_knight") {
        // Knight already moved us here via play_knight → robber; disallow.
        return null;
      }
      if (action.type !== "move_robber") return null;
      const hex = payloadString(action, "hex");
      if (!hex || hex === genre.robberHex) return null;
      if (!genre.tiles.some((tile) => hexKey(tile.q, tile.r) === hex)) return null;
      genre.robberHex = hex;
      // Steal from a random adjacent opponent with resources.
      const victims = stealCandidates(genre, playerId, hex, graph);
      if (victims.length) {
        const rng = createSeededRng(state.seed);
        const victim = victims[rng.at(state.sequence + 3) % victims.length];
        stealOne(genre, playerId, victim, state.seed, state.sequence);
      }
      updateAwards(genre, graph);
      const ended = maybeEnd(genre, playerId, playerId, "main");
      if (ended) {
        genre.lastAction = action.type;
        return ended;
      }
      return finish("main", playerId);
    }

    // ---- MAIN ----
    if (phase === "main") {
      if (action.type === "end_turn") {
        if (genre.freeRoadsRemaining > 0) return null;
        // Clear new-dev restriction for the player ending turn.
        player.newDevCards = [];
        const next = ((playerId + 1) % genre.playerCount) as PlayerId;
        genre.lastDice = null;
        genre.freeRoadsRemaining = 0;
        return finish("roll", next);
      }

      if (action.type === "place_road") {
        const edgeId = payloadString(action, "edgeId");
        if (!edgeId) return null;
        const free = action.payload?.free === true || genre.freeRoadsRemaining > 0;
        if (!legalMainRoads(genre, playerId, graph).includes(edgeId)) return null;
        if (!free) {
          const nextBank = pay(player.resources, { wood: 1, brick: 1 });
          if (!nextBank) return null;
          player.resources = nextBank;
        } else {
          genre.freeRoadsRemaining = Math.max(0, genre.freeRoadsRemaining - 1);
        }
        player.roads.push(edgeId);
        return finish("main", playerId);
      }

      if (action.type === "place_settlement") {
        const vertexId = payloadString(action, "vertexId");
        if (!vertexId) return null;
        if (!legalMainSettlements(genre, playerId, graph).includes(vertexId)) {
          return null;
        }
        const nextBank = pay(player.resources, {
          wood: 1,
          brick: 1,
          sheep: 1,
          wheat: 1,
        });
        if (!nextBank) return null;
        player.resources = nextBank;
        player.settlements.push(vertexId);
        return finish("main", playerId);
      }

      if (action.type === "place_city") {
        const vertexId = payloadString(action, "vertexId");
        if (!vertexId || !player.settlements.includes(vertexId)) return null;
        const nextBank = pay(player.resources, { wheat: 2, ore: 3 });
        if (!nextBank) return null;
        player.resources = nextBank;
        player.settlements = player.settlements.filter((entry) => entry !== vertexId);
        player.cities.push(vertexId);
        return finish("main", playerId);
      }

      if (action.type === "bank_trade") {
        const give = payloadString(action, "give") as Resource | null;
        const take = payloadString(action, "take") as Resource | null;
        const ratio = payloadNumber(action, "ratio");
        if (!give || !take || !ratio || give === take) return null;
        if (portRatio(genre, playerId, give) !== ratio) return null;
        if (player.resources[give] < ratio) return null;
        player.resources[give] -= ratio;
        player.resources[take] += 1;
        return finish("main", playerId);
      }

      if (action.type === "start_domestic_auction") {
        if (genre.pendingTrade || genre.pendingAuction) return null;
        if (genre.activeFloorLots.length > 0) return null;
        const resource = action.payload?.resource as Resource | undefined;
        const qty = Number(action.payload?.qty ?? 1);
        const reserve = Number(action.payload?.reserve ?? 1);
        const mode =
          action.payload?.mode === "sealed"
            ? "sealed"
            : action.payload?.mode === "live"
              ? "live"
              : "live";
        if (!resource || !RESOURCES.includes(resource)) return null;
        if (!Number.isInteger(qty) || qty < 1 || qty > 3) return null;
        if (!Number.isInteger(reserve) || reserve < 1) return null;
        if (player.resources[resource] < qty) return null;
        // Escrow lot off seller immediately so it cannot be spent mid-auction.
        player.resources[resource] -= qty;
        const lot = EMPTY_BANK();
        lot[resource] = qty;
        genre.lastAction = "start_domestic_auction";
        let next = ((playerId + 1) % genre.playerCount) as PlayerId;
        if (next === playerId) next = 0 as PlayerId;
        if (mode === "live") {
          const n = genre.playerCount;
          const brokerSeat =
            typeof action.payload?.brokerSeat === "number"
              ? (action.payload.brokerSeat as number)
              : n >= 3
                ? (((playerId + 1) % n) as number)
                : null;
          const cutBps =
            typeof action.payload?.cutBps === "number"
              ? (action.payload.cutBps as number)
              : n >= 3
                ? 1500
                : 0;
          pushDomesticLiveLot(
            genre,
            playerId,
            lot,
            reserve,
            brokerSeat === playerId ? null : brokerSeat,
            cutBps,
          );
          return {
            genre,
            phase: "domestic_live_floor" as PlayPhaseId,
            activePlayerId: next,
            status: "active" as const,
            winnerId: null,
          };
        }
        const sealedBids = Array.from({ length: genre.playerCount }, () => null as number | null);
        sealedBids[playerId] = -1; // seller does not bid
        genre.pendingAuction = {
          seller: playerId,
          lot,
          reserve,
          sealedBids,
          brokerCutBps: 1000,
          lastBroker: null,
        };
        return {
          genre,
          phase: "domestic_auction" as PlayPhaseId,
          activePlayerId: next,
          status: "active" as const,
          winnerId: null,
        };
      }

      if (action.type === "propose_trade") {
        if (genre.pendingTrade) return null;
        const withSeat = payloadNumber(action, "withSeat");
        const give = parseResourceBag(action.payload, "give");
        const take = parseResourceBag(action.payload, "take");
        if (
          withSeat === null ||
          withSeat === playerId ||
          withSeat < 0 ||
          withSeat >= genre.playerCount ||
          !give ||
          !take
        ) {
          return null;
        }
        if (totalResources(give) > 4 || totalResources(take) > 4) return null;
        const opponent = genre.players[withSeat];
        if (!canAffordBag(player, give) || !canAffordBag(opponent, take)) {
          return null;
        }
        genre.pendingTrade = {
          from: playerId,
          to: withSeat as PlayerId,
          give: cloneBank(give),
          take: cloneBank(take),
        };
        genre.lastAction = "propose_trade";
        return {
          genre,
          phase: "trade_response" as PlayPhaseId,
          activePlayerId: withSeat as PlayerId,
          status: "active" as const,
          winnerId: null,
        };
      }

      if (action.type === "buy_dev") {
        if (!genre.devDeck.length) return null;
        const nextBank = pay(player.resources, { sheep: 1, wheat: 1, ore: 1 });
        if (!nextBank) return null;
        player.resources = nextBank;
        const card = genre.devDeck.pop()!;
        if (card === "victory") {
          player.vpCards += 1;
        } else {
          player.devCards.push(card);
          player.newDevCards.push(card);
        }
        return finish("main", playerId);
      }

      if (action.type === "play_knight") {
        return applyKnight(genre, playerId, finish);
      }

      if (action.type === "play_road_building") {
        if (playableDevCount(player, "road_building") <= 0) return null;
        const idx = player.devCards.findIndex((card) => card === "road_building");
        if (idx < 0) return null;
        player.devCards.splice(idx, 1);
        genre.freeRoadsRemaining = 2;
        // If no legal road, burn the remainder and stay in main.
        if (!legalMainRoads(genre, playerId, graph).length) {
          genre.freeRoadsRemaining = 0;
        }
        return finish("main", playerId);
      }

      return null;
    }

    return null;
  },
};

function applyKnight(
  genre: HexIslandGenre,
  playerId: PlayerId,
  finish: (
    nextPhase: PlayPhaseId,
    nextActive: PlayerId,
    extras?: { passed?: boolean; endReason?: string },
  ) => {
    genre: HexIslandGenre;
    phase: PlayPhaseId;
    activePlayerId: PlayerId;
    status: "active" | "complete";
    winnerId: PlayerId | null;
    passed?: boolean;
    endReason?: string;
  },
) {
  const player = genre.players[playerId];
  if (playableDevCount(player, "knight") <= 0) return null;
  const idx = player.devCards.findIndex((card) => card === "knight");
  if (idx < 0) return null;
  player.devCards.splice(idx, 1);
  player.knightsPlayed += 1;
  genre.turnPlayer = playerId;
  return finish("robber", playerId);
}

function stealCandidates(
  genre: HexIslandGenre,
  thief: PlayerId,
  hex: string,
  graph: HexBoardGraph,
): PlayerId[] {
  const [qText, rText] = hex.split(",");
  const q = Number(qText);
  const r = Number(rText);
  const vertices = graph.hexVertices[hexKey(q, r)] ?? [];
  const victims: PlayerId[] = [];
  for (let seat = 0; seat < genre.playerCount; seat += 1) {
    if (seat === thief) continue;
    const player = genre.players[seat];
    const hits = vertices.some(
      (vertex) =>
        player.settlements.includes(vertex) || player.cities.includes(vertex),
    );
    if (hits && totalResources(player.resources) > 0) victims.push(seat);
  }
  return victims;
}

function stealOne(
  genre: HexIslandGenre,
  thief: PlayerId,
  victim: PlayerId,
  seed: number,
  sequence: number,
): void {
  const bank = genre.players[victim].resources;
  const pool: Resource[] = [];
  for (const resource of RESOURCES) {
    for (let i = 0; i < bank[resource]; i += 1) pool.push(resource);
  }
  if (!pool.length) return;
  const rng = createSeededRng(seed);
  const pick = pool[rng.at(sequence + 7) % pool.length];
  genre.players[victim].resources[pick] -= 1;
  genre.players[thief].resources[pick] += 1;
}

export function hexIslandToSessionFields(state: PlayState<HexIslandGenre>): {
  turn: number;
  activeSeat: number;
  scores: number[];
  status: "active" | "complete";
  winnerSeat: number | null;
  hexIsland: {
    phase: string;
    playerCount: number;
    victoryPointsToWin: number;
    tiles: HexIslandTile[];
    robberHex: string;
    ports: HexIslandPort[];
    players: HexIslandPlayer[];
    setupStep: number;
    pendingRoadVertex: string | null;
    lastDice: [number, number] | null;
    discardQueue: PlayerId[];
    discardRemaining: number;
    devDeck: DevCardKind[];
    longestRoadOwner: PlayerId | null;
    largestArmyOwner: PlayerId | null;
    freeRoadsRemaining: number;
    lastAction: string | null;
    turnPlayer: PlayerId;
    pendingTrade: PendingTrade | null;
    pendingAuction: PendingAuction | null;
    activeFloorLots: Array<LiveFloorLot<DomesticFloorPayload>>;
    lastFloorBroker: { seat: number; cut: number } | null;
  };
} {
  const scores = state.genre.players.map((_, seat) =>
    publicVictoryPoints(state.genre, seat),
  );
  return {
    turn: state.sequence,
    activeSeat: state.activePlayerId,
    scores,
    status: state.status,
    winnerSeat: state.winnerId,
    hexIsland: {
      phase: state.phase,
      playerCount: state.genre.playerCount,
      victoryPointsToWin: state.genre.victoryPointsToWin,
      tiles: state.genre.tiles.map((tile) => ({ ...tile })),
      robberHex: state.genre.robberHex,
      ports: state.genre.ports.map((port) => ({
        ...port,
        vertices: [...port.vertices],
      })),
      players: clonePlayers(state.genre.players),
      setupStep: state.genre.setupStep,
      pendingRoadVertex: state.genre.pendingRoadVertex,
      lastDice: state.genre.lastDice
        ? ([...state.genre.lastDice] as [number, number])
        : null,
      discardQueue: [...state.genre.discardQueue],
      discardRemaining: state.genre.discardRemaining,
      devDeck: [...state.genre.devDeck],
      longestRoadOwner: state.genre.longestRoadOwner,
      largestArmyOwner: state.genre.largestArmyOwner,
      freeRoadsRemaining: state.genre.freeRoadsRemaining,
      lastAction: state.genre.lastAction,
      turnPlayer: state.genre.turnPlayer,
      pendingTrade: state.genre.pendingTrade
        ? {
            from: state.genre.pendingTrade.from,
            to: state.genre.pendingTrade.to,
            give: cloneBank(state.genre.pendingTrade.give),
            take: cloneBank(state.genre.pendingTrade.take),
          }
        : null,
      pendingAuction: state.genre.pendingAuction
        ? {
            seller: state.genre.pendingAuction.seller,
            lot: cloneBank(state.genre.pendingAuction.lot),
            reserve: state.genre.pendingAuction.reserve,
            sealedBids: [...state.genre.pendingAuction.sealedBids],
            brokerCutBps: state.genre.pendingAuction.brokerCutBps,
            lastBroker: state.genre.pendingAuction.lastBroker
              ? { ...state.genre.pendingAuction.lastBroker }
              : null,
          }
        : null,
      activeFloorLots: (state.genre.activeFloorLots ?? []).map((lot) => ({
        ...lot,
        passedSinceRaise: [...lot.passedSinceRaise],
        payload: { lot: cloneBank(lot.payload.lot) },
      })),
      lastFloorBroker: state.genre.lastFloorBroker
        ? { ...state.genre.lastFloorBroker }
        : null,
    },
  };
}

export function bindHexIslandFromRuntimeKernel(input: {
  playerCount?: number;
  victoryPointsToWin?: number;
}): PlayKernelConfig {
  const playerCount = input.playerCount ?? 2;
  if (playerCount < 2 || playerCount > 4) {
    throw new Error("hex_island_requires_2_to_4_players");
  }
  return createHexIslandKernelConfig({
    playerCount,
    victoryPointsToWin: input.victoryPointsToWin ?? 10,
  });
}

export function playActionFromHexIslandIntent(
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

/** Prefer VP / build actions so autoplay reaches a terminal. */
function botActionWeight(action: LegalAction): number {
  switch (action.type) {
    case "place_city":
      return 200;
    case "place_settlement":
      return 180;
    case "buy_dev":
      return 120;
    case "place_road":
      return 90;
    case "play_road_building":
      return 80;
    case "play_knight":
      return 50;
    case "bank_trade":
      return 25;
    case "propose_trade":
      return 22;
    case "accept_trade":
      return 60;
    case "reject_trade":
      return 15;
    case "start_domestic_auction":
      return 1;
    case "auction_bid":
      return 55;
    case "auction_pass":
      return 20;
    case "floor_raise":
      return 55;
    case "floor_pass":
      return 20;
    case "set_broker_terms":
      return 2;
    case "roll_dice":
    case "discard":
    case "move_robber":
      return 300;
    case "end_turn":
      return 40;
    default:
      return 5;
  }
}

export function pickHexIslandBotAction(
  state: PlayState<HexIslandGenre>,
  config: PlayKernelConfig,
  seed: number,
  sequence: number,
): PlayAction | null {
  const parsed = parseHexIslandConfig(config.adapter);
  if (!parsed) return null;
  let legal = hexIslandAdapter.listLegalActions(state, state.activePlayerId, parsed);
  if (!legal.length) return null;
  // Autoplay: settle live floor; avoid opening auctions / broker spam.
  if (state.phase === "domestic_live_floor") {
    const raises = legal.filter((a) => a.type === "floor_raise");
    const passes = legal.filter((a) => a.type === "floor_pass");
    if (raises.length) legal = raises;
    else if (passes.length) legal = passes;
    else legal = legal.filter((a) => a.type !== "set_broker_terms");
  } else {
    legal = legal.filter((a) => a.type !== "start_domestic_auction");
    if (!legal.length) {
      legal = hexIslandAdapter.listLegalActions(state, state.activePlayerId, parsed);
    }
  }
  if (!legal.length) return null;
  const weights = legal.map(botActionWeight);
  const total = weights.reduce((sum, value) => sum + value, 0);
  const rng = createSeededRng(seed);
  let ticket = rng.at(Math.max(sequence, 1)) % total;
  let choice = legal[0];
  for (let index = 0; index < legal.length; index += 1) {
    ticket -= weights[index];
    if (ticket < 0) {
      choice = legal[index];
      break;
    }
  }
  return {
    type: choice.type,
    playerId: state.activePlayerId,
    ...(choice.payload ? { payload: { ...choice.payload } } : {}),
  };
}

export function autoPlayHexIslandGame(
  seed: number,
  config: PlayKernelConfig = createHexIslandKernelConfig(),
): {
  state: PlayState<HexIslandGenre>;
  actions: PlayAction[];
} {
  let state = createInitialState(hexIslandAdapter, config, seed);
  const actions: PlayAction[] = [];
  const maxPlies = 12000;
  let guard = 0;

  while (state.status === "active" && guard < maxPlies) {
    guard += 1;
    const bot = pickHexIslandBotAction(state, config, seed, state.sequence + 1);
    if (!bot) break;
    const result = applyAction(hexIslandAdapter, state, bot, config);
    if (!result.ok) {
      throw new Error(`hex_island_auto_play_illegal:${result.reason}:${bot.type}`);
    }
    actions.push(bot);
    state = result.state;
  }
  return { state, actions };
}
