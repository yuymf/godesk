/**
 * Tide Arena / 潮阵 — Executable Kernel `auto-battler-v1`.
 * Product name only: Tide Arena / 潮阵 (never third-party auto-battler brands).
 *
 * Loop: shop → place → combat → resolve → next shop; end when seat HP ≤ 0.
 * ★2 merge: out of scope (unsupported).
 */
import {
  applyAction,
  createInitialState,
  createSeededRng,
  type PlayAction,
  type PlayKernelAdapter,
  type PlayKernelConfig,
  type PlayState,
} from "../play-kernel";

export const AUTO_BATTLER_KERNEL_TYPE = "auto-battler-v1" as const;

/** Own half: 7 columns × 2 rows (row 0 = front, at the tide line). */
export const BOARD_COLS = 7;
export const BOARD_ROWS = 2;
export const BOARD_SLOTS = BOARD_COLS * BOARD_ROWS;
export const BENCH_SLOTS = 5;
export const SHOP_SIZE = 5;
export const START_GOLD = 10;
export const REFRESH_COST = 1;
export const BASE_INCOME = 5;
export const START_HP = 20;
export const MAX_COMBAT_TICKS = 64;
export const SELL_REFUND_RATIO = 0.5;

export type TraitId = "tide" | "shell" | "coral" | "voyager";

export type UnitDef = {
  id: string;
  name: string;
  cost: number;
  atk: number;
  hp: number;
  traits: readonly TraitId[];
};

/** Original Tide Arena roster (≥6). */
export const UNIT_CATALOG: readonly UnitDef[] = [
  { id: "crab", name: "礁蟹", cost: 1, atk: 45, hp: 650, traits: ["shell", "tide"] },
  { id: "blade", name: "潮刃", cost: 2, atk: 70, hp: 550, traits: ["tide"] },
  { id: "archer", name: "飞鱼弓", cost: 2, atk: 60, hp: 450, traits: ["voyager"] },
  { id: "witch", name: "珊瑚巫", cost: 3, atk: 50, hp: 600, traits: ["coral"] },
  { id: "whale", name: "鲸盾", cost: 4, atk: 55, hp: 1100, traits: ["shell"] },
  { id: "spirit", name: "海风灵", cost: 5, atk: 85, hp: 800, traits: ["voyager", "tide"] },
] as const;

const UNIT_BY_ID: Record<string, UnitDef> = Object.fromEntries(
  UNIT_CATALOG.map((unit) => [unit.id, unit]),
);

/**
 * Synergies: trait count ≥2 changes combat stats (v0 flat bonuses; the SPEC's
 * timed shield / armor / brittle / extra-projectile effects are not yet modelled).
 */
export const TRAIT_SYNERGIES: Record<
  TraitId,
  { label: string; glyph: string; min: number; tiers: readonly number[]; atkBonus: number; hpBonus: number }
> = {
  tide: { label: "潮汐", glyph: "潮", min: 2, tiers: [2, 4, 6], atkBonus: 0, hpBonus: 60 },
  shell: { label: "硬壳", glyph: "甲", min: 2, tiers: [2, 4], atkBonus: 0, hpBonus: 150 },
  coral: { label: "珊瑚咒", glyph: "咒", min: 2, tiers: [2, 3], atkBonus: 10, hpBonus: 0 },
  voyager: { label: "远航", glyph: "风", min: 2, tiers: [2, 4], atkBonus: 12, hpBonus: 0 },
};

export type Piece = {
  uid: string;
  unitId: string;
  owner: number;
  atk: number;
  hp: number;
  maxHp: number;
};

export type SeatState = {
  gold: number;
  hp: number;
  shop: string[];
  bench: Array<Piece | null>;
  board: Array<Piece | null>;
  ready: boolean;
};

export type CombatLogEntry =
  | { kind: "combat_start"; round: number }
  | { kind: "strike"; attackerUid: string; targetUid: string; damage: number; targetHp: number }
  | { kind: "unit_down"; uid: string; owner: number }
  | { kind: "combat_end"; winnerSeat: number | null; damageToLoser: number };

