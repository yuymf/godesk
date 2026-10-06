import { describe, expect, it } from "vitest";
import {
  createBeginnerTiles,
  type HexSettlementGenre,
  type HexSettlementPlayer,
  type ResourceBank,
} from "../../runtime/adapters/hex-settlement";
import { diffSceneModels } from "../scene-model";
import { mapHexSettlementToScene } from "./hex-settlement";

function emptyBank(): ResourceBank {
  return { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
}

function emptyPlayer(): HexSettlementPlayer {
  return {
    resources: emptyBank(),
    settlements: [],
    cities: [],
    roads: [],
    devCards: [],
    knightsPlayed: 0,
    vpCards: 0,
    newDevCards: [],
  };
}

function baseGenre(overrides: Partial<HexSettlementGenre> = {}): Pick<
  HexSettlementGenre,
  "tiles" | "robberHex" | "ports" | "players" | "lastDice"
> {
  const tiles = createBeginnerTiles();
  const desert = tiles.find((tile) => tile.terrain === "desert");
  return {
    tiles,
    robberHex: desert ? `${desert.q},${desert.r}` : "0,0",
    ports: [],
    players: [emptyPlayer(), emptyPlayer()],
    lastDice: null,
    ...overrides,
  };
}

describe("mapHexSettlementToScene", () => {
  it("emits 19 tiles, 18 number tokens, and 1 robber on beginner board", () => {
    const model = mapHexSettlementToScene(baseGenre());
    const tiles = model.nodes.filter((node) => node.kind === "tile");
    const nums = model.nodes.filter((node) => node.kind === "number-token");
    const robber = model.nodes.filter((node) => node.id === "robber");
    expect(tiles).toHaveLength(19);
    expect(nums).toHaveLength(18);
    expect(robber).toHaveLength(1);
    expect(tiles.every((node) => node.id.startsWith("tile:"))).toBe(true);
    expect(nums.every((node) => node.id.startsWith("num:"))).toBe(true);
  });

  it("diff after placing one settlement adds exactly one settle node", () => {
    const before = mapHexSettlementToScene(baseGenre());
    const vertexId = "100:0";
    const afterState = baseGenre({
      players: [
        { ...emptyPlayer(), settlements: [vertexId] },
        emptyPlayer(),
      ],
    });
    // Use a real vertex from the board graph if available-ish: pick from first tile corners via model roads/ports skip
    // Prefer an id that parseVertex accepts; synthetic is fine for mapper unit identity.
    const after = mapHexSettlementToScene(afterState);
    const diff = diffSceneModels(before, after);
    const settleAdds = diff.added.filter((node) => node.id.startsWith("settle:"));
    expect(settleAdds).toHaveLength(1);
    expect(settleAdds[0]?.id).toBe(`settle:${vertexId}`);
    expect(diff.removed).toHaveLength(0);
  });
});
