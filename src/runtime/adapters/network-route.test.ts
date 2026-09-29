import { describe, expect, it } from "vitest";
import {
  applyAction,
  createInitialState,
  hashPlayState,
  listLegalActions,
  PUBLIC_LAYER_FORBIDDEN_REQUIRED_KEYS,
  replay,
  type PlayAction,
  type PlayState,
} from "../play-kernel";
import {
  KERNEL_CAPABILITIES,
  MECHANIC_CAPABILITIES,
} from "../../creator/kernel-capabilities";
import {
  autoPlayNetworkRouteGame,
  bindNetworkRouteFromRuntimeKernel,
  countClaims,
  createNetworkRouteKernelConfig,
  DEFAULT_NETWORK_EDGES,
  NETWORK_ROUTE_KERNEL_TYPE,
  NETWORK_ROUTE_TERMINALS,
  networkRouteAdapter,
  networkRouteGraphTopology,
  playerConnectsTerminals,
  type NetworkRouteGenre,
} from "./network-route";

const config = createNetworkRouteKernelConfig();

function snapshotBody(state: PlayState<NetworkRouteGenre>) {
  const { events: _events, ...rest } = state;
  return rest;
}

describe("network-route-v1 adapter", () => {
  it("registers network-route-v1 with the mechanics capability set", () => {
    expect(Object.hasOwn(KERNEL_CAPABILITIES, NETWORK_ROUTE_KERNEL_TYPE)).toBe(
      true,
    );
    expect(KERNEL_CAPABILITIES[NETWORK_ROUTE_KERNEL_TYPE]).toEqual(
      MECHANIC_CAPABILITIES["route-network"],
    );
  });

  it("creates fixed graph without Catan/Othello fields on the public envelope", () => {
    const state = createInitialState(networkRouteAdapter, config, 42);
    expect(state.seed).toBe(42);
    expect(state.phase).toBe("play");
    expect(state.activePlayerId).toBe(0);
    expect(state.genre.edges).toHaveLength(DEFAULT_NETWORK_EDGES.length);
    expect(state.genre.terminalFrom).toBe(NETWORK_ROUTE_TERMINALS[0]);
    expect(state.genre.terminalTo).toBe(NETWORK_ROUTE_TERMINALS[1]);
    expect(Object.values(state.genre.claims).every((c) => c === null)).toBe(
      true,
    );
    for (const key of PUBLIC_LAYER_FORBIDDEN_REQUIRED_KEYS) {
      expect(Object.hasOwn(state, key)).toBe(false);
    }
    expect(networkRouteGraphTopology().kind).toBe("graph");
  });

  it("lists only unclaimed edges as legal claims for the active seat", () => {
    const state = createInitialState(networkRouteAdapter, config, 1);
    const legal = listLegalActions(networkRouteAdapter, state, 0, config);
    expect(legal).toHaveLength(DEFAULT_NETWORK_EDGES.length);
    expect(legal.every((entry) => entry.type === "claim")).toBe(true);
    expect(listLegalActions(networkRouteAdapter, state, 1, config)).toEqual([]);
  });

  it("claims an edge and fails closed on illegal / already-claimed", () => {
    let state = createInitialState(networkRouteAdapter, config, 7);
    const edgeId = "A|B";
    const ok = applyAction(
      networkRouteAdapter,
      state,
      { type: "claim", playerId: 0, payload: { edgeId } },
      config,
    );
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    state = ok.state;
    expect(state.genre.claims[edgeId]).toBe(0);
    expect(state.activePlayerId).toBe(1);
    expect(state.genre.routeCounts).toEqual([1, 0]);
    expect(state.genre.lastClaim).toEqual({ edgeId, playerId: 0 });

    const again = applyAction(
      networkRouteAdapter,
      state,
      { type: "claim", playerId: 1, payload: { edgeId } },
      config,
    );
    expect(again.ok).toBe(false);
    if (again.ok) return;
    expect(again.state).toBe(state);
    expect(again.reason).toBe("illegal_action");

    const wrongSeat = applyAction(
      networkRouteAdapter,
      state,
      { type: "claim", playerId: 0, payload: { edgeId: "A|C" } },
      config,
    );
    expect(wrongSeat.ok).toBe(false);
  });

  it("wins when claimed edges connect terminals A–F", () => {
    // Short path A-B, B-D, D-F claimed by seat 0 on their turns
    // (seat 1 claims distractors in between).
    let state = createInitialState(networkRouteAdapter, config, 3);
    const sequence: PlayAction[] = [
      { type: "claim", playerId: 0, payload: { edgeId: "A|B" } },
      { type: "claim", playerId: 1, payload: { edgeId: "A|C" } },
      { type: "claim", playerId: 0, payload: { edgeId: "B|D" } },
      { type: "claim", playerId: 1, payload: { edgeId: "C|E" } },
      { type: "claim", playerId: 0, payload: { edgeId: "D|F" } },
    ];
    for (const action of sequence) {
      const result = applyAction(networkRouteAdapter, state, action, config);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      state = result.state;
    }
    expect(state.status).toBe("complete");
    expect(state.winnerId).toBe(0);
    expect(state.phase).toBe("ended");
    expect(
      playerConnectsTerminals(
        state.genre.claims,
        state.genre.edges,
        0,
        "A",
        "F",
      ),
    ).toBe(true);
    expect(countClaims(state.genre.claims)[0]).toBe(3);
  });

  it("seed replay matches terminal hash", () => {
    const { state, actions } = autoPlayNetworkRouteGame(99);
    const replayed = replay(networkRouteAdapter, config, 99, actions);
    expect(hashPlayState(replayed)).toBe(hashPlayState(state));
    expect(snapshotBody(replayed)).toEqual(snapshotBody(state));
  });

  it("bindNetworkRouteFromRuntimeKernel requires two players", () => {
    expect(bindNetworkRouteFromRuntimeKernel({}).kernelType).toBe(
      NETWORK_ROUTE_KERNEL_TYPE,
    );
    expect(() =>
      bindNetworkRouteFromRuntimeKernel({ playerCount: 3 }),
    ).toThrow(/two_players/);
  });
});
