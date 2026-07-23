import { describe, expect, it } from "vitest";
import {
  canPlaceWorker,
  createPlayableState,
  placeWorker,
  playBots,
  rollPunts,
  usePilot,
  type ManilaTargetId,
} from "./playable";

function humanTurn(state: ReturnType<typeof createPlayableState>, target: ManilaTargetId) {
  return playBots(placeWorker(state, "you", target));
}

describe("generated playable Manila voyage", () => {
  it("runs four placement rounds around three movement rounds", () => {
    let state = createPlayableState();
    state = humanTurn(state, "nutmeg");
    state = humanTurn(state, "port-a");
    expect(state.phase).toBe("movement");
    expect(state.placementRound).toBe(2);

    state = rollPunts(state, { nutmeg: 4, silk: 3, ginseng: 2 });
    expect(state.phase).toBe("placement");
    expect(state.placementRound).toBe(3);
    state = humanTurn(state, "yard-a");
    state = rollPunts(state, { nutmeg: 4, silk: 3, ginseng: 2 });
    expect(state.placementRound).toBe(4);
    state = humanTurn(state, "pilot-large");
    expect(state.phase).toBe("pilot");
    state = usePilot(state, "ginseng", 1);
    state = rollPunts(state, { nutmeg: 4, silk: 3, ginseng: 2 });

    expect(state.phase).toBe("resolved");
    expect(state.placements).toHaveLength(12);
    expect(state.movementRound).toBe(3);
    expect(state.winnerId).toBeTruthy();
  });

  it("enforces turn ownership, capacity, and affordability", () => {
    const state = createPlayableState();
    expect(canPlaceWorker(state, "you", "nutmeg")).toBe(true);
    expect(canPlaceWorker(state, "bot-green", "nutmeg")).toBe(false);
    const after = humanTurn(state, "insurance");
    expect(after.players.find((player) => player.id === "you")?.cash).toBe(40);
    expect(canPlaceWorker(after, "you", "insurance")).toBe(false);
  });

  it("rejects impossible die values", () => {
    let state = createPlayableState();
    state = humanTurn(state, "nutmeg");
    state = humanTurn(state, "port-a");
    const rejected = rollPunts(state, { nutmeg: 5, silk: 1, ginseng: 1 });
    expect(rejected).toBe(state);
  });
});
