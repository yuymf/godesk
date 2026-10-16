import { describe, expect, it } from "vitest";
import { applyAction, createInitialState, hashPlayState, listLegalActions,
  PUBLIC_LAYER_FORBIDDEN_REQUIRED_KEYS, replay } from "../play-kernel";
import { KERNEL_CAPABILITIES, MECHANIC_CAPABILITIES } from "../../creator/kernel-capabilities";
import { auctionBiddingAdapter, autoPlayAuctionBiddingGame,
  bindAuctionBiddingFromRuntimeKernel, createAuctionBiddingKernelConfig,
  defaultGalleryContent, defaultHarborContent, ideaRequestsGalleryAuction,
  ideaRequestsHarborAuction, parseHarborTuningFromIdea,
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
      "docs/hardness/suites/_archive-fictional/H03-dark-harbor-auction/INPUT.md",
      "utf8",
    );
    expect(ideaRequestsHarborAuction(idea)).toBe(true);
    const tuning = parseHarborTuningFromIdea(idea);
    expect(tuning.startingFunds).toBe(30);
  });
});

describe("auction-bidding-v1 gallery subset (T012)", () => {
  const galleryCfg = createAuctionBiddingKernelConfig({
    galleryContent: defaultGalleryContent({ startingFunds: 100, salesToEndRound: 2 }),
  });

  it("detects H05 INPUT as gallery (prefer over harbor 流拍)", () => {
    const idea = readFileSync(
      "docs/hardness/suites/H05-modern-art/INPUT.md",
      "utf8",
    );
    expect(ideaRequestsGalleryAuction(idea)).toBe(true);
    expect(ideaRequestsHarborAuction(idea)).toBe(true); // 流拍 etc.
  });

  it("starts in offer with dealt hands and zero market prices", () => {
    const state = createInitialState(auctionBiddingAdapter, galleryCfg, 7);
    expect(state.phase).toBe("offer");
    expect(state.genre.gallery).not.toBeNull();
    expect(state.genre.harbor).toBeNull();
    expect(state.genre.chips).toEqual([100, 100]);
    expect(state.genre.gallery!.auctionHand[0].length).toBeGreaterThan(0);
    expect(state.genre.gallery!.modes).toEqual(
      expect.arrayContaining(["open", "sealed", "fixed"]),
    );
    for (const a of state.genre.gallery!.artists) {
      expect(state.genre.gallery!.marketPrices[a.id]).toBe(0);
    }
  });

  it("open mode awards into collection then ends round into market sell", () => {
    let state = createInitialState(auctionBiddingAdapter, galleryCfg, 3);
    const seat = state.activePlayerId;
    const painting = state.genre.gallery!.auctionHand[seat]![0]!;
    const play = applyAction(
      auctionBiddingAdapter,
      state,
      {
        type: "play_painting",
        playerId: seat,
        payload: { instanceId: painting.instanceId, mode: "open" },
      },
      galleryCfg,
    );
    expect(play.ok).toBe(true);
    if (!play.ok) return;
    state = play.state;
    expect(state.phase).toBe("live_floor");
    const lotId = state.genre.gallery!.activeFloorLots[0]!.lotId;
    const bidder = state.activePlayerId;
    const reserve = state.genre.gallery!.activeFloorLots[0]!.reserve;
    const bid = applyAction(
      auctionBiddingAdapter,
      state,
      {
        type: "floor_raise",
        playerId: bidder,
        payload: { lotId, amount: reserve },
      },
      galleryCfg,
    );
    expect(bid.ok).toBe(true);
    if (!bid.ok) return;
    state = bid.state;
    // Seller (and any other seats) pass to settle.
    for (const s of [0, 1]) {
      if (!state.genre.gallery!.activeFloorLots.some((l) => l.lotId === lotId)) break;
      if (s === bidder) continue;
      const pass = applyAction(
        auctionBiddingAdapter,
        state,
        { type: "floor_pass", playerId: s, payload: { lotId } },
        galleryCfg,
      );
      expect(pass.ok).toBe(true);
      if (!pass.ok) return;
      state = pass.state;
    }
    expect(state.genre.gallery!.collection[bidder]!.length).toBe(1);
    // salesToEndRound=2 — need second sale of same artist or keep going
    expect(["offer", "market", "live_floor"]).toContain(state.phase);
  });

  it("fixed mode lets other seat buy_fixed", () => {
    let state = createInitialState(auctionBiddingAdapter, galleryCfg, 11);
    const auctioneer = state.activePlayerId;
    const painting = state.genre.gallery!.auctionHand[auctioneer]![0]!;
    const play = applyAction(
      auctionBiddingAdapter,
      state,
      {
        type: "play_painting",
        playerId: auctioneer,
        payload: { instanceId: painting.instanceId, mode: "fixed" },
      },
      galleryCfg,
    );
    expect(play.ok).toBe(true);
    if (!play.ok) return;
    state = play.state;
    expect(state.phase).toBe("fixed");
    const buyer = state.activePlayerId;
    expect(buyer).not.toBe(auctioneer);
    const buy = applyAction(
      auctionBiddingAdapter,
      state,
      { type: "buy_fixed", playerId: buyer },
      galleryCfg,
    );
    expect(buy.ok).toBe(true);
    if (!buy.ok) return;
    expect(buy.state.genre.gallery!.collection[buyer]!.some((p) => p.id === painting.id)).toBe(true);
  });

  it("gallery auto-play completes without illegal actions", () => {
    const { state, actions } = autoPlayAuctionBiddingGame(42, galleryCfg);
    expect(actions.length).toBeGreaterThan(8);
    expect(state.status).toBe("complete");
  });

  it("H03 harbor idea is not gallery", () => {
    const idea = readFileSync(
      "docs/hardness/suites/_archive-fictional/H03-dark-harbor-auction/INPUT.md",
      "utf8",
    );
    expect(ideaRequestsGalleryAuction(idea)).toBe(false);
    expect(ideaRequestsHarborAuction(idea)).toBe(true);
  });
});

