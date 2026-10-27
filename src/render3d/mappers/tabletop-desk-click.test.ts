import { describe, expect, it } from "vitest";
import { gemEngineLayout, patternDraftLayout } from "./tabletop-kernels";
import { mapTabletopToScene, resolveTabletopPick } from "./tabletop";
import { defaultRenderSpec } from "../../creator/render-spec";
import type { TabletopRenderInput } from "./tabletop";

const render = () => defaultRenderSpec("gem-engine-v1", "table") as TabletopRenderInput;

describe("desk legal click filtering", () => {
  it("gem: only legal buy/reserve attach actions and hints", () => {
    const state = {
      bank: { white: 4, blue: 4, green: 4, red: 4, black: 4, gold: 5 },
      market: [
        [{ id: "t1a", discount: "white", prestige: 0 }, { id: "t1b", discount: "blue", prestige: 1 }],
        [],
        [],
      ],
      nobles: [],
      seats: [
        { gems: { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 }, prestige: 0, cards: [], reserved: [] },
        { gems: { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 }, prestige: 0, cards: [], reserved: [] },
      ],
    };
    const legal = [
      { type: "buy", payload: { tier: 1, index: 0 } },
      { type: "take_pair", payload: { color: "blue" } },
    ];
    const layout = gemEngineLayout(state, legal);
    const buyPieces = layout.pieces.filter((p) => p.action?.type === "buy");
    expect(buyPieces).toHaveLength(1);
    expect(buyPieces[0]!.action?.payload).toEqual({ tier: 1, index: 0 });
    expect(layout.hints.filter((h) => h.action.type === "buy")).toHaveLength(1);
    expect(layout.hints.filter((h) => h.action.type === "reserve")).toHaveLength(0);
    expect(layout.pieces.some((p) => p.action?.type === "take_pair" && p.action.payload?.color === "blue")).toBe(true);
    const scene = mapTabletopToScene(layout, render());
    const cardId = scene.model.nodes.find((n) => n.kind === "piece" && n.id.includes("market:t1:0"))!.id;
    expect(resolveTabletopPick(scene, { nodeId: cardId })?.type).toBe("buy");
    const other = scene.model.nodes.find((n) => n.kind === "piece" && n.id.includes("market:t1:1"));
    if (other) expect(resolveTabletopPick(scene, { nodeId: other.id })).toBeNull();
  });

  it("pattern: empty legal clears draft hints; legal paints factory discs", () => {
    const state = {
      factories: [["blue", "blue", "red"], ["white"]],
      center: ["yellow"],
      markerInCenter: true,
      round: 1,
      seats: [
        {
          lines: [{ color: null, tiles: [], capacity: 1 }],
          wall: [[null]],
          floor: [],
          score: 0,
        },
      ],
    };
    const empty = patternDraftLayout(state, []);
    expect(empty.hints.filter((h) => h.action.type === "draft")).toHaveLength(0);
    const legal = [
      { type: "draft", payload: { source: "factory", factoryId: 0, color: "blue", line: 0 } },
    ];
    const layout = patternDraftLayout(state, legal);
    expect(layout.hints.some((h) => h.action.payload?.color === "blue")).toBe(true);
    expect(layout.pieces.some((p) => p.id.startsWith("factory:0:tile:") && p.action?.type === "draft")).toBe(true);
    expect(layout.pieces.filter((p) => p.action?.type === "draft" && p.action.payload?.color === "red")).toHaveLength(0);
  });
});
