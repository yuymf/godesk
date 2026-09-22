import { describe, expect, it } from "vitest";
import type { RuleSystem } from "../creator/project-contract";
import { hasBoundImage, presentationFloor } from "./presentation-floor";

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

  it("passes kit provenance with a theme", () => {
    const floor = presentationFloor(base());
    expect(floor).toEqual({
      status: "passed",
      reason: "主题 kit 已满足 Presentation Floor。",
      visuals: [{ provenance: "kit", label: "主题 kit" }],
    });
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
});
