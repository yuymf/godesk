import {
  env,
  evictDurableObject,
  runDurableObjectAlarm,
  runInDurableObject,
  SELF,
} from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { GameProject } from "../src/creator/project-contract";

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
  expect(
    payload.result.isError,
    JSON.stringify(payload.result.content),
  ).not.toBe(true);
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

function shareApi(shareUrl: string, pathname: string) {
  const url = new URL(shareUrl);
  url.pathname = pathname;
  return url.toString();
}

async function claimSeat(
  roomId: string,
  seat: number,
  shareUrl?: string,
  extras?: { seatToken?: string; displayName?: string },
) {
  const pathname = `/api/sessions/${roomId}/seats`;
  const response = await SELF.fetch(
    shareUrl ? shareApi(shareUrl, pathname) : `https://godesk.test${pathname}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ seat, ...extras }),
    },
  );
  const body = await response.json<{
    session?: {
      id: string;
      seats: Array<{ seat: number; displayName?: string }>;
    };
    seatToken?: string;
    error?: string;
    seat?: number;
  }>();
  return {
    status: response.status,
    session: body.session,
    seatToken: body.seatToken,
    error: body.error,
    claimedSeat: body.seat,
  };
}

function nextSocketSnapshot(socket: WebSocket, label = "Room snapshot") {
  return new Promise<{
    type: string;
    session: {
      id: string;
      seats: Array<{ seat: number; displayName?: string }>;
      acceptedActions: Array<{ actionId: string }>;
    };
  }>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`${label} was not received`)),
      1_000,
    );
    socket.addEventListener("message", (event) => {
      try {
        clearTimeout(timeout);
        resolve(JSON.parse(String(event.data)));
      } catch (reason) {
        clearTimeout(timeout);
        reject(reason);
      }
    }, { once: true });
  });
}

async function applyKitPresentation(
  projectId: string,
  expectedVersion: number,
  idempotencyKey: string,
  theme = "idea-relay",
) {
  const response = await SELF.fetch(
    `https://godesk.test/api/projects/${projectId}/changes`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        expectedVersion,
        idempotencyKey,
        operations: [{
          op: "update_rule_system",
          fields: {
            presentation: {
              theme,
              visuals: [{ provenance: "kit", label: "程序化主题 kit" }],
            },
          },
        }],
      }),
    },
  );
  expect(response.status).toBe(200);
  return response.json<{ project: { version: number } }>();
}

