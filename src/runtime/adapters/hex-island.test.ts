import { describe, expect, it } from "vitest";
import {
  applyAction,
  createInitialState,
  hashPlayState,
  listLegalActions,
  PUBLIC_LAYER_FORBIDDEN_REQUIRED_KEYS,
  replay,
  type PlayAction,
  type PlayState,
} from "../play-kernel";
import { KERNEL_CAPABILITIES, MECHANIC_CAPABILITIES } from "../../creator/kernel-capabilities";
import { createHexBoardGraph, createHexTopologyStub } from "../topology-stub";
import {
  autoPlayHexIslandGame,
  bindHexIslandFromRuntimeKernel,
  hexIslandAdapter,
  hexIslandBoardGraph,
  createBeginnerTiles,
  createHexIslandKernelConfig,
  HEX_SETTLEMENT_KERNEL_TYPE,
  pickHexIslandBotAction,
  publicVictoryPoints,
  type HexIslandGenre,
} from "./hex-island";

const config = createHexIslandKernelConfig({ playerCount: 2 });

function snapshotBody(state: PlayState<HexIslandGenre>) {
  const { events: _events, ...rest } = state;
  return rest;
}

describe("hex-settlement-v1 hexIsland adapter", () => {
  it("registers hex-settlement-v1 with the mechanics capability set", () => {
    expect(Object.hasOwn(KERNEL_CAPABILITIES, HEX_SETTLEMENT_KERNEL_TYPE)).toBe(
      true,
    );
    expect(KERNEL_CAPABILITIES[HEX_SETTLEMENT_KERNEL_TYPE]).toEqual(
      MECHANIC_CAPABILITIES["hex-settlement"],
    );
  });

  it("creates beginner board without hex-island fields on the public envelope", () => {
    const state = createInitialState(hexIslandAdapter, config, 42);
    expect(state.seed).toBe(42);
    expect(state.phase).toBe("setup");
    expect(state.activePlayerId).toBe(0);
    expect(state.playerCount).toBe(2);
    expect(state.genre.tiles).toHaveLength(19);
    expect(state.genre.tiles.some((tile) => tile.terrain === "desert")).toBe(
      true,
    );
    expect(hexIslandBoardGraph().vertexIds.length).toBeGreaterThan(40);
    expect(createHexTopologyStub(2).kind).toBe("hex");
    expect(createHexBoardGraph(2).kind).toBe("hex");
    expect(createBeginnerTiles()).toHaveLength(19);

    for (const forbidden of PUBLIC_LAYER_FORBIDDEN_REQUIRED_KEYS) {
      expect(Object.keys(state)).not.toContain(forbidden);
      expect(Object.keys(config)).not.toContain(forbidden);
    }
  });

  it("lists opening setup settlements and rejects illegal distance", () => {
    const state = createInitialState(hexIslandAdapter, config, 7);
    const legal = listLegalActions(hexIslandAdapter, state, 0, config);
    expect(legal.length).toBeGreaterThan(10);
    expect(legal.every((action) => action.type === "place_settlement")).toBe(
      true,
    );
    expect(listLegalActions(hexIslandAdapter, state, 1, config)).toEqual([]);

    const first = legal[0];
    const placed = applyAction(
      hexIslandAdapter,
      state,
      {
        type: "place_settlement",
        playerId: 0,
        payload: first.payload,
      },
      config,
    );
    expect(placed.ok).toBe(true);
    if (!placed.ok) throw new Error(placed.reason);
    expect(placed.state.genre.pendingRoadVertex).toBe(first.payload?.vertexId);
    const roads = listLegalActions(hexIslandAdapter, placed.state, 0, config);
    expect(roads.every((action) => action.type === "place_road")).toBe(true);
    expect(roads.length).toBeGreaterThan(0);
  });

  it("does not mutate state on illegal actions", () => {
    const state = createInitialState(hexIslandAdapter, config, 11);
    const beforeHash = hashPlayState(state);
    const beforeJson = JSON.stringify(state);

    const bad = applyAction(
      hexIslandAdapter,
      state,
      { type: "roll_dice", playerId: 0 },
      config,
    );
    expect(bad.ok).toBe(false);
    if (bad.ok) throw new Error("expected fail");
    expect(bad.state).toBe(state);
    expect(JSON.stringify(state)).toBe(beforeJson);
    expect(hashPlayState(state)).toBe(beforeHash);

    const wrongSeat = applyAction(
      hexIslandAdapter,
      state,
      {
        type: "place_settlement",
        playerId: 1,
        payload: { vertexId: "nope" },
      },
      config,
    );
    expect(wrongSeat.ok).toBe(false);
    expect(wrongSeat.state).toBe(state);
  });

  it("replays the same seed + actions to an identical hash/state body", () => {
    const seed = 99;
    const { state: live, actions } = autoPlayHexIslandGame(seed, config);
    expect(live.status).toBe("complete");
    const replayed = replay(hexIslandAdapter, config, seed, actions);
    expect(hashPlayState(replayed)).toBe(hashPlayState(live));
    expect(snapshotBody(replayed)).toEqual(snapshotBody(live));
  });

  it("auto-plays ≥20 fixed seeds to a legal terminal", () => {
    const seeds = Array.from({ length: 24 }, (_, index) => index + 1);
    const summaries: Array<{
      seed: number;
      plies: number;
      status: string;
      scores: number[];
      hash: string;
    }> = [];

    for (const seed of seeds) {
      const { state, actions } = autoPlayHexIslandGame(seed, config);
      expect(state.status).toBe("complete");
      expect(state.phase).toBe("ended");
      expect(state.events.some((event) => event.kind === "ended")).toBe(true);
      expect(state.winnerId).not.toBeNull();
      expect(
        publicVictoryPoints(state.genre, state.winnerId as number),
      ).toBeGreaterThanOrEqual(10);
      expect(actions.length).toBeGreaterThan(0);
      const replayed = replay(hexIslandAdapter, config, seed, actions);
      expect(hashPlayState(replayed)).toBe(hashPlayState(state));
      summaries.push({
        seed,
        plies: actions.length,
        status: state.status,
        scores: state.genre.players.map((_, seat) =>
          publicVictoryPoints(state.genre, seat),
        ),
        hash: hashPlayState(state),
      });
    }
    expect(summaries).toHaveLength(24);
    expect(new Set(summaries.map((entry) => entry.hash)).size).toBeGreaterThan(
      1,
    );
  }, 120_000);

  it("local AI only chooses from listLegalActions and finishes", () => {
    const seed = 17;
    let state = createInitialState(hexIslandAdapter, config, seed);
    const log: PlayAction[] = [];
    let guard = 0;
    while (state.status === "active" && guard < 8000) {
      guard += 1;
      const legal = listLegalActions(
        hexIslandAdapter,
        state,
        state.activePlayerId,
        config,
      );
      expect(legal.length).toBeGreaterThan(0);
      const bot = pickHexIslandBotAction(state, config, seed, state.sequence + 1);
      expect(bot).not.toBeNull();
      if (!bot) throw new Error("missing bot");
      expect(legal.some((entry) => entry.type === bot.type)).toBe(true);
      const result = applyAction(hexIslandAdapter, state, bot, config);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.reason);
      log.push(bot);
      state = result.state;
    }
    expect(state.status).toBe("complete");
    expect(log.some((action) => action.type === "place_settlement")).toBe(true);
    expect(log.some((action) => action.type === "roll_dice")).toBe(true);
  }, 60_000);

  it("thin-binds a hex-island-shaped GameSpec/runtime kernel into createInitialState → play", () => {
    const bound = bindHexIslandFromRuntimeKernel({
      playerCount: 2,
      victoryPointsToWin: 10,
    });
    expect(bound.kernelType).toBe(HEX_SETTLEMENT_KERNEL_TYPE);
    const state = createInitialState(hexIslandAdapter, bound, 3);
    const first = listLegalActions(hexIslandAdapter, state, 0, bound)[0];
    expect(first?.type).toBe("place_settlement");
    const result = applyAction(
      hexIslandAdapter,
      state,
      {
        type: "place_settlement",
        playerId: 0,
        payload: first.payload,
      },
      bound,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.state.genre.players[0].settlements).toHaveLength(1);
    expect(result.state.phase).toBe("setup");
  });
});

