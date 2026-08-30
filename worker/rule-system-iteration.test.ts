import { describe, expect, it } from "vitest";
import type { RuleSystem } from "../src/creator/project-contract";
import {
  createActionDescriptionIterationPlan,
  IterationPlanError,
} from "./rule-system-iteration";

function ruleSystem(): RuleSystem {
  return {
    id: "rule_system_demo",
    version: 3,
    name: "雾港实验",
    pitch: "轮流做出选择。",
    participants: { min: 2, max: 2, default: 2, roles: [] },
    durationMinutes: 30,
    rules: [],
    constraints: [],
    entities: [],
    setup: [],
    actions: [
      {
        id: "inspect",
        label: "调查线索",
        description: "查看一条线索。",
        sourceId: "source_original",
        provenance: "source-anchored",
        confidence: 0.8,
      },
      {
        id: "advance",
        label: "推进调查",
        description: "推进调查并获得 1 分。",
        sourceId: "source_original",
        provenance: "source-anchored",
        confidence: 0.8,
      },
    ],
    playSurface: { kind: "screen", layout: "", regions: [] },
    stages: [],
    outcomes: [],
    presentation: { theme: "test" },
    runtimeSupport: {
      status: "executable",
      unsupported: [],
      kernel: {
        type: "turn-taking-v1",
        maxTurns: 8,
        actions: [
          { id: "inspect", label: "调查线索" },
          { id: "advance", label: "推进调查" },
        ],
      },
    },
  };
}

describe("Studio natural-language iteration", () => {
  it("turns one Chinese action-description prompt into a traceable patch", () => {
    const plan = createActionDescriptionIterationPlan({
      ruleSystem: ruleSystem(),
      prompt: "把行动 2 的说明改成“先说明新增约束，再说明获得 2 分”。",
      sourceId: "source_iteration_1",
    });

    expect(plan).toMatchObject({
      actionId: "advance",
      actionLabel: "推进调查",
      summary: "将行动「推进调查」的说明改为「先说明新增约束，再说明获得 2 分」。",
    });
    expect(plan.operations).toEqual([
      expect.objectContaining({ op: "add_source" }),
      expect.objectContaining({
        op: "update_rule_system",
        fields: {
          actions: expect.arrayContaining([
            expect.objectContaining({
              id: "advance",
              description: "先说明新增约束，再说明获得 2 分",
              sourceId: "source_iteration_1",
              provenance: "ai-proposed",
            }),
          ]),
        },
      }),
    ]);
  });

  it("resolves a quoted action label and supports the English form", () => {
    const chinese = createActionDescriptionIterationPlan({
      ruleSystem: ruleSystem(),
      prompt: "把“调查线索”的说明改为“先看证据，再决定是否推进”。",
      sourceId: "source_iteration_2",
    });
    const english = createActionDescriptionIterationPlan({
      ruleSystem: ruleSystem(),
      prompt: 'Rewrite action #1 description to "Inspect one clue, then choose whether to advance."',
      sourceId: "source_iteration_3",
    });

    expect(chinese.actionId).toBe("inspect");
    expect(english.actionId).toBe("inspect");
    expect(english.operations[1]).toMatchObject({
      op: "update_rule_system",
      fields: {
        actions: expect.arrayContaining([
          expect.objectContaining({
            id: "inspect",
            description: "Inspect one clue, then choose whether to advance.",
          }),
        ]),
      },
    });
  });

  it("rejects unsupported edits and unknown actions without a plan", () => {
    expect(() => createActionDescriptionIterationPlan({
      ruleSystem: ruleSystem(),
      prompt: "把胜利目标改成 12 分。",
      sourceId: "source_iteration_4",
    })).toThrowError(IterationPlanError);
    expect(() => createActionDescriptionIterationPlan({
      ruleSystem: ruleSystem(),
      prompt: "把行动 9 的说明改成“新的说明”。",
      sourceId: "source_iteration_5",
    })).toThrow(/iteration_action_not_found/);
  });
});
