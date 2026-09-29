import { z } from "zod";
import type { RuleSystem } from "./project-contract";

const text = z.string().trim().min(1);
const visibility = z.enum(["public", "owner", "private", "kernel-scoped"]);
export const generationMetadataSchema = z.strictObject({
  generatorVersion: text,
  rulesVersion: text,
  sourcePrompt: text,
  assumptions: z.array(text),
  seed: z.number().int().min(0).max(0xffffffff),
});
export type GenerationMetadata = z.infer<typeof generationMetadataSchema>;
export const GENERATOR_VERSION = "rule-system-materializer-v1";

/** Data only. Hooks identify adapter responsibilities; they never execute scripts. */
export const gameSpecSchema = z.strictObject({
  schemaVersion: z.literal(1),
  ruleSystemId: text,
  ruleSystemVersion: z.number().int().positive(),
  name: text,
  generation: generationMetadataSchema,
  players: z.strictObject({
    min: z.number().int().positive(), max: z.number().int().positive(),
    default: z.number().int().positive(), visibility,
  }),
  objects: z.array(z.strictObject({ id: text, name: text, kind: text, visibility, regionId: text.optional() })),
  regions: z.array(z.strictObject({ id: text, name: text, visibility })),
  relationships: z.array(z.strictObject({ from: text, to: text, kind: text })),
  setup: z.array(text),
  actions: z.array(z.strictObject({ id: text, label: text, description: text, phaseIds: z.array(text).min(1) })).min(1),
  phases: z.array(z.strictObject({ id: text, name: text })).min(1),
  endConditions: z.array(z.strictObject({ id: text, description: text })).min(1),
  scoring: z.strictObject({ kind: z.enum(["none", "kernel-hook"]), hook: text.nullable() }),
  presentation: z.strictObject({ kind: z.enum(["table", "cards", "conversation", "screen", "scene", "hybrid"]), layout: text }),
  execution: z.strictObject({ kernelType: text.nullable() }),
});
export type GameSpec = z.infer<typeof gameSpecSchema>;
export type SpecIssue = { path: string; message: string };
export type SpecValidation = { valid: boolean; issues: SpecIssue[] };

export function validateGameSpec(value: unknown): SpecValidation {
  const parsed = gameSpecSchema.safeParse(value);
  if (!parsed.success) return { valid: false, issues: parsed.error.issues.map((issue) => ({
    path: issue.path.join("."), message: issue.message,
  })) };
  const spec = parsed.data;
  const issues: SpecIssue[] = [];
  const fail = (path: string, message: string) => issues.push({ path, message });
  if (spec.players.min > spec.players.default || spec.players.default > spec.players.max) {
    fail("players", "Player counts must satisfy min ≤ default ≤ max.");
  }
  for (const key of ["objects", "regions", "actions", "phases", "endConditions"] as const) {
    if (new Set(spec[key].map((item) => item.id)).size !== spec[key].length) fail(key, "IDs must be unique.");
  }
  const regions = new Set(spec.regions.map((region) => region.id));
  const spatialIds = [...spec.objects, ...spec.regions].map((item) => item.id);
  if (new Set(spatialIds).size !== spatialIds.length) fail("objects", "Object and region IDs must be distinct.");
  const spatial = new Set(spatialIds);
  const phases = new Set(spec.phases.map((phase) => phase.id));
  for (const object of spec.objects) if (object.regionId && !regions.has(object.regionId)) fail("objects", `Unknown region: ${object.regionId}`);
  for (const relation of spec.relationships) if (!spatial.has(relation.from) || !spatial.has(relation.to)) fail("relationships", "Relationship endpoints must reference objects or regions.");
  for (const action of spec.actions) if (action.phaseIds.some((id) => !phases.has(id))) fail("actions", `Unknown phase for action: ${action.id}`);
  if ((spec.scoring.kind === "none") !== (spec.scoring.hook === null)) fail("scoring", "Scoring kind and hook disagree.");
  if (spec.scoring.kind === "kernel-hook" && !spec.execution.kernelType) fail("scoring", "Scoring hook requires an executable adapter.");
  if (!spec.setup.length) fail("setup", "Initial setup is required.");
  return { valid: issues.length === 0, issues };
}

