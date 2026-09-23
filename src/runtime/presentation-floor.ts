import type {
  PresentationFloorReadiness,
  RuleSystem,
  VisualTreatment,
} from "../creator/project-contract";
import { inferSourceGenre, type SourceGenre } from "./genre";
import { ruleSystemCorpus } from "./playability-floor";

export type { PresentationFloorReadiness };

export type GenreObjectFamily =
  | "conversation"
  | "hand-play"
  | "placement"
  | "hidden-role"
  | "generic";

export type GenreObjectFidelity = {
  status: "passed" | "failed";
  reason: string;
  family: GenreObjectFamily;
  missing: string[];
};

/** Distinctive Presentation Floor fail prefix — Studio copy keys off this (W3-06). */
export const GENRE_OBJECT_GAP_PREFIX = "桌子好看但还不是那款游戏";

export function hasBoundImage(ruleSystem: RuleSystem) {
  return Boolean(
    ruleSystem.presentation.image?.url ||
    ruleSystem.entities.some((entity) => entity.image?.url) ||
    ruleSystem.playSurface.regions.some((region) => region.image?.url),
  );
}

function entityBlob(ruleSystem: RuleSystem) {
  return ruleSystem.entities.map((entity) => `${entity.id} ${entity.name}`).join("\n");
}

function regionBlob(ruleSystem: RuleSystem) {
  return ruleSystem.playSurface.regions
    .map((region) => `${region.id} ${region.name}`)
    .join("\n");
}

function executableKernel(ruleSystem: RuleSystem) {
  return ruleSystem.runtimeSupport.status === "executable"
    ? ruleSystem.runtimeSupport.kernel
    : null;
}

/** Resolve which genre objects Presentation Floor must see (ADR 0012 / FP5–FP6). */
export function presentationGenreFamily(ruleSystem: RuleSystem): GenreObjectFamily {
  const kernel = executableKernel(ruleSystem);
  if (kernel) {
    if (kernel.type === "conversation-relay-v1") return "conversation";
    if (kernel.type === "hand-play-v1") return "hand-play";
    if (kernel.type === "harbor-voyage-v1" || kernel.type === "worker-placement-v1") {
      return "placement";
    }
    if (kernel.type === "hidden-role-v1") return "hidden-role";
  }
  const genre: SourceGenre = inferSourceGenre(ruleSystemCorpus(ruleSystem));
  if (genre === "generic") return "generic";
  return genre;
}

function hasTranscriptObject(ruleSystem: RuleSystem) {
  return /transcript|发言记录|发言区|接力记录/i.test(
    `${entityBlob(ruleSystem)}\n${regionBlob(ruleSystem)}`,
  );
}

function hasHandPlayObjects(ruleSystem: RuleSystem) {
  const blob = `${entityBlob(ruleSystem)}\n${regionBlob(ruleSystem)}`;
  const hand = /entity-hand|\bhand\b|手牌/i.test(blob);
  const play = /entity-play-area|play[- ]?area|出牌区|出牌/i.test(blob);
  return hand || play;
}

function hasPlacementRegions(ruleSystem: RuleSystem) {
  const kernel = executableKernel(ruleSystem);
  if (kernel?.type === "harbor-voyage-v1") {
    // Harbor Room board is the genre object; regions in Rule System remain preferred.
    return true;
  }
  if (kernel?.type === "worker-placement-v1" && kernel.regions.length > 0) {
    return true;
  }
  if (ruleSystem.playSurface.regions.some((region) => region.name.trim())) {
    return true;
  }
  return ruleSystem.entities.some(
    (entity) =>
      entity.id.startsWith("entity-region-") ||
      /区域|格子|航线|栈桥|region|spot|slot|zone/i.test(entity.name),
  );
}