async function approveGenerationPlan(
  projectId: string,
  expectedVersion: number,
  idempotencyKey: string,
) {
  const planView = await SELF.fetch(
    `https://godesk.test/api/projects/${projectId}?view=generation-plan`,
  ).then((response) => response.json<{
    generationPlan: { id: string; status: string } | null;
  }>());
  expect(planView.generationPlan?.status).toBe("pending");
  const response = await SELF.fetch(
    `https://godesk.test/api/projects/${projectId}/changes`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        expectedVersion,
        idempotencyKey,
        operations: [{
          op: "approve_generation_plan",
          planId: planView.generationPlan?.id,
        }],
      }),
    },
  );
  expect(response.status).toBe(200);
  return response.json<{
    project: { version: number };
    generationPlan: { status: string; ruleSystemVersion: number } | null;
  }>();
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
      studioUrl: string;
      project: {
        id: string;
        name: string;
        version: number;
        activeRuleSystemId: string;
      };
    }>();
    expect(created.project).toMatchObject({
      name: "雾港测试桌",
      version: 1,
    });
    expect(created.project.activeRuleSystemId).toMatch(/^rule_system_/);
    expect(new URL(created.studioUrl).pathname).toBe(
      `/studio/${created.project.id}`,
    );

    const reopenedResponse = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}`,
    );

    expect(reopenedResponse.status).toBe(200);
    await expect(reopenedResponse.json()).resolves.toEqual(created.project);

    const activityResponse = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}?view=activity`,
    );
    expect(activityResponse.status).toBe(200);
    await expect(activityResponse.json()).resolves.toMatchObject({
      project: { id: created.project.id, version: created.project.version },
      jobs: [],
      sessions: [],
    });
  });

  it("keeps one stable Playtest Link while explicitly switching its Shared Session", async () => {
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "固定试玩入口",
        templateId: "idea-relay",
      }),
    }).then((response) => response.json<{
      project: { id: string; version: number };
    }>());
    const prepared = await applyKitPresentation(
      created.project.id,
      created.project.version,
      "stable-playtest-kit",
    );
    const compiled = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/builds`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: prepared.project.version,
          idempotencyKey: "stable-playtest-build",
        }),
      },
    ).then((response) => response.json<{
      project: { version: number };
      build: { id: string };
    }>());
    const createRoom = (idempotencyKey: string) => SELF.fetch(
      `https://godesk.test/api/builds/${compiled.build.id}/sessions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ seed: 42, idempotencyKey }),
      },
    ).then((response) => response.json<{ id: string; replayId: string }>());
    const firstRoom = await createRoom("stable-playtest-room-1");

    await expect(SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}?view=playtest-link`,
    ).then((response) => response.json())).resolves.toEqual({ playtestLink: null });

    const invalidPublish = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/changes`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: compiled.project.version,
          idempotencyKey: "stable-playtest-invalid-room",
          operations: [{
            op: "publish_shared_session",
            sessionId: "room_from_another_project",
          }],
        }),
      },
    );
    expect(invalidPublish.status).toBe(400);
    await expect(invalidPublish.json()).resolves.toEqual({ error: "变更内容无效。" });

    const publish = (expectedVersion: number, sessionId: string, idempotencyKey: string) =>
      SELF.fetch(
        `https://godesk.test/api/projects/${created.project.id}/changes`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            expectedVersion,
            idempotencyKey,
            operations: [{ op: "publish_shared_session", sessionId }],
          }),
        },
      ).then((response) => response.json<{ project: { version: number } }>());
    const firstPublish = await publish(
      compiled.project.version,
      firstRoom.id,
      "stable-playtest-publish-1",
    );
    const firstLink = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}?view=playtest-link`,
    ).then((response) => response.json<{
      playtestLink: {
        projectId: string;
        sessionId: string;
        buildId: string;
        replayId: string;
        url: string;
      };
    }>());
    expect(firstLink.playtestLink).toMatchObject({
      projectId: created.project.id,
      sessionId: firstRoom.id,
      buildId: compiled.build.id,
      replayId: firstRoom.replayId,
    });
    expect(new URL(firstLink.playtestLink.url).pathname).toBe(
      `/try/${created.project.id}`,
    );
    expect(new URL(firstLink.playtestLink.url).searchParams.get("share")).toBeTruthy();
    expect(new URL(firstLink.playtestLink.url).searchParams.has("creator")).toBe(false);
    const firstRedirect = await SELF.fetch(firstLink.playtestLink.url, {
      redirect: "manual",
    });
    expect(firstRedirect.status).toBe(302);
    expect(new URL(firstRedirect.headers.get("location")!).pathname).toBe(
      `/room/${firstRoom.id}`,
    );

    const secondRoom = await createRoom("stable-playtest-room-2");
    const secondPublish = await publish(
      firstPublish.project.version,
      secondRoom.id,
      "stable-playtest-publish-2",
    );
    expect(secondPublish.project.version).toBe(firstPublish.project.version + 1);
    const secondLink = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}?view=playtest-link`,
    ).then((response) => response.json<{
      playtestLink: { sessionId: string; replayId: string; url: string };
    }>());
    expect(new URL(secondLink.playtestLink.url).pathname).toBe(
      `/try/${created.project.id}`,
    );
    expect(new URL(secondLink.playtestLink.url).searchParams.get("share")).toBeTruthy();
    expect(secondLink.playtestLink.sessionId).toBe(secondRoom.id);
    expect(secondLink.playtestLink.replayId).toBe(secondRoom.replayId);
    const secondRedirect = await SELF.fetch(secondLink.playtestLink.url, {
      redirect: "manual",
    });
    expect(new URL(secondRedirect.headers.get("location")!).pathname).toBe(
      `/room/${secondRoom.id}`,
    );
    await expect(SELF.fetch(
      `https://godesk.test/api/sessions/${firstRoom.id}`,
    )).resolves.toMatchObject({ status: 200 });
  });

  it("publishes and reads the stable Playtest Link through the Codex MCP surface", async () => {
    const created = await callMcpTool<{
      project: { id: string; version: number };
    }>(901, "create_project", {
      name: "MCP 固定试玩入口",
      templateId: "idea-relay",
    });
    const prepared = await callMcpTool<{ project: { version: number } }>(
      9011,
      "apply_project_patch",
      {
        projectId: created.project.id,
        expectedVersion: created.project.version,
        idempotencyKey: "mcp-stable-playtest-kit",
        operations: [{
          op: "update_rule_system",
          fields: {
            presentation: {
              theme: "idea-relay",
              visuals: [{ provenance: "kit", label: "程序化主题 kit" }],
            },
          },
        }],
      },
    );
    const submitted = await callMcpTool<{ id: string }>(902, "submit_job", {
      kind: "compile-build",
      projectId: created.project.id,
      expectedVersion: prepared.project.version,
      idempotencyKey: "mcp-stable-playtest-build",
    });
    const finished = await waitForJob(submitted.id);
    expect(finished).toMatchObject({ status: "succeeded" });
    const result = finished.result as {
      project: { version: number };
      build: { id: string };
    };
    const room = await callMcpTool<{ id: string; replayId: string }>(903, "create_shared_session", {
      buildId: result.build.id,
      seed: 42,
      idempotencyKey: "mcp-stable-playtest-room",
    });
    const published = await callMcpTool<{
      project: { version: number };
      changeset: { affectedEntities: string[] };
    }>(904, "apply_project_patch", {
      projectId: created.project.id,
      expectedVersion: result.project.version,
      idempotencyKey: "mcp-stable-playtest-publish",
      operations: [{ op: "publish_shared_session", sessionId: room.id }],
    });
    expect(published.changeset.affectedEntities).toContain(
      `playtest-link:${created.project.id}`,
    );
    const view = await callMcpTool<{
      view: string;
      data: {
        playtestLink: {
          projectId: string;
          sessionId: string;
          buildId: string;
          replayId: string;
          url: string;
        };
      };
    }>(905, "read_project", {
      projectId: created.project.id,
      view: "playtest-link",
    });
    expect(view.data.playtestLink).toMatchObject({
      projectId: created.project.id,
      sessionId: room.id,
      buildId: result.build.id,
      replayId: room.replayId,
    });
    expect(new URL(view.data.playtestLink.url).pathname).toBe(
      `/try/${created.project.id}`,
    );
    expect(new URL(view.data.playtestLink.url).searchParams.get("share")).toBeTruthy();
    expect(new URL(view.data.playtestLink.url).searchParams.has("creator")).toBe(false);
  });

  it.each([
    ["harbor-13", "港口十三号", "source_harbor_13_original_brief"],
    ["mistpeak-lodge", "雾岭山庄", "source_mistpeak_lodge_original_brief"],
    ["idea-relay", "灵感接力", "source_idea_relay_original_brief"],
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
        studioUrl: string;
      }>();
      expect(created.warnings).toEqual([]);
      expect(new URL(created.studioUrl).pathname).toBe(
        `/studio/${created.project.id}`,
      );

      const ruleSystem = await SELF.fetch(
        `https://godesk.test/api/projects/${created.project.id}?view=rule-system`,
      ).then((response) => response.json<{
        name: string;
        rules: Array<{ sourceId: string; provenance: string }>;
        entities: Array<{ sourceId: string; provenance: string }>;
        actions: Array<{ sourceId: string; provenance: string }>;
        runtimeSupport: { status: string; unsupported: string[] };
      }>());
      expect(ruleSystem.name).toBe(expectedName);
      expect(ruleSystem.runtimeSupport.status).toBe("executable");
      expect(ruleSystem.runtimeSupport.unsupported.length).toBeGreaterThan(0);
      for (const entity of [
        ...ruleSystem.rules,
        ...ruleSystem.entities,
        ...ruleSystem.actions,
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

  it("compiles harbor-13 voyage kernel, opens a room, and accepts a placement", async () => {
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "港口十三号", templateId: "harbor-13" }),
    }).then((response) =>
      response.json<{ project: { id: string; version: number } }>(),
    );

    const ruleSystem = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}?view=rule-system`,
    ).then((response) =>
      response.json<{
        runtimeSupport: { kernel: { type: string } };
        playSurface: { regions: unknown[] };
        stages: unknown[];
      }>(),
    );
    expect(ruleSystem.runtimeSupport.kernel.type).toBe("harbor-voyage-v1");
    expect(ruleSystem.playSurface.regions.length).toBeGreaterThanOrEqual(4);
    expect(ruleSystem.stages.length).toBeGreaterThanOrEqual(4);

    const compiled = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/builds`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: created.project.version,
          idempotencyKey: "harbor-voyage-compile",
        }),
      },
    );
    expect(compiled.status).toBe(201);
    const { build } = await compiled.json<{ build: { id: string } }>();

    const roomResponse = await SELF.fetch(
      `https://godesk.test/api/builds/${build.id}/sessions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          seed: 42,
          idempotencyKey: "harbor-voyage-room",
        }),
      },
    );
    expect(roomResponse.status).toBe(201);
    const room = await roomResponse.json<{
      id: string;
      state: {
        voyage?: { phase: string };
        activeSeat: number;
        scores: number[];
      };
      replayId: string;
    }>();
    expect(room.state.voyage?.phase).toBe("placement");
    expect(room.state.scores).toEqual([30, 30, 30]);

    const intent = await SELF.fetch(
      `https://godesk.test/api/sessions/${room.id}/intents`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          intentId: "place-cedar-1",
          seat: 0,
          actionId: "place:cedar",
        }),
      },
    );
    expect(intent.status).toBe(200);
    const updated = await intent.json<{
      state: {
        activeSeat: number;
        voyage?: { placements: unknown[]; phase: string };
      };
      acceptedActions: Array<{ actionId: string }>;
    }>();
    expect(updated.state.activeSeat).toBe(1);
    expect(updated.state.voyage?.placements).toHaveLength(1);
    expect(updated.acceptedActions[0]?.actionId).toBe("place:cedar");

    const playtest = await SELF.fetch(
      `https://godesk.test/api/builds/${build.id}/playtests`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          seed: 42,
          idempotencyKey: "harbor-voyage-bot",
        }),
      },
    );
    expect(playtest.status).toBe(201);
    const run = await playtest.json<{
      terminalStatus: string;
      replayId: string;
      metrics: { winnerSeat: number | null };
    }>();
    expect(run.terminalStatus).toBe("complete");
    expect(run.metrics.winnerSeat).not.toBeNull();

    const replay = await SELF.fetch(
      `https://godesk.test/api/replays/${run.replayId}`,
    ).then((response) =>
      response.json<{
        finalState: { status: string; voyage?: { phase: string } };
      }>(),
    );
    expect(replay.finalState.status).toBe("complete");
    expect(replay.finalState.voyage?.phase).toBe("resolved");
  });

  it("exposes harbor voyage session and replay state through MCP", async () => {
    const created = await callMcpTool<{
      project: { id: string; version: number };
    }>(200, "create_project", {
      name: "MCP 港口航次",
      templateId: "harbor-13",
    });
    const compile = await callMcpTool<{ id: string }>(201, "submit_job", {
      kind: "compile-build",
      projectId: created.project.id,
      expectedVersion: created.project.version,
      idempotencyKey: "mcp-harbor-compile-001",
    });
    const compiled = await waitForJob(compile.id);
    expect(compiled.status).toBe("succeeded");
    const buildId = String(
      (compiled.result?.build as { id?: unknown } | undefined)?.id,
    );
    expect(buildId).toMatch(/^build_/);

    const session = await callMcpTool<{
      id: string;
      replayId: string;
      state: { voyage?: { phase: string; placements: unknown[] } };
    }>(202, "create_shared_session", {
      buildId,
      seed: 42,
      idempotencyKey: "mcp-harbor-room-001",
    });
    expect(session.state.voyage).toMatchObject({
      phase: "placement",
      placements: [],
    });

    const acted = await callMcpTool<{
      state: { voyage?: { placements: unknown[] } };
      acceptedActions: Array<{ actionId: string }>;
    }>(203, "submit_session_intent", {
      sessionId: session.id,
      intentId: "mcp-harbor-place-001",
      seat: 0,
      actionId: "place:cedar",
    });
    expect(acted.state.voyage?.placements).toHaveLength(1);
    expect(acted.acceptedActions[0]?.actionId).toBe("place:cedar");

    const replay = await callMcpTool<{
      initialState: { voyage?: { phase: string } };
      acceptedActions: Array<{ actionId: string }>;
    }>(204, "read_replay", { replayId: session.replayId });
    expect(replay.initialState.voyage?.phase).toBe("placement");
    expect(replay.acceptedActions[0]?.actionId).toBe("place:cedar");
  });

  it("shares and replays the non-tabletop idea-relay example", async () => {
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "灵感接力", templateId: "idea-relay" }),
    }).then((response) => response.json<{
      project: { id: string; version: number; activeRuleSystemId: string };
    }>());
    const ruleSystem = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}?view=rule-system`,
    ).then((response) => response.json<{
      playSurface: { kind: string; regions: unknown[] };
    }>());
    expect(ruleSystem.playSurface).toEqual({
      kind: "conversation",
      layout: "prompt-and-response",
      regions: [],
    });
    const prepared = await applyKitPresentation(
      created.project.id,
      created.project.version,
      "idea-relay-kit",
    );

    const { build } = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/builds`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: prepared.project.version,
          idempotencyKey: "idea-relay-build",
        }),
      },
    ).then((response) => response.json<{ build: { id: string } }>());
    const room = await SELF.fetch(
      `https://godesk.test/api/builds/${build.id}/sessions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ seed: 9, idempotencyKey: "idea-relay-room" }),
      },
    ).then((response) => response.json<{ id: string; replayId: string }>());

    const seats = new Map<number, string>();
    for (const seat of [0, 1] as const) {
      const claimed = await claimSeat(room.id, seat);
      expect(claimed.status).toBe(200);
      expect(claimed.seatToken).toMatch(/^seat_/);
      seats.set(seat, claimed.seatToken!);
    }
    for (const [seat, actionId] of [
      [0, "connect"],
      [1, "constraint"],
    ] as const) {
      const accepted = await SELF.fetch(
        `https://godesk.test/api/sessions/${room.id}/intents`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            intentId: `idea-${seat}`,
            seat,
            seatToken: seats.get(seat),
            actionId,
          }),
        },
      );
      expect(accepted.status).toBe(200);
    }

    const replay = await SELF.fetch(
      `https://godesk.test/api/replays/${room.replayId}`,
    ).then((response) => response.json<{
      acceptedActions: Array<{ actionId: string }>;
      finalState: { turn: number; scores: number[] };
    }>());
    expect(replay.acceptedActions.map((action) => action.actionId)).toEqual([
      "connect",
      "constraint",
    ]);
    expect(replay.finalState).toMatchObject({ turn: 2, scores: [3, 2, 0] });
  });

  it("pushes persisted Room snapshots through isolated hibernation-compatible WebSockets", async () => {
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "实时灵感接力", templateId: "idea-relay" }),
    }).then((response) => response.json<{
      project: { id: string; version: number };
    }>());
    const prepared = await applyKitPresentation(
      created.project.id,
      created.project.version,
      "room-websocket-kit",
    );
    const { build } = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/builds`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: prepared.project.version,
          idempotencyKey: "room-websocket-build",
        }),
      },
    ).then((response) => response.json<{ build: { id: string } }>());
    const createRoom = (idempotencyKey: string) => SELF.fetch(
      `https://godesk.test/api/builds/${build.id}/sessions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ seed: 42, idempotencyKey }),
      },
    ).then((response) => response.json<{ id: string }>());
    const [firstRoom, secondRoom] = await Promise.all([
      createRoom("room-websocket-first"),
      createRoom("room-websocket-second"),
    ]);
    const creatorStub = env.CREATOR_PROJECTS.getByName("local-creator");
    expect(await SELF.fetch(
      `https://godesk.test/api/sessions/${firstRoom.id}/events`,
    ).then((response) => response.status)).toBe(426);

    const openRoomSocket = async (roomId: string) => {
      const response = await creatorStub.fetch(
        `https://projects.internal/sessions/${roomId}/events`,
        { headers: { Upgrade: "websocket" } },
      );
      expect(response.status).toBe(101);
      if (!response.webSocket) throw new Error("Expected Room WebSocket");
      const initial = nextSocketSnapshot(response.webSocket, `${roomId} initial snapshot`);
      response.webSocket.accept();
      response.webSocket.send('{"type":"session.sync"}');
      expect(await initial).toMatchObject({
        type: "session.snapshot",
        session: { id: roomId, seats: [], acceptedActions: [] },
      });
      return response.webSocket;
    };
    const [firstSocket, secondSocket] = await Promise.all([
      openRoomSocket(firstRoom.id),
      openRoomSocket(secondRoom.id),
    ]);
    await runInDurableObject(creatorStub, async (_instance, state) => {
      expect(state.getWebSockets().map((socket) =>
        (socket.deserializeAttachment() as { sessionId: string }).sessionId
      ).sort()).toEqual([firstRoom.id, secondRoom.id].sort());
    });
    const firstUpdate = nextSocketSnapshot(firstSocket, "seat update");
    let secondRoomUpdated = false;
    secondSocket.addEventListener("message", () => {
      secondRoomUpdated = true;
    }, { once: true });
    const claimed = await claimSeat(firstRoom.id, 0, undefined, {
      displayName: "socket-friend",
    });
    expect(claimed.status).toBe(200);
    expect(claimed.seatToken).toMatch(/^seat_/);
    expect(await firstUpdate).toMatchObject({
      type: "session.snapshot",
      session: {
        id: firstRoom.id,
        seats: [{ seat: 0, displayName: "socket-friend" }],
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(secondRoomUpdated).toBe(false);
    secondSocket.close(1000, "isolation_verified");

    const actionUpdate = nextSocketSnapshot(firstSocket, "action update");
    const accepted = await SELF.fetch(
      `https://godesk.test/api/sessions/${firstRoom.id}/intents`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          intentId: "socket-action",
          seat: 0,
          seatToken: claimed.seatToken,
          actionId: "connect",
        }),
      },
    );
    expect(accepted.status).toBe(200);
    expect(await actionUpdate).toMatchObject({
      session: {
        id: firstRoom.id,
        acceptedActions: [{ actionId: "connect" }],
      },
    });
    firstSocket.close(1000, "done");
  });

  it("persists one feedback entry per claimed seat without changing the Replay", async () => {
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "灵感反馈房间", templateId: "idea-relay" }),
    }).then((response) => response.json<{
      project: { id: string; version: number; activeRuleSystemId: string };
    }>());
    const prepared = await applyKitPresentation(
      created.project.id,
      created.project.version,
      "feedback-kit",
    );
    const { build } = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/builds`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: prepared.project.version,
          idempotencyKey: "feedback-build",
        }),
      },
    ).then((response) => response.json<{ build: { id: string } }>());
    const room = await SELF.fetch(
      `https://godesk.test/api/builds/${build.id}/sessions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ seed: 12, idempotencyKey: "feedback-room" }),
      },
    ).then((response) => response.json<{ id: string; replayId: string }>());

    const claim = await claimSeat(room.id, 0);
    expect(claim.status).toBe(200);
    expect(claim.seatToken).toMatch(/^seat_/);
    const beforeAction = await SELF.fetch(
      `https://godesk.test/api/sessions/${room.id}/feedback`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          seat: 0,
          seatToken: claim.seatToken,
          rating: 5,
          comment: "还没有行动，不能形成可追溯反馈。",
        }),
      },
    );
    expect(beforeAction.status).toBe(409);
    await expect(beforeAction.json()).resolves.toMatchObject({
      error: "feedback_requires_action",
    });
    const accepted = await SELF.fetch(
      `https://godesk.test/api/sessions/${room.id}/intents`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          intentId: "feedback-action",
          seat: 0,
          seatToken: claim.seatToken,
          actionId: "connect",
        }),
      },
    );
    expect(accepted.status).toBe(200);
    const replayBefore = await SELF.fetch(
      `https://godesk.test/api/replays/${room.replayId}`,
    ).then((response) => response.json<{
      acceptedActions: unknown[];
      finalState: unknown;
    }>());

    const invalid = await SELF.fetch(
      `https://godesk.test/api/sessions/${room.id}/feedback`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          seat: 0,
          seatToken: claim.seatToken,
          rating: 6,
          comment: "太短",
        }),
      },
    );
    expect(invalid.status).toBe(400);

    const unclaimed = await SELF.fetch(
      `https://godesk.test/api/sessions/${room.id}/feedback`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          seat: 1,
          seatToken: "seat_unclaimed-friend",
          rating: 5,
          comment: "这条反馈不应该被接受。",
        }),
      },
    );
    expect(unclaimed.status).toBe(409);
    await expect(unclaimed.json()).resolves.toMatchObject({
      error: "seat_not_claimed",
    });

    const firstFeedback = await SELF.fetch(
      `https://godesk.test/api/sessions/${room.id}/feedback`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          seat: 0,
          seatToken: claim.seatToken,
          rating: 5,
          comment: "目标很清楚，行动反馈也很及时。",
        }),
      },
    );
    expect(firstFeedback.status).toBe(200);
    const firstRoom = await firstFeedback.json<{
      feedback: Array<{
        id: string;
        seat: number;
        rating: number;
        comment: string;
        moment: { actionSequence: number; actionId: string };
        createdAt: string;
        updatedAt: string;
      }>;
    }>();
    expect(firstRoom.feedback).toHaveLength(1);
    expect(firstRoom.feedback[0]).toMatchObject({
      seat: 0,
      rating: 5,
      comment: "目标很清楚，行动反馈也很及时。",
      moment: { actionSequence: 1, actionId: "connect" },
    });
    const feedbackId = firstRoom.feedback[0].id;
    const createdAt = firstRoom.feedback[0].createdAt;

    const updatedFeedback = await SELF.fetch(
      `https://godesk.test/api/sessions/${room.id}/feedback`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          seat: 0,
          seatToken: claim.seatToken,
          rating: 4,
          comment: "目标很清楚，但第二回合还可以更有张力。",
        }),
      },
    );
    expect(updatedFeedback.status).toBe(200);
    const updatedRoom = await updatedFeedback.json<{
      feedback: Array<{
        id: string;
        seat: number;
        rating: number;
        comment: string;
        moment: { actionSequence: number; actionId: string };
        createdAt: string;
        updatedAt: string;
      }>;
    }>();
    expect(updatedRoom.feedback).toHaveLength(1);
    expect(updatedRoom.feedback[0]).toMatchObject({
      id: feedbackId,
      seat: 0,
      rating: 4,
      comment: "目标很清楚，但第二回合还可以更有张力。",
      moment: { actionSequence: 1, actionId: "connect" },
      createdAt,
    });

    await expect(
      SELF.fetch(`https://godesk.test/api/sessions/${room.id}`).then((response) =>
        response.json(),
      ),
    ).resolves.toMatchObject({
      feedback: [{ id: feedbackId, rating: 4 }],
    });
    await expect(
      SELF.fetch(
        `https://godesk.test/api/projects/${created.project.id}?view=sessions`,
      ).then((response) => response.json()),
    ).resolves.toMatchObject({
      sessions: [{ id: room.id, feedback: [{ id: feedbackId, rating: 4 }] }],
    });
    const replayAfter = await SELF.fetch(
      `https://godesk.test/api/replays/${room.replayId}`,
    ).then((response) => response.json<Record<string, unknown>>());
    expect(replayAfter).not.toHaveProperty("feedback");
    expect(replayAfter.acceptedActions).toEqual(replayBefore.acceptedActions);
    expect(replayAfter.finalState).toEqual(replayBefore.finalState);
  });

  it("records a human Validation Finding against a Design Hypothesis", async () => {
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "验证灵感接力", templateId: "idea-relay" }),
    }).then((response) => response.json<{
      project: { id: string; version: number };
    }>());
    const prepared = await applyKitPresentation(
      created.project.id,
      created.project.version,
      "idea-relay-validation-kit",
    );
    const hypothesisChange = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/changes`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: prepared.project.version,
          idempotencyKey: "idea-relay-hypothesis",
          operations: [{
            op: "add_design_hypothesis",
            hypothesis: {
              question: "加入约束是否会让共同创意更具体？",
              successSignal: "两名参与者都能在下一轮复用这个约束。",
            },
          }],
        }),
      },
    ).then((response) => response.json<{
      project: { version: number };
      hypotheses: Array<{ id: string }>;
    }>());
    const hypothesisId = hypothesisChange.hypotheses[0]?.id;
    expect(hypothesisId).toMatch(/^hypothesis_/);

    const compiled = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/builds`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: hypothesisChange.project.version,
          idempotencyKey: "idea-relay-validation-build",
        }),
      },
    ).then((response) => response.json<{
      project: { version: number };
      build: { id: string };
    }>());
    const botJob = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/jobs`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "bot-playtest",
          buildId: compiled.build.id,
          seed: 4,
          idempotencyKey: "idea-relay-validation-bot",
        }),
      },
    ).then((response) => response.json<{ id: string }>());
    const botPlaytest = await waitForJob(botJob.id).then((job) =>
      job.result as { id: string }
    );
    const mislabeledBot = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/changes`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: compiled.project.version,
          idempotencyKey: "idea-relay-mislabeled-bot",
          operations: [{
            op: "record_validation_finding",
            finding: {
              hypothesisId,
              buildId: compiled.build.id,
              evidence: {
                type: "human-session",
                sessionId: botPlaytest.id,
                seatedParticipants: [
                  { seat: 0, name: "Bot A" },
                  { seat: 1, name: "Bot B" },
                ],
                creatorAttested: true,
              },
              verdict: "supported",
              notes: "机器人结果不能标记为真人证据。",
              nextChange: "改为使用真实 Shared Session 证据。",
            },
          }],
        }),
      },
    );
    expect(mislabeledBot.status).toBe(400);
    const room = await SELF.fetch(
      `https://godesk.test/api/builds/${compiled.build.id}/sessions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ seed: 4, idempotencyKey: "idea-relay-validation-room" }),
      },
    ).then((response) => response.json<{ id: string }>());
    const creatorSeat = await claimSeat(room.id, 0, undefined, { displayName: "Creator" });
    const friendSeat = await claimSeat(room.id, 1, undefined, { displayName: "Friend" });
    expect(creatorSeat.status).toBe(200);
    expect(friendSeat.status).toBe(200);
    await SELF.fetch(`https://godesk.test/api/sessions/${room.id}/intents`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        intentId: "validation-action-1",
        seat: 0,
        seatToken: creatorSeat.seatToken,
        actionId: "constraint",
      }),
    });

    const unattestedFinding = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/changes`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: compiled.project.version,
          idempotencyKey: "idea-relay-unattested-human-finding",
          operations: [{
            op: "record_validation_finding",
            finding: {
              hypothesisId,
              buildId: compiled.build.id,
              evidence: {
                type: "human-session",
                sessionId: room.id,
                seatedParticipants: [
                  { seat: 0, name: "Creator" },
                  { seat: 1, name: "Friend" },
                ],
              },
              verdict: "inconclusive",
              notes: "缺少创作者真人证据声明。",
              nextChange: "完成真人参与者声明后重新记录。",
            },
          }],
        }),
      },
    );
    expect(unattestedFinding.status).toBe(400);

    const findingChange = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/changes`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: compiled.project.version,
          idempotencyKey: "idea-relay-finding",
          operations: [{
            op: "record_validation_finding",
            finding: {
              hypothesisId,
              buildId: compiled.build.id,
              evidence: {
                type: "human-session",
                sessionId: room.id,
                seatedParticipants: [
                  { seat: 0, name: "Creator" },
                  { seat: 1, name: "Friend" },
                ],
                creatorAttested: true,
              },
              verdict: "supported",
              notes: "第二位参与者复用了首轮约束。",
              nextChange: "把约束行动改成要求回应上一轮内容，再重新试玩。",
            },
          }],
        }),
      },
    );
    expect(findingChange.status).toBe(200);

    const validation = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}?view=validation`,
    ).then((response) => response.json<{
      hypotheses: Array<{ id: string; question: string }>;
      findings: Array<{
        hypothesisId: string;
        evidence: { type: string; sessionId: string };
        verdict: string;
        nextChange: string;
      }>;
    }>());
    expect(validation).toMatchObject({
      hypotheses: [{ id: hypothesisId, question: "加入约束是否会让共同创意更具体？" }],
      findings: [{
        hypothesisId,
        evidence: {
          type: "human-session",
          sessionId: room.id,
          seatedParticipants: [
            { seat: 0, name: "Creator" },
            { seat: 1, name: "Friend" },
          ],
          creatorAttested: true,
        },
        verdict: "supported",
        nextChange: "把约束行动改成要求回应上一轮内容，再重新试玩。",
      }],
    });
  });

  it("records a participant-feedback Finding without claiming human evidence", async () => {
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "参与者反馈证据", templateId: "idea-relay" }),
    }).then((response) => response.json<{
      project: { id: string; version: number };
    }>());
    const hypothesis = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/changes`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: created.project.version,
          idempotencyKey: "participant-feedback-hypothesis",
          operations: [{
            op: "add_design_hypothesis",
            hypothesis: {
              question: "参与者是否能理解共同创意的推进节奏？",
              successSignal: "反馈评论明确指出行动反馈易于理解。",
            },
          }, {
            op: "add_design_hypothesis",
            hypothesis: {
              question: "参与者是否喜欢视觉风格？",
              successSignal: "反馈明确提到视觉表现。",
            },
          }],
        }),
      },
    ).then((response) => response.json<{
      project: { id: string; version: number };
      hypotheses: Array<{ id: string; question: string; successSignal: string }>;
    }>());
    const prepared = await applyKitPresentation(
      created.project.id,
      hypothesis.project.version,
      "participant-feedback-kit",
    );
    const compiled = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/builds`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: prepared.project.version,
          idempotencyKey: "participant-feedback-build",
        }),
      },
    ).then((response) => response.json<{
      project: { version: number };
      build: { id: string };
    }>());
    const room = await SELF.fetch(
      `https://godesk.test/api/builds/${compiled.build.id}/sessions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          seed: 4,
          idempotencyKey: "participant-feedback-room",
          hypothesisId: hypothesis.hypotheses[0].id,
        }),
      },
    ).then((response) => response.json<{
      id: string;
      experiment: {
        hypothesisId: string;
        question: string;
        successSignal: string;
      };
    }>());
    expect(room.experiment).toEqual({
      hypothesisId: hypothesis.hypotheses[0].id,
      question: "参与者是否能理解共同创意的推进节奏？",
      successSignal: "反馈评论明确指出行动反馈易于理解。",
    });
    const participantSeat = await claimSeat(room.id, 0);
    expect(participantSeat.status).toBe(200);
    await SELF.fetch(`https://godesk.test/api/sessions/${room.id}/intents`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        intentId: "participant-feedback-action",
        seat: 0,
        seatToken: participantSeat.seatToken,
        actionId: "extend",
      }),
    });
    const feedbackRoom = await SELF.fetch(
      `https://godesk.test/api/sessions/${room.id}/feedback`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          seat: 0,
          seatToken: participantSeat.seatToken,
          rating: 5,
          comment: "行动反馈很清楚，知道下一步要继续扩展。",
        }),
      },
    ).then((response) => response.json<{
      feedback: Array<{
        id: string;
        seat: number;
        rating: 1 | 2 | 3 | 4 | 5;
        comment: string;
        moment: { actionSequence: number; actionId: string };
      }>;
    }>());
    const snapshot = feedbackRoom.feedback.map(({ id, seat, rating, comment, moment }) => ({
      id,
      seat,
      rating,
      comment,
      moment,
    }));
    const mismatchedHypothesis = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/changes`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: compiled.project.version,
          idempotencyKey: "participant-feedback-hypothesis-mismatch",
          operations: [{
            op: "record_validation_finding",
            finding: {
              hypothesisId: hypothesis.hypotheses[1].id,
              buildId: compiled.build.id,
              evidence: {
                type: "participant-feedback",
                sessionId: room.id,
                feedback: snapshot,
              },
              verdict: "inconclusive",
              notes: "不能把节奏实验的反馈挪到视觉问题。",
              nextChange: "为视觉问题创建单独的 Shared Session。",
            },
          }],
        }),
      },
    );
    expect(mismatchedHypothesis.status).toBe(400);

    const invalidSnapshot = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/changes`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: compiled.project.version,
          idempotencyKey: "participant-feedback-invalid-snapshot",
          operations: [{
            op: "record_validation_finding",
            finding: {
              hypothesisId: hypothesis.hypotheses[0].id,
              buildId: compiled.build.id,
              evidence: {
                type: "participant-feedback",
                sessionId: room.id,
                feedback: [{
                  ...snapshot[0],
                  moment: { actionSequence: 99, actionId: "connect" },
                }],
              },
              verdict: "inconclusive",
              notes: "篡改行动时刻后的反馈不应成为证据。",
              nextChange: "保留原始反馈快照再继续迭代。",
            },
          }],
        }),
      },
    );
    expect(invalidSnapshot.status).toBe(400);

    const finding = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/changes`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: compiled.project.version,
          idempotencyKey: "participant-feedback-finding",
          operations: [{
            op: "record_validation_finding",
            finding: {
              hypothesisId: hypothesis.hypotheses[0].id,
              buildId: compiled.build.id,
              evidence: {
                type: "participant-feedback",
                sessionId: room.id,
                feedback: snapshot,
              },
              verdict: "supported",
              notes: "参与者反馈指出行动反馈清楚；这不是真人验收声明。",
              nextChange: "保留清晰行动反馈，再用相同 seed 测试更紧凑的回合节奏。",
            },
          }],
        }),
      },
    );
    expect(finding.status).toBe(200);
    const validation = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}?view=validation`,
    ).then((response) => response.json<{
      findings: Array<{
        evidence: {
          type: string;
          sessionId: string;
          feedback: typeof snapshot;
        };
      }>;
    }>());
    expect(validation.findings).toMatchObject([{
      evidence: {
        type: "participant-feedback",
        sessionId: room.id,
        feedback: snapshot,
      },
    }]);

    await SELF.fetch(`https://godesk.test/api/sessions/${room.id}/feedback`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        seat: 0,
        seatToken: participantSeat.seatToken,
        rating: 3,
        comment: "后续回合需要更多节奏变化。",
      }),
    });
    const unchangedFinding = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}?view=validation`,
    ).then((response) => response.json<{
      findings: Array<{ evidence: { feedback: typeof snapshot } }>;
    }>());
    expect(unchangedFinding.findings[0].evidence.feedback).toEqual(snapshot);
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
      "The executable runtime requires reconfiguration after participant, rule, or action changes.",
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
              expect.stringContaining("requires reconfiguration"),
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
            op: "configure_turn_taking",
            config: {
              maxTurns: 18,
              unsupported: expect.arrayContaining([
                expect.stringContaining("conservative 18-turn prototype limit"),
              ]),
            },
          },
        },
      },
    });
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
    const room = await SELF.fetch(
      `https://godesk.test/api/builds/${compiled.build.id}/sessions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ seed: 42, idempotencyKey: "two-browser-room" }),
      },
    ).then((response) => response.json<{
      id: string;
      sessionUrl: string;
      replayId: string;
    }>());
    expect(new URL(room.sessionUrl).pathname).toBe(`/room/${room.id}`);
    expect(new URL(room.sessionUrl).searchParams.get("share")).toBeTruthy();
    expect(new URL(room.sessionUrl).searchParams.has("creator")).toBe(false);

    const publicRoomUrl = new URL(room.sessionUrl);
    publicRoomUrl.hostname = "friend.godesk.example";
    const publicShare = publicRoomUrl.toString();
    await expect(SELF.fetch(publicRoomUrl)).resolves.toMatchObject({ status: 200 });
    await expect(
      SELF.fetch(shareApi(publicShare, `/api/sessions/${room.id}`)),
    ).resolves.toMatchObject({ status: 200 });
    await expect(
      SELF.fetch(shareApi(publicShare, `/api/builds/${compiled.build.id}`)),
    ).resolves.toMatchObject({ status: 200 });
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
    expect(JSON.stringify(jobOutputSchema)).toContain("previewUrl");
    expect(JSON.stringify(jobOutputSchema)).toContain("artifactUrl");
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
        op: "configure_score_race",
        config: {
          maxTurns: 18,
          actions: [{ points: 1 }, { points: 2 }],
        },
      },
    });
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
      body: JSON.stringify({ name: "灵感接力轮流生成回归" }),
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
          idea: "三位玩家轮流扩展一个共同创意或加入约束，最多 4 回合。",
          sourceContent: [
            "三位玩家轮流行动。",
            "扩展创意。",
            "加入约束。",
            "最多 4 回合。",
          ].join("\n"),
          sourceKind: "brief",
          sourceName: "idea-relay.txt",
          name: "灵感接力轮流生成回归",
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
