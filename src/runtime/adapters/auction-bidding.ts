/** Auction-bidding-v1 on the public play-kernel.
 *
 * Classic: two-seat, one-lot open raise/pass (amber/jade).
 * Harbor subset (T007): multi-lot deck + optional sealed bids + black-market
 * resale — keeps bid/pass resolution semantics; does not invent a new kernel.
 * Gallery subset (T012/T015): multi modes (open/sealed/fixed/double) + artist
 * market-ladder sell + 2–5 seats + round-start hand refill — parallel to harbor.
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
  createLiveFloorLot,
  passOnLiveLot,
  raiseOnLiveLot,
  setLiveLotBrokerTerms,
  suggestRaiseAmounts,
  type LiveFloorLot,
} from "../auction-floor";
import {
  splitBrokerageAward,
  splitNegotiatedBrokerage,
} from "../brokerage";

export const AUCTION_BIDDING_KERNEL_TYPE = "auction-bidding-v1" as const;

export type AuctionLotDef = {
  id: string;
  name: string;
  /** 底价 — minimum meaningful bid / sealed floor. */
  reserve: number;
  /** 黑市倍率 applied to reserve when sold. */
  marketMult: number;
};

export type AuctionLotInstance = AuctionLotDef & { instanceId: string };

export type AuctionBiddingContent = {
  lots: AuctionLotDef[];
  startingFunds: number;
  /** open = alternate raise/pass; sealed = each seat commits once per lot. */
  bidVisibility: "open" | "sealed";
};

export type GalleryAuctionMode = "open" | "sealed" | "fixed" | "double";

export type GalleryPaintingDef = {
  id: string;
  name: string;
  artistId: string;
  /** Floor for open/sealed; posted price for fixed mode. */
  reserve: number;
};

export type GalleryPaintingInstance = GalleryPaintingDef & { instanceId: string };

export type GalleryAuctionContent = {
  artists: Array<{ id: string; name: string }>;
  paintings: GalleryPaintingDef[];
  startingFunds: number;
  modes: GalleryAuctionMode[];
  /** Successful sales of one artist that end the round (2p ≈ 3). */
  salesToEndRound: number;
  /** Rank ladder applied (cumulative) when round ends. */
  marketLadder: number[];
  handSize: number;
  roundsToEnd: number;
  /** Simultaneous sealed: any uncommitted seat may commit (off-turn). */
  simultaneousSealed: boolean;
  /** Multi-party brokerage: second-highest gets a cut of the award. */
  brokerageEnabled: boolean;
  /** Basis points of winning price to second place (1000 = 10%). */
  brokerSecondCutBps: number;
  /** T024: concurrent open lots on a live floor (realtime multi-lot). */
  liveMultiLotFloor: boolean;
  /** Cap concurrent live floor lots. */
  maxLiveLots: number;
  /** T024: explicit per-deal broker seat+cut beyond fixed award-cut. */
  negotiatedBrokerage: boolean;
};

export type GalleryAuctionState = {
  artists: Array<{ id: string; name: string }>;
  modes: GalleryAuctionMode[];
  currentMode: GalleryAuctionMode;
  modeCursor: number;
  salesToEndRound: number;
  marketLadder: number[];
  roundsToEnd: number;
  round: number;
  playerCount: number;
  handSize: number;
  auctioneer: PlayerId;
  auctionHand: GalleryPaintingInstance[][];
  collection: GalleryPaintingInstance[][];
  deck: GalleryPaintingInstance[];
  currentLot: GalleryPaintingInstance | null;
  /** Second painting when mode === "double"; otherwise null. */
  companionLot: GalleryPaintingInstance | null;
  sealedBids: Array<number | null>;
  fixedPrice: number;
  fixedAnswered: boolean[];
  roundSales: Record<string, number>;
  marketPrices: Record<string, number>;
  lastSold: {
    seat: number;
    name: string;
    payout: number;
    artistId: string;
  } | null;
  marketPasses: number;
  simultaneousSealed: boolean;
  brokerageEnabled: boolean;
  brokerSecondCutBps: number;
  lastBroker: { seat: number; cut: number } | null;
  liveMultiLotFloor: boolean;
  maxLiveLots: number;
  negotiatedBrokerage: boolean;
  activeFloorLots: Array<LiveFloorLot<GalleryPaintingInstance>>;
};

type AuctionBiddingConfig = {
  playerCount: number;
  lotValue: number;
  harbor: boolean;
  gallery: boolean;
  content: AuctionBiddingContent | null;
  galleryContent: GalleryAuctionContent | null;
};

export type AuctionBiddingGenre = {
  /** Classic lot id when !harbor && !gallery; subsets use currentLot. */
  lotId: "amber" | "jade" | string;
  chips: number[];
  /** Classic: VP from awarded lotValue. Subsets: lots won count (display). */
  scores: number[];
  lotValue: number;
  currentBid: number;
  highBidder: number | null;
  passedWithoutBid: number;
  awardedTo: number | null;
  seatOrder: number[];
  /** Harbor fields (null in classic / gallery). */
  harbor: {
    bidVisibility: "open" | "sealed";
    deck: AuctionLotInstance[];
    discard: AuctionLotInstance[];
    currentLot: AuctionLotInstance | null;
    hand: [AuctionLotInstance[], AuctionLotInstance[]];
    /** sealed: null=pending, number=bid, -1=pass */
    sealedBids: [number | null, number | null];
    lastSold: { seat: number; name: string; payout: number } | null;
  } | null;
  /** Gallery fields (null in classic / harbor). */
  gallery: GalleryAuctionState | null;
};

/** Generic harbor/auction-house cues (not 暗港-specific alone). */
export const HARBOR_AUCTION_CUES =
  /黑市|赃物|密封|拍品|底价|流拍|暗港|牌库|转售|black\s*market|sealed\s*bid|lot\s*queue|reserve\s*price/i;

/** Generic gallery / multi-mode + artist-market cues (not Modern Art IP). */
export const GALLERY_AUCTION_CUES =
  /画家|行情|画作|画廊|定价购|定价购买|双画|公开加价|一次暗标|artist\s*market|fixed.?price|gallery\s*auction|market\s*ladder/i;

export function ideaRequestsHarborAuction(idea: string): boolean {
  return HARBOR_AUCTION_CUES.test(idea);
}

export function ideaRequestsGalleryAuction(idea: string): boolean {
  return GALLERY_AUCTION_CUES.test(idea);
}

export function defaultHarborLots(): AuctionLotDef[] {
  const names = [
    "暗港罗盘",
    "伪旗",
    "锈蚀火炮",
    "密账",
    "毒酒",
    "走私香料",
    "假护照",
    "沉船图",
  ];
  // Varied reserve / mult — generic loot table, not a special-case skin.
  const reserves = [4, 5, 6, 7, 5, 8, 6, 9];
  const mults = [1.5, 1.2, 1.8, 2.0, 1.4, 1.6, 1.3, 2.2];
  return names.map((name, i) => ({
    id: `lot_${i}_${name}`,
    name,
    reserve: reserves[i]!,
    marketMult: mults[i]!,
  }));
}

export function defaultHarborContent(
  overrides?: Partial<AuctionBiddingContent>,
): AuctionBiddingContent {
  return {
    lots: overrides?.lots ?? defaultHarborLots(),
    startingFunds: overrides?.startingFunds ?? 30,
    bidVisibility: overrides?.bidVisibility ?? "open",
  };
}

export function parseHarborTuningFromIdea(
  idea: string,
): Partial<AuctionBiddingContent> {
  const out: Partial<AuctionBiddingContent> = {};
  const funds = idea.match(/(?:资金|筹码)\s*(\d+)/);
  if (funds) out.startingFunds = Math.max(1, Number(funds[1]));
  if (/密封出价|密封竞价|sealed/.test(idea)) out.bidVisibility = "sealed";
  else if (/密封/.test(idea) && /加价/.test(idea)) out.bidVisibility = "open";
  else if (/密封/.test(idea)) out.bidVisibility = "sealed";
  return out;
}

export function harborAuctionUnsupportedNotes(): string[] {
  return [
    "auction-bidding-v1 harbor subset: multi-lot queue, open or sealed resolve, black-market resale; 3–4 seats / simultaneous real-time sealed / negotiated trades unsupported.",
  ];
}

export function defaultGalleryArtists(): Array<{ id: string; name: string }> {
  return [
    { id: "a0", name: "青釉" },
    { id: "a1", name: "赤陶" },
    { id: "a2", name: "墨线" },
    { id: "a3", name: "金箔" },
  ];
}

export function defaultGalleryPaintings(
  artists: Array<{ id: string; name: string }> = defaultGalleryArtists(),
  copiesPerArtist = 4,
): GalleryPaintingDef[] {
  const out: GalleryPaintingDef[] = [];
  let n = 0;
  const copies = Math.max(4, copiesPerArtist);
  for (const artist of artists) {
    for (let k = 0; k < copies; k += 1) {
      out.push({
        id: `paint_${n}`,
        name: `${artist.name}·${k + 1}`,
        artistId: artist.id,
        reserve: 5 + (n % 5),
      });
      n += 1;
    }
  }
  return out;
}

