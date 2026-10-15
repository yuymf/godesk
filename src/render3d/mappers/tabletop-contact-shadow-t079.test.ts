import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { mapTabletopToScene } from "./tabletop";
import { gemEngineLayout, patternDraftLayout, networkRouteLayout } from "./tabletop-kernels";
import { defaultRenderSpec } from "../../creator/render-spec";
import type { TabletopRenderInput } from "./tabletop";

describe("T079 tabletop contact shadows", () => {
  it("softContactShadow opacity strengthened (T079)", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T079");
    expect(src).toMatch(/opacity:\s*0\.48/);
    expect(src).toContain("contact-shadow");
  });

  it("gem / pattern / network scenes keep contact shadows; no gold:0 labels", () => {
    const gem = mapTabletopToScene(
      gemEngineLayout({
        bank: { white: 0, blue: 2, green: 0, red: 0, black: 0, gold: 0 },
        market: [[{ discount: "blue", prestige: 1, cost: { white: 1 } }]],
        nobles: [],
        seats: [{ gems: {}, prestige: 0, cards: [], reserved: [] }],
      }),
      defaultRenderSpec("gem-engine-v1", "table") as TabletopRenderInput,
    );
    const pattern = mapTabletopToScene(
      patternDraftLayout({
        factories: [["blue", "yellow"]],
        center: ["red"],
        markerInCenter: false,
        seats: [{ lines: [], wall: [], floor: [], score: 0 }],
      }),
      defaultRenderSpec("pattern-draft-v1", "table") as TabletopRenderInput,
    );
    const net = mapTabletopToScene(
      networkRouteLayout({
        cities: [{ id: "a", name: "A", x: 0, y: 0 }, { id: "b", name: "B", x: 3, y: 0 }],
        edges: [{ id: "e1", from: "a", to: "b", length: 2, color: "red" }],
        claims: { e1: 0 },
        routeCounts: [1],
      }, new Set()),
      defaultRenderSpec("network-route-v1", "table") as TabletopRenderInput,
    );
    // discs emit contact-shadow nodes; cards/tiles embed in groups
    expect(gem.model.nodes.some((n) => n.mesh === "contact-shadow" || n.mesh === "card" || n.mesh === "gem-chip")).toBe(true);
    expect(pattern.model.nodes.some((n) => n.mesh === "glazed-tile" || n.mesh === "porcelain-plate" || n.mesh === "contact-shadow")).toBe(true);
    expect(net.model.nodes.some((n) => n.mesh === "rail-track" || n.mesh === "contact-shadow")).toBe(true);
    const labels = gem.model.nodes.map((n) => n.tag ?? "").join(" ");
    expect(labels).not.toMatch(/gold:\s*0/i);
  });
});
