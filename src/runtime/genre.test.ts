import { describe, expect, it } from "vitest";
import {
  hasWeakGenreScoreRaceLeak,
  inferSourceGenre,
} from "./genre";

describe("inferSourceGenre (W4-05 near-miss cues)", () => {
  it("classifies 出牌计分 / 打牌 near-misses as hand-play (not generic)", () => {
    expect(inferSourceGenre("出牌计分。每次出牌得 2 分，先到 10 分。")).toBe(
      "hand-play",
    );
    expect(inferSourceGenre("四个人轮流打牌赢分。出牌得 3 分，先到 12 分。")).toBe(
      "hand-play",
    );
    expect(inferSourceGenre("A card game: play cards for points, first to 8.")).toBe(
      "hand-play",
    );
  });

  it("still classifies strong hand-play cues", () => {
    expect(inferSourceGenre("从手牌打出一张到出牌区。")).toBe("hand-play");
  });

  it("keeps true generic point races as generic", () => {
    expect(
      inferSourceGenre(
        "三人可以调查线索得 2 分或整理线索得 1 分。先到 6 分者胜，共 12 回合。",
      ),
    ).toBe("generic");
    expect(
      inferSourceGenre(
        "Three players can investigate clues for 2 points or organize clues for 1 point. Be the first to reach 6 points in 12 turns.",
      ),
    ).toBe("generic");
  });
});

describe("hasWeakGenreScoreRaceLeak (W4-05)", () => {
  it("flags weak placement / role / conversation cues on generic corpus", () => {
    expect(
      hasWeakGenreScoreRaceLeak(
        "在资源区行动得 2 分，整理得 1 分，先到 8 分。",
      ),
    ).toBe(true);
    expect(
      hasWeakGenreScoreRaceLeak("找出凶手得 3 分，先到 9 分。"),
    ).toBe(true);
    expect(
      hasWeakGenreScoreRaceLeak("轮流发言得 1 分，先到 5 分。"),
    ).toBe(true);
  });

  it("returns false for true generic point races", () => {
    expect(
      hasWeakGenreScoreRaceLeak(
        "三人可以调查线索得 2 分或整理线索得 1 分。先到 6 分者胜。",
      ),
    ).toBe(false);
  });

  it("returns false when a strong genre already won", () => {
    expect(hasWeakGenreScoreRaceLeak("从手牌打出一张到出牌区，点数计分。")).toBe(
      false,
    );
    expect(hasWeakGenreScoreRaceLeak("剧本杀：发言后指控凶手。")).toBe(false);
  });
});
