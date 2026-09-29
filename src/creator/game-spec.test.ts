import { describe, expect, it } from "vitest";
import { gameSpecSchema, validateGameSpec, gameSpecCapabilityGap, ruleSystemSpecIssues } from "./game-spec";
import { BASELINE_PROMPTS, structuredSpecFixture } from "./fixtures/game-spec";
import type { RuleSystem } from "./project-contract";

describe("GameSpec v1", () => {
  it.each(["hex", "grid", "network"] as const)("accepts %s without globally required hex/resources", (kind) => {
    expect(validateGameSpec(structuredSpecFixture(kind))).toEqual({ valid: true, issues: [] });
  });
  it.each([undefined, {}, { schemaVersion: 2 }, { ...structuredSpecFixture("grid"), actions: [] }, { ...structuredSpecFixture("grid"), phases: [] }, { ...structuredSpecFixture("grid"), endConditions: [] }, { ...structuredSpecFixture("grid"), generation: { seed: "42" } }])("rejects malformed or incomplete schema %#", (value) => {
    expect(gameSpecSchema.safeParse(value).success).toBe(false);
    expect(validateGameSpec(value).valid).toBe(false);
  });
  it("rejects cross-field contradictions and dangling references", () => {
    const spec = structuredSpecFixture("grid");
    spec.players.default = 3;
    spec.actions.push(spec.actions[0]);
    spec.actions[0].phaseIds = ["missing"];
    spec.objects[0].regionId = "missing";
    spec.relationships[0].from = "missing";
    spec.scoring = { kind: "kernel-hook", hook: null };
    const result = validateGameSpec(spec);
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.path)).toEqual(expect.arrayContaining(["players", "actions", "objects", "relationships", "scoring"]));
  });
  it.each(BASELINE_PROMPTS)("reports the baseline capability gap: %s", (prompt) => {
    expect(gameSpecCapabilityGap(prompt)).toContain("当前没有对应 Executable Kernel");
  });
  it("does not label valid structured data executable", () => {
    const spec = structuredSpecFixture("grid");
    const rule = { gameSpec: spec, runtimeSupport: { status: "draft", unsupported: [] } } as unknown as RuleSystem;
    expect(ruleSystemSpecIssues(rule).map((issue) => issue.path)).toContain("execution");
  });
});
