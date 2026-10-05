import { describe, expect, it } from "vitest";
import {
  createInitialCatanSessionSlice,
  listCatanLegalActionsForSession,
} from "./hex-settlement-session";

describe("createInitialCatanSessionSlice", () => {
  it("returns beginner tiles and setup phase for 2 players", () => {
    const catan = createInitialCatanSessionSlice(2);
    expect(catan.playerCount).toBe(2);
    expect(catan.tiles).toHaveLength(19);
    expect(catan.phase).toBe("setup");
  });
});

describe("listCatanLegalActionsForSession", () => {
  it("lists place_settlement during setup for active seat", () => {
    const catan = createInitialCatanSessionSlice(2);
    const legal = listCatanLegalActionsForSession({
      catan,
      activeSeat: 0,
      status: "active",
      playerId: 0,
    });
    expect(legal.some((action) => action.type === "place_settlement")).toBe(true);
  });

  it("returns empty when status is complete", () => {
    const catan = createInitialCatanSessionSlice(2);
    expect(
      listCatanLegalActionsForSession({
        catan,
        activeSeat: 0,
        status: "complete",
        playerId: 0,
      }),
    ).toEqual([]);
  });
});
