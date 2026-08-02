import {
  env,
  evictDurableObject,
  runDurableObjectAlarm,
  runInDurableObject,
  SELF,
} from "cloudflare:test";
import { describe, expect, it } from "vitest";

async function mcpPayload<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (response.headers.get("content-type")?.includes("application/json")) {
    return JSON.parse(text) as T;
  }
  const data = text
    .split("\n")
    .find((line) => line.startsWith("data: "));
  if (!data) throw new Error(`MCP response had no data event: ${text}`);
  return JSON.parse(data.slice("data: ".length)) as T;
}

async function callMcpTool<T>(
  id: number,
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const response = await SELF.fetch("https://godesk.test/mcp", {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });
  expect(response.status).toBe(200);
  const payload = await mcpPayload<{
    result: { isError?: boolean; structuredContent?: T; content: unknown[] };
  }>(response);
  expect(payload.result.isError).not.toBe(true);
  expect(payload.result.structuredContent).toBeTruthy();
  return payload.result.structuredContent as T;
}

async function waitForJob(id: string) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const job = await SELF.fetch(`https://godesk.test/api/jobs/${id}`).then(
      (response) =>
        response.json<{
          id: string;
          status: string;
          result?: Record<string, unknown>;
          error?: string;
        }>(),
    );
    if (job.status === "succeeded" || job.status === "failed") return job;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`job ${id} did not finish`);
}

