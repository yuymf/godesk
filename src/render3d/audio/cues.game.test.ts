import { describe, expect, it } from "vitest";
import { applyAction, createInitialState } from "../../runtime/play-kernel";
import { autoPlayHexIslandGame, hexIslandAdapter, hexIslandToSessionFields, createHexIslandKernelConfig } from "../../runtime/adapters/hex-island";
import { CUE_IDS, cuesForRoomDelta, type AudioRoomSnapshot, type AudioSessionState, type CueId } from "./cues";

/**
 * G3D-10：用真实六角岛 Kernel 自动对局到终局，逐步把「房间快照」喂给 cuesForRoomDelta，
 * 断言整局下来对局事件推导出的 cue 覆盖 §3.6 表中所有由 PlayEvent 触发的 cue。
 * （hover / select / illegal / panel / toggle 来自 UI，见 e2e/room-audio.spec.ts。）
 */
const UI_CUES: ReadonlySet<CueId> = new Set<CueId>(["hover", "select", "illegal", "toggle"]);

function playGame(seed: number) {
  const config = createHexIslandKernelConfig();
  const { actions } = autoPlayHexIslandGame(seed, config);
  let state = createInitialState(hexIslandAdapter, config, seed);
  const toSession = (s: typeof state): AudioSessionState => {
    const fields = hexIslandToSessionFields(s);
    return { status: fields.status, winnerSeat: fields.winnerSeat, hexIsland: { players: fields.hexIsland.players } };
  };
  const snapshots: AudioRoomSnapshot[] = [{ state: toSession(state), acceptedActions: [] }];
  const accepted: AudioRoomSnapshot["acceptedActions"][number][] = [];
  actions.forEach((action, index) => {
    const result = applyAction(hexIslandAdapter, state, action, config);
    if (!result.ok) throw new Error(`replay rejected ${action.type}`);
    state = result.state;
    const session = toSession(state);
    accepted.push({ sequence: index + 1, seat: action.playerId, actionId: action.type, payload: action.payload, state: session });
    // cuesForRoomDelta 只看 prev 的最后一条与 next 中更新的序号，所以每份快照只带本步动作即可。
    snapshots.push({ state: session, acceptedActions: [accepted[accepted.length - 1]] });
  });
  return { snapshots, winner: state.winnerId };
}

function cuesFor(snapshots: AudioRoomSnapshot[], seat: number) {
  const cues = [];
  for (let i = 1; i < snapshots.length; i += 1) cues.push(...cuesForRoomDelta(snapshots[i - 1], snapshots[i], seat));
  return cues;
}

describe("cues over full auto-played hex-settlement games", () => {
  it("covers every PlayEvent-driven cue, with win for the winner and lose for the other seat", () => {
    const seen = new Set<CueId>();
    const gainResources = new Set<string>();
    const tradeKinds = new Set<string>();
    for (const seed of [1, 2]) {
      const { snapshots, winner } = playGame(seed);
      expect(winner).not.toBeNull();
      for (const seat of [0, 1]) {
        const cues = cuesFor(snapshots, seat);
        for (const cue of cues) {
          seen.add(cue.cue);
          if (cue.resource) gainResources.add(cue.resource);
          if (cue.tradeKind) tradeKinds.add(cue.tradeKind);
        }
        const ending = cues.filter((cue) => cue.source === "ended");
        expect(ending).toHaveLength(1);
        expect(ending[0].cue).toBe(seat === winner ? "win" : "lose");
      }
    }
    const expected = CUE_IDS.filter((cue) => !UI_CUES.has(cue));
    expect([...seen].sort()).toEqual(expect.arrayContaining(expected));
    expect(gainResources.size).toBe(5);
    expect(tradeKinds.has("bank")).toBe(true);
  }, 60_000);
});
