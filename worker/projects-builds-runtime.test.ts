import {
  env,
  runInDurableObject,
  SELF,
} from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { GameProject } from "../src/creator/project-contract";
import {
  waitForJob,
  shareApi,
  claimSeat,
} from "./projects-test-helpers";

describe("Game Project HTTP seam — changesets, builds, runtime, playtests", () => {

  it("applies one idempotent changeset and rejects stale edits", async () => {
    const createdResponse = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "版本冲突测试桌" }),
    });
    const { project } = await createdResponse.json<{
      project: { id: string; version: number; activeRuleSystemId: string };
    }>();
    const changeBody = {
      expectedVersion: 1,
      idempotencyKey: "changeset-test-001",
      operations: [
        {
          op: "add_source",
          source: {
            kind: "brief",
            name: "雾港玩法简述",
            content: "三名调查员在港口合作寻找失踪货物。",
            provenance: {
              origin: "creator-authored",
              locator: "Creator Studio",
            },
          },
        },
        {
          op: "update_rule_system",
          fields: {
            name: "雾港失踪案",
            pitch: "合作调查，然后带着证据离港。",
            participants: { min: 3, max: 3, default: 3, roles: [] },
            durationMinutes: 45,
          },
        },
      ],
    };

    const changedResponse = await SELF.fetch(
      `https://godesk.test/api/projects/${project.id}/changes`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(changeBody),
      },
    );
    expect(changedResponse.status).toBe(200);
    const changed = await changedResponse.json<{
      changeset: { id: string; previousVersion: number; newVersion: number };
      project: { version: number };
      warnings: string[];
      studioUrl: string;
    }>();
    expect(changed).toMatchObject({
      changeset: { previousVersion: 1, newVersion: 2 },
      project: { version: 2 },
    });
    expect(new URL(changed.studioUrl).pathname).toBe(`/studio/${project.id}`);
    expect(Array.isArray(changed.warnings)).toBe(true);

    const retriedResponse = await SELF.fetch(
      `https://godesk.test/api/projects/${project.id}/changes`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(changeBody),
      },
    );
    expect(await retriedResponse.json()).toEqual(changed);

    const staleResponse = await SELF.fetch(
      `https://godesk.test/api/projects/${project.id}/changes`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...changeBody,
          idempotencyKey: "changeset-test-stale",
        }),
      },
    );
    expect(staleResponse.status).toBe(409);
    await expect(staleResponse.json()).resolves.toMatchObject({
      error: "version_conflict",
      currentVersion: 2,
      affectedEntities: expect.arrayContaining([
        expect.stringMatching(/^source:/),
        expect.stringMatching(/^rule-system:/),
      ]),
      currentState: {
        project: { version: 2 },
        ruleSystem: { name: "雾港失踪案" },
      },
    });

    const ruleSystemResponse = await SELF.fetch(
      `https://godesk.test/api/projects/${project.id}?view=rule-system`,
    );
    await expect(ruleSystemResponse.json()).resolves.toMatchObject({
      name: "雾港失踪案",
      pitch: "合作调查，然后带着证据离港。",
      participants: { min: 3, max: 3, default: 3 },
      durationMinutes: 45,
    });

    const sourcesResponse = await SELF.fetch(
      `https://godesk.test/api/projects/${project.id}?view=sources`,
    );
    const sources = await sourcesResponse.json<{
      sources: Array<{ name: string; provenance: { origin: string } }>;
    }>();
    expect(sources.sources).toHaveLength(1);
    expect(sources.sources[0]).toMatchObject({
      name: "雾港玩法简述",
      provenance: { origin: "creator-authored" },
    });
  });

  it("rejects a generated image whose visual brief is not in the same project", async () => {
    const createdResponse = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "素材谱系拒绝测试" }),
    });
    const { project } = await createdResponse.json<{
      project: { id: string; version: number };
    }>();

    const response = await SELF.fetch(
      `https://godesk.test/api/projects/${project.id}/changes`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: project.version,
          idempotencyKey: "missing-visual-brief-001",
          operations: [{
            op: "add_source",
            source: {
              kind: "image",
              imageUse: "project-asset",
              name: "Generated card",
              content: "data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAABwAQCdASoBAAEAAUAmJaQAA3AA/vuUAAA=",
              provenance: {
                origin: "generative-api",
                locator: "Codex host-user quota",
                basedOnSourceIds: ["source_missing_visual_brief"],
              },
            },
          }],
        }),
      },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "source_dependency_not_found",
    });
  });

  it("keeps Visual References unbound and rejects direct placement", async () => {
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "参考图边界测试" }),
    }).then((response) => response.json<{
      project: { id: string; version: number };
    }>());
    const image = "data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAABwAQCdASoBAAEAAUAmJaQAA3AA/vuUAAA=";
    const queued = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/jobs`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "generate-rule-system",
          expectedVersion: created.project.version,
          idea: "两名玩家合作调查。调查推进 2 点，累计 6 点完成，最多 8 回合。",
          visualInputs: [{
            name: "港口风格参考",
            content: image,
            pageNumber: 1,
            imageUse: "visual-reference",
          }],
          idempotencyKey: "visual-reference-generation-001",
        }),
      },
    ).then((response) => response.json<{ id: string }>());
    const generated = await waitForJob(queued.id) as unknown as {
      result: {
        project: { version: number };
        ruleSystem: { presentation: { image?: unknown } };
        sources: Array<{ id: string; kind: string; imageUse?: string }>;
      };
    };
    const reference = generated.result.sources.find(
      (source) => source.kind === "image",
    );
    expect(reference).toMatchObject({ imageUse: "visual-reference" });
    expect(generated.result.ruleSystem.presentation.image).toBeUndefined();

    const binding = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/changes`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: generated.result.project.version,
          idempotencyKey: "bind-visual-reference-001",
          operations: [{
            op: "update_rule_system",
            fields: {
              presentation: {
                theme: "mist-reference",
                image: { sourceId: reference?.id, url: image, alt: "港口风格参考" },
                visuals: [{ provenance: "uploaded", label: "港口风格参考" }],
              },
            },
          }],
        }),
      },
    );
    expect(binding.status).toBe(409);
    await expect(binding.json()).resolves.toEqual({
      error: "visual_reference_not_bindable",
    });
  });

  it("rejects malformed operations and includes action provenance in builds", async () => {
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "受控变更验证" }),
    }).then((response) =>
      response.json<{ project: { id: string; version: number } }>(),
    );
    const malformed = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/changes`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: 1,
          idempotencyKey: "malformed-null-operation",
          operations: [null],
        }),
      },
    );
    expect(malformed.status).toBe(400);
    const malformedAction = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/changes`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: 1,
          idempotencyKey: "malformed-null-action",
          operations: [{
            op: "configure_score_race",
            config: {
              victoryTarget: 1,
              maxTurns: 1,
              actions: [null],
            },
          }],
        }),
      },
    );
    expect(malformedAction.status).toBe(400);

    const sourced = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/changes`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: 1,
          idempotencyKey: "action-source-create",
          operations: [{
            op: "add_source",
            source: {
              kind: "brief",
              name: "行动依据",
              content: "玩家可以检查中央区域。",
              provenance: {
                origin: "creator-authored",
                locator: "test",
              },
            },
          }],
        }),
      },
    ).then((response) =>
      response.json<{
        project: { version: number };
        sources: Array<{ id: string }>;
      }>(),
    );
    const sourceId = sourced.sources[0].id;
    const changed = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/changes`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: sourced.project.version,
          idempotencyKey: "action-source-link",
          operations: [{
            op: "update_rule_system",
            fields: {
              actions: [{
                id: "inspect",
                label: "检查",
                description: "检查中央区域。",
                sourceId,
                provenance: "source-anchored",
                confidence: 1,
              }],
            },
          }],
        }),
      },
    ).then((response) => response.json<{ project: { version: number } }>());
    const compiled = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/builds`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: changed.project.version,
          idempotencyKey: "action-source-compile",
        }),
      },
    ).then((response) =>
      response.json<{ build: { sourceIds: string[] } }>(),
    );
    expect(compiled.build.sourceIds).toContain(sourceId);
  });

  it("compiles an immutable build from one Rule System version", async () => {
    const createdResponse = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "不可变构建测试桌" }),
    });
    const { project: created } = await createdResponse.json<{
      project: { id: string };
    }>();

    const ruleSystemResponse = await SELF.fetch(
      `https://godesk.test/api/projects/${created.id}/changes`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: 1,
          idempotencyKey: "build-ruleSystem-v1",
          operations: [
            {
              op: "update_rule_system",
              fields: {
                name: "雾港初版",
                pitch: "原始构建内容",
                participants: { min: 3, max: 3, default: 3, roles: [] },
                durationMinutes: 45,
              },
            },
          ],
        }),
      },
    );
    expect(ruleSystemResponse.status).toBe(200);

    const compileInput = {
      expectedVersion: 2,
      idempotencyKey: "compile-v2-once",
    };
    const compiledResponse = await SELF.fetch(
      `https://godesk.test/api/projects/${created.id}/builds`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(compileInput),
      },
    );
    expect(compiledResponse.status).toBe(201);
    const compiled = await compiledResponse.json<{
      project: { version: number };
      warnings: string[];
      studioUrl: string;
      build: {
        id: string;
        ruleSystemVersion: number;
        ruleSystem: { pitch: string };
        playableUrl: string;
        warnings: string[];
      };
    }>();
    expect(compiled).toMatchObject({
      project: { version: 3 },
      build: {
        ruleSystemVersion: 2,
        ruleSystem: { pitch: "原始构建内容" },
      },
    });
    expect(new URL(compiled.build.playableUrl).pathname).toBe(
      `/play/${compiled.build.id}`,
    );
    expect(compiled.build.warnings.length).toBeGreaterThan(0);
    expect(compiled.warnings).toEqual(compiled.build.warnings);
    expect(new URL(compiled.studioUrl).pathname).toBe(`/studio/${created.id}`);

    const retriedResponse = await SELF.fetch(
      `https://godesk.test/api/projects/${created.id}/builds`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(compileInput),
      },
    );
    expect(await retriedResponse.json()).toEqual(compiled);

    const recompiledResponse = await SELF.fetch(
      `https://godesk.test/api/projects/${created.id}/builds`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: 3,
          idempotencyKey: "compile-same-ruleSystem-new-request",
        }),
      },
    );
    expect(recompiledResponse.status).toBe(200);
    await expect(recompiledResponse.json()).resolves.toMatchObject({
      project: { version: 3 },
      build: { id: compiled.build.id, ruleSystemVersion: 2 },
    });

    await SELF.fetch(`https://godesk.test/api/projects/${created.id}/changes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        expectedVersion: 3,
        idempotencyKey: "unrelated-source-after-build",
        operations: [
          {
            op: "add_source",
            source: {
              kind: "brief",
              name: "未引用研究笔记",
              content: "这条来源没有被当前 Rule System 的任何规则或 Game Entity 引用。",
              provenance: {
                origin: "creator-authored",
                locator: "test",
              },
            },
          },
        ],
      }),
    });
    const afterUnrelatedSource = await SELF.fetch(
      `https://godesk.test/api/projects/${created.id}/builds`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: 4,
          idempotencyKey: "compile-after-unrelated-source",
        }),
      },
    );
    await expect(afterUnrelatedSource.json()).resolves.toMatchObject({
      project: { version: 4 },
      build: { id: compiled.build.id, ruleSystemVersion: 2 },
    });

    await SELF.fetch(`https://godesk.test/api/projects/${created.id}/changes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        expectedVersion: 4,
        idempotencyKey: "edit-after-build",
        operations: [
          {
            op: "update_rule_system",
            fields: { pitch: "构建之后的新内容" },
          },
        ],
      }),
    });

    const buildResponse = await SELF.fetch(
      `https://godesk.test/api/builds/${compiled.build.id}`,
    );
    expect(buildResponse.status).toBe(200);
    await expect(buildResponse.json()).resolves.toMatchObject({
      id: compiled.build.id,
      ruleSystemVersion: 2,
      ruleSystem: { pitch: "原始构建内容" },
    });
  });

  it("branches and switches Rule Systems inside one project", async () => {
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "RuleSystem 分支测试桌" }),
    }).then((response) => response.json<{
      project: { id: string; version: number; activeRuleSystemId: string };
    }>());
    const originalRuleSystemId = created.project.activeRuleSystemId;
    const duplicated = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/rule-systems/${originalRuleSystemId}/duplicate`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: 1,
          idempotencyKey: "branch-ruleSystem-001",
          name: "竞速变体",
        }),
      },
    );
    expect(duplicated.status).toBe(201);
    const branch = await duplicated.json<{
      project: { version: number; activeRuleSystemId: string };
      ruleSystem: { id: string; name: string; version: number };
      ruleSystems: Array<{ id: string }>;
    }>();
    expect(branch).toMatchObject({
      project: { version: 2, activeRuleSystemId: branch.ruleSystem.id },
      ruleSystem: { name: "竞速变体", version: 1 },
    });
    expect(branch.ruleSystems).toHaveLength(2);

    const switched = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/changes`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: 2,
          idempotencyKey: "activate-original-001",
          operations: [
            {
              op: "activate_rule_system",
              ruleSystemId: originalRuleSystemId,
            },
          ],
        }),
      },
    ).then((response) => response.json<{
      project: { version: number; activeRuleSystemId: string };
      ruleSystem: { id: string };
    }>());
    expect(switched).toMatchObject({
      project: { version: 3, activeRuleSystemId: originalRuleSystemId },
      ruleSystem: { id: originalRuleSystemId },
    });
  });

  it("restores an immutable Build into a new editable Rule System", async () => {
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Build 恢复测试" }),
    }).then((response) => response.json<{
      project: { id: string; version: number; activeRuleSystemId: string };
    }>());
    const projectId = created.project.id;
    const originalRuleSystemId = created.project.activeRuleSystemId;

    await SELF.fetch(`https://godesk.test/api/projects/${projectId}/changes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        expectedVersion: 1,
        idempotencyKey: "restore-source-edit",
        operations: [{
          op: "update_rule_system",
          fields: { pitch: "应被精确恢复的旧玩法" },
        }],
      }),
    });
    const compiled = await SELF.fetch(
      `https://godesk.test/api/projects/${projectId}/builds`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: 2,
          idempotencyKey: "restore-source-build",
        }),
      },
    ).then((response) => response.json<{
      project: { version: number };
      build: { id: string; ruleSystem: { pitch: string } };
    }>());
    expect(compiled.project.version).toBe(3);

    await SELF.fetch(`https://godesk.test/api/projects/${projectId}/changes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        expectedVersion: 3,
        idempotencyKey: "edit-after-restore-source",
        operations: [{
          op: "update_rule_system",
          fields: { pitch: "后来被证明不合适的玩法" },
        }],
      }),
    });

    const restoredResponse = await SELF.fetch(
      `https://godesk.test/api/projects/${projectId}/builds/${compiled.build.id}/restore`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: 4,
          idempotencyKey: "restore-build-001",
        }),
      },
    );
    expect(restoredResponse.status).toBe(201);
    const restored = await restoredResponse.json<{
      project: { version: number; activeRuleSystemId: string };
      ruleSystem: {
        id: string;
        version: number;
        pitch: string;
        restoredFromBuildId: string;
      };
      ruleSystems: Array<{ id: string }>;
      changeset: { restoredFromBuildId: string; affectedEntities: string[] };
      sourceBuildId: string;
    }>();
    expect(restored).toMatchObject({
      project: { version: 5, activeRuleSystemId: restored.ruleSystem.id },
      ruleSystem: {
        version: 1,
        pitch: "应被精确恢复的旧玩法",
        restoredFromBuildId: compiled.build.id,
      },
      changeset: { restoredFromBuildId: compiled.build.id },
      sourceBuildId: compiled.build.id,
    });
    expect(restored.ruleSystem.id).not.toBe(originalRuleSystemId);
    expect(restored.ruleSystems).toHaveLength(2);
    expect(restored.changeset.affectedEntities).toContain(
      `build:${compiled.build.id}`,
    );

    const retried = await SELF.fetch(
      `https://godesk.test/api/projects/${projectId}/builds/${compiled.build.id}/restore`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: 4,
          idempotencyKey: "restore-build-001",
        }),
      },
    );
    expect(retried.status).toBe(201);
    await expect(retried.json()).resolves.toMatchObject({
      project: { version: 5 },
      ruleSystem: { id: restored.ruleSystem.id },
    });

    const duplicateRestore = await SELF.fetch(
      `https://godesk.test/api/projects/${projectId}/builds/${compiled.build.id}/restore`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: 5,
          idempotencyKey: "restore-build-002",
        }),
      },
    );
    expect(duplicateRestore.status).toBe(409);
    await expect(duplicateRestore.json()).resolves.toMatchObject({
      error: "build_already_active",
      buildId: compiled.build.id,
    });

    await SELF.fetch(`https://godesk.test/api/projects/${projectId}/changes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        expectedVersion: 5,
        idempotencyKey: "edit-after-first-restore",
        operations: [{
          op: "update_rule_system",
          fields: { pitch: "恢复后继续尝试的新方向" },
        }],
      }),
    });
    const restoredAgain = await SELF.fetch(
      `https://godesk.test/api/projects/${projectId}/builds/${compiled.build.id}/restore`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: 6,
          idempotencyKey: "restore-build-003",
        }),
      },
    );
    expect(restoredAgain.status).toBe(201);
    await expect(restoredAgain.json()).resolves.toMatchObject({
      project: { version: 7 },
      ruleSystem: {
        pitch: "应被精确恢复的旧玩法",
        restoredFromBuildId: compiled.build.id,
      },
    });

    await expect(
      SELF.fetch(`https://godesk.test/api/builds/${compiled.build.id}`).then(
        (response) => response.json(),
      ),
    ).resolves.toMatchObject({
      id: compiled.build.id,
      ruleSystem: { pitch: "应被精确恢复的旧玩法" },
    });
  });

  it("runs fixed-seed playtests and validates authoritative room intents", async () => {
    const createdResponse = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "确定性房间测试桌" }),
    });
    const { project } = await createdResponse.json<{
      project: { id: string };
    }>();
    await SELF.fetch(`https://godesk.test/api/projects/${project.id}/changes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        expectedVersion: 1,
        idempotencyKey: "configure-runtime-v1",
        operations: [
          {
            op: "configure_score_race",
            config: {
              victoryTarget: 6,
              maxTurns: 20,
              actions: [
                { id: "steady", label: "稳步推进", points: 1 },
                { id: "bold", label: "大胆推进", points: 2 },
              ],
            },
          },
          {
            op: "update_rule_system",
            fields: {
              presentation: {
                theme: "test",
                visuals: [{
                  provenance: "kit",
                  label: "Test presentation kit",
                }],
              },
            },
          },
        ],
      }),
    });
    const compiledResponse = await SELF.fetch(
      `https://godesk.test/api/projects/${project.id}/builds`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: 2,
          idempotencyKey: "compile-runtime-v2",
        }),
      },
    );
    const { build } = await compiledResponse.json<{
      build: { id: string };
    }>();

    const playtestResponse = await SELF.fetch(
      `https://godesk.test/api/builds/${build.id}/playtests`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          seed: 42,
          idempotencyKey: "playtest-seed-42",
        }),
      },
    );
    expect(playtestResponse.status).toBe(201);
    const playtest = await playtestResponse.json<{
      id: string;
      evidenceType: string;
      metrics: { turns: number };
      replayId: string;
      replayUrl: string;
    }>();
    expect(playtest).toMatchObject({
      evidenceType: "automated-bot-simulation",
    });
    expect(playtest.metrics.turns).toBeGreaterThan(0);
    expect(new URL(playtest.replayUrl).pathname).toBe(
      `/replay/${playtest.replayId}`,
    );

    const roomResponse = await SELF.fetch(
      `https://godesk.test/api/builds/${build.id}/sessions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ seed: 42, idempotencyKey: "room-seed-42" }),
      },
    );
    const room = await roomResponse.json<{
      id: string;
      replayId: string;
      state: { turn: number; scores: number[] };
      acceptedActions: unknown[];
    }>();
    const rejected = await SELF.fetch(
      `https://godesk.test/api/sessions/${room.id}/intents`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          intentId: "wrong-seat",
          seat: 1,
          actionId: "bold",
        }),
      },
    );
    expect(rejected.status).toBe(409);

    const acceptedResponse = await SELF.fetch(
      `https://godesk.test/api/sessions/${room.id}/intents`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          intentId: "seat-zero-bold",
          seat: 0,
          actionId: "bold",
        }),
      },
    );
    const accepted = await acceptedResponse.json<{
      state: { turn: number; activeSeat: number; scores: number[] };
      acceptedActions: Array<{ intentId: string }>;
    }>();
    expect(accepted).toMatchObject({
      state: { turn: 1, activeSeat: 1, scores: [2, 0] },
      acceptedActions: [{ intentId: "seat-zero-bold" }],
    });

    const replayResponse = await SELF.fetch(
      `https://godesk.test/api/replays/${room.replayId}`,
    );
    await expect(replayResponse.json()).resolves.toMatchObject({
      evidenceType: "session-action-log",
      finalState: { turn: 1, scores: [2, 0] },
      acceptedActions: [{ intentId: "seat-zero-bold" }],
    });
    const creatorStub = env.CREATOR_PROJECTS.getByName("local-creator");
    await runInDurableObject(creatorStub, async (_instance, state) => {
      const storedRoom = await state.storage.get<Record<string, unknown>>(
        `session:${room.id}`,
      );
      const storedReplay = await state.storage.get<Record<string, unknown>>(
        `replay:${room.replayId}`,
      );
      await state.storage.put({
        [`session:${room.id}`]: {
          ...storedRoom,
          state: {
            turn: 999,
            activeSeat: 0,
            scores: [999, 999],
            status: "complete",
            winnerSeat: 0,
          },
        },
        [`replay:${room.replayId}`]: {
          ...storedReplay,
          finalState: {
            turn: 999,
            activeSeat: 0,
            scores: [999, 999],
            status: "complete",
            winnerSeat: 0,
          },
        },
      });
    });
    const reconnected = await SELF.fetch(
      `https://godesk.test/api/sessions/${room.id}`,
    );
    await expect(reconnected.json()).resolves.toMatchObject(accepted);
    await expect(
      SELF.fetch(
        `https://godesk.test/api/replays/${room.replayId}`,
      ).then((response) => response.json()),
    ).resolves.toMatchObject({
      finalState: { turn: 1, scores: [2, 0] },
      acceptedActions: [{ intentId: "seat-zero-bold" }],
    });

    const deleted = await SELF.fetch(
      `https://godesk.test/api/projects/${project.id}`,
      {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          confirmationProjectId: project.id,
          expectedVersion: 3,
          idempotencyKey: "delete-complete-aggregate",
        }),
      },
    );
    expect(deleted.status).toBe(200);
    for (const path of [
      `/api/builds/${build.id}`,
      `/api/playtests/${playtest.id}`,
      `/api/sessions/${room.id}`,
      `/api/replays/${playtest.replayId}`,
      `/api/replays/${room.replayId}`,
    ]) {
      expect(await SELF.fetch(`https://godesk.test${path}`)).toMatchObject({
        status: 404,
      });
    }
  });

  it("invalidates executable runtime after Rule System kernel inputs change", async () => {
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "运行时失效测试桌" }),
    }).then((response) =>
      response.json<{ project: { id: string; version: number } }>(),
    );
    const configured = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/changes`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: created.project.version,
          idempotencyKey: "runtime-invalidation-configure-1",
          operations: [{
            op: "configure_score_race",
            config: {
              victoryTarget: 4,
              maxTurns: 8,
              actions: [{ id: "step", label: "前进", points: 1 }],
            },
          }],
        }),
      },
    ).then((response) =>
      response.json<{ project: { version: number } }>(),
    );
    const participantCountChanged = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/changes`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: configured.project.version,
          idempotencyKey: "runtime-invalidation-player-count",
          operations: [{
            op: "update_rule_system",
            fields: {
              participants: { min: 3, max: 3, default: 3, roles: [] },
            },
          }],
        }),
      },
    ).then((response) =>
      response.json<{ project: { version: number } }>(),
    );
    const afterPlayerCount = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}?view=rule-system`,
    ).then((response) => response.json<{
      runtimeSupport: { status: string; unsupported: string[] };
    }>());
    expect(afterPlayerCount.runtimeSupport).toMatchObject({ status: "draft" });
    expect(afterPlayerCount.runtimeSupport.unsupported).toContain(
      "改了人数、规则或行动后，需要再确认一次玩法才能继续开玩。",
    );

    const reconfigured = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/changes`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: participantCountChanged.project.version,
          idempotencyKey: "runtime-invalidation-configure-2",
          operations: [{
            op: "configure_score_race",
            config: {
              victoryTarget: 4,
              maxTurns: 8,
              actions: [{ id: "step", label: "前进", points: 1 }],
            },
          }],
        }),
      },
    ).then((response) =>
      response.json<{ project: { version: number } }>(),
    );
    const actionChanged = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/changes`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: reconfigured.project.version,
          idempotencyKey: "runtime-invalidation-actions",
          operations: [{
            op: "update_rule_system",
            fields: {
              actions: [{
                id: "step",
                label: "前进两步",
                description: "获得 1 分。",
                sourceId: null,
                provenance: "ai-proposed",
                confidence: 0.5,
              }],
            },
          }],
        }),
      },
    ).then((response) =>
      response.json<{ project: { version: number } }>(),
    );
    const compiled = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/builds`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: actionChanged.project.version,
          idempotencyKey: "runtime-invalidation-build",
        }),
      },
    ).then((response) => response.json<{
      build: { id: string; unsupportedBehavior: string[] };
    }>());
    expect(compiled.build.unsupportedBehavior).toContain("rule-execution");
    const room = await SELF.fetch(
      `https://godesk.test/api/builds/${compiled.build.id}/sessions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ seed: 42, idempotencyKey: "runtime-invalidation-room" }),
      },
    );
    expect(room.status).toBe(422);
  });

  it("keeps the executable runtime after descriptive action edits", async () => {
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "运行时描述编辑测试桌" }),
    }).then((response) =>
      response.json<{ project: { id: string; version: number } }>(),
    );
    const configured = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/changes`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: created.project.version,
          idempotencyKey: "runtime-description-configure-1",
          operations: [{
            op: "configure_score_race",
            config: {
              victoryTarget: 4,
              maxTurns: 8,
              actions: [{ id: "step", label: "前进", points: 1 }],
            },
          }],
        }),
      },
    ).then((response) =>
      response.json<{ project: { version: number } }>(),
    );
    const current = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}?view=rule-system`,
    ).then((response) => response.json<{
      actions: Array<{
        id: string;
        label: string;
        description: string;
        sourceId: string | null;
        provenance: "source-anchored" | "system-generated" | "ai-proposed";
        confidence: number;
      }>;
    }>());
    const edited = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/changes`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: configured.project.version,
          idempotencyKey: "runtime-description-edit-1",
          operations: [{
            op: "update_rule_system",
            fields: {
              actions: current.actions.map((action) =>
                action.id === "step"
                  ? { ...action, description: "先说明行动，再说明获得 1 分。" }
                  : action,
              ),
            },
          }],
        }),
      },
    ).then((response) =>
      response.json<{ project: { version: number } }>(),
    );
    expect(edited.project.version).toBe(configured.project.version + 1);
    const afterEdit = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}?view=rule-system`,
    ).then((response) => response.json<{
      actions: Array<{ id: string; description: string }>;
      runtimeSupport: { status: string };
    }>());
    expect(afterEdit.runtimeSupport).toMatchObject({ status: "executable" });
    expect(afterEdit.actions.find((action) => action.id === "step"))
      .toMatchObject({ description: "先说明行动，再说明获得 1 分。" });

    const compiled = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/builds`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: edited.project.version,
          idempotencyKey: "runtime-description-build-1",
        }),
      },
    ).then((response) => response.json<{
      build: { id: string; ruleSystem: { runtimeSupport: { status: string } } };
    }>());
    expect(compiled.build.ruleSystem.runtimeSupport)
      .toMatchObject({ status: "executable" });
    const playtest = await SELF.fetch(
      `https://godesk.test/api/builds/${compiled.build.id}/playtests`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ seed: 42, idempotencyKey: "runtime-description-room" }),
      },
    );
    expect(playtest.status).toBe(201);
  });

  it("iterates from a Studio prompt, compiles the next Build, and self-plays it", async () => {
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Studio 自然语言迭代测试桌" }),
    }).then((response) =>
      response.json<{ project: { id: string; version: number } }>(),
    );
    const configured = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/changes`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: created.project.version,
          idempotencyKey: "studio-iteration-configure-1",
          operations: [{
            op: "configure_score_race",
            config: {
              victoryTarget: 4,
              maxTurns: 8,
              actions: [{ id: "step", label: "前进", points: 1 }],
            },
          }],
        }),
      },
    ).then((response) =>
      response.json<{ project: { id: string; version: number } }>(),
    );
    const baseline = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/builds`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: configured.project.version,
          idempotencyKey: "studio-iteration-baseline-build-1",
        }),
      },
    ).then((response) =>
      response.json<{ build: { id: string }; project: { version: number } }>(),
    );

    const queued = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/jobs`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "iterate-rule-system",
          expectedVersion: baseline.project.version,
          prompt: "把行动 1 的说明改成“先说明行动，再说明获得 1 分”。",
          idempotencyKey: "studio-iteration-job-1",
        }),
      },
    ).then((response) => response.json<{ id: string; status: string }>());
    expect(queued.status).toBe("queued");
    const iteration = await waitForJob(queued.id) as unknown as {
      status: string;
      error?: string;
      result: {
        project: { version: number };
        ruleSystem: {
          runtimeSupport: { status: string };
          actions: Array<{ id: string; description: string; sourceId: string | null; provenance: string }>;
        };
        sources: Array<{ content: string; provenance: { origin: string } }>;
        iteration: { actionId: string; summary: string };
      };
    };
    expect(iteration).toMatchObject({
      status: "succeeded",
      result: {
        project: { version: baseline.project.version + 1 },
        iteration: {
          actionId: "step",
          summary: "将行动「前进」的说明改为「先说明行动，再说明获得 1 分」。",
        },
      },
    });
    expect(iteration.result.ruleSystem.runtimeSupport).toMatchObject({
      status: "executable",
    });
    expect(iteration.result.ruleSystem.actions).toContainEqual(
      expect.objectContaining({
        id: "step",
        description: "先说明行动，再说明获得 1 分",
        provenance: "ai-proposed",
      }),
    );
    expect(iteration.result.sources.find((source) =>
      source.content === "把行动 1 的说明改成“先说明行动，再说明获得 1 分”。"
    )).toMatchObject({
      provenance: { origin: "creator-authored" },
    });

    const nextBuildJob = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/jobs`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "compile-build",
          expectedVersion: iteration.result.project.version,
          idempotencyKey: "studio-iteration-next-build-1",
        }),
      },
    ).then((response) => response.json<{ id: string }>());
    const nextBuild = await waitForJob(nextBuildJob.id) as unknown as {
      status: string;
      result: {
        build: {
          id: string;
          ruleSystem: { runtimeSupport: { status: string }; actions: Array<{ description: string }> };
        };
      };
    };
    expect(nextBuild).toMatchObject({
      status: "succeeded",
      result: {
        build: {
          ruleSystem: {
            runtimeSupport: { status: "executable" },
          },
        },
      },
    });
    expect(nextBuild.result.build.ruleSystem.actions[0]?.description).toBe(
      "先说明行动，再说明获得 1 分",
    );
    expect(nextBuild.result.build.id).not.toBe(baseline.build.id);

    const playtestJob = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/jobs`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "bot-playtest",
          buildId: nextBuild.result.build.id,
          seed: 42,
          idempotencyKey: "studio-iteration-next-playtest-1",
        }),
      },
    ).then((response) => response.json<{ id: string }>());
    await expect(waitForJob(playtestJob.id)).resolves.toMatchObject({
      status: "succeeded",
      result: {
        seed: 42,
        buildId: nextBuild.result.build.id,
      },
    });

    const rejected = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/jobs`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "iterate-rule-system",
          expectedVersion: iteration.result.project.version + 1,
          prompt: "把胜利目标改成 12 分。",
          idempotencyKey: "studio-iteration-unsupported-1",
        }),
      },
    ).then((response) => response.json<{ id: string }>());
    await expect(waitForJob(rejected.id)).resolves.toMatchObject({
      status: "failed",
      error: expect.stringContaining("iteration_unsupported"),
    });
    const afterRejected = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}`,
    ).then((response) => response.json<{ version: number }>());
    expect(afterRejected.version).toBe(iteration.result.project.version + 1);
  });

  it("compiles a hidden-role source on score-race but refuses to share it", async () => {
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "换皮剧本杀" }),
    }).then((response) => response.json<{
      project: { id: string; version: number };
    }>());
    const configured = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/changes`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: created.project.version,
          idempotencyKey: "playability-floor-reskin",
          operations: [{
            op: "configure_score_race",
            config: {
              victoryTarget: 4,
              maxTurns: 6,
              actions: [{ id: "advance", label: "质问", points: 2 }],
            },
          }, {
            op: "update_rule_system",
            fields: {
              name: "别墅剧本杀",
              pitch: "三个人找出凶手，发言后指控。",
              presentation: {
                theme: "harbor-kit",
                visuals: [{ provenance: "kit", label: "Harbor ink presentation kit" }],
              },
            },
          }],
        }),
      },
    ).then((response) => response.json<{ project: { version: number } }>());
    const compiled = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/builds`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: configured.project.version,
          idempotencyKey: "playability-floor-reskin-build",
        }),
      },
    ).then((response) => response.json<{
      build: {
        id: string;
        playabilityFloor: { status: string; reason: string; genre: string };
      };
    }>());
    expect(compiled.build.playabilityFloor.status).toBe("failed");
    expect(compiled.build.playabilityFloor.genre).toBe("hidden-role");
    const refused = await SELF.fetch(
      `https://godesk.test/api/builds/${compiled.build.id}/sessions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          seed: 42,
          idempotencyKey: "playability-floor-refused",
        }),
      },
    );
    expect(refused.status).toBe(422);
    await expect(refused.json()).resolves.toMatchObject({
      error: "playability_floor_unmet",
      playabilityFloor: { status: "failed", genre: "hidden-role" },
    });
  });

  it("uses the invitation URL for two clients to claim seats and take authoritative turns", async () => {
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "双浏览器邀请桌" }),
    }).then((response) => response.json<{
      project: { id: string; version: number };
    }>());
    const configured = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/changes`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: created.project.version,
          idempotencyKey: "two-browser-configure",
          operations: [{
            op: "configure_score_race",
            config: {
              victoryTarget: 5,
              maxTurns: 6,
              actions: [{ id: "advance", label: "前进", points: 1 }],
            },
          }, {
            op: "update_rule_system",
            fields: {
              presentation: {
                theme: "harbor-kit",
                visuals: [{ provenance: "kit", label: "Harbor ink presentation kit" }],
              },
            },
          }],
        }),
      },
    ).then((response) => response.json<{ project: { version: number } }>());
    const compiled = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/builds`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: configured.project.version,
          idempotencyKey: "two-browser-build",
        }),
      },
    ).then((response) => response.json<{ build: { id: string } }>());
    const roomResponse = await SELF.fetch(
      `https://godesk.test/api/builds/${compiled.build.id}/sessions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ seed: 42, idempotencyKey: "two-browser-room" }),
      },
    );
    const room = await roomResponse.json<{
      id: string;
      sessionUrl: string;
      replayId: string;
      error?: string;
    }>();
    expect(roomResponse.status, JSON.stringify(room)).toBe(201);
    expect(new URL(room.sessionUrl).pathname).toBe(`/room/${room.id}`);
    expect(new URL(room.sessionUrl).searchParams.get("share")).toBeTruthy();
    expect(new URL(room.sessionUrl).searchParams.has("creator")).toBe(false);

    const publicRoomUrl = new URL(room.sessionUrl);
    publicRoomUrl.hostname = "friend.godesk.example";
    const publicShare = publicRoomUrl.toString();
    const publicRoomPage = await SELF.fetch(publicRoomUrl);
    expect(
      publicRoomPage.status,
      `${publicRoomUrl.toString()} ${await publicRoomPage.text()}`,
    ).toBe(200);
    const publicSession = await SELF.fetch(shareApi(publicShare, `/api/sessions/${room.id}`));
    expect(publicSession.status, await publicSession.clone().text()).toBe(200);
    const publicBuild = await SELF.fetch(shareApi(publicShare, `/api/builds/${compiled.build.id}`));
    expect(publicBuild.status, await publicBuild.clone().text()).toBe(200);
    const unclaimedTurn = await SELF.fetch(
      shareApi(publicShare, `/api/sessions/${room.id}/intents`),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          intentId: "unclaimed-turn",
          seat: 0,
          actionId: "advance",
        }),
      },
    );
    expect(unclaimedTurn.status).toBe(409);
    await expect(unclaimedTurn.json()).resolves.toMatchObject({
      error: "seat_not_claimed",
    });
    const protectedRoomUrl = new URL(publicRoomUrl);
    protectedRoomUrl.search = "";
    const protectedRoom = await SELF.fetch(
      new Request(protectedRoomUrl, { redirect: "manual" }),
    );
    expect(protectedRoom.status).toBe(302);

    const creatorSeat = await claimSeat(room.id, 0, publicShare, {
      displayName: "Creator",
    });
    expect(creatorSeat.status).toBe(200);
    expect(creatorSeat.seatToken).toMatch(/^seat_/);
    const reclaim = await claimSeat(room.id, 0, publicShare, {
      seatToken: creatorSeat.seatToken,
    });
    expect(reclaim.status).toBe(200);
    expect(reclaim.seatToken).toBe(creatorSeat.seatToken);
    const duplicateSeat = await claimSeat(room.id, 1, publicShare, {
      seatToken: creatorSeat.seatToken,
    });
    expect(duplicateSeat.status).toBe(409);
    expect(duplicateSeat.error).toBe("client_already_seated");
    expect(duplicateSeat.claimedSeat).toBe(0);
    const friendSeat = await claimSeat(room.id, 1, publicShare, {
      displayName: "Friend",
    });
    expect(friendSeat.status).toBe(200);
    expect(friendSeat.seatToken).toMatch(/^seat_/);

    const impersonatedTurn = await SELF.fetch(
      shareApi(publicShare, `/api/sessions/${room.id}/intents`),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          intentId: "impersonated-turn",
          seat: 0,
          seatToken: friendSeat.seatToken,
          actionId: "advance",
        }),
      },
    );
    expect(impersonatedTurn.status).toBe(409);
    await expect(impersonatedTurn.json()).resolves.toMatchObject({
      error: expect.stringMatching(/^(seat_not_claimed|seat_claimed)$/),
    });

    const firstTurn = await SELF.fetch(
      shareApi(publicShare, `/api/sessions/${room.id}/intents`),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          intentId: "creator-turn",
          seat: 0,
          seatToken: creatorSeat.seatToken,
          actionId: "advance",
        }),
      },
    );
    expect(firstTurn.status).toBe(200);
    const secondTurn = await SELF.fetch(
      shareApi(publicShare, `/api/sessions/${room.id}/intents`),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          intentId: "friend-turn",
          seat: 1,
          seatToken: friendSeat.seatToken,
          actionId: "advance",
        }),
      },
    );
    await expect(secondTurn.json()).resolves.toMatchObject({
      state: { turn: 2, activeSeat: 0, scores: [1, 1] },
      acceptedActions: [
        { intentId: "creator-turn", seat: 0 },
        { intentId: "friend-turn", seat: 1 },
      ],
      seats: [
        { seat: 0, displayName: "Creator" },
        { seat: 1, displayName: "Friend" },
      ],
    });
    const friendFeedback = await SELF.fetch(
      shareApi(publicShare, `/api/sessions/${room.id}/feedback`),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          seat: 1,
          seatToken: friendSeat.seatToken,
          rating: 4,
          comment: "两个人的回合衔接很清楚。",
        }),
      },
    );
    expect(friendFeedback.status).toBe(200);
    await expect(friendFeedback.json()).resolves.toMatchObject({
      feedback: [{ seat: 1, rating: 4, comment: "两个人的回合衔接很清楚。" }],
    });
    await expect(
      SELF.fetch(shareApi(publicShare, `/api/sessions/${room.id}`)).then((response) =>
        response.json(),
      ),
    ).resolves.toMatchObject({
      feedback: [{ seat: 1, rating: 4 }],
    });
    await expect(
      SELF.fetch(shareApi(publicShare, `/api/replays/${room.replayId}`)).then(
        (response) => response.json(),
      ),
    ).resolves.toMatchObject({
      evidenceType: "session-action-log",
      finalState: { turn: 2, scores: [1, 1] },
      acceptedActions: [
        { intentId: "creator-turn", seat: 0 },
        { intentId: "friend-turn", seat: 1 },
      ],
    });
  });

  it("rejects legacy immutable build shapes instead of backfilling them", async () => {
    const creatorId = "legacy-build-creator";
    const stub = env.CREATOR_PROJECTS.getByName(creatorId);
    await runInDurableObject(stub, async (_instance, state) => {
      await state.storage.put("build:build_legacy", {
        id: "build_legacy",
        projectId: "project_legacy",
        ruleSystemId: "rule_system_legacy",
        ruleSystemVersion: 1,
        ruleSystem: {
          id: "rule_system_legacy",
          version: 1,
          name: "Legacy",
          pitch: "",
          playerCount: 2,
          durationMinutes: 30,
          rules: [],
          entities: [],
          stages: [],
          outcomes: [],
          presentation: { theme: "legacy" },
          runtimeSupport: { status: "draft", unsupported: [] },
        },
        sourceIds: [],
        warnings: [],
        unsupportedBehavior: ["rule-execution"],
        createdAt: new Date().toISOString(),
      });
    });
    const response = await SELF.fetch(
      "https://godesk.test/api/builds/build_legacy",
      { headers: { "x-godesk-dev-creator": creatorId } },
    );
    expect(response.status).toBe(410);
  });

  it("rejects a legacy bare project instead of synthesizing a current record", async () => {
    const creatorId = "legacy-project-creator";
    const stub = env.CREATOR_PROJECTS.getByName(creatorId);
    await runInDurableObject(stub, async (_instance, state) => {
      await state.storage.put("/projects/project_legacy", {
        id: "project_legacy",
        name: "Legacy project",
        version: 1,
        activeRuleSystemId: "rule_system_legacy",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        capabilities: {
          authentication: "local-development-only",
          compilation: "unavailable",
          persistence: "durable-object",
        },
      });
    });
    const response = await SELF.fetch(
      "https://godesk.test/api/projects/project_legacy",
      { headers: { "x-godesk-dev-creator": creatorId } },
    );
    expect(response.status).toBe(410);
  });

  it("keeps stale project records out of the current project list", async () => {
    const creatorId = "legacy-list-creator";
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-godesk-dev-creator": creatorId,
      },
      body: JSON.stringify({ name: "当前 Rule System 项目" }),
    }).then((response) => response.json<{ project: GameProject }>());
    const stub = env.CREATOR_PROJECTS.getByName(creatorId);
    await runInDurableObject(stub, async (_instance, state) => {
      await state.storage.put("/projects/project_legacy", {
        id: "project_legacy",
        name: "Legacy project",
        version: 1,
        activeRuleSystemId: "rule_system_legacy",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        capabilities: {
          authentication: "local-development-only",
          compilation: "unavailable",
          persistence: "durable-object",
        },
      });
    });

    const response = await SELF.fetch("https://godesk.test/api/projects", {
      headers: { "x-godesk-dev-creator": creatorId },
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      projects: [created.project],
    });
  });

});
