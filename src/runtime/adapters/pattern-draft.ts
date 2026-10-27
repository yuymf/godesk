/**
 * pattern-draft-v1 — factory draft / pattern-line / wall tile / floor penalty
 * on the public play-kernel (T013). Generic; not an IP special-case.
 *
 * Subset (2-4 seats via shared seat-capacity): take same-color tiles from a
 * factory or the center, place on a pattern line (excess -> floor), when the
 * table empties resolve full lines onto the wall with orthogonal adjacency
 * scoring + floor penalties, refill factories, rotate first player via the
 * center marker, then row/column/color-set end bonuses when a completed row
 * ends the game. Factory count scales with seats (2N+1).
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
  SEAT_CAPACITY,
  clampSeatCount,
  makeSeatArray,
  nextSeatId,
  patternFactoryCountForSeats,
  winnerByHighestScore,
} from "../seat-capacity";

const PATTERN_DRAFT_KERNEL_TYPE = "pattern-draft-v1" as const;

const TILE_COLORS = ["blue", "yellow", "red", "black", "white"] as const;
type TileColor = (typeof TILE_COLORS)[number];

type PatternEndBonuses = {
  /** Points per fully filled wall row. */
  perCompleteRow: number;
  /** Points per fully filled wall column. */
  perCompleteColumn: number;
  /** Points per color with all 5 wall cells of that color filled. */
  perCompleteColorSet: number;
};

type PatternDraftContent = {
  /** Factories on the table (2p default 5). */
  factoryCount: number;
  tilesPerFactory: number;
  /** Copies of each color in the bag. */
  tilesPerColor: number;
  floorPenalties: number[];
  endBonuses: PatternEndBonuses;
};

type PatternDraftConfig = {
  playerCount: number;
  content: PatternDraftContent;
};

type PatternLine = {
  color: TileColor | null;
  tiles: TileColor[];
  capacity: number;
};

type PatternSeat = {
  lines: PatternLine[];
  /** 5×5; null = empty; value = placed color. */
  wall: Array<Array<TileColor | null>>;
  floor: TileColor[];
  /** Took the first-player marker this round (occupies a floor slot). */
  hasMarker: boolean;
  score: number;
};

export type PatternDraftGenre = {
  factories: TileColor[][];
  center: TileColor[];
  markerInCenter: boolean;
  bag: TileColor[];
  lid: TileColor[];
  seats: PatternSeat[];
  round: number;
  /** Seat who will start the next draft round. */
  nextStart: PlayerId;
  lastEvent: string | null;
};

export function defaultPatternDraftContent(
  overrides?: Partial<PatternDraftContent>,
): PatternDraftContent {
  const endOverrides = overrides?.endBonuses;
  return {
    factoryCount: overrides?.factoryCount ?? 5,
    tilesPerFactory: overrides?.tilesPerFactory ?? 4,
    tilesPerColor: overrides?.tilesPerColor ?? 20,
    floorPenalties: overrides?.floorPenalties ?? [-1, -1, -2, -2, -2, -3, -3],
    endBonuses: {
      perCompleteRow: endOverrides?.perCompleteRow ?? 2,
      perCompleteColumn: endOverrides?.perCompleteColumn ?? 7,
      perCompleteColorSet: endOverrides?.perCompleteColorSet ?? 10,
    },
  };
}

export function patternDraftUnsupportedNotes(): string[] {
  return [
    "pattern-draft-v1 subset: 2-4 seats (shared seat-capacity), factory/center same-color draft, pattern lines, wall adjacency scoring, floor penalties, marker rotation, row/column/color-set end bonuses.",
  ];
}

/** Expected wall color at row/col (rotating pattern — generic, not brand art). */
export function wallColorAt(row: number, col: number): TileColor {
  return TILE_COLORS[(row + col) % TILE_COLORS.length]!;
}

export function wallColumnForColor(row: number, color: TileColor): number {
  for (let col = 0; col < 5; col += 1) {
    if (wallColorAt(row, col) === color) return col;
  }
  return -1;
}

function emptySeat(): PatternSeat {
  return {
    lines: [1, 2, 3, 4, 5].map((capacity) => ({
      color: null,
      tiles: [],
      capacity,
    })),
    wall: Array.from({ length: 5 }, () =>
      Array.from({ length: 5 }, () => null as TileColor | null),
    ),
    floor: [],
    hasMarker: false,
    score: 0,
  };
}

