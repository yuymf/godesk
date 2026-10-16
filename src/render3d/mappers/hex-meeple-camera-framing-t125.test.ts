import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { framingPoints } from "../camera-rig";
import { mapHexSettlementToScene } from "./hex-settlement";
import { GLYPH_STRETCH_Y } from "../number-labels";

describe("T125 hex meeple camera framing", () => {
  it("includes meeples in framingPoints and keeps T123 markers", () => {
    const scene = mapHexSettlementToScene({
      tiles: [
        { q: 0, r: 0, terrain: "wood", number: 6 },
        { q: 1, r: 0, terrain: "sheep", number: 4 },
        { q: 0, r: 1, terrain: "brick", number: 8 },
      ],
      robberHex: "0,0",
      ports: [],
      players: [{ settlements: [], cities: [], roads: [] }, { settlements: [], cities: [], roads: [] }],
      lastDice: null,
    });
    const meeples = scene.nodes.filter((n) => n.kind === "meeple");
    expect(meeples.length).toBeGreaterThanOrEqual(2);
    const pts = framingPoints(scene.nodes);
    const mx = meeples.map((m) => m.position[0]);
    const mz = meeples.map((m) => m.position[2]);
    const nearMeeple = pts.some((p) => mx.some((x) => Math.abs(p[0] - x) < 0.35) && mz.some((z) => Math.abs(p[2] - z) < 0.35));
    expect(nearMeeple).toBe(true);
    const hx = readFileSync("src/render3d/mappers/hex-settlement.ts", "utf8");
    expect(hx).toContain("T123");
    expect(hx).toContain("T125");
  });

  it("softens number glyph stretch without cutting T118 floor / T090 rim", () => {
    expect(GLYPH_STRETCH_Y).toBeGreaterThanOrEqual(1.62);
    expect(GLYPH_STRETCH_Y).toBeLessThan(1.78);
    const tt = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(tt).toContain("T090");
    expect(tt).toContain("#a89478");
  });
});