export function defaultGalleryContent(
  overrides?: Partial<GalleryAuctionContent> & { playerCount?: number },
): GalleryAuctionContent {
  const artists = overrides?.artists ?? defaultGalleryArtists();
  const seats = Math.max(2, Math.min(5, overrides?.playerCount ?? 2));
  const copies = Math.max(4, seats + 2);
  return {
    artists,
    paintings:
      overrides?.paintings ?? defaultGalleryPaintings(artists, copies),
    startingFunds: overrides?.startingFunds ?? 100,
    modes: overrides?.modes ?? ["open", "sealed", "fixed", "double"],
    salesToEndRound:
      overrides?.salesToEndRound ?? Math.max(3, seats),
    marketLadder: overrides?.marketLadder ?? [30, 20, 10, 0],
    handSize: overrides?.handSize ?? 4,
    roundsToEnd: overrides?.roundsToEnd ?? 4,
    simultaneousSealed: overrides?.simultaneousSealed ?? true,
    brokerageEnabled:
      overrides?.brokerageEnabled ?? seats >= 3,
    brokerSecondCutBps: overrides?.brokerSecondCutBps ?? 1000,
    liveMultiLotFloor: overrides?.liveMultiLotFloor ?? true,
    maxLiveLots: overrides?.maxLiveLots ?? 2,
    negotiatedBrokerage:
      overrides?.negotiatedBrokerage ?? seats >= 3,
  };
}

export function parseGallerySeatsFromIdea(idea: string): number | null {
  const range = idea.match(
    /(\d+)\s*[-–—－]\s*(\d+)\s*(?:人|理想|players?|席|位)?/i,
  );
  if (range) {
    const hi = Math.max(Number(range[1]), Number(range[2]));
    return Math.max(2, Math.min(5, hi));
  }
  const single = idea.match(/(\d+)\s*(?:[-–—－]?\s*)?(?:人|玩家|players?)/i);
  if (single) return Math.max(2, Math.min(5, Number(single[1])));
  return null;
}

export function parseGalleryTuningFromIdea(
  idea: string,
): Partial<GalleryAuctionContent> & { playerCount?: number } {
  const out: Partial<GalleryAuctionContent> & { playerCount?: number } = {};
  const funds = idea.match(/(?:资金|筹码)\s*(\d+)/);
  if (funds) out.startingFunds = Math.max(1, Number(funds[1]));
  // Prefer 100 when 资金若干 or explicit 100.
  if (/每人\s*100|资金若干/.test(idea) && !funds) out.startingFunds = 100;
  const sales = idea.match(/第\s*(\d+)\s*张/);
  if (sales) out.salesToEndRound = Math.max(2, Number(sales[1]));
  const seats = parseGallerySeatsFromIdea(idea);
  if (seats !== null) out.playerCount = seats;
  const modes: GalleryAuctionMode[] = [];
  if (/公开加价|open\s*raise|open\s*bid/i.test(idea)) modes.push("open");
  if (/一次暗标|密封|sealed/i.test(idea)) modes.push("sealed");
  if (/定价购|定价购买|fixed/i.test(idea)) modes.push("fixed");
  if (/双画|double\s*paint/i.test(idea)) modes.push("double");
  if (modes.length) out.modes = [...new Set(modes)] as GalleryAuctionMode[];
  return out;
}

