import { describe, expect, it } from "vitest";
import type { RuleSystem } from "./project-contract";
import {
  showsAcceptedActionPointChrome,
  usesConversationTranscriptSurface,
  usesScoreTrackSurface,
} from "./room-presentation";

type ExecutableKernel = Extract<
  Extract<RuleSystem["runtimeSupport"], { status: "executable" }>["kernel"],
  { type: string }
>;

function base(kernel: ExecutableKernel): RuleSystem {
  return {
    id: "rs",
    version: 1,
    name: "测试",
    pitch: "测试",
    participants: { min: 2, max: 2, default: 2, roles: [] },
    durationMinutes: 10,
    rules: [],
    constraints: [],
    entities: [],
    setup: [],
    actions: [],
    playSurface: { kind: "table", layout: "track", regions: [] },
    stages: [],
    outcomes: [],
    presentation: { theme: "kit", visuals: [{ provenance: "kit", label: "kit" }] },
    runtimeSupport: {
      status: "executable",
      unsupported: [],
      kernel,
    },
  };
}

describe("usesScoreTrackSurface", () => {
  it("is true for score-track-family kernels", () => {
    expect(usesScoreTrackSurface(base({
      type: "score-race-v1",
      victoryTarget: 8,
      maxTurns: 12,
      actions: [{ id: "a", label: "得分", points: 2 }],
    }))).toBe(true);
    expect(usesScoreTrackSurface(base({
      type: "shared-goal-v1",
      goalTarget: 8,
      maxTurns: 12,
      actions: [{ id: "a", label: "推进", progress: 2 }],
    }))).toBe(true);
    expect(usesScoreTrackSurface(base({
      type: "take-away-v1",
      initialPool: 10,
      actions: [{ id: "a", label: "拿", take: 1 }],
    }))).toBe(true);
    expect(usesScoreTrackSurface(base({
      type: "roll-and-move-v1",
      dieSides: 6,
      targetPosition: 20,
      maxTurns: 30,
      actions: [{ id: "roll", label: "掷骰" }],
    }))).toBe(true);
    expect(usesScoreTrackSurface(base({
      type: "draw-and-score-v1",
      cardValues: [1, 2, 3],
      copiesPerValue: 2,
      victoryTarget: 10,
      actions: [{ id: "draw", label: "抽牌" }],
    }))).toBe(true);
    expect(usesScoreTrackSurface(base({
      type: "push-your-luck-v1",
      dieSides: 6,
      bustFace: 1,
      victoryTarget: 20,
      maxActions: 40,
      actions: [{ id: "roll", label: "掷" }, { id: "bank", label: "存" }],
    }))).toBe(true);
    expect(usesScoreTrackSurface(base({
      type: "turn-taking-v1",
      maxTurns: 8,
      actions: [{ id: "pass", label: "过" }],
    }))).toBe(true);
  });

  it("is false for genre and placement kernels", () => {
    expect(usesScoreTrackSurface(base({
      type: "hidden-role-v1",
      playerCount: 3,
      roles: [
        { id: "culprit", name: "凶手", alignment: "culprit" },
        { id: "detective", name: "侦探", alignment: "town" },
        { id: "civilian", name: "平民", alignment: "town" },
      ],
    }))).toBe(false);
    expect(usesScoreTrackSurface(base({
      type: "hand-play-v1",
      playerCount: 2,
      cardValues: [1, 2, 3],
      copiesPerValue: 2,
      handSize: 3,
      victoryTarget: 10,
      actions: [{ id: "play", label: "出牌" }],
    }))).toBe(false);
    expect(usesScoreTrackSurface(base({
      type: "conversation-relay-v1",
      victoryTarget: 8,
      maxTurns: 8,
      actions: [{ id: "speak", label: "发言", points: 1 }],
    }))).toBe(false);
    expect(usesScoreTrackSurface(base({
      type: "harbor-voyage-v1",
      playerCount: 4,
    }))).toBe(false);
    expect(usesScoreTrackSurface(base({
      type: "worker-placement-v1",
      playerCount: 3,
      workersPerSeat: 3,
      startingCoins: 0,
      regions: [
        { id: "spot-a", name: "A", capacity: 2, cost: 0, resolvePoints: 1 },
        { id: "spot-b", name: "B", capacity: 2, cost: 0, resolvePoints: 1 },
      ],
      victoryTarget: null,
    }))).toBe(false);
  });
});

const conversationKernel = {
  type: "conversation-relay-v1" as const,
  victoryTarget: 8,
  maxTurns: 8,
  actions: [{ id: "speak", label: "发言", points: 1 }],
};

describe("usesConversationTranscriptSurface", () => {
  it("is true only for conversation-relay", () => {
    expect(usesConversationTranscriptSurface(base(conversationKernel))).toBe(true);
    expect(usesConversationTranscriptSurface(base({
      type: "score-race-v1",
      victoryTarget: 8,
      maxTurns: 12,
      actions: [{ id: "a", label: "得分", points: 2 }],
    }))).toBe(false);
    expect(usesConversationTranscriptSurface(base({
      type: "harbor-voyage-v1",
      playerCount: 4,
    }))).toBe(false);
  });
});

describe("showsAcceptedActionPointChrome", () => {
  it("hides point chrome for conversation even though the kernel awards points", () => {
    expect(showsAcceptedActionPointChrome(base(conversationKernel))).toBe(false);
    expect(usesScoreTrackSurface(base(conversationKernel))).toBe(false);
  });

  it("keeps point chrome for score-track and non-conversation genre kernels", () => {
    expect(showsAcceptedActionPointChrome(base({
      type: "score-race-v1",
      victoryTarget: 8,
      maxTurns: 12,
      actions: [{ id: "a", label: "得分", points: 2 }],
    }))).toBe(true);
    expect(showsAcceptedActionPointChrome(base({
      type: "hand-play-v1",
      playerCount: 2,
      cardValues: [1, 2, 3],
      copiesPerValue: 2,
      handSize: 3,
      victoryTarget: 10,
      actions: [{ id: "play", label: "出牌" }],
    }))).toBe(true);
  });
});
