import { describe, expect, it } from "vitest";
import {
  advancePhase,
  applyAction,
  createInitialState,
  createSeededRng,
  hashPlayState,
  listLegalActions,
  PUBLIC_LAYER_FORBIDDEN_REQUIRED_KEYS,
  replay,
  type PlayAction,
  type PlayKernelConfig,
  type PlayState,
} from "./play-kernel";
import {
  createTurnTakingKernelConfig,
  TURN_TAKING_KERNEL_TYPE,
  TURN_TAKING_PHASES,
  turnTakingAdapter,
  type TurnTakingGenre,
} from "./adapters/turn-taking";
import {
  createGridTopologyStub,
  GRID_EIGHT_DIRECTIONS,
  type TopologyStub,
} from "./topology-stub";
import { KERNEL_CAPABILITIES } from "../creator/kernel-capabilities";

const demoConfig = createTurnTakingKernelConfig({
  playerCount: 2,
  maxTurns: 4,
  actions: [
    { id: "continue", label: "Continue" },
    { id: "focus", label: "Focus" },
  ],
});

const passConfig = createTurnTakingKernelConfig({
  playerCount: 2,
  maxTurns: 3,
  actions: [{ id: "continue", label: "Continue" }],
  allowPass: true,
});

function snapshotBody(state: PlayState<TurnTakingGenre>) {
  const { events: _events, ...rest } = state;
  return rest;
}

