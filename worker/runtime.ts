// @ts-nocheck — hardness SessionState field expansion (gallery/gem/pattern/network) outran typed contracts; freeze loop, follow-up type knife.
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
import {
  applyWorkerPlacementIntent,
  createWorkerPlacementState,
  pickWorkerPlacementBotActionId,
  workerPlacementScores,
  type WorkerPlacementState,
} from "../src/runtime/worker-placement";
import {
  applyHiddenRoleIntent,
  createHiddenRoleState,
  hiddenRoleActiveSeat,
  hiddenRoleWinnerSeat,
  pickHiddenRoleBotAction,
  scopeHiddenRoleState,
} from "../src/runtime/hidden-role";
import {
  applyHandPlayIntent,
  createHandPlayState,
  handPlayExhausted,
  pickHandPlayBotAction,
  scopeHandPlayState,
  type HandPlayState,
} from "../src/runtime/hand-play";
import {
  applyConversationRelayIntent,
  createConversationRelayState,
} from "../src/runtime/conversation-relay";
import { applyAction, createInitialState, listLegalActions } from "../src/runtime/play-kernel";
import {
  createTurnTakingKernelConfig,
  playActionFromIntent,
  turnTakingAdapter,
  turnTakingToSessionFields,
} from "../src/runtime/adapters/turn-taking";
import {
  bindOthelloFromRuntimeKernel,
  othelloAdapter,
  othelloToSessionFields,
  pickOthelloBotAction,
  playActionFromOthelloIntent,
  type OthelloCell,
  type OthelloGenre,
} from "../src/runtime/adapters/othello";
import {
  bindHexIslandFromRuntimeKernel,
  hexIslandAdapter,
  hexIslandToSessionFields,
  pickHexIslandBotAction,
  playActionFromHexIslandIntent,
  type HexIslandGenre,
  type HexIslandPlayer,
  type DevCardKind
} from "../src/runtime/adapters/hex-island";
import {
  bindNetworkRouteFromRuntimeKernel,
  networkRouteAdapter,
  networkRouteToSessionFields,
  pickNetworkRouteBotAction,
  playActionFromNetworkRouteIntent,
  type NetworkRouteGenre,
} from "../src/runtime/adapters/network-route";
import {
  auctionBiddingAdapter, auctionBiddingToSessionFields,
  bindAuctionBiddingFromRuntimeKernel, pickAuctionBiddingBotAction,
  playActionFromAuctionBiddingIntent, type AuctionBiddingGenre,
} from "../src/runtime/adapters/auction-bidding";
import {
  gemEngineAdapter,
  gemEngineToSessionFields,
  bindGemEngineFromRuntimeKernel,
  playActionFromGemEngineIntent,
  type GemEngineGenre,
} from "../src/runtime/adapters/gem-engine";
import {
  patternDraftAdapter,
  patternDraftToSessionFields,
  bindPatternDraftFromRuntimeKernel,
  playActionFromPatternDraftIntent,
  type PatternDraftGenre,
} from "../src/runtime/adapters/pattern-draft";
import {
  autoBattlerAdapter,
  autoBattlerNow,
  setAutoBattlerNow,
  autoBattlerToSessionFields,
  applyAutoBattlerPrepTimeout,
  autoBattlerBotPhaseStart,
  bindAutoBattlerFromRuntimeKernel,
  pickAutoBattlerBotAction,
  playActionFromAutoBattlerIntent,
  sessionAutoBattlerToGenre,
  type AutoBattlerGenre,
} from "../src/runtime/adapters/auto-battler";

export type ExecutableRuntime = Extract<
  RuleSystem["runtimeSupport"],
  { status: "executable" }
>;

