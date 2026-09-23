import type { SessionState } from "./project-contract";

type HandPlayState = NonNullable<SessionState["handPlay"]>;
type HiddenRoleState = NonNullable<SessionState["hiddenRole"]>;

export type ReplayPrimarySurface =
  | { kind: "hand-play"; deckRemaining: number; playArea: HandPlayState["playArea"]; hands: Array<{ seat: number; cards: number[] }>; lastPlay: HandPlayState["lastPlay"] }
  | {
      kind: "hidden-role";
      phase: HiddenRoleState["phase"];
      transcript: HiddenRoleState["transcript"];
      accusations: HiddenRoleState["accusations"];
      /** Roles only when phase is resolved (Replay has no viewer seat). */
      roles: Array<{ seat: number; name: string; alignment: "culprit" | "town" }> | null;
      resolution: { condemnedSeat: number; winnerAlignment: "culprit" | "town" } | null;
    }
  | {
      kind: "conversation";
      transcript: NonNullable<SessionState["conversation"]>["transcript"];
    }
  | { kind: "shared-goal"; progress: number; target: number }
  | { kind: "take-away"; remaining: number; initialPool: number }
  | {
      kind: "roll-and-move";
      positions: number[];
      targetPosition: number;
      lastRoll: number | null;
    }
  | {
      kind: "draw-and-score";
      remainingCards: number;
      totalCards: number;
      lastDraw: number | null;
      scores: number[];
    }
  | {
      kind: "push-your-luck";
      turnScore: number;
      lastRoll: number | null;
      scores: number[];
    }
  | { kind: "turn-taking"; turn: number; maxTurns: number }
  | { kind: "score-grid"; scores: number[] };

/** Hand-play / hidden-role / conversation must not fall back to a pure score grid (W4-07). */
export function replayOmitsPrimaryScoreGrid(state: SessionState): boolean {
  return Boolean(
    state.handPlay ||
      state.hiddenRole ||
      state.conversation ||
      state.sharedGoal ||
      state.takeAway ||
      state.rollAndMove ||
      state.drawAndScore ||
      state.pushYourLuck ||
      state.turnTaking,
  );
}

export function hiddenRoleReplayRolesVisible(hiddenRole: HiddenRoleState): boolean {
  return hiddenRole.phase === "resolved";
}

export function replayPrimarySurface(state: SessionState): ReplayPrimarySurface {
  if (state.handPlay) {
    return {
      kind: "hand-play",
      deckRemaining: state.handPlay.deckRemaining,
      playArea: state.handPlay.playArea,
      hands: state.handPlay.hands.map((cards, seat) => ({ seat, cards })),
      lastPlay: state.handPlay.lastPlay,
    };
  }
  if (state.hiddenRole) {
    const rolesVisible = hiddenRoleReplayRolesVisible(state.hiddenRole);
    const condemned = state.hiddenRole.condemnedSeat;
    const winner = state.hiddenRole.winnerAlignment;
    return {
      kind: "hidden-role",
      phase: state.hiddenRole.phase,
      transcript: state.hiddenRole.transcript,
      accusations: state.hiddenRole.accusations,
      roles: rolesVisible
        ? state.hiddenRole.roles.map((role) => ({
            seat: role.seat,
            name: role.name,
            alignment: role.alignment,
          }))
        : null,
      resolution:
        rolesVisible && condemned !== null && winner
          ? { condemnedSeat: condemned, winnerAlignment: winner }
          : null,
    };
  }
  if (state.conversation) {
    return { kind: "conversation", transcript: state.conversation.transcript };
  }
  if (state.sharedGoal) {
    return {
      kind: "shared-goal",
      progress: state.sharedGoal.progress,
      target: state.sharedGoal.target,
    };
  }
  if (state.takeAway) {
    return {
      kind: "take-away",
      remaining: state.takeAway.remaining,
      initialPool: state.takeAway.initialPool,
    };
  }
  if (state.rollAndMove) {
    return {
      kind: "roll-and-move",
      positions: state.rollAndMove.positions,
      targetPosition: state.rollAndMove.targetPosition,
      lastRoll: state.rollAndMove.lastRoll,
    };
  }
  if (state.drawAndScore) {
    return {
      kind: "draw-and-score",
      remainingCards: state.drawAndScore.remainingCards,
      totalCards: state.drawAndScore.totalCards,
      lastDraw: state.drawAndScore.lastDraw,
      scores: state.scores,
    };
  }
  if (state.pushYourLuck) {
    return {
      kind: "push-your-luck",
      turnScore: state.pushYourLuck.turnScore,
      lastRoll: state.pushYourLuck.lastRoll,
      scores: state.scores,
    };
  }
  if (state.turnTaking) {
    return {
      kind: "turn-taking",
      turn: state.turn,
      maxTurns: state.turnTaking.maxTurns,
    };
  }
  return { kind: "score-grid", scores: state.scores };
}
