import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { mapHexSettlementToScene } from "./hex-settlement";

describe("T123 meeple rim hex visibility", () => {
  it("hex scene emits per-seat meeples with rim-tuned shared figure", () => {
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
    expect(meeples.every((n) => typeof n.seat === "number")).toBe(true);
    expect(meeples.every((n) => /^seat:\d+:meeple$/.test(n.id))).toBe(true);
  });

  it("shared rim keeps T090/T106/T116 markers while enlarging disc", () => {
    const pieces = readFileSync("src/render3d/assets/pieces.ts", "utf8");
    expect(pieces).toContain("T123");
    expect(pieces).toMatch(/#a89478|#e8c878|#ffe6b0/); // T123 heritage / T163 crown
    expect(pieces).toMatch(/CylinderGeometry\(0\.(28|30|32|36|40),\s*0\.(30|32|34|40|44)/);
    expect(pieces).toMatch(/contactShadow\(0\.(2[2468]|3[0468]),\s*0\.(2[2468]|3[0468])/);
    const tt = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(tt).toContain("T090");
    expect(tt).toContain("T116");
    expect(tt).toContain("#a89478");
    expect(tt).toMatch(/softContactShadow\(0\.(26|30|34),\s*0\.(22|26|30)\)/);
    expect(tt).toMatch(/CylinderGeometry\(0\.28,\s*0\.30,\s*0\.045/);
  });
});
