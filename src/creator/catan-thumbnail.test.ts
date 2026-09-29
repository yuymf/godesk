import { describe, expect, it } from "vitest";
import {
  catanBoardThumbnailDataUrl,
  catanStartingBoardThumbnailDataUrl,
  createInitialCatanSessionSlice,
} from "./catan-thumbnail";
import { listCatanLegalActionsForSession } from "./CatanBoard";
import { createBeginnerTiles } from "../runtime/adapters/catan";

describe("catanStartingBoardThumbnailDataUrl", () => {
  it("returns a deterministic SVG data URL for the beginner island", () => {
    const a = catanStartingBoardThumbnailDataUrl();
    const b = catanStartingBoardThumbnailDataUrl();
    expect(a).toBe(b);
    expect(a.startsWith("data:image/svg+xml")).toBe(true);
    const decoded = decodeURIComponent(a);
    expect(decoded.includes("<svg")).toBe(true);
    expect(decoded.includes("polygon")).toBe(true);
  });

  it("embeds the 19 beginner tiles", () => {
    const tiles = createBeginnerTiles();
    expect(tiles).toHaveLength(19);
    expect(tiles.some((tile) => tile.terrain === "desert")).toBe(true);
    const url = catanBoardThumbnailDataUrl(tiles);
    expect(url).toBe(catanStartingBoardThumbnailDataUrl());
  });
});

describe("listCatanLegalActionsForSession", () => {
  it("lists opening setup settlements for seat 0 via the catan adapter", () => {
    const catan = createInitialCatanSessionSlice(2);
    expect(catan.phase).toBe("setup");
    const legal = listCatanLegalActionsForSession({
      catan,
      activeSeat: 0,
      status: "active",
      playerId: 0,
    });
    expect(legal.length).toBeGreaterThan(0);
    expect(legal.every((action) => action.type === "place_settlement")).toBe(
      true,
    );
    expect(
      legal.every(
        (action) =>
          typeof action.payload?.vertexId === "string" &&
          String(action.payload.vertexId).includes(":"),
      ),
    ).toBe(true);
  });

  it("returns empty when asking a non-active seat", () => {
    const catan = createInitialCatanSessionSlice(2);
    expect(
      listCatanLegalActionsForSession({
        catan,
        activeSeat: 0,
        status: "active",
        playerId: 1,
      }),
    ).toEqual([]);
  });
});
