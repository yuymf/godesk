/**
 * auto-battler-v1 content data layer.
 *
 * Units, traits (tiers + effect presets) and star-up rules are DATA read from the
 * `configure_auto_battler` config. The adapter logic only interprets these presets;
 * the shipped roster below is merely the default value of this data.
 */

import type { UnitCombatFx } from "./auto-battler-vfx";
import { isVfxPreset } from "./auto-battler-vfx";

/** Silhouette presets the 3D/2D token renderers know how to draw. */
export const UNIT_SHAPE_PRESETS = [
  "crab", "conch", "blade", "archer", "rider", "anemone",
  "witch", "priest", "turtle", "whale", "lantern", "spirit",
] as const;
export type UnitShapePreset = (typeof UNIT_SHAPE_PRESETS)[number];

export type UnitDef = {
  id: string;
  name: string;
  cost: number;
  atk: number;
  hp: number;
  traits: readonly string[];
  /**
   * Procedural stylized piece preset (renderer fallback when no modelRef).
   * Legacy field `shape` is accepted as an alias and normalized to this.
   */
  proceduralPreset?: UnitShapePreset;
  /** @deprecated alias of proceduralPreset — kept for older content patches. */
  shape?: UnitShapePreset;
  /**
   * Imported project asset id (GLB under assets/imported/). When set and the
   * matching imported model is available, the renderer uses that mesh instead
   * of the procedural silhouette.
   */
  modelRef?: string;
  /** Generic attack / hit VFX + optional attackEffect (aoe splash, unit heal, …). */
  combatFx?: UnitCombatFx;
};

/**
 * Built-in combat effect presets a trait can carry (values per tier).
 * Kinds are extensible: unknown kinds are kept on content for Plan honesty and
 * ignored by the combat loop until a handler is registered (not hard-capped at 4).
 */
export const BUILTIN_TRAIT_EFFECT_KINDS = [
  "shield_start",
  "heal_first_strike",
  "extra_hit",
  "reflect",
  "aoe_on_hit",
] as const;
/** @deprecated alias — prefer BUILTIN_TRAIT_EFFECT_KINDS; kept for older imports. */
export const TRAIT_EFFECT_KINDS = BUILTIN_TRAIT_EFFECT_KINDS;
export type TraitEffectKind = string;

export type TraitDef = {
  id: string;
  label: string;
  glyph: string;
  /** Unit counts at which tiers activate, ascending; tiers[0] is the activation minimum. */
  tiers: readonly number[];
  /** Flat stat bonus to every allied fighter while the trait is active. */
  atkBonus: number;
  hpBonus: number;
  effect?: { kind: TraitEffectKind; label: string; values: readonly number[] };
};

export type StarRules = { star2: boolean; star3: boolean; mult2: number; mult3: number };

export type AutoBattlerContent = {
  units: readonly UnitDef[];
  traits: readonly TraitDef[];
  stars: StarRules;
};

/** Partial content a configure op may carry; each present field replaces the default wholesale. */
export type AutoBattlerContentPatch = {
  units?: UnitDef[];
  traits?: TraitDef[];
  stars?: Partial<StarRules>;
};

export const DEFAULT_AUTO_BATTLER_CONTENT: AutoBattlerContent = {
  units: [
    { id: "crab", name: "礁蟹", cost: 1, atk: 45, hp: 650, traits: ["shell", "tide"] },
    { id: "conch", name: "螺号卫", cost: 1, atk: 40, hp: 700, traits: ["shell"] },
    { id: "blade", name: "潮刃", cost: 2, atk: 70, hp: 550, traits: ["tide"] },
    { id: "archer", name: "飞鱼弓", cost: 2, atk: 60, hp: 450, traits: ["voyager"] },
    { id: "rider", name: "浪脊骑", cost: 2, atk: 65, hp: 520, traits: ["tide", "voyager"] },
    { id: "anemone", name: "海葵师", cost: 2, atk: 55, hp: 500, traits: ["coral"] },
    { id: "witch", name: "珊瑚巫", cost: 3, atk: 50, hp: 600, traits: ["coral"] },
    { id: "priest", name: "潮汐祭司", cost: 3, atk: 48, hp: 620, traits: ["tide", "coral"] },
    { id: "turtle", name: "珍珠龟", cost: 3, atk: 42, hp: 900, traits: ["shell", "voyager"] },
    { id: "whale", name: "鲸盾", cost: 4, atk: 55, hp: 1100, traits: ["shell"] },
    { id: "lantern", name: "雾灯人", cost: 4, atk: 75, hp: 700, traits: ["voyager"] },
    { id: "spirit", name: "海风灵", cost: 5, atk: 85, hp: 800, traits: ["voyager", "tide"] },
  ],
  traits: [
    { id: "tide", label: "潮汐", glyph: "潮", tiers: [2, 4, 6], atkBonus: 0, hpBonus: 60, effect: { kind: "shield_start", label: "潮涌护盾", values: [20, 45, 90] } },
    { id: "shell", label: "硬壳", glyph: "甲", tiers: [2, 4], atkBonus: 0, hpBonus: 150, effect: { kind: "reflect", label: "硬壳反射", values: [0, 0.1] } },
    { id: "coral", label: "珊瑚咒", glyph: "咒", tiers: [2, 3], atkBonus: 10, hpBonus: 0, effect: { kind: "heal_first_strike", label: "珊瑚愈伤", values: [0.2, 0.4] } },
    { id: "voyager", label: "远航", glyph: "风", tiers: [2, 4], atkBonus: 12, hpBonus: 0, effect: { kind: "extra_hit", label: "远航追击", values: [0.5, 0.5] } },
  ],
  stars: { star2: true, star3: false, mult2: 1.8, mult3: 3.2 },
};

