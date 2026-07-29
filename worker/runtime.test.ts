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

describe("deterministic score-race runtime", () => {
  it("repeats the same accepted actions and terminal state for one seed", () => {
    expect(runBotSimulation(definition, 42)).toEqual(
      runBotSimulation(definition, 42),
    );
  });

  it("accepts only the active seat and leaves rejected state unchanged", () => {
    const runtime = executableRuntime(definition)!;
    const state = initialTableState(3);
    expect(
      acceptIntent(
        state,
        runtime,
        { intentId: "wrong-seat", seat: 1, actionId: "steady" },
        1,
      ),
    ).toBeNull();
    expect(state).toEqual(initialTableState(3));

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
    expect(state).toEqual(initialTableState(3));
  });
});
