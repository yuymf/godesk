import { describe, expect, it } from "vitest";
import { PROP_COUNTS, layoutProps, placeShoreDressing, type PropTile } from "../terrain-props";

const sampleTiles: PropTile[] = [
  { q: 0, r: 0, terrain: "desert", center: [0, 0, 0] },
  { q: 1, r: 0, terrain: "wood", center: [1.5, 0, 0] },
  { q: 0, r: 1, terrain: "ore", center: [0.75, 0, 1.299] },
  { q: -1, r: 0, terrain: "brick", center: [-1.5, 0, 0] },
];

describe("T088 hex desk density dressing", () => {
  it("densifies desert/ore/brick on high tier (shared PROP_COUNTS)", () => {
    expect(PROP_COUNTS.high.desert!.pebble!).toBeGreaterThanOrEqual(14);
    expect(PROP_COUNTS.high.desert!.dune!).toBeGreaterThanOrEqual(7);
    expect(PROP_COUNTS.high.ore!.pebble!).toBeGreaterThanOrEqual(12);
    expect(PROP_COUNTS.high.brick!.clay!).toBeGreaterThanOrEqual(10);
    // wheat stays continuous golden field (R23)
    expect(PROP_COUNTS.high.wheat!.wheatrow ?? 0).toBe(0);
  });

  it("placeShoreDressing fills empty ring outside hexes", () => {
    const shore = placeShoreDressing(sampleTiles, "high");
    expect(shore.length).toBeGreaterThanOrEqual(16);
    expect(shore.every((p) => p.terrain === "shore")).toBe(true);
    // all outside hex circumradius ~1.0 from nearest center
    for (const p of shore) {
      const min = Math.min(...sampleTiles.map((t) => Math.hypot(t.center[0] - p.x, t.center[2] - p.z)));
      expect(min).toBeGreaterThan(0.9);
    }
  });

  it("layoutProps merges shore dressing with on-tile props", () => {
    const map = layoutProps(sampleTiles, "high");
    const pebbles = map.get("pebble") ?? [];
    expect(pebbles.length).toBeGreaterThan(10);
    expect(pebbles.some((p) => p.terrain === "shore")).toBe(true);
  });
});
