import { describe, expect, it } from "vitest";
import {
  inferredDrawAndScoreRule,
  inferredPushYourLuckRule,
  inferredSharedGoalTarget,
  inferredParticipantRange,
  inferredRollAndMoveRule,
  inferredTakeAwayRule,
  isSharedGoalDescription,
  isTurnTakingDescription,
  materializeRuleSystem,
} from "./rulebook-generation";

describe("rulebook Rule System materialization", () => {
  it("extracts editable structure and anchors it to the uploaded rulebook", () => {
    const ruleSystem = materializeRuleSystem({
      name: "Harbor Traders",
      description: "A 3 player trading game in 45 minutes.",
      sourceId: "source_test",
      sourceText: [
        "SETUP Place the harbor board in the center and shuffle 24 cargo cards.",
        "Each player may bid for one ship and move a cargo marker.",
        "Players must keep all bids visible until the voyage ends.",
        "VOYAGE PHASE Players take turns placing workers in harbor zones.",
        "The winner is the player with the most coins after three voyages.",
      ].join("\n"),
    });
    expect(ruleSystem).toMatchObject({
      participants: { min: 3, max: 3, default: 3 },
      durationMinutes: 45,
    });
    expect(ruleSystem.rules.length).toBeGreaterThan(2);
    expect(ruleSystem.actions.length).toBeGreaterThan(0);
    expect(ruleSystem.constraints.length).toBeGreaterThan(0);
    expect(ruleSystem.entities.length).toBeGreaterThan(0);
    expect(ruleSystem.rules[0].sourceId).toBe("source_test");
    expect(ruleSystem.actions[0]).toMatchObject({
      id: "source-action-1",
      sourceId: "source_test",
      provenance: "source-anchored",
    });
  });

  it("keeps rulebook promotions out of the playable action list", () => {
    const ruleSystem = materializeRuleSystem({
      name: "Gem market rulebook",
      description: "A 2 player game.",
      sourceId: "source_gem_market",
      sourceText: [
        "Play for free with players around the world on our online platform.",
        "To learn how to play scan this QR Code.",
        "Take 3 Gem pieces of different colors",
        "Take 2 Gem pieces of the same color",
        "• Reserve 1 Development card and take 1 Gold piece To reserve a card, draw one.",
        "• Purchase 1 Development card You may purchase one from the middle.",
      ].join("\n"),
    });

    expect(ruleSystem.actions.map((action) => action.label)).toEqual([
      "Take 3 Gem pieces of different colors",
      "Take 2 Gem pieces of the same color",
      "Reserve 1 Development card and take 1 Gold piece",
      "Purchase 1 Development card",
    ]);
  });

  it("materializes an idea without inventing a tabletop surface", () => {
    const ruleSystem = materializeRuleSystem({
      name: "灵感接力",
      description: "3 players take turns extending an idea or adding a constraint.",
      sourceId: "source_idea",
      sourceText: "",
    });

    expect(ruleSystem.participants.default).toBe(3);
    expect(ruleSystem.playSurface).toMatchObject({
      kind: "conversation",
      layout: "prompt-and-response",
      regions: [],
    });
    expect(ruleSystem.presentation.visuals).toEqual([{
      provenance: "kit",
      label: "程序化主题 kit",
    }]);
    expect(ruleSystem.entities).toEqual([]);
    expect(ruleSystem.rules.length).toBeGreaterThan(0);
    expect(ruleSystem.constraints).toEqual([
      expect.objectContaining({
        sourceId: "source_idea",
        provenance: "source-anchored",
      }),
    ]);
  });

  it("keeps Chinese prompt counts and separate scored actions", () => {
    const ruleSystem = materializeRuleSystem({
      name: "自测·灵感回路",
      description: "三位玩家轮流扩展一个共同创意。玩家可以扩展创意获得 1 分，也可以加入约束获得 2 分。率先达到 8 分者获胜，18 回合后最高分获胜。每次行动必须回应已有内容。",
      sourceId: "source_chinese_prompt",
      sourceText: "",
    });

    expect(ruleSystem.participants).toMatchObject({
      min: 3,
      max: 3,
      default: 3,
    });
    expect(ruleSystem.actions).toMatchObject([
      { label: "扩展创意", description: "扩展创意获得 1 分" },
      { label: "加入约束", description: "加入约束获得 2 分" },
    ]);
    expect(ruleSystem.constraints).toContainEqual(
      expect.objectContaining({ text: "每次行动必须回应已有内容。" }),
    );
  });

  it("keeps separate Chinese action choices when their scoring is unspecified", () => {
    const description = "三个人轮流在夜市交换灵感。每次可以扩展一个已有点子、加入一个之后必须遵守的限制，或把两个元素连接起来。率先达到 8 分的人获胜，最多 18 回合。";
    const ruleSystem = materializeRuleSystem({
      name: "夜市交换",
      description,
      sourceId: "source_unscored_chinese_choices",
      sourceText: "",
    });

    expect(ruleSystem.actions).toMatchObject([
      { label: "扩展一个已有点子", description: "扩展一个已有点子" },
      { label: "加入一个之后必须遵守的限制", description: "加入一个之后必须遵守的限制" },
      { label: "把两个元素连接起来", description: "把两个元素连接起来" },
    ]);
    expect(ruleSystem.actions).toHaveLength(3);
  });

  it("keeps action names in Chinese scored choices separated by punctuation", () => {
    const description = "三个人轮流在夜市交换灵感。每次可以扩展一个已有点子，获得 1 分；可以加入一个之后必须遵守的限制，获得 2 分；也可以把两个元素连接起来，获得 3 分。率先达到 8 分的人获胜，最多 18 回合。";
    const ruleSystem = materializeRuleSystem({
      name: "夜市竞分",
      description,
      sourceId: "source_scored_chinese_choices",
      sourceText: "",
    });

    expect(ruleSystem.actions).toMatchObject([
      { label: "扩展一个已有点子", description: "扩展一个已有点子获得 1 分" },
      { label: "加入一个之后必须遵守的限制", description: "加入一个之后必须遵守的限制获得 2 分" },
      { label: "把两个元素连接起来", description: "把两个元素连接起来获得 3 分" },
    ]);
    expect(ruleSystem.actions).toHaveLength(3);
  });

  it("recognizes an explicit cooperative goal without treating it as a race", () => {
    const description = "三位玩家合作收集线索。玩家可以调查线索推进 2 点，也可以整理线索推进 1 点。累计达到 6 点完成目标，最多 12 回合。";
    const ruleSystem = materializeRuleSystem({
      name: "共享线索",
      description,
      sourceId: "source_shared_goal",
      sourceText: "",
    });

    expect(isSharedGoalDescription(description)).toBe(true);
    expect(inferredSharedGoalTarget(description)).toBe(6);
    expect(isSharedGoalDescription("Three players work together toward a shared goal.")).toBe(true);
    expect(inferredSharedGoalTarget("Three players work together and reach 6 points in 12 turns.")).toBe(6);
    expect(ruleSystem.actions).toMatchObject([
      { label: "调查线索", description: "调查线索推进 2 点" },
      { label: "整理线索", description: "整理线索推进 1 点" },
    ]);
  });

  it("recognizes concise Chinese shared-goal actions and a narrative outcome", () => {
    const description = "三名调查员合作在雾港收集线索。调查行动推进 2 点，整理证词推进 1 点。累计 8 点破解案件，最多 12 回合。";
    const ruleSystem = materializeRuleSystem({
      name: "雾港线索",
      description,
      sourceId: "source_fog_harbor",
      sourceText: description,
    });

    expect(inferredParticipantRange(description)).toEqual({
      min: 3,
      max: 3,
      default: 3,
    });
    expect(isSharedGoalDescription(description)).toBe(true);
    expect(inferredSharedGoalTarget(description)).toBe(8);
    expect(ruleSystem.actions).toMatchObject([
      { label: "调查", description: "调查行动推进 2 点" },
      { label: "整理证词", description: "整理证词推进 1 点" },
    ]);
  });

  it("recognizes explicit turn-taking without inventing a numeric goal", () => {
    expect(isTurnTakingDescription("Three players take turns extending an idea.")).toBe(true);
    expect(isTurnTakingDescription("三位玩家轮流加入约束。")).toBe(true);
    expect(isTurnTakingDescription("Players score points for matching cards.")).toBe(false);
  });

  it("extracts a complete shared-pool take-away rule without reducing it to turn taking", () => {
    const brief = "两名玩家轮流从桌上的15枚石子中拿走石子。每回合可以拿1枚或拿2枚。拿到最后一枚石子的人获胜。";
    expect(inferredTakeAwayRule(brief)).toEqual({
      initialPool: 15,
      takes: [1, 2],
    });
    const ruleSystem = materializeRuleSystem({
      name: "十五枚石子",
      description: brief,
      sourceId: "source_take_away",
      sourceText: brief,
    });
    expect(ruleSystem.actions).toMatchObject([
      { id: "source-action-1", label: "拿走 1 枚" },
      { id: "source-action-2", label: "拿走 2 枚" },
    ]);
    expect(ruleSystem.playSurface.kind).toBe("table");
    expect(ruleSystem.entities).toContainEqual(expect.objectContaining({
      kind: "token",
      quantity: 15,
      sourceId: "source_take_away",
    }));
  });

  it("extracts an explicit die race as one source-anchored roll action", () => {
    const brief = "两名玩家轮流掷一颗六面骰子，并按点数前进相应格数。率先到达20格的玩家获胜。";
    expect(inferredRollAndMoveRule(brief)).toEqual({
      dieSides: 6,
      targetPosition: 20,
    });
    const ruleSystem = materializeRuleSystem({
      name: "二十格竞速",
      description: brief,
      sourceId: "source_roll_and_move",
      sourceText: brief,
    });
    expect(ruleSystem.actions).toEqual([
      expect.objectContaining({
        id: "source-action-1",
        label: "掷骰前进",
        sourceId: "source_roll_and_move",
        provenance: "source-anchored",
      }),
    ]);
    expect(ruleSystem.playSurface.kind).toBe("table");
  });

  it("extracts a finite shuffled draw-and-score deck as one action", () => {
    const brief = "两名玩家轮流从洗牌后的牌库顶抽一张牌。牌库里有点数1到6的牌，每个点数各2张。玩家把抽到的点数加入自己的总分。率先达到15分者获胜；牌库用完仍无人达到时，总分最高者获胜。";
    expect(inferredDrawAndScoreRule(brief)).toEqual({
      cardValues: [1, 2, 3, 4, 5, 6],
      copiesPerValue: 2,
      victoryTarget: 15,
    });
    const ruleSystem = materializeRuleSystem({
      name: "抽牌竞分",
      description: brief,
      sourceId: "source_draw_and_score",
      sourceText: brief,
    });
    expect(ruleSystem.actions).toEqual([
      expect.objectContaining({
        id: "source-action-1",
        label: "抽牌计分",
        sourceId: "source_draw_and_score",
        provenance: "source-anchored",
      }),
    ]);
    expect(ruleSystem.playSurface.kind).toBe("cards");
  });

  it("extracts push-your-luck roll and bank decisions", () => {
    const brief = "两名玩家轮流进行回合。回合开始时未存分为0。当前玩家可以反复掷一颗六面骰子：掷出2到6就把点数加入本回合未存分，并可选择继续掷或收手；掷出1则本回合未存分清零并立即换人。选择收手时，把本回合未存分加入自己的总分并换人。率先达到20分者获胜。";
    expect(inferredPushYourLuckRule(brief)).toEqual({
      dieSides: 6,
      bustFace: 1,
      victoryTarget: 20,
    });
    const ruleSystem = materializeRuleSystem({
      name: "冒险押注",
      description: brief,
      sourceId: "source_push_your_luck",
      sourceText: brief,
    });
    expect(ruleSystem.actions).toEqual([
      expect.objectContaining({ id: "roll", label: "继续掷骰" }),
      expect.objectContaining({ id: "bank", label: "收手存分" }),
    ]);
  });

  it("preserves player ranges from Chinese and English natural-language briefs", () => {
    expect(inferredParticipantRange("适合二至四位玩家的合作游戏。")).toEqual({
      min: 2,
      max: 4,
      default: 2,
    });
    expect(inferredParticipantRange("A 2 to 4 player conversation game.")).toEqual({
      min: 2,
      max: 4,
      default: 2,
    });

    const ruleSystem = materializeRuleSystem({
      name: "范围测试",
      description: "A 2-4 player conversation game in 20 minutes.",
      sourceId: "source_player_range",
      sourceText: "Players take turns adding one idea.",
    });
    expect(ruleSystem.participants).toMatchObject({ min: 2, max: 4, default: 2 });
  });

  it("keeps multiple English scored actions and their victory target", () => {
    const ruleSystem = materializeRuleSystem({
      name: "Clue relay",
      description: "Three players can investigate clues for 2 points or organize clues for 1 point. Be the first to reach 6 points in 12 turns.",
      sourceId: "source_english_scored_actions",
      sourceText: "",
    });

    expect(ruleSystem.actions).toMatchObject([
      { label: "investigate clues", description: "investigate clues for 2 points" },
      { label: "organize clues", description: "organize clues for 1 point" },
    ]);
  });

  it("preserves all supported English scored actions instead of truncating them", () => {
    const actions = Array.from({ length: 12 }, (_, index) =>
      `action ${index + 1} for 1 point`,
    ).join(" or ");
    const ruleSystem = materializeRuleSystem({
      name: "Many choices",
      description: `Three players can ${actions}. Be the first to reach 12 points in 12 turns.`,
      sourceId: "source_many_choices",
      sourceText: "",
    });

    expect(ruleSystem.actions).toHaveLength(12);
    expect(ruleSystem.actions.at(-1)).toMatchObject({
      label: "action 12",
      description: "action 12 for 1 point",
    });
  });
});
