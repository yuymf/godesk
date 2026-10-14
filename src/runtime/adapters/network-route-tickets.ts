/**
 * Tickets subset for network-route-v1 (T016): destination tickets deck,
 * multi-color length claims, length scoring table. Generic — no sample IP.
 */
import { createSeededRng, type PlayerId } from "../play-kernel";

/** Minimal city/edge shapes (avoid circular import with network-route.ts). */
export type TicketsCity = { id: string; name: string };
export type TicketsEdge = { id: string; from: string; to: string };

export const TRAIN_COLORS = [
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "black",
  "white",
] as const;
export type TrainColor = (typeof TRAIN_COLORS)[number];
export type RouteEdgeColor = TrainColor | "gray";
export type TrainCardColor = TrainColor | "wild";

export const DEFAULT_LENGTH_SCORES: Readonly<Record<number, number>> = {
  1: 1,
  2: 2,
  3: 4,
  4: 7,
  5: 10,
  6: 15,
};

/** Rail / destination-ticket cues (not freight logistics). */
export const TICKETS_ROUTE_CUES =
  /车票|车厢牌|彩色(?:路线|路段)|认领路线|长度表|destination\s*tickets?|train\s*cars?|multi-?color\s*routes?|scoring\s*table/i;

export function ideaRequestsTicketsRoute(idea: string): boolean {
  return TICKETS_ROUTE_CUES.test(idea);
}

export type DestinationTicketDef = {
  id: string;
  name: string;
  from: string;
  to: string;
  points: number;
};

export type DestinationTicketInstance = DestinationTicketDef & {
  instanceId: string;
};

export type EdgeColorMeta = {
  color: RouteEdgeColor | string;
  length: number;
};

export type NetworkRouteTicketsContent = {
  edgeMeta: Record<string, EdgeColorMeta>;
  tickets: DestinationTicketDef[];
  lengthScores: Record<number, number> & Record<string, number>;
  startingTrainCards: number;
  startingTicketDraw: number;
  startingTicketKeep: number;
  startingTrains: number;
  faceUpCount: number;
  cardsPerColor: number;
  wildCount: number;
};

export type HandCounts = Record<TrainCardColor, number>;

export type NetworkRouteTicketsState = {
  edgeMeta: Record<string, EdgeColorMeta>;
  lengthScores: Record<number, number> & Record<string, number>;
  trainHand: [HandCounts, HandCounts];
  trainDeck: TrainCardColor[];
  trainDiscard: TrainCardColor[];
  faceUp: TrainCardColor[];
  ticketHand: [DestinationTicketInstance[], DestinationTicketInstance[]];
  ticketDeck: DestinationTicketInstance[];
  trainsLeft: [number, number];
  routeScore: [number, number];
  finalScore: [number, number] | null;
  /** After a seat hits train threshold, remaining turns including others. */
  finalTurnsLeft: number | null;
  lastEvent: string | null;
};

function emptyHand(): HandCounts {
  const h = { wild: 0 } as HandCounts;
  for (const c of TRAIN_COLORS) h[c] = 0;
  return h;
}

function cloneHand(h: HandCounts): HandCounts {
  return { ...h };
}

