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

  it("defaults to tide pack when no genre cue", () => {
    expect(resolveAutoBattlerPack("做一款两人自走棋，商店买棋上阵自动打架").id).toBe("tide");
  });
});
