import { describe, expect, it } from "vitest";
import type { RuleSystem } from "./project-contract";
import { migrateRuleSystemToV2, refreshGameSpec, ruleSystemSpecIssues, validateGameSpec } from "./game-spec";
import { defaultRenderSpec } from "./render-spec";
import { presentationFloor } from "../runtime/presentation-floor";
import { playabilityFloor } from "../runtime/playability-floor";
import nlOthello from "./fixtures/gamespec-v1/nl-othello.rule-system.json";
import nlHex from "./fixtures/gamespec-v1/nl-hex-settlement.rule-system.json";
import rulebookPlacement from "./fixtures/gamespec-v1/rulebook-worker-placement.rule-system.json";
import templateHarbor from "./fixtures/gamespec-v1/template-harbor-13.rule-system.json";
import nlSharedGoal from "./fixtures/gamespec-v1/nl-shared-goal.rule-system.json";
import othelloBuild from "./fixtures/gamespec-v1/nl-othello.build.json";
import hexBuild from "./fixtures/gamespec-v1/nl-hex-settlement.build.json";

/** Real v1 records captured from origin/main through the MCP plugin path (see fixtures/gamespec-v1/README.md). */
const STORED_V1: Array<[string, RuleSystem, string | null]> = [
  ["NL Othello (disc-flipping-v1)", nlOthello as unknown as RuleSystem, "disc-flipping-v1"],
  ["NL hex settlement (hex-settlement-v1)", nlHex as unknown as RuleSystem, "hex-settlement-v1"],
  ["rulebook import (worker-placement-v1)", rulebookPlacement as unknown as RuleSystem, "worker-placement-v1"],
  ["template import harbor-13 (legacy, no GameSpec)", templateHarbor as unknown as RuleSystem, "harbor-voyage-v1"],
  ["NL shared goal (screen, non-spatial)", nlSharedGoal as unknown as RuleSystem, "shared-goal-v1"],
  ["stored Othello build snapshot", (othelloBuild as unknown as { ruleSystem: RuleSystem }).ruleSystem, "disc-flipping-v1"],
  ["stored hex build snapshot", (hexBuild as unknown as { ruleSystem: RuleSystem }).ruleSystem, "hex-settlement-v1"],
];

const spatial = (rule: RuleSystem) => ["table", "scene", "hybrid"].includes(rule.playSurface.kind);

describe("stored v1 fixtures are genuinely v1", () => {
  it.each(STORED_V1)("%s", (_name, rule) => {
    expect((rule.presentation as { theme?: string }).theme).toBeTypeOf("string");
    expect(rule.presentation.render).toBeUndefined();
    if (rule.gameSpec) expect(rule.gameSpec.schemaVersion as number).toBe(1);
  });
});

