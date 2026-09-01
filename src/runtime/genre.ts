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
  if (
    /手牌|出牌区|从手牌打出|play (?:a |one )?card from (?:your )?hand|hidden hands?/i
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
