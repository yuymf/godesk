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
  defaultFreightContent,
  defaultTicketsContent,
  ideaRequestsFreightLogistics,
  ideaRequestsTicketsRoute,
  parseFreightTuningFromIdea,
  type NetworkRouteGenre,
} from "./network-route";
import { readFileSync } from "node:fs";

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

  it("creates fixed graph without hex-island/Othello fields on the public envelope", () => {
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

describe("network-route-v1 freight subset (T006)", () => {
  const freightConfig = createNetworkRouteKernelConfig({
    content: defaultFreightContent({ winReputation: 3, startingFunds: 20 }),
  });

  it("starts with funds, reputation, ships, and a 3-card market", () => {
    const state = createInitialState(networkRouteAdapter, freightConfig, 11);
    expect(state.genre.freight).not.toBeNull();
    const f = state.genre.freight!;
    expect(f.funds).toEqual([20, 20]);
    expect(f.reputation).toEqual([0, 0]);
    expect(f.shipIds[0]).toEqual(["barge"]);
    expect(f.market).toHaveLength(3);
    expect(f.winReputation).toBe(3);
  });

  it("accepts a contract into hand then claims toward delivery", () => {
    let state = createInitialState(networkRouteAdapter, freightConfig, 5);
    const market0 = state.genre.freight!.market[0]!;
    const accept = applyAction(
      networkRouteAdapter,
      state,
      {
        type: "accept_contract",
        playerId: 0,
        payload: { instanceId: market0.instanceId },
      },
      freightConfig,
    );
    expect(accept.ok).toBe(true);
    if (!accept.ok) return;
    state = accept.state;
    expect(state.genre.freight!.hand[0]).toHaveLength(1);
    expect(state.activePlayerId).toBe(1);

    // seat 1 also accepts something / or claims
    const legal1 = listLegalActions(networkRouteAdapter, state, 1, freightConfig);
    expect(legal1.length).toBeGreaterThan(0);
    const act1 = legal1.find((a) => a.type === "claim") ?? legal1[0]!;
    const r1 = applyAction(
      networkRouteAdapter,
      state,
      { type: act1.type, playerId: 1, payload: act1.payload },
      freightConfig,
    );
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    state = r1.state;
  });

  it("delivers when claims connect contract endpoints and can win on reputation", () => {
    // Force a short contract A→B (direct edge) via custom content
    const content = defaultFreightContent({
      winReputation: 1,
      startingFunds: 50,
      contracts: [
        {
          id: "c_ab",
          name: "短途·北港→西岭",
          from: "A",
          to: "B",
          reward: 5,
          reputation: 1,
          kind: "普通货",
        },
      ],
      edgeTolls: {},
    });
    const cfg = createNetworkRouteKernelConfig({ content });
    let state = createInitialState(networkRouteAdapter, cfg, 1);
    const inst = state.genre.freight!.market[0]!;
    const a0 = applyAction(
      networkRouteAdapter,
      state,
      { type: "accept_contract", playerId: 0, payload: { instanceId: inst.instanceId } },
      cfg,
    );
    expect(a0.ok).toBe(true);
    if (!a0.ok) return;
    state = a0.state;
    // seat1 claims distractor
    const a1 = applyAction(
      networkRouteAdapter,
      state,
      { type: "claim", playerId: 1, payload: { edgeId: "E|F" } },
      cfg,
    );
    expect(a1.ok).toBe(true);
    if (!a1.ok) return;
    state = a1.state;
    const deliver = applyAction(
      networkRouteAdapter,
      state,
      { type: "claim", playerId: 0, payload: { edgeId: "A|B" } },
      cfg,
    );
    expect(deliver.ok).toBe(true);
    if (!deliver.ok) return;
    state = deliver.state;
    expect(state.genre.freight!.reputation[0]).toBeGreaterThanOrEqual(1);
    expect(state.genre.freight!.lastDelivery?.contractId).toBe("c_ab");
    expect(state.status).toBe("complete");
    expect(state.winnerId).toBe(0);
  });

  it("freight auto-play terminates without illegal actions", () => {
    const cfg = createNetworkRouteKernelConfig({
      content: defaultFreightContent({ winReputation: 4 }),
    });
    const { state, actions } = autoPlayNetworkRouteGame(77, cfg);
    expect(actions.length).toBeGreaterThan(0);
    expect(["active", "complete"]).toContain(state.status);
  });
});


describe("freight cues for H02", () => {
  it("detects logistics freight from H02 INPUT", () => {
    const idea = readFileSync(
      "docs/hardness/suites/_archive-fictional/H02-starport-convoy/INPUT.md",
      "utf8",
    );
    expect(ideaRequestsFreightLogistics(idea)).toBe(true);
    const tuning = parseFreightTuningFromIdea(idea);
    expect(tuning.winReputation).toBe(10);
    expect(tuning.startingFunds).toBe(20);
    const content = defaultFreightContent(tuning);
    expect(content.ships.map((s) => s.name)).toEqual([
      "驳船",
      "快艇",
      "武装商船",
      "巨型矿驳",
    ]);
    expect(content.contracts.length).toBeGreaterThanOrEqual(8);
  });
});

describe("network-route tickets subset (T016)", () => {
  it("detects tickets cues from H02 rail rulebook without freight", () => {
    const idea = readFileSync(
      "docs/hardness/suites/H02-ticket-to-ride/INPUT.md",
      "utf8",
    );
    expect(ideaRequestsTicketsRoute(idea)).toBe(true);
    expect(ideaRequestsFreightLogistics(idea)).toBe(false);
  });

  it("deals destination tickets and train hands", () => {
    const cfg = createNetworkRouteKernelConfig({
      tickets: true,
      ticketsContent: defaultTicketsContent(),
    });
    const state = createInitialState(networkRouteAdapter, cfg, 7);
    expect(state.genre.tickets).not.toBeNull();
    const t = state.genre.tickets!;
    expect(t.ticketHand[0].length).toBe(2);
    expect(t.ticketHand[1].length).toBe(2);
    expect(Object.values(t.trainHand[0]).reduce((a, b) => a + b, 0)).toBe(4);
    expect(t.faceUp.length).toBe(5);
    expect(Object.keys(t.edgeMeta).length).toBe(DEFAULT_NETWORK_EDGES.length);
  });

  it("claims a colored route by paying length with scoring table", () => {
    const cfg = createNetworkRouteKernelConfig({
      tickets: true,
      ticketsContent: defaultTicketsContent({
        startingTrainCards: 0,
        startingTrains: 45,
      }),
    });
    let state = createInitialState(networkRouteAdapter, cfg, 11);
    // Force a known hand: give seat0 enough red + wild for a red or gray edge
    const tickets = state.genre.tickets!;
    const edgeId = DEFAULT_NETWORK_EDGES[0]!.id; // A|B
    const meta = tickets.edgeMeta[edgeId]!;
    const payColor = meta.color === "gray" ? "red" : (meta.color as "red");
    const hand0 = {
      red: 0,
      orange: 0,
      yellow: 0,
      green: 0,
      blue: 0,
      purple: 0,
      black: 0,
      white: 0,
      wild: 0,
    } as typeof tickets.trainHand[0];
    hand0[payColor] = meta.length;
    tickets.trainHand[0] = hand0;
    state = {
      ...state,
      genre: { ...state.genre, tickets: { ...tickets, trainHand: [tickets.trainHand[0], tickets.trainHand[1]] } },
    };
    const pts = tickets.lengthScores[meta.length] ?? meta.length;
    const result = applyAction(
      networkRouteAdapter,
      state,
      {
        type: "claim",
        playerId: 0,
        payload: { edgeId, payColor },
      },
      cfg,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.genre.claims[edgeId]).toBe(0);
    expect(result.state.genre.tickets!.routeScore[0]).toBe(pts);
    expect(result.state.genre.tickets!.trainsLeft[0]).toBe(45 - meta.length);
  });

  it("draw_trains and draw_tickets are legal and advance turn", () => {
    const cfg = createNetworkRouteKernelConfig({ tickets: true });
    let state = createInitialState(networkRouteAdapter, cfg, 3);
    const parsed = networkRouteAdapter.parseConfig(cfg.adapter)!;
    const legal = networkRouteAdapter.listLegalActions(state, 0, parsed);
    expect(legal.some((a) => a.type === "draw_trains")).toBe(true);
    const drawn = applyAction(
      networkRouteAdapter,
      state,
      { type: "draw_trains", playerId: 0, payload: {} },
      cfg,
    );
    expect(drawn.ok).toBe(true);
    if (!drawn.ok) return;
    state = drawn.state;
    expect(state.activePlayerId).toBe(1);
  });

  it("auto-play tickets game terminates", () => {
    const cfg = createNetworkRouteKernelConfig({
      tickets: true,
      ticketsContent: defaultTicketsContent({ startingTrains: 8 }),
    });
    const { state, actions } = autoPlayNetworkRouteGame(99, cfg);
    expect(actions.length).toBeGreaterThan(0);
    expect(["active", "complete"]).toContain(state.status);
  });
});
