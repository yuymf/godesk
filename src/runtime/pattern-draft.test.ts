import { describe, expect, it } from "vitest";
import { isPatternDraftCorpus } from "./pattern-draft";
import { generationRefuseReason, REFUSE_PATTERN_DRAFT } from "./generation-refuse";

describe("T009 pattern-draft corpus", () => {
  it("detects factory + pattern-wall style briefs", () => {
    expect(
      isPatternDraftCorpus(
        "从工厂展示拿同色瓷砖放入准备行；满行贴到纹样墙得分，地板扣分。",
      ),
    ).toBe(true);
  });
  it("ignores unrelated turn-taking briefs", () => {
    expect(isPatternDraftCorpus("三位玩家轮流发言扩展同一个点子。")).toBe(false);
  });
  it("exposes an honest refuse reason", () => {
    expect(generationRefuseReason("pattern-draft")).toBe(REFUSE_PATTERN_DRAFT);
  });
});