describe("hex-settlement negotiated trade (T014)", () => {
  it("propose → accept swaps multi-resource bags", () => {
    const config = createHexIslandKernelConfig({ playerCount: 2 });
    let state = createInitialState(hexIslandAdapter, config, 11);
    state = {
      ...state,
      phase: "main",
      activePlayerId: 0,
      genre: {
        ...state.genre,
        pendingTrade: null,
        players: state.genre.players.map((player, seat) => ({
          ...player,
          resources:
            seat === 0
              ? { wood: 2, brick: 0, sheep: 1, wheat: 0, ore: 0 }
              : { wood: 0, brick: 1, sheep: 0, wheat: 0, ore: 1 },
        })),
      },
    };
    const propose = applyAction(
      hexIslandAdapter,
      state,
      {
        type: "propose_trade",
        playerId: 0,
        payload: {
          withSeat: 1,
          give: { wood: 1, sheep: 1, brick: 0, wheat: 0, ore: 0 },
          take: { ore: 1, wood: 0, brick: 0, sheep: 0, wheat: 0 },
        },
      },
      config,
    );
    expect(propose.ok).toBe(true);
    if (!propose.ok) return;
    expect(propose.state.phase).toBe("trade_response");
    expect(propose.state.activePlayerId).toBe(1);
    const accept = applyAction(
      hexIslandAdapter,
      propose.state,
      { type: "accept_trade", playerId: 1 },
      config,
    );
    expect(accept.ok).toBe(true);
    if (!accept.ok) return;
    expect(accept.state.phase).toBe("main");
    expect(accept.state.activePlayerId).toBe(0);
    expect(accept.state.genre.players[0].resources.ore).toBe(1);
    expect(accept.state.genre.players[0].resources.wood).toBe(1);
    expect(accept.state.genre.players[1].resources.wood).toBe(1);
    expect(accept.state.genre.pendingTrade).toBeNull();
  });

  it("reject returns initiative to proposer without swapping", () => {
    const config = createHexIslandKernelConfig({ playerCount: 2 });
    let state = createInitialState(hexIslandAdapter, config, 5);
    state = {
      ...state,
      phase: "main",
      activePlayerId: 0,
      genre: {
        ...state.genre,
        pendingTrade: null,
        players: state.genre.players.map((player, seat) => ({
          ...player,
          resources:
            seat === 0
              ? { wood: 2, brick: 0, sheep: 0, wheat: 0, ore: 0 }
              : { wood: 0, brick: 1, sheep: 0, wheat: 0, ore: 0 },
        })),
      },
    };
    const propose = applyAction(
      hexIslandAdapter,
      state,
      {
        type: "propose_trade",
        playerId: 0,
        payload: {
          withSeat: 1,
          give: { wood: 1, brick: 0, sheep: 0, wheat: 0, ore: 0 },
          take: { brick: 1, wood: 0, sheep: 0, wheat: 0, ore: 0 },
        },
      },
      config,
    );
    expect(propose.ok).toBe(true);
    if (!propose.ok) return;
    const reject = applyAction(
      hexIslandAdapter,
      propose.state,
      { type: "reject_trade", playerId: 1 },
      config,
    );
    expect(reject.ok).toBe(true);
    if (!reject.ok) return;
    expect(reject.state.genre.players[0].resources.wood).toBe(2);
    expect(reject.state.genre.players[1].resources.brick).toBe(1);
    expect(reject.state.activePlayerId).toBe(0);
  });
});

