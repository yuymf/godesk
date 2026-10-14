import { describe, expect, it } from "vitest";
import { defaultRenderSpec } from "../../creator/render-spec";
import { gemEngineLayout, patternDraftLayout } from "./tabletop-kernels";
import { mapTabletopToScene, type TabletopRenderInput } from "./tabletop";

describe("T034 glazed tiles + card/plaque illustration", () => {
  it("desk bindings include glazed-tile and plaque", () => {
    const render = defaultRenderSpec("pattern-draft-v1", "table")!;
    expect(render.bindings.some((b) => b.objectKind === "tile" && b.mesh === "glazed-tile")).toBe(true);
    expect(render.bindings.some((b) => b.objectKind === "plaque" && b.mesh === "plaque")).toBe(true);
  });

  it("pattern factories emit glazed tiles, not beige region cubes as primary pieces", () => {
    const layout = patternDraftLayout({
      factories: [["blue", "red"], ["white"]],
      center: ["yellow"],
      markerInCenter: false,
      seats: [{ lines: [{ color: null, tiles: [], capacity: 1 }], wall: [[null]], floor: [], score: 0 }],
    });
    const tiles = layout.pieces.filter((p) => p.id.includes(":tile:") || p.id.startsWith("center:"));
    expect(tiles.every((p) => p.objectKind === "tile")).toBe(true);
    expect(layout.pieces.some((p) => p.id.includes("factory:") && p.id.endsWith(":pad") && p.objectKind === "disc")).toBe(true);
    // no beige region cube factory pads
    expect(layout.pieces.filter((p) => p.id.includes("factory:") && p.objectKind === "region")).toHaveLength(0);
  });

  it("gem nobles are plaques; market cards carry face schema tags", () => {
    const layout = gemEngineLayout({
      bank: { white: 1, blue: 0, green: 0, red: 0, black: 0, gold: 0 },
      market: [[{ id: "c", discount: "blue", prestige: 2 }], [], []],
      nobles: [{ id: "n1", name: "白蓝勋爵" }],
      seats: [{ gems: { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 }, prestige: 0, cards: [], reserved: [] }],
    });
    expect(layout.pieces.some((p) => p.objectKind === "plaque" && p.label?.includes("勋爵"))).toBe(true);
    const card = layout.pieces.find((p) => p.id.startsWith("market:"));
    expect(card?.label).toMatch(/^face\|card\|/);
    const scene = mapTabletopToScene(layout, defaultRenderSpec("gem-engine-v1", "table") as TabletopRenderInput);
    expect(scene.model.nodes.some((n) => n.mesh === "plaque")).toBe(true);
    expect(scene.model.nodes.some((n) => n.mesh === "card" && String(n.tag ?? "").startsWith("face|"))).toBe(true);
  });
});
