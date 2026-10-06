import { describe, expect, it } from "vitest";
import {
  createInitialHexIslandSessionSlice,
  listHexIslandLegalActionsForSession,
} from "./hex-settlement-session";

describe("createInitialHexIslandSessionSlice", () => {
  it("returns beginner tiles and setup phase for 2 players", () => {
    const hexSettlement = createInitialHexIslandSessionSlice(2);
    expect(hexSettlement.playerCount).toBe(2);
    expect(hexSettlement.tiles).toHaveLength(19);
    expect(hexSettlement.phase).toBe("setup");
  });
});

describe("listHexIslandLegalActionsForSession", () => {
  it("lists place_settlement during setup for active seat", () => {
    const hexSettlement = createInitialHexIslandSessionSlice(2);
    const legal = listHexIslandLegalActionsForSession({
      hexSettlement,
      activeSeat: 0,
      status: "active",
      playerId: 0,
    });
    expect(legal.some((action) => action.type === "place_settlement")).toBe(true);
  });

  it("returns empty when status is complete", () => {
    const hexSettlement = createInitialHexIslandSessionSlice(2);
    expect(
      listHexIslandLegalActionsForSession({
        hexSettlement,
        activeSeat: 0,
        status: "complete",
        playerId: 0,
      }),
    ).toEqual([]);
  });
});
