import {
  env,
  evictDurableObject,
  runDurableObjectAlarm,
  runInDurableObject,
  SELF,
} from "cloudflare:test";
import { describe, expect, it } from "vitest";
import {
  callMcpTool,
  waitForJob,
  approveGenerationPlan,
} from "./projects-test-helpers";

describe("Game Project HTTP seam — jobs, generation, rulebook, floors", () => {

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

    const rejectedPreview = await SELF.fetch(
      `https://godesk.test/api/projects/${project.id}/jobs`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "render-preview",
          buildId: submitted.result.build.id,
          idempotencyKey: "durable-preview-gone-001",
        }),
      },
    );
    expect(rejectedPreview.status).toBe(400);

    const failedJob = await SELF.fetch(
      `https://godesk.test/api/projects/${project.id}/jobs`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "export-build",
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

  it("exposes the bounded Studio iteration job through MCP", async () => {
    const created = await callMcpTool<{
      project: { id: string; version: number };
    }>(904, "create_project", { name: "MCP Studio 迭代测试桌" });
    const configured = await callMcpTool<{
      project: { version: number };
    }>(905, "apply_project_patch", {
      projectId: created.project.id,
      expectedVersion: created.project.version,
      idempotencyKey: "mcp-studio-iteration-configure-1",
      operations: [{
        op: "configure_score_race",
        config: {
          victoryTarget: 4,
          maxTurns: 8,
          actions: [{ id: "step", label: "前进", points: 1 }],
        },
      }],
    });
    const iterationJob = await callMcpTool<{ id: string }>(906, "submit_job", {
      kind: "iterate-rule-system",
      projectId: created.project.id,
      expectedVersion: configured.project.version,
      prompt: "把行动 1 的说明改成“先说明行动，再说明获得 1 分”。",
      idempotencyKey: "mcp-studio-iteration-1",
    });
    await expect(waitForJob(iterationJob.id)).resolves.toMatchObject({
      status: "succeeded",
      result: {
        iteration: {
          actionId: "step",
          summary: "将行动「前进」的说明改为「先说明行动，再说明获得 1 分」。",
        },
        ruleSystem: {
          runtimeSupport: { status: "executable" },
          actions: [expect.objectContaining({
            id: "step",
            description: "先说明行动，再说明获得 1 分",
          })],
        },
      },
    });
  });

  it("materializes a brief through a durable generation job", async () => {
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Generation Job 测试桌" }),
    }).then((response) => response.json<{
      project: { id: string; version: number; activeRuleSystemId: string };
    }>());
    const queued = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/jobs`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "generate-rule-system",
          expectedVersion: 1,
          idea: "三名玩家合作修复灯塔，45 分钟内完成。",
          sourceContent: "设置灯塔板。三名玩家可以选择修复透镜或移动燃料标记。",
          sourceKind: "rulebook",
          sourceName: "lighthouse-rules.txt",
          name: "灯塔协作",
          participants: { min: 3, max: 3, default: 3, roles: [] },
          durationMinutes: 45,
          idempotencyKey: "generate-rule-system-001",
        }),
      },
    ).then((response) => response.json<{ id: string; status: string }>());
    expect(queued.status).toBe("queued");
    await expect(waitForJob(queued.id)).resolves.toMatchObject({
      id: queued.id,
      status: "succeeded",
      result: {
        generationMode: "deterministic-rule-system-materialization",
        project: { version: 2 },
        ruleSystem: {
          name: "灯塔协作",
          pitch: "三名玩家合作修复灯塔，45 分钟内完成。",
          participants: { min: 3, max: 3, default: 3 },
          runtimeSupport: {
            status: "draft",
            unsupported: expect.arrayContaining([
              expect.stringContaining("需要再确认一次玩法"),
            ]),
          },
        },
        studioUrl: expect.stringContaining(
          `/studio/${created.project.id}`,
        ),
      },
    });
    const pendingPlan = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}?view=generation-plan`,
    ).then((response) => response.json<{
      generationPlan: { status: string; ruleSystemVersion: number } | null;
    }>());
    expect(pendingPlan.generationPlan).toMatchObject({
      status: "pending",
      ruleSystemVersion: 2,
    });
    const secondGenerate = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/jobs`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "generate-rule-system",
          expectedVersion: 2,
          idea: "第二次生成必须在未确认的 Generation Plan 上失败。",
          idempotencyKey: "generate-rule-system-pending-blocked",
        }),
      },
    ).then((response) => response.json<{ id: string }>());
    await expect(waitForJob(secondGenerate.id)).resolves.toMatchObject({
      status: "failed",
      error: "generation_plan_pending",
    });
    const blockedBuild = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/builds`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: 2,
          idempotencyKey: "generation-plan-build-blocked",
        }),
      },
    );
    expect(blockedBuild.status).toBe(409);
    await expect(blockedBuild.json()).resolves.toMatchObject({
      error: "generation_plan_pending",
    });

    const duplicateBlocked = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/rule-systems/${created.project.activeRuleSystemId}/duplicate`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: 2,
          idempotencyKey: "generation-plan-duplicate-blocked",
          name: "灯塔协作变体",
        }),
      },
    );
    expect(duplicateBlocked.status).toBe(409);
    await expect(duplicateBlocked.json()).resolves.toMatchObject({
      error: "generation_plan_pending",
    });

    const corrected = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/changes`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: 2,
          idempotencyKey: "generation-plan-correction",
          operations: [{
            op: "update_rule_system",
            fields: { pitch: "三名玩家合作修复灯塔，并先确认这次生成解释。" },
          }],
        }),
      },
    ).then((response) => response.json<{
      project: { version: number };
      ruleSystem: { version: number };
      generationPlan: {
        status: string;
        ruleSystemVersion: number;
        summary: string;
      } | null;
    }>());
    expect(corrected).toMatchObject({
      project: { version: 3 },
      ruleSystem: { version: 3 },
      generationPlan: {
        status: "pending",
        ruleSystemVersion: 3,
        summary: "三名玩家合作修复灯塔，并先确认这次生成解释。",
      },
    });
    const approved = await approveGenerationPlan(
      created.project.id,
      corrected.project.version,
      "generation-plan-approve-after-correction",
    );
    expect(approved.generationPlan).toMatchObject({
      status: "approved",
      ruleSystemVersion: 3,
    });
  });

  it("materializes an idea-only Rule System through a durable job", async () => {
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Idea-only project" }),
    }).then((response) => response.json<{
      project: { id: string; version: number };
    }>());

    const queued = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/jobs`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "generate-rule-system",
          expectedVersion: 1,
          idea: "3 players take turns extending an idea or adding a constraint.",
          name: "灵感接力",
          participants: { min: 2, max: 6, default: 3, roles: [] },
          idempotencyKey: "generate-idea-only-001",
        }),
      },
    ).then((response) => response.json<{ id: string; status: string }>());

    expect(queued.status).toBe("queued");
    await expect(waitForJob(queued.id)).resolves.toMatchObject({
      status: "succeeded",
      result: {
        generationMode: "deterministic-rule-system-materialization",
        ruleSystem: {
          participants: { min: 2, max: 6, default: 3 },
          playSurface: { kind: "conversation", regions: [] },
          runtimeSupport: { status: "draft" },
        },
        generationPlan: {
          status: "pending",
          proposedRuntime: {
            op: "configure_conversation_relay",
            config: {
              maxTurns: 18,
              actions: expect.arrayContaining([
                expect.objectContaining({ label: expect.any(String) }),
              ]),
            },
          },
        },
      },
    });
    const finished = await waitForJob(queued.id);
    const proposed = (finished.result as {
      generationPlan: { proposedRuntime: { config: { actions: Array<{ id: string; label: string; points?: number }> } } };
    }).generationPlan.proposedRuntime;
    expect(proposed.config.actions.every((action) => action.points === undefined)).toBe(true);
    expect("victoryTarget" in proposed.config).toBe(false);
  });

  it("preserves a natural-language player range in the generated project", async () => {
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Player range project" }),
    }).then((response) => response.json<{
      project: { id: string; version: number };
    }>());

    const queued = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/jobs`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "generate-rule-system",
          expectedVersion: created.project.version,
          idea: "A 2 to 4 player conversation game where players build one shared story.",
          name: "Shared story range",
          idempotencyKey: "generate-player-range-001",
        }),
      },
    ).then((response) => response.json<{ id: string; status: string }>());

    expect(queued.status).toBe("queued");
    await expect(waitForJob(queued.id)).resolves.toMatchObject({
      status: "succeeded",
      result: {
        ruleSystem: {
          participants: { min: 2, max: 4, default: 2 },
          playSurface: { kind: "conversation" },
        },
      },
    });
  });

  it("configures every explicit English scored action in the generated Kernel", async () => {
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "English score project" }),
    }).then((response) => response.json<{
      project: { id: string; version: number };
    }>());
    const brief = "Three players can investigate clues for 2 points or organize clues for 1 point. Be the first to reach 6 points in 12 turns.";
    const queued = await SELF.fetch(
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
          sourceName: "english-score-brief.txt",
          idempotencyKey: "generate-english-score-001",
        }),
      },
    ).then((response) => response.json<{ id: string; status: string }>());

    expect(queued.status).toBe("queued");
    await expect(waitForJob(queued.id)).resolves.toMatchObject({
      status: "succeeded",
      result: {
        ruleSystem: {
          runtimeSupport: { status: "draft" },
        },
        generationPlan: {
          status: "pending",
          proposedRuntime: {
            op: "configure_score_race",
            config: {
              victoryTarget: 6,
              maxTurns: 12,
              actions: [
                { label: "investigate clues", points: 2 },
                { label: "organize clues", points: 1 },
              ],
            },
          },
        },
      },
    });
  });

  it("proposes worker-placement for generic placement and never emits harbor cargo IDs", async () => {
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Placement generic generation" }),
    }).then((response) => response.json<{
      project: { id: string; version: number };
    }>());
    const brief = [
      "3 players take turns on a shared worker placement board.",
      "On your turn place one worker onto a resource region;",
      "occupied spaces cannot be reused.",
      "First to finish 2 buildings wins.",
    ].join(" ");
    const queued = await SELF.fetch(
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
          sourceName: "placement-brief.txt",
          name: "Placement generic generation",
          idempotencyKey: "generate-placement-generic-001",
        }),
      },
    ).then((response) => response.json<{ id: string; status: string }>());
    expect(queued.status).toBe("queued");
    const finished = await waitForJob(queued.id);
    expect(finished.status).toBe("succeeded");
    const generated = finished.result as {
      project: { version: number };
      ruleSystem: {
        playSurface: { kind: string; layout?: string; regions?: Array<{ id: string; name: string }> };
        runtimeSupport: { status: string };
        participants: { default: number };
        entities: Array<{ id: string; name: string }>;
      };
      generationPlan: {
        status: string;
        proposedRuntime?: {
          op: string;
          config: {
            playerCount: number;
            regions: Array<{ id: string; name: string }>;
            unsupported?: string[];
          };
        };
      };
    };
    expect(generated.ruleSystem.runtimeSupport).toMatchObject({ status: "draft" });
    expect(generated.ruleSystem.playSurface).toMatchObject({
      kind: "table",
      layout: "worker-placement",
    });
    expect(generated.ruleSystem.playSurface.regions?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(generated.ruleSystem.entities.length).toBeGreaterThan(0);
    expect(generated.ruleSystem.entities.some((entity) => /worker|工人/i.test(entity.name))).toBe(true);
    const proposed = generated.generationPlan.proposedRuntime as {
      op: string;
      config: {
        playerCount: number;
        regions: Array<Record<string, unknown>>;
        victoryBuildings?: number | null;
        unsupported?: string[];
      };
    };
    expect(proposed?.op).toBe("configure_worker_placement");
    expect(proposed?.config.playerCount).toBe(3);
    expect(proposed?.config.regions?.length).toBeGreaterThanOrEqual(2);
    const regionBlob = JSON.stringify(proposed?.config.regions ?? []);
    expect(regionBlob).not.toMatch(/amber|cobalt|cedar|port-a|琥珀货|东栈桥/);
    // Building-victory placement brief ships the honest economy subset.
    expect(proposed?.config.victoryBuildings).toBe(2);
    expect(proposed?.config.regions.some((region) => (region.yieldWood as number) > 0)).toBe(true);
    expect(
      proposed?.config.regions.some((region) => (region.convertWoodToBuilding as number) > 0),
    ).toBe(true);
    expect(proposed?.config.unsupported).toEqual(
      expect.arrayContaining([
        expect.stringContaining("worker-placement-v1"),
        expect.stringContaining("harbor cargo"),
        expect.stringContaining("economy subset"),
      ]),
    );
    const approved = await approveGenerationPlan(
      created.project.id,
      generated.project.version,
      "placement-generic-approve-plan",
    );
    expect(approved.project.version).toBeGreaterThan(generated.project.version);
    const ruleSystem = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}?view=rule-system`,
    ).then((response) => response.json<{
      runtimeSupport:
        | { status: "draft" }
        | {
            status: "executable";
            kernel: {
              type: string;
              playerCount: number;
              regions: Array<{ id: string; name: string }>;
            };
          };
    }>());
    expect(ruleSystem.runtimeSupport).toMatchObject({
      status: "executable",
      kernel: { type: "worker-placement-v1", playerCount: 3 },
    });
    if (ruleSystem.runtimeSupport.status === "executable") {
      const ids = ruleSystem.runtimeSupport.kernel.regions.map((region) => region.id);
      expect(ids).not.toContain("amber");
      expect(ids).not.toContain("port-a");
    }
  });


  it("parameterizes hand-play deck from corpus (not hardcoded 1–5×4 / 12)", async () => {
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Hand-play parameterized generation" }),
    }).then((response) => response.json<{
      project: { id: string; version: number };
    }>());
    const brief =
      "四个人轮流打牌。牌库里点数 1–10 各 2 张。开局各抽 5 张手牌。轮到你时从手牌打出一张到出牌区，该牌点数加入你的分数，然后从牌库补一张。手牌始终对其他玩家隐藏。先到 20 分的人获胜。";
    const queued = await SELF.fetch(
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
          sourceName: "hand-play-param.txt",
          name: "Hand-play parameterized generation",
          idempotencyKey: "generate-hand-play-param-001",
        }),
      },
    ).then((response) => response.json<{ id: string; status: string }>());
    expect(queued.status).toBe("queued");
    const finished = await waitForJob(queued.id);
    expect(finished.status).toBe("succeeded");
    const proposed = (finished.result as {
      generationPlan: {
        proposedRuntime?: {
          op: string;
          config: {
            cardValues: number[];
            copiesPerValue: number;
            handSize: number;
            victoryTarget: number;
            unsupported?: string[];
          };
        };
      };
    }).generationPlan.proposedRuntime;
    expect(proposed?.op).toBe("configure_hand_play");
    expect(proposed?.config.cardValues).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(proposed?.config.copiesPerValue).toBe(2);
    expect(proposed?.config.handSize).toBe(5);
    expect(proposed?.config.victoryTarget).toBe(20);
    expect(proposed?.config.unsupported).toEqual(
      expect.arrayContaining([
        expect.stringContaining("source-derived"),
        expect.stringContaining("trick-taking"),
      ]),
    );
  });

  it("refuses configure_hand_play for trick-taking / shedding briefs", async () => {
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Trick-taking refuse generation" }),
    }).then((response) => response.json<{
      project: { id: string; version: number };
    }>());
    const brief =
      "四人各有手牌。轮流出牌必须跟牌，同花色最大者吃墩。最终赢得最多墩的人获胜。";
    const queued = await SELF.fetch(
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
          sourceName: "trick-taking.txt",
          name: "Trick-taking refuse generation",
          idempotencyKey: "generate-hand-play-refuse-trick-001",
        }),
      },
    ).then((response) => response.json<{ id: string; status: string }>());
    expect(queued.status).toBe("queued");
    const finished = await waitForJob(queued.id);
    expect(finished.status).toBe("succeeded");
    const result = finished.result as {
      ruleSystem: { runtimeSupport: { status: string } };
      generationPlan: {
        proposedRuntime?: { op: string };
        unsupported: string[];
      };
      warnings?: string[];
    };
    expect(result.generationPlan.proposedRuntime).toBeUndefined();
    expect(result.ruleSystem.runtimeSupport.status).toBe("draft");
    expect(result.warnings?.join(" ") ?? "").toMatch(/非计分|出牌计分/);
  });


  it("parameterizes hidden-role roles from corpus (not always 凶手/侦探/平民)", async () => {
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Hidden-role parameterized generation" }),
    }).then((response) => response.json<{
      project: { id: string; version: number };
    }>());
    const brief =
      "三位玩家找出凶手。身份牌：毒蛇（凶手阵营）、医师（好人）、守卫（好人）。先轮流公开发言，再互相指控。被指控最多的人被揭晓。";
    const queued = await SELF.fetch(
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
          sourceName: "hidden-role-param.txt",
          name: "Hidden-role parameterized generation",
          idempotencyKey: "generate-hidden-role-param-001",
        }),
      },
    ).then((response) => response.json<{ id: string; status: string }>());
    expect(queued.status).toBe("queued");
    const finished = await waitForJob(queued.id);
    expect(finished.status).toBe("succeeded");
    const proposed = (finished.result as {
      generationPlan: {
        proposedRuntime?: {
          op: string;
          config: {
            roles: Array<{ id: string; name: string; alignment: string }>;
            unsupported?: string[];
          };
        };
      };
    }).generationPlan.proposedRuntime;
    expect(proposed?.op).toBe("configure_hidden_role");
    expect(proposed?.config.roles.map((role) => role.name)).toEqual([
      "毒蛇",
      "医师",
      "守卫",
    ]);
    expect(proposed?.config.roles.filter((role) => role.alignment === "culprit")).toHaveLength(1);
    expect(proposed?.config.roles.find((role) => role.name === "毒蛇")?.alignment).toBe("culprit");
    expect(proposed?.config.unsupported).toEqual(
      expect.arrayContaining([
        expect.stringContaining("source-derived"),
        expect.stringContaining("multi-act"),
      ]),
    );
  });

  it("refuses configure_hidden_role for multi-act / clue-board briefs", async () => {
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Multi-act hidden-role refuse generation" }),
    }).then((response) => response.json<{
      project: { id: string; version: number };
    }>());
    const brief =
      "三幕剧本杀。第一幕搜证，第二幕讨论，第三幕投票。桌上有线索板。每人有隐藏身份，发言后互相指控。";
    const queued = await SELF.fetch(
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
          sourceName: "multi-act-script.txt",
          name: "Multi-act hidden-role refuse generation",
          idempotencyKey: "generate-hidden-role-refuse-multiact-001",
        }),
      },
    ).then((response) => response.json<{ id: string; status: string }>());
    expect(queued.status).toBe("queued");
    const finished = await waitForJob(queued.id);
    expect(finished.status).toBe("succeeded");
    const result = finished.result as {
      ruleSystem: { runtimeSupport: { status: string } };
      generationPlan: {
        proposedRuntime?: { op: string };
        unsupported: string[];
      };
      warnings?: string[];
    };
    expect(result.generationPlan.proposedRuntime).toBeUndefined();
    expect(result.ruleSystem.runtimeSupport.status).toBe("draft");
    expect(result.warnings?.join(" ") ?? "").toMatch(/多幕|线索板|单轮/);
  });


  it("W4-05: near-miss 出牌计分 configures hand-play, not score-race", async () => {
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "出牌计分 near-miss" }),
    }).then((response) => response.json<{
      project: { id: string; version: number };
    }>());
    const brief =
      "四人轮流出牌计分。每次出牌得该牌点数，先到 15 分的人获胜。";
    const queued = await SELF.fetch(
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
          sourceName: "play-cards-score-near-miss.txt",
          name: "出牌计分 near-miss",
          idempotencyKey: "generate-w405-card-near-miss-001",
        }),
      },
    ).then((response) => response.json<{ id: string; status: string }>());
    expect(queued.status).toBe("queued");
    const finished = await waitForJob(queued.id);
    expect(finished.status).toBe("succeeded");
    const result = finished.result as {
      generationPlan: { proposedRuntime?: { op: string } };
    };
    expect(result.generationPlan.proposedRuntime?.op).not.toBe("configure_score_race");
    expect(result.generationPlan.proposedRuntime?.op).toBe("configure_hand_play");
  });

  it("W4-05: finite shuffled 抽牌计分 configures draw-and-score, not hand-play", async () => {
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "抽牌计分" }),
    }).then((response) => response.json<{
      project: { id: string; version: number };
    }>());
    const brief =
      "两名玩家轮流从洗牌后的牌库顶抽一张牌。牌库里有点数1到6的牌，每个点数各2张。玩家把抽到的点数加入自己的总分。率先达到15分者获胜；牌库用完仍无人达到时，总分最高者获胜。";
    const queued = await SELF.fetch(
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
          sourceName: "draw-and-score.txt",
          name: "抽牌竞分",
          idempotencyKey: "generate-w405-draw-and-score-001",
        }),
      },
    ).then((response) => response.json<{ id: string; status: string }>());
    expect(queued.status).toBe("queued");
    const finished = await waitForJob(queued.id);
    expect(finished.status).toBe("succeeded");
    const result = finished.result as {
      ruleSystem: { actions: Array<{ id: string; label: string }> };
      generationPlan: { proposedRuntime?: { op: string } };
    };
    expect(result.ruleSystem.actions).toEqual([
      expect.objectContaining({ id: "source-action-1", label: "抽牌计分" }),
    ]);
    expect(result.generationPlan.proposedRuntime?.op).toBe("configure_draw_and_score");
    expect(result.generationPlan.proposedRuntime?.op).not.toBe("configure_hand_play");
  });


  it("W4-05: weak placement cues refuse silent score-race configure", async () => {
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "资源区弱体裁" }),
    }).then((response) => response.json<{
      project: { id: string; version: number };
    }>());
    const brief =
      "三人可以在资源区行动得 2 分，或整理物资得 1 分。先到 8 分的人获胜，共 12 回合。";
    const queued = await SELF.fetch(
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
          sourceName: "weak-placement-score.txt",
          name: "资源区弱体裁",
          idempotencyKey: "generate-w405-weak-placement-001",
        }),
      },
    ).then((response) => response.json<{ id: string; status: string }>());
    expect(queued.status).toBe("queued");
    const finished = await waitForJob(queued.id);
    expect(finished.status).toBe("succeeded");
    const result = finished.result as {
      ruleSystem: { runtimeSupport: { status: string } };
      generationPlan: { proposedRuntime?: { op: string } };
      warnings?: string[];
    };
    expect(result.generationPlan.proposedRuntime).toBeUndefined();
    expect(result.ruleSystem.runtimeSupport.status).toBe("draft");
    expect(result.warnings?.join(" ") ?? "").toMatch(/弱体裁|score-race/);
  });


  it("still proposes harbor-voyage for harbor-like placement corpus", async () => {
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Placement harbor generation" }),
    }).then((response) => response.json<{
      project: { id: string; version: number };
    }>());
    const brief = [
      "3 players race on a harbor voyage board with 琥珀货, 钴蓝绸, and 雪松木.",
      "Place workers on 东栈桥 and cargo berths; sail and settle the voyage.",
    ].join(" ");
    const queued = await SELF.fetch(
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
          sourceName: "harbor-brief.txt",
          name: "Placement harbor generation",
          idempotencyKey: "generate-placement-harbor-001",
        }),
      },
    ).then((response) => response.json<{ id: string; status: string }>());
    expect(queued.status).toBe("queued");
    const finished = await waitForJob(queued.id);
    expect(finished.status).toBe("succeeded");
    const generated = finished.result as {
      project: { version: number };
      generationPlan: {
        proposedRuntime?: { op: string; config: { playerCount: number } };
      };
    };
    expect(generated.generationPlan.proposedRuntime).toMatchObject({
      op: "configure_harbor_voyage",
      config: { playerCount: 3 },
    });
    const approved = await approveGenerationPlan(
      created.project.id,
      generated.project.version,
      "placement-harbor-approve-plan",
    );
    expect(approved.project.version).toBeGreaterThan(generated.project.version);
    const ruleSystem = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}?view=rule-system`,
    ).then((response) => response.json<{
      runtimeSupport:
        | { status: "draft" }
        | { status: "executable"; kernel: { type: string; playerCount: number } };
    }>());
    expect(ruleSystem.runtimeSupport).toMatchObject({
      status: "executable",
      kernel: { type: "harbor-voyage-v1", playerCount: 3 },
    });
  });

  it("keeps an over-limit action set in draft instead of dropping source actions", async () => {
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Over-limit score project" }),
    }).then((response) => response.json<{
      project: { id: string; version: number };
    }>());
    const actions = Array.from({ length: 13 }, (_, index) =>
      `action ${index + 1} for 1 point`,
    ).join(" or ");
    const brief = `Three players can ${actions}. Be the first to reach 12 points in 12 turns.`;
    const queued = await SELF.fetch(
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
          sourceName: "over-limit-score-brief.txt",
          idempotencyKey: "generate-over-limit-score-001",
        }),
      },
    ).then((response) => response.json<{ id: string; status: string }>());

    expect(queued.status).toBe("queued");
    const completed = await waitForJob(queued.id);
    expect(completed.status).toBe("succeeded");
    expect(completed.result?.ruleSystem).toMatchObject({
      actions: expect.arrayContaining([
        expect.objectContaining({
          label: "action 13",
          description: "action 13 for 1 point",
        }),
      ]),
      runtimeSupport: { status: "draft" },
    });
    expect(completed.result?.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("超过 Kernel 上限")]),
    );
  });

  it("turns a rulebook without experience text into a build and authoritative room", async () => {
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "规则书直达房间" }),
    }).then((response) => response.json<{
      project: { id: string; version: number };
    }>());
    const generation = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/jobs`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "generate-rule-system",
          expectedVersion: created.project.version,
          sourceContent: "两名玩家轮流选择航线，执行后获得 2 分。率先获得 8 分者获胜。",
          sourceKind: "rulebook",
          sourceName: "harbor-rules.md",
          name: "规则书直达房间",
          idempotencyKey: "rulebook-only-generate",
        }),
      },
    ).then((response) => response.json<{ id: string }>());
    const generated = await waitForJob(generation.id);
    expect(generated.status).toBe("succeeded");
    const generatedResult = generated.result as {
      ruleSystem: { name: string; runtimeSupport: { status: string } };
      generationPlan: { status: string; proposedRuntime?: { op: string } };
      sources: Array<{
        kind: string;
        name: string;
        provenance: { origin: string };
      }>;
    };
    expect(generatedResult.ruleSystem.name).toBe("规则书直达房间");
    expect(generatedResult.ruleSystem.runtimeSupport.status).toBe("draft");
    expect(generatedResult.generationPlan).toMatchObject({
      status: "pending",
      proposedRuntime: { op: expect.stringMatching(/^configure_/) },
    });
    expect(generatedResult.sources).toContainEqual(expect.objectContaining({
      kind: "rulebook",
      name: "harbor-rules.md",
      provenance: expect.objectContaining({ origin: "creator-upload" }),
    }));
    const approved = await approveGenerationPlan(
      created.project.id,
      2,
      "rulebook-only-approve-plan",
    );

    const compiled = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/jobs`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "compile-build",
          expectedVersion: approved.project.version,
          idempotencyKey: "rulebook-only-compile",
        }),
      },
    ).then((response) => response.json<{ id: string }>());
    const buildJob = await waitForJob(compiled.id) as unknown as {
      result: { build: { id: string; unsupportedBehavior: string[] } };
    };
    expect(buildJob.result.build.unsupportedBehavior).not.toHaveLength(0);

    const roomResponse = await SELF.fetch(
      `https://godesk.test/api/builds/${buildJob.result.build.id}/sessions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          seed: 42,
          idempotencyKey: "rulebook-only-room",
        }),
      },
    );
    expect(roomResponse.status).toBe(201);
    const room = await roomResponse.json<{ sessionUrl: string }>();
    expect(new URL(room.sessionUrl).pathname).toMatch(/^\/room\/room_/);
  });

  it("harvests rulebook art into Source Library and binds it into the playable Rule System", async () => {
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "灯塔航线" }),
    }).then((response) => response.json<{
      project: { id: string; version: number };
    }>());
    const queued = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/jobs`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "generate-rule-system",
          expectedVersion: created.project.version,
          idea: "两名领航员穿越灯塔航线。",
          sourceContent: [
            "SETUP Place the lighthouse board in the center and shuffle 12 tide cards.",
            "VOYAGE PHASE Players choose a route card.",
          ].join("\n"),
          sourceKind: "rulebook",
          sourceName: "lighthouse-rules.pdf",
          name: "灯塔航线",
          visualInputs: [{
            name: "灯塔航线 · 第 2 页",
            content: "data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAABwAQCdASoBAAEAAUAmJaQAA3AA/vuUAAA=",
            pageNumber: 2,
            imageUse: "project-asset",
          }],
          idempotencyKey: "harvest-rulebook-art-001",
        }),
      },
    ).then((response) => response.json<{ id: string }>());

    await expect(waitForJob(queued.id)).resolves.toMatchObject({
      status: "succeeded",
      result: {
        ruleSystem: {
          presentation: {
            image: expect.objectContaining({
              sourceId: expect.stringMatching(/^source_/),
              url: expect.stringMatching(/^data:image\/webp;base64,/),
            }),
            visuals: [{
              provenance: "extracted",
              label: "规则书提取图像",
            }],
          },
          entities: expect.arrayContaining([
            expect.objectContaining({ image: expect.any(Object) }),
          ]),
          playSurface: {
            regions: expect.arrayContaining([
              expect.objectContaining({ image: expect.any(Object) }),
            ]),
          },
        },
      },
    });

    const { sources } = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}?view=sources`,
    ).then((response) => response.json<{
      sources: Array<{
        id: string;
        kind: string;
        provenance: { origin: string; locator: string };
      }>;
    }>());
    const image = sources.find((source) => source.kind === "image");
    expect(image).toMatchObject({
      provenance: {
        origin: "creator-upload",
        locator: "lighthouse-rules.pdf page 2",
      },
    });
  });

  it("does not claim art when a rulebook supplies no usable page image", async () => {
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "纯文本规则书" }),
    }).then((response) => response.json<{
      project: { id: string; version: number };
    }>());
    const queued = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/jobs`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "generate-rule-system",
          expectedVersion: created.project.version,
          idea: "没有插图的规则书。",
          sourceContent: "SETUP Place 10 cards. TURN Players draw one card.",
          sourceKind: "rulebook",
          sourceName: "text-only-rules.pdf",
          idempotencyKey: "no-rulebook-art-001",
        }),
      },
    ).then((response) => response.json<{ id: string }>());

    await expect(waitForJob(queued.id)).resolves.toMatchObject({
      status: "succeeded",
      result: { ruleSystem: { presentation: { theme: "rulebook-studio" } } },
    });
    const ruleSystem = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}?view=rule-system`,
    ).then((response) => response.json<{ presentation: { image?: unknown } }>());
    expect(ruleSystem.presentation.image).toBeUndefined();
    const { sources } = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}?view=sources`,
    ).then((response) => response.json<{ sources: Array<{ kind: string }> }>());
    expect(sources.some((source) => source.kind === "image")).toBe(false);
  });

  it("labels standalone visual material without calling it a rulebook page", async () => {
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "独立视觉素材" }),
    }).then((response) => response.json<{
      project: { id: string; version: number };
    }>());
    const queued = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/jobs`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "generate-rule-system",
          expectedVersion: created.project.version,
          idea: "根据这张视觉素材提出一个可编辑的规则游戏提案。",
          sourceName: "visual material",
          sourceKind: "brief",
          visualInputs: [{
            name: "mood.gif",
            content: "data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAABwAQCdASoBAAEAAUAmJaQAA3AA/vuUAAA=",
            pageNumber: 1,
            imageUse: "visual-reference",
          }],
          idempotencyKey: "standalone-visual-material-001",
        }),
      },
    ).then((response) => response.json<{ id: string }>());

    await expect(waitForJob(queued.id)).resolves.toMatchObject({
      status: "succeeded",
      result: {
        ruleSystem: { runtimeSupport: { status: "draft" } },
      },
    });
    const { sources } = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}?view=sources`,
    ).then((response) => response.json<{
      sources: Array<{ kind: string; provenance: { origin: string; locator: string } }>;
    }>());
    expect(sources.find((source) => source.kind === "image")).toMatchObject({
      provenance: {
        origin: "creator-upload",
        locator: "visual material item 1",
      },
    });
  });

  it("blocks invitations for a naked build, then admits typographic and kit-backed visual floors", async () => {
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Presentation Floor 门闩" }),
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
          idempotencyKey: "visual-floor-runtime",
          operations: [{
            op: "configure_score_race",
            config: {
              victoryTarget: 3,
              maxTurns: 6,
              actions: [{ id: "advance", label: "前进", points: 1 }],
            },
          }],
        }),
      },
    ).then((response) => response.json<{ project: { version: number } }>());
    const naked = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/builds`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: configured.project.version,
          idempotencyKey: "visual-floor-naked-build",
        }),
      },
    ).then((response) => response.json<{
      build: {
        id: string;
        presentationFloor: { status: string; reason: string };
      };
    }>());
    expect(naked.build.presentationFloor).toEqual({
      status: "failed",
      reason: "没有可分享的呈现：请绑定提取/上传图像、生成排版界面，或应用主题 kit。",
      visuals: [],
    });
    const refused = await SELF.fetch(
      `https://godesk.test/api/builds/${naked.build.id}/sessions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ seed: 42, idempotencyKey: "visual-floor-refused" }),
      },
    );
    expect(refused.status).toBe(422);
    await expect(refused.json()).resolves.toMatchObject({
      error: "visual_floor_unmet",
      presentationFloor: naked.build.presentationFloor,
    });

    const generated = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/jobs`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "generate-rule-system",
          expectedVersion: configured.project.version + 1,
          sourceContent: "两名玩家轮流选择航线，执行后获得 2 分。率先获得 8 分者获胜。",
          sourceKind: "rulebook",
          sourceName: "visual-floor-rules.md",
          name: "排版渲染桌",
          idempotencyKey: "visual-floor-typographic",
        }),
      },
    ).then((response) => response.json<{ id: string }>());
    await expect(waitForJob(generated.id)).resolves.toMatchObject({
      status: "succeeded",
      result: {
        ruleSystem: {
          presentation: {
            visuals: [{
              provenance: "kit",
              label: "程序化主题 kit",
            }],
          },
          runtimeSupport: { status: "draft" },
        },
      },
    });
    const approved = await approveGenerationPlan(
      created.project.id,
      configured.project.version + 2,
      "visual-floor-approve-plan",
    );
    const kitMaterializedBuild = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/builds`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: approved.project.version,
          idempotencyKey: "visual-floor-typographic-build",
        }),
      },
    ).then((response) => response.json<{
      build: { id: string; presentationFloor: { status: string; reason: string } };
    }>());
    expect(kitMaterializedBuild.build.presentationFloor).toEqual({
      status: "passed",
      reason: "程序化主题 kit 已满足 Presentation Floor。",
      visuals: [{
        provenance: "kit",
        label: "程序化主题 kit",
      }],
    });
    expect(
      await SELF.fetch(
        `https://godesk.test/api/builds/${kitMaterializedBuild.build.id}/sessions`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            seed: 42,
            idempotencyKey: "visual-floor-typographic-room",
          }),
        },
      ),
    ).toMatchObject({ status: 201 });

    const fakeGenerated = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/changes`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: approved.project.version + 1,
          idempotencyKey: "visual-floor-fake-generated",
          operations: [{
            op: "update_rule_system",
            fields: {
              presentation: {
                theme: "fake-generated",
                visuals: [{
                  provenance: "generated",
                  label: "排版与程序化游戏界面",
                }],
              },
            },
          }],
        }),
      },
    ).then((response) => response.json<{ project: { version: number } }>());
    const fakeGeneratedBuild = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/builds`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: fakeGenerated.project.version,
          idempotencyKey: "visual-floor-fake-generated-build",
        }),
      },
    ).then((response) => response.json<{
      build: { id: string; presentationFloor: { status: string; reason: string } };
    }>());
    expect(fakeGeneratedBuild.build.presentationFloor).toEqual({
      status: "failed",
      reason: "generated、extracted 或 uploaded 呈现必须绑定真实图像，不能只写 provenance。",
      visuals: [{
        provenance: "generated",
        label: "排版与程序化游戏界面",
      }],
    });
    const refusedFake = await SELF.fetch(
      `https://godesk.test/api/builds/${fakeGeneratedBuild.build.id}/sessions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ seed: 42, idempotencyKey: "visual-floor-fake-refused" }),
      },
    );
    expect(refusedFake.status).toBe(422);
    await expect(refusedFake.json()).resolves.toMatchObject({
      error: "visual_floor_unmet",
      presentationFloor: fakeGeneratedBuild.build.presentationFloor,
    });

    const kit = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/changes`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: fakeGenerated.project.version + 1,
          idempotencyKey: "visual-floor-kit",
          operations: [{
            op: "update_rule_system",
            fields: {
              presentation: {
                theme: "harbor-kit",
                visuals: [{
                  provenance: "kit",
                  label: "Harbor ink presentation kit",
                }],
              },
            },
          }],
        }),
      },
    ).then((response) => response.json<{ project: { version: number } }>());
    const kitBuild = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/builds`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: kit.project.version,
          idempotencyKey: "visual-floor-kit-build",
        }),
      },
    ).then((response) => response.json<{
      build: { presentationFloor: { status: string; reason: string } };
    }>());
    expect(kitBuild.build.presentationFloor).toEqual({
      status: "passed",
      reason: "Harbor ink presentation kit 已满足 Presentation Floor。",
      visuals: [{
        provenance: "kit",
        label: "Harbor ink presentation kit",
      }],
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
      result: { build: { ruleSystemVersion: 2 } },
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
      result: { build: { ruleSystemVersion: 1 } },
    });
  }, 15_000);

});
