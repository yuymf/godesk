import { describe, expect, it } from "vitest";
import {
  inferRequestedMechanics,
  mechanicsCapabilityGap,
} from "./kernel-capabilities";
import { BASELINE_PROMPTS } from "./fixtures/game-spec";

/** Off-corpus / unseen prompts used by Sol max PR10 release gate. */
const UNSEEN_PROMPTS = [
  "做一款线路网络桌游，玩家铺设路线连接城市",
  "做一款卡牌区域控制游戏，玩家出牌争夺区域",
  "随便做个桌游",
] as const;

describe("inferRequestedMechanics — baseline vs unseen", () => {
  it("binds hex-settlement only for Catan-shaped baseline prompts", () => {
    expect(inferRequestedMechanics(BASELINE_PROMPTS[0])).toEqual(["hex-settlement"]);
    expect(inferRequestedMechanics(BASELINE_PROMPTS[1])).toEqual(["disc-flipping"]);
  });

  it.each(UNSEEN_PROMPTS)(
    "never infers hex-settlement or disc-flipping from unseen prompt: %s",
    (prompt) => {
      const mechanics = inferRequestedMechanics(prompt);
      expect(mechanics).not.toContain("hex-settlement");
      expect(mechanics).not.toContain("disc-flipping");
      // No game keyword → no silent Catan/Othello mechanic declaration.
      expect(mechanics).toEqual([]);
    },
  );

  it("gameSpecCapabilityGap for unseen prompts without declared mechanics is null (no false Catan gap)", () => {
    for (const prompt of UNSEEN_PROMPTS) {
      // Empty inferred mechanics → no capability demand for hex/disc kernels.
      expect(mechanicsCapabilityGap(inferRequestedMechanics(prompt))).toBeNull();
    }
  });
});
