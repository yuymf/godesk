import type {
  AcceptedAction,
  RuleSystem,
  SessionState,
} from "../src/creator/project-contract";
import {
  applyHarborIntent,
  createHarborVoyageState,
  harborScores,
  pickHarborBotActionId,
  type HarborVoyageState,
} from "../src/runtime/harbor-voyage";

type ExecutableRuntime = Extract<
  RuleSystem["runtimeSupport"],
  { status: "executable" }
>;

export interface SessionIntent {
  intentId: string;
  seat: number;
  actionId: string;
  payload?: Record<string, unknown>;
}

export function executableRuntime(
  ruleSystem: RuleSystem,
): ExecutableRuntime | null {
  return ruleSystem.runtimeSupport.status === "executable"
    ? ruleSystem.runtimeSupport
    : null;
}

function voyageToTableState(
  voyage: HarborVoyageState,
  turn: number,
): SessionState {
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

export function initialSessionState(
  ruleSystem: RuleSystem,
  _seed = 42,
): SessionState {
  const runtime = executableRuntime(ruleSystem);
  if (runtime?.kernel.type === "harbor-voyage-v1") {
    return voyageToTableState(
      createHarborVoyageState(runtime.kernel.playerCount),
      0,
    );
  }
  if (runtime?.kernel.type === "shared-goal-v1") {
    return {
      turn: 0,
      activeSeat: 0,
      scores: Array.from({ length: ruleSystem.participants.default }, () => 0),
      status: "active",
      winnerSeat: null,
      sharedGoal: {
        progress: 0,
        target: runtime.kernel.goalTarget,
      },
    };
  }
  if (runtime?.kernel.type === "turn-taking-v1") {
    return {
      turn: 0,
      activeSeat: 0,
      scores: Array.from({ length: ruleSystem.participants.default }, () => 0),
      status: "active",
      winnerSeat: null,
      turnTaking: {
        maxTurns: runtime.kernel.maxTurns,
      },
    };
  }
  if (runtime?.kernel.type === "take-away-v1") {
    return {
      turn: 0,
      activeSeat: 0,
      scores: Array.from({ length: ruleSystem.participants.default }, () => 0),
      status: "active",
      winnerSeat: null,
      takeAway: {
        initialPool: runtime.kernel.initialPool,
        remaining: runtime.kernel.initialPool,
      },
    };
  }
  if (runtime?.kernel.type === "roll-and-move-v1") {
    return {
      turn: 0,
      activeSeat: 0,
      scores: Array.from({ length: ruleSystem.participants.default }, () => 0),
      status: "active",
      winnerSeat: null,
      rollAndMove: {
        positions: Array.from({ length: ruleSystem.participants.default }, () => 0),
        targetPosition: runtime.kernel.targetPosition,
        lastRoll: null,
      },
    };
  }
  if (runtime?.kernel.type === "draw-and-score-v1") {
    const totalCards = runtime.kernel.cardValues.length * runtime.kernel.copiesPerValue;
    return {
      turn: 0,
      activeSeat: 0,
      scores: Array.from({ length: ruleSystem.participants.default }, () => 0),
      status: "active",
      winnerSeat: null,
      drawAndScore: {
        totalCards,
        remainingCards: totalCards,
        lastDraw: null,
      },
    };
  }
  if (runtime?.kernel.type === "push-your-luck-v1") {
    return {
      turn: 0,
      activeSeat: 0,
      scores: Array.from({ length: ruleSystem.participants.default }, () => 0),
      status: "active",
      winnerSeat: null,
      pushYourLuck: {
        turnScore: 0,
        dieSides: runtime.kernel.dieSides,
        bustFace: runtime.kernel.bustFace,
        lastRoll: null,
        maxActions: runtime.kernel.maxActions,
      },
    };
  }
  return {
    turn: 0,
    activeSeat: 0,
    scores: Array.from({ length: ruleSystem.participants.default }, () => 0),
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
  state: SessionState,
  runtime: ExecutableRuntime,
  intent: SessionIntent,
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

  if (runtime.kernel.type === "shared-goal-v1") {
    const action = runtime.kernel.actions.find(
      (candidate) => candidate.id === intent.actionId,
    );
    if (
      state.status !== "active" ||
      intent.seat !== state.activeSeat ||
      !action ||
      !state.sharedGoal
    ) {
      return null;
    }
    const progress = state.sharedGoal.progress + action.progress;
    const turn = state.turn + 1;
    const reachedTarget = progress >= runtime.kernel.goalTarget;
    const reachedLimit = turn >= runtime.kernel.maxTurns;
    const complete = reachedTarget || reachedLimit;
    const nextState: SessionState = {
      turn,
      activeSeat: complete ? intent.seat : (intent.seat + 1) % state.scores.length,
      scores: [...state.scores],
      status: complete ? "complete" : "active",
      winnerSeat: null,
      sharedGoal: {
        progress,
        target: runtime.kernel.goalTarget,
      },
    };
    return {
      sequence,
      intentId: intent.intentId,
      seat: intent.seat,
      actionId: action.id,
      points: action.progress,
      payload: intent.payload,
      state: nextState,
    };
  }

  if (runtime.kernel.type === "turn-taking-v1") {
    const action = runtime.kernel.actions.find(
      (candidate) => candidate.id === intent.actionId,
    );
    if (
      state.status !== "active" ||
      intent.seat !== state.activeSeat ||
      !action ||
      !state.turnTaking
    ) {
      return null;
    }
    const turn = state.turn + 1;
    const complete = turn >= runtime.kernel.maxTurns;
    return {
      sequence,
      intentId: intent.intentId,
      seat: intent.seat,
      actionId: action.id,
      points: 0,
      payload: intent.payload,
      state: {
        turn,
        activeSeat: complete ? intent.seat : (intent.seat + 1) % state.scores.length,
        scores: [...state.scores],
        status: complete ? "complete" : "active",
        winnerSeat: null,
        turnTaking: {
          maxTurns: runtime.kernel.maxTurns,
        },
      },
    };
  }

  if (runtime.kernel.type === "take-away-v1") {
    const action = runtime.kernel.actions.find(
      (candidate) => candidate.id === intent.actionId,
    );
    if (
      state.status !== "active" ||
      intent.seat !== state.activeSeat ||
      !action ||
      !state.takeAway ||
      action.take > state.takeAway.remaining
    ) {
      return null;
    }
    const remaining = state.takeAway.remaining - action.take;
    const complete = remaining === 0;
    return {
      sequence,
      intentId: intent.intentId,
      seat: intent.seat,
      actionId: action.id,
      points: action.take,
      payload: intent.payload,
      state: {
        turn: state.turn + 1,
        activeSeat: complete ? intent.seat : (intent.seat + 1) % state.scores.length,
        scores: [...state.scores],
        status: complete ? "complete" : "active",
        winnerSeat: complete ? intent.seat : null,
        takeAway: {
          initialPool: runtime.kernel.initialPool,
          remaining,
        },
      },
    };
  }

  if (runtime.kernel.type === "roll-and-move-v1") {
    const action = runtime.kernel.actions.find(
      (candidate) => candidate.id === intent.actionId,
    );
    if (
      state.status !== "active" ||
      intent.seat !== state.activeSeat ||
      !action ||
      !state.rollAndMove
    ) {
      return null;
    }
    const roll = randomAtSequence(seed, sequence) % runtime.kernel.dieSides + 1;
    const positions = [...state.rollAndMove.positions];
    positions[intent.seat] = Math.min(
      runtime.kernel.targetPosition,
      positions[intent.seat] + roll,
    );
    const turn = state.turn + 1;
    const reachedTarget = positions[intent.seat] >= runtime.kernel.targetPosition;
    const reachedLimit = turn >= runtime.kernel.maxTurns;
    const complete = reachedTarget || reachedLimit;
    return {
      sequence,
      intentId: intent.intentId,
      seat: intent.seat,
      actionId: action.id,
      points: roll,
      payload: intent.payload,
      state: {
        turn,
        activeSeat: complete ? intent.seat : (intent.seat + 1) % state.scores.length,
        scores: [...state.scores],
        status: complete ? "complete" : "active",
        winnerSeat: reachedTarget ? intent.seat : null,
        rollAndMove: {
          positions,
          targetPosition: runtime.kernel.targetPosition,
          lastRoll: roll,
        },
      },
    };
  }

  if (runtime.kernel.type === "draw-and-score-v1") {
    const action = runtime.kernel.actions.find(
      (candidate) => candidate.id === intent.actionId,
    );
    if (
      state.status !== "active" ||
      intent.seat !== state.activeSeat ||
      !action ||
      !state.drawAndScore ||
      state.drawAndScore.remainingCards < 1
    ) {
      return null;
    }
    const deck = shuffledDrawDeck(
      runtime.kernel.cardValues,
      runtime.kernel.copiesPerValue,
      seed,
    );
    const drawnValue = deck[state.turn];
    if (drawnValue === undefined) return null;
    const scores = [...state.scores];
    scores[intent.seat] += drawnValue;
    const turn = state.turn + 1;
    const remainingCards = deck.length - turn;
    const reachedTarget = scores[intent.seat] >= runtime.kernel.victoryTarget;
    const complete = reachedTarget || remainingCards === 0;
    return {
      sequence,
      intentId: intent.intentId,
      seat: intent.seat,
      actionId: action.id,
      points: drawnValue,
      payload: intent.payload,
      state: {
        turn,
        activeSeat: complete ? intent.seat : (intent.seat + 1) % scores.length,
        scores,
        status: complete ? "complete" : "active",
        winnerSeat: reachedTarget
          ? intent.seat
          : remainingCards === 0
            ? uniqueWinnerSeat(scores)
            : null,
        drawAndScore: {
          totalCards: deck.length,
          remainingCards,
          lastDraw: drawnValue,
        },
      },
    };
  }

  if (runtime.kernel.type === "push-your-luck-v1") {
    const action = runtime.kernel.actions.find(
      (candidate) => candidate.id === intent.actionId,
    );
    if (
      state.status !== "active" ||
      intent.seat !== state.activeSeat ||
      !action ||
      !state.pushYourLuck ||
      (action.id === "bank" && state.pushYourLuck.turnScore === 0)
    ) return null;
    const turn = state.turn + 1;
    const reachedLimit = turn >= runtime.kernel.maxActions;
    if (action.id === "roll") {
      const roll = randomAtSequence(seed, sequence) % runtime.kernel.dieSides + 1;
      const busted = roll === runtime.kernel.bustFace;
      return {
        sequence,
        intentId: intent.intentId,
        seat: intent.seat,
        actionId: action.id,
        points: roll,
        payload: intent.payload,
        state: {
          turn,
          activeSeat: reachedLimit || !busted
            ? intent.seat
            : (intent.seat + 1) % state.scores.length,
          scores: [...state.scores],
          status: reachedLimit ? "complete" : "active",
          winnerSeat: null,
          pushYourLuck: {
            turnScore: busted || reachedLimit ? 0 : state.pushYourLuck.turnScore + roll,
            dieSides: runtime.kernel.dieSides,
            bustFace: runtime.kernel.bustFace,
            lastRoll: roll,
            maxActions: runtime.kernel.maxActions,
          },
        },
      };
    }
    const scores = [...state.scores];
    const banked = state.pushYourLuck.turnScore;
    scores[intent.seat] += banked;
    const reachedTarget = scores[intent.seat] >= runtime.kernel.victoryTarget;
    const complete = reachedTarget || reachedLimit;
    return {
      sequence,
      intentId: intent.intentId,
      seat: intent.seat,
      actionId: action.id,
      points: banked,
      payload: intent.payload,
      state: {
        turn,
        activeSeat: complete ? intent.seat : (intent.seat + 1) % scores.length,
        scores,
        status: complete ? "complete" : "active",
        winnerSeat: reachedTarget ? intent.seat : null,
        pushYourLuck: {
          turnScore: 0,
          dieSides: runtime.kernel.dieSides,
          bustFace: runtime.kernel.bustFace,
          lastRoll: state.pushYourLuck.lastRoll,
          maxActions: runtime.kernel.maxActions,
        },
      },
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
  const nextState: SessionState = {
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
    payload: intent.payload,
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

function randomAtSequence(seed: number, sequence: number) {
  let random = seed >>> 0 || 1;
  for (let index = 0; index < sequence; index += 1) {
    random = nextRandom(random);
  }
  return random;
}

function shuffledDrawDeck(values: number[], copiesPerValue: number, seed: number) {
  const deck = values.flatMap((value) =>
    Array.from({ length: copiesPerValue }, () => value),
  );
  let random = seed >>> 0 || 1;
  for (let index = deck.length - 1; index > 0; index -= 1) {
    random = nextRandom(random);
    const swapIndex = random % (index + 1);
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }
  return deck;
}

function uniqueWinnerSeat(scores: number[]) {
  const highest = Math.max(...scores);
  const winners = scores
    .map((score, seat) => ({ score, seat }))
    .filter(({ score }) => score === highest);
  return winners.length === 1 ? winners[0].seat : null;
}

export function runBotSimulation(
  ruleSystem: RuleSystem,
  seed: number,
) {
  const runtime = executableRuntime(ruleSystem);
  if (!runtime) throw new Error("runtime_not_executable");
  const initialState = initialSessionState(ruleSystem, seed);
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

  if (runtime.kernel.type === "shared-goal-v1") {
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
      terminalStatus: state.sharedGoal &&
        state.sharedGoal.progress >= runtime.kernel.goalTarget
        ? ("complete" as const)
        : ("turn-limit" as const),
    };
  }

  if (runtime.kernel.type === "turn-taking-v1") {
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
      terminalStatus: "turn-limit" as const,
    };
  }

  if (runtime.kernel.type === "take-away-v1") {
    while (state.status === "active" && state.takeAway) {
      random = nextRandom(random);
      const legalActions = runtime.kernel.actions.filter(
        (action) => action.take <= state.takeAway!.remaining,
      );
      const action = legalActions[random % legalActions.length];
      if (!action) throw new Error("bot_action_unavailable");
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
    return {
      initialState,
      acceptedActions,
      finalState: state,
      terminalStatus: "complete" as const,
    };
  }

  if (runtime.kernel.type === "roll-and-move-v1") {
    while (state.status === "active") {
      const accepted = acceptIntent(
        state,
        runtime,
        {
          intentId: `bot_${acceptedActions.length + 1}`,
          seat: state.activeSeat,
          actionId: runtime.kernel.actions[0].id,
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
      terminalStatus: state.winnerSeat === null
        ? ("turn-limit" as const)
        : ("complete" as const),
    };
  }

  if (runtime.kernel.type === "draw-and-score-v1") {
    while (state.status === "active") {
      const accepted = acceptIntent(
        state,
        runtime,
        {
          intentId: `bot_${acceptedActions.length + 1}`,
          seat: state.activeSeat,
          actionId: runtime.kernel.actions[0].id,
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

  if (runtime.kernel.type === "push-your-luck-v1") {
    while (state.status === "active" && state.pushYourLuck) {
      const actionId = state.pushYourLuck.turnScore >= 8 ? "bank" : "roll";
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
      terminalStatus: state.winnerSeat === null
        ? ("turn-limit" as const)
        : ("complete" as const),
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
