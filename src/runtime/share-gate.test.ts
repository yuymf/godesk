import { describe, expect, it } from "vitest";
import { buildMeetsShareGate, shareGateRefusal } from "./share-gate";
import type { ShareGateBuild } from "./share-gate";
import { playabilityFloor } from "./playability-floor";
import type { RuleSystem } from "../creator/project-contract";

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

  it("prefers playability when both floors fail (ADR 0012 share SSOT)", () => {
    expect(shareGateRefusal(build({
      presentationFloor: { status: "failed", reason: "no visual", visuals: [] },
      playabilityFloor: {
        status: "failed",
        reason: "reskin",
        genre: "hidden-role",
        kernelType: "score-race-v1",
      },
    }))).toEqual({
      error: "playability_floor_unmet",
      playabilityFloor: {
        status: "failed",
        reason: "reskin",
        genre: "hidden-role",
        kernelType: "score-race-v1",
      },
    });
  });

  it("refuses share when Playability Floor fails decision density (W4-04 wire)", () => {
    const ruleSystem = {
      id: "rs",
      version: 1,
      name: "轻放置",
      pitch: "在共享桌面放置工人到资源区。",
      participants: { min: 2, max: 2, default: 2, roles: [] },
      durationMinutes: 10,
      rules: [],
      constraints: [],
      entities: [],
      setup: [],
      actions: [],
      playSurface: { kind: "table" as const, layout: "worker-placement", regions: [] },
      stages: [],
      outcomes: [],
      presentation: { theme: "kit", visuals: [{ provenance: "kit" as const, label: "kit" }] },
      runtimeSupport: {
        status: "executable" as const,
        unsupported: [],
        kernel: {
          type: "worker-placement-v1" as const,
          playerCount: 2,
          workersPerSeat: 2,
          startingCoins: 0,
          regions: [],
          victoryTarget: null,
          victoryBuildings: null,
        },
      },
    } satisfies RuleSystem;
    const floor = playabilityFloor(ruleSystem);
    expect(floor.status).toBe("failed");
    expect(floor.reason).toMatch(/决策密度|区域/);
    const gateBuild = build({
      playabilityFloor: floor,
      ruleSystem: { runtimeSupport: ruleSystem.runtimeSupport },
    });
    expect(shareGateRefusal(gateBuild)).toMatchObject({
      error: "playability_floor_unmet",
    });
    expect(buildMeetsShareGate(gateBuild)).toBe(false);
  });

});
