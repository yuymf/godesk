/**
 * Hex-settlement session helpers (G3D-18).
 * Legal-action listing + initial session slice; no SVG board.
 */
import {
  hexSettlementAdapter,
  hexSettlementToSessionFields,
  createHexSettlementKernelConfig,
  parseHexSettlementConfig,
  type HexSettlementGenre,
  type HexSettlementPlayer,
  type HexSettlementPort,
  type HexSettlementTile,
  type DevCardKind,
  type ResourceBank,
} from "../runtime/adapters/hex-settlement";
import { createInitialState, type PlayState } from "../runtime/play-kernel";

export type HexSettlementBoardState = {
  phase: string;
  playerCount: number;
  victoryPointsToWin: number;
  tiles: HexSettlementTile[];
  robberHex: string;
  ports: HexSettlementPort[];
  players: HexSettlementPlayer[];
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

export function toHexSettlementGenre(hexSettlement: HexSettlementBoardState): HexSettlementGenre {
  return {
    playerCount: hexSettlement.playerCount,
    victoryPointsToWin: hexSettlement.victoryPointsToWin,
    tiles: hexSettlement.tiles.map((tile) => ({ ...tile })),
    robberHex: hexSettlement.robberHex,
    ports: hexSettlement.ports.map((port) => ({
      ...port,
      vertices: [...port.vertices],
    })),
    players: hexSettlement.players.map((player) => ({
      resources: { ...EMPTY_BANK(), ...player.resources },
      settlements: [...player.settlements],
      cities: [...player.cities],
      roads: [...player.roads],
      devCards: [...player.devCards] as DevCardKind[],
      knightsPlayed: player.knightsPlayed,
      vpCards: player.vpCards,
      newDevCards: [...player.newDevCards] as DevCardKind[],
    })),
    setupStep: hexSettlement.setupStep,
    pendingRoadVertex: hexSettlement.pendingRoadVertex,
    lastDice: hexSettlement.lastDice ? ([...hexSettlement.lastDice] as [number, number]) : null,
    discardQueue: [...hexSettlement.discardQueue],
    discardRemaining: hexSettlement.discardRemaining,
    devDeck: [...hexSettlement.devDeck] as DevCardKind[],
    longestRoadOwner: hexSettlement.longestRoadOwner,
    largestArmyOwner: hexSettlement.largestArmyOwner,
    freeRoadsRemaining: hexSettlement.freeRoadsRemaining,
    lastAction: hexSettlement.lastAction,
    turnPlayer: hexSettlement.turnPlayer,
  };
}

function playStateFromSession(
  hexSettlement: HexSettlementBoardState,
  activeSeat: number,
  status: "active" | "complete",
  winnerSeat: number | null = null,
): PlayState<HexSettlementGenre> {
  return {
    seed: 0,
    sequence: 0,
    phase: status === "complete" ? "ended" : hexSettlement.phase,
    activePlayerId: activeSeat,
    playerCount: hexSettlement.playerCount,
    status,
    winnerId: winnerSeat,
    events: [],
    genre: toHexSettlementGenre(hexSettlement),
  };
}

export function listHexSettlementLegalActionsForSession(input: {
  hexSettlement: HexSettlementBoardState;
  activeSeat: number;
  status: "active" | "complete";
  playerId: number;
}) {
  const config = createHexSettlementKernelConfig({
    playerCount: input.hexSettlement.playerCount,
    victoryPointsToWin: input.hexSettlement.victoryPointsToWin,
  });
  const parsed = parseHexSettlementConfig(config.adapter);
  if (!parsed) return [];
  const state = playStateFromSession(input.hexSettlement, input.activeSeat, input.status);
  return hexSettlementAdapter.listLegalActions(state, input.playerId, parsed);
}

/** Starting beginner-island session slice for preview / lobby. */
export function createInitialHexSettlementSessionSlice(playerCount = 2) {
  const config = createHexSettlementKernelConfig({ playerCount });
  const state = createInitialState(hexSettlementAdapter, config, 0);
  return hexSettlementToSessionFields(state).hexSettlement;
}
