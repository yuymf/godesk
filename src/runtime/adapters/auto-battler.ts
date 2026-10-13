/**
 * Tide Arena / 潮阵 — Executable Kernel `auto-battler-v1`.
 * Product name only: Tide Arena / 潮阵 (never third-party auto-battler brands).
 *
 * Loop: shop → place → combat → resolve → next shop; end when seat HP ≤ 0.
 * Step5: ★2 merge, 10–12 units, trait heal/trigger events, authoritative prep timer.
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
export const START_LEVEL = 3;
export const MAX_LEVEL = 9;
/** Gold cost to buy XP (TFT-style 「升级」). */
export const BUY_XP_COST = 4;
/** XP granted per purchase; level-up when xp >= xpToNext(level). */
export const XP_PER_BUY = 4;
export const MAX_COMBAT_TICKS = 64;
export const SELL_REFUND_RATIO = 0.5;
export const PREP_SHOP_SECONDS = 45;
export const PREP_PLACE_SECONDS = 30;

/** Injectable clock for deterministic prep-timer tests. */
export let autoBattlerNow: () => number = () => Date.now();
export function setAutoBattlerNow(fn: () => number): void {
  autoBattlerNow = fn;
}
export function resetAutoBattlerNow(): void {
  autoBattlerNow = () => Date.now();
}

/** XP needed to advance from `level` → level+1 (flat ladder, simplest). */
export function xpToNext(_level: number): number {
  return XP_PER_BUY;
}

/** Board unit cap = current level (clamped to board slots). */
export function boardCap(level: number): number {
  return Math.min(Math.max(1, level), BOARD_SLOTS);
}

/** ★★ ×1.8, ★★★ ×3.2 (★3 merge deferred). */
export function starMult(stars: number): number {
  if (stars >= 3) return 3.2;
  if (stars >= 2) return 1.8;
  return 1;
}

export type TraitId = "tide" | "shell" | "coral" | "voyager";
export type StarLevel = 1 | 2 | 3;

export type UnitDef = {
  id: string;
  name: string;
  cost: number;
  atk: number;
  hp: number;
  traits: readonly TraitId[];
};

/** Original Tide Arena roster (10–12 sea-themed; no third-party names). */
export const UNIT_CATALOG: readonly UnitDef[] = [
  { id: "crab", name: "礁蟹", cost: 1, atk: 45, hp: 650, traits: ["shell", "tide"] },
  { id: "conch", name: "螺号卫", cost: 1, atk: 40, hp: 700, traits: ["shell"] },
  { id: "blade", name: "潮刃", cost: 2, atk: 70, hp: 550, traits: ["tide"] },
  { id: "archer", name: "飞鱼弓", cost: 2, atk: 60, hp: 450, traits: ["voyager"] },
  { id: "rider", name: "浪脊骑", cost: 2, atk: 65, hp: 520, traits: ["tide", "voyager"] },
  { id: "anemone", name: "海葵师", cost: 2, atk: 55, hp: 500, traits: ["coral"] },
  { id: "witch", name: "珊瑚巫", cost: 3, atk: 50, hp: 600, traits: ["coral"] },
  { id: "priest", name: "潮汐祭司", cost: 3, atk: 48, hp: 620, traits: ["tide", "coral"] },
  { id: "turtle", name: "珍珠龟", cost: 3, atk: 42, hp: 900, traits: ["shell", "voyager"] },
  { id: "whale", name: "鲸盾", cost: 4, atk: 55, hp: 1100, traits: ["shell"] },
  { id: "lantern", name: "雾灯人", cost: 4, atk: 75, hp: 700, traits: ["voyager"] },
  { id: "spirit", name: "海风灵", cost: 5, atk: 85, hp: 800, traits: ["voyager", "tide"] },
] as const;

const UNIT_BY_ID: Record<string, UnitDef> = Object.fromEntries(
  UNIT_CATALOG.map((unit) => [unit.id, unit]),
);