describe("public play-kernel contract", () => {
  it("creates initial state from seed without mutating adapter config", () => {
    const state = createInitialState(turnTakingAdapter, demoConfig, 42);
    expect(state.seed).toBe(42);
    expect(state.sequence).toBe(0);
    expect(state.phase).toBe("turn");
    expect(state.activePlayerId).toBe(0);
    expect(state.playerCount).toBe(2);
    expect(state.status).toBe("active");
    expect(state.winnerId).toBeNull();
    expect(state.events).toEqual([
      { kind: "initialized", seed: 42, phase: "turn", playerCount: 2 },
    ]);
    expect(state.genre).toMatchObject({
      maxTurns: 4,
      turn: 0,
      lastActionId: null,
    });
    expect(demoConfig.kernelType).toBe(TURN_TAKING_KERNEL_TYPE);
  });

  it("lists legal actions only for the active player", () => {
    const state = createInitialState(turnTakingAdapter, demoConfig, 7);
    expect(listLegalActions(turnTakingAdapter, state, 0, demoConfig)).toEqual([
      { type: "continue", label: "Continue" },
      { type: "focus", label: "Focus" },
    ]);
    expect(listLegalActions(turnTakingAdapter, state, 1, demoConfig)).toEqual([]);
  });

  it("does not mutate state when the action is illegal", () => {
    const state = createInitialState(turnTakingAdapter, demoConfig, 11);
    const beforeHash = hashPlayState(state);
    const beforeJson = JSON.stringify(state);

    const wrongSeat = applyAction(
      turnTakingAdapter,
      state,
      { type: "continue", playerId: 1 },
      demoConfig,
    );
    expect(wrongSeat.ok).toBe(false);
    if (wrongSeat.ok) throw new Error("expected fail");
    expect(wrongSeat.reason).toBe("not_active_player");
    expect(wrongSeat.state).toBe(state);
    expect(JSON.stringify(state)).toBe(beforeJson);
    expect(hashPlayState(state)).toBe(beforeHash);

    const unknown = applyAction(
      turnTakingAdapter,
      state,
      { type: "build-settlement", playerId: 0 },
      demoConfig,
    );
    expect(unknown.ok).toBe(false);
    if (unknown.ok) throw new Error("expected fail");
    expect(unknown.reason).toBe("illegal_action");
    expect(unknown.state).toBe(state);
    expect(JSON.stringify(state)).toBe(beforeJson);
  });

  it("applies legal actions, rotates seats, and ends on maxTurns", () => {
    let state = createInitialState(turnTakingAdapter, demoConfig, 3);
    const log: PlayAction[] = [
      { type: "continue", playerId: 0 },
      { type: "focus", playerId: 1 },
      { type: "focus", playerId: 0 },
      { type: "continue", playerId: 1 },
    ];
    for (const action of log) {
      const result = applyAction(turnTakingAdapter, state, action, demoConfig);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.reason);
      state = result.state;
    }
    expect(state.status).toBe("complete");
    expect(state.phase).toBe("ended");
    expect(state.genre.turn).toBe(4);
    expect(state.winnerId).toBeNull();
    expect(state.events.some((event) => event.kind === "ended")).toBe(true);
    expect(state.events.some((event) => event.kind === "phase_advanced")).toBe(
      true,
    );
  });

  it("replays the same seed + action log to an identical hash/state body", () => {
    const seed = 99;
    const actions: PlayAction[] = [
      { type: "continue", playerId: 0 },
      { type: "focus", playerId: 1 },
      { type: "continue", playerId: 0 },
      { type: "focus", playerId: 1 },
    ];
    const first = replay(turnTakingAdapter, demoConfig, seed, actions);
    const second = replay(turnTakingAdapter, demoConfig, seed, actions);
    expect(hashPlayState(first)).toBe(hashPlayState(second));
    expect(snapshotBody(first)).toEqual(snapshotBody(second));
    expect(first.status).toBe("complete");

    // Divergent seed must not collide on the same action log body.
    const otherSeed = replay(turnTakingAdapter, demoConfig, seed + 1, actions);
    expect(otherSeed.seed).toBe(seed + 1);
    expect(snapshotBody(otherSeed)).toEqual({
      ...snapshotBody(first),
      seed: seed + 1,
    });
  });

  it("supports pass + advancePhase end-condition hooks", () => {
    let state = createInitialState(turnTakingAdapter, passConfig, 5);
    expect(
      listLegalActions(turnTakingAdapter, state, 0, passConfig).map(
        (action) => action.type,
      ),
    ).toEqual(["continue", "pass"]);

    const passed = applyAction(
      turnTakingAdapter,
      state,
      { type: "pass", playerId: 0 },
      passConfig,
    );
    expect(passed.ok).toBe(true);
    if (!passed.ok) throw new Error(passed.reason);
    state = passed.state;
    expect(state.events.some((event) => event.kind === "pass")).toBe(true);
    expect(state.genre.passedSeats).toEqual([0]);
    expect(state.activePlayerId).toBe(1);

    // Finish remaining turns via continue, then advancePhase is a no-op once complete.
    for (const action of [
      { type: "continue", playerId: 1 },
      { type: "continue", playerId: 0 },
    ] as PlayAction[]) {
      const result = applyAction(turnTakingAdapter, state, action, passConfig);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.reason);
      state = result.state;
    }
    expect(state.status).toBe("complete");
    expect(state.phase).toBe("ended");

    const advanced = advancePhase(turnTakingAdapter, state, passConfig);
    expect(advanced.ok).toBe(false);
    if (advanced.ok) throw new Error("expected fail");
    expect(advanced.reason).toBe("game_complete");
    expect(advanced.state).toBe(state);
  });

  it("seeded RNG is deterministic across createSeededRng.at", () => {
    const rng = createSeededRng(42);
    const a = [rng.next(), rng.next(), rng.next()];
    const b = createSeededRng(42);
    expect([b.next(), b.next(), b.next()]).toEqual(a);
    expect(createSeededRng(42).at(2)).toBe(a[1]);
    expect(createSeededRng(42).at(3)).toBe(a[2]);
  });

  it("public config/state types do not require hex-island-only fields", () => {
    const requiredConfigKeys = [
      "kernelType",
      "playerCount",
      "phases",
      "adapter",
    ] as const;
    const sample: PlayKernelConfig = {
      kernelType: TURN_TAKING_KERNEL_TYPE,
      playerCount: 2,
      phases: [...TURN_TAKING_PHASES],
      adapter: { maxTurns: 2, actions: [{ id: "go", label: "Go" }] },
    };
    for (const key of requiredConfigKeys) {
      expect(sample).toHaveProperty(key);
    }
    for (const forbidden of PUBLIC_LAYER_FORBIDDEN_REQUIRED_KEYS) {
      expect(requiredConfigKeys).not.toContain(forbidden);
      expect(Object.keys(sample)).not.toContain(forbidden);
      expect(Object.keys(sample.adapter)).not.toContain(forbidden);
    }

    const state = createInitialState(turnTakingAdapter, sample, 1);
    const publicKeys = Object.keys(state);
    for (const forbidden of PUBLIC_LAYER_FORBIDDEN_REQUIRED_KEYS) {
      expect(publicKeys).not.toContain(forbidden);
    }
  });

  it("demo adapter kernelType stays inside the capability registry", () => {
    expect(Object.hasOwn(KERNEL_CAPABILITIES, TURN_TAKING_KERNEL_TYPE)).toBe(
      true,
    );
    expect(KERNEL_CAPABILITIES[TURN_TAKING_KERNEL_TYPE]).toEqual(["turn-budget"]);
  });

  it("rejects mismatched kernelType / invalid playerCount fail-closed at create", () => {
    expect(() =>
      createInitialState(
        turnTakingAdapter,
        { ...demoConfig, kernelType: "score-race-v1" },
        1,
      ),
    ).toThrow(/play_kernel_mismatch/);
    expect(() =>
      createInitialState(
        turnTakingAdapter,
        { ...demoConfig, playerCount: 0 },
        1,
      ),
    ).toThrow(/play_kernel_invalid_player_count/);
  });
});

describe("topology stubs (PR5/PR6 placeholders)", () => {
  it("exposes grid eight-direction stub without implementing Othello rules", () => {
    const grid = createGridTopologyStub(8, 8);
    expect(grid.kind).toBe("grid");
    expect(grid.rows).toBe(8);
    expect(grid.cols).toBe(8);
    expect(grid.directions).toEqual(GRID_EIGHT_DIRECTIONS);
    expect(grid.directions).toHaveLength(8);

    const none: TopologyStub = { kind: "none" };
    expect(none.kind).toBe("none");
  });
});
