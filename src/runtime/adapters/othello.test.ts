import { describe, expect, it } from "vitest";
import {
  applyAction,
  createInitialState,
  hashPlayState,
  listLegalActions,
  PUBLIC_LAYER_FORBIDDEN_REQUIRED_KEYS,
  replay,
  type PlayAction,
  type PlayState,
} from "../play-kernel";
import { KERNEL_CAPABILITIES, MECHANIC_CAPABILITIES } from "../../creator/kernel-capabilities";
import { GRID_EIGHT_DIRECTIONS } from "../topology-stub";
import {
  autoPlayOthelloGame,
  bindOthelloFromRuntimeKernel,
  createOthelloKernelConfig,
  createStandardOthelloBoard,
  DISC_FLIPPING_KERNEL_TYPE,
  flipsForPlace,
  listLegalPlaces,
  othelloAdapter,
  othelloGridTopology,
  pickOthelloBotAction,
  type OthelloCell,
  type OthelloGenre,
} from "./othello";

const config = createOthelloKernelConfig();

function snapshotBody(state: PlayState<OthelloGenre>) {
  const { events: _events, ...rest } = state;
  return rest;
}

/** Build a custom genre state for rule-case tests (keeps public envelope intact). */
function stateWithBoard(
  board: OthelloCell[][],
  activePlayerId = 0,
  consecutivePasses = 0,
): PlayState<OthelloGenre> {
  const base = createInitialState(othelloAdapter, config, 1);
  return {
    ...base,
    activePlayerId,
    genre: {
      rows: 8,
      cols: 8,
      board,
      consecutivePasses,
      discCounts: board
        .flat()
        .reduce<[number, number]>(
          (acc, cell) => {
            if (cell === 0) acc[0] += 1;
            else if (cell === 1) acc[1] += 1;
            return acc;
          },
          [0, 0],
        ),
      lastMove: null,
      lastAction: null,
    },
  };
}

