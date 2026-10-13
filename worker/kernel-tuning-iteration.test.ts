import { describe, expect, it } from "vitest";
import type { RuleSystem } from "../src/creator/project-contract";
import { createKernelTuningIterationPlan } from "./kernel-tuning-iteration";

function withKernel(kernel: unknown): RuleSystem {
  return {
    id: "rs", version: 2, name: "测试", pitch: "", participants: { min: 2, max: 2, default: 2, roles: [] },
    durationMinutes: 20, rules: [], constraints: [], entities: [], setup: [], actions: [],
    playSurface: { kind: "table", layout: "", regions: [] }, stages: [], outcomes: [], presentation: {},
    runtimeSupport: { status: "executable", unsupported: ["x"], kernel },
  } as unknown as RuleSystem;
}

const battler = (tuning?: object) => withKernel({ type: "auto-battler-v1", playerCount: 2, ...(tuning ? { tuning } : {}) });
const plan = (rs: RuleSystem, prompt: string) => createKernelTuningIterationPlan({ ruleSystem: rs, prompt, sourceId: "src_1" });

describe("createKernelTuningIterationPlan", () => {
  it("maps a bare prep-timer sentence onto both prep phases", () => {
    const p = plan(battler(), "每回合备战阶段限时30秒，超时自动开打")!;
    expect(p.operations[1]).toEqual({
      op: "configure_auto_battler",
      config: { playerCount: 2, unsupported: ["x"], tuning: { prepShopSeconds: 30, prepPlaceSeconds: 30 } },
    });
  });
  it("targets one phase, keeps existing tuning, parses Chinese numerals", () => {
    const p = plan(battler({ startHp: 30 }), "布阵时间改成二十秒")!;
    expect(p.operations[1]).toMatchObject({ config: { tuning: { startHp: 30, prepPlaceSeconds: 20 } } });
    expect(p.changes.map((c) => c.key)).toEqual(["prepPlaceSeconds"]);
  });
  it("reads starting HP and gold without mistaking them for seconds", () => {
    const p = plan(battler(), "初始血量改成40，初始金币改成15")!;
    expect(p.operations[1]).toMatchObject({ config: { tuning: { startHp: 40, startGold: 15 } } });
  });
  it("rejects out-of-range values with a readable reason", () => {
    expect(() => plan(battler(), "备战限时3秒")).toThrow(/iteration_unsupported/);
  });
  it("returns undefined for non-numeric or unrelated prompts and other kernels", () => {
    expect(plan(battler(), "三个相同的棋子自动合成二星")).toBeUndefined();
    expect(plan(withKernel({ type: "turn-taking-v1", maxTurns: 8, actions: [] }), "备战限时30秒")).toBeUndefined();
  });
});

describe("iteration AI hint", () => {
  it("points bot-playable games to the lobby vs-computer entry", async () => {
    const { createActionDescriptionIterationPlan } = await import("./rule-system-iteration");
    expect(() => createActionDescriptionIterationPlan({ ruleSystem: battler(), prompt: "加一个电脑对手，我一个人也能玩", sourceId: "s" })).toThrow(/和电脑对战/);
  });
});
