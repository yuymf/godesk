/**
 * G3D-04b: Room AI seat — the DO alarm drives `aiSeats` with the same bot
 * picker as runBotSimulation, through acceptIntent only, exactly once.
 */
import {
  env,
  evictDurableObject,
  runDurableObjectAlarm,
  runInDurableObject,
  SELF,
} from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { BASELINE_PROMPTS } from "../src/creator/fixtures/game-spec";
import type { GameProject, GenerationPlan, RuleSystem } from "../src/creator/project-contract";
import {
  normalizedBuild,
  reconstructSession,
  type StoredPlayableBuild,
} from "./project-operations";
import type { StoredSharedSession } from "./public-urls";
import { aiTurnKey, normalizeAiSeats, type AiPendingTurn } from "./room-ai";
import { executableRuntime, pickBotIntent, runBotSimulation } from "./runtime";

const origin = "https://godesk.test";
/** Each test gets its own Creator DO so eviction never races other tests. */
let creator = "local-creator";
const devHeaders = () => ({ "x-godesk-dev-creator": creator });
const post = (path: string, body: unknown) =>
  SELF.fetch(`${origin}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...devHeaders() },
    body: JSON.stringify(body),
  });
async function claimSeat(roomId: string, seat: number) {
  const response = await post(`/api/sessions/${roomId}/seats`, { seat });
  const body = await response.json<{ seatToken?: string; error?: string }>();
  return { status: response.status, seatToken: body.seatToken, error: body.error };
}
async function waitForJob(id: string) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const job = await SELF.fetch(`${origin}/api/jobs/${id}`, { headers: devHeaders() })
      .then((response) => response.json<{ status: string; error?: string }>());
    if (job.status === "succeeded" || job.status === "failed") return job;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`job ${id} did not finish`);
}

async function catanBuild(key: string) {
  const { project } = await (await post("/api/projects", { name: `AI seat ${key}` })).json<{ project: GameProject }>();
  const queued = await (await post(`/api/projects/${project.id}/jobs`, {
    kind: "generate-rule-system",
    expectedVersion: project.version,
    idea: BASELINE_PROMPTS[0],
    idempotencyKey: `ai-seat-gen-${key}`,
  })).json<{ id: string }>();
  expect((await waitForJob(queued.id)).status).toBe("succeeded");
  const { generationPlan } = await (await SELF.fetch(
    `${origin}/api/projects/${project.id}?view=generation-plan`,
    { headers: devHeaders() },
  )).json<{ generationPlan: GenerationPlan }>();
  const approved = await (await post(`/api/projects/${project.id}/changes`, {
    expectedVersion: 2,
    idempotencyKey: `ai-seat-approve-${key}`,
    operations: [
      { op: "approve_generation_plan", planId: generationPlan.id },
      generationPlan.proposedRuntime as NonNullable<typeof generationPlan.proposedRuntime>,
    ],
  })).json<{ project: GameProject; ruleSystem: RuleSystem }>();
  const built = await post(`/api/projects/${project.id}/builds`, {
    expectedVersion: approved.project.version,
    idempotencyKey: `ai-seat-build-${key}`,
  });
  expect([200, 201]).toContain(built.status);
  const { build } = await built.json<{ build: { id: string } }>();
  return { build, ruleSystem: approved.ruleSystem };
}

async function createRoom(buildId: string, body: Record<string, unknown>) {
  return post(`/api/builds/${buildId}/sessions`, {
    seed: 42,
    idempotencyKey: crypto.randomUUID(),
    ...body,
  });
}

const stubs = new Map<string, DurableObjectStub>();
const stub = () => {
  let found = stubs.get(creator);
  if (!found) {
    found = env.CREATOR_PROJECTS.getByName(creator);
    stubs.set(creator, found);
  }
  return found;
};

/** Authoritative (unscoped) room as the DO stores it (state is full; the
 *  action log is slim). `reconstruct` replays the log through the kernel. */
async function readRoom(roomId: string, reconstruct = false) {
  return runInDurableObject(stub(), async (_instance, state) => {
    const room = (await state.storage.get<StoredSharedSession>(`session:${roomId}`))!;
    const build = normalizedBuild(
      (await state.storage.get<StoredPlayableBuild>(`build:${room.buildId}`))!,
    );
    const pending = await state.storage.get<AiPendingTurn>(aiTurnKey(roomId));
    return {
      room: reconstruct ? reconstructSession(room, build) : room,
      pending,
      ruleSystem: build.ruleSystem,
    };
  });
}

/** Pull a pending AI turn's dueAt to now and fire the alarm manually
 *  (rooms in this test use a long think delay so nothing fires on its own). */
async function fireAiNow(roomId: string) {
  await runInDurableObject(stub(), async (_instance, state) => {
    const pending = await state.storage.get<AiPendingTurn>(aiTurnKey(roomId));
    if (pending) await state.storage.put(aiTurnKey(roomId), { ...pending, dueAt: Date.now() });
    await state.storage.setAlarm(Date.now() + 60_000);
  });
  return runDurableObjectAlarm(stub());
}

async function humanMove(roomId: string, seatToken: string) {
  const { room, ruleSystem } = await readRoom(roomId);
  const picked = pickBotIntent(room.state, executableRuntime(ruleSystem)!, room.seed)!;
  expect(picked.seat).toBe(0);
  const response = await post(`/api/sessions/${roomId}/intents`, {
    intentId: `human_${room.acceptedActions.length + 1}`,
    seat: 0,
    seatToken,
    actionId: picked.actionId,
    payload: picked.payload,
  });
  expect(response.status, await response.clone().text()).toBe(200);
}

describe("Room AI seat (G3D-04b)", () => {
  beforeEach(() => {
    creator = `ai-seat-${crypto.randomUUID()}`;
  });

  it("validates aiSeats", () => {
    expect(normalizeAiSeats(undefined, 2)).toEqual([]);
    expect(normalizeAiSeats([1, 1], 2)).toEqual([1]);
    expect(normalizeAiSeats([0, 1], 2)).toBeNull();
    expect(normalizeAiSeats([2], 2)).toBeNull();
    expect(normalizeAiSeats(["1"], 2)).toBeNull();
  });

  it("rejects bad options, AI seat claims and human intents on the AI seat", async () => {
    const { build } = await catanBuild("guards");
    expect((await createRoom(build.id, { aiSeats: [0, 1] })).status).toBe(400);
    expect((await createRoom(build.id, { aiSeats: [1], aiThinkMs: 99_999 })).status).toBe(400);
    const created = await createRoom(build.id, { aiSeats: [1], aiThinkMs: 0 });
    expect(created.status).toBe(201);
    const room = await created.json<{ id: string; aiSeats: number[]; aiThinkMs: number }>();
    expect(room).toMatchObject({ aiSeats: [1], aiThinkMs: 0 });
    expect(await claimSeat(room.id, 1)).toMatchObject({ status: 409, error: "seat_is_ai" });
    const human = await claimSeat(room.id, 0);
    expect(human.status).toBe(200);
    const forged = await post(`/api/sessions/${room.id}/intents`, {
      intentId: "forged", seat: 1, seatToken: human.seatToken, actionId: "end_turn",
    });
    expect(forged.status).toBe(409);
    expect(await forged.json()).toMatchObject({ error: "seat_is_ai" });
    // Human seat opens; no AI turn is pending yet.
    expect((await readRoom(room.id)).pending).toBeUndefined();
  });

  it("takes its setup turns from the alarm exactly once, across eviction and duplicate alarms", async () => {
    const { build } = await catanBuild("setup");
    const room = await (await createRoom(build.id, { aiSeats: [1], aiThinkMs: 5_000 })).json<{ id: string }>();
    const { seatToken } = await claimSeat(room.id, 0);
    // Snake setup for 2 seats: 0 (settlement, road), 1, 1, 0.
    await humanMove(room.id, seatToken!);
    await humanMove(room.id, seatToken!);
    let snapshot = await readRoom(room.id);
    expect(snapshot.room.state.activeSeat).toBe(1);
    expect(snapshot.pending).toMatchObject({ expectedActions: 2 });
    const stalePending = snapshot.pending!;

    // DO restart before the alarm fires: the pending turn is durable.
    await evictDurableObject(stub());
    expect(await fireAiNow(room.id)).toBe(true);
    snapshot = await readRoom(room.id);
    expect(snapshot.room.acceptedActions).toHaveLength(3);
    expect(snapshot.room.acceptedActions[2]).toMatchObject({ seat: 1, intentId: "ai_3" });

    // A duplicate/stale alarm for the same turn must not double-move.
    await runInDurableObject(stub(), async (_instance, state) => {
      await state.storage.put(aiTurnKey(room.id), { ...stalePending, dueAt: Date.now() });
      await state.storage.setAlarm(Date.now() + 60_000);
    });
    expect(await runDurableObjectAlarm(stub())).toBe(true);
    snapshot = await readRoom(room.id);
    expect(snapshot.room.acceptedActions).toHaveLength(3);
    // …and the stale record was re-derived for the real next AI step.
    expect(snapshot.pending).toMatchObject({ expectedActions: 3 });

    for (let step = 0; step < 6 && snapshot.room.state.activeSeat === 1; step += 1) {
      await fireAiNow(room.id);
      snapshot = await readRoom(room.id);
    }
    const aiActions = snapshot.room.acceptedActions.filter((action) => action.seat === 1);
    expect(aiActions.map((action) => action.actionId)).toEqual([
      "place_settlement", "place_road", "place_settlement", "place_road",
    ]);
    expect(snapshot.room.state.activeSeat).toBe(0);
    expect(snapshot.pending).toBeUndefined();
    // Reconnect heal never schedules while the human is up.
    const sessions = new Set(snapshot.room.acceptedActions.map((action) => action.intentId));
    expect(sessions.size).toBe(snapshot.room.acceptedActions.length);
  }, 60_000);

  it("plays a full game on real alarms vs a scripted human to game over, matching the bot simulation picker", async () => {
    const { build, ruleSystem } = await catanBuild("full");
    // Full-length seed 42 (~865 actions): fits CI since G3D-04c made each
    // move incremental (memory cache + snapshots) instead of a full replay.
    const room = await (await createRoom(build.id, { seed: 42, aiSeats: [1], aiThinkMs: 0 })).json<{ id: string }>();
    const { seatToken } = await claimSeat(room.id, 0);
    let snapshot = await readRoom(room.id);
    for (let guard = 0; guard < 40_000 && snapshot.room.state.status === "active"; guard += 1) {
      if (snapshot.room.state.activeSeat === 0) {
        await humanMove(room.id, seatToken!);
      } else {
        // Real DO alarms (think delay 0) drive the AI seat; just wait.
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      snapshot = await readRoom(room.id);
    }
    snapshot = await readRoom(room.id, true);
    expect(snapshot.room.state.status).toBe("complete");
    expect(snapshot.room.state.winnerSeat).not.toBeNull();
    expect(snapshot.pending).toBeUndefined();
    const actions = snapshot.room.acceptedActions;
    for (const action of actions.filter((entry) => entry.seat === 1)) {
      expect(action.intentId).toBe(`ai_${action.sequence}`);
    }
    // Same picker as runBotSimulation (no parallel engine): with both seats
    // driven by pickBotIntent the Room log equals the simulation log.
    const simulation = runBotSimulation(ruleSystem, 42);
    expect(actions.map((action) => [action.seat, action.actionId, action.payload ?? null]))
      .toEqual(simulation.acceptedActions.map((action) => [action.seat, action.actionId, action.payload ?? null]));
    const aiKinds = new Set(actions.filter((entry) => entry.seat === 1).map((entry) => entry.actionId));
    expect(aiKinds.has("roll_dice")).toBe(true);
    expect(aiKinds.has("end_turn")).toBe(true);
  }, 420_000);
});
