import { describe, expect, it } from "vitest";
import {
  AUTO_BATTLER_MECHANIC_CUES,
  packMentionsAutoBattler,
  packToContentPatch,
  resolveAutoBattlerPack,
} from "./auto-battler-packs";

describe("auto-battler packs", () => {
  it("mechanic cues cover 自走棋 without requiring tide words", () => {
    expect(AUTO_BATTLER_MECHANIC_CUES.test("做一款两人自走棋，商店买棋上阵自动打架")).toBe(true);
    expect(packMentionsAutoBattler("赛博机甲自走棋")).toBe(true);
  });

  it("selects cyber pack from 机甲/赛博 cues", () => {
    const pack = resolveAutoBattlerPack("做一款赛博机甲自走棋，两人商店买棋上阵自动打架");
    expect(pack.id).toBe("cyber");
    expect(pack.theme.preset).toBe("night");
    expect(pack.branding.title).toContain("机甲");
    const patch = packToContentPatch(pack);
    expect(patch.units?.some((u) => u.name.includes("机") || u.name.includes("刃") || u.name.includes("盾"))).toBe(true);
    expect(patch.traits?.every((t) => !["潮汐", "珊瑚咒", "远航", "硬壳"].includes(t.label))).toBe(true);
  });

  it("packMentionsAutoBattler ignores negated 自走棋", () => {
    expect(packMentionsAutoBattler("星际物流竞速（非自走棋默认包）。星港节点派车运货")).toBe(false);
    expect(packMentionsAutoBattler("做一款两人自走棋，商店买棋上阵")).toBe(true);
    expect(packMentionsAutoBattler("这不是已有 auto-battler 默认包能冒充的题材；星港物流")).toBe(false);
  });

  it("defaults to tide pack when no genre cue", () => {
    expect(resolveAutoBattlerPack("做一款两人自走棋，商店买棋上阵自动打架").id).toBe("tide");
  });

  it("ignores negated cyber/tide cues (hardness T002)", () => {
    const pack = resolveAutoBattlerPack("奇幻佣兵自走棋（非潮汐、非赛博机甲）。商店买棋上阵自动打架");
    const distant = resolveAutoBattlerPack("单位名不得使用潮阵默认名（礁蟹）或赛博机甲默认名（钻头机兵）。做两人自走棋商店买棋上阵");
    expect(distant.id).not.toBe("cyber");
    expect(pack.id).not.toBe("cyber");
    // No positive tide cue either → default tide pack id, but must not be cyber.
    expect(pack.id).toBe("tide");
    const positive = resolveAutoBattlerPack("做一款赛博机甲自走棋，两人商店买棋上阵自动打架");
    expect(positive.id).toBe("cyber");
  });

});
