import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { HOBBYIST_STARTERS } from "../src/creator/hobbyist-starters";
import {
  mcpPayload,
  callMcpTool,
  waitForJob,
  claimSeat,
  approveGenerationPlan,
} from "./projects-test-helpers";

describe("Game Project HTTP seam — MCP surface, kernels, hobbyist flows", () => {

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
      "get_studio_url",
      "apply_project_patch",
      "submit_job",
      "track_job",
      "retry_job",
      "read_build",
      "create_shared_session",
      "read_shared_session",
      "submit_session_intent",
      "read_replay",
      "duplicate_rule_system",
      "restore_build_as_rule_system",
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
    expect(JSON.stringify(jobOutputSchema)).not.toContain("previewUrl");
    expect(JSON.stringify(jobOutputSchema)).toContain("artifactUrl");
    const submitJobSchema = payload.result.tools.find(
      (tool) => tool.name === "submit_job",
    )?.inputSchema;
    expect(JSON.stringify(submitJobSchema)).not.toContain("render-preview");
    const mutationOutputSchema = payload.result.tools.find(
      (tool) => tool.name === "apply_project_patch",
    )?.outputSchema;
    expect(JSON.stringify(mutationOutputSchema)).toContain("generationPlan");
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
      project: { id: string; version: number; activeRuleSystemId: string };
      studioUrl: string;
    }>(10, "create_project", { name: "MCP 创作者项目" });
    expect(new URL(created.studioUrl).pathname).toBe(
      `/studio/${created.project.id}`,
    );

    const changed = await callMcpTool<{
      project: { version: number };
      ruleSystem: { pitch: string };
    }>(11, "apply_project_patch", {
      projectId: created.project.id,
      expectedVersion: 1,
      idempotencyKey: "mcp-patch-001",
      operations: [
        {
          op: "update_rule_system",
          fields: {
            pitch: "由 MCP 写入，Web Studio 必须读取同一状态。",
            rules: [{
              id: "rule-mcp",
              text: "每回合选择一个行动。",
              sourceId: null,
              provenance: "ai-proposed",
              confidence: 0.7,
            }],
            constraints: [{
              id: "constraint-mcp",
              text: "同一参与者每回合只能执行一个行动。",
              sourceId: null,
              provenance: "ai-proposed",
              confidence: 0.7,
            }],
            entities: [{
              id: "component-mcp",
              name: "行动标记",
              kind: "token",
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
            playSurface: {
              kind: "table",
              layout: "shared",
              regions: [{
                id: "zone-mcp",
                name: "中央区域",
                description: "共享 Game Entity 放置区。",
              }],
            },
            stages: [{ id: "phase-mcp", name: "行动阶段" }],
            outcomes: [{ id: "scenario-mcp", name: "基础场景" }],
            presentation: {
              theme: "harbor",
              visuals: [{
                provenance: "kit",
                label: "Harbor presentation kit",
              }],
            },
          },
        },
      ],
    });
    expect(changed).toMatchObject({
      project: { version: 2 },
      ruleSystem: { pitch: "由 MCP 写入，Web Studio 必须读取同一状态。" },
    });
    const ruleSystemsView = await callMcpTool<{
      view: string;
      data: {
        ruleSystems: Array<{ id: string }>;
        page: {
          cursor: number;
          limit: number;
          nextCursor: number | null;
          total: number;
        };
      };
    }>(111, "read_project", {
      projectId: created.project.id,
      view: "rule-systems",
      cursor: 0,
      limit: 1,
    });
    expect(ruleSystemsView).toMatchObject({
      view: "rule-systems",
      data: {
        ruleSystems: [{ id: created.project.activeRuleSystemId }],
        page: { cursor: 0, limit: 1, nextCursor: null, total: 1 },
      },
    });

    const apiResponse = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}?view=rule-system`,
    );
    await expect(apiResponse.json()).resolves.toMatchObject({
      pitch: "由 MCP 写入，Web Studio 必须读取同一状态。",
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
    const constraintsView = await callMcpTool<{
      view: string;
      data: { constraints: Array<{ id: string }>; page: { total: number } };
    }>(173, "read_project", {
      projectId: created.project.id,
      view: "constraints",
      cursor: 0,
      limit: 10,
    });
    expect(constraintsView).toMatchObject({
      view: "constraints",
      data: { constraints: [{ id: "constraint-mcp" }], page: { total: 1 } },
    });
    const surfaceView = await callMcpTool<{
      view: string;
      data: { layout: string; regions: Array<{ id: string }> };
    }>(113, "read_project", {
      projectId: created.project.id,
      view: "surface",
    });
    expect(surfaceView).toMatchObject({
      view: "surface",
      data: { layout: "shared", regions: [{ id: "zone-mcp" }] },
    });
    const entityView = await callMcpTool<{
      view: string;
      data: { id: string; name: string };
    }>(114, "read_project", {
      projectId: created.project.id,
      view: "entity",
      entityType: "entity",
      entityId: "component-mcp",
    });
    expect(entityView).toMatchObject({
      view: "entity",
      data: { id: "component-mcp", name: "行动标记" },
    });

    const configured = await callMcpTool<{
      project: { version: number };
    }>(12, "apply_project_patch", {
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
      result: { id: string; evidenceType: string };
    };
    expect(finishedPlaytestJob.result.evidenceType).toBe(
      "automated-bot-simulation",
    );
    const hypothesisChange = await callMcpTool<{
      project: { version: number };
      hypotheses: Array<{ id: string }>;
    }>(151, "apply_project_patch", {
      projectId: created.project.id,
      expectedVersion: 4,
      idempotencyKey: "mcp-hypothesis-001",
      operations: [{
        op: "add_design_hypothesis",
        hypothesis: {
          question: "大胆推进是否会缩短对局？",
          successSignal: "固定种子试玩在六回合内结束。",
        },
      }],
    });
    const hypothesisId = hypothesisChange.hypotheses[0]?.id;
    expect(hypothesisId).toMatch(/^hypothesis_/);
    const findingChange = await callMcpTool<{
      project: { version: number };
      findings: Array<{ id: string; evidence: { type: string } }>;
    }>(152, "apply_project_patch", {
      projectId: created.project.id,
      expectedVersion: hypothesisChange.project.version,
      idempotencyKey: "mcp-finding-001",
      operations: [{
        op: "record_validation_finding",
        finding: {
          hypothesisId,
          buildId: trackedJob.result.build.id,
          evidence: {
            type: "automated-playtest",
            playtestId: finishedPlaytestJob.result.id,
          },
          verdict: "inconclusive",
          notes: "自动化结果只能作为自动化证据。",
          nextChange: "邀请两位真实参与者使用同一 Build，再记录人类证据。",
        },
      }],
    });
    expect(findingChange.findings[0]).toMatchObject({
      evidence: { type: "automated-playtest" },
      nextChange: "邀请两位真实参与者使用同一 Build，再记录人类证据。",
    });
    const validationView = await callMcpTool<{
      view: string;
      data: {
        hypotheses: Array<{ id: string }>;
        findings: Array<{ hypothesisId: string }>;
      };
    }>(153, "read_project", {
      projectId: created.project.id,
      view: "validation",
    });
    expect(validationView).toMatchObject({
      view: "validation",
      data: {
        hypotheses: [{ id: hypothesisId }],
        findings: [{ hypothesisId }],
      },
    });
    await expect(callMcpTool<{ data: { id: string } }>(154, "read_project", {
      projectId: created.project.id,
      view: "entity",
      entityType: "hypothesis",
      entityId: hypothesisId,
    })).resolves.toMatchObject({ data: { id: hypothesisId } });
    const findingId = findingChange.findings[0]?.id;
    await expect(callMcpTool<{ data: { id: string } }>(155, "read_project", {
      projectId: created.project.id,
      view: "entity",
      entityType: "finding",
      entityId: findingId,
    })).resolves.toMatchObject({ data: { id: findingId } });
    const room = await callMcpTool<{
      id: string;
      replayId: string;
      state: { turn: number };
    }>(16, "create_shared_session", {
      buildId: trackedJob.result.build.id,
      seed: 42,
      idempotencyKey: "mcp-room-001",
    });
    const actedRoom = await callMcpTool<{
      state: { turn: number; scores: number[] };
    }>(17, "submit_session_intent", {
      sessionId: room.id,
      intentId: "mcp-room-action-001",
      seat: 0,
      actionId: "bold",
    });
    expect(actedRoom.state).toMatchObject({ turn: 1, scores: [2, 0] });
    const mcpFeedbackSeat = await claimSeat(room.id, 0);
    expect(mcpFeedbackSeat.status).toBe(200);
    await expect(
      SELF.fetch(`https://godesk.test/api/sessions/${room.id}/feedback`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          seat: 0,
          seatToken: mcpFeedbackSeat.seatToken,
          rating: 5,
          comment: "MCP 可以读取同一 Shared Session 的反馈。",
        }),
      }),
    ).resolves.toMatchObject({ status: 200 });
    const reopenedSession = await callMcpTool<{
      id: string;
      sessionUrl: string;
      state: { turn: number };
      feedback: Array<{
        seat: number;
        rating: number;
        comment: string;
        moment: { actionSequence: number; actionId: string };
      }>;
    }>(171, "read_shared_session", { sessionId: room.id });
    expect(reopenedSession).toMatchObject({
      id: room.id,
      state: { turn: 1 },
      feedback: [{
        seat: 0,
        rating: 5,
        comment: "MCP 可以读取同一 Shared Session 的反馈。",
        moment: { actionSequence: 1, actionId: "bold" },
      }],
    });
    expect(new URL(reopenedSession.sessionUrl).pathname).toBe(`/room/${room.id}`);
    const sessionsView = await callMcpTool<{
      view: string;
      data: {
        sessions: Array<{
          id: string;
          sessionUrl: string;
          feedback: Array<{ seat: number; rating: number }>;
        }>;
      };
    }>(172, "read_project", {
      projectId: created.project.id,
      view: "sessions",
    });
    expect(sessionsView.data.sessions[0]).toMatchObject({
      id: room.id,
      feedback: [{ seat: 0, rating: 5 }],
    });
    const replay = await callMcpTool<{
      finalState: { turn: number; scores: number[] };
    }>(18, "read_replay", { replayId: room.replayId });
    expect(replay.finalState).toMatchObject({ turn: 1, scores: [2, 0] });

    const duplicated = await callMcpTool<{
      project: { id: string; version: number };
      studioUrl: string;
    }>(19, "duplicate_project", {
      projectId: created.project.id,
      expectedVersion: 6,
      idempotencyKey: "mcp-duplicate-001",
      name: "MCP 安全副本",
    });
    expect(duplicated.project).toMatchObject({ version: 1 });
    expect(duplicated.project.id).not.toBe(created.project.id);
    const duplicatedValidation = await callMcpTool<{
      data: { hypotheses: unknown[]; findings: unknown[] };
    }>(191, "read_project", {
      projectId: duplicated.project.id,
      view: "validation",
    });
    expect(duplicatedValidation.data.hypotheses).toHaveLength(1);
    expect(duplicatedValidation.data.findings).toEqual([]);

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

    const prematureCompile = await callMcpTool<{ id: string }>(201, "submit_job", {
      kind: "compile-build",
      projectId: created.project.id,
      expectedVersion: 6,
      basedOnFindingId: findingId,
      idempotencyKey: "mcp-premature-finding-compile-001",
    });
    await expect(waitForJob(prematureCompile.id)).resolves.toMatchObject({
      status: "failed",
      error: "finding_revision_missing",
    });

    const iterated = await callMcpTool<{ project: { version: number } }>(202, "apply_project_patch", {
      projectId: created.project.id,
      expectedVersion: 6,
      idempotencyKey: "mcp-finding-revision-001",
      operations: [{
        op: "configure_score_race",
        config: {
          victoryTarget: 5,
          maxTurns: 12,
          actions: [
            { id: "steady", label: "稳步推进", points: 1 },
            { id: "bold", label: "大胆推进", points: 3 },
          ],
        },
      }],
    });
    const lineageCompile = await callMcpTool<{ id: string }>(203, "submit_job", {
      kind: "compile-build",
      projectId: created.project.id,
      expectedVersion: iterated.project.version,
      basedOnFindingId: findingId,
      idempotencyKey: "mcp-finding-lineage-compile-001",
    });
    await expect(waitForJob(lineageCompile.id)).resolves.toMatchObject({
      status: "succeeded",
      result: {
        build: { basedOnFindingId: findingId },
        changeset: { basedOnFindingId: findingId },
      },
    });
  });

  it("passes structured action payloads through MCP Shared Sessions", async () => {
    const created = await callMcpTool<{
      project: { id: string; version: number };
    }>(160, "create_project", { name: "MCP structured intent" });
    const patched = await callMcpTool<{ project: { version: number } }>(
      161,
      "apply_project_patch",
      {
        projectId: created.project.id,
        expectedVersion: created.project.version,
        idempotencyKey: "mcp-structured-kernel-001",
        operations: [
          {
            op: "update_rule_system",
            fields: {
              participants: { min: 2, max: 2, default: 2, roles: [] },
              presentation: {
                theme: "structured-action-fixture",
                visuals: [{
                  provenance: "kit",
                  label: "程序化主题 kit",
                }],
              },
            },
          },
          {
            op: "configure_score_race",
            config: {
              victoryTarget: 5,
              maxTurns: 10,
              actions: [{ id: "advance", label: "Advance", points: 1 }],
              unsupported: [],
            },
          },
        ],
      },
    );
    const compile = await callMcpTool<{ id: string }>(162, "submit_job", {
      kind: "compile-build",
      projectId: created.project.id,
      expectedVersion: patched.project.version,
      idempotencyKey: "mcp-structured-compile-001",
    });
    const completed = await waitForJob(compile.id) as unknown as {
      result: { build: { id: string } };
    };
    const session = await callMcpTool<{ id: string }>(
      163,
      "create_shared_session",
      {
        buildId: completed.result.build.id,
        seed: 7,
        idempotencyKey: "mcp-structured-session-001",
      },
    );
    const acted = await callMcpTool<{
      state: { turn: number };
      acceptedActions: Array<{ payload?: Record<string, unknown> }>;
    }>(
      164,
      "submit_session_intent",
      {
        sessionId: session.id,
        intentId: "mcp-structured-action-001",
        seat: 0,
        actionId: "advance",
        payload: { note: "creator-observation" },
      },
    );
    expect(acted.state.turn).toBe(1);
    expect(acted.acceptedActions[0]?.payload).toEqual({
      note: "creator-observation",
    });
  });

  it("drives harvested and host-generated assets through MCP to a shareable room", async () => {
    const created = await callMcpTool<{
      project: { id: string; version: number };
    }>(30, "create_project", { name: "MCP 资产桌" });
    const generated = await callMcpTool<{ id: string }>(31, "submit_job", {
      kind: "generate-rule-system",
      projectId: created.project.id,
      expectedVersion: created.project.version,
      sourceKind: "rulebook",
      sourceName: "asset-rules.pdf",
      sourceContent: "两名玩家轮流选择航线，执行后获得 2 分。率先获得 8 分者获胜。",
      visualInputs: [{
        name: "规则书第 1 页",
        content: "data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAABwAQCdASoBAAEAAUAmJaQAA3AA/vuUAAA=",
        pageNumber: 1,
        imageUse: "project-asset",
      }],
      idempotencyKey: "mcp-harvest-asset-001",
    });
    const generation = await waitForJob(generated.id) as unknown as {
      result: {
        project: { version: number };
        sources: Array<{ id: string; kind: string }>;
      };
    };
    const extracted = generation.result.sources.find(
      (source) => source.kind === "image",
    );
    expect(extracted?.id).toMatch(/^source_/);

    const bound = await callMcpTool<{
      project: { version: number };
      sources: Array<{
        id: string;
        kind: string;
        provenance: { origin: string; basedOnSourceIds?: string[] };
      }>;
      ruleSystem: { presentation: { visuals: Array<{ provenance: string }> } };
    }>(32, "apply_project_patch", {
      projectId: created.project.id,
      expectedVersion: generation.result.project.version,
      idempotencyKey: "mcp-bind-generated-asset-001",
      operations: [
        {
          op: "add_source",
          source: {
            id: "source_host_visual_brief",
            kind: "brief",
            name: "Route card visual direction",
            content: "A mist-green harbor route card with bold paper-cut silhouettes and no text.",
            provenance: {
              origin: "creator-authored",
              locator: "Creator prompt",
            },
          },
        },
        {
          op: "add_source",
          source: {
            id: "source_host_generated_card",
            kind: "image",
            imageUse: "project-asset",
            name: "Host generated route card",
            content: "data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAABwAQCdASoBAAEAAUAmJaQAA3AA/vuUAAA=",
            provenance: {
              origin: "generative-api",
              locator: "Codex host-user quota",
              basedOnSourceIds: ["source_host_visual_brief"],
            },
          },
        },
        {
          op: "update_rule_system",
          fields: {
            presentation: {
              theme: "rulebook-studio",
              image: {
                sourceId: "source_host_generated_card",
                url: "data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAABwAQCdASoBAAEAAUAmJaQAA3AA/vuUAAA=",
                alt: "Host generated route card",
              },
              visuals: [{
                provenance: "generated",
                label: "Codex host quota generated route card",
              }],
            },
          },
        },
      ],
    });
    expect(bound.sources).toContainEqual(expect.objectContaining({
      kind: "image",
      provenance: expect.objectContaining({
        origin: "generative-api",
        basedOnSourceIds: ["source_host_visual_brief"],
      }),
    }));
    expect(bound.ruleSystem.presentation.visuals).toEqual([
      expect.objectContaining({ provenance: "generated" }),
    ]);
    const planView = await callMcpTool<{
      view: string;
      data: { generationPlan: { id: string; status: string } | null };
    }>(35, "read_project", {
      projectId: created.project.id,
      view: "generation-plan",
    });
    expect(planView.data.generationPlan).toMatchObject({ status: "pending" });
    const approved = await callMcpTool<{
      project: { version: number };
      generationPlan: { status: string };
    }>(36, "apply_project_patch", {
      projectId: created.project.id,
      expectedVersion: bound.project.version,
      idempotencyKey: "mcp-approve-generation-plan-001",
      operations: [{
        op: "approve_generation_plan",
        planId: planView.data.generationPlan?.id,
      }],
    });
    expect(approved.generationPlan.status).toBe("approved");

    const compile = await callMcpTool<{ id: string }>(33, "submit_job", {
      kind: "compile-build",
      projectId: created.project.id,
      expectedVersion: approved.project.version,
      idempotencyKey: "mcp-asset-compile-001",
    });
    const compiled = await waitForJob(compile.id) as unknown as {
      result: {
        build: {
          id: string;
          sourceIds: string[];
          presentationFloor: { status: string };
        };
      };
    };
    expect(compiled.result.build.presentationFloor.status).toBe("passed");
    expect(compiled.result.build.sourceIds).toEqual(expect.arrayContaining([
      "source_host_generated_card",
      "source_host_visual_brief",
    ]));
    const room = await callMcpTool<{ sessionUrl: string }>(34, "create_shared_session", {
      buildId: compiled.result.build.id,
      seed: 42,
      idempotencyKey: "mcp-asset-room-001",
    });
    expect(new URL(room.sessionUrl).pathname).toMatch(/^\/room\/room_/);
  });

  it("materializes an idea-only Rule System through MCP", async () => {
    const created = await callMcpTool<{
      project: { id: string; version: number };
    }>(40, "create_project", { name: "MCP idea-only project" });
    const submitted = await callMcpTool<{ id: string; status: string }>(
      41,
      "submit_job",
      {
        kind: "generate-rule-system",
        projectId: created.project.id,
        expectedVersion: created.project.version,
        idea: "3 players take turns extending a shared idea and adding constraints.",
        participants: { min: 2, max: 6, default: 3, roles: [] },
        idempotencyKey: "mcp-idea-only-001",
      },
    );
    await waitForJob(submitted.id);
    const tracked = await callMcpTool<{
      status: string;
      result: {
        generationMode: string;
        ruleSystem: {
          playSurface: { kind: string };
          participants: { default: number };
        };
      };
    }>(42, "track_job", { jobId: submitted.id });
    expect(tracked).toMatchObject({
      status: "succeeded",
      result: {
        generationMode: "deterministic-rule-system-materialization",
        ruleSystem: {
          playSurface: { kind: "conversation" },
          participants: { default: 3 },
        },
      },
    });
  });

  it("exposes shared-goal-v1 as an explicit MCP Kernel", async () => {
    const created = await callMcpTool<{
      project: { id: string; version: number };
    }>(50, "create_project", { name: "MCP shared goal" });
    const patched = await callMcpTool<{
      project: { version: number };
      ruleSystem: {
        runtimeSupport: {
          status: string;
          unsupported: string[];
          kernel: {
            type: string;
            goalTarget: number;
            actions: Array<{ progress: number }>;
          };
        };
      };
    }>(51, "apply_project_patch", {
      projectId: created.project.id,
      expectedVersion: created.project.version,
      idempotencyKey: "mcp-shared-goal-001",
      operations: [{
        op: "configure_shared_goal",
        config: {
          goalTarget: 5,
          maxTurns: 10,
          actions: [
            { id: "investigate", label: "调查线索", progress: 2 },
            { id: "organize", label: "整理线索", progress: 1 },
          ],
          unsupported: ["source movement is not implemented"],
        },
      }],
    });
    expect(patched).toMatchObject({
      project: { version: 2 },
      ruleSystem: {
        runtimeSupport: {
          status: "executable",
          unsupported: ["source movement is not implemented"],
          kernel: {
            type: "shared-goal-v1",
            goalTarget: 5,
            actions: [{ progress: 2 }, { progress: 1 }],
          },
        },
      },
    });
  });

  it("exposes turn-taking-v1 as an explicit MCP Kernel", async () => {
    const created = await callMcpTool<{
      project: { id: string; version: number };
    }>(52, "create_project", { name: "MCP turn taking" });
    const patched = await callMcpTool<{
      project: { version: number };
      ruleSystem: {
        runtimeSupport: {
          status: string;
          unsupported: string[];
          kernel: {
            type: string;
            maxTurns: number;
            actions: Array<{ id: string; label: string }>;
          };
        };
      };
    }>(53, "apply_project_patch", {
      projectId: created.project.id,
      expectedVersion: created.project.version,
      idempotencyKey: "mcp-turn-taking-001",
      operations: [{
        op: "configure_turn_taking",
        config: {
          maxTurns: 4,
          actions: [
            { id: "extend", label: "扩展创意" },
            { id: "constrain", label: "加入约束" },
          ],
          unsupported: ["winner and score semantics are not specified"],
        },
      }],
    });
    expect(patched).toMatchObject({
      project: { version: 2 },
      ruleSystem: {
        runtimeSupport: {
          status: "executable",
          unsupported: ["winner and score semantics are not specified"],
          kernel: {
            type: "turn-taking-v1",
            maxTurns: 4,
            actions: [
              { id: "extend", label: "扩展创意" },
              { id: "constrain", label: "加入约束" },
            ],
          },
        },
      },
    });
  });

  it("exposes take-away-v1 as an explicit MCP Kernel", async () => {
    const created = await callMcpTool<{
      project: { id: string; version: number };
    }>(54, "create_project", { name: "MCP take away" });
    const patched = await callMcpTool<{
      project: { version: number };
      ruleSystem: {
        runtimeSupport: {
          status: string;
          kernel: {
            type: string;
            initialPool: number;
            actions: Array<{ id: string; label: string; take: number }>;
          };
        };
      };
    }>(55, "apply_project_patch", {
      projectId: created.project.id,
      expectedVersion: created.project.version,
      idempotencyKey: "mcp-take-away-001",
      operations: [{
        op: "configure_take_away",
        config: {
          initialPool: 15,
          actions: [
            { id: "take-1", label: "拿走 1 枚", take: 1 },
            { id: "take-2", label: "拿走 2 枚", take: 2 },
          ],
        },
      }],
    });
    expect(patched).toMatchObject({
      project: { version: 2 },
      ruleSystem: {
        runtimeSupport: {
          status: "executable",
          kernel: {
            type: "take-away-v1",
            initialPool: 15,
            actions: [
              { id: "take-1", take: 1 },
              { id: "take-2", take: 2 },
            ],
          },
        },
      },
    });
  });

  it("exposes roll-and-move-v1 as an explicit MCP Kernel", async () => {
    const created = await callMcpTool<{
      project: { id: string; version: number };
    }>(56, "create_project", { name: "MCP roll and move" });
    const patched = await callMcpTool<{
      project: { version: number };
      ruleSystem: {
        runtimeSupport: {
          status: string;
          kernel: {
            type: string;
            dieSides: number;
            targetPosition: number;
            maxTurns: number;
          };
        };
      };
    }>(57, "apply_project_patch", {
      projectId: created.project.id,
      expectedVersion: created.project.version,
      idempotencyKey: "mcp-roll-and-move-001",
      operations: [{
        op: "configure_roll_and_move",
        config: {
          dieSides: 6,
          targetPosition: 20,
          maxTurns: 80,
          actions: [{ id: "roll-move", label: "掷骰前进" }],
        },
      }],
    });
    expect(patched).toMatchObject({
      project: { version: 2 },
      ruleSystem: {
        runtimeSupport: {
          status: "executable",
          kernel: {
            type: "roll-and-move-v1",
            dieSides: 6,
            targetPosition: 20,
            maxTurns: 80,
            actions: [{ id: "roll-move", label: "掷骰前进" }],
          },
        },
      },
    });
  });

  it("exposes draw-and-score-v1 as an explicit MCP Kernel", async () => {
    const created = await callMcpTool<{ project: { id: string; version: number } }>(58, "create_project", {
      name: "MCP draw and score",
    });
    const patched = await callMcpTool<{
      project: { version: number };
      ruleSystem: { runtimeSupport: { status: string; kernel: Record<string, unknown> } };
    }>(59, "apply_project_patch", {
      projectId: created.project.id,
      expectedVersion: created.project.version,
      idempotencyKey: "mcp-draw-and-score-001",
      operations: [{
        op: "configure_draw_and_score",
        config: {
          cardValues: [1, 2, 3, 4, 5, 6],
          copiesPerValue: 2,
          victoryTarget: 15,
          actions: [{ id: "draw-score", label: "抽牌计分" }],
        },
      }],
    });
    expect(patched).toMatchObject({
      project: { version: 2 },
      ruleSystem: {
        runtimeSupport: {
          status: "executable",
          kernel: {
            type: "draw-and-score-v1",
            cardValues: [1, 2, 3, 4, 5, 6],
            copiesPerValue: 2,
            victoryTarget: 15,
            actions: [{ id: "draw-score", label: "抽牌计分" }],
          },
        },
      },
    });
  });

  it("exposes push-your-luck-v1 as an explicit MCP Kernel", async () => {
    const created = await callMcpTool<{ project: { id: string; version: number } }>(60, "create_project", {
      name: "MCP push your luck",
    });
    const patched = await callMcpTool<{
      project: { version: number };
      ruleSystem: { runtimeSupport: { status: string; kernel: Record<string, unknown> } };
    }>(61, "apply_project_patch", {
      projectId: created.project.id,
      expectedVersion: created.project.version,
      idempotencyKey: "mcp-push-your-luck-001",
      operations: [{
        op: "configure_push_your_luck",
        config: {
          dieSides: 6,
          bustFace: 1,
          victoryTarget: 20,
          maxActions: 200,
          actions: [
            { id: "roll", label: "继续掷骰" },
            { id: "bank", label: "收手存分" },
          ],
        },
      }],
    });
    expect(patched).toMatchObject({
      project: { version: 2 },
      ruleSystem: {
        runtimeSupport: {
          status: "executable",
          kernel: {
            type: "push-your-luck-v1",
            dieSides: 6,
            bustFace: 1,
            victoryTarget: 20,
            maxActions: 200,
          },
        },
      },
    });
  });

  it("does not lose Chinese prompt counts, scored actions, or turn limits", async () => {
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "中文 prompt 生成回归" }),
    }).then((response) => response.json<{
      project: { id: string; version: number };
    }>());
    const submitted = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/jobs`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "generate-rule-system",
          projectId: created.project.id,
          expectedVersion: created.project.version,
          idea: "三位玩家轮流扩展一个共同创意。玩家可以扩展创意获得 1 分，也可以加入约束获得 2 分。率先达到 8 分者获胜，18 回合后最高分获胜。每次行动必须回应已有内容。",
          name: "中文 prompt 生成回归",
          idempotencyKey: "chinese-prompt-generation-001",
        }),
      },
    ).then((response) => response.json<{ id: string }>());

    const finished = await waitForJob(submitted.id);
    expect(finished.status).toBe("succeeded");
    const result = finished.result as {
      ruleSystem: {
        participants: { default: number };
        actions: Array<{ label: string }>;
        runtimeSupport:
          | { status: "draft" }
          | { status: "executable"; kernel: { maxTurns: number; actions: Array<{ points: number }> } };
      };
    };
    expect(result.ruleSystem.participants.default).toBe(3);
    expect(result.ruleSystem.actions.map((action) => action.label)).toEqual([
      "扩展创意",
      "加入约束",
    ]);
    expect(result.ruleSystem.runtimeSupport).toMatchObject({
      status: "draft",
    });
    expect((finished.result as { generationPlan: unknown }).generationPlan).toMatchObject({
      status: "pending",
      proposedRuntime: {
        op: "configure_conversation_relay",
        config: {
          maxTurns: 18,
          actions: [{ points: 1 }, { points: 2 }],
        },
      },
    });
  });

  it("turns each hobbyist starter into a genre-faithful pending plan", async () => {
    const expected = {
      script: { op: "configure_hidden_role" },
      cards: { op: "configure_hand_play" },
      board: { op: "configure_harbor_voyage" },
    } as const;
    for (const starter of HOBBYIST_STARTERS) {
      const created = await SELF.fetch("https://godesk.test/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: starter.label }),
      }).then((response) => response.json<{
        project: { id: string; version: number };
      }>());
      const submitted = await SELF.fetch(
        `https://godesk.test/api/projects/${created.project.id}/jobs`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            kind: "generate-rule-system",
            expectedVersion: created.project.version,
            idea: starter.text,
            name: starter.label,
            idempotencyKey: `hobbyist-starter-${starter.id}`,
          }),
        },
      ).then((response) => response.json<{ id: string }>());
      const finished = await waitForJob(submitted.id);
      expect(finished.status, starter.label).toBe("succeeded");
      const plan = (finished.result as {
        generationPlan: { status: string; proposedRuntime?: { op: string } };
      }).generationPlan;
      expect(plan.status, starter.label).toBe("pending");
      expect(plan.proposedRuntime?.op, starter.label).toBe(expected[starter.id].op);
      const participants = (
        finished.result as {
          ruleSystem: { participants: { min: number; max: number; default: number } };
        }
      ).ruleSystem.participants;
      if (starter.id === "script") {
        expect(participants, starter.label).toMatchObject({ min: 3, max: 3, default: 3 });
      } else if (starter.id === "cards") {
        expect(participants, starter.label).toMatchObject({ min: 4, max: 4, default: 4 });
      } else {
        expect(participants, starter.label).toMatchObject({ min: 2, max: 4, default: 2 });
      }
    }
  });

  it("materializes, compiles, shares, and replays an explicit shared goal", async () => {
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "共享线索生成回归" }),
    }).then((response) => response.json<{
      project: { id: string; version: number };
    }>());
    const submitted = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/jobs`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "generate-rule-system",
          projectId: created.project.id,
          expectedVersion: created.project.version,
          idea: "三位玩家合作收集线索。玩家可以调查线索推进 2 点，也可以整理线索推进 1 点。累计达到 6 点完成目标，最多 12 回合。",
          name: "共享线索生成回归",
          idempotencyKey: "shared-goal-generation-001",
        }),
      },
    ).then((response) => response.json<{ id: string }>());

    const finished = await waitForJob(submitted.id);
    expect(finished.status).toBe("succeeded");
    const generated = finished.result as {
      project: { version: number };
      generationPlan: {
        proposedRuntime?: {
          op: string;
          config: {
            goalTarget?: number;
            maxTurns: number;
            actions: Array<{ progress?: number }>;
          };
        };
      };
      ruleSystem: {
        runtimeSupport: { status: string };
      };
    };
    expect(generated.ruleSystem.runtimeSupport).toMatchObject({
      status: "draft",
    });
    expect(generated.generationPlan.proposedRuntime).toMatchObject({
      op: "configure_shared_goal",
      config: {
        goalTarget: 6,
        maxTurns: 12,
        actions: [{ progress: 2 }, { progress: 1 }],
      },
    });
    const approved = await approveGenerationPlan(
      created.project.id,
      generated.project.version,
      "shared-goal-approve-plan",
    );

    const compiled = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/builds`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: approved.project.version,
          idempotencyKey: "shared-goal-build-001",
        }),
      },
    ).then((response) => response.json<{
      build: { id: string; ruleSystem: { runtimeSupport: { kernel: { type: string } } } };
    }>());
    expect(compiled.build.ruleSystem.runtimeSupport.kernel.type).toBe("shared-goal-v1");

    const playtest = await SELF.fetch(
      `https://godesk.test/api/builds/${compiled.build.id}/playtests`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ seed: 42, idempotencyKey: "shared-goal-playtest-001" }),
      },
    ).then((response) => response.json<{
      terminalStatus: string;
      replayId: string;
      metrics: { sharedGoal?: { progress: number; target: number } };
    }>());
    expect(playtest.terminalStatus).toBe("complete");
    expect(playtest.metrics.sharedGoal?.target).toBe(6);

    const room = await SELF.fetch(
      `https://godesk.test/api/builds/${compiled.build.id}/sessions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ seed: 42, idempotencyKey: "shared-goal-room-001" }),
      },
    ).then((response) => response.json<{
      id: string;
      state: { sharedGoal?: { progress: number; target: number } };
    }>());
    expect(room.state.sharedGoal).toEqual({ progress: 0, target: 6 });

    const intent = await SELF.fetch(
      `https://godesk.test/api/sessions/${room.id}/intents`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          intentId: "shared-goal-intent-001",
          seat: 0,
          actionId: "source-action-1",
        }),
      },
    ).then((response) => response.json<{
      state: { sharedGoal?: { progress: number; target: number } };
    }>());
    expect(intent.state.sharedGoal).toEqual({ progress: 2, target: 6 });

    const replay = await SELF.fetch(
      `https://godesk.test/api/replays/${playtest.replayId}`,
    ).then((response) => response.json<{
      finalState: { sharedGoal?: { progress: number; target: number }; winnerSeat: number | null };
    }>());
    expect(replay.finalState.sharedGoal?.target).toBe(6);
    expect(replay.finalState.winnerSeat).toBeNull();
  });

  it("materializes, compiles, shares, and replays explicit turn taking", async () => {
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "轮流行动生成回归" }),
    }).then((response) => response.json<{
      project: { id: string; version: number };
    }>());
    const submitted = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/jobs`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "generate-rule-system",
          projectId: created.project.id,
          expectedVersion: created.project.version,
          idea: "三位玩家轮流扩展创意或加入约束，最多 4 回合。",
          sourceContent: [
            "三位玩家轮流行动。",
            "扩展创意。",
            "加入约束。",
            "最多 4 回合。",
          ].join("\n"),
          sourceKind: "brief",
          sourceName: "turn-taking.txt",
          name: "轮流行动生成回归",
          idempotencyKey: "turn-taking-generation-001",
        }),
      },
    ).then((response) => response.json<{ id: string }>());

    const finished = await waitForJob(submitted.id);
    expect(finished.status).toBe("succeeded");
    const generated = finished.result as {
      project: { version: number };
      generationPlan: {
        status: string;
        proposedRuntime?: {
          op: string;
          config: {
            maxTurns: number;
            actions: Array<{ id: string; label: string }>;
          };
        };
      };
      ruleSystem: {
        runtimeSupport: { status: string };
      };
    };
    expect(generated.generationPlan.status).toBe("pending");
    expect(generated.ruleSystem.runtimeSupport).toMatchObject({
      status: "draft",
    });
    expect(generated.generationPlan.proposedRuntime).toMatchObject({
      op: "configure_turn_taking",
      config: {
        maxTurns: 4,
        actions: [
          { id: "source-action-1", label: "扩展创意" },
          { id: "source-action-2", label: "加入约束" },
        ],
      },
    });

    const approved = await approveGenerationPlan(
      created.project.id,
      generated.project.version,
      "turn-taking-approve-plan",
    );
    const compiled = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/builds`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: approved.project.version,
          idempotencyKey: "turn-taking-build-001",
        }),
      },
    ).then((response) => response.json<{
      build: { id: string; ruleSystem: { runtimeSupport: { kernel: { type: string } } } };
    }>());
    expect(compiled.build.ruleSystem.runtimeSupport.kernel.type).toBe("turn-taking-v1");

    const playtest = await SELF.fetch(
      `https://godesk.test/api/builds/${compiled.build.id}/playtests`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ seed: 42, idempotencyKey: "turn-taking-playtest-001" }),
      },
    ).then((response) => response.json<{
      terminalStatus: string;
      replayId: string;
      metrics: { winnerSeat: number | null; turnTaking?: { turns: number; maxTurns: number } };
    }>());
    expect(playtest).toMatchObject({
      terminalStatus: "turn-limit",
      metrics: {
        winnerSeat: null,
        turnTaking: { turns: 4, maxTurns: 4 },
      },
    });

    const room = await SELF.fetch(
      `https://godesk.test/api/builds/${compiled.build.id}/sessions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ seed: 42, idempotencyKey: "turn-taking-room-001" }),
      },
    ).then((response) => response.json<{
      id: string;
      state: { turn: number; activeSeat: number; winnerSeat: number | null; turnTaking?: { maxTurns: number } };
    }>());
    expect(room.state).toMatchObject({
      turn: 0,
      activeSeat: 0,
      winnerSeat: null,
      turnTaking: { maxTurns: 4 },
    });

    const intent = await SELF.fetch(
      `https://godesk.test/api/sessions/${room.id}/intents`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          intentId: "turn-taking-intent-001",
          seat: 0,
          actionId: "source-action-1",
        }),
      },
    ).then((response) => response.json<{
      state: { turn: number; activeSeat: number; scores: number[]; winnerSeat: number | null; turnTaking?: { maxTurns: number } };
    }>());
    expect(intent.state).toMatchObject({
      turn: 1,
      activeSeat: 1,
      scores: [0, 0, 0],
      winnerSeat: null,
      turnTaking: { maxTurns: 4 },
    });

    const replay = await SELF.fetch(
      `https://godesk.test/api/replays/${playtest.replayId}`,
    ).then((response) => response.json<{
      finalState: { turn: number; winnerSeat: number | null; turnTaking?: { maxTurns: number } };
    }>());
    expect(replay.finalState).toMatchObject({
      turn: 4,
      winnerSeat: null,
      turnTaking: { maxTurns: 4 },
    });
  });

  it("materializes, compiles, self-plays, shares, and replays a take-away game", async () => {
    const brief = "两名玩家轮流从桌上的15枚石子中拿走石子。每回合可以拿1枚或拿2枚。拿到最后一枚石子的人获胜。";
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "十五枚石子生成回归" }),
    }).then((response) => response.json<{
      project: { id: string; version: number };
    }>());
    const submitted = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/jobs`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "generate-rule-system",
          expectedVersion: created.project.version,
          idea: brief,
          sourceContent: brief,
          sourceKind: "brief",
          sourceName: "take-away.txt",
          name: "十五枚石子生成回归",
          idempotencyKey: "take-away-generation-001",
        }),
      },
    ).then((response) => response.json<{ id: string }>());
    const finished = await waitForJob(submitted.id);
    expect(finished.status).toBe("succeeded");
    const generated = finished.result as {
      project: { version: number };
      generationPlan: {
        proposedRuntime?: {
          op: string;
          config: {
            initialPool: number;
            actions: Array<{ id: string; label: string; take: number }>;
          };
        };
      };
      ruleSystem: { runtimeSupport: { status: string } };
    };
    expect(generated.ruleSystem.runtimeSupport).toMatchObject({
      status: "draft",
    });
    expect(generated.generationPlan.proposedRuntime).toMatchObject({
      op: "configure_take_away",
      config: {
        initialPool: 15,
        actions: [
          { id: "source-action-1", label: "拿走 1 枚", take: 1 },
          { id: "source-action-2", label: "拿走 2 枚", take: 2 },
        ],
      },
    });

    const approved = await approveGenerationPlan(
      created.project.id,
      generated.project.version,
      "take-away-approve-plan",
    );
    const compiled = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/builds`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: approved.project.version,
          idempotencyKey: "take-away-build-001",
        }),
      },
    ).then((response) => response.json<{
      build: { id: string; ruleSystem: { runtimeSupport: { kernel: { type: string } } } };
    }>());
    expect(compiled.build.ruleSystem.runtimeSupport.kernel.type).toBe("take-away-v1");

    const playtest = await SELF.fetch(
      `https://godesk.test/api/builds/${compiled.build.id}/playtests`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ seed: 42, idempotencyKey: "take-away-playtest-001" }),
      },
    ).then((response) => response.json<{
      terminalStatus: string;
      replayId: string;
      metrics: { winnerSeat: number | null; takeAway?: { initialPool: number; remaining: number } };
    }>());
    expect(playtest).toMatchObject({
      terminalStatus: "complete",
      metrics: {
        winnerSeat: expect.any(Number),
        takeAway: { initialPool: 15, remaining: 0 },
      },
    });

    const room = await SELF.fetch(
      `https://godesk.test/api/builds/${compiled.build.id}/sessions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ seed: 42, idempotencyKey: "take-away-room-001" }),
      },
    ).then((response) => response.json<{
      id: string;
      state: { activeSeat: number; takeAway?: { initialPool: number; remaining: number } };
    }>());
    expect(room.state).toMatchObject({
      activeSeat: 0,
      takeAway: { initialPool: 15, remaining: 15 },
    });
    const intent = await SELF.fetch(
      `https://godesk.test/api/sessions/${room.id}/intents`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          intentId: "take-away-intent-001",
          seat: 0,
          actionId: "source-action-2",
        }),
      },
    ).then((response) => response.json<{
      state: { activeSeat: number; winnerSeat: number | null; takeAway?: { initialPool: number; remaining: number } };
    }>());
    expect(intent.state).toMatchObject({
      activeSeat: 1,
      winnerSeat: null,
      takeAway: { initialPool: 15, remaining: 13 },
    });

    const replay = await SELF.fetch(
      `https://godesk.test/api/replays/${playtest.replayId}`,
    ).then((response) => response.json<{
      finalState: { winnerSeat: number | null; takeAway?: { initialPool: number; remaining: number } };
    }>());
    expect(replay.finalState).toMatchObject({
      winnerSeat: expect.any(Number),
      takeAway: { initialPool: 15, remaining: 0 },
    });
  });

  it("materializes, compiles, self-plays, shares, and replays a roll-and-move game", async () => {
    const brief = "两名玩家轮流掷一颗六面骰子，并按点数前进相应格数。率先到达20格的玩家获胜。";
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "二十格竞速生成回归" }),
    }).then((response) => response.json<{
      project: { id: string; version: number };
    }>());
    const submitted = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/jobs`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "generate-rule-system",
          expectedVersion: created.project.version,
          idea: brief,
          sourceContent: brief,
          sourceKind: "brief",
          sourceName: "roll-and-move.txt",
          name: "二十格竞速生成回归",
          idempotencyKey: "roll-and-move-generation-001",
        }),
      },
    ).then((response) => response.json<{ id: string }>());
    const finished = await waitForJob(submitted.id);
    expect(finished.status).toBe("succeeded");
    const generated = finished.result as {
      project: { version: number };
      generationPlan: {
        proposedRuntime?: {
          op: string;
          config: {
            dieSides: number;
            targetPosition: number;
            maxTurns: number;
            actions: Array<{ id: string; label: string }>;
          };
        };
      };
      ruleSystem: { runtimeSupport: { status: string } };
    };
    expect(generated.ruleSystem.runtimeSupport).toMatchObject({
      status: "draft",
    });
    expect(generated.generationPlan.proposedRuntime).toMatchObject({
      op: "configure_roll_and_move",
      config: {
        dieSides: 6,
        targetPosition: 20,
        maxTurns: 80,
        actions: [{ id: "source-action-1", label: "掷骰前进" }],
      },
    });

    const approved = await approveGenerationPlan(
      created.project.id,
      generated.project.version,
      "roll-and-move-approve-plan",
    );
    const compiled = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/builds`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: approved.project.version,
          idempotencyKey: "roll-and-move-build-001",
        }),
      },
    ).then((response) => response.json<{
      build: { id: string; ruleSystem: { runtimeSupport: { kernel: { type: string } } } };
    }>());
    expect(compiled.build.ruleSystem.runtimeSupport.kernel.type).toBe("roll-and-move-v1");

    const playtest = await SELF.fetch(
      `https://godesk.test/api/builds/${compiled.build.id}/playtests`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ seed: 42, idempotencyKey: "roll-and-move-playtest-001" }),
      },
    ).then((response) => response.json<{
      terminalStatus: string;
      replayId: string;
      metrics: { winnerSeat: number | null; rollAndMove?: { positions: number[]; targetPosition: number; lastRoll: number | null } };
    }>());
    expect(playtest.terminalStatus).toBe("complete");
    expect(playtest.metrics.winnerSeat).not.toBeNull();
    expect(playtest.metrics.rollAndMove?.targetPosition).toBe(20);
    expect(Math.max(...(playtest.metrics.rollAndMove?.positions ?? []))).toBe(20);

    const room = await SELF.fetch(
      `https://godesk.test/api/builds/${compiled.build.id}/sessions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ seed: 42, idempotencyKey: "roll-and-move-room-001" }),
      },
    ).then((response) => response.json<{
      id: string;
      state: { activeSeat: number; rollAndMove?: { positions: number[]; targetPosition: number; lastRoll: number | null } };
    }>());
    expect(room.state.rollAndMove).toEqual({
      positions: [0, 0],
      targetPosition: 20,
      lastRoll: null,
    });
    const intent = await SELF.fetch(
      `https://godesk.test/api/sessions/${room.id}/intents`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          intentId: "roll-and-move-intent-001",
          seat: 0,
          actionId: "source-action-1",
        }),
      },
    ).then((response) => response.json<{
      state: { activeSeat: number; rollAndMove?: { positions: number[]; targetPosition: number; lastRoll: number | null } };
    }>());
    expect(intent.state.activeSeat).toBe(1);
    expect(intent.state.rollAndMove?.lastRoll).toBeGreaterThanOrEqual(1);
    expect(intent.state.rollAndMove?.lastRoll).toBeLessThanOrEqual(6);
    expect(intent.state.rollAndMove?.positions[0]).toBe(intent.state.rollAndMove?.lastRoll);

    const replay = await SELF.fetch(
      `https://godesk.test/api/replays/${playtest.replayId}`,
    ).then((response) => response.json<{
      finalState: { winnerSeat: number | null; rollAndMove?: { positions: number[]; targetPosition: number } };
    }>());
    expect(replay.finalState.winnerSeat).not.toBeNull();
    expect(Math.max(...(replay.finalState.rollAndMove?.positions ?? []))).toBe(20);
  });

});
