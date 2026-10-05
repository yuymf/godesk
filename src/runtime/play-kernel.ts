/**
 * Public play-kernel contract (Sol max §3.2 / PR4).
 *
 * Owns: state envelope, legal actions, phase hooks, seeded RNG, append-only
 * events, fail-closed apply, and deterministic replay.
 * Does NOT own: hex/grid topology, resources, dice-as-universal-turn, or
 * genre visuals — those live in adapters (stubs OK; Othello/Catan = PR5/PR6).
 *
 * GameSpec / KERNEL_CAPABILITIES remain authoritative for which kernelType
 * may become executable. Unknown kernels stay fail-closed upstream.
 */

export type PlayerId = number;

export type PlayPhaseId = string;

/** Genre-agnostic action sent by UI / AI through the same entry. */
export type PlayAction = {
  type: string;
  playerId: PlayerId;
  payload?: Record<string, unknown>;
};

export type LegalAction = {
  type: string;
  label: string;
  /** Optional structured payload template (e.g. cell coordinate). */
  payload?: Record<string, unknown>;
};

export type PlayEvent =
  | { kind: "initialized"; seed: number; phase: PlayPhaseId; playerCount: number }
  | { kind: "action_applied"; action: PlayAction; sequence: number; phase: PlayPhaseId }
  | { kind: "phase_advanced"; from: PlayPhaseId; to: PlayPhaseId; sequence: number }
  | { kind: "pass"; playerId: PlayerId; sequence: number }
  | { kind: "ended"; reason: string; winnerId: PlayerId | null; sequence: number };

export type PlayStatus = "active" | "complete";

/**
 * Public state envelope. Adapter-private fields live under `genre` only.
 * Intentionally has no hex / resource / dice / road required fields.
 */
export type PlayState<TGenre = unknown> = {
  seed: number;
  sequence: number;
  phase: PlayPhaseId;
  activePlayerId: PlayerId;
  playerCount: number;
  status: PlayStatus;
  winnerId: PlayerId | null;
  /** Append-only event log suitable for HUD subscribers / replay. */
  events: readonly PlayEvent[];
  /** Opaque genre payload supplied by the adapter. */
  genre: TGenre;
};

/** Kernel binding used to create initial state. No Catan-only required keys. */
export type PlayKernelConfig = {
  /** Must match a registered Executable Kernel type when bound to GameSpec. */
  kernelType: string;
  playerCount: number;
  phases: readonly { id: PlayPhaseId; name: string }[];
  /** Adapter-private options (opaque to the public layer). */
  adapter: Record<string, unknown>;
};

type ApplyActionResult<TGenre = unknown> =
  | { ok: true; state: PlayState<TGenre> }
  | { ok: false; state: PlayState<TGenre>; reason: string };

export type PlayKernelAdapter<TGenre, TConfig extends Record<string, unknown>> = {
  /** Registered kernel type this adapter implements. */
  kernelType: string;
  parseConfig(raw: Record<string, unknown>): TConfig | null;
  createGenreState(config: TConfig, seed: number, playerCount: number): TGenre;
  initialPhase(config: TConfig): PlayPhaseId;
  listLegalActions(
    state: PlayState<TGenre>,
    playerId: PlayerId,
    config: TConfig,
  ): LegalAction[];
  /**
   * Apply a legal action. Must return null when illegal — public applyAction
   * then fail-closes with the prior state unchanged.
   */
  reduce(
    state: PlayState<TGenre>,
    action: PlayAction,
    config: TConfig,
  ): {
    genre: TGenre;
    phase: PlayPhaseId;
    activePlayerId: PlayerId;
    status: PlayStatus;
    winnerId: PlayerId | null;
    passed?: boolean;
    endReason?: string;
  } | null;
  /**
   * Optional explicit phase transition (e.g. discuss → accuse). When omitted,
   * phase changes only happen inside `reduce`.
   */
  advancePhase?(
    state: PlayState<TGenre>,
    config: TConfig,
  ): {
    genre: TGenre;
    phase: PlayPhaseId;
    activePlayerId: PlayerId;
    status: PlayStatus;
    winnerId: PlayerId | null;
    endReason?: string;
  } | null;
};

