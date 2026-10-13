import { describe, expect, it } from "vitest";
import {
  applyAction,
  createInitialState,
  hashPlayState,
  replay,
} from "../play-kernel";
import {
  arenaCell,
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
    expect(state.genre.seats[0].board).toHaveLength(14);
    expect(state.genre.seats[0].bench).toHaveLength(5);
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

  it("drag ops: place, move between own cells, sell from board; illegal targets fail closed", () => {
    let state = createInitialState(autoBattlerAdapter, config, 7);
    const step = (type: string, payload?: Record<string, unknown>) => {
      const result = applyAction(autoBattlerAdapter, state, { type, playerId: 0, ...(payload ? { payload } : {}) }, config);
      if (result.ok) state = result.state;
      return result.ok;
    };
    expect(step("buy", { shopIndex: 0 })).toBe(true);
    expect(step("place", { benchIndex: 0, boardIndex: 3 })).toBe(true); // placement allowed during shop
    expect(step("move", { from: 3, to: 10 })).toBe(true);
    expect(state.genre.seats[0].board[10]).not.toBeNull();
    expect(step("move", { from: 10, to: 14 })).toBe(false); // outside own half
    const gold = state.genre.seats[0].gold;
    expect(step("sell", { boardIndex: 10 })).toBe(true);
    expect(state.genre.seats[0].gold).toBeGreaterThan(gold);
    expect(step("sell", { boardIndex: 10, benchIndex: 0 })).toBe(false);
  });

  it("mirrors seat 1 onto the enemy half with seat 0's front row at the tide line", () => {
    expect(arenaCell(0, 0)).toEqual({ col: 0, row: 2 });
    expect(arenaCell(0, 13)).toEqual({ col: 6, row: 3 });
    expect(arenaCell(1, 0)).toEqual({ col: 6, row: 1 });
    expect(arenaCell(1, 13)).toEqual({ col: 0, row: 0 });
  });

  it("buy_xp raises level and board cap", () => {
    let state = createInitialState(autoBattlerAdapter, config, 11);
    expect(state.genre.seats[0].level).toBe(3);
    const before = state.genre.seats[0].gold;
    const up = applyAction(autoBattlerAdapter, state, { type: "buy_xp", playerId: 0 }, config);
    expect(up.ok).toBe(true);
    state = up.state;
    expect(state.genre.seats[0].gold).toBe(before - 4);
    expect(state.genre.seats[0].level).toBe(4);
    expect(state.genre.seats[0].xp).toBe(0);
  });
});
