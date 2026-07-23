import { describe, expect, it } from "vitest";
import {
  applyAction,
  canPlace,
  createInitialState,
  replayActions,
  type GameAction,
  type PlayerId,
  type TargetId,
} from "./game";

function place(
  id: string,
  playerId: PlayerId,
  targetId: TargetId,
): GameAction {
  return { id, type: "place", playerId, targetId };
}

const placements: GameAction[] = [
  place("1", "you", "tea"),
  place("2", "bot-lime", "silk"),
  place("3", "bot-coral", "spice"),
  place("4", "you", "harbor"),
  place("5", "bot-lime", "shipyard"),
  place("6", "bot-coral", "pirates"),
  place("7", "you", "tea"),
  place("8", "bot-lime", "silk"),
  place("9", "bot-coral", "spice"),
];

describe("voyage engine", () => {
  it("accepts only the active player's affordable placement", () => {
    const initial = createInitialState();
    expect(canPlace(initial, "you", "tea")).toBe(true);
    expect(canPlace(initial, "bot-lime", "tea")).toBe(false);

    const ignored = applyAction(initial, place("bad", "bot-lime", "tea"));
    expect(ignored).toBe(initial);

    const next = applyAction(initial, place("ok", "you", "tea"));
    expect(next.players[0]).toMatchObject({ cash: 28, workers: 2 });
    expect(next.activePlayer).toBe("bot-lime");
    expect(next.placements).toHaveLength(1);
  });

  it("moves to sailing only after all nine workers are placed", () => {
    const state = replayActions(placements);
    expect(state.phase).toBe("sailing");
    expect(state.placements).toHaveLength(9);
    expect(state.players.every((player) => player.workers === 0)).toBe(true);
  });

  it("records deterministic dice and resolves port, shipyard, and pirate outcomes", () => {
    const actions: GameAction[] = [
      ...placements,
      { id: "r1", type: "roll", playerId: "you", values: [4, 4, 4] },
      { id: "r2", type: "roll", playerId: "you", values: [4, 3, 3] },
      { id: "r3", type: "roll", playerId: "you", values: [6, 5, 3] },
    ];
    const state = replayActions(actions);

    expect(state.phase).toBe("resolved");
    expect(state.results).toEqual({
      tea: "harbor",
      silk: "pirates",
      spice: "shipyard",
    });
    expect(state.log.some((entry) => entry.message.includes("本航次结算"))).toBe(
      true,
    );
  });

  it("reconstructs identical state from the accepted action log", () => {
    const once = replayActions(placements);
    const twice = placements.reduce(applyAction, createInitialState());
    expect(twice).toEqual(once);
  });

  it("rejects forged or impossible dice actions", () => {
    const sailing = replayActions(placements);
    const forged = applyAction(sailing, {
      id: "forged",
      type: "roll",
      playerId: "bot-lime",
      values: [6, 6, 6],
    });
    const impossible = applyAction(sailing, {
      id: "impossible",
      type: "roll",
      playerId: "you",
      values: [0, 7, 2],
    });
    expect(forged).toBe(sailing);
    expect(impossible).toBe(sailing);
  });
});
