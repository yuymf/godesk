import { describe, expect, it } from "vitest";
import type { RuleSystem } from "../src/creator/project-contract";
import {
  acceptIntent,
  executableRuntime,
  initialSessionState,
  runBotSimulation,
} from "./runtime";

const conversationRuleSystem: RuleSystem = {
  id: "rule_system_conversation",
  version: 1,
  name: "灵感接力",
  pitch: "用逐步增加的约束共同完成一个创意。",
  participants: {
    min: 2,
    max: 6,
    default: 3,
    roles: [],
  },
  durationMinutes: 12,
  rules: [],
  constraints: [],
  entities: [],
  setup: [],
  actions: [],
  stages: [{ id: "create", name: "创意接力" }],
  outcomes: [{ id: "target", name: "率先达到 6 分" }],
  playSurface: {
    kind: "conversation",
    layout: "prompt-and-response",
    regions: [],
  },
  presentation: { theme: "idea-relay" },
  runtimeSupport: {
    status: "executable",
    unsupported: [],
    kernel: {
      type: "score-race-v1",
      victoryTarget: 6,
      maxTurns: 20,
      actions: [
        { id: "extend", label: "扩展创意", points: 1 },
        { id: "twist", label: "加入约束", points: 2 },
      ],
    },
  },
};

const ruleSystem: RuleSystem = {
  id: "rule_system_test",
  version: 1,
  name: "确定性竞速",
  pitch: "先达到目标分。",
  participants: { min: 3, max: 3, default: 3, roles: [] },
  durationMinutes: 15,
  rules: [],
  constraints: [],
  entities: [],
  setup: [],
  actions: [],
  playSurface: { kind: "table", layout: "", regions: [] },
  stages: [],
  outcomes: [],
  presentation: { theme: "test" },
  runtimeSupport: {
    status: "executable",
    unsupported: [],
    kernel: {
      type: "score-race-v1",
      victoryTarget: 6,
      maxTurns: 20,
      actions: [
        { id: "steady", label: "稳步推进", points: 1 },
        { id: "bold", label: "大胆推进", points: 2 },
      ],
    },
  },
};

const harborRuleSystem: RuleSystem = {
  ...ruleSystem,
  id: "rule_system_harbor",
  name: "港口十三号",
  runtimeSupport: {
    status: "executable",
    unsupported: ["多航次未覆盖"],
    kernel: { type: "harbor-voyage-v1", playerCount: 3 },
  },
};

const sharedGoalRuleSystem: RuleSystem = {
  ...ruleSystem,
  id: "rule_system_shared_goal",
  name: "共享线索",
  pitch: "所有玩家共同推进一个目标。",
  runtimeSupport: {
    status: "executable",
    unsupported: [],
    kernel: {
      type: "shared-goal-v1",
      goalTarget: 5,
      maxTurns: 12,
      actions: [
        { id: "investigate", label: "调查线索", progress: 2 },
        { id: "organize", label: "整理线索", progress: 1 },
      ],
    },
  },
};

const turnTakingRuleSystem: RuleSystem = {
  ...ruleSystem,
  id: "rule_system_turn_taking",
  name: "灵感接力轮流版",
  pitch: "玩家轮流扩展共同创意或加入约束。",
  playSurface: { kind: "conversation", layout: "prompt-and-response", regions: [] },
  runtimeSupport: {
    status: "executable",
    unsupported: ["winner and score semantics are not specified"],
    kernel: {
      type: "turn-taking-v1",
      maxTurns: 4,
      actions: [
        { id: "extend", label: "扩展创意" },
        { id: "constrain", label: "加入约束" },
      ],
    },
  },
};

const takeAwayRuleSystem: RuleSystem = {
  ...ruleSystem,
  id: "rule_system_take_away",
  name: "十五枚石子",
  pitch: "轮流拿走一或两枚石子，拿到最后一枚者获胜。",
  runtimeSupport: {
    status: "executable",
    unsupported: [],
    kernel: {
      type: "take-away-v1",
      initialPool: 15,
      actions: [
        { id: "take-1", label: "拿走 1 枚", take: 1 },
        { id: "take-2", label: "拿走 2 枚", take: 2 },
      ],
    },
  },
};

