import { describe, expect, it } from "vitest";
import {
  inferRequestedMechanics,
  mechanicsCapabilityGap,
} from "./kernel-capabilities";
import { BASELINE_PROMPTS } from "./fixtures/game-spec";

/** Off-corpus / unseen prompts used by Sol max PR10–PR12 release gate. */
const NETWORK_PROMPT = "做一款线路网络桌游，玩家铺设路线连接城市";
const CARD_AREA_PROMPT = "做一款卡牌区域控制游戏，玩家出牌争夺区域";
const AUCTION_PROMPT = "做一款拍卖竞价桌游";
const OTHER_UNSEEN_PROMPTS = [
  "随便做个桌游",
] as const;

describe("inferRequestedMechanics — baseline vs unseen", () => {
  it("binds auction intent only to auction-bidding", () => {
    for (const prompt of [AUCTION_PROMPT, "players bid in an auction", "轮流出价"]) {
      expect(inferRequestedMechanics(prompt)).toEqual(["auction-bidding"]);
    }
    expect(mechanicsCapabilityGap(["auction-bidding"], "auction-bidding-v1")).toBeNull();
    for (const kernel of ["hex-settlement-v1", "disc-flipping-v1", "network-route-v1", "hand-play-v1"]) {
      expect(mechanicsCapabilityGap(["auction-bidding"], kernel)).toContain("能力缺口");
    }
  });
  it("keeps mixed auction and other genre requests visible as a capability gap", () => {
    for (const [prompt, otherKernel] of [
      ["拍卖竞价卡坦岛", "hex-settlement-v1"],
      ["auction with an Othello board", "disc-flipping-v1"],
      ["拍卖竞价线路网络", "network-route-v1"],
      ["拍卖竞价卡牌区域控制", "hand-play-v1"],
    ] as const) {
      const mechanics = inferRequestedMechanics(prompt);
      expect(mechanics).toContain("auction-bidding");
      expect(mechanics).toHaveLength(2);
      expect(mechanicsCapabilityGap(mechanics, otherKernel)).toContain("能力缺口");
      expect(mechanicsCapabilityGap(mechanics, "auction-bidding-v1")).toContain("能力缺口");
    }
  });
  it("binds hex-settlement only for Catan-shaped baseline prompts", () => {
    expect(inferRequestedMechanics(BASELINE_PROMPTS[0])).toEqual(["hex-settlement"]);
    expect(inferRequestedMechanics("帮我生成一个卡坦岛游戏")).toEqual(["hex-settlement"]);
    expect(inferRequestedMechanics(BASELINE_PROMPTS[1])).toEqual(["disc-flipping"]);
  });

  it("binds route-network for the line-network prompt (never hex/disc)", () => {
    const mechanics = inferRequestedMechanics(NETWORK_PROMPT);
    expect(mechanics).toEqual(["route-network"]);
    expect(mechanics).not.toContain("hex-settlement");
    expect(mechanics).not.toContain("disc-flipping");
    expect(mechanicsCapabilityGap(mechanics)).toBeNull();
  });

  it("binds hand-play for the card-area prompt (never hex/disc/route)", () => {
    const mechanics = inferRequestedMechanics(CARD_AREA_PROMPT);
    expect(mechanics).toEqual(["hand-play"]);
    expect(mechanics).not.toContain("hex-settlement");
    expect(mechanics).not.toContain("disc-flipping");
    expect(mechanics).not.toContain("route-network");
    expect(mechanicsCapabilityGap(mechanics)).toBeNull();
  });

  it.each(OTHER_UNSEEN_PROMPTS)(
    "never infers hex-settlement, disc-flipping, route-network, or hand-play from vague unseen prompt: %s",
    (prompt) => {
      const mechanics = inferRequestedMechanics(prompt);
      expect(mechanics).not.toContain("hex-settlement");
      expect(mechanics).not.toContain("disc-flipping");
      expect(mechanics).not.toContain("route-network");
      expect(mechanics).not.toContain("hand-play");
      expect(mechanics).toEqual([]);
    },
  );

  it("gameSpecCapabilityGap for vague unseen prompts without declared mechanics is null", () => {
    for (const prompt of OTHER_UNSEEN_PROMPTS) {
      expect(mechanicsCapabilityGap(inferRequestedMechanics(prompt))).toBeNull();
    }
  });
});
