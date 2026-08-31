import { describe, expect, it } from "vitest";
import type { RuleSystem } from "../creator/project-contract";
import { playabilityFloor } from "./playability-floor";

function base(overrides: Partial<RuleSystem> = {}): RuleSystem {
  return {
    id: "rs",
    version: 1,
    name: "测试",
    pitch: "先到 8 分。",
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
      kernel: {
        type: "score-race-v1",
        victoryTarget: 8,
        maxTurns: 12,
        actions: [{ id: "a", label: "得分", points: 2 }],
      },
    },
    ...overrides,
  };
}

describe("playabilityFloor", () => {
  it("rejects a hidden-role source running score-race", () => {
    const floor = playabilityFloor(base({
      name: "别墅剧本杀",
      pitch: "三个人找出凶手，发言后指控。",
    }));
    expect(floor.status).toBe("failed");
    expect(floor.reason).toMatch(/hidden-role/);
  });

  it("accepts hidden-role on a conversation surface", () => {
    const floor = playabilityFloor(base({
      name: "别墅剧本杀",
      pitch: "找出凶手并指控。",
      playSurface: { kind: "conversation", layout: "talk", regions: [] },
      runtimeSupport: {
        status: "executable",
        unsupported: [],
        kernel: {
          type: "hidden-role-v1",
          playerCount: 3,
          roles: [
            { id: "culprit", name: "凶手", alignment: "culprit" },
            { id: "detective", name: "侦探", alignment: "town" },
            { id: "civilian-2", name: "平民", alignment: "town" },
          ],
        },
      },
    }));
    expect(floor.status).toBe("passed");
  });

  it("accepts a generic point race", () => {
    expect(playabilityFloor(base()).status).toBe("passed");
  });

  it("rejects cards or conversation surfaces running a scoreboard kernel", () => {
    expect(playabilityFloor(base({
      playSurface: { kind: "cards", layout: "hand", regions: [] },
    })).status).toBe("failed");
    expect(playabilityFloor(base({
      playSurface: { kind: "conversation", layout: "talk", regions: [] },
    })).status).toBe("failed");
  });

  it("accepts hand-play on a cards surface", () => {
    expect(playabilityFloor(base({
      name: "聚会卡牌",
      pitch: "从手牌打出一张到出牌区。",
      playSurface: { kind: "cards", layout: "hand-and-play-area", regions: [] },
      runtimeSupport: {
        status: "executable",
        unsupported: [],
        kernel: {
          type: "hand-play-v1",
          playerCount: 4,
          cardValues: [1, 2, 3, 4, 5],
          copiesPerValue: 4,
          handSize: 3,
          victoryTarget: 12,
          actions: [{ id: "play", label: "打出一张手牌" }],
        },
      },
    })).status).toBe("passed");
  });
});