const rollAndMoveRuleSystem: RuleSystem = {
  ...ruleSystem,
  id: "rule_system_roll_and_move",
  name: "二十格竞速",
  pitch: "轮流掷六面骰，先到二十格者获胜。",
  runtimeSupport: {
    status: "executable",
    unsupported: [],
    kernel: {
      type: "roll-and-move-v1",
      dieSides: 6,
      targetPosition: 20,
      maxTurns: 80,
      actions: [{ id: "roll-move", label: "掷骰前进" }],
    },
  },
};

const drawAndScoreRuleSystem: RuleSystem = {
  ...ruleSystem,
  id: "rule_system_draw_and_score",
  name: "抽牌竞分",
  pitch: "轮流从有限牌库抽牌计分。",
  participants: { ...ruleSystem.participants, default: 2 },
  runtimeSupport: {
    status: "executable",
    unsupported: [],
    kernel: {
      type: "draw-and-score-v1",
      cardValues: [1, 2, 3, 4, 5, 6],
      copiesPerValue: 2,
      victoryTarget: 15,
      actions: [{ id: "draw-score", label: "抽牌计分" }],
    },
  },
};

const pushYourLuckRuleSystem: RuleSystem = {
  ...ruleSystem,
  id: "rule_system_push_your_luck",
  name: "冒险押注",
  pitch: "继续掷骰累积未存分，或收手把它存入总分。",
  participants: { ...ruleSystem.participants, default: 2 },
  runtimeSupport: {
    status: "executable",
    unsupported: [],
    kernel: {
      type: "push-your-luck-v1",
      dieSides: 6,
      bustFace: 1,
      victoryTarget: 20,
      maxActions: 200,
      actions: [
        { id: "roll", label: "继续掷骰" },
        { id: "bank", label: "收手存分" },
      ],
    },
  },
};

describe("deterministic score-race runtime", () => {
  it("runs a conversation Rule System without board or component fields", () => {
    const state = initialSessionState(conversationRuleSystem);
    expect(state).toMatchObject({
      turn: 0,
      activeSeat: 0,
      scores: [0, 0, 0],
      status: "active",
    });
    expect(runBotSimulation(conversationRuleSystem, 42).finalState.status).toBe(
      "complete",
    );
  });

  it("repeats the same accepted actions and terminal state for one seed", () => {
    expect(runBotSimulation(ruleSystem, 42)).toEqual(
      runBotSimulation(ruleSystem, 42),
    );
  });

  it("accepts only the active seat and leaves rejected state unchanged", () => {
    const runtime = executableRuntime(ruleSystem)!;
    const state = initialSessionState(ruleSystem);
    expect(
      acceptIntent(
        state,
        runtime,
        { intentId: "wrong-seat", seat: 1, actionId: "steady" },
        1,
      ),
    ).toBeNull();
    expect(state).toEqual(initialSessionState(ruleSystem));

    const accepted = acceptIntent(
      state,
      runtime,
      { intentId: "accepted", seat: 0, actionId: "bold" },
      1,
    );
    expect(accepted).toMatchObject({
      sequence: 1,
      seat: 0,
      actionId: "bold",
      state: { turn: 1, activeSeat: 1, scores: [2, 0, 0] },
    });
    expect(state).toEqual(initialSessionState(ruleSystem));
  });
});

describe("harbor-voyage-v1 runtime", () => {
  it("repeats bot simulations for one seed", () => {
    expect(runBotSimulation(harborRuleSystem, 42)).toEqual(
      runBotSimulation(harborRuleSystem, 42),
    );
  });

  it("accepts placement then rejects wrong-seat placement", () => {
    const runtime = executableRuntime(harborRuleSystem)!;
    const state = initialSessionState(harborRuleSystem, 42);
    expect(state.voyage?.phase).toBe("placement");
    const accepted = acceptIntent(
      state,
      runtime,
      { intentId: "p1", seat: 0, actionId: "place:cedar" },
      1,
      42,
    );
    expect(accepted?.state.voyage?.placements).toHaveLength(1);
    expect(accepted?.state.activeSeat).toBe(1);
    expect(
      acceptIntent(
        accepted!.state,
        runtime,
        { intentId: "bad", seat: 0, actionId: "place:amber" },
        2,
        42,
      ),
    ).toBeNull();
  });

  it("reconstructs the same voyage from canonical roll action ids", () => {
    const runtime = executableRuntime(harborRuleSystem)!;
    const first = runBotSimulation(harborRuleSystem, 7);
    let state = initialSessionState(harborRuleSystem, 7);
    for (const logged of first.acceptedActions) {
      const accepted = acceptIntent(
        state,
        runtime,
        {
          intentId: logged.intentId,
          seat: logged.seat,
          actionId: logged.actionId,
        },
        logged.sequence,
        7,
      );
      expect(accepted).not.toBeNull();
      state = accepted!.state;
    }
    expect(state).toEqual(first.finalState);
  });

  it("finishes a full bot voyage", () => {
    const result = runBotSimulation(harborRuleSystem, 99);
    expect(result.finalState.status).toBe("complete");
    expect(result.finalState.voyage?.phase).toBe("resolved");
    expect(result.finalState.winnerSeat).not.toBeNull();
    expect(result.acceptedActions.length).toBeGreaterThan(10);
  });
});

