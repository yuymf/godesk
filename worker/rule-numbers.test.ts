import { describe, expect, it } from "vitest";
import { parseRuleNumber } from "./rule-numbers";

describe("parseRuleNumber", () => {
  it("reads arabic, Chinese, and English numerals", () => {
    expect(parseRuleNumber("15")).toBe(15);
    expect(parseRuleNumber("一")).toBe(1);
    expect(parseRuleNumber("两")).toBe(2);
    expect(parseRuleNumber("十")).toBe(10);
    expect(parseRuleNumber("十一")).toBe(11);
    expect(parseRuleNumber("二十")).toBe(20);
    expect(parseRuleNumber("二十三")).toBe(23);
    expect(parseRuleNumber("two")).toBe(2);
  });

  it("returns a non-integer for missing or unknown tokens", () => {
    expect(Number.isInteger(parseRuleNumber(undefined))).toBe(false);
    expect(Number.isInteger(parseRuleNumber("行动"))).toBe(false);
  });
});