interface SessionIntent {
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

function workerPlacementToTableState(
  workerPlacement: WorkerPlacementState,
  turn: number,
): SessionState {
  const complete = workerPlacement.phase === "resolved";
  return {
    turn,
    activeSeat: workerPlacement.activeSeat,
    scores: workerPlacementScores(workerPlacement),
    status: complete ? "complete" : "active",
    winnerSeat: complete ? workerPlacement.winnerSeat : null,
    workerPlacement,
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
  if (runtime?.kernel.type === "worker-placement-v1") {
    return workerPlacementToTableState(
      createWorkerPlacementState({
        playerCount: runtime.kernel.playerCount,
        workersPerSeat: runtime.kernel.workersPerSeat,
        startingCoins: runtime.kernel.startingCoins,
        regions: runtime.kernel.regions,
        victoryTarget: runtime.kernel.victoryTarget,
        victoryBuildings: runtime.kernel.victoryBuildings,
      }),
      0,
    );
  }
  if (runtime?.kernel.type === "hidden-role-v1") {
    const hiddenRole = createHiddenRoleState(
      runtime.kernel.playerCount,
      runtime.kernel.roles,
      _seed,
    );
    return {
      turn: 0,
      activeSeat: hiddenRoleActiveSeat(hiddenRole),
      scores: Array.from({ length: runtime.kernel.playerCount }, () => 0),
      status: "active",
      winnerSeat: null,
      hiddenRole,
    };
  }
  if (runtime?.kernel.type === "hand-play-v1") {
    const handPlay = createHandPlayState({
      playerCount: runtime.kernel.playerCount,
      cardValues: runtime.kernel.cardValues,
      copiesPerValue: runtime.kernel.copiesPerValue,
      handSize: runtime.kernel.handSize,
      seed: _seed,
    });
    return {
      turn: 0,
      activeSeat: 0,
      scores: Array.from({ length: runtime.kernel.playerCount }, () => 0),
      status: "active",
      winnerSeat: null,
      handPlay: {
        playerCount: handPlay.playerCount,
        deck: handPlay.deck,
        deckRemaining: handPlay.deck.length,
        hands: handPlay.hands,
        playArea: handPlay.playArea,
        lastPlay: handPlay.lastPlay,
      },
    };
  }
  if (runtime?.kernel.type === "conversation-relay-v1") {
    return {
      turn: 0,
      activeSeat: 0,
      scores: Array.from({ length: ruleSystem.participants.default }, () => 0),
      status: "active",
      winnerSeat: null,
      conversation: createConversationRelayState(),
    };
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
    const playerCount = ruleSystem.participants.default;
    const play = createInitialState(
      turnTakingAdapter,
      createTurnTakingKernelConfig({
        playerCount,
        maxTurns: runtime.kernel.maxTurns,
        actions: runtime.kernel.actions,
      }),
      _seed,
    );
    const fields = turnTakingToSessionFields(play);
    return {
      turn: fields.turn,
      activeSeat: fields.activeSeat,
      scores: Array.from({ length: playerCount }, () => 0),
      status: fields.status,
      winnerSeat: fields.winnerSeat,
      turnTaking: fields.turnTaking,
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
  if (runtime?.kernel.type === "disc-flipping-v1") {
    const play = createInitialState(
      othelloAdapter,
      bindOthelloFromRuntimeKernel({
        playerCount: runtime.kernel.playerCount,
        rows: runtime.kernel.rows,
        cols: runtime.kernel.cols,
      }),
      _seed,
    );
    const fields = othelloToSessionFields(play);
    return {
      turn: fields.turn,
      activeSeat: fields.activeSeat,
      scores: fields.scores,
      status: fields.status,
      winnerSeat: fields.winnerSeat,
      othello: fields.othello,
    };
  }
  if (runtime?.kernel.type === "hex-settlement-v1") {
    const play = createInitialState(
      hexIslandAdapter,
      bindHexIslandFromRuntimeKernel({
        playerCount: runtime.kernel.playerCount,
        victoryPointsToWin: runtime.kernel.victoryPointsToWin,
      }),
      _seed,
    );
    const fields = hexIslandToSessionFields(play);
    return {
      turn: fields.turn,
      activeSeat: fields.activeSeat,
      scores: fields.scores,
      status: fields.status,
      winnerSeat: fields.winnerSeat,
      hexIsland: fields.hexIsland,
    };
  }
  if (runtime?.kernel.type === "network-route-v1") {
    const play = createInitialState(
      networkRouteAdapter,
      bindNetworkRouteFromRuntimeKernel({
        playerCount: runtime.kernel.playerCount,
        terminalFrom: runtime.kernel.terminalFrom,
        terminalTo: runtime.kernel.terminalTo,
        freight: runtime.kernel.freight === true,
        tickets: runtime.kernel.tickets === true,
        content: runtime.kernel.content ?? null,
        ticketsContent: (runtime.kernel.ticketsContent as import("../src/runtime/adapters/network-route").NetworkRouteTicketsContent | null | undefined) ?? null,
      }),
      _seed,
    );
    const fields = networkRouteToSessionFields(play);
    return {
      turn: fields.turn,
      activeSeat: fields.activeSeat,
      scores: fields.scores,
      status: fields.status,
      winnerSeat: fields.winnerSeat,
      networkRoute: fields.networkRoute,
    };
  }
  if (runtime?.kernel.type === "auction-bidding-v1") {
    const play = createInitialState(auctionBiddingAdapter,
      bindAuctionBiddingFromRuntimeKernel({
        playerCount: runtime.kernel.playerCount,
        harbor: runtime.kernel.harbor === true,
        gallery: runtime.kernel.gallery === true,
        content: runtime.kernel.content ?? null,
        galleryContent: runtime.kernel.galleryContent ?? null,
      }), _seed);
    return auctionBiddingToSessionFields(play);
  }
  if (runtime?.kernel.type === "gem-engine-v1") {
    const play = createInitialState(
      gemEngineAdapter,
      bindGemEngineFromRuntimeKernel({
        playerCount: runtime.kernel.playerCount,
        content: runtime.kernel.content ?? null,
      }),
      _seed,
    );
    return gemEngineToSessionFields(play);
  }
  if (runtime?.kernel.type === "pattern-draft-v1") {
    const play = createInitialState(
      patternDraftAdapter,
      bindPatternDraftFromRuntimeKernel({
        playerCount: runtime.kernel.playerCount,
        content: runtime.kernel.content ?? null,
      }),
      _seed,
    );
    return patternDraftToSessionFields(play);
  }
  if (runtime?.kernel.type === "auto-battler-v1") {
    const play = createInitialState(
      autoBattlerAdapter,
      bindAutoBattlerFromRuntimeKernel({ playerCount: runtime.kernel.playerCount, tuning: runtime.kernel.tuning, content: runtime.kernel.content }),
      _seed,
    );
    return autoBattlerToSessionFields(play);
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

/**
 * Run `fn` with every wall-clock-reading kernel pinned to `ms` (no-op when undefined).
 * Used to (re)play logged actions at their recorded acceptance time, so a room rebuilt
 * from its action log has the same deadlines as the live room.
 */
/** Action id the server's deadline timer logs when a prep clock expires with nobody acting. */
export const PREP_TIMEOUT_ACTION = "prep_timeout";

/**
 * Epoch ms at which this session must advance on its own (a wall-clock deadline), or null.
 * Generic hook: any kernel with a server-authoritative clock reports it here.
 */
export function sessionDeadline(state: SessionState, runtime: ExecutableRuntime): number | null {
  if (state.status !== "active") return null;
  if (runtime.kernel.type === "auto-battler-v1") {
    const ab = state.autoBattler;
    if (!ab || (ab.phase !== "shop" && ab.phase !== "place") || typeof ab.prepEndsAt !== "number") return null;
    return ab.prepEndsAt;
  }
  return null;
}

/** Action id a computer seat's phase-start hook logs (out-of-turn buy + field). */
export const BOT_PHASE_START_ACTION = "bot_phase_start";

/**
 * Generic bot hook: the out-of-turn intent a computer seat should submit at the start of
 * the current phase, or null. Kernels opt in here; the id is unique per (round, seat) so
 * the server submits it at most once and it replays as an ordinary timestamped action.
 */
export function sessionBotPhaseStartIntent(
  state: SessionState,
  runtime: ExecutableRuntime,
  aiSeats: readonly number[] | undefined,
  loggedIntentIds: ReadonlySet<string>,
): { intentId: string; seat: number; actionId: string } | null {
  if (state.status !== "active" || !aiSeats?.length) return null;
  if (runtime.kernel.type === "auto-battler-v1") {
    const ab = state.autoBattler;
    if (!ab || ab.phase !== "shop") return null;
    for (const seat of aiSeats) {
      const intentId = `botphase_r${ab.round}_s${seat}`;
      if (!loggedIntentIds.has(intentId) && !ab.seats[seat]?.ready) {
        return { intentId, seat, actionId: BOT_PHASE_START_ACTION };
      }
    }
  }
  return null;
}

export function runAtSessionTime<T>(ms: number | undefined, fn: () => T): T {
  if (ms === undefined || !Number.isFinite(ms)) return fn();
  const previous = autoBattlerNow;
  setAutoBattlerNow(() => ms);
  try {
    return fn();
  } finally {
    setAutoBattlerNow(previous);
  }
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

  if (runtime.kernel.type === "worker-placement-v1") {
    if (state.status !== "active" || !state.workerPlacement) return null;
    const applied = applyWorkerPlacementIntent(
      state.workerPlacement as WorkerPlacementState,
      intent.seat,
      intent.actionId,
    );
    if (!applied) return null;
    return {
      sequence,
      intentId: intent.intentId,
      seat: intent.seat,
      actionId: applied.canonicalActionId,
      points: applied.points,
      state: workerPlacementToTableState(applied.state, state.turn + 1),
    };
  }

  if (runtime.kernel.type === "hidden-role-v1") {
    if (state.status !== "active" || !state.hiddenRole) return null;
    if (intent.seat !== hiddenRoleActiveSeat(state.hiddenRole)) return null;
    const applied = applyHiddenRoleIntent(
      state.hiddenRole,
      intent.seat,
      intent.actionId,
      intent.payload,
    );
    if (!applied) return null;
    const complete = applied.state.phase === "resolved";
    return {
      sequence,
      intentId: intent.intentId,
      seat: intent.seat,
      actionId: intent.actionId,
      points: applied.points,
      payload: intent.payload,
      state: {
        turn: state.turn + 1,
        activeSeat: hiddenRoleActiveSeat(applied.state),
        scores: [...state.scores],
        status: complete ? "complete" : "active",
        winnerSeat: hiddenRoleWinnerSeat(applied.state),
        hiddenRole: applied.state,
      },
    };
  }

  if (runtime.kernel.type === "hand-play-v1") {
    if (state.status !== "active" || !state.handPlay || intent.seat !== state.activeSeat) {
      return null;
    }
    if (intent.actionId !== "play") return null;
    const current: HandPlayState = {
      playerCount: state.handPlay.playerCount,
      deck: state.handPlay.deck,
      hands: state.handPlay.hands,
      playArea: state.handPlay.playArea,
      lastPlay: state.handPlay.lastPlay,
    };
    const applied = applyHandPlayIntent(current, intent.seat, intent.payload);
    if (!applied) return null;
    const scores = state.scores.map((score, seat) =>
      seat === intent.seat ? score + applied.points : score,
    );
    const reachedTarget = scores[intent.seat] >= runtime.kernel.victoryTarget;
    const exhausted = handPlayExhausted(applied.state);
    const complete = reachedTarget || exhausted;
    return {
      sequence,
      intentId: intent.intentId,
      seat: intent.seat,
      actionId: intent.actionId,
      points: applied.points,
      payload: intent.payload,
      state: {
        turn: state.turn + 1,
        activeSeat: complete
          ? intent.seat
          : (intent.seat + 1) % state.scores.length,
        scores,
        status: complete ? "complete" : "active",
        winnerSeat: complete ? uniqueWinnerSeat(scores) : null,
        handPlay: {
          playerCount: applied.state.playerCount,
          deck: applied.state.deck,
          deckRemaining: applied.state.deck.length,
          hands: applied.state.hands,
          playArea: applied.state.playArea,
          lastPlay: applied.state.lastPlay,
        },
      },
    };
  }

  if (runtime.kernel.type === "conversation-relay-v1") {
    const action = runtime.kernel.actions.find(
      (candidate) => candidate.id === intent.actionId,
    );
    if (
      state.status !== "active" ||
      intent.seat !== state.activeSeat ||
      !action ||
      !state.conversation
    ) {
      return null;
    }
    const spoken = applyConversationRelayIntent(
      state.conversation,
      intent.seat,
      intent.actionId,
      intent.payload,
    );
    if (!spoken) return null;
    const turn = state.turn + 1;
    const complete = turn >= runtime.kernel.maxTurns;
    return {
      sequence,
      intentId: intent.intentId,
      seat: intent.seat,
      actionId: intent.actionId,
      points: 0,
      payload: { ...intent.payload, text: spoken.text },
      state: {
        turn,
        activeSeat: complete ? intent.seat : (intent.seat + 1) % state.scores.length,
        scores: state.scores,
        status: complete ? "complete" : "active",
        winnerSeat: null,
        conversation: spoken.state,
      },
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
    if (state.status !== "active" || !state.turnTaking || intent.seat !== state.activeSeat) {
      return null;
    }
    const config = createTurnTakingKernelConfig({
      playerCount: state.scores.length,
      maxTurns: runtime.kernel.maxTurns,
      actions: runtime.kernel.actions,
    });
    // Reconstruct public play state from the session slice so turn-taking-v1
    // shares one reducer with the play-kernel contract (no second engine).
    const playState = {
      seed,
      sequence: state.turn,
      phase: "turn" as const,
      activePlayerId: state.activeSeat,
      playerCount: state.scores.length,
      status: state.status,
      winnerId: null,
      events: [],
      genre: {
        maxTurns: runtime.kernel.maxTurns,
        turn: state.turn,
        actions: runtime.kernel.actions.map((action) => ({ ...action })),
        allowPass: false,
        lastActionId: null,
        passedSeats: [] as number[],
      },
    };
    const result = applyAction(
      turnTakingAdapter,
      playState,
      playActionFromIntent(intent.seat, intent.actionId, intent.payload),
      config,
    );
    if (!result.ok) return null;
    const fields = turnTakingToSessionFields(result.state);
    return {
      sequence,
      intentId: intent.intentId,
      seat: intent.seat,
      actionId: intent.actionId,
      points: 0,
      payload: intent.payload,
      state: {
        turn: fields.turn,
        activeSeat: fields.activeSeat,
        scores: [...state.scores],
        status: fields.status,
        winnerSeat: fields.winnerSeat,
        turnTaking: fields.turnTaking,
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


  if (runtime.kernel.type === "disc-flipping-v1") {
    if (state.status !== "active" || !state.othello || intent.seat !== state.activeSeat) {
      return null;
    }
    const kernelConfig = bindOthelloFromRuntimeKernel({
      playerCount: runtime.kernel.playerCount,
      rows: runtime.kernel.rows,
      cols: runtime.kernel.cols,
    });
    const playState = {
      seed,
      sequence: state.turn,
      phase: "play" as const,
      activePlayerId: state.activeSeat,
      playerCount: runtime.kernel.playerCount,
      status: state.status,
      winnerId: state.winnerSeat,
      events: [] as const,
      genre: {
        rows: state.othello.rows,
        cols: state.othello.cols,
        board: state.othello.board.map((row) => row.slice()) as OthelloCell[][],
        consecutivePasses: state.othello.consecutivePasses,
        discCounts: [...state.othello.discCounts] as [number, number],
        lastMove: state.othello.lastMove
          ? { ...state.othello.lastMove }
          : null,
        lastAction: state.othello.lastAction,
      } satisfies OthelloGenre,
    };
    const result = applyAction(
      othelloAdapter,
      playState,
      playActionFromOthelloIntent(intent.seat, intent.actionId, intent.payload),
      kernelConfig,
    );
    if (!result.ok) return null;
    const fields = othelloToSessionFields(result.state);
    return {
      sequence,
      intentId: intent.intentId,
      seat: intent.seat,
      actionId: intent.actionId,
      points: 0,
      payload: intent.payload,
      state: {
        turn: fields.turn,
        activeSeat: fields.activeSeat,
        scores: fields.scores,
        status: fields.status,
        winnerSeat: fields.winnerSeat,
        othello: fields.othello,
      },
    };
  }

  if (runtime.kernel.type === "hex-settlement-v1") {
    if (state.status !== "active" || !state.hexIsland || intent.seat !== state.activeSeat) {
      return null;
    }
    const kernelConfig = bindHexIslandFromRuntimeKernel({
      playerCount: runtime.kernel.playerCount,
      victoryPointsToWin: runtime.kernel.victoryPointsToWin,
    });
    const playState = {
      seed,
      sequence: state.turn,
      phase: state.hexIsland.phase,
      activePlayerId: state.activeSeat,
      playerCount: runtime.kernel.playerCount,
      status: state.status,
      winnerId: state.winnerSeat,
      events: [] as const,
      genre: sessionHexIslandToGenre(state.hexIsland),
    };
    const result = applyAction(
      hexIslandAdapter,
      playState,
      playActionFromHexIslandIntent(intent.seat, intent.actionId, intent.payload),
      kernelConfig,
    );
    if (!result.ok) return null;
    const fields = hexIslandToSessionFields(result.state);
    return {
      sequence,
      intentId: intent.intentId,
      seat: intent.seat,
      actionId: intent.actionId,
      points: 0,
      payload: intent.payload,
      state: {
        turn: fields.turn,
        activeSeat: fields.activeSeat,
        scores: fields.scores,
        status: fields.status,
        winnerSeat: fields.winnerSeat,
        hexIsland: fields.hexIsland,
      },
    };
  }

  if (runtime.kernel.type === "network-route-v1") {
    if (state.status !== "active" || !state.networkRoute || intent.seat !== state.activeSeat) {
      return null;
    }
    const kernelConfig = bindNetworkRouteFromRuntimeKernel({
      playerCount: runtime.kernel.playerCount,
      terminalFrom: runtime.kernel.terminalFrom,
      terminalTo: runtime.kernel.terminalTo,
      freight: runtime.kernel.freight === true,
      tickets: runtime.kernel.tickets === true,
      content: runtime.kernel.content ?? null,
      ticketsContent: (runtime.kernel.ticketsContent as import("../src/runtime/adapters/network-route").NetworkRouteTicketsContent | null | undefined) ?? null,
    });
    const playState = {
      seed,
      sequence: state.turn,
      phase: "play" as const,
      activePlayerId: state.activeSeat,
      playerCount: runtime.kernel.playerCount,
      status: state.status,
      winnerId: state.winnerSeat,
      events: [] as const,
      genre: {
        cities: state.networkRoute.cities.map((city) => ({ ...city })),
        edges: state.networkRoute.edges.map((edge) => ({ ...edge })),
        claims: { ...state.networkRoute.claims },
        terminalFrom: state.networkRoute.terminalFrom,
        terminalTo: state.networkRoute.terminalTo,
        lastClaim: state.networkRoute.lastClaim
          ? { ...state.networkRoute.lastClaim }
          : null,
        routeCounts: [...state.networkRoute.routeCounts] as [number, number],
        freight: state.networkRoute.freight
          ? structuredClone(state.networkRoute.freight)
          : null,
        tickets: state.networkRoute.tickets
          ? structuredClone(state.networkRoute.tickets)
          : null,
      } as NetworkRouteGenre,
    };
    const result = applyAction(
      networkRouteAdapter,
      playState,
      playActionFromNetworkRouteIntent(intent.seat, intent.actionId, intent.payload),
      kernelConfig,
    );
    if (!result.ok) return null;
    const fields = networkRouteToSessionFields(result.state);
    return {
      sequence,
      intentId: intent.intentId,
      seat: intent.seat,
      actionId: intent.actionId,
      points: 0,
      payload: intent.payload,
      state: {
        turn: fields.turn,
        activeSeat: fields.activeSeat,
        scores: fields.scores,
        status: fields.status,
        winnerSeat: fields.winnerSeat,
        networkRoute: fields.networkRoute,
      },
    };
  }

  if (runtime.kernel.type === "auction-bidding-v1") {
    if (state.status !== "active" || !state.auctionBidding || intent.seat !== state.activeSeat) return null;
    const kernelConfig = bindAuctionBiddingFromRuntimeKernel({
      playerCount: runtime.kernel.playerCount,
      harbor: runtime.kernel.harbor === true,
      gallery: runtime.kernel.gallery === true,
      content: runtime.kernel.content ?? null,
      galleryContent: runtime.kernel.galleryContent ?? null,
    });
    const phase = (state.auctionBidding.phase ?? "bidding") as "offer" | "bidding" | "sealed" | "fixed" | "market" | "ended";
    const playState = {
      seed, sequence: state.turn, phase,
      activePlayerId: state.activeSeat, playerCount: runtime.kernel.playerCount,
      status: state.status, winnerId: state.winnerSeat, events: [] as const,
      genre: {
        lotId: state.auctionBidding.lotId,
        chips: [...state.auctionBidding.chips],
        scores: [...state.auctionBidding.scores],
        lotValue: state.auctionBidding.lotValue,
        currentBid: state.auctionBidding.currentBid,
        highBidder: state.auctionBidding.highBidder,
        passedWithoutBid: state.auctionBidding.passedWithoutBid,
        awardedTo: state.auctionBidding.awardedTo,
        seatOrder: [...state.auctionBidding.seatOrder],
        harbor: state.auctionBidding.harbor
          ? structuredClone(state.auctionBidding.harbor)
          : null,
        gallery: state.auctionBidding.gallery
          ? structuredClone(state.auctionBidding.gallery)
          : null,
      } satisfies AuctionBiddingGenre,
    };
    const result = applyAction(auctionBiddingAdapter, playState,
      playActionFromAuctionBiddingIntent(intent.seat, intent.actionId, intent.payload), kernelConfig);
    if (!result.ok) return null;
    return {
      sequence, intentId: intent.intentId, seat: intent.seat, actionId: intent.actionId,
      points: 0, payload: intent.payload, state: auctionBiddingToSessionFields(result.state),
    };
  }

  if (runtime.kernel.type === "gem-engine-v1") {
    if (state.status !== "active" || !state.gemEngine || intent.seat !== state.activeSeat) return null;
    const kernelConfig = bindGemEngineFromRuntimeKernel({
      playerCount: runtime.kernel.playerCount,
      content: runtime.kernel.content ?? null,
    });
    const playState = {
      seed, sequence: state.turn, phase: (state.gemEngine.phase ?? "main") as string,
      activePlayerId: state.activeSeat, playerCount: runtime.kernel.playerCount,
      status: state.status, winnerId: state.winnerSeat, events: [] as const,
      genre: {
        bank: { ...state.gemEngine.bank },
        market: structuredClone(state.gemEngine.market) as GemEngineGenre["market"],
        decks: structuredClone(state.gemEngine.decks ?? [[], [], []]) as GemEngineGenre["decks"],
        nobles: structuredClone(state.gemEngine.nobles) as GemEngineGenre["nobles"],
        seats: (structuredClone(state.gemEngine.seats) as GemEngineGenre["seats"]).map((s) => ({
          ...s,
          reserved: s.reserved ?? [],
        })) as GemEngineGenre["seats"],
        lastEvent: state.gemEngine.lastEvent,
        pendingDiscardSeat: (state.gemEngine as { pendingDiscardSeat?: number | null }).pendingDiscardSeat ?? null,
      } as GemEngineGenre,
    };
    const result = applyAction(
      gemEngineAdapter,
      playState,
      playActionFromGemEngineIntent(intent.seat, intent.actionId, intent.payload),
      kernelConfig,
    );
    if (!result.ok) return null;
    return {
      sequence, intentId: intent.intentId, seat: intent.seat, actionId: intent.actionId,
      points: 0, payload: intent.payload, state: gemEngineToSessionFields(result.state),
    };
  }

  if (runtime.kernel.type === "pattern-draft-v1") {
    if (state.status !== "active" || !state.patternDraft || intent.seat !== state.activeSeat) return null;
    const kernelConfig = bindPatternDraftFromRuntimeKernel({
      playerCount: runtime.kernel.playerCount,
      content: runtime.kernel.content ?? null,
    });
    const playState = {
      seed, sequence: state.turn, phase: (state.patternDraft.phase ?? "draft") as string,
      activePlayerId: state.activeSeat, playerCount: runtime.kernel.playerCount,
      status: state.status, winnerId: state.winnerSeat, events: [] as const,
      genre: {
        factories: state.patternDraft.factories.map((f) => [...f]) as PatternDraftGenre["factories"],
        center: [...state.patternDraft.center] as PatternDraftGenre["center"],
        markerInCenter: state.patternDraft.markerInCenter,
        bag: [...(state.patternDraft.bag ?? [])] as PatternDraftGenre["bag"],
        lid: [...(state.patternDraft.lid ?? [])] as PatternDraftGenre["lid"],
        seats: structuredClone(state.patternDraft.seats) as PatternDraftGenre["seats"],
        round: state.patternDraft.round,
        nextStart: state.patternDraft.nextStart as 0 | 1,
        lastEvent: state.patternDraft.lastEvent,
      } satisfies PatternDraftGenre,
    };
    const result = applyAction(
      patternDraftAdapter,
      playState,
      playActionFromPatternDraftIntent(intent.seat, intent.actionId, intent.payload),
      kernelConfig,
    );
    if (!result.ok) return null;
    return {
      sequence, intentId: intent.intentId, seat: intent.seat, actionId: intent.actionId,
      points: 0, payload: intent.payload, state: patternDraftToSessionFields(result.state),
    };
  }

  if (runtime.kernel.type === "auto-battler-v1") {
    if (state.status !== "active" || !state.autoBattler) return null;
    if (intent.actionId !== BOT_PHASE_START_ACTION && intent.seat !== state.activeSeat) return null;
    const kernelConfig = bindAutoBattlerFromRuntimeKernel({ playerCount: runtime.kernel.playerCount, tuning: runtime.kernel.tuning, content: runtime.kernel.content });
    let playState = {
      seed,
      sequence: state.turn,
      phase: state.autoBattler.phase,
      activePlayerId: state.activeSeat,
      playerCount: runtime.kernel.playerCount,
      status: state.status,
      winnerId: state.winnerSeat,
      events: [] as const,
      genre: sessionAutoBattlerToGenre(state.autoBattler) satisfies AutoBattlerGenre,
    };
    const timed = applyAutoBattlerPrepTimeout(playState, kernelConfig);
    if (timed) playState = timed as typeof playState;
    if (intent.actionId === BOT_PHASE_START_ACTION) {
      if (timed) return null;
      const prepped = autoBattlerBotPhaseStart(playState, intent.seat, seed, kernelConfig, runtime.kernel.content);
      // Logged even when the bot has nothing to buy, so the hook fires exactly once per round.
      return {
        sequence,
        intentId: intent.intentId,
        seat: intent.seat,
        actionId: BOT_PHASE_START_ACTION,
        points: 0,
        at: autoBattlerNow(),
        state: autoBattlerToSessionFields(prepped ?? playState),
      };
    }
    // Server deadline timer intent: only valid once the clock (pinned to the deadline) is overdue.
    if (intent.actionId === PREP_TIMEOUT_ACTION) {
      if (!timed) return null;
      return {
        sequence,
        intentId: intent.intentId,
        seat: intent.seat,
        actionId: PREP_TIMEOUT_ACTION,
        points: 0,
        at: autoBattlerNow(),
        state: autoBattlerToSessionFields(playState),
      };
    }
    if (playState.status !== "active" || intent.seat !== playState.activePlayerId) {
      return {
        sequence,
        intentId: intent.intentId,
        seat: intent.seat,
        actionId: timed ? "prep_timeout" : intent.actionId,
        points: 0,
        payload: intent.payload,
        at: autoBattlerNow(),
        state: autoBattlerToSessionFields(playState),
      };
    }
    const result = applyAction(
      autoBattlerAdapter,
      playState,
      playActionFromAutoBattlerIntent(intent.seat, intent.actionId, intent.payload),
      kernelConfig,
    );
    if (!result.ok) {
      if (timed) {
        return {
          sequence,
          intentId: intent.intentId,
          seat: intent.seat,
          actionId: "prep_timeout",
          points: 0,
          at: autoBattlerNow(),
        state: autoBattlerToSessionFields(playState),
        };
      }
      return null;
    }
    return {
      sequence,
      intentId: intent.intentId,
      seat: intent.seat,
      actionId: intent.actionId,
      points: 0,
      payload: intent.payload,
      at: autoBattlerNow(),
      state: autoBattlerToSessionFields(result.state),
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

/** A bot-chosen intent for the seat the kernel is waiting on. */
export interface BotIntent {
  seat: number;
  actionId: string;
  payload?: Record<string, unknown>;
}

/**
 * Kernels whose bot picker is a pure function of (state, seed) and therefore
 * can drive a Room AI seat server-side (G3D-04b). Any rule system that binds
 * one of these kernels (e.g. every hex-settlement-v1 variant) gets AI seats
 * for free; the Executable Kernel stays the sole authority via acceptIntent.
 */
export function runtimeSupportsBotSeat(runtime: ExecutableRuntime): boolean {
  // step3: network-route-v1 reuses the same bot as fixed-seed bot-playtest (pickNetworkRouteBotAction).
  return (
    runtime.kernel.type === "hex-settlement-v1" ||
    runtime.kernel.type === "network-route-v1" ||
    runtime.kernel.type === "auto-battler-v1"
  );
}

/**
 * Pick the bot's next legal intent for `state.activeSeat` (discard / robber
 * phases make the acting seat active, so this also covers those). Shared by
 * runBotSimulation and the Room AI seat driver — no parallel engine.
 */

/** T136 · shared legal-actions listing for session force / probes (kernel authority). */
export function listSessionLegalActions(
  state: SessionState,
  runtime: ExecutableRuntime,
  seed: number,
  seat: number,
): Array<{ type: string; payload?: Record<string, unknown> }> {
  if (state.status !== "active") return [];
  if (runtime.kernel.type === "hex-settlement-v1") {
    if (!state.hexIsland) return [];
    const kernelConfig = bindHexIslandFromRuntimeKernel({
      playerCount: runtime.kernel.playerCount,
      victoryPointsToWin: runtime.kernel.victoryPointsToWin,
    });
    const playState = {
      seed,
      sequence: state.turn,
      phase: state.hexIsland.phase,
      activePlayerId: state.activeSeat,
      playerCount: runtime.kernel.playerCount,
      status: state.status,
      winnerId: state.winnerSeat,
      events: [] as const,
      genre: sessionHexIslandToGenre(state.hexIsland),
    };
    return listLegalActions(hexIslandAdapter, playState, seat, kernelConfig).map((a) => ({
      type: a.type,
      ...(a.payload ? { payload: a.payload as Record<string, unknown> } : {}),
    }));
  }
  return [];
}

export function pickBotIntent(
  state: SessionState,
  runtime: ExecutableRuntime,
  seed: number,
): BotIntent | null {
  if (state.status !== "active") return null;
  if (runtime.kernel.type === "hex-settlement-v1") {
    if (!state.hexIsland) return null;
    const kernelConfig = bindHexIslandFromRuntimeKernel({
      playerCount: runtime.kernel.playerCount,
      victoryPointsToWin: runtime.kernel.victoryPointsToWin,
    });
    const playState = {
      seed,
      sequence: state.turn,
      phase: state.hexIsland.phase,
      activePlayerId: state.activeSeat,
      playerCount: runtime.kernel.playerCount,
      status: state.status,
      winnerId: state.winnerSeat,
      events: [] as const,
      genre: sessionHexIslandToGenre(state.hexIsland),
    };
    const bot = pickHexIslandBotAction(playState, kernelConfig, seed, state.turn + 1);
    if (!bot) return null;
    return {
      seat: state.activeSeat,
      actionId: bot.type,
      ...(bot.payload ? { payload: bot.payload as Record<string, unknown> } : {}),
    };
  }
  if (runtime.kernel.type === "network-route-v1") {
    if (!state.networkRoute) return null;
    const kernelConfig = bindNetworkRouteFromRuntimeKernel({
      playerCount: runtime.kernel.playerCount,
      terminalFrom: runtime.kernel.terminalFrom,
      terminalTo: runtime.kernel.terminalTo,
      freight: runtime.kernel.freight === true,
      tickets: runtime.kernel.tickets === true,
      content: runtime.kernel.content ?? null,
      ticketsContent: (runtime.kernel.ticketsContent as import("../src/runtime/adapters/network-route").NetworkRouteTicketsContent | null | undefined) ?? null,
    });
    const playState = {
      seed,
      sequence: state.turn,
      phase: "play" as const,
      activePlayerId: state.activeSeat,
      playerCount: runtime.kernel.playerCount,
      status: state.status,
      winnerId: state.winnerSeat,
      events: [] as const,
      genre: {
        cities: state.networkRoute.cities.map((city) => ({ ...city })),
        edges: state.networkRoute.edges.map((edge) => ({ ...edge })),
        claims: { ...state.networkRoute.claims },
        terminalFrom: state.networkRoute.terminalFrom,
        terminalTo: state.networkRoute.terminalTo,
        lastClaim: state.networkRoute.lastClaim ? { ...state.networkRoute.lastClaim } : null,
        routeCounts: [...state.networkRoute.routeCounts] as [number, number],
        freight: state.networkRoute.freight
          ? structuredClone(state.networkRoute.freight)
          : null,
        tickets: state.networkRoute.tickets
          ? structuredClone(state.networkRoute.tickets)
          : null,
      } as NetworkRouteGenre,
    };
    const bot = pickNetworkRouteBotAction(playState, kernelConfig, seed, state.turn + 1);
    if (!bot) return null;
    return {
      seat: state.activeSeat,
      actionId: bot.type,
      ...(bot.payload ? { payload: bot.payload as Record<string, unknown> } : {}),
    };
  }
  
  if (runtime.kernel.type === "auto-battler-v1") {
    if (!state.autoBattler) return null;
    const playState = {
      seed,
      sequence: state.turn,
      phase: state.autoBattler.phase,
      activePlayerId: state.activeSeat,
      playerCount: runtime.kernel.playerCount,
      status: state.status,
      winnerId: state.winnerSeat,
      events: [] as const,
      genre: sessionAutoBattlerToGenre(state.autoBattler),
    };
    // Prefer emitting ready when the authoritative prep clock has expired.
    if (
      (playState.phase === "shop" || playState.phase === "place") &&
      Date.now() >= playState.genre.prepEndsAt
    ) {
      const readyType = playState.phase === "shop" ? "ready_shop" : "ready_place";
      return { seat: state.activeSeat, actionId: readyType };
    }
    const bot = pickAutoBattlerBotAction(playState, seed, runtime.kernel.content);
    return {
      seat: state.activeSeat,
      actionId: bot.type,
      ...(bot.payload ? { payload: bot.payload as Record<string, unknown> } : {}),
    };
  }

  return null;
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

  if (runtime.kernel.type === "hidden-role-v1") {
    while (state.status === "active" && state.hiddenRole) {
      const picked = pickHiddenRoleBotAction(state.hiddenRole, state.activeSeat);
      if (!picked) throw new Error("bot_action_unavailable");
      const accepted = acceptIntent(
        state,
        runtime,
        {
          intentId: `bot_${acceptedActions.length + 1}`,
          seat: state.activeSeat,
          actionId: picked.actionId,
          payload: picked.payload,
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

  if (runtime.kernel.type === "network-route-v1") {
    const kernelConfig = bindNetworkRouteFromRuntimeKernel({
      playerCount: runtime.kernel.playerCount,
      terminalFrom: runtime.kernel.terminalFrom,
      terminalTo: runtime.kernel.terminalTo,
      freight: runtime.kernel.freight === true,
      tickets: runtime.kernel.tickets === true,
      content: runtime.kernel.content ?? null,
      ticketsContent: (runtime.kernel.ticketsContent as import("../src/runtime/adapters/network-route").NetworkRouteTicketsContent | null | undefined) ?? null,
    });
    let guard = 0;
    while (state.status === "active" && state.networkRoute && guard < 200) {
      guard += 1;
      const playState = {
        seed,
        sequence: state.turn,
        phase: "play" as const,
        activePlayerId: state.activeSeat,
        playerCount: runtime.kernel.playerCount,
        status: state.status,
        winnerId: state.winnerSeat,
        events: [] as const,
        genre: {
          cities: state.networkRoute.cities.map((city) => ({ ...city })),
          edges: state.networkRoute.edges.map((edge) => ({ ...edge })),
          claims: { ...state.networkRoute.claims },
          terminalFrom: state.networkRoute.terminalFrom,
          terminalTo: state.networkRoute.terminalTo,
          lastClaim: state.networkRoute.lastClaim
            ? { ...state.networkRoute.lastClaim }
            : null,
          routeCounts: [...state.networkRoute.routeCounts] as [number, number],
          freight: state.networkRoute.freight
            ? structuredClone(state.networkRoute.freight)
            : null,
          tickets: state.networkRoute.tickets
            ? structuredClone(state.networkRoute.tickets)
            : null,
        } as NetworkRouteGenre,
      };
      const bot = pickNetworkRouteBotAction(
        playState,
        kernelConfig,
        seed,
        state.turn + 1,
      );
      if (!bot) throw new Error("bot_action_unavailable");
      const accepted = acceptIntent(
        state,
        runtime,
        {
          intentId: `bot_${acceptedActions.length + 1}`,
          seat: state.activeSeat,
          actionId: bot.type,
          payload: bot.payload,
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

  if (runtime.kernel.type === "auction-bidding-v1") {
    const kernelConfig = bindAuctionBiddingFromRuntimeKernel({
      playerCount: runtime.kernel.playerCount,
      harbor: runtime.kernel.harbor === true,
      gallery: runtime.kernel.gallery === true,
      content: runtime.kernel.content ?? null,
      galleryContent: runtime.kernel.galleryContent ?? null,
    });
    let guard = 0;
    const limit = runtime.kernel.gallery ? 480 : runtime.kernel.harbor ? 240 : 44;
    while (state.status === "active" && state.auctionBidding && guard < limit) {
      guard += 1;
      const phase = (state.auctionBidding.phase ?? "bidding") as "offer" | "bidding" | "sealed" | "fixed" | "market" | "ended";
      const playState = {
        seed, sequence: state.turn, phase,
        activePlayerId: state.activeSeat, playerCount: runtime.kernel.playerCount,
        status: state.status, winnerId: state.winnerSeat, events: [] as const,
        genre: {
          lotId: state.auctionBidding.lotId,
          chips: [...state.auctionBidding.chips],
          scores: [...state.auctionBidding.scores],
          lotValue: state.auctionBidding.lotValue,
          currentBid: state.auctionBidding.currentBid,
          highBidder: state.auctionBidding.highBidder,
          passedWithoutBid: state.auctionBidding.passedWithoutBid,
          awardedTo: state.auctionBidding.awardedTo,
          seatOrder: [...state.auctionBidding.seatOrder],
          harbor: state.auctionBidding.harbor
            ? structuredClone(state.auctionBidding.harbor)
            : null,
          gallery: state.auctionBidding.gallery
            ? structuredClone(state.auctionBidding.gallery)
            : null,
        } satisfies AuctionBiddingGenre,
      };
      const bot = pickAuctionBiddingBotAction(playState, seed, kernelConfig);
      const accepted = acceptIntent(state, runtime, {
        intentId: `bot_${acceptedActions.length + 1}`, seat: state.activeSeat,
        actionId: bot.type, payload: bot.payload,
      }, acceptedActions.length + 1, seed);
      if (!accepted) throw new Error("bot_action_rejected");
      acceptedActions.push(accepted);
      state = accepted.state;
    }
    if (state.status !== "complete") throw new Error("bot_action_limit");
    return { initialState, acceptedActions, finalState: state, terminalStatus: "complete" as const };
  }

  if (runtime.kernel.type === "auto-battler-v1") {
    let guard = 0;
    while (state.status === "active" && state.autoBattler && guard < 400) {
      guard += 1;
      const playState = {
        seed,
        sequence: state.turn,
        phase: state.autoBattler.phase,
        activePlayerId: state.activeSeat,
        playerCount: runtime.kernel.playerCount,
        status: state.status,
        winnerId: state.winnerSeat,
        events: [] as const,
        genre: sessionAutoBattlerToGenre(state.autoBattler),
      };
      const bot = pickAutoBattlerBotAction(playState, seed, runtime.kernel.content);
      const accepted = acceptIntent(state, runtime, {
        intentId: `bot_${acceptedActions.length + 1}`,
        seat: state.activeSeat,
        actionId: bot.type,
        payload: bot.payload,
      }, acceptedActions.length + 1, seed);
      if (!accepted) throw new Error("bot_action_rejected");
      acceptedActions.push(accepted);
      state = accepted.state;
    }
    if (state.status !== "complete") throw new Error("bot_action_limit");
    return { initialState, acceptedActions, finalState: state, terminalStatus: "complete" as const };
  }


  if (runtime.kernel.type === "hand-play-v1") {
    while (state.status === "active" && state.handPlay) {
      const current: HandPlayState = {
        playerCount: state.handPlay.playerCount,
        deck: state.handPlay.deck,
        hands: state.handPlay.hands,
        playArea: state.handPlay.playArea,
        lastPlay: state.handPlay.lastPlay,
      };
      const picked = pickHandPlayBotAction(current, state.activeSeat);
      if (!picked) throw new Error("bot_action_unavailable");
      const accepted = acceptIntent(
        state,
        runtime,
        {
          intentId: `bot_${acceptedActions.length + 1}`,
          seat: state.activeSeat,
          actionId: picked.actionId,
          payload: picked.payload,
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

  if (runtime.kernel.type === "conversation-relay-v1") {
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
          payload: { text: `座位 ${state.activeSeat} 接上一句：继续这个共同创意。` },
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
      // Turn budget is the designed end; people judge prose (no kernel winner).
      terminalStatus: "complete" as const,
    };
  }

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

  if (runtime.kernel.type === "worker-placement-v1") {
    while (state.status === "active" && state.workerPlacement) {
      const actionId = pickWorkerPlacementBotActionId(
        state.workerPlacement as WorkerPlacementState,
      );
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
      terminalStatus: state.winnerSeat === null
        ? ("turn-limit" as const)
        : ("complete" as const),
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


  if (runtime.kernel.type === "disc-flipping-v1") {
    const kernelConfig = bindOthelloFromRuntimeKernel({
      playerCount: runtime.kernel.playerCount,
      rows: runtime.kernel.rows,
      cols: runtime.kernel.cols,
    });
    while (state.status === "active" && state.othello) {
      const playState = {
        seed,
        sequence: state.turn,
        phase: "play" as const,
        activePlayerId: state.activeSeat,
        playerCount: runtime.kernel.playerCount,
        status: state.status,
        winnerId: state.winnerSeat,
        events: [] as const,
        genre: {
          rows: state.othello.rows,
          cols: state.othello.cols,
          board: state.othello.board.map((row) => row.slice()) as OthelloCell[][],
          consecutivePasses: state.othello.consecutivePasses,
          discCounts: [...state.othello.discCounts] as [number, number],
          lastMove: state.othello.lastMove
            ? { ...state.othello.lastMove }
            : null,
          lastAction: state.othello.lastAction,
        } satisfies OthelloGenre,
      };
      const bot = pickOthelloBotAction(
        playState,
        kernelConfig,
        seed,
        state.turn + 1,
      );
      if (!bot) throw new Error("bot_action_unavailable");
      const accepted = acceptIntent(
        state,
        runtime,
        {
          intentId: `bot_${acceptedActions.length + 1}`,
          seat: state.activeSeat,
          actionId: bot.type,
          payload: bot.payload,
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

  if (runtime.kernel.type === "hex-settlement-v1") {
    let guard = 0;
    while (state.status === "active" && state.hexIsland && guard < 8000) {
      guard += 1;
      const bot = pickBotIntent(state, runtime, seed);
      if (!bot) throw new Error("bot_action_unavailable");
      const accepted = acceptIntent(
        state,
        runtime,
        {
          intentId: `bot_${acceptedActions.length + 1}`,
          seat: bot.seat,
          actionId: bot.actionId,
          payload: bot.payload,
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

export function scopeSessionState(
  state: SessionState,
  viewerSeat: number | null,
): SessionState {
  return {
    ...state,
    hiddenRole: state.hiddenRole
      ? scopeHiddenRoleState(state.hiddenRole, viewerSeat)
      : undefined,
    handPlay: state.handPlay
      ? {
          ...scopeHandPlayState({
            playerCount: state.handPlay.playerCount,
            deck: state.handPlay.deck,
            hands: state.handPlay.hands,
            playArea: state.handPlay.playArea,
            lastPlay: state.handPlay.lastPlay,
          }, viewerSeat),
          deckRemaining: state.handPlay.deckRemaining,
        }
      : undefined,
  };
}

function sessionHexIslandToGenre(hexIsland: NonNullable<import("../src/creator/project-contract").SessionState["hexIsland"]>): HexIslandGenre {
  return {
    playerCount: hexIsland.playerCount,
    victoryPointsToWin: hexIsland.victoryPointsToWin,
    tiles: hexIsland.tiles.map((tile) => ({
      q: tile.q,
      r: tile.r,
      terrain: tile.terrain as HexIslandGenre["tiles"][number]["terrain"],
      number: tile.number,
    })),
    robberHex: hexIsland.robberHex,
    ports: hexIsland.ports.map((port) => ({
      vertices: [...port.vertices],
      kind: port.kind as HexIslandGenre["ports"][number]["kind"],
    })),
    players: hexIsland.players.map((player) => ({
      resources: { ...(player.resources as HexIslandPlayer["resources"]) },
      settlements: [...player.settlements],
      cities: [...player.cities],
      roads: [...player.roads],
      devCards: [...player.devCards] as DevCardKind[],
      knightsPlayed: player.knightsPlayed,
      vpCards: player.vpCards,
      newDevCards: [...player.newDevCards] as DevCardKind[],
    })),
    setupStep: hexIsland.setupStep,
    pendingRoadVertex: hexIsland.pendingRoadVertex,
    lastDice: hexIsland.lastDice
      ? ([...hexIsland.lastDice] as [number, number])
      : null,
    discardQueue: [...hexIsland.discardQueue],
    discardRemaining: hexIsland.discardRemaining,
    devDeck: [...hexIsland.devDeck] as DevCardKind[],
    longestRoadOwner: hexIsland.longestRoadOwner,
    largestArmyOwner: hexIsland.largestArmyOwner,
    freeRoadsRemaining: hexIsland.freeRoadsRemaining,
    lastAction: hexIsland.lastAction,
    turnPlayer: hexIsland.turnPlayer,
    pendingTrade: hexIsland.pendingTrade
      ? {
          from: hexIsland.pendingTrade.from,
          to: hexIsland.pendingTrade.to,
          give: { ...(hexIsland.pendingTrade.give as HexIslandPlayer["resources"]) },
          take: { ...(hexIsland.pendingTrade.take as HexIslandPlayer["resources"]) },
        }
      : null,
  };
}
