/** Auction-bidding-v1 on the public play-kernel.
 *
 * Classic: two-seat, one-lot open raise/pass (amber/jade).
 * Harbor subset (T007): multi-lot deck + optional sealed bids + black-market
 * resale — keeps bid/pass resolution semantics; does not invent a new kernel.
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

type AuctionBiddingConfig = {
  playerCount: number;
  lotValue: number;
  harbor: boolean;
  content: AuctionBiddingContent | null;
};

export type AuctionBiddingGenre = {
  /** Classic lot id when !harbor; harbor uses currentLot. */
  lotId: "amber" | "jade" | string;
  chips: [number, number];
  /** Classic: VP from awarded lotValue. Harbor: lots won count (display). */
  scores: [number, number];
  lotValue: number;
  currentBid: number;
  highBidder: number | null;
  passedWithoutBid: number;
  awardedTo: number | null;
  seatOrder: [number, number];
  /** Harbor fields (null in classic). */
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
};

/** Generic harbor/auction-house cues (not 暗港-specific alone). */
export const HARBOR_AUCTION_CUES =
  /黑市|赃物|密封|拍品|底价|流拍|暗港|牌库|转售|black\s*market|sealed\s*bid|lot\s*queue|reserve\s*price/i;

export function ideaRequestsHarborAuction(idea: string): boolean {
  return HARBOR_AUCTION_CUES.test(idea);
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
  if (/密封/.test(idea) && !/加价/.test(idea.split("密封")[0] ?? "")) {
    // "密封/加价" keeps open as primary; pure 密封 prefers sealed.
  }
  // H03 writes 密封/加价 — support sealed when 密封 is present as optional mode.
  // Prefer open when 加价 also present; sealed when 密封 without 加价, or explicit 密封出价.
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

function drawNextLot(
  harbor: NonNullable<AuctionBiddingGenre["harbor"]>,
): AuctionLotInstance | null {
  if (harbor.deck.length === 0) return null;
  return harbor.deck.shift() ?? null;
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

function parseAuctionBiddingConfig(
  raw: Record<string, unknown>,
): AuctionBiddingConfig | null {
  const playerCount = raw.playerCount ?? 2;
  if (playerCount !== 2) return null;
  const contentRaw = raw.content;
  let content: AuctionBiddingContent | null = null;
  if (contentRaw && typeof contentRaw === "object") {
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
  const harbor = raw.harbor === true || content !== null;
  const lotValue =
    typeof raw.lotValue === "number" ? raw.lotValue : harbor ? 0 : 10;
  if (!harbor && lotValue !== 10) return null;
  return {
    playerCount: 2,
    lotValue: harbor ? lotValue : 10,
    harbor,
    content,
  };
}

export function createAuctionBiddingKernelConfig(input?: {
  harbor?: boolean;
  content?: AuctionBiddingContent | null;
}): PlayKernelConfig {
  const content = input?.content ?? null;
  const harbor = input?.harbor === true || content !== null;
  return {
    kernelType: AUCTION_BIDDING_KERNEL_TYPE,
    playerCount: 2,
    phases: [
      { id: "bidding", name: "Bidding" },
      { id: "sealed", name: "Sealed" },
      { id: "market", name: "Market" },
      { id: "ended", name: "Ended" },
    ],
    adapter: {
      playerCount: 2,
      lotValue: harbor ? 0 : 10,
      harbor,
      ...(content ? { content } : {}),
    },
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
    };
  },
  initialPhase(config) {
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
    const harbor = state.genre.harbor;

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
      // Offer a few sealed bid amounts + pass for HUD simplicity.
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
    });

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
        // Stay in market for same seat to sell more, or they can pass_market.
        return {
          genre,
          phase: "market" as PlayPhaseId,
          activePlayerId: action.playerId,
          status: "active" as const,
          winnerId: null,
        };
      }
      if (action.type !== "pass_market") return null;
      // Advance to next lot after market.
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

    // ---- Sealed bidding ----
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
      // Resolve sealed.
      const cand: Array<{ seat: PlayerId; bid: number }> = [];
      if (b0 >= 0) cand.push({ seat: 0, bid: b0 });
      if (b1 >= 0) cand.push({ seat: 1, bid: b1 });
      if (!cand.length) {
        // Unsold
        harbor.discard.push(harbor.currentLot);
        harbor.currentLot = null;
        // Market with empty hands still allows pass_market → next
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
        // seatOrder priority
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
      // Classic single-lot end
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
    scores: state.genre.harbor
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
      harbor: state.genre.harbor
        ? cloneHarbor(state.genre.harbor)
        : null,
    },
  };
}

export function bindAuctionBiddingFromRuntimeKernel(input: {
  playerCount: number;
  harbor?: boolean;
  content?: AuctionBiddingContent | null;
}): PlayKernelConfig {
  if (input.playerCount !== 2) {
    throw new Error("auction_bidding_requires_two_players");
  }
  return createAuctionBiddingKernelConfig({
    harbor: input.harbor,
    content: input.content ?? null,
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
    // Prefer sell once if in market with hand; else random legal.
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
    return {
      type: choice.type,
      playerId: state.activePlayerId,
      ...(choice.payload ? { payload: { ...choice.payload } } : {}),
    };
  }
  // Classic fallback
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
  const max = config.adapter?.harbor ? 200 : 44;
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