function hasHiddenRoleAffordances(ruleSystem: RuleSystem) {
  const kernel = executableKernel(ruleSystem);
  const seatRoles =
    ruleSystem.participants.roles.length > 0 ||
    (kernel?.type === "hidden-role-v1" && kernel.roles.length > 0);
  const privateRole =
    /entity-role|身份牌|role card|hidden role/i.test(entityBlob(ruleSystem)) ||
    ruleSystem.participants.roles.length > 0 ||
    (kernel?.type === "hidden-role-v1" && kernel.roles.length > 0);
  return seatRoles && privateRole;
}

/**
 * Genre object checklist for share/presentation fidelity.
 * Kit theme / bound image make the table legible; these objects make it that game.
 */
export function genreObjectFidelity(ruleSystem: RuleSystem): GenreObjectFidelity {
  const family = presentationGenreFamily(ruleSystem);
  if (family === "generic") {
    return {
      status: "passed",
      reason: "通用 / 计分赛体裁不额外要求体裁物件。",
      family,
      missing: [],
    };
  }
  if (family === "conversation") {
    if (hasTranscriptObject(ruleSystem)) {
      return {
        status: "passed",
        reason: "对话体裁已具备可见发言记录物件。",
        family,
        missing: [],
      };
    }
    return {
      status: "failed",
      reason:
        `${GENRE_OBJECT_GAP_PREFIX}：对话体裁需要可见的发言记录区域（transcript），不能只靠主题 kit。`,
      family,
      missing: ["transcript"],
    };
  }
  if (family === "hand-play") {
    if (hasHandPlayObjects(ruleSystem)) {
      return {
        status: "passed",
        reason: "卡牌体裁已具备手牌或出牌区物件。",
        family,
        missing: [],
      };
    }
    return {
      status: "failed",
      reason:
        `${GENRE_OBJECT_GAP_PREFIX}：卡牌体裁需要手牌和/或出牌区，不能只靠主题 kit。`,
      family,
      missing: ["hand-or-play-area"],
    };
  }
  if (family === "placement") {
    if (hasPlacementRegions(ruleSystem)) {
      return {
        status: "passed",
        reason: "放置体裁已具备具名区域 / 槽位。",
        family,
        missing: [],
      };
    }
    return {
      status: "failed",
      reason:
        `${GENRE_OBJECT_GAP_PREFIX}：放置 / 桌面体裁需要具名区域或槽位，不能只靠主题 kit。`,
      family,
      missing: ["named-regions"],
    };
  }
  // hidden-role
  if (hasHiddenRoleAffordances(ruleSystem)) {
    return {
      status: "passed",
      reason: "隐藏身份体裁已具备席位与私密身份物件。",
      family,
      missing: [],
    };
  }
  return {
    status: "failed",
    reason:
      `${GENRE_OBJECT_GAP_PREFIX}：隐藏身份体裁需要席位与私密身份牌/角色，不能只靠主题 kit。`,
    family,
    missing: ["seat-role"],
  };
}

export function presentationFloor(ruleSystem: RuleSystem): PresentationFloorReadiness {
  const visuals: VisualTreatment[] = ruleSystem.presentation.visuals?.length
    ? ruleSystem.presentation.visuals
    : [];
  const visual = visuals[0];
  if (!visual) {
    return {
      status: "failed",
      reason: "没有可分享的呈现：请绑定提取/上传图像、生成排版界面，或应用主题 kit。",
      visuals,
    };
  }
  if (visual.provenance === "kit") {
    if (!ruleSystem.presentation.theme.trim()) {
      return {
        status: "failed",
        reason: "主题 kit 缺少 theme，不能作为 Presentation Floor。",
        visuals,
      };
    }
  } else if (!hasBoundImage(ruleSystem)) {
    return {
      status: "failed",
      reason: "generated、extracted 或 uploaded 呈现必须绑定真实图像，不能只写 provenance。",
      visuals,
    };
  }

  const objects = genreObjectFidelity(ruleSystem);
  if (objects.status !== "passed") {
    return {
      status: "failed",
      reason: objects.reason,
      visuals,
    };
  }

  return {
    status: "passed",
    reason: `${visual.label} 已满足 Presentation Floor。`,
    visuals,
  };
}
