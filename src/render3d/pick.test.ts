import { describe, expect, it } from "vitest";
import { matchPickToLegalAction } from "./pick";

describe("matchPickToLegalAction", () => {
  const settlement = {
    type: "place_settlement",
    payload: { vertexId: "100:0" },
  };
  const city = { type: "place_city", payload: { vertexId: "100:0" } };
  const road = {
    type: "place_road",
    payload: { edgeId: "100:0|50:86.6" },
  };
  const robber = { type: "move_robber", payload: { hex: "0,0", stealFrom: null } };

  it("matches settlement hit id", () => {
    expect(
      matchPickToLegalAction(
        { nodeId: "hit:place_settlement:100:0", kind: "hit" },
        [settlement, road],
      ),
    ).toEqual({ type: "place_settlement", payload: { vertexId: "100:0" } });
  });

  it("matches city and road hit ids", () => {
    expect(
      matchPickToLegalAction({ nodeId: "hit:place_city:100:0", kind: "hit" }, [
        city,
      ]),
    ).toEqual({ type: "place_city", payload: { vertexId: "100:0" } });
    expect(
      matchPickToLegalAction(
        { nodeId: "hit:place_road:100:0|50:86.6", kind: "hit" },
        [road],
      ),
    ).toEqual({
      type: "place_road",
      payload: { edgeId: "100:0|50:86.6" },
    });
  });

  it("matches tile pick to move_robber", () => {
    expect(
      matchPickToLegalAction({ nodeId: "tile:0,0", kind: "tile" }, [robber]),
    ).toEqual({
      type: "move_robber",
      payload: { hex: "0,0", stealFrom: null },
    });
  });

  it("returns null for illegal / unmatched pick", () => {
    expect(
      matchPickToLegalAction({ nodeId: "tile:1,0", kind: "tile" }, [robber]),
    ).toBeNull();
    expect(
      matchPickToLegalAction(
        { nodeId: "hit:place_settlement:999:0", kind: "hit" },
        [settlement],
      ),
    ).toBeNull();
  });
});