/** Explicit gaps take precedence over the existing heuristic Kernel selector. */
export function gameSpecCapabilityGap(corpus: string): string | null {
  if (/\bcatan\b|settlecoast|卡坦|卡版|六角.*(?:资源|建造)|hex.*(?:resource|build)/i.test(corpus)) {
    return "能力缺口：Catan / 卡坦基础版需要六角拓扑、资源生产、交易和建设规则；当前没有对应 Executable Kernel，不能生成可玩版本。";
  }
  if (/\bothello\b|\breversi\b|黑白棋|翻转棋|翻子|flipp?ing.*dis[ck]|dis[ck].*flipp?ing/i.test(corpus)) {
    return "能力缺口：Othello / 黑白棋需要方格落子、八方向翻子、强制跳过和终盘计分；当前没有对应 Executable Kernel，不能生成可玩版本。";
  }
  return null;
}

/** Project the existing Rule System; do not introduce another generator or rules engine. */
export function createGameSpec(rule: RuleSystem, generation: GenerationMetadata): GameSpec {
  const kernel = rule.runtimeSupport.status === "executable" ? rule.runtimeSupport.kernel : null;
  // Existing Kernels own setup/phase advancement/end/scoring. Keep that delegation explicit.
  const phases = kernel ? [{ id: "kernel-turn", name: `${kernel.type}: phase advancement` }] : rule.stages;
  return {
    schemaVersion: 1, ruleSystemId: rule.id, ruleSystemVersion: rule.version, name: rule.name,
    generation: structuredClone(generation),
    players: { min: rule.participants.min, max: rule.participants.max, default: rule.participants.default, visibility: "kernel-scoped" },
    objects: rule.entities.map(({ id, name, kind }) => ({ id, name, kind, visibility: "kernel-scoped" })),
    regions: rule.playSurface.regions.map(({ id, name }) => ({ id, name, visibility: "kernel-scoped" })),
    relationships: [],
    setup: kernel ? [`${kernel.type}: initialSessionState`] : rule.setup,
    actions: rule.actions.map(({ id, label, description }) => ({ id, label, description, phaseIds: phases.map((phase) => phase.id) })),
    phases,
    endConditions: kernel ? [{ id: "kernel-end", description: `${kernel.type}: authoritative termination` }] : rule.outcomes.map(({ id, name }) => ({ id, description: name })),
    scoring: kernel ? { kind: "kernel-hook", hook: `${kernel.type}: authoritative outcome` } : { kind: "none", hook: null },
    presentation: { kind: rule.playSurface.kind, layout: rule.playSurface.layout },
    execution: { kernelType: kernel?.type ?? null },
  };
}

/** Legacy Rule Systems remain readable without silently claiming a v1 migration. */
export function refreshGameSpec(rule: RuleSystem): void {
  if (rule.generation) rule.gameSpec = createGameSpec(rule, rule.generation);
}

export function ruleSystemSpecIssues(rule: RuleSystem): SpecIssue[] {
  if (!rule.generation && !rule.gameSpec) return [];
  const result = validateGameSpec(rule.gameSpec);
  const issues = [...result.issues];
  if (!rule.generation) issues.push({ path: "generation", message: "Generation metadata is missing." });
  else {
    const gap = gameSpecCapabilityGap(`${rule.generation.sourcePrompt}\n${rule.name}\n${rule.pitch}\n${rule.rules.map((item) => item.text).join("\n")}`);
    if (gap) issues.unshift({ path: "execution", message: gap });
    if (JSON.stringify(rule.gameSpec) !== JSON.stringify(createGameSpec(rule, rule.generation))) {
      issues.push({ path: "ruleSystemVersion", message: "GameSpec is stale; save this Rule System again before building." });
    }
  }
  if (rule.runtimeSupport.status !== "executable") issues.push({ path: "execution", message: "尚未配置对应的 Executable Kernel；已保存草稿，不能开局。" });
  return issues;
}
