import { describe, expect, it } from "vitest";
import { applyAction, createInitialState, hashPlayState, listLegalActions,
  PUBLIC_LAYER_FORBIDDEN_REQUIRED_KEYS, replay } from "../play-kernel";
import { KERNEL_CAPABILITIES, MECHANIC_CAPABILITIES } from "../../creator/kernel-capabilities";
import { auctionBiddingAdapter, autoPlayAuctionBiddingGame,
  bindAuctionBiddingFromRuntimeKernel, createAuctionBiddingKernelConfig } from "./auction-bidding";

const config = createAuctionBiddingKernelConfig();
const initial = (seed = 42) => createInitialState(auctionBiddingAdapter, config, seed);

describe("auction-bidding-v1", () => {
  it("registers only auction capabilities and keeps money/lots inside genre", () => {
    expect(KERNEL_CAPABILITIES["auction-bidding-v1"]).toEqual(["bid-pass-resolution", "award-selection", "seeded-draw"]);
    expect(MECHANIC_CAPABILITIES["auction-bidding"]).toEqual(KERNEL_CAPABILITIES["auction-bidding-v1"]);
    const state = initial();
    expect(state.genre).toMatchObject({ chips: [20, 20], scores: [0, 0], lotValue: 10, currentBid: 0, highBidder: null });
    expect(Object.keys(state).sort()).toEqual(["activePlayerId", "events", "genre", "phase", "playerCount", "seed", "sequence", "status", "winnerId"]);
    for (const key of [...PUBLIC_LAYER_FORBIDDEN_REQUIRED_KEYS, "chips", "scores", "lotValue", "currentBid", "highBidder", "cards", "items"]) {
      expect(Object.hasOwn(state, key)).toBe(false);
    }
    expect(() => bindAuctionBiddingFromRuntimeKernel({ playerCount: 3 })).toThrow(/two_players/);
    expect(() => createInitialState(auctionBiddingAdapter, { ...config, adapter: { playerCount: 3 } }, 1)).toThrow(/invalid_adapter_config/);
  });

  it("allows alternating raises then awards the lot on opponent pass", () => {
    let state = initial();
    expect(listLegalActions(auctionBiddingAdapter, state, 0, config).map((a) => a.type)).toEqual(["bid", "pass"]);
    expect(listLegalActions(auctionBiddingAdapter, state, 1, config)).toEqual([]);
    for (const [seat, amount] of [[0, 3], [1, 5], [0, 8]] as const) {
      const result = applyAction(auctionBiddingAdapter, state, { type: "bid", playerId: seat, payload: { amount } }, config);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      state = result.state;
    }
    expect(state.genre.highBidder).toBe(0);
    const result = applyAction(auctionBiddingAdapter, state, { type: "pass", playerId: 1 }, config);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state).toMatchObject({ phase: "ended", status: "complete", winnerId: 0 });
    expect(result.state.genre).toMatchObject({ chips: [12, 20], scores: [10, 0], awardedTo: 0 });
    expect(listLegalActions(auctionBiddingAdapter, result.state, 0, config)).toEqual([]);
  });

  it("ends unsold after two opening passes", () => {
    const first = applyAction(auctionBiddingAdapter, initial(), { type: "pass", playerId: 0 }, config);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = applyAction(auctionBiddingAdapter, first.state, { type: "pass", playerId: 1 }, config);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.state).toMatchObject({ status: "complete", winnerId: null, phase: "ended" });
    expect(second.state.genre).toMatchObject({ scores: [0, 0], chips: [20, 20], awardedTo: null });
  });

  it("fails closed for invalid bid amounts through listLegal → apply", () => {
    const state = initial();
    expect(listLegalActions(auctionBiddingAdapter, state, 0, config).some((a) => a.type === "bid")).toBe(true);
    for (const amount of [0, -1, 1.5, 21, "2", null, undefined]) {
      const result = applyAction(auctionBiddingAdapter, state, { type: "bid", playerId: 0, payload: { amount } }, config);
      expect(result).toMatchObject({ ok: false, reason: "illegal_action" });
      expect(result.state).toBe(state);
    }
    const bid = applyAction(auctionBiddingAdapter, state, { type: "bid", playerId: 0, payload: { amount: 2 } }, config);
    if (!bid.ok) return;
    for (const amount of [2, 1, 21]) {
      expect(applyAction(auctionBiddingAdapter, bid.state, { type: "bid", playerId: 1, payload: { amount } }, config).ok).toBe(false);
    }
  });

  it("replays the same seeded action log to the same hash", () => {
    const { state, actions } = autoPlayAuctionBiddingGame(99);
    expect(state.status).toBe("complete");
    expect(hashPlayState(replay(auctionBiddingAdapter, config, 99, actions))).toBe(hashPlayState(state));
    expect(initial(99).genre.seatOrder).toEqual(initial(99).genre.seatOrder);
    expect(initial(1).genre.lotId).not.toBe(initial(2).genre.lotId);
  });
});
