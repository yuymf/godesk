import type { PlaySurfaceKind, RuleSystem } from "../creator/project-contract";
import { inferSourceGenre, type SourceGenre } from "./genre";

export interface PlayabilityFloorReadiness {
  status: "passed" | "failed";
  reason: string;
  genre: SourceGenre;
  kernelType: string | null;
}

const SHAREABLE_KERNELS = new Set([
  "hidden-role-v1",
  "hand-play-v1",
  "conversation-relay-v1",
  "harbor-voyage-v1",
]);

const SURFACES_FOR_KERNEL: Record<string, PlaySurfaceKind[]> = {
  "hidden-role-v1": ["conversation", "hybrid"],
  "hand-play-v1": ["cards"],
  "conversation-relay-v1": ["conversation"],
  "harbor-voyage-v1": ["table"],
};

const GENRE_KERNEL: Record<Exclude<SourceGenre, "generic">, string> = {
  "hidden-role": "hidden-role-v1",
  "hand-play": "hand-play-v1",
  conversation: "conversation-relay-v1",
  placement: "harbor-voyage-v1",
};

export function ruleSystemCorpus(ruleSystem: RuleSystem) {
  return [
    ruleSystem.name,
    ruleSystem.pitch,
    ...ruleSystem.rules.map((rule) => rule.text),
    ...ruleSystem.actions.map((action) => `${action.label} ${action.description}`),
    ...ruleSystem.outcomes.map((outcome) => outcome.name),
    ruleSystem.playSurface.layout,
  ].join("\n");
}

export function playabilityFloor(ruleSystem: RuleSystem): PlayabilityFloorReadiness {
  const genre = inferSourceGenre(ruleSystemCorpus(ruleSystem));
  if (ruleSystem.runtimeSupport.status !== "executable") {
    return {
      status: "failed",
      reason: "没有可执行内核，不能把未完成的规则当作可玩成品分享。",
      genre,
      kernelType: null,
    };
  }
  const kernelType = ruleSystem.runtimeSupport.kernel.type;
  const required = genre === "generic" ? null : GENRE_KERNEL[genre];
  if (required && kernelType !== required) {
    return {
      status: "failed",
      reason: `来源体裁是 ${genre}，不能用 ${kernelType} 换皮分享。`,
      genre,
      kernelType,
    };
  }
  if (
    (ruleSystem.playSurface.kind === "conversation" ||
      ruleSystem.playSurface.kind === "cards") &&
    (kernelType === "score-race-v1" || kernelType === "shared-goal-v1")
  ) {
    return {
      status: "failed",
      reason: "对话或卡牌表面不能用计分器内核顶替该游戏的核心环。",
      genre,
      kernelType,
    };
  }
  if (SHAREABLE_KERNELS.has(kernelType)) {
    const allowed = SURFACES_FOR_KERNEL[kernelType] ?? [];
    if (!allowed.includes(ruleSystem.playSurface.kind)) {
      return {
        status: "failed",
        reason: `${kernelType} 需要 ${allowed.join(" / ")} Play Surface，而不是共用记分板。`,
        genre,
        kernelType,
      };
    }
    return {
      status: "passed",
      reason: `${kernelType} 已满足 Playability Floor。`,
      genre,
      kernelType,
    };
  }
  if (genre === "generic") {
    return {
      status: "passed",
      reason: `${kernelType} 与来源体裁一致，已满足 Playability Floor。`,
      genre,
      kernelType,
    };
  }
  return {
    status: "failed",
    reason: `${kernelType} 没有专用表面，不能作为该体裁的可分享成品。`,
    genre,
    kernelType,
  };
}
