/** Two-seat, one-lot open auction on the public play-kernel. */
import {
  applyAction, createInitialState, createSeededRng, type PlayAction,
  type PlayKernelAdapter, type PlayKernelConfig, type PlayState,
} from "../play-kernel";

export const AUCTION_BIDDING_KERNEL_TYPE = "auction-bidding-v1" as const;
export type AuctionBiddingConfig = { playerCount: number; lotValue: number };
export type AuctionBiddingGenre = {
  lotId: "amber" | "jade";
  chips: [number, number];
  scores: [number, number];
  lotValue: number;
  currentBid: number;
  highBidder: number | null;
  passedWithoutBid: number;
  awardedTo: number | null;
  seatOrder: [number, number];
};

export function parseAuctionBiddingConfig(raw: Record<string, unknown>): AuctionBiddingConfig | null {
  const playerCount = raw.playerCount ?? 2;
  const lotValue = raw.lotValue ?? 10;
  return playerCount === 2 && lotValue === 10 ? { playerCount: 2, lotValue: 10 } : null;
}

export function createAuctionBiddingKernelConfig(): PlayKernelConfig {
  return {
    kernelType: AUCTION_BIDDING_KERNEL_TYPE,
    playerCount: 2,
    phases: [{ id: "bidding", name: "Bidding" }, { id: "ended", name: "Ended" }],
    adapter: { playerCount: 2, lotValue: 10 },
  };
}

export const auctionBiddingAdapter: PlayKernelAdapter<AuctionBiddingGenre, AuctionBiddingConfig> = {
  kernelType: AUCTION_BIDDING_KERNEL_TYPE,
  parseConfig: parseAuctionBiddingConfig,
  createGenreState(config, seed) {
    const first = createSeededRng(seed).at(1) % 2;
    return {
      lotId: createSeededRng(seed).at(2) % 2 === 0 ? "amber" : "jade",
      chips: [20, 20], scores: [0, 0], lotValue: config.lotValue,
      currentBid: 0, highBidder: null, passedWithoutBid: 0, awardedTo: null,
      seatOrder: [first, 1 - first],
    };
  },
  initialPhase() { return "bidding"; },
  listLegalActions(state, playerId) {
    if (state.status !== "active" || state.phase !== "bidding" || playerId !== state.activePlayerId) return [];
    const legal = [{ type: "pass", label: "Pass" }];
    if (state.genre.currentBid < state.genre.chips[playerId]) {
      legal.unshift({ type: "bid", label: "Bid" });
    }
    return legal;
  },
  reduce(state, action) {
    if (state.status !== "active" || state.phase !== "bidding" || action.playerId !== state.activePlayerId) return null;
    const next = (action.playerId + 1) % 2;
    const genre: AuctionBiddingGenre = {
      ...state.genre,
      chips: [...state.genre.chips],
      scores: [...state.genre.scores],
      seatOrder: [...state.genre.seatOrder],
    };
    if (action.type === "bid") {
      const amount = action.payload?.amount;
      if (!Number.isSafeInteger(amount) || (amount as number) <= genre.currentBid || (amount as number) > genre.chips[action.playerId]) return null;
      genre.currentBid = amount as number;
      genre.highBidder = action.playerId;
      genre.passedWithoutBid = 0;
      return { genre, phase: "bidding", activePlayerId: next, status: "active", winnerId: null };
    }
    if (action.type !== "pass" || action.payload !== undefined) return null;
    if (genre.highBidder !== null) {
      // Strictly increasing open bids make a tie unreachable; seeded order is retained
      // for deterministic award priority if a future rule introduces equal bids.
      const winner = genre.highBidder;
      genre.chips[winner] -= genre.currentBid;
      genre.scores[winner] += genre.lotValue;
      genre.awardedTo = winner;
      return { genre, phase: "ended", activePlayerId: action.playerId, status: "complete", winnerId: winner, passed: true, endReason: "lot_awarded" };
    }
    genre.passedWithoutBid += 1;
    if (genre.passedWithoutBid === 2) {
      return { genre, phase: "ended", activePlayerId: action.playerId, status: "complete", winnerId: null, passed: true, endReason: "lot_unsold" };
    }
    return { genre, phase: "bidding", activePlayerId: next, status: "active", winnerId: null, passed: true };
  },
};

export function auctionBiddingToSessionFields(state: PlayState<AuctionBiddingGenre>) {
  return {
    turn: state.sequence, activeSeat: state.activePlayerId, scores: [...state.genre.scores],
    status: state.status, winnerSeat: state.winnerId,
    auctionBidding: {
      ...state.genre, chips: [...state.genre.chips] as [number, number],
      scores: [...state.genre.scores] as [number, number],
      seatOrder: [...state.genre.seatOrder] as [number, number],
    },
  };
}

export function bindAuctionBiddingFromRuntimeKernel(input: { playerCount: number }): PlayKernelConfig {
  if (input.playerCount !== 2) throw new Error("auction_bidding_requires_two_players");
  return createAuctionBiddingKernelConfig();
}

export function playActionFromAuctionBiddingIntent(seat: number, actionId: string, payload?: Record<string, unknown>): PlayAction {
  return { type: actionId, playerId: seat, ...(payload ? { payload } : {}) };
}

export function pickAuctionBiddingBotAction(state: PlayState<AuctionBiddingGenre>, seed: number): PlayAction {
  const amount = state.genre.currentBid + 1;
  const bid = amount <= state.genre.chips[state.activePlayerId] &&
    (state.genre.highBidder === null || createSeededRng(seed).at(state.sequence + 1) % 3 !== 0);
  return bid
    ? { type: "bid", playerId: state.activePlayerId, payload: { amount } }
    : { type: "pass", playerId: state.activePlayerId };
}

export function autoPlayAuctionBiddingGame(seed: number) {
  const config = createAuctionBiddingKernelConfig();
  let state = createInitialState(auctionBiddingAdapter, config, seed);
  const actions: PlayAction[] = [];
  while (state.status === "active" && actions.length < 44) {
    const action = pickAuctionBiddingBotAction(state, seed);
    const result = applyAction(auctionBiddingAdapter, state, action, config);
    if (!result.ok) throw new Error(`auction_bidding_auto_play_illegal:${result.reason}`);
    actions.push(action);
    state = result.state;
  }
  return { state, actions };
}
