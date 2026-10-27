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


describe("mechanics cue negation", () => {
  it("does not infer auto-battler from 非自走棋 / 不是 auto-battler", () => {
    expect(inferRequestedMechanics("星际物流竞速（非自走棋默认包、非潮汐）。星港节点派车运货")).not.toContain("auto-battler");
    expect(inferRequestedMechanics("这不是已有 auto-battler 默认包；星港物流车队")).not.toContain("auto-battler");
    expect(inferRequestedMechanics("非棋盘自走棋 HUD；星图节点路线")).not.toContain("auto-battler");
  });
  it("binds H02-like logistics corpus to route-network only", () => {
    const m = inferRequestedMechanics(
      "星港车队。星际物流竞速（非自走棋、非潮汐棋盘）。玩家在星港节点间派车运货，货运合约。星图节点 + 路线高亮。",
    );
    expect(m).toEqual(["route-network"]);
    expect(m).not.toContain("auto-battler");
  });
  it("does not infer hex from 非六角结算-style negation when no positive hex cue", () => {
    expect(inferRequestedMechanics("做一款竞速，非六角资源建造")).not.toContain("hex-settlement");
  });
  it("does not infer auction from 不是拍卖 when no positive auction cue", () => {
    expect(inferRequestedMechanics("做一款竞速，不是拍卖竞价")).not.toContain("auction-bidding");
  });
});

describe("Tide Arena / auto-battler mechanics", () => {
  it("binds 自走棋 / 潮阵 / 机甲 cues to auto-battler only", () => {
    for (const prompt of [
      "做一款两人自走棋，商店买棋上阵自动打架",
      "潮阵自动战斗",
      "Tide Arena auto-battler",
      "备战席买棋上阵",
      "赛博机甲自走棋",
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


describe("route-network ticket/rail cues", () => {
  it("binds 车票/车厢/认领路线/铺线/铁道 corpus to route-network only", () => {
    const book = `洲际铁道。收集彩色车厢牌，支付认领路线；持有车票连通起终点得分。铺线，非自走棋。`;
    expect(inferRequestedMechanics(book)).toEqual(["route-network"]);
  });
  it("does not need logistics tokens when rail cues are present", () => {
    expect(inferRequestedMechanics("认领路线并铺线，用车厢与车票连通城市")).toEqual(["route-network"]);
  });
});


describe("gem-engine cues", () => {
  it("binds gem-token / development / noble corpus to gem-engine", () => {
    const m = inferRequestedMechanics(
      "宝石作坊。拿宝石代币买发展牌获得永久折扣，贵族拜访，先到声望15。",
    );
    expect(m).toEqual(["gem-engine"]);
  });
});
