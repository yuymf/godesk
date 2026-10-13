/**
 * auto-battler-v1 content+theme packs (data only).
 *
 * The kernel is a generic shop→bench→board→combat→star loop. Genre flavour
 * (tide roster, cyber mecha, …) is a registrable pack selected by cues from the
 * creator idea — never a special-case branch in the adapter.
 */
import {
  DEFAULT_AUTO_BATTLER_CONTENT,
  type AutoBattlerContent,
  type AutoBattlerContentPatch,
} from "./auto-battler-content";
import type { AutoBattlerThemePatch } from "./auto-battler-theme";

/** HUD / room chrome labels (not combat rules). */
export type AutoBattlerBranding = {
  /** Short product / table title shown in the top bar. */
  title: string;
  /** Own-seat display name. */
  ownSeat: string;
  /** Enemy-seat display name. */
  enemySeat: string;
};

export type AutoBattlerPack = {
  id: string;
  /** Idea / prompt cues that select this pack (first match wins). */
  cues: RegExp;
  content: AutoBattlerContent;
  theme: AutoBattlerThemePatch;
  branding: AutoBattlerBranding;
};

/** Shared mechanic cues → auto-battler (not pack-specific). */
export const AUTO_BATTLER_MECHANIC_CUES =
  /自走棋|自动战斗|买棋上阵|备战席|潮阵|\btide arena\b|\bauto[- ]?battler\b|机甲自走棋|赛博.*自走棋|自走棋.*(?:机甲|赛博)/i;

const TIDE_CONTENT = DEFAULT_AUTO_BATTLER_CONTENT;

/** Cyber / mecha roster — same slot count & trait graph shape; display names only differ. */
const CYBER_CONTENT: AutoBattlerContent = {
  units: [
    { id: "crab", name: "钻头机兵", cost: 1, atk: 45, hp: 650, traits: ["shell", "tide"] },
    { id: "conch", name: "护盾车", cost: 1, atk: 40, hp: 700, traits: ["shell"] },
    { id: "blade", name: "脉冲刃", cost: 2, atk: 70, hp: 550, traits: ["tide"] },
    { id: "archer", name: "磁轨射手", cost: 2, atk: 60, hp: 450, traits: ["voyager"] },
    { id: "rider", name: "悬浮骑", cost: 2, atk: 65, hp: 520, traits: ["tide", "voyager"] },
    { id: "anemone", name: "纳米工", cost: 2, atk: 55, hp: 500, traits: ["coral"] },
    { id: "witch", name: "黑客巫", cost: 3, atk: 50, hp: 600, traits: ["coral"] },
    { id: "priest", name: "能源祭司", cost: 3, atk: 48, hp: 620, traits: ["tide", "coral"] },
    { id: "turtle", name: "装甲龟", cost: 3, atk: 42, hp: 900, traits: ["shell", "voyager"] },
    { id: "whale", name: "巨盾机", cost: 4, atk: 55, hp: 1100, traits: ["shell"] },
    { id: "lantern", name: "探照机", cost: 4, atk: 75, hp: 700, traits: ["voyager"] },
    { id: "spirit", name: "幽灵芯", cost: 5, atk: 85, hp: 800, traits: ["voyager", "tide"] },
  ],
  traits: [
    { id: "tide", label: "能源", glyph: "能", tiers: [2, 4, 6], atkBonus: 0, hpBonus: 60, effect: { kind: "shield_start", label: "电容护盾", values: [20, 45, 90] } },
    { id: "shell", label: "装甲", glyph: "甲", tiers: [2, 4], atkBonus: 0, hpBonus: 150, effect: { kind: "reflect", label: "装甲反射", values: [0, 0.1] } },
    { id: "coral", label: "脉冲", glyph: "脉", tiers: [2, 3], atkBonus: 10, hpBonus: 0, effect: { kind: "heal_first_strike", label: "脉冲修复", values: [0.2, 0.4] } },
    { id: "voyager", label: "游猎", glyph: "猎", tiers: [2, 4], atkBonus: 12, hpBonus: 0, effect: { kind: "extra_hit", label: "游猎追击", values: [0.5, 0.5] } },
  ],
  stars: { ...TIDE_CONTENT.stars },
};

export const AUTO_BATTLER_PACKS: readonly AutoBattlerPack[] = [
  {
    id: "cyber",
    cues: /机甲|赛博|赛博朋克|\bmech(?:a)?\b|\bcyber\b|霓虹.*自走|自走.*霓虹/i,
    content: CYBER_CONTENT,
    theme: { preset: "night" },
    branding: { title: "机甲自走棋", ownSeat: "蓝方机库", enemySeat: "红方机库" },
  },
  {
    id: "tide",
    cues: /潮阵|潮汐战场|海岸木桌|\btide arena\b/i,
    content: TIDE_CONTENT,
    theme: { preset: "tide" },
    branding: { title: "潮阵", ownSeat: "汐屿·我方", enemySeat: "珊瑚港·对手" },
  },
];

/** Default pack when mechanic matches but no pack cue hits. */
export const DEFAULT_AUTO_BATTLER_PACK = AUTO_BATTLER_PACKS.find((p) => p.id === "tide")!;

/** Pick the first pack whose cues match; otherwise the tide default. */
export function resolveAutoBattlerPack(idea: string): AutoBattlerPack {
  const hit = AUTO_BATTLER_PACKS.find((p) => p.id !== "tide" && p.cues.test(idea));
  if (hit) return hit;
  if (DEFAULT_AUTO_BATTLER_PACK.cues.test(idea)) return DEFAULT_AUTO_BATTLER_PACK;
  return DEFAULT_AUTO_BATTLER_PACK;
}

/** Content patch suitable for configure_auto_battler (full replace of units/traits/stars). */
export function packToContentPatch(pack: AutoBattlerPack): AutoBattlerContentPatch {
  return {
    units: pack.content.units.map((u) => ({ ...u, traits: [...u.traits] })),
    traits: pack.content.traits.map((t) => ({
      ...t,
      tiers: [...t.tiers],
      ...(t.effect ? { effect: { ...t.effect, values: [...t.effect.values] } } : {}),
    })),
    stars: { ...pack.content.stars },
  };
}

export function packMentionsAutoBattler(idea: string): boolean {
  return AUTO_BATTLER_MECHANIC_CUES.test(idea) || AUTO_BATTLER_PACKS.some((p) => p.cues.test(idea));
}