describe("Game Project HTTP seam", () => {
  it("creates and reopens the same durable project", async () => {
    const createdResponse = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "雾港测试桌" }),
    });

    expect(createdResponse.status).toBe(201);
    const created = await createdResponse.json<{
      editorUrl: string;
      project: {
        id: string;
        name: string;
        version: number;
        activeDefinitionId: string;
      };
    }>();
    expect(created.project).toMatchObject({
      name: "雾港测试桌",
      version: 1,
    });
    expect(created.project.activeDefinitionId).toMatch(/^definition_/);
    expect(new URL(created.editorUrl).pathname).toBe(
      `/editor/${created.project.id}`,
    );

    const reopenedResponse = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}`,
    );

    expect(reopenedResponse.status).toBe(200);
    await expect(reopenedResponse.json()).resolves.toEqual(created.project);
  });

  it.each([
    ["harbor-13", "港口十三号", "source_harbor_13_original_brief"],
    ["mistpeak-lodge", "雾岭山庄", "source_mistpeak_lodge_original_brief"],
  ])(
    "creates the %s default example as an independent sourced project",
    async (templateId, expectedName, expectedSourceId) => {
      const createdResponse = await SELF.fetch(
        "https://godesk.test/api/projects",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: expectedName, templateId }),
        },
      );
      expect(createdResponse.status).toBe(201);
      const created = await createdResponse.json<{
        project: { id: string; version: number };
        warnings: string[];
        editorUrl: string;
      }>();
      expect(created.warnings).toEqual([]);
      expect(new URL(created.editorUrl).pathname).toBe(
        `/editor/${created.project.id}`,
      );

      const definition = await SELF.fetch(
        `https://godesk.test/api/projects/${created.project.id}?view=definition`,
      ).then((response) => response.json<{
        name: string;
        rules: Array<{ sourceId: string; provenance: string }>;
        components: Array<{ sourceId: string; provenance: string }>;
        actions: Array<{ sourceId: string; provenance: string }>;
        runtimeSupport: { status: string; unsupported: string[] };
      }>());
      expect(definition.name).toBe(expectedName);
      expect(definition.runtimeSupport.status).toBe("executable");
      expect(definition.runtimeSupport.unsupported.length).toBeGreaterThan(0);
      for (const entity of [
        ...definition.rules,
        ...definition.components,
        ...definition.actions,
      ]) {
        expect(entity).toMatchObject({
          sourceId: expectedSourceId,
          provenance: "source-anchored",
        });
      }

      const { sources } = await SELF.fetch(
        `https://godesk.test/api/projects/${created.project.id}?view=sources`,
      ).then((response) => response.json<{
        sources: Array<{
          id: string;
          provenance: { origin: string; locator: string };
        }>;
      }>());
      expect(sources).toEqual([
        expect.objectContaining({
          id: expectedSourceId,
          provenance: {
            origin: "creator-authored",
            locator: "GoDesk default example catalog",
            confidence: 1,
          },
        }),
      ]);
    },
  );

  it("rejects unknown default examples", async () => {
    const response = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "不应创建",
        templateId: "third-party-game",
      }),
    });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "没有这个默认案例。",
    });
  });

  it("isolates every project behind the resolved creator identity", async () => {
    const createdResponse = await SELF.fetch(
      "https://godesk.test/api/projects",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-godesk-dev-creator": "creator-a",
        },
        body: JSON.stringify({ name: "Creator A 私有项目" }),
      },
    );
    const { project } = await createdResponse.json<{
      project: { id: string };
    }>();
    expect(
      await SELF.fetch(
        `https://godesk.test/api/projects/${project.id}`,
        { headers: { "x-godesk-dev-creator": "creator-b" } },
      ),
    ).toMatchObject({ status: 404 });
    expect(
      await SELF.fetch(
        `https://godesk.test/api/projects/${project.id}`,
        { headers: { "x-godesk-dev-creator": "creator-a" } },
      ),
    ).toMatchObject({ status: 200 });
  });

  it("fails closed with an OAuth discovery challenge outside local hosts", async () => {
    const response = await SELF.fetch("https://godesk.example/api/projects");
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain(
      "oauth-protected-resource",
    );
  });

  it("publishes protected resource metadata at the MCP-specific discovery path", async () => {
    const response = await SELF.fetch(
      "https://godesk.example/.well-known/oauth-protected-resource/mcp",
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      resource: "https://godesk.example/mcp",
      scopes_supported: ["godesk:read", "godesk:write"],
    });
  });

  it("applies one idempotent changeset and rejects stale edits", async () => {
    const createdResponse = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "版本冲突测试桌" }),
    });
    const { project } = await createdResponse.json<{
      project: { id: string; version: number; activeDefinitionId: string };
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
              locator: "Creator Editor",
            },
          },
        },
        {
          op: "update_definition",
          fields: {
            name: "雾港失踪案",
            pitch: "合作调查，然后带着证据离港。",
            playerCount: 3,
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
      editorUrl: string;
    }>();
    expect(changed).toMatchObject({
      changeset: { previousVersion: 1, newVersion: 2 },
      project: { version: 2 },
    });
    expect(new URL(changed.editorUrl).pathname).toBe(`/editor/${project.id}`);
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
        expect.stringMatching(/^definition:/),
      ]),
      currentState: {
        project: { version: 2 },
        definition: { name: "雾港失踪案" },
      },
    });

    const definitionResponse = await SELF.fetch(
      `https://godesk.test/api/projects/${project.id}?view=definition`,
    );
    await expect(definitionResponse.json()).resolves.toMatchObject({
      name: "雾港失踪案",
      pitch: "合作调查，然后带着证据离港。",
      playerCount: 3,
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
            op: "update_definition",
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

  it("compiles an immutable build from one definition version", async () => {
    const createdResponse = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "不可变构建测试桌" }),
    });
    const { project: created } = await createdResponse.json<{
      project: { id: string };
    }>();

    const definitionResponse = await SELF.fetch(
      `https://godesk.test/api/projects/${created.id}/changes`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: 1,
          idempotencyKey: "build-definition-v1",
          operations: [
            {
              op: "update_definition",
              fields: {
                name: "雾港初版",
                pitch: "原始构建内容",
                playerCount: 3,
                durationMinutes: 45,
              },
            },
          ],
        }),
      },
    );
    expect(definitionResponse.status).toBe(200);

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
      editorUrl: string;
      build: {
        id: string;
        definitionVersion: number;
        definition: { pitch: string };
        playableUrl: string;
        warnings: string[];
      };
    }>();
    expect(compiled).toMatchObject({
      project: { version: 3 },
      build: {
        definitionVersion: 2,
        definition: { pitch: "原始构建内容" },
      },
    });
    expect(new URL(compiled.build.playableUrl).pathname).toBe(
      `/play/${compiled.build.id}`,
    );
    expect(compiled.build.warnings.length).toBeGreaterThan(0);
    expect(compiled.warnings).toEqual(compiled.build.warnings);
    expect(new URL(compiled.editorUrl).pathname).toBe(`/editor/${created.id}`);

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
          idempotencyKey: "compile-same-definition-new-request",
        }),
      },
    );
    expect(recompiledResponse.status).toBe(200);
    await expect(recompiledResponse.json()).resolves.toMatchObject({
      project: { version: 3 },
      build: { id: compiled.build.id, definitionVersion: 2 },
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
              content: "这条来源没有被当前 Definition 的任何规则或组件引用。",
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
      build: { id: compiled.build.id, definitionVersion: 2 },
    });

    await SELF.fetch(`https://godesk.test/api/projects/${created.id}/changes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        expectedVersion: 4,
        idempotencyKey: "edit-after-build",
        operations: [
          {
            op: "update_definition",
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
      definitionVersion: 2,
      definition: { pitch: "原始构建内容" },
    });
  });

  it("branches and switches Game Definitions inside one project", async () => {
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Definition 分支测试桌" }),
    }).then((response) => response.json<{
      project: { id: string; version: number; activeDefinitionId: string };
    }>());
    const originalDefinitionId = created.project.activeDefinitionId;
    const duplicated = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/definitions/${originalDefinitionId}/duplicate`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: 1,
          idempotencyKey: "branch-definition-001",
          name: "竞速变体",
        }),
      },
    );
    expect(duplicated.status).toBe(201);
    const branch = await duplicated.json<{
      project: { version: number; activeDefinitionId: string };
      definition: { id: string; name: string; version: number };
      definitions: Array<{ id: string }>;
    }>();
    expect(branch).toMatchObject({
      project: { version: 2, activeDefinitionId: branch.definition.id },
      definition: { name: "竞速变体", version: 1 },
    });
    expect(branch.definitions).toHaveLength(2);

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
              op: "activate_definition",
              definitionId: originalDefinitionId,
            },
          ],
        }),
      },
    ).then((response) => response.json<{
      project: { version: number; activeDefinitionId: string };
      definition: { id: string };
    }>());
    expect(switched).toMatchObject({
      project: { version: 3, activeDefinitionId: originalDefinitionId },
      definition: { id: originalDefinitionId },
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
      `https://godesk.test/api/builds/${build.id}/rooms`,
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
      `https://godesk.test/api/rooms/${room.id}/intents`,
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
      `https://godesk.test/api/rooms/${room.id}/intents`,
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
      evidenceType: "room-action-log",
      finalState: { turn: 1, scores: [2, 0] },
      acceptedActions: [{ intentId: "seat-zero-bold" }],
    });
    const creatorStub = env.CREATOR_PROJECTS.getByName("local-creator");
    await runInDurableObject(creatorStub, async (_instance, state) => {
      const storedRoom = await state.storage.get<Record<string, unknown>>(
        `room:${room.id}`,
      );
      const storedReplay = await state.storage.get<Record<string, unknown>>(
        `replay:${room.replayId}`,
      );
      await state.storage.put({
        [`room:${room.id}`]: {
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
      `https://godesk.test/api/rooms/${room.id}`,
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
      `/api/rooms/${room.id}`,
      `/api/replays/${playtest.replayId}`,
      `/api/replays/${room.replayId}`,
    ]) {
      expect(await SELF.fetch(`https://godesk.test${path}`)).toMatchObject({
        status: 404,
      });
    }
  });

  it("invalidates executable runtime after definition kernel inputs change", async () => {
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
    const playerCountChanged = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/changes`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: configured.project.version,
          idempotencyKey: "runtime-invalidation-player-count",
          operations: [{
            op: "update_definition",
            fields: { playerCount: 3 },
          }],
        }),
      },
    ).then((response) =>
      response.json<{ project: { version: number } }>(),
    );
    const afterPlayerCount = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}?view=definition`,
    ).then((response) => response.json<{
      runtimeSupport: { status: string; unsupported: string[] };
    }>());
    expect(afterPlayerCount.runtimeSupport).toMatchObject({ status: "draft" });
    expect(afterPlayerCount.runtimeSupport.unsupported).toContain(
      "score-race-v1 requires reconfiguration after player count, rules, or action changes.",
    );

    const reconfigured = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/changes`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: playerCountChanged.project.version,
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
            op: "update_definition",
            fields: {
              actions: [{
                id: "step",
                label: "前进",
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
      `https://godesk.test/api/builds/${compiled.build.id}/rooms`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ seed: 42, idempotencyKey: "runtime-invalidation-room" }),
      },
    );
    expect(room.status).toBe(422);
  });

  it("submits idempotent durable jobs and tracks terminal artifacts", async () => {
    const createdResponse = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "持久任务测试桌" }),
    });
    const { project } = await createdResponse.json<{
      project: { id: string; version: number };
    }>();
    const configuredResponse = await SELF.fetch(
      `https://godesk.test/api/projects/${project.id}/changes`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: project.version,
          idempotencyKey: "job-config-001",
          operations: [
            {
              op: "configure_score_race",
              config: {
                victoryTarget: 5,
                maxTurns: 8,
                actions: [{ id: "advance", label: "推进", points: 1 }],
              },
            },
          ],
        }),
      },
    );
    const configured = await configuredResponse.json<{
      project: { version: number };
    }>();
    const compileInput = {
      kind: "compile-build",
      expectedVersion: configured.project.version,
      idempotencyKey: "durable-compile-001",
    };
    const submittedResponses = await Promise.all([
      SELF.fetch(`https://godesk.test/api/projects/${project.id}/jobs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(compileInput),
      }),
      SELF.fetch(`https://godesk.test/api/projects/${project.id}/jobs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(compileInput),
      }),
    ]);
    expect(submittedResponses.map((response) => response.status)).toEqual([
      202,
      202,
    ]);
    const [queued, raced] = await Promise.all(
      submittedResponses.map((response) => response.json<{
        id: string;
        status: string;
      }>()),
    );
    expect(queued.id).toBe(raced.id);
    expect(queued.status).toBe("queued");
    const submitted = await waitForJob(queued.id) as {
      id: string;
      status: string;
      result: { build: { id: string; playableUrl: string } };
    };
    expect(submitted.status).toBe("succeeded");
    expect(new URL(submitted.result.build.playableUrl).pathname).toBe(
      `/play/${submitted.result.build.id}`,
    );

    const repeated = await SELF.fetch(
      `https://godesk.test/api/projects/${project.id}/jobs`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(compileInput),
      },
    ).then((response) => response.json<{ id: string }>());
    expect(repeated.id).toBe(submitted.id);

    const tracked = await SELF.fetch(
      `https://godesk.test/api/jobs/${submitted.id}`,
    ).then((response) => response.json<{ id: string; status: string }>());
    expect(tracked).toMatchObject({
      id: submitted.id,
      status: "succeeded",
    });

    const queuedExport = await SELF.fetch(
      `https://godesk.test/api/projects/${project.id}/jobs`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "export-build",
          buildId: submitted.result.build.id,
          idempotencyKey: "durable-export-001",
        }),
      },
    ).then((response) => response.json<{ id: string; status: string }>());
    const exportJob = await waitForJob(queuedExport.id) as {
      id: string;
      status: string;
      result: { artifactUrl: string };
    };
    expect(exportJob.status).toBe("succeeded");
    const artifact = await SELF.fetch(exportJob.result.artifactUrl);
    expect(artifact.status).toBe(200);
    expect(artifact.headers.get("content-disposition")).toContain(
      ".godesk.json",
    );

    const failedJob = await SELF.fetch(
      `https://godesk.test/api/projects/${project.id}/jobs`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "render-preview",
          buildId: "build_missing",
          idempotencyKey: "durable-retry-001",
        }),
      },
    ).then((response) => response.json<{ id: string }>());
    await expect(waitForJob(failedJob.id)).resolves.toMatchObject({
      id: failedJob.id,
      status: "failed",
    });
    const retriedJob = await SELF.fetch(
      `https://godesk.test/api/jobs/${failedJob.id}/retry`,
      { method: "POST" },
    ).then((response) => response.json<{ id: string; status: string }>());
    expect(retriedJob).toMatchObject({
      id: failedJob.id,
      status: "queued",
    });
    await expect(waitForJob(failedJob.id)).resolves.toMatchObject({
      id: failedJob.id,
      status: "failed",
      error: "build_not_found",
    });
  });

  it("materializes a brief through a durable generation job", async () => {
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Generation Job 测试桌" }),
    }).then((response) => response.json<{
      project: { id: string; version: number };
    }>());
    const queued = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/jobs`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "generate-definition",
          expectedVersion: 1,
          brief: "三名玩家合作修复灯塔，45 分钟内完成。",
          name: "灯塔协作",
          playerCount: 3,
          durationMinutes: 45,
          idempotencyKey: "generate-definition-001",
        }),
      },
    ).then((response) => response.json<{ id: string; status: string }>());
    expect(queued.status).toBe("queued");
    await expect(waitForJob(queued.id)).resolves.toMatchObject({
      id: queued.id,
      status: "succeeded",
      result: {
        generationMode: "deterministic-brief-materialization",
        project: { version: 2 },
        definition: {
          name: "灯塔协作",
          pitch: "三名玩家合作修复灯塔，45 分钟内完成。",
          playerCount: 3,
        },
        editorUrl: expect.stringContaining(
          `/editor/${created.project.id}`,
        ),
      },
    });
  });

  it("recovers a persisted queued job through an alarm after eviction", async () => {
    const creatorId = "alarm-recovery-creator";
    const creatorHeaders = {
      "content-type": "application/json",
      "x-godesk-dev-creator": creatorId,
    };
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: creatorHeaders,
      body: JSON.stringify({ name: "Alarm 恢复测试桌" }),
    }).then((response) => response.json<{
      project: { id: string; version: number };
    }>());
    const configured = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/changes`,
      {
        method: "POST",
        headers: creatorHeaders,
        body: JSON.stringify({
          expectedVersion: 1,
          idempotencyKey: "alarm-config-001",
          operations: [
            {
              op: "configure_score_race",
              config: {
                victoryTarget: 3,
                maxTurns: 6,
                actions: [{ id: "step", label: "前进", points: 1 }],
              },
            },
          ],
        }),
      },
    ).then((response) => response.json<{ project: { version: number } }>());
    const stub = env.CREATOR_PROJECTS.getByName(creatorId);
    const jobId = "job_alarm_recovery";
    const now = new Date().toISOString();
    await runInDurableObject(stub, async (_instance, state) => {
      await state.storage.put({
        [`job:${jobId}`]: {
          id: jobId,
          projectId: created.project.id,
          kind: "compile-build",
          status: "queued",
          idempotencyKey: "alarm-recovery-001",
          createdAt: now,
          updatedAt: now,
        },
        [`job-input:${jobId}`]: {
          kind: "compile-build",
          expectedVersion: configured.project.version,
          idempotencyKey: "alarm-recovery-001",
        },
      });
      await state.storage.setAlarm(Date.now() + 60_000);
    });
    await evictDurableObject(stub);
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    await expect(
      SELF.fetch(`https://godesk.test/api/jobs/${jobId}`, {
        headers: { "x-godesk-dev-creator": creatorId },
      }).then((response) => response.json()),
    ).resolves.toMatchObject({
      id: jobId,
      status: "succeeded",
      result: { build: { definitionVersion: 2 } },
    });
  }, 15_000);

  it("re-arms a persisted queued job when a duplicate submit arrives", async () => {
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "重复提交恢复测试桌" }),
    }).then((response) => response.json<{
      project: { id: string; version: number };
    }>());
    const jobId = "job_duplicate_recovery";
    const idempotencyKey = "duplicate-recovery-001";
    const input = {
      kind: "compile-build" as const,
      expectedVersion: created.project.version,
      idempotencyKey,
    };
    const stub = env.CREATOR_PROJECTS.getByName("local-creator");
    const now = new Date().toISOString();
    await runInDurableObject(stub, async (_instance, state) => {
      await state.storage.put({
        [`job:${jobId}`]: {
          id: jobId,
          projectId: created.project.id,
          kind: input.kind,
          status: "queued",
          idempotencyKey,
          createdAt: now,
          updatedAt: now,
        },
        [`job-idempotency:${created.project.id}:${idempotencyKey}`]: {
          id: jobId,
          projectId: created.project.id,
          kind: input.kind,
          status: "queued",
          idempotencyKey,
          createdAt: now,
          updatedAt: now,
        },
        [`job-input:${jobId}`]: input,
      });
      await state.storage.deleteAlarm();
    });
    const duplicate = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/jobs`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      },
    );
    expect(duplicate.status).toBe(202);
    await expect(waitForJob(jobId)).resolves.toMatchObject({
      id: jobId,
      status: "succeeded",
      result: { build: { definitionVersion: 1 } },
    });
  }, 15_000);

  it("normalizes legacy immutable build definitions at every read seam", async () => {
    const creatorId = "legacy-build-creator";
    const stub = env.CREATOR_PROJECTS.getByName(creatorId);
    await runInDurableObject(stub, async (_instance, state) => {
      await state.storage.put("build:build_legacy", {
        id: "build_legacy",
        projectId: "project_legacy",
        definitionId: "definition_legacy",
        definitionVersion: 1,
        definition: {
          id: "definition_legacy",
          version: 1,
          name: "Legacy",
          pitch: "",
          playerCount: 2,
          durationMinutes: 30,
          rules: [],
          components: [],
          phases: [],
          scenarios: [],
          presentation: { theme: "legacy" },
          runtimeSupport: { status: "draft", unsupported: [] },
        },
        sourceIds: [],
        warnings: [],
        unsupportedBehavior: ["rule-execution"],
        createdAt: new Date().toISOString(),
      });
    });
    const build = await SELF.fetch(
      "https://godesk.test/api/builds/build_legacy",
      { headers: { "x-godesk-dev-creator": creatorId } },
    ).then((response) =>
      response.json<{
        definition: {
          setup: string[];
          actions: unknown[];
          board: { layout: string; zones: unknown[] };
        };
      }>(),
    );
    expect(build.definition).toMatchObject({
      setup: [],
      actions: [],
      board: { layout: "", zones: [] },
    });
  });

  it("publishes exact headless MCP tool schemas", async () => {
    const response = await SELF.fetch("https://godesk.test/mcp", {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      }),
    });

    expect(response.status).toBe(200);
    const payload = await mcpPayload<{
      result: {
        tools: Array<{
          name: string;
          inputSchema: object;
          outputSchema: object;
          annotations?: {
            readOnlyHint?: boolean;
            destructiveHint?: boolean;
            idempotentHint?: boolean;
          };
          _meta?: {
            securitySchemes?: Array<{ type: string; scopes: string[] }>;
          };
        }>;
      };
    }>(response);
    expect(payload.result.tools.map((tool) => tool.name)).toEqual([
      "list_projects",
      "create_project",
      "read_project",
      "get_editor_url",
      "apply_game_patch",
      "submit_job",
      "track_job",
      "retry_job",
      "read_build",
      "create_room",
      "read_room",
      "submit_room_intent",
      "read_replay",
      "duplicate_definition",
      "duplicate_project",
      "delete_project",
    ]);
    for (const tool of payload.result.tools) {
      expect(tool.inputSchema).toBeTruthy();
      expect(tool.outputSchema).toBeTruthy();
      expect(tool._meta?.securitySchemes).toEqual([
        {
          type: "oauth2",
          scopes: tool.annotations?.readOnlyHint
            ? ["godesk:read"]
            : ["godesk:read", "godesk:write"],
        },
      ]);
    }
    const jobOutputSchema = payload.result.tools.find(
      (tool) => tool.name === "track_job",
    )?.outputSchema;
    expect(JSON.stringify(jobOutputSchema)).toContain("generationMode");
    expect(JSON.stringify(jobOutputSchema)).toContain("previewUrl");
    expect(JSON.stringify(jobOutputSchema)).toContain("artifactUrl");
    expect(
      payload.result.tools.find((tool) => tool.name === "delete_project")
        ?.annotations,
    ).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
    });
  });

  it("creates and patches the same authoritative project through MCP", async () => {
    const created = await callMcpTool<{
      project: { id: string; version: number; activeDefinitionId: string };
      editorUrl: string;
    }>(10, "create_project", { name: "MCP 创作者项目" });
    expect(new URL(created.editorUrl).pathname).toBe(
      `/editor/${created.project.id}`,
    );

    const changed = await callMcpTool<{
      project: { version: number };
      definition: { pitch: string };
    }>(11, "apply_game_patch", {
      projectId: created.project.id,
      expectedVersion: 1,
      idempotencyKey: "mcp-patch-001",
      operations: [
        {
          op: "update_definition",
          fields: {
            pitch: "由 MCP 写入，Editor 必须读取同一状态。",
            rules: [{
              id: "rule-mcp",
              text: "每回合选择一个行动。",
              sourceId: null,
              provenance: "ai-proposed",
              confidence: 0.7,
            }],
            components: [{
              id: "component-mcp",
              name: "行动标记",
              quantity: 2,
              sourceId: null,
              provenance: "ai-proposed",
              confidence: 0.7,
            }],
            setup: ["每位玩家领取一个行动标记。"],
            actions: [{
              id: "action-mcp",
              label: "行动",
              description: "执行一个规则允许的行动。",
              sourceId: null,
              provenance: "ai-proposed",
              confidence: 0.7,
            }],
            board: {
              layout: "shared",
              zones: [{
                id: "zone-mcp",
                name: "中央区域",
                description: "共享组件放置区。",
              }],
            },
            phases: [{ id: "phase-mcp", name: "行动阶段" }],
            scenarios: [{ id: "scenario-mcp", name: "基础场景" }],
            presentation: { theme: "harbor" },
          },
        },
      ],
    });
    expect(changed).toMatchObject({
      project: { version: 2 },
      definition: { pitch: "由 MCP 写入，Editor 必须读取同一状态。" },
    });
    const definitionsView = await callMcpTool<{
      view: string;
      data: {
        definitions: Array<{ id: string }>;
        page: {
          cursor: number;
          limit: number;
          nextCursor: number | null;
          total: number;
        };
      };
    }>(111, "read_project", {
      projectId: created.project.id,
      view: "definitions",
      cursor: 0,
      limit: 1,
    });
    expect(definitionsView).toMatchObject({
      view: "definitions",
      data: {
        definitions: [{ id: created.project.activeDefinitionId }],
        page: { cursor: 0, limit: 1, nextCursor: null, total: 1 },
      },
    });

    const apiResponse = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}?view=definition`,
    );
    await expect(apiResponse.json()).resolves.toMatchObject({
      pitch: "由 MCP 写入，Editor 必须读取同一状态。",
    });
    const rulesView = await callMcpTool<{
      view: string;
      data: { rules: Array<{ id: string }>; page: { total: number } };
    }>(112, "read_project", {
      projectId: created.project.id,
      view: "rules",
      cursor: 0,
      limit: 10,
    });
    expect(rulesView).toMatchObject({
      view: "rules",
      data: { rules: [{ id: "rule-mcp" }], page: { total: 1 } },
    });
    const boardView = await callMcpTool<{
      view: string;
      data: { layout: string; zones: Array<{ id: string }> };
    }>(113, "read_project", {
      projectId: created.project.id,
      view: "board",
    });
    expect(boardView).toMatchObject({
      view: "board",
      data: { layout: "shared", zones: [{ id: "zone-mcp" }] },
    });
    const entityView = await callMcpTool<{
      view: string;
      data: { id: string; name: string };
    }>(114, "read_project", {
      projectId: created.project.id,
      view: "entity",
      entityType: "component",
      entityId: "component-mcp",
    });
    expect(entityView).toMatchObject({
      view: "entity",
      data: { id: "component-mcp", name: "行动标记" },
    });

    const configured = await callMcpTool<{
      project: { version: number };
    }>(12, "apply_game_patch", {
      projectId: created.project.id,
      expectedVersion: 2,
      idempotencyKey: "mcp-runtime-001",
      operations: [
        {
          op: "configure_score_race",
          config: {
            victoryTarget: 5,
            maxTurns: 12,
            actions: [
              { id: "steady", label: "稳步推进", points: 1 },
              { id: "bold", label: "大胆推进", points: 2 },
            ],
          },
        },
      ],
    });
    expect(configured.project.version).toBe(3);
    const compileJob = await callMcpTool<{
      id: string;
      status: string;
    }>(13, "submit_job", {
      kind: "compile-build",
      projectId: created.project.id,
      expectedVersion: 3,
      idempotencyKey: "mcp-compile-001",
    });
    expect(compileJob.status).toBe("queued");
    await waitForJob(compileJob.id);
    const trackedJob = await callMcpTool<{
      id: string;
      status: string;
      result: { build: { id: string } };
    }>(14, "track_job", { jobId: compileJob.id });
    expect(trackedJob).toMatchObject({
      id: compileJob.id,
      status: "succeeded",
    });
    const playtestJob = await callMcpTool<{
      id: string;
      status: string;
    }>(15, "submit_job", {
      kind: "bot-playtest",
      projectId: created.project.id,
      buildId: trackedJob.result.build.id,
      seed: 42,
      idempotencyKey: "mcp-playtest-001",
    });
    const finishedPlaytestJob = await waitForJob(
      playtestJob.id,
    ) as unknown as {
      result: { evidenceType: string };
    };
    expect(finishedPlaytestJob.result.evidenceType).toBe(
      "automated-bot-simulation",
    );
    const room = await callMcpTool<{
      id: string;
      replayId: string;
      state: { turn: number };
    }>(16, "create_room", {
      buildId: trackedJob.result.build.id,
      seed: 42,
      idempotencyKey: "mcp-room-001",
    });
    const actedRoom = await callMcpTool<{
      state: { turn: number; scores: number[] };
    }>(17, "submit_room_intent", {
      roomId: room.id,
      intentId: "mcp-room-action-001",
      seat: 0,
      actionId: "bold",
    });
    expect(actedRoom.state).toMatchObject({ turn: 1, scores: [2, 0] });
    const replay = await callMcpTool<{
      finalState: { turn: number; scores: number[] };
    }>(18, "read_replay", { replayId: room.replayId });
    expect(replay.finalState).toMatchObject({ turn: 1, scores: [2, 0] });

    const duplicated = await callMcpTool<{
      project: { id: string; version: number };
      editorUrl: string;
    }>(19, "duplicate_project", {
      projectId: created.project.id,
      expectedVersion: 4,
      idempotencyKey: "mcp-duplicate-001",
      name: "MCP 安全副本",
    });
    expect(duplicated.project).toMatchObject({ version: 1 });
    expect(duplicated.project.id).not.toBe(created.project.id);

    const deleted = await callMcpTool<{ deletedProjectId: string }>(
      20,
      "delete_project",
      {
        projectId: duplicated.project.id,
        confirmationProjectId: duplicated.project.id,
        expectedVersion: 1,
        idempotencyKey: "mcp-delete-001",
      },
    );
    expect(deleted.deletedProjectId).toBe(duplicated.project.id);
    expect(
      await SELF.fetch(
        `https://godesk.test/api/projects/${duplicated.project.id}`,
      ),
    ).toMatchObject({ status: 404 });
  });
});