export type AutoBattlerConfig = { playerCount: number };

export type AutoBattlerGenre = {
  round: number;
  seats: [SeatState, SeatState];
  combatLog: CombatLogEntry[];
  lastCombat: { winnerSeat: number | null; damage: number } | null;
  nextUid: number;
};

export type AutoBattlerPhase = "shop" | "place" | "ended";

function parseAutoBattlerConfig(
  raw: Record<string, unknown>,
): AutoBattlerConfig | null {
  const playerCount = raw.playerCount ?? 2;
  return playerCount === 2 ? { playerCount: 2 } : null;
}

export function createAutoBattlerKernelConfig(): PlayKernelConfig {
  return {
    kernelType: AUTO_BATTLER_KERNEL_TYPE,
    playerCount: 2,
    phases: [
      { id: "shop", name: "Shop" },
      { id: "place", name: "Place" },
      { id: "ended", name: "Ended" },
    ],
    adapter: { playerCount: 2 },
  };
}

function emptySlots<T>(n: number): Array<T | null> {
  return Array.from({ length: n }, () => null);
}

function rollShop(seed: number, sequence: number, count: number): string[] {
  const rng = createSeededRng(seed);
  const ids = UNIT_CATALOG.map((unit) => unit.id);
  const shop: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const roll = rng.at(sequence + 17 + i) % ids.length;
    shop.push(ids[roll]!);
  }
  return shop;
}

function cloneSeat(seat: SeatState): SeatState {
  return {
    gold: seat.gold,
    hp: seat.hp,
    shop: [...seat.shop],
    bench: seat.bench.map((piece) => (piece ? { ...piece } : null)),
    board: seat.board.map((piece) => (piece ? { ...piece } : null)),
    ready: seat.ready,
  };
}

function cloneGenre(genre: AutoBattlerGenre): AutoBattlerGenre {
  return {
    round: genre.round,
    seats: [cloneSeat(genre.seats[0]), cloneSeat(genre.seats[1])],
    combatLog: [...genre.combatLog],
    lastCombat: genre.lastCombat ? { ...genre.lastCombat } : null,
    nextUid: genre.nextUid,
  };
}

function firstEmpty(slots: Array<Piece | null>): number {
  return slots.findIndex((slot) => slot === null);
}

function interest(gold: number): number {
  return Math.min(5, Math.floor(gold / 10));
}

function grantIncome(seat: SeatState): void {
  seat.gold += BASE_INCOME + interest(seat.gold);
}

function makePiece(
  genre: AutoBattlerGenre,
  unitId: string,
  owner: number,
): Piece | null {
  const def = UNIT_BY_ID[unitId];
  if (!def) return null;
  const uid = `p${genre.nextUid}`;
  genre.nextUid += 1;
  return {
    uid,
    unitId: def.id,
    owner,
    atk: def.atk,
    hp: def.hp,
    maxHp: def.hp,
  };
}

export function unitDef(unitId: string): UnitDef | undefined {
  return UNIT_BY_ID[unitId];
}

/** Trait counts on a board (for HUD rows incl. inactive traits). */
export function traitCounts(board: Array<Piece | null>): Record<TraitId, number> {
  const counts: Record<TraitId, number> = { tide: 0, shell: 0, coral: 0, voyager: 0 };
  for (const piece of board) {
    const def = piece ? UNIT_BY_ID[piece.unitId] : undefined;
    if (def) for (const trait of def.traits) counts[trait] += 1;
  }
  return counts;
}

export function activeSynergies(
  board: Array<Piece | null>,
): Array<{ trait: TraitId; count: number; label: string }> {
  const counts: Record<TraitId, number> = { tide: 0, shell: 0, coral: 0, voyager: 0 };
  for (const piece of board) {
    if (!piece) continue;
    const def = UNIT_BY_ID[piece.unitId];
    if (!def) continue;
    for (const trait of def.traits) counts[trait] += 1;
  }
  return (Object.keys(TRAIT_SYNERGIES) as TraitId[])
    .filter((trait) => counts[trait] >= TRAIT_SYNERGIES[trait].min)
    .map((trait) => ({
      trait,
      count: counts[trait],
      label: TRAIT_SYNERGIES[trait].label,
    }));
}