/** Deterministic xorshift32 RNG (matches worker/runtime nextRandom). */
function nextRandom(state: number): number {
  let value = state | 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return value >>> 0;
}

export function createSeededRng(seed: number): {
  /** Current internal state (unsigned). */
  state: () => number;
  next: () => number;
  /** Value after advancing `sequence` steps from the original seed. */
  at: (sequence: number) => number;
} {
  let current = (seed >>> 0) || 1;
  return {
    state: () => current,
    next: () => {
      current = nextRandom(current);
      return current;
    },
    at: (sequence: number) => {
      let random = (seed >>> 0) || 1;
      for (let index = 0; index < sequence; index += 1) {
        random = nextRandom(random);
      }
      return random;
    },
  };
}

/** Stable JSON for hashing / replay equality (sorted object keys). */
function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      return Object.fromEntries(
        Object.entries(item as Record<string, unknown>).sort(([a], [b]) =>
          a.localeCompare(b),
        ),
      );
    }
    return item;
  });
}

/** FNV-1a 32-bit over canonical JSON — enough for replay equality checks. */
export function hashPlayState(state: PlayState<unknown>): string {
  // Events are excluded from the hash so two independent replays of the same
  // action log compare equal even if callers snapshot events differently.
  const { events: _events, ...rest } = state;
  const text = canonicalJson(rest);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function createInitialState<TGenre, TConfig extends Record<string, unknown>>(
  adapter: PlayKernelAdapter<TGenre, TConfig>,
  config: PlayKernelConfig,
  seed: number,
): PlayState<TGenre> {
  if (config.kernelType !== adapter.kernelType) {
    throw new Error(
      `play_kernel_mismatch: config ${config.kernelType} ≠ adapter ${adapter.kernelType}`,
    );
  }
  if (!Number.isInteger(config.playerCount) || config.playerCount < 1) {
    throw new Error("play_kernel_invalid_player_count");
  }
  if (!Number.isInteger(seed) || seed < 0) {
    throw new Error("play_kernel_invalid_seed");
  }
  const parsed = adapter.parseConfig(config.adapter);
  if (!parsed) {
    throw new Error(`play_kernel_invalid_adapter_config:${adapter.kernelType}`);
  }
  const phase = adapter.initialPhase(parsed);
  if (config.phases.length && !config.phases.some((entry) => entry.id === phase)) {
    throw new Error(`play_kernel_unknown_initial_phase:${phase}`);
  }
  const genre = adapter.createGenreState(parsed, seed, config.playerCount);
  const initialized: PlayEvent = {
    kind: "initialized",
    seed,
    phase,
    playerCount: config.playerCount,
  };
  return {
    seed,
    sequence: 0,
    phase,
    activePlayerId: 0,
    playerCount: config.playerCount,
    status: "active",
    winnerId: null,
    events: [initialized],
    genre,
  };
}

export function listLegalActions<TGenre, TConfig extends Record<string, unknown>>(
  adapter: PlayKernelAdapter<TGenre, TConfig>,
  state: PlayState<TGenre>,
  playerId: PlayerId,
  config: PlayKernelConfig,
): LegalAction[] {
  if (state.status !== "active") return [];
  const parsed = adapter.parseConfig(config.adapter);
  if (!parsed) return [];
  return adapter.listLegalActions(state, playerId, parsed);
}

/**
 * Validate + apply. Illegal actions fail closed: returned state is the same
 * object reference (no mutation, no event append).
 */
export function applyAction<TGenre, TConfig extends Record<string, unknown>>(
  adapter: PlayKernelAdapter<TGenre, TConfig>,
  state: PlayState<TGenre>,
  action: PlayAction,
  config: PlayKernelConfig,
): ApplyActionResult<TGenre> {
  if (state.status !== "active") {
    return { ok: false, state, reason: "game_complete" };
  }
  if (action.playerId !== state.activePlayerId) {
    return { ok: false, state, reason: "not_active_player" };
  }
  const parsed = adapter.parseConfig(config.adapter);
  if (!parsed) {
    return { ok: false, state, reason: "invalid_adapter_config" };
  }
  const legal = adapter.listLegalActions(state, action.playerId, parsed);
  const allowed = legal.some((entry) => entry.type === action.type);
  if (!allowed) {
    return { ok: false, state, reason: "illegal_action" };
  }
  const reduced = adapter.reduce(state, action, parsed);
  if (!reduced) {
    return { ok: false, state, reason: "illegal_action" };
  }

  const sequence = state.sequence + 1;
  const events: PlayEvent[] = [
    ...state.events,
    {
      kind: "action_applied",
      action,
      sequence,
      phase: reduced.phase,
    },
  ];
  if (reduced.passed) {
    events.push({ kind: "pass", playerId: action.playerId, sequence });
  }
  if (reduced.phase !== state.phase) {
    events.push({
      kind: "phase_advanced",
      from: state.phase,
      to: reduced.phase,
      sequence,
    });
  }
  if (reduced.status === "complete") {
    events.push({
      kind: "ended",
      reason: reduced.endReason ?? "end_condition",
      winnerId: reduced.winnerId,
      sequence,
    });
  }

  return {
    ok: true,
    state: {
      seed: state.seed,
      sequence,
      phase: reduced.phase,
      activePlayerId: reduced.activePlayerId,
      playerCount: state.playerCount,
      status: reduced.status,
      winnerId: reduced.winnerId,
      events,
      genre: reduced.genre,
    },
  };
}

export function advancePhase<TGenre, TConfig extends Record<string, unknown>>(
  adapter: PlayKernelAdapter<TGenre, TConfig>,
  state: PlayState<TGenre>,
  config: PlayKernelConfig,
): ApplyActionResult<TGenre> {
  if (!adapter.advancePhase) {
    return { ok: false, state, reason: "phase_advance_unsupported" };
  }
  if (state.status !== "active") {
    return { ok: false, state, reason: "game_complete" };
  }
  const parsed = adapter.parseConfig(config.adapter);
  if (!parsed) {
    return { ok: false, state, reason: "invalid_adapter_config" };
  }
  const advanced = adapter.advancePhase(state, parsed);
  if (!advanced) {
    return { ok: false, state, reason: "phase_advance_illegal" };
  }
  const sequence = state.sequence + 1;
  const events: PlayEvent[] = [
    ...state.events,
    {
      kind: "phase_advanced",
      from: state.phase,
      to: advanced.phase,
      sequence,
    },
  ];
  if (advanced.status === "complete") {
    events.push({
      kind: "ended",
      reason: advanced.endReason ?? "end_condition",
      winnerId: advanced.winnerId,
      sequence,
    });
  }
  return {
    ok: true,
    state: {
      seed: state.seed,
      sequence,
      phase: advanced.phase,
      activePlayerId: advanced.activePlayerId,
      playerCount: state.playerCount,
      status: advanced.status,
      winnerId: advanced.winnerId,
      events,
      genre: advanced.genre,
    },
  };
}

/**
 * Replay: same seed + action sequence → identical terminal hash/state body.
 * Rejected actions are skipped (fail closed) so callers can feed raw logs.
 */
export function replay<TGenre, TConfig extends Record<string, unknown>>(
  adapter: PlayKernelAdapter<TGenre, TConfig>,
  config: PlayKernelConfig,
  seed: number,
  actions: readonly PlayAction[],
): PlayState<TGenre> {
  let state = createInitialState(adapter, config, seed);
  for (const action of actions) {
    const result = applyAction(adapter, state, action, config);
    if (result.ok) state = result.state;
  }
  return state;
}

/** Keys that must NEVER appear as required fields on the public envelope. */
export const PUBLIC_LAYER_FORBIDDEN_REQUIRED_KEYS = [
  "hex",
  "hexes",
  "tiles",
  "resources",
  "resourceBank",
  "dice",
  "diceRoll",
  "roads",
  "settlements",
  "cities",
  "robber",
  "victoryPoints",
] as const;