function cloneSeat(seat: PatternSeat): PatternSeat {
  return {
    lines: seat.lines.map((line) => ({
      color: line.color,
      tiles: [...line.tiles],
      capacity: line.capacity,
    })),
    wall: seat.wall.map((row) => [...row]),
    floor: [...seat.floor],
    hasMarker: seat.hasMarker,
    score: seat.score,
  };
}

function cloneGenre(genre: PatternDraftGenre): PatternDraftGenre {
  return {
    factories: genre.factories.map((f) => [...f]),
    center: [...genre.center],
    markerInCenter: genre.markerInCenter,
    bag: [...genre.bag],
    lid: [...genre.lid],
    seats: genre.seats.map(cloneSeat),
    round: genre.round,
    nextStart: genre.nextStart,
    lastEvent: genre.lastEvent,
  };
}

function shuffleInPlace<T>(
  items: T[],
  rng: { at: (i: number) => number },
  salt: number,
): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = rng.at(salt + i) % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function buildBag(tilesPerColor: number): TileColor[] {
  const bag: TileColor[] = [];
  for (const color of TILE_COLORS) {
    for (let i = 0; i < tilesPerColor; i += 1) bag.push(color);
  }
  return bag;
}

function drawFromBag(
  genre: PatternDraftGenre,
  count: number,
  rng: { at: (i: number) => number },
  salt: number,
): TileColor[] {
  const drawn: TileColor[] = [];
  for (let i = 0; i < count; i += 1) {
    if (genre.bag.length === 0) {
      if (genre.lid.length === 0) break;
      genre.bag = shuffleInPlace(genre.lid, rng, salt + 1000 + i);
      genre.lid = [];
    }
    if (genre.bag.length === 0) break;
    drawn.push(genre.bag.shift()!);
  }
  return drawn;
}

function refillFactories(
  genre: PatternDraftGenre,
  content: PatternDraftContent,
  rng: { at: (i: number) => number },
  salt: number,
): void {
  genre.factories = [];
  for (let f = 0; f < content.factoryCount; f += 1) {
    genre.factories.push(
      drawFromBag(genre, content.tilesPerFactory, rng, salt + f * 17),
    );
  }
  genre.center = [];
  genre.markerInCenter = true;
}

function tableHasDraftTiles(genre: PatternDraftGenre): boolean {
  if (genre.factories.some((f) => f.length > 0)) return true;
  return genre.center.length > 0;
}

function lineAccepts(seat: PatternSeat, lineIndex: number, color: TileColor): boolean {
  const line = seat.lines[lineIndex];
  if (!line) return false;
  if (line.tiles.length >= line.capacity) return false;
  if (line.color !== null && line.color !== color) return false;
  const col = wallColumnForColor(lineIndex, color);
  if (col < 0) return false;
  if (seat.wall[lineIndex]![col] !== null) return false;
  return true;
}

function pushFloor(seat: PatternSeat, tiles: TileColor[]): void {
  for (const t of tiles) {
    if (seat.floor.length < 7) seat.floor.push(t);
    // Excess beyond floor track discarded to nowhere for subset simplicity
  }
}

function placeOnLine(
  seat: PatternSeat,
  lineIndex: number | "floor",
  tiles: TileColor[],
): void {
  if (lineIndex === "floor") {
    pushFloor(seat, tiles);
    return;
  }
  const line = seat.lines[lineIndex]!;
  const color = tiles[0]!;
  line.color = color;
  for (const t of tiles) {
    if (line.tiles.length < line.capacity) line.tiles.push(t);
    else pushFloor(seat, [t]);
  }
}

function scoreWallPlacement(wall: Array<Array<TileColor | null>>, row: number, col: number): number {
  // Horizontal run
  let h = 1;
  for (let c = col - 1; c >= 0 && wall[row]![c] !== null; c -= 1) h += 1;
  for (let c = col + 1; c < 5 && wall[row]![c] !== null; c += 1) h += 1;
  // Vertical run
  let v = 1;
  for (let r = row - 1; r >= 0 && wall[r]![col] !== null; r -= 1) v += 1;
  for (let r = row + 1; r < 5 && wall[r]![col] !== null; r += 1) v += 1;
  if (h === 1 && v === 1) return 1;
  if (h > 1 && v > 1) return h + v;
  return Math.max(h, v);
}

