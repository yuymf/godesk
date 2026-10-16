/**
 * Executable Kernel `auto-battler-v1` — generic shop → bench → board → combat → star-up.
 * Genre flavour (tide / cyber / …) lives in content+theme packs, not adapter branches.
 *
 * Loop: shop → place → combat → resolve → next shop; end when seat HP ≤ 0.
 * Step5: ★2 merge, 10–12 units, trait heal/trigger events, authoritative prep timer.
 */
import { combatReplayDurationMs } from "./combat-playback";
import {
  applyAction,
  createInitialState,
  createSeededRng,
  type PlayAction,
  type PlayKernelAdapter,
  type PlayKernelConfig,
  type PlayState,
} from "../play-kernel";
import {
  DEFAULT_AUTO_BATTLER_CONTENT,
  resolveAutoBattlerContent,
  traitTierIndex,
  type AutoBattlerContent,
  type AutoBattlerContentPatch,
  type TraitDef,
  type UnitDef,
} from "./auto-battler-content";
import type { CombatVfxEntry } from "./auto-battler-vfx";

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
export function boardCap(level: number, slots: number = BOARD_SLOTS): number {
  return Math.min(Math.max(1, level), slots);
}

/** Star multiplier from the active content's star rules (default ★★ ×1.8, ★★★ ×3.2). */
export function starMult(stars: number, content: AutoBattlerContent = active.content): number {
  if (stars >= 3) return content.stars.mult3;
  if (stars >= 2) return content.stars.mult2;
  return 1;
}

export type TraitId = string;
export type StarLevel = 1 | 2 | 3;
export type { UnitDef, TraitDef, AutoBattlerContent, AutoBattlerContentPatch };

type ResolvedContent = {
  content: AutoBattlerContent;
  byId: Record<string, UnitDef>;
  traitById: Record<string, TraitDef>;
};

function indexContent(content: AutoBattlerContent): ResolvedContent {
  return {
    content,
    byId: Object.fromEntries(content.units.map((u) => [u.id, u])),
    traitById: Object.fromEntries(content.traits.map((t) => [t.id, t])),
  };
}

const DEFAULT_RESOLVED = indexContent(DEFAULT_AUTO_BATTLER_CONTENT);
/**
 * Content in effect for the current synchronous adapter call. Adapter entry points
 * pin it from their config via withAutoBattlerContent; it is never left changed.
 */
let active: ResolvedContent = DEFAULT_RESOLVED;
const resolvedCache = new WeakMap<AutoBattlerContent, ResolvedContent>();

export function withAutoBattlerContent<T>(content: AutoBattlerContent | undefined, fn: () => T): T {
  if (!content || content === active.content) return fn();
  let resolved = resolvedCache.get(content);
  if (!resolved) {
    resolved = indexContent(content);
    resolvedCache.set(content, resolved);
  }
  const previous = active;
  active = resolved;
  try {
    return fn();
  } finally {
    active = previous;
  }
}

/** Default roster (data, not logic) — kept as named exports for existing callers. */
export const UNIT_CATALOG: readonly UnitDef[] = DEFAULT_AUTO_BATTLER_CONTENT.units;

/** Trait table keyed by id for the given content (HUD rows). */
export function traitTable(content: AutoBattlerContent = active.content): Record<string, TraitDef & { min: number }> {
  return Object.fromEntries(content.traits.map((t) => [t.id, { ...t, min: t.tiers[0] ?? 2 }]));
}
export const TRAIT_SYNERGIES = traitTable(DEFAULT_AUTO_BATTLER_CONTENT);

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
  | { kind: "strike"; attackerUid: string; targetUid: string; damage: number; targetHp: number; crit?: boolean; splash?: boolean }
  | { kind: "heal"; uid: string; amount: number; targetHp: number }
  | { kind: "trait_trigger"; trait: TraitId; label: string; detail?: string }
  | { kind: "unit_down"; uid: string; owner: number }
  | CombatVfxEntry
  | { kind: "combat_end"; winnerSeat: number | null; damageToLoser: number };

