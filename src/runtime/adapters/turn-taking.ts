/**
 * Thin demonstration adapter: existing turn-taking-v1 kernel behind the
 * public play-kernel contract. No genre visuals; no hex/resources/dice.
 * Semantics match worker/runtime.ts turn-taking-v1 (maxTurns budget, seat
 * rotation, no winner).
 */

import type {
  LegalAction,
  PlayAction,
  PlayKernelAdapter,
  PlayKernelConfig,
  PlayPhaseId,
  PlayState,
} from "../play-kernel";

export const TURN_TAKING_KERNEL_TYPE = "turn-taking-v1" as const;

export const TURN_TAKING_PHASES = [
  { id: "turn", name: "Turn" },
  { id: "ended", name: "Ended" },
] as const;

export type TurnTakingActionDef = { id: string; label: string };

type TurnTakingConfig = {
  maxTurns: number;
  actions: TurnTakingActionDef[];
  /** When true, active player may pass (hook for forced-pass genres). */
  allowPass?: boolean;
};

export type TurnTakingGenre = {
  maxTurns: number;
  turn: number;
  actions: TurnTakingActionDef[];
  allowPass: boolean;
  lastActionId: string | null;
  passedSeats: number[];
};

function isActionDef(value: unknown): value is TurnTakingActionDef {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.label === "string";
}

function parseTurnTakingConfig(
  raw: Record<string, unknown>,
): TurnTakingConfig | null {
  const maxTurns = raw.maxTurns;
  const actions = raw.actions;
  if (
    !Number.isInteger(maxTurns) ||
    (maxTurns as number) < 1 ||
    !Array.isArray(actions) ||
    actions.length < 1 ||
    !actions.every(isActionDef)
  ) {
    return null;
  }
  return {
    maxTurns: maxTurns as number,
    actions: actions as TurnTakingActionDef[],
    allowPass: raw.allowPass === true,
  };
}

export function createTurnTakingKernelConfig(input: {
  playerCount: number;
  maxTurns: number;
  actions: TurnTakingActionDef[];
  allowPass?: boolean;
}): PlayKernelConfig {
  return {
    kernelType: TURN_TAKING_KERNEL_TYPE,
    playerCount: input.playerCount,
    phases: TURN_TAKING_PHASES.map((phase) => ({ ...phase })),
    adapter: {
      maxTurns: input.maxTurns,
      actions: input.actions,
      ...(input.allowPass ? { allowPass: true } : {}),
    },
  };
}

export const turnTakingAdapter: PlayKernelAdapter<
  TurnTakingGenre,
  TurnTakingConfig
> = {
  kernelType: TURN_TAKING_KERNEL_TYPE,

  parseConfig: parseTurnTakingConfig,

  createGenreState(config, _seed, _playerCount) {
    return {
      maxTurns: config.maxTurns,
      turn: 0,
      actions: config.actions.map((action) => ({ ...action })),
      allowPass: config.allowPass === true,
      lastActionId: null,
      passedSeats: [],
    };
  },

  initialPhase(): PlayPhaseId {
    return "turn";
  },

  listLegalActions(state, playerId, _config) {
    if (state.status !== "active" || playerId !== state.activePlayerId) {
      return [];
    }
    const legal: LegalAction[] = state.genre.actions.map((action) => ({
      type: action.id,
      label: action.label,
    }));
    if (state.genre.allowPass) {
      legal.push({ type: "pass", label: "Pass" });
    }
    return legal;
  },

  reduce(state, action, _config) {
    if (state.status !== "active" || action.playerId !== state.activePlayerId) {
      return null;
    }
    const isPass = action.type === "pass";
    const defined = state.genre.actions.find((entry) => entry.id === action.type);
    if (!isPass && !defined) return null;
    if (isPass && !state.genre.allowPass) return null;

    const turn = state.genre.turn + 1;
    const complete = turn >= state.genre.maxTurns;
    const phase: PlayPhaseId = complete ? "ended" : "turn";
    const nextSeat = complete
      ? action.playerId
      : (action.playerId + 1) % state.playerCount;
    const passedSeats = isPass
      ? [...state.genre.passedSeats, action.playerId]
      : state.genre.passedSeats;

    return {
      genre: {
        ...state.genre,
        turn,
        lastActionId: action.type,
        passedSeats,
      },
      phase,
      activePlayerId: nextSeat,
      status: complete ? "complete" : "active",
      winnerId: null,
      passed: isPass,
      endReason: complete ? "max_turns" : undefined,
    };
  },

  advancePhase(state, _config) {
    // Explicit end when turn budget already exhausted but status still active
    // (defensive hook; reduce normally ends the game itself).
    if (state.status !== "active") return null;
    if (state.genre.turn < state.genre.maxTurns) return null;
    return {
      genre: state.genre,
      phase: "ended",
      activePlayerId: state.activePlayerId,
      status: "complete",
      winnerId: null,
      endReason: "max_turns",
    };
  },
};

/** Map public play state → existing SessionState turnTaking slice. */
export function turnTakingToSessionFields(state: PlayState<TurnTakingGenre>): {
  turn: number;
  activeSeat: number;
  status: "active" | "complete";
  winnerSeat: null;
  turnTaking: { maxTurns: number };
} {
  return {
    turn: state.genre.turn,
    activeSeat: state.activePlayerId,
    status: state.status,
    winnerSeat: null,
    turnTaking: { maxTurns: state.genre.maxTurns },
  };
}

export function playActionFromIntent(
  seat: number,
  actionId: string,
  payload?: Record<string, unknown>,
): PlayAction {
  return {
    type: actionId,
    playerId: seat,
    ...(payload ? { payload } : {}),
  };
}
