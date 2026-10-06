import { describe, expect, it } from "vitest";
import {
  createInitialHexSettlementSessionSlice,
  listHexSettlementLegalActionsForSession,
} from "./hex-settlement-session";

describe("createInitialHexSettlementSessionSlice", () => {
  it("returns beginner tiles and setup phase for 2 players", () => {
    const hexSettlement = createInitialHexSettlementSessionSlice(2);
    expect(hexSettlement.playerCount).toBe(2);
    expect(hexSettlement.tiles).toHaveLength(19);
    expect(hexSettlement.phase).toBe("setup");
  });
});

describe("listHexSettlementLegalActionsForSession", () => {
  it("lists place_settlement during setup for active seat", () => {
    const hexSettlement = createInitialHexSettlementSessionSlice(2);
    const legal = listHexSettlementLegalActionsForSession({
      hexSettlement,
      activeSeat: 0,
      status: "active",
      playerId: 0,
    });
    expect(legal.some((action) => action.type === "place_settlement")).toBe(true);
  });

  it("returns empty when status is complete", () => {
    const hexSettlement = createInitialHexSettlementSessionSlice(2);
    expect(
      listHexSettlementLegalActionsForSession({
        hexSettlement,
        activeSeat: 0,
        status: "complete",
        playerId: 0,
      }),
    ).toEqual([]);
  });
});
