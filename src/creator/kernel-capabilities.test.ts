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
      ["拍卖竞价汐屿六角岛", "hex-settlement-v1"],
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
  it("binds hex-settlement only for hex-island-shaped baseline prompts", () => {
    expect(inferRequestedMechanics(BASELINE_PROMPTS[0])).toEqual(["hex-settlement"]);
    expect(inferRequestedMechanics("帮我生成一个汐屿六角岛游戏")).toEqual(["hex-settlement"]);
    expect(inferRequestedMechanics(BASELINE_PROMPTS[1])).toEqual(["disc-flipping"]);
  });

  it.each(["帮我生成一个黑白棋游戏", "做一款翻转棋 othello"])(
    "binds north-star Othello to disc-flipping only: %s",
    (prompt) => {
      const mechanics = inferRequestedMechanics(prompt);
      expect(mechanics).toEqual(["disc-flipping"]);
      expect(mechanicsCapabilityGap(mechanics, "disc-flipping-v1")).toBeNull();
      for (const kernel of ["auction-bidding-v1", "hex-settlement-v1", "hand-play-v1", "network-route-v1"]) {
        expect(mechanicsCapabilityGap(mechanics, kernel)).toContain("能力缺口");
      }
    },
  );

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


describe("Tide Arena / auto-battler mechanics", () => {
  it("binds 自走棋 / 潮阵 cues to auto-battler only", () => {
    for (const prompt of [
      "做一款两人自走棋，商店买棋上阵自动打架",
      "潮阵自动战斗",
      "Tide Arena auto-battler",
      "备战席买棋上阵",
    ]) {
      expect(inferRequestedMechanics(prompt)).toEqual(["auto-battler"]);
    }
    expect(mechanicsCapabilityGap(["auto-battler"], "auto-battler-v1")).toBeNull();
  });
});

describe("BOT_PLAYABLE_KERNELS", () => {
  it("seats the computer in the last seat only for bot-playable executable kernels", async () => {
    const { computerSeatForRuleSystem } = await import("./kernel-capabilities");
    expect(computerSeatForRuleSystem({ runtimeSupport: { status: "executable", unsupported: [], kernel: { type: "auto-battler-v1", playerCount: 2 } } } as never)).toBe(1);
    expect(computerSeatForRuleSystem({ runtimeSupport: { status: "executable", unsupported: [], kernel: { type: "hex-settlement-v1", playerCount: 3 } } } as never)).toBe(2);
    expect(computerSeatForRuleSystem({ runtimeSupport: { status: "executable", unsupported: [], kernel: { type: "turn-taking-v1", maxTurns: 4, actions: [] } } } as never)).toBeNull();
    expect(computerSeatForRuleSystem({ runtimeSupport: { status: "draft", unsupported: [] } } as never)).toBeNull();
  });
});
