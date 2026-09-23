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

  it("accepts placement on harbor-voyage or worker-placement table kernels", () => {
    const placementBase = {
      name: "工人放置桌游",
      pitch: "在共享桌面放置工人到资源区。",
      playSurface: { kind: "table" as const, layout: "worker-placement", regions: [] },
    };
    expect(playabilityFloor(base({
      ...placementBase,
      runtimeSupport: {
        status: "executable",
        unsupported: [],
        kernel: { type: "harbor-voyage-v1", playerCount: 3 },
      },
    })).status).toBe("passed");
    expect(playabilityFloor(base({
      ...placementBase,
      runtimeSupport: {
        status: "executable",
        unsupported: [],
        kernel: {
          type: "worker-placement-v1",
          playerCount: 3,
          workersPerSeat: 3,
          startingCoins: 0,
          regions: [
            { id: "spot-a", name: "Resource Spot A", capacity: 2, cost: 0, resolvePoints: 1 },
            { id: "spot-b", name: "Resource Spot B", capacity: 2, cost: 0, resolvePoints: 1 },
          ],
          victoryTarget: null,
          victoryBuildings: null,
        },
      },
    })).status).toBe("passed");
    expect(playabilityFloor(base({
      ...placementBase,
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
    })).status).toBe("failed");
  });


  it("fails economy placement corpus when worker-placement kernel is score-only", () => {
    const economyPitch =
      "资源区给木材，工坊把木材换成建筑。先建成 2 座建筑的人获胜。放置工人。";
    expect(
      playabilityFloor(
        base({
          name: "轻桌游",
          pitch: economyPitch,
          playSurface: { kind: "table" as const, layout: "worker-placement", regions: [] },
          runtimeSupport: {
            status: "executable",
            unsupported: [],
            kernel: {
              type: "worker-placement-v1",
              playerCount: 2,
              workersPerSeat: 3,
              startingCoins: 0,
              regions: [
                { id: "a", name: "资源区甲", capacity: 2, cost: 0, resolvePoints: 1 },
                { id: "b", name: "建筑场", capacity: 3, cost: 0, resolvePoints: 2, tag: "building" },
              ],
              victoryTarget: null,
              victoryBuildings: null,
            },
          },
        }),
      ).status,
    ).toBe("failed");
  });

  it("passes economy placement when kernel has wood yield, convert, and building victory", () => {
    const economyPitch =
      "资源区给木材，工坊把木材换成建筑。先建成 2 座建筑的人获胜。放置工人。";
    expect(
      playabilityFloor(
        base({
          name: "轻桌游",
          pitch: economyPitch,
          playSurface: { kind: "table" as const, layout: "worker-placement", regions: [] },
          runtimeSupport: {
            status: "executable",
            unsupported: [],
            kernel: {
              type: "worker-placement-v1",
              playerCount: 2,
              workersPerSeat: 3,
              startingCoins: 0,
              regions: [
                { id: "woods", name: "资源区", capacity: 2, cost: 0, resolvePoints: 0, yieldWood: 1 },
                {
                  id: "workshop",
                  name: "工坊",
                  capacity: 3,
                  cost: 0,
                  resolvePoints: 0,
                  convertWoodToBuilding: 1,
                  tag: "workshop",
                },
              ],
              victoryTarget: null,
              victoryBuildings: 2,
            },
          },
        }),
      ).status,
    ).toBe("passed");
  });


  it("fails non-score hand loops when kernel is play-to-score hand-play", () => {
    const floor = playabilityFloor(
      base({
        name: "吃墩打牌",
        pitch: "四人跟牌吃墩，必须跟同花色，赢得最多墩者获胜。从手牌打出。",
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
      }),
    );
    expect(floor.status).toBe("failed");
    expect(floor.reason).toMatch(/非计分|出牌计分/);
  });

  it("still accepts play-to-score hand-play when the source is that race", () => {
    expect(
      playabilityFloor(
        base({
          name: "聚会卡牌",
          pitch:
            "点数 1 到 5 各 4 张。从手牌打出一张到出牌区，该牌点数加入分数，先到 12 分。",
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
        }),
      ).status,
    ).toBe("passed");
  });

});
