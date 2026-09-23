import { describe, expect, it } from "vitest";
import { buildMeetsShareGate, shareGateRefusal } from "./share-gate";
import type { ShareGateBuild } from "./share-gate";

function build(
  overrides: Partial<ShareGateBuild> = {},
): ShareGateBuild {
  return {
    presentationFloor: { status: "passed", reason: "ok", visuals: [] },
    playabilityFloor: {
      status: "passed",
      reason: "ok",
      genre: "generic",
      kernelType: "score-race-v1",
    },
    ruleSystem: {
      runtimeSupport: {
        status: "executable",
        unsupported: [],
        kernel: {
          type: "score-race-v1",
          victoryTarget: 8,
          maxTurns: 12,
          actions: [{ id: "a", label: "得分", points: 2 }],
        },
      },
    },
    ...overrides,
  };
}

describe("shareGate", () => {
  it("passes only when both floors and executable kernel agree", () => {
    expect(buildMeetsShareGate(build())).toBe(true);
    expect(shareGateRefusal(build())).toBeNull();
  });

  it("refuses with the same error codes the session create route used", () => {
    expect(shareGateRefusal(build({
      presentationFloor: { status: "failed", reason: "no visual", visuals: [] },
    }))).toEqual({
      error: "visual_floor_unmet",
      presentationFloor: { status: "failed", reason: "no visual", visuals: [] },
    });
    expect(shareGateRefusal(build({
      playabilityFloor: {
        status: "failed",
        reason: "reskin",
        genre: "hidden-role",
        kernelType: "score-race-v1",
      },
    }))).toMatchObject({ error: "playability_floor_unmet" });
    expect(shareGateRefusal(build({
      ruleSystem: { runtimeSupport: { status: "draft", unsupported: [] } },
    }))).toEqual({ error: "runtime_not_executable" });
  });
});
