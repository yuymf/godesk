import { HOBBYIST_STARTERS } from "../src/creator/hobbyist-starters";
import { runCreatorJob } from "./job-runner";
import { PROJECT_PREFIX, type ProjectRecord, type StoredPlayableBuild } from "./project-operations";
import { SELF, env, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { CreatorJob, GameProject, GenerationPlan, RuleSystem } from "../src/creator/project-contract";
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

const conversation = "三位玩家轮流发言扩展同一个点子；每回合必须写一句回应，12 回合后结束。";
const corruptions: Array<[string, (rule: RuleSystem) => void]> = [
  ["unknown kernel", (rule) => { rule.gameSpec!.execution.kernelType = "unknown-v1"; }],
  ["unsupported schema", (rule) => { Object.assign(rule.gameSpec!, { schemaVersion: 99 }); }],
  ["stale generator", (rule) => { rule.generation!.generatorVersion = "obsolete-v0"; rule.gameSpec!.generation.generatorVersion = "obsolete-v0"; }],
  ["unsupported rules", (rule) => { rule.generation!.rulesVersion = "future-v2"; rule.gameSpec!.generation.rulesVersion = "future-v2"; }],
  ["stale provenance", (rule) => { rule.gameSpec!.generation.seed++; }],
  ["declared mechanics", (rule) => { rule.generation!.requestedMechanics = ["disc-flipping"]; rule.gameSpec!.generation.requestedMechanics = ["disc-flipping"]; }],
];

describe("all artifact entry points fail closed", () => {
  it.each(corruptions)("manual build, compile job, share and bot replay refuse %s", async (_name, corrupt) => {
    const { project, job } = await generate(conversation);
    const buildId = (job.result!.build as { id: string }).id;
    const stub = env.CREATOR_PROJECTS.getByName("local-creator");
    const version = await runInDurableObject(stub, async (_instance, state) => {
      const record = (await state.storage.get<ProjectRecord>(`${PROJECT_PREFIX}${project.id}`))!;
      corrupt(record.ruleSystem);
      await state.storage.put(`${PROJECT_PREFIX}${project.id}`, record);
      const build = (await state.storage.get<StoredPlayableBuild>(`build:${buildId}`))!;
      corrupt(build.ruleSystem);
      await state.storage.put(`build:${buildId}`, build);
      return record.project.version;
    });
    const manual = await post(`/api/projects/${project.id}/builds`, { expectedVersion: version, idempotencyKey: "manual-refusal" });
    expect(manual.status).toBe(409);
    expect(await manual.json()).toMatchObject({ error: "gamespec_invalid" });
    const queued = await (await post(`/api/projects/${project.id}/jobs`, { kind: "compile-build", expectedVersion: version, idempotencyKey: "job-refusal" })).json<{ id: string }>();
    expect(await waitForJob(queued.id)).toMatchObject({ status: "failed", error: "gamespec_invalid" });
    const shared = await post(`/api/builds/${buildId}/sessions`, { seed: 42, idempotencyKey: "share-refusal" });
    expect(shared.status).toBe(422);
    expect(await shared.json()).toMatchObject({ error: "playability_floor_unmet" });
    const bot = await post(`/api/builds/${buildId}/playtests`, { seed: 42, idempotencyKey: "bot-refusal" });
    expect(bot.status).toBe(409);
    expect(await bot.json()).toMatchObject({ error: "gamespec_invalid" });
    const saved = await (await SELF.fetch(`${origin}/api/projects/${project.id}?view=builds`)).json<{ builds: unknown[] }>();
    expect(saved.builds).toHaveLength(1);
  });

  it("approving the placement starter persists its real region actions before compilation", async () => {
    const { project } = await generate(HOBBYIST_STARTERS.find((starter) => starter.id === "board")!.text);
    const { generationPlan } = await (await SELF.fetch(`${origin}/api/projects/${project.id}?view=generation-plan`)).json<{ generationPlan: GenerationPlan }>();
    const approved = await (await post(`/api/projects/${project.id}/changes`, {
      expectedVersion: 2, idempotencyKey: "approve-placement",
      operations: [{ op: "approve_generation_plan", planId: generationPlan.id }],
    })).json<{ project: GameProject; ruleSystem: RuleSystem }>();
    expect(ruleSystemSpecIssues(approved.ruleSystem)).toEqual([]);
    expect(approved.ruleSystem.gameSpec!.actions.map((action) => action.id)).toEqual(
      approved.ruleSystem.playSurface.regions.map((region) => `place:${region.id}`),
    );
    const compiled = await post(`/api/projects/${project.id}/builds`, { expectedVersion: approved.project.version, idempotencyKey: "placement-build" });
    expect(compiled.status).toBe(201);
  });

  it("approved-plan compilation checks declared mechanics without title keywords", async () => {
    const { project } = await generate("两位玩家轮流得分，每次加 1 分，先到 10 分获胜。");
    const rule = await readRule(project.id);
    const { generationPlan } = await (await SELF.fetch(`${origin}/api/projects/${project.id}?view=generation-plan`)).json<{ generationPlan: GenerationPlan }>();
    expect(generationPlan.status).toBe("pending");
    const current = await (await SELF.fetch(`${origin}/api/projects/${project.id}`)).json<GameProject>();
    const approval = await post(`/api/projects/${project.id}/changes`, {
      expectedVersion: current.version, idempotencyKey: "approve-with-mechanics",
      operations: [
        { op: "update_rule_system", fields: { generation: { ...rule.generation, requestedMechanics: ["hex-settlement"] } } },
        { op: "approve_generation_plan", planId: generationPlan.id },
      ],
    });
    expect(approval.status).toBe(200);
    const approved = await approval.json<{ project: GameProject }>();
    const response = await post(`/api/projects/${project.id}/builds`, { expectedVersion: approved.project.version, idempotencyKey: "approved-invalid" });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "gamespec_invalid", issues: expect.arrayContaining([expect.objectContaining({ path: "execution" })]) });
    const builds = await (await SELF.fetch(`${origin}/api/projects/${project.id}?view=builds`)).json<{ builds: unknown[] }>();
    expect(builds.builds).toEqual([]);
  });

  it("automatic generation reaches the common compiler and refuses invalid metadata", async () => {
    const { project } = await (await post("/api/projects", { name: "Auto gate fault injection" })).json<{ project: GameProject }>();
    const stub = env.CREATOR_PROJECTS.getByName("local-creator");
    await runInDurableObject(stub, async (instance, state) => {
      const now = new Date().toISOString();
      const job: CreatorJob = { id: "job_auto_gate", projectId: project.id, kind: "generate-rule-system", status: "queued", idempotencyKey: "auto-gate", createdAt: now, updatedAt: now };
      await state.storage.put(`job:${job.id}`, job);
      let compileAttempts = 0;
      let sessionAttempts = 0;
      await runCreatorJob({
        ctx: state,
        saveJob: async (saved) => { await state.storage.put(`job:${saved.id}`, saved); },
        schedulePendingJobRecovery: async () => {},
        applyProjectChanges: (id, input) => instance.applyProjectChanges(id, input),
        compileProjectBuild: async (id, input) => {
          compileAttempts++;
          // Simulate persisted generator drift at the automatic build boundary.
          const key = `${PROJECT_PREFIX}${id}`;
          const record = (await state.storage.get<ProjectRecord>(key))!;
          record.ruleSystem.generation!.generatorVersion = "obsolete-v0";
          await state.storage.put(key, record);
          const response = await instance.compileProjectBuild(id, input);
          expect(await response.clone().json()).toMatchObject({ error: "gamespec_invalid" });
          return response;
        },
        createBuildSession: async (id, input) => { sessionAttempts++; return instance.createBuildSession(id, input); },
        createBuildPlaytest: (id, input) => instance.createBuildPlaytest(id, input),
      }, job.id, { kind: "generate-rule-system", expectedVersion: project.version, idea: conversation, idempotencyKey: "auto-gate" });
      expect(compileAttempts).toBe(1);
      expect(sessionAttempts).toBe(0);
      const saved = (await state.storage.get<CreatorJob>(`job:${job.id}`))!;
      expect(saved.result?.build).toBeUndefined();
      expect(saved.result?.warnings).toEqual(expect.arrayContaining([expect.stringContaining("gamespec_invalid")]));
      const record = (await state.storage.get<ProjectRecord>(`${PROJECT_PREFIX}${project.id}`))!;
      expect(record.builds).toEqual([]);
    });
  });

  it("restoring an old Build does not upgrade unsupported generator metadata", async () => {
    const { project, job } = await generate(conversation);
    const buildId = (job.result!.build as { id: string }).id;
    const stub = env.CREATOR_PROJECTS.getByName("local-creator");
    const version = await runInDurableObject(stub, async (_instance, state) => {
      const key = `${PROJECT_PREFIX}${project.id}`;
      const record = (await state.storage.get<ProjectRecord>(key))!;
      record.builds[0].ruleSystem.generation!.generatorVersion = "obsolete-v0";
      await state.storage.put(key, record);
      return record.project.version;
    });
    const restored = await post(`/api/projects/${project.id}/builds/${buildId}/restore`, { expectedVersion: version, idempotencyKey: "restore-old" });
    expect(restored.status).toBe(201);
    const result = await restored.json<{ project: GameProject }>();
    const compiled = await post(`/api/projects/${project.id}/builds`, { expectedVersion: result.project.version, idempotencyKey: "restored-recompile" });
    expect(compiled.status).toBe(409);
    expect(await compiled.json()).toMatchObject({ error: "gamespec_invalid" });
  });
});