describe("shared-goal-v1 runtime", () => {
  it("keeps one shared progress track and rejects the wrong seat", () => {
    const runtime = executableRuntime(sharedGoalRuleSystem)!;
    const state = initialSessionState(sharedGoalRuleSystem);
    expect(state).toMatchObject({
      turn: 0,
      activeSeat: 0,
      scores: [0, 0, 0],
      sharedGoal: { progress: 0, target: 5 },
      winnerSeat: null,
    });
    expect(
      acceptIntent(
        state,
        runtime,
        { intentId: "wrong-seat", seat: 1, actionId: "investigate" },
        1,
      ),
    ).toBeNull();
    const accepted = acceptIntent(
      state,
      runtime,
      { intentId: "accepted", seat: 0, actionId: "investigate" },
      1,
    );
    expect(accepted).toMatchObject({
      points: 2,
      state: {
        turn: 1,
        activeSeat: 1,
        sharedGoal: { progress: 2, target: 5 },
        winnerSeat: null,
      },
    });
  });

  it("reaches the shared target and reproduces bot evidence for one seed", () => {
    const first = runBotSimulation(sharedGoalRuleSystem, 42);
    expect(first).toEqual(runBotSimulation(sharedGoalRuleSystem, 42));
    expect(first.finalState.status).toBe("complete");
    expect(first.finalState.winnerSeat).toBeNull();
    expect(first.finalState.sharedGoal).toMatchObject({
      progress: expect.any(Number),
      target: 5,
    });
    expect(first.terminalStatus).toBe("complete");
  });

  it("reports turn-limit when the target remains unreachable", () => {
    const limited = structuredClone(sharedGoalRuleSystem);
    if (limited.runtimeSupport.status !== "executable") throw new Error("test_setup");
    if (limited.runtimeSupport.kernel.type !== "shared-goal-v1") throw new Error("test_setup");
    limited.runtimeSupport.kernel.maxTurns = 1;
    limited.runtimeSupport.kernel.goalTarget = 100;
    const result = runBotSimulation(limited, 42);
    expect(result.terminalStatus).toBe("turn-limit");
    expect(result.finalState.status).toBe("complete");
    expect(result.finalState.sharedGoal).toMatchObject({ progress: 2, target: 100 });
  });
});

describe("turn-taking-v1 runtime", () => {
  it("advances round-robin turns without inventing score or winner semantics", () => {
    const runtime = executableRuntime(turnTakingRuleSystem)!;
    const state = initialSessionState(turnTakingRuleSystem);
    expect(state).toMatchObject({
      turn: 0,
      activeSeat: 0,
      scores: [0, 0, 0],
      winnerSeat: null,
      turnTaking: { maxTurns: 4 },
    });
    expect(
      acceptIntent(
        state,
        runtime,
        { intentId: "wrong-seat", seat: 1, actionId: "extend" },
        1,
      ),
    ).toBeNull();
    expect(
      acceptIntent(
        state,
        runtime,
        { intentId: "unknown-action", seat: 0, actionId: "missing" },
        1,
      ),
    ).toBeNull();
    const accepted = acceptIntent(
      state,
      runtime,
      { intentId: "accepted", seat: 0, actionId: "extend" },
      1,
    );
    expect(accepted).toMatchObject({
      points: 0,
      state: {
        turn: 1,
        activeSeat: 1,
        scores: [0, 0, 0],
        status: "active",
        winnerSeat: null,
        turnTaking: { maxTurns: 4 },
      },
    });
  });

  it("stops at the explicit turn limit and reproduces bot evidence", () => {
    const first = runBotSimulation(turnTakingRuleSystem, 42);
    expect(first).toEqual(runBotSimulation(turnTakingRuleSystem, 42));
    expect(first.terminalStatus).toBe("turn-limit");
    expect(first.finalState).toMatchObject({
      turn: 4,
      status: "complete",
      winnerSeat: null,
      turnTaking: { maxTurns: 4 },
    });
  });
});

