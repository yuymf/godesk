import { describe, expect, it } from "vitest";
import { Color } from "three";
import {
  buildCityGeometry,
  buildRoadGeometry,
  buildRobberGeometry,
  buildSettlementGeometry,
  disposePieceGeometries,
  pieceGeometry,
  ROAD_LENGTH,
  seatColor,
} from "./assets/pieces";
import { SEAT_COLORS } from "./tokens";

function size(geom: ReturnType<typeof buildSettlementGeometry>) {
  geom.computeBoundingBox();
  const box = geom.boundingBox!;
  return { x: box.max.x - box.min.x, y: box.max.y - box.min.y, z: box.max.z - box.min.z, minY: box.min.y };
}

function hasColor(geom: ReturnType<typeof buildSettlementGeometry>, hex: string): boolean {
  const target = new Color(hex);
  const colors = geom.getAttribute("color");
  for (let i = 0; i < colors.count; i += 1) {
    if (
      Math.abs(colors.getX(i) - target.r) < 1e-4 &&
      Math.abs(colors.getY(i) - target.g) < 1e-4 &&
      Math.abs(colors.getZ(i) - target.b) < 1e-4
    ) {
      return true;
    }
  }
  return false;
}

describe("procedural pieces (own-modelled, vertex-coloured)", () => {
  it("settlement: cottage stands on y=0, footprint ≈ a fifth of a hex width, roof in seat colour", () => {
    const geom = buildSettlementGeometry(1);
    const s = size(geom);
    expect(s.minY).toBeCloseTo(0, 5);
    expect(s.x).toBeGreaterThan(0.32);
    expect(s.x).toBeLessThan(0.45);
    expect(s.y).toBeGreaterThan(0.36);
    expect(s.y).toBeLessThan(0.48);
    expect(geom.getAttribute("color")).toBeDefined();
    expect(geom.index).toBeNull();
    // Roof is a shade of the seat colour, door is dark wood: not one flat colour.
    expect(hasColor(geom, "#4a2f1d")).toBe(true);
  });

  it("city is a larger multi-volume building (tower taller than the cottage)", () => {
    const city = size(buildCityGeometry(0));
    const house = size(buildSettlementGeometry(0));
    expect(city.x).toBeGreaterThan(house.x * 1.3);
    expect(city.y).toBeGreaterThan(house.y * 1.4);
  });

  it("road: plank beam along +X, seat paint baked, length ROAD_LENGTH", () => {
    const geom = buildRoadGeometry(2);
    const s = size(geom);
    expect(s.x).toBeCloseTo(ROAD_LENGTH, 2);
    expect(s.z).toBeLessThan(0.15);
    expect(s.y).toBeLessThan(0.1);
    expect(hasColor(geom, SEAT_COLORS[2]!)).toBe(true);
  });

  it("robber: hooded figure ≈0.6 tall on y=0", () => {
    const s = size(buildRobberGeometry());
    expect(s.minY).toBeCloseTo(0, 5);
    expect(s.y).toBeGreaterThan(0.55);
    expect(s.y).toBeLessThan(0.68);
  });

  it("seat colours differ per seat; cache returns one geometry per kind × seat", () => {
    expect(seatColor(0)).not.toBe(seatColor(1));
    expect(seatColor(5)).toBe(seatColor(1));
    const a = pieceGeometry("settlement", 0);
    expect(pieceGeometry("settlement", 0)).toBe(a);
    expect(pieceGeometry("settlement", 1)).not.toBe(a);
    expect(pieceGeometry("robber", 3)).toBe(pieceGeometry("robber", 0));
    disposePieceGeometries();
    expect(pieceGeometry("settlement", 0)).not.toBe(a);
    disposePieceGeometries();
  });
});
