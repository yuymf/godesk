/**
 * Othello / Reversi disc-flipping adapter on the public play-kernel (PR5).
 *
 * Genre/topology state lives under `genre` only — the public envelope still
 * has no hex/resources/dice required fields. AI and humans share
 * `listLegalActions` → `applyAction`.
 */

import {
  applyAction,
  createInitialState,
  createSeededRng,
  type LegalAction,
  type PlayAction,
  type PlayKernelAdapter,
  type PlayKernelConfig,
  type PlayPhaseId,
  type PlayState,
  type PlayerId,
} from "../play-kernel";
import {
  GRID_EIGHT_DIRECTIONS,
  createGridTopologyStub,
  type GridCoord,
  type GridTopologyStub,
} from "../topology-stub";

export const DISC_FLIPPING_KERNEL_TYPE = "disc-flipping-v1" as const;

export const OTHELLO_PHASES = [
  { id: "play", name: "Play" },
  { id: "ended", name: "Ended" },
] as const;

/** Empty cell = null; occupied = owning playerId (0 = black, 1 = white). */
export type OthelloCell = PlayerId | null;

export type OthelloConfig = {
  rows: number;
  cols: number;
};

export type OthelloGenre = {
  rows: number;
  cols: number;
  /** Row-major board; never mutate in place — reduce always copies. */
  board: OthelloCell[][];
  consecutivePasses: number;
  discCounts: [number, number];
  lastMove: { row: number; col: number; flipped: number } | null;
  lastAction: "place" | "pass" | null;
};

export function parseOthelloConfig(
  raw: Record<string, unknown>,
): OthelloConfig | null {
  const rows = raw.rows ?? 8;
  const cols = raw.cols ?? 8;
  if (
    !Number.isInteger(rows) ||
    !Number.isInteger(cols) ||
    (rows as number) < 4 ||
    (cols as number) < 4 ||
    (rows as number) > 16 ||
    (cols as number) > 16 ||
    (rows as number) % 2 !== 0 ||
    (cols as number) % 2 !== 0
  ) {
    return null;
  }
  return { rows: rows as number, cols: cols as number };
}

export function createOthelloKernelConfig(input?: {
  playerCount?: number;
  rows?: number;
  cols?: number;
}): PlayKernelConfig {
  return {
    kernelType: DISC_FLIPPING_KERNEL_TYPE,
    playerCount: input?.playerCount ?? 2,
    phases: OTHELLO_PHASES.map((phase) => ({ ...phase })),
    adapter: {
      rows: input?.rows ?? 8,
      cols: input?.cols ?? 8,
    },
  };
}

/** Standard opening: black (0) starts. Center four discs. */
export function createStandardOthelloBoard(
  rows: number,
  cols: number,
): OthelloCell[][] {
  const board: OthelloCell[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => null),
  );
  const midR = rows / 2 - 1;
  const midC = cols / 2 - 1;
  board[midR][midC] = 1;
  board[midR][midC + 1] = 0;
  board[midR + 1][midC] = 0;
  board[midR + 1][midC + 1] = 1;
  return board;
}

export function countDiscs(board: OthelloCell[][]): [number, number] {
  let black = 0;
  let white = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell === 0) black += 1;
      else if (cell === 1) white += 1;
    }
  }
  return [black, white];
}

function inBounds(row: number, col: number, rows: number, cols: number): boolean {
  return row >= 0 && col >= 0 && row < rows && col < cols;
}

/**
 * Cells that would flip if `playerId` places at (row, col). Empty array means
 * the placement is illegal (must sandwich ≥1 opponent disc in some direction).
 */
export function flipsForPlace(
  board: OthelloCell[][],
  row: number,
  col: number,
  playerId: PlayerId,
  rows: number,
  cols: number,
): GridCoord[] {
  if (!inBounds(row, col, rows, cols) || board[row][col] !== null) return [];
  const opponent: PlayerId = playerId === 0 ? 1 : 0;
  const flipped: GridCoord[] = [];

  for (const step of GRID_EIGHT_DIRECTIONS) {
    const line: GridCoord[] = [];
    let r = row + step.row;
    let c = col + step.col;
    while (inBounds(r, c, rows, cols) && board[r][c] === opponent) {
      line.push({ row: r, col: c });
      r += step.row;
      c += step.col;
    }
    if (
      line.length > 0 &&
      inBounds(r, c, rows, cols) &&
      board[r][c] === playerId
    ) {
      flipped.push(...line);
    }
  }
  return flipped;
}

