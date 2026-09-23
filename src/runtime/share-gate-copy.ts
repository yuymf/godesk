import type { ShareGateBuild } from "./share-gate";
import { shareGateRefusal } from "./share-gate";
import {
  GENRE_OBJECT_GAP_PREFIX,
  type GenreObjectFamily,
} from "./presentation-floor";

export type StudioShareGateKind =
  | "ok"
  | "presentation-genre-objects"
  | "presentation-visual"
  | "playability"
  | "runtime";

export type StudioShareGateMessage = {
  title: string;
  /** Floor / gate reason — reuse Presentation/Playability Floor SSOT verbatim. */
  reason: string;
  /** Creator next step; never “再贴 kit / 换主题就能过” when objects are the gap. */
  nextStep: string;
  kind: StudioShareGateKind;
};

const TITLE_BLOCKED = "这一版还不能分享";

/**
 * Studio-facing share / presentation / playability copy.
 * Reasons come from the floors; this helper only chooses honest next-step guidance
 * (ADR 0012: share = playability + genre fidelity, not kit cosmetics).
 */
export function studioShareGateMessage(build: ShareGateBuild): StudioShareGateMessage {
  const refusal = shareGateRefusal(build);
  if (!refusal) {
    return { title: "可以分享", reason: "", nextStep: "", kind: "ok" };
  }

  if (refusal.error === "playability_floor_unmet") {
    return {
      title: TITLE_BLOCKED,
      reason: refusal.playabilityFloor.reason,
      nextStep:
        "分享门闩是可玩性 + 体裁忠实（ADR 0012），不是再贴主题 kit。请按上方原因补齐与来源体裁匹配的 Executable Kernel / 核心循环，再编译后分享。",
      kind: "playability",
    };
  }

  if (refusal.error === "visual_floor_unmet") {
    const reason = refusal.presentationFloor.reason;
    if (reason.includes(GENRE_OBJECT_GAP_PREFIX)) {
      return {
        title: TITLE_BLOCKED,
        reason,
        nextStep:
          "主题 kit / 换主题过不了分享门闩。请补上或修好该体裁的可见物件（发言记录、手牌/出牌区、具名区域或席位身份），再编译后分享。",
        kind: "presentation-genre-objects",
      };
    }
    return {
      title: TITLE_BLOCKED,
      reason,
      nextStep:
        "先让桌子可读：绑定提取/上传图像、生成排版界面，或应用主题 kit。体裁仍须通过 Presentation Floor 的物件清单；kit 不能顶替发言记录 / 手牌 / 区域。",
      kind: "presentation-visual",
    };
  }

  return {
    title: TITLE_BLOCKED,
    reason: "还没有可执行内核，不能把未完成的规则当作可玩成品分享。",
    nextStep:
      "在 Studio 配置与来源体裁匹配的 Executable Kernel 后再分享；不要用换皮计分赛顶替。",
    kind: "runtime",
  };
}

/** Generation Plan creator-facing reminder (ADR 0012); shown in Studio assumptions. */
export function shareGatePlanAssumption(): string {
  return "分享门闩 = Playability Floor + Presentation Floor（含体裁物件）。主题 kit 只解决「桌子好看」，再贴 kit / 换主题不能顶替发言记录、手牌/出牌区或具名区域（ADR 0012）。";
}

/** When objects are already present, keep creators from mistaking kit polish for share readiness. */
export function genreObjectSatisfiedPlanAssumption(family: GenreObjectFamily): string | null {
  if (family === "generic") return null;
  return `Presentation Floor：${family} 体裁物件已识别。分享仍须 Playability Floor；不要以为再换主题就能过门闩。`;
}
