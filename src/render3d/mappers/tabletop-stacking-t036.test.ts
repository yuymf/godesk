import { describe, expect, it } from "vitest";
import { auctionBiddingLayout, gemEngineLayout, patternDraftLayout } from "./tabletop-kernels";

describe("T036 piece stacking fidelity", () => {
  it("forbids empty factory pads; spawns N glazed tiles in a countable grid", () => {
    const layout = patternDraftLayout({
      factories: [["yellow", "yellow", "yellow", "black"], [], ["white", "blue"]],
      center: [],
      seats: [{ lines: [{ color: "blue", tiles: ["blue"], capacity: 1 }], wall: [["blue", null], [null, "red"]], floor: [], score: 0 }],
    });
    const pads = layout.pieces.filter((p) => p.id.endsWith(":pad"));
    expect(pads).toHaveLength(2); // empty factory[] skipped
    expect(layout.pieces.some((p) => p.id === "factory:1:pad")).toBe(false);

    const f0tiles = layout.pieces.filter((p) => p.id.startsWith("factory:0:tile:"));
    expect(f0tiles).toHaveLength(4);
    expect(f0tiles.every((p) => p.objectKind === "tile")).toBe(true);
    // 2×2 grid: distinct xz positions
    const keys = new Set(f0tiles.map((p) => `${p.x.toFixed(2)},${p.z.toFixed(2)}`));
    expect(keys.size).toBe(4);
    expect(f0tiles.filter((p) => p.tint === "#eab308")).toHaveLength(3);
    expect(f0tiles.filter((p) => p.tint === "#1f2937")).toHaveLength(1);

    // wall: only filled glazed tiles + optional board; no empty cell frames
    const wallPieces = layout.pieces.filter((p) => p.id.includes(":wall:"));
    expect(wallPieces.filter((p) => p.objectKind === "cell")).toHaveLength(0);
    expect(wallPieces.filter((p) => p.objectKind === "tile")).toHaveLength(2);
  });

  it("bank/supply vertical stacks with readable count; no single disc for pile", () => {
    const layout = gemEngineLayout({
      bank: { white: 7, blue: 0, green: 3, red: 0, black: 0, gold: 5 },
      market: [[], [], []],
      nobles: [],
      seats: [{ gems: { white: 4, blue: 0, green: 0, red: 0, black: 0, gold: 0 }, prestige: 0, cards: [], reserved: [] }],
    });
    const whiteStack = layout.pieces.filter((p) => p.id.startsWith("bank:white:") && p.objectKind === "resource");
    expect(whiteStack.length).toBeGreaterThan(1);
    expect(whiteStack.some((p) => p.label === "7")).toBe(true);
    expect(layout.pieces.some((p) => p.id === "bank:blue:slot" && p.objectKind === "cell")).toBe(true);
    expect(layout.pieces.some((p) => p.id.startsWith("bank:blue:") && p.objectKind === "resource")).toBe(false);

    const seatWhite = layout.pieces.filter((p) => p.id.startsWith("seat:0:gem:white:"));
    expect(seatWhite.every((p) => p.objectKind === "resource")).toBe(true);
    expect(seatWhite.length).toBeGreaterThan(1);
    expect(seatWhite.some((p) => p.label === "4")).toBe(true);
  });

  it("auction chip piles stack with count tip", () => {
    const layout = auctionBiddingLayout({
      chips: [100, 40],
      gallery: { artists: [], collection: [[], []], auctionHand: [[], []] },
    });
    const chips = layout.pieces.filter((p) => p.id.startsWith("seat:0:chip:"));
    expect(chips.length).toBeGreaterThan(1);
    expect(chips.every((p) => p.objectKind === "resource")).toBe(true);
    expect(chips.some((p) => p.label === "100")).toBe(true);
  });
});