export function listLegalPlaces(
  board: OthelloCell[][],
  playerId: PlayerId,
  rows: number,
  cols: number,
): GridCoord[] {
  const places: GridCoord[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (flipsForPlace(board, row, col, playerId, rows, cols).length > 0) {
        places.push({ row, col });
      }
    }
  }
  return places;
}

function cloneBoard(board: OthelloCell[][]): OthelloCell[][] {
  return board.map((row) => row.slice());
}

function winnerFromCounts(counts: [number, number]): PlayerId | null {
  if (counts[0] > counts[1]) return 0;
  if (counts[1] > counts[0]) return 1;
  return null;
}

function payloadCoord(
  action: PlayAction,
): { row: number; col: number } | null {
  const payload = action.payload;
  if (!payload) return null;
  const row = payload.row;
  const col = payload.col;
  if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
  return { row: row as number, col: col as number };
}

export const othelloAdapter: PlayKernelAdapter<OthelloGenre, OthelloConfig> = {
  kernelType: DISC_FLIPPING_KERNEL_TYPE,

  parseConfig: parseOthelloConfig,

  createGenreState(config) {
    const board = createStandardOthelloBoard(config.rows, config.cols);
    return {
      rows: config.rows,
      cols: config.cols,
      board,
      consecutivePasses: 0,
      discCounts: countDiscs(board),
      lastMove: null,
      lastAction: null,
    };
  },

  initialPhase(): PlayPhaseId {
    return "play";
  },

  listLegalActions(state, playerId) {
    if (state.status !== "active" || playerId !== state.activePlayerId) {
      return [];
    }
    const { board, rows, cols } = state.genre;
    const places = listLegalPlaces(board, playerId, rows, cols);
    if (places.length === 0) {
      return [{ type: "pass", label: "Pass" }];
    }
    return places.map(
      (place) =>
        ({
          type: "place",
          label: `Place ${place.row},${place.col}`,
          payload: { row: place.row, col: place.col },
        }) satisfies LegalAction,
    );
  },

  reduce(state, action) {
    if (state.status !== "active" || action.playerId !== state.activePlayerId) {
      return null;
    }
    const { board, rows, cols } = state.genre;
    const playerId = action.playerId;
    const places = listLegalPlaces(board, playerId, rows, cols);

    if (action.type === "pass") {
      if (places.length > 0) return null;
      const nextPlayer = ((playerId + 1) % state.playerCount) as PlayerId;
      const nextPlaces = listLegalPlaces(board, nextPlayer, rows, cols);
      const consecutivePasses = state.genre.consecutivePasses + 1;
      // End when both sides have been forced to pass, or opponent also has no place.
      const mutualPass = consecutivePasses >= 2 || nextPlaces.length === 0;
      if (mutualPass) {
        const discCounts = countDiscs(board);
        return {
          genre: {
            ...state.genre,
            consecutivePasses,
            discCounts,
            lastMove: null,
            lastAction: "pass" as const,
          },
          phase: "ended" as PlayPhaseId,
          activePlayerId: playerId,
          status: "complete" as const,
          winnerId: winnerFromCounts(discCounts),
          passed: true,
          endReason: "no_legal_moves",
        };
      }
      return {
        genre: {
          ...state.genre,
          consecutivePasses,
          lastMove: null,
          lastAction: "pass" as const,
        },
        phase: "play" as PlayPhaseId,
        activePlayerId: nextPlayer,
        status: "active" as const,
        winnerId: null,
        passed: true,
      };
    }

    if (action.type !== "place") return null;
    if (places.length === 0) return null;
    const coord = payloadCoord(action);
    if (!coord) return null;
    const flips = flipsForPlace(
      board,
      coord.row,
      coord.col,
      playerId,
      rows,
      cols,
    );
    if (flips.length === 0) return null;

    const nextBoard = cloneBoard(board);
    nextBoard[coord.row][coord.col] = playerId;
    for (const cell of flips) {
      nextBoard[cell.row][cell.col] = playerId;
    }
    const discCounts = countDiscs(nextBoard);
    const nextPlayer = ((playerId + 1) % state.playerCount) as PlayerId;
    const boardFull = discCounts[0] + discCounts[1] >= rows * cols;
    const nextPlaces = listLegalPlaces(nextBoard, nextPlayer, rows, cols);
    const selfPlaces = listLegalPlaces(nextBoard, playerId, rows, cols);

    if (boardFull || (nextPlaces.length === 0 && selfPlaces.length === 0)) {
      return {
        genre: {
          rows,
          cols,
          board: nextBoard,
          consecutivePasses: 0,
          discCounts,
          lastMove: {
            row: coord.row,
            col: coord.col,
            flipped: flips.length,
          },
          lastAction: "place" as const,
        },
        phase: "ended" as PlayPhaseId,
        activePlayerId: playerId,
        status: "complete" as const,
        winnerId: winnerFromCounts(discCounts),
        endReason: boardFull ? "board_full" : "no_legal_moves",
      };
    }

    return {
      genre: {
        rows,
        cols,
        board: nextBoard,
        consecutivePasses: 0,
        discCounts,
        lastMove: {
          row: coord.row,
          col: coord.col,
          flipped: flips.length,
        },
        lastAction: "place" as const,
      },
      phase: "play" as PlayPhaseId,
      activePlayerId: nextPlayer,
      status: "active" as const,
      winnerId: null,
    };
  },
};

