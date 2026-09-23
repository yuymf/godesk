import type {
  PlayabilityFloorReadiness,
  PlaySurfaceKind,
  RuleSystem,
} from "../creator/project-contract";
import {
  hasWeakGenreScoreRaceLeak,
  inferSourceGenre,
  type SourceGenre,
} from "./genre";
import { isNonScoreHandLoopCorpus } from "./hand-play";
import {
  isEconomyPlacementCorpus,
  kernelHasPlacementEconomy,
} from "./worker-placement";

export type { PlayabilityFloorReadiness };

const SHAREABLE_KERNELS = new Set([
  "hidden-role-v1",
  "hand-play-v1",
  "conversation-relay-v1",
  "harbor-voyage-v1",
  "worker-placement-v1",
]);

const SURFACES_FOR_KERNEL: Record<string, PlaySurfaceKind[]> = {
  "hidden-role-v1": ["conversation", "hybrid"],
  "hand-play-v1": ["cards"],
  "conversation-relay-v1": ["conversation"],
  "harbor-voyage-v1": ["table"],
  "worker-placement-v1": ["table"],
};

const GENRE_KERNEL: Record<Exclude<SourceGenre, "generic">, string | readonly string[]> = {
  "hidden-role": "hidden-role-v1",
  "hand-play": "hand-play-v1",
  conversation: "conversation-relay-v1",
  placement: ["harbor-voyage-v1", "worker-placement-v1"],
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

type ExecutableKernel = Extract<
  RuleSystem["runtimeSupport"],
  { status: "executable" }
>["kernel"];

/**
 * ADR 0012 decision density: genre kernels must carry non-scalar contracts
 * (hands, regions/occupancy, speech, roles+accuse). Kernel *type* alone is
 * not enough — an empty contract fails the share gate.
 */
export function decisionDensityGap(
  kernel: ExecutableKernel,
  ruleSystem: RuleSystem,
): string | null {
  switch (kernel.type) {
    case "hand-play-v1": {
      if (
        kernel.cardValues.length < 1 ||
        kernel.handSize < 1 ||
        kernel.copiesPerValue < 1 ||
        !kernel.actions.some((action) => action.id === "play")
      ) {
        return "hand-play-v1 缺少非空手牌契约，决策密度不足。";
      }
      return null;
    }
    case "worker-placement-v1": {
      if (kernel.regions.length < 2) {
        return "worker-placement-v1 需要至少 2 个可放置区域，决策密度不足。";
      }
      if (!kernel.regions.some((region) => region.capacity >= 1)) {
        return "worker-placement-v1 区域无法改变占用，决策密度不足。";
      }
      return null;
    }
    case "conversation-relay-v1": {
      if (kernel.maxTurns < 1 || kernel.actions.length < 1) {
        return "conversation-relay-v1 缺少可写入发言内容的动作或回合预算，决策密度不足。";
      }
      return null;
    }
    case "hidden-role-v1": {
      if (kernel.roles.length < 2) {
        return "hidden-role-v1 缺少角色分配，决策密度不足。";
      }
      const hasCulprit = kernel.roles.some((role) => role.alignment === "culprit");
      const hasTown = kernel.roles.some((role) => role.alignment === "town");
      if (!hasCulprit || !hasTown) {
        return "hidden-role-v1 需要凶手与小镇两侧身份才能形成指控决策。";
      }
      const accuseInActions = ruleSystem.actions.some(
        (action) =>
          action.id === "accuse" ||
          /指控|accuse/i.test(`${action.label} ${action.description}`),
      );
      const accuseInStages = ruleSystem.stages.some(
        (stage) => stage.id === "accuse" || /指控|accuse/i.test(stage.name),
      );
      if (!accuseInActions && !accuseInStages) {
        return "hidden-role-v1 缺少指控路径，决策密度不足。";
      }
      return null;
    }
    case "harbor-voyage-v1": {
      if (kernel.playerCount < 2) {
        return "harbor-voyage-v1 需要至少 2 名玩家才能形成港口放置决策。";
      }
      return null;
    }
    default:
      return null;
  }
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
  if (required) {
    const allowed = typeof required === "string" ? [required] : required;
    if (!allowed.includes(kernelType)) {
      return {
        status: "failed",
        reason: `来源体裁是 ${genre}，不能用 ${kernelType} 换皮分享。`,
        genre,
        kernelType,
      };
    }
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

  // W4-05: weak genre cues + score-race = silent leakage. Refuse share.
  if (
    kernelType === "score-race-v1" &&
    hasWeakGenreScoreRaceLeak(ruleSystemCorpus(ruleSystem))
  ) {
    return {
      status: "failed",
      reason:
        "来源含弱体裁信号（卡牌/放置/身份/对话），不能静默用计分赛换皮分享。",
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
    const densityGap = decisionDensityGap(
      ruleSystem.runtimeSupport.kernel,
      ruleSystem,
    );
    if (densityGap) {
      return {
        status: "failed",
        reason: densityGap,
        genre,
        kernelType,
      };
    }
    if (
      kernelType === "worker-placement-v1" &&
      ruleSystem.runtimeSupport.status === "executable" &&
      isEconomyPlacementCorpus(ruleSystemCorpus(ruleSystem))
    ) {
      const kernel = ruleSystem.runtimeSupport.kernel;
      if (
        kernel.type !== "worker-placement-v1" ||
        !kernelHasPlacementEconomy(kernel)
      ) {
        return {
          status: "failed",
          reason:
            "来源要求资源兑换/建成建筑，不能用放置计分冒充建筑胜利。",
          genre,
          kernelType,
        };
      }
    }
    if (
      kernelType === "hand-play-v1" &&
      isNonScoreHandLoopCorpus(ruleSystemCorpus(ruleSystem))
    ) {
      return {
        status: "failed",
        reason:
          "来源是吃墩/出完手牌/花色效果等非计分手牌环，不能用出牌计分冒充分享。",
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
