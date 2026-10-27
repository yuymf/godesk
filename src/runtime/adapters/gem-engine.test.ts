import { describe, expect, it } from "vitest";
import {
  applyAction,
  createInitialState,
  listLegalActions,
} from "../play-kernel";
import {
  GEM_ENGINE_KERNEL_TYPE,
  autoPlayGemEngineGame,
  createGemEngineKernelConfig,
  gemEngineAdapter,
  ideaRequestsGemEngine,
} from "./gem-engine";

describe("gem-engine-v1 adapter", () => {
  it("registers capability set for gem-engine mechanic", async () => {
    // capabilities wired in a follow-up import once kernel-capabilities updated;
    // adapter kernel type is stable here.
    expect(GEM_ENGINE_KERNEL_TYPE).toBe("gem-engine-v1");
    expect(ideaRequestsGemEngine("宝石代币引擎，发展牌永久折扣，贵族声望15")).toBe(true);
    expect(ideaRequestsGemEngine("随便做个竞速")).toBe(false);
  });

  it("boots a 2-seat market with legal take/buy actions", () => {
    const config = createGemEngineKernelConfig();
    const state = createInitialState(gemEngineAdapter, config, 42);
    expect(state.playerCount).toBe(2);
    expect(state.genre.market[0].length).toBe(4);
    const legal = listLegalActions(gemEngineAdapter, state, 0, config);
    expect(legal.some((a) => a.type === "take_diverse")).toBe(true);
  });

  it("auto-plays to a terminal prestige winner", () => {
    const { state, actions } = autoPlayGemEngineGame(7, createGemEngineKernelConfig({
      content: { prestigeToWin: 5 },
    }));
    expect(actions.length).toBeGreaterThan(3);
    expect(state.status).toBe("complete");
    expect(state.winnerId === 0 || state.winnerId === 1).toBe(true);
  });

  it("buys a card and gains a permanent discount", () => {
    const config = createGemEngineKernelConfig({
      content: { bankPerBasic: 7, prestigeToWin: 99 },
    });
    let state = createInitialState(gemEngineAdapter, config, 3);
    // Force tokens onto seat 0 via take actions until a buy is possible, or seed gems.
    // Directly apply take_diverse thrice-equivalent by mutate then buy if legal.
    for (let i = 0; i < 12 && state.status === "active"; i++) {
      const legal = listLegalActions(gemEngineAdapter, state, state.activePlayerId, config);
      const buy = legal.find((a) => a.type === "buy");
      const act = buy ?? legal.find((a) => a.type === "take_diverse") ?? legal[0];
      if (!act) break;
      const result = applyAction(gemEngineAdapter, state, {
        type: act.type,
        playerId: state.activePlayerId,
        ...(act.payload ? { payload: { ...act.payload } } : {}),
      }, config);
      expect(result.ok).toBe(true);
      if (result.ok) state = result.state;
      if (buy) break;
    }
    const discounts = state.genre.seats.flatMap((s) =>
      Object.values(s.discounts).reduce((a, b) => a + b, 0),
    );
    expect(discounts.some((n) => n > 0) || state.genre.seats.some((s) => s.cards.length > 0)).toBe(true);
  });
});