/** Topology helper for adapters / tests — not on the public envelope. */
export function othelloGridTopology(
  rows = 8,
  cols = 8,
): GridTopologyStub {
  return createGridTopologyStub(rows, cols);
}

export function othelloToSessionFields(state: PlayState<OthelloGenre>): {
  turn: number;
  activeSeat: number;
  scores: number[];
  status: "active" | "complete";
  winnerSeat: number | null;
  othello: {
    rows: number;
    cols: number;
    board: OthelloCell[][];
    consecutivePasses: number;
    discCounts: [number, number];
    lastMove: OthelloGenre["lastMove"];
    lastAction: OthelloGenre["lastAction"];
  };
} {
  return {
    turn: state.sequence,
    activeSeat: state.activePlayerId,
    scores: [...state.genre.discCounts],
    status: state.status,
    winnerSeat: state.winnerId,
    othello: {
      rows: state.genre.rows,
      cols: state.genre.cols,
      board: cloneBoard(state.genre.board),
      consecutivePasses: state.genre.consecutivePasses,
      discCounts: [...state.genre.discCounts] as [number, number],
      lastMove: state.genre.lastMove ? { ...state.genre.lastMove } : null,
      lastAction: state.genre.lastAction,
    },
  };
}

/**
 * Thin bind: Othello-shaped RuleSystem / GameSpec kernel options → public
 * PlayKernelConfig. Does not run the NL generator.
 */
export function bindOthelloFromRuntimeKernel(input: {
  playerCount?: number;
  rows?: number;
  cols?: number;
}): PlayKernelConfig {
  const playerCount = input.playerCount ?? 2;
  if (playerCount !== 2) {
    throw new Error("othello_requires_two_players");
  }
  return createOthelloKernelConfig({
    playerCount,
    rows: input.rows ?? 8,
    cols: input.cols ?? 8,
  });
}

export function playActionFromOthelloIntent(
  seat: number,
  actionId: string,
  payload?: Record<string, unknown>,
): PlayAction {
  return {
    type: actionId,
    playerId: seat,
    ...(payload ? { payload } : {}),
  };
}

/**
 * Local AI: choose uniformly among `listLegalActions` using the same seeded
 * RNG as the public kernel. No privileged state writes.
 */
export function pickOthelloBotAction(
  state: PlayState<OthelloGenre>,
  config: PlayKernelConfig,
  seed: number,
  sequence: number,
): PlayAction | null {
  const parsed = parseOthelloConfig(config.adapter);
  if (!parsed) return null;
  const legal = othelloAdapter.listLegalActions(
    state,
    state.activePlayerId,
    parsed,
  );
  if (!legal.length) return null;
  const rng = createSeededRng(seed);
  const random = rng.at(Math.max(sequence, 1));
  const choice = legal[random % legal.length];
  return {
    type: choice.type,
    playerId: state.activePlayerId,
    ...(choice.payload ? { payload: { ...choice.payload } } : {}),
  };
}

/** Auto-play one full game (both seats via listLegalActions only). */
export function autoPlayOthelloGame(
  seed: number,
  config: PlayKernelConfig = createOthelloKernelConfig(),
): {
  state: PlayState<OthelloGenre>;
  actions: PlayAction[];
} {
  let state = createInitialState(othelloAdapter, config, seed);
  const actions: PlayAction[] = [];
  const rows = Number(config.adapter.rows ?? 8);
  const cols = Number(config.adapter.cols ?? 8);
  const maxPlies = rows * cols * 4;
  let guard = 0;

  while (state.status === "active" && guard < maxPlies) {
    guard += 1;
    const bot = pickOthelloBotAction(state, config, seed, state.sequence + 1);
    if (!bot) break;
    const result = applyAction(othelloAdapter, state, bot, config);
    if (!result.ok) {
      throw new Error(`othello_auto_play_illegal:${result.reason}`);
    }
    actions.push(bot);
    state = result.state;
  }
  return { state, actions };
}
