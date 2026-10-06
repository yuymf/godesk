/**
 * Hex-settlement session helpers (G3D-18).
 * Legal-action listing + initial session slice; no SVG board.
 */
import {
  hexIslandAdapter,
  hexIslandToSessionFields,
  createHexIslandKernelConfig,
  parseHexIslandConfig,
  type HexIslandGenre,
  type HexIslandPlayer,
  type HexIslandPort,
  type HexIslandTile,
  type DevCardKind,
  type ResourceBank,
} from "../runtime/adapters/hex-island";
import { createInitialState, type PlayState } from "../runtime/play-kernel";

export type HexSettlementBoardState = {
  phase: string;
  playerCount: number;
  victoryPointsToWin: number;
  tiles: HexIslandTile[];
  robberHex: string;
  ports: HexIslandPort[];
  players: HexIslandPlayer[];
  setupStep: number;
  pendingRoadVertex: string | null;
  lastDice: [number, number] | null;
  discardQueue: number[];
  discardRemaining: number;
  devDeck: DevCardKind[];
  longestRoadOwner: number | null;
  largestArmyOwner: number | null;
  freeRoadsRemaining: number;
  lastAction: string | null;
  turnPlayer: number;
};

const EMPTY_BANK = (): ResourceBank => ({
  wood: 0,
  brick: 0,
  sheep: 0,
  wheat: 0,
  ore: 0,
});

export function toHexSettlementGenre(hexIsland: HexSettlementBoardState): HexIslandGenre {
  return {
    playerCount: hexIsland.playerCount,
    victoryPointsToWin: hexIsland.victoryPointsToWin,
    tiles: hexIsland.tiles.map((tile) => ({ ...tile })),
    robberHex: hexIsland.robberHex,
    ports: hexIsland.ports.map((port) => ({
      ...port,
      vertices: [...port.vertices],
    })),
    players: hexIsland.players.map((player) => ({
      resources: { ...EMPTY_BANK(), ...player.resources },
      settlements: [...player.settlements],
      cities: [...player.cities],
      roads: [...player.roads],
      devCards: [...player.devCards] as DevCardKind[],
      knightsPlayed: player.knightsPlayed,
      vpCards: player.vpCards,
      newDevCards: [...player.newDevCards] as DevCardKind[],
    })),
    setupStep: hexIsland.setupStep,
    pendingRoadVertex: hexIsland.pendingRoadVertex,
    lastDice: hexIsland.lastDice ? ([...hexIsland.lastDice] as [number, number]) : null,
    discardQueue: [...hexIsland.discardQueue],
    discardRemaining: hexIsland.discardRemaining,
    devDeck: [...hexIsland.devDeck] as DevCardKind[],
    longestRoadOwner: hexIsland.longestRoadOwner,
    largestArmyOwner: hexIsland.largestArmyOwner,
    freeRoadsRemaining: hexIsland.freeRoadsRemaining,
    lastAction: hexIsland.lastAction,
    turnPlayer: hexIsland.turnPlayer,
  };
}

function playStateFromSession(
  hexIsland: HexSettlementBoardState,
  activeSeat: number,
  status: "active" | "complete",
  winnerSeat: number | null = null,
): PlayState<HexIslandGenre> {
  return {
    seed: 0,
    sequence: 0,
    phase: status === "complete" ? "ended" : hexIsland.phase,
    activePlayerId: activeSeat,
    playerCount: hexIsland.playerCount,
    status,
    winnerId: winnerSeat,
    events: [],
    genre: toHexSettlementGenre(hexIsland),
  };
}

export function listHexIslandLegalActionsForSession(input: {
  hexIsland: HexSettlementBoardState;
  activeSeat: number;
  status: "active" | "complete";
  playerId: number;
}) {
  const config = createHexIslandKernelConfig({
    playerCount: input.hexIsland.playerCount,
    victoryPointsToWin: input.hexIsland.victoryPointsToWin,
  });
  const parsed = parseHexIslandConfig(config.adapter);
  if (!parsed) return [];
  const state = playStateFromSession(input.hexIsland, input.activeSeat, input.status);
  return hexIslandAdapter.listLegalActions(state, input.playerId, parsed);
}

/** Starting beginner-island session slice for preview / lobby. */
export function createInitialHexIslandSessionSlice(playerCount = 2) {
  const config = createHexIslandKernelConfig({ playerCount });
  const state = createInitialState(hexIslandAdapter, config, 0);
  return hexIslandToSessionFields(state).hexIsland;
}
