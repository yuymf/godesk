/**
 * Hex-settlement session helpers (G3D-18).
 * Legal-action listing + initial session slice; no SVG board.
 */
import {
  catanAdapter,
  catanToSessionFields,
  createCatanKernelConfig,
  parseCatanConfig,
  type CatanGenre,
  type CatanPlayer,
  type CatanPort,
  type CatanTile,
  type DevCardKind,
  type ResourceBank,
} from "../runtime/adapters/catan";
import { createInitialState, type PlayState } from "../runtime/play-kernel";

export type HexSettlementBoardState = {
  phase: string;
  playerCount: number;
  victoryPointsToWin: number;
  tiles: CatanTile[];
  robberHex: string;
  ports: CatanPort[];
  players: CatanPlayer[];
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

export function toHexSettlementGenre(catan: HexSettlementBoardState): CatanGenre {
  return {
    playerCount: catan.playerCount,
    victoryPointsToWin: catan.victoryPointsToWin,
    tiles: catan.tiles.map((tile) => ({ ...tile })),
    robberHex: catan.robberHex,
    ports: catan.ports.map((port) => ({
      ...port,
      vertices: [...port.vertices],
    })),
    players: catan.players.map((player) => ({
      resources: { ...EMPTY_BANK(), ...player.resources },
      settlements: [...player.settlements],
      cities: [...player.cities],
      roads: [...player.roads],
      devCards: [...player.devCards] as DevCardKind[],
      knightsPlayed: player.knightsPlayed,
      vpCards: player.vpCards,
      newDevCards: [...player.newDevCards] as DevCardKind[],
    })),
    setupStep: catan.setupStep,
    pendingRoadVertex: catan.pendingRoadVertex,
    lastDice: catan.lastDice ? ([...catan.lastDice] as [number, number]) : null,
    discardQueue: [...catan.discardQueue],
    discardRemaining: catan.discardRemaining,
    devDeck: [...catan.devDeck] as DevCardKind[],
    longestRoadOwner: catan.longestRoadOwner,
    largestArmyOwner: catan.largestArmyOwner,
    freeRoadsRemaining: catan.freeRoadsRemaining,
    lastAction: catan.lastAction,
    turnPlayer: catan.turnPlayer,
  };
}

function playStateFromSession(
  catan: HexSettlementBoardState,
  activeSeat: number,
  status: "active" | "complete",
  winnerSeat: number | null = null,
): PlayState<CatanGenre> {
  return {
    seed: 0,
    sequence: 0,
    phase: status === "complete" ? "ended" : catan.phase,
    activePlayerId: activeSeat,
    playerCount: catan.playerCount,
    status,
    winnerId: winnerSeat,
    events: [],
    genre: toHexSettlementGenre(catan),
  };
}

export function listCatanLegalActionsForSession(input: {
  catan: HexSettlementBoardState;
  activeSeat: number;
  status: "active" | "complete";
  playerId: number;
}) {
  const config = createCatanKernelConfig({
    playerCount: input.catan.playerCount,
    victoryPointsToWin: input.catan.victoryPointsToWin,
  });
  const parsed = parseCatanConfig(config.adapter);
  if (!parsed) return [];
  const state = playStateFromSession(input.catan, input.activeSeat, input.status);
  return catanAdapter.listLegalActions(state, input.playerId, parsed);
}

/** Starting beginner-island session slice for preview / lobby. */
export function createInitialCatanSessionSlice(playerCount = 2) {
  const config = createCatanKernelConfig({ playerCount });
  const state = createInitialState(catanAdapter, config, 0);
  return catanToSessionFields(state).catan;
}