/**
 * Synergies: trait count ≥2 changes combat stats; timed / heal / extra-hit
 * effects emit heal / trait_trigger combat-log events (Step5).
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
  stars: StarLevel;
  atk: number;
  hp: number;
  maxHp: number;
};

export type SeatState = {
  gold: number;
  hp: number;
  level: number;
  xp: number;
  shop: string[];
  bench: Array<Piece | null>;
  board: Array<Piece | null>;
  ready: boolean;
};

export type CombatLogEntry =
  | { kind: "combat_start"; round: number }
  | { kind: "strike"; attackerUid: string; targetUid: string; damage: number; targetHp: number }
  | { kind: "heal"; uid: string; amount: number; targetHp: number }
  | { kind: "trait_trigger"; trait: TraitId; label: string; detail?: string }
  | { kind: "unit_down"; uid: string; owner: number }
  | { kind: "combat_end"; winnerSeat: number | null; damageToLoser: number };

export type AutoBattlerConfig = { playerCount: number };

export type AutoBattlerGenre = {
  round: number;
  seats: [SeatState, SeatState];
  combatLog: CombatLogEntry[];
  lastCombat: { winnerSeat: number | null; damage: number } | null;
  nextUid: number;
  /** Epoch ms; client displays remaining seconds; worker auto-locks at expiry. */
  prepEndsAt: number;
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
    level: seat.level,
    xp: seat.xp,
    shop: [...seat.shop],
    bench: seat.bench.map((piece) => (piece ? { ...piece } : null)),
    board: seat.board.map((piece) => (piece ? { ...piece } : null)),
    ready: seat.ready,
  };
}

function boardCount(seat: SeatState): number {
  return seat.board.reduce((n, p) => n + (p ? 1 : 0), 0);
}

/** Apply purchased XP; auto-level while xp fills (no leftover compat layer). */
function applyBuyXp(seat: SeatState): void {
  seat.xp += XP_PER_BUY;
  while (seat.level < MAX_LEVEL && seat.xp >= xpToNext(seat.level)) {
    seat.xp -= xpToNext(seat.level);
    seat.level += 1;
  }
  if (seat.level >= MAX_LEVEL) seat.xp = 0;
}