export const CONTENT_LIMITS = {
  units: { min: 2, max: 24 },
  traits: { max: 8 },
  cost: { min: 1, max: 5 },
  atk: { min: 1, max: 500 },
  hp: { min: 1, max: 5000 },
  tierCount: { min: 1, max: 4 },
  tierValue: { min: 1, max: 12 },
  bonus: { min: 0, max: 500 },
  mult: { min: 1, max: 10 },
} as const;

const isInt = (v: unknown, lo: number, hi: number) => typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi;
const isNum = (v: unknown, lo: number, hi: number) => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;
const isText = (v: unknown, max: number) => typeof v === "string" && v.trim().length > 0 && v.length <= max;

function normalizeTrait(raw: unknown): TraitDef | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Record<string, unknown>;
  if (!isText(t.id, 32) || !isText(t.label, 24) || !isText(t.glyph, 2)) return null;
  const tiers = t.tiers;
  if (!Array.isArray(tiers) || tiers.length < CONTENT_LIMITS.tierCount.min || tiers.length > CONTENT_LIMITS.tierCount.max) return null;
  if (!tiers.every((n, i) => isInt(n, CONTENT_LIMITS.tierValue.min, CONTENT_LIMITS.tierValue.max) && (i === 0 || n > tiers[i - 1]))) return null;
  if (!isInt(t.atkBonus ?? 0, 0, CONTENT_LIMITS.bonus.max) || !isInt(t.hpBonus ?? 0, 0, CONTENT_LIMITS.bonus.max)) return null;
  let effect: TraitDef["effect"];
  if (t.effect !== undefined) {
    const e = t.effect as Record<string, unknown>;
    if (!e || !isText(e.kind, 32) || !isText(e.label, 24)) return null;
    const values = e.values;
    if (!Array.isArray(values) || values.length !== tiers.length || !values.every((v) => isNum(v, 0, 1000))) return null;
    effect = { kind: String(e.kind), label: e.label as string, values: values as number[] };
  }
  return {
    id: t.id as string, label: t.label as string, glyph: t.glyph as string, tiers: tiers as number[],
    atkBonus: (t.atkBonus as number) ?? 0, hpBonus: (t.hpBonus as number) ?? 0, ...(effect ? { effect } : {}),
  };
}

function normalizeUnit(raw: unknown, traitIds: Set<string>): UnitDef | null {
  if (!raw || typeof raw !== "object") return null;
  const u = raw as Record<string, unknown>;
  if (!isText(u.id, 32) || !isText(u.name, 16)) return null;
  if (!isInt(u.cost, CONTENT_LIMITS.cost.min, CONTENT_LIMITS.cost.max)) return null;
  if (!isInt(u.atk, CONTENT_LIMITS.atk.min, CONTENT_LIMITS.atk.max) || !isInt(u.hp, CONTENT_LIMITS.hp.min, CONTENT_LIMITS.hp.max)) return null;
  if (!Array.isArray(u.traits) || u.traits.length > 3 || !u.traits.every((id) => typeof id === "string" && traitIds.has(id))) return null;
  const procedural = (u.proceduralPreset ?? u.shape) as UnitShapePreset | undefined;
  if (procedural !== undefined && !UNIT_SHAPE_PRESETS.includes(procedural)) return null;
  if (u.modelRef !== undefined && !isText(u.modelRef, 128)) return null;
  let combatFx: UnitCombatFx | undefined;
  if (u.combatFx !== undefined && typeof u.combatFx === "object") {
    const fx = u.combatFx as Record<string, unknown>;
    const attackVfx = isVfxPreset(fx.attackVfx) ? fx.attackVfx : undefined;
    const hitVfx = isVfxPreset(fx.hitVfx) ? fx.hitVfx : undefined;
    let attackEffect: UnitCombatFx["attackEffect"];
    if (fx.attackEffect && typeof fx.attackEffect === "object") {
      const ae = fx.attackEffect as Record<string, unknown>;
      if (isText(ae.kind, 32) && isNum(ae.value, 0, 10)) {
        attackEffect = {
          kind: String(ae.kind),
          value: ae.value as number,
          ...(isText(ae.label, 24) ? { label: ae.label as string } : {}),
        };
      }
    }
    if (attackVfx || hitVfx || attackEffect) {
      combatFx = {
        ...(attackVfx ? { attackVfx } : {}),
        ...(hitVfx ? { hitVfx } : {}),
        ...(attackEffect ? { attackEffect } : {}),
      };
    }
  }
  return {
    id: u.id as string, name: u.name as string, cost: u.cost as number, atk: u.atk as number, hp: u.hp as number,
    traits: [...(u.traits as string[])],
    ...(procedural ? { proceduralPreset: procedural, shape: procedural } : {}),
    ...(u.modelRef ? { modelRef: (u.modelRef as string).trim() } : {}),
    ...(combatFx ? { combatFx } : {}),
  };
}

