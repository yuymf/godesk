/**
 * Determinism harness — the always-on slice (G3D-HARNESS).
 *
 * This module is imported by SceneHost on the normal render path, so it must
 * stay tiny: in normal mode every function below is a cheap boolean check and
 * `wallOrHarnessNow()` is exactly `performance.now()`. The public API
 * (step / digest / stepUntil) lives in `./api.ts` and is loaded with a dynamic
 * import ONLY when `?harness=1` is present.
 *
 * Normal players never get a `window.__godeskHarness` global and never run a
 * simulation frame through this clock.
 */

export function harnessModeEnabled(search: string = typeof location === "undefined" ? "" : location.search): boolean {
  try {
    const value = new URLSearchParams(search).get("harness");
    return value === "1" || value === "true";
  } catch {
    return false;
  }
}

export const HARNESS_DEFAULT_DT_MS = 1000 / 60;
export const HARNESS_PHYSICS_DT_MS = 1000 / 60;

let virtualNowMs = 0;
let frozen = true;
let dtMs = HARNESS_DEFAULT_DT_MS;
let frames = 0;
let physicsTicks = 0;
let physicsAccumulatorMs = 0;

export function setHarnessNow(ms: number): void { virtualNowMs = ms; }
export function harnessNowMs(): number { return virtualNowMs; }
export function harnessFrozen(): boolean { return frozen; }
export function setHarnessFrozen(next: boolean): void { frozen = next; }
export function harnessDtMs(): number { return dtMs; }

export function setHarnessDt(ms: number): number {
  if (!Number.isFinite(ms) || ms <= 0 || ms > 1000) {
    throw new Error(`harness.setDt: expected 0 < ms <= 1000, got ${ms}`);
  }
  dtMs = ms;
  return ms;
}

export function harnessCounters(): { frames: number; physicsTicks: number; gameTimeMs: number } {
  return { frames, physicsTicks, gameTimeMs: virtualNowMs };
}

/** Advance ONE fixed step. Returns the new virtual timestamp. */
export function harnessAdvanceOne(): number {
  virtualNowMs = Math.round((virtualNowMs + dtMs) * 1e9) / 1e9;
  frames += 1;
  physicsAccumulatorMs += dtMs;
  while (physicsAccumulatorMs + 1e-9 >= HARNESS_PHYSICS_DT_MS) {
    physicsAccumulatorMs -= HARNESS_PHYSICS_DT_MS;
    physicsTicks += 1;
  }
  return virtualNowMs;
}

export function harnessResetClock(): void {
  virtualNowMs = 0;
  frames = 0;
  physicsTicks = 0;
  physicsAccumulatorMs = 0;
  frozen = true;
}

/**
 * Single time source for everything SceneHost owns: tween start times, shadow
 * refresh deadlines and frame stamps. In normal mode this is `performance.now`
 * (byte-for-byte the old behaviour). In harness mode it is the virtual clock,
 * so wall time never leaks into simulation state.
 */
export function wallOrHarnessNow(): number {
  return harnessModeEnabled() ? virtualNowMs : (typeof performance !== "undefined" ? performance.now() : Date.now());
}