function cloneGenre(genre: AutoBattlerGenre): AutoBattlerGenre {
  return {
    round: genre.round,
    seats: [cloneSeat(genre.seats[0]), cloneSeat(genre.seats[1])],
    combatLog: [...genre.combatLog],
    lastCombat: genre.lastCombat ? { ...genre.lastCombat } : null,
    nextUid: genre.nextUid,
    prepEndsAt: genre.prepEndsAt,
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

function scaledStats(def: UnitDef, stars: StarLevel): { atk: number; hp: number } {
  const m = starMult(stars);
  return { atk: Math.round(def.atk * m), hp: Math.round(def.hp * m) };
}

function makePiece(
  genre: AutoBattlerGenre,
  unitId: string,
  owner: number,
  stars: StarLevel = 1,
): Piece | null {
  const def = UNIT_BY_ID[unitId];
  if (!def) return null;
  const uid = `p${genre.nextUid}`;
  genre.nextUid += 1;
  const stats = scaledStats(def, stars);
  return {
    uid,
    unitId: def.id,
    owner,
    stars,
    atk: stats.atk,
    hp: stats.hp,
    maxHp: stats.hp,
  };
}

function sellRefund(def: UnitDef, stars: StarLevel): number {
  return Math.max(1, Math.floor(def.cost * SELL_REFUND_RATIO * stars));
}

/**
 * ★2 merge: any three ★1 of the same unitId across board+bench → one ★2.
 * ★3 deferred (interface allows stars=3 but no merge path yet).
 */
function tryMergeSeat(seat: SeatState, genre: AutoBattlerGenre): void {
  let changed = true;
  while (changed) {
    changed = false;
    const groups = new Map<string, Array<{ where: "board" | "bench"; index: number; piece: Piece }>>();
    const collect = (where: "board" | "bench", slots: Array<Piece | null>) => {
      slots.forEach((piece, index) => {
        if (!piece || piece.stars !== 1) return;
        const list = groups.get(piece.unitId) ?? [];
        list.push({ where, index, piece });
        groups.set(piece.unitId, list);
      });
    };
    collect("board", seat.board);
    collect("bench", seat.bench);
    for (const [, list] of groups) {
      if (list.length < 3) continue;
      const keep = list[0]!;
      const dropA = list[1]!;
      const dropB = list[2]!;
      const merged = makePiece(genre, keep.piece.unitId, keep.piece.owner, 2);
      if (!merged) continue;
      // Prefer keeping the keep slot; free the other two.
      const keepSlots = keep.where === "board" ? seat.board : seat.bench;
      keepSlots[keep.index] = merged;
      (dropA.where === "board" ? seat.board : seat.bench)[dropA.index] = null;
      (dropB.where === "board" ? seat.board : seat.bench)[dropB.index] = null;
      changed = true;
      break;
    }
  }
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
  const counts = traitCounts(board);
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
  const base = scaledStats(def, piece.stars);
  let atk = base.atk;
  let hp = base.hp;
  for (const entry of syn) {
    const bonus = TRAIT_SYNERGIES[entry.trait];
    atk += bonus.atkBonus;
    hp += bonus.hpBonus;
  }
  return { ...piece, atk, hp, maxHp: hp };
}

type CombatFighter = Piece & { x: number; y: number; firstStrikeDone?: boolean };

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
    fighters.push({ ...buffed, x: cell.col, y: cell.row, firstStrikeDone: false });
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

function tideShieldAmount(count: number): number {
  if (count >= 6) return 90;
  if (count >= 4) return 45;
  if (count >= 2) return 20;
  return 0;
}

function coralHealRatio(count: number): number {
  if (count >= 3) return 0.4;
  if (count >= 2) return 0.2;
  return 0;
}

function applyHeal(
  fighters: CombatFighter[],
  uid: string,
  amount: number,
  log: CombatLogEntry[],
): void {
  const target = fighters.find((f) => f.uid === uid && f.hp > 0);
  if (!target || amount <= 0) return;
  const room = target.maxHp - target.hp;
  let gained = Math.min(room, amount);
  if (gained <= 0) {
    // Full HP: treat as a brief shield (raise max + current) so heal events still fire.
    target.maxHp += amount;
    target.hp += amount;
    gained = amount;
  } else {
    target.hp += gained;
  }
  log.push({ kind: "heal", uid, amount: gained, targetHp: target.hp });
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
  const syn0 = activeSynergies(genre.seats[0].board);
  const syn1 = activeSynergies(genre.seats[1].board);
  const counts0 = traitCounts(genre.seats[0].board);
  const counts1 = traitCounts(genre.seats[1].board);

  // Tide surge at combat start: shield (heal) all living allies.
  for (const [owner, syn, counts] of [
    [0, syn0, counts0] as const,
    [1, syn1, counts1] as const,
  ]) {
    if (!syn.some((s) => s.trait === "tide")) continue;
    const amount = tideShieldAmount(counts.tide);
    if (amount <= 0) continue;
    log.push({
      kind: "trait_trigger",
      trait: "tide",
      label: TRAIT_SYNERGIES.tide.label,
      detail: `潮涌护盾 +${amount}`,
    });
    for (const f of fighters.filter((x) => x.owner === owner && x.hp > 0)) {
      applyHeal(fighters, f.uid, amount, log);
    }
  }
  if (syn0.some((s) => s.trait === "shell") || syn1.some((s) => s.trait === "shell")) {
    for (const [owner, syn] of [[0, syn0] as const, [1, syn1] as const]) {
      if (!syn.some((s) => s.trait === "shell")) continue;
      log.push({
        kind: "trait_trigger",
        trait: "shell",
        label: TRAIT_SYNERGIES.shell.label,
        detail: counts0.shell >= 4 || counts1.shell >= 4 ? "硬壳反射就绪" : "硬壳加持",
      });
      void owner;
    }
  }
  for (const [syn] of [[syn0] as const, [syn1] as const]) {
    if (syn.some((s) => s.trait === "coral")) {
      log.push({
        kind: "trait_trigger",
        trait: "coral",
        label: TRAIT_SYNERGIES.coral.label,
        detail: "珊瑚愈伤",
      });
      break;
    }
  }
  for (const [syn] of [[syn0] as const, [syn1] as const]) {
    if (syn.some((s) => s.trait === "voyager")) {
      log.push({
        kind: "trait_trigger",
        trait: "voyager",
        label: TRAIT_SYNERGIES.voyager.label,
        detail: "远航追击",
      });
      break;
    }
  }

  const coralHealUsed = new Set<number>(); // per owner: first coral strike heals
  let tick = 0;
  while (tick < MAX_COMBAT_TICKS) {
    const living0 = fighters.filter((f) => f.owner === 0 && f.hp > 0);
    const living1 = fighters.filter((f) => f.owner === 1 && f.hp > 0);
    if (living0.length === 0 || living1.length === 0) break;

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
      const deal = (dmg: number) => {
        target.hp -= dmg;
        log.push({
          kind: "strike",
          attackerUid: attacker.uid,
          targetUid: target.uid,
          damage: dmg,
          targetHp: Math.max(0, target.hp),
        });
        // Shell (4): reflect 10% of melee damage back.
        const shellCount = attacker.owner === 0 ? counts1.shell : counts0.shell;
        const targetDef = UNIT_BY_ID[target.unitId];
        if (shellCount >= 4 && targetDef?.traits.includes("shell") && target.hp > 0) {
          const reflect = Math.max(1, Math.floor(dmg * 0.1));
          attacker.hp -= reflect;
          log.push({
            kind: "strike",
            attackerUid: target.uid,
            targetUid: attacker.uid,
            damage: reflect,
            targetHp: Math.max(0, attacker.hp),
          });
          if (attacker.hp <= 0) {
            attacker.hp = 0;
            log.push({ kind: "unit_down", uid: attacker.uid, owner: attacker.owner });
          }
        }
        if (target.hp <= 0) {
          target.hp = 0;
          log.push({ kind: "unit_down", uid: target.uid, owner: target.owner });
        }
      };

      deal(attacker.atk);

      // Coral: first strike from a coral unit heals lowest-hp ally.
      const atkDef = UNIT_BY_ID[attacker.unitId];
      const coralCount = attacker.owner === 0 ? counts0.coral : counts1.coral;
      if (
        atkDef?.traits.includes("coral") &&
        coralCount >= 2 &&
        !coralHealUsed.has(attacker.owner)
      ) {
        coralHealUsed.add(attacker.owner);
        const ratio = coralHealRatio(coralCount);
        const allies = fighters.filter((f) => f.owner === attacker.owner && f.hp > 0);
        allies.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || a.uid.localeCompare(b.uid));
        const needy = allies[0];
        if (needy) applyHeal(fighters, needy.uid, Math.max(1, Math.floor(attacker.atk * ratio)), log);
      }

      // Voyager: first attack fires an extra hit at 50% damage.
      const voyCount = attacker.owner === 0 ? counts0.voyager : counts1.voyager;
      if (
        atkDef?.traits.includes("voyager") &&
        voyCount >= 2 &&
        !attacker.firstStrikeDone &&
        target.hp > 0
      ) {
        attacker.firstStrikeDone = true;
        deal(Math.max(1, Math.floor(attacker.atk * 0.5)));
      } else {
        attacker.firstStrikeDone = true;
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

function setPrepDeadline(genre: AutoBattlerGenre, phase: "shop" | "place"): void {
  const sec = phase === "shop" ? PREP_SHOP_SECONDS : PREP_PLACE_SECONDS;
  genre.prepEndsAt = autoBattlerNow() + sec * 1000;
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
  setPrepDeadline(genre, "shop");
}

function emptySeat(seed: number, seq: number): SeatState {
  return {
    gold: START_GOLD,
    hp: START_HP,
    level: START_LEVEL,
    xp: 0,
    shop: rollShop(seed, seq, SHOP_SIZE),
    bench: emptySlots(BENCH_SLOTS),
    board: emptySlots(BOARD_SLOTS),
    ready: false,
  };
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
      seats: [emptySeat(seed, 1), emptySeat(seed, 2)],
      combatLog: [],
      lastCombat: null,
      nextUid: 1,
      prepEndsAt: 0,
    };
    setPrepDeadline(genre, "shop");
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
      if (seat.level < MAX_LEVEL && seat.gold >= BUY_XP_COST) {
        legal.push({ type: "buy_xp", label: "升级" });
      }
    }
    const cap = boardCap(seat.level);
    const onBoard = boardCount(seat);
    seat.bench.forEach((piece, benchIndex) => {
      if (!piece) return;
      legal.push({ type: "sell", label: `出售 ${name(piece)}`, payload: { benchIndex } });
      if (onBoard >= cap) return;
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
      seat.shop[shopIndex] = "";
      tryMergeSeat(seat, genre);
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
      seat.gold += sellRefund(def, piece.stars);
      return stay();
    }
    if (action.type === "buy_xp") {
      if (phase !== "shop" || action.payload !== undefined) return null;
      if (seat.level >= MAX_LEVEL || seat.gold < BUY_XP_COST) return null;
      seat.gold -= BUY_XP_COST;
      applyBuyXp(seat);
      return stay();
    }
    if (action.type === "place") {
      const benchIndex = index("benchIndex", seat.bench.length);
      const boardIndex = index("boardIndex", seat.board.length);
      if (benchIndex === null || boardIndex === null) return null;
      const piece = seat.bench[benchIndex];
      if (!piece || seat.board[boardIndex]) return null;
      if (boardCount(seat) >= boardCap(seat.level)) return null;
      seat.board[boardIndex] = piece;
      seat.bench[benchIndex] = null;
      tryMergeSeat(seat, genre);
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
      tryMergeSeat(seat, genre);
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
      tryMergeSeat(seat, genre);
      return stay();
    }
    if (action.type === "ready_shop") {
      if (phase !== "shop" || action.payload !== undefined) return null;
      seat.ready = true;
      if (!bothReady(genre)) {
        return { genre, phase: "shop", activePlayerId: other, status: "active", winnerId: null };
      }
      clearReady(genre);
      setPrepDeadline(genre, "place");
      return { genre, phase: "place", activePlayerId: 0, status: "active", winnerId: null };
    }
    if (action.type === "ready_place") {
      if (phase !== "place" || action.payload !== undefined) return null;
      seat.ready = true;
      if (!bothReady(genre)) {
        return { genre, phase: "place", activePlayerId: other, status: "active", winnerId: null };
      }
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

function seatToSession(seat: SeatState) {
  return {
    gold: seat.gold,
    hp: seat.hp,
    level: seat.level,
    xp: seat.xp,
    shop: [...seat.shop],
    bench: seat.bench.map((p) => (p ? { ...p } : null)),
    board: seat.board.map((p) => (p ? { ...p } : null)),
    ready: seat.ready,
    synergies: activeSynergies(seat.board),
  };
}

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
      prepEndsAt: g.prepEndsAt,
      seats: [seatToSession(g.seats[0]), seatToSession(g.seats[1])] as [
        ReturnType<typeof seatToSession>,
        ReturnType<typeof seatToSession>,
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

/**
 * When prepEndsAt has passed, force ready_shop / ready_place for every seat that
 * is not yet ready (worker / Shared Session authority). Returns null if no-op.
 */
export function applyAutoBattlerPrepTimeout(
  state: PlayState<AutoBattlerGenre>,
  config: PlayKernelConfig,
  nowMs = autoBattlerNow(),
): PlayState<AutoBattlerGenre> | null {
  if (state.status !== "active") return null;
  if (state.phase !== "shop" && state.phase !== "place") return null;
  if (nowMs < state.genre.prepEndsAt) return null;
  let current = state;
  // Cap iterations: force ready through shop→place→combat when the clock is overdue.
  for (let i = 0; i < 8; i += 1) {
    if (current.status !== "active") break;
    if (current.phase !== "shop" && current.phase !== "place") break;
    if (nowMs < current.genre.prepEndsAt) break;
    const seat = current.genre.seats[current.activePlayerId];
    if (!seat || seat.ready) break;
    const readyType = current.phase === "shop" ? "ready_shop" : "ready_place";
    const result = applyAction(
      autoBattlerAdapter,
      current,
      { type: readyType, playerId: current.activePlayerId },
      config,
    );
    if (!result.ok) break;
    current = result.state;
  }
  return current === state ? null : current;
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
  const seat = state.genre.seats[state.activePlayerId]!;
  const onBoard = boardCount(seat);
  const cap = boardCap(seat.level);

  // Always place when possible so Shared Session / e2e see enemy pieces.
  const place = legal.find((a) => a.type === "place");
  if (place && onBoard < cap) {
    return {
      type: "place",
      playerId: state.activePlayerId,
      payload: place.payload,
    };
  }

  const buy = legal
    .filter((a) => a.type === "buy")
    .sort(
      (a, b) =>
        Number(a.payload?.shopIndex ?? 0) - Number(b.payload?.shopIndex ?? 0),
    )[0];
  // Buy while gold allows and board/bench can still grow; rarely skip.
  if (buy && (onBoard < cap || firstEmpty(seat.bench) >= 0)) {
    if (createSeededRng(seed).at(state.sequence + 3) % 5 !== 0 || onBoard === 0) {
      return {
        type: "buy",
        playerId: state.activePlayerId,
        payload: buy.payload,
      };
    }
  }

  // Do not ready with an empty board if we can still buy or place.
  const ready = legal.find(
    (a) => a.type === "ready_shop" || a.type === "ready_place",
  );
  if (onBoard === 0 && (buy || place)) {
    if (place) {
      return { type: "place", playerId: state.activePlayerId, payload: place.payload };
    }
    if (buy) {
      return { type: "buy", playerId: state.activePlayerId, payload: buy.payload };
    }
  }

  const buyXp = legal.find((a) => a.type === "buy_xp");
  if (buyXp && onBoard >= cap && createSeededRng(seed).at(state.sequence + 7) % 3 !== 0) {
    return { type: "buy_xp", playerId: state.activePlayerId };
  }

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
  // Freeze the clock so prepEndsAt (and thus state hashes) stay deterministic.
  const frozen = 1_700_000_000_000 + seed * 97;
  const prev = autoBattlerNow;
  autoBattlerNow = () => frozen;
  try {
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
  } finally {
    autoBattlerNow = prev;
  }
}

/** Wire piece may carry stars as a plain number. */
type WirePiece = Omit<Piece, "stars"> & { stars?: number };

/** Session blob shape (synergies.trait may be widened to string across the wire). */
export type AutoBattlerSessionBlob = {
  phase: AutoBattlerPhase;
  round: number;
  prepEndsAt?: number;
  seats: [
    {
      gold: number;
      hp: number;
      level?: number;
      xp?: number;
      shop: string[];
      bench: Array<WirePiece | null>;
      board: Array<WirePiece | null>;
      ready: boolean;
      synergies?: Array<{ trait: string; count: number; label: string }>;
    },
    {
      gold: number;
      hp: number;
      level?: number;
      xp?: number;
      shop: string[];
      bench: Array<WirePiece | null>;
      board: Array<WirePiece | null>;
      ready: boolean;
      synergies?: Array<{ trait: string; count: number; label: string }>;
    },
  ];
  combatLog: CombatLogEntry[] | Array<Record<string, unknown>>;
  lastCombat: { winnerSeat: number | null; damage: number } | null;
  nextUid: number;
};

function normalizePiece(p: WirePiece | null): Piece | null {
  if (!p) return null;
  const stars: StarLevel = p.stars === 2 || p.stars === 3 ? p.stars : 1;
  return { ...p, stars };
}

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
        level: blob.seats[0].level ?? START_LEVEL,
        xp: blob.seats[0].xp ?? 0,
        shop: [...blob.seats[0].shop],
        bench: blob.seats[0].bench.map(normalizePiece),
        board: blob.seats[0].board.map(normalizePiece),
        ready: blob.seats[0].ready,
      },
      {
        gold: blob.seats[1].gold,
        hp: blob.seats[1].hp,
        level: blob.seats[1].level ?? START_LEVEL,
        xp: blob.seats[1].xp ?? 0,
        shop: [...blob.seats[1].shop],
        bench: blob.seats[1].bench.map(normalizePiece),
        board: blob.seats[1].board.map(normalizePiece),
        ready: blob.seats[1].ready,
      },
    ],
    combatLog: [...blob.combatLog] as CombatLogEntry[],
    lastCombat: blob.lastCombat ? { ...blob.lastCombat } : null,
    nextUid: blob.nextUid,
    prepEndsAt: blob.prepEndsAt ?? autoBattlerNow() + PREP_SHOP_SECONDS * 1000,
  };
}