/**
 * Creator-tunable genre knobs (generic auto-battler rules, not roster content).
 * Every field is optional; omitted fields fall back to the kernel defaults.
 */
export type AutoBattlerTuning = {
  prepShopSeconds?: number;
  prepPlaceSeconds?: number;
  startHp?: number;
  startGold?: number;
  /** Own-half columns (default 7). */
  boardCols?: number;
  /** Own-half rows (default 2). */
  boardRows?: number;
};

/** Inclusive bounds a tuning value must satisfy (validated on every write path). */
export const AUTO_BATTLER_TUNING_LIMITS: Record<keyof AutoBattlerTuning, { min: number; max: number }> = {
  prepShopSeconds: { min: 10, max: 300 },
  prepPlaceSeconds: { min: 10, max: 300 },
  startHp: { min: 1, max: 200 },
  startGold: { min: 0, max: 100 },
  boardCols: { min: 4, max: 8 },
  boardRows: { min: 1, max: 3 },
};

/** Resolve board half size from tuning (falls back to defaults). */
export function boardDims(tuning?: AutoBattlerTuning | null): { cols: number; rows: number; slots: number } {
  const cols = tuning?.boardCols ?? BOARD_COLS;
  const rows = tuning?.boardRows ?? BOARD_ROWS;
  return { cols, rows, slots: cols * rows };
}

export function normalizeAutoBattlerTuning(raw: unknown): AutoBattlerTuning | null {
  if (raw === undefined) return {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: AutoBattlerTuning = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const limits = AUTO_BATTLER_TUNING_LIMITS[key as keyof AutoBattlerTuning];
    if (!limits) return null;
    if (typeof value !== "number" || !Number.isInteger(value) || value < limits.min || value > limits.max) return null;
    out[key as keyof AutoBattlerTuning] = value;
  }
  return out;
}

export type AutoBattlerConfig = { playerCount: number; tuning?: AutoBattlerTuning; content?: AutoBattlerContent };

export type AutoBattlerGenre = {
  round: number;
  seats: [SeatState, SeatState];
  combatLog: CombatLogEntry[];
  lastCombat: { winnerSeat: number | null; damage: number } | null;
  nextUid: number;
  /** Epoch ms; client displays remaining seconds; worker auto-locks at expiry. */
  prepEndsAt: number;
  /** Creator tuning carried with the match so timers survive session round-trips. */
  tuning?: AutoBattlerTuning;
};

export type AutoBattlerPhase = "shop" | "place" | "ended";

function parseAutoBattlerConfig(
  raw: Record<string, unknown>,
): AutoBattlerConfig | null {
  const playerCount = raw.playerCount ?? 2;
  if (playerCount !== 2) return null;
  const tuning = normalizeAutoBattlerTuning(raw.tuning);
  if (tuning === null) return null;
  const content = raw.content === undefined ? undefined : resolveAutoBattlerContent(raw.content);
  if (content === null) return null;
  return {
    playerCount: 2,
    ...(Object.keys(tuning).length ? { tuning } : {}),
    ...(content ? { content } : {}),
  };
}

export function createAutoBattlerKernelConfig(
  tuning?: AutoBattlerTuning,
  content?: AutoBattlerContentPatch,
): PlayKernelConfig {
  return {
    kernelType: AUTO_BATTLER_KERNEL_TYPE,
    playerCount: 2,
    phases: [
      { id: "shop", name: "Shop" },
      { id: "place", name: "Place" },
      { id: "ended", name: "Ended" },
    ],
    adapter: {
      playerCount: 2,
      ...(tuning && Object.keys(tuning).length ? { tuning } : {}),
      ...(content && Object.keys(content).length ? { content } : {}),
    },
  };
}

function emptySlots<T>(n: number): Array<T | null> {
  return Array.from({ length: n }, () => null);
}

