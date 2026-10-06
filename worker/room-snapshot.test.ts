/**
 * G3D-04c: incremental Room kernel state. The Room DO caches the current
 * kernel state in memory and persists a state snapshot every
 * SESSION_SNAPSHOT_EVERY actions; a move applies only the new action and a
 * DO restart rebuilds from the latest snapshot + tail. The Executable Kernel
 * stays the sole authority: snapshot + tail must equal a full replay.
 */
import { env, evictDurableObject, runInDurableObject, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { BASELINE_PROMPTS } from "../src/creator/fixtures/game-spec";
import type { GameProject, GenerationPlan, RuleSystem } from "../src/creator/project-contract";
import {
  normalizedBuild,
  reconstructSession,
  SESSION_SNAPSHOT_EVERY,
  sessionSnapshotKey,
  slimAcceptedActionsForStorage,
  type SessionStateSnapshot,
  type StoredPlayableBuild,
} from "./project-operations";
import type { StoredSharedSession } from "./public-urls";
import { runBotSimulation } from "./runtime";

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
  const { project } = await (await post("/api/projects", { name: `Snapshot ${key}` })).json<{ project: GameProject }>();
  const queued = await (await post(`/api/projects/${project.id}/jobs`, {
    kind: "generate-rule-system",
    expectedVersion: project.version,
    idea: BASELINE_PROMPTS[0],
    idempotencyKey: `snap-gen-${key}`,
  })).json<{ id: string }>();
  expect((await waitForJob(queued.id)).status).toBe("succeeded");
  const { generationPlan } = await (await SELF.fetch(
    `${origin}/api/projects/${project.id}?view=generation-plan`,
    { headers: devHeaders() },
  )).json<{ generationPlan: GenerationPlan }>();
  const approved = await (await post(`/api/projects/${project.id}/changes`, {
    expectedVersion: 2,
    idempotencyKey: `snap-approve-${key}`,
    operations: [
      { op: "approve_generation_plan", planId: generationPlan.id },
      generationPlan.proposedRuntime as NonNullable<typeof generationPlan.proposedRuntime>,
    ],
  })).json<{ project: GameProject; ruleSystem: RuleSystem }>();
  const built = await post(`/api/projects/${project.id}/builds`, {
    expectedVersion: approved.project.version,
    idempotencyKey: `snap-build-${key}`,
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

/** Order-independent JSON so equal states hash equally. */
function stableJson(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`).join(",")}}`;
}
async function stateHash(value: unknown) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stableJson(value)));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function storedBuild(buildId: string) {
  return runInDurableObject(stub(), async (_instance, state) =>
    normalizedBuild((await state.storage.get<StoredPlayableBuild>(`build:${buildId}`))!));
}
async function storedRoom(roomId: string) {
  return runInDurableObject(stub(), async (_instance, state) => ({
    room: (await state.storage.get<StoredSharedSession>(`session:${roomId}`))!,
    snapshot: await state.storage.get<SessionStateSnapshot>(sessionSnapshotKey(roomId)),
  }));
}

beforeEach(() => {
  creator = `snap-${crypto.randomUUID()}`;
});

describe("Room incremental kernel state (G3D-04c)", () => {
  it("snapshot + tail replay equals full replay (state hash) over the full seed-42 game", async () => {
    const { build: created, ruleSystem } = await catanBuild("hash");
    const build = await storedBuild(created.id);
    const simulation = runBotSimulation(ruleSystem, 42);
    const total = simulation.acceptedActions.length;
    expect(total).toBeGreaterThan(800);
    const finalState = simulation.acceptedActions[total - 1].state;
    expect(finalState.status).toBe("complete");
    const log = slimAcceptedActionsForStorage(simulation.acceptedActions);
    const session = { seed: 42, state: finalState, acceptedActions: log } as unknown as StoredSharedSession;

    const full = reconstructSession(session, build);
    const fullHash = await stateHash(full.state);
    expect(fullHash).toBe(await stateHash(finalState));

    for (const count of [SESSION_SNAPSHOT_EVERY, 400, Math.floor(total / SESSION_SNAPSHOT_EVERY) * SESSION_SNAPSHOT_EVERY]) {
      // The snapshot is itself produced by the kernel (replay of the prefix).
      const prefix = reconstructSession({ ...session, acceptedActions: log.slice(0, count) }, build);
      const snapshot: SessionStateSnapshot = { count, lastIntentId: log[count - 1].intentId, state: prefix.state };
      const viaSnapshot = reconstructSession(session, build, snapshot);
      expect(await stateHash(viaSnapshot.state), `snapshot@${count}`).toBe(fullHash);
      expect(viaSnapshot.acceptedActions.map((action) => [action.sequence, action.intentId]))
        .toEqual(full.acceptedActions.map((action) => [action.sequence, action.intentId]));
    }

    // A snapshot that does not match the log is ignored (full replay wins).
    const bogus: SessionStateSnapshot = { count: 400, lastIntentId: "not-in-log", state: simulation.acceptedActions[10].state };
    expect(await stateHash(reconstructSession(session, build, bogus).state)).toBe(fullHash);
  }, 180_000);

  it("survives DO restarts mid-game: rebuilds from snapshot + tail and finishes equal to the simulation", async () => {
    const { build, ruleSystem } = await catanBuild("restart");
    const simulation = runBotSimulation(ruleSystem, 42);
    const room = await (await createRoom(build.id, {})).json<{ id: string }>();
    const tokens = [(await claimSeat(room.id, 0)).seatToken!, (await claimSeat(room.id, 1)).seatToken!];
    const restartAt = new Set([120, 437, 801]);
    for (const [index, action] of simulation.acceptedActions.entries()) {
      if (restartAt.has(index)) {
        const before = await storedRoom(room.id);
        expect(before.room.acceptedActions).toHaveLength(index);
        const expectedSnapshot = Math.floor(index / SESSION_SNAPSHOT_EVERY) * SESSION_SNAPSHOT_EVERY;
        expect(before.snapshot?.count).toBe(expectedSnapshot);
        expect(before.snapshot?.lastIntentId).toBe(simulation.acceptedActions[expectedSnapshot - 1].intentId);
        expect(await stateHash(before.snapshot?.state))
          .toBe(await stateHash(simulation.acceptedActions[expectedSnapshot - 1].state));
        await evictDurableObject(stub());
      }
      const response = await post(`/api/sessions/${room.id}/intents`, {
        intentId: action.intentId,
        seat: action.seat,
        seatToken: tokens[action.seat],
        actionId: action.actionId,
        payload: action.payload,
      });
      expect(response.status, `action ${index}`).toBe(200);
    }
    const total = simulation.acceptedActions.length;
    const finalState = simulation.acceptedActions[total - 1].state;
    const after = await storedRoom(room.id);
    expect(after.room.acceptedActions).toHaveLength(total);
    expect(after.room.state.status).toBe("complete");
    expect(await stateHash(after.room.state)).toBe(await stateHash(finalState));
    // The authoritative read after a final restart agrees too.
    await evictDurableObject(stub());
    const session = await (await SELF.fetch(`${origin}/api/sessions/${room.id}`, { headers: devHeaders() }))
      .json<{ acceptedActions: unknown[]; state: { status: string; winnerSeat: number | null } }>();
    expect(session.acceptedActions).toHaveLength(total);
    expect(session.state.status).toBe("complete");
    expect(session.state.winnerSeat).toBe(finalState.winnerSeat);
  }, 300_000);
});
