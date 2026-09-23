import { describe, expect, it } from "vitest";
import type { ShareGateBuild } from "./share-gate";
import {
  GENRE_OBJECT_GAP_PREFIX,
  genreObjectFidelity,
} from "./presentation-floor";
import {
  genreObjectSatisfiedPlanAssumption,
  shareGatePlanAssumption,
  studioShareGateMessage,
} from "./share-gate-copy";
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
        kernel: { type: "score-race-v1" },
        unsupported: [],
      },
    } as unknown as ShareGateBuild["ruleSystem"],
    ...overrides,
  };
}

const kitOkObjectsMissingReason =
  `${GENRE_OBJECT_GAP_PREFIX}：对话体裁需要可见的发言记录区域（transcript），不能只靠主题 kit。`;

describe("studioShareGateMessage", () => {
  it("is ok when share gate passes", () => {
    expect(studioShareGateMessage(build()).kind).toBe("ok");
  });

  it("keys kit-ok / objects-missing off the Presentation Floor reason SSOT", () => {
    const message = studioShareGateMessage(build({
      presentationFloor: {
        status: "failed",
        reason: kitOkObjectsMissingReason,
        visuals: [{ provenance: "kit", label: "程序化主题 kit" }],
      },
    }));
    expect(message.kind).toBe("presentation-genre-objects");
    expect(message.reason).toBe(kitOkObjectsMissingReason);
    expect(message.reason).toContain(GENRE_OBJECT_GAP_PREFIX);
    expect(message.nextStep).toMatch(/补上|修好/);
    expect(message.nextStep).not.toMatch(/再贴.*就能|换主题就能/);
    expect(message.nextStep).toMatch(/主题 kit|换主题/);
  });

  it("allows kit / image guidance only when visuals themselves are missing", () => {
    const message = studioShareGateMessage(build({
      presentationFloor: {
        status: "failed",
        reason: "没有可分享的呈现：请绑定提取/上传图像、生成排版界面，或应用主题 kit。",
        visuals: [],
      },
    }));
    expect(message.kind).toBe("presentation-visual");
    expect(message.nextStep).toMatch(/主题 kit/);
    expect(message.nextStep).toMatch(/物件清单|发言记录/);
  });

  it("does not nudge kit when Playability Floor fails", () => {
    const message = studioShareGateMessage(build({
      playabilityFloor: {
        status: "failed",
        reason: "来源要求对话，但内核是计分赛。",
        genre: "conversation",
        kernelType: "score-race-v1",
      },
    }));
    expect(message.kind).toBe("playability");
    expect(message.reason).toBe("来源要求对话，但内核是计分赛。");
    expect(message.nextStep).toMatch(/ADR 0012/);
    expect(message.nextStep).not.toMatch(/应用主题 kit/);
  });

  it("reuses floor reason strings from genreObjectFidelity (single SSOT)", () => {
    const ruleSystem = {
      name: "灵感接力",
      pitch: "发言写入记录",
      presentation: {
        theme: "rulebook-studio",
        visuals: [{ provenance: "kit", label: "程序化主题 kit" }],
      },
      playSurface: { kind: "conversation", layout: "prompt-and-response", regions: [] },
      entities: [],
      participants: { min: 2, max: 4, default: 3, roles: [] },
      runtimeSupport: {
        status: "executable",
        unsupported: [],
        kernel: {
          type: "conversation-relay-v1",
          maxTurns: 12,
          actions: [{ id: "speak", label: "发言" }],
        },
      },
    } as unknown as RuleSystem;
    const objects = genreObjectFidelity(ruleSystem);
    expect(objects.status).toBe("failed");
    const message = studioShareGateMessage(build({
      presentationFloor: {
        status: "failed",
        reason: objects.reason,
        visuals: [{ provenance: "kit", label: "程序化主题 kit" }],
      },
    }));
    expect(message.reason).toBe(objects.reason);
    expect(message.kind).toBe("presentation-genre-objects");
  });
});

describe("shareGatePlanAssumption", () => {
  it("states ADR 0012 share gate and rejects kit-as-fix", () => {
    const text = shareGatePlanAssumption();
    expect(text).toMatch(/Playability Floor/);
    expect(text).toMatch(/Presentation Floor/);
    expect(text).toMatch(/ADR 0012/);
    expect(text).toMatch(/再贴 kit|换主题/);
    expect(text).toMatch(/发言记录|手牌|具名区域/);
  });

  it("satisfied assumption still warns against theme-swap sharing", () => {
    const text = genreObjectSatisfiedPlanAssumption("conversation");
    expect(text).toMatch(/conversation/);
    expect(text).toMatch(/Playability Floor/);
    expect(text).toMatch(/换主题/);
    expect(genreObjectSatisfiedPlanAssumption("generic")).toBeNull();
  });
});
