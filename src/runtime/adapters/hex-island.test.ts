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

describe("hex-settlement-v1 hexSettlement adapter", () => {
  it("registers hex-settlement-v1 with the mechanics capability set", () => {
    expect(Object.hasOwn(KERNEL_CAPABILITIES, HEX_SETTLEMENT_KERNEL_TYPE)).toBe(
      true,
    );
    expect(KERNEL_CAPABILITIES[HEX_SETTLEMENT_KERNEL_TYPE]).toEqual(
      MECHANIC_CAPABILITIES["hex-settlement"],
    );
  });

  it("creates beginner board without Tidewell fields on the public envelope", () => {
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
