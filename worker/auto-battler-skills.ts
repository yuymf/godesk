/**
 * NL → unit combatFx / new trait effects (generic VFX + extensible effect kinds).
 */
import type { AutoBattlerContent, TraitDef, UnitDef } from "../src/runtime/adapters/auto-battler-content";
import { vfxPresetFromHint, type UnitCombatFx } from "../src/runtime/adapters/auto-battler-vfx";
import { resolveUnitHint } from "./auto-battler-assets";

export type SkillFxIntent =
  | { kind: "unit_attack_fx"; unitHint: string; effectKind: string; value: number; vfx?: string; label?: string }
  | { kind: "unit_heal"; unitHint: string; value: number }
  | { kind: "new_trait_shield"; label: string; tiers?: number[]; values?: number[] };

export type SkillFxReport = { lines: string[]; unsupported: string[] };

/** Parse one clause into a skill/VFX intent (0 = not mine). */
export function parseSkillFxClause(clause: string): SkillFxIntent | null {
  const text = clause.trim();
  if (!text) return null;

  // 「给新羁绊加护盾」「新羁绊叫护潮，带护盾」
  if (/(新羁绊|加一个羁绊|新增羁绊)/.test(text) && /(护盾|盾)/.test(text)) {
    const label = text.match(/[「"]([^」"]{1,8})[」"]/)?.[1]
      ?? text.match(/叫\s*([^\s，,。]{1,8})/)?.[1]
      ?? "护盾";
    return { kind: "new_trait_shield", label, tiers: [2, 4], values: [25, 50] };
  }
  if (/给新羁绊加护盾/.test(text) || (/护盾/.test(text) && /新羁绊/.test(text))) {
    return { kind: "new_trait_shield", label: "护盾", tiers: [2, 4], values: [25, 50] };
  }

  // 「巫师有治疗」「给巫师加治疗」
  if (/(治疗|回血|愈伤)/.test(text) && /(巫师|女巫|法师|巫|witch)/i.test(text)) {
    const unitHint = text.match(/(礁蟹|螃蟹|蟹|巫师|女巫|法师|巫|潮刃|飞鱼|弓手|螺号|海葵|祭司|龟|鲸|灯|精灵|[A-Za-z]+)/)?.[1] ?? "巫师";
    return { kind: "unit_heal", unitHint, value: 0.35 };
  }

  // 「螃蟹攻击带范围溅射」
  if (/(溅射|范围伤害|aoe)/i.test(text) || (/(攻击|普攻)/.test(text) && /(范围|溅射)/.test(text))) {
    const unitHint = text.match(/(?:给)?\s*(礁蟹|螃蟹|蟹|巫师|女巫|法师|巫|潮刃|飞鱼|弓手|螺号|海葵|祭司|龟|鲸|灯|精灵|[^\s，,。攻击带有]+)/)?.[1];
    if (!unitHint) return null;
    const vfx = vfxPresetFromHint(text) ?? "aoe";
    return { kind: "unit_attack_fx", unitHint, effectKind: "aoe_splash", value: 0.4, vfx, label: "范围溅射" };
  }

  return null;
}

export function applySkillFxIntents(content: AutoBattlerContent, intents: SkillFxIntent[]): {
  content: AutoBattlerContent;
  report: SkillFxReport;
  contentTouched: Set<"units" | "traits" | "stars">;
} {
  let units: UnitDef[] = content.units.map((u) => ({ ...u, traits: [...u.traits], ...(u.combatFx ? { combatFx: { ...u.combatFx } } : {}) }));
  let traits: TraitDef[] = content.traits.map((t) => ({
    ...t,
    tiers: [...t.tiers],
    ...(t.effect ? { effect: { ...t.effect, values: [...t.effect.values] } } : {}),
  }));
  const report: SkillFxReport = { lines: [], unsupported: [] };
  const contentTouched = new Set<"units" | "traits" | "stars">();

  for (const intent of intents) {
    if (intent.kind === "new_trait_shield") {
      if (traits.length >= 8) {
        report.unsupported.push(`技能：羁绊已满（${traits.length}/8），无法再加「${intent.label}」`);
        continue;
      }
      let id = `shield_${traits.length + 1}`;
      if (traits.some((t) => t.id === id)) id = `guard_${Date.now().toString(36).slice(-4)}`;
      const tiers = intent.tiers ?? [2, 4];
      const values = intent.values ?? [25, 50];
      const trait: TraitDef = {
        id,
        label: intent.label.slice(0, 24),
        glyph: "盾",
        tiers,
        atkBonus: 0,
        hpBonus: 40,
        effect: { kind: "shield_start", label: intent.label.includes("盾") ? intent.label : `${intent.label}护盾`, values },
      };
      traits = [...traits, trait];
      contentTouched.add("traits");
      report.lines.push(`技能：新羁绊「${trait.label}」→ shield_start 护盾（${values.join("/")}）+ VFX shield`);
      continue;
    }

    const unit = resolveUnitHint({ ...content, units, traits }, intent.unitHint);
    if (!unit) {
      report.unsupported.push(`技能：未识别单位「${intent.unitHint}」`);
      continue;
    }

    if (intent.kind === "unit_heal") {
      const combatFx: UnitCombatFx = {
        ...(unit.combatFx ?? {}),
        attackVfx: "heal",
        hitVfx: "hit_particles",
        attackEffect: { kind: "heal_ally", value: intent.value, label: "治疗" },
      };
      units = units.map((u) => (u.id === unit.id ? { ...u, combatFx } : u));
      contentTouched.add("units");
      report.lines.push(`技能：${unit.name} → heal_ally ${Math.round(intent.value * 100)}% + VFX heal（映射预设 heal）`);
      continue;
    }

    if (intent.kind === "unit_attack_fx") {
      const combatFx: UnitCombatFx = {
        ...(unit.combatFx ?? {}),
        attackVfx: (intent.vfx as UnitCombatFx["attackVfx"]) ?? "aoe",
        hitVfx: "hit_particles",
        attackEffect: { kind: intent.effectKind, value: intent.value, label: intent.label },
      };
      units = units.map((u) => (u.id === unit.id ? { ...u, combatFx } : u));
      contentTouched.add("units");
      report.lines.push(
        `技能：${unit.name} 攻击 → ${intent.effectKind}×${intent.value} + VFX ${combatFx.attackVfx}（映射预设；暴击另发 crit_shake）`,
      );
    }
  }

  return { content: { ...content, units, traits }, report, contentTouched };
}
