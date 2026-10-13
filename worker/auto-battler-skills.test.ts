import { describe, expect, it } from "vitest";
import { DEFAULT_AUTO_BATTLER_CONTENT } from "../src/runtime/adapters/auto-battler-content";
import { applySkillFxIntents, parseSkillFxClause } from "./auto-battler-skills";
import { parseKernelEdits } from "./kernel-tuning-iteration";

describe("auto-battler skill / VFX NL", () => {
  it("parses splash / heal / new trait shield", () => {
    expect(parseSkillFxClause("螃蟹攻击带范围溅射")).toMatchObject({
      kind: "unit_attack_fx",
      effectKind: "aoe_splash",
    });
    expect(parseSkillFxClause("巫师有治疗")).toMatchObject({ kind: "unit_heal", unitHint: "巫师" });
    expect(parseSkillFxClause("给新羁绊加护盾")).toMatchObject({ kind: "new_trait_shield" });
  });

  it("applies combatFx and new shield trait", () => {
    const a = applySkillFxIntents(DEFAULT_AUTO_BATTLER_CONTENT, [
      parseSkillFxClause("螃蟹攻击带范围溅射")!,
    ]);
    expect(a.content.units.find((u) => u.id === "crab")?.combatFx?.attackEffect?.kind).toBe("aoe_splash");
    const b = applySkillFxIntents(a.content, [parseSkillFxClause("巫师有治疗")!]);
    expect(b.content.units.find((u) => u.id === "witch")?.combatFx?.attackEffect?.kind).toBe("heal_ally");
    const c = applySkillFxIntents(b.content, [parseSkillFxClause("给新羁绊加护盾")!]);
    expect(c.content.traits.some((t) => t.effect?.kind === "shield_start" && t.label.includes("护盾"))).toBe(true);
    const newId = c.content.traits.find((t) => t.label.includes("护盾") && t.id.startsWith("shield_"))!.id;
    expect(c.content.units.filter((u) => u.traits.includes(newId)).length).toBeGreaterThanOrEqual(2);
  });

  it("maps through kernel edits", () => {
    const r = parseKernelEdits({ type: "auto-battler-v1", playerCount: 2 } as never, "螃蟹攻击带范围溅射");
    expect(r?.changes.some((c) => c.key === "skill")).toBe(true);
    expect(r?.notes.some((n) => /aoe_splash|溅射|aoe/i.test(n))).toBe(true);
  });
});