function applySynergiesToPiece(piece: Piece, board: Array<Piece | null>): Piece {
  const def = UNIT_BY_ID[piece.unitId];
  if (!def) return { ...piece };
  const syn = activeSynergies(board);
  let atk = def.atk;
  let hp = def.hp;
  for (const entry of syn) {
    const bonus = TRAIT_SYNERGIES[entry.trait];
    atk += bonus.atkBonus;
    hp += bonus.hpBonus;
  }
  return { ...piece, atk, hp, maxHp: hp };
}

type CombatFighter = Piece & { x: number; y: number };

function boardToFighters(
  seat: number,
  board: Array<Piece | null>,
): CombatFighter[] {
  const fighters: CombatFighter[] = [];
  for (let i = 0; i < board.length; i += 1) {
    const piece = board[i];
    if (!piece) continue;
    const buffed = applySynergiesToPiece(piece, board);
    const cell = arenaCell(seat, i);
    fighters.push({ ...buffed, x: cell.col, y: cell.row });
  }
  return fighters;
}

/**
 * Shared arena coordinates (7×4, row 0 = far edge from seat 0). Seat 0's front
 * row sits on row 2 at the tide line; seat 1 is mirrored onto rows 1..0.
 */
export function arenaCell(seat: number, boardIndex: number): { col: number; row: number } {
  const col = boardIndex % BOARD_COLS;
  const local = Math.floor(boardIndex / BOARD_COLS);
  return seat === 0
    ? { col, row: BOARD_ROWS + local }
    : { col: BOARD_COLS - 1 - col, row: BOARD_ROWS - 1 - local };
}

function manhattan(a: CombatFighter, b: CombatFighter): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function runCombat(
  genre: AutoBattlerGenre,
  seed: number,
  sequence: number,
): { winnerSeat: number | null; damage: number; log: CombatLogEntry[] } {
  const log: CombatLogEntry[] = [{ kind: "combat_start", round: genre.round }];
  let fighters = [
    ...boardToFighters(0, genre.seats[0].board),
    ...boardToFighters(1, genre.seats[1].board),
  ];
  const rng = createSeededRng(seed);
  let tick = 0;
  while (tick < MAX_COMBAT_TICKS) {
    const living0 = fighters.filter((f) => f.owner === 0 && f.hp > 0);
    const living1 = fighters.filter((f) => f.owner === 1 && f.hp > 0);
    if (living0.length === 0 || living1.length === 0) break;

    // Deterministic attack order: by uid, then seeded jitter.
    const order = [...fighters]
      .filter((f) => f.hp > 0)
      .sort((a, b) => {
        const ja = rng.at(sequence + 100 + tick * 17 + a.uid.length) % 97;
        const jb = rng.at(sequence + 100 + tick * 17 + b.uid.length) % 97;
        if (ja !== jb) return ja - jb;
        return a.uid.localeCompare(b.uid);
      });

    for (const attacker of order) {
      if (attacker.hp <= 0) continue;
      const enemies = fighters.filter(
        (f) => f.owner !== attacker.owner && f.hp > 0,
      );
      if (!enemies.length) break;
      enemies.sort((a, b) => {
        const da = manhattan(attacker, a);
        const db = manhattan(attacker, b);
        if (da !== db) return da - db;
        return a.uid.localeCompare(b.uid);
      });
      const target = enemies[0]!;
      target.hp -= attacker.atk;
      log.push({
        kind: "strike",
        attackerUid: attacker.uid,
        targetUid: target.uid,
        damage: attacker.atk,
        targetHp: Math.max(0, target.hp),
      });
      if (target.hp <= 0) {
        target.hp = 0;
        log.push({ kind: "unit_down", uid: target.uid, owner: target.owner });
      }
    }
    fighters = fighters.filter((f) => f.hp > 0);
    tick += 1;
  }

  const alive0 = fighters.filter((f) => f.owner === 0 && f.hp > 0).length;
  const alive1 = fighters.filter((f) => f.owner === 1 && f.hp > 0).length;
  let winnerSeat: number | null = null;
  if (alive0 > 0 && alive1 === 0) winnerSeat = 0;
  else if (alive1 > 0 && alive0 === 0) winnerSeat = 1;
  const survivors = winnerSeat === 0 ? alive0 : winnerSeat === 1 ? alive1 : 0;
  const damage = winnerSeat === null ? 0 : 2 + survivors;
  log.push({
    kind: "combat_end",
    winnerSeat,
    damageToLoser: damage,
  });
  return { winnerSeat, damage, log };
}

