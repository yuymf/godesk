import { describe, expect, it } from "vitest";
import { executableHexIslandSpecFixture } from "../src/creator/fixtures/game-spec";
import {
  reconstructActions,
  slimAcceptedActionsForStorage,
} from "./project-operations";
import { runBotSimulation } from "./runtime";
import type { StoredPlayableBuild } from "./public-urls";

describe("slimAcceptedActionsForStorage", () => {
  it(
    "keeps seed-42 bot log under 1MB and reconstructs the same terminal state",
    () => {
    const rule = executableHexIslandSpecFixture();
    const simulation = runBotSimulation(rule, 42);
    expect(simulation.acceptedActions.length).toBeGreaterThan(100);

    const slim = slimAcceptedActionsForStorage(simulation.acceptedActions);
    for (const action of slim) {
      expect(action.state.hexSettlement).toBeUndefined();
      expect(action.state.othello).toBeUndefined();
      expect(action.actionId).toBeTruthy();
    }

    const slimBytes = new TextEncoder().encode(JSON.stringify(slim)).byteLength;
    // Full log was ~2.8MB; slim must stay under DO/SQLite blob comfort zone.
    expect(slimBytes).toBeLessThan(1_000_000);

    const build = {
      id: "build_slim",
      projectId: "proj_slim",
      ruleSystem: rule,
    } as StoredPlayableBuild;

    const rebuilt = reconstructActions(build, slim, 42);
    expect(rebuilt.state.status).toBe(simulation.finalState.status);
    expect(rebuilt.state.winnerSeat).toBe(simulation.finalState.winnerSeat);
    expect(rebuilt.state.scores).toEqual(simulation.finalState.scores);
    expect(rebuilt.state.turn).toBe(simulation.finalState.turn);
    expect(rebuilt.acceptedActions).toHaveLength(
      simulation.acceptedActions.length,
    );
  },
    60_000,
  );
});
