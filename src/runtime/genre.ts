export type SourceGenre =
  | "hidden-role"
  | "hand-play"
  | "conversation"
  | "placement"
  | "generic";

export function inferSourceGenre(corpus: string): SourceGenre {
  const text = corpus;
  if (
    /剧本杀|谁是凶手|隐藏身份|身份牌|指控|hidden[- ]role|murderer|accuse(?:s|d)? (?:a |the )?player/i
      .test(text)
  ) {
    return "hidden-role";
  }
  // W4-05: carefully broaden hand-play cues so near-misses like「出牌计分」「打牌」
  // do not fall through to generic → silent score-race. False-positive budget:
  // these tokens strongly imply a card loop in hobbyist briefs.
  // Do NOT include bare「牌库」here: finite shuffled draw-and-score briefs also
  // say 牌库 / deck; that path must stay source-anchored draw-and-score, not hand-play.
  if (
    /手牌|出牌区|出牌|打牌|卡牌|从手牌打出|play (?:a |one )?card from (?:your )?hand|hidden hands?|card game|playing cards?/i
      .test(text)
  ) {
    return "hand-play";
  }
  if (
    /派遣伙计|工人放置|放到资源区|worker placement|harbor voyage|港口航线/i
      .test(text)
  ) {
    return "placement";
  }
  if (
    /共同创意|灵感接力|公开发言|发言记录|conversation relay|shared idea/i
      .test(text)
  ) {
    return "conversation";
  }
  return "generic";
}

/**
 * W4-05 — weak genre cues that did not win `inferSourceGenre` but still imply
 * cards / placement / hidden-role / conversation. When these coexist with a
 * point harvest, refuse silent `score-race-v1` share (ADR 0012 / FP4).
 * True generic point races (no such cues) return false.
 */
export function hasWeakGenreScoreRaceLeak(corpus: string): boolean {
  if (inferSourceGenre(corpus) !== "generic") return false;
  const weakCard =
    /洗牌|牌局|扑克|trick[- ]tak|\bdeck\b|\bcards?\b/i.test(corpus);
  const weakPlacement =
    /资源区|放置工人|工人到|区域行动|place(?:s|d)? workers?|worker(?:s)? (?:on|onto|to)\b/i.test(
      corpus,
    );
  const weakRole =
    /身份|凶手|侦探|狼人|hidden identity/i.test(corpus);
  const weakConversation =
    /发言|口述|创意点子|speak aloud|conversation game|transcript/i.test(corpus);
  return weakCard || weakPlacement || weakRole || weakConversation;
}
