import { describe, expect, it } from "vitest";
import {
  createInitialHexIslandSessionSlice,
  listHexIslandLegalActionsForSession,
} from "./hex-settlement-session";

describe("createInitialHexIslandSessionSlice", () => {
  it("returns beginner tiles and setup phase for 2 players", () => {
    const hexIsland = createInitialHexIslandSessionSlice(2);
    expect(hexIsland.playerCount).toBe(2);
    expect(hexIsland.tiles).toHaveLength(19);
    expect(hexIsland.phase).toBe("setup");
  });
});

describe("listHexIslandLegalActionsForSession", () => {
  it("lists place_settlement during setup for active seat", () => {
    const hexIsland = createInitialHexIslandSessionSlice(2);
    const legal = listHexIslandLegalActionsForSession({
      hexIsland,
      activeSeat: 0,
      status: "active",
      playerId: 0,
    });
    expect(legal.some((action) => action.type === "place_settlement")).toBe(true);
  });

  it("returns empty when status is complete", () => {
    const hexIsland = createInitialHexIslandSessionSlice(2);
    expect(
      listHexIslandLegalActionsForSession({
        hexIsland,
        activeSeat: 0,
        status: "complete",
        playerId: 0,
      }),
    ).toEqual([]);
  });
});
