import { describe, expect, it } from "vitest";
import { answerRuleQuestion } from "./rules";

describe("grounded rules helper", () => {
  it("answers known rules with a citation", () => {
    const answer = answerRuleQuestion("海盗什么时候得分？");
    expect(answer.certain).toBe(true);
    expect(answer.citation).toContain("原型规则");
    expect(answer.answer).toContain("13");
  });

  it("does not invent an answer outside the bundled rules", () => {
    const answer = answerRuleQuestion("台风会让保险翻倍吗？");
    expect(answer.certain).toBe(false);
    expect(answer.citation).toBeNull();
    expect(answer.answer).toContain("没有找到明确答案");
  });
});