function handTotal(h: HandCounts): number {
  let n = 0;
  for (const c of TRAIN_COLORS) n += h[c] ?? 0;
  n += h.wild ?? 0;
  return n;
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

/** Assign colors/lengths on the fixed beginner graph (deterministic, generic). */
const FALLBACK_EDGES: TicketsEdge[] = [
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

const FALLBACK_CITIES: TicketsCity[] = [
  { id: "A", name: "北港" },
  { id: "B", name: "西岭" },
  { id: "C", name: "东湾" },
  { id: "D", name: "河谷" },
  { id: "E", name: "矿山" },
  { id: "F", name: "南站" },
];

export function defaultTicketsEdgeMeta(
  edges: readonly TicketsEdge[] = FALLBACK_EDGES,
): Record<string, EdgeColorMeta> {
  const palette: RouteEdgeColor[] = [
    "red",
    "blue",
    "green",
    "yellow",
    "orange",
    "purple",
    "black",
    "white",
    "gray",
    "gray",
  ];
  const lengths = [2, 3, 2, 4, 3, 2, 3, 2, 4, 3];
  const meta: Record<string, EdgeColorMeta> = {};
  edges.forEach((e, i) => {
    meta[e.id] = {
      color: palette[i % palette.length]!,
      length: lengths[i % lengths.length]!,
    };
  });
  return meta;
}

export function defaultDestinationTickets(
  cities: readonly TicketsCity[] = FALLBACK_CITIES,
): DestinationTicketDef[] {
  const nameOf = (id: string) => cities.find((c) => c.id === id)?.name ?? id;
  const pairs: Array<[string, string, number]> = [
    ["A", "F", 8],
    ["A", "D", 5],
    ["A", "E", 6],
    ["B", "F", 7],
    ["C", "F", 7],
    ["B", "E", 4],
    ["C", "D", 4],
    ["A", "C", 3],
    ["B", "D", 3],
    ["D", "E", 5],
    ["B", "C", 2],
    ["E", "F", 4],
  ];
  return pairs.map(([from, to, points], i) => ({
    id: `ticket_${from}_${to}_${i}`,
    name: `${nameOf(from)}↔${nameOf(to)}`,
    from,
    to,
    points,
  }));
}

export function defaultTicketsContent(
  overrides?: Partial<NetworkRouteTicketsContent>,
): NetworkRouteTicketsContent {
  return {
    edgeMeta: overrides?.edgeMeta ?? defaultTicketsEdgeMeta(),
    tickets: overrides?.tickets ?? defaultDestinationTickets(),
    lengthScores: overrides?.lengthScores ?? { ...DEFAULT_LENGTH_SCORES },
    startingTrainCards: overrides?.startingTrainCards ?? 4,
    startingTicketDraw: overrides?.startingTicketDraw ?? 3,
    startingTicketKeep: overrides?.startingTicketKeep ?? 2,
    startingTrains: overrides?.startingTrains ?? 20,
    faceUpCount: overrides?.faceUpCount ?? 5,
    cardsPerColor: overrides?.cardsPerColor ?? 8,
    wildCount: overrides?.wildCount ?? 10,
  };
}

export function ticketsUnsupportedNotes(): string[] {
  return [
    "network-route-v1 tickets subset: destination tickets deck + multi-color length claim + length scoring table; 3–5 seats / face-up rainbow take limits / longest-path bonus unsupported.",
  ];
}

function buildTrainDeck(content: NetworkRouteTicketsContent, seed: number): TrainCardColor[] {
  const deck: TrainCardColor[] = [];
  for (const c of TRAIN_COLORS) {
    for (let i = 0; i < content.cardsPerColor; i += 1) deck.push(c);
  }
  for (let i = 0; i < content.wildCount; i += 1) deck.push("wild");
  return shuffleWithSeed(deck, seed ^ 0x51eed);
}

function drawOne(
  deck: TrainCardColor[],
  discard: TrainCardColor[],
  seedSalt: number,
): TrainCardColor | null {
  if (deck.length === 0) {
    if (discard.length === 0) return null;
    const reshuffled = shuffleWithSeed(discard.splice(0, discard.length), seedSalt);
    deck.push(...reshuffled);
  }
  return deck.shift() ?? null;
}

function refillFaceUpTo(
  tickets: NetworkRouteTicketsState,
  count: number,
  seedSalt: number,
): void {
  while (tickets.faceUp.length < count) {
    const card = drawOne(
      tickets.trainDeck,
      tickets.trainDiscard,
      seedSalt + tickets.faceUp.length,
    );
    if (!card) break;
    tickets.faceUp.push(card);
  }
}

export function buildTicketsState(
  content: NetworkRouteTicketsContent,
  seed: number,
): NetworkRouteTicketsState {
  const trainDeck = buildTrainDeck(content, seed);
  const trainDiscard: TrainCardColor[] = [];
  const hands: [HandCounts, HandCounts] = [emptyHand(), emptyHand()];
  for (const seat of [0, 1] as const) {
    for (let i = 0; i < content.startingTrainCards; i += 1) {
      const card = drawOne(trainDeck, trainDiscard, seed + seat * 17 + i);
      if (card) hands[seat][card] = (hands[seat][card] ?? 0) + 1;
    }
  }
  const ticketPool = shuffleWithSeed(
    content.tickets.map((t, i) => ({ ...t, instanceId: `${t.id}#${i}` })),
    seed ^ 0xc0ffee,
  );
  const ticketHand: [DestinationTicketInstance[], DestinationTicketInstance[]] = [
    [],
    [],
  ];
  for (const seat of [0, 1] as const) {
    const drawn: DestinationTicketInstance[] = [];
    for (let i = 0; i < content.startingTicketDraw && ticketPool.length; i += 1) {
      drawn.push(ticketPool.shift()!);
    }
    drawn.sort((a, b) => b.points - a.points);
    const keep = drawn.slice(0, content.startingTicketKeep);
    const discard = drawn.slice(content.startingTicketKeep);
    ticketHand[seat] = keep;
    // discarded tickets go under deck
    ticketPool.push(...discard);
  }
  const tickets: NetworkRouteTicketsState = {
    edgeMeta: { ...content.edgeMeta },
    lengthScores: { ...content.lengthScores },
    trainHand: hands,
    trainDeck,
    trainDiscard,
    faceUp: [],
    ticketHand,
    ticketDeck: ticketPool,
    trainsLeft: [content.startingTrains, content.startingTrains],
    routeScore: [0, 0],
    finalScore: null,
    finalTurnsLeft: null,
    lastEvent: "tickets_dealt",
  };
  refillFaceUpTo(tickets, content.faceUpCount, seed ^ 0xfa3e);
  return tickets;
}

export function cloneTicketsState(
  t: NetworkRouteTicketsState,
): NetworkRouteTicketsState {
  return {
    edgeMeta: { ...t.edgeMeta },
    lengthScores: { ...t.lengthScores },
    trainHand: [cloneHand(t.trainHand[0]), cloneHand(t.trainHand[1])],
    trainDeck: [...t.trainDeck],
    trainDiscard: [...t.trainDiscard],
    faceUp: [...t.faceUp],
    ticketHand: [
      t.ticketHand[0].map((x) => ({ ...x })),
      t.ticketHand[1].map((x) => ({ ...x })),
    ],
    ticketDeck: t.ticketDeck.map((x) => ({ ...x })),
    trainsLeft: [...t.trainsLeft] as [number, number],
    routeScore: [...t.routeScore] as [number, number],
    finalScore: t.finalScore ? ([...t.finalScore] as [number, number]) : null,
    finalTurnsLeft: t.finalTurnsLeft,
    lastEvent: t.lastEvent,
  };
}

/** Can seat pay `length` of `payColor` (wilds fill)? */
export function canPayForClaim(
  hand: HandCounts,
  edgeColor: RouteEdgeColor | string,
  length: number,
  payColor: TrainColor,
): boolean {
  if (edgeColor !== "gray" && edgeColor !== payColor) return false;
  const colored = hand[payColor] ?? 0;
  const wild = hand.wild ?? 0;
  return colored + wild >= length;
}

export function payForClaim(
  hand: HandCounts,
  length: number,
  payColor: TrainColor,
): { hand: HandCounts; spent: TrainCardColor[] } {
  const next = cloneHand(hand);
  const spent: TrainCardColor[] = [];
  let need = length;
  const useColored = Math.min(need, next[payColor] ?? 0);
  next[payColor] = (next[payColor] ?? 0) - useColored;
  for (let i = 0; i < useColored; i += 1) spent.push(payColor);
  need -= useColored;
  next.wild = (next.wild ?? 0) - need;
  for (let i = 0; i < need; i += 1) spent.push("wild");
  return { hand: next, spent };
}

export function scoreTicketsForSeat(
  claims: Record<string, PlayerId | null>,
  edges: readonly TicketsEdge[],
  connects: (
    claims: Record<string, PlayerId | null>,
    edges: readonly TicketsEdge[],
    playerId: PlayerId,
    from: string,
    to: string,
  ) => boolean,
  seat: PlayerId,
  ticketHand: DestinationTicketInstance[],
): number {
  let delta = 0;
  for (const t of ticketHand) {
    const ok = connects(claims, edges, seat, t.from, t.to);
    delta += ok ? t.points : -t.points;
  }
  return delta;
}

export function computeFinalScores(
  tickets: NetworkRouteTicketsState,
  claims: Record<string, PlayerId | null>,
  edges: readonly TicketsEdge[],
  connects: (
    claims: Record<string, PlayerId | null>,
    edges: readonly TicketsEdge[],
    playerId: PlayerId,
    from: string,
    to: string,
  ) => boolean,
): [number, number] {
  const s0 =
    tickets.routeScore[0] +
    scoreTicketsForSeat(claims, edges, connects, 0, tickets.ticketHand[0]);
  const s1 =
    tickets.routeScore[1] +
    scoreTicketsForSeat(claims, edges, connects, 1, tickets.ticketHand[1]);
  return [s0, s1];
}

export function applyDrawTrains(
  tickets: NetworkRouteTicketsState,
  playerId: PlayerId,
  seedSalt: number,
): NetworkRouteTicketsState | null {
  const next = cloneTicketsState(tickets);
  const drawn: TrainCardColor[] = [];
  for (let i = 0; i < 2; i += 1) {
    const card = drawOne(next.trainDeck, next.trainDiscard, seedSalt + i);
    if (!card) break;
    drawn.push(card);
    next.trainHand[playerId][card] = (next.trainHand[playerId][card] ?? 0) + 1;
  }
  if (drawn.length === 0) return null;
  next.lastEvent = `seat${playerId}_draw_trains_${drawn.join("+")}`;
  return next;
}

export function applyDrawTickets(
  tickets: NetworkRouteTicketsState,
  playerId: PlayerId,
): NetworkRouteTicketsState | null {
  if (tickets.ticketDeck.length === 0) return null;
  const next = cloneTicketsState(tickets);
  const take = Math.min(3, next.ticketDeck.length);
  const drawn: DestinationTicketInstance[] = [];
  for (let i = 0; i < take; i += 1) drawn.push(next.ticketDeck.shift()!);
  // Keep highest-value; return rest to bottom (must keep ≥1).
  drawn.sort((a, b) => b.points - a.points);
  const keep = drawn.slice(0, Math.max(1, Math.min(drawn.length, 2)));
  const ret = drawn.slice(keep.length);
  next.ticketHand[playerId].push(...keep);
  next.ticketDeck.push(...ret);
  next.lastEvent = `seat${playerId}_draw_tickets_keep_${keep.length}`;
  return next;
}

export function applyTicketsClaim(
  tickets: NetworkRouteTicketsState,
  playerId: PlayerId,
  edgeId: string,
  payColor: TrainColor,
): NetworkRouteTicketsState | null {
  const meta = tickets.edgeMeta[edgeId];
  if (!meta) return null;
  const hand = tickets.trainHand[playerId];
  if (!canPayForClaim(hand, meta.color, meta.length, payColor)) return null;
  if (tickets.trainsLeft[playerId]! < meta.length) return null;
  const next = cloneTicketsState(tickets);
  const paid = payForClaim(next.trainHand[playerId], meta.length, payColor);
  next.trainHand[playerId] = paid.hand;
  next.trainDiscard.push(...paid.spent);
  next.trainsLeft[playerId] = next.trainsLeft[playerId]! - meta.length;
  const pts = next.lengthScores[meta.length] ?? meta.length;
  next.routeScore[playerId] = next.routeScore[playerId]! + pts;
  next.lastEvent = `seat${playerId}_claim_${edgeId}_${payColor}_+${pts}`;
  return next;
}

export { handTotal, emptyHand };
