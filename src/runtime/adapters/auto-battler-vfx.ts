/**
 * Generic auto-battler VFX / skill presentation presets (not tide-arena skins).
 * Combat log + timeline carry `vfx` events; the 3D scene interprets presets.
 */
const VFX_PRESETS = [
  "projectile",
  "aoe",
  "heal",
  "shield",
  "hit_particles",
  "crit_shake",
] as const;
type VfxPreset = (typeof VFX_PRESETS)[number];

export function isVfxPreset(v: unknown): v is VfxPreset {
  return typeof v === "string" && (VFX_PRESETS as readonly string[]).includes(v);
}

/** Unit-level attack / skill presentation + optional combat modifiers. */
export type UnitCombatFx = {
  /** Presentation preset for basic attacks (overrides ranged heuristic when set). */
  attackVfx?: VfxPreset;
  /** Presentation when this unit is hit. */
  hitVfx?: VfxPreset;
  /**
   * Combat modifier on each basic strike (extensible kinds).
   * `aoe_splash`: deal value×atk to other enemies within manhattan ≤ 1 of the primary target.
   * `heal_ally`: heal neediest ally for value×atk on first strike.
   */
  attackEffect?: { kind: string; value: number; label?: string };
};

export type CombatVfxEntry = {
  kind: "vfx";
  preset: VfxPreset;
  atUid?: string;
  fromUid?: string;
  toUid?: string;
  amount?: number;
};

/** Map NL / skill words → VFX preset (generic). */
export function vfxPresetFromHint(text: string): VfxPreset | undefined {
  if (/(溅射|范围|aoe|爆炸|扩散)/i.test(text)) return "aoe";
  if (/(治疗|回血|愈|heal)/i.test(text)) return "heal";
  if (/(护盾|护甲|盾|shield)/i.test(text)) return "shield";
  if (/(暴击|暴击震|震屏|shake|crit)/i.test(text)) return "crit_shake";
  if (/(受击|粒子|火花|hit)/i.test(text)) return "hit_particles";
  if (/(弹道|飞弹|射击|projectile|missile)/i.test(text)) return "projectile";
  return undefined;
}