describe("hex-settlement-v1 domestic auction + brokerage (T023)", () => {
  it("runs a 3-seat sealed resource auction with second-place cut", () => {
    const config = createHexIslandKernelConfig({ playerCount: 3 });
    let state = createInitialState(hexIslandAdapter, config, 11);
    // Jump to main with resources by mutating after create (setup is long).
    // Force main phase with stocked banks.
    state = {
      ...state,
      phase: "main",
      activePlayerId: 0,
      status: "active",
      genre: {
        ...state.genre,
        setupStep: state.genre.playerCount * 4,
        pendingRoadVertex: null,
        turnPlayer: 0,
        players: state.genre.players.map((p, i) => ({
          ...p,
          resources: {
            wood: i === 0 ? 2 : 0,
            brick: 0,
            sheep: 0,
            wheat: i === 0 ? 0 : 5,
            ore: 0,
          },
        })),
      },
    };
    const start = applyAction(
      hexIslandAdapter,
      state,
      {
        type: "start_domestic_auction",
        playerId: 0,
        payload: { resource: "wood", qty: 1, reserve: 1, mode: "sealed" },
      },
      config,
    );
    expect(start.ok).toBe(true);
    if (!start.ok) return;
    state = start.state;
    expect(state.phase).toBe("domestic_auction");
    expect(state.genre.players[0].resources.wood).toBe(1); // escrowed 1 of 2

    // Seat 2 bids off-turn
    const off = applyAction(
      hexIslandAdapter,
      state,
      { type: "auction_bid", playerId: 2, payload: { amount: 2 } },
      config,
    );
    expect(off.ok).toBe(true);
    if (!off.ok) return;
    state = off.state;

    const bid1 = applyAction(
      hexIslandAdapter,
      state,
      { type: "auction_bid", playerId: 1, payload: { amount: 4 } },
      config,
    );
    expect(bid1.ok).toBe(true);
    if (!bid1.ok) return;
    state = bid1.state;
    expect(state.phase).toBe("main");
    // Winner seat 1 paid 4 wheat, got wood; seller got payment minus 10% cut to seat 2
    expect(state.genre.players[1].resources.wood).toBe(1);
    expect(state.genre.players[1].resources.wheat).toBe(1); // 5-4
    expect(state.genre.players[0].resources.wheat).toBe(4); // seller gets 4 (cut 0 if second got from paid - 10% of 4 = 0)
    // With amount 4 and 1000 bps, cut = 0. Use higher bid to see cut.
  });

  it("pays brokerage cut on larger sealed award", () => {
    const config = createHexIslandKernelConfig({ playerCount: 3 });
    let state = createInitialState(hexIslandAdapter, config, 5);
    state = {
      ...state,
      phase: "main",
      activePlayerId: 0,
      status: "active",
      genre: {
        ...state.genre,
        setupStep: 12,
        pendingRoadVertex: null,
        turnPlayer: 0,
        players: state.genre.players.map((p, i) => ({
          ...p,
          resources: {
            wood: i === 0 ? 1 : 0,
            brick: 0,
            sheep: 0,
            wheat: i === 0 ? 0 : 10,
            ore: 0,
          },
        })),
      },
    };
    let r = applyAction(
      hexIslandAdapter,
      state,
      {
        type: "start_domestic_auction",
        playerId: 0,
        payload: { resource: "wood", qty: 1, reserve: 1, mode: "sealed" },
      },
      config,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    state = r.state;
    r = applyAction(
      hexIslandAdapter,
      state,
      { type: "auction_bid", playerId: 1, payload: { amount: 10 } },
      config,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    state = r.state;
    r = applyAction(
      hexIslandAdapter,
      state,
      { type: "auction_bid", playerId: 2, payload: { amount: 6 } },
      config,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    state = r.state;
    // cut = floor(10 * 1000 / 10000) = 1; seat 2 second gets cut, did not pay bid
    expect(state.genre.players[2].resources.wheat).toBe(11); // 10 + 1 cut
    expect(state.genre.players[0].resources.wheat).toBe(9); // seller 10-1
    expect(state.genre.players[1].resources.wheat).toBe(0); // winner paid 10
    expect(state.genre.players[1].resources.wood).toBe(1);
  });
});

describe("hex-settlement-v1 domestic live multi-lot + negotiated brokerage (T025)", () => {
  function stockedMain(seed: number, playerCount = 3) {
    const config = createHexIslandKernelConfig({ playerCount });
    let state = createInitialState(hexIslandAdapter, config, seed);
    state = {
      ...state,
      phase: "main",
      activePlayerId: 0,
      status: "active",
      genre: {
        ...state.genre,
        setupStep: playerCount * 4,
        pendingRoadVertex: null,
        turnPlayer: 0,
        activeFloorLots: [],
        lastFloorBroker: null,
        players: state.genre.players.map((p, i) => ({
          ...p,
          resources: {
            wood: i === 0 ? 3 : 0,
            brick: i === 0 ? 1 : 0,
            sheep: 0,
            wheat: i === 0 ? 0 : 12,
            ore: 0,
          },
        })),
      },
    };
    return { config, state };
  }

  it("runs two concurrent live lots and awards with negotiated broker cut", () => {
    let { config, state } = stockedMain(17);
    let r = applyAction(
      hexIslandAdapter,
      state,
      {
        type: "start_domestic_auction",
        playerId: 0,
        payload: {
          resource: "wood",
          qty: 1,
          reserve: 1,
          mode: "live",
          brokerSeat: 2,
          cutBps: 1500,
        },
      },
      config,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    state = r.state;
    expect(state.phase).toBe("domestic_live_floor");
    expect(state.genre.activeFloorLots).toHaveLength(1);
    // Add second lot while first is live
    r = applyAction(
      hexIslandAdapter,
      state,
      {
        type: "start_domestic_auction",
        playerId: 0,
        payload: {
          resource: "brick",
          qty: 1,
          reserve: 1,
          mode: "live",
          brokerSeat: 2,
          cutBps: 2000,
        },
      },
      config,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    state = r.state;
    expect(state.genre.activeFloorLots).toHaveLength(2);
    const lotA = state.genre.activeFloorLots[0]!;
    const amount = Math.max(lotA.currentBid + 1, 10);
    r = applyAction(
      hexIslandAdapter,
      state,
      {
        type: "floor_raise",
        playerId: 1,
        payload: { lotId: lotA.lotId, amount },
      },
      config,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    state = r.state;
    for (const s of [0, 2]) {
      if (!state.genre.activeFloorLots.some((l) => l.lotId === lotA.lotId)) break;
      r = applyAction(
        hexIslandAdapter,
        state,
        { type: "floor_pass", playerId: s, payload: { lotId: lotA.lotId } },
        config,
      );
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      state = r.state;
    }
    expect(state.genre.lastFloorBroker?.seat).toBe(2);
    expect(state.genre.lastFloorBroker?.cut).toBe(
      Math.floor((amount * 1500) / 10000),
    );
    expect(state.genre.activeFloorLots).toHaveLength(1);
    expect(state.genre.players[1].resources.wood).toBe(1);
  });

  it("set_broker_terms updates negotiated cut before first raise", () => {
    let { config, state } = stockedMain(9);
    let r = applyAction(
      hexIslandAdapter,
      state,
      {
        type: "start_domestic_auction",
        playerId: 0,
        payload: { resource: "wood", qty: 1, reserve: 1, mode: "live" },
      },
      config,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    state = r.state;
    const lotId = state.genre.activeFloorLots[0]!.lotId;
    r = applyAction(
      hexIslandAdapter,
      state,
      {
        type: "set_broker_terms",
        playerId: 0,
        payload: { lotId, brokerSeat: 2, cutBps: 2500 },
      },
      config,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    state = r.state;
    expect(state.genre.activeFloorLots[0]!.brokerSeat).toBe(2);
    expect(state.genre.activeFloorLots[0]!.brokerCutBps).toBe(2500);
  });
});