function applyFloorPenalty(seat: PatternSeat, penalties: number[]): number {
  const slots = seat.floor.length + (seat.hasMarker ? 1 : 0);
  let loss = 0;
  for (let i = 0; i < slots; i += 1) {
    loss += penalties[i] ?? penalties[penalties.length - 1] ?? -3;
  }
  return loss;
}

function rowComplete(wall: Array<Array<TileColor | null>>, row: number): boolean {
  return wall[row]!.every((cell) => cell !== null);
}

function columnComplete(wall: Array<Array<TileColor | null>>, col: number): boolean {
  return wall.every((row) => row[col] !== null);
}

function colorSetComplete(
  wall: Array<Array<TileColor | null>>,
  color: TileColor,
): boolean {
  let n = 0;
  for (let r = 0; r < 5; r += 1) {
    for (let c = 0; c < 5; c += 1) {
      if (wall[r]![c] === color) n += 1;
    }
  }
  return n === 5;
}

function anyRowComplete(seat: PatternSeat): boolean {
  return seat.wall.some((_, r) => rowComplete(seat.wall, r));
}

/** Apply configurable end-game bonuses; returns points added. */
export function applyEndGameBonuses(
  seat: PatternSeat,
  bonuses: PatternEndBonuses,
): number {
  let added = 0;
  for (let row = 0; row < 5; row += 1) {
    if (rowComplete(seat.wall, row)) added += bonuses.perCompleteRow;
  }
  for (let col = 0; col < 5; col += 1) {
    if (columnComplete(seat.wall, col)) added += bonuses.perCompleteColumn;
  }
  for (const color of TILE_COLORS) {
    if (colorSetComplete(seat.wall, color)) added += bonuses.perCompleteColorSet;
  }
  seat.score += added;
  return added;
}

function resolveWallPhase(
  genre: PatternDraftGenre,
  content: PatternDraftContent,
): {
  ended: boolean;
  winnerId: PlayerId | null;
} {
  for (let seatId = 0; seatId < genre.seats.length; seatId += 1) {
    const seat = genre.seats[seatId]!;
    for (let row = 0; row < 5; row += 1) {
      const line = seat.lines[row]!;
      if (line.tiles.length === line.capacity && line.color) {
        const color = line.color;
        const col = wallColumnForColor(row, color);
        if (col >= 0 && seat.wall[row]![col] === null) {
          seat.wall[row]![col] = color;
          seat.score += scoreWallPlacement(seat.wall, row, col);
          for (let i = 1; i < line.tiles.length; i += 1) {
            genre.lid.push(line.tiles[i]!);
          }
        } else {
          for (const tile of line.tiles) genre.lid.push(tile);
        }
        line.tiles = [];
        line.color = null;
      }
    }
    const loss = applyFloorPenalty(seat, content.floorPenalties);
    seat.score += loss;
    for (const tile of seat.floor) genre.lid.push(tile);
    seat.floor = [];
    seat.hasMarker = false;
  }
  const anyDone = genre.seats.some((seat) => anyRowComplete(seat));
  if (anyDone) {
    for (const seat of genre.seats) {
      applyEndGameBonuses(seat, content.endBonuses);
    }
    genre.lastEvent = "end_bonuses_applied";
    const winnerId = winnerByHighestScore(
      genre.seats.map((seat) => seat.score),
    ) as PlayerId | null;
    return { ended: true, winnerId };
  }
  return { ended: false, winnerId: null };
}

export function parsePatternDraftConfig(
  adapter: PlayKernelConfig["adapter"] | Record<string, unknown> | undefined,
): PatternDraftConfig | null {
  if (!adapter || typeof adapter !== "object") return null;
  const rawCount = Number((adapter as { playerCount?: unknown }).playerCount);
  const cap = SEAT_CAPACITY["pattern-draft-v1"];
  if (!Number.isInteger(rawCount) || rawCount < cap.min || rawCount > cap.max) {
    return null;
  }
  const playerCount = clampSeatCount(rawCount, cap);
  const raw = (adapter as { content?: unknown }).content;
  const content = defaultPatternDraftContent(
    raw && typeof raw === "object" ? (raw as Partial<PatternDraftContent>) : undefined,
  );
  if (content.factoryCount < 1 || content.tilesPerFactory < 1) return null;
  return { playerCount, content };
}