function bothReady(genre: AutoBattlerGenre): boolean {
  return genre.seats[0].ready && genre.seats[1].ready;
}

function clearReady(genre: AutoBattlerGenre): void {
  genre.seats[0].ready = false;
  genre.seats[1].ready = false;
}

function startShopRound(
  genre: AutoBattlerGenre,
  seed: number,
  sequence: number,
): void {
  genre.round += 1;
  for (let seat = 0; seat < 2; seat += 1) {
    const s = genre.seats[seat]!;
    grantIncome(s);
    s.shop = rollShop(seed, sequence + seat * 31 + genre.round * 97, SHOP_SIZE);
    s.ready = false;
  }
}

export const autoBattlerAdapter: PlayKernelAdapter<
  AutoBattlerGenre,
  AutoBattlerConfig
> = {
  kernelType: AUTO_BATTLER_KERNEL_TYPE,
  parseConfig: parseAutoBattlerConfig,
  createGenreState(_config, seed) {
    const genre: AutoBattlerGenre = {
      round: 1,
      seats: [
        {
          gold: START_GOLD,
          hp: START_HP,
          shop: rollShop(seed, 1, SHOP_SIZE),
          bench: emptySlots(BENCH_SLOTS),
          board: emptySlots(BOARD_SLOTS),
          ready: false,
        },
        {
          gold: START_GOLD,
          hp: START_HP,
          shop: rollShop(seed, 2, SHOP_SIZE),
          bench: emptySlots(BENCH_SLOTS),
          board: emptySlots(BOARD_SLOTS),
          ready: false,
        },
      ],
      combatLog: [],
      lastCombat: null,
      nextUid: 1,
    };
    return genre;
  },
  initialPhase() {
    return "shop";
  },
  listLegalActions(state, playerId) {
    if (
      state.status !== "active" ||
      playerId !== state.activePlayerId ||
      (state.phase !== "shop" && state.phase !== "place")
    ) {
      return [];
    }
    const seat = state.genre.seats[playerId];
    if (!seat || seat.ready) return [];
    const legal: Array<{ type: string; label: string; payload?: Record<string, unknown> }> = [];
    const name = (piece: Piece) => UNIT_BY_ID[piece.unitId]?.name ?? piece.unitId;
    if (state.phase === "shop") {
      seat.shop.forEach((unitId, shopIndex) => {
        const def = UNIT_BY_ID[unitId];
        if (def && seat.gold >= def.cost && firstEmpty(seat.bench) >= 0) {
          legal.push({ type: "buy", label: `购买 ${def.name}`, payload: { shopIndex } });
        }
      });
      if (seat.gold >= REFRESH_COST) legal.push({ type: "refresh", label: "刷新商店" });
    }
    // Arrange (drag) + sell are legal in both prep phases; locked during combat.
    seat.bench.forEach((piece, benchIndex) => {
      if (!piece) return;
      legal.push({ type: "sell", label: `出售 ${name(piece)}`, payload: { benchIndex } });
      seat.board.forEach((cell, boardIndex) => {
        if (!cell) legal.push({ type: "place", label: `上阵 ${name(piece)}`, payload: { benchIndex, boardIndex } });
      });
    });
    seat.board.forEach((piece, boardIndex) => {
      if (!piece) return;
      legal.push({ type: "sell", label: `出售 ${name(piece)}`, payload: { boardIndex } });
      if (firstEmpty(seat.bench) >= 0) {
        legal.push({ type: "recall", label: `撤回 ${name(piece)}`, payload: { boardIndex } });
      }
      seat.board.forEach((cell, to) => {
        if (!cell) legal.push({ type: "move", label: `移动 ${name(piece)}`, payload: { from: boardIndex, to } });
      });
    });
    legal.push(
      state.phase === "shop"
        ? { type: "ready_shop", label: "准备完毕" }
        : { type: "ready_place", label: "锁定阵容" },
    );
    return legal;
  },
  reduce(state, action) {
    if (
      state.status !== "active" ||
      action.playerId !== state.activePlayerId ||
      (state.phase !== "shop" && state.phase !== "place")
    ) {
      return null;
    }
    const phase = state.phase as "shop" | "place";
    const genre = cloneGenre(state.genre);
    const seat = genre.seats[action.playerId];
    if (!seat || seat.ready) return null;
    const other = action.playerId === 0 ? 1 : 0;
    const stay = () => ({
      genre,
      phase,
      activePlayerId: action.playerId,
      status: "active" as const,
      winnerId: null,
    });
    const index = (key: string, length: number): number | null => {
      const value = action.payload?.[key];
      return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < length ? value : null;
    };

    if (action.type === "buy") {
      if (phase !== "shop") return null;
      const shopIndex = index("shopIndex", seat.shop.length);
      if (shopIndex === null) return null;
      const def = UNIT_BY_ID[seat.shop[shopIndex] ?? ""];
      const slot = firstEmpty(seat.bench);
      if (!def || seat.gold < def.cost || slot < 0) return null;
      const piece = makePiece(genre, def.id, action.playerId);
      if (!piece) return null;
      seat.gold -= def.cost;
      seat.bench[slot] = piece;
      seat.shop[shopIndex] = ""; // sold-out slot
      return stay();
    }
    if (action.type === "refresh") {
      if (phase !== "shop" || action.payload !== undefined || seat.gold < REFRESH_COST) return null;
      seat.gold -= REFRESH_COST;
      seat.shop = rollShop(state.seed, state.sequence + 50 + action.playerId, SHOP_SIZE);
      return stay();
    }
    if (action.type === "sell") {
      const benchIndex = index("benchIndex", seat.bench.length);
      const boardIndex = index("boardIndex", seat.board.length);
      if ((benchIndex === null) === (boardIndex === null)) return null;
      const slots = benchIndex !== null ? seat.bench : seat.board;
      const at = (benchIndex ?? boardIndex)!;
      const piece = slots[at];
      const def = piece ? UNIT_BY_ID[piece.unitId] : undefined;
      if (!piece || !def) return null;
      slots[at] = null;
      seat.gold += Math.max(1, Math.floor(def.cost * SELL_REFUND_RATIO));
      return stay();
    }
    if (action.type === "place") {
      const benchIndex = index("benchIndex", seat.bench.length);
      const boardIndex = index("boardIndex", seat.board.length);
      if (benchIndex === null || boardIndex === null) return null;
      const piece = seat.bench[benchIndex];
      if (!piece || seat.board[boardIndex]) return null;
      seat.board[boardIndex] = piece;
      seat.bench[benchIndex] = null;
      return stay();
    }
    if (action.type === "move") {
      const from = index("from", seat.board.length);
      const to = index("to", seat.board.length);
      if (from === null || to === null || from === to) return null;
      const piece = seat.board[from];
      if (!piece || seat.board[to]) return null;
      seat.board[to] = piece;
      seat.board[from] = null;
      return stay();
    }
    if (action.type === "recall") {
      const boardIndex = index("boardIndex", seat.board.length);
      if (boardIndex === null) return null;
      const piece = seat.board[boardIndex];
      const slot = firstEmpty(seat.bench);
      if (!piece || slot < 0) return null;
      seat.bench[slot] = piece;
      seat.board[boardIndex] = null;
      return stay();
    }
    if (action.type === "ready_shop") {
      if (phase !== "shop" || action.payload !== undefined) return null;
      seat.ready = true;
      if (!bothReady(genre)) {
        return { genre, phase: "shop", activePlayerId: other, status: "active", winnerId: null };
      }
      clearReady(genre);
      return { genre, phase: "place", activePlayerId: 0, status: "active", winnerId: null };
    }
    if (action.type === "ready_place") {
      if (phase !== "place" || action.payload !== undefined) return null;
      seat.ready = true;
      if (!bothReady(genre)) {
        return { genre, phase: "place", activePlayerId: other, status: "active", winnerId: null };
      }
      // Combat + resolve inside this reduce (authoritative).
      const result = runCombat(genre, state.seed, state.sequence);
      genre.combatLog = result.log;
      genre.lastCombat = { winnerSeat: result.winnerSeat, damage: result.damage };
      if (result.winnerSeat !== null) {
        genre.seats[result.winnerSeat === 0 ? 1 : 0]!.hp -= result.damage;
      }
      for (const s of genre.seats) s.ready = false;
      if (genre.seats[0].hp <= 0 || genre.seats[1].hp <= 0) {
        const winnerId =
          genre.seats[0].hp <= 0 && genre.seats[1].hp <= 0 ? null : genre.seats[0].hp <= 0 ? 1 : 0;
        return {
          genre,
          phase: "ended",
          activePlayerId: action.playerId,
          status: "complete",
          winnerId,
          endReason: "hp_depleted",
        };
      }
      startShopRound(genre, state.seed, state.sequence);
      return { genre, phase: "shop", activePlayerId: 0, status: "active", winnerId: null };
    }
    return null;
  },
};