describe("take-away-v1 runtime", () => {
  it("decrements the shared pool, rejects overdraw, and awards the last take", () => {
    const runtime = executableRuntime(takeAwayRuleSystem)!;
    let state = initialSessionState(takeAwayRuleSystem);
    expect(state.takeAway).toEqual({ initialPool: 15, remaining: 15 });
    const first = acceptIntent(
      state,
      runtime,
      { intentId: "take-first", seat: 0, actionId: "take-2" },
      1,
    );
    expect(first?.state).toMatchObject({
      activeSeat: 1,
      winnerSeat: null,
      takeAway: { initialPool: 15, remaining: 13 },
    });
    state = { ...first!.state, takeAway: { initialPool: 15, remaining: 1 } };
    expect(
      acceptIntent(state, runtime, { intentId: "overdraw", seat: 1, actionId: "take-2" }, 2),
    ).toBeNull();
    expect(
      acceptIntent(state, runtime, { intentId: "last", seat: 1, actionId: "take-1" }, 2),
    ).toMatchObject({
      state: {
        status: "complete",
        winnerSeat: 1,
        takeAway: { initialPool: 15, remaining: 0 },
      },
    });
  });

  it("reproduces a complete fixed-seed game", () => {
    const first = runBotSimulation(takeAwayRuleSystem, 42);
    expect(first).toEqual(runBotSimulation(takeAwayRuleSystem, 42));
    expect(first.terminalStatus).toBe("complete");
    expect(first.finalState).toMatchObject({
      status: "complete",
      winnerSeat: expect.any(Number),
      takeAway: { initialPool: 15, remaining: 0 },
    });
  });
});

describe("roll-and-move-v1 runtime", () => {
  it("rolls authoritatively, advances one position, and rejects the wrong seat", () => {
    const runtime = executableRuntime(rollAndMoveRuleSystem)!;
    const state = initialSessionState(rollAndMoveRuleSystem, 42);
    expect(state.rollAndMove).toEqual({
      positions: [0, 0, 0],
      targetPosition: 20,
      lastRoll: null,
    });
    expect(
      acceptIntent(
        state,
        runtime,
        { intentId: "wrong-seat", seat: 1, actionId: "roll-move" },
        1,
        42,
      ),
    ).toBeNull();
    const accepted = acceptIntent(
      state,
      runtime,
      { intentId: "roll", seat: 0, actionId: "roll-move" },
      1,
      42,
    );
    expect(accepted?.points).toBeGreaterThanOrEqual(1);
    expect(accepted?.points).toBeLessThanOrEqual(6);
    expect(accepted?.state).toMatchObject({
      turn: 1,
      activeSeat: 1,
      winnerSeat: null,
      rollAndMove: {
        positions: [accepted?.points, 0, 0],
        targetPosition: 20,
        lastRoll: accepted?.points,
      },
    });
  });

  it("reproduces a complete fixed-seed race", () => {
    const first = runBotSimulation(rollAndMoveRuleSystem, 42);
    expect(first).toEqual(runBotSimulation(rollAndMoveRuleSystem, 42));
    expect(first.terminalStatus).toBe("complete");
    expect(first.finalState.status).toBe("complete");
    expect(first.finalState.winnerSeat).not.toBeNull();
    expect(first.finalState.rollAndMove?.positions[first.finalState.winnerSeat!]).toBe(20);
  });

  it("uses the safety turn limit without inventing a winner", () => {
    const limited = structuredClone(rollAndMoveRuleSystem);
    if (limited.runtimeSupport.status !== "executable") throw new Error("test_setup");
    if (limited.runtimeSupport.kernel.type !== "roll-and-move-v1") throw new Error("test_setup");
    limited.runtimeSupport.kernel.maxTurns = 1;
    limited.runtimeSupport.kernel.targetPosition = 100;
    const result = runBotSimulation(limited, 42);
    expect(result.terminalStatus).toBe("turn-limit");
    expect(result.finalState).toMatchObject({
      status: "complete",
      winnerSeat: null,
      rollAndMove: { targetPosition: 100 },
    });
  });
});