export function galleryAuctionUnsupportedNotes(): string[] {
  return [
    "auction-bidding-v1 gallery subset: 2–5 seats, open/sealed/fixed/double + market sell + refill; simultaneous sealed commits (off-turn) + second-place award-cut brokerage; live multi-lot open floor + negotiated per-deal broker cut (T024).",
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

function instantiateDeck(lots: AuctionLotDef[], seed: number): AuctionLotInstance[] {
  return shuffleWithSeed(lots, seed).map((lot, i) => ({
    ...lot,
    instanceId: `${lot.id}#${i}`,
  }));
}

function instantiateGalleryDeck(
  paintings: GalleryPaintingDef[],
  seed: number,
): GalleryPaintingInstance[] {
  return shuffleWithSeed(paintings, seed).map((p, i) => ({
    ...p,
    instanceId: `${p.id}#${i}`,
  }));
}

function cloneHarbor(
  harbor: NonNullable<AuctionBiddingGenre["harbor"]>,
): NonNullable<AuctionBiddingGenre["harbor"]> {
  return {
    bidVisibility: harbor.bidVisibility,
    deck: harbor.deck.map((l) => ({ ...l })),
    discard: harbor.discard.map((l) => ({ ...l })),
    currentLot: harbor.currentLot ? { ...harbor.currentLot } : null,
    hand: [
      harbor.hand[0].map((l) => ({ ...l })),
      harbor.hand[1].map((l) => ({ ...l })),
    ],
    sealedBids: [...harbor.sealedBids] as [number | null, number | null],
    lastSold: harbor.lastSold ? { ...harbor.lastSold } : null,
  };
}

function cloneGallery(g: GalleryAuctionState): GalleryAuctionState {
  return {
    artists: g.artists.map((a) => ({ ...a })),
    modes: [...g.modes],
    currentMode: g.currentMode,
    modeCursor: g.modeCursor,
    salesToEndRound: g.salesToEndRound,
    marketLadder: [...g.marketLadder],
    roundsToEnd: g.roundsToEnd,
    round: g.round,
    playerCount: g.playerCount,
    handSize: g.handSize,
    auctioneer: g.auctioneer,
    auctionHand: g.auctionHand.map((hand) => hand.map((p) => ({ ...p }))),
    collection: g.collection.map((col) => col.map((p) => ({ ...p }))),
    deck: g.deck.map((p) => ({ ...p })),
    currentLot: g.currentLot ? { ...g.currentLot } : null,
    companionLot: g.companionLot ? { ...g.companionLot } : null,
    sealedBids: [...g.sealedBids],
    fixedPrice: g.fixedPrice,
    fixedAnswered: [...g.fixedAnswered],
    roundSales: { ...g.roundSales },
    marketPrices: { ...g.marketPrices },
    lastSold: g.lastSold ? { ...g.lastSold } : null,
    marketPasses: g.marketPasses,
    simultaneousSealed: g.simultaneousSealed ?? true,
    brokerageEnabled: g.brokerageEnabled ?? false,
    brokerSecondCutBps: g.brokerSecondCutBps ?? 1000,
    lastBroker: g.lastBroker ? { ...g.lastBroker } : null,
    liveMultiLotFloor: g.liveMultiLotFloor ?? true,
    maxLiveLots: g.maxLiveLots ?? 2,
    negotiatedBrokerage: g.negotiatedBrokerage ?? false,
    activeFloorLots: (g.activeFloorLots ?? []).map((lot) => ({
      ...lot,
      passedSinceRaise: [...lot.passedSinceRaise],
      payload: { ...lot.payload },
    })),
  };
}

function drawNextLot(
  harbor: NonNullable<AuctionBiddingGenre["harbor"]>,
): AuctionLotInstance | null {
  if (harbor.deck.length === 0) return null;
  return harbor.deck.shift() ?? null;
}

function dealGalleryHands(
  deck: GalleryPaintingInstance[],
  handSize: number,
  playerCount: number,
): {
  hands: GalleryPaintingInstance[][];
  deck: GalleryPaintingInstance[];
} {
  const hands: GalleryPaintingInstance[][] = Array.from(
    { length: playerCount },
    () => [],
  );
  for (let i = 0; i < handSize; i += 1) {
    for (let seat = 0; seat < playerCount; seat += 1) {
      if (deck.length) hands[seat]!.push(deck.shift()!);
    }
  }
  return { hands, deck };
}

/** Round-start refill: each seat draws up to handSize from deck (T015 timing). */
function refillGalleryHands(g: GalleryAuctionState): void {
  for (let seat = 0; seat < g.playerCount; seat += 1) {
    while (
      g.auctionHand[seat]!.length < g.handSize &&
      g.deck.length > 0
    ) {
      g.auctionHand[seat]!.push(g.deck.shift()!);
    }
  }
}

function startLotBidding(
  genre: AuctionBiddingGenre,
  firstSeat: PlayerId,
): {
  genre: AuctionBiddingGenre;
  phase: PlayPhaseId;
  activePlayerId: PlayerId;
} {
  const harbor = genre.harbor!;
  const lot = harbor.currentLot;
  if (!lot) {
    return { genre, phase: "ended", activePlayerId: firstSeat };
  }
  genre.lotId = lot.id;
  genre.lotValue = lot.reserve;
  genre.currentBid = Math.max(0, lot.reserve - 1);
  genre.highBidder = null;
  genre.passedWithoutBid = 0;
  genre.awardedTo = null;
  harbor.sealedBids = [null, null];
  harbor.lastSold = null;
  if (harbor.bidVisibility === "sealed") {
    return { genre, phase: "sealed", activePlayerId: firstSeat };
  }
  return { genre, phase: "bidding", activePlayerId: firstSeat };
}

function finishGameByChips(genre: AuctionBiddingGenre, actor: PlayerId) {
  let best = -Infinity;
  let winnerId: PlayerId | null = null;
  let tie = false;
  for (let seat = 0; seat < genre.chips.length; seat += 1) {
    const c = genre.chips[seat]!;
    if (c > best) {
      best = c;
      winnerId = seat as PlayerId;
      tie = false;
    } else if (c === best) {
      tie = true;
    }
  }
  return {
    genre,
    phase: "ended" as PlayPhaseId,
    activePlayerId: actor,
    status: "complete" as const,
    winnerId: tie ? null : winnerId,
    endReason: "deck_exhausted",
  };
}

function applyGalleryMarketLadder(g: GalleryAuctionState): void {
  const ranked = [...g.artists].sort((a, b) => {
    const sa = g.roundSales[a.id] ?? 0;
    const sb = g.roundSales[b.id] ?? 0;
    if (sb !== sa) return sb - sa;
    return a.id.localeCompare(b.id);
  });
  ranked.forEach((artist, i) => {
    const add = g.marketLadder[i] ?? 0;
    if (add > 0) {
      g.marketPrices[artist.id] = (g.marketPrices[artist.id] ?? 0) + add;
    }
  });
}


function cashOutCollections(genre: AuctionBiddingGenre): void {
  const g = genre.gallery!;
  for (let seat = 0; seat < g.playerCount; seat += 1) {
    let payout = 0;
    for (const painting of g.collection[seat]!) {
      payout += g.marketPrices[painting.artistId] ?? 0;
    }
    genre.chips[seat]! += payout;
    g.collection[seat] = [];
  }
}

function ensureOfferReady(
  genre: AuctionBiddingGenre,
  actor: PlayerId,
): {
  genre: AuctionBiddingGenre;
  phase: PlayPhaseId;
  activePlayerId: PlayerId;
  status: "active" | "complete";
  winnerId: PlayerId | null;
  endReason?: string;
} {
  const g = genre.gallery!;
  const n = g.playerCount;
  // Skip auctioneers with empty hands (no mid-round refill — only round-start).
  for (let i = 0; i < n; i += 1) {
    if (g.auctionHand[g.auctioneer]!.length > 0) break;
    g.auctioneer = ((g.auctioneer + 1) % n) as PlayerId;
  }
  if (g.auctionHand[g.auctioneer]!.length === 0) {
    cashOutCollections(genre);
    const ended = finishGameByChips(genre, actor);
    return { ...ended, status: "complete", winnerId: ended.winnerId };
  }
  return {
    genre,
    phase: "offer",
    activePlayerId: g.auctioneer,
    status: "active",
    winnerId: null,
  };
}

function galleryAwardLot(
  genre: AuctionBiddingGenre,
  winner: PlayerId,
  price: number,
  secondSeat: PlayerId | null = null,
): {
  genre: AuctionBiddingGenre;
  phase: PlayPhaseId;
  activePlayerId: PlayerId;
  endReason: string;
} {
  const g = genre.gallery!;
  const lot = g.currentLot!;
  const companion = g.companionLot;
  genre.chips[winner]! -= price;
  g.lastBroker = null;
  const split = splitBrokerageAward({
    price,
    seller: g.auctioneer,
    winner,
    second: secondSeat,
    enabled: g.brokerageEnabled,
    cutBps: g.brokerSecondCutBps,
    playerCount: g.playerCount,
  });
  if (split.brokerSeat !== null && split.toBroker > 0) {
    genre.chips[split.brokerSeat]! += split.toBroker;
    g.lastBroker = { seat: split.brokerSeat, cut: split.toBroker };
  }
  genre.chips[g.auctioneer]! += split.toSeller;
  genre.scores[winner]! += companion ? 2 : 1;
  genre.awardedTo = winner;
  genre.highBidder = winner;
  genre.currentBid = price;
  g.collection[winner]!.push(lot);
  g.roundSales[lot.artistId] = (g.roundSales[lot.artistId] ?? 0) + 1;
  if (companion) {
    g.collection[winner]!.push(companion);
    g.roundSales[companion.artistId] =
      (g.roundSales[companion.artistId] ?? 0) + 1;
  }
  g.currentLot = null;
  g.companionLot = null;
  const sales = g.roundSales[lot.artistId] ?? 0;
  if (sales >= g.salesToEndRound) {
    applyGalleryMarketLadder(g);
    g.marketPasses = 0;
    g.lastSold = null;
    return {
      genre,
      phase: "market",
      activePlayerId: 0 as PlayerId,
      endReason: "round_market",
      status: "active" as const,
      winnerId: null as PlayerId | null,
    };
  }
  g.auctioneer = ((g.auctioneer + 1) % g.playerCount) as PlayerId;
  return { ...ensureOfferReady(genre, winner), endReason: "lot_awarded" };
}

function galleryUnsold(
  genre: AuctionBiddingGenre,
  actor: PlayerId,
): {
  genre: AuctionBiddingGenre;
  phase: PlayPhaseId;
  activePlayerId: PlayerId;
  endReason: string;
  status: "active" | "complete";
  winnerId: PlayerId | null;
} {
  const g = genre.gallery!;
  // Return unsold paintings to the bottom of the deck (exact refill pool).
  if (g.currentLot) {
    g.deck.push(g.currentLot);
    g.currentLot = null;
  }
  if (g.companionLot) {
    g.deck.push(g.companionLot);
    g.companionLot = null;
  }
  genre.awardedTo = null;
  g.auctioneer = ((g.auctioneer + 1) % g.playerCount) as PlayerId;
  return { ...ensureOfferReady(genre, actor), endReason: "lot_unsold" };
}


function pushRemainingFloorLotsToDeck(g: GalleryAuctionState): void {
  for (const lot of g.activeFloorLots) {
    g.deck.push(lot.payload);
  }
  g.activeFloorLots = [];
}

function galleryAwardFloorLot(
  genre: AuctionBiddingGenre,
  floorLot: LiveFloorLot<GalleryPaintingInstance>,
  winner: PlayerId,
  price: number,
): {
  genre: AuctionBiddingGenre;
  phase: PlayPhaseId;
  activePlayerId: PlayerId;
  endReason: string;
  status?: "active" | "complete";
  winnerId?: PlayerId | null;
} {
  const g = genre.gallery!;
  const lot = floorLot.payload;
  genre.chips[winner]! -= price;
  g.lastBroker = null;
  let split;
  if (
    g.negotiatedBrokerage &&
    floorLot.brokerSeat !== null &&
    floorLot.brokerCutBps > 0
  ) {
    split = splitNegotiatedBrokerage({
      price,
      seller: floorLot.seller,
      winner,
      brokerSeat: floorLot.brokerSeat,
      cutBps: floorLot.brokerCutBps,
    });
  } else {
    split = splitBrokerageAward({
      price,
      seller: floorLot.seller,
      winner,
      second: null,
      enabled: g.brokerageEnabled,
      cutBps: g.brokerSecondCutBps,
      playerCount: g.playerCount,
    });
  }
  if (split.brokerSeat !== null && split.toBroker > 0) {
    genre.chips[split.brokerSeat]! += split.toBroker;
    g.lastBroker = { seat: split.brokerSeat, cut: split.toBroker };
  }
  genre.chips[floorLot.seller]! += split.toSeller;
  genre.scores[winner]! += 1;
  genre.awardedTo = winner;
  genre.highBidder = winner;
  genre.currentBid = price;
  g.collection[winner]!.push(lot);
  g.roundSales[lot.artistId] = (g.roundSales[lot.artistId] ?? 0) + 1;
  g.activeFloorLots = g.activeFloorLots.filter((l) => l.lotId !== floorLot.lotId);
  g.currentLot = null;
  g.companionLot = null;
  const sales = g.roundSales[lot.artistId] ?? 0;
  if (sales >= g.salesToEndRound) {
    pushRemainingFloorLotsToDeck(g);
    applyGalleryMarketLadder(g);
    g.marketPasses = 0;
    g.lastSold = null;
    return {
      genre,
      phase: "market",
      activePlayerId: 0 as PlayerId,
      endReason: "round_market",
      status: "active",
      winnerId: null,
    };
  }
  if (g.activeFloorLots.length > 0) {
    return {
      genre,
      phase: "live_floor",
      activePlayerId: g.auctioneer,
      endReason: "lot_awarded",
      status: "active",
      winnerId: null,
    };
  }
  g.auctioneer = ((g.auctioneer + 1) % g.playerCount) as PlayerId;
  return { ...ensureOfferReady(genre, winner), endReason: "lot_awarded" };
}

function galleryUnsoldFloorLot(
  genre: AuctionBiddingGenre,
  floorLot: LiveFloorLot<GalleryPaintingInstance>,
  actor: PlayerId,
) {
  const g = genre.gallery!;
  g.deck.push(floorLot.payload);
  g.activeFloorLots = g.activeFloorLots.filter((l) => l.lotId !== floorLot.lotId);
  g.currentLot = null;
  g.companionLot = null;
  genre.awardedTo = null;
  if (g.activeFloorLots.length > 0) {
    return {
      genre,
      phase: "live_floor" as PlayPhaseId,
      activePlayerId: g.auctioneer,
      endReason: "lot_unsold",
      status: "active" as const,
      winnerId: null as PlayerId | null,
    };
  }
  g.auctioneer = ((g.auctioneer + 1) % g.playerCount) as PlayerId;
  return { ...ensureOfferReady(genre, actor), endReason: "lot_unsold" };
}

function galleryMaybeEndAfterMarket(
  genre: AuctionBiddingGenre,
  actor: PlayerId,
) {
  const g = genre.gallery!;
  g.roundSales = Object.fromEntries(g.artists.map((a) => [a.id, 0]));
  g.round += 1;
  g.marketPasses = 0;
  if (g.round > g.roundsToEnd) {
    cashOutCollections(genre);
    return finishGameByChips(genre, actor);
  }
  // T015: exact round-start refill timing — after market, before next offer.
  refillGalleryHands(g);
  return ensureOfferReady(genre, actor);
}

function parseAuctionBiddingConfig(
  raw: Record<string, unknown>,
): AuctionBiddingConfig | null {
  const rawCount = raw.playerCount ?? 2;
  if (typeof rawCount !== "number" || !Number.isInteger(rawCount)) return null;

  let galleryContent: GalleryAuctionContent | null = null;
  const gcRaw = raw.galleryContent;
  if (gcRaw && typeof gcRaw === "object") {
    const c = gcRaw as Record<string, unknown>;
    const artists = Array.isArray(c.artists)
      ? (c.artists as GalleryAuctionContent["artists"])
      : null;
    const paintings = Array.isArray(c.paintings)
      ? (c.paintings as GalleryPaintingDef[])
      : null;
    const modes = Array.isArray(c.modes)
      ? (c.modes as GalleryAuctionMode[]).filter(
          (m) =>
            m === "open" ||
            m === "sealed" ||
            m === "fixed" ||
            m === "double",
        )
      : ["open", "sealed", "fixed", "double"];
    if (artists && artists.length > 0 && paintings && paintings.length > 0) {
      galleryContent = {
        artists,
        paintings,
        startingFunds:
          typeof c.startingFunds === "number" ? c.startingFunds : 100,
        modes: modes.length ? modes : ["open", "sealed", "fixed", "double"],
        salesToEndRound:
          typeof c.salesToEndRound === "number" ? c.salesToEndRound : 3,
        marketLadder: Array.isArray(c.marketLadder)
          ? (c.marketLadder as number[])
          : [30, 20, 10, 0],
        handSize: typeof c.handSize === "number" ? c.handSize : 4,
        roundsToEnd: typeof c.roundsToEnd === "number" ? c.roundsToEnd : 4,
        simultaneousSealed:
          typeof c.simultaneousSealed === "boolean"
            ? c.simultaneousSealed
            : true,
        brokerageEnabled:
          typeof c.brokerageEnabled === "boolean"
            ? c.brokerageEnabled
            : (typeof raw.playerCount === "number" ? raw.playerCount >= 3 : false),
        brokerSecondCutBps:
          typeof c.brokerSecondCutBps === "number" ? c.brokerSecondCutBps : 1000,
        liveMultiLotFloor:
          typeof c.liveMultiLotFloor === "boolean" ? c.liveMultiLotFloor : true,
        maxLiveLots:
          typeof c.maxLiveLots === "number"
            ? Math.max(1, Math.min(4, c.maxLiveLots))
            : 2,
        negotiatedBrokerage:
          typeof c.negotiatedBrokerage === "boolean"
            ? c.negotiatedBrokerage
            : (typeof raw.playerCount === "number" ? raw.playerCount >= 3 : false),
      };
    }
  }

  const contentRaw = raw.content;
  let content: AuctionBiddingContent | null = null;
  if (contentRaw && typeof contentRaw === "object" && !galleryContent) {
    const c = contentRaw as Record<string, unknown>;
    const lots = Array.isArray(c.lots) ? (c.lots as AuctionLotDef[]) : null;
    if (lots && lots.length > 0) {
      content = {
        lots,
        startingFunds:
          typeof c.startingFunds === "number" ? c.startingFunds : 30,
        bidVisibility: c.bidVisibility === "sealed" ? "sealed" : "open",
      };
    }
  }

  const gallery = raw.gallery === true || galleryContent !== null;
  const harbor =
    !gallery && (raw.harbor === true || content !== null);
  // Gallery: 2–5 seats. Classic / harbor: exactly 2.
  if (gallery) {
    if (rawCount < 2 || rawCount > 5) return null;
  } else if (rawCount !== 2) {
    return null;
  }
  const lotValue =
    typeof raw.lotValue === "number"
      ? raw.lotValue
      : harbor || gallery
        ? 0
        : 10;
  if (!harbor && !gallery && lotValue !== 10) return null;
  return {
    playerCount: gallery ? rawCount : 2,
    lotValue: harbor || gallery ? lotValue : 10,
    harbor,
    gallery,
    content: gallery ? null : content,
    galleryContent: gallery ? galleryContent : null,
  };
}

export function createAuctionBiddingKernelConfig(input?: {
  harbor?: boolean;
  gallery?: boolean;
  playerCount?: number;
  content?: AuctionBiddingContent | null;
  galleryContent?: GalleryAuctionContent | null;
}): PlayKernelConfig {
  const galleryContent = input?.galleryContent ?? null;
  const gallery = input?.gallery === true || galleryContent !== null;
  const content = gallery ? null : (input?.content ?? null);
  const harbor = !gallery && (input?.harbor === true || content !== null);
  const playerCount = gallery
    ? Math.max(2, Math.min(5, input?.playerCount ?? 2))
    : 2;
  return {
    kernelType: AUCTION_BIDDING_KERNEL_TYPE,
    playerCount,
    phases: [
      { id: "offer", name: "Offer" },
      { id: "bidding", name: "Bidding" },
      { id: "live_floor", name: "Live multi-lot floor" },
      { id: "sealed", name: "Sealed" },
      { id: "fixed", name: "Fixed" },
      { id: "market", name: "Market" },
      { id: "ended", name: "Ended" },
    ],
    adapter: {
      playerCount,
      lotValue: harbor || gallery ? 0 : 10,
      harbor,
      gallery,
      ...(content ? { content } : {}),
      ...(galleryContent ? { galleryContent } : {}),
    },
  };
}

function createGalleryState(
  content: GalleryAuctionContent,
  seed: number,
  playerCount: number,
): GalleryAuctionState {
  const n = Math.max(2, Math.min(5, playerCount));
  let deck = instantiateGalleryDeck(content.paintings, seed ^ 0xa11e17);
  const dealt = dealGalleryHands(deck, content.handSize, n);
  deck = dealt.deck;
  const prices: Record<string, number> = {};
  const sales: Record<string, number> = {};
  for (const a of content.artists) {
    prices[a.id] = 0;
    sales[a.id] = 0;
  }
  return {
    artists: content.artists.map((a) => ({ ...a })),
    modes: [...content.modes],
    currentMode: content.modes[0] ?? "open",
    modeCursor: 0,
    salesToEndRound: content.salesToEndRound,
    marketLadder: [...content.marketLadder],
    roundsToEnd: content.roundsToEnd,
    round: 1,
    playerCount: n,
    handSize: content.handSize,
    // play-kernel createInitialState always starts activePlayerId at 0.
    auctioneer: 0 as PlayerId,
    auctionHand: dealt.hands,
    collection: Array.from({ length: n }, () => []),
    deck,
    currentLot: null,
    companionLot: null,
    sealedBids: Array.from({ length: n }, () => null),
    fixedPrice: 0,
    fixedAnswered: Array.from({ length: n }, () => false),
    roundSales: sales,
    marketPrices: prices,
    lastSold: null,
    marketPasses: 0,
    simultaneousSealed: content.simultaneousSealed ?? true,
    brokerageEnabled: content.brokerageEnabled ?? playerCount >= 3,
    brokerSecondCutBps: content.brokerSecondCutBps ?? 1000,
    lastBroker: null,
    liveMultiLotFloor: content.liveMultiLotFloor ?? true,
    maxLiveLots: content.maxLiveLots ?? 2,
    negotiatedBrokerage:
      content.negotiatedBrokerage ?? playerCount >= 3,
    activeFloorLots: [],
  };
}

export const auctionBiddingAdapter: PlayKernelAdapter<
  AuctionBiddingGenre,
  AuctionBiddingConfig
> = {
  kernelType: AUCTION_BIDDING_KERNEL_TYPE,
  parseConfig: parseAuctionBiddingConfig,
  allowsOffTurnAction(state, action) {
    const g = state.genre.gallery;
    if (!g) return false;
    if (
      g.liveMultiLotFloor &&
      state.phase === "live_floor" &&
      (action.type === "floor_raise" ||
        action.type === "floor_pass" ||
        action.type === "set_broker_terms" ||
        action.type === "play_painting")
    ) {
      return true;
    }
    if (!g.simultaneousSealed || state.phase !== "sealed") return false;
    if (action.type !== "sealed_bid" && action.type !== "sealed_pass") {
      return false;
    }
    return g.sealedBids[action.playerId] === null;
  },
  createGenreState(config, seed) {
    const n = config.playerCount;
    const first = (createSeededRng(seed).at(1) % n) as PlayerId;
    if (config.gallery && config.galleryContent) {
      const gallery = createGalleryState(config.galleryContent, seed, n);
      const funds = config.galleryContent.startingFunds;
      return {
        lotId: "gallery",
        chips: Array.from({ length: n }, () => funds),
        scores: Array.from({ length: n }, () => 0),
        lotValue: 0,
        currentBid: 0,
        highBidder: null,
        passedWithoutBid: 0,
        awardedTo: null,
        seatOrder: Array.from({ length: n }, (_, i) => (first + i) % n),
        harbor: null,
        gallery,
      };
    }
    if (config.harbor && config.content) {
      const deck = instantiateDeck(config.content.lots, seed ^ 0x51eed);
      const current = deck.shift() ?? null;
      const genre: AuctionBiddingGenre = {
        lotId: current?.id ?? "empty",
        chips: [config.content.startingFunds, config.content.startingFunds],
        scores: [0, 0],
        lotValue: current?.reserve ?? 0,
        currentBid: current ? Math.max(0, current.reserve - 1) : 0,
        highBidder: null,
        passedWithoutBid: 0,
        awardedTo: null,
        seatOrder: [first, (1 - first) as PlayerId],
        harbor: {
          bidVisibility: config.content.bidVisibility,
          deck,
          discard: [],
          currentLot: current,
          hand: [[], []],
          sealedBids: [null, null],
          lastSold: null,
        },
        gallery: null,
      };
      return genre;
    }
    return {
      lotId: createSeededRng(seed).at(2) % 2 === 0 ? "amber" : "jade",
      chips: [20, 20],
      scores: [0, 0],
      lotValue: config.lotValue,
      currentBid: 0,
      highBidder: null,
      passedWithoutBid: 0,
      awardedTo: null,
      seatOrder: [first, (1 - first) as PlayerId],
      harbor: null,
      gallery: null,
    };
  },
  initialPhase(config) {
    if (config.gallery) return "offer";
    if (config.harbor && config.content?.bidVisibility === "sealed") {
      return "sealed";
    }
    return "bidding";
  },
  listLegalActions(state, playerId) {
    if (state.status !== "active") return [];
    const gallery = state.genre.gallery;
    const harbor = state.genre.harbor;
    const simultaneousSealed =
      Boolean(gallery?.simultaneousSealed && state.phase === "sealed") ||
      Boolean(
        harbor?.bidVisibility === "sealed" &&
          state.phase === "sealed" &&
          // harbor stays sequential by default; gallery drives T020
          false,
      );
    const liveFloorOffTurn =
      Boolean(gallery?.liveMultiLotFloor && state.phase === "live_floor");
    if (
      !simultaneousSealed &&
      !liveFloorOffTurn &&
      playerId !== state.activePlayerId
    ) {
      return [];
    }
    const legal: LegalAction[] = [];

    // ---- Gallery ----
    if (gallery) {
      if (state.phase === "offer") {
        if (playerId !== gallery.auctioneer) return [];
        const hand = gallery.auctionHand[playerId]!;
        for (const p of hand) {
          for (const mode of gallery.modes) {
            if (mode === "double") continue;
            legal.push({
              type: "play_painting",
              label: `拍 ${p.name} · ${mode}`,
              payload: { instanceId: p.instanceId, mode },
            });
          }
        }
        if (gallery.modes.includes("double")) {
          for (let i = 0; i < hand.length; i += 1) {
            for (let j = i + 1; j < hand.length; j += 1) {
              const a = hand[i]!;
              const b = hand[j]!;
              if (a.artistId !== b.artistId) continue;
              legal.push({
                type: "play_painting",
                label: `双画 ${a.name}+${b.name} · double`,
                payload: {
                  instanceId: a.instanceId,
                  secondInstanceId: b.instanceId,
                  mode: "double",
                },
              });
            }
          }
        }
        return legal;
      }
      if (state.phase === "market") {
        for (const p of gallery.collection[playerId]!) {
          const price = gallery.marketPrices[p.artistId] ?? 0;
          if (price > 0) {
            legal.push({
              type: "sell",
              label: `卖 ${p.name} (+${price})`,
              payload: { instanceId: p.instanceId },
            });
          }
        }
        legal.push({ type: "pass_market", label: "跳过行情卖出" });
        return legal;
      }
      if (state.phase === "sealed") {
        if (gallery.sealedBids[playerId] !== null) return [];
        const reserve =
          (gallery.currentLot?.reserve ?? 1) +
          (gallery.companionLot?.reserve ?? 0);
        const max = state.genre.chips[playerId]!;
        const amounts = [
          reserve,
          Math.min(max, reserve + 2),
          Math.min(max, reserve + 5),
          max,
        ].filter((a, i, arr) => a >= reserve && a <= max && arr.indexOf(a) === i);
        for (const amount of amounts) {
          legal.push({
            type: "sealed_bid",
            label: `Sealed ${amount}`,
            payload: { amount },
          });
        }
        legal.push({ type: "sealed_pass", label: "Sealed pass" });
        return legal;
      }
      if (state.phase === "fixed") {
        const price = gallery.fixedPrice;
        const isAuctioneer = playerId === gallery.auctioneer;
        const n = gallery.playerCount;
        let othersPending = false;
        for (let s = 0; s < n; s += 1) {
          if (s === gallery.auctioneer) continue;
          if (!gallery.fixedAnswered[s]!) othersPending = true;
        }
        if (!isAuctioneer && !gallery.fixedAnswered[playerId]!) {
          if (price <= state.genre.chips[playerId]!) {
            legal.push({
              type: "buy_fixed",
              label:
                gallery.currentMode === "double"
                  ? `双画购 ${price}`
                  : `定价购 ${price}`,
            });
          }
          legal.push({ type: "pass_fixed", label: "不买" });
          return legal;
        }
        if (
          isAuctioneer &&
          !othersPending &&
          !gallery.fixedAnswered[playerId]!
        ) {
          if (price <= state.genre.chips[playerId]!) {
            legal.push({ type: "buy_own", label: `自购 ${price}` });
          }
          legal.push({ type: "decline_own", label: "流拍" });
          return legal;
        }
        return [];
      }
      if (state.phase === "live_floor") {
        for (const lot of gallery.activeFloorLots) {
          if (playerId !== lot.seller) {
            for (const amount of suggestRaiseAmounts(
              lot,
              state.genre.chips[playerId]!,
            )) {
              legal.push({
                type: "floor_raise",
                label: `加价 ${lot.payload.name} → ${amount}`,
                payload: { lotId: lot.lotId, amount },
              });
            }
          }
          if (!lot.passedSinceRaise[playerId]) {
            legal.push({
              type: "floor_pass",
              label: `过 ${lot.payload.name}`,
              payload: { lotId: lot.lotId },
            });
          }
          if (
            gallery.negotiatedBrokerage &&
            playerId === lot.seller &&
            lot.highBidder === null
          ) {
            for (let s = 0; s < gallery.playerCount; s += 1) {
              if (s === lot.seller) continue;
              for (const bps of [1000, 1500, 2000]) {
                legal.push({
                  type: "set_broker_terms",
                  label: `经纪席${s} · ${bps / 100}%`,
                  payload: {
                    lotId: lot.lotId,
                    brokerSeat: s,
                    cutBps: bps,
                  },
                });
              }
            }
          }
        }
        if (
          playerId === gallery.auctioneer &&
          gallery.activeFloorLots.length < gallery.maxLiveLots
        ) {
          const hand = gallery.auctionHand[playerId]!;
          for (const p of hand) {
            legal.push({
              type: "play_painting",
              label: `再拍 ${p.name} · live`,
              payload: { instanceId: p.instanceId, mode: "open" },
            });
          }
        }
        return legal;
      }
      if (state.phase === "bidding") {
        legal.push({ type: "pass", label: "Pass" });
        const minBid = state.genre.currentBid + 1;
        if (minBid <= state.genre.chips[playerId]!) {
          legal.unshift({ type: "bid", label: "Bid" });
        }
        return legal;
      }
      return [];
    }

    if (state.phase === "market" && harbor) {
      for (const lot of harbor.hand[playerId]!) {
        const payout = Math.max(
          1,
          Math.floor(lot.reserve * lot.marketMult),
        );
        legal.push({
          type: "sell",
          label: `Sell ${lot.name} (+${payout})`,
          payload: { instanceId: lot.instanceId },
        });
      }
      legal.push({ type: "pass_market", label: "Skip market" });
      return legal;
    }

    if (state.phase === "sealed" && harbor) {
      if (harbor.sealedBids[playerId] !== null) return [];
      const reserve = harbor.currentLot?.reserve ?? 1;
      const max = state.genre.chips[playerId]!;
      const amounts = [
        reserve,
        Math.min(max, reserve + 2),
        Math.min(max, reserve + 5),
        max,
      ].filter((a, i, arr) => a >= reserve && a <= max && arr.indexOf(a) === i);
      for (const amount of amounts) {
        legal.push({
          type: "sealed_bid",
          label: `Sealed ${amount}`,
          payload: { amount },
        });
      }
      legal.push({ type: "sealed_pass", label: "Sealed pass" });
      return legal;
    }

    if (state.phase !== "bidding") return [];
    legal.push({ type: "pass", label: "Pass" });
    const minBid = state.genre.currentBid + 1;
    if (minBid <= state.genre.chips[playerId]!) {
      legal.unshift({ type: "bid", label: "Bid" });
    }
    return legal;
  },
  reduce(state, action) {
    if (state.status !== "active") return null;
    const g0 = state.genre.gallery;
    const offTurnSealed =
      Boolean(g0?.simultaneousSealed) &&
      state.phase === "sealed" &&
      (action.type === "sealed_bid" || action.type === "sealed_pass") &&
      g0!.sealedBids[action.playerId] === null;
    const offTurnLive =
      Boolean(g0?.liveMultiLotFloor) &&
      state.phase === "live_floor" &&
      (action.type === "floor_raise" ||
        action.type === "floor_pass" ||
        action.type === "set_broker_terms" ||
        action.type === "play_painting");
    if (
      action.playerId !== state.activePlayerId &&
      !offTurnSealed &&
      !offTurnLive
    ) {
      return null;
    }

    const baseGenre = (): AuctionBiddingGenre => ({
      ...state.genre,
      chips: [...state.genre.chips],
      scores: [...state.genre.scores],
      seatOrder: [...state.genre.seatOrder],
      harbor: state.genre.harbor ? cloneHarbor(state.genre.harbor) : null,
      gallery: state.genre.gallery ? cloneGallery(state.genre.gallery) : null,
    });

    // ---- Gallery ----
    if (state.genre.gallery) {
      const genre = baseGenre();
      const g = genre.gallery!;

      if (state.phase === "offer") {
        if (action.type !== "play_painting") return null;
        if (action.playerId !== g.auctioneer) return null;
        const id = action.payload?.instanceId;
        const mode = action.payload?.mode;
        if (typeof id !== "string") return null;
        if (
          mode !== "open" &&
          mode !== "sealed" &&
          mode !== "fixed" &&
          mode !== "double"
        ) {
          return null;
        }
        if (!g.modes.includes(mode)) return null;
        const hand = g.auctionHand[action.playerId]!;
        const idx = hand.findIndex((p) => p.instanceId === id);
        if (idx < 0) return null;
        const n = g.playerCount;
        let lot = hand[idx]!;
        let companion: GalleryPaintingInstance | null = null;
        if (mode === "double") {
          const secondId = action.payload?.secondInstanceId;
          if (typeof secondId !== "string" || secondId === id) return null;
          const idx2 = hand.findIndex((p) => p.instanceId === secondId);
          if (idx2 < 0) return null;
          const other = hand[idx2]!;
          if (other.artistId !== lot.artistId) return null;
          // remove higher index first
          const [iHi, iLo] = idx > idx2 ? [idx, idx2] : [idx2, idx];
          const removedHi = hand.splice(iHi, 1)[0]!;
          const removedLo = hand.splice(iLo, 1)[0]!;
          if (removedLo.instanceId === id) {
            lot = removedLo;
            companion = removedHi;
          } else {
            lot = removedHi;
            companion = removedLo;
          }
        } else {
          hand.splice(idx, 1);
        }
        g.currentLot = lot;
        g.companionLot = companion;
        g.currentMode = mode;
        g.modeCursor = g.modes.indexOf(mode);
        genre.lotId = lot.id;
        genre.lotValue = lot.reserve + (companion?.reserve ?? 0);
        genre.highBidder = null;
        genre.passedWithoutBid = 0;
        genre.awardedTo = null;
        g.sealedBids = Array.from({ length: n }, () => null);
        g.fixedPrice = lot.reserve + (companion?.reserve ?? 0);
        g.fixedAnswered = Array.from({ length: n }, () => false);
        g.lastSold = null;
        const nextSeat = ((g.auctioneer + 1) % n) as PlayerId;
        if (mode === "sealed") {
          genre.currentBid = 0;
          return {
            genre,
            phase: "sealed" as PlayPhaseId,
            activePlayerId: g.auctioneer,
            status: "active" as const,
            winnerId: null,
          };
        }
        if (mode === "fixed" || mode === "double") {
          genre.currentBid = g.fixedPrice;
          return {
            genre,
            phase: "fixed" as PlayPhaseId,
            activePlayerId: nextSeat,
            status: "active" as const,
            winnerId: null,
          };
        }
        // open — T024 live multi-lot floor when enabled
        if (g.liveMultiLotFloor) {
          const brokerSeat =
            typeof action.payload?.brokerSeat === "number"
              ? (action.payload.brokerSeat as number)
              : g.negotiatedBrokerage
                ? (((g.auctioneer + 1) % n) as number)
                : null;
          const cutBps =
            typeof action.payload?.cutBps === "number"
              ? (action.payload.cutBps as number)
              : g.negotiatedBrokerage
                ? 1500
                : 0;
          const floorLot = createLiveFloorLot({
            lotId: lot.instanceId,
            seller: g.auctioneer,
            reserve: lot.reserve,
            playerCount: n,
            payload: lot,
            brokerSeat:
              brokerSeat === g.auctioneer ? null : brokerSeat,
            brokerCutBps: cutBps,
          });
          g.activeFloorLots.push(floorLot);
          g.currentLot = lot;
          genre.currentBid = floorLot.currentBid;
          return {
            genre,
            phase: "live_floor" as PlayPhaseId,
            activePlayerId: nextSeat,
            status: "active" as const,
            winnerId: null,
          };
        }
        genre.currentBid = Math.max(0, lot.reserve - 1);
        return {
          genre,
          phase: "bidding" as PlayPhaseId,
          activePlayerId: nextSeat,
          status: "active" as const,
          winnerId: null,
        };
      }

      if (state.phase === "market") {
        if (action.type === "sell") {
          const id = action.payload?.instanceId;
          if (typeof id !== "string") return null;
          const col = g.collection[action.playerId]!;
          const idx = col.findIndex((p) => p.instanceId === id);
          if (idx < 0) return null;
          const [lot] = col.splice(idx, 1);
          const payout = g.marketPrices[lot!.artistId] ?? 0;
          if (payout <= 0) return null;
          genre.chips[action.playerId]! += payout;
          g.lastSold = {
            seat: action.playerId,
            name: lot!.name,
            payout,
            artistId: lot!.artistId,
          };
          return {
            genre,
            phase: "market" as PlayPhaseId,
            activePlayerId: action.playerId,
            status: "active" as const,
            winnerId: null,
          };
        }
        if (action.type !== "pass_market") return null;
        g.marketPasses += 1;
        if (g.marketPasses < g.playerCount) {
          const next = ((action.playerId + 1) % g.playerCount) as PlayerId;
          return {
            genre,
            phase: "market" as PlayPhaseId,
            activePlayerId: next,
            status: "active" as const,
            winnerId: null,
          };
        }
        return galleryMaybeEndAfterMarket(genre, action.playerId);
      }

      if (state.phase === "sealed") {
        if (!g.currentLot) return null;
        if (g.sealedBids[action.playerId] !== null) return null;
        const floor = g.currentLot.reserve + (g.companionLot?.reserve ?? 0);
        if (action.type === "sealed_pass") {
          g.sealedBids[action.playerId] = -1;
        } else if (action.type === "sealed_bid") {
          const amount = action.payload?.amount;
          if (
            !Number.isSafeInteger(amount) ||
            (amount as number) < floor ||
            (amount as number) > genre.chips[action.playerId]!
          ) {
            return null;
          }
          g.sealedBids[action.playerId] = amount as number;
        } else {
          return null;
        }
        if (g.sealedBids.some((b) => b === null)) {
          let next = ((action.playerId + 1) % g.playerCount) as PlayerId;
          // Prefer next uncommitted seat (simultaneous commit window).
          for (let step = 0; step < g.playerCount; step += 1) {
            const s = ((action.playerId + 1 + step) % g.playerCount) as PlayerId;
            if (g.sealedBids[s] === null) {
              next = s;
              break;
            }
          }
          return {
            genre,
            phase: "sealed" as PlayPhaseId,
            activePlayerId: next,
            status: "active" as const,
            winnerId: null,
          };
        }
        const cand: Array<{ seat: PlayerId; bid: number }> = [];
        for (let s = 0; s < g.playerCount; s += 1) {
          const b = g.sealedBids[s]!;
          if (b >= 0) cand.push({ seat: s as PlayerId, bid: b });
        }
        if (!cand.length) {
          const u = galleryUnsold(genre, action.playerId);
          return {
            ...u,
            status: u.status ?? "active",
            winnerId: u.winnerId ?? null,
            passed: true,
          };
        }
        cand.sort((a, b) => {
          if (b.bid !== a.bid) return b.bid - a.bid;
          return (
            genre.seatOrder.indexOf(a.seat) - genre.seatOrder.indexOf(b.seat)
          );
        });
        const winner = cand[0]!;
        const second = cand.length >= 2 ? cand[1]!.seat : null;
        const awarded = galleryAwardLot(genre, winner.seat, winner.bid, second);
        return {
          ...awarded,
          status: (awarded as { status?: "active" | "complete" }).status ?? "active",
          winnerId: (awarded as { winnerId?: PlayerId | null }).winnerId ?? null,
        };
      }

      if (state.phase === "fixed") {
        if (!g.currentLot) return null;
        const n = g.playerCount;
        const nextFixedSeat = (from: PlayerId): PlayerId => {
          for (let step = 1; step <= n; step += 1) {
            const s = ((from + step) % n) as PlayerId;
            if (s === g.auctioneer) continue;
            if (!g.fixedAnswered[s]!) return s;
          }
          return g.auctioneer;
        };
        const othersAllDone = (): boolean => {
          for (let s = 0; s < n; s += 1) {
            if (s === g.auctioneer) continue;
            if (!g.fixedAnswered[s]!) return false;
          }
          return true;
        };
        if (action.type === "buy_fixed") {
          if (action.playerId === g.auctioneer) return null;
          if (g.fixedAnswered[action.playerId]!) return null;
          if (g.fixedPrice > genre.chips[action.playerId]!) return null;
          g.fixedAnswered[action.playerId] = true;
          const awarded = galleryAwardLot(
            genre,
            action.playerId,
            g.fixedPrice,
          );
          return {
            ...awarded,
            status: (awarded as { status?: "active" | "complete" }).status ?? "active",
            winnerId: (awarded as { winnerId?: PlayerId | null }).winnerId ?? null,
          };
        }
        if (action.type === "pass_fixed") {
          if (action.playerId === g.auctioneer) return null;
          if (g.fixedAnswered[action.playerId]!) return null;
          g.fixedAnswered[action.playerId] = true;
          const next = othersAllDone()
            ? g.auctioneer
            : nextFixedSeat(action.playerId);
          return {
            genre,
            phase: "fixed" as PlayPhaseId,
            activePlayerId: next,
            status: "active" as const,
            winnerId: null,
            passed: true,
          };
        }
        if (action.type === "buy_own") {
          if (action.playerId !== g.auctioneer) return null;
          if (!othersAllDone()) return null;
          if (g.fixedPrice > genre.chips[action.playerId]!) return null;
          g.fixedAnswered[action.playerId] = true;
          const awarded = galleryAwardLot(
            genre,
            action.playerId,
            g.fixedPrice,
          );
          return {
            ...awarded,
            status: (awarded as { status?: "active" | "complete" }).status ?? "active",
            winnerId: (awarded as { winnerId?: PlayerId | null }).winnerId ?? null,
          };
        }
        if (action.type === "decline_own") {
          if (action.playerId !== g.auctioneer) return null;
          if (!othersAllDone()) return null;
          g.fixedAnswered[action.playerId] = true;
          const u = galleryUnsold(genre, action.playerId);
          return {
            ...u,
            status: u.status ?? "active",
            winnerId: u.winnerId ?? null,
            passed: true,
          };
        }
        return null;
      }

      if (state.phase === "live_floor") {
        const n = g.playerCount;
        if (action.type === "play_painting") {
          if (action.playerId !== g.auctioneer) return null;
          if (g.activeFloorLots.length >= g.maxLiveLots) return null;
          const id = action.payload?.instanceId;
          if (typeof id !== "string") return null;
          const mode = action.payload?.mode;
          if (mode !== undefined && mode !== "open") return null;
          const hand = g.auctionHand[action.playerId]!;
          const idx = hand.findIndex((p) => p.instanceId === id);
          if (idx < 0) return null;
          const lot = hand.splice(idx, 1)[0]!;
          const brokerSeat =
            typeof action.payload?.brokerSeat === "number"
              ? (action.payload.brokerSeat as number)
              : g.negotiatedBrokerage
                ? (((g.auctioneer + 1) % n) as number)
                : null;
          const cutBps =
            typeof action.payload?.cutBps === "number"
              ? (action.payload.cutBps as number)
              : g.negotiatedBrokerage
                ? 1500
                : 0;
          const floorLot = createLiveFloorLot({
            lotId: lot.instanceId,
            seller: g.auctioneer,
            reserve: lot.reserve,
            playerCount: n,
            payload: lot,
            brokerSeat:
              brokerSeat === g.auctioneer ? null : brokerSeat,
            brokerCutBps: cutBps,
          });
          g.activeFloorLots.push(floorLot);
          g.currentLot = lot;
          g.currentMode = "open";
          genre.lotId = lot.id;
          return {
            genre,
            phase: "live_floor" as PlayPhaseId,
            activePlayerId: state.activePlayerId,
            status: "active" as const,
            winnerId: null,
          };
        }
        if (action.type === "set_broker_terms") {
          const lotId = action.payload?.lotId;
          if (typeof lotId !== "string") return null;
          const floorLot = g.activeFloorLots.find((l) => l.lotId === lotId);
          if (!floorLot) return null;
          if (action.playerId !== floorLot.seller) return null;
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
          return {
            genre,
            phase: "live_floor" as PlayPhaseId,
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
          const floorLot = g.activeFloorLots.find((l) => l.lotId === lotId);
          if (!floorLot) return null;
          if (
            !raiseOnLiveLot(
              floorLot,
              action.playerId,
              amount as number,
              genre.chips[action.playerId]!,
            )
          ) {
            return null;
          }
          genre.currentBid = floorLot.currentBid;
          genre.highBidder = floorLot.highBidder;
          const next = ((action.playerId + 1) % n) as PlayerId;
          return {
            genre,
            phase: "live_floor" as PlayPhaseId,
            activePlayerId: next,
            status: "active" as const,
            winnerId: null,
          };
        }
        if (action.type === "floor_pass") {
          const lotId = action.payload?.lotId;
          if (typeof lotId !== "string") return null;
          const floorLot = g.activeFloorLots.find((l) => l.lotId === lotId);
          if (!floorLot) return null;
          const settle = passOnLiveLot(floorLot, action.playerId, n);
          if (settle === "award") {
            const awarded = galleryAwardFloorLot(
              genre,
              floorLot,
              floorLot.highBidder as PlayerId,
              floorLot.currentBid,
            );
            return {
              ...awarded,
              status: awarded.status ?? "active",
              winnerId: awarded.winnerId ?? null,
              passed: true,
            };
          }
          if (settle === "unsold") {
            const u = galleryUnsoldFloorLot(genre, floorLot, action.playerId);
            return {
              ...u,
              status: u.status ?? "active",
              winnerId: u.winnerId ?? null,
              passed: true,
            };
          }
          const next = ((action.playerId + 1) % n) as PlayerId;
          return {
            genre,
            phase: "live_floor" as PlayPhaseId,
            activePlayerId: next,
            status: "active" as const,
            winnerId: null,
            passed: true,
          };
        }
        return null;
      }

      if (state.phase === "bidding") {
        const n = g.playerCount;
        const next = ((action.playerId + 1) % n) as PlayerId;
        if (action.type === "bid") {
          const amount = action.payload?.amount;
          if (
            !Number.isSafeInteger(amount) ||
            (amount as number) <= genre.currentBid ||
            (amount as number) > genre.chips[action.playerId]!
          ) {
            return null;
          }
          genre.currentBid = amount as number;
          genre.highBidder = action.playerId;
          genre.passedWithoutBid = 0;
          return {
            genre,
            phase: "bidding" as PlayPhaseId,
            activePlayerId: next,
            status: "active" as const,
            winnerId: null,
          };
        }
        if (action.type !== "pass" || action.payload !== undefined) return null;
        if (genre.highBidder !== null) {
          // Award when the next seat to act is the high bidder (full circle).
          if (next === genre.highBidder) {
            const awarded = galleryAwardLot(
              genre,
              genre.highBidder as PlayerId,
              genre.currentBid,
            );
            return {
              ...awarded,
              status: (awarded as { status?: "active" | "complete" }).status ?? "active",
              winnerId: (awarded as { winnerId?: PlayerId | null }).winnerId ?? null,
              passed: true,
            };
          }
          return {
            genre,
            phase: "bidding" as PlayPhaseId,
            activePlayerId: next,
            status: "active" as const,
            winnerId: null,
            passed: true,
          };
        }
        genre.passedWithoutBid += 1;
        if (genre.passedWithoutBid >= n) {
          const u = galleryUnsold(genre, action.playerId);
          return {
            ...u,
            status: u.status ?? "active",
            winnerId: u.winnerId ?? null,
            passed: true,
          };
        }
        return {
          genre,
          phase: "bidding" as PlayPhaseId,
          activePlayerId: next,
          status: "active" as const,
          winnerId: null,
          passed: true,
        };
      }
      return null;
    }

    // ---- Harbor market ----
    if (state.phase === "market") {
      const genre = baseGenre();
      const harbor = genre.harbor;
      if (!harbor) return null;
      if (action.type === "sell") {
        const id = action.payload?.instanceId;
        if (typeof id !== "string") return null;
        const hand = harbor.hand[action.playerId]!;
        const idx = hand.findIndex((l) => l.instanceId === id);
        if (idx < 0) return null;
        const [lot] = hand.splice(idx, 1);
        const payout = Math.max(
          1,
          Math.floor(lot!.reserve * lot!.marketMult),
        );
        genre.chips[action.playerId]! += payout;
        harbor.lastSold = {
          seat: action.playerId,
          name: lot!.name,
          payout,
        };
        return {
          genre,
          phase: "market" as PlayPhaseId,
          activePlayerId: action.playerId,
          status: "active" as const,
          winnerId: null,
        };
      }
      if (action.type !== "pass_market") return null;
      harbor.currentLot = drawNextLot(harbor);
      if (!harbor.currentLot) {
        return finishGameByChips(genre, action.playerId);
      }
      const started = startLotBidding(
        genre,
        genre.seatOrder[0] as PlayerId,
      );
      return {
        genre: started.genre,
        phase: started.phase,
        activePlayerId: started.activePlayerId,
        status: "active" as const,
        winnerId: null,
      };
    }

    // ---- Sealed bidding (harbor) ----
    if (state.phase === "sealed") {
      const genre = baseGenre();
      const harbor = genre.harbor;
      if (!harbor?.currentLot) return null;
      if (harbor.sealedBids[action.playerId] !== null) return null;
      if (action.type === "sealed_pass") {
        harbor.sealedBids[action.playerId] = -1;
      } else if (action.type === "sealed_bid") {
        const amount = action.payload?.amount;
        if (
          !Number.isSafeInteger(amount) ||
          (amount as number) < harbor.currentLot.reserve ||
          (amount as number) > genre.chips[action.playerId]!
        ) {
          return null;
        }
        harbor.sealedBids[action.playerId] = amount as number;
      } else {
        return null;
      }
      const [b0, b1] = harbor.sealedBids;
      if (b0 === null || b1 === null) {
        const next = ((action.playerId + 1) % 2) as PlayerId;
        return {
          genre,
          phase: "sealed" as PlayPhaseId,
          activePlayerId: next,
          status: "active" as const,
          winnerId: null,
        };
      }
      const cand: Array<{ seat: PlayerId; bid: number }> = [];
      if (b0 >= 0) cand.push({ seat: 0, bid: b0 });
      if (b1 >= 0) cand.push({ seat: 1, bid: b1 });
      if (!cand.length) {
        harbor.discard.push(harbor.currentLot);
        harbor.currentLot = null;
        return {
          genre,
          phase: "market" as PlayPhaseId,
          activePlayerId: genre.seatOrder[0] as PlayerId,
          status: "active" as const,
          winnerId: null,
          endReason: "lot_unsold",
        };
      }
      cand.sort((a, b) => {
        if (b.bid !== a.bid) return b.bid - a.bid;
        return (
          genre.seatOrder.indexOf(a.seat) - genre.seatOrder.indexOf(b.seat)
        );
      });
      const winner = cand[0]!;
      genre.chips[winner.seat]! -= winner.bid;
      genre.scores[winner.seat]! += 1;
      genre.awardedTo = winner.seat;
      genre.highBidder = winner.seat;
      genre.currentBid = winner.bid;
      harbor.hand[winner.seat]!.push(harbor.currentLot);
      harbor.currentLot = null;
      return {
        genre,
        phase: "market" as PlayPhaseId,
        activePlayerId: winner.seat,
        status: "active" as const,
        winnerId: null,
        endReason: "lot_awarded",
      };
    }

    // ---- Open bidding (classic + harbor) ----
    if (state.phase !== "bidding") return null;
    const next = ((action.playerId + 1) % 2) as PlayerId;
    const genre = baseGenre();

    if (action.type === "bid") {
      const amount = action.payload?.amount;
      if (
        !Number.isSafeInteger(amount) ||
        (amount as number) <= genre.currentBid ||
        (amount as number) > genre.chips[action.playerId]!
      ) {
        return null;
      }
      genre.currentBid = amount as number;
      genre.highBidder = action.playerId;
      genre.passedWithoutBid = 0;
      return {
        genre,
        phase: "bidding" as PlayPhaseId,
        activePlayerId: next,
        status: "active" as const,
        winnerId: null,
      };
    }
    if (action.type !== "pass" || action.payload !== undefined) return null;

    if (genre.highBidder !== null) {
      const winner = genre.highBidder as PlayerId;
      genre.chips[winner]! -= genre.currentBid;
      if (genre.harbor?.currentLot) {
        genre.scores[winner]! += 1;
        genre.harbor.hand[winner]!.push(genre.harbor.currentLot);
        genre.harbor.currentLot = null;
        genre.awardedTo = winner;
        return {
          genre,
          phase: "market" as PlayPhaseId,
          activePlayerId: winner,
          status: "active" as const,
          winnerId: null,
          endReason: "lot_awarded",
        };
      }
      genre.scores[winner]! += genre.lotValue;
      genre.awardedTo = winner;
      return {
        genre,
        phase: "ended" as PlayPhaseId,
        activePlayerId: action.playerId,
        status: "complete" as const,
        winnerId: winner,
        passed: true,
        endReason: "lot_awarded",
      };
    }

    genre.passedWithoutBid += 1;
    if (genre.passedWithoutBid === 2) {
      if (genre.harbor?.currentLot) {
        genre.harbor.discard.push(genre.harbor.currentLot);
        genre.harbor.currentLot = null;
        return {
          genre,
          phase: "market" as PlayPhaseId,
          activePlayerId: genre.seatOrder[0] as PlayerId,
          status: "active" as const,
          winnerId: null,
          passed: true,
          endReason: "lot_unsold",
        };
      }
      return {
        genre,
        phase: "ended" as PlayPhaseId,
        activePlayerId: action.playerId,
        status: "complete" as const,
        winnerId: null,
        passed: true,
        endReason: "lot_unsold",
      };
    }
    return {
      genre,
      phase: "bidding" as PlayPhaseId,
      activePlayerId: next,
      status: "active" as const,
      winnerId: null,
      passed: true,
    };
  },
};

export function auctionBiddingToSessionFields(
  state: PlayState<AuctionBiddingGenre>,
) {
  return {
    turn: state.sequence,
    activeSeat: state.activePlayerId,
    scores:
      state.genre.harbor || state.genre.gallery
        ? [...state.genre.chips]
        : [...state.genre.scores],
    status: state.status,
    winnerSeat: state.winnerId,
    auctionBidding: {
      lotId: state.genre.lotId,
      chips: [...state.genre.chips],
      scores: [...state.genre.scores],
      lotValue: state.genre.lotValue,
      currentBid: state.genre.currentBid,
      highBidder: state.genre.highBidder,
      passedWithoutBid: state.genre.passedWithoutBid,
      awardedTo: state.genre.awardedTo,
      seatOrder: [...state.genre.seatOrder],
      phase: state.phase,
      harbor: state.genre.harbor ? cloneHarbor(state.genre.harbor) : null,
      gallery: state.genre.gallery ? cloneGallery(state.genre.gallery) : null,
    },
  };
}

export function bindAuctionBiddingFromRuntimeKernel(input: {
  playerCount: number;
  harbor?: boolean;
  gallery?: boolean;
  content?: AuctionBiddingContent | null;
  galleryContent?: GalleryAuctionContent | null;
}): PlayKernelConfig {
  const gallery =
    input.gallery === true || input.galleryContent != null;
  if (gallery) {
    if (input.playerCount < 2 || input.playerCount > 5) {
      throw new Error("auction_bidding_gallery_requires_2_to_5_players");
    }
  } else if (input.playerCount !== 2) {
    throw new Error("auction_bidding_requires_two_players");
  }
  return createAuctionBiddingKernelConfig({
    harbor: input.harbor,
    gallery: input.gallery,
    playerCount: input.playerCount,
    content: input.content ?? null,
    galleryContent: input.galleryContent ?? null,
  });
}

export function playActionFromAuctionBiddingIntent(
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

export function pickAuctionBiddingBotAction(
  state: PlayState<AuctionBiddingGenre>,
  seed: number,
  config?: PlayKernelConfig,
): PlayAction {
  const parsed = config
    ? parseAuctionBiddingConfig(config.adapter)
    : parseAuctionBiddingConfig({ playerCount: 2, lotValue: 10 });
  const legal = parsed
    ? auctionBiddingAdapter.listLegalActions(
        state,
        state.activePlayerId,
        parsed,
      )
    : [];
  if (legal.length) {
    const rng = createSeededRng(seed);
    if (state.phase === "offer") {
      const plays = legal.filter((a) => a.type === "play_painting");
      if (plays.length) {
        const choice = plays[rng.at(state.sequence + 5) % plays.length]!;
        return {
          type: choice.type,
          playerId: state.activePlayerId,
          payload: { ...choice.payload },
        };
      }
    }
    if (state.phase === "market") {
      const sell = legal.find((a) => a.type === "sell");
      if (sell && rng.at(state.sequence + 1) % 2 === 0) {
        return {
          type: sell.type,
          playerId: state.activePlayerId,
          ...(sell.payload ? { payload: { ...sell.payload } } : {}),
        };
      }
      const skip = legal.find((a) => a.type === "pass_market");
      if (skip) {
        return { type: skip.type, playerId: state.activePlayerId };
      }
    }
    if (state.phase === "live_floor") {
      const raises = legal.filter((a) => a.type === "floor_raise");
      const passes = legal.filter((a) => a.type === "floor_pass");
      const adds = legal.filter((a) => a.type === "play_painting");
      // Prefer settling existing lots over opening more / tweaking broker terms.
      if (raises.length && rng.at(state.sequence + 7) % 5 !== 0) {
        const choice = raises[rng.at(state.sequence + 8) % raises.length]!;
        return {
          type: choice.type,
          playerId: state.activePlayerId,
          payload: { ...choice.payload },
        };
      }
      if (passes.length) {
        const choice = passes[rng.at(state.sequence + 9) % passes.length]!;
        return {
          type: choice.type,
          playerId: state.activePlayerId,
          payload: { ...choice.payload },
        };
      }
      if (adds.length && rng.at(state.sequence + 10) % 4 === 0) {
        const choice = adds[0]!;
        return {
          type: choice.type,
          playerId: state.activePlayerId,
          payload: { ...choice.payload },
        };
      }
      if (passes.length === 0 && raises.length === 0 && adds.length) {
        const choice = adds[0]!;
        return {
          type: choice.type,
          playerId: state.activePlayerId,
          payload: { ...choice.payload },
        };
      }
      // Avoid set_broker_terms spam — fall through only if nothing else.
      const nonBroker = legal.filter((a) => a.type !== "set_broker_terms");
      if (nonBroker.length) {
        const choice = nonBroker[rng.at(state.sequence + 11) % nonBroker.length]!;
        return {
          type: choice.type,
          playerId: state.activePlayerId,
          ...(choice.payload ? { payload: { ...choice.payload } } : {}),
        };
      }
    }
    if (state.phase === "fixed") {
      const buy = legal.find(
        (a) => a.type === "buy_fixed" || a.type === "buy_own",
      );
      if (buy && rng.at(state.sequence + 2) % 3 !== 0) {
        return { type: buy.type, playerId: state.activePlayerId };
      }
      const decline = legal.find(
        (a) => a.type === "pass_fixed" || a.type === "decline_own",
      );
      if (decline) {
        return { type: decline.type, playerId: state.activePlayerId };
      }
    }
    const choice = legal[rng.at(state.sequence + 3) % legal.length]!;
    if (choice.type === "bid") {
      const amount = state.genre.currentBid + 1;
      return {
        type: "bid",
        playerId: state.activePlayerId,
        payload: { amount },
      };
    }
    if (choice.type === "sealed_bid" && choice.payload) {
      return {
        type: "sealed_bid",
        playerId: state.activePlayerId,
        payload: { ...choice.payload },
      };
    }
    if (choice.type === "play_painting" && choice.payload) {
      return {
        type: "play_painting",
        playerId: state.activePlayerId,
        payload: { ...choice.payload },
      };
    }
    return {
      type: choice.type,
      playerId: state.activePlayerId,
      ...(choice.payload ? { payload: { ...choice.payload } } : {}),
    };
  }
  if (state.status !== "active" || state.phase === "ended") {
    return { type: "pass", playerId: state.activePlayerId };
  }
  if (state.genre.gallery || state.genre.harbor) {
    // Empty legal list mid-subset — last resort pass_market only in market phase.
    if (state.phase === "market") {
      return { type: "pass_market", playerId: state.activePlayerId };
    }
    return { type: "pass", playerId: state.activePlayerId };
  }
  const amount = state.genre.currentBid + 1;
  const bid =
    amount <= state.genre.chips[state.activePlayerId]! &&
    (state.genre.highBidder === null ||
      createSeededRng(seed).at(state.sequence + 1) % 3 !== 0);
  return bid
    ? { type: "bid", playerId: state.activePlayerId, payload: { amount } }
    : { type: "pass", playerId: state.activePlayerId };
}

export function autoPlayAuctionBiddingGame(
  seed: number,
  config: PlayKernelConfig = createAuctionBiddingKernelConfig(),
) {
  let state = createInitialState(auctionBiddingAdapter, config, seed);
  const actions: PlayAction[] = [];
  const gallery = Boolean(config.adapter?.gallery);
  const harbor = Boolean(config.adapter?.harbor);
  const max = gallery ? 700 : harbor ? 200 : 44;
  while (state.status === "active" && actions.length < max) {
    const action = pickAuctionBiddingBotAction(state, seed, config);
    const result = applyAction(auctionBiddingAdapter, state, action, config);
    if (!result.ok) {
      throw new Error(`auction_bidding_auto_play_illegal:${result.reason}`);
    }
    actions.push(action);
    state = result.state;
  }
  return { state, actions };
}
