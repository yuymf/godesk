import { describe, expect, it } from "vitest";
import {
  createInitialNetworkRouteSessionSlice,
  networkRouteStartingBoardThumbnailDataUrl,
} from "./network-route-thumbnail";
import { listNetworkRouteLegalActionsForSession } from "./NetworkRouteBoard";

describe("network-route thumbnail", () => {
  it("emits a deterministic SVG data URL", () => {
    const a = networkRouteStartingBoardThumbnailDataUrl();
    const b = networkRouteStartingBoardThumbnailDataUrl();
    expect(a).toBe(b);
    expect(a.startsWith("data:image/svg+xml")).toBe(true);
  });

  it("initial slice exposes legal claims for seat 0", () => {
    const slice = createInitialNetworkRouteSessionSlice();
    const legal = listNetworkRouteLegalActionsForSession({
      networkRoute: slice,
      activeSeat: 0,
      status: "active",
      playerId: 0,
    });
    expect(legal.length).toBeGreaterThan(0);
    expect(legal.every((entry) => entry.type === "claim")).toBe(true);
  });
});
