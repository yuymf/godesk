/**
 * Wave4 refuse reasons must stay visible on the hobbyist Generation Plan
 * (pending 「这局还做不到」), not only in job warnings (W5-01 / FP4).
 */

export const REFUSE_NON_SCORE_HAND =
  "来源是吃墩/出完手牌/花色效果等非计分手牌环；hand-play-v1 仅支持出牌计分，Rule System 保持 draft，不会用出牌计分顶替分享。";

export const REFUSE_MULTI_ACT_HIDDEN_ROLE =
  "来源是多幕/线索板剧本杀；hidden-role-v1 仅支持单轮发言→指控→揭晓，Rule System 保持 draft，不会用单轮环顶替分享。";

export const REFUSE_WEAK_GENRE_SCORE_RACE =
  "来源含弱体裁信号（卡牌/放置/身份/对话），不能静默配置 score-race-v1；Rule System 保持 draft，请改写为明确体裁或纯计分赛。";

export type GenerationRefuseKind =
  | "non-score-hand"
  | "multi-act-hidden-role"
  | "weak-genre-score-race";

export function generationRefuseReason(
  kind: GenerationRefuseKind,
): string {
  switch (kind) {
    case "non-score-hand":
      return REFUSE_NON_SCORE_HAND;
    case "multi-act-hidden-role":
      return REFUSE_MULTI_ACT_HIDDEN_ROLE;
    case "weak-genre-score-race":
      return REFUSE_WEAK_GENRE_SCORE_RACE;
  }
}
