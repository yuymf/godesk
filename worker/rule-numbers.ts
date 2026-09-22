export const RULE_NUMBER_TOKEN = "[0-9一二两三四五六七八九十]+";
export const RULE_NUMBER_WORD_TOKEN =
  `${RULE_NUMBER_TOKEN}|one|two|three|four|five|six|seven|eight|nine`;

const chineseDigits: Record<string, number> = {
  零: 0,
  〇: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
};

export function parseRuleNumber(value: string | undefined) {
  if (!value) return Number.NaN;
  const numeric = Number(value);
  if (Number.isInteger(numeric)) return numeric;
  const tenIndex = value.indexOf("十");
  if (tenIndex >= 0) {
    const tens = tenIndex === 0 ? 1 : chineseDigits[value[tenIndex - 1]];
    const ones = value.slice(tenIndex + 1)
      ? chineseDigits[value.slice(tenIndex + 1)]
      : 0;
    if (Number.isInteger(tens) && Number.isInteger(ones)) {
      return tens * 10 + ones;
    }
  }
  return chineseDigits[value];
}
