import type {
  AcceptedAction,
  GameDefinition,
  TableState,
} from "../src/creator/project-contract";
import {
  applyHarborIntent,
  createHarborVoyageState,
  harborScores,
  pickHarborBotActionId,
  type HarborVoyageState,
} from "../src/runtime/harbor-voyage";

type ExecutableRuntime = Extract<
  GameDefinition["runtimeSupport"],
  { status: "executable" }
>;

export interface RoomIntent {
  intentId: string;
  seat: number;
  actionId: string;
}

export function executableRuntime(
  definition: GameDefinition,
): ExecutableRuntime | null {
  return definition.runtimeSupport.status === "executable"
    ? definition.runtimeSupport
    : null;
}

function voyageToTableState(
  voyage: HarborVoyageState,
  turn: number,
): TableState {
  const complete = voyage.phase === "resolved";
  return {
    turn,
    activeSeat: voyage.activeSeat,
    scores: harborScores(voyage),
    status: complete ? "complete" : "active",
    winnerSeat: complete ? voyage.winnerSeat : null,
    voyage,
  };
}

export function initialTableState(
  definition: GameDefinition,
  _seed = 42,
): TableState {
  const runtime = executableRuntime(definition);
  if (runtime?.kernel.type === "harbor-voyage-v1") {
    return voyageToTableState(
      createHarborVoyageState(runtime.kernel.playerCount),
      0,
    );
  }
  return {
    turn: 0,
    activeSeat: 0,
    scores: Array.from({ length: definition.playerCount }, () => 0),
    status: "active",
    winnerSeat: null,
  };
}

function winnerSeat(scores: number[]) {
  return scores.reduce(
    (winner, score, seat) => (score > scores[winner] ? seat : winner),
    0,
  );
}

export function acceptIntent(
  state: TableState,
  runtime: ExecutableRuntime,
  intent: RoomIntent,
  sequence: number,
  seed = 42,
): AcceptedAction | null {
  if (runtime.kernel.type === "harbor-voyage-v1") {
    if (state.status !== "active" || !state.voyage) return null;
    const applied = applyHarborIntent(
      state.voyage as HarborVoyageState,
      intent.seat,
      intent.actionId,
      seed,
      sequence,
    );
    if (!applied) return null;
    return {
      sequence,
      intentId: intent.intentId,
      seat: intent.seat,
      actionId: applied.canonicalActionId,
      points: applied.points,
      state: voyageToTableState(applied.state, state.turn + 1),
    };
  }

  const raceKernel = runtime.kernel;
  const action = raceKernel.actions.find(
    (candidate) => candidate.id === intent.actionId,
  );
  if (
    state.status !== "active" ||
    intent.seat !== state.activeSeat ||
    !action
  ) {
    return null;
  }
  const scores = [...state.scores];
  scores[intent.seat] += action.points;
  const turn = state.turn + 1;
  const reachedTarget = scores[intent.seat] >= raceKernel.victoryTarget;
  const reachedLimit = turn >= raceKernel.maxTurns;
  const complete = reachedTarget || reachedLimit;
  const nextState: TableState = {
    turn,
    activeSeat: complete ? intent.seat : (intent.seat + 1) % scores.length,
    scores,
    status: complete ? "complete" : "active",
    winnerSeat: complete
      ? reachedTarget
        ? intent.seat
        : winnerSeat(scores)
      : null,
  };
  return {
    sequence,
    intentId: intent.intentId,
    seat: intent.seat,
    actionId: action.id,
    points: action.points,
    state: nextState,
  };
}

function nextRandom(state: number) {
  let value = state | 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return value >>> 0;
}

export function runBotSimulation(
  definition: GameDefinition,
  seed: number,
) {
  const runtime = executableRuntime(definition);
  if (!runtime) throw new Error("runtime_not_executable");
  const initialState = initialTableState(definition, seed);
  const acceptedActions: AcceptedAction[] = [];
  let state = initialState;
  let random = seed >>> 0 || 1;

  if (runtime.kernel.type === "harbor-voyage-v1") {
    while (state.status === "active" && state.voyage) {
      const actionId = pickHarborBotActionId(state.voyage as HarborVoyageState);
      if (!actionId) throw new Error("bot_action_unavailable");
      const accepted = acceptIntent(
        state,
        runtime,
        {
          intentId: `bot_${acceptedActions.length + 1}`,
          seat: state.activeSeat,
          actionId,
        },
        acceptedActions.length + 1,
        seed,
      );
      if (!accepted) throw new Error("bot_action_rejected");
      acceptedActions.push(accepted);
      state = accepted.state;
    }
    return {
      initialState,
      acceptedActions,
      finalState: state,
      terminalStatus: "complete" as const,
    };
  }

  const raceKernel = runtime.kernel;
  while (state.status === "active") {
    random = nextRandom(random);
    const action =
      raceKernel.actions[random % raceKernel.actions.length];
    const accepted = acceptIntent(
      state,
      runtime,
      {
        intentId: `bot_${acceptedActions.length + 1}`,
        seat: state.activeSeat,
        actionId: action.id,
      },
      acceptedActions.length + 1,
      seed,
    );
    if (!accepted) throw new Error("bot_action_rejected");
    acceptedActions.push(accepted);
    state = accepted.state;
  }
  const reachedTarget = state.scores.some(
    (score) => score >= raceKernel.victoryTarget,
  );
  return {
    initialState,
    acceptedActions,
    finalState: state,
    terminalStatus: reachedTarget
      ? ("complete" as const)
      : ("turn-limit" as const),
  };
}
