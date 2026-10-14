import { describe, expect, it } from "vitest";
import { applyAction, createInitialState, hashPlayState, listLegalActions,
  PUBLIC_LAYER_FORBIDDEN_REQUIRED_KEYS, replay } from "../play-kernel";
import { KERNEL_CAPABILITIES, MECHANIC_CAPABILITIES } from "../../creator/kernel-capabilities";
import { auctionBiddingAdapter, autoPlayAuctionBiddingGame,
  bindAuctionBiddingFromRuntimeKernel, createAuctionBiddingKernelConfig,
  defaultHarborContent, ideaRequestsHarborAuction, parseHarborTuningFromIdea,
} from "./auction-bidding";
import { readFileSync } from "node:fs";

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


describe("auction-bidding-v1 harbor subset (T007)", () => {
  const harborCfg = createAuctionBiddingKernelConfig({
    content: defaultHarborContent({ startingFunds: 30, bidVisibility: "open" }),
  });

  it("starts with multi-lot deck, funds 30, and a current lot", () => {
    const state = createInitialState(auctionBiddingAdapter, harborCfg, 7);
    expect(state.genre.harbor).not.toBeNull();
    expect(state.genre.chips).toEqual([30, 30]);
    expect(state.genre.harbor!.currentLot).not.toBeNull();
    expect(state.genre.harbor!.deck.length).toBe(7);
    expect(state.phase).toBe("bidding");
  });

  it("awards a lot into hand then allows black-market sell", () => {
    let state = createInitialState(auctionBiddingAdapter, harborCfg, 3);
    const reserve = state.genre.harbor!.currentLot!.reserve;
    const seat = state.activePlayerId;
    const bid = applyAction(
      auctionBiddingAdapter,
      state,
      { type: "bid", playerId: seat, payload: { amount: reserve } },
      harborCfg,
    );
    expect(bid.ok).toBe(true);
    if (!bid.ok) return;
    state = bid.state;
    const other = state.activePlayerId;
    const pass = applyAction(
      auctionBiddingAdapter,
      state,
      { type: "pass", playerId: other },
      harborCfg,
    );
    expect(pass.ok).toBe(true);
    if (!pass.ok) return;
    state = pass.state;
    expect(state.phase).toBe("market");
    expect(state.genre.harbor!.hand[seat]!.length).toBe(1);
    const lot = state.genre.harbor!.hand[seat]![0]!;
    const sell = applyAction(
      auctionBiddingAdapter,
      state,
      { type: "sell", playerId: seat, payload: { instanceId: lot.instanceId } },
      harborCfg,
    );
    expect(sell.ok).toBe(true);
    if (!sell.ok) return;
    expect(sell.state.genre.chips[seat]!).toBeGreaterThan(30 - reserve);
    const skip = applyAction(
      auctionBiddingAdapter,
      sell.state,
      { type: "pass_market", playerId: seat },
      harborCfg,
    );
    expect(skip.ok).toBe(true);
    if (!skip.ok) return;
    expect(skip.state.phase).toMatch(/bidding|sealed/);
    expect(skip.state.genre.harbor!.currentLot).not.toBeNull();
  });

  it("sealed mode resolves both commits then enters market", () => {
    const cfg = createAuctionBiddingKernelConfig({
      content: defaultHarborContent({ bidVisibility: "sealed", startingFunds: 30 }),
    });
    let state = createInitialState(auctionBiddingAdapter, cfg, 11);
    expect(state.phase).toBe("sealed");
    const reserve = state.genre.harbor!.currentLot!.reserve;
    const a0 = state.activePlayerId;
    const r0 = applyAction(
      auctionBiddingAdapter,
      state,
      { type: "sealed_bid", playerId: a0, payload: { amount: reserve + 1 } },
      cfg,
    );
    expect(r0.ok).toBe(true);
    if (!r0.ok) return;
    state = r0.state;
    const a1 = state.activePlayerId;
    const r1 = applyAction(
      auctionBiddingAdapter,
      state,
      { type: "sealed_pass", playerId: a1 },
      cfg,
    );
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    expect(r1.state.phase).toBe("market");
    expect(r1.state.genre.awardedTo).toBe(a0);
  });

  it("harbor auto-play exhausts deck without illegal actions", () => {
    const { state, actions } = autoPlayAuctionBiddingGame(42, harborCfg);
    expect(actions.length).toBeGreaterThan(5);
    expect(state.status).toBe("complete");
  });

  it("detects H03 INPUT as harbor auction cues", () => {
    const idea = readFileSync(
      "docs/hardness/suites/H03-dark-harbor-auction/INPUT.md",
      "utf8",
    );
    expect(ideaRequestsHarborAuction(idea)).toBe(true);
    const tuning = parseHarborTuningFromIdea(idea);
    expect(tuning.startingFunds).toBe(30);
  });
});
