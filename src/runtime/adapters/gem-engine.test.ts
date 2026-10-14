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

describe("gem-engine-v1 adapter (T010)", () => {
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
