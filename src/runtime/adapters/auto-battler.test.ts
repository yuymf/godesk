import { describe, expect, it } from "vitest";
import {
  applyAction,
  createInitialState,
  hashPlayState,
  replay,
} from "../play-kernel";
import {
  autoBattlerAdapter,
  autoPlayAutoBattlerGame,
  createAutoBattlerKernelConfig,
  UNIT_CATALOG,
} from "./auto-battler";

describe("auto-battler-v1 Tide Arena", () => {
  const config = createAutoBattlerKernelConfig();

  it("exposes a roster of at least 6 original units", () => {
    expect(UNIT_CATALOG.length).toBeGreaterThanOrEqual(6);
  });

  it("starts in shop with gold, HP, shop of 5, empty bench/board", () => {
    const state = createInitialState(autoBattlerAdapter, config, 42);
    expect(state.phase).toBe("shop");
    expect(state.genre.seats[0].gold).toBe(10);
    expect(state.genre.seats[0].hp).toBe(20);
    expect(state.genre.seats[0].shop).toHaveLength(5);
    expect(state.genre.seats[0].bench.every((slot) => slot === null)).toBe(true);
    expect(state.genre.seats[0].board).toHaveLength(8);
  });

  it("buy → ready_shop both → place → ready_place runs combat deterministically", () => {
    let state = createInitialState(autoBattlerAdapter, config, 7);
    const buy0 = applyAction(
      autoBattlerAdapter,
      state,
      { type: "buy", playerId: 0, payload: { shopIndex: 0 } },
      config,
    );
    expect(buy0.ok).toBe(true);
    state = buy0.state;
    const ready0 = applyAction(
      autoBattlerAdapter,
      state,
      { type: "ready_shop", playerId: 0 },
      config,
    );
    expect(ready0.ok).toBe(true);
    state = ready0.state;
    expect(state.activePlayerId).toBe(1);
    // seat 1 may buy then ready
    const ready1 = applyAction(
      autoBattlerAdapter,
      state,
      { type: "ready_shop", playerId: 1 },
      config,
    );
    expect(ready1.ok).toBe(true);
    state = ready1.state;
    expect(state.phase).toBe("place");

    const benchIdx = state.genre.seats[0].bench.findIndex((p) => p !== null);
    if (benchIdx >= 0) {
      const placed = applyAction(
        autoBattlerAdapter,
        state,
        {
          type: "place",
          playerId: 0,
          payload: { benchIndex: benchIdx, boardIndex: 0 },
        },
        config,
      );
      expect(placed.ok).toBe(true);
      state = placed.state;
    }
    const lock0 = applyAction(
      autoBattlerAdapter,
      state,
      { type: "ready_place", playerId: 0 },
      config,
    );
    expect(lock0.ok).toBe(true);
    state = lock0.state;
    const lock1 = applyAction(
      autoBattlerAdapter,
      state,
      { type: "ready_place", playerId: 1 },
      config,
    );
    expect(lock1.ok).toBe(true);
    state = lock1.state;
    expect(state.genre.combatLog.some((e) => e.kind === "combat_end")).toBe(true);
    // After resolve, either next shop or ended
    expect(["shop", "ended"]).toContain(state.phase);
  });

  it("same seed auto-play is deterministic (hash + combat log)", () => {
    const a = autoPlayAutoBattlerGame(99, 120);
    const b = autoPlayAutoBattlerGame(99, 120);
    expect(hashPlayState(a.state)).toBe(hashPlayState(b.state));
    expect(a.state.genre.combatLog).toEqual(b.state.genre.combatLog);
    expect(a.actions).toEqual(b.actions);
  });

  it("replays the same action log to equal hash", () => {
    const { state, actions } = autoPlayAutoBattlerGame(21, 80);
    const replayed = replay(autoBattlerAdapter, config, 21, actions);
    expect(hashPlayState(replayed)).toBe(hashPlayState(state));
  });
});