export function autoBattlerToSessionFields(state: PlayState<AutoBattlerGenre>) {
  const g = state.genre;
  return {
    turn: state.sequence,
    activeSeat: state.activePlayerId,
    scores: [g.seats[0].hp, g.seats[1].hp],
    status: state.status,
    winnerSeat: state.winnerId,
    autoBattler: {
      phase: state.phase as AutoBattlerPhase,
      round: g.round,
      seats: [
        {
          gold: g.seats[0].gold,
          hp: g.seats[0].hp,
          shop: [...g.seats[0].shop],
          bench: g.seats[0].bench.map((p) => (p ? { ...p } : null)),
          board: g.seats[0].board.map((p) => (p ? { ...p } : null)),
          ready: g.seats[0].ready,
          synergies: activeSynergies(g.seats[0].board),
        },
        {
          gold: g.seats[1].gold,
          hp: g.seats[1].hp,
          shop: [...g.seats[1].shop],
          bench: g.seats[1].bench.map((p) => (p ? { ...p } : null)),
          board: g.seats[1].board.map((p) => (p ? { ...p } : null)),
          ready: g.seats[1].ready,
          synergies: activeSynergies(g.seats[1].board),
        },
      ] as [
        SeatState & { synergies: ReturnType<typeof activeSynergies> },
        SeatState & { synergies: ReturnType<typeof activeSynergies> },
      ],
      combatLog: [...g.combatLog],
      lastCombat: g.lastCombat ? { ...g.lastCombat } : null,
      nextUid: g.nextUid,
    },
  };
}

