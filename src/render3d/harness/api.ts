/**
 * Determinism harness — browser-side regression runtime (G3D-HARNESS).
 *
 * Loaded ONLY by SceneHost when `?harness=1` is present (see ./mode.ts),
 * exactly like `?perf=1` loads perf.ts. Normal players never evaluate this
 * module and never get the `window.__godeskHarness` global.
 *
 * Semantics (intentionally different from godot-mcp where noted):
 *  - ONE frame == ONE fixed `dtMs` step. `step({frames:N})` advances exactly
 *    N x dtMs of game time — NOT an unknown wall-clock duration. There is no
 *    "real frames, variable duration" trap; `durationMs` is quantised to whole
 *    fixed steps and the exact elapsed value is returned.
 *  - While frozen, no rAF frame advances state (rAF only re-presents the last
 *    deterministic frame so the canvas stays visible for a pixel gate).
 *    `digest()` is a pure read, so two consecutive calls are byte-identical.
 *  - `physicsTicks` is a genuine fixed-step accumulator at PHYSICS_DT_MS;
 *    GoDesk has no rigid-body engine, so it counts fixed simulation steps.
 *
 * digest() contains NO wall-clock timestamps, NO pixel data and NO Math.random
 * reads. Everything is state that a code change can move.
 */
import {
  HARNESS_DEFAULT_DT_MS,
  HARNESS_PHYSICS_DT_MS,
  harnessCounters,
  harnessDtMs,
  harnessFrozen,
  harnessModeEnabled,
  harnessResetClock,
  harnessAdvanceOne,
  setHarnessDt,
  setHarnessFrozen,
  setHarnessNow,
} from "./mode";
import {
  clearHarnessSeed,
  consumeSequence,
  harnessRngState,
  seedFingerprint,
  seededSequence,
  setHarnessSeed,
} from "./rng";
import { clearTuning, setTuning, tuningState } from "./tuning";

export const HARNESS_SCHEMA = "godesk-harness/digest-v1";

export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];

export type HarnessObjectState = {
  id: string;
  kind: string;
  visible: boolean;
  /** World-space position (matrixWorld decomposed). */
  position: Vec3;
  /** Euler XYZ, radians. */
  rotation: Vec3;
  quaternion: Quat;
  scale: Vec3;
};

export type HarnessTweenState = {
  id: string;
  kind: string;
  durationMs: number;
  elapsedMs: number;
  /** Raw linear progress, clamp(0..1). */
  linearProgress: number;
  /** Eased progress actually applied to the pose. */
  easedProgress: number;
  playing: boolean;
};

export type HarnessSnapshot = {
  scene: {
    objects: HarnessObjectState[];
    nodeCount: number;
    contentChildren: number;
  };
  animations: {
    busy: boolean;
    tweens: HarnessTweenState[];
  };
  camera: {
    type: "orthographic" | "perspective";
    position: Vec3;
    quaternion: Quat;
    target: Vec3;
    zoom: number;
    fov: number | null;
    aspect: number | null;
  };
  subsystems: Record<string, unknown>;
};

/** Everything SceneHost must hand to the runtime. */
export type HarnessHost = {
  /** Execute exactly ONE deterministic frame at `nowMs` with injected `deltaMs`. */
  frame: (nowMs: number, deltaMs: number) => void;
  /** Pure read of scene state; must not mutate, must not read wall clock. */
  snapshot: () => HarnessSnapshot;
  /** Snap all in-flight tweens to their final pose (used by `reset`). */
  finishTweens: () => void;
  /**
   * Harness-only fixture: run a REAL MotionController tween on a REAL
   * registered scene object from a canonical pose. Lets a regression spec
   * change a gameplay constant (`motion.placeMs`) and prove the digest moves
   * by the predicted amount, without depending on async gameplay round-trips.
   */
  playMotion: (id: string) => number;
};

export type HarnessDigest = {
  schema: string;
  clock: {
    mode: "fixed-dt";
    dtMs: number;
    gameTimeMs: number;
    frames: number;
    physicsTicks: number;
    physicsDtMs: number;
    frozen: boolean;
  };
  rng: {
    seeded: boolean;
    seed: number | null;
    draws: number;
    sequenceFingerprint: string;
  };
  tuning: Record<string, number>;
  scene: HarnessSnapshot["scene"];
  animations: HarnessSnapshot["animations"];
  camera: HarnessSnapshot["camera"];
  subsystems: HarnessSnapshot["subsystems"];
};

export type StepOptions = { frames?: number; durationMs?: number };
export type StepReport = {
  elapsedMs: number;
  frames: number;
  physicsTicks: number;
  /** Digest AFTER the step. */
  report: HarnessDigest;
};
export type StepUntilReport = {
  predicateMet: boolean;
  elapsedMs: number;
  frames: number;
  physicsTicks: number;
  predicate: string;
  error?: string;
  report: HarnessDigest;
};

