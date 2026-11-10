/**
 * Determinism harness — injectable gameplay constants (G3D-HARNESS).
 *
 * A regression spec must be able to prove "change one constant -> digest moves
 * by the predicted amount" WITHOUT rebuilding the bundle. `motion.ts` reads
 * `tuningNumber("motion.placeMs", MOTION_MS.place)` instead of the literal, so
 * `?harness=1&motion.placeMs=560` (or `setTuning({ "motion.placeMs": 560 })`)
 * is behaviourally identical to editing the constant in source and rebuilding.
 *
 * With no override installed this returns `fallback` behind one Map lookup —
 * normal players get exactly the shipped constants.
 */
export type TuningKey = "motion.placeMs" | "motion.removeMs" | "motion.robberMs" | "motion.diceMs" | "motion.cameraMs";

const overrides = new Map<string, number>();

export function tuningNumber(key: string, fallback: number): number {
  const value = overrides.get(key);
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function setTuning(partial: Record<string, number>): void {
  for (const [key, value] of Object.entries(partial)) {
    if (Number.isFinite(value) && value >= 0) overrides.set(key, value);
  }
  if (typeof document !== "undefined") {
    document.documentElement.dataset.godeskHarnessTuning = JSON.stringify(tuningState());
  }
}

export function clearTuning(): void {
  overrides.clear();
  if (typeof document !== "undefined") delete document.documentElement.dataset.godeskHarnessTuning;
}

export function tuningState(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of [...overrides.keys()].sort()) out[key] = overrides.get(key)!;
  return out;
}

// Boot-time overrides, before any tween is created.
if (typeof location !== "undefined") {
  try {
    const params = new URLSearchParams(location.search);
    const harness = params.get("harness");
    if (harness === "1" || harness === "true") {
      for (const [key, value] of params) {
        if (!key.startsWith("motion.")) continue;
        const n = Number(value);
        if (Number.isFinite(n) && n >= 0) overrides.set(key, n);
      }
    }
  } catch {
    /* no overrides */
  }
}