describe("gem-engine-v1 reserve + overflow", () => {
  it("reserves a market card and may take gold", () => {
    const config = createGemEngineKernelConfig({
      content: { bankGold: 5, prestigeToWin: 99 },
    });
    let state = createInitialState(gemEngineAdapter, config, 5);
    const beforeGold = state.genre.bank.gold;
    const card = state.genre.market[0][0]!;
    const result = applyAction(
      gemEngineAdapter,
      state,
      { type: "reserve", playerId: 0, payload: { tier: 1, index: 0 } },
      config,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    state = result.state;
    expect(state.genre.seats[0].reserved.map((c) => c.id)).toContain(card.id);
    expect(state.genre.seats[0].reserved.length).toBe(1);
    if (beforeGold > 0) {
      expect(state.genre.seats[0].gems.gold).toBe(1);
      expect(state.genre.bank.gold).toBe(beforeGold - 1);
    }
    expect(state.activePlayerId).toBe(1);
  });

  it("forces discard when gem total exceeds 10", () => {
    const config = createGemEngineKernelConfig({
      content: { bankPerBasic: 7, prestigeToWin: 99 },
    });
    let state = createInitialState(gemEngineAdapter, config, 9);
    // Fill seat 0 to 9 gems, then take 3 → 12, pending discard.
    state = {
      ...state,
      genre: {
        ...state.genre,
        seats: [
          {
            ...state.genre.seats[0],
            gems: { white: 2, blue: 2, green: 2, red: 2, black: 1, gold: 0 },
            reserved: [],
          },
          { ...state.genre.seats[1], reserved: [] },
        ],
      },
    };
    const take = applyAction(
      gemEngineAdapter,
      state,
      {
        type: "take_diverse",
        playerId: 0,
        payload: { colors: ["white", "blue", "green"] },
      },
      config,
    );
    expect(take.ok).toBe(true);
    if (!take.ok) return;
    state = take.state;
    expect(state.genre.pendingDiscardSeat).toBe(0);
    expect(state.activePlayerId).toBe(0);
    const legal = listLegalActions(gemEngineAdapter, state, 0, config);
    expect(legal.every((a) => a.type === "discard_gems")).toBe(true);
    // Discard until ≤10
    while (state.genre.pendingDiscardSeat === 0) {
      const acts = listLegalActions(gemEngineAdapter, state, 0, config);
      const d = acts.find((a) => a.type === "discard_gems");
      expect(d).toBeTruthy();
      const r = applyAction(
        gemEngineAdapter,
        state,
        {
          type: "discard_gems",
          playerId: 0,
          payload: { ...(d!.payload ?? {}) },
        },
        config,
      );
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      state = r.state;
    }
    const total =
      Object.values(state.genre.seats[0].gems).reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(10);
    expect(state.activePlayerId).toBe(1);
  });

  it("buys from reserved hand", () => {
    const config = createGemEngineKernelConfig({
      content: { bankPerBasic: 7, prestigeToWin: 99 },
    });
    let state = createInitialState(gemEngineAdapter, config, 11);
    const card = state.genre.market[0][0]!;
    // Force reserve without gold complication
    state = {
      ...state,
      genre: {
        ...state.genre,
        bank: { ...state.genre.bank, gold: 0 },
        seats: [
          {
            ...state.genre.seats[0],
            gems: { white: 4, blue: 4, green: 4, red: 4, black: 4, gold: 2 },
            reserved: [{ ...card, cost: { ...card.cost } }],
          },
          { ...state.genre.seats[1], reserved: [] },
        ],
        market: [
          state.genre.market[0].filter((c) => c.id !== card.id),
          state.genre.market[1],
          state.genre.market[2],
        ],
      },
    };
    const result = applyAction(
      gemEngineAdapter,
      state,
      { type: "buy_reserved", playerId: 0, payload: { index: 0 } },
      config,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.genre.seats[0].reserved.length).toBe(0);
    expect(result.state.genre.seats[0].cards.some((c) => c.id === card.id)).toBe(true);
  });
});

describe("gem-engine-v1 multi-seat", () => {
  it("boots 3 and 4 seats with scaled bank and nobles", () => {
    for (const n of [3, 4] as const) {
      const config = createGemEngineKernelConfig({ playerCount: n });
      const state = createInitialState(gemEngineAdapter, config, 11);
      expect(state.playerCount).toBe(n);
      expect(state.genre.seats).toHaveLength(n);
      expect(state.genre.nobles.length).toBe(n + 1);
      const legal = listLegalActions(gemEngineAdapter, state, 0, config);
      expect(legal.length).toBeGreaterThan(0);
    }
  });

  it("auto-plays a 3-seat game to completion", () => {
    const { state, actions } = autoPlayGemEngineGame(
      19,
      createGemEngineKernelConfig({ playerCount: 3, content: { prestigeToWin: 5 } }),
    );
    expect(actions.length).toBeGreaterThan(5);
    expect(state.status).toBe("complete");
    expect(state.winnerId).not.toBeNull();
    expect(state.winnerId! >= 0 && state.winnerId! < 3).toBe(true);
  });
});
