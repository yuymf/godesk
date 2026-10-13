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
import { DEFAULT_AUTO_BATTLER_CONTENT, resolveAutoBattlerContent } from "./auto-battler-content";

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

  it("aoe_splash damages adjacent enemies and emits vfx aoe", () => {
    const content = resolveAutoBattlerContent({
      units: DEFAULT_AUTO_BATTLER_CONTENT.units.map((u) =>
        u.id === "crab"
          ? {
              ...u,
              combatFx: {
                attackVfx: "aoe",
                hitVfx: "hit_particles",
                attackEffect: { kind: "aoe_splash", value: 0.5, label: "溅射" },
              },
            }
          : { ...u },
      ),
    })!;
    const cfg = createAutoBattlerKernelConfig(undefined, content);
    let state = createInitialState(autoBattlerAdapter, cfg, 11);
    const mk = (uid: string, unitId: string, owner: number) => {
      const def = unitDef(unitId, content)!;
      return { uid, unitId, owner, stars: 1 as const, atk: def.atk, hp: def.hp, maxHp: def.hp };
    };
    // Seat0 crab attacks seat1: primary at board[0], adjacent at board[1] (manhattan ≤1 on arena).
    state.genre.seats[0].board[0] = mk("atk", "crab", 0);
    state.genre.seats[1].board[0] = mk("t0", "conch", 1);
    state.genre.seats[1].board[1] = mk("t1", "blade", 1);
    state = { ...state, phase: "place", activePlayerId: 0 };
    const r0 = applyAction(autoBattlerAdapter, state, { type: "ready_place", playerId: 0 }, cfg);
    expect(r0.ok).toBe(true);
    state = r0.state;
    const r1 = applyAction(autoBattlerAdapter, state, { type: "ready_place", playerId: 1 }, cfg);
    expect(r1.ok).toBe(true);
    state = r1.state;
    const log = state.genre.combatLog;
    const splash = log.filter((e) => e.kind === "strike" && "splash" in e && e.splash);
    expect(splash.length).toBeGreaterThanOrEqual(1);
    const aoe = log.filter((e) => e.kind === "vfx" && e.preset === "aoe");
    expect(aoe.length).toBeGreaterThanOrEqual(1);
    // Adjacent target HP dropped below max (primary and/or splash).
    const t1Strikes = log.filter((e) => e.kind === "strike" && e.targetUid === "t1");
    expect(t1Strikes.length).toBeGreaterThanOrEqual(1);
    expect(t1Strikes.some((e) => e.kind === "strike" && e.targetHp < unitDef("blade", content)!.hp)).toBe(true);
  });

  it("heal_ally emits heal + vfx heal and raises ally HP/maxHp", () => {
    const content = resolveAutoBattlerContent({
      units: DEFAULT_AUTO_BATTLER_CONTENT.units.map((u) =>
        u.id === "witch"
          ? {
              ...u,
              combatFx: {
                attackVfx: "heal",
                hitVfx: "hit_particles",
                attackEffect: { kind: "heal_ally", value: 0.5, label: "治疗" },
              },
            }
          : { ...u },
      ),
    })!;
    const cfg = createAutoBattlerKernelConfig(undefined, content);
    let state = createInitialState(autoBattlerAdapter, cfg, 13);
    const mk = (uid: string, unitId: string, owner: number, hp?: number) => {
      const def = unitDef(unitId, content)!;
      const h = hp ?? def.hp;
      return { uid, unitId, owner, stars: 1 as const, atk: def.atk, hp: h, maxHp: def.hp };
    };
    state.genre.seats[0].board[0] = mk("w", "witch", 0);
    state.genre.seats[0].board[1] = mk("ally", "crab", 0, 100); // wounded
    state.genre.seats[1].board[0] = mk("e", "conch", 1);
    state = { ...state, phase: "place", activePlayerId: 0 };
    state = applyAction(autoBattlerAdapter, state, { type: "ready_place", playerId: 0 }, cfg).state;
    state = applyAction(autoBattlerAdapter, state, { type: "ready_place", playerId: 1 }, cfg).state;
    const log = state.genre.combatLog;
    const heals = log.filter((e) => e.kind === "heal");
    expect(heals.length).toBeGreaterThanOrEqual(1);
    const allyHeal = heals.find((e) => e.kind === "heal" && e.uid === "ally");
    expect(allyHeal).toBeTruthy();
    if (allyHeal && allyHeal.kind === "heal") {
      expect(allyHeal.amount).toBeGreaterThan(0);
      expect(allyHeal.targetHp).toBeGreaterThan(100);
    }
    expect(log.some((e) => e.kind === "vfx" && e.preset === "heal" && e.atUid === "ally")).toBe(true);
  });

  it("shield_start emits trait_trigger + vfx shield and raises fighter HP", () => {
    const content = resolveAutoBattlerContent({
      traits: [
        ...DEFAULT_AUTO_BATTLER_CONTENT.traits,
        {
          id: "bulwark",
          label: "壁垒",
          glyph: "盾",
          tiers: [1],
          atkBonus: 0,
          hpBonus: 0,
          effect: { kind: "shield_start", label: "开战护盾", values: [80] },
        },
      ],
      units: DEFAULT_AUTO_BATTLER_CONTENT.units.map((u) =>
        u.id === "crab" ? { ...u, traits: [...u.traits, "bulwark"] } : { ...u },
      ),
    })!;
    const cfg = createAutoBattlerKernelConfig(undefined, content);
    let state = createInitialState(autoBattlerAdapter, cfg, 17);
    const mk = (uid: string, unitId: string, owner: number) => {
      const def = unitDef(unitId, content)!;
      return { uid, unitId, owner, stars: 1 as const, atk: def.atk, hp: def.hp, maxHp: def.hp };
    };
    state.genre.seats[0].board[0] = mk("c0", "crab", 0);
    state.genre.seats[1].board[0] = mk("e0", "conch", 1);
    const baseHp = unitDef("crab", content)!.hp;
    state = { ...state, phase: "place", activePlayerId: 0 };
    state = applyAction(autoBattlerAdapter, state, { type: "ready_place", playerId: 0 }, cfg).state;
    state = applyAction(autoBattlerAdapter, state, { type: "ready_place", playerId: 1 }, cfg).state;
    const log = state.genre.combatLog;
    expect(log.some((e) => e.kind === "trait_trigger" && e.trait === "bulwark")).toBe(true);
    const shields = log.filter((e) => e.kind === "vfx" && e.preset === "shield");
    expect(shields.length).toBeGreaterThanOrEqual(1);
    const heals = log.filter((e) => e.kind === "heal" && e.uid === "c0");
    expect(heals.length).toBeGreaterThanOrEqual(1);
    if (heals[0] && heals[0].kind === "heal") {
      expect(heals[0].amount).toBe(80);
      expect(heals[0].targetHp).toBe(baseHp + 80);
    }
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

describe("auto-battler content data layer", () => {
  it("default content reproduces the shipped 12 units / 4 traits / ★2-only rules", async () => {
    const { DEFAULT_AUTO_BATTLER_CONTENT, resolveAutoBattlerContent } = await import("./auto-battler-content");
    expect(DEFAULT_AUTO_BATTLER_CONTENT.units).toHaveLength(12);
    expect(DEFAULT_AUTO_BATTLER_CONTENT.traits.map((t) => t.id)).toEqual(["tide", "shell", "coral", "voyager"]);
    expect(resolveAutoBattlerContent(undefined)).toBe(DEFAULT_AUTO_BATTLER_CONTENT);
    expect(resolveAutoBattlerContent({ units: [{ id: "x", name: "X", cost: 9, atk: 1, hp: 1, traits: [] }] })).toBeNull();
  });
  it("custom roster drives the shop and ★3 merges three ★2", async () => {
    const m = await import("./auto-battler");
    const { applyAction, createInitialState } = await import("../play-kernel");
    const units = [
      { id: "a", name: "甲", cost: 1, atk: 10, hp: 100, traits: [] },
      { id: "b", name: "乙", cost: 1, atk: 10, hp: 100, traits: [] },
    ];
    const cfg = m.bindAutoBattlerFromRuntimeKernel({ playerCount: 2, tuning: { startGold: 100 }, content: { units, stars: { star3: true } } });
    let s = createInitialState(m.autoBattlerAdapter, cfg, 3);
    expect(s.genre.seats[0].shop.every((id) => id === "a" || id === "b")).toBe(true);
    // Force a shop of all "a" and buy 9 → one ★3.
    for (let k = 0; k < 9; k++) {
      s = { ...s, genre: { ...s.genre, seats: [{ ...s.genre.seats[0], shop: ["a", "a", "a", "a", "a"] }, s.genre.seats[1]] } };
      const r = applyAction(m.autoBattlerAdapter, s, { type: "buy", playerId: 0, payload: { shopIndex: 0 } }, cfg);
      expect(r.ok).toBe(true);
      if (r.ok) s = r.state;
    }
    const pieces = [...s.genre.seats[0].bench, ...s.genre.seats[0].board].filter(Boolean);
    expect(pieces).toHaveLength(1);
    expect(pieces[0]!.stars).toBe(3);
    expect(pieces[0]!.atk).toBe(Math.round(10 * 3.2));
  });
  it("trait tiers from content gate activation", async () => {
    const m = await import("./auto-battler");
    const { DEFAULT_AUTO_BATTLER_CONTENT, resolveAutoBattlerContent } = await import("./auto-battler-content");
    const traits = DEFAULT_AUTO_BATTLER_CONTENT.traits.map((t) => (t.id === "coral" ? { ...t, tiers: [3], effect: { ...t.effect!, values: [0.3] } } : t));
    const content = resolveAutoBattlerContent({ traits })!;
    const board = [
      { uid: "1", unitId: "anemone", owner: 0, stars: 1 as const, atk: 1, hp: 1, maxHp: 1 },
      { uid: "2", unitId: "witch", owner: 0, stars: 1 as const, atk: 1, hp: 1, maxHp: 1 },
    ];
    expect(m.activeSynergies(board).some((s) => s.trait === "coral")).toBe(true);
    expect(m.activeSynergies(board, content).some((s) => s.trait === "coral")).toBe(false);
  });
});

describe("shop refresh variety", () => {
  it("consecutive refreshes are not a sliding window of the previous shop", async () => {
    const m = await import("./auto-battler");
    const { applyAction, createInitialState } = await import("../play-kernel");
    const cfg = m.bindAutoBattlerFromRuntimeKernel({ playerCount: 2, tuning: { startGold: 100 } });
    let s = createInitialState(m.autoBattlerAdapter, cfg, 11);
    const seen = new Set<string>();
    let slid = 0;
    for (let k = 0; k < 12; k++) {
      const prev = s.genre.seats[0].shop.join(",");
      const r = applyAction(m.autoBattlerAdapter, s, { type: "refresh", playerId: 0 }, cfg);
      if (!r.ok) throw new Error("refresh");
      s = r.state;
      s.genre.seats[0].shop.forEach((id) => seen.add(id));
      if (s.genre.seats[0].shop.slice(0, 4).join(",") === prev.split(",").slice(1).join(",")) slid += 1;
    }
    expect(slid).toBe(0);
    expect(seen.size).toBeGreaterThanOrEqual(10);
  });
});