function rollShop(seed: number, sequence: number, count: number): string[] {
  const rng = createSeededRng(seed);
  const ids = active.content.units.map((unit) => unit.id);
  const shop: string[] = [];
  for (let i = 0; i < count; i += 1) {
    // Stride by shop size so consecutive refreshes (sequence+1) don't reuse 4 of 5 rolls.
    const roll = rng.at(sequence * (count + 3) + 17 + i) % ids.length;
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
    ...(genre.tuning ? { tuning: { ...genre.tuning } } : {}),
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
  const def = active.byId[unitId];
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
 * Star-up per content star rules: three ★1 of a unit → ★2 (when star2), three ★2 → ★3
 * (when star3), across board + bench.
 */
function tryMergeSeat(seat: SeatState, genre: AutoBattlerGenre): void {
  const { star2, star3 } = active.content.stars;
  if (!star2) return;
  for (const from of star3 ? [1, 2] as const : [1] as const) {
    mergeStarsOnce(seat, genre, from);
  }
  // A fresh ★2 may complete a ★3 trio.
  if (star3) mergeStarsOnce(seat, genre, 2);
}

function mergeStarsOnce(seat: SeatState, genre: AutoBattlerGenre, from: 1 | 2): void {
  let changed = true;
  while (changed) {
    changed = false;
    const groups = new Map<string, Array<{ where: "board" | "bench"; index: number; piece: Piece }>>();
    const collect = (where: "board" | "bench", slots: Array<Piece | null>) => {
      slots.forEach((piece, index) => {
        if (!piece || piece.stars !== from) return;
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
      const merged = makePiece(genre, keep.piece.unitId, keep.piece.owner, (from + 1) as StarLevel);
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

export function unitDef(unitId: string, content?: AutoBattlerContent): UnitDef | undefined {
  return content ? content.units.find((u) => u.id === unitId) : active.byId[unitId];
}

/** Trait counts on a board (for HUD rows incl. inactive traits). */
export function traitCounts(board: Array<Piece | null>, content?: AutoBattlerContent): Record<TraitId, number> {
  return withAutoBattlerContent(content, () => {
    const counts: Record<TraitId, number> = Object.fromEntries(active.content.traits.map((t) => [t.id, 0]));
    for (const piece of board) {
      const def = piece ? active.byId[piece.unitId] : undefined;
      if (def) for (const trait of def.traits) if (trait in counts) counts[trait] = (counts[trait] ?? 0) + 1;
    }
    return counts;
  });
}

export function activeSynergies(
  board: Array<Piece | null>,
  content?: AutoBattlerContent,
): Array<{ trait: TraitId; count: number; label: string; tier: number }> {
  return withAutoBattlerContent(content, () => {
    const counts = traitCounts(board);
    return active.content.traits
      .map((t) => ({ trait: t.id, count: counts[t.id] ?? 0, label: t.label, tier: traitTierIndex(t, counts[t.id] ?? 0) }))
      .filter((entry) => entry.tier >= 0);
  });
}

function applySynergiesToPiece(piece: Piece, board: Array<Piece | null>): Piece {
  const def = active.byId[piece.unitId];
  if (!def) return { ...piece };
  const syn = activeSynergies(board);
  const base = scaledStats(def, piece.stars);
  let atk = base.atk;
  let hp = base.hp;
  for (const entry of syn) {
    const bonus = active.traitById[entry.trait]!;
    atk += bonus.atkBonus;
    hp += bonus.hpBonus;
  }
  return { ...piece, atk, hp, maxHp: hp };
}

type CombatFighter = Piece & { x: number; y: number; firstStrikeDone?: boolean };

function boardToFighters(
  seat: number,
  board: Array<Piece | null>,
  dims?: { cols: number; rows: number },
): CombatFighter[] {
  const fighters: CombatFighter[] = [];
  for (let i = 0; i < board.length; i += 1) {
    const piece = board[i];
    if (!piece) continue;
    const buffed = applySynergiesToPiece(piece, board);
    const cell = arenaCell(seat, i, dims);
    fighters.push({ ...buffed, x: cell.col, y: cell.row, firstStrikeDone: false });
  }
  return fighters;
}

/**
 * Shared arena coordinates (7×4, row 0 = far edge from seat 0). Seat 0's front
 * row sits on row 2 at the tide line; seat 1 is mirrored onto rows 1..0.
 */
export function arenaCell(
  seat: number,
  boardIndex: number,
  dims?: { cols?: number; rows?: number },
): { col: number; row: number } {
  const cols = dims?.cols ?? BOARD_COLS;
  const rows = dims?.rows ?? BOARD_ROWS;
  const col = boardIndex % cols;
  const local = Math.floor(boardIndex / cols);
  return seat === 0
    ? { col, row: rows + local }
    : { col: cols - 1 - col, row: rows - 1 - local };
}

function manhattan(a: CombatFighter, b: CombatFighter): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** Effect value at the trait's current tier for a side (0 when inactive / no such effect). */
function effectValue(trait: TraitDef, count: number): number {
  const idx = traitTierIndex(trait, count);
  return idx >= 0 && trait.effect ? trait.effect.values[idx] ?? 0 : 0;
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
  const dims = boardDims(genre.tuning);
  let fighters = [
    ...boardToFighters(0, genre.seats[0].board, dims),
    ...boardToFighters(1, genre.seats[1].board, dims),
  ];
  const rng = createSeededRng(seed);
  const syn0 = activeSynergies(genre.seats[0].board);
  const syn1 = activeSynergies(genre.seats[1].board);
  const counts0 = traitCounts(genre.seats[0].board);
  const counts1 = traitCounts(genre.seats[1].board);

  const countsBy = [counts0, counts1] as const;
  const synBy = [syn0, syn1] as const;
  // Combat-start trait triggers, in content order (data-driven effect presets).
  for (const trait of active.content.traits) {
    const kind = trait.effect?.kind;
    if (kind === "shield_start") {
      for (const owner of [0, 1] as const) {
        if (!synBy[owner].some((s) => s.trait === trait.id)) continue;
        const amount = effectValue(trait, countsBy[owner][trait.id] ?? 0);
        if (amount <= 0) continue;
        log.push({ kind: "trait_trigger", trait: trait.id, label: trait.label, detail: `${trait.effect!.label} +${amount}` });
        for (const f of fighters.filter((x) => x.owner === owner && x.hp > 0)) {
          applyHeal(fighters, f.uid, amount, log);
          log.push({ kind: "vfx", preset: "shield", atUid: f.uid, amount });
        }
      }
    } else if (synBy[0].some((s) => s.trait === trait.id) || synBy[1].some((s) => s.trait === trait.id)) {
      log.push({ kind: "trait_trigger", trait: trait.id, label: trait.label, detail: trait.effect?.label ?? `${trait.label}加持` });
    }
  }
  const traitsWith = (kind: string) => active.content.traits.filter((t) => t.effect?.kind === kind);

  const healUsed = new Set<string>(); // per owner+trait: first strike of a healer trait heals
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
      const atkDef = active.byId[attacker.unitId];
      const ownCounts = countsBy[attacker.owner as 0 | 1];
      const fx = atkDef?.combatFx;
      const deal = (dmg: number, opts?: { splash?: boolean; skipAoe?: boolean }) => {
        const crit = dmg >= attacker.atk * 1.5;
        target.hp -= dmg;
        log.push({
          kind: "strike",
          attackerUid: attacker.uid,
          targetUid: target.uid,
          damage: dmg,
          targetHp: Math.max(0, target.hp),
          ...(crit ? { crit: true } : {}),
          ...(opts?.splash ? { splash: true } : {}),
        });
        const attackVfx = fx?.attackVfx ?? (opts?.splash ? "aoe" : undefined);
        if (attackVfx) {
          log.push({ kind: "vfx", preset: attackVfx, fromUid: attacker.uid, toUid: target.uid, amount: dmg });
        }
        log.push({ kind: "vfx", preset: fx?.hitVfx ?? "hit_particles", atUid: target.uid, fromUid: attacker.uid, amount: dmg });
        if (crit) {
          log.push({ kind: "vfx", preset: "crit_shake", atUid: target.uid, fromUid: attacker.uid, amount: dmg });
        }
        // Reflect presets: defender units carrying the trait bounce a share of damage back.
        const targetDef = active.byId[target.unitId];
        for (const trait of traitsWith("reflect")) {
          const ratio = effectValue(trait, countsBy[target.owner as 0 | 1][trait.id] ?? 0);
          if (ratio <= 0 || !targetDef?.traits.includes(trait.id) || target.hp <= 0) continue;
          const reflect = Math.max(1, Math.floor(dmg * ratio));
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
        // Unit attackEffect aoe_splash: damage other enemies near the primary target.
        if (!opts?.skipAoe && fx?.attackEffect?.kind === "aoe_splash" && fx.attackEffect.value > 0) {
          const splash = Math.max(1, Math.floor(attacker.atk * fx.attackEffect.value));
          log.push({ kind: "vfx", preset: "aoe", atUid: target.uid, fromUid: attacker.uid, amount: splash });
          for (const other of enemies) {
            if (other.uid === target.uid || other.hp <= 0) continue;
            if (manhattan(target, other) > 1) continue;
            other.hp -= splash;
            log.push({
              kind: "strike",
              attackerUid: attacker.uid,
              targetUid: other.uid,
              damage: splash,
              targetHp: Math.max(0, other.hp),
              splash: true,
            });
            log.push({ kind: "vfx", preset: "hit_particles", atUid: other.uid, fromUid: attacker.uid, amount: splash });
            if (other.hp <= 0) {
              other.hp = 0;
              log.push({ kind: "unit_down", uid: other.uid, owner: other.owner });
            }
          }
        }
        // Trait aoe_on_hit: same splash using trait value as ratio.
        if (!opts?.skipAoe) {
          for (const trait of traitsWith("aoe_on_hit")) {
            const ratio = effectValue(trait, ownCounts[trait.id] ?? 0);
            if (ratio <= 0 || !atkDef?.traits.includes(trait.id)) continue;
            const splash = Math.max(1, Math.floor(attacker.atk * ratio));
            log.push({ kind: "vfx", preset: "aoe", atUid: target.uid, fromUid: attacker.uid, amount: splash });
            for (const other of enemies) {
              if (other.uid === target.uid || other.hp <= 0) continue;
              if (manhattan(target, other) > 1) continue;
              other.hp -= splash;
              log.push({
                kind: "strike",
                attackerUid: attacker.uid,
                targetUid: other.uid,
                damage: splash,
                targetHp: Math.max(0, other.hp),
                splash: true,
              });
              if (other.hp <= 0) {
                other.hp = 0;
                log.push({ kind: "unit_down", uid: other.uid, owner: other.owner });
              }
            }
          }
        }
      };

      deal(attacker.atk);

      // Heal presets: the first strike of a unit carrying the trait heals the neediest ally.
      for (const trait of traitsWith("heal_first_strike")) {
        const ratio = effectValue(trait, ownCounts[trait.id] ?? 0);
        const key = `${attacker.owner}:${trait.id}`;
        if (ratio <= 0 || !atkDef?.traits.includes(trait.id) || healUsed.has(key)) continue;
        healUsed.add(key);
        const allies = fighters.filter((f) => f.owner === attacker.owner && f.hp > 0);
        allies.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || a.uid.localeCompare(b.uid));
        const needy = allies[0];
        if (needy) {
          applyHeal(fighters, needy.uid, Math.max(1, Math.floor(attacker.atk * ratio)), log);
          log.push({ kind: "vfx", preset: "heal", atUid: needy.uid, fromUid: attacker.uid });
        }
      }
      // Unit combatFx heal_ally (e.g. NL「巫师有治疗」).
      if (fx?.attackEffect?.kind === "heal_ally" && !healUsed.has(`${attacker.uid}:heal_ally`)) {
        healUsed.add(`${attacker.uid}:heal_ally`);
        const allies = fighters.filter((f) => f.owner === attacker.owner && f.hp > 0);
        allies.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || a.uid.localeCompare(b.uid));
        const needy = allies[0];
        if (needy) {
          applyHeal(fighters, needy.uid, Math.max(1, Math.floor(attacker.atk * fx.attackEffect.value)), log);
          log.push({ kind: "vfx", preset: "heal", atUid: needy.uid, fromUid: attacker.uid });
        }
      }

      // Extra-hit presets: a unit's first attack fires a follow-up at ratio × atk.
      const extra = traitsWith("extra_hit")
        .filter((t) => atkDef?.traits.includes(t.id))
        .map((t) => effectValue(t, ownCounts[t.id] ?? 0))
        .find((ratio) => ratio > 0);
      if (extra !== undefined && !attacker.firstStrikeDone && target.hp > 0) {
        attacker.firstStrikeDone = true;
        deal(Math.max(1, Math.floor(attacker.atk * extra)), { skipAoe: true });
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

function setPrepDeadline(genre: AutoBattlerGenre, phase: "shop" | "place", afterMs = 0): void {
  const sec = phase === "shop"
    ? genre.tuning?.prepShopSeconds ?? PREP_SHOP_SECONDS
    : genre.tuning?.prepPlaceSeconds ?? PREP_PLACE_SECONDS;
  genre.prepEndsAt = autoBattlerNow() + afterMs + sec * 1000;
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
  // The shop clock starts after the combat replay the players are watching ends.
  setPrepDeadline(genre, "shop", genre.combatLog.length ? combatReplayDurationMs(genre.combatLog) : 0);
}

function emptySeat(seed: number, seq: number, tuning?: AutoBattlerTuning): SeatState {
  const { slots } = boardDims(tuning);
  return {
    gold: tuning?.startGold ?? START_GOLD,
    hp: tuning?.startHp ?? START_HP,
    level: START_LEVEL,
    xp: 0,
    shop: rollShop(seed, seq, SHOP_SIZE),
    bench: emptySlots(BENCH_SLOTS),
    board: emptySlots(slots),
    ready: false,
  };
}

export const autoBattlerAdapter: PlayKernelAdapter<
  AutoBattlerGenre,
  AutoBattlerConfig
> = {
  kernelType: AUTO_BATTLER_KERNEL_TYPE,
  parseConfig: parseAutoBattlerConfig,
  createGenreState(config, seed) {
    return withAutoBattlerContent(config.content, () => createGenreStateImpl(config, seed));
  },
  initialPhase() {
    return "shop";
  },
  listLegalActions(state, playerId, config) {
    return withAutoBattlerContent(config?.content, () => listLegalActionsImpl(state, playerId));
  },
  reduce(state, action, config) {
    return withAutoBattlerContent(config?.content, () => reduceImpl(state, action));
  },
};

function createGenreStateImpl(config: AutoBattlerConfig, seed: number): AutoBattlerGenre {
  {
    const tuning = config.tuning && Object.keys(config.tuning).length ? config.tuning : undefined;
    const genre: AutoBattlerGenre = {
      round: 1,
      seats: [emptySeat(seed, 1, tuning), emptySeat(seed, 2, tuning)],
      combatLog: [],
      lastCombat: null,
      nextUid: 1,
      prepEndsAt: 0,
      ...(tuning ? { tuning } : {}),
    };
    setPrepDeadline(genre, "shop");
    return genre;
  }
}

function listLegalActionsImpl(state: PlayState<AutoBattlerGenre>, playerId: number) {
  {
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
    const name = (piece: Piece) => active.byId[piece.unitId]?.name ?? piece.unitId;
    if (state.phase === "shop") {
      seat.shop.forEach((unitId, shopIndex) => {
        const def = active.byId[unitId];
        if (def && seat.gold >= def.cost && firstEmpty(seat.bench) >= 0) {
          legal.push({ type: "buy", label: `购买 ${def.name}`, payload: { shopIndex } });
        }
      });
      if (seat.gold >= REFRESH_COST) legal.push({ type: "refresh", label: "刷新商店" });
      if (seat.level < MAX_LEVEL && seat.gold >= BUY_XP_COST) {
        legal.push({ type: "buy_xp", label: "升级" });
      }
    }
    const cap = boardCap(seat.level, boardDims(state.genre.tuning).slots);
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
  }
}

function reduceImpl(state: PlayState<AutoBattlerGenre>, action: PlayAction): ReturnType<typeof autoBattlerAdapter.reduce> {
  {
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
      const def = active.byId[seat.shop[shopIndex] ?? ""];
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
      const def = piece ? active.byId[piece.unitId] : undefined;
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
      if (boardCount(seat) >= boardCap(seat.level, boardDims(genre.tuning).slots)) return null;
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
        const loser = genre.seats[result.winnerSeat === 0 ? 1 : 0]!;
        // Player HP floors at 0 (the match ends there; never show negative HP).
        loser.hp = Math.max(0, loser.hp - result.damage);
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
  }
}

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
      ...(g.tuning ? { tuning: { ...g.tuning } } : {}),
    },
  };
}

export function bindAutoBattlerFromRuntimeKernel(input: {
  playerCount: number;
  tuning?: AutoBattlerTuning;
  content?: AutoBattlerContentPatch;
}): PlayKernelConfig {
  if (input.playerCount !== 2) throw new Error("auto_battler_requires_two_players");
  return createAutoBattlerKernelConfig(input.tuning, input.content);
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

/**
 * Phase-start bot hook: at the start of a shop phase a computer seat buys and fields
 * units out of turn (it does not ready up; the prep timer or its own turn does that).
 * Pure function of (state, seat, seed, content) so the logged action replays exactly.
 * Returns null when nothing changed.
 */
export function autoBattlerBotPhaseStart(
  state: PlayState<AutoBattlerGenre>,
  seat: number,
  seed: number,
  config: PlayKernelConfig,
  content?: AutoBattlerContentPatch,
): PlayState<AutoBattlerGenre> | null {
  if (state.status !== "active" || state.phase !== "shop") return null;
  if (!state.genre.seats[seat] || state.genre.seats[seat]!.ready) return null;
  const restore = state.activePlayerId;
  let current: PlayState<AutoBattlerGenre> = { ...state, activePlayerId: seat };
  let changed = false;
  for (let i = 0; i < 24; i += 1) {
    const pick = pickAutoBattlerBotAction(current, seed, content);
    if (pick.type !== "buy" && pick.type !== "place" && pick.type !== "buy_xp") break;
    const result = applyAction(autoBattlerAdapter, current, pick, config);
    if (!result.ok) break;
    current = result.state;
    changed = true;
  }
  return changed ? { ...current, activePlayerId: restore } : null;
}

export function pickAutoBattlerBotAction(
  state: PlayState<AutoBattlerGenre>,
  seed: number,
  content?: AutoBattlerContentPatch,
): PlayAction {
  const resolved = content ? resolveAutoBattlerContent(content) ?? undefined : undefined;
  const legal = autoBattlerAdapter.listLegalActions(
    state,
    state.activePlayerId,
    { playerCount: 2, ...(resolved ? { content: resolved } : {}) },
  );
  if (!legal.length) {
    return {
      type: state.phase === "shop" ? "ready_shop" : "ready_place",
      playerId: state.activePlayerId,
    };
  }
  const seat = state.genre.seats[state.activePlayerId]!;
  const onBoard = boardCount(seat);
  const cap = boardCap(seat.level, boardDims(state.genre.tuning).slots);

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
  tuning?: AutoBattlerTuning;
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
    prepEndsAt: blob.prepEndsAt ?? autoBattlerNow() + (blob.tuning?.prepShopSeconds ?? PREP_SHOP_SECONDS) * 1000,
    ...(blob.tuning ? { tuning: { ...blob.tuning } } : {}),
  };
}