describe("disc-flipping-v1 othello adapter", () => {
  it("registers disc-flipping-v1 with the mechanics capability set", () => {
    expect(Object.hasOwn(KERNEL_CAPABILITIES, DISC_FLIPPING_KERNEL_TYPE)).toBe(
      true,
    );
    expect(KERNEL_CAPABILITIES[DISC_FLIPPING_KERNEL_TYPE]).toEqual(
      MECHANIC_CAPABILITIES["disc-flipping"],
    );
  });

  it("creates standard 8×8 opening without Catan fields on the public envelope", () => {
    const state = createInitialState(othelloAdapter, config, 42);
    expect(state.seed).toBe(42);
    expect(state.phase).toBe("play");
    expect(state.activePlayerId).toBe(0);
    expect(state.playerCount).toBe(2);
    expect(state.genre.discCounts).toEqual([2, 2]);
    expect(state.genre.board[3][3]).toBe(1);
    expect(state.genre.board[3][4]).toBe(0);
    expect(state.genre.board[4][3]).toBe(0);
    expect(state.genre.board[4][4]).toBe(1);

    for (const forbidden of PUBLIC_LAYER_FORBIDDEN_REQUIRED_KEYS) {
      expect(Object.keys(state)).not.toContain(forbidden);
      expect(Object.keys(config)).not.toContain(forbidden);
    }
    expect(othelloGridTopology().directions).toEqual(GRID_EIGHT_DIRECTIONS);
  });

  it("lists opening legal places for black and none for white", () => {
    const state = createInitialState(othelloAdapter, config, 7);
    const black = listLegalActions(othelloAdapter, state, 0, config);
    expect(black.every((action) => action.type === "place")).toBe(true);
    expect(black.map((action) => action.payload)).toEqual(
      expect.arrayContaining([
        { row: 2, col: 3 },
        { row: 3, col: 2 },
        { row: 4, col: 5 },
        { row: 5, col: 4 },
      ]),
    );
    expect(black).toHaveLength(4);
    expect(listLegalActions(othelloAdapter, state, 1, config)).toEqual([]);
  });

  it("flips correctly in all eight directions", () => {
    // Cross of white discs around an empty center, black anchors on each ray.
    const board = createStandardOthelloBoard(8, 8).map((row) => row.slice());
    for (let r = 0; r < 8; r += 1) {
      for (let c = 0; c < 8; c += 1) board[r][c] = null;
    }
    // Place black at (3,3); surround with white then black anchors in 8 dirs.
    // Empty target: (4,4). For each direction, one white then one black.
    const target = { row: 4, col: 4 };
    for (const step of GRID_EIGHT_DIRECTIONS) {
      const mid = { row: target.row + step.row, col: target.col + step.col };
      const end = {
        row: target.row + step.row * 2,
        col: target.col + step.col * 2,
      };
      board[mid.row][mid.col] = 1;
      board[end.row][end.col] = 0;
    }
    const flips = flipsForPlace(board, target.row, target.col, 0, 8, 8);
    expect(flips).toHaveLength(8);
    for (const step of GRID_EIGHT_DIRECTIONS) {
      expect(flips).toContainEqual({
        row: target.row + step.row,
        col: target.col + step.col,
      });
    }

    const state = stateWithBoard(board, 0);
    const result = applyAction(
      othelloAdapter,
      state,
      { type: "place", playerId: 0, payload: { row: 4, col: 4 } },
      config,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.state.genre.board[4][4]).toBe(0);
    for (const step of GRID_EIGHT_DIRECTIONS) {
      expect(
        result.state.genre.board[target.row + step.row][target.col + step.col],
      ).toBe(0);
    }
    expect(result.state.genre.lastMove?.flipped).toBe(8);
  });

  it("does not mutate state on illegal place", () => {
    const state = createInitialState(othelloAdapter, config, 11);
    const beforeHash = hashPlayState(state);
    const beforeJson = JSON.stringify(state);

    const occupied = applyAction(
      othelloAdapter,
      state,
      { type: "place", playerId: 0, payload: { row: 3, col: 3 } },
      config,
    );
    expect(occupied.ok).toBe(false);
    if (occupied.ok) throw new Error("expected fail");
    expect(occupied.state).toBe(state);
    expect(JSON.stringify(state)).toBe(beforeJson);
    expect(hashPlayState(state)).toBe(beforeHash);

    const emptyNoFlip = applyAction(
      othelloAdapter,
      state,
      { type: "place", playerId: 0, payload: { row: 0, col: 0 } },
      config,
    );
    expect(emptyNoFlip.ok).toBe(false);
    if (emptyNoFlip.ok) throw new Error("expected fail");
    expect(emptyNoFlip.state).toBe(state);
    expect(JSON.stringify(state)).toBe(beforeJson);

    const wrongSeat = applyAction(
      othelloAdapter,
      state,
      { type: "place", playerId: 1, payload: { row: 2, col: 3 } },
      config,
    );
    expect(wrongSeat.ok).toBe(false);
    expect(wrongSeat.state).toBe(state);
  });

  it("forced pass both sides ends with disc-count scoring", () => {
    // Nearly empty board: only two isolated discs — neither player can place.
    const board = createStandardOthelloBoard(8, 8).map((row) => row.slice());
    for (let r = 0; r < 8; r += 1) {
      for (let c = 0; c < 8; c += 1) board[r][c] = null;
    }
    board[0][0] = 0;
    board[7][7] = 1;
    expect(listLegalPlaces(board, 0, 8, 8)).toEqual([]);
    expect(listLegalPlaces(board, 1, 8, 8)).toEqual([]);

    let state = stateWithBoard(board, 0);
    expect(
      listLegalActions(othelloAdapter, state, 0, config).map((a) => a.type),
    ).toEqual(["pass"]);

    const firstPass = applyAction(
      othelloAdapter,
      state,
      { type: "pass", playerId: 0 },
      config,
    );
    expect(firstPass.ok).toBe(true);
    if (!firstPass.ok) throw new Error(firstPass.reason);
    // Opponent also has no place → terminal on the first forced pass.
    state = firstPass.state;
    expect(state.status).toBe("complete");
    expect(state.phase).toBe("ended");
    expect(state.genre.discCounts).toEqual([1, 1]);
    expect(state.winnerId).toBeNull(); // draw
    expect(state.events.some((event) => event.kind === "pass")).toBe(true);
    expect(state.events.some((event) => event.kind === "ended")).toBe(true);

    // Consecutive passes path: give white a place so first pass doesn't end,
    // then clear so white must pass and black also cannot move.
    const board2 = createStandardOthelloBoard(8, 8).map((row) => row.slice());
    for (let r = 0; r < 8; r += 1) {
      for (let c = 0; c < 8; c += 1) board2[r][c] = null;
    }
    // Black has no move; white would have a move from a classic pair — use
    // consecutivePasses=1 already and black to pass with white also empty.
    board2[0][0] = 0;
    board2[0][2] = 1;
    // Black at (0,0), white at (0,2) — no sandwich possible either way.
    let state2 = stateWithBoard(board2, 0, 1);
    expect(listLegalPlaces(board2, 0, 8, 8)).toEqual([]);
    expect(listLegalPlaces(board2, 1, 8, 8)).toEqual([]);
    const second = applyAction(
      othelloAdapter,
      state2,
      { type: "pass", playerId: 0 },
      config,
    );
    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error(second.reason);
    expect(second.state.status).toBe("complete");
    expect(second.state.genre.discCounts[0] + second.state.genre.discCounts[1]).toBe(
      2,
    );
  });

  it("replays the same seed + actions to an identical hash/state body", () => {
    const seed = 99;
    const { state: live, actions } = autoPlayOthelloGame(seed, config);
    expect(live.status).toBe("complete");
    const replayed = replay(othelloAdapter, config, seed, actions);
    expect(hashPlayState(replayed)).toBe(hashPlayState(live));
    expect(snapshotBody(replayed)).toEqual(snapshotBody(live));

    const again = replay(othelloAdapter, config, seed, actions);
    expect(hashPlayState(again)).toBe(hashPlayState(live));
  });

  it("auto-plays ≥20 fixed seeds to a legal terminal", () => {
    const seeds = Array.from({ length: 24 }, (_, index) => index + 1);
    const summaries: Array<{
      seed: number;
      plies: number;
      status: string;
      discs: [number, number];
      hash: string;
    }> = [];

    for (const seed of seeds) {
      const { state, actions } = autoPlayOthelloGame(seed, config);
      expect(state.status).toBe("complete");
      expect(state.phase).toBe("ended");
      expect(state.events.some((event) => event.kind === "ended")).toBe(true);
      const [black, white] = state.genre.discCounts;
      expect(black + white).toBeGreaterThanOrEqual(4);
      expect(black + white).toBeLessThanOrEqual(64);
      // Every recorded action must have been legal at apply time (autoPlay throws otherwise).
      expect(actions.length).toBeGreaterThan(0);
      const replayed = replay(othelloAdapter, config, seed, actions);
      expect(hashPlayState(replayed)).toBe(hashPlayState(state));
      summaries.push({
        seed,
        plies: actions.length,
        status: state.status,
        discs: state.genre.discCounts,
        hash: hashPlayState(state),
      });
    }
    expect(summaries).toHaveLength(24);
    // Distinct seeds should not all collapse to one trivial hash.
    expect(new Set(summaries.map((entry) => entry.hash)).size).toBeGreaterThan(
      1,
    );
  });

  it("local AI only chooses from listLegalActions and finishes including pass/end", () => {
    const seed = 17;
    let state = createInitialState(othelloAdapter, config, seed);
    const log: PlayAction[] = [];
    while (state.status === "active") {
      const legal = listLegalActions(
        othelloAdapter,
        state,
        state.activePlayerId,
        config,
      );
      expect(legal.length).toBeGreaterThan(0);
      const bot = pickOthelloBotAction(state, config, seed, state.sequence + 1);
      expect(bot).not.toBeNull();
      if (!bot) throw new Error("missing bot");
      expect(legal.some((entry) => entry.type === bot.type)).toBe(true);
      if (bot.type === "place") {
        expect(
          legal.some(
            (entry) =>
              entry.type === "place" &&
              entry.payload?.row === bot.payload?.row &&
              entry.payload?.col === bot.payload?.col,
          ),
        ).toBe(true);
      }
      const result = applyAction(othelloAdapter, state, bot, config);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.reason);
      log.push(bot);
      state = result.state;
    }
    expect(state.status).toBe("complete");
    expect(log.some((action) => action.type === "pass" || action.type === "place")).toBe(
      true,
    );
  });

  it("thin-binds an Othello-shaped GameSpec/runtime kernel into createInitialState → play", () => {
    const bound = bindOthelloFromRuntimeKernel({
      playerCount: 2,
      rows: 8,
      cols: 8,
    });
    expect(bound.kernelType).toBe(DISC_FLIPPING_KERNEL_TYPE);
    const state = createInitialState(othelloAdapter, bound, 3);
    const first = listLegalActions(othelloAdapter, state, 0, bound)[0];
    expect(first?.type).toBe("place");
    const result = applyAction(
      othelloAdapter,
      state,
      {
        type: "place",
        playerId: 0,
        payload: first.payload,
      },
      bound,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.state.genre.discCounts[0]).toBeGreaterThan(2);
    expect(result.state.activePlayerId).toBe(1);
  });
});
