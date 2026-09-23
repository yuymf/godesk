import { describe, expect, it } from "vitest";
import type { RuleSystem } from "../creator/project-contract";
import {
  genreObjectFidelity,
  hasBoundImage,
  presentationFloor,
} from "./presentation-floor";

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
    presentation: { theme: "kit", visuals: [{ provenance: "kit", label: "主题 kit" }] },
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

describe("presentationFloor", () => {
  it("fails when there is no visual treatment", () => {
    const floor = presentationFloor(base({
      presentation: { theme: "", visuals: [] },
    }));
    expect(floor.status).toBe("failed");
    expect(floor.reason).toContain("没有可分享的呈现");
    expect(floor.visuals).toEqual([]);
  });

  it("fails kit provenance without a theme", () => {
    const floor = presentationFloor(base({
      presentation: { theme: "  ", visuals: [{ provenance: "kit", label: "空主题" }] },
    }));
    expect(floor.status).toBe("failed");
    expect(floor.reason).toContain("缺少 theme");
  });

  it("passes kit-only score-race / generic without genre objects", () => {
    const floor = presentationFloor(base());
    expect(floor).toEqual({
      status: "passed",
      reason: "主题 kit 已满足 Presentation Floor。",
      visuals: [{ provenance: "kit", label: "主题 kit" }],
    });
    expect(genreObjectFidelity(base()).status).toBe("passed");
  });

  it("fails generated/extracted/uploaded without a bound image", () => {
    const floor = presentationFloor(base({
      presentation: {
        theme: "",
        visuals: [{ provenance: "generated", label: "排版" }],
      },
    }));
    expect(floor.status).toBe("failed");
    expect(floor.reason).toContain("必须绑定真实图像");
    expect(hasBoundImage(base({
      presentation: {
        theme: "",
        visuals: [{ provenance: "generated", label: "排版" }],
      },
    }))).toBe(false);
  });

  it("passes generated provenance when an image is bound", () => {
    const ruleSystem = base({
      presentation: {
        theme: "",
        image: { sourceId: "src-1", url: "https://example.com/cover.png", alt: "cover" },
        visuals: [{ provenance: "uploaded", label: "封面" }],
      },
    });
    expect(hasBoundImage(ruleSystem)).toBe(true);
    expect(presentationFloor(ruleSystem)).toEqual({
      status: "passed",
      reason: "封面 已满足 Presentation Floor。",
      visuals: [{ provenance: "uploaded", label: "封面" }],
    });
  });

  it("fails kit-only conversation without a transcript object", () => {
    const ruleSystem = base({
      name: "灵感接力",
      pitch: "共同创意，公开发言写入发言记录。",
      playSurface: { kind: "conversation", layout: "prompt-and-response", regions: [] },
      entities: [],
      runtimeSupport: {
        status: "executable",
        unsupported: [],
        kernel: {
          type: "conversation-relay-v1",
          maxTurns: 12,
          actions: [{ id: "speak", label: "发言" }],
        },
      },
    });
    const objects = genreObjectFidelity(ruleSystem);
    expect(objects.status).toBe("failed");
    expect(objects.missing).toContain("transcript");
    const floor = presentationFloor(ruleSystem);
    expect(floor.status).toBe("failed");
    expect(floor.reason).toContain("桌子好看但还不是那款游戏");
    expect(floor.reason).toContain("发言记录");
  });

  it("passes conversation when transcript entity is present", () => {
    const ruleSystem = base({
      name: "灵感接力",
      pitch: "共同创意接力。",
      playSurface: { kind: "conversation", layout: "prompt-and-response", regions: [] },
      entities: [{
        id: "entity-transcript",
        name: "发言记录",
        kind: "object",
        sourceId: "s",
        provenance: "source-anchored",
        confidence: 1,
      }],
      runtimeSupport: {
        status: "executable",
        unsupported: [],
        kernel: {
          type: "conversation-relay-v1",
          maxTurns: 12,
          actions: [{ id: "speak", label: "发言" }],
        },
      },
    });
    expect(genreObjectFidelity(ruleSystem).status).toBe("passed");
    expect(presentationFloor(ruleSystem).status).toBe("passed");
  });

  it("fails kit-only placement without named regions", () => {
    const ruleSystem = base({
      name: "工人放置桌游",
      pitch: "在共享桌面放置工人到资源区。",
      playSurface: { kind: "table", layout: "worker-placement", regions: [] },
      entities: [],
      runtimeSupport: {
        status: "draft",
        unsupported: [],
      },
    });
    const objects = genreObjectFidelity(ruleSystem);
    expect(objects.family).toBe("placement");
    expect(objects.status).toBe("failed");
    expect(objects.missing).toContain("named-regions");
    expect(presentationFloor(ruleSystem).status).toBe("failed");
    expect(presentationFloor(ruleSystem).reason).toContain("具名区域");
  });

  it("passes placement when named regions exist", () => {
    const ruleSystem = base({
      name: "工人放置桌游",
      pitch: "在共享桌面放置工人到资源区。",
      playSurface: {
        kind: "table",
        layout: "worker-placement",
        regions: [{ id: "spot-a", name: "资源区甲", description: "放置工人。" }],
      },
      runtimeSupport: {
        status: "executable",
        unsupported: [],
        kernel: {
          type: "worker-placement-v1",
          playerCount: 3,
          workersPerSeat: 2,
          startingCoins: 0,
          regions: [
            { id: "spot-a", name: "资源区甲", capacity: 2, cost: 0, resolvePoints: 1 },
          ],
          victoryTarget: null,
      victoryBuildings: null,
        },
      },
    });
    expect(genreObjectFidelity(ruleSystem).status).toBe("passed");
    expect(presentationFloor(ruleSystem).status).toBe("passed");
  });

  it("passes harbor-voyage kit via built-in board even without copied regions", () => {
    const ruleSystem = base({
      name: "港口航线",
      pitch: "派遣伙计到港口航线。",
      playSurface: { kind: "table", layout: "harbor", regions: [] },
      runtimeSupport: {
        status: "executable",
        unsupported: [],
        kernel: { type: "harbor-voyage-v1", playerCount: 3 },
      },
    });
    expect(genreObjectFidelity(ruleSystem).status).toBe("passed");
    expect(presentationFloor(ruleSystem).status).toBe("passed");
  });

  it("fails kit-only hand-play without hand or play-area objects", () => {
    const ruleSystem = base({
      name: "聚会卡牌",
      pitch: "从手牌打出一张到出牌区。",
      playSurface: { kind: "cards", layout: "hand-and-play-area", regions: [] },
      entities: [],
      runtimeSupport: {
        status: "executable",
        unsupported: [],
        kernel: {
          type: "hand-play-v1",
          playerCount: 4,
          cardValues: [1, 2, 3],
          copiesPerValue: 2,
          handSize: 3,
          victoryTarget: 10,
          actions: [{ id: "play", label: "打出" }],
        },
      },
    });
    expect(genreObjectFidelity(ruleSystem).missing).toContain("hand-or-play-area");
    expect(presentationFloor(ruleSystem).status).toBe("failed");
  });
});
