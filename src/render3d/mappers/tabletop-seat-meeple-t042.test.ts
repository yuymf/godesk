import { describe, expect, it } from "vitest";
import { defaultRenderSpec } from "../../creator/render-spec";
import { mapTabletopToScene, type TabletopRenderInput } from "./tabletop";
import {
  auctionBiddingLayout,
  gemEngineLayout,
  networkRouteLayout,
  patternDraftLayout,
} from "./tabletop-kernels";
import { DEFAULT_NETWORK_CITIES, DEFAULT_NETWORK_EDGES } from "../../runtime/adapters/network-route";

function emptyWall() {
  return Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => null as string | null));
}

describe("T042 shared seat meeple", () => {
  it("gem / pattern / auction seat markers bind to meeple (not house)", () => {
    const gem = gemEngineLayout({
      bank: { white: 4, blue: 4, green: 4, red: 4, black: 4, gold: 5 },
      market: [[{ id: "t1a", discount: "white", prestige: 0 }], [], []],
      nobles: [],
      seats: [
        { prestige: 0, gems: { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 }, cards: [] },
        { prestige: 1, gems: { white: 1, blue: 0, green: 0, red: 0, black: 0, gold: 0 }, cards: [] },
      ],
    });
    expect(gem.pieces.filter((p) => /seat:\d+:marker/.test(p.id)).every((p) => p.objectKind === "worker")).toBe(true);

    const pattern = patternDraftLayout({
      factories: [["blue", "yellow", "red", "black"], ["white", "blue", "blue", "red"]],
      center: [],
      markerInCenter: true,
      seats: [
        {
          lines: [
            { color: null, tiles: [], capacity: 1 },
            { color: null, tiles: [], capacity: 2 },
            { color: null, tiles: [], capacity: 3 },
            { color: null, tiles: [], capacity: 4 },
            { color: null, tiles: [], capacity: 5 },
          ],
          wall: emptyWall(),
          floor: [],
          hasMarker: false,
          score: 0,
        },
        {
          lines: [
            { color: null, tiles: [], capacity: 1 },
            { color: null, tiles: [], capacity: 2 },
            { color: null, tiles: [], capacity: 3 },
            { color: null, tiles: [], capacity: 4 },
            { color: null, tiles: [], capacity: 5 },
          ],
          wall: emptyWall(),
          floor: [],
          hasMarker: true,
          score: 2,
        },
      ],
    });
    expect(pattern.pieces.filter((p) => /seat:\d+:marker/.test(p.id)).every((p) => p.objectKind === "worker")).toBe(true);

    const auction = auctionBiddingLayout({
      chips: [40, 40, 40, 40],
      currentBid: 0,
      highBidder: null,
      phase: "bidding",
      lotId: "amber",
      gallery: {
        round: 1,
        roundsToEnd: 4,
        currentMode: "open",
        artists: [{ id: "a0", name: "青釉" }],
        marketPrices: { a0: 3 },
        auctionHand: [[], [], [], []],
        collection: [[], [], [], []],
        auctioneer: 0,
        currentLot: { id: "l1", name: "晨光", reserve: 2 },
      },
    });
    const markers = auction.pieces.filter((p) => /seat:\d+:marker/.test(p.id));
    expect(markers.length).toBe(4);
    expect(markers.every((p) => p.objectKind === "worker")).toBe(true);

    for (const [kernel, layout] of [
      ["gem-engine-v1", gem],
      ["pattern-draft-v1", pattern],
      ["auction-bidding-v1", auction],
    ] as const) {
      const scene = mapTabletopToScene(layout, defaultRenderSpec(kernel, "table") as TabletopRenderInput);
      const seatMeshes = scene.model.nodes.filter((n) => /seat:\d+:marker/.test(n.id));
      expect(seatMeshes.length).toBeGreaterThan(0);
      expect(seatMeshes.every((n) => n.mesh === "meeple")).toBe(true);
      expect(seatMeshes.some((n) => n.mesh === "house")).toBe(false);
    }
  });

  it("network-route emits per-seat meeple markers", () => {
    const layout = networkRouteLayout(
      {
        cities: DEFAULT_NETWORK_CITIES,
        edges: DEFAULT_NETWORK_EDGES,
        claims: Object.fromEntries(DEFAULT_NETWORK_EDGES.map((e) => [e.id, null])),
        terminalFrom: DEFAULT_NETWORK_CITIES[0]!.id,
        terminalTo: DEFAULT_NETWORK_CITIES[1]!.id,
        routeCounts: [2, 1],
      },
      new Set(),
    );
    const markers = layout.pieces.filter((p) => /seat:\d+:marker/.test(p.id));
    expect(markers.length).toBe(2);
    expect(markers.every((p) => p.objectKind === "worker")).toBe(true);
    const scene = mapTabletopToScene(layout, defaultRenderSpec("network-route-v1", "table") as TabletopRenderInput);
    const meshes = scene.model.nodes.filter((n) => /seat:\d+:marker/.test(n.id));
    expect(meshes.every((n) => n.mesh === "meeple")).toBe(true);
  });
});