describe("draw-and-score-v1 runtime", () => {
  it("draws without exposing the future deck and reproduces the same seed", () => {
    const runtime = executableRuntime(drawAndScoreRuleSystem)!;
    const initial = initialSessionState(drawAndScoreRuleSystem, 42);
    expect(initial.drawAndScore).toEqual({
      totalCards: 12,
      remainingCards: 12,
      lastDraw: null,
    });
    expect(initial).not.toHaveProperty("deck");
    expect(initial.drawAndScore).not.toHaveProperty("cards");
    const accepted = acceptIntent(
      initial,
      runtime,
      { intentId: "draw", seat: 0, actionId: "draw-score" },
      1,
      42,
    );
    expect(accepted?.points).toBeGreaterThanOrEqual(1);
    expect(accepted?.points).toBeLessThanOrEqual(6);
    expect(accepted?.state).toMatchObject({
      turn: 1,
      activeSeat: 1,
      scores: [accepted?.points, 0],
      drawAndScore: {
        totalCards: 12,
        remainingCards: 11,
        lastDraw: accepted?.points,
      },
    });
    expect(runBotSimulation(drawAndScoreRuleSystem, 42)).toEqual(
      runBotSimulation(drawAndScoreRuleSystem, 42),
    );
  });

  it("finishes at the target or deck exhaustion and preserves an exhaustion tie", () => {
    const result = runBotSimulation(drawAndScoreRuleSystem, 42);
    expect(result.terminalStatus).toBe("complete");
    expect(result.finalState.status).toBe("complete");
    expect(result.finalState.drawAndScore?.remainingCards === 0 || result.finalState.winnerSeat !== null).toBe(true);

    const tied = structuredClone(drawAndScoreRuleSystem);
    if (tied.runtimeSupport.status !== "executable" || tied.runtimeSupport.kernel.type !== "draw-and-score-v1") throw new Error("test_setup");
    tied.runtimeSupport.kernel.cardValues = [1];
    tied.runtimeSupport.kernel.copiesPerValue = 2;
    tied.runtimeSupport.kernel.victoryTarget = 99;
    expect(runBotSimulation(tied, 42).finalState).toMatchObject({
      scores: [1, 1],
      status: "complete",
      winnerSeat: null,
      drawAndScore: { remainingCards: 0 },
    });
  });
});

describe("push-your-luck-v1 runtime", () => {
  it("busts, keeps the turn after a safe roll, and banks authoritatively", () => {
    const runtime = executableRuntime(pushYourLuckRuleSystem)!;
    const initial = initialSessionState(pushYourLuckRuleSystem, 42);
    expect(initial.pushYourLuck).toEqual({
      turnScore: 0,
      dieSides: 6,
      bustFace: 1,
      lastRoll: null,
      maxActions: 200,
    });
    expect(acceptIntent(initial, runtime, {
      intentId: "bank-empty",
      seat: 0,
      actionId: "bank",
    }, 1, 42)).toBeNull();
    const busted = acceptIntent(initial, runtime, {
      intentId: "bust",
      seat: 0,
      actionId: "roll",
    }, 1, 42)!;
    expect(busted).toMatchObject({
      points: 1,
      state: { activeSeat: 1, scores: [0, 0], pushYourLuck: { turnScore: 0, lastRoll: 1 } },
    });
    const safe = acceptIntent(busted.state, runtime, {
      intentId: "safe",
      seat: 1,
      actionId: "roll",
    }, 2, 42)!;
    expect(safe).toMatchObject({
      points: 5,
      state: { activeSeat: 1, scores: [0, 0], pushYourLuck: { turnScore: 5, lastRoll: 5 } },
    });
    const banked = acceptIntent(safe.state, runtime, {
      intentId: "bank",
      seat: 1,
      actionId: "bank",
    }, 3, 42)!;
    expect(banked).toMatchObject({
      points: 5,
      state: { activeSeat: 0, scores: [0, 5], pushYourLuck: { turnScore: 0 } },
    });
  });

  it("uses a deterministic bot policy and reaches a winner", () => {
    const first = runBotSimulation(pushYourLuckRuleSystem, 42);
    expect(first).toEqual(runBotSimulation(pushYourLuckRuleSystem, 42));
    expect(first.terminalStatus).toBe("complete");
    expect(first.finalState.winnerSeat).not.toBeNull();
    expect(first.finalState.scores[first.finalState.winnerSeat!]).toBeGreaterThanOrEqual(20);
    expect(first.acceptedActions.some((action) => action.actionId === "roll")).toBe(true);
    expect(first.acceptedActions.some((action) => action.actionId === "bank")).toBe(true);
  });
});
