import { describe, expect, it } from "vitest";
import { tileCenter } from "./hex-dressing";
import { mapHexSettlementToScene } from "./mappers/hex-settlement";
import {
  HEX_CIRCUMRADIUS,
  PROP_MAX_EXTENT,
  PROP_TARGET_HEIGHT,
  layoutFromNodes,
  normalizePropScale,
  placeImportedProps,
  tileGap,
} from "./imported-props";

/** Standard 19-hex island (radius 2). */
function standardTiles() {
  const out: { x: number; z: number }[] = [];
  for (let q = -2; q <= 2; q += 1) {
    for (let r = Math.max(-2, -q - 2); r <= Math.min(2, -q + 2); r += 1) {
      const [x, , z] = tileCenter(q, r);
      out.push({ x, z });
    }
  }
  return out;
}

describe("normalizePropScale", () => {
  it("scales a tall barrel to ≈ settlement height", () => {
    const s = normalizePropScale({ x: 0.6, y: 0.9, z: 0.6 });
    expect(0.9 * s).toBeCloseTo(PROP_TARGET_HEIGHT, 5);
    expect(0.6 * s).toBeLessThanOrEqual(PROP_MAX_EXTENT);
  });
  it("caps wide/flat props by footprint, not height", () => {
    const s = normalizePropScale({ x: 4, y: 0.5, z: 2 });
    expect(4 * s).toBeCloseTo(PROP_MAX_EXTENT, 5);
    expect(0.5 * s).toBeLessThan(PROP_TARGET_HEIGHT);
  });
  it("handles huge units (cm-scale GLB) and degenerate sizes", () => {
    expect(80 * normalizePropScale({ x: 50, y: 80, z: 50 })).toBeCloseTo(PROP_TARGET_HEIGHT, 5);
    expect(Number.isFinite(normalizePropScale({ x: 0, y: 0, z: 0 }))).toBe(true);
  });
});

describe("placeImportedProps", () => {
  const tiles = standardTiles();

  it("never overlaps any hex tile (no ports → shore ring)", () => {
    const spots = placeImportedProps({ tiles }, 6);
    expect(spots).toHaveLength(6);
    for (const s of spots) expect(tileGap(s, tiles)).toBeGreaterThanOrEqual(PROP_MAX_EXTENT / 2);
  });

  it("prefers a berth next to a harbour/dock and stays off tiles and boats", () => {
    const a = (40 * Math.PI) / 180;
    const port = { x: Math.cos(a) * 4.7, z: Math.sin(a) * 4.7 };
    const ship = { x: Math.cos(a) * 5.3, z: Math.sin(a) * 5.3 };
    const [spot] = placeImportedProps({ tiles, ports: [port], obstacles: [ship] }, 1);
    expect(Math.hypot(spot!.x - port.x, spot!.z - port.z)).toBeLessThan(1);
    expect(tileGap(spot!, tiles)).toBeGreaterThan(PROP_MAX_EXTENT / 2);
    expect(Math.hypot(spot!.x - ship.x, spot!.z - ship.z)).toBeGreaterThan(PROP_MAX_EXTENT / 2);
  });

  it("spreads multiple props without stacking", () => {
    const spots = placeImportedProps({ tiles, ports: [{ x: 4.7, z: 0 }] }, 4);
    for (let i = 0; i < spots.length; i += 1) {
      for (let j = i + 1; j < spots.length; j += 1) {
        expect(Math.hypot(spots[i]!.x - spots[j]!.x, spots[i]!.z - spots[j]!.z)).toBeGreaterThanOrEqual(PROP_MAX_EXTENT);
      }
    }
  });

  it("works off the real hex-settlement mapper layout", () => {
    const tilesIn = [
      { id: "0,0", q: 0, r: 0, terrain: "forest", number: 6 },
      { id: "1,0", q: 1, r: 0, terrain: "hills", number: 8 },
      { id: "0,1", q: 0, r: 1, terrain: "fields", number: 5 },
    ];
    const model = mapHexSettlementToScene({
      tiles: tilesIn,
      robberHex: "0,0",
      ports: [],
      players: [],
      lastDice: null,
    } as never);
    const layout = layoutFromNodes(model.nodes);
    expect(layout.tiles.length).toBe(3);
    const [spot] = placeImportedProps(layout, 1);
    expect(tileGap(spot!, layout.tiles)).toBeGreaterThan(0);
    expect(HEX_CIRCUMRADIUS).toBe(1);
  });
});
