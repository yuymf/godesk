import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { GameProject, GenerationPlan, RuleSystem } from "../src/creator/project-contract";
import { BASELINE_PROMPTS } from "../src/creator/fixtures/game-spec";
import { GENERATOR_VERSION, ruleSystemSpecIssues } from "../src/creator/game-spec";
import { waitForJob } from "./projects-test-helpers";

const origin = "https://godesk.test";
async function post(path: string, body: unknown) {
  return SELF.fetch(`${origin}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}
async function generate(idea: string) {
  const { project } = await (await post("/api/projects", { name: "GameSpec regression" })).json<{ project: GameProject }>();
  const input = { kind: "generate-rule-system", expectedVersion: project.version, idea, idempotencyKey: "gamespec-generation" };
  const queued = await (await post(`/api/projects/${project.id}/jobs`, input)).json<{ id: string }>();
  const job = await waitForJob(queued.id);
  expect(job.status, job.error).toBe("succeeded");
  return { project, job, input };
}
async function readRule(projectId: string) {
  return (await SELF.fetch(`${origin}/api/projects/${projectId}?view=rule-system`)).json<RuleSystem>();
}

describe("GameSpec generation, save and build gate", () => {
  it.each(BASELINE_PROMPTS)("saves %s as an explicit capability gap, never a substitute Build", async (idea) => {
    const { project, job, input } = await generate(idea);
    expect(job.result?.artifactState).toMatchObject({ status: "capability-gap" });
    const rule = await readRule(project.id);
    expect(rule.generation).toMatchObject({ sourcePrompt: idea, generatorVersion: GENERATOR_VERSION, rulesVersion: "source-rules-v1" });
    expect(rule.generation?.assumptions.join(" ")).toContain("能力缺口");
    expect(rule.gameSpec?.generation.seed).toBeGreaterThan(0);
    expect(rule.runtimeSupport.status).toBe("draft");
    const { generationPlan } = await (await SELF.fetch(`${origin}/api/projects/${project.id}?view=generation-plan`)).json<{ generationPlan: GenerationPlan }>();
    expect(generationPlan.proposedRuntime).toBeUndefined();
    expect(generationPlan.unsupported.join(" ")).toContain("能力缺口");
    const repeated = await (await post(`/api/projects/${project.id}/jobs`, input)).json<{ id: string }>();
    expect(repeated.id).toBe(job.id);
    expect(await readRule(project.id)).toEqual(rule);
    const approved = await (await post(`/api/projects/${project.id}/changes`, {
      expectedVersion: 2, idempotencyKey: "force-substitute",
      operations: [{ op: "approve_generation_plan", planId: generationPlan.id }, {
        op: "configure_score_race", config: { victoryTarget: 10, maxTurns: 20, actions: [{ id: "score", label: "Score", points: 1 }] },
      }],
    })).json<{ project: GameProject }>();
    const build = await post(`/api/projects/${project.id}/builds`, { expectedVersion: approved.project.version, idempotencyKey: "blocked-build" });
    expect(build.status).toBe(409);
    expect(await build.json()).toMatchObject({ error: "gamespec_invalid", issues: expect.arrayContaining([expect.objectContaining({ path: "execution" })]) });
    const savedBuilds = await (await SELF.fetch(`${origin}/api/projects/${project.id}?view=builds`)).json<{ builds: unknown[] }>();
    expect(savedBuilds.builds).toEqual([]);
  });

  it("persists a valid version and seed through auto-build, reopen, edit and recompile", async () => {
    const { project, job } = await generate("三位玩家轮流发言扩展同一个点子；每回合必须写一句回应，12 回合后结束。");
    expect(job.result?.artifactState).toMatchObject({ status: "built", issues: [] });
    const rule = await readRule(project.id);
    expect(ruleSystemSpecIssues(rule)).toEqual([]);
    const session = job.result?.session as { seed: number };
    expect(session.seed).toBe(rule.gameSpec?.generation.seed);
    const savedProject = await (await SELF.fetch(`${origin}/api/projects/${project.id}`)).json<GameProject>();
    const changedResponse = await post(`/api/projects/${project.id}/changes`, {
      expectedVersion: savedProject.version, idempotencyKey: "incomplete-edit",
      operations: [{ op: "update_rule_system", fields: { actions: [] } }],
    });
    expect(changedResponse.status).toBe(200);
    const changed = await changedResponse.json<{ project: GameProject; ruleSystem: RuleSystem }>();
    expect(changed.ruleSystem.gameSpec?.ruleSystemVersion).toBe(changed.ruleSystem.version);
    expect(changed.ruleSystem.generation).toEqual(rule.generation);
    const failed = await post(`/api/projects/${project.id}/builds`, { expectedVersion: changed.project.version, idempotencyKey: "invalid-recompile" });
    expect(failed.status).toBe(409);
    expect(await failed.json()).toMatchObject({ error: "gamespec_invalid" });
    const builds = await (await SELF.fetch(`${origin}/api/projects/${project.id}?view=builds`)).json<{ builds: Array<{ ruleSystem: RuleSystem }> }>();
    expect(builds.builds).toHaveLength(1);
    expect(builds.builds[0].ruleSystem.gameSpec).toEqual(rule.gameSpec);
  });
});
