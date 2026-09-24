import { describe, expect, it } from "vitest";
import type { SessionState } from "./project-contract";
import {
  hiddenRoleReplayRolesVisible,
  replayOmitsPrimaryScoreGrid,
  replayPrimarySurface,
} from "./replay-presentation";

function baseState(overrides: Partial<SessionState> = {}): SessionState {
  return {
    turn: 3,
    activeSeat: 1,
    scores: [4, 7, 2],
    status: "active",
    winnerSeat: null,
    ...overrides,
  };
}

describe("replayPrimarySurface (W4-07)", () => {
  it("falls through to score-grid only for pure score-track state", () => {
    expect(replayPrimarySurface(baseState())).toEqual({ kind: "score-grid", scores: [4, 7, 2] });
  });

  it("does not use score-grid when handPlay genre objects exist", () => {
    const state = baseState({
      handPlay: {
        playerCount: 2,
        deck: [3, 4],
        deckRemaining: 2,
        hands: [
          [1, 5],
          [2, 3],
        ],
        playArea: [
          { seat: 0, card: 4 },
          { seat: 1, card: 2 },
        ],
        lastPlay: { seat: 1, card: 2 },
      },
    });
    const surface = replayPrimarySurface(state);
    expect(surface.kind).toBe("hand-play");
    if (surface.kind !== "hand-play") return;
    expect(surface.deckRemaining).toBe(2);
    expect(surface.playArea).toEqual([
      { seat: 0, card: 4 },
      { seat: 1, card: 2 },
    ]);
    expect(surface.hands).toEqual([
      { seat: 0, cards: [1, 5] },
      { seat: 1, cards: [2, 3] },
    ]);
    expect(surface.lastPlay).toEqual({ seat: 1, card: 2 });
    // Scores stay secondary — not the primary surface.
    expect(replayOmitsPrimaryScoreGrid(state)).toBe(true);
  });

  it("does not use score-grid when hiddenRole genre objects exist", () => {
    const state = baseState({
      scores: [0, 0, 0],
      hiddenRole: {
        phase: "accuse",
        playerCount: 3,
        roles: [
          { seat: 0, roleId: "culprit", name: "凶手", alignment: "culprit" },
          { seat: 1, roleId: "detective", name: "侦探", alignment: "town" },
          { seat: 2, roleId: "civilian", name: "平民", alignment: "town" },
        ],
        spoken: [0, 1, 2],
        accused: [0],
        transcript: [
          { seat: 0, text: "我在书房。" },
          { seat: 1, text: "听到脚步声。" },
        ],
        accusations: [{ seat: 0, targetSeat: 2 }],
        condemnedSeat: null,
        winnerAlignment: null,
      },
    });
    const surface = replayPrimarySurface(state);
    expect(surface.kind).toBe("hidden-role");
    if (surface.kind !== "hidden-role") return;
    expect(surface.phase).toBe("accuse");
    expect(surface.transcript).toHaveLength(2);
    expect(surface.accusations).toEqual([{ seat: 0, targetSeat: 2 }]);
    // Mid-game: roles must not leak in Replay (no viewer seat).
    expect(surface.roles).toBeNull();
    expect(surface.resolution).toBeNull();
    expect(replayOmitsPrimaryScoreGrid(state)).toBe(true);
  });

  it("reveals roles and resolution only when hidden-role phase is resolved (W6-01 Room+Replay gate)", () => {
    const state = baseState({
      status: "complete",
      winnerSeat: 1,
      scores: [0, 0, 0],
      hiddenRole: {
        phase: "resolved",
        playerCount: 3,
        roles: [
          { seat: 0, roleId: "culprit", name: "凶手", alignment: "culprit" },
          { seat: 1, roleId: "detective", name: "侦探", alignment: "town" },
          { seat: 2, roleId: "civilian", name: "平民", alignment: "town" },
        ],
        spoken: [0, 1, 2],
        accused: [0, 1, 2],
        transcript: [{ seat: 0, text: "结案。" }],
        accusations: [
          { seat: 0, targetSeat: 0 },
          { seat: 1, targetSeat: 0 },
          { seat: 2, targetSeat: 0 },
        ],
        condemnedSeat: 0,
        winnerAlignment: "town",
      },
    });
    const surface = replayPrimarySurface(state);
    expect(surface.kind).toBe("hidden-role");
    if (surface.kind !== "hidden-role") return;
    expect(hiddenRoleReplayRolesVisible(state.hiddenRole!)).toBe(true);
    expect(surface.roles).toEqual([
      { seat: 0, name: "凶手", alignment: "culprit" },
      { seat: 1, name: "侦探", alignment: "town" },
      { seat: 2, name: "平民", alignment: "town" },
    ]);
    expect(surface.resolution).toEqual({
      condemnedSeat: 0,
      winnerAlignment: "town",
    });
  });

  it("keeps conversation as genre surface (not score-grid)", () => {
    const state = baseState({
      scores: [0, 0],
      conversation: {
        transcript: [{ seat: 0, actionId: "speak", text: "接一句" }],
      },
    });
    expect(replayPrimarySurface(state).kind).toBe("conversation");
    expect(replayOmitsPrimaryScoreGrid(state)).toBe(true);
  });
});
