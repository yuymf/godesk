import type {
  AcceptedAction,
  GameDefinition,
  TableState,
} from "../src/creator/project-contract";

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

export function initialTableState(playerCount: number): TableState {
  return {
    turn: 0,
    activeSeat: 0,
    scores: Array.from({ length: playerCount }, () => 0),
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
): AcceptedAction | null {
  const action = runtime.kernel.actions.find(
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
  const reachedTarget = scores[intent.seat] >= runtime.kernel.victoryTarget;
  const reachedLimit = turn >= runtime.kernel.maxTurns;
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
  const initialState = initialTableState(definition.playerCount);
  const acceptedActions: AcceptedAction[] = [];
  let state = initialState;
  let random = seed >>> 0 || 1;
  while (state.status === "active") {
    random = nextRandom(random);
    const action =
      runtime.kernel.actions[random % runtime.kernel.actions.length];
    const accepted = acceptIntent(
      state,
      runtime,
      {
        intentId: `bot_${acceptedActions.length + 1}`,
        seat: state.activeSeat,
        actionId: action.id,
      },
      acceptedActions.length + 1,
    );
    if (!accepted) throw new Error("bot_action_rejected");
    acceptedActions.push(accepted);
    state = accepted.state;
  }
  const reachedTarget = state.scores.some(
    (score) => score >= runtime.kernel.victoryTarget,
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
