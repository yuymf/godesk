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
    expect(p.operations[1]).toMatchObject({
      op: "configure_auto_battler",
      config: { playerCount: 2, tuning: { prepShopSeconds: 30, prepPlaceSeconds: 30 } },
    });
    // "超时自动开打" has no dedicated knob: it is listed, not silently claimed.
    expect(p.unsupportedClauses).toEqual(["超时自动开打"]);
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
    expect(plan(battler(), "把规则写得更有趣")).toBeUndefined();
    expect(plan(battler(), "三个相同的棋子自动合成二星")!.changes).toEqual([{ key: "stars.star2", label: "★2 合成", value: "开启" }]);
    expect(plan(withKernel({ type: "turn-taking-v1", maxTurns: 8, actions: [] }), "备战限时30秒")).toBeUndefined();
  });
});

describe("iteration AI hint", () => {
  it("points bot-playable games to the lobby vs-computer entry", async () => {
    const { createActionDescriptionIterationPlan } = await import("./rule-system-iteration");
    expect(() => createActionDescriptionIterationPlan({ ruleSystem: battler(), prompt: "加一个电脑对手，我一个人也能玩", sourceId: "s" })).toThrow(/和电脑对战/);
  });
});

describe("content data-layer NL edits (multi-change, honest leftovers)", () => {
  it("adds a unit with cost/stats/traits/shape from one sentence", () => {
    const p = plan(battler(), "加一个新单位「雷鳗」，费用3，攻击80，生命600，羁绊远航和潮汐，外形像精灵")!;
    const op = p.operations[1] as { config: { content: { units: Array<Record<string, unknown>> } } };
    const added = op.config.content.units.at(-1)!;
    expect(op.config.content.units).toHaveLength(13);
    expect(added).toMatchObject({ name: "雷鳗", cost: 3, atk: 80, hp: 600, traits: ["tide", "voyager"], shape: "spirit" });
    expect(p.unsupportedClauses).toEqual([]);
  });
  it("hits every edit in one sentence (trait tiers + tuning) and resamples effect values", () => {
    const p = plan(battler(), "把珊瑚咒羁绊的档位改成2/4，并且初始金币改成12")!;
    const cfg = (p.operations[1] as { config: Record<string, any> }).config;
    expect(cfg.tuning).toEqual({ startGold: 12 });
    const coral = cfg.content.traits.find((t: { id: string }) => t.id === "coral");
    expect(coral.tiers).toEqual([2, 4]);
    expect(coral.effect.values).toHaveLength(2);
    expect(p.changes.map((c) => c.key)).toEqual(["trait:coral", "startGold"]);
  });
  it("enables ★3 with a multiplier and records the unsupported clause instead of dropping it", () => {
    const p = plan(battler(), "开启三星，三星倍率改成3.5，棋盘改成8列")!;
    const cfg = (p.operations[1] as { config: Record<string, any> }).config;
    expect(cfg.content.stars).toEqual({ star2: true, star3: true, mult2: 1.8, mult3: 3.5 });
    expect(p.unsupportedClauses).toEqual(["棋盘改成8列"]);
    expect(cfg.unsupported.at(-1)).toContain("棋盘改成8列");
  });
  it("keeps earlier content edits when a later prompt touches another field", () => {
    const first = plan(battler(), "加一个新单位「雷鳗」，费用3")!;
    const content = (first.operations[1] as { config: { content: object } }).config.content;
    const second = plan(battler({}), "开启三星");
    void second;
    const p = plan(withKernel({ type: "auto-battler-v1", playerCount: 2, content }), "开启三星")!;
    const cfg = (p.operations[1] as { config: Record<string, any> }).config;
    expect(cfg.content.units).toHaveLength(13);
    expect(cfg.content.stars.star3).toBe(true);
  });
});
