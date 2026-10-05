import { SELF, env, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { GameProject, GenerationPlan, RuleSystem } from "../src/creator/project-contract";
import { BASELINE_PROMPTS } from "../src/creator/fixtures/game-spec";
import { defaultRenderSpec } from "../src/creator/render-spec";
import storedHexV1 from "../src/creator/fixtures/gamespec-v1/nl-hex-settlement.rule-system.json";
import { PROJECT_PREFIX, type ProjectRecord, type StoredPlayableBuild } from "./project-operations";
import { waitForJob } from "./projects-test-helpers";

const origin = "https://godesk.test";
const stub = () => env.CREATOR_PROJECTS.getByName("local-creator");

async function post(path: string, body: unknown) {
  return SELF.fetch(`${origin}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}
async function readRule(projectId: string) {
  return (await SELF.fetch(`${origin}/api/projects/${projectId}?view=rule-system`)).json<RuleSystem>();
}
async function projectVersion(projectId: string) {
  return (await (await SELF.fetch(`${origin}/api/projects/${projectId}`)).json<GameProject>()).version;
}

/** NL Othello → approved disc-flipping-v1 → compiled Build, all through the public API. */
async function othelloWithBuild(key: string) {
  const { project } = await (await post("/api/projects", { name: `GameSpec v2 ${key}` })).json<{ project: GameProject }>();
  const queued = await (await post(`/api/projects/${project.id}/jobs`, {
    kind: "generate-rule-system", expectedVersion: project.version, idea: BASELINE_PROMPTS[1], idempotencyKey: `${key}-gen`,
  })).json<{ id: string }>();
  expect((await waitForJob(queued.id)).status).toBe("succeeded");
  const { generationPlan } = await (await SELF.fetch(`${origin}/api/projects/${project.id}?view=generation-plan`)).json<{ generationPlan: GenerationPlan }>();
  const approved = await post(`/api/projects/${project.id}/changes`, {
    expectedVersion: await projectVersion(project.id), idempotencyKey: `${key}-approve`,
    operations: [{ op: "approve_generation_plan", planId: generationPlan.id }],
  });
  expect(approved.status).toBe(200);
  const compiled = await post(`/api/projects/${project.id}/builds`, { expectedVersion: await projectVersion(project.id), idempotencyKey: `${key}-build` });
  expect(compiled.status).toBe(201);
  const { build } = await compiled.json<{ build: { id: string } }>();
  return { projectId: project.id, buildId: build.id };
}

/** Rewrite a v2 Rule System into the exact shape origin/main stored (GameSpec v1). */
function toStoredV1(rule: RuleSystem): RuleSystem {
  const legacy = structuredClone(rule) as RuleSystem & { presentation: { theme?: string } };
  delete legacy.presentation.render;
  legacy.presentation.theme = "rulebook-studio";
  if (legacy.gameSpec) {
    delete legacy.gameSpec.render;
    Object.assign(legacy.gameSpec, { schemaVersion: 1 });
  }
  return legacy;
}

async function downgradeStorage(projectId: string, buildId: string) {
  await runInDurableObject(stub(), async (_instance, state) => {
    const record = (await state.storage.get<ProjectRecord>(`${PROJECT_PREFIX}${projectId}`))!;
    record.ruleSystem = toStoredV1(record.ruleSystem);
    record.ruleSystems = record.ruleSystems.map(toStoredV1);
    record.builds = record.builds.map((build) => ({ ...build, ruleSystem: toStoredV1(build.ruleSystem) }));
    await state.storage.put(`${PROJECT_PREFIX}${projectId}`, record);
    const build = (await state.storage.get<StoredPlayableBuild>(`build:${buildId}`))!;
    await state.storage.put(`build:${buildId}`, { ...build, ruleSystem: toStoredV1(build.ruleSystem) });
  });
}

async function rawRecord(projectId: string) {
  return runInDurableObject(stub(), async (_instance, state) =>
    (await state.storage.get<ProjectRecord>(`${PROJECT_PREFIX}${projectId}`))!);
}

describe("GameSpec v2 lazy storage migration (G3D-12)", () => {
  it("a stored v1 project and Build load as v2, build, share, and persist v2 on the next write", async () => {
    const { projectId, buildId } = await othelloWithBuild("lazy-v1");
    await downgradeStorage(projectId, buildId);
    const raw = await rawRecord(projectId);
    expect(raw.ruleSystem.gameSpec?.schemaVersion as number).toBe(1);
    expect((raw.ruleSystem.presentation as { theme?: string }).theme).toBe("rulebook-studio");

    const rule = await readRule(projectId);
    expect("theme" in rule.presentation).toBe(false);
    expect(rule.presentation.render).toEqual(defaultRenderSpec("disc-flipping-v1", "table"));
    expect(rule.gameSpec).toMatchObject({ schemaVersion: 2, render: rule.presentation.render });

    // Playability Floor share gate on the OLD stored (v1) Build snapshot.
    const shared = await post(`/api/builds/${buildId}/sessions`, { seed: 42, idempotencyKey: "share-migrated-v1-build" });
    expect(shared.status).toBe(201);
    const bot = await post(`/api/builds/${buildId}/playtests`, { seed: 42, idempotencyKey: "bot-migrated-v1-build" });
    expect(bot.status).toBe(201);

    const rebuilt = await post(`/api/projects/${projectId}/builds`, { expectedVersion: await projectVersion(projectId), idempotencyKey: "rebuild-migrated" });
    expect(rebuilt.status).toBe(201);
    const persisted = await rawRecord(projectId);
    expect(persisted.ruleSystem.gameSpec?.schemaVersion).toBe(2);
    expect(persisted.ruleSystem.gameSpec?.render).toEqual(rule.presentation.render);
    expect("theme" in persisted.ruleSystem.presentation).toBe(false);
  });

  it("a real stored v1 hex record (captured from origin/main) is readable, buildable and passes the gates", async () => {
    const { project } = await (await post("/api/projects", { name: "Real v1 fixture" })).json<{ project: GameProject }>();
    const fixture = structuredClone(storedHexV1) as unknown as RuleSystem;
    await runInDurableObject(stub(), async (_instance, state) => {
      const record = (await state.storage.get<ProjectRecord>(`${PROJECT_PREFIX}${project.id}`))!;
      record.ruleSystem = fixture;
      record.ruleSystems = [fixture];
      record.project = { ...record.project, activeRuleSystemId: fixture.id };
      await state.storage.put(`${PROJECT_PREFIX}${project.id}`, record);
    });
    const rule = await readRule(project.id);
    expect(rule.gameSpec?.schemaVersion).toBe(2);
    expect(rule.gameSpec?.render?.water.enabled).toBe(true);
    const built = await post(`/api/projects/${project.id}/builds`, { expectedVersion: await projectVersion(project.id), idempotencyKey: "real-v1-build" });
    expect(built.status).toBe(201);
    const { build } = await built.json<{ build: { id: string; presentationFloor: { status: string }; playabilityFloor: { status: string } } }>();
    expect(build.presentationFloor.status).toBe("passed");
    expect(build.playabilityFloor.status).toBe("passed");
  });
});

describe("update_rule_system with GameSpec v2 presentation", () => {
  it("accepts authored render edits (water / sun / material) and projects them into gameSpec.render", async () => {
    const { projectId } = await othelloWithBuild("edit-render");
    const before = await readRule(projectId);
    const render = structuredClone(before.presentation.render!);
    render.water = { ...render.water, enabled: true, shallow: "#2a9d8f" };
    render.lighting.sun.elevationDeg = 64;
    render.materials.piece = { ...render.materials.piece, base: "#d4af37", metalness: 0.6 };
    const edited = await post(`/api/projects/${projectId}/changes`, {
      expectedVersion: await projectVersion(projectId), idempotencyKey: "edit-render-ok",
      operations: [{ op: "update_rule_system", fields: { presentation: { ...before.presentation, render } } }],
    });
    expect(edited.status).toBe(200);
    const after = await readRule(projectId);
    expect(after.gameSpec?.render).toEqual(render);
    expect(after.presentation.render).toEqual(render);
    const built = await post(`/api/projects/${projectId}/builds`, { expectedVersion: await projectVersion(projectId), idempotencyKey: "edit-render-build" });
    expect(built.status).toBe(201);
  });

  it("drops a legacy client's theme and keeps the current render when render is omitted", async () => {
    const { projectId } = await othelloWithBuild("legacy-theme");
    const before = await readRule(projectId);
    const response = await post(`/api/projects/${projectId}/changes`, {
      expectedVersion: await projectVersion(projectId), idempotencyKey: "legacy-theme",
      operations: [{ op: "update_rule_system", fields: { presentation: { theme: "old-plugin-theme", visuals: before.presentation.visuals } } }],
    });
    expect(response.status).toBe(200);
    const after = await readRule(projectId);
    expect("theme" in after.presentation).toBe(false);
    expect(after.presentation.render).toEqual(before.presentation.render);
    expect(after.gameSpec?.render).toEqual(before.presentation.render);
  });

  it.each([
    ["unknown material", (render: NonNullable<RuleSystem["presentation"]["render"]>) => { render.bindings[0]!.material = "no-such-material"; }],
    ["unregistered asset", (render: NonNullable<RuleSystem["presentation"]["render"]>) => { render.audio.musicTracks = ["music/unlicensed"]; }],
    ["inverted camera polar range", (render: NonNullable<RuleSystem["presentation"]["render"]>) => { render.camera.minPolarDeg = 70; render.camera.maxPolarDeg = 30; }],
    ["script-like extra key", (render: NonNullable<RuleSystem["presentation"]["render"]>) => { Object.assign(render, { shader: "void main(){}" }); }],
  ])("rejects an invalid render (%s) without changing storage", async (_name, corrupt) => {
    const { projectId } = await othelloWithBuild(`bad-render-${_name.replace(/\W+/g, "-")}`);
    const before = await readRule(projectId);
    const render = structuredClone(before.presentation.render!);
    corrupt(render);
    const response = await post(`/api/projects/${projectId}/changes`, {
      expectedVersion: await projectVersion(projectId), idempotencyKey: "bad-render",
      operations: [{ op: "update_rule_system", fields: { presentation: { ...before.presentation, render } } }],
    });
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
    const after = await readRule(projectId);
    expect(after.version).toBe(before.version);
    expect(after.presentation.render).toEqual(before.presentation.render);
  });
});