/** Validate a content patch and merge it over the defaults. Returns null when invalid. */
export function resolveAutoBattlerContent(raw: unknown): AutoBattlerContent | null {
  if (raw === undefined || raw === null) return DEFAULT_AUTO_BATTLER_CONTENT;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const patch = raw as Record<string, unknown>;
  for (const key of Object.keys(patch)) if (!["units", "traits", "stars"].includes(key)) return null;
  let traits = DEFAULT_AUTO_BATTLER_CONTENT.traits;
  if (patch.traits !== undefined) {
    if (!Array.isArray(patch.traits) || patch.traits.length > CONTENT_LIMITS.traits.max) return null;
    const parsed = patch.traits.map(normalizeTrait);
    if (parsed.some((t) => !t)) return null;
    traits = parsed as TraitDef[];
    if (new Set(traits.map((t) => t.id)).size !== traits.length) return null;
  }
  const traitIds = new Set(traits.map((t) => t.id));
  let units = DEFAULT_AUTO_BATTLER_CONTENT.units;
  if (patch.units !== undefined) {
    if (!Array.isArray(patch.units) || patch.units.length < CONTENT_LIMITS.units.min || patch.units.length > CONTENT_LIMITS.units.max) return null;
    const parsed = patch.units.map((u) => normalizeUnit(u, traitIds));
    if (parsed.some((u) => !u)) return null;
    units = parsed as UnitDef[];
    if (new Set(units.map((u) => u.id)).size !== units.length) return null;
  } else if (!units.every((u) => u.traits.every((id) => traitIds.has(id)))) {
    // Traits were replaced: default units may only keep traits that still exist.
    units = units.map((u) => ({ ...u, traits: u.traits.filter((id) => traitIds.has(id)) }));
  }
  let stars = DEFAULT_AUTO_BATTLER_CONTENT.stars;
  if (patch.stars !== undefined) {
    const s = patch.stars as Record<string, unknown>;
    if (!s || typeof s !== "object") return null;
    for (const key of Object.keys(s)) if (!["star2", "star3", "mult2", "mult3"].includes(key)) return null;
    const next = { ...stars, ...(s as Partial<StarRules>) };
    if (typeof next.star2 !== "boolean" || typeof next.star3 !== "boolean") return null;
    if (!isNum(next.mult2, CONTENT_LIMITS.mult.min, CONTENT_LIMITS.mult.max) || !isNum(next.mult3, CONTENT_LIMITS.mult.min, CONTENT_LIMITS.mult.max)) return null;
    if (next.star3 && !next.star2) return null;
    stars = next;
  }
  return { units, traits, stars };
}

export function unitShape(unit: Pick<UnitDef, "id" | "shape" | "proceduralPreset">): UnitShapePreset {
  const preset = unit.proceduralPreset ?? unit.shape;
  if (preset) return preset;
  return (UNIT_SHAPE_PRESETS as readonly string[]).includes(unit.id) ? (unit.id as UnitShapePreset) : "blade";
}

/** Resolved appearance: imported GLB when modelRef is set, else procedural stylized piece. */
export function unitAppearanceOf(unit: Pick<UnitDef, "id" | "shape" | "proceduralPreset" | "modelRef">): {
  proceduralPreset: UnitShapePreset;
  modelRef?: string;
} {
  const proceduralPreset = unitShape(unit);
  return unit.modelRef
    ? { proceduralPreset, modelRef: unit.modelRef }
    : { proceduralPreset };
}

/** Highest tier index reached by `count` (−1 when inactive). */
export function traitTierIndex(trait: Pick<TraitDef, "tiers">, count: number): number {
  let idx = -1;
  trait.tiers.forEach((need, i) => { if (count >= need) idx = i; });
  return idx;
}
