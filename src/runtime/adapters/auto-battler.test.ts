import { describe, expect, it } from "vitest";
import {
  applyAction,
  createInitialState,
  hashPlayState,
  replay,
} from "../play-kernel";
import {
  arenaCell,
  applyAutoBattlerPrepTimeout,
  autoBattlerAdapter,
  autoPlayAutoBattlerGame,
  createAutoBattlerKernelConfig,
  pickAutoBattlerBotAction,
  PREP_SHOP_SECONDS,
  resetAutoBattlerNow,
  setAutoBattlerNow,
  TRAIT_SYNERGIES,
  UNIT_CATALOG,
  unitDef,
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
    const frozen = 1_700_000_000_000 + 21 * 97;
    setAutoBattlerNow(() => frozen);
    try {
      const { state, actions } = autoPlayAutoBattlerGame(21, 80);
      const replayed = replay(autoBattlerAdapter, config, 21, actions);
      expect(hashPlayState(replayed)).toBe(hashPlayState(state));
    } finally {
      resetAutoBattlerNow();
    }
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

describe("auto-battler-v1 Step5 depth", () => {
  const config = createAutoBattlerKernelConfig();

  it("exposes 10–12 original units across 4 traits", () => {
    expect(UNIT_CATALOG.length).toBeGreaterThanOrEqual(10);
    expect(UNIT_CATALOG.length).toBeLessThanOrEqual(12);
    expect(Object.keys(TRAIT_SYNERGIES)).toHaveLength(4);
  });

  it("merges three ★1 of the same unit into one ★2 (×1.8 stats)", () => {
    let state = createInitialState(autoBattlerAdapter, config, 3);
    const mk = (n: number) => ({
      uid: `t${n}`,
      unitId: "crab",
      owner: 0,
      stars: 1 as const,
      atk: 45,
      hp: 650,
      maxHp: 650,
    });
    state.genre.seats[0].bench[0] = mk(1);
    state.genre.seats[0].bench[1] = mk(2);
    state.genre.seats[0].bench[2] = mk(3);
    state.genre.nextUid = 10;
    const placed = applyAction(
      autoBattlerAdapter,
      state,
      { type: "place", playerId: 0, payload: { benchIndex: 0, boardIndex: 0 } },
      config,
    );
    expect(placed.ok).toBe(true);
    state = placed.state;
    const pieces = [...state.genre.seats[0].board, ...state.genre.seats[0].bench].filter(Boolean);
    const star2 = pieces.filter((p) => p && p.stars === 2 && p.unitId === "crab");
    expect(star2).toHaveLength(1);
    expect(star2[0]!.atk).toBe(Math.round(45 * 1.8));
    expect(star2[0]!.maxHp).toBe(Math.round(650 * 1.8));
    expect(pieces).toHaveLength(1);
  });

  it("emits heal and trait_trigger events in combat when synergies are active", () => {
    let state = createInitialState(autoBattlerAdapter, config, 5);
    const mk = (uid: string, unitId: string, owner: number) => {
      const def = unitDef(unitId)!;
      return {
        uid,
        unitId,
        owner,
        stars: 1 as const,
        atk: def.atk,
        hp: def.hp,
        maxHp: def.hp,
      };
    };
    state.genre.seats[0].board[0] = mk("a1", "witch", 0);
    state.genre.seats[0].board[1] = mk("a2", "anemone", 0);
    state.genre.seats[1].board[0] = mk("b1", "crab", 1);
    state = { ...state, phase: "place", activePlayerId: 0 };
    const r0 = applyAction(autoBattlerAdapter, state, { type: "ready_place", playerId: 0 }, config);
    expect(r0.ok).toBe(true);
    state = r0.state;
    const r1 = applyAction(autoBattlerAdapter, state, { type: "ready_place", playerId: 1 }, config);
    expect(r1.ok).toBe(true);
    state = r1.state;
    const kinds = state.genre.combatLog.map((e) => e.kind);
    expect(kinds).toContain("trait_trigger");
    expect(kinds).toContain("heal");
  });

  it("authoritative prep timeout auto-readies both seats into place", () => {
    setAutoBattlerNow(() => 1_000_000);
    const state = createInitialState(autoBattlerAdapter, config, 9);
    expect(state.genre.prepEndsAt).toBe(1_000_000 + PREP_SHOP_SECONDS * 1000);
    setAutoBattlerNow(() => state.genre.prepEndsAt + 1);
    const next = applyAutoBattlerPrepTimeout(state, config);
    expect(next).not.toBeNull();
    expect(next!.phase).toBe("place");
    resetAutoBattlerNow();
  });

  it("bot autoplay fields units on both boards before the first combat", () => {
    let state = createInitialState(autoBattlerAdapter, config, 42);
    let boardsAtCombat: [number, number] | null = null;
    for (let i = 0; i < 80; i += 1) {
      const action = pickAutoBattlerBotAction(state, 42);
      const result = applyAction(autoBattlerAdapter, state, action, config);
      expect(result.ok).toBe(true);
      state = result.state;
      if (state.genre.combatLog.some((e) => e.kind === "combat_end")) {
        boardsAtCombat = [
          state.genre.seats[0].board.filter(Boolean).length,
          state.genre.seats[1].board.filter(Boolean).length,
        ];
        break;
      }
    }
    expect(boardsAtCombat).not.toBeNull();
    expect(boardsAtCombat![0]).toBeGreaterThanOrEqual(1);
    expect(boardsAtCombat![1]).toBeGreaterThanOrEqual(1);
  });
});

describe("auto-battler tuning (creator knobs)", () => {
  it("applies prep timers and starting HP/gold, and round-trips through the session blob", async () => {
    const m = await import("./auto-battler");
    const { createInitialState } = await import("../play-kernel");
    m.setAutoBattlerNow(() => 1_000_000);
    try {
      const cfg = m.bindAutoBattlerFromRuntimeKernel({ playerCount: 2, tuning: { prepShopSeconds: 30, startHp: 40, startGold: 15 } });
      const s = createInitialState(m.autoBattlerAdapter, cfg, 7);
      expect(s.genre.prepEndsAt).toBe(1_000_000 + 30_000);
      expect(s.genre.seats[0].hp).toBe(40);
      expect(s.genre.seats[1].gold).toBe(15);
      const blob = m.autoBattlerToSessionFields(s).autoBattler!;
      expect(m.sessionAutoBattlerToGenre(blob as never).tuning).toEqual({ prepShopSeconds: 30, startHp: 40, startGold: 15 });
      // tuning must survive an applied action (cloneGenre), else timers/HP max reset mid-match
      const { applyAction } = await import("../play-kernel");
      const next = applyAction(m.autoBattlerAdapter, s, m.playActionFromAutoBattlerIntent(0, "ready_shop"), cfg);
      expect(next.ok && next.state.genre.tuning).toEqual({ prepShopSeconds: 30, startHp: 40, startGold: 15 });
    } finally {
      m.resetAutoBattlerNow();
    }
  });
  it("rejects out-of-range tuning", async () => {
    const m = await import("./auto-battler");
    expect(m.normalizeAutoBattlerTuning({ prepShopSeconds: 2 })).toBeNull();
    expect(m.normalizeAutoBattlerTuning({ bogus: 1 })).toBeNull();
  });
});