describe("auction-bidding-v1 gallery T015 seats/double/refill", () => {
  it("binds 3–5 gallery seats and rejects classic 3p", () => {
    expect(() =>
      bindAuctionBiddingFromRuntimeKernel({
        playerCount: 3,
        gallery: true,
        galleryContent: defaultGalleryContent({ playerCount: 3 }),
      }),
    ).not.toThrow();
    const cfg = createAuctionBiddingKernelConfig({
      playerCount: 3,
      galleryContent: defaultGalleryContent({ playerCount: 3, salesToEndRound: 3 }),
    });
    expect(cfg.playerCount).toBe(3);
    const state = createInitialState(auctionBiddingAdapter, cfg, 5);
    expect(state.playerCount).toBe(3);
    expect(state.genre.chips).toEqual([100, 100, 100]);
    expect(state.genre.gallery!.playerCount).toBe(3);
    expect(state.genre.gallery!.auctionHand).toHaveLength(3);
    expect(state.genre.gallery!.modes).toEqual(
      expect.arrayContaining(["open", "sealed", "fixed", "double"]),
    );
    expect(() => bindAuctionBiddingFromRuntimeKernel({ playerCount: 3 })).toThrow(
      /two_players/,
    );
  });

  it("double mode posts two same-artist paintings at combined fixed price", () => {
    const cfg = createAuctionBiddingKernelConfig({
      galleryContent: defaultGalleryContent({
        modes: ["double"],
        salesToEndRound: 9,
        handSize: 6,
      }),
    });
    let state = createInitialState(auctionBiddingAdapter, cfg, 21);
    const seat = state.activePlayerId;
    const hand = state.genre.gallery!.auctionHand[seat]!;
    // find a same-artist pair
    let a = hand[0]!;
    let b = hand.find((p) => p.instanceId !== a.instanceId && p.artistId === a.artistId);
    if (!b) {
      // reshuffle seed until pair exists
      for (const seed of [22, 23, 24, 25, 30, 40, 50]) {
        state = createInitialState(auctionBiddingAdapter, cfg, seed);
        const h = state.genre.gallery!.auctionHand[state.activePlayerId]!;
        for (let i = 0; i < h.length; i++) {
          for (let j = i + 1; j < h.length; j++) {
            if (h[i]!.artistId === h[j]!.artistId) {
              a = h[i]!;
              b = h[j]!;
              break;
            }
          }
          if (b) break;
        }
        if (b) break;
      }
    }
    expect(b).toBeTruthy();
    const play = applyAction(
      auctionBiddingAdapter,
      state,
      {
        type: "play_painting",
        playerId: state.activePlayerId,
        payload: {
          instanceId: a.instanceId,
          secondInstanceId: b!.instanceId,
          mode: "double",
        },
      },
      cfg,
    );
    expect(play.ok).toBe(true);
    if (!play.ok) return;
    state = play.state;
    expect(state.phase).toBe("fixed");
    expect(state.genre.gallery!.currentMode).toBe("double");
    expect(state.genre.gallery!.companionLot).not.toBeNull();
    expect(state.genre.gallery!.fixedPrice).toBe(
      a.reserve + b!.reserve,
    );
    const buyer = state.activePlayerId;
    const buy = applyAction(
      auctionBiddingAdapter,
      state,
      { type: "buy_fixed", playerId: buyer },
      cfg,
    );
    expect(buy.ok).toBe(true);
    if (!buy.ok) return;
    expect(buy.state.genre.gallery!.collection[buyer]!.length).toBeGreaterThanOrEqual(2);
    expect(buy.state.genre.gallery!.companionLot).toBeNull();
  });

  it("refills hands to handSize at round-start after market", () => {
    const cfg = createAuctionBiddingKernelConfig({
      galleryContent: defaultGalleryContent({
        modes: ["fixed"],
        salesToEndRound: 1,
        handSize: 3,
        roundsToEnd: 3,
        startingFunds: 200,
      }),
    });
    let state = createInitialState(auctionBiddingAdapter, cfg, 8);
    const handSize = state.genre.gallery!.handSize;
    // Play one fixed sale to trigger market (salesToEndRound=1)
    const auctioneer = state.activePlayerId;
    const painting = state.genre.gallery!.auctionHand[auctioneer]![0]!;
    let r = applyAction(
      auctionBiddingAdapter,
      state,
      {
        type: "play_painting",
        playerId: auctioneer,
        payload: { instanceId: painting.instanceId, mode: "fixed" },
      },
      cfg,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    state = r.state;
    const buyer = state.activePlayerId;
    r = applyAction(
      auctionBiddingAdapter,
      state,
      { type: "buy_fixed", playerId: buyer },
      cfg,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    state = r.state;
    expect(state.phase).toBe("market");
    // both seats pass market
    for (let i = 0; i < 2; i++) {
      r = applyAction(
        auctionBiddingAdapter,
        state,
        { type: "pass_market", playerId: state.activePlayerId },
        cfg,
      );
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      state = r.state;
    }
    expect(state.phase).toBe("offer");
    expect(state.genre.gallery!.round).toBe(2);
    for (const hand of state.genre.gallery!.auctionHand) {
      expect(hand.length).toBeLessThanOrEqual(handSize);
      // after spending 1 card, refill should bring back toward handSize if deck allows
      expect(hand.length).toBeGreaterThan(0);
    }
  });

  it("3p gallery auto-play completes", () => {
    const cfg = createAuctionBiddingKernelConfig({
      playerCount: 3,
      galleryContent: defaultGalleryContent({
        playerCount: 3,
        salesToEndRound: 3,
        roundsToEnd: 2,
      }),
    });
    const { state, actions } = autoPlayAuctionBiddingGame(77, cfg);
    expect(actions.length).toBeGreaterThan(10);
    expect(state.status).toBe("complete");
    expect(state.genre.chips).toHaveLength(3);
  });
});


describe("auction-bidding-v1 gallery T020 simultaneous sealed + brokerage", () => {
  it("allows off-turn sealed commits then reveals together", () => {
    const config = createAuctionBiddingKernelConfig({
      playerCount: 3,
      galleryContent: defaultGalleryContent({
        playerCount: 3,
        startingFunds: 100,
        salesToEndRound: 9,
        modes: ["sealed"],
        simultaneousSealed: true,
        brokerageEnabled: true,
        brokerSecondCutBps: 1000,
      }),
    });
    let state = createInitialState(auctionBiddingAdapter, config, 5);
    const auctioneer = state.genre.gallery!.auctioneer;
    const painting = state.genre.gallery!.auctionHand[auctioneer]![0]!;
    const played = applyAction(
      auctionBiddingAdapter,
      state,
      {
        type: "play_painting",
        playerId: auctioneer,
        payload: { instanceId: painting.instanceId, mode: "sealed" },
      },
      config,
    );
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    state = played.state;
    expect(state.phase).toBe("sealed");
    const floor = state.genre.gallery!.currentLot!.reserve;
    // Seat 2 commits while active may still be auctioneer/another — off-turn OK.
    const offSeat = ((auctioneer + 2) % 3) as number;
    const off = applyAction(
      auctionBiddingAdapter,
      state,
      {
        type: "sealed_bid",
        playerId: offSeat,
        payload: { amount: floor + 4 },
      },
      config,
    );
    expect(off.ok).toBe(true);
    if (!off.ok) return;
    state = off.state;
    expect(state.genre.gallery!.sealedBids[offSeat]).toBe(floor + 4);
    // Remaining seats commit
    for (let s = 0; s < 3; s += 1) {
      if (state.genre.gallery!.sealedBids[s] !== null) continue;
      const amount = s === auctioneer ? floor + 1 : floor + 8;
      const r = applyAction(
        auctionBiddingAdapter,
        state,
        {
          type: "sealed_bid",
          playerId: s,
          payload: { amount },
        },
        config,
      );
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      state = r.state;
    }
    expect(state.phase).not.toBe("sealed");
    // Highest (floor+8) won; second (floor+4) got brokerage cut
    expect(state.genre.gallery!.lastBroker).not.toBeNull();
    expect(state.genre.gallery!.lastBroker!.cut).toBeGreaterThan(0);
  });

  it("brokerage pays second place a cut of the sealed award", () => {
    const config = createAuctionBiddingKernelConfig({
      playerCount: 3,
      galleryContent: defaultGalleryContent({
        playerCount: 3,
        startingFunds: 80,
        salesToEndRound: 9,
        modes: ["sealed"],
        brokerageEnabled: true,
        brokerSecondCutBps: 2000,
      }),
    });
    let state = createInitialState(auctionBiddingAdapter, config, 9);
    const a = state.genre.gallery!.auctioneer;
    const painting = state.genre.gallery!.auctionHand[a]![0]!;
    let r = applyAction(
      auctionBiddingAdapter,
      state,
      {
        type: "play_painting",
        playerId: a,
        payload: { instanceId: painting.instanceId, mode: "sealed" },
      },
      config,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    state = r.state;
    const floor = state.genre.gallery!.currentLot!.reserve;
    const bids = [floor + 2, floor + 10, floor + 6];
    for (let s = 0; s < 3; s += 1) {
      r = applyAction(
        auctionBiddingAdapter,
        state,
        { type: "sealed_bid", playerId: s, payload: { amount: bids[s] } },
        config,
      );
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      state = r.state;
    }
    // Winner seat 1 paid 10+floor; second seat 2 gets 20% cut
    expect(state.genre.gallery!.lastBroker?.seat).toBe(2);
    const cut = Math.floor(((floor + 10) * 2000) / 10000);
    expect(state.genre.gallery!.lastBroker?.cut).toBe(cut);
  });
});

describe("auction-bidding-v1 gallery T024 live multi-lot + negotiated brokerage", () => {
  it("keeps two lots live and settles with negotiated broker cut", () => {
    const config = createAuctionBiddingKernelConfig({
      playerCount: 3,
      galleryContent: defaultGalleryContent({
        playerCount: 3,
        startingFunds: 120,
        salesToEndRound: 9,
        modes: ["open"],
        liveMultiLotFloor: true,
        maxLiveLots: 2,
        negotiatedBrokerage: true,
        brokerageEnabled: false,
      }),
    });
    let state = createInitialState(auctionBiddingAdapter, config, 11);
    const a = state.genre.gallery!.auctioneer;
    const hand = state.genre.gallery!.auctionHand[a]!;
    const p0 = hand[0]!;
    const p1 = hand[1]!;
    let r = applyAction(
      auctionBiddingAdapter,
      state,
      {
        type: "play_painting",
        playerId: a,
        payload: {
          instanceId: p0.instanceId,
          mode: "open",
          brokerSeat: ((a + 2) % 3),
          cutBps: 1500,
        },
      },
      config,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    state = r.state;
    expect(state.phase).toBe("live_floor");
    expect(state.genre.gallery!.activeFloorLots).toHaveLength(1);
    // Auctioneer adds second lot while first still live (off-turn / same phase).
    r = applyAction(
      auctionBiddingAdapter,
      state,
      {
        type: "play_painting",
        playerId: a,
        payload: {
          instanceId: p1.instanceId,
          mode: "open",
          brokerSeat: ((a + 2) % 3),
          cutBps: 2000,
        },
      },
      config,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    state = r.state;
    expect(state.genre.gallery!.activeFloorLots.length).toBe(2);
    const lotA = state.genre.gallery!.activeFloorLots[0]!;
    const bidder = ((a + 1) % 3) as number;
    const amount = lotA.currentBid + 3;
    r = applyAction(
      auctionBiddingAdapter,
      state,
      {
        type: "floor_raise",
        playerId: bidder,
        payload: { lotId: lotA.lotId, amount },
      },
      config,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    state = r.state;
    // Remaining seats pass on lotA → award with negotiated broker (seat a+2)
    for (const s of [0, 1, 2]) {
      if (s === bidder) continue;
      if (!state.genre.gallery!.activeFloorLots.some((l) => l.lotId === lotA.lotId)) {
        break;
      }
      r = applyAction(
        auctionBiddingAdapter,
        state,
        {
          type: "floor_pass",
          playerId: s,
          payload: { lotId: lotA.lotId },
        },
        config,
      );
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      state = r.state;
    }
    expect(state.genre.gallery!.lastBroker?.seat).toBe((a + 2) % 3);
    expect(state.genre.gallery!.lastBroker?.cut).toBe(
      Math.floor((amount * 1500) / 10000),
    );
    expect(state.genre.gallery!.activeFloorLots.length).toBe(1);
  });

  it("set_broker_terms changes cut before first raise", () => {
    const config = createAuctionBiddingKernelConfig({
      playerCount: 3,
      galleryContent: defaultGalleryContent({
        playerCount: 3,
        modes: ["open"],
        liveMultiLotFloor: true,
        negotiatedBrokerage: true,
        salesToEndRound: 9,
      }),
    });
    let state = createInitialState(auctionBiddingAdapter, config, 3);
    const a = state.genre.gallery!.auctioneer;
    const p = state.genre.gallery!.auctionHand[a]![0]!;
    let r = applyAction(
      auctionBiddingAdapter,
      state,
      {
        type: "play_painting",
        playerId: a,
        payload: { instanceId: p.instanceId, mode: "open" },
      },
      config,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    state = r.state;
    const lotId = state.genre.gallery!.activeFloorLots[0]!.lotId;
    const broker = ((a + 2) % 3) as number;
    r = applyAction(
      auctionBiddingAdapter,
      state,
      {
        type: "set_broker_terms",
        playerId: a,
        payload: { lotId, brokerSeat: broker, cutBps: 2500 },
      },
      config,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    state = r.state;
    expect(state.genre.gallery!.activeFloorLots[0]!.brokerCutBps).toBe(2500);
    expect(state.genre.gallery!.activeFloorLots[0]!.brokerSeat).toBe(broker);
  });
});