export function createPatternDraftKernelConfig(
  overrides?: Partial<{
    playerCount: number;
    content: Partial<PatternDraftContent>;
  }>,
): PlayKernelConfig {
  const playerCount = clampSeatCount(
    overrides?.playerCount ?? 2,
    SEAT_CAPACITY["pattern-draft-v1"],
  );
  const content = defaultPatternDraftContent({
    factoryCount: patternFactoryCountForSeats(playerCount),
    ...overrides?.content,
  });
  return {
    kernelType: PATTERN_DRAFT_KERNEL_TYPE,
    playerCount,
    phases: [
      { id: "draft", name: "Draft" },
      { id: "ended", name: "Ended" },
    ],
    adapter: {
      playerCount,
      content,
    },
  };
}

export function bindPatternDraftFromRuntimeKernel(input: {
  playerCount: number;
  content?: Partial<PatternDraftContent> | null;
}): PlayKernelConfig {
  const playerCount = clampSeatCount(
    input.playerCount,
    SEAT_CAPACITY["pattern-draft-v1"],
  );
  return createPatternDraftKernelConfig({
    playerCount,
    content: input.content ?? undefined,
  });
}


export const patternDraftAdapter: PlayKernelAdapter<
  PatternDraftGenre,
  PatternDraftConfig
> = {
  kernelType: PATTERN_DRAFT_KERNEL_TYPE,
  parseConfig: parsePatternDraftConfig,
  createGenreState(config, seed, playerCount) {
    const rng = createSeededRng(seed);
    const seats = clampSeatCount(playerCount, SEAT_CAPACITY["pattern-draft-v1"]);
    const bag = shuffleInPlace(
      buildBag(config.content.tilesPerColor),
      rng,
      7,
    );
    const genre: PatternDraftGenre = {
      factories: [],
      center: [],
      markerInCenter: true,
      bag,
      lid: [],
      seats: makeSeatArray(seats, () => emptySeat()),
      round: 1,
      nextStart: 0,
      lastEvent: null,
    };
    refillFactories(genre, config.content, rng, 13);
    return genre;
  },
  initialPhase() {
    return "draft";
  },
  listLegalActions(state, playerId, _config) {
    if (state.status !== "active" || playerId !== state.activePlayerId) return [];
    if (state.phase !== "draft") return [];
    const genre = state.genre;
    const seat = genre.seats[playerId]!;
    const legal: LegalAction[] = [];

    const addPlacement = (
      source: "factory" | "center",
      color: TileColor,
      factoryId: number | undefined,
      count: number,
    ) => {
      for (let line = 0; line < 5; line += 1) {
        if (lineAccepts(seat, line, color)) {
          legal.push({
            type: "draft",
            label: `${source} ${color} → 行${line + 1}`,
            payload: {
              source,
              color,
              line,
              ...(factoryId !== undefined ? { factoryId } : {}),
            },
          });
        }
      }
      legal.push({
        type: "draft",
        label: `${source} ${color} → 地板`,
        payload: {
          source,
          color,
          line: "floor",
          ...(factoryId !== undefined ? { factoryId } : {}),
        },
      });
      void count;
    };

    genre.factories.forEach((factory, factoryId) => {
      const colors = new Set(factory);
      for (const color of colors) {
        const count = factory.filter((t) => t === color).length;
        addPlacement("factory", color, factoryId, count);
      }
    });
    const centerColors = new Set(genre.center);
    for (const color of centerColors) {
      const count = genre.center.filter((t) => t === color).length;
      addPlacement("center", color, undefined, count);
    }
    return legal;
  },
  reduce(state, action, config) {
    if (state.status !== "active" || action.playerId !== state.activePlayerId) {
      return null;
    }
    if (state.phase !== "draft" || action.type !== "draft") return null;
    const parsed = action.payload;
    if (!parsed || typeof parsed !== "object") return null;
    const source = parsed.source;
    const color = parsed.color as TileColor;
    const lineRaw = parsed.line;
    if (source !== "factory" && source !== "center") return null;
    if (!TILE_COLORS.includes(color)) return null;
    const line: number | "floor" =
      lineRaw === "floor"
        ? "floor"
        : typeof lineRaw === "number" && lineRaw >= 0 && lineRaw < 5
          ? lineRaw
          : ("invalid" as unknown as number);
    if (line !== "floor" && (typeof line !== "number" || line < 0 || line > 4)) {
      return null;
    }

    const genre = cloneGenre(state.genre);
    const seat = genre.seats[action.playerId]!;
    let taken: TileColor[] = [];

    if (source === "factory") {
      const factoryId = parsed.factoryId;
      if (typeof factoryId !== "number" || !genre.factories[factoryId]) return null;
      const factory = genre.factories[factoryId]!;
      taken = factory.filter((t) => t === color);
      if (!taken.length) return null;
      const rest = factory.filter((t) => t !== color);
      genre.factories[factoryId] = [];
      genre.center.push(...rest);
    } else {
      taken = genre.center.filter((t) => t === color);
      if (!taken.length) return null;
      genre.center = genre.center.filter((t) => t !== color);
      if (genre.markerInCenter) {
        genre.markerInCenter = false;
        seat.hasMarker = true;
        genre.nextStart = action.playerId;
      }
    }

    if (line !== "floor" && !lineAccepts(seat, line, color)) return null;
    placeOnLine(seat, line, taken);
    genre.lastEvent = `seat${action.playerId}_${source}_${color}`;

    const content = config.content;

    if (!tableHasDraftTiles(genre)) {
      const result = resolveWallPhase(genre, content);
      if (result.ended) {
        return {
          genre,
          phase: "ended" as PlayPhaseId,
          activePlayerId: action.playerId,
          status: "complete" as const,
          winnerId: result.winnerId,
          endReason: "row_complete",
        };
      }
      genre.round += 1;
      const rng = createSeededRng(state.seed ^ (genre.round * 997));
      refillFactories(genre, content, rng, genre.round * 31);
      // Preserve factoryCount from actual factories length after refill
      return {
        genre,
        phase: "draft" as PlayPhaseId,
        activePlayerId: genre.nextStart,
        status: "active" as const,
        winnerId: null,
        endReason: "round_refill",
      };
    }

    const next = nextSeatId(action.playerId, genre.seats.length) as PlayerId;
    return {
      genre,
      phase: "draft" as PlayPhaseId,
      activePlayerId: next,
      status: "active" as const,
      winnerId: null,
    };
  },
};

