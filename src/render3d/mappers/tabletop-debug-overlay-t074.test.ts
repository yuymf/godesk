import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { gemEngineLayout } from "./tabletop-kernels";
import { mapTabletopToScene } from "./tabletop";
import { defaultRenderSpec } from "../../creator/render-spec";

describe("T074 stage debug overlay purge", () => {
  it("empty bank slots have no color:N labels", () => {
    const layout = gemEngineLayout({
      bank: { white: 1, blue: 0, green: 0, red: 0, black: 0, gold: 0 },
      market: [[], [], []],
      nobles: [],
      seats: [{ gems: { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 }, prestige: 0, cards: [], reserved: [] }],
    });
    const slots = layout.pieces.filter((p) => /bank:.*:slot/.test(p.id));
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((p) => !p.label)).toBe(true);
  });

  it("mapper does not spawn gold:0 / color:N parchment nameplates", () => {
    const layout = gemEngineLayout({
      bank: { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 },
      market: [[], [], []],
      nobles: [],
      seats: [{ gems: { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 }, prestige: 0, cards: [], reserved: [] }],
    });
    // inject a poison label to ensure filter works
    layout.pieces.push({
      id: "poison",
      objectKind: "cell",
      x: 0,
      z: 0,
      size: 0.3,
      label: "gold:0",
    });
    const render = defaultRenderSpec("gem-engine-v1", "table");
    const scene = mapTabletopToScene(layout, render as never);
    const labels = scene.model.nodes.filter((n) => n.kind === "label" || n.mesh === "label");
    expect(labels.every((n) => !/^(white|blue|green|red|black|gold):\d+$/i.test(String(n.tag ?? "")))).toBe(true);
    expect(labels.some((n) => String(n.tag) === "gold:0")).toBe(false);
  });

  it("source declares T074 filters", () => {
    const src = readFileSync("src/render3d/mappers/tabletop.ts", "utf8");
    expect(src).toContain("T074");
    expect(src).toContain("T074 · purge");
  });
});
