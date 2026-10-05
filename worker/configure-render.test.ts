import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { GameProject, GenerationPlan, RuleSystem } from "../src/creator/project-contract";
import { ruleSystemSpecIssues } from "../src/creator/game-spec";
import { defaultRenderSpec } from "../src/creator/render-spec";
import { callMcpTool, waitForJob } from "./projects-test-helpers";

/**
 * G3D-15：生成默认 render + MCP `configure_render` 局部 patch。
 * 3D Room 截图那半条验收（逐轮可见差异）要等 G3D-14 的通用桌面 mapper，
 * 这里断言的是数据层：逐轮 render 变化、GameSpec 校验通过、非法 patch 被拒。
 */
const origin = "https://godesk.test";

async function post(path: string, body: unknown) {
  return SELF.fetch(`${origin}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}
async function readRule(projectId: string) {
  return (await SELF.fetch(`${origin}/api/projects/${projectId}?view=rule-system`)).json<RuleSystem>();
}
async function projectVersion(projectId: string) {
  return (await (await SELF.fetch(`${origin}/api/projects/${projectId}`)).json<GameProject>()).version;
}

async function generate(key: string, idea: string) {
  const { project } = await (await post("/api/projects", { name: `G3D-15 ${key}` })).json<{ project: GameProject }>();
  const queued = await (await post(`/api/projects/${project.id}/jobs`, {
    kind: "generate-rule-system", expectedVersion: project.version, idea, idempotencyKey: `${key}-gen`,
  })).json<{ id: string }>();
  expect((await waitForJob(queued.id)).status).toBe("succeeded");
  return project.id;
}

async function approve(projectId: string, key: string) {
  const { generationPlan } = await (await SELF.fetch(`${origin}/api/projects/${projectId}?view=generation-plan`)).json<{ generationPlan: GenerationPlan }>();
  const approved = await post(`/api/projects/${projectId}/changes`, {
    expectedVersion: await projectVersion(projectId), idempotencyKey: `${key}-approve`,
    operations: [{ op: "approve_generation_plan", planId: generationPlan.id }],
  });
  expect(approved.status).toBe(200);
}

async function patchViaMcp(id: number, projectId: string, key: string, patch: Record<string, unknown>) {
  return callMcpTool<{ ruleSystem: RuleSystem; project: { version: number } }>(id, "apply_project_patch", {
    projectId,
    expectedVersion: await projectVersion(projectId),
    idempotencyKey: key,
    operations: [{ op: "configure_render", patch }],
  });
}

async function patchViaHttp(projectId: string, key: string, patch: unknown) {
  return post(`/api/projects/${projectId}/changes`, {
    expectedVersion: await projectVersion(projectId), idempotencyKey: key,
    operations: [{ op: "configure_render", patch }],
  });
}

describe("G3D-15 default render + configure_render", () => {
  it("NL「做一款两人翻转棋」gets the disc-flipping render preset; three configure_render rounds each change the render and keep GameSpec valid", async () => {
    const projectId = await generate("othello", "做一款两人翻转棋");
    // 草稿阶段 playSurface 仍是 screen（没有 3D 声明）；批准生成计划绑定 disc-flipping-v1 后写入其 preset。
    expect((await readRule(projectId)).presentation.render).toBeUndefined();
    await approve(projectId, "othello");
    const initial = await readRule(projectId);
    expect(initial.runtimeSupport.status === "executable" && initial.runtimeSupport.kernel.type).toBe("disc-flipping-v1");
    expect(initial.presentation.render).toEqual(defaultRenderSpec("disc-flipping-v1", initial.playSurface.kind));

    const rounds = [
      { patch: { water: { enabled: true, shallow: "#3fa7c9" } }, check: (rule: RuleSystem) => expect(rule.presentation.render?.water).toMatchObject({ enabled: true, shallow: "#3fa7c9" }) },
      { patch: { lighting: { sun: { elevationDeg: 24 } } }, check: (rule: RuleSystem) => expect(rule.presentation.render?.lighting.sun.elevationDeg).toBe(24) },
      { patch: { materials: { piece: { base: "#222831", roughness: 0.3, metalness: 0.2 } } }, check: (rule: RuleSystem) => expect(rule.presentation.render?.materials.piece).toMatchObject({ base: "#222831", roughness: 0.3, metalness: 0.2 }) },
    ];
    let previous = initial;
    for (const [index, round] of rounds.entries()) {
      const result = await patchViaMcp(400 + index, projectId, `othello-render-${index}`, round.patch);
      const rule = await readRule(projectId);
      expect(result.ruleSystem.presentation.render).toEqual(rule.presentation.render);
      round.check(rule);
      expect(rule.presentation.render).not.toEqual(previous.presentation.render);
      // 只改了 patch 指到的字段。
      expect(rule.presentation.render?.bindings).toEqual(initial.presentation.render?.bindings);
      expect(rule.gameSpec?.render).toEqual(rule.presentation.render);
      expect(ruleSystemSpecIssues(rule)).toEqual([]);
      previous = rule;
    }
    // 累积生效：第 3 轮后前两轮的修改仍在。
    expect(previous.presentation.render?.water.shallow).toBe("#3fa7c9");
    expect(previous.presentation.render?.lighting.sun.elevationDeg).toBe(24);
  });

  it("rejects out-of-range values, unknown materials, unlicensed assets, empty patches and unknown keys without changing the render", async () => {
    const projectId = await generate("reject", "做一款两人翻转棋");
    await approve(projectId, "reject");
    const before = (await readRule(projectId)).presentation.render;
    const bad: Array<[string, unknown]> = [
      ["elevation-out-of-range", { lighting: { sun: { elevationDeg: 5 } } }],
      ["unknown-material", { bindings: [{ objectKind: "disc", mesh: "disc", material: "no-such", scale: 1 }] }],
      ["unlicensed-asset", { materials: { piece: { texture: "textures/not-registered" } } }],
      ["incomplete-new-material", { materials: { brass: { base: "#b08d57" } } }],
      ["camera-range", { camera: { minPolarDeg: 70, maxPolarDeg: 30 } }],
      ["empty", {}],
      ["unknown-key", { fog: { density: 1 } }],
    ];
    for (const [key, patch] of bad) {
      const response = await patchViaHttp(projectId, `reject-${key}`, patch);
      expect(response.status, key).toBe(400);
    }
    expect((await readRule(projectId)).presentation.render).toEqual(before);
  });

  it("refuses configure_render on a non-spatial surface", async () => {
    const { project } = await (await post("/api/projects", { name: "G3D-15 screen" })).json<{ project: GameProject }>();
    const rule = await readRule(project.id);
    expect(rule.playSurface.kind).toBe("screen");
    const response = await patchViaHttp(project.id, "screen-render", { water: { foam: 0.2 } });
    expect(response.status).toBe(400);
    expect(await response.text()).toContain("不是桌面");
  });
});
