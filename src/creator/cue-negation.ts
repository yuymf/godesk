/**
 * Shared "positive cue" matcher: a regex hit is ignored when a negation word
 * sits immediately before it or earlier in the same sentence
 * (e.g. 「非自走棋」「不得使用…赛博机甲默认名」).
 */
export const CUE_NEGATION_NEAR = /(?:非|不是|不要|别用|禁止|不得(?:使用)?|勿|别|不含|排除)/;

/** True if `cues` matches `idea` at least once outside a negated span. */
export function cueMatchIsPositive(idea: string, cues: RegExp): boolean {
  const flags = cues.flags.includes("g") ? cues.flags : `${cues.flags}g`;
  const re = new RegExp(cues.source, flags);
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(idea))) {
    const near = idea.slice(Math.max(0, m.index - 8), m.index);
    if (CUE_NEGATION_NEAR.test(near)) continue;
    const sentStart = Math.max(idea.lastIndexOf("。", m.index) + 1, idea.lastIndexOf("\n", m.index) + 1, 0);
    const sentenceBefore = idea.slice(sentStart, m.index);
    if (CUE_NEGATION_NEAR.test(sentenceBefore)) continue;
    return true;
  }
  return false;
}
