import type {
  PresentationFloorReadiness,
  RuleSystem,
  VisualTreatment,
} from "../creator/project-contract";

export type { PresentationFloorReadiness };

export function hasBoundImage(ruleSystem: RuleSystem) {
  return Boolean(
    ruleSystem.presentation.image?.url ||
    ruleSystem.entities.some((entity) => entity.image?.url) ||
    ruleSystem.playSurface.regions.some((region) => region.image?.url),
  );
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
    return {
      status: "passed",
      reason: `${visual.label} 已满足 Presentation Floor。`,
      visuals,
    };
  }
  if (!hasBoundImage(ruleSystem)) {
    return {
      status: "failed",
      reason: "generated、extracted 或 uploaded 呈现必须绑定真实图像，不能只写 provenance。",
      visuals,
    };
  }
  return {
    status: "passed",
    reason: `${visual.label} 已满足 Presentation Floor。`,
    visuals,
  };
}