export function bindAutoBattlerFromRuntimeKernel(input: {
  playerCount: number;
}): PlayKernelConfig {
  if (input.playerCount !== 2) throw new Error("auto_battler_requires_two_players");
  return createAutoBattlerKernelConfig();
}

export function playActionFromAutoBattlerIntent(
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

export function pickAutoBattlerBotAction(
  state: PlayState<AutoBattlerGenre>,
  seed: number,
): PlayAction {
  const legal = autoBattlerAdapter.listLegalActions(
    state,
    state.activePlayerId,
    { playerCount: 2 },
  );
  if (!legal.length) {
    return {
      type: state.phase === "shop" ? "ready_shop" : "ready_place",
      playerId: state.activePlayerId,
    };
  }
  // Prefer buy cheapest, then place first free, else ready.
  const buy = legal
    .filter((a) => a.type === "buy")
    .sort(
      (a, b) =>
        Number(a.payload?.shopIndex ?? 0) - Number(b.payload?.shopIndex ?? 0),
    )[0];
  if (buy && createSeededRng(seed).at(state.sequence + 3) % 4 !== 0) {
    return {
      type: "buy",
      playerId: state.activePlayerId,
      payload: buy.payload,
    };
  }
  const place = legal.find((a) => a.type === "place");
  if (place) {
    return {
      type: "place",
      playerId: state.activePlayerId,
      payload: place.payload,
    };
  }
  const ready = legal.find(
    (a) => a.type === "ready_shop" || a.type === "ready_place",
  );
  if (ready) {
    return { type: ready.type, playerId: state.activePlayerId };
  }
  const pick = legal[createSeededRng(seed).at(state.sequence + 5) % legal.length]!;
  return {
    type: pick.type,
    playerId: state.activePlayerId,
    ...(pick.payload ? { payload: pick.payload } : {}),
  };
}

export function autoPlayAutoBattlerGame(seed: number, maxActions = 200) {
  const config = createAutoBattlerKernelConfig();
  let state = createInitialState(autoBattlerAdapter, config, seed);
  const actions: PlayAction[] = [];
  while (state.status === "active" && actions.length < maxActions) {
    const action = pickAutoBattlerBotAction(state, seed);
    const result = applyAction(autoBattlerAdapter, state, action, config);
    if (!result.ok) throw new Error(`auto_battler_auto_play_illegal:${result.reason}`);
    actions.push(action);
    state = result.state;
  }
  return { state, actions };
}

/** Session blob shape (synergies.trait may be widened to string across the wire). */
export type AutoBattlerSessionBlob = {
  phase: AutoBattlerPhase;
  round: number;
  seats: [
    {
      gold: number;
      hp: number;
      shop: string[];
      bench: Array<Piece | null>;
      board: Array<Piece | null>;
      ready: boolean;
      synergies?: Array<{ trait: string; count: number; label: string }>;
    },
    {
      gold: number;
      hp: number;
      shop: string[];
      bench: Array<Piece | null>;
      board: Array<Piece | null>;
      ready: boolean;
      synergies?: Array<{ trait: string; count: number; label: string }>;
    },
  ];
  combatLog: CombatLogEntry[] | Array<Record<string, unknown>>;
  lastCombat: { winnerSeat: number | null; damage: number } | null;
  nextUid: number;
};

/** Reconstruct PlayState genre from SessionState.autoBattler blob. */
export function sessionAutoBattlerToGenre(
  blob: AutoBattlerSessionBlob,
): AutoBattlerGenre {
  return {
    round: blob.round,
    seats: [
      {
        gold: blob.seats[0].gold,
        hp: blob.seats[0].hp,
        shop: [...blob.seats[0].shop],
        bench: blob.seats[0].bench.map((p) => (p ? { ...p } : null)),
        board: blob.seats[0].board.map((p) => (p ? { ...p } : null)),
        ready: blob.seats[0].ready,
      },
      {
        gold: blob.seats[1].gold,
        hp: blob.seats[1].hp,
        shop: [...blob.seats[1].shop],
        bench: blob.seats[1].bench.map((p) => (p ? { ...p } : null)),
        board: blob.seats[1].board.map((p) => (p ? { ...p } : null)),
        ready: blob.seats[1].ready,
      },
    ],
    combatLog: [...blob.combatLog] as CombatLogEntry[],
    lastCombat: blob.lastCombat ? { ...blob.lastCombat } : null,
    nextUid: blob.nextUid,
  };
}
