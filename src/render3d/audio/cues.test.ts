import { describe, expect, it } from "vitest";
import {
  ACTION_CUES,
  CORE_SPRITE_CUES,
  CUE_IDS,
  DEFAULT_CUE_FRAGMENTS,
  cuesForRoomDelta,
  pickVariantIndex,
  type AudioRoomSnapshot,
  type AudioSessionState,
} from "./cues";

const res = (wood = 0, brick = 0, sheep = 0, wheat = 0, ore = 0) => ({ wood, brick, sheep, wheat, ore });

function state(players: ReturnType<typeof res>[], status: "active" | "complete" = "active", winnerSeat: number | null = null): AudioSessionState {
  return { status, winnerSeat, hexIsland: { players: players.map((resources) => ({ resources })) } };
}

function room(s: AudioSessionState, actions: AudioRoomSnapshot["acceptedActions"] = []): AudioRoomSnapshot {
  return { state: s, acceptedActions: actions };
}

describe("cue tables", () => {
  it("covers 16 cues with 30 fragments split 15 core / 15 extended (§4.8)", () => {
    expect(CUE_IDS).toHaveLength(16);
    const all = CUE_IDS.flatMap((cue) => DEFAULT_CUE_FRAGMENTS[cue]);
    expect(all).toHaveLength(30);
    expect(new Set(all).size).toBe(30);
    const core = CUE_IDS.filter((cue) => CORE_SPRITE_CUES.has(cue)).flatMap((cue) => DEFAULT_CUE_FRAGMENTS[cue]);
    expect(core).toHaveLength(15);
    for (const cue of CUE_IDS) expect(DEFAULT_CUE_FRAGMENTS[cue].length).toBeLessThanOrEqual(6);
  });

  it("maps every hex-settlement action type to a cue", () => {
    for (const type of ["place_settlement", "place_road", "place_city", "roll_dice", "move_robber", "play_knight",
      "play_road_building", "bank_trade", "player_trade", "buy_dev", "discard", "end_turn"]) {
      expect(ACTION_CUES[type], type).toBeDefined();
    }
  });
});

describe("pickVariantIndex", () => {
  it("gain uses the [wood, brick, sheep, wheat, ore] index", () => {
    expect(pickVariantIndex({ cue: "gain", resource: "wood", source: "t" }, 5)).toBe(0);
    expect(pickVariantIndex({ cue: "gain", resource: "ore", source: "t" }, 5)).toBe(4);
  });
  it("trade uses the [offer, accept, decline, bank] index", () => {
    expect(pickVariantIndex({ cue: "trade", tradeKind: "accept", source: "t" }, 4)).toBe(1);
    expect(pickVariantIndex({ cue: "trade", tradeKind: "bank", source: "t" }, 4)).toBe(3);
  });
  it("other cues pick randomly and fall back to 0 for single variants", () => {
    expect(pickVariantIndex({ cue: "dice", source: "t" }, 4, () => 0.99)).toBe(3);
    expect(pickVariantIndex({ cue: "dice", source: "t" }, 4, () => 0)).toBe(0);
    expect(pickVariantIndex({ cue: "win", source: "t" }, 1, () => 0.99)).toBe(0);
    expect(pickVariantIndex({ cue: "gain", resource: "ore", source: "t" }, 2)).toBe(0);
  });
});

describe("cuesForRoomDelta", () => {
  it("does not replay history on first snapshot", () => {
    const first = room(state([res(), res()]), [{ sequence: 1, seat: 0, actionId: "place_settlement", state: state([res(), res()]) }]);
    expect(cuesForRoomDelta(null, first, 0)).toEqual([]);
  });

  it("emits action cues in order and only for new sequences", () => {
    const s0 = state([res(), res()]);
    const prev = room(s0, [{ sequence: 1, seat: 0, actionId: "place_settlement", state: s0 }]);
    const next = room(s0, [
      ...prev.acceptedActions,
      { sequence: 2, seat: 0, actionId: "place_road", state: s0 },
      { sequence: 3, seat: 1, actionId: "place_city", state: s0 },
      { sequence: 4, seat: 1, actionId: "end_turn", state: s0 },
    ]);
    expect(cuesForRoomDelta(prev, next, 0).map((c) => c.cue)).toEqual(["road", "upgrade", "turn"]);
  });

  it("roll_dice → dice, then one gain per resource the viewer gained", () => {
    const before = state([res(1, 0, 0, 0, 0), res()]);
    const after = state([res(2, 0, 2, 0, 1), res(0, 5, 0, 0, 0)]);
    const cues = cuesForRoomDelta(room(before), room(after, [{ sequence: 5, seat: 1, actionId: "roll_dice", state: after }]), 0);
    expect(cues.map((c) => [c.cue, c.resource])).toEqual([
      ["dice", undefined],
      ["gain", "wood"],
      ["gain", "sheep"],
      ["gain", "ore"],
    ]);
  });

  it("move_robber adds steal when the mover's hand grew", () => {
    const before = state([res(), res(1)]);
    const after = state([res(1), res()]);
    const cues = cuesForRoomDelta(room(before), room(after, [{ sequence: 9, seat: 0, actionId: "move_robber", state: after }]), 1);
    expect(cues.map((c) => c.cue)).toEqual(["move", "steal"]);
  });

  it("trade variants: bank vs player", () => {
    const s = state([res(), res()]);
    const cues = cuesForRoomDelta(room(s), room(s, [
      { sequence: 1, seat: 0, actionId: "bank_trade", state: s },
      { sequence: 2, seat: 0, actionId: "player_trade", state: s },
    ]), 0);
    expect(cues.map((c) => c.tradeKind)).toEqual(["bank", "accept"]);
  });

  it("ended → win for the winner, lose for others, win for spectators", () => {
    const active = state([res(), res()]);
    const done = state([res(), res()], "complete", 1);
    expect(cuesForRoomDelta(room(active), room(done), 1).at(-1)?.cue).toBe("win");
    expect(cuesForRoomDelta(room(active), room(done), 0).at(-1)?.cue).toBe("lose");
    expect(cuesForRoomDelta(room(active), room(done), null).at(-1)?.cue).toBe("win");
    expect(cuesForRoomDelta(room(done), room(done), 1)).toEqual([]);
  });
});
