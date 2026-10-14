/** Auction-bidding-v1 on the public play-kernel.
 *
 * Classic: two-seat, one-lot open raise/pass (amber/jade).
 * Harbor subset (T007): multi-lot deck + optional sealed bids + black-market
 * resale — keeps bid/pass resolution semantics; does not invent a new kernel.
 * Gallery subset (T012): multi auction modes (open/sealed/fixed) + artist
 * market-ladder sell scoring — parallel to harbor, does not mutate harbor.
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

export type GalleryAuctionMode = "open" | "sealed" | "fixed";

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
  auctioneer: PlayerId;
  auctionHand: [GalleryPaintingInstance[], GalleryPaintingInstance[]];
  collection: [GalleryPaintingInstance[], GalleryPaintingInstance[]];
  deck: GalleryPaintingInstance[];
  currentLot: GalleryPaintingInstance | null;
  sealedBids: [number | null, number | null];
  fixedPrice: number;
  fixedAnswered: [boolean, boolean];
  roundSales: Record<string, number>;
  marketPrices: Record<string, number>;
  lastSold: {
    seat: number;
    name: string;
    payout: number;
    artistId: string;
  } | null;
  marketPasses: number;
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
  chips: [number, number];
  /** Classic: VP from awarded lotValue. Subsets: lots won count (display). */
  scores: [number, number];
  lotValue: number;
  currentBid: number;
  highBidder: number | null;
  passedWithoutBid: number;
  awardedTo: number | null;
  seatOrder: [number, number];
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
): GalleryPaintingDef[] {
  const out: GalleryPaintingDef[] = [];
  let n = 0;
  for (const artist of artists) {
    for (let k = 0; k < 4; k += 1) {
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
  overrides?: Partial<GalleryAuctionContent>,
): GalleryAuctionContent {
  const artists = overrides?.artists ?? defaultGalleryArtists();
  return {
    artists,
    paintings: overrides?.paintings ?? defaultGalleryPaintings(artists),
    startingFunds: overrides?.startingFunds ?? 100,
    modes: overrides?.modes ?? ["open", "sealed", "fixed"],
    salesToEndRound: overrides?.salesToEndRound ?? 3,
    marketLadder: overrides?.marketLadder ?? [30, 20, 10, 0],
    handSize: overrides?.handSize ?? 4,
    roundsToEnd: overrides?.roundsToEnd ?? 4,
  };
}

export function parseGalleryTuningFromIdea(
  idea: string,
): Partial<GalleryAuctionContent> {
  const out: Partial<GalleryAuctionContent> = {};
  const funds = idea.match(/(?:资金|筹码)\s*(\d+)/);
  if (funds) out.startingFunds = Math.max(1, Number(funds[1]));
  // Prefer 100 when 资金若干 or explicit 100.
  if (/每人\s*100|资金若干/.test(idea) && !funds) out.startingFunds = 100;
  const sales = idea.match(/第\s*(\d+)\s*张/);
  if (sales) out.salesToEndRound = Math.max(2, Number(sales[1]));
  const modes: GalleryAuctionMode[] = [];
  if (/公开加价|open\s*raise|open\s*bid/i.test(idea)) modes.push("open");
  if (/一次暗标|密封|sealed/i.test(idea)) modes.push("sealed");
  if (/定价购|定价购买|fixed/i.test(idea)) modes.push("fixed");
  if (modes.length) out.modes = [...new Set(modes)] as GalleryAuctionMode[];
  return out;
}

export function galleryAuctionUnsupportedNotes(): string[] {
  return [
    "auction-bidding-v1 gallery subset: open/sealed/fixed modes + artist market-ladder sell; 3–5 seats / double-painting fixed / exact hand-refill timing unsupported — 仅部分能力.",
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
    auctioneer: g.auctioneer,
    auctionHand: [
      g.auctionHand[0].map((p) => ({ ...p })),
      g.auctionHand[1].map((p) => ({ ...p })),
    ],
    collection: [
      g.collection[0].map((p) => ({ ...p })),
      g.collection[1].map((p) => ({ ...p })),
    ],
    deck: g.deck.map((p) => ({ ...p })),
    currentLot: g.currentLot ? { ...g.currentLot } : null,
    sealedBids: [...g.sealedBids] as [number | null, number | null],
    fixedPrice: g.fixedPrice,
    fixedAnswered: [...g.fixedAnswered] as [boolean, boolean],
    roundSales: { ...g.roundSales },
    marketPrices: { ...g.marketPrices },
    lastSold: g.lastSold ? { ...g.lastSold } : null,
    marketPasses: g.marketPasses,
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
): {
  hands: [GalleryPaintingInstance[], GalleryPaintingInstance[]];
  deck: GalleryPaintingInstance[];
} {
  const h0: GalleryPaintingInstance[] = [];
  const h1: GalleryPaintingInstance[] = [];
  for (let i = 0; i < handSize; i += 1) {
    if (deck.length) h0.push(deck.shift()!);
    if (deck.length) h1.push(deck.shift()!);
  }
  return { hands: [h0, h1], deck };
}

function refillGalleryHands(g: GalleryAuctionState, handSize: number): void {
  for (const seat of [0, 1] as const) {
    while (g.auctionHand[seat].length < handSize && g.deck.length > 0) {
      g.auctionHand[seat].push(g.deck.shift()!);
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
  const [c0, c1] = genre.chips;
  const winnerId =
    c0 === c1 ? null : ((c0 > c1 ? 0 : 1) as PlayerId | null);
  return {
    genre,
    phase: "ended" as PlayPhaseId,
    activePlayerId: actor,
    status: "complete" as const,
    winnerId,
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
  for (const seat of [0, 1] as const) {
    let payout = 0;
    for (const painting of g.collection[seat]) {
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
  if (g.auctionHand[g.auctioneer]!.length === 0) {
    g.auctioneer = ((g.auctioneer + 1) % 2) as PlayerId;
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
): {
  genre: AuctionBiddingGenre;
  phase: PlayPhaseId;
  activePlayerId: PlayerId;
  endReason: string;
} {
  const g = genre.gallery!;
  const lot = g.currentLot!;
  genre.chips[winner]! -= price;
  genre.scores[winner]! += 1;
  genre.awardedTo = winner;
  genre.highBidder = winner;
  genre.currentBid = price;
  g.collection[winner]!.push(lot);
  g.roundSales[lot.artistId] = (g.roundSales[lot.artistId] ?? 0) + 1;
  g.currentLot = null;
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
    };
  }
  g.auctioneer = ((g.auctioneer + 1) % 2) as PlayerId;
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
  if (g.currentLot) {
    g.currentLot = null;
  }
  genre.awardedTo = null;
  g.auctioneer = ((g.auctioneer + 1) % 2) as PlayerId;
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
  refillGalleryHands(g, 4);
  return ensureOfferReady(genre, actor);
}

function parseAuctionBiddingConfig(
  raw: Record<string, unknown>,
): AuctionBiddingConfig | null {
  const playerCount = raw.playerCount ?? 2;
  if (playerCount !== 2) return null;

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
      ? (c.modes as GalleryAuctionMode[]).filter((m) =>
          m === "open" || m === "sealed" || m === "fixed",
        )
      : ["open", "sealed", "fixed"];
    if (artists && artists.length > 0 && paintings && paintings.length > 0) {
      galleryContent = {
        artists,
        paintings,
        startingFunds:
          typeof c.startingFunds === "number" ? c.startingFunds : 100,
        modes: modes.length ? modes : ["open", "sealed", "fixed"],
        salesToEndRound:
          typeof c.salesToEndRound === "number" ? c.salesToEndRound : 3,
        marketLadder: Array.isArray(c.marketLadder)
          ? (c.marketLadder as number[])
          : [30, 20, 10, 0],
        handSize: typeof c.handSize === "number" ? c.handSize : 4,
        roundsToEnd: typeof c.roundsToEnd === "number" ? c.roundsToEnd : 4,
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
  const lotValue =
    typeof raw.lotValue === "number"
      ? raw.lotValue
      : harbor || gallery
        ? 0
        : 10;
  if (!harbor && !gallery && lotValue !== 10) return null;
  return {
    playerCount: 2,
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
  content?: AuctionBiddingContent | null;
  galleryContent?: GalleryAuctionContent | null;
}): PlayKernelConfig {
  const galleryContent = input?.galleryContent ?? null;
  const gallery = input?.gallery === true || galleryContent !== null;
  const content = gallery ? null : (input?.content ?? null);
  const harbor = !gallery && (input?.harbor === true || content !== null);
  return {
    kernelType: AUCTION_BIDDING_KERNEL_TYPE,
    playerCount: 2,
    phases: [
      { id: "offer", name: "Offer" },
      { id: "bidding", name: "Bidding" },
      { id: "sealed", name: "Sealed" },
      { id: "fixed", name: "Fixed" },
      { id: "market", name: "Market" },
      { id: "ended", name: "Ended" },
    ],
    adapter: {
      playerCount: 2,
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
  _first: PlayerId,
): GalleryAuctionState {
  let deck = instantiateGalleryDeck(content.paintings, seed ^ 0xa11e17);
  const dealt = dealGalleryHands(deck, content.handSize);
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
    // play-kernel createInitialState always starts activePlayerId at 0.
    auctioneer: 0 as PlayerId,
    auctionHand: dealt.hands,
    collection: [[], []],
    deck,
    currentLot: null,
    sealedBids: [null, null],
    fixedPrice: 0,
    fixedAnswered: [false, false],
    roundSales: sales,
    marketPrices: prices,
    lastSold: null,
    marketPasses: 0,
  };
}

export const auctionBiddingAdapter: PlayKernelAdapter<
  AuctionBiddingGenre,
  AuctionBiddingConfig
> = {
  kernelType: AUCTION_BIDDING_KERNEL_TYPE,
  parseConfig: parseAuctionBiddingConfig,
  createGenreState(config, seed) {
    const first = (createSeededRng(seed).at(1) % 2) as PlayerId;
    if (config.gallery && config.galleryContent) {
      const gallery = createGalleryState(config.galleryContent, seed, first);
      return {
        lotId: "gallery",
        chips: [
          config.galleryContent.startingFunds,
          config.galleryContent.startingFunds,
        ],
        scores: [0, 0],
        lotValue: 0,
        currentBid: 0,
        highBidder: null,
        passedWithoutBid: 0,
        awardedTo: null,
        seatOrder: [first, (1 - first) as PlayerId],
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
    if (state.status !== "active" || playerId !== state.activePlayerId) {
      return [];
    }
    const legal: LegalAction[] = [];
    const gallery = state.genre.gallery;
    const harbor = state.genre.harbor;

    // ---- Gallery ----
    if (gallery) {
      if (state.phase === "offer") {
        if (playerId !== gallery.auctioneer) return [];
        for (const p of gallery.auctionHand[playerId]!) {
          for (const mode of gallery.modes) {
            legal.push({
              type: "play_painting",
              label: `拍 ${p.name} · ${mode}`,
              payload: { instanceId: p.instanceId, mode },
            });
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
        const reserve = gallery.currentLot?.reserve ?? 1;
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
        const othersDone = gallery.fixedAnswered[(1 - gallery.auctioneer) as PlayerId];
        if (!isAuctioneer && !gallery.fixedAnswered[playerId]!) {
          if (price <= state.genre.chips[playerId]!) {
            legal.push({ type: "buy_fixed", label: `定价购 ${price}` });
          }
          legal.push({ type: "pass_fixed", label: "不买" });
          return legal;
        }
        if (isAuctioneer && othersDone && !gallery.fixedAnswered[playerId]!) {
          if (price <= state.genre.chips[playerId]!) {
            legal.push({ type: "buy_own", label: `自购 ${price}` });
          }
          legal.push({ type: "decline_own", label: "流拍" });
          return legal;
        }
        return [];
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
    if (state.status !== "active" || action.playerId !== state.activePlayerId) {
      return null;
    }

    const baseGenre = (): AuctionBiddingGenre => ({
      ...state.genre,
      chips: [...state.genre.chips] as [number, number],
      scores: [...state.genre.scores] as [number, number],
      seatOrder: [...state.genre.seatOrder] as [number, number],
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
        if (mode !== "open" && mode !== "sealed" && mode !== "fixed") return null;
        if (!g.modes.includes(mode)) return null;
        const hand = g.auctionHand[action.playerId]!;
        const idx = hand.findIndex((p) => p.instanceId === id);
        if (idx < 0) return null;
        const [lot] = hand.splice(idx, 1);
        g.currentLot = lot!;
        g.currentMode = mode;
        g.modeCursor = g.modes.indexOf(mode);
        genre.lotId = lot!.id;
        genre.lotValue = lot!.reserve;
        genre.highBidder = null;
        genre.passedWithoutBid = 0;
        genre.awardedTo = null;
        g.sealedBids = [null, null];
        g.fixedPrice = lot!.reserve;
        g.fixedAnswered = [false, false];
        g.lastSold = null;
        const other = ((g.auctioneer + 1) % 2) as PlayerId;
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
        if (mode === "fixed") {
          genre.currentBid = lot!.reserve;
          return {
            genre,
            phase: "fixed" as PlayPhaseId,
            activePlayerId: other,
            status: "active" as const,
            winnerId: null,
          };
        }
        // open
        genre.currentBid = Math.max(0, lot!.reserve - 1);
        return {
          genre,
          phase: "bidding" as PlayPhaseId,
          activePlayerId: other,
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
        if (g.marketPasses < 2) {
          const next = ((action.playerId + 1) % 2) as PlayerId;
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
        if (action.type === "sealed_pass") {
          g.sealedBids[action.playerId] = -1;
        } else if (action.type === "sealed_bid") {
          const amount = action.payload?.amount;
          if (
            !Number.isSafeInteger(amount) ||
            (amount as number) < g.currentLot.reserve ||
            (amount as number) > genre.chips[action.playerId]!
          ) {
            return null;
          }
          g.sealedBids[action.playerId] = amount as number;
        } else {
          return null;
        }
        const [b0, b1] = g.sealedBids;
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
          const u = galleryUnsold(genre, action.playerId);
          return {
            ...u,
            status: "active" as const,
            winnerId: null,
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
        const awarded = galleryAwardLot(genre, winner.seat, winner.bid);
        return {
          ...awarded,
          status: "active" as const,
          winnerId: null,
        };
      }

      if (state.phase === "fixed") {
        if (!g.currentLot) return null;
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
            status: "active" as const,
            winnerId: null,
          };
        }
        if (action.type === "pass_fixed") {
          if (action.playerId === g.auctioneer) return null;
          if (g.fixedAnswered[action.playerId]!) return null;
          g.fixedAnswered[action.playerId] = true;
          return {
            genre,
            phase: "fixed" as PlayPhaseId,
            activePlayerId: g.auctioneer,
            status: "active" as const,
            winnerId: null,
            passed: true,
          };
        }
        if (action.type === "buy_own") {
          if (action.playerId !== g.auctioneer) return null;
          const other = (1 - g.auctioneer) as PlayerId;
          if (!g.fixedAnswered[other]!) return null;
          if (g.fixedPrice > genre.chips[action.playerId]!) return null;
          g.fixedAnswered[action.playerId] = true;
          const awarded = galleryAwardLot(
            genre,
            action.playerId,
            g.fixedPrice,
          );
          return {
            ...awarded,
            status: "active" as const,
            winnerId: null,
          };
        }
        if (action.type === "decline_own") {
          if (action.playerId !== g.auctioneer) return null;
          const other = (1 - g.auctioneer) as PlayerId;
          if (!g.fixedAnswered[other]!) return null;
          g.fixedAnswered[action.playerId] = true;
          const u = galleryUnsold(genre, action.playerId);
          return {
            ...u,
            status: "active" as const,
            winnerId: null,
            passed: true,
          };
        }
        return null;
      }

      if (state.phase === "bidding") {
        const next = ((action.playerId + 1) % 2) as PlayerId;
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
          const awarded = galleryAwardLot(
            genre,
            genre.highBidder as PlayerId,
            genre.currentBid,
          );
          return {
            ...awarded,
            status: "active" as const,
            winnerId: null,
            passed: true,
          };
        }
        genre.passedWithoutBid += 1;
        if (genre.passedWithoutBid === 2) {
          const u = galleryUnsold(genre, action.playerId);
          return {
            ...u,
            status: "active" as const,
            winnerId: null,
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
      chips: [...state.genre.chips] as [number, number],
      scores: [...state.genre.scores] as [number, number],
      lotValue: state.genre.lotValue,
      currentBid: state.genre.currentBid,
      highBidder: state.genre.highBidder,
      passedWithoutBid: state.genre.passedWithoutBid,
      awardedTo: state.genre.awardedTo,
      seatOrder: [...state.genre.seatOrder] as [number, number],
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
  if (input.playerCount !== 2) {
    throw new Error("auction_bidding_requires_two_players");
  }
  return createAuctionBiddingKernelConfig({
    harbor: input.harbor,
    gallery: input.gallery,
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
  if (state.genre.gallery || state.genre.harbor) {
    // Empty legal list mid-subset — prefer a no-op that reduce rejects less often
    // by ending offer via ensureOfferReady on next successful path; as last resort pass_market.
    return { type: "pass_market", playerId: state.activePlayerId };
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
  const max = gallery ? 400 : harbor ? 200 : 44;
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
