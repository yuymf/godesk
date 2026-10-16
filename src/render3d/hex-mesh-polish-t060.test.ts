import { describe, expect, it } from "vitest";
import {
  buildCityGeometry,
  buildRoadGeometry,
  buildSettlementGeometry,
  ROAD_LENGTH,
} from "./assets/pieces";
import { mapHexSettlementToScene } from "./mappers/hex-settlement";

function size(geom: ReturnType<typeof buildSettlementGeometry>) {
  geom.computeBoundingBox();
  const b = geom.boundingBox!;
  return {
    x: b.max.x - b.min.x,
    y: b.max.y - b.min.y,
    z: b.max.z - b.min.z,
    minY: b.min.y,
  };
}

describe("T060 hex settlement/road mesh polish", () => {
  it("settlement pitched cottage taller than wide road plank; city taller than settlement", () => {
    const house = size(buildSettlementGeometry(0));
    const city = size(buildCityGeometry(0));
    const road = size(buildRoadGeometry(0));
    expect(house.minY).toBeCloseTo(0, 5);
    expect(house.y).toBeGreaterThan(0.42);
    expect(house.y / house.x).toBeGreaterThan(0.7); // pitched mass, not flat block
    expect(city.y).toBeGreaterThan(house.y * 1.35);
    expect(road.x).toBeGreaterThan(0.75); // edge-aligned span
    expect(road.x).toBeGreaterThan(ROAD_LENGTH - 0.05);
    expect(road.y).toBeLessThan(house.y * 0.35);
  });

  it("force-build style state maps ≥2 settle + ≥2 road nodes (no text-label kinds)", () => {
    const scene = mapHexSettlementToScene({
      tiles: [{ q: 0, r: 0, terrain: "desert", number: null }],
      robberHex: "0,0",
      ports: [],
      players: [
        {
          settlements: ["-100:-173", "-250:260"],
          cities: [],
          roads: ["-100:-173|-200:-173", "-200:173|-250:260"],
        },
        { settlements: [], cities: [], roads: [] },
        { settlements: [], cities: [], roads: [] },
        { settlements: [], cities: [], roads: [] },
      ],
      lastDice: null,
    });
    const settles = scene.nodes.filter((n) => n.kind === "settlement");
    const roads = scene.nodes.filter((n) => n.kind === "road");
    expect(settles.length).toBeGreaterThanOrEqual(2);
    expect(roads.length).toBeGreaterThanOrEqual(2);
    expect(scene.nodes.every((n) => n.kind !== "label" && n.kind !== "text")).toBe(true);
  });
});
