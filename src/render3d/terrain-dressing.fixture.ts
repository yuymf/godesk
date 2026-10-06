/** 测试夹具：初学者棋盘 + 按 createBeginnerPorts 规则取的海岸港口顶点（仅测试使用）。 */
import { createBeginnerTiles, hexSettlementBoardGraph } from "../runtime/adapters/hex-settlement";
import type { HexSettlementSceneInput } from "./mappers/hex-settlement";

export function beginnerSceneInput(): HexSettlementSceneInput {
  const graph = hexSettlementBoardGraph();
  const coastal = graph.vertexIds.filter((v) => (graph.vertexHexes[v] ?? []).length <= 2);
  const kinds = ["any3", "wood", "any3", "brick", "any3", "sheep", "any3", "wheat", "ore"];
  const tiles = createBeginnerTiles();
  const desert = tiles.find((t) => t.terrain === "desert");
  return {
    tiles,
    robberHex: desert ? `${desert.q},${desert.r}` : "0,0",
    ports: kinds.map((kind, i) => ({ kind, vertices: [coastal[(i * 2) % coastal.length]!, coastal[(i * 2 + 1) % coastal.length]!] })),
    players: [
      { settlements: [], cities: [], roads: [] },
      { settlements: [], cities: [], roads: [] },
    ],
    lastDice: null,
  };
}
