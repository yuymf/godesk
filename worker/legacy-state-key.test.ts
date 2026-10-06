/**
 * Pre-public rename: rooms persisted before the rename keep the hex-island
 * board under LEGACY_HEX_ISLAND_STATE_KEY (intentionally kept literal).
 */
import { describe, expect, it } from "vitest";
import type { SessionState } from "../src/creator/project-contract";
import {
  LEGACY_HEX_ISLAND_STATE_KEY as LEGACY,
  visibleSession,
  withHexIslandStateKey,
} from "./project-operations";
import type { StoredSharedSession } from "./public-urls";

const board = { phase: "setup", players: [] };

describe("legacy hex-island state key", () => {
  it("maps a stored legacy key to hexIsland and leaves new states untouched", () => {
    const legacy = { status: "active", scores: [0, 0], [LEGACY]: board } as unknown as SessionState;
    const mapped = withHexIslandStateKey(legacy) as unknown as Record<string, unknown>;
    expect(mapped.hexIsland).toBe(board);
    expect(LEGACY in mapped).toBe(false);
    const current = { status: "active", scores: [0, 0], hexIsland: board } as unknown as SessionState;
    expect(withHexIslandStateKey(current)).toBe(current);
    expect(withHexIslandStateKey(undefined)).toBeUndefined();
  });

  it("visibleSession serves legacy stored rooms under hexIsland", () => {
    const room = {
      id: "room-1",
      seats: [],
      acceptedActions: [],
      state: { status: "active", scores: [0, 0], [LEGACY]: board },
    } as unknown as StoredSharedSession;
    const visible = visibleSession(room) as unknown as { state: Record<string, unknown> };
    expect(visible.state.hexIsland).toEqual(board);
    expect(visible.state[LEGACY]).toBeUndefined();
  });
});
