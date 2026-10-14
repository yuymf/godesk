import { describe, expect, it } from "vitest";
import { mapHexSettlementToScene } from "./hex-settlement";

describe("T057 hex force-build Room mapping", () => {
  it("≥2 settlements + ≥2 roads map to visible settle/road nodes", () => {
    const emptyPlayer = () => ({
      resources: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 },
      settlements: [] as string[],
      cities: [] as string[],
      roads: [] as string[],
      devHand: [] as string[],
      knightsPlayed: 0,
      vpCards: 0,
      hasLargestArmy: false,
      hasLongestRoad: false,
    });
    const scene = mapHexSettlementToScene({
      tiles: [
        { q: 0, r: 0, terrain: "wood", number: 6 },
        { q: 1, r: 0, terrain: "brick", number: 5 },
      ],
      robberHex: "0,0",
      ports: [],
      players: [
        {
          ...emptyPlayer(),
          settlements: ["-100:0", "-100:173"],
          roads: ["-100:0|-100:173", "-100:173|-50:87"],
        },
        emptyPlayer(),
      ],
    });
    const settles = scene.nodes.filter((n) => n.kind === "settlement");
    const roads = scene.nodes.filter((n) => n.kind === "road");
    expect(settles.length).toBeGreaterThanOrEqual(2);
    expect(roads.length).toBeGreaterThanOrEqual(2);
  });
});