export function patternDraftToSessionFields(
  state: PlayState<PatternDraftGenre>,
) {
  return {
    turn: state.sequence,
    activeSeat: state.activePlayerId,
    scores: state.genre.seats.map((s) => s.score),
    status: state.status,
    winnerSeat: state.winnerId,
    patternDraft: {
      phase: state.phase,
      factories: state.genre.factories.map((f) => [...f]),
      center: [...state.genre.center],
      markerInCenter: state.genre.markerInCenter,
      bag: [...state.genre.bag],
      lid: [...state.genre.lid],
      bagCount: state.genre.bag.length,
      lidCount: state.genre.lid.length,
      round: state.genre.round,
      nextStart: state.genre.nextStart,
      lastEvent: state.genre.lastEvent,
      seats: state.genre.seats.map(cloneSeat),
    },
  };
}

export function playActionFromPatternDraftIntent(
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

function pickPatternDraftBotAction(
  state: PlayState<PatternDraftGenre>,
  seed: number,
  config?: PlayKernelConfig,
): PlayAction {
  const parsed = config
    ? parsePatternDraftConfig(config.adapter)
    : parsePatternDraftConfig({ playerCount: 2, content: defaultPatternDraftContent() });
  const legal = parsed
    ? patternDraftAdapter.listLegalActions(state, state.activePlayerId, parsed)
    : [];
  if (!legal.length) {
    return { type: "draft", playerId: state.activePlayerId, payload: { source: "center", color: "blue", line: "floor" } };
  }
  const rng = createSeededRng(seed);
  // Prefer placing on a line over floor.
  const linePlays = legal.filter((a) => a.payload && a.payload.line !== "floor");
  const pool = linePlays.length ? linePlays : legal;
  const choice = pool[rng.at(state.sequence + 3) % pool.length]!;
  return {
    type: choice.type,
    playerId: state.activePlayerId,
    ...(choice.payload ? { payload: { ...choice.payload } } : {}),
  };
}

export function autoPlayPatternDraftGame(
  seed: number,
  config: PlayKernelConfig = createPatternDraftKernelConfig(),
) {
  let state = createInitialState(patternDraftAdapter, config, seed);
  const actions: PlayAction[] = [];
  const max = 500;
  while (state.status === "active" && actions.length < max) {
    const action = pickPatternDraftBotAction(state, seed, config);
    const result = applyAction(patternDraftAdapter, state, action, config);
    if (!result.ok) {
      throw new Error(`pattern_draft_auto_play_illegal:${result.reason}`);
    }
    actions.push(action);
    state = result.state;
  }
  return { state, actions };
}