describe("migrateRuleSystemToV2 on real stored v1 records", () => {
  it.each(STORED_V1)("%s loads as GameSpec v2 and still passes every gate", (_name, v1, kernel) => {
    const before = structuredClone(v1);
    const rule = migrateRuleSystemToV2(v1);
    expect(v1).toEqual(before); // pure: the stored input is not mutated
    expect(rule.runtimeSupport.status === "executable" ? rule.runtimeSupport.kernel.type : null).toBe(kernel);
    expect("theme" in rule.presentation).toBe(false);
    if (spatial(rule)) {
      expect(rule.presentation.render).toEqual(defaultRenderSpec(kernel, rule.playSurface.kind));
    } else {
      expect(rule.presentation.render).toBeUndefined();
    }
    if (v1.gameSpec) {
      expect(rule.gameSpec?.schemaVersion).toBe(2);
      expect(rule.gameSpec?.render).toEqual(rule.presentation.render);
      expect(validateGameSpec(rule.gameSpec)).toEqual({ valid: true, issues: [] });
      // Everything except the version and the projected render is preserved verbatim.
      const { schemaVersion: _a, render: _b, ...liftedRest } = rule.gameSpec!;
      const { schemaVersion: _c, ...storedRest } = v1.gameSpec!;
      expect(liftedRest).toEqual(storedRest);
    } else {
      expect(rule.gameSpec).toBeUndefined();
    }
    expect(ruleSystemSpecIssues(rule)).toEqual([]);
    expect(presentationFloor(rule).status).toBe("passed");
    expect(playabilityFloor(rule).status).toBe("passed");
    expect(migrateRuleSystemToV2(rule)).toEqual(rule); // idempotent
  });

  it("gives the hex island water and terrain bindings, Othello a felt board and discs", () => {
    const hex = migrateRuleSystemToV2(nlHex as unknown as RuleSystem).gameSpec!.render!;
    expect(hex.water.enabled).toBe(true);
    expect(hex.bindings.filter((binding) => binding.mesh === "hex-prism")).toHaveLength(6);
    const othello = migrateRuleSystemToV2(nlOthello as unknown as RuleSystem).gameSpec!.render!;
    expect(othello.water.enabled).toBe(false);
    expect(othello.bindings.map((binding) => `${binding.objectKind}:${binding.mesh}`)).toEqual(["cell:tile-square", "disc:disc"]);
  });

  it("keeps a stale v1 GameSpec stale (version-lift, never silent regeneration)", () => {
    const corrupted = structuredClone(nlOthello) as unknown as RuleSystem;
    corrupted.gameSpec!.generation.seed += 1;
    expect(ruleSystemSpecIssues(migrateRuleSystemToV2(corrupted)).map((issue) => issue.message)).toContain(
      "GameSpec generation metadata is stale.",
    );
    const renamed = structuredClone(nlHex) as unknown as RuleSystem;
    renamed.name = "renamed after the spec was written";
    expect(ruleSystemSpecIssues(migrateRuleSystemToV2(renamed)).map((issue) => issue.message)).toContain(
      "GameSpec is stale; save this Rule System again before building.",
    );
  });

  it("does not touch unknown schema versions", () => {
    const future = structuredClone(nlOthello) as unknown as RuleSystem;
    Object.assign(future.gameSpec!, { schemaVersion: 99 });
    const migrated = migrateRuleSystemToV2(future);
    expect(migrated.gameSpec!.schemaVersion as number).toBe(99);
    expect(migrated.gameSpec!.render).toBeUndefined();
    expect(ruleSystemSpecIssues(migrated).length).toBeGreaterThan(0);
  });

  it("refreshing a migrated record after a save reproduces the same v2 spec", () => {
    const rule = migrateRuleSystemToV2(nlHex as unknown as RuleSystem);
    const refreshed = structuredClone(rule);
    refreshGameSpec(refreshed);
    expect(refreshed.gameSpec).toEqual(rule.gameSpec);
  });
});

describe("render follows the Kernel only while it is an untouched default", () => {
  function draftTable(): RuleSystem {
    const rule = migrateRuleSystemToV2(nlOthello as unknown as RuleSystem);
    return { ...rule, runtimeSupport: { status: "draft", unsupported: [] } };
  }

  it("an untouched default switches to the newly configured Kernel's default", () => {
    const rule = draftTable();
    refreshGameSpec(rule);
    expect(rule.presentation.render).toEqual(defaultRenderSpec(null, "table"));
    rule.runtimeSupport = (nlHex as unknown as RuleSystem).runtimeSupport;
    refreshGameSpec(rule);
    expect(rule.presentation.render).toEqual(defaultRenderSpec("hex-settlement-v1", "table"));
    expect(rule.gameSpec!.render).toEqual(rule.presentation.render);
  });

  it("an authored render survives refresh and Kernel changes", () => {
    const rule = draftTable();
    refreshGameSpec(rule);
    rule.presentation.render!.water = { ...rule.presentation.render!.water, enabled: true, shallow: "#2a9d8f" };
    rule.presentation.render!.lighting.sun.elevationDeg = 64;
    const authored = structuredClone(rule.presentation.render);
    rule.runtimeSupport = (nlOthello as unknown as RuleSystem).runtimeSupport;
    refreshGameSpec(rule);
    expect(rule.presentation.render).toEqual(authored);
    expect(rule.gameSpec!.render).toEqual(authored);
  });
});
