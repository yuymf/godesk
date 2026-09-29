import { describe, expect, it } from "vitest";
import {
  inferRequestedMechanics,
  mechanicsCapabilityGap,
} from "./kernel-capabilities";
import { BASELINE_PROMPTS } from "./fixtures/game-spec";

/** Off-corpus / unseen prompts used by Sol max PR10 release gate. */
const NETWORK_PROMPT = "做一款线路网络桌游，玩家铺设路线连接城市";
const OTHER_UNSEEN_PROMPTS = [
  "做一款卡牌区域控制游戏，玩家出牌争夺区域",
  "随便做个桌游",
] as const;

describe("inferRequestedMechanics — baseline vs unseen", () => {
  it("binds hex-settlement only for Catan-shaped baseline prompts", () => {
    expect(inferRequestedMechanics(BASELINE_PROMPTS[0])).toEqual(["hex-settlement"]);
    expect(inferRequestedMechanics(BASELINE_PROMPTS[1])).toEqual(["disc-flipping"]);
  });

  it("binds route-network for the line-network prompt (never hex/disc)", () => {
    const mechanics = inferRequestedMechanics(NETWORK_PROMPT);
    expect(mechanics).toEqual(["route-network"]);
    expect(mechanics).not.toContain("hex-settlement");
    expect(mechanics).not.toContain("disc-flipping");
    expect(mechanicsCapabilityGap(mechanics)).toBeNull();
  });

  it.each(OTHER_UNSEEN_PROMPTS)(
    "never infers hex-settlement, disc-flipping, or route-network from other unseen prompt: %s",
    (prompt) => {
      const mechanics = inferRequestedMechanics(prompt);
      expect(mechanics).not.toContain("hex-settlement");
      expect(mechanics).not.toContain("disc-flipping");
      expect(mechanics).not.toContain("route-network");
      expect(mechanics).toEqual([]);
    },
  );

  it("gameSpecCapabilityGap for other unseen prompts without declared mechanics is null", () => {
    for (const prompt of OTHER_UNSEEN_PROMPTS) {
      expect(mechanicsCapabilityGap(inferRequestedMechanics(prompt))).toBeNull();
    }
  });
});
