import { describe, expect, it } from "vitest";
import { executableAutoBattlerSpecFixture } from "../src/creator/fixtures/game-spec";
import { reconstructActions } from "./project-operations";
import { acceptIntent, executableRuntime, initialSessionState, runAtSessionTime } from "./runtime";
import type { StoredPlayableBuild } from "./public-urls";

describe("wall-clock kernels replay at logged acceptance time", () => {
  it("rebuilds the same prep deadlines as the live room (round-2 timer regression)", () => {
    const rule = executableAutoBattlerSpecFixture();
    const runtime = executableRuntime(rule)!;
    const start = 1_800_000_000_000;
    let state = runAtSessionTime(start, () => initialSessionState(rule, 42));
    const live = [] as NonNullable<ReturnType<typeof acceptIntent>>[];
    const steps: Array<[number, string]> = [[0, "ready_shop"], [1, "ready_shop"], [0, "ready_place"], [1, "ready_place"]];
    steps.forEach(([seat, actionId], i) => {
      const accepted = runAtSessionTime(start + (i + 1) * 5_000, () =>
        acceptIntent(state, runtime, { intentId: `i${i}`, seat, actionId }, i + 1, 42))!;
      expect(accepted.at).toBe(start + (i + 1) * 5_000);
      live.push(accepted);
      state = accepted.state;
    });
    expect(state.autoBattler?.round).toBe(2);
    const liveDeadline = state.autoBattler!.prepEndsAt!;
    expect(liveDeadline).toBe(start + 20_000 + 45_000);
    const build = { id: "b", projectId: "p", ruleSystem: rule } as StoredPlayableBuild;
    // Replaying "much later" must not move the deadline to now+45s.
    const rebuilt = runAtSessionTime(start + 600_000, () => reconstructActions(build, live, 42, start));
    expect(rebuilt.state.autoBattler?.prepEndsAt).toBe(liveDeadline);
  });
});

describe("legacy logs without `at`", () => {
  it("replay at the room start time instead of now (no spurious prep timeout)", () => {
    const rule = executableAutoBattlerSpecFixture();
    const runtime = executableRuntime(rule)!;
    const start = 1_800_000_000_000;
    const s0 = runAtSessionTime(start, () => initialSessionState(rule, 42));
    const a1 = runAtSessionTime(start + 1000, () => acceptIntent(s0, runtime, { intentId: "i0", seat: 0, actionId: "buy", payload: { shopIndex: 0 } }, 1, 42))!;
    const { at: _drop, ...legacy } = a1;
    void _drop;
    const build = { id: "b", projectId: "p", ruleSystem: rule } as StoredPlayableBuild;
    const rebuilt = runAtSessionTime(start + 3_600_000, () => reconstructActions(build, [legacy], 42, start));
    expect(rebuilt.state.autoBattler?.phase).toBe("shop");
  });
});

describe("server deadline timer action", () => {
  it("prep_timeout is rejected before the deadline, advances at it, and replays identically", async () => {
    const { PREP_TIMEOUT_ACTION, sessionDeadline } = await import("./runtime");
    const rule = executableAutoBattlerSpecFixture();
    const runtime = executableRuntime(rule)!;
    const start = 1_800_000_000_000;
    const s0 = runAtSessionTime(start, () => initialSessionState(rule, 42));
    const due = sessionDeadline(s0, runtime)!;
    expect(due).toBe(start + 45_000);
    const intent = { intentId: "timer_1", seat: s0.activeSeat, actionId: PREP_TIMEOUT_ACTION };
    expect(runAtSessionTime(due - 1, () => acceptIntent(s0, runtime, intent, 1, 42))).toBeNull();
    const fired = runAtSessionTime(due, () => acceptIntent(s0, runtime, intent, 1, 42))!;
    expect(fired.at).toBe(due);
    expect(fired.state.autoBattler?.phase).toBe("place");
    expect(sessionDeadline(fired.state, runtime)).toBe(due + 30_000);
    const build = { id: "b", projectId: "p", ruleSystem: rule } as StoredPlayableBuild;
    const rebuilt = runAtSessionTime(due + 999_999, () => reconstructActions(build, [fired], 42, start));
    expect(rebuilt.state).toEqual(fired.state);
  });
});
