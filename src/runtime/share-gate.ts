import type {
  PlayabilityFloorReadiness,
  PresentationFloorReadiness,
  RuleSystem,
} from "../creator/project-contract";

export type ShareGateBuild = {
  presentationFloor: PresentationFloorReadiness;
  playabilityFloor: PlayabilityFloorReadiness;
  ruleSystem: Pick<RuleSystem, "runtimeSupport">;
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

/** Studio + worker share gate: both floors passed and an executable kernel. */
export function shareGateRefusal(build: ShareGateBuild): ShareGateRefusal | null {
  if (build.presentationFloor.status !== "passed") {
    return {
      error: "visual_floor_unmet",
      presentationFloor: build.presentationFloor,
    };
  }
  if (build.playabilityFloor.status !== "passed") {
    return {
      error: "playability_floor_unmet",
      playabilityFloor: build.playabilityFloor,
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