export function q(value: number, digits = 6): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  const rounded = Math.round(value * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/** Normalise numbers recursively so JSON.stringify is byte-stable. */
function normalise(value: unknown): unknown {
  if (typeof value === "number") return q(value);
  if (Array.isArray(value)) return value.map(normalise);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = normalise((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  if (value === undefined || value === null || typeof value === "function" || typeof value === "symbol") return null;
  return value;
}

function digestOf(host: () => HarnessHost | null): HarnessDigest {
  const h = host();
  if (!h) throw new Error("harness: no SceneHost attached");
  const snap = h.snapshot();
  const counters = harnessCounters();
  const rng = harnessRngState();
  return normalise({
    schema: HARNESS_SCHEMA,
    clock: {
      mode: "fixed-dt",
      dtMs: q(harnessDtMs(), 9),
      gameTimeMs: q(counters.gameTimeMs, 6),
      frames: counters.frames,
      physicsTicks: counters.physicsTicks,
      physicsDtMs: q(HARNESS_PHYSICS_DT_MS, 9),
      frozen: harnessFrozen(),
    },
    rng: {
      seeded: rng.seeded,
      seed: rng.seed,
      draws: rng.draws,
      sequenceFingerprint: seedFingerprint(rng.seed),
    },
    tuning: tuningState(),
    scene: snap.scene,
    animations: snap.animations,
    camera: snap.camera,
    subsystems: snap.subsystems,
  }) as HarnessDigest;
}

function digestJsonOf(host: () => HarnessHost | null): string {
  return JSON.stringify(normalise(digestOf(host)));
}

/** Advance exactly `count` fixed steps through the host's frame function. */
function advanceOf(host: () => HarnessHost | null, count: number): void {
  const h = host();
  if (!h) throw new Error("harness: no SceneHost attached");
  const steps = Math.max(0, Math.floor(count));
  for (let i = 0; i < steps; i += 1) {
    const nowMs = harnessAdvanceOne();
    setHarnessNow(nowMs);
    h.frame(nowMs, harnessDtMs());
  }
}

function makePredicate(expression: string): (h: unknown, d: HarnessDigest) => unknown {
  // `new Function` is used only in harness mode. The app ships no CSP meta
  // tag and no CSP header, so page-evaluable expressions work.
  // eslint-disable-next-line no-new-func
  const compile = new Function("h", "d", `"use strict"; return (${expression});`);
  return compile as (h: unknown, d: HarnessDigest) => unknown;
}

function buildApi(host: () => HarnessHost | null, onDetach: () => void) {
  const digest = () => digestOf(host);
  const digestJson = () => digestJsonOf(host);

  const api = {
    version: 1 as const,
    schema: HARNESS_SCHEMA,
    defaultDtMs: HARNESS_DEFAULT_DT_MS,
    physicsDtMs: HARNESS_PHYSICS_DT_MS,

    // ---- clock -----------------------------------------------------------
    freeze: () => { setHarnessFrozen(true); return true; },
    resume: () => { setHarnessFrozen(false); return true; },
    isFrozen: () => harnessFrozen(),
    setDt: (ms: number) => setHarnessDt(ms),
    getDt: () => harnessDtMs(),
    reset: (seed?: number) => {
      harnessResetClock();
      setHarnessNow(0);
      clearTuning();
      host()?.finishTweens();
      const current = harnessRngState().seed;
      if (seed !== undefined) setHarnessSeed(seed);
      else if (current === null) clearHarnessSeed();
      else setHarnessSeed(current);
      return digestJson();
    },
    now: () => harnessCounters().gameTimeMs,

    // ---- seeded RNG ------------------------------------------------------
    setSeed: (seed: number) => { setHarnessSeed(seed); return harnessRngState(); },
    clearSeed: () => { clearHarnessSeed(); return harnessRngState(); },
    rngState: () => harnessRngState(),
    /** Consume `count` values from the LIVE injected RNG stream. */
    randomSequence: (count = 8) => consumeSequence(Math.max(0, Math.min(1024, Math.floor(count)))),
    /** Pure deterministic sequence from a seed; does NOT consume the stream. */
    seededSequence: (seed: number, count = 8) => seededSequence(seed, Math.max(0, Math.min(1024, Math.floor(count)))),

    // ---- tuning seam: change a real gameplay constant without a rebuild ----
    setTuning: (partial: Record<string, number>) => { setTuning(partial); return tuningState(); },
    getTuning: () => tuningState(),
    /**
     * Drive a real `place` tween on a real registered scene object. Returns its
     * durationMs (the tuned `motion.placeMs`), or -1 if the id is unknown.
     */
    playMotion: (id: string) => host()?.playMotion(id) ?? -1,

    // ---- state -----------------------------------------------------------
    digest,
    digestJson,
    status: () => ({
      schema: HARNESS_SCHEMA,
      frozen: harnessFrozen(),
      dtMs: harnessDtMs(),
      ...harnessCounters(),
      rng: harnessRngState(),
      tuning: tuningState(),
    }),
    /** Async SHA-256 of the exact digest JSON (secure context required). */
    digestSha256: async (): Promise<string> => {
      const bytes = new TextEncoder().encode(digestJson());
      const buf = await crypto.subtle.digest("SHA-256", bytes);
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
    },

    // ---- stepping --------------------------------------------------------
    step(options: StepOptions = {}): StepReport {
      const hasFrames = typeof options.frames === "number";
      const hasDuration = typeof options.durationMs === "number";
      if (hasFrames && hasDuration) throw new Error("harness.step: pass frames OR durationMs, not both");
      let count: number;
      if (hasFrames) count = Math.max(0, Math.floor(options.frames!));
      else if (hasDuration) count = Math.max(0, Math.round(options.durationMs! / harnessDtMs()));
      else count = 1;
      const before = harnessCounters().physicsTicks;
      advanceOf(host, count);
      return {
        elapsedMs: q(count * harnessDtMs(), 6),
        frames: count,
        physicsTicks: harnessCounters().physicsTicks - before,
        report: digest(),
      };
    },

    stepUntil(predicate: string, options: { timeoutMs?: number; maxFrames?: number } = {}): StepUntilReport {
      const timeoutMs = Math.max(0, options.timeoutMs ?? 10_000);
      const maxFrames = Math.max(1, Math.floor(options.maxFrames ?? (timeoutMs / harnessDtMs() + 1)));
      const startFrames = harnessCounters().frames;
      const startTicks = harnessCounters().physicsTicks;
      let evaluate: (h: unknown, d: HarnessDigest) => unknown;
      try {
        evaluate = makePredicate(predicate);
      } catch (error) {
        return {
          predicateMet: false, elapsedMs: 0, frames: 0, physicsTicks: 0,
          predicate, error: `predicate compile failed: ${String(error)}`, report: digest(),
        };
      }
      for (;;) {
        const d = digest();
        let met = false;
        try {
          met = Boolean(evaluate({ ...api, digest: () => d }, d));
        } catch (e) {
          return {
            predicateMet: false,
            elapsedMs: q((harnessCounters().frames - startFrames) * harnessDtMs(), 6),
            frames: harnessCounters().frames - startFrames,
            physicsTicks: harnessCounters().physicsTicks - startTicks,
            predicate, error: `predicate threw: ${String(e)}`, report: d,
          };
        }
        const frames = harnessCounters().frames - startFrames;
        if (met) {
          return {
            predicateMet: true, elapsedMs: q(frames * harnessDtMs(), 6), frames,
            physicsTicks: harnessCounters().physicsTicks - startTicks, predicate, report: d,
          };
        }
        if (frames >= maxFrames || frames * harnessDtMs() >= timeoutMs) {
          return {
            predicateMet: false, elapsedMs: q(frames * harnessDtMs(), 6), frames,
            physicsTicks: harnessCounters().physicsTicks - startTicks,
            predicate, error: "timeout", report: d,
          };
        }
        advanceOf(host, 1);
      }
    },

    /** Tear down the global (used when the SceneHost unmounts). */
    detach: onDetach,
  };
  return api;
}

export type HarnessApi = ReturnType<typeof buildApi>;

declare global {
  interface Window {
    __godeskHarness?: HarnessApi;
  }
}

let activeHost: HarnessHost | null = null;

/**
 * Attach a SceneHost to the page-level runtime. Returns a cleanup function.
 * The global is deleted when the host detaches, mirroring poster-capture.
 */
export function attachHarness(host: HarnessHost): () => void {
  if (!harnessModeEnabled()) return () => undefined;
  activeHost = host;
  setHarnessFrozen(true);
  const api = buildApi(() => activeHost, detach);
  // Conditional mount — the ONLY place this global is ever created, and it is
  // reachable only from `?harness=1` (SceneHost's lazy import branch above).
  window.__godeskHarness = api;
  document.documentElement.dataset.godeskHarness = "1";

  function detach(): void {
    if (activeHost !== host) return;
    activeHost = null;
    delete window.__godeskHarness;
    delete document.documentElement.dataset.godeskHarness;
    delete document.documentElement.dataset.godeskHarnessTuning;
  }
  return detach;
}
