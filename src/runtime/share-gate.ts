import { validateGameSpec } from "../creator/game-spec";
import type {
  PlayabilityFloorReadiness,
  PresentationFloorReadiness,
  RuleSystem,
} from "../creator/project-contract";

export type ShareGateBuild = {
  presentationFloor: PresentationFloorReadiness;
  playabilityFloor: PlayabilityFloorReadiness;
  ruleSystem: Pick<RuleSystem, "runtimeSupport" | "generation" | "gameSpec">;
};

export type ShareGateRefusal =
  | {
      error: "visual_floor_unmet";
      presentationFloor: PresentationFloorReadiness;
    }
  | {
      error: "playability_floor_unmet";
      playabilityFloor: PlayabilityFloorReadiness;
    }
  | { error: "runtime_not_executable" };

/**
 * Studio + worker share gate: both floors passed and an executable kernel.
 * When both floors fail, prefer playability (ADR 0012: share gate is genre
 * honesty / that-game fidelity, not merely visual kit or genre-object gaps).
 */
export function shareGateRefusal(build: ShareGateBuild): ShareGateRefusal | null {
  if ((build.ruleSystem.generation || build.ruleSystem.gameSpec) && !validateGameSpec(build.ruleSystem.gameSpec).valid) {
    return { error: "playability_floor_unmet", playabilityFloor: { ...build.playabilityFloor, status: "failed", reason: "GameSpec 校验失败；请修正规则后重新构建。" } };
  }
  if (build.playabilityFloor.status !== "passed") {
    return {
      error: "playability_floor_unmet",
      playabilityFloor: build.playabilityFloor,
    };
  }
  if (build.presentationFloor.status !== "passed") {
    return {
      error: "visual_floor_unmet",
      presentationFloor: build.presentationFloor,
    };
  }
  if (build.ruleSystem.runtimeSupport.status !== "executable") {
    return { error: "runtime_not_executable" };
  }
  return null;
}

export function buildMeetsShareGate(build: ShareGateBuild): boolean {
  return shareGateRefusal(build) === null;
}
