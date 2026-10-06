import { describe, expect, it } from "vitest";
import { gameSpecSchema, validateGameSpec, gameSpecCapabilityGap, ruleSystemSpecIssues, refreshGameSpec } from "./game-spec";
import { BASELINE_PROMPTS, structuredSpecFixture, executableSpecFixture, executableOthelloSpecFixture, executableHexIslandSpecFixture, executableAuctionBiddingSpecFixture } from "./fixtures/game-spec";
import type { RuleSystem } from "./project-contract";

describe("GameSpec v1", () => {
  it("accepts auction fixture and rejects auction declarations on another kernel", () => {
    const rule = executableAuctionBiddingSpecFixture();
    expect(ruleSystemSpecIssues(rule)).toEqual([]);
    expect(rule.gameSpec?.execution.kernelType).toBe("auction-bidding-v1");
    const mismatch = executableAuctionBiddingSpecFixture();
    mismatch.gameSpec!.execution.kernelType = "network-route-v1";
    expect(validateGameSpec(mismatch.gameSpec).issues).toContainEqual(expect.objectContaining({ path: "execution" }));
  });
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
  it("closes the hex-island baseline capability gap once hex-settlement-v1 is registered", () => {
    expect(gameSpecCapabilityGap(BASELINE_PROMPTS[0])).toBeNull();
    expect(gameSpecCapabilityGap(BASELINE_PROMPTS[0], ["hex-settlement"], "hex-settlement-v1")).toBeNull();
    expect(gameSpecCapabilityGap(BASELINE_PROMPTS[0], ["hex-settlement"], "conversation-relay-v1")).toContain("能力缺口");
  });
  it("closes the Othello baseline capability gap once disc-flipping-v1 is registered", () => {
    expect(gameSpecCapabilityGap(BASELINE_PROMPTS[1])).toBeNull();
    expect(gameSpecCapabilityGap(BASELINE_PROMPTS[1], ["disc-flipping"], "disc-flipping-v1")).toBeNull();
    expect(gameSpecCapabilityGap(BASELINE_PROMPTS[1], ["disc-flipping"], "conversation-relay-v1")).toContain("能力缺口");
  });
  it("does not label valid structured data executable", () => {
    const spec = structuredSpecFixture("grid");
    const rule = { gameSpec: spec, runtimeSupport: { status: "draft", unsupported: [] } } as unknown as RuleSystem;
    expect(ruleSystemSpecIssues(rule).map((issue) => issue.path)).toContain("execution");
  });
});

describe("GameSpec executable semantics and freshness", () => {
  it.each(["unknown-v1", "toString", "__proto__"])("rejects unregistered kernel %s", (kernel) => {
    const spec = executableSpecFixture().gameSpec!;
    spec.execution.kernelType = kernel;
    expect(validateGameSpec(spec).issues).toContainEqual(expect.objectContaining({ path: "execution.kernelType" }));
  });
  it.each(["arbitrary hook", "hand-play-v1: authoritative outcome", null])("rejects a hook not owned by the adapter: %s", (hook) => {
    const spec = executableSpecFixture().gameSpec!;
    spec.scoring.hook = hook;
    expect(validateGameSpec(spec).valid).toBe(false);
  });
  it.each(["generatorVersion", "rulesVersion"] as const)("rejects unsupported %s even when regenerated metadata agrees", (field) => {
    const rule = executableSpecFixture();
    rule.generation![field] = "obsolete-v0";
    refreshGameSpec(rule);
    expect(ruleSystemSpecIssues(rule)).toContainEqual(expect.objectContaining({ path: `generation.${field}` }));
  });
  it("compares provenance canonically while rejecting changed seeds and rule versions", () => {
    const rule = executableSpecFixture();
    rule.gameSpec = Object.fromEntries(Object.entries(rule.gameSpec!).reverse()) as typeof rule.gameSpec;
    rule.gameSpec!.generation = Object.fromEntries(Object.entries(rule.generation!).reverse()) as typeof rule.generation & {};
    expect(ruleSystemSpecIssues(rule)).toEqual([]);
    rule.generation!.seed++;
    expect(ruleSystemSpecIssues(rule)).toContainEqual(expect.objectContaining({ path: "generation" }));
    refreshGameSpec(rule);
    rule.version++;
    expect(ruleSystemSpecIssues(rule)).toContainEqual(expect.objectContaining({ path: "ruleSystemVersion" }));
  });
  it.each(["hex-settlement", "disc-flipping", "unknown-mechanic", "toString", "hand-play"])("rejects declared %s on a conversation adapter without game-name keywords", (mechanic) => {
    const rule = executableSpecFixture();
    rule.generation!.requestedMechanics = [mechanic];
    refreshGameSpec(rule);
    expect(ruleSystemSpecIssues(rule)).toContainEqual(expect.objectContaining({ path: "execution" }));
  });
  it("does not combine capabilities from separate adapters into a fictional runtime", () => {
    expect(gameSpecCapabilityGap("Untitled", ["conversation", "hand-play"])).toContain("能力缺口");
    expect(gameSpecCapabilityGap("Untitled", ["conversation"], "conversation-relay-v1")).toBeNull();
  });
});

describe("GameSpec disc-flipping-v1 executable fixture", () => {
  it("validates an Othello-shaped RuleSystem without capability gap", () => {
    const rule = executableOthelloSpecFixture();
    expect(ruleSystemSpecIssues(rule)).toEqual([]);
    expect(rule.gameSpec?.execution.kernelType).toBe("disc-flipping-v1");
    expect(rule.gameSpec?.generation.requestedMechanics).toEqual(["disc-flipping"]);
  });
});

describe("GameSpec hex-settlement-v1 executable fixture", () => {
  it("validates a hex-island-shaped RuleSystem without capability gap", () => {
    const rule = executableHexIslandSpecFixture();
    expect(ruleSystemSpecIssues(rule)).toEqual([]);
    expect(rule.gameSpec?.execution.kernelType).toBe("hex-settlement-v1");
    expect(rule.gameSpec?.generation.requestedMechanics).toEqual(["hex-settlement"]);
  });
});
