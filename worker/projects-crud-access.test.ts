import {
  env,
  runInDurableObject,
  SELF,
} from "cloudflare:test";
import { describe, expect, it } from "vitest";
import {
  callMcpTool,
  waitForJob,
  claimSeat,
  nextSocketSnapshot,
  applyKitPresentation,
} from "./projects-test-helpers";

describe("Game Project HTTP seam — CRUD, access, examples, sessions", () => {

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
            payload: { text: `座位 ${seat} 接上一句共同创意。` },
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
          payload: { text: "把雨夜和码头连起来。" },
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
          payload: { text: "把雨夜和码头连起来。" },
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
        payload: { text: "之后每句话都要提到雾。" },
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
        payload: { text: "共同创意里多了一把湿伞。" },
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

  it("lets a visitor open the hobbyist home page without login", async () => {
    const response = await SELF.fetch("https://godesk.example/");
    expect(response.status).not.toBe(401);
    expect(response.headers.get("www-authenticate")).toBeNull();
    expect(response.status).not.toBe(302);
  });

  it("lets a visitor create a game through the public plugin mount", async () => {
    const created = await SELF.fetch("https://godesk.example/chatgpt-plugin/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "公开入口" }),
    });
    expect(created.status, await created.clone().text()).toBe(201);
    expect(created.headers.get("set-cookie") ?? "").toContain("GODESK_ANON");
    const body = await created.json<{
      project: { id: string };
      studioUrl: string;
    }>();
    expect(new URL(body.studioUrl).pathname).toBe(
      `/chatgpt-plugin/studio/${body.project.id}`,
    );
  });

  it("gives a visitor a prefixed invitation a friend can follow", async () => {
    const mount = "https://godesk.example/chatgpt-plugin";
    const created = await SELF.fetch(`${mount}/api/projects`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "灵感接力", templateId: "idea-relay" }),
    });
    expect(created.status, await created.clone().text()).toBe(201);
    const cookie = (created.headers.get("set-cookie") ?? "").split(";")[0];
    const headers = { "content-type": "application/json", cookie };
    const { project } = await created.json<{
      project: { id: string; version: number };
    }>();
    const compiled = await SELF.fetch(`${mount}/api/projects/${project.id}/builds`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        expectedVersion: project.version,
        idempotencyKey: "public-mount-build",
      }),
    });
    expect(compiled.status, await compiled.clone().text()).toBe(201);
    const compiledBody = await compiled.json<{
      project: { version: number };
      build: { id: string };
    }>();
    const roomResponse = await SELF.fetch(
      `${mount}/api/builds/${compiledBody.build.id}/sessions`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ seed: 42, idempotencyKey: "public-mount-room" }),
      },
    );
    expect(roomResponse.status, await roomResponse.clone().text()).toBe(201);
    const room = await roomResponse.json<{ id: string; sessionUrl: string }>();
    expect(new URL(room.sessionUrl).pathname).toBe(`/chatgpt-plugin/room/${room.id}`);
    const published = await SELF.fetch(`${mount}/api/projects/${project.id}/changes`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        expectedVersion: compiledBody.project.version,
        idempotencyKey: "public-mount-publish",
        operations: [{ op: "publish_shared_session", sessionId: room.id }],
      }),
    });
    expect(published.status, await published.clone().text()).toBe(200);
    const link = await SELF.fetch(
      `${mount}/api/projects/${project.id}?view=playtest-link`,
      { headers },
    ).then((response) => response.json<{ playtestLink: { url: string } }>());
    expect(new URL(link.playtestLink.url).pathname).toBe(
      `/chatgpt-plugin/try/${project.id}`,
    );
    const redirect = await SELF.fetch(link.playtestLink.url, { redirect: "manual" });
    expect(redirect.status).toBe(302);
    const joined = new URL(redirect.headers.get("location")!);
    expect(joined.pathname).toBe(`/chatgpt-plugin/room/${room.id}`);
    const share = joined.searchParams.get("share");
    expect(share).toBeTruthy();
    const friendSeat = await SELF.fetch(
      `${mount}/api/sessions/${room.id}/seats?share=${encodeURIComponent(share!)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ seat: 0, displayName: "朋友" }),
      },
    );
    expect(friendSeat.status, await friendSeat.clone().text()).toBe(200);
    const seated = await friendSeat.json<{ seatToken: string }>();
    const played = await SELF.fetch(
      `${mount}/api/sessions/${room.id}/intents?share=${encodeURIComponent(share!)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          intentId: "public-mount-friend-turn",
          seat: 0,
          seatToken: seated.seatToken,
          actionId: "extend",
          payload: { text: "朋友接上一句共同创意。" },
        }),
      },
    );
    expect(played.status, await played.clone().text()).toBe(200);
  });

  it("challenges Codex at the Access-open MCP mount", async () => {
    const response = await SELF.fetch("https://godesk.example/chatgpt-plugin/mcp");
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain(
      "oauth-protected-resource/chatgpt-plugin/mcp",
    );
    const metadata = await SELF.fetch(
      "https://godesk.example/.well-known/oauth-protected-resource/chatgpt-plugin/mcp",
    );
    expect(metadata.status).toBe(200);
    await expect(metadata.json()).resolves.toMatchObject({
      resource: "https://godesk.example/chatgpt-plugin/mcp",
      scopes_supported: ["godesk:read", "godesk:write"],
    });
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

});
