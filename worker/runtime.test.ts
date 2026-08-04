import { describe, expect, it } from "vitest";
import type { GameDefinition } from "../src/creator/project-contract";
import {
  acceptIntent,
  executableRuntime,
  initialTableState,
  runBotSimulation,
} from "./runtime";

const definition: GameDefinition = {
  id: "definition_test",
  version: 1,
  name: "确定性竞速",
  pitch: "先达到目标分。",
  playerCount: 3,
  durationMinutes: 15,
  rules: [],
  components: [],
  setup: [],
  actions: [],
  board: { layout: "", zones: [] },
  phases: [],
  scenarios: [],
  presentation: { theme: "test" },
  runtimeSupport: {
    status: "executable",
    unsupported: [],
    kernel: {
      type: "score-race-v1",
      victoryTarget: 6,
      maxTurns: 20,
      actions: [
        { id: "steady", label: "稳步推进", points: 1 },
        { id: "bold", label: "大胆推进", points: 2 },
      ],
    },
  },
};

const harborDefinition: GameDefinition = {
  ...definition,
  id: "definition_harbor",
  name: "港口十三号",
  runtimeSupport: {
    status: "executable",
    unsupported: ["多航次未覆盖"],
    kernel: { type: "harbor-voyage-v1", playerCount: 3 },
  },
};

describe("deterministic score-race runtime", () => {
  it("repeats the same accepted actions and terminal state for one seed", () => {
    expect(runBotSimulation(definition, 42)).toEqual(
      runBotSimulation(definition, 42),
    );
  });

  it("accepts only the active seat and leaves rejected state unchanged", () => {
    const runtime = executableRuntime(definition)!;
    const state = initialTableState(definition);
    expect(
      acceptIntent(
        state,
        runtime,
        { intentId: "wrong-seat", seat: 1, actionId: "steady" },
        1,
      ),
    ).toBeNull();
    expect(state).toEqual(initialTableState(definition));

    const accepted = acceptIntent(
      state,
      runtime,
      { intentId: "accepted", seat: 0, actionId: "bold" },
      1,
    );
    expect(accepted).toMatchObject({
      sequence: 1,
      seat: 0,
      actionId: "bold",
      state: { turn: 1, activeSeat: 1, scores: [2, 0, 0] },
    });
    expect(state).toEqual(initialTableState(definition));
  });
});

describe("harbor-voyage-v1 runtime", () => {
  it("repeats bot simulations for one seed", () => {
    expect(runBotSimulation(harborDefinition, 42)).toEqual(
      runBotSimulation(harborDefinition, 42),
    );
  });

  it("accepts placement then rejects wrong-seat placement", () => {
    const runtime = executableRuntime(harborDefinition)!;
    const state = initialTableState(harborDefinition, 42);
    expect(state.voyage?.phase).toBe("placement");
    const accepted = acceptIntent(
      state,
      runtime,
      { intentId: "p1", seat: 0, actionId: "place:cedar" },
      1,
      42,
    );
    expect(accepted?.state.voyage?.placements).toHaveLength(1);
    expect(accepted?.state.activeSeat).toBe(1);
    expect(
      acceptIntent(
        accepted!.state,
        runtime,
        { intentId: "bad", seat: 0, actionId: "place:amber" },
        2,
        42,
      ),
    ).toBeNull();
  });

  it("reconstructs the same voyage from canonical roll action ids", () => {
    const runtime = executableRuntime(harborDefinition)!;
    const first = runBotSimulation(harborDefinition, 7);
    let state = initialTableState(harborDefinition, 7);
    for (const logged of first.acceptedActions) {
      const accepted = acceptIntent(
        state,
        runtime,
        {
          intentId: logged.intentId,
          seat: logged.seat,
          actionId: logged.actionId,
        },
        logged.sequence,
        7,
      );
      expect(accepted).not.toBeNull();
      state = accepted!.state;
    }
    expect(state).toEqual(first.finalState);
  });

  it("finishes a full bot voyage", () => {
    const result = runBotSimulation(harborDefinition, 99);
    expect(result.finalState.status).toBe("complete");
    expect(result.finalState.voyage?.phase).toBe("resolved");
    expect(result.finalState.winnerSeat).not.toBeNull();
    expect(result.acceptedActions.length).toBeGreaterThan(10);
  });
});
