import { describe, expect, it } from "vitest";
import {
  applyHandPlayIntent,
  createHandPlayState,
  deriveHandPlayDeck,
  DEFAULT_HAND_PLAY_DECK,
  handPlayExhausted,
  isNonScoreHandLoopCorpus,
  scopeHandPlayState,
} from "./hand-play";
import { HOBBYIST_STARTERS } from "../creator/hobbyist-starters";

const HOBBYIST_CARDS =
  HOBBYIST_STARTERS.find((starter) => starter.id === "cards")?.text ?? "";

describe("hand-play-v1", () => {
  it("deals hidden hands and scores the played card", () => {
    const state = createHandPlayState({
      playerCount: 2,
      cardValues: [1, 2, 3],
      copiesPerValue: 2,
      handSize: 2,
      seed: 4,
    });
    expect(state.hands).toHaveLength(2);
    expect(state.hands[0]).toHaveLength(2);
    expect(state.deck.length).toBe(2);
    const scoped = scopeHandPlayState(state, 0);
    expect(scoped.deck).toEqual([]);
    expect(scoped.hands[0]).toEqual(state.hands[0]);
    expect(scoped.hands[1]).toEqual(state.hands[1].map(() => 0));

    const played = applyHandPlayIntent(state, 0, { cardIndex: 0 });
    expect(played).not.toBeNull();
    expect(played!.points).toBe(state.hands[0][0]);
    expect(played!.state.playArea).toEqual([{
      seat: 0,
      card: state.hands[0][0],
    }]);
    expect(played!.state.hands[0]).toHaveLength(2);
  });

  it("ends when the deck and hands are empty", () => {
    const state = createHandPlayState({
      playerCount: 1,
      cardValues: [1],
      copiesPerValue: 1,
      handSize: 1,
      seed: 1,
    });
    const played = applyHandPlayIntent(state, 0, { cardIndex: 0 });
    expect(played).not.toBeNull();
    expect(handPlayExhausted(played!.state)).toBe(true);
  });
});

describe("hand-play source parameterization (W4-02)", () => {
  it("derives cardValues / copies / handSize / victoryTarget from corpus", () => {
    const brief = "点数 1–10 各 2 张，手牌 5，先到 20。从手牌打出一张计分。";
    expect(deriveHandPlayDeck(brief)).toEqual({
      cardValues: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      copiesPerValue: 2,
      handSize: 5,
      victoryTarget: 20,
    });
  });

  it("keeps 聚会卡牌 defaults when numbers match the hobbyist starter", () => {
    expect(isNonScoreHandLoopCorpus(HOBBYIST_CARDS)).toBe(false);
    expect(deriveHandPlayDeck(HOBBYIST_CARDS)).toEqual(DEFAULT_HAND_PLAY_DECK);
  });

  it("falls back to 聚会卡牌 defaults when the brief omits deck numbers", () => {
    const brief = "四人轮流从手牌打出一张到出牌区，该牌点数加入分数。";
    expect(deriveHandPlayDeck(brief)).toEqual(DEFAULT_HAND_PLAY_DECK);
  });

  it("detects trick-taking / shedding / suit-effect as non-score hand loops", () => {
    expect(
      isNonScoreHandLoopCorpus(
        "四人打牌跟牌吃墩，必须跟同花色，赢得最多墩的人获胜。手牌隐藏。",
      ),
    ).toBe(true);
    expect(
      isNonScoreHandLoopCorpus(
        "每人有手牌，轮流出牌，先出完手牌的人获胜。",
      ),
    ).toBe(true);
    expect(
      isNonScoreHandLoopCorpus(
        "从手牌打出特殊效果牌，按花色相同才能组合成套。",
      ),
    ).toBe(true);
    expect(isNonScoreHandLoopCorpus(HOBBYIST_CARDS)).toBe(false);
    expect(
      isNonScoreHandLoopCorpus(
        "点数 1 到 5 各 4 张。从手牌打出一张，点数加入分数，先到 12 分获胜。",
      ),
    ).toBe(false);
  });
});
